'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Package, Search, X, XCircle } from 'lucide-react';
import { Metadata, Product, SoldProductPayload } from '@/lib/api';
import { SHOE_SIZES } from '@/lib/constants';

type SaleMode = 'pair' | 'box';

interface SoldProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SoldProductPayload) => Promise<string>;
  metadata: Metadata;
  products: Product[];
  isSubmitting?: boolean;
}

interface SoldProductFormState {
  artNo: string;
  colourName: string;
  materialType: string;
  size: string;
  soldPrice: string;
  boxQuantity: string;
  pairPrice: string;
  boxPrice: string;
  boxStockId: string;
}

const initialFormState: SoldProductFormState = {
  artNo: '',
  colourName: '',
  materialType: '',
  size: '',
  soldPrice: '',
  boxQuantity: '1',
  pairPrice: '',
  boxPrice: '',
  boxStockId: '',
};

function sizesFromBoxRange(sizeRange: string) {
  return String(sizeRange || '')
    .split(',')
    .map((part) => part.trim().split('x')[0])
    .map(Number)
    .filter((size) => (SHOE_SIZES as readonly number[]).includes(size));
}

function pairCountFromBoxRange(sizeRange: string) {
  return String(sizeRange || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((total, part) => {
      const match = part.match(/^(\d+)(?:x(\d+))?$/);
      if (!match) return total;
      return total + (match[2] ? Number(match[2]) : 1);
    }, 0);
}

function availableSizesForProduct(product: Product | null) {
  if (!product) return [];

  const quantities = new Map<number, number>();
  (product.inventory || [])
    .filter((item) => item.quantity > 0)
    .forEach((item) => quantities.set(item.size, item.quantity));

  (product.boxStock || [])
    .filter((item) => item.quantity > 0)
    .flatMap((item) => sizesFromBoxRange(item.sizeRange))
    .forEach((size) => {
      if (!quantities.has(size)) quantities.set(size, 0);
    });

  return [...quantities.entries()]
    .map(([size, quantity]) => ({ size, quantity }))
    .sort((left, right) => left.size - right.size);
}

function formatMoneyInput(value: number) {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
}

// New sold-product feature code starts.
export function SoldProductModal({
  isOpen,
  onClose,
  onSubmit,
  metadata,
  products,
  isSubmitting = false,
}: SoldProductModalProps) {
  const [saleMode, setSaleMode] = useState<SaleMode>('pair');
  const [formData, setFormData] = useState<SoldProductFormState>(initialFormState);
  const [productSearch, setProductSearch] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSaleMode('pair');
      setFormData(initialFormState);
      setProductSearch('');
      setSelectedVariantId(null);
      setError(null);
    }
  }, [isOpen]);

  const stockProducts = useMemo(
    () =>
      products.filter((product) => {
        const hasPairStock =
          (product.inventory || []).some((item) => item.quantity > 0) ||
          (product.boxStock || []).some((item) => item.quantity > 0);
        const hasBoxStock = (product.boxStock || []).some((item) => item.quantity > 0);
        return saleMode === 'box' ? hasBoxStock : hasPairStock;
      }),
    [products, saleMode]
  );

  const filteredStockProducts = useMemo(() => {
    const tokens = productSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = tokens.length
      ? stockProducts.filter((product) => {
          const sizes = (product.inventory || [])
            .filter((item) => item.quantity > 0)
            .map((item) => `${item.size} ${item.size}x${item.quantity}`)
            .join(' ');
          const boxStock = (product.boxStock || [])
            .filter((item) => item.quantity > 0)
            .map((item) => `${item.quantity} ${item.sizeRange}`)
            .join(' ');
          const text = [
            product.artNo,
            product.name,
            product.colour,
            product.material,
            product.type,
            product.price,
            sizes,
            boxStock,
          ]
            .join(' ')
            .toLowerCase();
          return tokens.every((token) => text.includes(token));
        })
      : stockProducts;

    return matches.slice(0, 8);
  }, [productSearch, stockProducts]);

  const selectedProduct = useMemo(
    () => stockProducts.find((product) => product.variantId === selectedVariantId) || null,
    [selectedVariantId, stockProducts]
  );

  const availableSizes = availableSizesForProduct(selectedProduct);
  const availableBoxes = useMemo(
    () => (selectedProduct?.boxStock || []).filter((item) => item.quantity > 0),
    [selectedProduct]
  );
  const selectedBox = useMemo(
    () => availableBoxes.find((item) => String(item.id) === formData.boxStockId) || availableBoxes[0] || null,
    [availableBoxes, formData.boxStockId]
  );
  const selectedBoxPairCount = selectedBox ? pairCountFromBoxRange(selectedBox.sizeRange) : 0;

  if (!isOpen) return null;

  const updateField = (field: keyof SoldProductFormState, value: string) => {
    setFormData((current) => {
      const next = { ...current, [field]: value };
      const pairPrice = Number(field === 'pairPrice' ? value : next.pairPrice);
      const nextBox = field === 'boxStockId' ? availableBoxes.find((item) => String(item.id) === value) : selectedBox;
      const pairCount = nextBox ? pairCountFromBoxRange(nextBox.sizeRange) : selectedBoxPairCount;

      if ((field === 'pairPrice' || field === 'boxStockId') && Number.isFinite(pairPrice) && pairPrice >= 0 && pairCount > 0) {
        next.boxPrice = formatMoneyInput(pairPrice * pairCount);
      }

      return next;
    });

    if (field === 'artNo' || field === 'colourName' || field === 'materialType') {
      setSelectedVariantId(null);
    }
    setError(null);
  };

  const selectProduct = (product: Product) => {
    const firstAvailableSize = availableSizesForProduct(product)[0];
    const firstBox = (product.boxStock || []).find((item) => item.quantity > 0);
    const pairPrice = String(product.price || '');
    const pairCount = firstBox ? pairCountFromBoxRange(firstBox.sizeRange) : 0;

    setSelectedVariantId(product.variantId || null);
    setProductSearch(`${product.artNo} ${product.colour} ${product.material}`);
    setFormData((current) => ({
      ...current,
      artNo: product.artNo,
      colourName: product.colour,
      materialType: product.material,
      size: firstAvailableSize ? String(firstAvailableSize.size) : current.size,
      soldPrice: current.soldPrice || pairPrice,
      pairPrice: current.pairPrice || pairPrice,
      boxPrice: current.boxPrice || formatMoneyInput(Number(pairPrice) * pairCount),
      boxStockId: firstBox ? String(firstBox.id) : '',
    }));
    setError(null);
  };

  const changeSaleMode = (mode: SaleMode) => {
    setSaleMode(mode);
    setError(null);
    setFormData((current) => {
      if (!selectedProduct) return current;

      const firstSize = availableSizesForProduct(selectedProduct)[0];
      const firstBox = (selectedProduct.boxStock || []).find((item) => item.quantity > 0);
      const pairPrice = current.pairPrice || current.soldPrice || String(selectedProduct.price || '');
      const pairCount = firstBox ? pairCountFromBoxRange(firstBox.sizeRange) : 0;

      return {
        ...current,
        size: mode === 'pair' && firstSize ? String(firstSize.size) : current.size,
        pairPrice,
        boxPrice: mode === 'box' ? current.boxPrice || formatMoneyInput(Number(pairPrice) * pairCount) : current.boxPrice,
        boxStockId: mode === 'box' && firstBox ? String(firstBox.id) : current.boxStockId,
      };
    });
  };

  const resetAndClose = () => {
    setFormData(initialFormState);
    setProductSearch('');
    setSelectedVariantId(null);
    onClose();
  };

  const submitPairSale = async (soldPrice: number) => {
    const quantity = 1;
    const payload: SoldProductPayload = {
      sale_type: 'pair',
      art_no: formData.artNo.trim(),
      colour_name: formData.colourName.trim(),
      material_type: formData.materialType.trim(),
      size: formData.size,
      sold_price: soldPrice,
      quantity,
    };

    try {
      await onSubmit(payload);
      resetAndClose();
    } catch (submitError) {
      if (
        submitError instanceof Error &&
        (submitError as any).requiresBoxOpen &&
        window.confirm(`${submitError.message}\n\nBitta qutini ochib sotishni davom ettirasizmi?`)
      ) {
        try {
          await onSubmit({ ...payload, open_box_if_needed: true });
          resetAndClose();
          return;
        } catch (retryError) {
          setError(retryError instanceof Error ? retryError.message : 'Qutini ochib mahsulotni sotilgan deb belgilab bo\'lmadi.');
          return;
        }
      }

      setError(submitError instanceof Error ? submitError.message : 'Mahsulotni sotilgan deb belgilab bo\'lmadi.');
    }
  };

  const submitBoxSale = async (pairPrice: number, boxPrice: number, quantity: number) => {
    await onSubmit({
      sale_type: 'box',
      art_no: formData.artNo.trim(),
      colour_name: formData.colourName.trim(),
      material_type: formData.materialType.trim(),
      quantity,
      pair_price: pairPrice,
      box_price: boxPrice,
      box_stock_id: selectedBox?.id,
    });
    resetAndClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.artNo.trim() || !formData.colourName.trim() || !formData.materialType.trim()) {
      setError('Iltimos, barcha majburiy maydonlarni to\'ldiring.');
      return;
    }

    if (saleMode === 'pair') {
      const soldPrice = Number(formData.soldPrice);
      if (!formData.size || !formData.soldPrice.trim()) {
        setError('Iltimos, barcha majburiy maydonlarni to\'ldiring.');
        return;
      }

      if (!Number.isFinite(soldPrice) || soldPrice < 0) {
        setError('Sotilgan narx 0 yoki undan katta bo\'lishi kerak.');
        return;
      }

      await submitPairSale(soldPrice);
      return;
    }

    const quantity = Number(formData.boxQuantity);
    const pairPrice = Number(formData.pairPrice);
    const boxPrice = Number(formData.boxPrice);

    if (!selectedBox) {
      setError('Quti zaxirasi mavjud mahsulotni tanlang.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError('Quti soni musbat butun son bo\'lishi kerak.');
      return;
    }

    if (quantity > selectedBox.quantity) {
      setError(`Faqat ${selectedBox.quantity} ta ochilmagan quti mavjud.`);
      return;
    }

    if (!Number.isFinite(pairPrice) || pairPrice < 0 || !Number.isFinite(boxPrice) || boxPrice < 0) {
      setError('Narxlar 0 yoki undan katta bo\'lishi kerak.');
      return;
    }

    try {
      await submitBoxSale(pairPrice, boxPrice, quantity);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Qutini sotilgan deb belgilab bo\'lmadi.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sotilgan mahsulot</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Sotilgan mahsulot formasini yopish"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800">
                {(['pair', 'box'] as SaleMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => changeSaleMode(mode)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      saleMode === mode
                        ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
                    }`}
                  >
                    {mode === 'pair' ? 'Dona sotish' : 'Quti sotish'}
                  </button>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Ombordan mahsulot topish
                </label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setSelectedVariantId(null);
                      setError(null);
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder={saleMode === 'box' ? 'Art no, rang, material yoki quti oralig\'i...' : 'Art no, rang, material yoki razmer...'}
                  />
                </div>

                <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                  {filteredStockProducts.length > 0 ? (
                    filteredStockProducts.map((product) => {
                      const sizes = (product.inventory || []).filter((item) => item.quantity > 0);
                      const boxStock = (product.boxStock || []).filter((item) => item.quantity > 0);
                      const isSelected = selectedVariantId === product.variantId;

                      return (
                        <button
                          key={product.variantId ? `variant-${product.variantId}` : `product-${product.id}`}
                          type="button"
                          onClick={() => selectProduct(product)}
                          className={`w-full rounded-lg border p-3 text-left transition ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                              <Package className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-bold text-gray-900 dark:text-gray-100">{product.artNo}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {product.colour} / {product.material}
                                </span>
                              </div>
                              <p className="truncate text-xs text-gray-600 dark:text-gray-400">{product.name}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {saleMode === 'pair' &&
                                  sizes.map((item) => (
                                    <span
                                      key={item.size}
                                      className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                    >
                                      {item.size}x{item.quantity}
                                    </span>
                                  ))}
                                {boxStock.map((item) => (
                                  <span
                                    key={item.id}
                                    className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
                                  >
                                    {item.quantity} {item.sizeRange}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                      Omborda mos mahsulot topilmadi
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Art no <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.artNo}
                  onChange={(event) => updateField('artNo', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="Masalan, ART-001"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Rang <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    list="sold-product-colours"
                    value={formData.colourName}
                    onChange={(event) => updateField('colourName', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="Masalan, Black"
                  />
                  <datalist id="sold-product-colours">
                    {metadata.colours.map((colour) => (
                      <option key={colour} value={colour} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Material turi <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    list="sold-product-materials"
                    value={formData.materialType}
                    onChange={(event) => updateField('materialType', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="Masalan, Leather"
                  />
                  <datalist id="sold-product-materials">
                    {metadata.materials.map((material) => (
                      <option key={material} value={material} />
                    ))}
                  </datalist>
                </div>
              </div>

              {saleMode === 'pair' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Razmer <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={formData.size}
                      onChange={(event) => updateField('size', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="">Tanlang</option>
                      {(availableSizes.length > 0 ? availableSizes.map((item) => item.size) : SHOE_SIZES).map((size) => (
                        <option key={size} value={String(size)}>
                          {size}
                        </option>
                      ))}
                    </select>
                    {selectedProduct && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Mavjud:{' '}
                        {availableSizes
                          .map((item) => (item.quantity > 0 ? `${item.size}x${item.quantity}` : `${item.size} qutida`))
                          .join(', ')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Sotilgan narx <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.soldPrice}
                      onChange={(event) => updateField('soldPrice', event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedProduct && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Quti zaxirasi <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={formData.boxStockId || (selectedBox ? String(selectedBox.id) : '')}
                        onChange={(event) => updateField('boxStockId', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        {availableBoxes.map((item) => (
                          <option key={item.id} value={String(item.id)}>
                            {item.quantity} quti - {item.sizeRange}
                          </option>
                        ))}
                      </select>
                      {selectedBox && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Bitta qutida {selectedBoxPairCount} juft bor
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Soni <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.boxQuantity}
                        onChange={(event) => updateField('boxQuantity', event.target.value.replace(/[^\d]/g, ''))}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Bir juft narxi <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.pairPrice}
                        onChange={(event) => updateField('pairPrice', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Butun quti narxi <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.boxPrice}
                        onChange={(event) => updateField('boxPrice', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
              >
                {isSubmitting ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
// New sold-product feature code ends.

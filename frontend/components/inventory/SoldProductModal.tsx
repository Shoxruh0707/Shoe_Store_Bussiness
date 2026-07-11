'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { X, XCircle } from 'lucide-react';
import { Metadata, Product, SoldProductPayload } from '@/lib/api';
import { SHOE_SIZES } from '@/lib/constants';

interface SoldProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SoldProductPayload) => Promise<string>;
  metadata: Metadata;
  products: Product[];
  isSubmitting?: boolean;
}

interface SoldProductFormState {
  productKey: string;
  productQuery: string;
  artNo: string;
  colourName: string;
  materialType: string;
  size: string;
  soldPrice: string;
  quantity: string;
}

const initialFormState: SoldProductFormState = {
  productKey: '',
  productQuery: '',
  artNo: '',
  colourName: '',
  materialType: '',
  size: '',
  soldPrice: '',
  quantity: '1',
};

function formatGroupedNumber(value: string | number) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseGroupedNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : Number.NaN;
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
  const [formData, setFormData] = useState<SoldProductFormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);

  const productOptions = useMemo(
    () =>
      products
        .map((product) => ({
          key: product.variantId ? `variant-${product.variantId}` : `${product.artNo}-${product.colour}-${product.material}`,
          product,
          stock: product.inventory.filter((item) => item.quantity > 0).sort((a, b) => a.size - b.size),
          searchText: `${product.artNo} ${product.colour} ${product.material}`.toLowerCase(),
        }))
        .filter((option) => option.stock.length > 0),
    [products]
  );

  const selectedOption = productOptions.find((option) => option.key === formData.productKey) || null;
  const productQuery = formData.productQuery.trim().toLowerCase();
  const filteredProductOptions = useMemo(
    () =>
      productQuery
        ? productOptions
            .filter((option) => productQuery.split(/\s+/).every((part) => option.searchText.includes(part)))
            .slice(0, 8)
        : [],
    [productOptions, productQuery]
  );
  const availableSizes = selectedOption?.stock || SHOE_SIZES.map((size) => ({ size, quantity: 0 }));

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateField = (field: keyof SoldProductFormState, value: string) => {
    setFormData((current) => ({
      ...current,
      productKey: ['artNo', 'colourName', 'materialType'].includes(field) ? '' : current.productKey,
      [field]: field === 'soldPrice' ? formatGroupedNumber(value) : value,
    }));
    setError(null);
  };

  const handleProductQueryChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      productKey: '',
      productQuery: value,
    }));
    setError(null);
  };

  const handleProductSelect = (productKey: string) => {
    const option = productOptions.find((item) => item.key === productKey);
    if (!option) {
      setFormData(initialFormState);
      setError(null);
      return;
    }

    const firstSize = option.stock[0];
    setFormData({
      productKey,
      productQuery: `${option.product.artNo} - ${option.product.colour} / ${option.product.material}`,
      artNo: option.product.artNo,
      colourName: option.product.colour,
      materialType: option.product.material,
      size: firstSize ? String(firstSize.size) : '',
      soldPrice: formatGroupedNumber(option.product.price || ''),
      quantity: '1',
    });
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quantity = Number(formData.quantity || 1);
    const soldPrice = parseGroupedNumber(formData.soldPrice);

    if (
      !formData.artNo.trim() ||
      !formData.colourName.trim() ||
      !formData.materialType.trim() ||
      !formData.size ||
      !formData.soldPrice.trim()
    ) {
      setError('Barcha majburiy maydonlarni to\'ldiring.');
      return;
    }

    if (!Number.isFinite(soldPrice) || soldPrice < 0) {
      setError('Sotuv narxi 0 yoki undan katta bo\'lishi kerak.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError('Sotilgan son musbat butun son bo\'lishi kerak.');
      return;
    }

    const matchingOption =
      selectedOption ||
      productOptions.find(
        (option) =>
          option.product.artNo.trim().toLowerCase() === formData.artNo.trim().toLowerCase() &&
          option.product.colour.trim().toLowerCase() === formData.colourName.trim().toLowerCase() &&
          option.product.material.trim().toLowerCase() === formData.materialType.trim().toLowerCase()
      );
    const matchingSize = matchingOption?.stock.find((item) => String(item.size) === formData.size);

    if (!matchingOption || !matchingSize) {
      setError('Bu mahsulot, rang, material va o\'lcham omborda topilmadi.');
      return;
    }

    if (quantity > matchingSize.quantity) {
      setError(`Omborda ${matchingSize.quantity} dona bor. Sotilgan sonni kamaytiring.`);
      return;
    }

    try {
      await onSubmit({
        art_no: matchingOption.product.artNo,
        colour_name: matchingOption.product.colour,
        material_type: matchingOption.product.material,
        size: formData.size,
        sold_price: soldPrice,
        quantity,
      });

      setFormData(initialFormState);
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Mahsulotni sotilgan deb belgilashda xatolik.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:flex sm:items-center sm:justify-center">
        <div className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
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

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Mahsulot <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.productQuery}
                  onChange={(event) => handleProductQueryChange(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="Art raqami, rang yoki materialni yozing"
                />
                {formData.productQuery.trim() && !selectedOption && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    {filteredProductOptions.length > 0 ? (
                      filteredProductOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleProductSelect(option.key)}
                          className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50 dark:border-gray-800 dark:hover:bg-blue-950/40"
                        >
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{option.product.artNo}</span>
                          <span className="ml-2 text-gray-600 dark:text-gray-400">
                            {option.product.colour} / {option.product.material}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                            {option.stock.map((item) => `${item.size}x${item.quantity}`).join(', ')}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        Mavjud mahsulot topilmadi
                      </div>
                    )}
                  </div>
                )}
                {selectedOption && (
                  <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                    {selectedOption.product.artNo} tanlandi: {selectedOption.product.colour} / {selectedOption.product.material}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Art raqami <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.artNo}
                  onChange={(event) => updateField('artNo', event.target.value)}
                  readOnly={Boolean(selectedOption)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="masalan, ART-001"
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
                    readOnly={Boolean(selectedOption)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="masalan, qora"
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
                    readOnly={Boolean(selectedOption)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="masalan, charm"
                  />
                  <datalist id="sold-product-materials">
                    {metadata.materials.map((material) => (
                      <option key={material} value={material} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    O'lcham <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.size}
                    onChange={(event) => updateField('size', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">Tanlang</option>
                    {availableSizes.map((item) => (
                      <option key={item.size} value={String(item.size)} disabled={item.quantity <= 0}>
                        {item.size}{item.quantity > 0 ? ` (${item.quantity} dona)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Sotuv narxi <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.soldPrice}
                    onChange={(event) => updateField('soldPrice', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Sotilgan son <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.quantity}
                    onChange={(event) => updateField('quantity', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
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

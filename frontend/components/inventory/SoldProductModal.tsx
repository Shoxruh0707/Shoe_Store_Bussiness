'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Package, Search, X, XCircle } from 'lucide-react';
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
  artNo: string;
  colourName: string;
  materialType: string;
  size: string;
  soldPrice: string;
}

const initialFormState: SoldProductFormState = {
  artNo: '',
  colourName: '',
  materialType: '',
  size: '',
  soldPrice: '',
};

function sizesFromBoxRange(sizeRange: string) {
  return String(sizeRange || '')
    .split(',')
    .map((part) => part.trim().split('x')[0])
    .map(Number)
    .filter((size) => (SHOE_SIZES as readonly number[]).includes(size));
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
  const [productSearch, setProductSearch] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setProductSearch('');
      setSelectedVariantId(null);
      setError(null);
    }
  }, [isOpen]);

  const stockProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (product.inventory || []).some((item) => item.quantity > 0) ||
          (product.boxStock || []).some((item) => item.quantity > 0)
      ),
    [products]
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

  if (!isOpen) return null;

  const updateField = (field: keyof SoldProductFormState, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (field === 'artNo' || field === 'colourName' || field === 'materialType') {
      setSelectedVariantId(null);
    }
    setError(null);
  };

  const selectProduct = (product: Product) => {
    const firstAvailableSize = availableSizesForProduct(product)[0];

    setSelectedVariantId(product.variantId || null);
    setProductSearch(`${product.artNo} ${product.colour} ${product.material}`);
    setFormData((current) => ({
      ...current,
      artNo: product.artNo,
      colourName: product.colour,
      materialType: product.material,
      size: firstAvailableSize ? String(firstAvailableSize.size) : current.size,
      soldPrice: current.soldPrice || String(product.price || ''),
    }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quantity = 1;
    const soldPrice = Number(formData.soldPrice);

    if (
      !formData.artNo.trim() ||
      !formData.colourName.trim() ||
      !formData.materialType.trim() ||
      !formData.size ||
      !formData.soldPrice.trim()
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!Number.isFinite(soldPrice) || soldPrice < 0) {
      setError('Sold price must be 0 or greater.');
      return;
    }

    try {
      const payload = {
        art_no: formData.artNo.trim(),
        colour_name: formData.colourName.trim(),
        material_type: formData.materialType.trim(),
        size: formData.size,
        sold_price: soldPrice,
        quantity,
      };

      await onSubmit(payload);

      setFormData(initialFormState);
      setProductSearch('');
      setSelectedVariantId(null);
      onClose();
    } catch (submitError) {
      if (
        submitError instanceof Error &&
        (submitError as any).requiresBoxOpen &&
        window.confirm(`${submitError.message}\n\nOpen one box and continue the sale?`)
      ) {
        try {
          await onSubmit({
            art_no: formData.artNo.trim(),
            colour_name: formData.colourName.trim(),
            material_type: formData.materialType.trim(),
            size: formData.size,
            sold_price: soldPrice,
            quantity,
            open_box_if_needed: true,
          });

          setFormData(initialFormState);
          setProductSearch('');
          setSelectedVariantId(null);
          onClose();
          return;
        } catch (retryError) {
          setError(retryError instanceof Error ? retryError.message : 'Failed to open box and mark product as sold.');
          return;
        }
      }

      setError(submitError instanceof Error ? submitError.message : 'Failed to mark product as sold.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sold Product</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close sold product form"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Find product from stock
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
                    placeholder="Search art no, colour, material, size..."
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
                                {sizes.map((item) => (
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
                      No matching products in stock
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Art number <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.artNo}
                  onChange={(event) => updateField('artNo', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="e.g., ART-001"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Color <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    list="sold-product-colours"
                    value={formData.colourName}
                    onChange={(event) => updateField('colourName', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="e.g., Black"
                  />
                  <datalist id="sold-product-colours">
                    {metadata.colours.map((colour) => (
                      <option key={colour} value={colour} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Material type <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    list="sold-product-materials"
                    value={formData.materialType}
                    onChange={(event) => updateField('materialType', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                    placeholder="e.g., Leather"
                  />
                  <datalist id="sold-product-materials">
                    {metadata.materials.map((material) => (
                      <option key={material} value={material} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Size <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.size}
                    onChange={(event) => updateField('size', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">Select</option>
                    {(availableSizes.length > 0 ? availableSizes.map((item) => item.size) : SHOE_SIZES).map((size) => (
                      <option key={size} value={String(size)}>
                        {size}
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Available: {availableSizes.map((item) => (item.quantity > 0 ? `${item.size}x${item.quantity}` : `${item.size} in box`)).join(', ')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Sold price <span className="text-red-600">*</span>
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
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
// New sold-product feature code ends.

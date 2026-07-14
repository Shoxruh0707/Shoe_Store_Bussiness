'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle, X, XCircle } from 'lucide-react';
import { Metadata, SoldProductPayload } from '@/lib/api';
import { SHOE_SIZES } from '@/lib/constants';

interface SoldProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SoldProductPayload) => Promise<string>;
  metadata: Metadata;
  isSubmitting?: boolean;
}

interface SoldProductFormState {
  artNo: string;
  colourName: string;
  materialType: string;
  size: string;
  soldPrice: string;
  quantity: string;
}

const initialFormState: SoldProductFormState = {
  artNo: '',
  colourName: '',
  materialType: '',
  size: '',
  soldPrice: '',
  quantity: '1',
};

// New sold-product feature code starts.
export function SoldProductModal({
  isOpen,
  onClose,
  onSubmit,
  metadata,
  isSubmitting = false,
}: SoldProductModalProps) {
  const [formData, setFormData] = useState<SoldProductFormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormState);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateField = (field: keyof SoldProductFormState, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quantity = Number(formData.quantity || 1);
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

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError('Quantity sold must be a positive whole number.');
      return;
    }

    try {
      const message = await onSubmit({
        art_no: formData.artNo.trim(),
        colour_name: formData.colourName.trim(),
        material_type: formData.materialType.trim(),
        size: formData.size,
        sold_price: soldPrice,
        quantity,
      });

      setSuccess(message);
      setFormData(initialFormState);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to mark product as sold.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
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
            <div className="space-y-4 p-6">
              {success && (
                <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-200">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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

              <div className="grid gap-4 sm:grid-cols-3">
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
                    {SHOE_SIZES.map((size) => (
                      <option key={size} value={String(size)}>
                        {size}
                      </option>
                    ))}
                  </select>
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

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Quantity sold <span className="text-red-600">*</span>
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

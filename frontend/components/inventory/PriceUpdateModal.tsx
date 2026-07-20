'use client';

import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, PriceUpdatePayload } from '@/lib/api';

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: PriceUpdatePayload) => Promise<boolean>;
  isSubmitting?: boolean;
}

export function PriceUpdateModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: PriceUpdateModalProps) {
  const [artNo, setArtNo] = useState('');
  const [landingPriceUpdate, setLandingPriceUpdate] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [foundProductName, setFoundProductName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetAndClose = () => {
    setArtNo('');
    setLandingPriceUpdate('');
    setSellingPrice('');
    setLookupStatus('idle');
    setFoundProductName('');
    setError(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const normalizedArtNo = artNo.trim();
    if (!normalizedArtNo) {
      setLookupStatus('idle');
      setFoundProductName('');
      return;
    }

    let cancelled = false;
    setLookupStatus('checking');
    setFoundProductName('');

    const timeout = window.setTimeout(async () => {
      try {
        const lookup = await api.lookupProductByArtNo(normalizedArtNo);
        if (cancelled) return;

        if (lookup?.product) {
          setLookupStatus('found');
          setFoundProductName(lookup.product.name || lookup.product.artNo);
        } else {
          setLookupStatus('not_found');
        }
      } catch (_lookupError) {
        if (!cancelled) {
          setLookupStatus('not_found');
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [artNo, isOpen]);

  if (!isOpen) return null;

  const parseOptionalPrice = (value: string) => {
    const text = value.trim();
    if (!text) return undefined;

    const number = Number(text.replace(/\s/g, '').replace(/,/g, '.'));
    return Number.isFinite(number) && number >= 0 ? number : null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedArtNo = artNo.trim();
    const nextLandingPrice = parseOptionalPrice(landingPriceUpdate);
    const nextSellingPrice = parseOptionalPrice(sellingPrice);

    if (!normalizedArtNo) {
      setError('Art no kiriting.');
      return;
    }

    const lookup = await api.lookupProductByArtNo(normalizedArtNo).catch(() => null);
    if (!lookup?.product) {
      setLookupStatus('not_found');
      setFoundProductName('');
      setError('Bu art no bo\'yicha mahsulot topilmadi.');
      return;
    }

    if (nextLandingPrice === null || nextSellingPrice === null) {
      setError("Narxlar 0 yoki undan katta son bo'lishi kerak.");
      return;
    }

    if (nextLandingPrice === undefined && nextSellingPrice === undefined) {
      setError("Kamida bitta narx maydonini to'ldiring.");
      return;
    }

    const saved = await onSubmit({
      artNo: normalizedArtNo,
      ...(nextLandingPrice !== undefined ? { landingPriceUpdate: nextLandingPrice } : {}),
      ...(nextSellingPrice !== undefined ? { sellingPrice: nextSellingPrice } : {}),
    });

    if (saved) resetAndClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" onClick={resetAndClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Narxni yangilash</h2>
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Narx formasini yopish"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 p-6">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Art no <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={artNo}
                  onChange={(event) => {
                    setArtNo(event.target.value);
                    setError(null);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="Masalan, ART-001"
                />
                {lookupStatus === 'checking' && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Art no tekshirilmoqda...</p>
                )}
                {lookupStatus === 'found' && (
                  <p className="mt-1 text-xs font-medium text-green-700 dark:text-green-300">
                    Mahsulot topildi: {foundProductName}
                  </p>
                )}
                {lookupStatus === 'not_found' && (
                  <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">
                    Bu art no bo'yicha mahsulot topilmadi.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Kelish narxini yangilash
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={landingPriceUpdate}
                  onChange={(event) => setLandingPriceUpdate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="Bo'sh qolsa o'zgarmaydi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Sotish narxi
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
                  placeholder="Bo'sh qolsa o'zgarmaydi"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
              <button
                type="button"
                onClick={resetAndClose}
                disabled={isSubmitting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSubmitting || lookupStatus === 'checking' || lookupStatus === 'not_found'}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {isSubmitting ? 'Saqlanmoqda...' : 'Narxni yangilash'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

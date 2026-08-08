'use client';

import { useEffect, useMemo, useState } from 'react';
import { BoxStockItem, InventoryItem, Product } from '@/lib/api';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { SHOE_SIZES } from '@/lib/constants';

type InventoryEditMode = 'pair' | 'box';

interface InventoryEditModalProps {
  isOpen: boolean;
  mode: InventoryEditMode;
  product: Product | null;
  onClose: () => void;
  onSavePair: (inventory: InventoryItem[]) => Promise<Product | null>;
  onSaveBoxes: (boxes: BoxStockItem[]) => Promise<Product | null>;
  isSubmitting?: boolean;
}

function emptyPairInventory(product: Product | null): InventoryItem[] {
  const quantities = new Map((product?.inventory || []).map((item) => [Number(item.size), Number(item.quantity || 0)]));
  return SHOE_SIZES.map((size) => ({
    size,
    quantity: quantities.get(size) || 0,
  }));
}

function emptyBoxRows(product: Product | null): BoxStockItem[] {
  return (product?.boxStock || []).map((box) => ({
    id: box.id,
    sizeRange: box.sizeRange,
    quantity: box.quantity,
  }));
}

export function InventoryEditModal({
  isOpen,
  mode,
  product,
  onClose,
  onSavePair,
  onSaveBoxes,
  isSubmitting = false,
}: InventoryEditModalProps) {
  const [pairInventory, setPairInventory] = useState<InventoryItem[]>([]);
  const [boxRows, setBoxRows] = useState<BoxStockItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPairInventory(emptyPairInventory(product));
    setBoxRows(emptyBoxRows(product));
    setError(null);
  }, [isOpen, product]);

  const title = mode === 'pair' ? 'Juft inventarini tahrirlash' : 'Quti zaxirasini tahrirlash';
  const totalPairs = useMemo(
    () => pairInventory.reduce((total, item) => total + Number(item.quantity || 0), 0),
    [pairInventory]
  );

  function updatePair(size: number, quantity: number) {
    setPairInventory((current) =>
      current.map((item) => (item.size === size ? { ...item, quantity: Math.max(0, quantity) } : item))
    );
    setError(null);
  }

  function updateBox(index: number, patch: Partial<BoxStockItem>) {
    setBoxRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    setError(null);
  }

  async function handleSave() {
    if (!product) return;

    if (mode === 'box') {
      const invalidRow = boxRows.find(
        (row) => String(row.sizeRange || '').trim().length === 0 || !Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 0
      );
      if (invalidRow) {
        setError('Har bir quti qatorida size range va 0 yoki undan katta butun son bo\'lishi kerak.');
        return;
      }
    }

    const updated =
      mode === 'pair'
        ? await onSavePair(pairInventory)
        : await onSaveBoxes(
            boxRows.map((row) => ({
              ...row,
              sizeRange: row.sizeRange.trim(),
              quantity: Math.max(0, Math.floor(Number(row.quantity || 0))),
            }))
          );

    if (updated) onClose();
    if (!updated) setError('Inventarni saqlab bo\'lmadi. Maydonlarni tekshirib qayta urinib ko\'ring.');
  }

  if (!isOpen || !product) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{product.artNo}</p>
            </div>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Yopish">
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          <div className="max-h-[calc(90vh-140px)] overflow-y-auto p-6">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
            )}

            {mode === 'pair' ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Jami juft</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalPairs}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {pairInventory.map((item) => (
                    <div
                      key={item.size}
                      className={`rounded-lg border-2 p-3 ${
                        item.quantity > 0
                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                      }`}
                    >
                      <p className="text-center text-sm font-bold text-gray-900 dark:text-gray-100">Razmer {item.size}</p>
                      <div className="mt-2 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => updatePair(item.size, item.quantity - 1)}
                          className="rounded bg-gray-200 p-1 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                          aria-label="Kamaytirish"
                        >
                          <Minus className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={item.quantity}
                          onChange={(event) => updatePair(item.size, Number(event.target.value || 0))}
                          className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-center text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => updatePair(item.size, item.quantity + 1)}
                          className="rounded bg-blue-200 p-1 hover:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-600"
                          aria-label="Ko'paytirish"
                        >
                          <Plus className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {boxRows.map((row, index) => (
                  <div key={`${row.id || 'new'}-${index}`} className="grid grid-cols-[1fr_110px_36px] gap-2">
                    <input
                      type="text"
                      value={row.sizeRange}
                      onChange={(event) => updateBox(index, { sizeRange: event.target.value })}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      placeholder="36-40,38x2"
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.quantity}
                      onChange={(event) => updateBox(index, { quantity: Number(event.target.value || 0) })}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setBoxRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      className="inline-flex items-center justify-center rounded-lg bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                      aria-label="Qatorni olib tashlash"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setBoxRows((current) => [...current, { id: 0, sizeRange: '', quantity: 1 }])}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                  Quti qatori
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
            >
              {isSubmitting ? 'Saqlanmoqda...' : 'Qo\'llash'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

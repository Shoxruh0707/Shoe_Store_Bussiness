'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, ImageIcon, RefreshCw, XCircle } from 'lucide-react';
import { api, SoldProductAnalyticsItem } from '@/lib/api';

function todayForInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// New sold-product analytics page starts.
export default function AnalyticsPage() {
  const [selectedDate, setSelectedDate] = useState(todayForInput);
  const [items, setItems] = useState<SoldProductAnalyticsItem[]>([]);
  const [canViewLandingPrice, setCanViewLandingPrice] = useState(false);
  const [soldByFilter, setSoldByFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sellerOptions = useMemo(
    () =>
      [...new Set(items.map((item) => item.soldBy).filter((seller): seller is string => Boolean(seller)))].sort(
        (left, right) => left.localeCompare(right)
      ),
    [items]
  );

  const filteredItems = useMemo(
    () => (soldByFilter ? items.filter((item) => item.soldBy === soldByFilter) : items),
    [items, soldByFilter]
  );

  const totals = useMemo(
    () =>
      filteredItems.filter((item) => !item.isCancelled).reduce(
        (summary, item) => ({
          quantity: summary.quantity + item.quantity,
          revenue: summary.revenue + item.soldPrice * item.quantity,
          landing: summary.landing + Number(item.landingPrice || 0) * item.quantity,
        }),
        { quantity: 0, revenue: 0, landing: 0 }
      ),
    [filteredItems]
  );

  const fetchSoldProducts = async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getSoldProducts(date);
      setItems(result.items);
      setCanViewLandingPrice(Boolean(result.viewer?.canViewLandingPrice));
      setSoldByFilter('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Sotilgan mahsulotlarni yuklab bo\'lmadi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSoldProducts(selectedDate);
  }, [selectedDate]);

  const cancelSale = async (item: SoldProductAnalyticsItem) => {
    if (item.isCancelled || cancellingId) return;

    const confirmed = window.confirm(`${item.artNo} sotuvini bekor qilasizmi? Mahsulot omborga qaytariladi.`);
    if (!confirmed) return;

    try {
      setCancellingId(item.id);
      setError(null);
      await api.cancelSoldProduct(item.id);
      await fetchSoldProducts(selectedDate);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Sotuvni bekor qilib bo\'lmadi.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/inventory"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Inventarga qaytish"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Tahlil</h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Kunlik sotilgan mahsulotlar</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                <CalendarDays className="h-4 w-4" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value || todayForInput())}
                  className="bg-transparent text-sm outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => fetchSoldProducts(selectedDate)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Yangilash
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Tahlilni yuklashda xatolik</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {canViewLandingPrice && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sotilgan soni</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totals.quantity}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sotuv jami</p>
              <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{money(totals.revenue)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Kelish narxi jami</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{money(totals.landing)}</p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <BarChart3 className="h-4 w-4" />
                {selectedDate} uchun sotilgan mahsulotlar
              </div>
              {canViewLandingPrice && sellerOptions.length > 0 && (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                  Sotuvchi
                  <select
                    value={soldByFilter}
                    onChange={(event) => setSoldByFilter(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">Barcha sotuvchilar</option>
                    {sellerOptions.map((seller) => (
                      <option key={seller} value={seller}>
                        {seller}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          )}

          {!loading && filteredItems.length === 0 && (
            <div className="py-10 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600" />
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Sotilgan mahsulot yo'q</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Boshqa natija uchun sana yoki sotuvchi filtrini o'zgartiring.</p>
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Rasm</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Art no</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Rang</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Material</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Turi</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Razmer</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Sotilgan narx</th>
                    {canViewLandingPrice && (
                      <>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Kelish narxi</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Sotuvchi</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Amal</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-200 dark:border-gray-800 ${
                        item.isCancelled ? 'bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                          {item.imagePath ? (
                            <img src={item.imagePath} alt={item.artNo} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{item.artNo}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.colour}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.material}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.type}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.size}</td>
                      <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-300">{money(item.soldPrice)}</td>
                      {canViewLandingPrice && (
                        <>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{money(item.landingPrice || 0)}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.soldBy || 'Yo\'q'}</td>
                          <td className="px-4 py-3 text-right">
                            {item.isCancelled ? (
                              <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-200">
                                <XCircle className="h-3.5 w-3.5" />
                                Bekor qilingan
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => cancelSale(item)}
                                disabled={Boolean(cancellingId)}
                                className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-600"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                {cancellingId === item.id ? 'Bekor qilinmoqda...' : 'Bekor qilish'}
                              </button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
// New sold-product analytics page ends.

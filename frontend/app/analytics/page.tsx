'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, ImageIcon, RefreshCw } from 'lucide-react';
import { api, AuthMe, SoldProductAnalyticsItem } from '@/lib/api';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthMe | null>(null);
  const canViewSensitiveFields = auth?.user.role === 'admin' || ['owner', 'manager'].includes(auth?.store?.storeRole || '');

  const totals = useMemo(
    () =>
      items.reduce(
        (summary, item) => ({
          quantity: summary.quantity + (item.quantity || 0),
          revenue: summary.revenue + (item.soldPrice || 0) * (item.quantity || 0),
          landing: summary.landing + (item.landingPrice || 0) * (item.quantity || 0),
        }),
        { quantity: 0, revenue: 0, landing: 0 }
      ),
    [items]
  );

  const fetchSoldProducts = async (date: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getSoldProducts(date);
      setItems(result.items);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Sotilgan mahsulotlarni yuklashda xatolik.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSoldProducts(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    api.getAuthMe().then(setAuth).catch(() => setAuth(null));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/inventory"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                aria-label="Omborga qaytish"
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

        <div className={`mb-6 grid gap-3 ${canViewSensitiveFields ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sotilgan son</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totals.quantity}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Sotuv jami</p>
            <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{money(totals.revenue)}</p>
          </div>
          {canViewSensitiveFields && (
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Kelish jami</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{money(totals.landing)}</p>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <BarChart3 className="h-4 w-4" />
              {selectedDate} uchun sotilgan mahsulotlar
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="py-10 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600" />
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Sotilgan mahsulot yo'q</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Boshqa kunni ko'rish uchun sanani o'zgartiring.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Rasm</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Art No</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Rang</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Material</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">O'lcham</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Sotuv narxi</th>
                    {canViewSensitiveFields && (
                      <>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Sotuvchi</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Kelish narxi</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-gray-800">
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
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.size}</td>
                      <td className="px-4 py-3 font-semibold text-green-700 dark:text-green-300">{money(item.soldPrice || 0)}</td>
                      {canViewSensitiveFields && (
                        <>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.sellerName || 'Noma\'lum'}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{money(item.landingPrice || 0)}</td>
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

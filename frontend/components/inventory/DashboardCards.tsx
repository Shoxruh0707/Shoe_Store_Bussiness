'use client';

import { Package, AlertCircle, Zap } from 'lucide-react';

interface DashboardCardsProps {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export function DashboardCards({
  totalProducts,
  totalStock,
  lowStockCount,
  outOfStockCount,
}: DashboardCardsProps) {
  const cards = [
    {
      label: 'Jami mahsulotlar',
      value: totalProducts,
      icon: Package,
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      trend: null,
    },
    {
      label: 'Jami qoldiq',
      value: totalStock,
      icon: Zap,
      color: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
      trend: null,
    },
    {
      label: 'Kam qolgan',
      value: lowStockCount,
      icon: AlertCircle,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
      trend: lowStockCount > 0 ? 'warning' : null,
    },
    {
      label: 'Tugagan',
      value: outOfStockCount,
      icon: AlertCircle,
      color: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
      trend: outOfStockCount > 0 ? 'danger' : null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {card.value.toLocaleString()}
                </p>
              </div>
              <div className={`rounded-lg p-2.5 ${card.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            {card.trend && (
              <div className="mt-2">
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    card.trend === 'warning'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                  }`}
                >
                  {card.trend === 'warning' ? 'E\'tibor kerak' : 'Amal kerak'}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

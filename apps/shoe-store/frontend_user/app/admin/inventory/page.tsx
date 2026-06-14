'use client';

import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import { TrendingDown } from 'lucide-react';
import { getInventory, type InventoryItem } from '@/lib/store-api';

export default function AdminInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getInventory()
      .then(setInventory)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const lowStockItems = inventory.filter((item) => item.quantity <= item.reorderLevel);

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        <div className="bg-card border-b border-border p-6">
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Inventory is loaded from the database</p>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {error && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {lowStockItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-4">
              <TrendingDown className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-orange-900">Low Stock Alert</h3>
                <p className="text-sm text-orange-800 mt-1">
                  {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} are low
                </p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Color</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Size</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Current Stock</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventory.map((item) => {
                    const isLowStock = item.quantity <= item.reorderLevel;
                    return (
                      <tr key={item.id} className={`hover:bg-muted/50 transition-colors ${isLowStock ? 'bg-orange-50' : ''}`}>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">{item.product}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{item.color}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{item.size}</td>
                        <td className="px-6 py-4 text-sm font-bold text-foreground">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {isLowStock ? 'Low' : 'Available'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {!inventory.length && !isLoading && !error && (
            <p className="text-muted-foreground">No inventory rows in the database yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}

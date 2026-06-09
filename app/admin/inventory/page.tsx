'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import { Plus, Edit, Trash2, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InventoryItem {
  id: string;
  product: string;
  color: string;
  size: string;
  quantity: number;
  reorderLevel: number;
  lastRestocked: string;
}

export default function AdminInventoryPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([
    {
      id: '1',
      product: 'Premium Leather Sneaker',
      color: 'Black',
      size: '10',
      quantity: 45,
      reorderLevel: 20,
      lastRestocked: '2024-01-10',
    },
    {
      id: '2',
      product: 'Premium Leather Sneaker',
      color: 'White',
      size: '10',
      quantity: 12,
      reorderLevel: 20,
      lastRestocked: '2024-01-08',
    },
    {
      id: '3',
      product: 'Winter Wool Boot',
      color: 'Black',
      size: '9',
      quantity: 3,
      reorderLevel: 15,
      lastRestocked: '2024-01-05',
    },
    {
      id: '4',
      product: 'Urban Casual Loafer',
      color: 'Brown',
      size: '8',
      quantity: 32,
      reorderLevel: 15,
      lastRestocked: '2024-01-12',
    },
  ]);

  const [formData, setFormData] = useState({
    product: '',
    color: '',
    size: '',
    quantity: '',
    reorderLevel: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      setInventory(
        inventory.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                product: formData.product,
                color: formData.color,
                size: formData.size,
                quantity: parseInt(formData.quantity),
                reorderLevel: parseInt(formData.reorderLevel),
              }
            : item
        )
      );
    } else {
      setInventory([
        ...inventory,
        {
          id: String(inventory.length + 1),
          product: formData.product,
          color: formData.color,
          size: formData.size,
          quantity: parseInt(formData.quantity),
          reorderLevel: parseInt(formData.reorderLevel),
          lastRestocked: new Date().toISOString().split('T')[0],
        },
      ]);
    }

    setFormData({ product: '', color: '', size: '', quantity: '', reorderLevel: '' });
    setEditingItem(null);
    setShowModal(false);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      product: item.product,
      color: item.color,
      size: item.size,
      quantity: item.quantity.toString(),
      reorderLevel: item.reorderLevel.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setInventory(inventory.filter((item) => item.id !== id));
  };

  const lowStockItems = inventory.filter((item) => item.quantity <= item.reorderLevel);

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Track stock levels and manage inventory</p>
          </div>
          <Button
            onClick={() => {
              setEditingItem(null);
              setFormData({ product: '', color: '', size: '', quantity: '', reorderLevel: '' });
              setShowModal(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Stock
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-4">
              <TrendingDown className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-orange-900">Low Stock Alert</h3>
                <p className="text-sm text-orange-800 mt-1">
                  {lowStockItems.length} product{lowStockItems.length > 1 ? 's' : ''} are below reorder level
                </p>
              </div>
            </div>
          )}

          {/* Inventory Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Color
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Current Stock
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Reorder Level
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Last Restocked
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventory.map((item) => {
                    const isLowStock = item.quantity <= item.reorderLevel;
                    return (
                      <tr key={item.id} className={`hover:bg-muted/50 transition-colors ${isLowStock ? 'bg-orange-50' : ''}`}>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">
                          {item.product}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {item.color}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {item.size}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-foreground">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {item.reorderLevel}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              isLowStock
                                ? 'bg-red-100 text-red-700'
                                : item.quantity > item.reorderLevel * 2
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {isLowStock ? 'Low' : item.quantity > item.reorderLevel * 2 ? 'Adequate' : 'Medium'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {new Date(item.lastRestocked).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm flex gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-6 text-foreground">
                {editingItem ? 'Edit Stock' : 'Add Stock'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground">
                    Product
                  </label>
                  <input
                    type="text"
                    value={formData.product}
                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Color
                    </label>
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Size
                    </label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Quantity
                    </label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Reorder Level
                    </label>
                    <input
                      type="number"
                      value={formData.reorderLevel}
                      onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {editingItem ? 'Update Stock' : 'Add Stock'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

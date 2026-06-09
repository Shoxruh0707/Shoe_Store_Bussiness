'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import Link from 'next/link';
import { Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  material: string;
  colors: number;
  sizes: number;
  status: 'active' | 'inactive';
}

export default function AdminProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      name: 'Premium Leather Sneaker',
      category: 'Sneakers',
      price: 189.99,
      stock: 45,
      material: 'Leather',
      colors: 3,
      sizes: 8,
      status: 'active',
    },
    {
      id: '2',
      name: 'Urban Casual Loafer',
      category: 'Casual',
      price: 159.99,
      stock: 32,
      material: 'Suede',
      colors: 3,
      sizes: 7,
      status: 'active',
    },
    {
      id: '3',
      name: 'Winter Wool Boot',
      category: 'Winter',
      price: 249.99,
      stock: 18,
      material: 'Wool',
      colors: 3,
      sizes: 7,
      status: 'active',
    },
    {
      id: '4',
      name: 'Summer Canvas Slip-On',
      category: 'Summer',
      price: 89.99,
      stock: 56,
      material: 'Canvas',
      colors: 3,
      sizes: 7,
      status: 'active',
    },
  ]);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    material: '',
    colors: '',
    sizes: '',
  });

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingProduct) {
      setProducts(
        products.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                name: formData.name,
                category: formData.category,
                price: parseFloat(formData.price),
                material: formData.material,
                colors: parseInt(formData.colors),
                sizes: parseInt(formData.sizes),
              }
            : p
        )
      );
    } else {
      setProducts([
        ...products,
        {
          id: String(products.length + 1),
          name: formData.name,
          category: formData.category,
          price: parseFloat(formData.price),
          stock: 0,
          material: formData.material,
          colors: parseInt(formData.colors),
          sizes: parseInt(formData.sizes),
          status: 'active',
        },
      ]);
    }

    setFormData({ name: '', category: '', price: '', material: '', colors: '', sizes: '' });
    setEditingProduct(null);
    setShowModal(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      price: product.price.toString(),
      material: product.material,
      colors: product.colors.toString(),
      sizes: product.sizes.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setProducts(products.filter((p) => p.id !== id));
  };

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Products Management</h1>
            <p className="text-muted-foreground mt-1">Manage your product catalog</p>
          </div>
          <Button
            onClick={() => {
              setEditingProduct(null);
              setFormData({ name: '', category: '', price: '', material: '', colors: '', sizes: '' });
              setShowModal(true);
            }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Search & Filter */}
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Material
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Options
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {product.category}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-foreground">
                        ${product.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            product.stock > 20
                              ? 'bg-green-50 text-green-700'
                              : product.stock > 10
                              ? 'bg-yellow-50 text-yellow-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {product.material}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {product.colors} colors / {product.sizes} sizes
                      </td>
                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
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
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="Sneakers">Sneakers</option>
                    <option value="Casual">Casual</option>
                    <option value="Winter">Winter</option>
                    <option value="Summer">Summer</option>
                    <option value="Kids">Kids</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Material
                    </label>
                    <input
                      type="text"
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Colors
                    </label>
                    <input
                      type="number"
                      value={formData.colors}
                      onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-foreground">
                      Sizes
                    </label>
                    <input
                      type="number"
                      value={formData.sizes}
                      onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
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
                    {editingProduct ? 'Update Product' : 'Add Product'}
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

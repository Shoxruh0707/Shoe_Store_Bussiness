'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import Link from 'next/link';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getProducts, type StoreProduct } from '@/lib/store-api';

export default function AdminProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        [product.name, product.category, product.brand, product.artNo]
          .join(' ')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ),
    [products, searchQuery]
  );

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        <div className="bg-card border-b border-border p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Products Management</h1>
            <p className="text-muted-foreground mt-1">Product catalog loaded from the database</p>
          </div>
          <Link href="http://127.0.0.1:3000">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              Add Product
            </Button>
          </Link>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
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

          {error && (
            <div className="mb-6 rounded border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Product Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Price</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Stock</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Material</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        <Link href={`/products/${product.id}`} className="hover:text-accent">
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{product.category}</td>
                      <td className="px-6 py-4 text-sm font-bold text-foreground">
                        {Number(product.price).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${product.stockQuantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {product.stockQuantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{product.material}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {product.colors.length} colour / {product.sizes.length} sizes
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {!filteredProducts.length && !isLoading && !error && (
            <p className="mt-6 text-muted-foreground">No products in the database yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}

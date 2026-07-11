'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, AuthMe, Product } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useSearch } from '@/hooks/useSearch';
import { ProductTable } from '@/components/inventory/ProductTable';
import { ProductDrawer } from '@/components/inventory/ProductDrawer';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { SoldProductModal } from '@/components/inventory/SoldProductModal';
import { SoldProductPayload } from '@/lib/api';
import { BarChart3, Plus, ShoppingBag } from 'lucide-react';

export default function InventoryPage() {
  const {
    products,
    metadata,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    markProductSold,
  } = useProducts();

  const { searchQuery, setSearchQuery, filteredProducts, clearSearch } = useSearch(products);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSoldModalOpen, setIsSoldModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleMessage, setSaleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [auth, setAuth] = useState<AuthMe | null>(null);

  const canManageInventory = auth?.user.role === 'admin' || ['owner', 'manager'].includes(auth?.store?.storeRole || '');
  const canSeeStoreIdentity = auth?.user.role === 'admin' || auth?.store?.storeRole === 'owner';

  useEffect(() => {
    api.getAuthMe().then(setAuth).catch(() => setAuth(null));
  }, []);

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
    setEditingProduct(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsAddModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!product.id) return;
    if (!window.confirm(`${product.name} mahsulotini o'chirishni xohlaysizmi?`)) return;

    setIsSubmitting(true);
    try {
      const success = await deleteProduct(product.id);
      if (success) {
        setIsDrawerOpen(false);
        setSelectedProduct(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProduct = async (product: Product) => {
    setIsSubmitting(true);
    try {
      let savedProduct: Product | null;

      if (editingProduct?.id) {
        savedProduct = await updateProduct(editingProduct.id, product);
      } else {
        savedProduct = await createProduct(product);
      }

      if (!savedProduct) {
        throw new Error('Mahsulot saqlanmadi. Maydonlarni tekshirib, qayta urinib ko\'ring.');
      }

      setEditingProduct(null);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // New sold-product feature code starts.
  const handleSoldProduct = async (payload: SoldProductPayload) => {
    setIsSubmitting(true);
    setSaleMessage(null);

    try {
      const result = await markProductSold(payload);
      if (!result) {
        throw new Error('Mahsulot sotilgan deb belgilanmadi. Maydonlarni tekshirib, qayta urinib ko\'ring.');
      }

      const message = `${result.message}. Qolgan soni: ${result.remaining_quantity}`;
      setSaleMessage({ type: 'success', text: message });
      return message;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mahsulotni sotilgan deb belgilashda xatolik yuz berdi.';
      setSaleMessage({ type: 'error', text: message });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };
  // New sold-product feature code ends.

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {canSeeStoreIdentity && auth?.store ? auth.store.storeName : 'Ombor'}
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {canSeeStoreIdentity && auth?.store
                  ? `Do'kon ID: ${auth.store.id}`
                  : 'Oyoq kiyim mahsulotlari va qoldiqlarini boshqaring'}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {/* New sold-product analytics page code starts. */}
              <Link
                href="/analytics"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <BarChart3 className="h-4 w-4" />
                Tahlil
              </Link>
              {/* New sold-product analytics page code ends. */}
              {/* New sold-product feature code starts. */}
              <button
                onClick={() => {
                  setSaleMessage(null);
                  setIsSoldModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
              >
                <ShoppingBag className="h-4 w-4" />
                Sotilgan mahsulot
              </button>
              {/* New sold-product feature code ends. */}
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Mahsulot qo'shish
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Omborni yuklashda xatolik</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* New sold-product feature code starts. */}
        {saleMessage && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm ${
              saleMessage.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200'
                : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'
            }`}
          >
            <p className="font-medium">{saleMessage.type === 'success' ? 'Sotuv saqlandi' : 'Sotuv saqlanmadi'}</p>
            <p className="mt-1">{saleMessage.text}</p>
          </div>
        )}
        {/* New sold-product feature code ends. */}

        {/* Product Table */}
        <div className="rounded-lg bg-white shadow-sm dark:bg-gray-900">
          <ProductTable
            products={filteredProducts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onView={handleViewProduct}
            isLoading={loading}
          />
        </div>
      </div>

      {/* Product Drawer */}
      <ProductDrawer
        product={selectedProduct}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedProduct(null);
        }}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        canManageInventory={canManageInventory}
        canViewSensitiveFields={true}
      />

      {/* Add/Edit Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        editingProduct={editingProduct || undefined}
        metadata={metadata}
        isSubmitting={isSubmitting}
      />

      {/* New sold-product feature code starts. */}
      <SoldProductModal
        isOpen={isSoldModalOpen}
        onClose={() => setIsSoldModalOpen(false)}
        onSubmit={handleSoldProduct}
        metadata={metadata}
        products={products}
        isSubmitting={isSubmitting}
      />
      {/* New sold-product feature code ends. */}
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, AuthSession, Product } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useSearch } from '@/hooks/useSearch';
import { ProductTable } from '@/components/inventory/ProductTable';
import { ProductDrawer } from '@/components/inventory/ProductDrawer';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { SoldProductModal } from '@/components/inventory/SoldProductModal';
import { PriceUpdateModal } from '@/components/inventory/PriceUpdateModal';
import { SoldProductPayload } from '@/lib/api';
import { BarChart3, DollarSign, Plus, ShoppingBag } from 'lucide-react';

export default function InventoryPage() {
  const {
    products,
    metadata,
    loading,
    error,
    createProduct,
    updateProduct,
    updateProductPrices,
    markProductSold,
  } = useProducts();

  const { searchQuery, setSearchQuery, filteredProducts, clearSearch } = useSearch(products);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSoldModalOpen, setIsSoldModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleMessage, setSaleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const canManageInventory =
    authSession?.user.role === 'admin' || ['owner', 'manager'].includes(authSession?.store?.storeRole || '');

  useEffect(() => {
    api.getAuthSession()
      .then(setAuthSession)
      .catch((authError) => {
        console.error('[v0] Failed to load auth session:', authError);
      });
  }, []);

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsDrawerOpen(true);
    setEditingProduct(null);
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
        throw new Error('Mahsulot saqlanmadi. Maydonlarni tekshirib qayta urinib ko\'ring.');
      }

      setEditingProduct(null);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePriceUpdate = async (payload: Parameters<typeof updateProductPrices>[0]) => {
    setIsSubmitting(true);
    setSaleMessage(null);

    try {
      const saved = await updateProductPrices(payload);
      if (saved) {
        setSaleMessage({ type: 'success', text: 'Narxlar muvaffaqiyatli yangilandi.' });
      }
      return saved;
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
        throw new Error('Mahsulot sotilgan deb belgilanmadi. Maydonlarni tekshirib qayta urinib ko\'ring.');
      }

      const message = `${result.message}. Qolgan miqdor: ${result.remaining_quantity}`;
      setSaleMessage({ type: 'success', text: message });
      return message;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mahsulotni sotilgan deb belgilab bo\'lmadi.';
      if ((error as any)?.requiresBoxOpen) {
        throw error;
      }
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
                Inventar
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Mahsulotlar va ombor qoldiqlarini boshqaring
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
              {canManageInventory && (
                <button
                  onClick={() => {
                    setSaleMessage(null);
                    setIsPriceModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <DollarSign className="h-4 w-4" />
                  Narxni yangilash
                </button>
              )}
              {/* New sold-product feature code ends. */}
              {canManageInventory && (
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Inventarni yuklashda xatolik</p>
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
            <p className="font-medium">{saleMessage.type === 'success' ? 'Amal saqlandi' : 'Amal bajarilmadi'}</p>
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
        canViewLandingPrice={canManageInventory}
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

      <PriceUpdateModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        onSubmit={handlePriceUpdate}
        isSubmitting={isSubmitting}
      />
      {/* New sold-product feature code ends. */}
    </main>
  );
}

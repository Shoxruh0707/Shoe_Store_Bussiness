'use client';

import { useState } from 'react';
import { Product } from '@/lib/api';
import { useProducts } from '@/hooks/useProducts';
import { useSearch } from '@/hooks/useSearch';
import { DashboardCards } from '@/components/inventory/DashboardCards';
import { ProductTable } from '@/components/inventory/ProductTable';
import { ProductDrawer } from '@/components/inventory/ProductDrawer';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { Plus } from 'lucide-react';

export default function InventoryPage() {
  const {
    products,
    metadata,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    getTotalStock,
    getLowStockCount,
    getOutOfStockCount,
  } = useProducts();

  const { searchQuery, setSearchQuery, filteredProducts, clearSearch } = useSearch(products);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!window.confirm(`Are you sure you want to delete ${product.name}?`)) return;

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
        throw new Error('Product could not be saved. Check the fields and try again.');
      }

      setEditingProduct(null);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Inventory
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage your shoe products and stock levels
              </p>
            </div>
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            <p className="font-medium">Error loading inventory</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="mb-8">
          <DashboardCards
            totalProducts={products.length}
            totalStock={getTotalStock()}
            lowStockCount={getLowStockCount()}
            outOfStockCount={getOutOfStockCount()}
          />
        </div>

        {/* Product Table */}
        <div className="rounded-lg bg-white shadow-sm dark:bg-gray-900">
          <ProductTable
            products={filteredProducts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onView={handleViewProduct}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
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
    </main>
  );
}

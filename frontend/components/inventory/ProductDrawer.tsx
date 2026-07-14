'use client';

import { useState } from 'react';
import { Product } from '@/lib/api';
import { X, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { STOCK_STATUS, LOW_STOCK_THRESHOLD } from '@/lib/constants';

interface ProductDrawerProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

function getStockStatus(inventory: { size: number; quantity: number }[]) {
  const total = inventory.reduce((sum, item) => sum + item.quantity, 0);
  if (total === 0) return { status: STOCK_STATUS.OUT_OF_STOCK, label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' };
  if (total < LOW_STOCK_THRESHOLD) return { status: STOCK_STATUS.LOW_STOCK, label: 'Low Stock', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' };
  return { status: STOCK_STATUS.IN_STOCK, label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' };
}

function getTotalStock(inventory: { size: number; quantity: number }[]) {
  return inventory.reduce((sum, item) => sum + item.quantity, 0);
}

export function ProductDrawer({
  product,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: ProductDrawerProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!product) return null;

  const images = product.images || [];
  const currentImage = images[currentImageIndex];
  const stockInfo = getStockStatus(product.inventory);
  const totalStock = getTotalStock(product.inventory);
  const sortedInventory = [...product.inventory].sort((a, b) => a.size - b.size);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 dark:bg-black/70"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md transform bg-white shadow-lg transition-transform duration-300 ease-in-out dark:bg-gray-900 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Product Details
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Images
                </h3>
                <div className="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  {currentImage ? (
                    <img
                      src={currentImage.path || ''}
                      alt={product.name}
                      className="w-full h-64 object-cover"
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {/* Image Counter & Controls */}
                {images.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {currentImageIndex + 1} / {images.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length)}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => setCurrentImageIndex((i) => (i + 1) % images.length)}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
                          idx === currentImageIndex
                            ? 'border-blue-500'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <img
                          src={img.path || ''}
                          alt={`Thumbnail ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Product Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Information
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Art Number</p>
                  <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {product.artNo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Product Name</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {product.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Type</p>
                    <p className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {product.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Material</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {product.material}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Colour</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded border border-gray-300 dark:border-gray-600"
                        style={{ backgroundColor: product.colour.toLowerCase() }}
                      />
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {product.colour}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Seasons</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {product.seasons?.join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Pricing
              </h3>
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Selling Price</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {product.price.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Landing Price</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {product.landingPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Stock Status & Inventory */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Inventory
                </h3>
                <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-medium ${stockInfo.color}`}>
                  {stockInfo.label}
                </span>
              </div>

              {/* Total Stock Summary */}
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                <p className="text-xs text-blue-600 dark:text-blue-400">Total Stock</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalStock}
                </p>
              </div>

              {/* Size Breakdown Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">Size</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInventory.map((item) => {
                      const itemStatus = item.quantity === 0
                        ? 'Out of Stock'
                        : item.quantity < LOW_STOCK_THRESHOLD
                        ? 'Low Stock'
                        : 'In Stock';
                      const itemColor = item.quantity === 0
                        ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                        : item.quantity < LOW_STOCK_THRESHOLD
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300';

                      return (
                        <tr key={item.size} className="border-b border-gray-200 dark:border-gray-800">
                          <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">
                            {item.size}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-900 dark:text-gray-100">
                            {item.quantity}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${itemColor}`}>
                              {itemStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onEdit(product);
                  onClose();
                }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <Edit className="inline mr-1 h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
              >
                <Trash2 className="inline mr-1 h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="mx-4 rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Delete Product?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete <span className="font-semibold">{product.name}</span>? This action cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(product);
                  setShowDeleteConfirm(false);
                  onClose();
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

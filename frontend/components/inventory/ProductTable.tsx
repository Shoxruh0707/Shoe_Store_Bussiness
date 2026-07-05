'use client';

import { useState } from 'react';
import { Product } from '@/lib/api';
import { Eye, Edit, Trash2, Search, Package } from 'lucide-react';
import { STOCK_STATUS, LOW_STOCK_THRESHOLD } from '@/lib/constants';

interface ProductTableProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  isLoading?: boolean;
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

// Mobile Product Card
function MobileProductCard({
  product,
  onView,
  onEdit,
  onDelete,
}: {
  product: Product;
  onView: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const stockInfo = getStockStatus(product.inventory);
  const totalStock = getTotalStock(product.inventory);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
          {product.images && product.images.length > 0 ? (
            <img
              src={product.images[0].path || ''}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {product.artNo}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {product.name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {product.colour}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${stockInfo.color}`}>
              {totalStock}x
            </span>
            <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${stockInfo.color}`}>
              {stockInfo.label}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onView(product)}
          className="flex-1 rounded bg-blue-50 px-2 py-2 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
        >
          <Eye className="inline mr-1 h-3 w-3" />
          View
        </button>
        <button
          onClick={() => onEdit(product)}
          className="flex-1 rounded bg-gray-100 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Edit className="inline mr-1 h-3 w-3" />
          Edit
        </button>
        <button
          onClick={() => onDelete(product)}
          className="flex-1 rounded bg-red-50 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
        >
          <Trash2 className="inline h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// Desktop Product Table
function DesktopProductTable({
  products,
  onView,
  onEdit,
  onDelete,
}: {
  products: Product[];
  onView: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Image</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Art No</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Product Name</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Type</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Colour</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Price</th>
            <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">Stock</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Status</th>
            <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const stockInfo = getStockStatus(product.inventory);
            const totalStock = getTotalStock(product.inventory);

            return (
              <tr
                key={product.id}
                className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <td className="px-4 py-3">
                  <div className="h-10 w-10 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0].path || ''}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <div className="text-xs">No image</div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{product.artNo}</span>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                  {product.name}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {product.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div
                    className="h-4 w-4 rounded border border-gray-300 dark:border-gray-600"
                    style={{
                      backgroundColor: product.colour.toLowerCase(),
                    }}
                    title={product.colour}
                  />
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                  {product.price.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">
                  {totalStock}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-medium ${stockInfo.color}`}>
                    {stockInfo.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => onView(product)}
                      className="rounded p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950"
                      title="View details"
                    >
                      <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </button>
                    <button
                      onClick={() => onEdit(product)}
                      className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Edit product"
                    >
                      <Edit className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      onClick={() => onDelete(product)}
                      className="rounded p-1.5 hover:bg-red-50 dark:hover:bg-red-950"
                      title="Delete product"
                    >
                      <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProductTable({
  products,
  searchQuery,
  onSearchChange,
  onView,
  onEdit,
  onDelete,
  isLoading = false,
}: ProductTableProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Art No, Product Name, Colour, Type..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400"
        />
      </div>

      {/* Results Info */}
      {searchQuery && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Found <span className="font-semibold">{products.length}</span> products
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && products.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <Package className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600" />
          <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            {searchQuery ? 'No products found' : 'No products yet'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {searchQuery ? 'Try adjusting your search' : 'Add your first product to get started'}
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!isLoading && products.length > 0 && (
        <DesktopProductTable
          products={products}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Mobile Cards */}
      {!isLoading && products.length > 0 && (
        <div className="md:hidden space-y-2">
          {products.map((product) => (
            <MobileProductCard
              key={product.id}
              product={product}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

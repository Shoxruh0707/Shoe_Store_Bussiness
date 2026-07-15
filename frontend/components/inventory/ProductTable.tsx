'use client';

import { Product } from '@/lib/api';
import { Search, Package } from 'lucide-react';
import { STOCK_STATUS, LOW_STOCK_THRESHOLD } from '@/lib/constants';

interface ProductTableProps {
  products: Product[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onView: (product: Product) => void;
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

function getExistingSizes(inventory: { size: number; quantity: number }[]) {
  return inventory
    .filter((item) => item.quantity > 0)
    .sort((a, b) => a.size - b.size);
}

function getBoxStock(product: Product) {
  return (product.boxStock || []).filter((item) => item.quantity > 0);
}

function productRowKey(product: Product) {
  return product.variantId ? `variant-${product.variantId}` : `product-${product.id}`;
}

// Mobile Product Card
function MobileProductCard({
  product,
  onView,
}: {
  product: Product;
  onView: (p: Product) => void;
}) {
  const stockInfo = getStockStatus(product.inventory);
  const totalStock = getTotalStock(product.inventory);
  const existingSizes = getExistingSizes(product.inventory);
  const boxStock = getBoxStock(product);

  return (
    <button
      type="button"
      onClick={() => onView(product)}
      className="block w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
    >
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
            {product.colour} / {product.material}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${stockInfo.color}`}>
              {totalStock}x
            </span>
            <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${stockInfo.color}`}>
              {stockInfo.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {existingSizes.length > 0 ? (
              existingSizes.map((item) => (
                <span
                  key={item.size}
                  className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {item.size}x{item.quantity}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">No sizes in stock</span>
            )}
          </div>
          {boxStock.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {boxStock.map((item) => (
                <span
                  key={item.id}
                  className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
                >
                  Box {item.quantity}x: {item.sizeRange}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// Desktop Product Table
function DesktopProductTable({
  products,
  onView,
}: {
  products: Product[];
  onView: (p: Product) => void;
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
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Material</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Price</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Sizes</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const stockInfo = getStockStatus(product.inventory);
            const existingSizes = getExistingSizes(product.inventory);
            const boxStock = getBoxStock(product);

            return (
              <tr
                key={productRowKey(product)}
                onClick={() => onView(product)}
                className="cursor-pointer border-b border-gray-200 transition hover:bg-blue-50/50 focus-within:bg-blue-50/50 dark:border-gray-800 dark:hover:bg-blue-950/30"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onView(product);
                  }
                }}
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
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded border border-gray-300 dark:border-gray-600"
                      style={{
                        backgroundColor: product.colour.toLowerCase(),
                      }}
                      title={product.colour}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{product.colour}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {product.material}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                  {product.price.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {existingSizes.length > 0 ? (
                      existingSizes.map((item) => (
                        <span
                          key={item.size}
                          className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        >
                          {item.size}x{item.quantity}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">No stock</span>
                    )}
                  </div>
                  {boxStock.length > 0 && (
                    <div className="mt-2 flex max-w-xs flex-wrap gap-1">
                      {boxStock.map((item) => (
                        <span
                          key={item.id}
                          className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
                        >
                          Box {item.quantity}x: {item.sizeRange}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-medium ${stockInfo.color}`}>
                    {stockInfo.label}
                  </span>
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
  isLoading = false,
}: ProductTableProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by Art No, Product Name, Colour, Material, Type..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm font-medium text-gray-950 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
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
        />
      )}

      {/* Mobile Cards */}
      {!isLoading && products.length > 0 && (
        <div className="md:hidden space-y-2">
          {products.map((product) => (
            <MobileProductCard
              key={productRowKey(product)}
              product={product}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
}

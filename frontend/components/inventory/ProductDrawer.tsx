'use client';

import { useEffect, useRef, useState, type WheelEvent } from 'react';
import { Product } from '@/lib/api';
import { X, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { getSeasonLabel, STOCK_STATUS, LOW_STOCK_THRESHOLD } from '@/lib/constants';

interface ProductDrawerProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  canViewLandingPrice?: boolean;
  canEditProduct?: boolean;
  canOpenBox?: boolean;
  isOpeningBox?: boolean;
  onEdit?: (product: Product) => void;
  onEditPairInventory?: (product: Product) => void;
  onEditBoxStock?: (product: Product) => void;
  onCancelStockAddition?: (additionId: number) => Promise<void>;
  onOpenBox?: (boxStockId: number) => Promise<void>;
}

function getStockStatus(inventory: { size: number; quantity: number }[]) {
  const total = inventory.reduce((sum, item) => sum + item.quantity, 0);
  if (total === 0) return { status: STOCK_STATUS.OUT_OF_STOCK, label: 'Tugagan', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' };
  if (total < LOW_STOCK_THRESHOLD) return { status: STOCK_STATUS.LOW_STOCK, label: 'Kam qolgan', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' };
  return { status: STOCK_STATUS.IN_STOCK, label: 'Mavjud', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' };
}

function getTotalStock(inventory: { size: number; quantity: number }[]) {
  return inventory.reduce((sum, item) => sum + item.quantity, 0);
}

export function ProductDrawer({
  product,
  isOpen,
  onClose,
  canViewLandingPrice = true,
  canEditProduct = false,
  canOpenBox = false,
  isOpeningBox = false,
  onEdit,
  onEditPairInventory,
  onEditBoxStock,
  onCancelStockAddition,
  onOpenBox,
}: ProductDrawerProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [openBoxError, setOpenBoxError] = useState<string | null>(null);
  const imageScrollerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const images = product?.images || [];
  const productKey = product?.variantId || product?.id || null;

  useEffect(() => {
    setCurrentImageIndex(0);
    setOpenBoxError(null);
    imageScrollerRef.current?.scrollTo({ left: 0 });
  }, [productKey]);

  useEffect(() => {
    if (currentImageIndex >= images.length) {
      setCurrentImageIndex(Math.max(images.length - 1, 0));
    }
  }, [currentImageIndex, images.length]);

  if (!product) return null;

  const stockInfo = getStockStatus(product.inventory);
  const totalStock = getTotalStock(product.inventory);
  const sortedInventory = [...product.inventory].sort((a, b) => a.size - b.size);
  const boxStock = (product.boxStock || []).filter((item) => item.quantity > 0);
  const stockAdditions = product.stockAdditions || [];
  const firstOpenableBox = boxStock[0] || null;
  const hasOpenableBox = Boolean(firstOpenableBox);
  const allSizesUnavailable = sortedInventory.length > 0 && sortedInventory.every((item) => item.quantity === 0);
  const canPressOpenBox = canOpenBox && Boolean(onOpenBox) && hasOpenableBox && !isOpeningBox;
  const openBoxButtonClass = !hasOpenableBox
    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
    : allSizesUnavailable
    ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
    : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700';

  function scrollToImage(index: number) {
    const nextIndex = (index + images.length) % images.length;
    const scroller = imageScrollerRef.current;

    setCurrentImageIndex(nextIndex);
    if (scroller) {
      scroller.scrollTo({
        left: nextIndex * scroller.clientWidth,
        behavior: 'smooth',
      });
    }
    thumbnailRefs.current[nextIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }

  function handleImageScroll() {
    const scroller = imageScrollerRef.current;
    if (!scroller?.clientWidth) return;

    const nextIndex = Math.max(
      0,
      Math.min(images.length - 1, Math.round(scroller.scrollLeft / scroller.clientWidth))
    );
    if (nextIndex !== currentImageIndex) {
      setCurrentImageIndex(nextIndex);
    }
  }

  function handleImageWheel(event: WheelEvent<HTMLDivElement>) {
    if (images.length <= 1) return;

    event.preventDefault();
    event.stopPropagation();
    imageScrollerRef.current?.scrollBy({
      left: event.deltaX || event.deltaY,
      behavior: 'auto',
    });
  }

  async function handleOpenBox() {
    if (!canPressOpenBox || !firstOpenableBox || !onOpenBox) return;

    const confirmed = window.confirm(
      `${product?.artNo || 'Mahsulot'} uchun ${firstOpenableBox.sizeRange} qutisini ochasizmi?`
    );
    if (!confirmed) return;

    setOpenBoxError(null);

    try {
      await onOpenBox(firstOpenableBox.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Qutini ochib bo\'lmadi.';
      setOpenBoxError(message);
    }
  }

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
              Mahsulot tafsilotlari
            </h2>
            <div className="flex items-center gap-2">
              {canEditProduct && onEdit && (
                <button
                  onClick={() => onEdit(product)}
                  className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  <Pencil className="h-4 w-4" />
                  Tahrirlash
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Yopish"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Rasmlar
                </h3>
                <div
                  ref={imageScrollerRef}
                  onScroll={handleImageScroll}
                  onWheel={handleImageWheel}
                  className="relative flex h-64 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-contain rounded-lg bg-gray-100 scroll-smooth dark:bg-gray-800"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {images.map((image, index) => (
                    <div key={`${image.path || index}-${index}`} className="h-64 w-full flex-none snap-center">
                      <img
                        src={image.path || ''}
                        alt={`${product.name} ${index + 1}`}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>

                {/* Image Counter & Controls */}
                {images.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {currentImageIndex + 1} / {images.length}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => scrollToImage(currentImageIndex - 1)}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label="Oldingi rasm"
                      >
                        <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => scrollToImage(currentImageIndex + 1)}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label="Keyingi rasm"
                      >
                        <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        ref={(node) => {
                          thumbnailRefs.current[idx] = node;
                        }}
                        onClick={() => scrollToImage(idx)}
                        className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
                          idx === currentImageIndex
                            ? 'border-blue-500'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                        aria-label={`Rasm ${idx + 1}`}
                      >
                        <img
                          src={img.path || ''}
                          alt={`Kichik rasm ${idx + 1}`}
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
                Ma'lumot
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Art no</p>
                  <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {product.artNo}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Mahsulot nomi</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {product.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Turi</p>
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
                    <p className="text-xs text-gray-600 dark:text-gray-400">Rang</p>
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
                    <p className="text-xs text-gray-600 dark:text-gray-400">Mavsumlar</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {product.seasons?.map(getSeasonLabel).join(', ') || 'Yo\'q'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Narxlar
              </h3>
              <div className={`grid gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800 ${canViewLandingPrice ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Sotish narxi</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {product.price.toLocaleString()}
                  </p>
                </div>
                {canViewLandingPrice && product.landingPrice !== null && (
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Kelish narxi</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {product.landingPrice.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stock Status & Inventory */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Inventar
                </h3>
                <div className="flex items-center gap-2">
                  {canEditProduct && onEditPairInventory && (
                    <button
                      type="button"
                      onClick={() => onEditPairInventory(product)}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Juft
                    </button>
                  )}
                  {canEditProduct && onEditBoxStock && (
                    <button
                      type="button"
                      onClick={() => onEditBoxStock(product)}
                      className="inline-flex items-center gap-1 rounded border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Quti
                    </button>
                  )}
                  <span className={`inline-block rounded px-2.5 py-0.5 text-xs font-medium ${stockInfo.color}`}>
                    {stockInfo.label}
                  </span>
                </div>
              </div>

              {/* Total Stock Summary */}
              <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Jami qoldiq</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {totalStock}
                    </p>
                  </div>
                  {canOpenBox && onOpenBox && (
                    <button
                      type="button"
                      onClick={handleOpenBox}
                      disabled={!canPressOpenBox}
                      title={hasOpenableBox ? 'Qutini ochish' : 'Ochilmagan quti yo\'q'}
                      aria-label={hasOpenableBox ? 'Qutini ochish' : 'Ochilmagan quti yo\'q'}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors disabled:pointer-events-none ${openBoxButtonClass}`}
                    >
                      <Plus className={`h-5 w-5 ${isOpeningBox ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                </div>
                {openBoxError && (
                  <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">{openBoxError}</p>
                )}
              </div>

              {/* Size Breakdown Table */}
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">Razmer</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100">Soni</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInventory.map((item) => {
                      const itemStatus = item.quantity === 0
                        ? 'Tugagan'
                        : item.quantity < LOW_STOCK_THRESHOLD
                        ? 'Kam qolgan'
                        : 'Mavjud';
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

              {boxStock.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                    Quti zaxirasi
                  </h4>
                  <div className="space-y-2">
                    {boxStock.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950"
                      >
                        <p className="text-xs text-sky-700 dark:text-sky-300">Ochilmagan qutilar</p>
                        <p className="text-lg font-bold text-sky-800 dark:text-sky-100">{item.quantity}</p>
                        <p className="mt-1 text-sm font-medium text-sky-900 dark:text-sky-100">{item.sizeRange}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stockAdditions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                    Qo'shilgan zaxira
                  </h4>
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">Tur</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">Razmer</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-gray-100">Soni</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">Amal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockAdditions.map((addition) => (
                          <tr key={addition.id} className="border-b border-gray-200 dark:border-gray-800">
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                              {addition.stockType === 'box' ? 'Quti' : 'Juft'}
                            </td>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                              {addition.stockType === 'box' ? addition.sizeRange : addition.size}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-900 dark:text-gray-100">
                              {addition.quantity}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {addition.isCancelled ? (
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Bekor qilingan</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onCancelStockAddition?.(addition.id)}
                                  disabled={!onCancelStockAddition}
                                  className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                                >
                                  Bekor qilish
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

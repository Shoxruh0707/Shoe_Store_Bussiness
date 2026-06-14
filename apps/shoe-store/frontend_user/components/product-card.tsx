'use client';

import Link from 'next/link';
import { Heart, Star } from 'lucide-react';
import { assetUrl, type StoreProduct } from '@/lib/store-api';

interface ProductCardProps {
  product: StoreProduct;
  compact?: boolean;
}

function formatPrice(value: number) {
  return `${Number(value).toLocaleString()} UZS`;
}

export default function ProductCard({ product, compact = false }: ProductCardProps) {
  const originalPrice = product.originalPrice ? Number(product.originalPrice) : 0;
  const price = Number(product.price) || 0;
  const hasMarkdown = originalPrice > price;

  return (
    <article className="group relative h-full">
      <Link href={`/products/${product.id}`} className="block h-full">
        <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-lg bg-muted">
          {product.image ? (
            <img
              src={assetUrl(product.image)}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center">
              <span className="text-sm font-semibold text-muted-foreground">{product.brand}</span>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {product.season && (
              <span className="rounded bg-background/90 px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
                {product.season}
              </span>
            )}
            {!product.inStock && (
              <span className="rounded bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground">
                Sold out
              </span>
            )}
          </div>

        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{product.brand}</p>
              <h3 className="line-clamp-2 font-semibold text-foreground transition-colors group-hover:text-accent">
                {product.name}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-accent text-accent" />
              {product.rating}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {product.type} / {product.color}
          </p>

          {!compact && product.sizes.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              Sizes {product.sizes.slice(0, 6).join(', ')}
              {product.sizes.length > 6 ? '...' : ''}
            </p>
          )}

          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-bold text-foreground">{formatPrice(price)}</span>
            {hasMarkdown && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </span>
            )}
          </div>

          <p className={`text-sm font-medium ${product.inStock ? 'text-green-700' : 'text-destructive'}`}>
            {product.inStock ? `${product.stockQuantity} in stock` : 'Out of stock'}
          </p>
        </div>
      </Link>
      <button
        type="button"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:text-accent"
        aria-label="Add to wishlist"
      >
        <Heart className="h-4 w-4" />
      </button>
    </article>
  );
}

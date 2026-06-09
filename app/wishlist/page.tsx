'use client';

import { useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { Star, Heart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  rating: number;
  inStock: boolean;
  addedDate: string;
}

export default function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([
    {
      id: '1',
      name: 'Premium Leather Sneaker',
      price: 189.99,
      originalPrice: 239.99,
      category: 'Sneakers',
      rating: 4.8,
      inStock: true,
      addedDate: '2024-01-15',
    },
    {
      id: '3',
      name: 'Winter Wool Boot',
      price: 249.99,
      originalPrice: 299.99,
      category: 'Winter',
      rating: 4.9,
      inStock: true,
      addedDate: '2024-01-10',
    },
    {
      id: '5',
      name: 'Kids Colorful Sneaker',
      price: 69.99,
      category: 'Kids',
      rating: 4.5,
      inStock: false,
      addedDate: '2024-01-08',
    },
  ]);

  const removeItem = (id: string) => {
    setWishlistItems(wishlistItems.filter((item) => item.id !== id));
  };

  const addToCart = (id: string) => {
    // TODO: Implement add to cart logic
    console.log('Added to cart:', id);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Wishlist</h1>
            <p className="text-muted-foreground mt-2">
              {wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''} saved
            </p>
          </div>

          {wishlistItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlistItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square bg-muted overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                      <span className="text-muted-foreground font-medium">[Product Image]</span>
                    </div>

                    {item.originalPrice && (
                      <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-3 py-1 rounded text-sm font-semibold">
                        Sale
                      </div>
                    )}

                    {!item.inStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">Out of Stock</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-6 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Link
                          href={`/products/${item.id}`}
                          className="font-semibold text-foreground hover:text-accent transition-colors block"
                        >
                          {item.name}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">{item.category}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-accent text-accent" />
                      <span className="text-sm text-muted-foreground">{item.rating}</span>
                    </div>

                    {/* Price */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">
                        ${item.price.toFixed(2)}
                      </span>
                      {item.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          ${item.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Added Date */}
                    <p className="text-xs text-muted-foreground">
                      Added on {new Date(item.addedDate).toLocaleDateString()}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => addToCart(item.id)}
                        disabled={!item.inStock}
                        className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add to Cart
                      </Button>
                      <Link href={`/products/${item.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h2 className="text-2xl font-bold text-foreground mb-3">Your wishlist is empty</h2>
              <p className="text-muted-foreground mb-8">
                Start adding your favorite shoes to your wishlist!
              </p>
              <Link href="/products">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6">
                  Explore Products
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

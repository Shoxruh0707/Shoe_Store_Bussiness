'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { ChevronLeft, Heart, Minus, Plus, Share2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assetUrl, getProduct, type StoreProduct } from '@/lib/store-api';
import ProductCard from '@/components/product-card';

function formatPrice(value: number) {
  return `${Number(value).toLocaleString()} UZS`;
}

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<StoreProduct[]>([]);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProduct(params.id)
      .then((data) => {
        setProduct(data.product);
        setRelatedProducts(data.relatedProducts);
        setSelectedImage(data.product.images?.[0] || data.product.image || '');
        setSelectedSize(data.product.sizes[0] || '');
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
        <Link href="/products" className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Back to Products
        </Link>
      </div>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {!product && !error && (
            <p className="text-muted-foreground">Loading product...</p>
          )}

          {product && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                  <div className="bg-muted rounded-lg aspect-[4/5] overflow-hidden flex items-center justify-center">
                    {selectedImage ? (
                      <img src={assetUrl(selectedImage)} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-muted-foreground font-medium text-lg">{product.brand}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(product.images || []).map((image) => (
                      <button
                        key={image}
                        onClick={() => setSelectedImage(image)}
                        className={`bg-muted rounded cursor-pointer aspect-square overflow-hidden hover:ring-2 hover:ring-accent transition-all ${
                          selectedImage === image ? 'ring-2 ring-accent' : ''
                        }`}
                      >
                        <img src={assetUrl(image)} alt={product.name} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="mb-2 text-sm font-semibold uppercase text-accent">{product.brand}</p>
                        <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
                        <p className="text-muted-foreground mt-1">Art no: {product.artNo}</p>
                      </div>
                      <button
                        onClick={() => setIsFavorite(!isFavorite)}
                        className="text-muted-foreground hover:text-accent transition-colors"
                      >
                        <Heart className={`w-6 h-6 ${isFavorite ? 'fill-accent text-accent' : ''}`} />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-accent text-accent" />
                        ))}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {product.rating} ({product.reviews} reviews)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-3xl font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                      {product.originalPrice && Number(product.originalPrice) > Number(product.price) && (
                        <span className="text-lg text-muted-foreground line-through">
                          {formatPrice(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-muted-foreground leading-relaxed">{product.description}</p>

                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Brand:</span>
                      <span className="font-semibold text-foreground">{product.brand}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Material:</span>
                      <span className="font-semibold text-foreground">{product.material}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-semibold text-foreground">{product.type}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Colour:</span>
                      <span className="font-semibold text-foreground">{product.color}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border">
                      <span className="text-muted-foreground">Season:</span>
                      <span className="font-semibold text-foreground">{product.season || 'All Season'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Availability:</span>
                      <span className={`font-semibold ${product.inStock ? 'text-green-600' : 'text-destructive'}`}>
                        {product.inStock ? `${product.stockQuantity} in stock` : 'Out of Stock'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-foreground">
                      Size: <span className="text-accent">{selectedSize}</span>
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {product.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`py-2 rounded border transition-all ${
                            selectedSize === size
                              ? 'bg-accent text-accent-foreground border-accent'
                              : 'bg-background border-border hover:border-accent'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-3 text-foreground">Quantity</label>
                    <div className="flex items-center gap-3 border border-border rounded w-fit">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-muted transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-4 py-2 font-semibold">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(product.stockQuantity, quantity + 1))}
                        className="flex h-10 w-10 items-center justify-center hover:bg-muted transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-lg" disabled={!product.inStock}>
                      Add to Cart
                    </Button>
                    <Button variant="outline" size="icon" className="px-6">
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <section className="mt-16 border-t border-border pt-12">
                <h2 className="text-2xl font-bold mb-8">Related Products</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {relatedProducts.map((prod) => (
                    <ProductCard key={prod.id} product={prod} compact />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

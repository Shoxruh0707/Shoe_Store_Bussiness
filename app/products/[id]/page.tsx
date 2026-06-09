'use client';

import { useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { Star, Heart, Share2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  color: string[];
  size: string[];
  material: string;
  type: string;
  rating: number;
  reviews: number;
  description: string;
  inStock: boolean;
}

// Mock product data - in real app, this would be fetched from database
const productData: { [key: string]: Product } = {
  '1': {
    id: '1',
    name: 'Premium Leather Sneaker',
    price: 189.99,
    originalPrice: 239.99,
    category: 'Sneakers',
    color: ['Black', 'White', 'Navy'],
    size: ['6', '7', '8', '9', '10', '11', '12', '13'],
    material: 'Leather',
    type: 'Sneaker',
    rating: 4.8,
    reviews: 342,
    description: 'Experience the perfect blend of comfort and style with our Premium Leather Sneaker. Crafted from premium Italian leather, these sneakers feature a cushioned insole and breathable lining for all-day comfort. Perfect for both casual outings and professional settings.',
    inStock: true,
  },
};

const relatedProducts = [
  { id: '2', name: 'Urban Casual Loafer', price: 159.99, rating: 4.7 },
  { id: '3', name: 'Winter Wool Boot', price: 249.99, rating: 4.9 },
  { id: '4', name: 'Summer Canvas Slip-On', price: 89.99, rating: 4.6 },
];

export default function ProductDetailsPage({ params }: { params: { id: string } }) {
  const product = productData[params.id] || productData['1'];
  const [selectedColor, setSelectedColor] = useState(product.color[0]);
  const [selectedSize, setSelectedSize] = useState(product.size[0]);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Breadcrumb */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-border">
        <Link href="/products" className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors">
          <ChevronLeft className="w-5 h-5" />
          Back to Products
        </Link>
      </div>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Product Image Section */}
            <div className="flex flex-col gap-4">
              <div className="bg-muted rounded-lg aspect-square overflow-hidden flex items-center justify-center">
                <span className="text-muted-foreground font-medium text-lg">[Product Image Gallery]</span>
              </div>

              {/* Thumbnail Gallery */}
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-muted rounded cursor-pointer aspect-square flex items-center justify-center hover:ring-2 hover:ring-accent transition-all"
                  >
                    <span className="text-xs text-muted-foreground">View {i}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Details Section */}
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">{product.name}</h1>
                    <p className="text-muted-foreground mt-1">{product.category}</p>
                  </div>
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    className="text-muted-foreground hover:text-accent transition-colors"
                  >
                    <Heart className={`w-6 h-6 ${isFavorite ? 'fill-accent text-accent' : ''}`} />
                  </button>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.floor(product.rating)
                            ? 'fill-accent text-accent'
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {product.rating} ({product.reviews} reviews)
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-foreground">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-xl text-muted-foreground line-through">
                      ${product.originalPrice.toFixed(2)}
                    </span>
                  )}
                  {product.originalPrice && (
                    <span className="bg-accent text-accent-foreground px-3 py-1 rounded text-sm font-semibold">
                      Save ${(product.originalPrice - product.price).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>

              {/* Product Details */}
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Material:</span>
                  <span className="font-semibold text-foreground">{product.material}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-semibold text-foreground">{product.type}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Availability:</span>
                  <span
                    className={`font-semibold ${
                      product.inStock ? 'text-green-600' : 'text-destructive'
                    }`}
                  >
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-semibold mb-3 text-foreground">
                  Color: <span className="text-accent">{selectedColor}</span>
                </label>
                <div className="flex gap-3">
                  {product.color.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-12 h-12 rounded-lg border-2 transition-all ${
                        selectedColor === color
                          ? 'border-accent'
                          : 'border-border hover:border-accent'
                      }`}
                      style={{
                        backgroundColor: color.toLowerCase() === 'black' ? '#000000' :
                                       color.toLowerCase() === 'white' ? '#ffffff' :
                                       color.toLowerCase() === 'navy' ? '#000080' :
                                       '#cccccc'
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <label className="block text-sm font-semibold mb-3 text-foreground">
                  Size: <span className="text-accent">{selectedSize}</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {product.size.map((size) => (
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

              {/* Quantity Selection */}
              <div>
                <label className="block text-sm font-semibold mb-3 text-foreground">
                  Quantity
                </label>
                <div className="flex items-center gap-3 border border-border rounded w-fit">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 hover:bg-muted transition-colors"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 hover:bg-muted transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-lg">
                  Add to Cart
                </Button>
                <Button variant="outline" size="icon" className="px-6">
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="space-y-2 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">✓ Free shipping on orders $100+</p>
                <p className="text-sm text-muted-foreground">✓ 30-day money-back guarantee</p>
                <p className="text-sm text-muted-foreground">✓ Secure checkout</p>
              </div>
            </div>
          </div>

          {/* Related Products */}
          <section className="mt-16 border-t border-border pt-12">
            <h2 className="text-2xl font-bold mb-8">Related Products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map((prod) => (
                <Link key={prod.id} href={`/products/${prod.id}`}>
                  <div className="group cursor-pointer">
                    <div className="bg-muted rounded-lg aspect-square overflow-hidden mb-4 group-hover:shadow-lg transition-shadow flex items-center justify-center">
                      <span className="text-muted-foreground font-medium">[Product Image]</span>
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors mb-2">
                      {prod.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground">
                        ${prod.price.toFixed(2)}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-accent text-accent" />
                        <span className="text-sm text-muted-foreground">{prod.rating}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

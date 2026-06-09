'use client';

import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  category: string;
  image: string;
  rating: number;
  inStock: boolean;
}

const featuredProducts: Product[] = [
  {
    id: '1',
    name: 'Premium Leather Sneaker',
    price: 189.99,
    originalPrice: 239.99,
    category: 'Sneakers',
    image: '/products/sneaker-1.jpg',
    rating: 4.8,
    inStock: true,
  },
  {
    id: '2',
    name: 'Urban Casual Loafer',
    price: 159.99,
    category: 'Casual',
    image: '/products/casual-1.jpg',
    rating: 4.7,
    inStock: true,
  },
  {
    id: '3',
    name: 'Winter Wool Boot',
    price: 249.99,
    originalPrice: 299.99,
    category: 'Winter',
    image: '/products/winter-1.jpg',
    rating: 4.9,
    inStock: true,
  },
  {
    id: '4',
    name: 'Summer Canvas Slip-On',
    price: 89.99,
    category: 'Summer',
    image: '/products/summer-1.jpg',
    rating: 4.6,
    inStock: true,
  },
];

const categories = [
  { name: 'Sneakers', count: 156, image: '/categories/sneakers.jpg' },
  { name: 'Casual', count: 142, image: '/categories/casual.jpg' },
  { name: 'Winter', count: 87, image: '/categories/winter.jpg' },
  { name: 'Summer', count: 203, image: '/categories/summer.jpg' },
  { name: 'Kids', count: 94, image: '/categories/kids.jpg' },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative h-screen md:h-[600px] bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-gradient-to-r from-primary via-primary to-primary opacity-80"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(184, 134, 11, 0.1) 0%, transparent 50%)',
            }}
          />
        </div>

        <div className="relative h-full flex items-center justify-center">
          <div className="text-center px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter mb-6 text-balance">
              Step Into Elegance
            </h2>
            <p className="text-lg sm:text-xl text-secondary-foreground mb-8 text-pretty">
              Discover premium quality footwear that combines comfort, style, and sophistication for every moment of your life.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6 text-lg">
                  Shop Now
                </Button>
              </Link>
              <Button variant="outline" className="px-8 py-6 text-lg border-primary-foreground text-primary-foreground hover:bg-white/10">
                View Collections
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Shop By Category</h2>
          <p className="text-muted-foreground text-lg">Explore our curated collections</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link key={cat.name} href={`/products?category=${cat.name.toLowerCase()}`}>
              <div className="group cursor-pointer">
                <div className="bg-muted rounded-lg h-40 sm:h-48 overflow-hidden flex items-center justify-center mb-3 group-hover:shadow-lg transition-shadow">
                  <div className="text-center text-muted-foreground font-medium">
                    {cat.name}
                  </div>
                </div>
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="text-sm text-muted-foreground">{cat.count} items</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Featured Shoes</h2>
            <p className="text-muted-foreground text-lg">Best sellers and new arrivals</p>
          </div>
          <Link href="/products" className="hidden sm:flex items-center gap-2 text-accent hover:gap-4 transition-all">
            View All <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`}>
              <div className="group cursor-pointer">
                <div className="bg-muted rounded-lg aspect-square overflow-hidden mb-4 relative group-hover:shadow-lg transition-shadow">
                  <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted flex items-center justify-center group-hover:to-accent/10 transition-colors">
                    <span className="text-muted-foreground font-medium">[Product Image]</span>
                  </div>
                  {product.originalPrice && (
                    <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-3 py-1 rounded text-sm font-semibold">
                      Sale
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-accent text-accent" />
                      <span className="text-sm text-muted-foreground">{product.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{product.category}</p>

                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">
                      ${product.price.toFixed(2)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        ${product.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="pt-2">
                    <span
                      className={`text-sm font-medium ${
                        product.inStock ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link href="/products" className="flex items-center justify-center gap-2 text-accent hover:gap-4 transition-all">
            View All Products <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Promotional Banner */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-gradient-to-r from-accent to-accent/80 rounded-lg p-8 sm:p-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-accent-foreground mb-3">
            Limited Time Offer
          </h3>
          <p className="text-accent-foreground/90 mb-6">
            Get 20% off on your first purchase with code: QUEENS20
          </p>
          <Link href="/products">
            <Button className="bg-accent-foreground text-accent hover:bg-accent-foreground/90">
              Shop Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-3">Join Our Community</h3>
          <p className="text-muted-foreground mb-8">
            Subscribe to get exclusive offers, new arrivals, and style tips delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded bg-background border border-border focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-8">
              Subscribe
            </Button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}

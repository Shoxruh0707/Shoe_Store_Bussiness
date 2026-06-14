'use client';

import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { ChevronRight, Package, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { assetUrl, getProducts, type StoreProduct } from '@/lib/store-api';
import ProductCard from '@/components/product-card';

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getProducts(8)
      .then(setFeaturedProducts)
      .catch((err) => setError(err.message));
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    featuredProducts.forEach((product) => {
      counts.set(product.category, (counts.get(product.category) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [featuredProducts]);
  const heroProduct = featuredProducts.find((product) => product.image) || featuredProducts[0];
  const featureItems = [
    { icon: Truck, title: 'Fast local delivery', text: 'Clear stock counts before checkout' },
    { icon: ShieldCheck, title: 'Verified inventory', text: 'Products come from your live database' },
    { icon: Package, title: 'Size-first shopping', text: 'Filter by available shoe size' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <section className="relative min-h-[560px] overflow-hidden bg-primary text-primary-foreground">
        {heroProduct?.image && (
          <img
            src={assetUrl(heroProduct.image)}
            alt={heroProduct.name}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative mx-auto flex min-h-[560px] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
              New shoes in stock
            </p>
            <h2 className="mb-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Find your next pair from today&apos;s live inventory
            </h2>
            <p className="mb-8 max-w-xl text-lg text-primary-foreground/85 sm:text-xl">
              Browse available sizes, colours, and materials pulled directly from the store database.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/products">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6 text-lg">
                  Shop Now
                </Button>
              </Link>
              <Link href="/products?stock=in">
                <Button variant="outline" className="border-primary-foreground px-8 py-6 text-lg text-primary-foreground hover:bg-white/10">
                  In-stock pairs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-8">
          {featureItems.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-accent" />
              <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Shop By Category</h2>
          <p className="text-muted-foreground text-lg">Explore our curated collections</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.length > 0 ? categories.map((cat) => {
            const sample = featuredProducts.find((product) => product.category === cat.name);
            return (
            <Link key={cat.name} href={`/products?category=${cat.name.toLowerCase()}`}>
              <div className="group cursor-pointer">
                <div className="relative mb-3 flex h-40 items-end overflow-hidden rounded-lg bg-muted p-4 transition-shadow group-hover:shadow-lg sm:h-48">
                  {sample?.image && (
                    <img src={assetUrl(sample.image)} alt={cat.name} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="relative text-primary-foreground">
                    <h3 className="font-semibold">{cat.name}</h3>
                    <p className="text-sm text-primary-foreground/80">{cat.count} items</p>
                  </div>
                </div>
              </div>
            </Link>
          )}) : (
            <p className="col-span-full text-muted-foreground">No categories yet.</p>
          )}
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

        {error && (
          <div className="mb-6 rounded border border-destructive/30 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {!featuredProducts.length && !error && (
          <p className="text-muted-foreground">No products in the database yet.</p>
        )}

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

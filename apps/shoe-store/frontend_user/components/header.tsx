'use client';

import Link from 'next/link';
import { Search, ShoppingCart, Heart, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const categories = [
    { name: 'All Shoes', href: '/products' },
    { name: 'In Stock', href: '/products?stock=in' },
    { name: 'Spring', href: '/products?season=spring' },
    { name: 'Summer', href: '/products?season=summer' },
    { name: 'Winter', href: '/products?season=winter' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground">
      {/* Top Navigation Bar */}
      <div className="border-b border-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <h1 className="text-2xl font-bold tracking-tight">Queen&apos;s Shoes</h1>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className="text-sm font-medium hover:text-accent transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              <Link href="/products" className="hidden sm:block text-primary-foreground hover:text-accent transition-colors" aria-label="Search products">
                <Search className="w-5 h-5" />
              </Link>
              <Link href="/wishlist">
                <button className="text-primary-foreground hover:text-accent transition-colors">
                  <Heart className="w-5 h-5" />
                </button>
              </Link>
              <Link href="/cart">
                <button className="relative text-primary-foreground hover:text-accent transition-colors">
                  <ShoppingCart className="w-5 h-5" />
                  <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    0
                  </span>
                </button>
              </Link>
              <div className="hidden sm:flex items-center gap-2 border-l border-secondary pl-4">
                <Link href="/login">
                  <Button variant="outline" className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                    Sign Up
                  </Button>
                </Link>
              </div>
              <button
                type="button"
                className="md:hidden text-primary-foreground"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-secondary">
          <div className="px-4 py-4 space-y-3">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="block text-sm font-medium hover:text-accent transition-colors py-2"
              >
                {cat.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-secondary space-y-2">
              <Link href="/account" className="block text-sm font-medium hover:text-accent py-2">
                My Account
              </Link>
              <Link href="/login" className="block text-sm font-medium hover:text-accent py-2">
                Sign In
              </Link>
              <Link href="/signup">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

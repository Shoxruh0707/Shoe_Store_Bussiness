'use client';

import Link from 'next/link';
import { Facebook, Instagram, Twitter } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-bold mb-4">Queen&apos;s Shoes</h3>
            <p className="text-sm text-secondary-foreground mb-4">
              Premium quality footwear for every occasion. Discover elegance in every step.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="hover:text-accent transition-colors">
                <Facebook className="w-5 h-5" />
              </Link>
              <Link href="#" className="hover:text-accent transition-colors">
                <Instagram className="w-5 h-5" />
              </Link>
              <Link href="#" className="hover:text-accent transition-colors">
                <Twitter className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-bold mb-4">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/products" className="hover:text-accent transition-colors">
                  All Shoes
                </Link>
              </li>
              <li>
                <Link href="/products?stock=in" className="hover:text-accent transition-colors">
                  In Stock
                </Link>
              </li>
              <li>
                <Link href="/products?season=spring" className="hover:text-accent transition-colors">
                  Spring
                </Link>
              </li>
              <li>
                <Link href="/products?season=summer" className="hover:text-accent transition-colors">
                  Summer
                </Link>
              </li>
              <li>
                <Link href="/products?season=winter" className="hover:text-accent transition-colors">
                  Winter
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="font-bold mb-4">Customer Service</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/contact" className="hover:text-accent transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-accent transition-colors">
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link href="/returns" className="hover:text-accent transition-colors">
                  Returns
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-accent transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-accent transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-accent transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-accent transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-secondary pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-secondary-foreground">
          <p>&copy; {currentYear} Queen&apos;s Shoes. All rights reserved.</p>
          <div className="flex gap-6">
            <span>Secure Checkout</span>
            <span>Live Inventory</span>
            <span>Local Delivery</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

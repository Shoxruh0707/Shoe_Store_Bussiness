'use client';

import { useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { Trash2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: '1',
      name: 'Premium Leather Sneaker',
      price: 189.99,
      quantity: 1,
      size: '10',
      color: 'Black',
    },
    {
      id: '2',
      name: 'Urban Casual Loafer',
      price: 159.99,
      quantity: 2,
      size: '9',
      color: 'Brown',
    },
  ]);

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id);
      return;
    }
    setCartItems(cartItems.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)));
  };

  const removeItem = (id: string) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal > 100 ? 0 : 10;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Shopping Cart</h1>

          {cartItems.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-card border border-border rounded-lg p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6"
                  >
                    {/* Product Image */}
                    <div className="w-full sm:w-24 h-24 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                      <span className="text-muted-foreground text-sm">[Image]</span>
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <Link href={`/products/${item.id}`} className="hover:text-accent transition-colors">
                        <h3 className="font-semibold text-lg text-foreground mb-2 hover:text-accent">
                          {item.name}
                        </h3>
                      </Link>
                      <div className="text-sm text-muted-foreground space-y-1 mb-3">
                        <p>Color: {item.color}</p>
                        <p>Size: {item.size}</p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-3 border border-border rounded w-fit">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-1 hover:bg-muted transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1 font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 hover:bg-muted transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Price and Remove */}
                    <div className="flex flex-col items-end justify-between">
                      <span className="text-xl font-bold text-foreground">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-sm">Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-card border border-border rounded-lg p-6 sticky top-24 space-y-4">
                  <h2 className="text-xl font-bold text-foreground mb-6">Order Summary</h2>

                  <div className="space-y-3">
                    <div className="flex justify-between text-foreground">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-foreground">
                      <span>Delivery Fee</span>
                      <span className={deliveryFee === 0 ? 'text-green-600' : ''}>
                        {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
                      </span>
                    </div>

                    <div className="flex justify-between text-foreground">
                      <span>Tax</span>
                      <span>${tax.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-border pt-3 flex justify-between text-xl font-bold text-foreground">
                      <span>Total</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {subtotal <= 100 && (
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                      Add ${(100 - subtotal).toFixed(2)} more for FREE shipping!
                    </p>
                  )}

                  <Link href="/checkout">
                    <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 py-6 text-lg">
                      Proceed to Checkout
                    </Button>
                  </Link>

                  <Link href="/products">
                    <Button variant="outline" className="w-full py-6">
                      Continue Shopping
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold text-foreground mb-3">Your cart is empty</h2>
              <p className="text-muted-foreground mb-8">
                Explore our collection and add some premium shoes to your cart.
              </p>
              <Link href="/products">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 py-6">
                  Start Shopping
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

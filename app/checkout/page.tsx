'use client';

import { useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { ChevronLeft, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutPage() {
  const [step, setStep] = useState<'info' | 'location' | 'payment' | 'review'>('info');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [location, setLocation] = useState({
    latitude: 40.7128,
    longitude: -74.006,
    address: 'New York, NY 10001',
  });
  const [paymentMethod, setPaymentMethod] = useState('card');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLocationChange = () => {
    // Simulate map location selection
    const newLat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const newLng = -74.006 + (Math.random() - 0.5) * 0.1;
    setLocation({
      latitude: newLat,
      longitude: newLng,
      address: `${Math.random() > 0.5 ? 'Brooklyn' : 'Manhattan'}, NY`,
    });
  };

  const cartTotal = 559.98;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Link href="/cart" className="flex items-center gap-2 text-accent hover:text-accent/80 mb-8 transition-colors">
            <ChevronLeft className="w-5 h-5" />
            Back to Cart
          </Link>

          <h1 className="text-3xl font-bold mb-8">Checkout</h1>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto">
            {['info', 'location', 'payment', 'review'].map((s, idx) => (
              <div key={s} className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setStep(s as typeof step)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    step === s
                      ? 'bg-accent text-accent-foreground'
                      : ['info', 'location', 'payment', 'review'].indexOf(step) > idx
                      ? 'bg-green-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx + 1}
                </button>
                {idx < 3 && <div className="w-8 h-0.5 bg-muted" />}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Customer Information */}
              {(step === 'info' || step === 'location' || step === 'payment' || step === 'review') && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      ['info', 'location', 'payment', 'review'].indexOf(step) >= 0
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted'
                    }`}>1</span>
                    Customer Information
                  </h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        name="firstName"
                        placeholder="First Name"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <input
                        type="text"
                        name="lastName"
                        placeholder="Last Name"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <input
                      type="email"
                      name="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                    />

                    <input
                      type="tel"
                      name="phone"
                      placeholder="Phone Number"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                    />

                    {step === 'info' && (
                      <Button
                        onClick={() => setStep('location')}
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        Continue to Delivery Location
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery Location */}
              {(step === 'location' || step === 'payment' || step === 'review') && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      ['info', 'location', 'payment', 'review'].indexOf(step) >= 1
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted'
                    }`}>2</span>
                    Delivery Location
                  </h2>

                  <div className="space-y-4">
                    {/* Map Preview */}
                    <div className="bg-muted rounded-lg h-64 flex items-center justify-center border-2 border-dashed border-border">
                      <div className="text-center">
                        <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground text-sm">Map View</p>
                        <p className="text-xs text-muted-foreground mt-1">Lat: {location.latitude.toFixed(4)}</p>
                        <p className="text-xs text-muted-foreground">Lng: {location.longitude.toFixed(4)}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2 text-foreground">
                        Selected Address
                      </label>
                      <input
                        type="text"
                        value={location.address}
                        onChange={(e) => setLocation({ ...location, address: e.target.value })}
                        className="w-full px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleLocationChange}
                      className="w-full border-accent text-accent hover:bg-accent/10"
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Change Location on Map
                    </Button>

                    {step === 'location' && (
                      <Button
                        onClick={() => setStep('payment')}
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        Continue to Payment
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {(step === 'payment' || step === 'review') && (
                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      ['info', 'location', 'payment', 'review'].indexOf(step) >= 2
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-muted'
                    }`}>3</span>
                    Payment Method
                  </h2>

                  <div className="space-y-3">
                    {['card', 'paypal', 'apple'].map((method) => (
                      <label key={method} className="flex items-center gap-3 p-4 border border-border rounded cursor-pointer hover:bg-muted transition-colors">
                        <input
                          type="radio"
                          name="payment"
                          value={method}
                          checked={paymentMethod === method}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="font-semibold text-foreground capitalize">
                          {method === 'card' && 'Credit Card'}
                          {method === 'paypal' && 'PayPal'}
                          {method === 'apple' && 'Apple Pay'}
                        </span>
                      </label>
                    ))}
                  </div>

                  {paymentMethod === 'card' && (
                    <div className="mt-4 space-y-4">
                      <input
                        type="text"
                        placeholder="Card Number"
                        className="w-full px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="MM/YY"
                          className="px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <input
                          type="text"
                          placeholder="CVV"
                          className="px-4 py-3 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </div>
                  )}

                  {step === 'payment' && (
                    <Button
                      onClick={() => setStep('review')}
                      className="w-full mt-4 bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      Review Order
                    </Button>
                  )}
                </div>
              )}

              {/* Order Review */}
              {step === 'review' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <h2 className="text-2xl font-bold text-green-700 mb-2">Order Ready!</h2>
                  <p className="text-green-600 mb-6">
                    Review your order and click &quot;Place Order&quot; to complete your purchase.
                  </p>
                  <Button className="bg-green-600 text-white hover:bg-green-700 px-8 py-6 text-lg">
                    Place Order
                  </Button>
                </div>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg p-6 sticky top-24">
                <h2 className="text-xl font-bold mb-6 text-foreground">Order Summary</h2>

                <div className="space-y-3 mb-6 pb-6 border-b border-border">
                  <div className="flex justify-between text-foreground">
                    <span>Premium Leather Sneaker</span>
                    <span>$189.99</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Urban Casual Loafer x2</span>
                    <span>$319.98</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-foreground">
                    <span>Subtotal</span>
                    <span>$509.97</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Delivery</span>
                    <span className="text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between text-foreground">
                    <span>Tax</span>
                    <span>$50.01</span>
                  </div>

                  <div className="border-t border-border pt-3 flex justify-between text-xl font-bold text-foreground">
                    <span>Total</span>
                    <span className="text-accent">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

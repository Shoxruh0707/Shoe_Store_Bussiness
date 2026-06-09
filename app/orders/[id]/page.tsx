'use client';

import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { ChevronLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
}

interface Order {
  id: string;
  date: string;
  status: 'pending' | 'paid' | 'delivering' | 'completed' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  tax: number;
  total: number;
  shippingAddress: string;
  estimatedDelivery: string;
  trackingNumber: string;
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  const order: Order = {
    id: params.id,
    date: '2024-01-15',
    status: 'delivering',
    items: [
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
    ],
    subtotal: 509.97,
    delivery: 0,
    tax: 50.01,
    total: 559.98,
    shippingAddress: '123 Main St, New York, NY 10001',
    estimatedDelivery: '2024-01-22',
    trackingNumber: 'UPS1234567890',
  };

  const statuses = [
    { key: 'pending', label: 'Order Placed', icon: Package, completed: true },
    { key: 'paid', label: 'Payment Confirmed', icon: CheckCircle, completed: true },
    { key: 'delivering', label: 'In Transit', icon: Truck, completed: true },
    { key: 'completed', label: 'Delivered', icon: CheckCircle, completed: false },
  ];

  const statusIndex = statuses.findIndex((s) => s.key === order.status);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <Link href="/account" className="flex items-center gap-2 text-accent hover:text-accent/80 mb-8 transition-colors">
            <ChevronLeft className="w-5 h-5" />
            Back to Account
          </Link>

          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">{order.id}</h1>
                <p className="text-muted-foreground mt-1">
                  Ordered on {new Date(order.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <span className={`px-4 py-2 rounded-full font-semibold text-sm ${
                order.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                order.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                order.status === 'delivering' ? 'bg-yellow-100 text-yellow-700' :
                order.status === 'completed' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>

            {/* Order Status Timeline */}
            <div className="mb-8">
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  {statuses.map((statusItem, idx) => {
                    const Icon = statusItem.icon;
                    const isCompleted = idx <= statusIndex;
                    const isCurrent = idx === statusIndex;

                    return (
                      <div key={statusItem.key} className="flex flex-col items-center flex-1">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all ${
                            isCompleted
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-muted text-muted-foreground'
                          } ${isCurrent ? 'ring-2 ring-accent ring-offset-2' : ''}`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <p className={`text-sm font-semibold text-center ${
                          isCompleted ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {statusItem.label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Timeline Connector */}
                <div className="absolute top-6 left-0 right-0 h-1 bg-muted -z-10">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${(statusIndex / (statuses.length - 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Tracking Info */}
            {order.status !== 'pending' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted rounded-lg mb-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tracking Number</p>
                  <p className="font-semibold text-foreground font-mono">{order.trackingNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Estimated Delivery</p>
                  <p className="font-semibold text-foreground">
                    {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Order Items */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-2xl font-bold text-foreground mb-6">Order Items</h2>

              {order.items.map((item) => (
                <div key={item.id} className="bg-card border border-border rounded-lg p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
                  {/* Product Image */}
                  <div className="w-full sm:w-24 h-24 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">[Image]</span>
                  </div>

                  {/* Product Info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-foreground mb-2">
                      {item.name}
                    </h3>
                    <div className="text-sm text-muted-foreground space-y-1 mb-3">
                      <p>Color: {item.color}</p>
                      <p>Size: {item.size}</p>
                      <p>Quantity: {item.quantity}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between sm:flex-shrink-0">
                    <span className="text-lg font-bold text-foreground">
                      ${item.price.toFixed(2)}
                    </span>
                    <Button variant="outline" size="sm" className="mt-2">
                      View Product
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary and Shipping */}
            <div className="lg:col-span-1 space-y-6">
              {/* Shipping Address */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-bold text-foreground mb-4">Shipping Address</h3>
                <p className="text-muted-foreground whitespace-pre-line">
                  {order.shippingAddress}
                </p>
              </div>

              {/* Order Summary */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-bold text-foreground mb-4">Order Summary</h3>

                <div className="space-y-3">
                  <div className="flex justify-between text-foreground">
                    <span>Subtotal</span>
                    <span>${order.subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-foreground">
                    <span>Delivery</span>
                    <span className={order.delivery === 0 ? 'text-green-600' : ''}>
                      {order.delivery === 0 ? 'FREE' : `$${order.delivery.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-foreground">
                    <span>Tax</span>
                    <span>${order.tax.toFixed(2)}</span>
                  </div>

                  <div className="border-t border-border pt-3 flex justify-between text-lg font-bold text-foreground">
                    <span>Total</span>
                    <span className="text-accent">${order.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    Download Invoice
                  </Button>
                  <Button variant="outline" className="w-full">
                    Contact Support
                  </Button>
                </div>
              </div>

              {/* Help Section */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Need Help?</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Having issues with your order? Our support team is here to help.
                </p>
                <Link href="#" className="text-accent hover:text-accent/80 text-sm font-medium">
                  Contact Support →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

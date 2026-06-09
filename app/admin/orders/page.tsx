'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import { Eye, Check, Clock, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Order {
  id: string;
  customer: string;
  email: string;
  amount: number;
  items: number;
  status: 'pending' | 'paid' | 'delivering' | 'completed';
  date: string;
  shippingAddress: string;
}

export default function AdminOrdersPage() {
  const [orders] = useState<Order[]>([
    {
      id: '#ORD-2024-001',
      customer: 'John Doe',
      email: 'john@example.com',
      amount: 559.98,
      items: 3,
      status: 'delivering',
      date: '2024-01-15',
      shippingAddress: '123 Main St, New York, NY 10001',
    },
    {
      id: '#ORD-2024-002',
      customer: 'Jane Smith',
      email: 'jane@example.com',
      amount: 189.99,
      items: 1,
      status: 'paid',
      date: '2024-01-14',
      shippingAddress: '456 Oak Ave, Brooklyn, NY 11201',
    },
    {
      id: '#ORD-2024-003',
      customer: 'Mike Johnson',
      email: 'mike@example.com',
      amount: 329.97,
      items: 2,
      status: 'pending',
      date: '2024-01-14',
      shippingAddress: '789 Elm St, Queens, NY 11375',
    },
    {
      id: '#ORD-2024-004',
      customer: 'Sarah Williams',
      email: 'sarah@example.com',
      amount: 249.99,
      items: 1,
      status: 'completed',
      date: '2024-01-13',
      shippingAddress: '321 Pine Rd, Bronx, NY 10451',
    },
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'paid':
        return <Check className="w-4 h-4" />;
      case 'delivering':
        return <Truck className="w-4 h-4" />;
      case 'completed':
        return <Check className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-50 text-gray-700';
      case 'paid':
        return 'bg-yellow-50 text-yellow-700';
      case 'delivering':
        return 'bg-blue-50 text-blue-700';
      case 'completed':
        return 'bg-green-50 text-green-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border p-6">
          <h1 className="text-3xl font-bold text-foreground">Orders Management</h1>
          <p className="text-muted-foreground mt-1">View and manage customer orders</p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Orders Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">
                        {order.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {order.customer}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {order.email}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-foreground">
                        ${order.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {order.items}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(order.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          View Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

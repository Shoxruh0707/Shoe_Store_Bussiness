'use client';

import AdminSidebar from '@/components/admin-sidebar';
import Link from 'next/link';
import { TrendingUp, DollarSign, Package, AlertTriangle, ShoppingCart, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: number;
  color: string;
}

interface RecentOrder {
  id: string;
  customer: string;
  amount: number;
  status: string;
  date: string;
}

export default function AdminDashboard() {
  const stats: StatCard[] = [
    {
      title: 'Total Revenue',
      value: '$24,580',
      icon: <DollarSign className="w-6 h-6" />,
      trend: 12.5,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Active Orders',
      icon: <ShoppingCart className="w-6 h-6" />,
      value: '28',
      trend: 5.2,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Total Customers',
      icon: <Users className="w-6 h-6" />,
      value: '1,204',
      trend: 8.1,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Low Stock Items',
      icon: <AlertTriangle className="w-6 h-6" />,
      value: '12',
      trend: -3.2,
      color: 'from-orange-500 to-orange-600',
    },
  ];

  const recentOrders: RecentOrder[] = [
    {
      id: '#ORD-2024-001',
      customer: 'John Doe',
      amount: 559.98,
      status: 'Delivering',
      date: '2024-01-15',
    },
    {
      id: '#ORD-2024-002',
      customer: 'Jane Smith',
      amount: 189.99,
      status: 'Paid',
      date: '2024-01-14',
    },
    {
      id: '#ORD-2024-003',
      customer: 'Mike Johnson',
      amount: 329.97,
      status: 'Pending',
      date: '2024-01-14',
    },
    {
      id: '#ORD-2024-004',
      customer: 'Sarah Williams',
      amount: 249.99,
      status: 'Completed',
      date: '2024-01-13',
    },
  ];

  const lowStockItems = [
    { id: 1, name: 'Winter Wool Boot', color: 'Black', stock: 3 },
    { id: 2, name: 'Kids Colorful Sneaker', color: 'Rainbow', stock: 5 },
    { id: 3, name: 'Premium Leather Sneaker', color: 'White', stock: 2 },
    { id: 4, name: 'Athletic Running Shoe', color: 'Red', stock: 4 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'text-green-600 bg-green-50';
      case 'Delivering':
        return 'text-blue-600 bg-blue-50';
      case 'Paid':
        return 'text-yellow-600 bg-yellow-50';
      case 'Pending':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        {/* Header */}
        <div className="bg-card border-b border-border p-6">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your business overview.</p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground">{stat.title}</h3>
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} text-white`}>
                    {stat.icon}
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className={`text-sm mt-2 ${stat.trend > 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {stat.trend > 0 ? '↑' : '↓'} {Math.abs(stat.trend)}% from last month
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Orders & Low Stock */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-2 bg-card border border-border rounded-lg">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Recent Orders</h2>
                <Link href="/admin/orders">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>

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
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">
                          {order.id}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {order.customer}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-foreground">
                          ${order.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {new Date(order.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold text-foreground">Low Stock Items</h2>
              </div>

              <div className="space-y-3">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="p-3 bg-muted rounded-lg border border-border hover:border-accent transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground text-sm">{item.name}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        item.stock <= 3 ? 'bg-destructive text-destructive-foreground' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.stock} left
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.color}</p>
                  </div>
                ))}
              </div>

              <Link href="/admin/inventory" className="block mt-4">
                <Button variant="outline" className="w-full">Manage Inventory</Button>
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/admin/products">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="w-4 h-4 mr-2" />
                  Add New Product
                </Button>
              </Link>
              <Link href="/admin/shipments">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Create Shipment
                </Button>
              </Link>
              <Link href="/admin/ocr-import">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="w-4 h-4 mr-2" />
                  OCR Import
                </Button>
              </Link>
              <Link href="/admin/analytics">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

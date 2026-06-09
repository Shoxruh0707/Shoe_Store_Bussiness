'use client';

import { useState } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import Link from 'next/link';
import { LogOut, User, Package, MapPin, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

type TabType = 'profile' | 'orders' | 'addresses' | 'settings';

interface Order {
  id: string;
  date: string;
  status: 'pending' | 'paid' | 'delivering' | 'completed' | 'cancelled';
  total: number;
  items: number;
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [orders] = useState<Order[]>([
    {
      id: '#ORD-001',
      date: '2024-01-15',
      status: 'completed',
      total: 559.98,
      items: 3,
    },
    {
      id: '#ORD-002',
      date: '2024-01-10',
      status: 'delivering',
      total: 189.99,
      items: 1,
    },
    {
      id: '#ORD-003',
      date: '2024-01-05',
      status: 'completed',
      total: 249.99,
      items: 1,
    },
  ]);

  const [addresses] = useState([
    {
      id: '1',
      type: 'Home',
      address: '123 Main St, New York, NY 10001',
      default: true,
    },
    {
      id: '2',
      type: 'Work',
      address: '456 Business Ave, Manhattan, NY 10002',
      default: false,
    },
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'delivering':
        return 'text-blue-600 bg-blue-50';
      case 'paid':
        return 'text-yellow-600 bg-yellow-50';
      case 'pending':
        return 'text-gray-600 bg-gray-50';
      case 'cancelled':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">My Account</h1>
            <p className="text-muted-foreground mt-2">Manage your profile, orders, and preferences</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <div className="md:col-span-1">
              <nav className="space-y-2 sticky top-24">
                {[
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'orders', label: 'Orders', icon: Package },
                  { id: 'addresses', label: 'Addresses', icon: MapPin },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as TabType)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{label}</span>
                  </button>
                ))}
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all">
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </nav>
            </div>

            {/* Main Content */}
            <div className="md:col-span-3">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-2xl font-bold mb-6 text-foreground">Personal Information</h2>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-foreground">
                            First Name
                          </label>
                          <input
                            type="text"
                            defaultValue="John"
                            className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-foreground">
                            Last Name
                          </label>
                          <input
                            type="text"
                            defaultValue="Doe"
                            className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground">
                          Email
                        </label>
                        <input
                          type="email"
                          defaultValue="john@example.com"
                          className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          defaultValue="+1 (555) 123-4567"
                          className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-foreground">
                          Member Since
                        </label>
                        <input
                          type="text"
                          defaultValue="January 15, 2024"
                          disabled
                          className="w-full px-4 py-2 border border-border rounded bg-muted text-muted-foreground"
                        />
                      </div>

                      <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="p-6 border-b border-border">
                      <h2 className="text-2xl font-bold text-foreground">Order History</h2>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted border-b border-border">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                              Order ID
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                              Items
                            </th>
                            <th className="px-6 py-3 text-right text-sm font-semibold text-foreground">
                              Total
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-semibold text-foreground">
                              Action
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
                                {new Date(order.date).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                    order.status
                                  )}`}
                                >
                                  {getStatusLabel(order.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-muted-foreground">
                                {order.items} item{order.items > 1 ? 's' : ''}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-foreground text-right">
                                ${order.total.toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Link href={`/orders/${order.id}`}>
                                  <Button variant="outline" size="sm">
                                    View
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Addresses Tab */}
              {activeTab === 'addresses' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-foreground">Saved Addresses</h2>
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                      Add New Address
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          addr.default ? 'border-accent bg-accent/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-foreground">{addr.type}</h3>
                          {addr.default && (
                            <span className="bg-accent text-accent-foreground text-xs font-semibold px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">{addr.address}</p>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-2xl font-bold mb-6 text-foreground">Account Settings</h2>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-4 border-b border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">Email Notifications</h3>
                          <p className="text-sm text-muted-foreground">
                            Receive updates about orders and promotions
                          </p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-5 h-5" />
                      </div>

                      <div className="flex items-center justify-between py-4 border-b border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">SMS Notifications</h3>
                          <p className="text-sm text-muted-foreground">
                            Get SMS alerts for important updates
                          </p>
                        </div>
                        <input type="checkbox" className="w-5 h-5" />
                      </div>

                      <div className="flex items-center justify-between py-4 border-b border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">Marketing Emails</h3>
                          <p className="text-sm text-muted-foreground">
                            Receive exclusive offers and new product launches
                          </p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-5 h-5" />
                      </div>

                      <div className="mt-6 pt-6 border-t border-border">
                        <h3 className="font-semibold text-foreground mb-3">Change Password</h3>
                        <div className="space-y-3">
                          <input
                            type="password"
                            placeholder="Current Password"
                            className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <input
                            type="password"
                            placeholder="New Password"
                            className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <input
                            type="password"
                            placeholder="Confirm Password"
                            className="w-full px-4 py-2 border border-border rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                            Update Password
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

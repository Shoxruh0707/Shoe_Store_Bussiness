'use client';

import AdminSidebar from '@/components/admin-sidebar';
import { Users, Search, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  totalSpent: number;
  joinDate: string;
}

export default function AdminCustomersPage() {
  const [customers] = useState<Customer[]>([
    { id: '1', name: 'John Doe', email: 'john@example.com', phone: '+1 (555) 123-4567', orders: 3, totalSpent: 559.98, joinDate: '2024-01-01' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '+1 (555) 234-5678', orders: 1, totalSpent: 189.99, joinDate: '2024-01-05' },
    { id: '3', name: 'Mike Johnson', email: 'mike@example.com', phone: '+1 (555) 345-6789', orders: 2, totalSpent: 329.97, joinDate: '2024-01-10' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex bg-background min-h-screen">
      <AdminSidebar />

      <main className="flex-1 lg:ml-64 pb-24 lg:pb-0">
        <div className="bg-card border-b border-border p-6">
          <h1 className="text-3xl font-bold text-foreground">Customers Management</h1>
          <p className="text-muted-foreground mt-1">Manage and track customer information</p>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Phone</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Orders</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Total Spent</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-foreground">{customer.name}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{customer.email}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{customer.phone}</td>
                      <td className="px-6 py-4 text-sm font-bold text-foreground">{customer.orders}</td>
                      <td className="px-6 py-4 text-sm font-bold text-foreground">${customer.totalSpent.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm">
                        <Button variant="outline" size="sm">View History</Button>
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

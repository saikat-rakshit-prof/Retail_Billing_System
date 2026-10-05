'use client';

import { Users, IndianRupee, CreditCard, Star } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface CustomerStatsProps {
  customers: any[];
}

export function CustomerStats({ customers }: CustomerStatsProps) {
  const totalCustomers = customers.length;
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalRevenue = customers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0);
  const stats = [
    {
      label: 'Total Customers',
      value: totalCustomers,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Total Outstanding',
      value: formatCurrency(totalOutstanding),
      icon: IndianRupee,
      color: 'bg-amber-100 text-amber-600',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: CreditCard,
      color: 'bg-green-100 text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-[10px] lg:gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between h-full hover:-translate-y-0.5 transition-transform duration-200 shadow-sm hover:shadow-md ${index === 2 ? 'col-span-2 md:col-span-1' : ''}`}
        >
          <div className="flex items-start justify-between mb-2 gap-2">
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-1">{stat.label}</p>
            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[18px] font-bold leading-tight font-mono">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

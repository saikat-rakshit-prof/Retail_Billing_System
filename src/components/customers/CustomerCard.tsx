'use client';

import { ChevronRight } from 'lucide-react';
import { CustomerWithStats } from '@/types';
import { CUSTOMER_TYPES } from '@/lib/constants/customerConstants';

interface CustomerCardProps {
  customer: CustomerWithStats;
  onEdit?: (customer: CustomerWithStats) => void;
  onDelete?: (customer: CustomerWithStats) => void;
  onClick?: (customer: CustomerWithStats) => void;
}

export function CustomerCard({ customer, onClick }: CustomerCardProps) {
  const typeConfig = CUSTOMER_TYPES[customer.customerType] || CUSTOMER_TYPES.regular;

  // ✅ Fix: safely handle missing lastBillDate field
  const rawDate = (customer as any).lastBillDate || customer.updatedAt;
  const billDate = rawDate ? new Date(rawDate) : new Date();
  const isValidDate = !isNaN(billDate.getTime());
  const safeBillDate = isValidDate ? billDate : new Date();

  const today = new Date();
  const daysDiff = Math.floor(
    (today.getTime() - safeBillDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isOverdue = daysDiff > 30;

  const outstanding = customer.outstandingBalance;

  const color =
    outstanding === 0
      ? '#16a34a'
      : isOverdue
        ? '#dc2626'
        : '#f97316';

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'C';
  };

  return (
    <div
      className={`bg-white p-4 border-b border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors ${onClick ? 'cursor-pointer' : ''
        }`}
      onClick={() => onClick?.(customer)}
    >
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
          {getInitials(customer.name)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900">
              {customer.name}
            </h3>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${typeConfig.badgeColor}`}
            >
              {typeConfig.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {customer.phone || 'No phone'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-right">
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: color,
              lineHeight: '1.2',
            }}
          >
            ₹{outstanding.toLocaleString('en-IN')}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: color,
              marginTop: '1px',
            }}
          >
            {outstanding === 0 ? 'Clear' : 'Due'}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300" />
      </div>
    </div>
  );
}
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { useProductStore } from '@/store/useProductStore';
import { useBillStore } from '@/store/useBillStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { formatCurrency, formatDate, calculatePercentageChange, toNumber } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  FileText, 
  Package, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Counter animation component
function CounterAnimation({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 600;
    const steps = 30;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, isVisible]);

  return (
    <span ref={elementRef} className="font-mono">
      {count}{suffix}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { products, forceRefresh: refreshProducts } = useProductStore();
  const { bills, forceRefresh: refreshBills } = useBillStore();
  const { inventory, forceRefresh: refreshInventory } = useInventoryStore();
  const { shopName } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [salesData, setSalesData] = useState<{ date: string; total: number }[]>([]);

  // Update browser tab title dynamically
  useEffect(() => {
    document.title = `${shopName || 'Store'} - Dashboard`;
  }, [shopName]);

  // Dashboard always fetches fresh stats - bypass cache
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([refreshProducts(), refreshBills(), refreshInventory()]);
      setIsLoading(false);
    };
    initialize();
  }, [refreshProducts, refreshBills, refreshInventory]);

  // Refetch on focus - 60 second stale time for dashboard
  const handleDashboardRefetch = useCallback(async () => {
    await Promise.all([refreshProducts(), refreshBills(), refreshInventory()]);
  }, [refreshProducts, refreshBills, refreshInventory]);
  
  useRefetchOnFocus({
    onRefetch: handleDashboardRefetch,
    staleTime: 60000, // 60 seconds
  });

  // Calculate today's stats - handle both string and number types
  const today = new Date().toISOString().split('T')[0];
  const todayBills = bills.filter(b => b.createdAt.split('T')[0] === today);
  const todaySales = todayBills.reduce((sum, b) => sum + toNumber(b.totalAmount), 0);
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayBills = bills.filter(b => b.createdAt.split('T')[0] === yesterday);
  const yesterdaySales = yesterdayBills.reduce((sum, b) => sum + toNumber(b.totalAmount), 0);

  const salesChange = calculatePercentageChange(todaySales, yesterdaySales);
  const billsChange = calculatePercentageChange(todayBills.length, yesterdayBills.length);

  // Get low stock alerts
  const lowStockItems = inventory.filter(s => s.status === 'Low Stock' || s.status === 'Out of Stock');

  // Prepare chart data for last 7 days
  useEffect(() => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayBills = bills.filter(b => b.createdAt.split('T')[0] === dateStr);
      const daySales = dayBills.reduce((sum, b) => sum + toNumber(b.totalAmount), 0);
      
      last7Days.push({
        date: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        total: daySales,
      });
    }
    setSalesData(last7Days);
  }, [bills]);

  // Get recent bills
  const recentBills = bills.slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="skeleton h-4 w-24 mb-4 rounded"></div>
              <div className="skeleton h-8 w-32 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <Header />

      {/* Stats Cards - Mobile 2 col, Desktop 4 col */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {/* Today's Sales */}
        <div 
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 font-medium">Today's Sales</span>
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold">
              <CounterAnimation value={todaySales} />
            </span>
            <span className={`text-xs font-medium flex items-center ${salesChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {salesChange >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(salesChange).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Bills Generated */}
        <div 
          onClick={() => router.push('/history?filter=today')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 animate-fade-in cursor-pointer active:scale-95"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 font-medium">Bills Today</span>
            <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold">
              <CounterAnimation value={todayBills.length} />
            </span>
            <span className={`text-xs font-medium flex items-center ${billsChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {billsChange >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(billsChange).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Total Products */}
        <div 
          onClick={() => router.push('/inventory')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 animate-fade-in cursor-pointer active:scale-95"
          style={{ animationDelay: '300ms' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 font-medium">Products</span>
            <div className="size-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold">
              <CounterAnimation value={products.length} />
            </span>
            <span className="text-xs text-slate-400">Active SKUs</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div 
          onClick={() => router.push('/inventory?filter=low')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 animate-fade-in cursor-pointer active:scale-95"
          style={{ animationDelay: '400ms' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-500 font-medium">Low Stock</span>
            <div className="size-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-2xl font-bold text-red-500">
              <CounterAnimation value={lowStockItems.length} />
            </span>
            <span className="text-xs text-red-400">Need restock</span>
          </div>
        </div>
      </div>

      {/* Weekly Sales Trend */}
      <div 
        className="bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in"
        style={{ animationDelay: '500ms' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-lg">Weekly Sales Trend</h3>
            <p className="text-sm text-slate-500">Revenue performance over last 7 days</p>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="h-64 min-w-[560px] lg:min-w-0">
          {salesData && salesData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salesData}>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="#1d9f76" 
                    radius={[4, 4, 0, 0]}
                    name="Sales"
                  />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              No sales data available
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Mobile Mini Stats - Visible only on mobile */}
      <div className="hidden overflow-x-auto pb-2 -mx-4 px-4">
        <div className="flex gap-3">
          {salesData.map((day, i) => (
            <div key={i} className="flex-shrink-0 bg-white p-3 rounded-lg border border-slate-200 min-w-[80px]">
              <p className="text-xs text-slate-500">{day.date}</p>
              <p className="text-sm font-bold font-mono text-primary">₹{day.total}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Bills */}
      <div 
        className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col animate-fade-in"
        style={{ animationDelay: '600ms' }}
      >
        <div className="p-4 lg:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Recent Bills</h3>
            <p className="text-sm text-slate-500 hidden lg:block">Latest transactions</p>
          </div>
          <Link 
            href="/history" 
            className="text-sm text-primary font-medium flex items-center gap-1 hover:underline"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentBills.map((bill, i) => {
                const status = (bill as any).status || (bill as any).paymentStatus || (bill as any).billStatus || 'paid';
                const isPaid = status.toLowerCase() === 'paid';
                
                return (
                  <tr 
                    key={bill.id} 
                    className="hover:bg-slate-50 transition-colors"
                    style={{ animationDelay: `${700 + i * 100}ms` }}
                  >
                    <td className="px-6 py-4 text-sm font-medium font-mono">{bill.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm">{bill.customerName || 'Walk-in'}</td>
                    <td className="px-6 py-4 text-sm font-semibold font-mono">{formatCurrency(bill.totalAmount)}</td>
                    <td className="px-6 py-4">
                      {isPaid ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 animate-pulse">
                          PAID
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          DUE
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="lg:hidden divide-y divide-slate-100">
          {recentBills.map((bill, i) => {
            const status = (bill as any).status || (bill as any).paymentStatus || (bill as any).billStatus || 'paid';
            const isPaid = status.toLowerCase() === 'paid';
            
            return (
              <div 
                key={bill.id} 
                className="p-4 flex items-center justify-between"
                style={{ animationDelay: `${700 + i * 100}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{bill.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">{bill.customerName || 'Walk-in'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold font-mono text-sm">{formatCurrency(bill.totalAmount)}</p>
                  {isPaid ? (
                    <span className="text-[10px] text-green-600 font-medium">PAID</span>
                  ) : (
                    <span className="text-[10px] text-red-600 font-medium">DUE</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

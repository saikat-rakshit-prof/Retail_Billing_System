'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const COLORS = ['#16a34a', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1'];

type DateFilterType = 'today' | 'week' | 'month' | 'custom';

export function SalesReportTab() {
  const [filterType, setFilterType] = useState<DateFilterType>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Calculate dates based on filterType
    const today = new Date();
    let from = '';
    let to = '';

    if (filterType === 'today') {
      from = today.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
    } else if (filterType === 'week') {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      from = lastWeek.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
    } else if (filterType === 'month') {
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      from = lastMonth.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
    } else if (filterType === 'custom') {
      from = dateFrom;
      to = dateTo;
    }

    if (filterType === 'custom' && (!from || !to)) {
      // Don't fetch if custom and dates are empty
      return;
    }

    fetchReports(from, to);
  }, [filterType, dateFrom, dateTo]);

  const fetchReports = async (from: string, to: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const response = await fetch(`/api/reports/sales?${params.toString()}`);
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch (error) {
      console.error('Error fetching sales reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const topProductsQty = data?.topProducts || [];
  const topProductsRev = [...(data?.topProducts || [])].sort((a: any, b: any) => b.revenue - a.revenue);
  const topCategory = data?.categoryBreakdown?.[0]?.category;
  const topCategoryProducts = topCategory 
    ? [...(data?.allProductsStats || [])].filter((p: any) => p.category === topCategory).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)
    : [];

  // Group brands into top 5 + Others
  let brandBreakdown = data?.brandBreakdown || [];
  if (brandBreakdown.length > 6) {
    const topBrands = brandBreakdown.slice(0, 5);
    const others = brandBreakdown.slice(5).reduce((acc: any, curr: any) => {
      acc.revenue += curr.revenue;
      acc.qty += curr.qty;
      return acc;
    }, { brand: 'Others', revenue: 0, qty: 0 });
    brandBreakdown = [...topBrands, others];
  }

  return (
    <div className="space-y-4">
      {/* Date Filter Pills */}
      <div className="bg-white p-3 rounded-[12px] border border-[#e5e7eb]">
        <div className="flex flex-row w-full gap-2 flex-nowrap overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-0.5">
          {(['today', 'week', 'month', 'custom'] as DateFilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 h-[36px] rounded-full text-[13px] font-medium text-center whitespace-nowrap border-[1.5px] transition-colors ${
                filterType === type
                  ? 'bg-[#16a34a] text-white border-[#16a34a]'
                  : 'bg-white text-[#374151] border-[#e5e7eb] hover:bg-slate-50'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {filterType === 'custom' && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm bg-white"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm bg-white"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#16a34a]" />
        </div>
      ) : !data ? (
        <div className="text-center py-8 text-slate-500">No data available</div>
      ) : (
        <>
          {/* Stat Cards Row (2x2) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 flex flex-col justify-center">
              <span className="text-[12px] text-slate-500 font-medium mb-1">Total Revenue</span>
              <span className="text-xl font-bold text-slate-900">{formatCurrency(data.totalRevenue)}</span>
            </div>
            <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 flex flex-col justify-center">
              <span className="text-[12px] text-slate-500 font-medium mb-1">Total Bills</span>
              <span className="text-xl font-bold text-slate-900">{data.totalBills}</span>
            </div>
            <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 flex flex-col justify-center">
              <span className="text-[12px] text-slate-500 font-medium mb-1">Avg Bill Value</span>
              <span className="text-xl font-bold text-slate-900">{formatCurrency(data.avgBillValue)}</span>
            </div>
            <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 flex flex-col justify-center">
              <span className="text-[12px] text-slate-500 font-medium mb-1">Items Sold</span>
              <span className="text-xl font-bold text-slate-900">{data.itemsSold}</span>
            </div>
          </div>

          {/* Top Selling Products (by quantity) */}
          <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 overflow-x-hidden">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Top Products by Quantity</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsQty} layout="vertical" margin={{ left: -20, right: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={10} tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val} />
                  <Tooltip formatter={(value) => [`${value} qty`, 'Sold']} />
                  <Bar dataKey="qty" fill="#16a34a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue by Product */}
          <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 overflow-x-hidden">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Revenue by Product</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsRev} layout="vertical" margin={{ left: -20, right: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={12} tickFormatter={(val) => `₹${val}`} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={10} tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value), 'Revenue']} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Wise Breakdown */}
          <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Sales by Category</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="revenue"
                    nameKey="category"
                  >
                    {data.categoryBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 px-1">
              {data.categoryBreakdown.map((cat: any, index: number) => {
                const isLast = index === data.categoryBreakdown.length - 1;
                return (
                  <div key={cat.category} className={`flex items-center justify-between py-1.5 ${!isLast ? 'border-b border-[#f3f4f6]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-[13px] text-[#374151]">{cat.category}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#111]">₹{Math.round(cat.revenue).toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drill-down for top category */}
          {topCategoryProducts.length > 0 && (
            <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4 overflow-x-hidden">
              <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Top Products in {topCategory}</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategoryProducts} layout="vertical" margin={{ left: -20, right: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={12} tickFormatter={(val) => `₹${val}`} />
                    <YAxis dataKey="name" type="category" width={100} fontSize={10} tickFormatter={(val) => val.length > 12 ? val.substring(0, 12) + '...' : val} />
                    <Tooltip formatter={(value: any) => [formatCurrency(value), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sales by Brand */}
          <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Revenue by Brand</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={brandBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="revenue"
                    nameKey="brand"
                  >
                    {brandBreakdown.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.brand === 'Others' ? '#6b7280' : COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 px-1">
              {brandBreakdown.map((brand: any, index: number) => {
                const isLast = index === brandBreakdown.length - 1;
                return (
                  <div key={brand.brand} className={`flex items-center justify-between py-1.5 ${!isLast ? 'border-b border-[#f3f4f6]' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: brand.brand === 'Others' ? '#6b7280' : COLORS[index % COLORS.length] }} />
                      <span className="text-[13px] text-[#374151]">{brand.brand}</span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#111]">₹{Math.round(brand.revenue).toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Size Wise Breakdown */}
          <div className="bg-white rounded-[12px] border border-[#e5e7eb] p-4">
            <h3 className="text-[16px] font-semibold text-slate-900 mb-4">Most Sold Sizes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#e5e7eb] text-slate-500">
                    <th className="py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Size</th>
                    <th className="py-2 font-medium text-right">Qty</th>
                    <th className="py-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {data.sizeBreakdown.map((size: any, idx: number) => (
                    <tr key={size.size}>
                      <td className="py-2.5 text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 font-medium text-slate-900">{size.size}</td>
                      <td className="py-2.5 text-right">{size.qty}</td>
                      <td className="py-2.5 text-right text-[#16a34a] font-semibold">{formatCurrency(size.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

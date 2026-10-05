'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface CustomerReportsProps {
  dateFrom?: string;
  dateTo?: string;
}
const COLORS = ['#16a34a', '#f59e0b', '#3b82f6', '#8b5cf6'];
export function CustomerReports() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  
  useEffect(() => {
    fetchReports();
  }, [dateFrom, dateTo]);
  
  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      
      const response = await fetch(`/api/customers/reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!reportData) {
    return <div className="text-center py-8 text-slate-500">No data available</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white p-3 md:p-4 rounded-[12px] border border-[#e5e7eb] mb-4">
        <span className="hidden md:inline text-sm font-medium text-slate-600">Date Range:</span>
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 flex-1">
          <div className="flex items-center gap-2">
            <span className="md:hidden text-sm font-medium text-slate-600 w-12">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm bg-white"
            />
          </div>
          <span className="hidden md:inline text-slate-400">to</span>
          <div className="flex items-center gap-2">
            <span className="md:hidden text-sm font-medium text-slate-600 w-12">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-lg text-sm bg-white"
            />
          </div>
        </div>
      </div>
      {/* Top Customers by Purchase Amount */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-hidden">
        <h3 className="text-sm font-bold text-slate-600 mb-4">Top 10 Customers by Purchase Amount</h3>
        <div className="h-[300px] md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reportData.topByPurchase || []} layout="vertical" margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="totalAmount" fill="#1d9f76" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Revenue by Customer Type */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-600 mb-4">Revenue by Customer Type</h3>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          <div className="h-[200px] w-[200px] md:h-64 md:w-full flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportData.revenueBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="revenue"
                  nameKey="label"
                  label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                  className="md:block hidden"
                >
                  {(reportData.revenueBreakdown || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Pie
                  data={reportData.revenueBreakdown || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="revenue"
                  nameKey="label"
                  className="block md:hidden"
                >
                  {(reportData.revenueBreakdown || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-[200px] md:hidden">
            {(reportData.revenueBreakdown || []).map((item: any, index: number) => {
               const total = reportData.revenueBreakdown.reduce((sum: number, i: any) => sum + i.revenue, 0);
               const percent = total > 0 ? ((item.revenue / total) * 100).toFixed(0) : 0;
               return (
                 <div key={index} className="flex items-center justify-between text-sm">
                   <div className="flex items-center gap-2">
                     <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                     <span className="text-slate-600 truncate">{item.label}</span>
                   </div>
                   <span className="font-bold shrink-0">{percent}%</span>
                 </div>
               );
            })}
          </div>
        </div>
      </div>
      
      {/* Top Customers by Bill Count */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-600 mb-4">Top Customers by Bill Count</h3>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-[13px] md:text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="hidden md:table-cell text-left py-2 px-3 font-medium text-slate-500">#</th>
                <th className="text-left py-2 px-1 md:px-3 font-medium text-slate-500">Customer</th>
                <th className="text-right py-2 px-1 md:px-3 font-medium text-slate-500">Bills</th>
                <th className="text-right py-2 px-1 md:px-3 font-medium text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {(reportData.topByBillCount || []).slice(0, 10).map((customer: any, index: number) => (
                <tr key={customer.id} className="border-b border-slate-100">
                  <td className="hidden md:table-cell py-2 px-3 text-slate-500">{index + 1}</td>
                  <td className="py-2 px-1 md:px-3 font-medium truncate max-w-[120px] md:max-w-none">{customer.name}</td>
                  <td className="py-2 px-1 md:px-3 text-right">{customer.totalBills}</td>
                  <td className="py-2 px-1 md:px-3 text-right font-bold">{formatCurrency(customer.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Highest Outstanding Balance */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-600 mb-4">Customers with Highest Outstanding Balance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-500">Customer</th>
                <th className="text-right py-2 px-3 font-medium text-slate-500">Phone</th>
                <th className="text-right py-2 px-3 font-medium text-slate-500">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {(reportData.topByOutstanding || []).slice(0, 10).map((customer: any) => (
                <tr key={customer.id} className="border-b border-slate-100">
                  <td className="py-2 px-3 font-medium">{customer.name}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{customer.phone || '-'}</td>
                  <td className="py-2 px-3 text-right font-bold text-amber-600">
                    {formatCurrency(customer.outstandingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!reportData.topByOutstanding || reportData.topByOutstanding.length === 0) && (
            <p className="text-center py-4 text-slate-400">No outstanding balances</p>
          )}
        </div>
      </div>
      
      {/* Monthly New Customer Acquisition */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-600 mb-4">Monthly New Customer Acquisition</h3>
        <div className="h-[160px] md:h-64 -ml-4 md:ml-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={reportData.newCustomerAcquisition || []} margin={{ left: -10, top: 10, right: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#1d9f76" 
                strokeWidth={2}
                dot={{ fill: '#1d9f76' }}
                name="New Customers"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-2 md:p-4 text-center flex flex-col justify-center">
          <p className="text-[10px] md:text-xs text-slate-500 leading-tight mb-1 md:mb-0">Total Customers</p>
          <p className="text-[16px] md:text-2xl font-bold">{reportData.totalCustomers || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-2 md:p-4 text-center flex flex-col justify-center">
          <p className="text-[10px] md:text-xs text-slate-500 leading-tight mb-1 md:mb-0">Total Outstanding</p>
          <p className="text-[16px] md:text-2xl font-bold text-amber-600">
            {formatCurrency(reportData.totalOutstanding || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-2 md:p-4 text-center flex flex-col justify-center">
          <p className="text-[10px] md:text-xs text-slate-500 leading-tight mb-1 md:mb-0">Active This Month</p>
          <p className="text-[16px] md:text-2xl font-bold text-green-600">
            {(reportData.retentionRate || 0).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

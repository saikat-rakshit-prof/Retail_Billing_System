'use client';

import { useState } from 'react';
import { MobileAvatar } from '@/components/layout/MobileAvatar';
import { Menu, BarChart2, Users } from 'lucide-react';
import { SalesReportTab } from '@/components/reports/SalesReportTab';
import { CustomerReports } from '@/components/customers/CustomerReports';

type Tab = 'sales' | 'customers';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-[88px] lg:pb-6 bg-[#f9fafb] min-h-screen lg:bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 lg:mb-6 px-4 pt-4 lg:px-0 lg:pt-0">
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-sidebar'));
              }
            }}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 leading-none mb-1">Reports</h1>
            <p className="text-slate-500 text-[11px] sm:text-sm truncate">Sales & customer analytics</p>
          </div>
          <div className="lg:hidden">
            <MobileAvatar />
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-0">
        {/* Tab Switcher */}
        <div className="flex bg-white rounded-[12px] border border-[#e5e7eb] h-[44px] p-1 mb-4 lg:mb-6">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 flex items-center justify-center gap-2 text-[14px] font-semibold transition-all ${
              activeTab === 'sales'
                ? 'bg-[#16a34a] text-white rounded-[10px] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden sm:inline">Sales Report</span>
            <span className="sm:hidden">Sales</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-1 flex items-center justify-center gap-2 text-[14px] font-semibold transition-all ${
              activeTab === 'customers'
                ? 'bg-[#16a34a] text-white rounded-[10px] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Customer Report</span>
            <span className="sm:hidden">Customers</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'sales' && <SalesReportTab />}
        
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <CustomerReports />
          </div>
        )}
      </div>
    </div>
  );
}

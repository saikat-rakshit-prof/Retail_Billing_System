'use client';

import { useState } from 'react';
import { Download, Loader2, ChevronDown } from 'lucide-react';
import { useCustomerStore } from '@/store/useCustomerStore';
import { formatCurrency } from '@/lib/utils';

interface CustomerExportProps {
  customers: any[];
  iconOnly?: boolean;
}

export function CustomerExport({ customers, iconOnly }: CustomerExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const { exportCustomers } = useCustomerStore();
  
  const handleExport = async (type: string) => {
    try {
      setIsExporting(true);
      setIsOpen(false);
      
      const filters: any = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      
      if (type === 'all') {
        // Export all customers
      } else if (type === 'outstanding') {
        // Filter to those with outstanding balance - handled by API or client
        filters.type = 'all'; // API will return all, we filter client-side
      } else if (type === 'wholesale') {
        filters.type = 'wholesale';
      }
      
      await exportCustomers(filters);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleCustomerSalesReport = async () => {
    try {
      setIsExporting(true);
      setIsOpen(false);
      
      // Fetch customer sales data
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      
      const response = await fetch(`/api/customers/reports?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      
      // Create CSV
      const headers = ['Customer Name', 'Total Bills', 'Total Amount', 'Average Bill', 'Last Purchase'];
      const csvRows = [headers.join(',')];
      
      data.topByPurchase?.forEach((customer: any) => {
        const row = [
          customer.name || '',
          customer.totalBills || 0,
          customer.totalAmount || 0,
          customer.totalBills > 0 ? (customer.totalAmount / customer.totalBills).toFixed(2) : 0,
          customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString('en-IN') : '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`);
        csvRows.push(row.join(','));
      });
      
      const csv = '\ufeff' + csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
      link.download = `customer-sales-report-${date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className={`flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 ${iconOnly ? 'w-10 h-10 px-0' : ''}`}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {!iconOnly && (
          <>
            Export
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
          {/* Date Range */}
          <div className="p-3 border-b border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-2">Date Range (Optional)</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                placeholder="To"
              />
            </div>
          </div>
          
          {/* Export Options */}
          <div className="p-2">
            <button
              onClick={() => handleExport('all')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded"
            >
              Export All Customers (CSV)
            </button>
            <button
              onClick={() => {
                // Filter and export
                const filtered = customers.filter(c => c.outstandingBalance > 0);
                exportFilteredCSV(filtered);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded"
            >
              Export with Outstanding (CSV)
            </button>
            <button
              onClick={() => handleExport('wholesale')}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded"
            >
              Export Wholesale (CSV)
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              onClick={handleCustomerSalesReport}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded text-primary"
            >
              Customer Sales Report (CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  );
  
  async function exportFilteredCSV(filteredCustomers: any[]) {
    const headers = ['Name', 'Phone', 'Email', 'Address', 'Customer Type', 'Total Purchases', 'Total Paid', 'Outstanding Balance', 'Total Bills'];
    const csvRows = [headers.join(',')];
    
    filteredCustomers.forEach((customer) => {
      const row = [
        customer.name || '',
        customer.phone || '',
        customer.email || '',
        customer.address || '',
        customer.customerType || '',
        customer.totalPurchases || 0,
        customer.totalPaid || 0,
        customer.outstandingBalance || 0,
        customer.totalBills || 0,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      csvRows.push(row.join(','));
    });
    
    const csv = '\ufeff' + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
    link.download = `customers-outstanding-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

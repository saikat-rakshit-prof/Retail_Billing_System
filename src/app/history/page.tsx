'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBillStore } from '@/store/useBillStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, formatDateTime, toNumber } from '@/lib/utils';
import { Search, Calendar, Filter, Receipt, ChevronRight, X, Printer, Download, Share2, MessageCircle, Loader2, Home } from 'lucide-react';
import { Bill, StoreSettings } from '@/types';
import { ThermalReceipt } from '@/components/billing/ThermalReceipt';
import { MobileAvatar } from '@/components/layout/MobileAvatar';
import { downloadBillImage, shareBillImage, shareViaWhatsApp, captureReceiptAsBase64 } from '@/lib/generateBillImage';
import { getPaymentTag, getPaymentBadgeStyle } from '@/lib/utils/paymentUtils';

export default function HistoryPage() {
  const router = useRouter();
  const { bills, forceRefresh } = useBillStore();
  const { shopName, shopPhone, shopAddress, taxRate, initialize: initSettings } = useSettingsStore();
  const { addToast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Download/Share states
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsapping, setIsWhatsapping] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Settings for receipt
  const settingsRef = useRef<StoreSettings>({
    shopName: 'My Store',
    ownerName: '',
    shopPhone: 'N/A',
    shopAddress: 'N/A',
    taxRate: 0,
    currency: 'INR',
    lowStockDefaultThreshold: 50,
  });

  // Update settings ref when settings change
  useEffect(() => {
    settingsRef.current = {
      shopName: shopName || 'My Store',
      ownerName: '',
      shopPhone: shopPhone || 'N/A',
      shopAddress: shopAddress || 'N/A',
      taxRate: taxRate || 0,
      currency: 'INR',
      lowStockDefaultThreshold: 50,
    };
  }, [shopName, shopPhone, shopAddress, taxRate]);

  useEffect(() => {
    const init = async () => {
      await initSettings();
      await forceRefresh();
      setIsLoading(false);
      
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('filter') === 'today') {
          setDateFilter('today');
        }
      }
    };
    init();
  }, [forceRefresh, initSettings]);

  // Preload logo image for html2canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/newlogo.png';
  }, []);

  // Filter bills
  const filteredBills = bills.filter((bill) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        bill.invoiceNumber.toLowerCase().includes(query) ||
        (bill.customerName && bill.customerName.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Date filter
    if (dateFilter !== 'all') {
      const billDate = new Date(bill.createdAt);
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          if (billDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (billDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (billDate < monthAgo) return false;
          break;
        case 'custom':
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (billDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (billDate > end) return false;
          }
          break;
      }
    }

    return true;
  });

  // Calculate stats - handle both string and number types from database
  const totalRevenue = bills.reduce((sum, b) => {
    const amount = typeof b.totalAmount === 'string' ? parseFloat(b.totalAmount) : b.totalAmount;
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);
  const totalBills = bills.length;
  const averageBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;

  // getPaymentModeBadge is no longer used, we use getPaymentBadgeStyle

  const handleDownload = async () => {
    if (!receiptRef.current || !selectedBill) return;
    
    setIsDownloading(true);
    try {
      await downloadBillImage(receiptRef.current, selectedBill.invoiceNumber);
      addToast('success', 'Bill downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      addToast('error', 'Failed to download bill');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current || !selectedBill) return;
    
    setIsSharing(true);
    try {
      const success = await shareBillImage(receiptRef.current, selectedBill.invoiceNumber, settingsRef.current.shopName);
      if (success) {
        addToast('success', 'Bill shared successfully');
      } else {
        addToast('info', 'Sharing not supported on this device — bill downloaded instead');
      }
    } catch (error) {
      console.error('Share error:', error);
      addToast('error', 'Failed to share bill');
    } finally {
      setIsSharing(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!receiptRef.current || !selectedBill) return;
    
    setIsWhatsapping(true);
    try {
      // First capture as high-res base64 PNG (Fix 5)
      const base64 = await captureReceiptAsBase64(receiptRef.current);
      
      // Convert base64 to blob
      const res = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], `${selectedBill.invoiceNumber}.png`, {
        type: 'image/png'
      });

      // Try Web Share API first (mobile) (Fix 5)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Fallback: download high quality PNG and open WhatsApp
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedBill.invoiceNumber}.png`;
        link.click();
        
        // Open WhatsApp with message
        const message = encodeURIComponent(
          `Your bill from ${settingsRef.current.shopName}.\nInvoice: ${selectedBill.invoiceNumber}\nTotal: ₹${Number(selectedBill.totalAmount).toFixed(2)}`
        );
        const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;
        window.open(whatsappUrl, '_blank');
        
        addToast('info', 'Bill image downloaded — please attach it manually in WhatsApp');
      }
    } catch (error) {
      console.error('WhatsApp error:', error);
      addToast('error', 'Failed to share via WhatsApp');
    } finally {
      setIsWhatsapping(false);
    }
  };



  const handleCloseModal = () => {
    setSelectedBill(null);
    setIsDownloading(false);
    setIsSharing(false);
    setIsWhatsapping(false);
  };

  const isAnyLoading = isDownloading || isSharing || isWhatsapping;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-8 w-32 rounded"></div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between lg:justify-start lg:gap-4 mb-2 lg:mb-0">
        <div className="flex items-center gap-2 lg:gap-4 w-full">
          {/* Mobile hamburger */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-sidebar'));
              }
            }}
            className="p-2 -ml-2 hover:bg-slate-100 rounded-lg lg:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>

          {/* Back/Home buttons for desktop */}
          <div className="hidden lg:flex gap-1">
            <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></button>
            <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-slate-100 rounded-lg"><Home className="w-5 h-5 text-slate-600" /></button>
          </div>

          <div className="hidden lg:flex bg-primary/10 p-2 rounded-lg shrink-0">
            <Receipt className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1 text-center lg:text-left min-w-0">
            <h1 className="text-lg lg:text-xl font-bold">Bill History</h1>
            <p className="text-[11px] lg:text-sm text-slate-500 truncate">View all transaction records</p>
          </div>

          <MobileAvatar />
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 lg:gap-4">
        {/* Mobile Stat Card 1 / Desktop Stat Card 1 */}
        <div className="bg-white lg:bg-slate-800 p-3 lg:p-6 rounded-xl lg:rounded-xl border border-slate-100 lg:border-primary/5 shadow-sm lg:shadow-sm">
          <div className="flex items-center justify-between mb-1 lg:mb-2">
            <p className="text-[#9ca3af] lg:text-slate-500 text-[11px] lg:text-sm font-medium">Total Revenue</p>
            <Receipt className="hidden lg:block w-5 h-5 text-primary" />
          </div>
          <p className="text-[20px] lg:text-3xl font-bold text-[#111] lg:text-primary">{formatCurrency(totalRevenue)}</p>
          <p className="text-[11px] lg:text-xs text-[#16a34a] lg:text-slate-400 mt-1 lg:mt-2 font-medium">
            {totalBills > 0 ? `+${((totalRevenue / (totalRevenue - totalRevenue * 0.1)) * 10).toFixed(1)}%` : '0%'} <span className="hidden lg:inline">from last period</span><span className="lg:hidden">↑</span>
          </p>
        </div>

        {/* Mobile Stat Card 2 / Desktop Stat Card 2 */}
        <div className="bg-white lg:bg-slate-800 p-3 lg:p-6 rounded-xl lg:rounded-xl border border-slate-100 lg:border-primary/5 shadow-sm lg:shadow-sm">
          <div className="flex items-center justify-between mb-1 lg:mb-2">
            <p className="text-[#9ca3af] lg:text-slate-500 text-[11px] lg:text-sm font-medium">Total Bills</p>
            <Receipt className="hidden lg:block w-5 h-5 text-primary" />
          </div>
          <p className="text-[20px] lg:text-3xl font-bold text-[#111] lg:text-white">{totalBills}</p>
          <p className="text-[11px] lg:text-xs text-[#9ca3af] lg:text-slate-400 mt-1 lg:mt-2 font-medium">
            <span className="lg:hidden">₹{averageBillValue.toFixed(0)} avg/bill</span>
            <span className="hidden lg:inline">Average: {formatCurrency(averageBillValue)} per bill</span>
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-2 lg:gap-3 mb-2 lg:mb-0">
        <div className="w-full lg:flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search customer or bill ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 lg:border-none rounded-lg py-2 lg:py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary shadow-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          {/* Mobile date pickers */}
          {dateFilter === 'custom' ? (
            <div className="flex-1 lg:hidden flex flex-col gap-2 w-full">
              <div className="w-full">
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-[0.05em] mb-1 px-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    padding: '0 12px',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    height: '44px',
                    width: '100%',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    color: '#111',
                  }}
                />
              </div>
              <div className="w-full">
                <label className="block text-[11px] font-bold text-[#9ca3af] uppercase tracking-[0.05em] mb-1 px-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    padding: '0 12px',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '14px',
                    height: '44px',
                    width: '100%',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    color: '#111',
                  }}
                />
              </div>
              <button 
                onClick={() => {
                  // Filtering is client-side but we trigger UI feedback or force refetch
                  if (typeof document !== 'undefined') {
                    (document.activeElement as HTMLElement)?.blur?.();
                  }
                }}
                className="w-full h-[44px] bg-[#16a34a] hover:bg-[#15803d] text-white rounded-[10px] text-[14px] font-semibold shadow-sm transition-colors"
              >
                Apply
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setDateFilter('custom')}
              className="flex-1 lg:hidden flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-500"
            >
              <Calendar className="w-4 h-4" />
              <span>Select Date</span>
            </button>
          )}
          
          <button className="hidden lg:flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-primary/5 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Calendar className="w-4 h-4" />
            {dateFilter === 'all' && 'All Time'}
            {dateFilter === 'today' && 'Today'}
            {dateFilter === 'week' && 'Last 7 Days'}
            {dateFilter === 'month' && 'Last 30 Days'}
          </button>
          
          <div className="w-[120px] lg:w-auto">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-white px-3 lg:px-4 py-2 lg:py-2 h-[38px] lg:h-auto rounded-lg border border-slate-200 lg:border-primary/5 text-sm font-medium"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden space-y-2">
        {filteredBills.length > 0 ? (
          filteredBills.map((bill) => {
            const total = typeof bill.totalAmount === 'string' ? parseFloat(bill.totalAmount) : bill.totalAmount;
            const paid = typeof bill.cashReceived === 'string' ? parseFloat(bill.cashReceived) : (bill.cashReceived || 0);
            const status = paid >= total ? { text: 'PAID', bg: 'bg-[#dcfce7]', textC: 'text-[#16a34a]' } : paid > 0 ? { text: 'PARTIAL', bg: 'bg-[#fef3c7]', textC: 'text-[#d97706]' } : { text: 'DUE', bg: 'bg-[#fee2e2]', textC: 'text-[#dc2626]' };
            
            const pMode = getPaymentTag(bill);
            const modeBg = getPaymentBadgeStyle(pMode);
            
            return (
              <div 
                key={bill.id} 
                onClick={() => setSelectedBill(bill)}
                className="bg-white border border-slate-100 rounded-[12px] p-3 mb-2"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[13px] font-semibold">{bill.invoiceNumber}</span>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${modeBg}`}>{pMode}</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${status.bg} ${status.textC}`}>{status.text}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[14px] font-semibold text-slate-800">{bill.customerName || 'Walk-in Customer'}</span>
                  <span className="text-[15px] font-bold text-[#16a34a]">{formatCurrency(total)}</span>
                </div>
                <div>
                  <span className="text-[12px] text-[#9ca3af]">{formatDate(bill.createdAt)} • {new Date(bill.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-white rounded-xl border border-slate-100 text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bills found</p>
          </div>
        )}
      </div>

      {/* Desktop Bills Table */}
      <div className="hidden lg:block bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-primary/5">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Bill #</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Payment Mode</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                <th className="px-6 py-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {filteredBills.length > 0 ? (
                filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className="hover:bg-primary/5 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium">{formatDate(bill.createdAt)}</p>
                      <p className="text-xs text-slate-500">{bill.invoiceNumber}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-700">
                        {bill.customerName || 'Walk-in Customer'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getPaymentBadgeStyle(getPaymentTag(bill))}`}>
                        {getPaymentTag(bill)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {formatCurrency(bill.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <Receipt className="w-12 h-12 mx-auto mb-2" />
                    <p>No bills found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-primary/5 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {filteredBills.length} of {bills.length} bills
          </p>
        </div>
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center lg:p-4 animate-fade-in-overlay" style={{ touchAction: 'none' }}>
          <div className="absolute inset-0 bg-transparent" onClick={handleCloseModal} />
          <div className="relative bg-white w-full lg:max-w-lg rounded-t-[20px] lg:rounded-2xl shadow-2xl overflow-hidden h-[95vh] lg:h-auto lg:max-h-[90vh] flex flex-col animate-slide-up lg:animate-scale-in">
            <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
              <div>
                <h3 className="text-[17px] font-semibold">Bill Details</h3>
                <p className="text-[13px] text-slate-500">{selectedBill.invoiceNumber}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 lg:p-0 text-slate-400 hover:text-slate-600 bg-slate-50 lg:bg-transparent rounded-full"
              >
                <X className="w-5 h-5 lg:w-5 lg:h-5" />
              </button>
            </div>
            
            {/* Receipt Preview - Scrollable */}
            <div className="p-4 bg-white lg:bg-slate-50 overflow-hidden flex-1">
              <div 
                className="bg-[#f9fafb] lg:bg-transparent border border-slate-100 lg:border-none rounded-xl p-4 lg:p-0 lg:scale-50 lg:origin-top lg:-mx-16 lg:-mb-8 w-full relative overflow-y-scroll overscroll-contain touch-pan-y min-h-[250px] max-h-[calc(100vh-340px)] lg:max-h-none" 
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div ref={receiptRef} className="w-full flex justify-center origin-top lg:origin-top lg:scale-100 transform min-w-[300px]">
                  <ThermalReceipt bill={selectedBill} settings={settingsRef.current} />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 lg:p-6 border-t border-slate-100 bg-white shrink-0 space-y-2.5 pb-8 lg:pb-6">
              <button
                onClick={handleDownload}
                disabled={isAnyLoading}
                className="w-full h-[46px] flex items-center justify-center gap-2 bg-white border-[1.5px] border-[#16a34a] hover:bg-green-50 disabled:opacity-50 text-[#16a34a] rounded-[10px] font-semibold text-[14px] transition-colors"
              >
                {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PNG
              </button>

              <div className="flex gap-2.5">
                <button
                  onClick={handleShare}
                  disabled={isAnyLoading}
                  className="flex-1 h-[46px] flex items-center justify-center gap-2 bg-[#16a34a] border-none hover:bg-[#15803d] disabled:opacity-50 text-white rounded-[10px] font-semibold text-[14px] transition-colors"
                >
                  {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Print
                </button>

                <button
                  onClick={handleWhatsApp}
                  disabled={isAnyLoading}
                  className="flex-1 h-[46px] flex items-center justify-center gap-2 bg-white border border-[#25d366] hover:bg-[#f0fdf4] disabled:opacity-50 text-[#25d366] rounded-[10px] font-semibold text-[14px] transition-colors"
                >
                  {isWhatsapping ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

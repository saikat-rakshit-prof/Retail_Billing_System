'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Download, Printer, MessageCircle } from 'lucide-react';
import { Bill } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useToast } from '@/components/Toast';
import { ThermalReceipt } from '@/components/billing/ThermalReceipt';
import { downloadBillImage, shareBillImage, shareViaWhatsApp, captureReceiptAsBase64 } from '@/lib/generateBillImage';

interface BillDetailsModalProps {
  billId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BillDetailsModal({ billId, isOpen, onClose }: BillDetailsModalProps) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsapping, setIsWhatsapping] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  const { shopName, shopPhone, shopAddress, taxRate } = useSettingsStore();
  const { addToast } = useToast();

  const settings = {
    shopName: shopName || 'My Store',
    ownerName: '',
    shopPhone: shopPhone || 'N/A',
    shopAddress: shopAddress || 'N/A',
    taxRate: taxRate || 0,
    currency: 'INR',
    lowStockDefaultThreshold: 50,
  };

  useEffect(() => {
    if (isOpen && billId) {
      fetchBill();
    }
  }, [isOpen, billId]);

  // Preload logo image for html2canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/newlogo.png';
  }, []);

  const fetchBill = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/bills/${billId}`);
      if (response.ok) {
        const data = await response.json();
        setBill(data);
      } else {
        addToast('error', 'Failed to load bill details');
      }
    } catch (error) {
      console.error(error);
      addToast('error', 'Failed to load bill details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!receiptRef.current || !bill) return;
    setIsDownloading(true);
    try {
      await downloadBillImage(receiptRef.current, bill.invoiceNumber);
      addToast('success', 'Bill downloaded successfully');
    } catch (error) {
      console.error(error);
      addToast('error', 'Failed to download bill');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current || !bill) return;
    setIsSharing(true);
    try {
      const success = await shareBillImage(receiptRef.current, bill.invoiceNumber, settings.shopName);
      if (success) {
        addToast('success', 'Bill shared successfully');
      } else {
        addToast('info', 'Sharing not supported, downloaded instead');
      }
    } catch (error) {
      console.error(error);
      addToast('error', 'Failed to share bill');
    } finally {
      setIsSharing(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!receiptRef.current || !bill) return;
    setIsWhatsapping(true);
    try {
      // First capture as high-res base64 PNG (Fix 5)
      const base64 = await captureReceiptAsBase64(receiptRef.current);
      
      // Convert base64 to blob
      const res = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], `${bill.invoiceNumber}.png`, {
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
        link.download = `${bill.invoiceNumber}.png`;
        link.click();
        
        // Open WhatsApp with message
        const message = encodeURIComponent(
          `Your bill from ${settings.shopName}.\nInvoice: ${bill.invoiceNumber}\nTotal: ₹${Number(bill.totalAmount).toFixed(2)}`
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

  if (!isOpen) return null;

  const isAnyLoading = isDownloading || isSharing || isWhatsapping;

  return (
    <div className="fixed inset-0 z-[120] flex items-end lg:items-center justify-center lg:p-4 animate-fade-in-overlay" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative bg-white w-full lg:max-w-lg rounded-t-[20px] lg:rounded-2xl shadow-2xl overflow-hidden h-[95vh] lg:h-auto lg:max-h-[90vh] flex flex-col animate-slide-up lg:animate-scale-in">
        <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0">
          <div>
            <h3 className="text-[17px] font-semibold">Bill Details</h3>
            <p className="text-[13px] text-slate-500">{bill?.invoiceNumber || 'Loading...'}</p>
          </div>
          <button onClick={onClose} className="p-2 lg:p-0 text-slate-400 hover:text-slate-600 bg-slate-50 lg:bg-transparent rounded-full">
            <X className="w-5 h-5 lg:w-5 lg:h-5" />
          </button>
        </div>
        
        {/* Receipt Preview */}
        <div className="p-4 bg-white lg:bg-slate-50 overflow-hidden flex-1 flex flex-col relative">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : bill ? (
            <div className="bg-[#f9fafb] lg:bg-transparent border border-slate-100 lg:border-none rounded-xl p-4 lg:p-0 lg:scale-50 lg:origin-top lg:-mx-16 lg:-mb-8 w-full relative overflow-y-scroll overscroll-contain touch-pan-y min-h-[250px] max-h-[calc(100vh-340px)] lg:max-h-none" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div ref={receiptRef} className="w-full flex justify-center origin-top lg:origin-top lg:scale-100 transform min-w-[300px]">
                <ThermalReceipt bill={bill} settings={settings} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Failed to load bill data
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 lg:p-6 border-t border-slate-100 bg-white shrink-0 space-y-2.5 pb-8 lg:pb-6">
          <button
            onClick={handleDownload}
            disabled={isAnyLoading || !bill}
            className="w-full h-[46px] flex items-center justify-center gap-2 bg-white border-[1.5px] border-[#16a34a] hover:bg-green-50 disabled:opacity-50 text-[#16a34a] rounded-[10px] font-semibold text-[14px] transition-colors"
          >
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PNG
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={handleShare}
              disabled={isAnyLoading || !bill}
              className="flex-1 h-[46px] flex items-center justify-center gap-2 bg-[#16a34a] border-none hover:bg-[#15803d] disabled:opacity-50 text-white rounded-[10px] font-semibold text-[14px] transition-colors"
            >
              {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-4 h-4" />}
              Print
            </button>

            <button
              onClick={handleWhatsApp}
              disabled={isAnyLoading || !bill}
              className="flex-1 h-[46px] flex items-center justify-center gap-2 bg-white border border-[#25d366] hover:bg-[#f0fdf4] disabled:opacity-50 text-[#25d366] rounded-[10px] font-semibold text-[14px] transition-colors"
            >
              {isWhatsapping ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

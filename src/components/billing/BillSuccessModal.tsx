'use client';

import { useState, useRef, useEffect } from 'react';
import { Bill, StoreSettings } from '@/types';
import { ThermalReceipt } from './ThermalReceipt';
import { 
  captureReceiptAsBase64, 
  downloadBillImage, 
  shareBillImage, 
  shareViaWhatsApp,
  shareToTinyPrint,
  openTinyPrintApp
} from '@/lib/generateBillImage';
import { useToast } from '@/components/Toast';
import { Check, Download, Share2, MessageCircle, Printer, X, Loader2 } from 'lucide-react';

interface BillSuccessModalProps {
  bill: Bill;
  settings: StoreSettings;
  isOpen: boolean;
  onClose: () => void;
  onNewBill: () => void;
}

export function BillSuccessModal({ 
  bill, 
  settings, 
  isOpen, 
  onClose, 
  onNewBill 
}: BillSuccessModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isWhatsapping, setIsWhatsapping] = useState(false);
  const [isTinyPrint, setIsTinyPrint] = useState(false);

  const { addToast } = useToast();

  // Get shop details for sharing
  const shopName = settings.shopName || 'My Store';

  // Reset loading states when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsCapturing(false);
      setIsDownloading(false);
      setIsSharing(false);
      setIsWhatsapping(false);
    }
  }, [isOpen]);

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    
    setIsDownloading(true);
    try {
      await downloadBillImage(receiptRef.current, bill.invoiceNumber);
      addToast('success', 'Bill downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      addToast('error', 'Failed to download bill');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;
    
    setIsSharing(true);
    try {
      const success = await shareBillImage(receiptRef.current, bill.invoiceNumber, shopName);
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
    if (!receiptRef.current) return;
    
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
          `Your bill from ${shopName}.\nInvoice: ${bill.invoiceNumber}\nTotal: ₹${Number(bill.totalAmount).toFixed(2)}`
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


  const handleNewBill = () => {
    onNewBill();
    onClose();
  };

  const handleTinyPrint = async () => {
    if (!receiptRef.current) return;
    
    setIsTinyPrint(true);
    try {
      await shareToTinyPrint(receiptRef.current, bill.invoiceNumber, shopName);
      addToast('success', 'Bill sent to TinyPrint');
    } catch (error) {
      console.error('TinyPrint error:', error);
      addToast('error', 'Failed to share to TinyPrint');
    } finally {
      setIsTinyPrint(false);
    }
  };

  if (!isOpen) return null;

  const isAnyLoading = isDownloading || isSharing || isWhatsapping || isTinyPrint;

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 flex items-end lg:items-center justify-center z-[100] lg:p-4 animate-fade-in-overlay">
        {/* Modal Content */}
        <div className="bg-[#f9fafb] lg:bg-white rounded-t-[20px] lg:rounded-2xl shadow-2xl max-w-md w-full h-[95vh] lg:h-auto lg:max-h-[90vh] flex flex-col overflow-hidden animate-slide-up lg:animate-scale-in">
          {/* Header */}
          <div className="bg-white lg:bg-transparent p-4 pb-3 lg:p-6 text-center border-b border-[#f3f4f6] shrink-0">
            {/* Animated Green Checkmark */}
            <div className="w-[56px] h-[56px] lg:w-20 lg:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 lg:mb-4 animate-in zoom-in duration-300">
              <Check className="w-8 h-8 lg:w-10 lg:h-10 text-green-600" strokeWidth={3} />
            </div>
            
            <h2 className="text-[20px] lg:text-2xl font-bold text-[#111] lg:text-slate-900 mb-1 lg:mb-2">Bill Generated!</h2>
            
            {/* Invoice Number */}
            <p className="font-semibold lg:font-mono text-[#16a34a] lg:font-medium text-[14px] lg:text-lg">
              {bill.invoiceNumber}
            </p>
            
            {/* Customer Name */}
            {bill.customerName && (
              <p className="text-[#6b7280] lg:text-slate-500 text-[13px] lg:text-sm mt-0.5 lg:mt-1">
                Customer: {bill.customerName}
              </p>
            )}
            
            {/* Total Amount */}
            <p className="text-[24px] lg:text-3xl font-bold lg:font-mono text-[#111] lg:text-slate-900 mt-2 lg:mt-4">
              ₹{Number(bill.totalAmount).toFixed(2)}
            </p>
            
            {/* Payment Status */}
            {bill.status === 'partially_paid' && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-700 text-sm font-medium">
                  Partially Paid
                </p>
                <p className="text-amber-600 text-xs">
                  Outstanding: ₹{((Number(bill.totalAmount) || 0) - (Number(bill.cashReceived) || 0)).toFixed(2)}
                </p>
              </div>
            )}
            {bill.status === 'pending' && bill.paymentMode === 'Credit' && (
              <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-700 text-sm font-medium">
                  Credit / Pending Payment
                </p>
                <p className="text-amber-600 text-xs">
                  Full amount added to customer balance
                </p>
              </div>
            )}
          </div>

          {/* Receipt Preview */}
          <div className="flex-1 overflow-hidden flex flex-col p-4 lg:bg-slate-50 lg:border-b lg:border-slate-100">
            <div className="bg-[#f5f5f5] lg:bg-transparent rounded-[12px] lg:rounded-none p-3 lg:p-0 overflow-y-auto w-full lg:max-h-none flex-1 lg:flex-none">
              <div className="w-full flex justify-center lg:scale-50 lg:origin-top lg:-mx-16 lg:-mb-8">
                {/* 
                  Wrapper div to capture the exact rendered element.
                  To ensure html2canvas captures it fully even if scrolled,
                  the ref is right on the thermal receipt block. 
                */}
                <div ref={receiptRef} className="flex justify-center origin-top lg:origin-top transform scale-150 lg:scale-100 mb-24 lg:mb-0 touch-pan-y" style={{ touchAction: 'pinch-zoom' }}>
                  <ThermalReceipt bill={bill} settings={settings} />
                </div>
              </div>
            </div>
            <p className="text-center text-[11px] text-[#9ca3af] mt-2 lg:hidden shrink-0">Scroll to view full receipt</p>
          </div>

          {/* Action Buttons */}
          <div className="bg-white p-4 pb-[88px] lg:pb-6 border-t border-[#f3f4f6] lg:border-none shrink-0 rounded-t-[16px] lg:rounded-none">
            {/* Download PNG - White style */}
            <button
              onClick={handleDownload}
              disabled={isAnyLoading}
              className="w-full h-[46px] lg:h-auto lg:py-3 flex items-center justify-center gap-2 bg-white border-[1.5px] border-[#16a34a] hover:bg-green-50 disabled:opacity-50 text-[#16a34a] rounded-[10px] lg:rounded-xl font-semibold text-[15px] lg:text-base transition-colors mb-2.5 lg:mb-3"
            >
              {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Download PNG
            </button>

            {/* Share/Print and WhatsApp Row */}
            <div className="flex gap-2.5 mb-2.5 lg:mb-3 lg:grid lg:grid-cols-2">
              <button
                onClick={handleShare}
                disabled={isAnyLoading}
                className="flex-1 h-[46px] lg:h-auto lg:py-3 flex items-center justify-center gap-2 bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white rounded-[10px] lg:rounded-xl font-semibold text-[14px] transition-colors"
              >
                {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-4 h-4" />}
                Print
              </button>

              <button
                onClick={handleWhatsApp}
                disabled={isAnyLoading}
                className="flex-1 h-[46px] lg:h-auto lg:py-3 flex items-center justify-center gap-2 bg-white border-[1.5px] border-[#16a34a] hover:bg-[#f0fdf4] disabled:opacity-50 text-[#16a34a] rounded-[10px] lg:rounded-xl font-semibold text-[14px] transition-colors"
              >
                {isWhatsapping ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                WhatsApp
              </button>
            </div>

            {/* New Bill - Ghost */}
            <button
              onClick={handleNewBill}
              disabled={isAnyLoading}
              className="w-full h-[46px] lg:h-auto lg:py-3 flex items-center justify-center gap-2 bg-white lg:bg-transparent lg:hover:bg-slate-100 border border-[#e5e7eb] disabled:opacity-50 text-[#374151] lg:text-slate-500 rounded-[10px] lg:rounded-xl font-semibold text-[14px] transition-colors"
            >
              <X className="w-4 h-4" />
              New Bill
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { X, Loader2, Minus, Plus, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { PaymentMode, Bill } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface ManageDueModalProps {
  customerId: string;
  currentBalance: number;
  customerName: string;
  dueBills: Bill[];
  onClose: () => void;
  onSuccess: () => void;
}

export function ManageDueModal({
  customerId,
  currentBalance,
  customerName,
  dueBills,
  onClose,
  onSuccess,
}: ManageDueModalProps) {
  const [selectedBill, setSelectedBill] = useState<Bill | 'all' | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [isLoading, setIsLoading] = useState(false);
  
  const { addToast } = useToast();
  
  const billsToPay = dueBills.filter(b => (b.outstandingAmount || 0) > 0);
  const totalOutstanding = billsToPay.reduce((sum, b) => sum + (b.outstandingAmount || 0), 0);
  
  const handleSelectBill = (bill: Bill) => {
    setSelectedBill(bill);
    setAmount((bill.outstandingAmount || 0).toString());
  };
  
  const handlePayAll = () => {
    setSelectedBill('all');
    setAmount(totalOutstanding.toString());
  };

  const handleConfirm = async () => {
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      addToast('error', 'Please enter a valid amount');
      return;
    }
    
    setIsLoading(true);
    try {
      if (selectedBill === 'all') {
        let remaining = payAmount;
        const sortedBills = [...billsToPay].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        for (const bill of sortedBills) {
          if (remaining <= 0) break;
          const billDue = bill.outstandingAmount || 0;
          const payForBill = Math.min(billDue, remaining);
          
          await fetch(`/api/bills/${bill.id}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: payForBill,
              paymentMode,
              customerId
            })
          });
          remaining -= payForBill;
        }
      } else if (selectedBill) {
        await fetch(`/api/bills/${selectedBill.id}/payment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: payAmount,
            paymentMode,
            customerId
          })
        });
      }
      
      addToast('success', `Payment of ${formatCurrency(payAmount)} recorded for ${customerName}`);
      
      setSelectedBill(null);
      
      if (payAmount >= totalOutstanding) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
      
      onSuccess();
    } catch (error) {
      console.error(error);
      addToast('error', 'Failed to record payment');
    } finally {
      setIsLoading(false);
    }
  };

  const currentDueAmount = selectedBill === 'all' 
    ? totalOutstanding 
    : (selectedBill?.outstandingAmount || 0);

  const amountNum = parseFloat(amount) || 0;
  const isPaidFull = amountNum >= currentDueAmount;
  const remainingDue = Math.max(0, currentDueAmount - amountNum);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-[20px] sm:rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-hidden flex flex-col animate-slide-up sm:animate-none">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-lg font-bold">Manage Due — {customerName}</h2>
            <p className={`text-sm font-semibold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Outstanding: {formatCurrency(totalOutstanding)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {!selectedBill ? (
            <div className="space-y-3">
              {billsToPay.map(bill => (
                <div 
                  key={bill.id} 
                  onClick={() => handleSelectBill(bill)}
                  className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-[#16a34a] hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="font-semibold text-sm">{bill.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">{new Date(bill.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                  </div>
                  <p className="font-bold text-red-600">{formatCurrency(bill.outstandingAmount || 0)}</p>
                </div>
              ))}
              
              {billsToPay.length === 0 && (
                <div className="py-8 text-center text-green-600 font-bold">
                  All dues cleared! 🎉
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <span className="font-semibold text-slate-700">
                  {selectedBill === 'all' ? 'Paying All Dues' : `Paying: ${selectedBill.invoiceNumber}`}
                </span>
                <span className="font-bold text-red-600">Due: {formatCurrency(currentDueAmount)}</span>
              </div>
              
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button 
                    onClick={() => setAmount(Math.max(0, amountNum - 100).toString())}
                    className="px-5 py-4 hover:bg-slate-100 text-slate-500 border-r border-slate-200"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-28 text-center font-bold text-2xl outline-none"
                    min="0"
                  />
                  <button 
                    onClick={() => setAmount((amountNum + 100).toString())}
                    className="px-5 py-4 hover:bg-slate-100 text-slate-500 border-l border-slate-200"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3 mb-8">
                <button
                  onClick={() => setPaymentMode('Cash')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-colors ${
                    paymentMode === 'Cash' ? 'border-[#16a34a] bg-[#f0fdf4] text-[#16a34a]' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                  }`}
                >
                  CASH
                </button>
                <button
                  onClick={() => setPaymentMode('UPI')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-colors ${
                    paymentMode === 'UPI' ? 'border-[#16a34a] bg-[#f0fdf4] text-[#16a34a]' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                  }`}
                >
                  UPI
                </button>
              </div>
              
              <div className={`p-4 rounded-xl mb-6 flex items-center justify-center gap-2 ${
                isPaidFull ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {isPaidFull ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                <span className="text-[15px] font-medium">
                  Status: {isPaidFull ? '✓ Will be marked PAID' : `Partial — ${formatCurrency(remainingDue)} still due`}
                </span>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedBill(null)}
                  className="px-5 py-4 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isLoading || amountNum <= 0}
                  className="flex-1 py-4 bg-[#16a34a] text-white rounded-xl font-bold text-[15px] hover:bg-green-700 disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  Confirm Payment
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer for Pay All */}
        {!selectedBill && billsToPay.length > 0 && (
          <div className="p-4 bg-white border-t border-slate-200">
            <button
              onClick={handlePayAll}
              className="w-full h-[52px] bg-[#16a34a] text-white rounded-xl font-bold text-[16px] hover:bg-green-700 shadow-sm"
            >
              Pay All ({formatCurrency(totalOutstanding)})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

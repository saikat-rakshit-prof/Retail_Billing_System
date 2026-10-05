'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCustomerStore } from '@/store/useCustomerStore';
import { PaymentMode, CustomerPaymentType } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface RecordPaymentModalProps {
  customerId: string;
  currentBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  customerId,
  currentBalance,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(currentBalance.toString());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [type, setType] = useState<CustomerPaymentType>('payment');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { recordPayment } = useCustomerStore();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (type === 'payment' && amountNum > currentBalance) {
      setError('Payment amount cannot exceed outstanding balance');
      return;
    }
    
    setIsLoading(true);
    try {
      await recordPayment(customerId, {
        amount: amountNum,
        paymentMode,
        type,
        note: note.trim() || undefined,
      });
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold">Record Payment</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}
          
          {/* Current Balance */}
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Current Outstanding Balance</p>
            <p className="text-xl font-bold text-amber-600">
              {formatCurrency(currentBalance)}
            </p>
          </div>
          
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              step="0.01"
              min="0"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAmount(currentBalance.toString())}
                className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Full Balance
              </button>
              <button
                type="button"
                onClick={() => setAmount((currentBalance / 2).toFixed(2))}
                className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Half
              </button>
            </div>
          </div>
          
          {/* Payment Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CustomerPaymentType)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            >
              <option value="payment">Payment (Reduce Balance)</option>
              <option value="refund">Refund (Increase Balance)</option>
              <option value="credit">Credit (New Purchase)</option>
            </select>
          </div>
          
          {/* Payment Mode */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Mode
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          </div>
          
          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              rows={2}
            />
          </div>
          
          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

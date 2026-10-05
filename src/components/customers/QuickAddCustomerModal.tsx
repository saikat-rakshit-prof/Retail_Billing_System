'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useCustomerStore } from '@/store/useCustomerStore';
import { CustomerType } from '@/types';
import { CUSTOMER_TYPES } from '@/lib/constants/customerConstants';

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: any) => void;
  initialName?: string;
}

export function QuickAddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
  initialName = '',
}: QuickAddCustomerModalProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('regular');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { addCustomer } = useCustomerStore();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    setIsLoading(true);
    try {
      const newCustomer = await addCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        customerType,
      });
      
      onSuccess(newCustomer);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    setName('');
    setPhone('');
    setCustomerType('regular');
    setError('');
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold">Add New Customer</h2>
          <button
            onClick={handleClose}
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
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number (optional)"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Customer Type
            </label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            >
              {Object.entries(CUSTOMER_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
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
              Add Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

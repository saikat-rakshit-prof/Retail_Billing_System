'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, User } from 'lucide-react';
import { useCustomerStore } from '@/store/useCustomerStore';
import { CustomerSummary, CustomerWithStats } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { getBalanceStatus } from '@/lib/constants/customerConstants';

interface CustomerSearchDropdownProps {
  onSelect: (customer: CustomerWithStats | null) => void;
  selectedCustomer: CustomerWithStats | null;
  onAddNew?: () => void;
}

export function CustomerSearchDropdown({ 
  onSelect, 
  selectedCustomer,
  onAddNew 
}: CustomerSearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [localResults, setLocalResults] = useState<CustomerWithStats[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { initialize, customers } = useCustomerStore();
  
  // Initialize customers on mount
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  // Priority-based search
  useEffect(() => {
    if (!query.trim()) {
      setLocalResults([]);
      return;
    }
    
    const q = query.toLowerCase().trim();
    
    const startsWith = customers.filter(c =>
      c.name.toLowerCase().startsWith(q) ||
      (c.phone && c.phone.startsWith(q))
    );
    
    const contains = customers.filter(c =>
      !c.name.toLowerCase().startsWith(q) &&
      !(c.phone && c.phone.startsWith(q)) &&
      (c.name.toLowerCase().includes(q) ||
       (c.phone && c.phone.includes(q)))
    );
    
    setLocalResults([...startsWith, ...contains]);
  }, [query, customers]);
  
  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = useCallback((customer: CustomerSummary) => {
    // Find full customer data
    const fullCustomer = customers.find(c => c.id === customer.id);
    if (fullCustomer) {
      onSelect(fullCustomer);
    }
    setQuery('');
    setIsOpen(false);
  }, [customers, onSelect]);
  
  const handleClear = useCallback(() => {
    onSelect(null);
    setQuery('');
    setIsOpen(false);
  }, [onSelect]);
  
  // Show selected customer
  if (selectedCustomer) {
    const balanceStatus = getBalanceStatus(
      selectedCustomer.outstandingBalance
    );
    
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm">{selectedCustomer.name}</p>
              <p className="text-xs text-slate-500">{selectedCustomer.phone || 'No phone'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedCustomer.outstandingBalance > 0 && (
              <span className={`text-xs px-2 py-1 rounded-full font-bold bg-amber-100 text-amber-700`}>
                Balance: {formatCurrency(selectedCustomer.outstandingBalance)}
              </span>
            )}
            <button
              onClick={handleClear}
              className="text-xs text-slate-500 hover:text-red-600"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search customer by name or phone..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm"
        />
      </div>
      
      {isOpen && (query.length > 0 || localResults.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto">
          {localResults.length > 0 ? (
            <>
              {localResults.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{customer.name}</p>
                    <p className="text-xs text-slate-500">{customer.phone || 'No phone'}</p>
                  </div>
                  {customer.outstandingBalance > 0 && (
                    <span className={`text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700`}>
                      {formatCurrency(customer.outstandingBalance)}
                    </span>
                  )}
                </button>
              ))}
              
              {onAddNew && query.length > 0 && !localResults.some(
                c => c.name.toLowerCase().includes(query.toLowerCase()) ||
                     (c.phone && c.phone.includes(query))
              ) && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew();
                  }}
                  className="w-full p-3 text-left hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 text-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add New Customer: {query}</span>
                </button>
              )}
            </>
          ) : query.length > 0 ? (
            <div className="p-3">
              {onAddNew ? (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onAddNew();
                  }}
                  className="w-full p-3 text-left hover:bg-slate-50 flex items-center gap-2 text-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add New Customer: {query}</span>
                </button>
              ) : (
                <div className="p-3 text-center text-sm text-slate-500">
                  No customers found
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

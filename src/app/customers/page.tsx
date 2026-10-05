'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerStore } from '@/store/useCustomerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useToast } from '@/components/Toast';
import { Search, Plus, Users, BarChart3, Home, Menu, Settings, LogOut, Phone, Filter, Download, Package, MoreVertical, Pencil, Trash2, Mail, MapPin, Loader2, IndianRupee, CreditCard, ChevronDown } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useRef } from 'react';
import { CustomerWithStats } from '@/types';
import { CustomerStats } from '@/components/customers/CustomerStats';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { MobileAvatar } from '@/components/layout/MobileAvatar';
import { CustomerExport } from '@/components/customers/CustomerExport';

import { CustomerDetailModal } from '@/components/customers/CustomerDetailModal';
import { QuickAddCustomerModal } from '@/components/customers/QuickAddCustomerModal';
import { CUSTOMER_TYPES, getBalanceStatus, BalanceStatus } from '@/lib/constants/customerConstants';


type FilterType = 'all' | 'regular' | 'seasonal' | 'retail' | 'wholesale';
type BalanceFilter = 'all' | 'clear' | 'dues';

export default function CustomersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { customers, initialize, isLoading, deleteCustomer } = useCustomerStore();
  const { ownerName } = useSettingsStore();
  const { addToast } = useToast();

  const getInitials = () => {
    if (ownerName) {
      return ownerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'FF';
  };

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!customer.name.toLowerCase().includes(query) &&
        !customer.phone?.includes(query)) {
        return false;
      }
    }

    // Type filter
    if (filterType !== 'all' && customer.customerType !== filterType) {
      return false;
    }

    // Balance filter
    if (balanceFilter !== 'all') {
      const isDue = customer.outstandingBalance > 0;
      if (balanceFilter === 'dues' && !isDue) return false;
      if (balanceFilter === 'clear' && isDue) return false;
    }

    return true;
  });

  const handleDelete = async (customer: CustomerWithStats) => {
    if (!confirm(`Are you sure you want to delete ${customer.name}?`)) {
      return;
    }

    try {
      await deleteCustomer(customer.id);
      addToast('success', 'Customer deleted successfully');
    } catch (error) {
      addToast('error', 'Failed to delete customer');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 w-full lg:w-auto lg:justify-start justify-between">
          {/* Hamburger menu for mobile */}
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
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 leading-none mb-1">Customers</h1>
            <p className="text-slate-500 text-[11px] sm:text-sm truncate">Manage customer database</p>
          </div>

          {/* Avatar/profile icon */}
          <div className="lg:hidden">
            <MobileAvatar />
          </div>
        </div>
      </div>

      <div className="space-y-4">
          {/* Stats */}
          <CustomerStats customers={customers} />

          {/* Toolbar */}
          <div className="flex flex-col gap-3 mb-2">
            {/* Search */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm w-full"
              />
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-2 w-full">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-2 py-1.5 bg-white border-[1.5px] border-[#e5e7eb] rounded-full text-[12px] outline-none focus:ring-2 focus:ring-primary/20 transition-shadow h-[34px] w-fit min-w-[90px] max-w-[110px] shrink-0"
              >
                <option value="all">All Types</option>
                <option value="regular">Regular</option>
                <option value="seasonal">Seasonal</option>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>

              <div className="flex items-center gap-1.5 h-[34px] flex-1">
                {(['all', 'dues', 'clear'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBalanceFilter(opt)}
                    className={`h-full px-2 lg:px-4 rounded-full text-[13px] font-medium transition-colors border flex-1 whitespace-nowrap ${balanceFilter === opt
                        ? 'bg-[#16a34a] border-[#16a34a] text-white'
                        : 'bg-white border-[#e5e7eb] text-[#374151] hover:bg-slate-50'
                      }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>

              <div className="shrink-0 lg:hidden h-[34px]">
                <CustomerExport customers={customers} iconOnly={true} />
              </div>
              <div className="shrink-0 hidden lg:block">
                <CustomerExport customers={customers} />
              </div>
            </div>

            {/* Add Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 w-full lg:w-auto h-[44px] bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary/90 mt-1 shadow-sm transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Customer
            </button>
          </div>

          {/* Customer Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading customers...</div>
          ) : filteredCustomers.length > 0 ? (
            <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 bg-white md:bg-transparent rounded-xl md:rounded-none border border-slate-200 md:border-none overflow-hidden">
              {filteredCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onClick={setSelectedCustomer}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4">No customers found</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add Your First Customer
              </button>
            </div>
          )}
        </div>

      {/* Modals */}
      {showAddModal && (
        <QuickAddCustomerModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={(customer) => {
            setSelectedCustomer(customer);
            setShowAddModal(false);
            addToast('success', 'Customer created successfully');
          }}
        />
      )}

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onUpdate={async () => { await initialize(); }}
          onDelete={async () => { await initialize(); setSelectedCustomer(null); }}
          onRecordPayment={async (id, data) => {
            // Handle payment recording
          }}
        />
      )}
    </div>
  );
}

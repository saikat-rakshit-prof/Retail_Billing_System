import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Customer, CustomerWithStats, CustomerSummary, CustomerPayment } from '@/types';

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const STORAGE_KEY = 'cold-drinks-customers-cache';

interface CustomerState {
  customers: CustomerWithStats[];
  selectedCustomer: CustomerWithStats | null;
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  searchResults: CustomerSummary[];
  
  // Actions
  initialize: () => Promise<void>;
  searchCustomers: (query: string) => Promise<void>;
  addCustomer: (customer: Partial<Customer>) => Promise<Customer>;
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  recordPayment: (customerId: string, payment: Partial<CustomerPayment>) => Promise<void>;
  getCustomerById: (id: string) => CustomerWithStats | undefined;
  setSelectedCustomer: (customer: CustomerWithStats | null) => void;
  exportCustomers: (filters?: { type?: string; dateFrom?: string; dateTo?: string }) => Promise<void>;
  clearCache: () => void;
}

// Helper to get from cache or fetch
async function fetchWithCache<T>(url: string, cacheKey: string): Promise<T> {
  const now = Date.now();
  
  // Check localStorage cache first
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed[cacheKey] && now - parsed[cacheKey].timestamp < CACHE_TTL) {
          console.log('📦 Using cached data for:', cacheKey);
          return parsed[cacheKey].data;
        }
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }
  }
  
  // Fetch fresh data
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  const data = await response.json();
  
  // Update cache
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(STORAGE_KEY);
    const cacheObj = cached ? JSON.parse(cached) : {};
    cacheObj[cacheKey] = { data, timestamp: now };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheObj));
  }
  
  return data;
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: [],
      selectedCustomer: null,
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      searchResults: [],

      initialize: async () => {
        set({ isLoading: true, error: null });
        try {
          const customers = await fetchWithCache<CustomerWithStats[]>(
            '/api/customers',
            'all-customers'
          );
          set({ 
            customers, 
            isLoading: false, 
            lastSyncedAt: new Date() 
          });
        } catch (error) {
          console.error('Error initializing customers:', error);
          set({ isLoading: false, error: 'Failed to load customers' });
        }
      },

      searchCustomers: async (query: string) => {
        if (!query || query.trim().length === 0) {
          set({ searchResults: [] });
          return;
        }
        
        try {
          const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
          if (!response.ok) {
            throw new Error('Search failed');
          }
          const results = await response.json();
          set({ searchResults: results });
        } catch (error) {
          console.error('Search error:', error);
          set({ searchResults: [] });
        }
      },

      addCustomer: async (customer: Partial<Customer>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create customer');
          }
          
          const newCustomer = await response.json();
          
          // Update local cache
          get().clearCache();
          await get().initialize();
          
          return newCustomer;
        } catch (error) {
          console.error('Error creating customer:', error);
          set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to create customer' });
          throw error;
        }
      },

      updateCustomer: async (id: string, data: Partial<Customer>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update customer');
          }
          
          // Update local cache
          get().clearCache();
          await get().initialize();
          
          // Update selected customer if it's the same
          const { selectedCustomer } = get();
          if (selectedCustomer?.id === id) {
            const updated = await response.json();
            set({ selectedCustomer: updated });
          }
        } catch (error) {
          console.error('Error updating customer:', error);
          set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to update customer' });
          throw error;
        }
      },

      deleteCustomer: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/customers/${id}`, {
            method: 'DELETE',
          });
          
          if (!response.ok && response.status !== 404) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || 'Failed to delete customer');
          }
          
          // Clear selected if it was deleted
          const { selectedCustomer } = get();
          if (selectedCustomer?.id === id) {
            set({ selectedCustomer: null });
          }
          
          // Update local cache
          get().clearCache();
          await get().initialize();
        } catch (error) {
          console.error('Error deleting customer:', error);
          set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to delete customer' });
          throw error;
        }
      },

      recordPayment: async (customerId: string, payment: Partial<CustomerPayment>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`/api/customers/${customerId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to record payment');
          }
          
          // Clear cache to get fresh data
          get().clearCache();
          await get().initialize();
          
          // Refresh selected customer
          if (get().selectedCustomer?.id === customerId) {
            const customerResponse = await fetch(`/api/customers/${customerId}`);
            if (customerResponse.ok) {
              const customerData = await customerResponse.json();
              set({ selectedCustomer: customerData });
            }
          }
        } catch (error) {
          console.error('Error recording payment:', error);
          set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to record payment' });
          throw error;
        }
      },

      getCustomerById: (id: string) => {
        return get().customers.find(c => c.id === id);
      },

      setSelectedCustomer: (customer: CustomerWithStats | null) => {
        set({ selectedCustomer: customer });
      },

      exportCustomers: async (filters?: { type?: string; dateFrom?: string; dateTo?: string }) => {
        try {
          const params = new URLSearchParams();
          if (filters?.type) params.set('type', filters.type);
          if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
          if (filters?.dateTo) params.set('dateTo', filters.dateTo);
          
          const response = await fetch(`/api/customers/export?${params.toString()}`);
          if (!response.ok) {
            throw new Error('Export failed');
          }
          
          const data = await response.json();
          
          // Convert to CSV and trigger download
          const headers = ['Name', 'Phone', 'Email', 'Address', 'Customer Type', 'Total Purchases', 'Total Paid', 'Outstanding Balance', 'Credit Limit', 'Total Bills', 'Last Purchase Date', 'Member Since'];
          
          const csvRows = [headers.join(',')];
          data.forEach((customer: any) => {
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
              customer.lastPurchaseDate || '',
              customer.memberSince || '',
            ].map(v => `"${String(v).replace(/"/g, '""')}"`);
            csvRows.push(row.join(','));
          });
          
          const csv = '\ufeff' + csvRows.join('\n'); // BOM for Excel
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const date = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
          link.download = `customers-export-${date}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Export error:', error);
          throw error;
        }
      },

      clearCache: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      },
    }),
    {
      name: 'cold-drinks-customers',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        customers: state.customers,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);


import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Bill, BillItem, PaymentMode } from '@/types';
import * as storage from '@/lib/storage';

interface BillState {
  bills: Bill[];
  currentBill: {
    customerName: string;
    phoneNumber: string;
    customerId: string | null;
    items: BillItem[];
    discountType: 'percentage' | 'flat';
    discountValue: number;
    paymentMode: 'Cash' | 'UPI' | 'Card' | 'Credit';
    cashReceived: number;
  };
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  
  // Actions
  initialize: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  initializeFromStorage: () => Promise<void>;
  addItem: (item: BillItem) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemPrice: (itemId: string, unitPrice: number) => void;
  removeItem: (itemId: string) => void;
  clearCurrentBill: () => void;
  setCustomerInfo: (name: string, phone: string) => void;
  setDiscount: (type: 'percentage' | 'flat', value: number) => void;
  setPaymentMode: (mode: 'Cash' | 'UPI' | 'Card' | 'Credit') => void;
  setCashReceived: (amount: number) => void;
  submitBill: () => { success: boolean; invoiceNumber?: string; error?: string };
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTotal: () => number;
  getBills: () => Bill[];
  getBillById: (id: string) => Bill | undefined;
}

export const useBillStore = create<BillState>()(
  persist(
    (set, get) => ({
      bills: [],
      currentBill: {
        customerName: '',
        phoneNumber: '',
        customerId: null,
        items: [],
        discountType: 'percentage',
        discountValue: 0,
        paymentMode: 'Cash',
        cashReceived: 0,
      },
      isLoading: false,
      error: null,
      lastSyncedAt: null,

      initialize: async () => {
        set({ isLoading: true, error: null });
        try {
          const bills = await storage.getBills();
          set({ bills, isLoading: false, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error initializing bills:', error);
          set({ isLoading: false, error: 'Failed to load bills' });
        }
      },

      forceRefresh: async () => {
        set({ isLoading: true, error: null });
        try {
          const bills = await storage.getBills(true); // Force fresh from Neon
          set({ bills, isLoading: false, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error force refreshing bills:', error);
          set({ isLoading: false, error: 'Failed to refresh bills' });
        }
      },

      // Backward compatibility alias
      initializeFromStorage: async () => {
        return get().initialize();
      },

      addItem: (item) => {
        const { currentBill } = get();
        const existingIndex = currentBill.items.findIndex(
          (i) => i.productId === item.productId && 
                 i.sizeId === item.sizeId && 
                 i.packaging === item.packaging
        );

        if (existingIndex >= 0) {
          const updatedItems = [...currentBill.items];
          updatedItems[existingIndex].quantity += item.quantity;
          updatedItems[existingIndex].totalPrice = 
            updatedItems[existingIndex].quantity * updatedItems[existingIndex].unitPrice;
          
          set({
            currentBill: {
              ...currentBill,
              items: updatedItems,
            },
          });
        } else {
          set({
            currentBill: {
              ...currentBill,
              items: [...currentBill.items, item],
            },
          });
        }
      },

      updateItemQuantity: (itemId, quantity) => {
        const { currentBill } = get();
        
        if (quantity <= 0) {
          set({
            currentBill: {
              ...currentBill,
              items: currentBill.items.filter((i) => i.id !== itemId),
            },
          });
          return;
        }
        
        const updatedItems = currentBill.items.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              quantity,
              totalPrice: quantity * item.unitPrice,
            };
          }
          return item;
        });
        
        set({
          currentBill: {
            ...currentBill,
            items: updatedItems,
          },
        });
      },

      updateItemPrice: (itemId, unitPrice) => {
        const { currentBill } = get();
        const updatedItems = currentBill.items.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              unitPrice,
              totalPrice: item.quantity * unitPrice,
            };
          }
          return item;
        });

        set({
          currentBill: {
            ...currentBill,
            items: updatedItems,
          },
        });
      },

      removeItem: (itemId) => {
        const { currentBill } = get();
        set({
          currentBill: {
            ...currentBill,
            items: currentBill.items.filter((i) => i.id !== itemId),
          },
        });
      },

      clearCurrentBill: () => {
        set({
          currentBill: {
            customerName: '',
            phoneNumber: '',
            customerId: null,
            items: [],
            discountType: 'percentage',
            discountValue: 0,
            paymentMode: 'Cash',
            cashReceived: 0,
          },
        });
      },

      setCustomerInfo: (name, phone) => {
        const { currentBill } = get();
        set({
          currentBill: {
            ...currentBill,
            customerName: name,
            phoneNumber: phone,
          },
        });
      },

      setDiscount: (type, value) => {
        const { currentBill } = get();
        set({
          currentBill: {
            ...currentBill,
            discountType: type,
            discountValue: value,
          },
        });
      },

      setPaymentMode: (mode: 'Cash' | 'UPI' | 'Card' | 'Credit') => {
        const { currentBill } = get();
        set({
          currentBill: {
            ...currentBill,
            paymentMode: mode,
            cashReceived: mode === 'Cash' ? currentBill.cashReceived : 0,
          },
        });
      },

      setCashReceived: (amount) => {
        const { currentBill } = get();
        set({
          currentBill: {
            ...currentBill,
            cashReceived: amount,
          },
        });
      },

      submitBill: () => {
        const { currentBill, bills } = get();
        
        if (currentBill.items.length === 0) {
          return { success: false as const, error: 'No items in bill' };
        }
        
        const subtotal = get().getSubtotal();
        const discountAmount = get().getDiscountAmount();
        const total = get().getTotal();
        
        const invoiceNumber = storage.getNextInvoiceNumber();
        
        const bill: Bill = {
          id: crypto.randomUUID(),
          invoiceNumber,
          customerName: currentBill.customerName || undefined,
          phoneNumber: currentBill.phoneNumber || undefined,
          customerId: currentBill.customerId || undefined,
          items: currentBill.items,
          subtotal,
          discountType: currentBill.discountType,
          discountValue: currentBill.discountValue,
          discountAmount,
          totalAmount: total,
          paymentMode: currentBill.paymentMode,
          cashReceived: currentBill.paymentMode === 'Cash' ? currentBill.cashReceived : undefined,
          changeGiven: currentBill.paymentMode === 'Cash' 
            ? currentBill.cashReceived - total 
            : undefined,
          createdAt: new Date().toISOString(),
          status: 'paid',
        };
        
        // Optimistic update - update store immediately
        const previousBills = bills;
        set({ bills: [bill, ...bills] });
        
        // Fire API call in background (don't await)
        storage.addBill(bill).catch(err => {
          console.error('Failed to save bill to API:', err);
          // Rollback on error
          set({ bills: previousBills });
        });
        
        // Deduct stock in background
        (async () => {
          for (const item of currentBill.items) {
            const skuId = `${item.productId}-${item.sizeId}`;
            let quantityToDeduct = item.quantity;
            
            if (item.packaging === 'carton') {
              quantityToDeduct = item.quantity * 12;
            }
            
            await storage.deductStock(skuId, quantityToDeduct);
          }
        })().catch(err => {
          console.error('Failed to deduct stock:', err);
        });
        
        // Clear current bill
        get().clearCurrentBill();
        
        return { success: true as const, invoiceNumber };
      },

      getSubtotal: () => {
        const { currentBill } = get();
        return currentBill.items.reduce((sum, item) => sum + item.totalPrice, 0);
      },

      getDiscountAmount: () => {
        const { currentBill } = get();
        const subtotal = get().getSubtotal();
        
        if (currentBill.discountType === 'percentage') {
          return (subtotal * currentBill.discountValue) / 100;
        }
        
        return currentBill.discountValue;
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const discount = get().getDiscountAmount();
        return Math.max(0, subtotal - discount);
      },

      getBills: () => {
        return get().bills;
      },

      getBillById: (id) => {
        return get().bills.find((b) => b.id === id);
      },
    }),
    {
      name: 'cold-drinks-bills',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        bills: state.bills,
      }),
    }
  )
);

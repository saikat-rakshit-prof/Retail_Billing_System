import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SKU, StockHistoryEntry } from '@/types';
import * as storage from '@/lib/storage';

interface InventoryState {
  inventory: SKU[];
  stockHistory: StockHistoryEntry[];
  searchQuery: string;
  filterStatus: 'all' | 'Healthy' | 'Low Stock' | 'Out of Stock';
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  
  // Actions
  initialize: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  initializeFromStorage: () => Promise<void>;
  addStock: (skuId: string, quantity: number, type: 'bottles' | 'cartons', batchId?: string, notes?: string) => Promise<void>;
  updateLowStockThreshold: (skuId: string, threshold: number) => Promise<void>;
  removeSku: (skuId: string) => Promise<void>;
  togglePin: (skuId: string) => Promise<void>;
  clearStock: (skuId: string) => Promise<void>;
  getInventory: () => SKU[];
  getFilteredInventory: () => SKU[];
  getStockHistory: (skuId?: string) => StockHistoryEntry[];
  getInventoryStats: () => { healthy: number; lowStock: number; outOfStock: number };
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: 'all' | 'Healthy' | 'Low Stock' | 'Out of Stock') => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      inventory: [],
      stockHistory: [],
      searchQuery: '',
      filterStatus: 'all',
      isLoading: false,
      error: null,
      lastSyncedAt: null,

      initialize: async () => {
        set({ isLoading: true, error: null });
        try {
          const inventory = await storage.getInventory();
          const stockHistory = await storage.getStockHistory();
          set({ inventory, stockHistory, isLoading: false, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error initializing inventory:', error);
          set({ isLoading: false, error: 'Failed to load inventory' });
        }
      },

      forceRefresh: async () => {
        set({ isLoading: true, error: null });
        try {
          const inventory = await storage.getInventory(true); // Force fresh from Neon
          const stockHistory = await storage.getStockHistory();
          set({ inventory, stockHistory, isLoading: false, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error force refreshing inventory:', error);
          set({ isLoading: false, error: 'Failed to refresh inventory' });
        }
      },

      // Backward compatibility alias
      initializeFromStorage: async () => {
        return get().initialize();
      },

      addStock: async (skuId, quantity, type, batchId, notes) => {
        const previousInventory = get().inventory;
        const previousHistory = get().stockHistory;
        
        const inventory = [...get().inventory];
        const skuIndex = inventory.findIndex(s => s.id === skuId);
        
        if (skuIndex === -1) {
          console.error('SKU not found:', skuId);
          return;
        }
        
        const sku = inventory[skuIndex];
        const previousStock = sku.currentStock;
        
        // Convert cartons to bottles if needed
        let bottleQuantity = quantity;
        if (type === 'cartons') {
          // Use the actual bottlesPerCarton from the SKU
          const bottlesPerCarton = sku.bottlesPerCarton || 12;
          bottleQuantity = quantity * bottlesPerCarton;
        }
        
        const newStock = previousStock + bottleQuantity;
        
        // Optimistic update
        inventory[skuIndex] = {
          ...sku,
          currentStock: newStock,
          status: newStock <= 0 ? 'Out of Stock' : newStock <= sku.lowStockThreshold ? 'Low Stock' : 'Healthy',
        };
        
        const newHistoryEntry: StockHistoryEntry = {
          id: crypto.randomUUID(),
          skuId,
          productId: sku.productId || '',
          type: 'addition',
          quantity: bottleQuantity,
          previousStock,
          newStock,
          timestamp: new Date().toISOString(),
          notes: notes || `Added ${quantity} ${type}`,
        };
        
        set({
          inventory,
          stockHistory: [...get().stockHistory, newHistoryEntry],
        });
        
        try {
          // Persist to API - pass the type so the API knows how to handle it
          await storage.updateStock(skuId, newStock, type);
          await storage.addStockHistoryEntry(newHistoryEntry);
        } catch (error) {
          // Rollback on error
          set({ inventory: previousInventory, stockHistory: previousHistory });
          console.error('Error adding stock:', error);
          throw error;
        }
      },

      updateLowStockThreshold: async (skuId, threshold) => {
        const previousInventory = get().inventory;
        
        const inventory = [...get().inventory];
        const index = inventory.findIndex(s => s.id === skuId);
        
        if (index !== -1) {
          inventory[index] = { ...inventory[index], lowStockThreshold: threshold };
          
          // Update status based on new threshold
          if (inventory[index].currentStock <= 0) {
            inventory[index].status = 'Out of Stock';
          } else if (inventory[index].currentStock <= threshold) {
            inventory[index].status = 'Low Stock';
          } else {
            inventory[index].status = 'Healthy';
          }
          
          set({ inventory });
          
          try {
            await storage.saveInventory(inventory);
          } catch (error) {
            set({ inventory: previousInventory });
            console.error('Error updating threshold:', error);
            throw error;
          }
        }
      },

      removeSku: async (skuId) => {
        const previousInventory = get().inventory;
        
        const inventory = get().inventory.filter(s => s.id !== skuId);
        set({ inventory });
        
        try {
          await storage.saveInventory(inventory);
        } catch (error) {
          set({ inventory: previousInventory });
          console.error('Error removing SKU:', error);
          throw error;
        }
      },

      togglePin: async (skuId) => {
        const previousInventory = get().inventory;
        const inventory = [...get().inventory];
        const index = inventory.findIndex(s => s.id === skuId);
        
        if (index !== -1) {
          const item = inventory[index];
          inventory[index] = {
            ...item,
            isPinned: !item.isPinned,
            pinnedAt: !item.isPinned ? new Date().toISOString() : null,
          };
          set({ inventory });
          
          try {
            await storage.togglePin(skuId);
          } catch (error) {
            set({ inventory: previousInventory });
            console.error('Error toggling pin:', error);
            throw error;
          }
        }
      },

      clearStock: async (skuId) => {
        const previousInventory = get().inventory;
        const inventory = [...get().inventory];
        const index = inventory.findIndex(s => s.id === skuId);
        
        if (index !== -1) {
          inventory[index] = {
            ...inventory[index],
            currentStock: 0,
            status: 'Out of Stock'
          };
          set({ inventory });
          
          try {
            await storage.clearStock(skuId);
          } catch (error) {
            set({ inventory: previousInventory });
            console.error('Error clearing stock:', error);
            throw error;
          }
        }
      },

      getInventory: () => {
        return get().inventory;
      },

      getFilteredInventory: () => {
        const { inventory, searchQuery, filterStatus } = get();
        
        return inventory.filter(sku => {
          // Filter by status
          if (filterStatus !== 'all' && sku.status !== filterStatus) {
            return false;
          }
          
          // Filter by search query
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return sku.skuCode.toLowerCase().includes(query);
          }
          
          return true;
        });
      },

      getStockHistory: (skuId) => {
        const { stockHistory } = get();
        
        if (skuId) {
          return stockHistory
            .filter(entry => entry.skuId === skuId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        
        return stockHistory.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      },

      getInventoryStats: () => {
        const { inventory } = get();
        
        return {
          healthy: inventory.filter(s => s.status === 'Healthy').length,
          lowStock: inventory.filter(s => s.status === 'Low Stock').length,
          outOfStock: inventory.filter(s => s.status === 'Out of Stock').length,
        };
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      setFilterStatus: (status) => {
        set({ filterStatus: status });
      },
    }),
    {
      name: 'cold-drinks-inventory',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        filterStatus: state.filterStatus,
      }),
    }
  )
);

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Product, ProductSize, ProductCategory } from '@/types';
import * as storage from '@/lib/storage';

interface ProductState {
  products: Product[];
  searchQuery: string;
  selectedCategory: ProductCategory;
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  
  // Actions
  initialize: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  initializeFromStorage: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: ProductCategory) => void;
  getFilteredProducts: () => Product[];
  getProductById: (id: string) => Product | undefined;
}

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      products: [],
      searchQuery: '',
      selectedCategory: 'All',
      isLoading: false,
      error: null,
      lastSyncedAt: null,

      initialize: async () => {
        set({ isLoading: true, error: null });
        try {
          const products = await storage.getProducts();
          set({ products, isLoading: false, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error initializing products:', error);
          set({ isLoading: false, error: 'Failed to load products' });
        }
      },

      forceRefresh: async () => {
        set({ isLoading: true, error: null });
        try {
          const products = await storage.getProducts(true); // Force fresh from Neon
          set({ products, isLoading: false, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error force refreshing products:', error);
          set({ isLoading: false, error: 'Failed to refresh products' });
        }
      },

      // Backward compatibility alias
      initializeFromStorage: async () => {
        return get().initialize();
      },

      addProduct: async (productData) => {
        try {
          // Persist to API first (inventory is now created in the API route)
          // The API returns the product with correct database IDs
          await storage.addProduct(productData as Product);
          
          // Then refresh products from the API to get the correct IDs
          const products = await storage.getProducts(true);
          set({ products, lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error adding product:', error);
          throw error;
        }
      },

      updateProduct: async (id, updates) => {
        const previousProduct = get().products.find(p => p.id === id);
        
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
        
        try {
          await storage.updateProduct(id, updates);
        } catch (error) {
          // Rollback on error
          if (previousProduct) {
            set((state) => ({
              products: state.products.map((p) =>
                p.id === id ? previousProduct : p
              ),
            }));
          }
          console.error('Error updating product:', error);
          throw error;
        }
      },

      deleteProduct: async (id) => {
        const previousProducts = get().products;
        
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }));
        
        try {
          await storage.deleteProduct(id);
        } catch (error) {
          // Rollback on error
          set({ products: previousProducts });
          console.error('Error deleting product:', error);
          throw error;
        }
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
      },

      setSelectedCategory: (category) => {
        set({ selectedCategory: category });
      },

      getFilteredProducts: () => {
        const { products, searchQuery, selectedCategory } = get();
        
        return products.filter((product) => {
          // Filter by category
          if (selectedCategory !== 'All') {
            const pCat = product.category.toLowerCase();
            const sCat = selectedCategory.toLowerCase();
            const match = pCat === sCat || 
                         (sCat === 'soft drinks' && pCat === 'sodas') || 
                         (sCat === 'sodas' && pCat === 'soft drinks');
            if (!match) return false;
          }
          
          // Filter by search query
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              product.name.toLowerCase().includes(query) ||
              product.brand.toLowerCase().includes(query)
            );
          }
          
          return true;
        });
      },

      getProductById: (id) => {
        return get().products.find((p) => p.id === id);
      },
    }),
    {
      name: 'cold-drinks-products',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        searchQuery: state.searchQuery,
        selectedCategory: state.selectedCategory,
      }),
    }
  )
);

// Sample products function - DISABLED
// No longer adds sample data - all data must come from user input
export async function addSampleProducts() {
  // Disabled - no more auto-seeding
  console.log('Sample products disabled - add products manually');
}

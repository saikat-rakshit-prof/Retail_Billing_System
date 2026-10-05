import { create } from 'zustand';
import * as storage from '@/lib/storage';

interface SettingsState {
  shopName: string;
  ownerName: string;
  shopPhone: string;
  shopAddress: string;
  taxRate: number;
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: Date | null;
  
  // Actions
  initialize: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  setShopName: (name: string) => void;
  setOwnerName: (name: string) => void;
  setShopPhone: (phone: string) => void;
  setShopAddress: (address: string) => void;
  setTaxRate: (rate: number) => void;
  saveAllSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  (set, get) => ({
      shopName: 'Saikat Enterprise',
      ownerName: '',
      shopPhone: '',
      shopAddress: '',
      taxRate: 0,
      isLoading: false,
      error: null,
      lastSyncedAt: null,

      initialize: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await storage.getSettings();
          set({
            shopName: settings.shopName || 'Saikat Enterprise',
            ownerName: settings.ownerName || '',
            shopPhone: settings.shopPhone || '',
            shopAddress: settings.shopAddress || '',
            taxRate: settings.taxRate || 0,
            isLoading: false,
            lastSyncedAt: new Date(),
          });
        } catch (error) {
          console.error('Error initializing settings:', error);
          set({ isLoading: false, error: 'Failed to load settings' });
        }
      },

      forceRefresh: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await storage.getSettings(true); // Force fresh from Neon
          set({
            shopName: settings.shopName || 'Saikat Enterprise',
            ownerName: settings.ownerName || '',
            shopPhone: settings.shopPhone || '',
            shopAddress: settings.shopAddress || '',
            taxRate: settings.taxRate || 0,
            isLoading: false,
            lastSyncedAt: new Date(),
          });
        } catch (error) {
          console.error('Error force refreshing settings:', error);
          set({ isLoading: false, error: 'Failed to refresh settings' });
        }
      },

      setShopName: (name) => set({ shopName: name }),
      setOwnerName: (name) => set({ ownerName: name }),
      setShopPhone: (phone) => set({ shopPhone: phone }),
      setShopAddress: (address) => set({ shopAddress: address }),
      setTaxRate: (rate) => set({ taxRate: rate }),

      saveAllSettings: async () => {
        const { shopName, ownerName, shopPhone, shopAddress, taxRate } = get();
        
        try {
          await storage.saveSettings({
            shopName,
            ownerName,
            shopPhone,
            shopAddress,
            taxRate,
            currency: 'INR',
            lowStockDefaultThreshold: 50,
          });
          
          // Invalidate cache to force fresh fetch
          set({ lastSyncedAt: new Date() });
        } catch (error) {
          console.error('Error saving settings:', error);
          throw error;
        }
      },
    })
  );


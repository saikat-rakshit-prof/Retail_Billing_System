import { Product, SKU, StockHistoryEntry, Bill, StoreSettings } from '@/types';
import * as cache from '@/lib/cache';

// ============================================================================
// STORAGE ABSTRACTION LAYER - Neon Database API
// ============================================================================
// This file provides a unified interface for data persistence using Neon DB.
// All operations now call the API routes instead of using localStorage.
// Includes smart caching with TTL and automatic invalidation.
// ============================================================================

const API_BASE = '/api';

// ============================================================================
// INTERNAL CACHE (for sync reads before API responds)
// ============================================================================
// Note: These are fallback caches. The primary cache is in lib/cache.ts
// These are kept for sync operations and as backup.

let productsCache: Product[] = [];
let inventoryCache: SKU[] = [];
let billsCache: Bill[] = [];
let stockHistoryCache: StockHistoryEntry[] = [];
let settingsCache: StoreSettings | null = null;

// Initialize cache system on module load
if (typeof window !== 'undefined') {
  cache.initializeCache();
}

// ============================================================================
// HTTP HELPER
// ============================================================================

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// PRODUCTS COLLECTION
// ============================================================================

/**
 * Get all products from API
 * @param forceFresh - If true, bypass cache and fetch from Neon
 */
export async function getProducts(forceFresh: boolean = false): Promise<Product[]> {
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cachedProducts = cache.getCache<Product[]>('products');
    if (cachedProducts) {
      productsCache = cachedProducts;
      return cachedProducts;
    }
  }
  
  try {
    const products = await apiCall<Product[]>('/products');
    productsCache = products;
    cache.setCache('products', products);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return productsCache;
  }
}

/**
 * Get products (sync version for backward compatibility - returns cache)
 */
export function getProductsSync(): Product[] {
  return productsCache;
}

/**
 * Save all products (not typically used - products are added individually)
 */
export async function saveProducts(products: Product[]): Promise<void> {
  // This would require updating each product individually
  // For now, we'll just update the cache
  productsCache = products;
}

/**
 * Add a single product via API
 */
export async function addProduct(product: Product): Promise<void> {
  try {
    const { id, createdAt, updatedAt, ...productData } = product;
    const sizes = product.sizes.map((size: any) => ({
      name: size.name,
      pricePerBottle: Number(size.pricePerBottle),
      pricePerCarton: Number(size.pricePerCarton),
      bottlesPerCarton: size.bottlesPerCarton,
      initialStock: size.initialStock || 0,
    }));
    
    const newProduct = await apiCall<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({
        ...productData,
        sizes,
      }),
    });
    
    // Add to cache
    productsCache.push(newProduct);
    
    // Invalidate cache - adding product affects both products and inventory
    cache.invalidateCacheByAction('product:add');
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
}

/**
 * Update a product by ID via API
 */
export async function updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
  try {
    await apiCall(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    
    // Update cache
    const index = productsCache.findIndex(p => p.id === productId);
    if (index !== -1) {
      productsCache[index] = { ...productsCache[index], ...updates, updatedAt: new Date().toISOString() };
    }
    
    // Invalidate cache - updating product affects both products and inventory
    cache.invalidateCacheByAction('product:update');
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

/**
 * Delete a product by ID via API
 */
export async function deleteProduct(productId: string): Promise<void> {
  try {
    await apiCall(`/products/${productId}`, {
      method: 'DELETE',
    });
    
    // Remove from cache
    productsCache = productsCache.filter(p => p.id !== productId);
    
    // Also remove related inventory and stock history
    inventoryCache = inventoryCache.filter(s => s.productId !== productId);
    stockHistoryCache = stockHistoryCache.filter(sh => sh.productId !== productId);
    
    // Invalidate cache - deleting product affects both products and inventory
    cache.invalidateCacheByAction('product:delete');
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// ============================================================================
// INVENTORY (SKU) COLLECTION
// ============================================================================

/**
 * Get all inventory/SKUs from API
 * @param forceFresh - If true, bypass cache and fetch from Neon
 */
export async function getInventory(forceFresh: boolean = false): Promise<SKU[]> {
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cachedInventory = cache.getCache<SKU[]>('inventory');
    if (cachedInventory) {
      inventoryCache = cachedInventory;
      return cachedInventory;
    }
  }
  
  try {
    const url = forceFresh ? `/inventory?t=${Date.now()}` : '/inventory';
    const inventory = await apiCall<SKU[]>(url);
    inventoryCache = inventory;
    cache.setCache('inventory', inventory);
    return inventory;
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return inventoryCache;
  }
}

/**
 * Get inventory (sync version for backward compatibility)
 */
export function getInventorySync(): SKU[] {
  return inventoryCache;
}

/**
 * Save all inventory
 */
export async function saveInventory(skus: SKU[]): Promise<void> {
  inventoryCache = skus;
}

/**
 * Add or update SKU via API
 */
export async function upsertSKU(sku: SKU): Promise<void> {
  try {
    // First try to create the inventory item
    try {
      await apiCall(`/inventory`, {
        method: 'POST',
        body: JSON.stringify({
          id: sku.id,
          productId: sku.productId,
          sizeId: sku.sizeId,
          skuCode: sku.skuCode,
          currentStock: sku.currentStock,
          lowStockThreshold: sku.lowStockThreshold,
        }),
      });
    } catch (createError: any) {
      // If 409 (already exists), that's fine - we'll update instead
      if (!createError.message?.includes('409')) {
        throw createError;
      }
    }
    
    // Then update the stock
    await apiCall(`/inventory/${sku.id}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ stock: sku.currentStock }),
    });
    
    // Update cache
    const index = inventoryCache.findIndex(s => s.id === sku.id);
    if (index !== -1) {
      inventoryCache[index] = sku;
    } else {
      inventoryCache.push(sku);
    }
    
    // Invalidate cache - adding/updating stock affects inventory
    cache.invalidateCacheByAction('stock:add');
  } catch (error) {
    console.error('Error upserting SKU:', error);
    throw error;
  }
}

/**
 * Update stock for a SKU via API
 */
export async function updateStock(skuId: string, newStock: number, type?: 'bottles' | 'cartons'): Promise<void> {
  try {
    // Find the SKU in cache to get additional details needed for placeholder items
    const sku = inventoryCache.find(s => s.id === skuId);
    
    const requestBody: Record<string, any> = { stock: newStock };
    
    // If this is a placeholder item, include additional details needed to create the inventory entry
    if (skuId.startsWith('placeholder-') && sku) {
      requestBody.skuCode = sku.skuCode;
      requestBody.productSizeId = sku.productSizeId || sku.sizeId;
      requestBody.productId = sku.productId;
      requestBody.sizeName = sku.sizeName;
      requestBody.brand = sku.brand;
      requestBody.productName = sku.productName;
    }
    
    await apiCall(`/inventory/${skuId}/stock`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });
    
    // Update cache
    const index = inventoryCache.findIndex(s => s.id === skuId);
    if (index !== -1) {
      inventoryCache[index].currentStock = newStock;
      
      // Update status based on new stock
      if (newStock <= 0) {
        inventoryCache[index].status = 'Out of Stock';
      } else if (newStock <= inventoryCache[index].lowStockThreshold) {
        inventoryCache[index].status = 'Low Stock';
      } else {
        inventoryCache[index].status = 'Healthy';
      }
    }
    
    // Invalidate cache - updating stock affects inventory
    cache.invalidateCacheByAction('stock:update');
  } catch (error) {
    console.error('Error updating stock:', error);
    throw error;
  }
}

/**
 * Deduct stock for billing via API
 */
export async function deductStock(skuId: string, quantity: number): Promise<boolean> {
  const index = inventoryCache.findIndex(s => s.id === skuId);
  
  if (index === -1) return false;
  
  const sku = inventoryCache[index];
  if (sku.currentStock < quantity) return false;
  
  const newStock = sku.currentStock - quantity;
  
  try {
    await updateStock(skuId, newStock);
    // Invalidate cache - deducting stock affects inventory
    cache.invalidateCacheByAction('stock:deduct');
    return true;
  } catch (error) {
    console.error('Error deducting stock:', error);
    return false;
  }
}

/**
 * Toggle pin status for a SKU
 */
export async function togglePin(skuId: string): Promise<void> {
  try {
    const response = await apiCall<{ isPinned: boolean, pinnedAt: string | null }>(`/inventory/${skuId}/pin`, {
      method: 'PATCH',
    });
    
    // Update cache
    const index = inventoryCache.findIndex(s => s.id === skuId);
    if (index !== -1) {
      inventoryCache[index].isPinned = response.isPinned;
      inventoryCache[index].pinnedAt = response.pinnedAt;
    }
    
    cache.invalidateCacheByAction('inventory:update');
  } catch (error) {
    console.error('Error toggling pin:', error);
    throw error;
  }
}

/**
 * Clear stock for a SKU
 */
export async function clearStock(skuId: string): Promise<void> {
  try {
    await apiCall(`/inventory/${skuId}/clear`, {
      method: 'PATCH',
    });
    
    // Update cache
    const index = inventoryCache.findIndex(s => s.id === skuId);
    if (index !== -1) {
      inventoryCache[index].currentStock = 0;
      inventoryCache[index].status = 'Out of Stock';
    }
    
    cache.invalidateCacheByAction('stock:update');
  } catch (error) {
    console.error('Error clearing stock:', error);
    throw error;
  }
}

// ============================================================================
// STOCK HISTORY COLLECTION
// ============================================================================

/**
 * Get all stock history entries
 */
export async function getStockHistory(): Promise<StockHistoryEntry[]> {
  // For now, return from cache - would need API endpoint
  return stockHistoryCache;
}

/**
 * Save all stock history
 */
export async function saveStockHistory(history: StockHistoryEntry[]): Promise<void> {
  stockHistoryCache = history;
}

/**
 * Add a stock history entry
 */
export async function addStockHistoryEntry(entry: StockHistoryEntry): Promise<void> {
  stockHistoryCache.push(entry);
}

// ============================================================================
// BILLS COLLECTION
// ============================================================================

/**
 * Get all bills from API
 * @param forceFresh - If true, bypass cache and fetch from Neon
 */
export async function getBills(forceFresh: boolean = false): Promise<Bill[]> {
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cachedBills = cache.getCache<Bill[]>('bills');
    if (cachedBills) {
      billsCache = cachedBills;
      return cachedBills;
    }
  }
  
  try {
    const bills = await apiCall<Bill[]>('/bills');
    billsCache = bills;
    cache.setCache('bills', bills);
    return bills;
  } catch (error) {
    console.error('Error fetching bills:', error);
    return billsCache;
  }
}

/**
 * Get bills (sync version for backward compatibility)
 */
export function getBillsSync(): Bill[] {
  return billsCache;
}

/**
 * Save all bills
 */
export async function saveBills(bills: Bill[]): Promise<void> {
  billsCache = bills;
}

/**
 * Add a new bill via API
 */
export async function addBill(bill: Bill): Promise<void> {
  try {
    const { id, items, ...billData } = bill;
    
    const newBill = await apiCall<Bill>('/bills', {
      method: 'POST',
      body: JSON.stringify({
        ...billData,
        items: bill.items.map(item => ({
          productId: item.productId,
          sizeId: item.sizeId,
          productName: item.productName,
          sizeName: item.sizeName,
          packaging: item.packaging,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      }),
    });
    
    // Add to cache
    billsCache.unshift(newBill);
    
    // Invalidate cache - adding bill affects both bills and inventory
    cache.invalidateCacheByAction('bill:add');
  } catch (error) {
    console.error('Error adding bill:', error);
    throw error;
  }
}

/**
 * Get bill by ID
 */
export function getBillById(billId: string): Bill | undefined {
  return billsCache.find(b => b.id === billId);
}

/**
 * Get bill by invoice number
 */
export function getBillByInvoiceNumber(invoiceNumber: string): Bill | undefined {
  return billsCache.find(b => b.invoiceNumber === invoiceNumber);
}

/**
 * Get next invoice number - generates locally based on cache
 */
export function getNextInvoiceNumber(): string {
  if (billsCache.length === 0) return 'INV-0001';
  
  const numbers = billsCache
    .map(b => {
      const match = b.invoiceNumber.match(/INV-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));
  
  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `INV-${String(maxNumber + 1).padStart(4, '0')}`;
}

// ============================================================================
// SETTINGS COLLECTION
// ============================================================================

const DEFAULT_SETTINGS: StoreSettings = {
  shopName: 'Cold Drinks Store',
  ownerName: 'Store Owner',
  shopAddress: '',
  shopPhone: '',
  taxRate: 0,
  currency: 'INR',
  lowStockDefaultThreshold: 50,
};

/**
 * Get store settings from API
 * @param forceFresh - If true, bypass cache and fetch from Neon
 */
export async function getSettings(forceFresh: boolean = false): Promise<StoreSettings> {
  // Check cache first if not forcing fresh data
  if (!forceFresh) {
    const cachedSettings = cache.getCache<StoreSettings>('settings');
    if (cachedSettings) {
      settingsCache = cachedSettings;
      return cachedSettings;
    }
  }
  
  try {
    const settings = await apiCall<StoreSettings>('/settings');
    settingsCache = settings;
    cache.setCache('settings', settings);
    return settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return settingsCache || DEFAULT_SETTINGS;
  }
}

/**
 * Get settings (sync version for backward compatibility)
 */
export function getSettingsSync(): StoreSettings {
  return settingsCache || DEFAULT_SETTINGS;
}

/**
 * Save store settings via API
 */
export async function saveSettings(settings: StoreSettings): Promise<void> {
  try {
    const updatedSettings = await apiCall<StoreSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        shopName: settings.shopName,
        ownerName: settings.ownerName,
        shopPhone: settings.shopPhone,
        shopAddress: settings.shopAddress,
        taxRate: settings.taxRate,
        currency: settings.currency,
        lowStockDefaultThreshold: settings.lowStockDefaultThreshold,
      }),
    });
    
    settingsCache = updatedSettings;
    
    // Invalidate cache - updating settings affects settings
    cache.invalidateCacheByAction('settings:update');
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

/**
 * Update store settings via API
 */
export async function updateSettings(updates: Partial<StoreSettings>): Promise<void> {
  const currentSettings = settingsCache || DEFAULT_SETTINGS;
  const newSettings = { ...currentSettings, ...updates };
  await saveSettings(newSettings);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate SKU code from product and size info
 */
export function generateSKUCode(brand: string, name: string, sizeName: string): string {
  const brandPrefix = brand.substring(0, 3).toUpperCase();
  const namePrefix = name.substring(0, 3).toUpperCase();
  const sizeClean = sizeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${brandPrefix}-${namePrefix}-${sizeClean}-${random}`;
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
  productsCache = [];
  inventoryCache = [];
  billsCache = [];
  stockHistoryCache = [];
  settingsCache = null;
  
  // Also clear the cache module
  cache.clearAllCache();
}

/**
 * Export all data as JSON (for backup)
 */
export async function exportData(): Promise<string> {
  const data = {
    products: await getProducts(),
    inventory: await getInventory(),
    bills: await getBills(),
    stockHistory: await getStockHistory(),
    settings: await getSettings(),
    exportedAt: new Date().toISOString(),
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON backup
 */
export async function importData(jsonData: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonData);
    
    if (data.products) productsCache = data.products;
    if (data.inventory) inventoryCache = data.inventory;
    if (data.bills) billsCache = data.bills;
    if (data.stockHistory) stockHistoryCache = data.stockHistory;
    if (data.settings) settingsCache = data.settings;
    
    return true;
  } catch (error) {
    console.error('Error importing data:', error);
    return false;
  }
}

// ============================================================================
// DASHBOARD HELPER FUNCTIONS
// ============================================================================

/**
 * Get sales data for the last N days
 */
export async function getSalesDataForDays(days: number): Promise<{ date: string; totalSales: number; billCount: number }[]> {
  const bills = await getBills();
  const result: { [date: string]: { totalSales: number; billCount: number } } = {};
  
  // Initialize all dates
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    result[dateStr] = { totalSales: 0, billCount: 0 };
  }
  
  // Aggregate bill data
  bills.forEach(bill => {
    const dateStr = bill.createdAt.split('T')[0];
    if (result[dateStr]) {
      result[dateStr].totalSales += Number(bill.totalAmount);
      result[dateStr].billCount += 1;
    }
  });
  
  return Object.entries(result).map(([date, data]) => ({
    date,
    ...data,
  }));
}

/**
 * Get today's sales summary
 */
export async function getTodaySalesSummary(): Promise<{ todaySales: number; todayBills: number; yesterdaySales: number; yesterdayBills: number }> {
  const bills = await getBills();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  let todaySales = 0;
  let todayBills = 0;
  let yesterdaySales = 0;
  let yesterdayBills = 0;
  
  bills.forEach(bill => {
    const billDate = bill.createdAt.split('T')[0];
    if (billDate === today) {
      todaySales += Number(bill.totalAmount);
      todayBills += 1;
    } else if (billDate === yesterday) {
      yesterdaySales += Number(bill.totalAmount);
      yesterdayBills += 1;
    }
  });
  
  return { todaySales, todayBills, yesterdaySales, yesterdayBills };
}

/**
 * Get inventory statistics
 */
export async function getInventoryStats(): Promise<{ healthy: number; lowStock: number; outOfStock: number }> {
  const inventory = await getInventory();
  
  return {
    healthy: inventory.filter(s => s.status === 'Healthy').length,
    lowStock: inventory.filter(s => s.status === 'Low Stock').length,
    outOfStock: inventory.filter(s => s.status === 'Out of Stock').length,
  };
}

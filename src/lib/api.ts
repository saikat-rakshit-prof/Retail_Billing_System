// ============================================================================
// API STORAGE LAYER
// ============================================================================
// This file replaces localStorage with API calls to Neon database
// All function signatures match the original storage.ts for compatibility
// ============================================================================

import { Product, SKU, StockHistoryEntry, Bill, StoreSettings } from '@/types';

const API_BASE = '/api';

// ============================================================================
// PRODUCTS API
// ============================================================================

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE}/products`, { 
    cache: 'no-store' 
  });
  if (!response.ok) throw new Error('Failed to fetch products');
  
  const products = await response.json();
  
  // Convert database format to app format
  return products.map((p: { id: string; name: string; brand: string; category: string; imageUrl?: string; createdAt: string; updatedAt: string; sizes: Array<{ id: string; sizeName: string; pricePerBottle: string; pricePerCarton: string; bottlesPerCarton: number }> }) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    image: p.imageUrl || '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    sizes: p.sizes.map((s) => ({
      id: s.id,
      name: s.sizeName,
      pricePerBottle: Number(s.pricePerBottle),
      pricePerCarton: Number(s.pricePerCarton),
      bottlesPerCarton: s.bottlesPerCarton,
    })),
  }));
}

export async function addProduct(product: Product): Promise<void> {
  const response = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: product.name,
      brand: product.brand,
      category: product.category,
      imageUrl: product.image,
      sizes: product.sizes.map((s) => ({
        name: s.name,
        pricePerBottle: s.pricePerBottle,
        pricePerCarton: s.pricePerCarton,
        bottlesPerCarton: s.bottlesPerCarton,
      })),
    }),
  });
  
  if (!response.ok) throw new Error('Failed to add product');
}

export async function updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
  const response = await fetch(`${API_BASE}/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: updates.name,
      brand: updates.brand,
      category: updates.category,
      imageUrl: updates.image,
      sizes: updates.sizes?.map((s) => ({
        name: s.name,
        pricePerBottle: s.pricePerBottle,
        pricePerCarton: s.pricePerCarton,
        bottlesPerCarton: s.bottlesPerCarton,
      })),
    }),
  });
  
  if (!response.ok) throw new Error('Failed to update product');
}

export async function deleteProduct(productId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/products/${productId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) throw new Error('Failed to delete product');
}

// ============================================================================
// INVENTORY API
// ============================================================================

export async function getInventory(): Promise<SKU[]> {
  const response = await fetch(`${API_BASE}/inventory`, { 
    cache: 'no-store' 
  });
  if (!response.ok) throw new Error('Failed to fetch inventory');
  
  const inventory = await response.json();
  
  // Convert database format to app format
  return inventory.map((item: { id: string; productSizeId: string; skuCode: string; currentStock: number; lowStockThreshold: number; status: string; isPinned: boolean; productName?: string; brand?: string; sizeName?: string }) => ({
    id: item.id,
    productId: '', // Will need to look up from productSizeId
    sizeId: item.productSizeId,
    skuCode: item.skuCode,
    currentStock: item.currentStock,
    lowStockThreshold: item.lowStockThreshold,
    status: item.status as 'Healthy' | 'Low Stock' | 'Out of Stock',
  }));
}

export async function saveInventory(skus: SKU[]): Promise<void> {
  // Bulk update not supported - individual updates only
  console.warn('saveInventory: Bulk save not implemented for API mode');
}

export async function updateStock(skuId: string, newStock: number): Promise<void> {
  const response = await fetch(`${API_BASE}/inventory/${skuId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentStock: newStock }),
  });
  
  if (!response.ok) throw new Error('Failed to update stock');
}

export async function deductStock(skuId: string, quantity: number): Promise<boolean> {
  const response = await fetch(`${API_BASE}/inventory/${skuId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity, type: 'deduction' }),
  });
  
  if (!response.ok) return false;
  return true;
}

export async function addStock(skuId: string, quantity: number, type: 'bottles' | 'cartons', notes?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/inventory/${skuId}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity, type, note: notes }),
  });
  
  if (!response.ok) throw new Error('Failed to add stock');
}

// ============================================================================
// STOCK HISTORY API
// ============================================================================

export async function getStockHistory(): Promise<StockHistoryEntry[]> {
  // Not implemented yet - would need a dedicated endpoint
  return [];
}

export async function addStockHistoryEntry(entry: StockHistoryEntry): Promise<void> {
  // Stock history is automatically created by the stock endpoint
  console.log('Stock history entry:', entry);
}

// ============================================================================
// BILLS API
// ============================================================================

export async function getBills(): Promise<Bill[]> {
  const response = await fetch(`${API_BASE}/bills`, { 
    cache: 'no-store' 
  });
  if (!response.ok) throw new Error('Failed to fetch bills');
  
  const bills = await response.json();
  
  // Convert database format to app format
  return bills.map((b: { id: string; invoiceNumber: string; customerName?: string; customerPhone?: string; subtotal: string; discountType: string; discountValue: string; discountAmount: string; totalAmount: string; paymentMode: string; cashReceived?: string; changeGiven?: string; createdAt: string; status: string; items: Array<{ id: string; productName: string; sizeName: string; packaging: string; quantity: number; unitPrice: string; totalPrice: string }> }) => ({
    id: b.id,
    invoiceNumber: b.invoiceNumber,
    customerName: b.customerName,
    phoneNumber: b.customerPhone,
    subtotal: Number(b.subtotal),
    discountType: b.discountType as 'percentage' | 'flat',
    discountValue: Number(b.discountValue),
    discountAmount: Number(b.discountAmount),
    totalAmount: Number(b.totalAmount),
    paymentMode: b.paymentMode as 'Cash' | 'UPI' | 'Card',
    cashReceived: b.cashReceived ? Number(b.cashReceived) : undefined,
    changeGiven: b.changeGiven ? Number(b.changeGiven) : undefined,
    createdAt: b.createdAt,
    status: b.status as 'paid' | 'pending' | 'cancelled' | 'partially_paid',
    items: b.items.map((i) => ({
      id: i.id,
      productId: '',
      sizeId: '',
      productName: i.productName,
      sizeName: i.sizeName,
      packaging: i.packaging as 'bottle' | 'carton',
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
    })),
  }));
}

export async function addBill(bill: Bill): Promise<void> {
  const response = await fetch(`${API_BASE}/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      billType: bill.billType || 'sale',
      customerId: bill.customerId,
      customerName: bill.customerName,
      customerPhone: bill.phoneNumber,
      items: bill.items.map((i) => ({
        productId: i.productId,
        sizeId: i.sizeId,
        productName: i.productName,
        sizeName: i.sizeName,
        packaging: i.packaging,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
      })),
      subtotal: bill.subtotal,
      discountType: bill.discountType,
      discountValue: bill.discountValue,
      discountAmount: bill.discountAmount,
      totalAmount: bill.totalAmount,
      paymentMode: bill.paymentMode,
      cashReceived: bill.cashReceived,
      changeGiven: bill.changeGiven,
      deliveryDate: bill.deliveryDate,
      status: bill.status || 'paid',
    }),
  });
  
  if (!response.ok) throw new Error('Failed to add bill');
}

export async function getBillById(billId: string): Promise<Bill | undefined> {
  const response = await fetch(`${API_BASE}/bills/${billId}`, { 
    cache: 'no-store' 
  });
  if (!response.ok) return undefined;
  return response.json();
}

export async function getNextInvoiceNumber(): Promise<string> {
  const bills = await getBills();
  if (bills.length === 0) return 'INV-0001';
  
  const numbers = bills
    .map((b) => {
      const match = b.invoiceNumber.match(/INV-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));
  
  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `INV-${String(maxNumber + 1).padStart(4, '0')}`;
}

// ============================================================================
// SETTINGS API
// ============================================================================

export async function getSettings(): Promise<StoreSettings> {
  const response = await fetch(`${API_BASE}/settings`, { 
    cache: 'no-store' 
  });
  if (!response.ok) throw new Error('Failed to fetch settings');
  
  const settings = await response.json();
  
  return {
    shopName: settings.shopName || 'My Store',
    ownerName: settings.ownerName || '',
    shopAddress: settings.shopAddress || '',
    shopPhone: settings.shopPhone || '',
    taxRate: Number(settings.taxRate) || 0,
    currency: settings.currency || 'INR',
    lowStockDefaultThreshold: settings.lowStockDefaultThreshold || 50,
  };
}

export async function saveSettings(settings: StoreSettings): Promise<void> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
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
  
  if (!response.ok) throw new Error('Failed to save settings');
}

// ============================================================================
// DASHBOARD HELPER FUNCTIONS
// ============================================================================

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
  bills.forEach((bill) => {
    const dateStr = bill.createdAt.split('T')[0];
    if (result[dateStr]) {
      result[dateStr].totalSales += bill.totalAmount;
      result[dateStr].billCount += 1;
    }
  });
  
  return Object.entries(result).map(([date, data]) => ({
    date,
    ...data,
  }));
}

export async function getTodaySalesSummary(): Promise<{ todaySales: number; todayBills: number; yesterdaySales: number; yesterdayBills: number }> {
  const bills = await getBills();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  let todaySales = 0;
  let todayBills = 0;
  let yesterdaySales = 0;
  let yesterdayBills = 0;
  
  bills.forEach((bill) => {
    const billDate = bill.createdAt.split('T')[0];
    if (billDate === today) {
      todaySales += bill.totalAmount;
      todayBills += 1;
    } else if (billDate === yesterday) {
      yesterdaySales += bill.totalAmount;
      yesterdayBills += 1;
    }
  });
  
  return { todaySales, todayBills, yesterdaySales, yesterdayBills };
}

export async function getInventoryStats(): Promise<{ healthy: number; lowStock: number; outOfStock: number }> {
  const inventory = await getInventory();
  
  return {
    healthy: inventory.filter((s) => s.status === 'Healthy').length,
    lowStock: inventory.filter((s) => s.status === 'Low Stock').length,
    outOfStock: inventory.filter((s) => s.status === 'Out of Stock').length,
  };
}

// ============================================================================
// LEGACY FUNCTIONS (for compatibility)
// ============================================================================

export function saveProducts(_products: Product[]): void {
  console.warn('saveProducts: Not implemented for API mode - use addProduct/updateProduct');
}

export function upsertSKU(_sku: SKU): void {
  console.warn('upsertSKU: Not implemented for API mode');
}

export function getBillByInvoiceNumber(_invoiceNumber: string): Bill | undefined {
  console.warn('getBillByInvoiceNumber: Not implemented for API mode');
  return undefined;
}

export function generateSKUCode(brand: string, name: string, sizeName: string): string {
  const brandPrefix = brand.substring(0, 3).toUpperCase();
  const namePrefix = name.substring(0, 3).toUpperCase();
  const sizeClean = sizeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${brandPrefix}-${namePrefix}-${sizeClean}-${random}`;
}

export function clearAllData(): void {
  console.warn('clearAllData: Not implemented for API mode');
}

export function exportData(): string {
  console.warn('exportData: Not implemented for API mode');
  return '{}';
}

export function importData(_jsonData: string): boolean {
  console.warn('importData: Not implemented for API mode');
  return false;
}

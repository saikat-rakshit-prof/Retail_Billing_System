// Product related types
export type ProductCategory = 'All' | 'Soft Drinks' | 'Juices' | 'Energy Drinks' | 'Water' | 'Others';

export interface ProductSize {
  id: string;
  name: string; // e.g., "500ml", "1.5L", "250ml Can"
  pricePerBottle: number;
  pricePerCarton: number;
  bottlesPerCarton: number;
}

export interface Product {
  id: string;
  brand: string;
  name: string;
  category: ProductCategory;
  icon?: string | null; // Icon name: 'Coffee', 'Droplets', 'Zap', 'Droplet', 'Beer'
  image?: string | null;
  sizes: ProductSize[];
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Inventory related types
export type StockStatus = 'Healthy' | 'Low Stock' | 'Out of Stock';

export interface SKU {
  id: string;
  productId?: string;
  sizeId?: string;
  skuCode: string; // Auto-generated SKU
  currentStock: number;
  lowStockThreshold: number;
  status: StockStatus;
  lastRestocked?: string;
  // Flat fields from JOIN query
  productSizeId?: string;
  productName?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  sizeName?: string;
  pricePerBottle?: number;
  pricePerCarton?: number;
  bottlesPerCarton?: number;
  isPinned?: boolean;
  pinnedAt?: string | null;
}

export interface StockEntry {
  id: string;
  skuId: string;
  productId: string;
  quantity: number; // in bottles
  quantityType: 'bottles' | 'cartons';
  batchId?: string;
  expiryDate?: string;
  addedAt: string;
  notes?: string;
}

export interface StockHistoryEntry {
  id: string;
  skuId: string;
  productId: string;
  type: 'addition' | 'deduction';
  quantity: number;
  previousStock: number;
  newStock: number;
  billId?: string;
  timestamp: string;
  notes?: string;
}

// Billing related types
export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Credit';

export interface BillItem {
  id: string;
  productId: string;
  sizeId: string;
  productName: string;
  sizeName: string;
  packaging: 'bottle' | 'carton';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  billType?: 'sale' | 'order';
  customerName?: string;
  phoneNumber?: string;
  customerEmail?: string;
  customerId?: string;
  customerType?: CustomerType;
  items: BillItem[];
  subtotal: number;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  discountAmount: number;
  totalAmount: number;
  paymentMode: PaymentMode;
  cashReceived?: number;
  changeGiven?: number;
  outstandingAmount?: number;
  deliveryDate?: string;
  createdAt: string;
  status: 'paid' | 'pending' | 'cancelled' | 'partially_paid' | 'completed' | 'returned';
}

// Settings types
export interface StoreSettings {
  shopName: string;
  ownerName: string;
  shopAddress?: string;
  shopPhone?: string;
  taxRate: number;
  currency: string;
  lowStockDefaultThreshold: number;
}

// Dashboard types
export interface DailySales {
  date: string;
  totalSales: number;
  billCount: number;
}

export interface DashboardStats {
  todaySales: number;
  todayBills: number;
  totalProducts: number;
  lowStockAlerts: number;
  yesterdaySales?: number;
  yesterdayBills?: number;
}

// ============================================================================
// CUSTOMER TYPES
// ============================================================================
export type CustomerType = 'regular' | 'seasonal' | 'retail' | 'wholesale';

export type CustomerPaymentType = 'payment' | 'refund' | 'credit';

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  customerType: CustomerType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentMode: PaymentMode;
  type: CustomerPaymentType;
  note?: string;
  billId?: string;
  createdAt: string;
}

export interface CustomerWithStats extends Customer {
  totalBills: number;
  averageBillValue: number;
  lastPurchaseDate?: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone?: string;
  customerType: CustomerType;
  outstandingBalance: number;
}

export interface CustomerReport {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  customerType: CustomerType;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  totalBills: number;
  lastPurchaseDate?: string;
  memberSince: string;
}

export interface CustomerSalesReport {
  customerName: string;
  totalBills: number;
  totalAmount: number;
  averageBill: number;
  lastPurchase: string;
}

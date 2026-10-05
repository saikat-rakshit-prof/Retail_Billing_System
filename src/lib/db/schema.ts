import { pgTable, uuid, varchar, text, decimal, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// SETTINGS TABLE
// ============================================================================
export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopName: varchar('shop_name', { length: 255 }).notNull().default('FrostyFlow'),
  ownerName: varchar('owner_name', { length: 255 }),
  shopPhone: varchar('shop_phone', { length: 50 }),
  shopAddress: text('shop_address'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 10 }).default('INR'),
  lowStockDefaultThreshold: integer('low_stock_default_threshold').default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// PRODUCTS TABLE
// ============================================================================
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  brand: varchar('brand', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  imageUrl: text('image_url'),
  isPinned: boolean('is_pinned').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// PRODUCT_SIZES TABLE
// ============================================================================
export const productSizes = pgTable('product_sizes', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  sizeName: varchar('size_name', { length: 50 }).notNull(),
  pricePerBottle: decimal('price_per_bottle', { precision: 10, scale: 2 }).notNull(),
  pricePerCarton: decimal('price_per_carton', { precision: 10, scale: 2 }).notNull(),
  bottlesPerCarton: integer('bottles_per_carton').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// INVENTORY TABLE (SKU)
// ============================================================================
export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  productSizeId: uuid('product_size_id').references(() => productSizes.id, { onDelete: 'cascade' }).notNull(),
  skuCode: varchar('sku_code', { length: 50 }).unique().notNull(),
  currentStock: integer('current_stock').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').default(50),
  status: varchar('status', { length: 20 }).default('Healthy'),
  isPinned: boolean('is_pinned').default(false),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  lastRestocked: timestamp('last_restocked', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// STOCK_HISTORY TABLE
// ============================================================================
export const stockHistory = pgTable('stock_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  inventoryId: uuid('inventory_id').references(() => inventory.id, { onDelete: 'cascade' }).notNull(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  billId: uuid('bill_id').references(() => bills.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// CUSTOMERS TABLE
// ============================================================================
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).unique(),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  notes: text('notes'),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0'),
  totalPurchases: decimal('total_purchases', { precision: 12, scale: 2 }).default('0'),
  totalPaid: decimal('total_paid', { precision: 12, scale: 2 }).default('0'),
  outstandingBalance: decimal('outstanding_balance', { precision: 12, scale: 2 }).default('0'),
  customerType: varchar('customer_type', { length: 20 }).default('regular'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// CUSTOMER PAYMENTS TABLE
// ============================================================================
export const customerPayments = pgTable('customer_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMode: varchar('payment_mode', { length: 20 }).default('Cash'),
  type: varchar('type', { length: 20 }).default('payment'), // payment, refund, credit
  note: text('note'),
  billId: uuid('bill_id').references(() => bills.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// BILLS TABLE
// ============================================================================
export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: varchar('invoice_number', { length: 20 }).unique().notNull(),
  billType: varchar('bill_type', { length: 20 }).default('sale'), // 'sale' or 'order'
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  discountType: varchar('discount_type', { length: 20 }).default('percentage'),
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentMode: varchar('payment_mode', { length: 20 }).default('Cash'),
  cashReceived: decimal('cash_received', { precision: 12, scale: 2 }),
  changeGiven: decimal('change_given', { precision: 12, scale: 2 }),
  outstandingAmount: decimal('outstanding_amount', { precision: 12, scale: 2 }).default('0'),
  deliveryDate: timestamp('delivery_date', { withTimezone: true }),
  status: varchar('status', { length: 20 }).default('paid'), // 'paid', 'pending', 'cancelled', 'partially_paid', 'completed', 'returned'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================================
// BILL_ITEMS TABLE
// ============================================================================
export const billItems = pgTable('bill_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').references(() => bills.id, { onDelete: 'cascade' }).notNull(),
  productSizeId: uuid('product_size_id').references(() => productSizes.id, { onDelete: 'set null' }),
  productName: varchar('product_name', { length: 255 }).notNull(),
  sizeName: varchar('size_name', { length: 50 }).notNull(),
  packaging: varchar('packaging', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
});

// ============================================================================
// INVOICE COUNTER TABLE
// ============================================================================
export const invoiceCounter = pgTable('invoice_counter', {
  id: integer('id').primaryKey().default(1),
  lastNumber: integer('last_number').notNull().default(0),
});

// ============================================================================
// RELATIONS
// ============================================================================
export const customersRelations = relations(customers, ({ many }) => ({
  payments: many(customerPayments),
  bills: many(bills),
}));

export const customerPaymentsRelations = relations(customerPayments, ({ one }) => ({
  customer: one(customers, {
    fields: [customerPayments.customerId],
    references: [customers.id],
  }),
  bill: one(bills, {
    fields: [customerPayments.billId],
    references: [bills.id],
  }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  customer: one(customers, {
    fields: [bills.customerId],
    references: [customers.id],
  }),
  items: many(billItems),
}));

export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(bills, {
    fields: [billItems.billId],
    references: [bills.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductSize = typeof productSizes.$inferSelect;
export type NewProductSize = typeof productSizes.$inferInsert;

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;

export type StockHistory = typeof stockHistory.$inferSelect;
export type NewStockHistory = typeof stockHistory.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type CustomerPayment = typeof customerPayments.$inferSelect;
export type NewCustomerPayment = typeof customerPayments.$inferInsert;

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

export type BillItem = typeof billItems.$inferSelect;
export type NewBillItem = typeof billItems.$inferInsert;

import { db } from '@/lib/db';
import {
  bills,
  billItems,
  customers,
  customerPayments,
  inventory,
  productSizes,
  products,
} from '@/lib/db/schema';
import { sql, eq, desc, gte, lte, and, ilike, or, count, type SQL } from 'drizzle-orm';

/**
 * Returns Start & End Date objects for Asia/Kolkata (IST, UTC+5:30) timezone
 */
export function getKolkataDateBounds(
  preset?: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom',
  customFrom?: string,
  customTo?: string
): { startDate: Date; endDate: Date; label: string } {
  const now = new Date();
  const kolkataStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const kolkataNow = new Date(kolkataStr);

  const year = kolkataNow.getFullYear();
  const month = kolkataNow.getMonth();
  const date = kolkataNow.getDate();
  const day = kolkataNow.getDay();

  if (preset === 'yesterday') {
    const start = new Date(Date.UTC(year, month, date - 1, -5, -30, 0, 0));
    const end = new Date(Date.UTC(year, month, date - 1, 18, 29, 59, 999));
    return { startDate: start, endDate: end, label: 'Yesterday (Asia/Kolkata)' };
  }

  if (preset === 'this_week') {
    const diff = date - (day === 0 ? 6 : day - 1);
    const start = new Date(Date.UTC(year, month, diff, -5, -30, 0, 0));
    const end = new Date(Date.UTC(year, month, date, 18, 29, 59, 999));
    return { startDate: start, endDate: end, label: 'This Week (Asia/Kolkata)' };
  }

  if (preset === 'this_month') {
    const start = new Date(Date.UTC(year, month, 1, -5, -30, 0, 0));
    const end = new Date(Date.UTC(year, month, date, 18, 29, 59, 999));
    return { startDate: start, endDate: end, label: 'This Month (Asia/Kolkata)' };
  }

  if (preset === 'custom' && customFrom) {
    const fromParts = customFrom.split('T')[0].split('-').map(Number);
    const toParts = (customTo || customFrom).split('T')[0].split('-').map(Number);

    const start = new Date(
      Date.UTC(fromParts[0], fromParts[1] - 1, fromParts[2], -5, -30, 0, 0)
    );
    const end = new Date(
      Date.UTC(toParts[0], toParts[1] - 1, toParts[2], 18, 29, 59, 999)
    );
    return {
      startDate: start,
      endDate: end,
      label: `${customFrom} to ${customTo || customFrom}`,
    };
  }

  // Default: Today
  const start = new Date(Date.UTC(year, month, date, -5, -30, 0, 0));
  const end = new Date(Date.UTC(year, month, date, 18, 29, 59, 999));
  return { startDate: start, endDate: end, label: 'Today (Asia/Kolkata)' };
}

/**
 * 1. getTodaySales
 * Returns total sales, number of bills, and payment-mode breakdown for today in Asia/Kolkata timezone.
 */
export async function getTodaySales() {
  const { startDate, endDate, label } = getKolkataDateBounds('today');

  const todayBills = await db
    .select()
    .from(bills)
    .where(and(gte(bills.createdAt, startDate), lte(bills.createdAt, endDate)));

  const totalSales = todayBills.reduce(
    (sum, b) => sum + (parseFloat(b.totalAmount) || 0),
    0
  );
  const totalSubtotal = todayBills.reduce(
    (sum, b) => sum + (parseFloat(b.subtotal) || 0),
    0
  );
  const totalDiscount = todayBills.reduce(
    (sum, b) => sum + (parseFloat(b.discountAmount || '0') || 0),
    0
  );
  const totalOutstanding = todayBills.reduce(
    (sum, b) => sum + (parseFloat(b.outstandingAmount || '0') || 0),
    0
  );

  const paymentModeBreakdown: Record<string, { count: number; totalAmount: number }> = {};
  for (const bill of todayBills) {
    const mode = bill.paymentMode || 'Cash';
    if (!paymentModeBreakdown[mode]) {
      paymentModeBreakdown[mode] = { count: 0, totalAmount: 0 };
    }
    paymentModeBreakdown[mode].count += 1;
    paymentModeBreakdown[mode].totalAmount += parseFloat(bill.totalAmount) || 0;
  }

  return {
    period: label,
    billCount: todayBills.length,
    totalSales,
    totalSubtotal,
    totalDiscount,
    totalOutstanding,
    paymentModeBreakdown,
  };
}

/**
 * 2. getSalesByDateRange
 * Returns sales and bill statistics within a given date range (Asia/Kolkata timezone).
 * Defaults to all-time (2000-01-01 to today) when no dates are given.
 */
export async function getSalesByDateRange(
  fromOrArgs?: string | { from?: string; to?: string },
  toParam?: string
) {
  const from = typeof fromOrArgs === 'object' ? fromOrArgs?.from : fromOrArgs;
  const to = typeof fromOrArgs === 'object' ? fromOrArgs?.to : toParam;

  // Default to all-time range when no dates given
  const effectiveFrom = from || '2000-01-01';
  const effectiveTo = to || new Date().toISOString().split('T')[0];

  const { startDate, endDate, label } = getKolkataDateBounds(
    'custom',
    effectiveFrom,
    effectiveTo
  );

  const rangeBills = await db
    .select()
    .from(bills)
    .where(and(gte(bills.createdAt, startDate), lte(bills.createdAt, endDate)))
    .orderBy(desc(bills.createdAt));

  const totalSales = rangeBills.reduce(
    (sum, b) => sum + (parseFloat(b.totalAmount) || 0),
    0
  );
  const totalDiscount = rangeBills.reduce(
    (sum, b) => sum + (parseFloat(b.discountAmount || '0') || 0),
    0
  );
  const totalOutstanding = rangeBills.reduce(
    (sum, b) => sum + (parseFloat(b.outstandingAmount || '0') || 0),
    0
  );

  const paymentModeBreakdown: Record<string, { count: number; totalAmount: number }> = {};
  for (const bill of rangeBills) {
    const mode = bill.paymentMode || 'Cash';
    if (!paymentModeBreakdown[mode]) {
      paymentModeBreakdown[mode] = { count: 0, totalAmount: 0 };
    }
    paymentModeBreakdown[mode].count += 1;
    paymentModeBreakdown[mode].totalAmount += parseFloat(bill.totalAmount) || 0;
  }

  return {
    dateRange: from ? label : 'All Time',
    totalBills: rangeBills.length,
    totalSales,
    totalDiscount,
    totalOutstanding,
    paymentModeBreakdown,
  };
}

/**
 * 3. getStockLevels
 * Returns current stock per product size & SKU. Can filter by partial product name.
 */
export async function getStockLevels(
  productNameOrArgs?: string | { productName?: string }
) {
  const productName =
    typeof productNameOrArgs === 'object'
      ? productNameOrArgs.productName
      : productNameOrArgs;

  const query = db
    .select({
      inventoryId: inventory.id,
      skuCode: inventory.skuCode,
      currentStock: inventory.currentStock,
      lowStockThreshold: inventory.lowStockThreshold,
      status: inventory.status,
      sizeName: productSizes.sizeName,
      pricePerBottle: productSizes.pricePerBottle,
      pricePerCarton: productSizes.pricePerCarton,
      bottlesPerCarton: productSizes.bottlesPerCarton,
      productName: products.name,
      brand: products.brand,
      category: products.category,
    })
    .from(inventory)
    .innerJoin(productSizes, eq(inventory.productSizeId, productSizes.id))
    .innerJoin(products, eq(productSizes.productId, products.id));

  let results;
  if (productName && productName.trim() !== '') {
    const searchPattern = `%${productName.trim()}%`;
    results = await query
      .where(
        or(
          ilike(products.name, searchPattern),
          ilike(products.brand, searchPattern),
          ilike(products.category, searchPattern)
        )
      )
      .limit(30);
  } else {
    results = await query.limit(30);
  }

  return {
    totalItemsFound: results.length,
    stocks: results.map((item) => {
      const bpc = item.bottlesPerCarton || 1;
      const cartons = Math.floor(item.currentStock / bpc);
      const remainingBottles = item.currentStock % bpc;
      return {
        productName: item.productName,
        brand: item.brand,
        category: item.category,
        size: item.sizeName,
        sku: item.skuCode,
        totalBottles: item.currentStock,
        formattedStock:
          bpc > 1
            ? `${cartons} cartons + ${remainingBottles} bottles (${item.currentStock} total bottles)`
            : `${item.currentStock} units`,
        threshold: item.lowStockThreshold,
        status: item.status,
        bottlePrice: parseFloat(item.pricePerBottle) || 0,
        cartonPrice: parseFloat(item.pricePerCarton) || 0,
      };
    }),
  };
}

/**
 * 4. getLowStockItems
 * Returns items whose current stock is at or below their low stock threshold.
 */
export async function getLowStockItems() {
  const allStock = await db
    .select({
      inventoryId: inventory.id,
      skuCode: inventory.skuCode,
      currentStock: inventory.currentStock,
      lowStockThreshold: inventory.lowStockThreshold,
      status: inventory.status,
      sizeName: productSizes.sizeName,
      bottlesPerCarton: productSizes.bottlesPerCarton,
      productName: products.name,
      brand: products.brand,
      category: products.category,
    })
    .from(inventory)
    .innerJoin(productSizes, eq(inventory.productSizeId, productSizes.id))
    .innerJoin(products, eq(productSizes.productId, products.id));

  const lowStockItems = allStock.filter(
    (item) => item.currentStock <= (item.lowStockThreshold ?? 50)
  );

  return {
    count: lowStockItems.length,
    items: lowStockItems.map((item) => ({
      productName: item.productName,
      brand: item.brand,
      category: item.category,
      size: item.sizeName,
      sku: item.skuCode,
      currentStock: item.currentStock,
      threshold: item.lowStockThreshold ?? 50,
      deficit: (item.lowStockThreshold ?? 50) - item.currentStock,
      status: item.currentStock === 0 ? 'Out of Stock' : 'Low Stock',
    })),
  };
}

/**
 * 5. getCustomersWithDue
 * Returns customers with pending balances, sorted in descending order of due amount.
 */
export async function getCustomersWithDue() {
  const dueCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      creditLimit: customers.creditLimit,
      totalPurchases: customers.totalPurchases,
      totalPaid: customers.totalPaid,
      outstandingBalance: customers.outstandingBalance,
      customerType: customers.customerType,
    })
    .from(customers)
    .where(sql`CAST(${customers.outstandingBalance} AS NUMERIC) > 0`)
    .orderBy(desc(sql`CAST(${customers.outstandingBalance} AS NUMERIC)`));

  const totalDue = dueCustomers.reduce(
    (sum, c) => sum + (parseFloat(c.outstandingBalance || '0') || 0),
    0
  );

  return {
    customerCount: dueCustomers.length,
    totalOutstandingAmount: totalDue,
    customers: dueCustomers.map((c) => ({
      name: c.name,
      phone: c.phone || 'N/A',
      type: c.customerType || 'regular',
      outstandingBalance: parseFloat(c.outstandingBalance || '0') || 0,
      creditLimit: parseFloat(c.creditLimit || '0') || 0,
      totalPurchases: parseFloat(c.totalPurchases || '0') || 0,
    })),
  };
}

/**
 * 6. getTopProducts
 * Returns top-selling products by quantity and revenue within an optional date range.
 */
export async function getTopProducts(
  fromOrArgs?: string | { from?: string; to?: string; limit?: number },
  toParam?: string,
  limitParam?: number
) {
  const from = typeof fromOrArgs === 'object' ? fromOrArgs.from : fromOrArgs;
  const to = typeof fromOrArgs === 'object' ? fromOrArgs.to : toParam;
  const rawLimit =
    typeof fromOrArgs === 'object' ? fromOrArgs.limit : limitParam;
  const limitCount = rawLimit && rawLimit > 0 ? Math.min(rawLimit, 20) : 5;

  const conditions: SQL[] = [];
  let label = 'All Time';

  if (from) {
    const { startDate, endDate, label: rangeLabel } = getKolkataDateBounds(
      'custom',
      from,
      to || from
    );
    conditions.push(gte(bills.createdAt, startDate));
    conditions.push(lte(bills.createdAt, endDate));
    label = rangeLabel;
  }

  const query = db
    .select({
      productName: billItems.productName,
      sizeName: billItems.sizeName,
      packaging: billItems.packaging,
      totalQuantitySold: sql<number>`SUM(${billItems.quantity})::int`,
      totalRevenue: sql<number>`SUM(CAST(${billItems.totalPrice} AS NUMERIC))::float`,
      orderCount: sql<number>`COUNT(DISTINCT ${billItems.billId})::int`,
    })
    .from(billItems)
    .innerJoin(bills, eq(billItems.billId, bills.id));

  const results = await (conditions.length > 0
    ? query.where(and(...conditions))
    : query
  )
    .groupBy(billItems.productName, billItems.sizeName, billItems.packaging)
    .orderBy(desc(sql`SUM(CAST(${billItems.totalPrice} AS NUMERIC))`))
    .limit(limitCount);

  return {
    period: label,
    topProducts: results.map((r, index) => ({
      rank: index + 1,
      productName: r.productName,
      size: r.sizeName,
      packaging: r.packaging,
      totalQuantitySold: r.totalQuantitySold,
      totalRevenue: Math.round((r.totalRevenue || 0) * 100) / 100,
      timesOrdered: r.orderCount,
    })),
  };
}

/**
 * 7. getCustomerDetails
 * Returns a specific customer's profile, recent bills, and payment records by name.
 */
export async function getCustomerDetails(args: { name: string } | string) {
  const name = typeof args === 'object' ? args.name : args;
  if (!name || name.trim() === '') {
    return { error: 'Customer name is required' };
  }

  const foundCustomers = await db
    .select()
    .from(customers)
    .where(ilike(customers.name, `%${name.trim()}%`))
    .limit(5);

  if (foundCustomers.length === 0) {
    return {
      message: `No customer found matching "${name}".`,
      customers: [],
    };
  }

  const customerResults = await Promise.all(
    foundCustomers.map(async (c) => {
      const recentBills = await db
        .select({
          id: bills.id,
          invoiceNumber: bills.invoiceNumber,
          totalAmount: bills.totalAmount,
          outstandingAmount: bills.outstandingAmount,
          paymentMode: bills.paymentMode,
          status: bills.status,
          createdAt: bills.createdAt,
        })
        .from(bills)
        .where(or(eq(bills.customerId, c.id), eq(bills.customerName, c.name)))
        .orderBy(desc(bills.createdAt))
        .limit(5);

      const recentPayments = await db
        .select({
          id: customerPayments.id,
          amount: customerPayments.amount,
          paymentMode: customerPayments.paymentMode,
          type: customerPayments.type,
          note: customerPayments.note,
          createdAt: customerPayments.createdAt,
        })
        .from(customerPayments)
        .where(eq(customerPayments.customerId, c.id))
        .orderBy(desc(customerPayments.createdAt))
        .limit(5);

      return {
        id: c.id,
        name: c.name,
        phone: c.phone || 'N/A',
        address: c.address || 'N/A',
        customerType: c.customerType || 'regular',
        outstandingBalance: parseFloat(c.outstandingBalance || '0') || 0,
        creditLimit: parseFloat(c.creditLimit || '0') || 0,
        totalPurchases: parseFloat(c.totalPurchases || '0') || 0,
        totalPaid: parseFloat(c.totalPaid || '0') || 0,
        recentBills: recentBills.map((b) => ({
          invoiceNumber: b.invoiceNumber,
          totalAmount: parseFloat(b.totalAmount) || 0,
          outstandingAmount: parseFloat(b.outstandingAmount || '0') || 0,
          status: b.status,
          date: b.createdAt
            ? new Date(b.createdAt).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })
            : 'N/A',
        })),
        recentPayments: recentPayments.map((p) => ({
          amount: parseFloat(p.amount) || 0,
          mode: p.paymentMode,
          note: p.note || '',
          date: p.createdAt
            ? new Date(p.createdAt).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })
            : 'N/A',
        })),
      };
    })
  );

  return {
    totalMatched: customerResults.length,
    customers: customerResults,
  };
}

/**
 * 8. getRecentBills
 * Returns recent bills with invoice numbers, amounts, customer names, and item counts.
 */
export async function getRecentBills(args?: { limit?: number } | number) {
  const rawLimit = typeof args === 'object' ? args.limit : args;
  const limitCount = rawLimit && rawLimit > 0 ? Math.min(rawLimit, 20) : 5;

  const recentBills = await db
    .select({
      id: bills.id,
      invoiceNumber: bills.invoiceNumber,
      billType: bills.billType,
      customerName: bills.customerName,
      customerPhone: bills.customerPhone,
      totalAmount: bills.totalAmount,
      discountAmount: bills.discountAmount,
      outstandingAmount: bills.outstandingAmount,
      paymentMode: bills.paymentMode,
      status: bills.status,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .orderBy(desc(bills.createdAt))
    .limit(limitCount);

  const billsWithItems = await Promise.all(
    recentBills.map(async (b) => {
      const items = await db
        .select({
          productName: billItems.productName,
          sizeName: billItems.sizeName,
          quantity: billItems.quantity,
          totalPrice: billItems.totalPrice,
        })
        .from(billItems)
        .where(eq(billItems.billId, b.id));

      return {
        invoiceNumber: b.invoiceNumber,
        customer: b.customerName || 'Walk-in Customer',
        phone: b.customerPhone || 'N/A',
        totalAmount: parseFloat(b.totalAmount) || 0,
        outstandingAmount: parseFloat(b.outstandingAmount || '0') || 0,
        paymentMode: b.paymentMode || 'Cash',
        status: b.status,
        itemCount: items.length,
        itemsSummary: items
          .map((i) => `${i.quantity}x ${i.productName} (${i.sizeName})`)
          .join(', '),
        date: b.createdAt
          ? new Date(b.createdAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'N/A',
      };
    })
  );

  return {
    count: billsWithItems.length,
    bills: billsWithItems,
  };
}

/**
 * 9. getBusinessSummary
 * Returns all-time totals: revenue, bill count, customer count, product count, total pending dues.
 */
export async function getBusinessSummary() {
  const [billStats, customerStats, productCount, inventoryStats] = await Promise.all([
    // All-time bill aggregates
    db
      .select({
        totalBills: count(),
        totalRevenue: sql<string>`COALESCE(SUM(CAST(${bills.totalAmount} AS NUMERIC)), 0)`,
        totalOutstanding: sql<string>`COALESCE(SUM(CAST(${bills.outstandingAmount} AS NUMERIC)), 0)`,
      })
      .from(bills),

    // Customer counts
    db
      .select({
        totalCustomers: count(),
        customersWithDue: sql<number>`COUNT(*) FILTER (WHERE CAST(${customers.outstandingBalance} AS NUMERIC) > 0)`,
      })
      .from(customers)
      .where(eq(customers.isActive, true)),

    // Product count
    db.select({ totalProducts: count() }).from(products),

    // Inventory summary
    db
      .select({
        totalSkus: count(),
        lowStockCount: sql<number>`COUNT(*) FILTER (WHERE ${inventory.currentStock} <= ${inventory.lowStockThreshold})`,
        outOfStockCount: sql<number>`COUNT(*) FILTER (WHERE ${inventory.currentStock} = 0)`,
      })
      .from(inventory),
  ]);

  const b = billStats[0];
  const c = customerStats[0];
  const p = productCount[0];
  const inv = inventoryStats[0];

  return {
    allTimeTotalRevenue: parseFloat(b?.totalRevenue ?? '0'),
    allTimeTotalBills: Number(b?.totalBills ?? 0),
    totalPendingDues: parseFloat(b?.totalOutstanding ?? '0'),
    totalActiveCustomers: Number(c?.totalCustomers ?? 0),
    customersWithOutstandingDue: Number(c?.customersWithDue ?? 0),
    totalProducts: Number(p?.totalProducts ?? 0),
    totalInventorySkus: Number(inv?.totalSkus ?? 0),
    lowStockSkus: Number(inv?.lowStockCount ?? 0),
    outOfStockSkus: Number(inv?.outOfStockCount ?? 0),
  };
}

/**
 * Tool Declarations for LLM Function Calling
 */
export const CHAT_TOOL_DEFINITIONS = [
  {
    name: 'getTodaySales',
    description:
      "Get today's total sales, number of bills, and payment-mode breakdown (in Asia/Kolkata timezone).",
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
  {
    name: 'getSalesByDateRange',
    description:
      'Get sales, total revenue, discount, and payment mode breakdown for a specific date or date range. If no dates are given, returns all-time totals.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        from: {
          type: 'STRING' as const,
          description: 'Start date in YYYY-MM-DD format (Asia/Kolkata timezone). Omit for all-time.',
        },
        to: {
          type: 'STRING' as const,
          description:
            'Optional end date in YYYY-MM-DD format. If omitted, queries only the "from" date.',
        },
      },
    },
  },
  {
    name: 'getStockLevels',
    description:
      'Get current inventory stock levels per product size and SKU. Can optionally search by brand or product name (e.g. Coca-Cola, Thums Up, Sprite).',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        productName: {
          type: 'STRING' as const,
          description:
            'Optional product name, brand, or category to filter by (e.g. "Coca-Cola", "Sprite", "Juice").',
        },
      },
    },
  },
  {
    name: 'getLowStockItems',
    description:
      'Get all products and SKUs currently at or below their reorder threshold / low stock limit.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
  {
    name: 'getCustomersWithDue',
    description:
      'Get all customers with pending/due balances, sorted from highest due amount to lowest.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
  {
    name: 'getCustomerDetails',
    description:
      "Get detailed information about a specific customer by name, including their phone, outstanding balance, credit limit, and recent bills.",
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        name: {
          type: 'STRING' as const,
          description: 'Customer name or partial name to search for (e.g. "Rahul", "Maa Tara").',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'getTopProducts',
    description:
      'Get top selling products ranked by revenue and quantity sold, optionally filtered by date range.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        from: {
          type: 'STRING' as const,
          description: 'Optional start date in YYYY-MM-DD format',
        },
        to: {
          type: 'STRING' as const,
          description: 'Optional end date in YYYY-MM-DD format',
        },
        limit: {
          type: 'INTEGER' as const,
          description: 'Number of top products to return (default is 5, max 20)',
        },
      },
    },
  },
  {
    name: 'getRecentBills',
    description:
      'Get recent bills/invoices with invoice numbers, customer names, total amounts, and purchased items.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        limit: {
          type: 'INTEGER' as const,
          description: 'Number of recent bills to fetch (default is 5, max 20)',
        },
      },
    },
  },
  {
    name: 'getBusinessSummary',
    description:
      'Get an all-time business overview: total revenue, bill count, customer count, product count, and total pending dues. Use this for general shop questions like "how is business" or "total sales".',
    parameters: {
      type: 'OBJECT' as const,
      properties: {},
    },
  },
];

export async function executeChatTool(
  name: string,
  args?: Record<string, unknown>
) {
  switch (name) {
    case 'getTodaySales':
      return await getTodaySales();
    case 'getSalesByDateRange':
      return await getSalesByDateRange(
        (args || {}) as { from?: string; to?: string }
      );
    case 'getStockLevels':
      return await getStockLevels(
        (args || {}) as { productName?: string }
      );
    case 'getLowStockItems':
      return await getLowStockItems();
    case 'getCustomersWithDue':
      return await getCustomersWithDue();
    case 'getCustomerDetails':
      return await getCustomerDetails(
        (args || {}) as { name: string }
      );
    case 'getTopProducts':
      return await getTopProducts(
        (args || {}) as { from?: string; to?: string; limit?: number }
      );
    case 'getRecentBills':
      return await getRecentBills(
        (args || {}) as { limit?: number }
      );
    case 'getBusinessSummary':
      return await getBusinessSummary();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

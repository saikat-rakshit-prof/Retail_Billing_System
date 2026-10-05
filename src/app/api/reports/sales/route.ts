import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bills, billItems, products, productSizes } from '@/lib/db/schema';
import { sql, eq, and, gte, lte } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDateStr = searchParams.get('from');
    const toDateStr = searchParams.get('to');

    let dateConditions = [];
    if (fromDateStr) {
      dateConditions.push(gte(bills.createdAt, new Date(fromDateStr)));
    }
    if (toDateStr) {
      const toDate = new Date(toDateStr);
      toDate.setHours(23, 59, 59, 999);
      dateConditions.push(lte(bills.createdAt, toDate));
    }

    // Fetch bills
    const allBills = await db.select().from(bills).where(
      dateConditions.length > 0 ? and(...dateConditions) : undefined
    );

    // Fetch bill items for these bills
    const billIds = allBills.map(b => b.id);
    let allItems: any[] = [];
    
    if (billIds.length > 0) {
      // Chunking if necessary, but assume manageable for now or we can just fetch all items and filter in memory
      // Actually we can just do a join or fetch all items and filter since it's a small app
      const itemsQuery = await db.select({
        id: billItems.id,
        billId: billItems.billId,
        productName: billItems.productName,
        sizeName: billItems.sizeName,
        quantity: billItems.quantity,
        totalPrice: billItems.totalPrice,
      }).from(billItems);
      
      allItems = itemsQuery.filter(item => billIds.includes(item.billId));
    }

    // Also we need categories and brands.
    const allProducts = await db.select({
      name: products.name,
      category: products.category,
      brand: products.brand
    }).from(products);

    const productCategoryMap = new Map<string, string>();
    const productBrandMap = new Map<string, string>();
    allProducts.forEach(p => {
      productCategoryMap.set(p.name, p.category);
      productBrandMap.set(p.name, p.brand);
    });

    let totalRevenue = 0;
    
    const productStats = new Map<string, { name: string, size: string, qty: number, revenue: number, category: string }>();
    const categoryStats = new Map<string, { category: string, qty: number, revenue: number }>();
    const brandStats = new Map<string, { brand: string, qty: number, revenue: number }>();
    const sizeStats = new Map<string, { size: string, qty: number, revenue: number }>();

    allBills.forEach(bill => {
      totalRevenue += parseFloat(bill.totalAmount as string) || 0;
    });

    allItems.forEach(item => {
      const qty = item.quantity;
      const rev = parseFloat(item.totalPrice as string) || 0;
      const pName = item.productName;
      const sName = item.sizeName;
      const pKey = `${pName} | ${sName}`;

      // Category stats
      const cat = productCategoryMap.get(pName) || 'Others';
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, { category: cat, qty: 0, revenue: 0 });
      }
      const cStat = categoryStats.get(cat)!;
      cStat.qty += qty;
      cStat.revenue += rev;

      // Product stats
      if (!productStats.has(pKey)) {
        productStats.set(pKey, { name: pName, size: sName, qty: 0, revenue: 0, category: cat });
      }
      const pStat = productStats.get(pKey)!;
      pStat.qty += qty;
      pStat.revenue += rev;

      // Brand stats
      const brand = productBrandMap.get(pName) || 'Unknown';
      if (!brandStats.has(brand)) {
        brandStats.set(brand, { brand, qty: 0, revenue: 0 });
      }
      const bStat = brandStats.get(brand)!;
      bStat.qty += qty;
      bStat.revenue += rev;

      // Size stats
      if (!sizeStats.has(sName)) {
        sizeStats.set(sName, { size: sName, qty: 0, revenue: 0 });
      }
      const sStat = sizeStats.get(sName)!;
      sStat.qty += qty;
      sStat.revenue += rev;
    });

    const totalBills = allBills.length;
    const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const categoryBreakdown = Array.from(categoryStats.values())
      .sort((a, b) => b.revenue - a.revenue);

    const brandBreakdown = Array.from(brandStats.values())
      .sort((a, b) => b.revenue - a.revenue);

    const sizeBreakdown = Array.from(sizeStats.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    return NextResponse.json({
      totalRevenue,
      totalBills,
      avgBillValue,
      itemsSold: allItems.reduce((acc, item) => acc + item.quantity, 0),
      topProducts,
      allProductsStats: Array.from(productStats.values()),
      categoryBreakdown,
      brandBreakdown,
      sizeBreakdown,
    });
  } catch (error) {
    console.error('Error in sales report API:', error);
    return NextResponse.json({ error: 'Failed to fetch sales reports' }, { status: 500 });
  }
}

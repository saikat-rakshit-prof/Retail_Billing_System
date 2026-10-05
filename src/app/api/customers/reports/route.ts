import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customers, bills } from '@/lib/db/schema';
import { eq, sql, desc, and, gte, lte, count, gt } from 'drizzle-orm';

// GET - Customer analytics data
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    console.log('🔄 Generating customer reports:', { dateFrom, dateTo });

    // Build date filter
    let dateFilter: any = undefined;
    if (dateFrom && dateTo) {
      dateFilter = and(
        gte(bills.createdAt, new Date(dateFrom)),
        lte(bills.createdAt, new Date(dateTo))
      );
    } else if (dateFrom) {
      dateFilter = gte(bills.createdAt, new Date(dateFrom));
    } else if (dateTo) {
      dateFilter = lte(bills.createdAt, new Date(dateTo));
    }

    // 1. Get all customers with their bill data
    const allCustomers = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        customerType: customers.customerType,
        totalPurchases: customers.totalPurchases,
        totalPaid: customers.totalPaid,
        outstandingBalance: customers.outstandingBalance,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.isActive, true));

    // Get bill counts and totals for each customer
    const customerBillData = await Promise.all(
      allCustomers.map(async (customer) => {
        let billConditions: any[] = [eq(bills.customerId, customer.id)];
        if (dateFilter) billConditions.push(dateFilter);

        const customerBills = await db
          .select({
            totalAmount: bills.totalAmount,
            createdAt: bills.createdAt,
          })
          .from(bills)
          .where(and(...billConditions));

        const totalBills = customerBills.length;
        const totalAmount = customerBills.reduce((sum, b) => sum + parseFloat(b.totalAmount || '0'), 0);

        return {
          ...customer,
          totalBills,
          totalAmount,
          totalPurchases: parseFloat(customer.totalPurchases || '0') || 0,
          totalPaid: parseFloat(customer.totalPaid || '0') || 0,
          outstandingBalance: parseFloat(customer.outstandingBalance || '0') || 0,
        };
      })
    );

    // 2. Top 10 customers by purchase amount
    const topByPurchase = [...customerBillData]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalAmount: c.totalAmount,
        totalBills: c.totalBills,
      }));

    // 3. Top 10 customers by bill count
    const topByBillCount = [...customerBillData]
      .sort((a, b) => b.totalBills - a.totalBills)
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalBills: c.totalBills,
        totalAmount: c.totalAmount,
      }));

    // 4. Customers with highest outstanding balance
    const topByOutstanding = [...customerBillData]
      .filter((c) => c.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        outstandingBalance: c.outstandingBalance,
      }));

    // 5. Revenue breakdown by customer type
    const revenueByType: Record<string, number> = {
      regular: 0,
      seasonal: 0,
      retail: 0,
      wholesale: 0,
    };

    customerBillData.forEach((c) => {
      const type = c.customerType || 'regular';
      if (revenueByType[type] !== undefined) {
        revenueByType[type] += c.totalAmount;
      } else {
        revenueByType.regular += c.totalAmount;
      }
    });

    const revenueBreakdown = Object.entries(revenueByType).map(([type, revenue]) => ({
      type,
      revenue,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    }));

    // 6. Monthly new customer acquisition
    const allTimeCustomers = await db
      .select({ createdAt: customers.createdAt })
      .from(customers)
      .where(eq(customers.isActive, true));

    // Group by month
    const monthlyAcquisition: Record<string, number> = {};
    allTimeCustomers.forEach((c) => {
      if (!c.createdAt) return;
      const date = new Date(c.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyAcquisition[monthKey] = (monthlyAcquisition[monthKey] || 0) + 1;
    });

    const sortedMonths = Object.entries(monthlyAcquisition)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12); // Last 12 months

    const newCustomerAcquisition = sortedMonths.map(([month, count]) => ({
      month,
      count,
      label: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    }));

    // 7. Customer retention rate (customers who bought more than once)
    const repeatCustomers = customerBillData.filter((c) => c.totalBills > 1).length;
    const totalCustomersWithBills = customerBillData.filter((c) => c.totalBills > 0).length;
    const retentionRate = totalCustomersWithBills > 0 
      ? (repeatCustomers / totalCustomersWithBills) * 100 
      : 0;

    console.log('✅ Reports generated');
    return NextResponse.json({
      topByPurchase,
      topByBillCount,
      topByOutstanding,
      revenueBreakdown,
      newCustomerAcquisition,
      retentionRate: Math.round(retentionRate * 10) / 10,
      totalCustomers: allCustomers.length,
      totalOutstanding: customerBillData.reduce((sum, c) => sum + c.outstandingBalance, 0),
      totalRevenue: customerBillData.reduce((sum, c) => sum + c.totalAmount, 0),
    });
  } catch (error) {
    console.error('❌ Customer reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

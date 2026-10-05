import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customers, bills } from '@/lib/db/schema';
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm';
import { CustomerType } from '@/types';

// Helper to parse customer
function parseCustomerReport(customer: any, totalBills: number, lastPurchaseDate: string | null) {
  return {
    name: customer.name,
    phone: customer.phone || '',
    email: customer.email || '',
    address: customer.address || '',
    customerType: customer.customerType,
    totalPurchases: parseFloat(customer.totalPurchases || '0') || 0,
    totalPaid: parseFloat(customer.totalPaid || '0') || 0,
    outstandingBalance: parseFloat(customer.outstandingBalance || '0') || 0,
    totalBills,
    lastPurchaseDate: lastPurchaseDate || '',
    memberSince: customer.createdAt,
  };
}

// GET - Export customers as CSV
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const type = searchParams.get('type') as CustomerType | 'all';

    console.log('🔄 Exporting customers:', { format, dateFrom, dateTo, type });

    // Build where conditions
    const whereConditions: any[] = [eq(customers.isActive, true)];

    // Filter by customer type
    if (type && type !== 'all') {
      whereConditions.push(eq(customers.customerType, type));
    }

    // Get all customers with filters
    const allCustomers = await db
      .select()
      .from(customers)
      .where(and(...whereConditions));

    // Get bill data for each customer
    const customersWithReports = await Promise.all(
      allCustomers.map(async (customer) => {
        // Get bills
        let billConditions: any[] = [eq(bills.customerId, customer.id)];
        
        if (dateFrom) {
          billConditions.push(gte(bills.createdAt, new Date(dateFrom)));
        }
        if (dateTo) {
          billConditions.push(lte(bills.createdAt, new Date(dateTo)));
        }

        const customerBills = await db
          .select({ totalAmount: bills.totalAmount, createdAt: bills.createdAt })
          .from(bills)
          .where(and(...billConditions))
          .orderBy(desc(bills.createdAt));

        const totalBills = customerBills.length;
        const lastPurchaseDate = customerBills[0]?.createdAt 
          ? new Date(customerBills[0].createdAt).toISOString() 
          : null;

        return parseCustomerReport(customer, totalBills, lastPurchaseDate);
      })
    );

    // Filter by outstanding balance if needed (for "with outstanding balance" export)
    // This will be handled by the UI by calling with appropriate type

    console.log('✅ Customers exported:', customersWithReports.length);
    return NextResponse.json(customersWithReports);
  } catch (error) {
    console.error('❌ Customer export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

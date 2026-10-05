import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customers, bills, customerPayments } from '@/lib/db/schema';
import { sql, eq, desc, count, max } from 'drizzle-orm';
import { CustomerType } from '@/types';

// Helper to parse decimal fields
function parseCustomer(customer: any) {
  return {
    ...customer,
    totalPurchases: parseFloat(customer.totalPurchases) || 0,
    totalPaid: parseFloat(customer.totalPaid) || 0,
    outstandingBalance: parseFloat(customer.outstandingBalance) || 0,
  };
}

// GET - All customers with stats
export async function GET() {
  try {
    console.log('🔄 Fetching customers...');

    // Single query: all active customers
    const allCustomers = await db
      .select()
      .from(customers)
      .where(eq(customers.isActive, true))
      .orderBy(desc(customers.createdAt));

    // Single bulk query: aggregate bill stats per customer (eliminates N+1)
    const billStats = await db
      .select({
        customerId: bills.customerId,
        totalBills: count(),
        totalAmount: sql<string>`COALESCE(SUM(${bills.totalAmount}::numeric), 0)`,
        lastPurchaseDate: max(bills.createdAt),
      })
      .from(bills)
      .groupBy(bills.customerId);

    // Build a lookup map: customerId -> stats
    const statsMap = new Map(
      billStats.map((s) => [
        s.customerId,
        {
          totalBills: Number(s.totalBills),
          totalAmount: parseFloat(s.totalAmount as string) || 0,
          lastPurchaseDate: s.lastPurchaseDate ?? null,
        },
      ])
    );

    const customersWithStats = allCustomers.map((customer) => {
      const stats = statsMap.get(customer.id) ?? {
        totalBills: 0,
        totalAmount: 0,
        lastPurchaseDate: null,
      };
      const averageBillValue =
        stats.totalBills > 0 ? stats.totalAmount / stats.totalBills : 0;
      return {
        ...parseCustomer(customer),
        totalBills: stats.totalBills,
        averageBillValue,
        lastPurchaseDate: stats.lastPurchaseDate,
      };
    });

    console.log('✅ Customers fetched:', customersWithStats.length);
    return NextResponse.json(customersWithStats);
  } catch (error) {
    console.error('❌ Customers API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Create customer
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, address, notes, customerType } = body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    // Check phone uniqueness if provided
    if (phone) {
      const existingCustomer = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phone));

      if (existingCustomer.length > 0) {
        return NextResponse.json(
          { error: 'A customer with this phone number already exists' },
          { status: 400 }
        );
      }
    }

    console.log('🔄 Creating customer:', name);

    const [newCustomer] = await db
      .insert(customers)
      .values({
        name: name.trim(),
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
        customerType: customerType || 'regular',
      })
      .returning();

    console.log('✅ Customer created:', newCustomer.id);
    return NextResponse.json(parseCustomer(newCustomer), { status: 201 });
  } catch (error) {
    console.error('❌ Customer creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

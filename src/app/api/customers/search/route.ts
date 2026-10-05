import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { eq, ilike, or, and } from 'drizzle-orm';

// GET - Search customers by name or phone
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json([]);
    }

    console.log('🔄 Searching customers:', query);

    // Search by name or phone for active customers
    const searchTerm = `%${query.trim()}%`;
    
    const results = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        customerType: customers.customerType,
        outstandingBalance: customers.outstandingBalance,
      })
      .from(customers)
      .where(
        and(
          eq(customers.isActive, true),
          or(
            ilike(customers.name, searchTerm),
            ilike(customers.phone, searchTerm)
          )
        )
      )
      .limit(20);

    // Parse outstanding balance
    const customersWithSummary = results.map((c) => ({
      ...c,
      outstandingBalance: parseFloat(c.outstandingBalance || '0') || 0,
    }));

    console.log('✅ Search results:', customersWithSummary.length);
    return NextResponse.json(customersWithSummary);
  } catch (error) {
    console.error('❌ Customer search error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

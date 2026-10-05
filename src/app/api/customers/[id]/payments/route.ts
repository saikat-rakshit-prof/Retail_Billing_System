import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customers, customerPayments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Helper to parse decimal fields
function parsePayment(payment: any) {
  return {
    ...payment,
    amount: parseFloat(payment.amount) || 0,
  };
}

// GET - All payments for customer
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Fetching payments for customer:', id);

    // Get payments
    const payments = await db
      .select()
      .from(customerPayments)
      .where(eq(customerPayments.customerId, id))
      .orderBy(desc(customerPayments.createdAt));

    console.log('✅ Payments fetched:', payments.length);
    return NextResponse.json(payments.map(parsePayment));
  } catch (error) {
    console.error('❌ Payments fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Record payment, update outstandingBalance
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, paymentMode, type, note, billId } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Recording payment for customer:', id, 'amount:', amount);

    // Check if customer exists
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Parse current values
    const currentTotalPaid = parseFloat(customer.totalPaid || '0');
    const currentOutstanding = parseFloat(customer.outstandingBalance || '0');

    // Calculate new values based on payment type
    let newTotalPaid = currentTotalPaid;
    let newOutstanding = currentOutstanding;

    if (type === 'payment') {
      // Payment reduces outstanding balance
      newTotalPaid = currentTotalPaid + amount;
      newOutstanding = Math.max(0, currentOutstanding - amount);
    } else if (type === 'refund') {
      // Refund: customer gets money back
      // First reduce from outstanding (if any), rest goes to reducing totalPaid
      if (currentOutstanding > 0) {
        // Customer had outstanding - refund reduces it
        const outstandingReduction = Math.min(currentOutstanding, amount);
        newOutstanding = currentOutstanding - outstandingReduction;
        // Rest of refund reduces totalPaid
        newTotalPaid = currentTotalPaid - (amount - outstandingReduction);
      } else {
        // Customer had no outstanding - refund reduces totalPaid (money back to customer)
        newTotalPaid = Math.max(0, currentTotalPaid - amount);
      }
    } else if (type === 'credit') {
      // Credit is like a purchase on account - increases outstanding
      newOutstanding = currentOutstanding + amount;
      newTotalPaid = currentTotalPaid; // No payment made
    }

    // Create payment record
    const [newPayment] = await db
      .insert(customerPayments)
      .values({
        customerId: id,
        amount: amount.toString(),
        paymentMode: paymentMode || 'Cash',
        type: type || 'payment',
        note: note || null,
        billId: billId || null,
      })
      .returning();

    // Update customer totals
    await db
      .update(customers)
      .set({
        totalPaid: newTotalPaid.toString(),
        outstandingBalance: newOutstanding.toString(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id));

    console.log('✅ Payment recorded:', newPayment.id);
    return NextResponse.json(parsePayment(newPayment), { status: 201 });
  } catch (error) {
    console.error('❌ Payment recording error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

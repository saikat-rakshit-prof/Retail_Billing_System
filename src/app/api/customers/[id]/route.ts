import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customers, customerPayments, bills } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

// Helper to parse decimal fields
function parseCustomer(customer: any) {
  return {
    ...customer,
    totalPurchases: parseFloat(customer.totalPurchases) || 0,
    totalPaid: parseFloat(customer.totalPaid) || 0,
    outstandingBalance: parseFloat(customer.outstandingBalance) || 0,
  };
}

function parsePayment(payment: any) {
  return {
    ...payment,
    amount: parseFloat(payment.amount) || 0,
  };
}

// GET - Single customer with full details and payment history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Fetching customer:', id);

    // Get customer
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

    // Get payment history
    const payments = await db
      .select()
      .from(customerPayments)
      .where(eq(customerPayments.customerId, id))
      .orderBy(desc(customerPayments.createdAt));

    // Get bill history
    const customerBills = await db
      .select()
      .from(bills)
      .where(eq(bills.customerId, id))
      .orderBy(desc(bills.createdAt));

    // Parse customer
    const parsedCustomer = parseCustomer(customer);

    console.log('✅ Customer fetched:', id);
    return NextResponse.json({
      ...parsedCustomer,
      payments: payments.map(parsePayment),
      bills: customerBills.map((b) => ({
        ...b,
        totalAmount: parseFloat(b.totalAmount || '0') || 0,
        subtotal: parseFloat(b.subtotal || '0') || 0,
        discountAmount: parseFloat(b.discountAmount || '0') || 0,
      })),
    });
  } catch (error) {
    console.error('❌ Customer fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Update customer
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, email, address, notes, customerType, isActive } = body;

    console.log('🔄 Updating customer:', id);

    // Check if customer exists
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check phone uniqueness if changing
    if (phone && phone !== existingCustomer.phone) {
      const duplicatePhone = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phone));

      if (duplicatePhone.length > 0) {
        return NextResponse.json(
          { error: 'A customer with this phone number already exists' },
          { status: 400 }
        );
      }
    }

    // Update customer
    const [updatedCustomer] = await db
      .update(customers)
      .set({
        ...(name && { name: name.trim() }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(customerType && { customerType }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();

    console.log('✅ Customer updated:', id);
    return NextResponse.json(parseCustomer(updatedCustomer));
  } catch (error) {
    console.error('❌ Customer update error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH - Update customer (Alias to PUT)
export const PATCH = PUT;

// DELETE - Hard delete after balance check
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 Deleting customer:', id);

    // Check if customer exists
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (parseFloat(existingCustomer.outstandingBalance as any) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer with outstanding balance' },
        { status: 400 }
      );
    }

    // Manually handle foreign key dependencies to ensure safe deletion
    await db.delete(customerPayments).where(eq(customerPayments.customerId, id));
    await db.update(bills).set({ customerId: null }).where(eq(bills.customerId, id));

    // Hard delete
    await db.delete(customers).where(eq(customers.id, id));

    console.log('✅ Customer deleted:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Customer delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bills, customers, customerPayments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const billId = params.id;
    const body = await request.json();
    const { amount, paymentMode, customerId } = body;
    
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    
    const [bill] = await db.select().from(bills).where(eq(bills.id, billId));
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }
    
    const previousCashReceived = parseFloat(bill.cashReceived || '0');
    const totalAmount = parseFloat(bill.totalAmount || '0');
    
    const newPaidAmount = previousCashReceived + amount;
    const newStatus = newPaidAmount >= totalAmount ? 'paid' : 'partially_paid';
    const newOutstanding = Math.max(0, totalAmount - newPaidAmount);
    
    await db.transaction(async (tx) => {
      await tx.update(bills)
        .set({
          cashReceived: newPaidAmount.toString(),
          paymentMode,
          status: newStatus,
          outstandingAmount: newOutstanding.toString()
        })
        .where(eq(bills.id, billId));
        
      if (customerId) {
        await tx.insert(customerPayments).values({
          customerId,
          billId,
          amount: amount.toString(),
          paymentMode,
          type: 'payment',
          note: `Payment for ${bill.invoiceNumber}`
        });
        
        const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId));
        if (customer) {
          const currentOutstanding = parseFloat(customer.outstandingBalance || '0');
          const currentPaid = parseFloat(customer.totalPaid || '0');
          await tx.update(customers)
            .set({
              outstandingBalance: Math.max(0, currentOutstanding - amount).toString(),
              totalPaid: (currentPaid + amount).toString(),
              updatedAt: new Date()
            })
            .where(eq(customers.id, customerId));
        }
      }
    });
    
    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Error processing payment:', error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}

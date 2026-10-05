import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bills, billItems, invoiceCounter, inventory, stockHistory, productSizes, products, customers, customerPayments } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';

// Helper to parse PostgreSQL decimal strings to numbers
function parseBill(bill: any) {
  return {
    ...bill,
    subtotal: parseFloat(bill.subtotal) || 0,
    discountValue: parseFloat(bill.discountValue) || 0,
    discountAmount: parseFloat(bill.discountAmount) || 0,
    totalAmount: parseFloat(bill.totalAmount) || 0,
    cashReceived: bill.cashReceived ? parseFloat(bill.cashReceived) : null,
    changeGiven: bill.changeGiven ? parseFloat(bill.changeGiven) : null,
    outstandingAmount: bill.outstandingAmount ? parseFloat(bill.outstandingAmount) : 0,
  };
}

function parseBillItem(item: any) {
  return {
    ...item,
    // Map database field to frontend expected field
    sizeId: item.productSizeId || item.sizeId,
    unitPrice: parseFloat(item.unitPrice) || 0,
    totalPrice: parseFloat(item.totalPrice) || 0,
  };
}

export async function GET() {
  try {
    console.log('🔄 Fetching bills...');
    
    // Get all bills ordered by date
    const allBills = await db.select().from(bills);
    console.log('📄 Bills count:', allBills.length);
    
    // Get all bill items in one query
    const allItems = await db.select().from(billItems);
    console.log('📋 Bill items count:', allItems.length);
    
    // Get all customer payments
    const allPayments = await db.select().from(customerPayments);
    
    // Map items and payments to bills in memory, parsing numeric fields
    const billsWithItems = allBills
      .map(bill => {
        const items = allItems
          .filter(item => item.billId === bill.id)
          .map(parseBillItem);
        const payments = allPayments
          .filter(p => p.billId === bill.id)
          .map(p => ({
            ...p,
            amount: parseFloat(p.amount as string) || 0
          }));
        return { ...parseBill(bill), items, payments };
      })
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    console.log('✅ Bills fetched successfully');
    return NextResponse.json(billsWithItems);
  } catch (error) {
    console.error('❌ Bills API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerId,
      billType = 'sale',
      items,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      totalAmount,
      paymentMode,
      cashReceived,
      changeGiven,
      deliveryDate,
    } = body;
    
    console.log('🔄 Creating bill...', 'Type:', billType);
    console.log('📝 Bill items:', JSON.stringify(items, null, 2));
    
    // Ensure invoice counter exists
    const existingCounter = await db.select().from(invoiceCounter).where(eq(invoiceCounter.id, 1));
    if (existingCounter.length === 0) {
      await db.insert(invoiceCounter).values({ id: 1, lastNumber: 0 });
    }
    
    // Get current counter and increment atomically
    const [counter] = await db.update(invoiceCounter)
      .set({ lastNumber: sql`last_number + 1` })
      .where(eq(invoiceCounter.id, 1))
      .returning({ lastNumber: invoiceCounter.lastNumber });
    
    const currentCount = counter?.lastNumber || 1;
    const invoiceNumber = `INV-${String(currentCount).padStart(4, '0')}`;
    
    // Create bill
    // Determine bill status based on payment
    const cashReceivedNum = cashReceived ? parseFloat(cashReceived) : 0;
    const totalAmountNum = parseFloat(totalAmount) || 0;
    const roundedTotal = Math.round(totalAmountNum);
    const dueAmount = roundedTotal - cashReceivedNum;
    
    let billStatus: 'paid' | 'partially_paid' | 'pending' = 'paid';
    let outstandingBalance = 0;
    
    // Handle payment status calculation
    if (dueAmount <= 0) {
      // Fully paid
      billStatus = 'paid';
      outstandingBalance = 0;
    } else if (dueAmount > 0 && cashReceivedNum > 0) {
      // Partially paid (regardless of payment mode)
      billStatus = 'partially_paid';
      outstandingBalance = dueAmount;
    } else if (paymentMode === 'Credit') {
      // No payment and Credit mode = full due
      billStatus = 'pending';
      outstandingBalance = dueAmount;
    } else {
      // No payment and non-Credit mode
      billStatus = 'pending';
      outstandingBalance = dueAmount;
    }
    
    const [newBill] = await db.insert(bills).values({
      invoiceNumber,
      billType,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerId: customerId || null,
      subtotal: subtotal.toString(),
      discountType: discountType || 'percentage',
      discountValue: discountValue?.toString() || '0',
      discountAmount: discountAmount?.toString() || '0',
      totalAmount: totalAmount.toString(),
      paymentMode: paymentMode || 'Cash',
      cashReceived: cashReceived?.toString() || null,
      changeGiven: changeGiven?.toString() || null,
      outstandingAmount: outstandingBalance.toString(),
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      status: billStatus,
    }).returning();
    
    // Create bill items
    const newItems = await db.insert(billItems).values(
      items.map((item: { productId: string; sizeId: string; productName: string; sizeName: string; packaging: string; quantity: number; unitPrice: number; totalPrice: number }) => ({
        billId: newBill.id,
        productSizeId: item.sizeId || null,
        productName: item.productName,
        sizeName: item.sizeName,
        packaging: item.packaging,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
      }))
    ).returning();
    
    console.log('✅ Bill created:', invoiceNumber);
    
    // ========================================
    // STOCK DEDUCTION LOGIC (bulk, not per-item)
    // ========================================
    const sizeIds = items
      .map((item: { sizeId: string }) => item.sizeId)
      .filter(Boolean) as string[];

    if (sizeIds.length > 0) {
      // Bulk fetch: all relevant inventory rows in ONE query
      const { inArray } = await import('drizzle-orm');
      const [invRows, sizeRows] = await Promise.all([
        db.select().from(inventory).where(inArray(inventory.productSizeId, sizeIds)),
        db.select().from(productSizes).where(inArray(productSizes.id, sizeIds)),
      ]);

      // Build lookup maps
      const invMap = new Map(invRows.map((r) => [r.productSizeId, r]));
      const sizeMap = new Map(sizeRows.map((r) => [r.id, r]));

      // Validate all items first before touching the DB
      const deductions: Array<{
        invItem: typeof invRows[0];
        sizeInfo: typeof sizeRows[0];
        bottlesToDeduct: number;
        newStock: number;
        newStatus: 'Healthy' | 'Low Stock' | 'Out of Stock';
        item: typeof items[0];
      }> = [];

      for (const item of items) {
        if (!item.sizeId) {
          console.warn('⚠️ No sizeId for item, skipping stock deduction:', item.productName);
          continue;
        }

        const invItem = invMap.get(item.sizeId);
        if (!invItem) {
          console.warn('⚠️ No inventory found for sizeId:', item.sizeId);
          continue;
        }

        const sizeInfo = sizeMap.get(item.sizeId);
        if (!sizeInfo) {
          console.warn('⚠️ No size info found for sizeId:', item.sizeId);
          continue;
        }

        const isCarton = item.packaging?.toLowerCase() === 'carton';
        const bottlesPerCarton = sizeInfo.bottlesPerCarton || 12;
        const bottlesToDeduct = isCarton ? item.quantity * bottlesPerCarton : item.quantity;
        const newStock = invItem.currentStock - bottlesToDeduct;

        if (newStock < 0) {
          // Rollback the bill
          await db.delete(billItems).where(eq(billItems.billId, newBill.id));
          await db.delete(bills).where(eq(bills.id, newBill.id));
          console.error('❌ Insufficient stock for:', item.productName, item.sizeName);
          return NextResponse.json(
            { error: `Insufficient stock for ${item.productName} (${item.sizeName}). Available: ${invItem.currentStock}, Requested: ${bottlesToDeduct}` },
            { status: 400 }
          );
        }

        let newStatus: 'Healthy' | 'Low Stock' | 'Out of Stock' = 'Healthy';
        if (newStock <= 0) newStatus = 'Out of Stock';
        else if (newStock <= (invItem.lowStockThreshold || 50)) newStatus = 'Low Stock';

        deductions.push({ invItem, sizeInfo, bottlesToDeduct, newStock, newStatus, item });
      }

      // Apply all updates in parallel (one UPDATE + one INSERT per item, concurrently)
      await Promise.all(
        deductions.map(async ({ invItem, sizeInfo, bottlesToDeduct, newStock, newStatus, item }) => {
          await db.update(inventory)
            .set({ currentStock: newStock, status: newStatus, updatedAt: new Date() })
            .where(eq(inventory.id, invItem.id));

          await db.insert(stockHistory).values({
            inventoryId: invItem.id,
            productId: sizeInfo.productId,
            type: 'sale',
            quantity: bottlesToDeduct,
            previousStock: invItem.currentStock,
            newStock,
            billId: newBill.id,
            note: `Sale: ${item.quantity} ${item.packaging}(s) of ${item.productName} ${item.sizeName}`,
          });

          console.log(
            '✅ Stock deducted:',
            item.productName, item.sizeName,
            '-', bottlesToDeduct, 'bottles.',
            'Stock:', invItem.currentStock, '->', newStock
          );
        })
      );
    }
    
    // ========================================
    // CUSTOMER STATS UPDATE (in transaction)
    // ========================================
    if (customerId) {
      try {
        // Use transaction to ensure bill + customer stats are consistent
        await db.transaction(async (tx) => {
          // Find the customer
          const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId));
          
          if (customer) {
            // Parse current values
            const currentTotalPurchases = parseFloat(customer.totalPurchases || '0') || 0;
            const currentOutstanding = parseFloat(customer.outstandingBalance || '0') || 0;
            const currentTotalPaid = parseFloat(customer.totalPaid || '0') || 0;
            
            // Calculate new values
            const newTotalPurchases = currentTotalPurchases + totalAmountNum;
            let newOutstanding = currentOutstanding;
            let newTotalPaid = currentTotalPaid;
            
            // Handle payment types
            // For orders with advance payment (billType='order' and cashReceived > 0)
            if (billType === 'order' && cashReceivedNum > 0) {
              // Order with advance payment - advance goes to totalPaid, rest to outstanding
              newTotalPaid = currentTotalPaid + cashReceivedNum;
              newOutstanding = currentOutstanding + outstandingBalance;
            } else if (paymentMode === 'Credit') {
              // Full credit - add full amount to outstanding
              newOutstanding = currentOutstanding + roundedTotal;
            } else if (cashReceivedNum > 0) {
              // Partial payment - add outstanding balance
              newOutstanding = currentOutstanding + outstandingBalance;
              newTotalPaid = currentTotalPaid + cashReceivedNum;
            } else {
              // No payment made - full outstanding
              newOutstanding = currentOutstanding + roundedTotal;
            }
            
            // Update customer stats
            await tx.update(customers)
              .set({
                totalPurchases: newTotalPurchases.toString(),
                outstandingBalance: newOutstanding.toString(),
                totalPaid: newTotalPaid.toString(),
                updatedAt: new Date(),
              })
              .where(eq(customers.id, customerId));
            
            // Create customer payment record
            await tx.insert(customerPayments).values({
              customerId: customerId,
              amount: cashReceived?.toString() || '0',
              paymentMode: paymentMode === 'Credit' ? 'Credit' : paymentMode,
              type: paymentMode === 'Credit' ? 'credit' : (cashReceivedNum < totalAmountNum ? 'payment' : 'payment'),
              note: `Bill #${invoiceNumber}${outstandingBalance > 0 ? ` (Outstanding: ₹${outstandingBalance})` : ''}`,
              billId: newBill.id,
            });
            
            console.log('✅ Customer stats updated for:', customer.name, '- Outstanding:', newOutstanding);
          }
        });
      } catch (error) {
        console.error('❌ Failed to update customer stats:', error);
        // Don't fail the bill if customer update fails
      }
    }
    
    // ========================================
    // CACHE INVALIDATION
    // ========================================
    console.log('✅ Stock deduction completed for all items');
    
    return NextResponse.json({
      ...newBill,
      items: newItems,
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Bill creation error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

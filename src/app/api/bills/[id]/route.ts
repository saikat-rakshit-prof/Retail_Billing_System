import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bills, billItems, inventory, stockHistory, productSizes, customers, customerPayments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Helper to parse bill item for frontend
function parseBillItem(item: any) {
  return {
    ...item,
    // Map database field to frontend expected field
    sizeId: item.productSizeId || item.sizeId,
    unitPrice: parseFloat(item.unitPrice) || 0,
    totalPrice: parseFloat(item.totalPrice) || 0,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [bill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, id));
    
    if (!bill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    const items = await db
      .select()
      .from(billItems)
      .where(eq(billItems.billId, id));
    
    return NextResponse.json({ 
      ...bill, 
      items: items.map(parseBillItem)
    });
  } catch (error) {
    console.error('❌ Bill fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log('🔄 Updating bill:', id, body);
    
    // Check if bill exists
    const [existingBill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, id));
    
    if (!existingBill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };
    
    if (body.status !== undefined) {
      updates.status = body.status;
    }
    
    if (body.cashReceived !== undefined) {
      updates.cashReceived = body.cashReceived.toString();
    }
    
    if (body.totalAmount !== undefined) {
      updates.totalAmount = body.totalAmount.toString();
    }
    
    if (body.outstandingAmount !== undefined) {
      updates.outstandingAmount = body.outstandingAmount.toString();
    }
    
    if (body.deliveryDate !== undefined) {
      updates.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
    }
    
    // Update bill
    const [updatedBill] = await db
      .update(bills)
      .set(updates)
      .where(eq(bills.id, id))
      .returning();
    
    console.log('✅ Bill updated:', id);
    
    // If status is 'returned', restore stock
    if (body.status === 'returned') {
      const items = await db
        .select()
        .from(billItems)
        .where(eq(billItems.billId, id));
      
      for (const item of items) {
        if (item.productSizeId) {
          const [invItem] = await db
            .select()
            .from(inventory)
            .where(eq(inventory.productSizeId, item.productSizeId));
          
          if (invItem) {
            const isCarton = item.packaging?.toLowerCase() === 'carton';
            const [sizeInfo] = await db
              .select()
              .from(productSizes)
              .where(eq(productSizes.id, item.productSizeId));
            
            const bottlesPerCarton = sizeInfo?.bottlesPerCarton || 12;
            const quantityToAdd = isCarton ? item.quantity * bottlesPerCarton : item.quantity;
            
            const previousStock = invItem.currentStock;
            const newStock = previousStock + quantityToAdd;
            
            await db
              .update(inventory)
              .set({ currentStock: newStock })
              .where(eq(inventory.id, invItem.id));
            
            // Add stock history
            await db.insert(stockHistory).values({
              inventoryId: invItem.id,
              productId: sizeInfo?.productId,
              type: 'addition',
              quantity: quantityToAdd,
              previousStock,
              newStock,
              billId: id,
              note: `Return for order: ${existingBill.invoiceNumber}`,
            });
            
            console.log('✅ Stock restored:', item.productName, '-', quantityToAdd, 'bottles');
          }
        }
      }
    }
    
    return NextResponse.json(updatedBill);
  } catch (error) {
    console.error('❌ Bill update error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if bill exists
    const [existingBill] = await db
      .select()
      .from(bills)
      .where(eq(bills.id, id));
    
    if (!existingBill) {
      return NextResponse.json(
        { error: 'Bill not found' },
        { status: 404 }
      );
    }
    
    // Delete bill items first
    await db.delete(billItems).where(eq(billItems.billId, id));
    
    // Delete bill
    await db.delete(bills).where(eq(bills.id, id));
    
    console.log('✅ Bill deleted:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Bill delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

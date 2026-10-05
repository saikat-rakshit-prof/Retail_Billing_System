import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory, stockHistory, productSizes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id));
    
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }
    
    const previousStock = item.currentStock;
    
    const [size] = await db.select().from(productSizes).where(eq(productSizes.id, item.productSizeId));
    
    const [updated] = await db.update(inventory).set({
      currentStock: 0,
      status: 'Out of Stock',
      updatedAt: new Date(),
    }).where(eq(inventory.id, id)).returning();
    
    // Add history log
    if (previousStock > 0) {
      await db.insert(stockHistory).values({
        inventoryId: id,
        productId: size?.productId || '',
        type: 'deduction',
        quantity: previousStock,
        previousStock,
        newStock: 0,
        note: 'Cleared stock to 0',
      });
    }
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error clearing stock:', error);
    return NextResponse.json({ error: 'Failed to clear stock' }, { status: 500 });
  }
}

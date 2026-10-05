import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory, stockHistory, productSizes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sizeId: string }> }
) {
  try {
    const { sizeId } = await params;
    const body = await request.json();
    const { quantity, type, note } = body;
    
    // Find inventory by productSizeId (not by inventory.id)
    const [item] = await db.select().from(inventory).where(
      // @ts-ignore
      eq(inventory.productSizeId, sizeId)
    );
    
    if (!item) {
      console.error('❌ Inventory not found for sizeId:', sizeId);
      return NextResponse.json({ error: 'Inventory item not found for this product size' }, { status: 404 });
    }

    const previousStock = item.currentStock;
    let newStock: number;
    let quantityInBottles = quantity;
    
    // Get size info to convert cartons to bottles if needed
    const [size] = await db.select().from(productSizes).where(
      // @ts-ignore
      eq(productSizes.id, sizeId)
    );
    
    if (type === 'cartons' && size) {
      quantityInBottles = quantity * size.bottlesPerCarton;
    }
    
    if (type === 'addition') {
      newStock = previousStock + quantityInBottles;
    } else if (type === 'deduction') {
      newStock = previousStock - quantityInBottles;
      if (newStock < 0) {
        return NextResponse.json({ error: 'Insufficient stock' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    
    // Determine new status
    let status = item.status;
    if (newStock <= 0) {
      status = 'Out of Stock';
    } else if (newStock <= (item.lowStockThreshold ?? 0)) {
      status = 'Low Stock';
    } else {
      status = 'Healthy';
    }
    
    // Update inventory
    await db.update(inventory).set({
      currentStock: newStock,
      status,
      lastRestocked: type === 'addition' ? new Date() : item.lastRestocked,
      updatedAt: new Date(),
    }).where(eq(inventory.id, item.id));
    
    // Add stock history entry
    await db.insert(stockHistory).values({
      inventoryId: item.id,
      productId: size?.productId || '',
      type,
      quantity: quantityInBottles.toString(),
      previousStock: previousStock.toString(),
      newStock: newStock.toString(),
      note: note || null,
    } as any);
    
    console.log(`✅ Stock ${type === 'addition' ? 'restored' : 'deducted'}: ${size?.sizeName || sizeId} - ${quantityInBottles} bottles. Stock: ${previousStock} -> ${newStock}`);
    
    return NextResponse.json({
      success: true,
      previousStock,
      newStock,
      change: quantityInBottles,
    });
  } catch (error) {
    console.error('Error updating stock by size:', error);
    return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
  }
}

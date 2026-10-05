import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory, stockHistory, products, productSizes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { stock, skuCode, productSizeId, productId, sizeName, brand, productName } = body;
    
    let item;
    let previousStock = 0;
    let isNewEntry = false;
    
    // Check if this is a placeholder item (new entry)
    if (id.startsWith('placeholder-')) {
      const actualSizeId = id.replace('placeholder-', '');
      
      // Generate SKU code if not provided
      const generatedSkuCode = skuCode || `${brand?.substring(0, 3).toUpperCase() || 'UNK'}-${productName?.substring(0, 3).toUpperCase() || 'PRD'}-${sizeName?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'SIZE'}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      
      // Create new inventory entry
      const newStock = typeof stock === 'number' ? stock : parseFloat(stock) || 0;
      
      let status = 'Healthy';
      if (newStock <= 0) {
        status = 'Out of Stock';
      } else if (newStock <= 50) {
        status = 'Low Stock';
      }
      
      const [newItem] = await db.insert(inventory).values({
        productSizeId: actualSizeId,
        skuCode: generatedSkuCode,
        currentStock: newStock,
        lowStockThreshold: 50,
        status,
        lastRestocked: newStock > 0 ? new Date() : null,
      }).returning();
      
      item = newItem;
      isNewEntry = true;
      previousStock = 0;
    } else {
      // Get existing inventory item
      [item] = await db.select().from(inventory).where(eq(inventory.id, id));
      
      if (!item) {
        return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
      }
      
      previousStock = item.currentStock;
    }
    
    const newStock = typeof stock === 'number' ? stock : parseFloat(stock);
    
    if (isNaN(newStock) || newStock < 0) {
      return NextResponse.json({ error: 'Invalid stock value' }, { status: 400 });
    }
    
    // Determine new status
    let status: string;
    if (newStock <= 0) {
      status = 'Out of Stock';
    } else if (newStock <= (item.lowStockThreshold ?? 0)) {
      status = 'Low Stock';
    } else {
      status = 'Healthy';
    }
    
    if (isNewEntry) {
      // Already created above
    } else {
      // Update existing inventory
      await db.update(inventory).set({
        currentStock: newStock,
        status,
        lastRestocked: newStock > previousStock ? new Date() : item.lastRestocked,
        updatedAt: new Date(),
      }).where(eq(inventory.id, id));
    }
    
    return NextResponse.json({ 
      success: true, 
      previousStock, 
      newStock,
      status,
      id: item.id
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { quantity, type, note } = body;
    
    // Get current inventory item (doesn't work for placeholders)
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id));
    
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found. Please use PUT to create inventory first.' }, { status: 404 });
    }

    const previousStock = item.currentStock;
    let newStock: number;
    let quantityInBottles = quantity;
    
    // Get size info to convert cartons to bottles if needed
    const [size] = await db.select().from(productSizes).where(eq(productSizes.id, item.productSizeId));
    
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
    }).where(eq(inventory.id, id));
    
    // Add stock history entry
    await db.insert(stockHistory).values({
      inventoryId: id,
      productId: size?.productId || '',
      type,
      quantity: quantityInBottles,
      previousStock,
      newStock,
      note: note || `${type === 'addition' ? 'Added' : 'Removed'} ${quantity} ${type}`,
    });
    
    return NextResponse.json({ 
      success: true, 
      previousStock, 
      newStock,
      status 
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory, products, productSizes, stockHistory } from '@/lib/db/schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [item] = await db.select().from(inventory).where(
      // @ts-ignore
      inventory.id.eq(id)
    );
    
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }
    
    const [size] = await db.select().from(productSizes).where(
      // @ts-ignore
      productSizes.id.eq(item.productSizeId)
    );
    
    const [product] = await db.select().from(products).where(
      // @ts-ignore
      products.id.eq(size?.productId)
    );
    
    return NextResponse.json({
      ...item,
      productName: product?.name,
      brand: product?.brand,
      sizeName: size?.sizeName,
    });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory item' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { lowStockThreshold, isPinned, currentStock } = body;
    
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    if (lowStockThreshold !== undefined) {
      updates.lowStockThreshold = lowStockThreshold;
    }
    
    if (isPinned !== undefined) {
      updates.isPinned = isPinned;
    }
    
    if (currentStock !== undefined) {
      updates.currentStock = currentStock;
      // Update status based on stock
      if (currentStock <= 0) {
        updates.status = 'Out of Stock';
      } else {
        const currentItem = await db.select().from(inventory).where(
          // @ts-ignore
          inventory.id.eq(id)
        );
        if (currentItem[0] && currentStock <= (currentItem[0].lowStockThreshold ?? 0)) {
          updates.status = 'Low Stock';
        } else {
          updates.status = 'Healthy';
        }
      }
    }
    
    await db.update(inventory).set(updates).where(
      // @ts-ignore
      inventory.id.eq(id)
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json({ error: 'Failed to update inventory item' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.delete(inventory).where(
      // @ts-ignore
      inventory.id.eq(id)
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json({ error: 'Failed to delete inventory item' }, { status: 500 });
  }
}

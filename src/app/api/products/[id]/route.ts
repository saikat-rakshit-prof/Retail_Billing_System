import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, productSizes, inventory, stockHistory, billItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [product] = await db.select().from(products).where(
      eq(products.id, id)
    );
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    const sizes = await db.select().from(productSizes).where(
      eq(productSizes.productId, id)
    );
    
    return NextResponse.json({ ...product, sizes });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, brand, category, icon, sizes } = body;
    
    // Update product
    await db.update(products).set({
      name,
      brand,
      category,
      imageUrl: icon || null,
      updatedAt: new Date(),
    }).where(
      eq(products.id, id)
    );
    
    // If sizes provided, update them - but preserve existing sizes to maintain inventory associations
    if (sizes && Array.isArray(sizes)) {
      // Get existing sizes for this product
      const existingSizes = await db.select().from(productSizes).where(
        eq(productSizes.productId, id)
      );
      
      // Update existing sizes or add new ones
      for (let i = 0; i < sizes.length; i++) {
        const sizeData = sizes[i];
        
        if (i < existingSizes.length) {
          // Update existing size
          const existingSize = existingSizes[i];
          await db.update(productSizes).set({
            sizeName: sizeData.name,
            pricePerBottle: (sizeData.pricePerBottle ?? 0).toString(),
            pricePerCarton: (sizeData.pricePerCarton ?? 0).toString(),
            bottlesPerCarton: sizeData.bottlesPerCarton || 0,
          }).where(
            eq(productSizes.id, existingSize.id)
          );
        } else {
          // Add new size (only if we don't have enough existing sizes)
          await db.insert(productSizes).values({
            productId: id,
            sizeName: sizeData.name,
            pricePerBottle: (sizeData.pricePerBottle ?? 0).toString(),
            pricePerCarton: (sizeData.pricePerCarton ?? 0).toString(),
            bottlesPerCarton: sizeData.bottlesPerCarton || 0,
          });
        }
      }
      
      // Delete any extra sizes that weren't in the update
      if (sizes.length < existingSizes.length) {
        const sizesToDelete = existingSizes.slice(sizes.length);
        for (const size of sizesToDelete) {
          // First delete inventory for this size
          await db.delete(inventory).where(
            eq(inventory.productSizeId, size.id)
          );
          // Then delete the size
          await db.delete(productSizes).where(
            eq(productSizes.id, size.id)
          );
        }
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🗑️ DELETE Product - ID:', id);
    
    // First, get all product sizes for this product
    const sizes = await db.select().from(productSizes).where(
      // @ts-ignore
      eq(productSizes.productId, id)
    );
    console.log('📋 Found sizes:', sizes.length);
    
    // For each size, find and clear related records
    for (const size of sizes) {
      // Clear bill_items references to this size (set null)
      await db.update(billItems)
        .set({ productSizeId: null })
        .where(
          // @ts-ignore
          eq(billItems.productSizeId, size.id)
        );
      console.log('✅ Cleared bill_items for size:', size.id);
      
      // Delete inventory for this size
      await db.delete(inventory).where(
        // @ts-ignore
        eq(inventory.productSizeId, size.id)
      );
      console.log('✅ Deleted inventory for size:', size.id);
      
      // Delete stock history for this product
      await db.delete(stockHistory).where(
        // @ts-ignore
        eq(stockHistory.productId, id)
      );
      console.log('✅ Deleted stock_history for product:', id);
    }
    
    // Delete product sizes
    await db.delete(productSizes).where(
      // @ts-ignore
      eq(productSizes.productId, id)
    );
    console.log('✅ Deleted product_sizes');
    
    // Finally, delete the product
    await db.delete(products).where(
      // @ts-ignore
      eq(products.id, id)
    );
    console.log('✅ Deleted product:', id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE Product Error:', error);
    console.error('❌ Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return NextResponse.json({ 
      error: 'Failed to delete product', 
      details: String(error) 
    }, { status: 500 });
  }
}

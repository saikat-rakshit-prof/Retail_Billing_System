import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory, products, productSizes } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🔄 Fetching inventory with JOIN...');

    // Single SQL LEFT JOIN: products → productSizes → inventory
    // Replaces 3 separate round-trips + in-memory loops
    const rows = await db
      .select({
        // inventory fields (null when no row exists)
        id: inventory.id,
        skuCode: inventory.skuCode,
        currentStock: inventory.currentStock,
        lowStockThreshold: inventory.lowStockThreshold,
        status: inventory.status,
        isPinned: inventory.isPinned,
        pinnedAt: inventory.pinnedAt,
        lastRestocked: inventory.lastRestocked,
        productSizeId: productSizes.id,
        // product / size fields
        productId: products.id,
        sizeName: productSizes.sizeName,
        pricePerBottle: productSizes.pricePerBottle,
        pricePerCarton: productSizes.pricePerCarton,
        bottlesPerCarton: productSizes.bottlesPerCarton,
        productName: products.name,
        brand: products.brand,
        category: products.category,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .innerJoin(productSizes, eq(productSizes.productId, products.id))
      .leftJoin(inventory, eq(inventory.productSizeId, productSizes.id));

    const inventoryWithDetails = rows.map((row) => {
      if (row.id) {
        // Real inventory row
        return {
          id: row.id,
          skuCode: row.skuCode,
          currentStock: row.currentStock,
          lowStockThreshold: row.lowStockThreshold,
          status: row.status,
          isPinned: row.isPinned,
          pinnedAt: row.pinnedAt,
          lastRestocked: row.lastRestocked,
          productSizeId: row.productSizeId,
          sizeId: row.productSizeId,
          productId: row.productId,
          sizeName: row.sizeName,
          pricePerBottle: row.pricePerBottle,
          pricePerCarton: row.pricePerCarton,
          bottlesPerCarton: row.bottlesPerCarton,
          productName: row.productName,
          brand: row.brand,
          category: row.category,
          imageUrl: row.imageUrl,
        };
      } else {
        // Placeholder for sizes without an inventory row
        const skuCode = `${(row.brand ?? '').substring(0, 3).toUpperCase()}-${(row.productName ?? '').substring(0, 3).toUpperCase()}-${(row.sizeName ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-AUTO`;
        return {
          id: `placeholder-${row.productSizeId}`,
          skuCode,
          currentStock: 0,
          lowStockThreshold: 50,
          status: 'Out of Stock',
          isPinned: false,
          pinnedAt: null,
          lastRestocked: null,
          productSizeId: row.productSizeId,
          sizeId: row.productSizeId,
          productId: row.productId,
          sizeName: row.sizeName,
          pricePerBottle: row.pricePerBottle,
          pricePerCarton: row.pricePerCarton,
          bottlesPerCarton: row.bottlesPerCarton,
          productName: row.productName,
          brand: row.brand,
          category: row.category,
          imageUrl: row.imageUrl,
        };
      }
    });

    console.log('📦 Inventory count:', inventoryWithDetails.length);
    console.log('✅ Inventory fetched successfully with JOIN');
    return NextResponse.json(inventoryWithDetails, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('❌ Inventory API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, productId, sizeId, skuCode, currentStock, lowStockThreshold } = body;
    
    if (!id || !productId || !sizeId || !skuCode) {
      return NextResponse.json(
        { error: 'Missing required fields: id, productId, sizeId, skuCode' },
        { status: 400 }
      );
    }
    
    // Check if inventory item already exists
    const [existing] = await db.select().from(inventory).where(
      // @ts-ignore
      inventory.id.eq(id)
    );
    
    if (existing) {
      return NextResponse.json({ error: 'Inventory item already exists' }, { status: 409 });
    }
    
    // Create new inventory item
    const [newInventory] = await db.insert(inventory).values({
      id,
      productSizeId: sizeId, // Map from frontend's sizeId to database's productSizeId
      skuCode,
      currentStock: currentStock || 0,
      lowStockThreshold: lowStockThreshold || 50,
      status: (currentStock || 0) > (lowStockThreshold || 50) ? 'Healthy' : 'Low Stock',
    }).returning();
    
    return NextResponse.json(newInventory, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory item', details: String(error) },
      { status: 500 }
    );
  }
}

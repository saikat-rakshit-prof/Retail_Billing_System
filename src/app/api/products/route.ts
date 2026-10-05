import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, productSizes, inventory, stockHistory } from '@/lib/db/schema';
import { ilike, desc, asc } from 'drizzle-orm';

// Helper to generate SKU code
function generateSKUCode(brand: string, name: string, sizeName: string): string {
  const brandPrefix = brand.substring(0, 3).toUpperCase();
  const namePrefix = name.substring(0, 3).toUpperCase();
  const sizeClean = sizeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${brandPrefix}-${namePrefix}-${sizeClean}-${random}`;
}

export async function GET() {
  try {
    const allProducts = await db.select()
      .from(products)
      .orderBy(desc(products.isPinned), asc(products.name));
    
    // Get sizes for all products - fetch all sizes
    const allSizes = await db.select().from(productSizes);
    
    // Map sizes to products
    const productsWithSizes = allProducts.map(product => ({
      ...product,
      icon: product.imageUrl, // Use imageUrl as icon
      sizes: allSizes.filter(size => size.productId === product.id).map(size => ({
        id: size.id,
        name: size.sizeName,
        pricePerBottle: parseFloat(size.pricePerBottle || '0'),
        pricePerCarton: parseFloat(size.pricePerCarton || '0'),
        bottlesPerCarton: size.bottlesPerCarton,
      })),
    }));
    
    return NextResponse.json(productsWithSizes, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, brand, category, icon, sizes } = body;
    
    console.log('📦 Creating product with sizes:', JSON.stringify(sizes, null, 2));
    
    if (!name || !brand || !category || !sizes || sizes.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check for duplicate product names (case-insensitive)
    const [existingProduct] = await db.select().from(products).where(ilike(products.name, name));
    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product with this name already exists' },
        { status: 409 }
      );
    }
    
    // Insert product
    const [newProduct] = await db.insert(products).values({
      name,
      brand,
      category,
      imageUrl: icon || null,
    }).returning();
    
    console.log('✅ Product created:', newProduct.id);
    
    // Insert product sizes
    const newSizes = await db.insert(productSizes).values(
      sizes.map((size: { name: string; pricePerBottle: number; pricePerCarton: number; bottlesPerCarton: number }) => ({
        productId: newProduct.id,
        sizeName: size.name,
        pricePerBottle: (size.pricePerBottle ?? 0).toString(),
        pricePerCarton: (size.pricePerCarton ?? 0).toString(),
        bottlesPerCarton: size.bottlesPerCarton || 0,
      }))
    ).returning();
    
    console.log('✅ Product sizes created:', newSizes.length);
    
    // Create inventory entries for each size with 0 stock (stock managed via inventory page)
    const inventoryEntries = [];
    for (let i = 0; i < newSizes.length; i++) {
      const size = newSizes[i];
      const skuCode = generateSKUCode(brand, name, size.sizeName);
      
      const [invEntry] = await db.insert(inventory).values({
        productSizeId: size.id,
        skuCode,
        currentStock: 0,
        lowStockThreshold: 50,
        status: 'Out of Stock',
        lastRestocked: null,
      }).returning();
      
      inventoryEntries.push(invEntry);
      
      console.log('✅ Inventory created:', skuCode, 'stock: 0');
    }
    
    return NextResponse.json({
      ...newProduct,
      sizes: newSizes,
      inventory: inventoryEntries,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

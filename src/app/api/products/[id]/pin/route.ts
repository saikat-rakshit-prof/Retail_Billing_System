import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const { isPinned } = body;
    const params = await context.params;
    const id = params.id;
    
    if (typeof isPinned !== 'boolean') {
      return NextResponse.json({ error: 'isPinned boolean is required' }, { status: 400 });
    }
    
    const [updatedProduct] = await db.update(products)
      .set({ isPinned, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
      
    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error pinning product:', error);
    return NextResponse.json({ error: 'Failed to pin product' }, { status: 500 });
  }
}

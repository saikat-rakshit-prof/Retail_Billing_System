import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('Starting migration...');
    const oldCategories = ['Sodas', 'sodas', 'soda', 'soft-drinks', 'softdrinks', 'SOFT DRINKS'];
    const newCategory = 'Soft Drinks';

    const result = await db.update(products).set({ category: newCategory }).where(inArray(products.category, oldCategories));
    console.log('Migration completed successfully', result);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}

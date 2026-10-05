import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inventory } from '@/lib/db/schema';
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
    
    const [updated] = await db.update(inventory).set({
      isPinned: !item.isPinned,
      pinnedAt: !item.isPinned ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(inventory.id, id)).returning();
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error toggling pin status:', error);
    return NextResponse.json({ error: 'Failed to toggle pin status' }, { status: 500 });
  }
}

// Clean up orphaned data in database
import 'dotenv/config';
import { db } from '../src/lib/db';
import { inventory, productSizes, products } from '../src/lib/db/schema';
import { inArray, sql } from 'drizzle-orm';

async function cleanupOrphanedData() {
  console.log('🔧 Starting data cleanup...\n');

  // Step 1: Find orphaned product_sizes (where product_id doesn't exist in products)
  console.log('=== STEP 1: Finding orphaned product_sizes ===');
  const allProductSizes = await db.select().from(productSizes);
  const allProducts = await db.select().from(products);
  
  const productIds = new Set(allProducts.map(p => p.id));
  const orphanedSizes = allProductSizes.filter(ps => !productIds.has(ps.productId));
  
  console.log(`Found ${orphanedSizes.length} orphaned product_sizes`);
  if (orphanedSizes.length > 0) {
    console.log('Orphaned sizes:', orphanedSizes.map(s => ({ id: s.id, productId: s.productId, sizeName: s.sizeName })));
  }

  if (orphanedSizes.length === 0) {
    console.log('✅ No orphaned data found!');
    return;
  }

  // Step 2: Delete inventory rows referencing orphaned sizes
  console.log('\n=== STEP 2: Deleting inventory for orphaned sizes ===');
  const orphanedSizeIds = orphanedSizes.map(s => s.id);
  
  if (orphanedSizeIds.length > 0) {
    const deletedInventory = await db.delete(inventory)
      .where(inArray(inventory.productSizeId, orphanedSizeIds))
      .returning();
    console.log(`Deleted ${deletedInventory.length} inventory rows`);
  }

  // Step 3: Delete orphaned product_sizes
  console.log('\n=== STEP 3: Deleting orphaned product_sizes ===');
  const deletedSizes = await db.delete(productSizes)
    .where(inArray(productSizes.id, orphanedSizeIds))
    .returning();
  console.log(`Deleted ${deletedSizes.length} product_sizes rows`);

  // Step 4: Verify cleanup
  console.log('\n=== STEP 4: Verifying cleanup ===');
  const remainingSizes = await db.select().from(productSizes);
  const remainingProductIds = new Set(allProducts.map(p => p.id));
  const stillOrphaned = remainingSizes.filter(ps => !remainingProductIds.has(ps.productId));
  
  console.log(`Remaining orphaned rows: ${stillOrphaned.length}`);
  
  if (stillOrphaned.length === 0) {
    console.log('\n✅ Cleanup completed successfully!');
  } else {
    console.log('\n⚠️ Some orphaned data still exists - manual cleanup may be needed');
  }
}

cleanupOrphanedData().catch(console.error);

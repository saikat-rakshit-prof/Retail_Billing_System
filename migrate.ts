import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { db } from './src/lib/db';
import { products } from './src/lib/db/schema';
import { inArray } from 'drizzle-orm';

async function migrate() {
  console.log('Starting migration...');
  const oldCategories = ['Sodas', 'sodas', 'soda', 'soft-drinks', 'softdrinks', 'SOFT DRINKS'];
  const newCategory = 'Soft Drinks';

  const result = await db.update(products).set({ category: newCategory }).where(inArray(products.category, oldCategories));
  console.log('Migration completed successfully', result);
}
migrate().catch(console.error);

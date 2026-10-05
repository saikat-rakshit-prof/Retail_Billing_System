import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Adding unique constraint to products.name...");
  
  try {
    await db.execute(sql`
      ALTER TABLE products ADD CONSTRAINT products_name_unique UNIQUE(name);
    `);
    console.log("Constraint added successfully!");
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log("Constraint already exists.");
    } else {
      console.error("Error adding constraint:", error);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));

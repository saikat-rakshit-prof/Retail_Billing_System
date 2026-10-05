// Check database tables
import 'dotenv/config';
import { db } from '../src/lib/db';

async function checkData() {
  console.log('🔍 Checking database tables...\n');

  // Check inventory
  console.log('=== INVENTORY TABLE ===');
  const inventory = await db.select().from(require('../src/lib/db/schema').inventory).limit(5);
  console.log('Inventory rows:', inventory.length);
  if (inventory.length > 0) {
    console.log('Sample inventory:', JSON.stringify(inventory, null, 2));
  }

  // Check product_sizes
  console.log('\n=== PRODUCT_SIZES TABLE ===');
  const productSizes = await db.select().from(require('../src/lib/db/schema').productSizes).limit(5);
  console.log('Product sizes rows:', productSizes.length);
  if (productSizes.length > 0) {
    console.log('Sample product sizes:', JSON.stringify(productSizes, null, 2));
  }

  // Check products
  console.log('\n=== PRODUCTS TABLE ===');
  const products = await db.select().from(require('../src/lib/db/schema').products).limit(5);
  console.log('Products rows:', products.length);
  if (products.length > 0) {
    console.log('Sample products:', JSON.stringify(products, null, 2));
  }

  // Check for foreign key mismatches
  console.log('\n=== FOREIGN KEY CHECK ===');
  const inventoryWithKeys = inventory.map(inv => {
    const size = productSizes.find(ps => ps.id === inv.productSizeId);
    const product = size ? products.find(p => p.id === size.productId) : null;
    return {
      inventoryId: inv.id,
      productSizeId: inv.productSizeId,
      foundSize: size ? 'YES' : 'NO',
      sizeProductId: size?.productId,
      foundProduct: product ? 'YES' : 'NO',
      productName: product?.name || 'UNKNOWN'
    };
  });
  console.log('FK Analysis:', JSON.stringify(inventoryWithKeys, null, 2));
}

checkData().catch(console.error);

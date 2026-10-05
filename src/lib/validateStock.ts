/**
 * Stock validation module for billing
 * Validates that sufficient stock is available before generating a bill
 */

import * as storage from '@/lib/storage';
import { BillItem } from '@/types';

export interface StockValidationResult {
  /** Whether the validation passed */
  pass: boolean;
  /** List of items that failed validation */
  failedItems: StockValidationFailure[];
}

export interface StockValidationFailure {
  /** The bill item that failed */
  item: BillItem;
  /** Current available stock */
  availableStock: number;
  /** Required quantity */
  requiredQuantity: number;
  /** Shortage amount (required - available) */
  shortage: number;
}

/**
 * Validates that all items in a bill have sufficient stock
 * Always fetches fresh inventory bypassing all cache
 * 
 * @param items - List of bill items to validate
 * @returns Validation result with pass/fail status and details of any failures
 * 
 * @example
 * ```typescript
 * const result = await validateStock(items);
 * if (!result.pass) {
 *   console.error('Out of stock items:', result.failedItems);
 * }
 * ```
 */
export async function validateStock(items: BillItem[]): Promise<StockValidationResult> {
  // Fetch fresh inventory bypassing all cache
  const inventory = await storage.getInventory(true);
  
  const failedItems: StockValidationFailure[] = [];
  
  for (const item of items) {
    // Find the SKU for this item
    const sku = inventory.find(s => s.productId === item.productId && (s.sizeId === item.sizeId || s.productSizeId === item.sizeId || s.sizeName === item.sizeName));
    
    if (!sku) {
      // SKU doesn't exist - treat as out of stock
      failedItems.push({
        item,
        availableStock: 0,
        requiredQuantity: item.quantity,
        shortage: item.quantity,
      });
      continue;
    }
    
    // Calculate required quantity in the same unit as currentStock
    let requiredQuantity = item.quantity;
    if (item.packaging === 'carton') {
      // Get product to find bottles per carton - use default of 12 if not found
      // The inventory stores in bottles, so we convert cartons to bottles
      requiredQuantity = item.quantity * (sku.bottlesPerCarton || 12);
    }
    
    if (sku.currentStock < requiredQuantity) {
      failedItems.push({
        item,
        availableStock: sku.currentStock,
        requiredQuantity,
        shortage: requiredQuantity - sku.currentStock,
      });
    }
  }
  
  const result: StockValidationResult = {
    pass: failedItems.length === 0,
    failedItems,
  };
  
  if (!result.pass) {
    console.warn('[StockValidation] ❌ Stock validation failed:', failedItems);
  } else {
    console.log('[StockValidation] ✅ Stock validation passed');
  }
  
  return result;
}

/**
 * Validates a single item's stock
 * Convenience function for checking one item
 * 
 * @param productId - Product ID
 * @param sizeId - Size ID
 * @param quantity - Quantity needed
 * @param packaging - 'bottle' or 'carton'
 * @returns True if sufficient stock available, false otherwise
 */
export async function validateSingleItemStock(
  productId: string,
  sizeId: string,
  quantity: number,
  packaging: 'bottle' | 'carton'
): Promise<boolean> {
  // Fetch fresh inventory bypassing all cache
  const inventory = await storage.getInventory(true);
  
  const sku = inventory.find(s => s.productId === productId && (s.sizeId === sizeId || s.productSizeId === sizeId));
  
  if (!sku) {
    return false;
  }
  
  let requiredQuantity = quantity;
  if (packaging === 'carton') {
    requiredQuantity = quantity * (sku.bottlesPerCarton || 12);
  }
  
  return sku.currentStock >= requiredQuantity;
}

export default validateStock;

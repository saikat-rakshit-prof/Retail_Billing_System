/**
 * Error recovery module for handling billing errors
 * Specifically handles the case where a bill is saved but stock deduction fails
 */

import * as storage from '@/lib/storage';
import { Bill, BillItem } from '@/types';

export interface BillErrorRecovery {
  /** The bill that was saved but has stock issues */
  bill: Bill;
  /** Error message describing what happened */
  errorMessage: string;
  /** Which items failed stock deduction */
  failedItems: BillItem[];
  /** Timestamp when the error occurred */
  occurredAt: Date;
}

/**
 * Handles the error when a bill is saved but stock deduction fails
 * 
 * This function:
 * 1. Marks the bill with a stock_error status
 * 2. Logs the full error details
 * 3. Provides a retry function to attempt stock deduction again
 * 
 * @param bill - The bill that was saved
 * @param failedItems - Array of items that failed stock deduction
 * @returns Error recovery object with retry function
 */
export function handleBillStockError(
  bill: Bill,
  failedItems: BillItem[]
): BillErrorRecovery {
  const errorMessage = `Bill ${bill.invoiceNumber} was saved but stock deduction failed for ${failedItems.length} item(s): ${failedItems.map(i => i.productName).join(', ')}`;
  
  // Log full error details
  console.error('[ErrorRecovery] ❌ Bill saved but stock deduction failed:', {
    billId: bill.id,
    invoiceNumber: bill.invoiceNumber,
    failedItems: failedItems.map(item => ({
      productName: item.productName,
      sizeName: item.sizeName,
      quantity: item.quantity,
      packaging: item.packaging,
    })),
    occurredAt: new Date().toISOString(),
  });
  
  // Create recovery object
  const recovery: BillErrorRecovery = {
    bill: {
      ...bill,
      status: 'stock_error' as Bill['status'], // Mark bill with stock_error status
    },
    errorMessage,
    failedItems,
    occurredAt: new Date(),
  };
  
  return recovery;
}

/**
 * Retries stock deduction for a bill that previously failed
 * 
 * @param bill - The bill to retry stock deduction for
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function retryStockDeduction(bill: Bill): Promise<{ success: boolean; error?: string }> {
  console.log(`[ErrorRecovery] 🔄 Retrying stock deduction for bill ${bill.invoiceNumber}...`);
  
  const failedItems: BillItem[] = [];
  
  for (const item of bill.items) {
    try {
      // Calculate quantity in bottles
      let quantityToDeduct = item.quantity;
      if (item.packaging === 'carton') {
        quantityToDeduct = item.quantity * 12;
      }
      
      // Create SKU ID (same logic as billing page)
      const skuId = `${item.productId}-${item.sizeId}`;
      
      // Get current stock
      const inventory = await storage.getInventory(true);
      const sku = inventory.find(s => s.id === skuId);
      
      if (!sku) {
        console.error(`[ErrorRecovery] SKU not found for retry: ${skuId}`);
        failedItems.push(item);
        continue;
      }
      
      if (sku.currentStock < quantityToDeduct) {
        console.error(`[ErrorRecovery] Insufficient stock for retry: ${skuId}, need ${quantityToDeduct}, have ${sku.currentStock}`);
        failedItems.push(item);
        continue;
      }
      
      // Deduct stock
      const success = await storage.deductStock(skuId, quantityToDeduct);
      
      if (!success) {
        console.error(`[ErrorRecovery] Failed to deduct stock for retry: ${skuId}`);
        failedItems.push(item);
      }
    } catch (error) {
      console.error(`[ErrorRecovery] Error during retry for item:`, error);
      failedItems.push(item);
    }
  }
  
  if (failedItems.length > 0) {
    const errorMessage = `Retry failed for ${failedItems.length} item(s): ${failedItems.map(i => i.productName).join(', ')}`;
    console.error('[ErrorRecovery] ❌ Retry failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
  
  console.log(`[ErrorRecovery] ✅ Stock deduction retry successful for bill ${bill.invoiceNumber}`);
  return { success: true };
}

/**
 * Creates a user-friendly error message for stock validation failures
 * 
 * @param failedItems - Array of items that failed validation
 * @returns Formatted error message string
 */
export function formatStockErrorMessage(failedItems: BillItem[]): string {
  if (failedItems.length === 0) {
    return '';
  }
  
  if (failedItems.length === 1) {
    const item = failedItems[0];
    return `Out of stock: ${item.productName} (${item.sizeName}) - ${item.packaging === 'carton' ? 'carton' : 'unit'} quantity: ${item.quantity}`;
  }
  
  const itemsList = failedItems
    .map(item => `${item.productName} (${item.sizeName})`)
    .join(', ');
    
  return `Out of stock: ${itemsList}`;
}

export default {
  handleBillStockError,
  retryStockDeduction,
  formatStockErrorMessage,
};

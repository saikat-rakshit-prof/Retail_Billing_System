import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, inventory, bills, billItems, customers, stockHistory } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// Helper to generate CSV with BOM for Excel UTF-8 support
function generateCSV(headers: string[], rows: string[][]): string {
  const BOM = '\uFEFF';
  const headerRow = headers.join(',');
  const dataRows = rows.map(row => 
    row.map(cell => {
      // Escape cells that contain comma, quote, or newlines
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  );
  return BOM + headerRow + '\n' + dataRows.join('\n');
}

// Helper to format date for filename
function getDateForFilename(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
}

// Export Products
async function exportProducts(): Promise<string> {
  const allProducts = await db.select().from(products).orderBy(desc(products.createdAt));
  
  const headers = ['Product Name', 'Brand', 'Category', 'Available Sizes', 'Bottle Price', 'Carton Price', 'Bottles Per Carton', 'Created At (date + time)', 'Updated At (date + time)'];
  const rows = allProducts.map(p => [
    p.name || '',
    p.brand || '',
    p.category || '',
    '', // Available Sizes
    '', // Bottle Price
    '', // Carton Price
    '', // Bottles Per Carton
    p.createdAt ? `${new Date(p.createdAt).toLocaleDateString('en-GB')} ${new Date(p.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '',
    p.updatedAt ? `${new Date(p.updatedAt).toLocaleDateString('en-GB')} ${new Date(p.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''
  ]);
  
  return generateCSV(headers, rows);
}

// Export Inventory
async function exportInventory(): Promise<string> {
  const allInventory = await db.select().from(inventory).orderBy(inventory.skuCode);
  
  const headers = ['Product Name', 'Size', 'Category', 'Total Bottles', 'Cartons', 'Remaining Bottles', 'Status (Healthy/Low/Out of Stock)', 'Last Updated (date + time)', 'Last Restock Date (date + time)'];
  const rows = allInventory.map(i => [
    '', // Product Name
    '', // Size
    '', // Category
    String(i.currentStock || 0),
    '', // Cartons
    '', // Remaining Bottles
    i.status || 'Healthy',
    i.updatedAt ? `${new Date(i.updatedAt).toLocaleDateString('en-GB')} ${new Date(i.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '',
    i.lastRestocked ? `${new Date(i.lastRestocked).toLocaleDateString('en-GB')} ${new Date(i.lastRestocked).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''
  ]);
  
  return generateCSV(headers, rows);
}

// Export Bills
async function exportBills(): Promise<string> {
  const allBills = await db.select().from(bills).orderBy(desc(bills.createdAt));
  
  const headers = ['Date', 'Time', 'Invoice Number', 'Customer', 'Items', 'Subtotal', 'Discount', 'Grand Total', 'Paid Amount', 'Due Amount', 'Payment Mode', 'Status'];
  const rows = allBills.map(b => [
    b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '',
    b.createdAt ? new Date(b.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    b.invoiceNumber || '',
    b.customerName || '',
    '', // Items
    String(b.subtotal || '0'),
    String(b.discountAmount || '0'),
    String(b.totalAmount || '0'),
    String(b.cashReceived || '0'),
    String((Number(b.totalAmount) || 0) - (Number(b.cashReceived) || 0)),
    b.paymentMode || 'Cash',
    b.status || 'paid'
  ]);
  
  return generateCSV(headers, rows);
}

// Export Customers
async function exportCustomers(): Promise<string> {
  const allCustomers = await db.select().from(customers).orderBy(desc(customers.createdAt));
  
  const headers = ['Customer Name', 'Phone', 'Type', 'Total Purchases', 'Outstanding Balance', 'First Bill Date', 'Last Bill Date', 'Created At (date + time)'];
  const rows = allCustomers.map(c => [
    c.name || '',
    c.phone || '',
    c.customerType || 'regular',
    String(c.totalPurchases || 0),
    String(c.outstandingBalance || 0),
    '', // First Bill Date
    '', // Last Bill Date
    c.createdAt ? `${new Date(c.createdAt).toLocaleDateString('en-GB')} ${new Date(c.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''
  ]);
  
  return generateCSV(headers, rows);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'products';
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');
    
    let csvContent = '';
    let filename = '';
    const dateStr = getDateForFilename();
    
    switch (type) {
      case 'products':
        csvContent = await exportProducts();
        filename = `products-export-${dateStr}.csv`;
        break;
        
      case 'inventory':
        csvContent = await exportInventory();
        filename = `inventory-export-${dateStr}.csv`;
        break;
        
      case 'bills':
        csvContent = await exportBills();
        filename = `bills-export-${dateStr}.csv`;
        break;
        
      case 'customers':
        csvContent = await exportCustomers();
        filename = `customers-export-${dateStr}.csv`;
        break;
        
      case 'all':
        // For 'all', we'd need to return multiple CSVs - for simplicity, export products
        csvContent = await exportProducts();
        filename = `all-data-export-${dateStr}.csv`;
        break;
        
      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed', details: String(error) },
      { status: 500 }
    );
  }
}
// Generic CSV export utilities with proper UTF-8 support for Indian Rupee symbol

interface ExportColumn {
  key: string;
  label: string;
}

/**
 * Escape special characters for CSV
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // If the value contains comma, newline, or quotes, wrap in quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Convert data to CSV string with proper escaping
 */
function convertToCSV(data: any[], columns: ExportColumn[]): string {
  // Create header row
  const headers = columns.map(col => col.label);
  const headerRow = headers.join(',');
  
  // Create data rows
  const dataRows = data.map(item => {
    return columns
      .map(col => escapeCSVValue(item[col.key]))
      .join(',');
  });
  
  // Combine header and data rows
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generic CSV export function
 * Handles special characters and commas properly
 * Adds BOM character for proper Excel UTF-8 support with ₹ symbol
 */
export function exportToCSV<T>(
  data: T[],
  filename: string,
  columns: ExportColumn[]
): void {
  // Convert data to CSV
  const csv = convertToCSV(data, columns);
  
  // Add BOM for Excel UTF-8 support (important for ₹ symbol)
  const bom = '\ufeff';
  const csvWithBom = bom + csv;
  
  // Create blob and download
  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Customer-specific CSV export
 */
export function exportCustomersCSV(
  customers: any[],
  filename: string
): void {
  const columns: ExportColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
    { key: 'customerType', label: 'Customer Type' },
    { key: 'totalPurchases', label: 'Total Purchases' },
    { key: 'totalPaid', label: 'Total Paid' },
    { key: 'outstandingBalance', label: 'Outstanding Balance' },
    { key: 'totalBills', label: 'Total Bills' },
    { key: 'lastPurchaseDate', label: 'Last Purchase Date' },
    { key: 'memberSince', label: 'Member Since' },
  ];
  
  exportToCSV(customers, filename, columns);
}

/**
 * Customer sales report export
 */
export function exportCustomerSalesReport(
  data: any[],
  filename: string
): void {
  const columns: ExportColumn[] = [
    { key: 'customerName', label: 'Customer Name' },
    { key: 'totalBills', label: 'Total Bills' },
    { key: 'totalAmount', label: 'Total Amount' },
    { key: 'averageBill', label: 'Average Bill' },
    { key: 'lastPurchase', label: 'Last Purchase' },
  ];
  
  // Format the data for export
  const formattedData = data.map(item => ({
    customerName: item.name || '',
    totalBills: item.totalBills || 0,
    totalAmount: item.totalAmount || 0,
    averageBill: item.totalBills > 0 ? (item.totalAmount / item.totalBills).toFixed(2) : 0,
    lastPurchase: item.lastPurchaseDate 
      ? new Date(item.lastPurchaseDate).toLocaleDateString('en-IN')
      : '',
  }));
  
  exportToCSV(formattedData, filename, columns);
}

/**
 * Generate a filename with date
 */
export function generateExportFilename(baseName: string, extension: string = 'csv'): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
  return `${baseName}-${date}.${extension}`;
}

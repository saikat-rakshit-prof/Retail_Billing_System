/**
 * Export utilities for downloading store data as CSV
 */

const API_BASE = '/api';

/**
 * Download a specific type of data as CSV
 */
export async function downloadCSV(type: string): Promise<void> {
  const response = await fetch(`${API_BASE}/export?type=${type}`);
  
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  if (contentDisposition && contentDisposition.includes('filename=')) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      a.download = filenameMatch[1];
    }
  } else {
    // Fallback filename
    a.download = `${type}-export.csv`;
  }
  
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Download all data types (for bulk export)
 */
export async function downloadAllData(): Promise<void> {
  const types = ['products', 'inventory', 'bills', 'customers'];
  
  for (let i = 0; i < types.length; i++) {
    await downloadCSV(types[i]);
    // Add delay between downloads to avoid overwhelming the server
    if (i < types.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
import { CustomerType, CustomerPaymentType, CustomerReport } from '@/types';

// ============================================================================
// CUSTOMER TYPES
// ============================================================================
export const CUSTOMER_TYPES: Record<CustomerType, { label: string; badgeColor: string }> = {
  regular: {
    label: 'Regular',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  seasonal: {
    label: 'Seasonal',
    badgeColor: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  retail: {
    label: 'Retail',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  wholesale: {
    label: 'Wholesale',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
};

// ============================================================================
// PAYMENT TYPES
// ============================================================================
export const PAYMENT_TYPES: Record<CustomerPaymentType, { label: string; color: string }> = {
  payment: {
    label: 'Payment',
    color: 'text-green-600',
  },
  refund: {
    label: 'Refund',
    color: 'text-orange-600',
  },
  credit: {
    label: 'Credit',
    color: 'text-red-600',
  },
};

// ============================================================================
// EXPORT COLUMN DEFINITIONS
// ============================================================================
export const CUSTOMER_EXPORT_COLUMNS: { key: keyof CustomerReport; label: string }[] = [
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

// ============================================================================
// CUSTOMER SALES REPORT COLUMNS
// ============================================================================
export const CUSTOMER_SALES_REPORT_COLUMNS = [
  'Customer Name',
  'Total Bills',
  'Total Amount',
  'Average Bill',
  'Last Purchase',
];

// ============================================================================
// BALANCE STATUS
// ============================================================================
export type BalanceStatus = 'clear' | 'has_balance';

export const getBalanceStatus = (
  outstandingBalance: number
): BalanceStatus => {
  if (outstandingBalance <= 0) return 'clear';
  return 'has_balance';
};

export const getBalanceStatusLabel = (status: BalanceStatus): string => {
  switch (status) {
    case 'clear':
      return 'Clear';
    case 'has_balance':
      return 'Has Balance';
  }
};

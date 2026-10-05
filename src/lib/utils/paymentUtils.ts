export const getPaymentTag = (bill: any) => {
  const payments = bill.payments || [];
  
  if (payments.length === 0) {
    return bill.paymentMode || 'Cash';
  }
  
  const modes = new Set<string>();
  payments.forEach((p: any) => {
    if (p.paymentMode) {
      modes.add(p.paymentMode.toLowerCase().trim());
    }
  });
  
  if (bill.paymentMode) {
    modes.add(bill.paymentMode.toLowerCase().trim());
  }
  
  modes.delete(undefined as any);
  modes.delete(null as any);
  modes.delete('');
  
  const hasCash = modes.has('cash');
  const hasUPI = modes.has('upi');
  const hasCard = modes.has('card');
  const hasCredit = modes.has('credit') || modes.has('due');

  if (modes.size === 1) {
    if (hasCash) return 'Cash';
    if (hasUPI) return 'UPI';
    if (hasCard) return 'Card';
    if (hasCredit) return 'Credit';
    return bill.paymentMode || 'Cash';
  }

  const parts = [];
  if (hasCash) parts.push('Cash');
  if (hasUPI) parts.push('UPI');
  if (hasCard) parts.push('Card');
  
  if (parts.length === 0) return 'Multi';
  if (parts.length >= 3) return 'Multi';
  
  return parts.join('+');
};

export const getPaymentBadgeStyle = (tag: string) => {
  switch (tag) {
    case 'Cash':
      return 'bg-[#f3f4f6] text-[#374151]';
    case 'UPI':
      return 'bg-[#eff6ff] text-[#1d4ed8]';
    case 'Card':
      return 'bg-[#f0fdf4] text-[#15803d]';
    case 'Credit':
      return 'bg-[#fef3c7] text-[#92400e]';
    case 'Cash+UPI':
    case 'UPI+Cash':
      return 'bg-[#fef3c7] text-[#92400e]';
    case 'Cash+Card':
    case 'Card+Cash':
      return 'bg-[#f0fdf4] text-[#166534]';
    case 'UPI+Card':
    case 'Card+UPI':
      return 'bg-[#eff6ff] text-[#1e40af]';
    case 'Multi':
    default:
      if (tag.includes('+')) {
        return 'bg-[#faf5ff] text-[#6b21a8]';
      }
      return 'bg-slate-100 text-slate-600';
  }
};

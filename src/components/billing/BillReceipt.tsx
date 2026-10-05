'use client';

import { Bill, StoreSettings } from '@/types';
import { CUSTOMER_TYPES } from '@/lib/constants/customerConstants';

interface BillReceiptProps {
  bill: Bill;
  settings: StoreSettings;
}

export function BillReceipt({ bill, settings }: BillReceiptProps) {
  const shopName = settings.shopName || 'My Store';
  const shopPhone = settings.shopPhone || 'N/A';
  const shopAddress = settings.shopAddress || 'N/A';
  const taxRate = settings.taxRate || 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  return (
    <div
      id="print-receipt"
      ref={(el) => {
        if (el) {
          (el as any).dataset.receipt = 'true';
        }
      }}
      className="bg-white"
      style={{
        width: '400px',
        padding: '24px',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        backgroundColor: '#ffffff',
        position: 'relative',
      }}
    >
      {/* Shop Name */}
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '8px',
        }}
      >
        {shopName}
      </h1>

      {/* Shop Address */}
      <p
        style={{
          fontSize: '12px',
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: '4px',
        }}
      >
        {shopAddress}
      </p>

      {/* Shop Phone */}
      <p
        style={{
          fontSize: '12px',
          color: '#6b7280',
          textAlign: 'center',
          marginBottom: '16px',
        }}
      >
        {shopPhone}
      </p>

      {/* Dashed Divider */}
      <div
        style={{
          borderTop: '1px dashed #d1d5db',
          marginBottom: '16px',
        }}
      />

      {/* Invoice Number */}
      <div style={{ textAlign: 'right', marginBottom: '8px' }}>
        <span
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: '14px',
            color: '#16a34a',
            fontWeight: 500,
          }}
        >
          {bill.invoiceNumber}
        </span>
      </div>

      {/* Date and Time */}
      <div style={{ textAlign: 'right', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {formatDate(bill.createdAt)} {formatTime(bill.createdAt)}
        </span>
      </div>

      {/* Customer Info */}
      {(bill.customerName || bill.phoneNumber) && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {bill.customerName && (
                  <p style={{ fontSize: '14px', marginBottom: '4px', fontWeight: 600 }}>
                    Customer: {bill.customerName}
                  </p>
                )}
                {bill.phoneNumber && (
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>
                    Phone: {bill.phoneNumber}
                  </p>
                )}
              </div>
              {/* Show type badge for non-regular customers */}
              {bill.customerType && bill.customerType !== 'regular' && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontWeight: 600,
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    border: `1px solid #93c5fd`,
                  }}
                >
                  {CUSTOMER_TYPES[bill.customerType]?.label || bill.customerType.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              borderTop: '1px dashed #d1d5db',
              marginBottom: '16px',
            }}
          />
        </>
      )}

      {/* Items Table Header */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                fontSize: '10px',
                fontWeight: 600,
                color: '#6b7280',
                paddingBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Item
            </th>
            <th
              style={{
                textAlign: 'center',
                fontSize: '10px',
                fontWeight: 600,
                color: '#6b7280',
                paddingBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Qty
            </th>
            <th
              style={{
                textAlign: 'right',
                fontSize: '10px',
                fontWeight: 600,
                color: '#6b7280',
                paddingBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Rate
            </th>
            <th
              style={{
                textAlign: 'right',
                fontSize: '10px',
                fontWeight: 600,
                color: '#6b7280',
                paddingBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item) => (
            <tr key={item.id}>
              <td style={{ padding: '4px 0' }}>
                <span style={{ fontSize: '12px', display: 'block' }}>
                  {item.productName} {item.sizeName}
                </span>
              </td>
              <td
                style={{
                  textAlign: 'center',
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: '12px',
                  padding: '4px 0',
                }}
              >
                {item.quantity} {item.packaging}
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: '12px',
                  padding: '4px 0',
                }}
              >
                {formatCurrency(item.unitPrice)}
              </td>
              <td
                style={{
                  textAlign: 'right',
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: '12px',
                  padding: '4px 0',
                }}
              >
                {formatCurrency(item.totalPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dashed Divider */}
      <div
        style={{
          borderTop: '1px dashed #d1d5db',
          marginBottom: '16px',
        }}
      />

      {/* Subtotal */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '12px' }}>Subtotal</span>
        <span
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: '12px',
          }}
        >
          {formatCurrency(Number(bill.subtotal))}
        </span>
      </div>

      {/* Discount */}
      {Number(bill.discountAmount) > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '12px' }}>
            Discount ({bill.discountType === 'percentage' ? `${bill.discountValue}%` : 'Flat'})
          </span>
          <span
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: '12px',
              color: '#dc2626',
            }}
          >
            -{formatCurrency(Number(bill.discountAmount))}
          </span>
        </div>
      )}

      {/* Total */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
          paddingTop: '8px',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 700 }}>Total</span>
        <span
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: '18px',
            fontWeight: 700,
          }}
        >
          {formatCurrency(Number(bill.totalAmount))}
        </span>
      </div>

      {/* Dashed Divider */}
      <div
        style={{
          borderTop: '1px dashed #d1d5db',
          marginBottom: '16px',
        }}
      />

      {/* Payment Mode */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontSize: '12px' }}>Payment Mode</span>
        <span
          style={{
            fontFamily: '"Geist Mono", monospace',
            fontSize: '12px',
            color: bill.paymentMode === 'Credit' ? '#dc2626' : undefined,
            fontWeight: bill.paymentMode === 'Credit' ? 700 : undefined,
          }}
        >
          {bill.paymentMode}
        </span>
      </div>

      {/* CREDIT SALE Stamp */}
      {bill.paymentMode === 'Credit' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-15deg)',
            border: '3px solid #dc2626',
            padding: '8px 24px',
            borderRadius: '4px',
            opacity: 0.3,
          }}
        >
          <span
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#dc2626',
              letterSpacing: '2px',
            }}
          >
            CREDIT SALE
          </span>
        </div>
      )}

      {/* Outstanding Balance for Credit */}
      {bill.paymentMode === 'Credit' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            padding: '8px',
            backgroundColor: '#fef2f2',
            borderRadius: '4px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
            Credit Amount Added
          </span>
          <span
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontSize: '12px',
              color: '#dc2626',
              fontWeight: 700,
            }}
          >
            {formatCurrency(Number(bill.totalAmount))}
          </span>
        </div>
      )}

      {/* Dashed Divider */}
      <div
        style={{
          borderTop: '1px dashed #d1d5db',
          marginBottom: '16px',
        }}
      />

      {/* Thank You Message */}
      <p
        style={{
          fontSize: '14px',
          fontStyle: 'italic',
          textAlign: 'center',
          marginBottom: '16px',
        }}
      >
        Thank you for your purchase!
      </p>

      {/* Shop Name at Bottom */}
      <p
        style={{
          fontSize: '10px',
          color: '#9ca3af',
          textAlign: 'center',
        }}
      >
        {shopName}
      </p>
    </div>
  );
}

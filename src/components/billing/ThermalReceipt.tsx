'use client';

import React from 'react';
import { Bill, StoreSettings, BillItem } from '@/types';
import { getPaymentTag } from '@/lib/utils/paymentUtils';

interface ThermalReceiptProps {
  bill: Bill;
  settings: StoreSettings;
  returnedItems?: Array<{
    productName: string;
    sizeName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    packaging?: string;
  }>;
  refundAmount?: number;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function convertHundreds(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertHundreds(n % 100) : '');
  }
  if (num >= 100000) {
    const lakhs = Math.floor(num / 100000);
    const remaining = num % 100000;
    return convertHundreds(lakhs) + ' Lakh' + (remaining !== 0 ? ' ' + convertHundreds(remaining) : '');
  }
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const remaining = num % 1000;
    return convertHundreds(thousands) + ' Thousand' + (remaining !== 0 ? ' ' + convertHundreds(remaining) : '');
  }
  return convertHundreds(num);
}

export function ThermalReceipt({
  bill,
  settings,
  returnedItems = [],
  refundAmount = 0,
}: ThermalReceiptProps) {
  React.useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/newlogo.png';
  }, []);

  const billItems: BillItem[] = typeof bill.items === 'string'
    ? JSON.parse(bill.items)
    : bill.items || [];

  // ✅ Defensive field mapping (handle different db field names)
  const mappedItems = billItems.map((item: any) => ({
    productName: item.productName || item.name || item.product_name || '',
    sizeName: item.sizeName || item.size_name || item.size || '',
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    totalPrice: Number(item.totalPrice) || 0,
    packaging: item.packaging,
    invoiceNumber: item.invoiceNumber,
  }));

  // ✅ Map returned items defensively too
  const mappedReturnedItems = returnedItems.map((item: any) => ({
    productName: item.productName || item.name || item.product_name || '',
    sizeName: item.sizeName || item.size_name || item.size || '',
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    totalPrice: Number(item.totalPrice) || 0,
    packaging: item.packaging,
  }));

  // Calculate totals
  const itemTotal = mappedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const discountAmount = Number(bill.discountAmount) || 0;
  const totalAfterDiscount = itemTotal - discountAmount;
  const roundOff = Math.round(totalAfterDiscount) - totalAfterDiscount;
  const roundedTotal = Math.round(totalAfterDiscount);
  const paidAmount = Number(bill.cashReceived) || 0;
  const dueAmount = roundedTotal - paidAmount - refundAmount;
  // ✅ Fix: change = cashReceived - roundedTotal (positive means change given back)
  const changeGiven = paidAmount - roundedTotal;

  const billDate = bill.createdAt ? new Date(bill.createdAt) : new Date();
  const dateStr = billDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = billDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatQty = (qty: number, packaging?: string) => {
    if (packaging === 'carton') return `${qty}C`;
    if (packaging === 'bottle') return `${qty}B`;
    return `${qty}`;
  };

  const getCustomerType = () => {
    if (bill.billType === 'order') return 'ORDER';
    if (bill.customerType === 'wholesale') return 'PICKUP';
    return 'WALK-IN';
  };

  const getStatusStamp = () => {
    if (dueAmount <= 0) return 'PAID';
    if (paidAmount > 0) return 'DUE';
    return 'UNPAID';
  };

  const statusStamp = getStatusStamp();

  const getPaymentMethod = () => {
    switch (bill.paymentMode) {
      case 'Cash': return 'CASH';
      case 'UPI': return 'UPI';
      case 'Card': return 'CARD';
      case 'Credit': return 'CREDIT';
      default: return 'CASH';
    }
  };

  const showReturnSection = mappedReturnedItems.length > 0 || refundAmount > 0;

  // ✅ Shared column definition — single source of truth
  const COL = '1fr 22px 48px 52px';

  return (
    <div
      data-receipt-root="true"
      style={{
        width: '52mm',
        minHeight: 'unset',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '9px',
        color: '#000000',
        padding: '0 0 8px 0',
        boxSizing: 'border-box',
        textRendering: 'optimizeLegibility',
      }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '8px 8px 6px',
        borderBottom: '1px dashed #000000',
        textAlign: 'center',
      }}>
        {/* Logo image */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '4px',
        }}>
          <img
            src="/newlogo.png"
            alt="Saikat Enterprise"
            style={{
              width: '70px',
              height: '70px',
              objectFit: 'contain',
            }}
            crossOrigin="anonymous"
          />
        </div>

        {/* Shop name with decorative side lines */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          marginBottom: '3px',
        }}>
          <div style={{ flex: 1, borderTop: '1px solid #000' }} />
          <div style={{
            fontSize: '14px',
            fontWeight: '900',
            letterSpacing: '1px',
            whiteSpace: 'nowrap',
            padding: '0 4px',
          }}>
            {(settings.shopName || 'MY SHOP').toUpperCase()}
          </div>
          <div style={{ flex: 1, borderTop: '1px solid #000' }} />
        </div>

        <div style={{ fontSize: '8px', fontWeight: '400', color: '#000000', marginTop: '2px' }}>
          {settings.shopAddress || 'Shop Address'}
        </div>
        <div style={{ fontSize: '8px', fontWeight: '400', color: '#000000', marginTop: '1px' }}>
          Ph: {settings.shopPhone || '9876543210'}
        </div>
      </div>

      {/* ── BILL INFO ── */}
      <div style={{ padding: '4px 8px', fontSize: '8.5px', fontWeight: 'bold' }}>
        <div>INV: {bill.invoiceNumber}</div>
        <div>DATE: {dateStr} | TIME: {timeStr}</div>
      </div>

      {/* ── CUSTOMER ── */}
      <div style={{ padding: '4px 8px 5px', borderBottom: '1px dashed #000000', fontSize: '9px' }}>
        <div style={{ marginBottom: '2px' }}>
          <span style={{ fontWeight: 'bold' }}>Type:</span> <span style={{ fontWeight: 'bold' }}>{getCustomerType()}</span>
          {bill.billType === 'order' && bill.deliveryDate && (
            <span style={{ fontWeight: 'bold' }}> | Delivery: {new Date(bill.deliveryDate).toLocaleDateString('en-GB')}</span>
          )}
        </div>
        <div style={{ marginBottom: '1px' }}>
          <span style={{ fontWeight: 'bold' }}>Customer:</span> <span style={{ fontWeight: 'bold' }}>{bill.customerName || 'CASH'}</span>
        </div>
        {bill.phoneNumber && (
          <div style={{ marginTop: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>Mobile:</span> <span style={{ fontWeight: 'bold' }}>{bill.phoneNumber}</span>
          </div>
        )}
        {bill.customerEmail && (
          <div style={{ marginTop: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>Email:</span> <span style={{ fontWeight: 'bold' }}>{bill.customerEmail}</span>
          </div>
        )}
      </div>

      {/* ── ITEMS HEADER ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: COL,
        fontSize: '9px',
        fontWeight: '800',
        color: '#000000',
        backgroundColor: '#ffffff',
        padding: '3px 4px',
        borderTop: '1px solid #000000',
        borderBottom: '1.5px solid #000000',
        textTransform: 'uppercase',
      }}>
        <span>Item</span>
        <span style={{ textAlign: 'center' }}>Qty</span>
        <span style={{ textAlign: 'right' }}>Rate</span>
        <span style={{ textAlign: 'right' }}>Amount</span>
      </div>

      {/* ── ITEMS LIST ── */}
      {mappedItems.map((item, index) => (
        <div key={index} style={{
          display: 'grid',
          gridTemplateColumns: COL,
          fontSize: '8.5px',
          fontWeight: 'bold',
          color: '#000000',
          padding: '3px 4px',
          backgroundColor: '#ffffff',
          alignItems: 'start',
          borderBottom: '0.5px dashed #ccc',
        }}>
          <div style={{
            paddingRight: '3px',
            lineHeight: '1.45',
            wordBreak: 'break-word',
            fontSize: '8.5px',
            fontWeight: 'bold',
          }}>
            <div>
              {[item.productName, item.sizeName].filter(Boolean).join(' ')}
            </div>
          </div>
          <span style={{ textAlign: 'center', alignSelf: 'flex-start', paddingTop: '2px', fontSize: '8.5px', fontWeight: 'bold' }}>
            {formatQty(item.quantity, item.packaging)}
          </span>
          <span style={{ textAlign: 'right', alignSelf: 'flex-start', paddingTop: '2px', fontSize: '8.5px', fontWeight: 'bold' }}>
            ₹{Number(item.unitPrice).toFixed(2)}
          </span>
          <span style={{ textAlign: 'right', alignSelf: 'flex-start', paddingTop: '2px', fontSize: '8.5px', fontWeight: 'bold' }}>
            ₹{Number(item.totalPrice).toFixed(2)}
          </span>
        </div>
      ))}

      {/* ── RETURN ITEMS ── */}
      {showReturnSection && (
        <div style={{
          padding: '4px 8px',
          borderTop: '1px dashed #000000',
          borderBottom: '1px dashed #000000',
          backgroundColor: '#ffffff',
        }}>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#000000', marginBottom: '3px' }}>
            RETURNED ITEMS:
          </div>
          {mappedReturnedItems.map((item, index) => (
            <div key={index} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 22px 42px',
              fontSize: '7px',
              fontWeight: 'bold',
              marginBottom: '2px',
              color: '#000000',
              alignItems: 'start',
            }}>
              <span style={{
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '3px',
              }}>
                {item.productName} {item.sizeName}
              </span>
              <span style={{ textAlign: 'center', alignSelf: 'flex-start', paddingTop: '1px' }}>
                {formatQty(item.quantity, item.packaging)}
              </span>
              <span style={{ textAlign: 'right', alignSelf: 'flex-start', paddingTop: '1px' }}>
                ₹{Number(item.totalPrice).toFixed(2)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 'bold', marginTop: '4px' }}>
            <span>Refund Amount:</span>
            <span>₹{refundAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ── TOTALS ── */}
      <div style={{ padding: '5px 8px', borderTop: '1px dashed #000000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', padding: '1px 0' }}>
          <span style={{ fontWeight: 'bold' }}>Item Total</span>
          <span style={{ fontWeight: 'bold' }}>₹{itemTotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', padding: '1px 0' }}>
          <span style={{ fontWeight: 'bold' }}>Sub Total</span>
          <span style={{ fontWeight: 'bold' }}>₹{itemTotal.toFixed(2)}</span>
        </div>
        {discountAmount > 0 && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '8.5px',
              padding: '2px 0',
              color: '#cc0000',
              fontWeight: 'bold',
            }}>
              <span>Discount</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
            {/* Full width separator after discount */}
            <div style={{
              width: '100%',
              borderBottom: '1px dashed #000',
              margin: '2px 0',
            }} />
          </>
        )}
        {roundOff !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', padding: '1px 0' }}>
            <span style={{ fontWeight: 'bold' }}>Round Off</span>
            {/* ✅ Show + or - sign clearly */}
            <span style={{ fontWeight: 'bold' }}>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
          </div>
        )}

        {/* Grand Total */}
        <div style={{
          borderTop: '1.5px solid #000000',
          borderBottom: '1.5px solid #000000',
          padding: '5px 0',
          margin: '4px 0',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: '900' }}>
            <span>GRAND TOTAL</span>
            <span>₹{roundedTotal.toFixed(2)}</span>
          </div>
        </div>

        {paidAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', padding: '1px 0' }}>
            <span style={{ fontWeight: 'bold' }}>Paid Amount</span>
            <span style={{ fontWeight: 'bold' }}>₹{paidAmount.toFixed(2)}</span>
          </div>
        )}

        {dueAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', fontWeight: 'bold', color: '#cc0000', padding: '1px 0' }}>
            <span>Due Amount</span>
            <span>₹{dueAmount.toFixed(2)}</span>
          </div>
        )}

        {showReturnSection && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', fontWeight: 'bold',
            marginTop: '4px', padding: '3px', backgroundColor: '#ffffff', border: '1px solid #000000',
          }}>
            <span>FINAL AMOUNT</span>
            <span>₹{dueAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* ── AMOUNT IN WORDS ── */}
      <div style={{ padding: '4px 8px 4px', lineHeight: '1.45', borderTop: '1px dashed #000000' }}>
        {/* ✅ Fix: use Math.abs(roundedTotal) for words, handle paid/due correctly */}
        <span style={{ fontSize: '8px', fontWeight: 'bold' }}>Amt in Words: </span>
        <span style={{ fontSize: '8px', fontWeight: 'bold' }}>
          {numberToWords(Math.abs(dueAmount <= 0 ? roundedTotal : dueAmount))} Only
        </span>
      </div>

      {/* ── CHANGE GIVEN ── */}
      {bill.paymentMode === 'Cash' && changeGiven > 0 && (
        <div style={{ padding: '4px 8px 4px', fontSize: '8px', borderTop: '1px dashed #000000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Change Given</span>
            {/* ✅ Fix: was roundedTotal - cashReceived (negative), now cashReceived - roundedTotal */}
            <span style={{ fontWeight: 'bold' }}>₹{changeGiven.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ── STATUS STAMP ── */}
      <div style={{ textAlign: 'center', margin: '4px 8px 0', padding: '2px 0' }}>
        <span style={{
          fontSize: '12px',
          fontWeight: '900',
          color: statusStamp === 'PAID' ? '#166534' : statusStamp === 'DUE' ? '#9a3412' : '#991b1b',
          border: `2px solid ${statusStamp === 'PAID' ? '#166534' : statusStamp === 'DUE' ? '#9a3412' : '#991b1b'}`,
          padding: '3px 10px',
          borderRadius: '3px',
          display: 'inline-block',
          letterSpacing: '3px',
        }}>
          {statusStamp}
        </span>
      </div>

      {/* ── PAYMENT METHOD ── */}
      <div style={{
        marginTop: '6px', padding: '4px 8px', fontSize: '8px',
        textAlign: 'center', backgroundColor: '#ffffff',
        borderTop: '1px solid #000000', borderBottom: '1px solid #000000',
      }}>
        <span style={{ fontWeight: 'bold' }}>Payment:</span> <span style={{ fontWeight: 'bold' }}>{getPaymentTag(bill)}</span>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        marginTop: '8px',
        padding: '6px 8px 0px 8px',
        borderTop: '1px dashed #000000',
        textAlign: 'center',
        fontSize: '8px',
        fontWeight: 'bold',
        marginBottom: '0px',
        paddingBottom: '0px',
      }}>
        Thank You... Visit Again!
      </div>
    </div>
  );
}

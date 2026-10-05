'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerStore } from '@/store/useCustomerStore';
import { useBillStore } from '@/store/useBillStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { formatCurrency } from '@/lib/utils';
import { Search, Package, Calendar, User, Phone, ChevronRight, AlertCircle, CheckCircle, RotateCcw, IndianRupee, X } from 'lucide-react';
import { CustomerWithStats, Bill, BillItem } from '@/types';

export default function OrdersPage() {
  const router = useRouter();
  const { customers, initialize: initCustomers } = useCustomerStore();
  const { bills, initialize: initBills, forceRefresh: refreshBills } = useBillStore();
  const { shopName, initialize: initSettings } = useSettingsStore();
  const { forceRefresh: refreshInventory } = useInventoryStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partially_paid' | 'paid' | 'completed' | 'returned'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  
  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnOrder, setReturnOrder] = useState<Bill | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Bill | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  
  // Initialize data
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      await Promise.all([initBills(), initCustomers(), initSettings()]);
      setIsLoading(false);
    };
    initialize();
  }, [initBills, initCustomers, initSettings]);
  
  // Get customer by ID
  const getCustomerById = (customerId?: string): CustomerWithStats | undefined => {
    if (!customerId) return undefined;
    return customers.find(c => c.id === customerId);
  };
  
  // Filter orders (billType === 'order')
  const orders = useMemo(() => {
    return bills.filter(b => b.billType === 'order' || b.billType === undefined);
  }, [bills]);
  
  // Filter by status
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (statusFilter === 'all') return true;
      return order.status === statusFilter;
    });
  }, [orders, statusFilter]);
  
  // Filter by search
  const searchedOrders = useMemo(() => {
    if (!searchQuery) return filteredOrders;
    const query = searchQuery.toLowerCase();
    return filteredOrders.filter(order => {
      const customer = getCustomerById(order.customerId);
      return (
        order.invoiceNumber.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query) ||
        order.phoneNumber?.includes(query) ||
        customer?.phone?.includes(query)
      );
    });
  }, [filteredOrders, searchQuery, customers]);
  
  // Sort by delivery date (upcoming first)
  const sortedOrders = useMemo(() => {
    return [...searchedOrders].sort((a, b) => {
      // Active orders first (pending, partially_paid)
      const activeStatuses = ['pending', 'partially_paid'];
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      // Then by delivery date
      if (a.deliveryDate && b.deliveryDate) {
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      }
      if (a.deliveryDate) return -1;
      if (b.deliveryDate) return 1;
      
      // Then by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [searchedOrders]);
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid' };
      case 'partially_paid':
        return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial' };
      case 'pending':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Due' };
      case 'completed':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Completed' };
      case 'returned':
        return { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Returned' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
    }
  };
  
  // Check if delivery is overdue
  const isOverdue = (deliveryDate?: string) => {
    if (!deliveryDate) return false;
    return new Date(deliveryDate) < new Date(new Date().toDateString());
  };
  
  // Check if delivery is today
  const isToday = (deliveryDate?: string) => {
    if (!deliveryDate) return false;
    const today = new Date().toDateString();
    const delivery = new Date(deliveryDate).toDateString();
    return today === delivery;
  };
  
  // Check if delivery is tomorrow
  const isTomorrow = (deliveryDate?: string) => {
    if (!deliveryDate) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toDateString() === new Date(deliveryDate).toDateString();
  };
  
  // Get delivery date label
  const getDeliveryLabel = (deliveryDate?: string) => {
    if (!deliveryDate) return null;
    if (isToday(deliveryDate)) return { text: 'Today', color: 'text-red-600', bg: 'bg-red-100' };
    if (isTomorrow(deliveryDate)) return { text: 'Tomorrow', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (isOverdue(deliveryDate)) return { text: 'Overdue', color: 'text-red-600', bg: 'bg-red-100' };
    return { text: new Date(deliveryDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }), color: 'text-slate-600', bg: 'bg-slate-100' };
  };
  
  // Calculate remaining amount
  const getRemainingAmount = (order: Bill) => {
    const total = typeof order.totalAmount === 'number' ? order.totalAmount : parseFloat(order.totalAmount || '0');
    const outstanding = typeof order.outstandingAmount === 'number' ? order.outstandingAmount : parseFloat(order.outstandingAmount || '0');
    return Math.max(0, outstanding);
  };
  
  // Calculate paid amount
  const getPaidAmount = (order: Bill) => {
    const total = typeof order.totalAmount === 'number' ? order.totalAmount : parseFloat(order.totalAmount || '0');
    const outstanding = typeof order.outstandingAmount === 'number' ? order.outstandingAmount : parseFloat(order.outstandingAmount || '0');
    return total - outstanding;
  };
  
  // Calculate return refund amount
  const getReturnRefundAmount = () => {
    if (!returnOrder) return 0;
    let refund = 0;
    for (const item of returnOrder.items || []) {
      const returnQty = returnQuantities[item.id] || 0;
      if (returnQty > 0) {
        refund += returnQty * item.unitPrice;
      }
    }
    return refund;
  };
  
  // Handle open return modal
  const handleOpenReturnModal = (order: Bill) => {
    setReturnOrder(order);
    // Initialize return quantities to 0 for each item
    const initial: Record<string, number> = {};
    for (const item of order.items || []) {
      initial[item.id] = 0;
    }
    setReturnQuantities(initial);
    setShowReturnModal(true);
  };
  
  // Handle return items
  const handleReturnItems = async () => {
    if (!returnOrder) return;
    
    const refundAmount = getReturnRefundAmount();
    if (refundAmount <= 0) {
      alert('Please select items to return');
      return;
    }
    
    if (!confirm(`Return items and refund ${formatCurrency(refundAmount)}?`)) return;
    
    setProcessingOrder(returnOrder.id);
    try {
      // Parse numeric values properly
      const originalTotal = typeof returnOrder.totalAmount === 'number' ? returnOrder.totalAmount : parseFloat(returnOrder.totalAmount || '0');
      const originalOutstanding = typeof returnOrder.outstandingAmount === 'number' ? returnOrder.outstandingAmount : parseFloat(returnOrder.outstandingAmount || '0');
      const paidAmount = originalTotal - originalOutstanding;
      const newTotal = originalTotal - refundAmount;
      const newOutstanding = Math.max(0, newTotal - paidAmount);
      
      // Determine new status
      let newStatus = returnOrder.status;
      if (newOutstanding === 0 && paidAmount >= newTotal) {
        newStatus = 'completed';
      } else if (newOutstanding > 0) {
        newStatus = paidAmount > 0 ? 'partially_paid' : 'pending';
      }
      
      // Process each return item
      for (const item of returnOrder.items || []) {
        const returnQty = returnQuantities[item.id] || 0;
        if (returnQty > 0 && returnQty <= item.quantity) {
          // Restore stock - use productSizeId to find inventory
          try {
            // Get the product size to find bottlesPerCarton
            const productResponse = await fetch(`/api/products/${item.productId}`);
            const product = await productResponse.json();
            const size = product.sizes?.find((s: any) => s.id === item.sizeId);
            const bottlesPerCarton = size?.bottlesPerCarton || 12;
            
            await fetch(`/api/inventory/by-size/${item.sizeId}/stock`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quantity: item.packaging === 'carton' ? returnQty * bottlesPerCarton : returnQty,
                type: 'addition',
                note: `Return from order ${returnOrder.invoiceNumber}`,
              }),
            });
          } catch (e) {
            console.error('Stock restore error:', e);
          }
        }
      }
      
      // Record refund in customer payments (negative amount reduces outstanding)
      if (returnOrder.customerId) {
        await fetch(`/api/customers/${returnOrder.customerId}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: refundAmount,
            paymentMode: 'Cash',
            type: 'refund',
            note: `Refund for order ${returnOrder.invoiceNumber}`,
          }),
        });
      }
      
      // Update bill with new totals and status
      await fetch(`/api/bills/${returnOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: newTotal,
          outstandingAmount: newOutstanding,
          status: newStatus,
        }),
      });
      
      await refreshBills();
      await refreshInventory(); // Refresh inventory to show updated stock
      await initCustomers(); // Refresh customers to update outstanding balance
      setShowReturnModal(false);
      setReturnOrder(null);
    } catch (error) {
      console.error('Error returning items:', error);
      alert('Failed to return items');
    }
    setProcessingOrder(null);
  };
  
  // Handle record payment
  const handleRecordPayment = (order: Bill) => {
    setPaymentOrder(order);
    setPaymentAmount(getRemainingAmount(order));
    setShowPaymentModal(true);
  };
  
  // Submit payment
  const handleSubmitPayment = async () => {
    if (!paymentOrder || paymentAmount <= 0) return;
    
    setProcessingOrder(paymentOrder.id);
    try {
      // Record payment
      const response = await fetch(`/api/customers/${paymentOrder.customerId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          paymentMode: 'Cash',
          type: 'payment',
          note: `Payment for order ${paymentOrder.invoiceNumber}`,
        }),
      });
      
      if (response.ok) {
        // Update order status
        const newPaidAmount = (paymentOrder.cashReceived || 0) + paymentAmount;
        const newStatus = newPaidAmount >= paymentOrder.totalAmount ? 'paid' : 'partially_paid';
        
        await fetch(`/api/bills/${paymentOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus,
            cashReceived: newPaidAmount,
            outstandingAmount: Math.max(0, paymentOrder.totalAmount - newPaidAmount),
          }),
        });
        
        await refreshBills();
        await initCustomers(); // Refresh customers to update outstanding balance
        setShowPaymentModal(false);
        setPaymentOrder(null);
      } else {
        alert('Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
    setProcessingOrder(null);
  };
  
  // Handle mark as completed - generate final bill
  const handleMarkCompleted = async (order: Bill) => {
    if (!confirm(`Generate final bill for order ${order.invoiceNumber}?`)) return;
    
    setProcessingOrder(order.id);
    try {
      const response = await fetch(`/api/bills/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      
      if (response.ok) {
        await refreshBills();
        // Navigate to history page to show the final bill for sharing
        router.push('/history');
      } else {
        alert('Failed to update order');
      }
    } catch (error) {
      console.error('Error completing order:', error);
      alert('Failed to update order');
    }
    setProcessingOrder(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Return Modal */}
      {showReturnModal && returnOrder && (() => {
        const orderTotal = typeof returnOrder.totalAmount === 'number' ? returnOrder.totalAmount : parseFloat(returnOrder.totalAmount || '0');
        const refundAmount = getReturnRefundAmount();
        const finalAmount = orderTotal - refundAmount;
        const outstanding = typeof returnOrder.outstandingAmount === 'number' ? returnOrder.outstandingAmount : parseFloat(returnOrder.outstandingAmount || '0');
        const paidAmount = orderTotal - outstanding;
        const newOutstanding = finalAmount - paidAmount;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowReturnModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b bg-red-50">
                <h3 className="text-lg font-bold text-red-700">Return Items - Final Bill</h3>
                <button onClick={() => setShowReturnModal(false)} className="p-1 hover:bg-red-100 rounded">
                  <X className="w-5 h-5 text-red-600" />
                </button>
              </div>
              
              <div className="p-4 overflow-auto flex-1">
                <div className="flex justify-between items-center mb-4 p-2 bg-slate-100 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">Order:</span>
                  <span className="font-bold">{returnOrder.invoiceNumber}</span>
                </div>
                
                {/* Original Order Items */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-slate-700">Ordered Items</h4>
                    <span className="text-sm font-bold text-slate-700">Order Total: {formatCurrency(orderTotal)}</span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {returnOrder.items?.map((item) => {
                      const itemTotal = typeof item.totalPrice === 'number' ? item.totalPrice : parseFloat(item.totalPrice || '0');
                      return (
                        <div key={item.id} className="flex justify-between text-sm p-2 bg-white border border-slate-200 rounded">
                          <span>{item.productName} ({item.sizeName}) × {item.quantity}</span>
                          <span className="font-medium">{formatCurrency(itemTotal)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Return Selection */}
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Select Items to Return
                  </h4>
                  <div className="space-y-3">
                    {returnOrder.items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-slate-500">
                            {item.sizeName} • {formatCurrency(item.unitPrice)} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setReturnQuantities(prev => ({
                              ...prev,
                              [item.id]: Math.max(0, (prev[item.id] || 0) - 1)
                            }))}
                            className="w-8 h-8 rounded-full bg-red-200 text-red-700 flex items-center justify-center"
                            disabled={!returnQuantities[item.id]}
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold">
                            {returnQuantities[item.id] || 0}
                          </span>
                          <button
                            onClick={() => setReturnQuantities(prev => ({
                              ...prev,
                              [item.id]: Math.min(item.quantity, (prev[item.id] || 0) + 1)
                            }))}
                            className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center"
                            disabled={(returnQuantities[item.id] || 0) >= item.quantity}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Return Summary */}
                {refundAmount > 0 && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <h4 className="text-sm font-bold text-orange-700 mb-2">Returned Items Value</h4>
                    <div className="space-y-1">
                      {returnOrder.items?.filter(item => returnQuantities[item.id] > 0).map(item => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span>{item.productName} ({item.sizeName}) × {returnQuantities[item.id]}</span>
                          <span>{formatCurrency(item.unitPrice * returnQuantities[item.id])}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Final Bill Calculation */}
                <div className="p-4 bg-gradient-to-r from-primary/10 to-green-50 border-2 border-primary/30 rounded-xl">
                  <h4 className="text-sm font-bold text-primary mb-3">Final Bill Calculation</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Order Total</span>
                      <span className="font-medium">{formatCurrency(orderTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Less: Returned Items</span>
                      <span className="font-medium">-{formatCurrency(refundAmount)}</span>
                    </div>
                    <div className="border-t border-primary/20 pt-2 flex justify-between text-lg">
                      <span className="font-bold">Final Amount</span>
                      <span className="font-bold text-primary">{formatCurrency(finalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500 pt-2 border-t border-slate-200">
                      <span>Already Paid</span>
                      <span className="font-medium">{formatCurrency(Math.max(0, paidAmount))}</span>
                    </div>
                    {newOutstanding > 0 ? (
                      <div className="flex justify-between text-sm text-red-600 font-bold pt-2 border-t border-red-200">
                        <span>New Outstanding</span>
                        <span>{formatCurrency(newOutstanding)}</span>
                      </div>
                    ) : newOutstanding < 0 ? (
                      <div className="flex justify-between text-sm text-green-600 font-bold pt-2 border-t border-green-200">
                        <span>Refund Due to Customer</span>
                        <span>{formatCurrency(Math.abs(newOutstanding))}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm text-green-600 font-bold pt-2 border-t border-green-200">
                        <span>✓ Fully Paid</span>
                        <span>No Outstanding</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t bg-slate-50">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReturnModal(false)}
                    className="flex-1 py-3 border border-slate-300 text-slate-600 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReturnItems}
                    disabled={processingOrder !== null || refundAmount <= 0}
                    className={`flex-1 py-3 rounded-lg font-medium disabled:opacity-50 ${
                      refundAmount > 0 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-slate-300 text-slate-500'
                    }`}
                  >
                    {processingOrder ? 'Processing...' : refundAmount > 0 ? 'Confirm Return' : 'Select Items to Return'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      
      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPaymentModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold mb-4">Record Payment</h3>
            <p className="text-sm text-slate-500 mb-4">
              Order: {paymentOrder.invoiceNumber}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Amount
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
              <p className="text-xs text-slate-500 mt-1">
                Remaining: {formatCurrency(getRemainingAmount(paymentOrder))}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={processingOrder !== null}
                className="flex-1 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
              >
                {processingOrder ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Orders</h1>
              <p className="text-sm text-slate-500">{shopName || 'Store'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total Orders</p>
              <p className="text-xl font-bold text-primary">{orders.length}</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice, customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Due' },
              { key: 'partially_paid', label: 'Partial' },
              { key: 'paid', label: 'Paid' },
              { key: 'completed', label: 'Completed' },
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === filter.key
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Orders List */}
      <div className="p-4 space-y-3">
        {sortedOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No orders found</p>
            {searchQuery && (
              <p className="text-sm text-slate-400 mt-1">Try adjusting your search</p>
            )}
          </div>
        ) : (
          sortedOrders.map((order) => {
            const customer = getCustomerById(order.customerId);
            const statusBadge = getStatusBadge(order.status);
            const deliveryLabel = getDeliveryLabel(order.deliveryDate);
            const remaining = getRemainingAmount(order);
            const isActive = ['pending', 'partially_paid', 'paid'].includes(order.status);
            const isFullyPaid = remaining <= 0 && order.status === 'paid';
            const isProcessing = processingOrder === order.id;
            
            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border ${
                  isOverdue(order.deliveryDate ?? undefined) && isActive && remaining > 0
                    ? 'border-red-200'
                    : 'border-slate-200'
                } p-4`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800">{order.invoiceNumber}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                        {statusBadge.label}
                      </span>
                      {isOverdue(order.deliveryDate ?? undefined) && isActive && remaining > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{formatCurrency(order.totalAmount)}</p>
                    {getPaidAmount(order) > 0 && (
                      <p className="text-xs text-green-600">
                        Paid: {formatCurrency(getPaidAmount(order))}
                      </p>
                    )}
                    {remaining > 0 && (
                      <p className="text-xs text-red-500">
                        Remaining: {formatCurrency(remaining)}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Customer */}
                {(order.customerName || customer) && (
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{order.customerName || customer?.name}</span>
                    {(order.phoneNumber || customer?.phone) && (
                      <>
                        <span className="text-slate-300">•</span>
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500">{order.phoneNumber || customer?.phone}</span>
                      </>
                    )}
                  </div>
                )}
                
                {/* Delivery Date */}
                {order.deliveryDate && deliveryLabel && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${deliveryLabel.bg} mb-3`}>
                    <Calendar className={`w-4 h-4 ${deliveryLabel.color}`} />
                    <span className={`text-sm font-medium ${deliveryLabel.color}`}>
                      Delivery: {deliveryLabel.text}
                    </span>
                    <span className="text-xs text-slate-500 ml-auto">
                      {new Date(order.deliveryDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                
                {/* Items Summary */}
                {order.items && order.items.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs text-slate-500 mb-2">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">
                            {item.quantity}x {item.productName} ({item.sizeName})
                          </span>
                          <span className="text-slate-500">{formatCurrency(item.totalPrice)}</span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-xs text-slate-400">
                          +{order.items.length - 3} more items
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                {isActive ? (
                  <div className="flex gap-2 mt-3">
                    {/* Record Payment Button */}
                    {remaining > 0 && (
                      <button
                        onClick={() => handleRecordPayment(order)}
                        disabled={isProcessing}
                        className="flex-1 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <IndianRupee className="w-4 h-4" />
                        {isProcessing ? '...' : 'Payment'}
                      </button>
                    )}
                    
                    {/* Generate Final Bill Button - Only enabled when fully paid */}
                    <button
                      onClick={() => handleMarkCompleted(order)}
                      disabled={isProcessing || !isFullyPaid}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                        isFullyPaid
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      title={!isFullyPaid ? 'Full payment required before completing' : 'Complete order'}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isProcessing ? '...' : 'Generate Bill'}
                    </button>
                    
                    {/* Return Items Button */}
                    <button
                      onClick={() => handleOpenReturnModal(order)}
                      disabled={isProcessing}
                      className="flex-1 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {isProcessing ? '...' : 'Return'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => router.push(`/billing?order=${order.id}`)}
                    className="w-full mt-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, CreditCard, Receipt, IndianRupee, Loader2, Package, Calendar, Pencil, Trash2 } from 'lucide-react';
import { CustomerWithStats, CustomerPayment, Bill } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { ChevronRight } from 'lucide-react';
import { CUSTOMER_TYPES, getBalanceStatus } from '@/lib/constants/customerConstants';
import { ManageDueModal } from './ManageDueModal';
import { BillDetailsModal } from '@/components/billing/BillDetailsModal';

interface CustomerDetailModalProps {
  customer: CustomerWithStats;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onRecordPayment?: (customerId: string, payment: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

type Tab = 'overview' | 'payments' | 'bills';

export function CustomerDetailModal({
  customer,
  isOpen,
  onClose,
  onUpdate,
  onRecordPayment,
  onDelete,
}: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [showManageDue, setShowManageDue] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerWithStats>(customer);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const { addToast } = useToast();

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(customer.name || '');
  const [editPhone, setEditPhone] = useState(customer.phone || '');
  const [nameError, setNameError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Fetch full customer data when opened
  useEffect(() => {
    if (isOpen && customer?.id) {
      fetchCustomerData();
    }
  }, [isOpen, customer?.id]);
  
  const fetchCustomerData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/customers/${customer.id}`);
      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
        setEditName(data.name || '');
        setEditPhone(data.phone || '');
        setPayments(data.payments || []);
        setBills(data.bills || []);
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const typeConfig = CUSTOMER_TYPES[customerData.customerType] || CUSTOMER_TYPES.regular;
  const balanceStatus = getBalanceStatus(customerData.outstandingBalance);
  
  const balanceColor = {
    clear: 'text-green-600',
    has_balance: 'text-amber-600',
  }[balanceStatus];
  
  const handlePaymentRecorded = async () => {
    await fetchCustomerData();
    if (onUpdate) await onUpdate(customer.id, customerData);
    setShowManageDue(false);
  };
  
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      setNameError('Name is required');
      return;
    }
    setNameError('');
    setIsSaving(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editName.trim(),
          phone: editPhone.trim() 
        })
      });
      if (!response.ok) throw new Error('Failed to update customer');
      
      const updated = await response.json();
      setCustomerData(prev => ({ ...prev, ...updated }));
      addToast('success', 'Customer updated successfully');
      setIsEditing(false);
      if (onUpdate) await onUpdate(customer.id, updated);
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to update customer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE'
      });
      if (!response.ok && response.status !== 404) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete customer');
      }
      
      addToast('success', 'Customer deleted successfully');
      if (onDelete) await onDelete(customer.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      addToast('error', err.message || 'Failed to delete customer');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Separate bills into sales and orders
  const salesBills = bills.filter(b => b.billType === 'sale' || !b.billType);
  const orderBills = bills.filter(b => b.billType === 'order');
  
  // Get status color for bill
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partially_paid': return 'bg-amber-100 text-amber-700';
      case 'pending': return 'bg-red-100 text-red-700';
      case 'cancelled': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'partially_paid': return 'Partial';
      case 'pending': return 'Due';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{customerData.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${typeConfig.badgeColor}`}>
                    {typeConfig.label}
                  </span>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded"
                    title="Edit Customer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === 'overview'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === 'payments'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500'
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === 'bills'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-slate-500'
              }`}
            >
              Sales & Orders
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : activeTab === 'overview' ? (
              <div className="space-y-4">
                {/* Edit Form */}
                {isEditing && (
                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value);
                            if (e.target.value.trim()) setNameError('');
                          }}
                          className={`w-full h-10 px-3 rounded-lg border-[1.5px] text-[15px] font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                            nameError ? 'border-red-500' : 'border-[#16a34a]'
                          }`}
                        />
                        {nameError && <p className="text-[11px] text-red-500 mt-1 font-medium">{nameError}</p>}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="Enter phone number"
                          className="w-full h-10 px-3 rounded-lg border-[1.5px] border-[#e5e7eb] text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setIsEditing(false);
                            setEditName(customerData.name || '');
                            setEditPhone(customerData.phone || '');
                            setNameError('');
                          }}
                          className="flex-1 h-10 bg-white border border-[#e5e7eb] rounded-lg text-[14px] font-medium hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSaving}
                          className="flex-1 h-10 bg-[#16a34a] text-white rounded-lg text-[14px] font-semibold hover:bg-[#15803d] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Financial Summary */}
                <div className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-600 mb-3">Financial Summary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Total Purchases</p>
                      <p className="text-lg font-bold">{formatCurrency(customerData.totalPurchases)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Paid</p>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(customerData.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Outstanding Balance</p>
                      <p className={`text-lg font-bold ${balanceColor}`}>
                        {formatCurrency(customerData.outstandingBalance)}
                      </p>
                    </div>

                  </div>
                </div>
                
                {/* Contact Info */}
                <div>
                  <h3 className="text-sm font-bold text-slate-600 mb-3">Contact Information</h3>
                  <div className="space-y-2">
                    {customerData.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{customerData.phone}</span>
                      </div>
                    )}
                    {customerData.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span>{customerData.email}</span>
                      </div>
                    )}
                    {customerData.address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{customerData.address}</span>
                      </div>
                    )}
                    {!customerData.phone && !customerData.email && !customerData.address && (
                      <p className="text-sm text-slate-400">No contact information</p>
                    )}
                  </div>
                </div>
                
                {/* Manage Due Button */}
                {customerData.outstandingBalance > 0 && (
                  <button
                    onClick={() => setShowManageDue(true)}
                    className="w-full py-3 bg-primary text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <IndianRupee className="w-4 h-4" />
                    Record Payment
                  </button>
                )}
              </div>
            ) : activeTab === 'payments' ? (
              <div className="space-y-2">
                {payments.length > 0 ? (
                  payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {payment.type === 'payment' && 'Payment Received'}
                          {payment.type === 'refund' && 'Refund Issued'}
                          {payment.type === 'credit' && 'Credit Added'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {payment.paymentMode} • {new Date(payment.createdAt).toLocaleDateString('en-IN')}
                        </p>
                        {payment.note && (
                          <p className="text-xs text-slate-400 mt-1">{payment.note}</p>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${
                        payment.type === 'payment' ? 'text-green-600' :
                        payment.type === 'refund' ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {payment.type === 'payment' ? '+' : payment.type === 'refund' ? '+' : '-'}
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-400 py-8">No payment history</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Sales Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Sales History ({salesBills.length})
                  </h3>
                  <div className="space-y-2">
                    {salesBills.length > 0 ? (
                      salesBills.map((bill) => (
                        <div
                          key={bill.id}
                          onClick={() => setSelectedBillId(bill.id)}
                          className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer rounded-lg transition-colors group"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{bill.invoiceNumber}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(bill.status)}`}>
                                {getStatusLabel(bill.status)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(bill.createdAt).toLocaleDateString('en-IN')} • {bill.paymentMode}
                            </p>
                            {bill.items && bill.items.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1">
                                {bill.items.length} item{bill.items.length > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm font-bold">{formatCurrency(bill.totalAmount)}</p>
                              {(bill.status === 'partially_paid' || bill.status === 'pending') && (
                                <p className="text-xs text-red-500">
                                  Due: {formatCurrency(bill.outstandingAmount || 0)}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary shrink-0" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-400 py-4">No sales history</p>
                    )}
                  </div>
                </div>
                
                {/* Orders Section */}
                <div>
                  <h3 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Orders ({orderBills.length})
                  </h3>
                  <div className="space-y-2">
                    {orderBills.length > 0 ? (
                      orderBills.map((bill) => (
                        <div
                          key={bill.id}
                          onClick={() => setSelectedBillId(bill.id)}
                          className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 cursor-pointer rounded-lg transition-colors group"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{bill.invoiceNumber}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(bill.status)}`}>
                                {getStatusLabel(bill.status)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {new Date(bill.createdAt).toLocaleDateString('en-IN')} • {bill.paymentMode}
                            </p>
                            {bill.deliveryDate && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Delivery: {new Date(bill.deliveryDate).toLocaleDateString('en-IN')}
                              </p>
                            )}
                            {bill.items && bill.items.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1">
                                {bill.items.length} item{bill.items.length > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-sm font-bold">{formatCurrency(bill.totalAmount)}</p>
                              {(bill.cashReceived ?? 0) > 0 && (
                                <p className="text-xs text-green-600">
                                  Paid: {formatCurrency(bill.cashReceived || 0)}
                                </p>
                              )}
                              {(bill.status === 'partially_paid' || bill.status === 'pending') && (
                                <p className="text-xs text-red-500">
                                  Due: {formatCurrency(bill.outstandingAmount || 0)}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-amber-300 group-hover:text-amber-600 shrink-0" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-400 py-4">No orders</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-slate-200">
            {customerData.outstandingBalance > 0 ? (
              <div className="relative group">
                <button
                  disabled
                  className="w-full h-[44px] bg-white border-[1.5px] border-[#9ca3af] text-[#9ca3af] rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-2 opacity-40 cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Customer
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-10 text-center">
                  Clear outstanding balance before deleting
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full h-[44px] bg-white border-[1.5px] border-[#dc2626] text-[#dc2626] rounded-[10px] font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Customer
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Manage Due Modal */}
      {showManageDue && (
        <ManageDueModal
          customerId={customerData.id}
          currentBalance={customerData.outstandingBalance}
          customerName={customerData.name}
          dueBills={bills.filter(b => b.status === 'pending' || b.status === 'partially_paid')}
          onClose={() => setShowManageDue(false)}
          onSuccess={handlePaymentRecorded}
        />
      )}
      
      {/* Bill Details Modal */}
      {selectedBillId && (
        <BillDetailsModal
          billId={selectedBillId}
          isOpen={!!selectedBillId}
          onClose={() => setSelectedBillId(null)}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !isDeleting && setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <h3 className="text-lg font-bold mb-2 text-slate-800">Delete Customer</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{customerData.name}</span>? This action cannot be undone. All their bill history will be preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 h-[44px] bg-white border border-[#e5e7eb] text-[#374151] rounded-[10px] font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 h-[44px] bg-[#dc2626] text-white rounded-[10px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

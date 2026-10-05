'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProductStore, addSampleProducts } from '@/store/useProductStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useToast } from '@/components/Toast';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { DataFreshness } from '@/components/ui/DataFreshness';
import { Search, Plus, Package, AlertCircle, CheckCircle, XCircle, Filter, Pin, Trash2, Home, Menu } from 'lucide-react';
import { Product, SKU, StockStatus } from '@/types';
import { formatStock } from '@/lib/utils';
import { MobileAvatar } from '@/components/layout/MobileAvatar';
const PRODUCT_ICONS = [
  { name: 'Cola', emoji: '🥤' },
  { name: 'Mango', emoji: '🥭' },
  { name: 'Lemon', emoji: '🍋' },
  { name: 'Orange', emoji: '🍊' },
  { name: 'Juice', emoji: '🧃' },
  { name: 'Jeera', emoji: '🌿' },
  { name: 'Nimbu', emoji: '🍈' },
  { name: 'Thumps Up', emoji: '👍' },
  { name: 'Water', emoji: '💧' },
  { name: 'Bottle', emoji: '🫙' },
  { name: 'Energy', emoji: '⚡' },
  { name: 'Soda', emoji: '🫚' },
  { name: 'Other', emoji: '📦' },
];

export default function InventoryPage() {
  const router = useRouter();
  const { products, initializeFromStorage: initProducts } = useProductStore();
  const {
    inventory,
    searchQuery,
    filterStatus,
    setSearchQuery,
    setFilterStatus,
    addStock,
    removeSku,
    togglePin,
    clearStock,
    getFilteredInventory,
    getInventoryStats,
    initializeFromStorage: initInventory,
    forceRefresh,
    isLoading: inventoryLoading,
    lastSyncedAt
  } = useInventoryStore();
  const { addToast } = useToast();

  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [stockType, setStockType] = useState<'bottles' | 'cartons'>('cartons');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmSku, setDeleteConfirmSku] = useState<SKU | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Soft Drinks');

  const CATEGORIES = ['Soft Drinks', 'Juices', 'Water', 'Energy Drinks', 'Others', 'All'];

  const { ownerName } = useSettingsStore();

  const getInitials = () => {
    if (ownerName) {
      return ownerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'SE';
  };

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([initProducts(), initInventory()]);
      setIsLoading(false);

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('filter') === 'low') {
          setFilterStatus('Low Stock');
        }
      }
    };
    initialize();
  }, [initProducts, initInventory, setFilterStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    };

    if (isTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeDropdownOpen]);

  // Refetch on focus - 60 second stale time
  const handleInventoryRefetch = useCallback(() => {
    return forceRefresh();
  }, [forceRefresh]);

  useRefetchOnFocus({
    onRefetch: handleInventoryRefetch,
    staleTime: 60000, // 60 seconds
  });

  // Add sample products if inventory is empty
  useEffect(() => {
    if (!isLoading && products.length > 0 && inventory.length === 0) {
      addSampleProducts();
    }
  }, [isLoading, products.length, inventory.length]);

  // Get filtered and sorted inventory (pinned items first)
  const getInventoryWithPinned = () => {
    let filtered = getFilteredInventory();

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(sku => {
        if (sku.category) return sku.category === selectedCategory;
        if (sku.productId) {
          const product = getProductForSku(sku.productId);
          if (product) return product.category === selectedCategory;
        }
        return false;
      });
    }

    const pinned = filtered.filter(sku => sku.isPinned).sort((a, b) => {
      // Sort oldest pin at very top (ascending pinnedAt)
      if (a.pinnedAt && b.pinnedAt) {
        return new Date(a.pinnedAt).getTime() - new Date(b.pinnedAt).getTime();
      }
      return 0;
    });
    const unpinned = filtered.filter(sku => !sku.isPinned).sort((a, b) => {
      const nameA = a.productName || '';
      const nameB = b.productName || '';
      return nameA.localeCompare(nameB);
    });
    return [...pinned, ...unpinned];
  };

  const filteredInventory = getInventoryWithPinned();
  const stats = getInventoryStats();

  const getProductForSku = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const getSizeForSku = (productId: string, sizeId: string) => {
    const product = getProductForSku(productId);
    return product?.sizes.find(s => s.id === sizeId);
  };

  const handleOpenAddStock = (sku: SKU) => {
    setSelectedSku(sku);
    setStockQuantity(0);
    setStockType('cartons');
    setNotes('');
    setIsAddStockModalOpen(true);
  };

  const handleAddStock = () => {
    if (!selectedSku || stockQuantity <= 0) {
      addToast('error', 'Please enter a valid quantity');
      return;
    }

    addStock(selectedSku.id, stockQuantity, stockType, undefined, notes || undefined);
    addToast('success', 'Stock added successfully');
    setIsAddStockModalOpen(false);
  };

  const handlePinToggle = async (skuId: string) => {
    try {
      await togglePin(skuId);
      const sku = inventory.find(s => s.id === skuId);
      if (sku) {
        if (!sku.isPinned) {
          addToast('success', 'Pinned to top');
        } else {
          addToast('success', 'Unpinned');
        }
      }
    } catch (error) {
      addToast('error', 'Failed to toggle pin');
    }
  };

  const handleDeleteSku = async (sku: SKU) => {
    try {
      await clearStock(sku.id);
      addToast('success', `Stock cleared for ${sku.productName || sku.skuCode}`);
      setDeleteConfirmSku(null);
    } catch (error) {
      addToast('error', 'Failed to clear stock');
    }
  };

  const getStatusColor = (status: StockStatus) => {
    switch (status) {
      case 'Healthy':
        return 'bg-green-100 text-green-700';
      case 'Low Stock':
        return 'bg-amber-100 text-amber-700';
      case 'Out of Stock':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusIcon = (status: StockStatus) => {
    switch (status) {
      case 'Healthy':
        return CheckCircle;
      case 'Low Stock':
        return AlertCircle;
      case 'Out of Stock':
        return XCircle;
      default:
        return Package;
    }
  };

  const StatusIcon = (status: StockStatus) => {
    const Icon = getStatusIcon(status);
    return <Icon className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-20 lg:pb-6">
        <div className="skeleton h-8 w-48 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 lg:pb-6 px-4 lg:px-0">
      {/* Header */}
      <header className="mb-2 md:mb-0 md:flex md:items-start md:justify-between md:gap-3">
        <div className="flex items-center justify-between mb-1 md:mb-0 md:flex-none">
          {/* Hamburger menu for mobile */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-sidebar'));
              }
            }}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 text-center md:text-left md:flex md:items-center md:gap-3 md:min-w-0">
            <div className="hidden md:block bg-primary/10 p-2 rounded-lg shrink-0">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">
                <span className="md:hidden">Inventory</span>
                <span className="hidden md:inline">Cold Drinks Inventory</span>
              </h1>
              <p className="hidden md:block text-sm text-slate-500 leading-snug">Manage beverage stock and SKUs</p>
            </div>
          </div>

          {/* Desktop Data Freshness */}
          <div className="hidden md:block shrink-0 ml-auto">
            <DataFreshness
              lastSyncedAt={lastSyncedAt}
              onRefresh={forceRefresh}
              isLoading={inventoryLoading}
            />
          </div>

          {/* Mobile Avatar */}
          <MobileAvatar />
        </div>
        <p className="text-xs text-slate-500 leading-snug text-center w-full truncate md:hidden">Manage beverage stock and SKUs</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-4 -mx-4 px-4 md:mx-0 md:px-0 !mb-2">
        <button
          onClick={() => setFilterStatus(filterStatus === 'Healthy' ? 'all' : 'Healthy')}
          className={`col-span-1 md:col-span-1 px-3 py-2 md:p-4 rounded-full md:rounded-xl border flex items-center gap-2 md:gap-4 transition-colors outline-none focus:ring-2 focus:ring-primary/20 ${filterStatus === 'Healthy' ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <div className="size-6 md:size-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
            <CheckCircle className="w-3.5 h-3.5 md:w-6 md:h-6" />
          </div>
          <div className="flex md:flex-col items-center md:items-start gap-1.5 md:gap-0 min-w-0">
            <p className="text-[12px] md:text-sm text-slate-500 truncate">Healthy</p>
            <p className="text-[14px] md:text-2xl font-bold font-mono">{stats.healthy} <span className="hidden md:inline">products</span></p>
          </div>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === 'Low Stock' ? 'all' : 'Low Stock')}
          className={`col-span-1 md:col-span-1 px-3 py-2 md:p-4 rounded-full md:rounded-xl border flex items-center gap-2 md:gap-4 transition-colors outline-none focus:ring-2 focus:ring-primary/20 ${filterStatus === 'Low Stock' ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <div className="size-6 md:size-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 md:w-6 md:h-6" />
          </div>
          <div className="flex md:flex-col items-center md:items-start gap-1.5 md:gap-0 min-w-0">
            <p className="text-[12px] md:text-sm text-slate-500 truncate">Low</p>
            <p className="text-[14px] md:text-2xl font-bold font-mono">{stats.lowStock} <span className="hidden md:inline">products</span></p>
          </div>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === 'Out of Stock' ? 'all' : 'Out of Stock')}
          className={`col-span-2 md:col-span-1 px-3 py-2 md:p-4 rounded-full md:rounded-xl border flex items-center gap-2 md:gap-4 transition-colors outline-none focus:ring-2 focus:ring-primary/20 ${filterStatus === 'Out of Stock' ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <div className="size-6 md:size-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <XCircle className="w-3.5 h-3.5 md:w-6 md:h-6" />
          </div>
          <div className="flex md:flex-col items-center md:items-start gap-1.5 md:gap-0 min-w-0">
            <p className="text-[12px] md:text-sm text-slate-500 truncate">Out of Stock</p>
            <p className="text-[14px] md:text-2xl font-bold font-mono">{stats.outOfStock} <span className="hidden md:inline">products</span></p>
          </div>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4 !mt-0 md:!mt-6 !mb-0">
        <div className="flex flex-col gap-2 md:gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 md:pl-11 pr-3 py-2 md:py-3 h-11 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm md:text-base"
            />
          </div>
          <div className="hidden md:flex items-center w-full shrink-0">
            <Filter className="hidden md:block w-5 h-5 text-slate-500 mr-2" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="w-full h-10 md:h-11 px-2 md:px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs md:text-base font-medium hover:border-primary focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
            >
              <option value="all">All Inventory</option>
              <option value="Healthy">Healthy</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Category Pills */}
      <div className="flex lg:hidden overflow-x-auto gap-2 pb-1 hide-scrollbar -mx-4 px-4 !mt-[8px] !mb-[5px]">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border shrink-0 ${selectedCategory === category
              ? 'bg-primary border-primary text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Desktop Table - Hidden on mobile */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Threshold</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length > 0 ? (
                filteredInventory.map((sku) => {
                  const isPinned = sku.isPinned;

                  return (
                    <tr key={sku.id} className={`hover:bg-slate-50 transition-colors ${isPinned ? 'bg-[#f0fdf4] border-l-[3px] border-[#16a34a]' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded bg-slate-100 flex items-center justify-center overflow-hidden">
                            {sku.imageUrl && (() => {
                              const iconObj = PRODUCT_ICONS.find(i => i.name === sku.imageUrl);
                              return iconObj ? <span className="text-[20px]">{iconObj.emoji}</span> : <Package className="w-5 h-5 text-slate-400" />;
                            })()}
                            {!sku.imageUrl && (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{sku.productName || 'Unknown'}</p>
                              {isPinned && (
                                <span className="px-1.5 py-0.5 rounded-md bg-[#f0fdf4] border border-[#16a34a]/20 text-[#16a34a] text-[10px] font-bold">
                                  Pinned
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{sku.brand || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{sku.sizeName || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold font-mono">
                            {formatStock(sku.currentStock, sku.bottlesPerCarton)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">{formatStock(sku.lowStockThreshold || 0, sku.bottlesPerCarton)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sku.status)}`}>
                          {StatusIcon(sku.status)}
                          {sku.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePinToggle(sku.id)}
                            className={`p-2 rounded-lg transition-colors ${isPinned ? 'bg-[#16a34a] text-white' : 'text-[#9ca3af] hover:text-[#16a34a] hover:bg-[#16a34a]/10'}`}
                            title={isPinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin className={`w-5 h-5 ${isPinned ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmSku(sku)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Clear Stock"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleOpenAddStock(sku)}
                            className="px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors text-sm font-medium"
                          >
                            + Add Stock
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-2" />
                    <p>No inventory items found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {filteredInventory.length} of {inventory.length} SKUs
          </p>
        </div>
      </div>

      {/* Mobile Card Layout - Visible only on mobile */}
      <div className="lg:hidden space-y-2.5 !mt-[5px]">
        {filteredInventory.length > 0 ? (
          filteredInventory.map((sku) => {
            const isPinned = sku.isPinned;

            return (
              <div key={sku.id} className={`bg-white rounded-xl border border-slate-200 p-3 ${isPinned ? 'bg-[#f0fdf4] border-l-[3px] border-[#16a34a]' : ''}`}>
                {/* ROW 1: [icon] [Name] [Status] */}
                <div className="flex items-center justify-between gap-2 mb-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="size-9 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                      {sku.imageUrl && (() => {
                        const iconObj = PRODUCT_ICONS.find(i => i.name === sku.imageUrl);
                        return iconObj ? <span className="text-[20px]">{iconObj.emoji}</span> : <Package className="w-5 h-5 text-slate-400" />;
                      })()}
                      {!sku.imageUrl && (
                        <Package className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <p className="text-[15px] font-bold truncate text-slate-900">
                      {sku.productName || 'Unknown'}
                    </p>
                  </div>
                  <span className={`shrink-0 flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold w-auto max-w-fit truncate ${getStatusColor(sku.status)}`}>
                    {sku.status}
                  </span>
                </div>

                {/* ROW 2: Size pill */}
                <div className="ml-11 mt-[2px]">
                  <span
                    style={{
                      fontSize: '11px',
                      paddingTop: '2px',
                      paddingBottom: '2px',
                      paddingLeft: '8px',
                      paddingRight: '8px',
                      border: '1px solid #085283ff',
                      color: '#1b6996ff',
                      borderRadius: '9999px',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                      lineHeight: '1.4',
                    }}
                    className="font-medium"
                  >
                    {sku.sizeName || 'Unknown'}
                  </span>
                </div>

                {/* ROW 3: Stock count | Pin | Delete */}
                <div className="flex items-center justify-between mt-[2px]">
                  <div className="text-[14px] font-normal text-[#111] ml-11">
                    {formatStock(sku.currentStock, sku.bottlesPerCarton)}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => handlePinToggle(sku.id)}
                      className="transition-colors flex items-center justify-center"
                    >
                      <Pin className={`w-4 h-4 ${isPinned ? 'text-[#16a34a] fill-current' : 'text-[#9ca3af] hover:text-[#16a34a]'}`} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmSku(sku)}
                      className="text-red-400 hover:text-red-500 transition-colors flex items-center justify-center"
                      title="Clear Stock"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ROW 4: Add Stock full width */}
                <button
                  onClick={() => handleOpenAddStock(sku)}
                  className="w-full h-9 mt-2 rounded-lg bg-[#f0fdf4] border border-[#16a34a] text-[#16a34a] hover:bg-primary/10 transition-colors text-[13px] font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Stock
                </button>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">No inventory items found</p>
          </div>
        )}

        {/* Mobile Pagination */}
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <p className="text-[11px] text-slate-500 text-center font-medium">
            Showing {filteredInventory.length} of {inventory.length} SKUs
          </p>
        </div>
      </div>

      {/* Add Stock Modal */}
      {isAddStockModalOpen && selectedSku && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[20px] md:rounded-2xl pt-[20px] px-[16px] pb-[32px] md:p-0 shadow-2xl mt-auto md:mt-0">
            {/* Drag Handle (Mobile) */}
            <div className="w-[40px] h-[4px] bg-[#e5e7eb] rounded-sm mx-auto mb-4 md:hidden" />

            <div className="md:p-6 md:border-b md:border-slate-100 flex justify-between items-center mb-[14px] md:mb-0">
              <h3 className="text-[17px] font-semibold md:text-lg md:font-bold">Add Stock</h3>
              <button
                onClick={() => setIsAddStockModalOpen(false)}
                className="text-[20px] text-[#6b7280] md:text-slate-400 hover:text-slate-600 p-1 md:p-1"
              >
                ✕
              </button>
            </div>

            <div className="md:p-6 md:space-y-4">
              <div className="bg-[#f9fafb] rounded-[8px] p-[10px] px-[12px] mb-[14px] md:bg-transparent md:p-0 md:mb-0">
                <p className="text-[10px] uppercase font-bold text-[#9ca3af] md:text-xs md:text-slate-500 mb-1">Product</p>
                <p className="text-[15px] font-semibold text-[#111] md:font-medium md:text-base">
                  {selectedSku.productName || 'Unknown'} - {selectedSku.sizeName || 'Unknown'}
                </p>
              </div>

              <div className="mb-[14px] md:mb-0">
                <label className="block text-[10px] uppercase font-bold text-[#9ca3af] md:text-xs md:text-slate-500 mb-1">Quantity</label>
                <div className="flex items-center gap-2 md:block">
                  <button
                    onClick={() => setStockQuantity(Math.max(0, stockQuantity - 1))}
                    className="md:hidden w-[40px] h-[40px] rounded-[8px] bg-[#f3f4f6] text-[#374151] text-[20px] flex items-center justify-center font-medium shrink-0"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={stockQuantity || ''}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    className="flex-1 md:w-full text-[24px] font-bold text-center h-[56px] border-[1.5px] border-[#e5e7eb] rounded-[10px] md:text-base md:font-normal md:text-left md:h-auto md:p-3 md:rounded-lg md:border-slate-200 bg-white outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="0"
                    min="1"
                  />
                  <button
                    onClick={() => setStockQuantity(stockQuantity + 1)}
                    className="md:hidden w-[40px] h-[40px] rounded-[8px] bg-[#f3f4f6] text-[#374151] text-[20px] flex items-center justify-center font-medium shrink-0"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mb-[14px] md:mb-0">
                <label className="block text-[10px] uppercase font-bold text-[#9ca3af] md:text-xs md:text-slate-500 mb-1">Type</label>

                {/* Desktop Native Select */}
                <select
                  value={stockType}
                  onChange={(e) => setStockType(e.target.value as 'bottles' | 'cartons')}
                  className="hidden md:block w-full md:h-auto md:p-3 md:text-base md:rounded-lg md:border-slate-200 bg-white outline-none focus:ring-2 focus:ring-primary/20 border border-slate-200"
                >
                  <option value="bottles">Bottles</option>
                  <option value="cartons">Cartons</option>
                </select>

                {/* Mobile Custom Dropup */}
                <div ref={typeDropdownRef} className="md:hidden relative" style={{ position: 'relative' }}>
                  {/* Trigger */}
                  <div onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)} style={{
                    height: '44px',
                    border: '1.5px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '0 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '15px',
                    cursor: 'pointer',
                    background: 'white',
                  }}>
                    <span>{stockType === 'cartons' ? 'Cartons' : 'Bottles'}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>▼</span>
                  </div>

                  {/* Options — opens UPWARD */}
                  {isTypeDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      right: 0,
                      marginBottom: '4px',
                      background: 'white',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      zIndex: 50,
                      boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
                    }}>
                      {['cartons', 'bottles'].map(option => (
                        <div key={option} onClick={() => {
                          setStockType(option as 'bottles' | 'cartons');
                          setIsTypeDropdownOpen(false);
                        }} style={{
                          padding: '12px 16px',
                          fontSize: '15px',
                          cursor: 'pointer',
                          background: stockType === option ? '#f0fdf4' : 'white',
                          color: stockType === option ? '#16a34a' : '#111',
                          fontWeight: stockType === option ? '600' : '400',
                        }}>
                          {option === 'cartons' ? 'Cartons' : 'Bottles'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-[20px] md:mb-0">
                <label className="block text-[10px] uppercase font-bold text-[#9ca3af] md:text-xs md:text-slate-500 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-[72px] p-[10px] px-[12px] text-[14px] resize-none border-[1.5px] border-[#e5e7eb] rounded-[10px] md:h-auto md:p-3 md:text-base md:rounded-lg md:border-slate-200 bg-white outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-[10px] md:p-6 md:bg-slate-50 md:flex md:gap-3">
              <button
                onClick={() => setIsAddStockModalOpen(false)}
                className="h-[46px] border-[1.5px] border-[#e5e7eb] bg-white text-[#374151] rounded-[10px] text-[15px] font-semibold md:flex-1 md:h-12 md:rounded-lg md:font-bold md:border-slate-200 md:hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStock}
                className="h-[46px] bg-[#16a34a] text-white rounded-[10px] text-[15px] font-semibold md:flex-1 md:h-12 md:rounded-lg md:font-bold md:hover:bg-primary/90 transition-colors"
              >
                Confirm Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6">
            <div className="text-center">
              <div className="size-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">Clear Stock</h3>
              <p className="text-sm text-slate-500 mb-6">
                This will set {deleteConfirmSku.productName || deleteConfirmSku.skuCode} stock to 0. The product will remain in inventory.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmSku(null)}
                  className="flex-1 h-12 rounded-lg font-bold border border-[#e5e7eb] bg-white hover:bg-slate-50 transition-colors text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSku(deleteConfirmSku)}
                  className="flex-1 h-12 rounded-lg font-bold bg-[#dc2626] text-white hover:bg-red-700 transition-colors text-base"
                >
                  Clear Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

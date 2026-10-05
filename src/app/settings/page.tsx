'use client';

import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useToast } from '@/components/Toast';
import { Settings, Store, User, Save, Download, Package, ShoppingCart, Receipt, Users, Home, LogOut } from 'lucide-react';
import { downloadCSV, downloadAllData } from '@/lib/exportData';

export default function SettingsPage() {
  const router = useRouter();
  const {
    shopName,
    ownerName,
    shopPhone,
    shopAddress,
    taxRate,
    setShopName,
    setOwnerName,
    setShopPhone,
    setShopAddress,
    setTaxRate,
    saveAllSettings,
    initialize
  } = useSettingsStore();
  const { addToast } = useToast();

  const [localShopName, setLocalShopName] = useState(shopName);
  const [localOwnerName, setLocalOwnerName] = useState(ownerName);
  const [localShopPhone, setLocalShopPhone] = useState(shopPhone);
  const [localShopAddress, setLocalShopAddress] = useState(shopAddress);
  const [localTaxRate, setLocalTaxRate] = useState(taxRate);
  const [isSaving, setIsSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Initialize settings from API on mount
    initialize();
  }, [initialize]);

  useEffect(() => {
    setLocalShopName(shopName);
    setLocalOwnerName(ownerName);
    setLocalShopPhone(shopPhone);
    setLocalShopAddress(shopAddress);
    setLocalTaxRate(taxRate);
  }, [shopName, ownerName, shopPhone, shopAddress, taxRate]);

  // Update browser tab title dynamically
  useEffect(() => {
    document.title = `${shopName || 'Store'} - Settings`;
  }, [shopName]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update store state first
      setShopName(localShopName);
      setOwnerName(localOwnerName);
      setShopPhone(localShopPhone);
      setShopAddress(localShopAddress);
      setTaxRate(localTaxRate);

      // Then save to API (database)
      await saveAllSettings();

      addToast('success', 'Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      addToast('error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (type: string) => {
    try {
      await downloadCSV(type);
      addToast('success', `${type} exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      addToast('error', 'Failed to export data');
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({
        callbackUrl: '/login',
        redirect: true
      });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-[12px] md:space-y-6 pb-20 md:pb-6 px-4 pt-4 md:pt-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-[16px] md:mb-0">
        {/* Mobile Hamburger */}
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('toggle-sidebar'));
            }
          }}
          className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-[20px] md:text-xl font-bold">Settings</h1>
          <p className="text-[12px] md:text-sm text-[#6b7280] md:text-slate-500 mt-[2px] md:mt-0">Manage store preferences</p>
        </div>

        {/* Mobile Avatar */}
        <div className="md:hidden">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {ownerName ? ownerName[0].toUpperCase() : (shopName ? shopName[0].toUpperCase() : 'S')}
          </div>
        </div>
      </div>

      {/* Store Settings */}
      <div className="bg-white rounded-[16px] md:rounded-xl border border-[#e5e7eb] md:border-slate-200 p-[16px] md:p-6 mb-[12px] md:mb-0 space-y-4">
        <h2 className="text-[16px] font-semibold md:font-bold md:text-base flex items-center gap-2 mb-[14px] md:mb-0">
          <span className="md:hidden">🏪</span>
          <span className="hidden md:inline"><Store className="w-5 h-5" /></span>
          <span>Store Information</span>
        </h2>

        <div className="grid gap-[12px] md:gap-4">
          <div>
            <label className="block text-[11px] md:text-sm font-bold md:font-medium text-[#9ca3af] md:text-slate-900 uppercase md:normal-case tracking-[0.05em] md:tracking-normal mb-[4px] md:mb-1">Store Name</label>
            <input
              type="text"
              value={localShopName}
              onChange={(e) => setLocalShopName(e.target.value)}
              className="w-full h-[46px] md:h-auto px-[14px] md:px-4 py-0 md:py-2 rounded-[10px] md:rounded-lg border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 bg-white md:bg-slate-50 text-[15px] md:text-base focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] md:text-sm font-bold md:font-medium text-[#9ca3af] md:text-slate-900 uppercase md:normal-case tracking-[0.05em] md:tracking-normal mb-[4px] md:mb-1">Owner Name</label>
            <input
              type="text"
              value={localOwnerName}
              onChange={(e) => setLocalOwnerName(e.target.value)}
              className="w-full h-[46px] md:h-auto px-[14px] md:px-4 py-0 md:py-2 rounded-[10px] md:rounded-lg border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 bg-white md:bg-slate-50 text-[15px] md:text-base focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] md:text-sm font-bold md:font-medium text-[#9ca3af] md:text-slate-900 uppercase md:normal-case tracking-[0.05em] md:tracking-normal mb-[4px] md:mb-1">Phone Number</label>
            <input
              type="tel"
              value={localShopPhone}
              onChange={(e) => setLocalShopPhone(e.target.value)}
              className="w-full h-[46px] md:h-auto px-[14px] md:px-4 py-0 md:py-2 rounded-[10px] md:rounded-lg border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 bg-white md:bg-slate-50 text-[15px] md:text-base focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] md:text-sm font-bold md:font-medium text-[#9ca3af] md:text-slate-900 uppercase md:normal-case tracking-[0.05em] md:tracking-normal mb-[4px] md:mb-1">Address</label>
            <textarea
              value={localShopAddress}
              onChange={(e) => setLocalShopAddress(e.target.value)}
              className="w-full h-[80px] md:h-auto px-[14px] md:px-4 py-[12px] md:py-2 rounded-[10px] md:rounded-lg border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 bg-white md:bg-slate-50 text-[15px] md:text-base focus:ring-2 focus:ring-primary/20 outline-none resize-none md:resize-y"
            />
          </div>
        </div>
      </div>

      {/* Billing Settings */}
      <div className="bg-white rounded-[16px] md:rounded-xl border border-[#e5e7eb] md:border-slate-200 p-[16px] md:p-6 mb-[12px] md:mb-0 space-y-4">
        <h2 className="text-[16px] font-semibold md:font-bold md:text-base flex items-center gap-2 mb-[14px] md:mb-0">
          <span className="md:hidden">👤</span>
          <span className="hidden md:inline"><User className="w-5 h-5" /></span>
          <span>Billing Settings</span>
        </h2>

        <div>
          <label className="block text-[11px] md:text-sm font-bold md:font-medium text-[#9ca3af] md:text-slate-900 uppercase md:normal-case tracking-[0.05em] md:tracking-normal mb-[4px] md:mb-1">TAX RATE (%)</label>
          <input
            type="number"
            value={localTaxRate}
            onChange={(e) => setLocalTaxRate(Number(e.target.value))}
            className="w-full h-[46px] md:h-auto px-[14px] md:px-4 py-0 md:py-2 rounded-[10px] md:rounded-lg border-[1.5px] border-[#e5e7eb] md:border md:border-slate-200 bg-white md:bg-slate-50 text-[15px] md:text-base focus:ring-2 focus:ring-primary/20 outline-none"
            min="0"
            max="100"
          />
          <p className="text-[11px] md:text-xs text-[#9ca3af] md:text-slate-500 mt-[4px] md:mt-1">
            Tax rate to apply on bills (0-100%)
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-[#16a34a] md:bg-primary hover:bg-[#15803d] disabled:bg-slate-300 text-white rounded-[12px] md:rounded-xl font-semibold md:font-bold flex items-center justify-center gap-2 transition-colors h-[48px] md:h-12 text-[15px] md:text-base mb-[16px] md:mb-0"
      >
        <Save className="w-[18px] h-[18px] md:w-5 md:h-5" />
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Data Export Section */}
      <div className="bg-white rounded-[16px] md:rounded-xl border border-[#e5e7eb] md:border-slate-200 p-[16px] md:p-6 mb-[12px] md:mb-0 space-y-4">
        <h2 className="text-[16px] font-semibold md:font-bold md:text-base flex items-center gap-2 mb-[14px] md:mb-0">
          <span className="md:hidden">↓</span>
          <span className="hidden md:inline"><Download className="w-5 h-5" /></span>
          <span>Data Export</span>
        </h2>
        <p className="text-[13px] md:text-sm text-[#6b7280] md:text-slate-500 mb-[14px] md:mb-4">
          Download your store data as CSV files for backup or analysis
        </p>

        <div className="grid grid-cols-2 gap-[12px] md:gap-3">
          <button
            onClick={() => handleExport('products')}
            className="h-[44px] md:h-auto flex items-center justify-center md:justify-start gap-2 px-[12px] md:px-4 py-0 md:py-2 border-[1.5px] border-[#e5e7eb] md:border md:border-primary bg-white md:bg-transparent text-[#374151] md:text-primary rounded-[10px] md:rounded-lg hover:bg-slate-50 md:hover:bg-primary/5 transition-colors text-[13px] md:text-sm font-semibold md:font-medium"
          >
            <span className="md:hidden">📦</span>
            <Package className="hidden md:block w-4 h-4" />
            Products
          </button>
          <button
            onClick={() => handleExport('inventory')}
            className="h-[44px] md:h-auto flex items-center justify-center md:justify-start gap-2 px-[12px] md:px-4 py-0 md:py-2 border-[1.5px] border-[#e5e7eb] md:border md:border-primary bg-white md:bg-transparent text-[#374151] md:text-primary rounded-[10px] md:rounded-lg hover:bg-slate-50 md:hover:bg-primary/5 transition-colors text-[13px] md:text-sm font-semibold md:font-medium"
          >
            <span className="md:hidden">📋</span>
            <ShoppingCart className="hidden md:block w-4 h-4" />
            Inventory
          </button>
          <button
            onClick={() => handleExport('bills')}
            className="h-[44px] md:h-auto flex items-center justify-center md:justify-start gap-2 px-[12px] md:px-4 py-0 md:py-2 border-[1.5px] border-[#e5e7eb] md:border md:border-primary bg-white md:bg-transparent text-[#374151] md:text-primary rounded-[10px] md:rounded-lg hover:bg-slate-50 md:hover:bg-primary/5 transition-colors text-[13px] md:text-sm font-semibold md:font-medium"
          >
            <span className="md:hidden">📄</span>
            <Receipt className="hidden md:block w-4 h-4" />
            Bills
          </button>
          <button
            onClick={() => handleExport('customers')}
            className="h-[44px] md:h-auto flex items-center justify-center md:justify-start gap-2 px-[12px] md:px-4 py-0 md:py-2 border-[1.5px] border-[#e5e7eb] md:border md:border-primary bg-white md:bg-transparent text-[#374151] md:text-primary rounded-[10px] md:rounded-lg hover:bg-slate-50 md:hover:bg-primary/5 transition-colors text-[13px] md:text-sm font-semibold md:font-medium"
          >
            <span className="md:hidden">👥</span>
            <Users className="hidden md:block w-4 h-4" />
            Customers
          </button>
        </div>

        <button
          onClick={() => {
            downloadAllData().then(() => {
              addToast('success', 'All data exported successfully');
            }).catch(() => {
              addToast('error', 'Failed to export all data');
            });
          }}
          className="w-full h-[46px] md:h-auto bg-[#1e3a5f] md:bg-primary hover:bg-[#152e4d] md:hover:bg-primary/90 text-white md:py-2 rounded-[12px] md:rounded-lg text-[14px] font-semibold md:font-medium flex items-center justify-center gap-2 mt-[10px] md:mt-0 transition-colors"
        >
          <Download className="w-[16px] h-[16px] md:w-4 md:h-4" />
          Download All Data
        </button>
      </div>

      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="w-full h-[46px] bg-white border-[1.5px] border-[#dc2626] text-[#dc2626] hover:bg-red-50 rounded-[12px] md:rounded-[10px] text-[14px] font-semibold flex items-center justify-center gap-2 mt-[8px] md:mt-0"
      >
        <LogOut className="w-[18px] h-[18px] md:w-4 md:h-4" />
        Logout
      </button>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Logout</h2>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to logout?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 h-11 rounded-[10px] border border-slate-200 text-slate-700 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 h-11 rounded-[10px] bg-[#dc2626] disabled:bg-red-300 text-white text-sm font-semibold"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

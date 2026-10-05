'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  BarChart2,
  Settings,
  IceCream,
  Users,
  X,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/useSettingsStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/inventory', label: 'Inventory', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/history', label: 'History', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { shopName } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Listen for toggle sidebar event from Header
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const getShopInitial = () => {
    if (shopName && shopName.length > 0) {
      return shopName.charAt(0).toUpperCase();
    }
    return 'S';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-[70] w-[min(18rem,86vw)] bg-white border-r border-slate-200 p-4 transform transition-transform duration-200 ease-in-out shadow-xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex items-center justify-center mb-10 mt-2">
          <img
            src="/logo.svg"
            alt="Saikat Enterprise"
            width={200}
            height={80}
            style={{ 
              objectFit: 'contain',
              marginBottom: '8px'
            }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="pt-6 border-t border-slate-200">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 p-6 sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center justify-center mb-10">
          <img
            src="/logo.svg"
            alt="Saikat Enterprise"
            width={200}
            height={80}
            style={{ 
              objectFit: 'contain',
              marginBottom: '8px'
            }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="pt-6 border-t border-slate-200">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </div>
      </aside>
    </>
  );
}

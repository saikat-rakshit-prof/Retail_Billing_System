'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Receipt, Package, Users, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/billing', label: 'Billing', icon: Receipt, isCenter: true },
  { href: '/inventory', label: 'Stock', icon: ShoppingCart },
  { href: '/products', label: 'Products', icon: Package },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-2 py-1 flex items-end justify-between z-50 safe-area-pb shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        if (item.isCenter) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center bg-primary text-white size-16 rounded-full -mt-6 shadow-lg border-4 border-white"
            >
              <Receipt className="w-7 h-7" />
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-2 min-w-0 flex-1',
              isActive ? 'text-primary' : 'text-slate-400'
            )}
          >
            <item.icon className={cn('w-5 h-5', isActive && 'fill-primary/20')} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

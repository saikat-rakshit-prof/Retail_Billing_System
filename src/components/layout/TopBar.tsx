'use client';

import { Bell, Plus } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';

interface TopBarProps {
  title?: string;
  showNewBill?: boolean;
}

export function TopBar({ title, showNewBill = true }: TopBarProps) {
  const { addToast } = useToast();
  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title || 'Overview'}</h2>
        <p className="text-slate-500 text-sm">Welcome back, here's what's happening today.</p>
      </div>
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button 
          onClick={() => addToast('info', 'No new notifications')}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors relative"
          style={{ cursor: 'pointer', zIndex: 10 }}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        {/* New Bill Button */}
        {showNewBill && (
          <Link
            href="/billing"
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Bill
          </Link>
        )}
      </div>
    </header>
  );
}


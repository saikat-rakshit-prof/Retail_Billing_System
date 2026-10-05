'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Droplets, Menu, Settings, LogOut } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSettingsStore } from '@/store/useSettingsStore';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useToast } from '@/components/Toast';
import { MobileAvatar } from '@/components/layout/MobileAvatar';
export function Header() {
  const { shopName, ownerName } = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isHomePage = pathname === '/';

  return (
    <header 
      className="
        sticky top-0 z-50 
        bg-white/80 backdrop-blur-sm 
        border-b border-slate-200 
        animate-slide-down
      "
      style={{ minHeight: '56px' }}
    >
      <div className="flex items-center justify-between px-4 lg:px-8 h-16">
        {/* Left Side - Menu & Logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button */}
          <button 
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => {
              // Toggle sidebar or menu - dispatch custom event
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toggle-sidebar'));
              }
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
          
           <Link href="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
             <img
               src="/logo.svg"
               alt="Saikat Enterprise"
               width={150}
               height={50}
               style={{ objectFit: 'contain' }}
             />
           </Link>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button 
            onClick={() => addToast('info', 'No new notifications')}
            className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            style={{ cursor: 'pointer', zIndex: 10 }}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <MobileAvatar />
        </div>
      </div>
    </header>
  );
}

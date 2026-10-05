'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useSettingsStore } from '@/store/useSettingsStore';

export function MobileAvatar() {
  const router = useRouter();
  const { shopName, ownerName } = useSettingsStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  const getInitials = () => {
    if (ownerName) {
      return ownerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (shopName) {
      return shopName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'FF';
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setProfileOpen(!profileOpen)}
        className="size-9 w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm hover:bg-primary/20 transition-colors"
      >
        {mounted ? getInitials() : 'FF'}
      </button>

      {profileOpen && (
        <div 
          className="absolute right-0 bg-white border border-[#e5e7eb] rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.1)] min-w-[160px] py-[8px]"
          style={{ top: '48px', zIndex: 50 }}
        >
          <div 
            onClick={() => { setProfileOpen(false); router.push('/profile'); }}
            className="px-[16px] py-[10px] text-[14px] cursor-pointer hover:bg-[#f9fafb] flex items-center gap-2"
          >
            👤 Profile
          </div>
          <div 
            onClick={() => { setProfileOpen(false); router.push('/settings'); }}
            className="px-[16px] py-[10px] text-[14px] cursor-pointer hover:bg-[#f9fafb] flex items-center gap-2"
          >
            ⚙️ Settings
          </div>
          <div 
            onClick={async () => { setProfileOpen(false); await signOut({ callbackUrl: '/login' }); }}
            className="px-[16px] py-[10px] text-[14px] cursor-pointer hover:bg-[#f9fafb] text-red-600 flex items-center gap-2 border-t border-slate-100"
          >
            🚪 Logout
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { StoreInitializer } from '@/components/StoreInitializer';
import { ChatWidget } from '@/components/ChatWidget';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <StoreInitializer />
      <KeyboardShortcuts />
      <div className="flex min-h-screen bg-background overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-5 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
        <BottomNav />
      </div>
      <ChatWidget />
    </>
  );
}

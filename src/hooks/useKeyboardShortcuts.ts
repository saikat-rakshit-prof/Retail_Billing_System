'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // N - New Bill
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        router.push('/billing');
      }

      // P - Products
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        router.push('/products');
      }

      // I - Inventory
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        router.push('/inventory');
      }

      // H - History
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        router.push('/history');
      }

      // D - Dashboard
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        router.push('/dashboard');
      }

      // Escape - Go back to dashboard
      if (e.key === 'Escape') {
        router.push('/dashboard');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}

'use client';

import { useEffect, useState } from 'react';
import { useProductStore } from '@/store/useProductStore';
import { useInventoryStore } from '@/store/useInventoryStore';
import { useBillStore } from '@/store/useBillStore';
import { useSettingsStore } from '@/store/useSettingsStore';

export function StoreInitializer() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      console.log('🔄 FrostyFlow: Initializing stores from Neon database...');
      
      try {
        await Promise.all([
          useProductStore.getState().initialize(),
          useInventoryStore.getState().initialize(),
          useBillStore.getState().initialize(),
          useSettingsStore.getState().initialize(),
        ]);
        
        console.log('✅ FrostyFlow connected to Neon database');
        setIsInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize stores:', error);
        // Still mark as initialized to prevent infinite loading
        setIsInitialized(true);
      }
    }

    initialize();
  }, []);

  // This component doesn't render anything
  // It's just responsible for initialization
  return null;
}

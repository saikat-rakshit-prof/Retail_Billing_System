/**
 * Smart caching module with TTL and invalidation for Neon database
 * Handles in-memory cache with localStorage persistence and dependency-based invalidation
 */

import { Product, SKU, Bill, StoreSettings, StockHistoryEntry } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type CacheKey = 'products' | 'inventory' | 'bills' | 'settings' | 'stockHistory';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
}

// ============================================================================
// TTL CONFIGURATION (in milliseconds)
// ============================================================================

const TTL_CONFIG: Record<CacheKey, number> = {
  settings: 60 * 60 * 1000,      // 1 hour - longest, changes rarely
  products: 5 * 60 * 1000,       // 5 minutes - medium, changes occasionally
  inventory: 1 * 60 * 1000,      // 1 minute - short, changes frequently
  bills: 5 * 60 * 1000,           // 5 minutes - medium, append only
  stockHistory: 1 * 60 * 1000,   // 1 minute - short
};

// ============================================================================
// DEPENDENCY MAP
// ============================================================================

const DEPENDENCY_MAP: Record<string, CacheKey[]> = {
  // Adding or editing a product must clear both products and inventory cache
  'product:add': ['products', 'inventory'],
  'product:update': ['products', 'inventory'],
  'product:delete': ['products', 'inventory'],
  
  // Updating stock must clear inventory cache only
  'stock:update': ['inventory'],
  'stock:add': ['inventory'],
  'stock:deduct': ['inventory'],
  
  // Generating a bill must clear both bills and inventory cache
  'bill:add': ['bills', 'inventory'],
  
  // Updating settings must clear settings cache only
  'settings:update': ['settings'],
};

// ============================================================================
// IN-MEMORY CACHE STORAGE
// ============================================================================

const memoryCache: Map<CacheKey, CacheEntry<any>> = new Map();

// Cache statistics
let cacheStats: CacheStats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
};

// ============================================================================
// LOCALSTORAGE PERSISTENCE
// ============================================================================

const LOCALSTORAGE_PREFIX = 'frostyflow_cache_';

function getLocalStorageKey(key: CacheKey): string {
  return `${LOCALSTORAGE_PREFIX}${key}`;
}

function saveToLocalStorage<T>(key: CacheKey, data: T, timestamp: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp,
      ttl: TTL_CONFIG[key],
    };
    localStorage.setItem(getLocalStorageKey(key), JSON.stringify(entry));
  } catch (error) {
    console.warn(`[Cache] Failed to save ${key} to localStorage:`, error);
  }
}

function loadFromLocalStorage<T>(key: CacheKey): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(getLocalStorageKey(key));
    if (!stored) return null;
    
    const entry: CacheEntry<T> = JSON.parse(stored);
    
    // Check if entry has expired based on localStorage timestamp
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      // Entry has expired, remove it
      localStorage.removeItem(getLocalStorageKey(key));
      return null;
    }
    
    return entry;
  } catch (error) {
    console.warn(`[Cache] Failed to load ${key} from localStorage:`, error);
    return null;
  }
}

function clearLocalStorage(key: CacheKey): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(getLocalStorageKey(key));
  } catch (error) {
    console.warn(`[Cache] Failed to clear ${key} from localStorage:`, error);
  }
}

// ============================================================================
// CACHE LOGGING
// ============================================================================

function logCacheEvent(type: 'hit' | 'miss' | 'invalidate' | 'set', key: CacheKey, details?: string): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  
  switch (type) {
    case 'hit':
      console.log(`[${timestamp}] ✅ CACHE HIT: ${key}`, details || '');
      break;
    case 'miss':
      console.log(`[${timestamp}] ❌ CACHE MISS: ${key}`, details || '');
      break;
    case 'invalidate':
      console.log(`[${timestamp}] 🔄 CACHE INVALIDATE: ${key}`, details || '');
      break;
    case 'set':
      console.log(`[${timestamp}] 💾 CACHE SET: ${key}`, details || '');
      break;
  }
}

// ============================================================================
// CACHE VALIDITY CHECKING
// ============================================================================

export function isCacheValid(key: CacheKey): boolean {
  const entry = memoryCache.get(key);
  
  if (!entry) {
    // Check localStorage as fallback
    const lsEntry = loadFromLocalStorage(key);
    if (lsEntry) {
      // Restore to memory cache
      memoryCache.set(key, lsEntry);
      const age = Date.now() - lsEntry.timestamp;
      if (age < lsEntry.ttl) {
        cacheStats.hits++;
        logCacheEvent('hit', key, `restored from localStorage, age: ${Math.round(age / 1000)}s`);
        return true;
      }
    }
    return false;
  }
  
  const age = Date.now() - entry.timestamp;
  const isValid = age < entry.ttl;
  
  if (isValid) {
    cacheStats.hits++;
    logCacheEvent('hit', key, `age: ${Math.round(age / 1000)}s`);
  } else {
    cacheStats.misses++;
    logCacheEvent('miss', key, `expired after ${Math.round(age / 1000)}s`);
  }
  
  return isValid;
}

export function getCacheAge(key: CacheKey): number {
  const entry = memoryCache.get(key);
  
  if (!entry) {
    const lsEntry = loadFromLocalStorage(key);
    if (lsEntry) {
      return Date.now() - lsEntry.timestamp;
    }
    return Infinity;
  }
  
  return Date.now() - entry.timestamp;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

export function getCache<T>(key: CacheKey): T | null {
  // Check memory cache first
  const entry = memoryCache.get(key);
  
  if (entry) {
    const age = Date.now() - entry.timestamp;
    
    if (age < entry.ttl) {
      // Valid entry in memory
      cacheStats.hits++;
      logCacheEvent('hit', key, `age: ${Math.round(age / 1000)}s`);
      return entry.data as T;
    }
    
    // Entry expired in memory, try localStorage
    memoryCache.delete(key);
  }
  
  // Try localStorage
  const lsEntry = loadFromLocalStorage<T>(key);
  if (lsEntry) {
    const age = Date.now() - lsEntry.timestamp;
    
    if (age < lsEntry.ttl) {
      // Valid entry in localStorage, restore to memory
      memoryCache.set(key, lsEntry as CacheEntry<any>);
      cacheStats.hits++;
      logCacheEvent('hit', key, `restored from localStorage, age: ${Math.round(age / 1000)}s`);
      return lsEntry.data as T;
    }
    
    // Entry expired in localStorage
    clearLocalStorage(key);
  }
  
  // Cache miss
  cacheStats.misses++;
  logCacheEvent('miss', key, 'no valid cache found');
  return null;
}

export function setCache<T>(key: CacheKey, data: T): void {
  const timestamp = Date.now();
  const ttl = TTL_CONFIG[key];
  
  const entry: CacheEntry<T> = {
    data,
    timestamp,
    ttl,
  };
  
  memoryCache.set(key, entry);
  saveToLocalStorage(key, data, timestamp);
  
  cacheStats.hits++; // Count as hit since we successfully stored
  logCacheEvent('set', key, `ttl: ${Math.round(ttl / 1000)}s`);
}

export function invalidateCache(key: CacheKey): void {
  memoryCache.delete(key);
  clearLocalStorage(key);
  
  cacheStats.invalidations++;
  logCacheEvent('invalidate', key);
}

export function invalidateCacheByAction(action: string): void {
  const keysToInvalidate = DEPENDENCY_MAP[action];
  
  if (keysToInvalidate && keysToInvalidate.length > 0) {
    keysToInvalidate.forEach(key => {
      invalidateCache(key);
    });
    console.log(`[Cache] 🔗 Dependency invalidation: ${action} → [${keysToInvalidate.join(', ')}]`);
  } else {
    console.warn(`[Cache] ⚠️ No dependency mapping for action: ${action}`);
  }
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

export function getCacheStats(): CacheStats {
  return { ...cacheStats };
}

export function resetCacheStats(): void {
  cacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };
}

export function logCacheStats(): void {
  const total = cacheStats.hits + cacheStats.misses;
  const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(1) : '0';
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    CACHE STATISTICS                       ║
╠════════════════════════════════════════════════════════════╣
║  Hits:         ${String(cacheStats.hits).padEnd(40)}║
║  Misses:       ${String(cacheStats.misses).padEnd(40)}║
║  Invalidation: ${String(cacheStats.invalidations).padEnd(40)}║
║  Hit Rate:     ${`${hitRate}%`.padEnd(40)}║
╚════════════════════════════════════════════════════════════╝
  `);
}

// ============================================================================
// TTL CONFIGURATION EXPORT
// ============================================================================

export function getTTL(key: CacheKey): number {
  return TTL_CONFIG[key];
}

export function getTTLDescription(key: CacheKey): string {
  const ttl = TTL_CONFIG[key];
  const seconds = Math.round(ttl / 1000);
  
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)} minute(s)`;
  }
  return `${seconds} seconds`;
}

// ============================================================================
// CLEAR ALL CACHE
// ============================================================================

export function clearAllCache(): void {
  const keys: CacheKey[] = ['products', 'inventory', 'bills', 'settings', 'stockHistory'];
  
  keys.forEach(key => {
    invalidateCache(key);
  });
  
  console.log('[Cache] 🗑️ All cache cleared');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initializeCache(): void {
  console.log('✅ Cache system initialized');
  console.log('📋 TTL Configuration:');
  Object.entries(TTL_CONFIG).forEach(([key, ttl]) => {
    console.log(`   - ${key}: ${getTTLDescription(key as CacheKey)}`);
  });
  console.log('📋 Dependency Map:');
  Object.entries(DEPENDENCY_MAP).forEach(([action, keys]) => {
    console.log(`   - ${action} → [${keys.join(', ')}]`);
  });
}

/**
 * DataFreshness component - shows when data was last synced
 * Designed to sit in page header area, small and unobtrusive
 */

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface DataFreshnessProps {
  /** Timestamp when data was last synced */
  lastSyncedAt: Date | null;
  /** Function to call when refresh is triggered */
  onRefresh: () => void;
  /** Whether refresh is currently loading */
  isLoading?: boolean;
}

export function DataFreshness({ 
  lastSyncedAt, 
  onRefresh, 
  isLoading = false 
}: DataFreshnessProps) {
  const [timeAgo, setTimeAgo] = useState<string>('Never');
  
  // Update time ago string every 30 seconds
  useEffect(() => {
    if (!lastSyncedAt) {
      setTimeAgo('Never');
      return;
    }
    
    const updateTimeAgo = () => {
      const now = new Date();
      const diffMs = now.getTime() - new Date(lastSyncedAt).getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      
      if (diffSeconds < 30) {
        setTimeAgo('Just now');
      } else if (diffMinutes < 1) {
        setTimeAgo(`${diffSeconds}s ago`);
      } else if (diffMinutes < 60) {
        setTimeAgo(`${diffMinutes}m ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours}h ago`);
      } else {
        setTimeAgo(`${Math.floor(diffHours / 24)}d ago`);
      }
    };
    
    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000);
    
    return () => clearInterval(interval);
  }, [lastSyncedAt]);
  
  // Determine freshness level
  const getFreshnessLevel = (): 'fresh' | 'stale' | 'old' => {
    if (!lastSyncedAt) return 'old';
    
    const diffMs = new Date().getTime() - new Date(lastSyncedAt).getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 2) return 'fresh';
    if (diffMinutes < 10) return 'stale';
    return 'old';
  };
  
  const freshnessLevel = getFreshnessLevel();
  
  const getColorClass = () => {
    switch (freshnessLevel) {
      case 'fresh':
        return 'text-green-600';
      case 'stale':
        return 'text-amber-600';
      case 'old':
        return 'text-red-500';
    }
  };
  
  const getDotColorClass = () => {
    switch (freshnessLevel) {
      case 'fresh':
        return 'bg-green-500';
      case 'stale':
        return 'bg-amber-500';
      case 'old':
        return 'bg-red-500';
    }
  };
  
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      {/* Status dot */}
      <div className={`size-2 rounded-full ${getDotColorClass()}`} />
      
      {/* Time ago text */}
      <span className={`font-mono ${getColorClass()}`}>
        {timeAgo}
      </span>
      
      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className={`p-1 rounded hover:bg-slate-100 transition-colors ${
          isLoading ? 'animate-spin text-primary' : 'text-slate-400 hover:text-primary'
        }`}
        title="Refresh data"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default DataFreshness;

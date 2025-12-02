/**
 * Sync Manager Service
 * Handles online/offline detection and automatic synchronization of offline data
 */

import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { offlineStorage, OfflineItem } from './offlineStorage';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  error: string | null;
}

class SyncManagerService {
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();
  private isOnline = true;
  private isSyncing = false;
  private pendingCount = 0;
  private lastSyncTime: number | null = null;
  private error: string | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  /**
   * Initialize sync manager with online/offline detection
   */
  async init(): Promise<void> {
    // Initialize offline storage
    await offlineStorage.init();

    // Set initial online status
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
    } else {
      // Native: Assume online initially, will be updated by NetInfo if available
      this.isOnline = true;
    }

    // Set up online/offline listeners
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      this.onlineListener = () => {
        console.log('[sync] Connection restored');
        this.isOnline = true;
        this.error = null;
        this.notifyListeners();
        this.sync(); // Auto-sync when connection is restored
      };

      this.offlineListener = () => {
        console.log('[sync] Connection lost');
        this.isOnline = false;
        this.notifyListeners();
      };

      window.addEventListener('online', this.onlineListener);
      window.addEventListener('offline', this.offlineListener);
    } else {
      // Native: Use NetInfo if available
      try {
        const NetInfo = require('@react-native-community/netinfo');
        NetInfo.addEventListener((state: any) => {
          const wasOnline = this.isOnline;
          this.isOnline = state.isConnected ?? false;
          
          if (!wasOnline && this.isOnline) {
            console.log('[sync] Connection restored');
            this.error = null;
            this.notifyListeners();
            this.sync(); // Auto-sync when connection is restored
          } else if (wasOnline && !this.isOnline) {
            console.log('[sync] Connection lost');
            this.notifyListeners();
          }
        });
      } catch (error) {
        console.warn('[sync] NetInfo not available, assuming always online');
      }
    }

    // Update pending count
    await this.updatePendingCount();

    // Start periodic sync check (every 30 seconds when online)
    this.startPeriodicSync();

    // Initial sync if online
    if (this.isOnline) {
      setTimeout(() => this.sync(), 2000); // Wait 2 seconds after init
    }

    this.notifyListeners();
  }

  /**
   * Start periodic sync check
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.updatePendingCount();
      
      if (this.isOnline && this.pendingCount > 0 && !this.isSyncing) {
        console.log('[sync] Periodic sync check: pending items found');
        this.sync();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update pending count
   */
  private async updatePendingCount(): Promise<void> {
    try {
      this.pendingCount = await offlineStorage.getPendingCount();
      this.notifyListeners();
    } catch (error) {
      console.error('[sync] Failed to update pending count:', error);
    }
  }

  /**
   * Sync all pending items
   */
  async sync(): Promise<void> {
    if (!this.isOnline) {
      console.log('[sync] Skipping sync: offline');
      return;
    }

    if (this.isSyncing) {
      console.log('[sync] Sync already in progress');
      return;
    }

    this.isSyncing = true;
    this.error = null;
    this.notifyListeners();

    try {
      const pendingItems = await offlineStorage.getPendingSyncItems();
      
      if (pendingItems.length === 0) {
        console.log('[sync] No pending items to sync');
        this.isSyncing = false;
        this.pendingCount = 0;
        this.lastSyncTime = Date.now();
        this.notifyListeners();
        return;
      }

      console.log(`[sync] Syncing ${pendingItems.length} pending items...`);

      let successCount = 0;
      let errorCount = 0;

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await offlineStorage.markAsSynced(item.id);
          successCount++;
        } catch (error: any) {
          console.error(`[sync] Failed to sync item ${item.id}:`, error);
          errorCount++;
          
          // If it's a network error, keep the item for retry
          // If it's a data error, mark as synced to avoid infinite retries
          if (error?.message?.includes('network') || error?.code === 'NETWORK_ERROR') {
            // Keep for retry
          } else {
            // Mark as synced to avoid infinite retries on data errors
            await offlineStorage.markAsSynced(item.id);
          }
        }
      }

      // Clean up synced items
      await offlineStorage.removeSyncedItems();
      await this.updatePendingCount();

      this.lastSyncTime = Date.now();
      
      if (errorCount > 0) {
        this.error = `${errorCount} item(s) failed to sync`;
      }

      console.log(`[sync] Sync complete: ${successCount} succeeded, ${errorCount} failed`);
    } catch (error: any) {
      console.error('[sync] Sync error:', error);
      this.error = error.message || 'Sync failed';
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Sync a single item
   */
  private async syncItem(item: OfflineItem): Promise<void> {
    const { table, operation, data } = item;

    switch (operation) {
      case 'insert':
        const { error: insertError } = await supabase
          .from(table)
          .insert(data);
        if (insertError) throw insertError;
        break;

      case 'update':
        const { error: updateError } = await supabase
          .from(table)
          .update(data)
          .eq('id', data.id);
        if (updateError) throw updateError;
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', data.id);
        if (deleteError) throw deleteError;
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncTime: this.lastSyncTime,
      error: this.error,
    };
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    // Immediately call with current status
    listener(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[sync] Error in sync listener:', error);
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (this.onlineListener) {
        window.removeEventListener('online', this.onlineListener);
      }
      if (this.offlineListener) {
        window.removeEventListener('offline', this.offlineListener);
      }
    }

    this.syncListeners.clear();
  }
}

export const syncManager = new SyncManagerService();


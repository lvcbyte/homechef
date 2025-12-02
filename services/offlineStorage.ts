/**
 * Offline Storage Service
 * Provides IndexedDB (web) and AsyncStorage (native) wrappers for offline data persistence
 */

import { Platform } from 'react-native';

export interface OfflineItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  synced: boolean;
}

class OfflineStorageService {
  private dbName = 'stockpit_offline';
  private dbVersion = 1;
  private storeName = 'pending_sync';
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  /**
   * Initialize IndexedDB (web) or return AsyncStorage adapter (native)
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'indexedDB' in window) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
          console.error('[offline] Failed to open IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.isInitialized = true;
          console.log('[offline] IndexedDB initialized');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: false });
            store.createIndex('synced', 'synced', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('table', 'table', { unique: false });
          }
        };
      });
    } else {
      // Native: AsyncStorage is already available via require
      this.isInitialized = true;
      console.log('[offline] Using AsyncStorage for offline storage');
    }
  }

  /**
   * Store an item for offline sync
   */
  async addPendingSync(item: Omit<OfflineItem, 'id' | 'timestamp' | 'synced'>): Promise<string> {
    await this.init();

    const offlineItem: OfflineItem = {
      ...item,
      id: `${item.table}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      synced: false,
    };

    if (Platform.OS === 'web' && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.add(offlineItem);

        request.onsuccess = () => {
          console.log('[offline] Item queued for sync:', offlineItem.id);
          resolve(offlineItem.id);
        };

        request.onerror = () => {
          console.error('[offline] Failed to queue item:', request.error);
          reject(request.error);
        };
      });
    } else {
      // Native: Use AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const key = `offline_sync_${offlineItem.id}`;
        await AsyncStorage.setItem(key, JSON.stringify(offlineItem));
        
        // Also maintain a list of pending sync keys
        const pendingKeys = await AsyncStorage.getItem('offline_sync_keys');
        const keys = pendingKeys ? JSON.parse(pendingKeys) : [];
        keys.push(key);
        await AsyncStorage.setItem('offline_sync_keys', JSON.stringify(keys));
        
        console.log('[offline] Item queued for sync:', offlineItem.id);
        return offlineItem.id;
      } catch (error) {
        console.error('[offline] Failed to queue item:', error);
        throw error;
      }
    }
  }

  /**
   * Get all pending sync items
   */
  async getPendingSyncItems(): Promise<OfflineItem[]> {
    await this.init();

    if (Platform.OS === 'web' && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('synced');
        const request = index.getAll(false); // Get all unsynced items

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          console.error('[offline] Failed to get pending items:', request.error);
          reject(request.error);
        };
      });
    } else {
      // Native: Use AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const pendingKeys = await AsyncStorage.getItem('offline_sync_keys');
        if (!pendingKeys) return [];

        const keys = JSON.parse(pendingKeys);
        const items: OfflineItem[] = [];

        for (const key of keys) {
          const itemJson = await AsyncStorage.getItem(key);
          if (itemJson) {
            const item = JSON.parse(itemJson) as OfflineItem;
            if (!item.synced) {
              items.push(item);
            }
          }
        }

        return items.sort((a, b) => a.timestamp - b.timestamp);
      } catch (error) {
        console.error('[offline] Failed to get pending items:', error);
        return [];
      }
    }
  }

  /**
   * Mark an item as synced
   */
  async markAsSynced(id: string): Promise<void> {
    await this.init();

    if (Platform.OS === 'web' && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const item = getRequest.result;
          if (item) {
            item.synced = true;
            const updateRequest = store.put(item);
            updateRequest.onsuccess = () => {
              console.log('[offline] Item marked as synced:', id);
              resolve();
            };
            updateRequest.onerror = () => reject(updateRequest.error);
          } else {
            resolve(); // Item not found, already synced or deleted
          }
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    } else {
      // Native: Use AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const key = `offline_sync_${id}`;
        const itemJson = await AsyncStorage.getItem(key);
        
        if (itemJson) {
          const item = JSON.parse(itemJson) as OfflineItem;
          item.synced = true;
          await AsyncStorage.setItem(key, JSON.stringify(item));
          console.log('[offline] Item marked as synced:', id);
        }
      } catch (error) {
        console.error('[offline] Failed to mark item as synced:', error);
      }
    }
  }

  /**
   * Remove synced items (cleanup)
   */
  async removeSyncedItems(): Promise<void> {
    await this.init();

    if (Platform.OS === 'web' && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('synced');
        const request = index.openCursor(true); // Get all synced items

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            console.log('[offline] Cleaned up synced items');
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    } else {
      // Native: Use AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const pendingKeys = await AsyncStorage.getItem('offline_sync_keys');
        if (!pendingKeys) return;

        const keys = JSON.parse(pendingKeys);
        const remainingKeys: string[] = [];

        for (const key of keys) {
          const itemJson = await AsyncStorage.getItem(key);
          if (itemJson) {
            const item = JSON.parse(itemJson) as OfflineItem;
            if (item.synced) {
              await AsyncStorage.removeItem(key);
            } else {
              remainingKeys.push(key);
            }
          }
        }

        await AsyncStorage.setItem('offline_sync_keys', JSON.stringify(remainingKeys));
        console.log('[offline] Cleaned up synced items');
      } catch (error) {
        console.error('[offline] Failed to cleanup synced items:', error);
      }
    }
  }

  /**
   * Get count of pending sync items
   */
  async getPendingCount(): Promise<number> {
    const items = await this.getPendingSyncItems();
    return items.length;
  }

  /**
   * Clear all offline data (for testing/debugging)
   */
  async clearAll(): Promise<void> {
    await this.init();

    if (Platform.OS === 'web' && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('[offline] All offline data cleared');
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    } else {
      // Native: Use AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const pendingKeys = await AsyncStorage.getItem('offline_sync_keys');
        if (pendingKeys) {
          const keys = JSON.parse(pendingKeys);
          for (const key of keys) {
            await AsyncStorage.removeItem(key);
          }
          await AsyncStorage.removeItem('offline_sync_keys');
        }
        console.log('[offline] All offline data cleared');
      } catch (error) {
        console.error('[offline] Failed to clear offline data:', error);
      }
    }
  }
}

export const offlineStorage = new OfflineStorageService();


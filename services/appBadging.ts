/**
 * App Badging Service
 * Manages badge count on app icon for PWA and native apps
 * Uses Browser Badging API for web and expo-notifications for native
 */

import { Platform } from 'react-native';
import { getUnreadNotificationCount } from './notifications';
import { supabase } from '../lib/supabase';

export interface BadgeCount {
  notifications: number;
  expiringItems: number;
  shoppingListItems: number;
  total: number;
}

/**
 * Set badge count on app icon
 */
export async function setAppBadge(count: number | null): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    // Browser Badging API (PWA)
    if ('setAppBadge' in navigator) {
      try {
        if (count === null || count === 0) {
          await (navigator as any).clearAppBadge();
        } else {
          await (navigator as any).setAppBadge(count);
        }
        console.log('[Badging] Badge set to:', count);
      } catch (error) {
        console.error('[Badging] Error setting badge:', error);
      }
    } else {
      console.warn('[Badging] Browser Badging API not supported');
    }
  } else if (Platform.OS !== 'web') {
    // Native: expo-notifications
    try {
      const Notifications = require('expo-notifications');
      if (count === null || count === 0) {
        await Notifications.setBadgeCountAsync(0);
      } else {
        await Notifications.setBadgeCountAsync(count);
      }
      console.log('[Badging] Native badge set to:', count);
    } catch (error) {
      console.error('[Badging] Error setting native badge:', error);
    }
  }
}

/**
 * Calculate total badge count for a user
 */
export async function calculateBadgeCount(userId: string | null): Promise<BadgeCount> {
  if (!userId) {
    return {
      notifications: 0,
      expiringItems: 0,
      shoppingListItems: 0,
      total: 0,
    };
  }

  try {
    // Get unread notifications count
    const notifications = await getUnreadNotificationCount(userId);

    // Get expiring items count (within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { count: expiringCount } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('expires_at', 'is', null)
      .lte('expires_at', threeDaysFromNow.toISOString())
      .gt('expires_at', new Date().toISOString());

    // Get shopping list items count (optional - only if shopping list exists)
    let shoppingListCount = 0;
    try {
      const { count: shoppingCount } = await supabase
        .from('shopping_list_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', false);

      shoppingListCount = shoppingCount || 0;
    } catch (error) {
      // Shopping list might not exist, ignore
      console.warn('[Badging] Could not fetch shopping list count:', error);
    }

    const total = notifications + (expiringCount || 0) + shoppingListCount;

    return {
      notifications,
      expiringItems: expiringCount || 0,
      shoppingListItems: shoppingListCount,
      total,
    };
  } catch (error) {
    console.error('[Badging] Error calculating badge count:', error);
    return {
      notifications: 0,
      expiringItems: 0,
      shoppingListItems: 0,
      total: 0,
    };
  }
}

/**
 * Update app badge for a user
 */
export async function updateAppBadge(userId: string | null): Promise<BadgeCount> {
  const badgeCount = await calculateBadgeCount(userId);
  await setAppBadge(badgeCount.total > 0 ? badgeCount.total : null);
  return badgeCount;
}

/**
 * Initialize badging service
 * Sets up real-time updates for badge count
 */
export function initAppBadging(
  userId: string | null,
  onBadgeUpdate?: (count: BadgeCount) => void
): () => void {
  if (!userId) {
    return () => {};
  }

  // Initial badge update
  updateAppBadge(userId).then((badgeCount) => {
    if (onBadgeUpdate) {
      onBadgeUpdate(badgeCount);
    }
  });

  // Set up real-time subscription for notifications
  const notificationsChannel = supabase
    .channel(`badging-notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        updateAppBadge(userId).then((badgeCount) => {
          if (onBadgeUpdate) {
            onBadgeUpdate(badgeCount);
          }
        });
      }
    )
    .subscribe();

  // Set up real-time subscription for inventory (expiring items)
  const inventoryChannel = supabase
    .channel(`badging-inventory:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        updateAppBadge(userId).then((badgeCount) => {
          if (onBadgeUpdate) {
            onBadgeUpdate(badgeCount);
          }
        });
      }
    )
    .subscribe();

  // Periodic update (every 5 minutes) as fallback
  const intervalId = setInterval(() => {
    updateAppBadge(userId).then((badgeCount) => {
      if (onBadgeUpdate) {
        onBadgeUpdate(badgeCount);
      }
    });
  }, 5 * 60 * 1000); // 5 minutes

  // Cleanup function
  return () => {
    supabase.removeChannel(notificationsChannel);
    supabase.removeChannel(inventoryChannel);
    clearInterval(intervalId);
  };
}

/**
 * Check if badging is supported
 */
export function isBadgingSupported(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return 'setAppBadge' in navigator;
  } else if (Platform.OS !== 'web') {
    // Native: expo-notifications should be available
    try {
      require('expo-notifications');
      return true;
    } catch {
      return false;
    }
  }
  return false;
}


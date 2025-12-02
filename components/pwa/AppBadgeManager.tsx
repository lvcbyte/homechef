/**
 * App Badge Manager Component
 * Manages app icon badge count based on notifications and expiring items
 */

import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { initAppBadging, BadgeCount } from '../../services/appBadging';

export function AppBadgeManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      // Clear badge when user logs out
      const { setAppBadge } = require('../../services/appBadging');
      setAppBadge(null);
      return;
    }

    // Initialize badging for logged-in user
    const cleanup = initAppBadging(user.id, (count: BadgeCount) => {
      // Optional: Log badge count updates
      if (count.total > 0) {
        console.log('[Badging] Badge count updated:', count);
      }
    });

    return cleanup;
  }, [user]);

  return null; // This component doesn't render anything
}


/**
 * PWA Shortcut Handler Component
 * Handles PWA shortcut launches and navigates accordingly
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { initPWAShortcuts, handleShortcutLaunch, ShortcutAction } from '../../services/pwaShortcuts';

export function ShortcutHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    // Handle shortcut launch
    const handleShortcut = (action: ShortcutAction) => {
      console.log('[PWA Shortcuts] Handling shortcut action:', action);

      switch (action.action) {
        case 'barcode':
          // Navigate to scan page and trigger barcode mode
          router.push('/scan?action=barcode');
          break;

        case 'manual':
          // Navigate to scan page and trigger manual entry
          router.push('/scan?action=manual');
          break;

        case 'scan':
          // Navigate to scan page
          router.push('/scan');
          break;

        case 'inventory':
          // Navigate to inventory page
          router.push('/inventory');
          break;

        case 'shopping':
          // Navigate to shopping list page
          router.push('/shopping');
          break;

        default:
          console.warn('[PWA Shortcuts] Unknown action:', action.action);
      }
    };

    // Initialize shortcut handler
    const cleanup = initPWAShortcuts(handleShortcut);

    // Also check URL on mount for shortcut actions
    if (typeof window !== 'undefined') {
      const url = window.location.href;
      const shortcutAction = handleShortcutLaunch(url);
      
      if (shortcutAction) {
        // Small delay to ensure router is ready
        setTimeout(() => {
          handleShortcut(shortcutAction);
        }, 100);
      }
    }

    return cleanup;
  }, [router]);

  return null; // This component doesn't render anything
}


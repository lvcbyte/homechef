/**
 * PWA Shortcuts Service
 * Handles PWA shortcut clicks and navigation
 */

import { Platform } from 'react-native';

export interface ShortcutAction {
  action: string;
  params?: Record<string, string>;
}

/**
 * Handle PWA shortcut launch
 * This is called when the app is launched via a shortcut
 */
export function handleShortcutLaunch(url: string): ShortcutAction | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  try {
    const urlObj = new URL(url, window.location.origin);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // Extract action from query params
    const action = searchParams.get('action');

    if (action) {
      return {
        action,
        params: Object.fromEntries(searchParams.entries()),
      };
    }

    // Fallback: extract action from pathname
    if (pathname.includes('/scan')) {
      return {
        action: 'scan',
        params: Object.fromEntries(searchParams.entries()),
      };
    }

    if (pathname.includes('/inventory')) {
      return {
        action: 'inventory',
      };
    }

    if (pathname.includes('/shopping')) {
      return {
        action: 'shopping',
      };
    }

    return null;
  } catch (error) {
    console.error('[PWA Shortcuts] Error parsing shortcut URL:', error);
    return null;
  }
}

/**
 * Initialize PWA shortcuts handler
 * Listens for beforeinstallprompt and handles shortcut launches
 */
export function initPWAShortcuts(
  onShortcutLaunch: (action: ShortcutAction) => void
): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return () => {};
  }

  // Handle launch from shortcut (when app is already installed)
  const handleLaunch = (event: Event) => {
    // This is typically handled by the router, but we can also handle it here
    console.log('[PWA Shortcuts] App launched:', event);
  };

  // Listen for app launch events
  window.addEventListener('appinstalled', handleLaunch);

  // Handle URL changes that might be from shortcuts
  const handleUrlChange = () => {
    const url = window.location.href;
    const shortcutAction = handleShortcutLaunch(url);
    
    if (shortcutAction) {
      console.log('[PWA Shortcuts] Shortcut action detected:', shortcutAction);
      onShortcutLaunch(shortcutAction);
    }
  };

  // Check on initial load
  handleUrlChange();

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);

  // Cleanup
  return () => {
    window.removeEventListener('appinstalled', handleLaunch);
    window.removeEventListener('popstate', handleUrlChange);
  };
}

/**
 * Check if PWA is installed
 */
export function isPWAInstalled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  // Check if running in standalone mode (PWA installed)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check for iOS standalone mode
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  return false;
}

/**
 * Show install prompt (if available)
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  // This would typically be called after beforeinstallprompt event
  // For now, we'll just check if the app can be installed
  return isPWAInstalled();
}


import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { AuthProvider } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  useEffect(() => {
    // PWA meta tags for mobile
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Prevent zoom on double tap
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      }, false);

      // Remove any base tag that might interfere with Expo Router's routing
      // Expo Router handles routing internally and base tags can cause issues
      const existingBase = document.querySelector('base');
      if (existingBase) {
        existingBase.remove();
      }

      // Add viewport meta tag if not exists
      if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
        document.getElementsByTagName('head')[0].appendChild(viewport);
      }

      // Add theme-color meta tag
      if (!document.querySelector('meta[name="theme-color"]')) {
        const themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        themeColor.content = '#047857';
        document.getElementsByTagName('head')[0].appendChild(themeColor);
      }

      // Add apple-mobile-web-app-capable
      if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const appleCapable = document.createElement('meta');
        appleCapable.name = 'apple-mobile-web-app-capable';
        appleCapable.content = 'yes';
        document.getElementsByTagName('head')[0].appendChild(appleCapable);
      }

      // Add apple-mobile-web-app-status-bar-style
      if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
        const appleStatusBar = document.createElement('meta');
        appleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
        appleStatusBar.content = 'black-translucent';
        document.getElementsByTagName('head')[0].appendChild(appleStatusBar);
      }

      // Add apple-touch-icon with multiple sizes
      const appleIconSizes = [180, 167, 152, 120, 76, 60];
      appleIconSizes.forEach(size => {
        if (!document.querySelector(`link[rel="apple-touch-icon"][sizes="${size}x${size}"]`)) {
          const appleIcon = document.createElement('link');
          appleIcon.rel = 'apple-touch-icon';
          appleIcon.sizes = `${size}x${size}`;
          appleIcon.href = `/assets/logo.png`;
          document.getElementsByTagName('head')[0].appendChild(appleIcon);
        }
      });
      
      // Add default apple-touch-icon
      if (!document.querySelector('link[rel="apple-touch-icon"]:not([sizes])')) {
        const appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        appleIcon.href = '/assets/logo.png';
        document.getElementsByTagName('head')[0].appendChild(appleIcon);
      }

      // Prevent pull-to-refresh on mobile
      document.body.style.overscrollBehavior = 'none';
      
      // Hide browser UI in standalone mode and keep it hidden
      const hideBrowserUI = () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        
        if (isStandalone) {
          // Force fullscreen styling
          document.documentElement.style.height = '100vh';
          document.documentElement.style.overflow = 'hidden';
          document.documentElement.style.position = 'fixed';
          document.documentElement.style.width = '100%';
          document.documentElement.style.top = '0';
          document.documentElement.style.left = '0';
          
          document.body.style.height = '100vh';
          document.body.style.overflow = 'hidden';
          document.body.style.position = 'fixed';
          document.body.style.width = '100%';
          document.body.style.top = '0';
          document.body.style.left = '0';
          document.body.style.margin = '0';
          document.body.style.padding = '0';
          
          // Prevent address bar from showing
          window.scrollTo(0, 0);
          
          // Force fullscreen on iOS
          if ((window.navigator as any).standalone) {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
              viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
            }
          }
        }
      };
      
      hideBrowserUI();
      
      // Re-hide on navigation/popstate
      window.addEventListener('popstate', () => {
        setTimeout(hideBrowserUI, 50);
      });
      
      // Monitor for navigation changes (Expo Router)
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(hideBrowserUI, 50);
      };
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(hideBrowserUI, 50);
      };
      
      // Also hide on focus (when returning to app)
      window.addEventListener('focus', hideBrowserUI);
      window.addEventListener('pageshow', hideBrowserUI);
      window.addEventListener('hashchange', hideBrowserUI);
      
      // Listen for Expo Router navigation
      if (typeof window !== 'undefined') {
        const observer = new MutationObserver(() => {
          hideBrowserUI();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      
      // Periodic check to ensure UI stays hidden
      setInterval(hideBrowserUI, 500);
      
      // Also hide on any scroll
      window.addEventListener('scroll', () => {
        hideBrowserUI();
        window.scrollTo(0, 0);
      }, { passive: false });
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: {
              backgroundColor: '#ffffff',
            },
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}


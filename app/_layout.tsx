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

      // Add apple-touch-icon
      if (!document.querySelector('link[rel="apple-touch-icon"]')) {
        const appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        appleIcon.href = '/assets/logo.png';
        document.getElementsByTagName('head')[0].appendChild(appleIcon);
      }

      // Prevent pull-to-refresh on mobile
      document.body.style.overscrollBehavior = 'none';
      
      // Hide browser UI in standalone mode
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
        document.documentElement.style.height = '100%';
        document.body.style.height = '100%';
        document.body.style.overflow = 'hidden';
      }
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


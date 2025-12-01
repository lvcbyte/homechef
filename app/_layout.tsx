import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../contexts/AuthContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  useEffect(() => {
    // PWA setup for web - Expo handles most meta tags via app.config.js
    // This effect only handles essential runtime adjustments
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Ensure viewport meta tag has viewport-fit=cover for safe areas
      let viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        const content = viewport.getAttribute('content') || '';
        if (!content.includes('viewport-fit=cover')) {
          viewport.setAttribute('content', `${content}, viewport-fit=cover`.replace(/^,\s*/, ''));
        }
      }

      // Add global CSS for safe area handling and immersive experience
      const styleId = 'pwa-safe-area-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          /* Base setup - minimal interference, preserve native layout */
          html {
            height: 100%;
            overflow-x: hidden;
          }

          body {
            height: 100%;
            overflow-x: hidden;
            margin: 0;
            padding: 0;
            /* Prevent pull-to-refresh */
            overscroll-behavior: none;
          }

          /* Hide scrollbars but allow scrolling */
          ::-webkit-scrollbar {
            display: none;
          }
          * {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          /* Prevent zoom on double tap (iOS) */
          input, textarea, select {
            font-size: 16px !important; /* Prevents iOS zoom on focus */
          }

          /* Safe area utility classes - only apply where explicitly used */
          .safe-area-top {
            padding-top: env(safe-area-inset-top, 0px) !important;
          }
          .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom, 0px) !important;
          }
          .safe-area-left {
            padding-left: env(safe-area-inset-left, 0px);
          }
          .safe-area-right {
            padding-right: env(safe-area-inset-right, 0px);
          }

          /* Navigation dock - fixed at bottom with safe area */
          .glass-dock {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            z-index: 1000 !important;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
            background-color: #fff !important;
            box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.05) !important;
          }

          /* SafeAreaView on web - add top safe area with consistent spacing */
          .safe-area-top {
            padding-top: calc(16px + env(safe-area-inset-top, 0px)) !important;
          }
        `;
        document.head.appendChild(style);
      }

      // Prevent zoom on double tap (additional safeguard)
      let lastTouchEnd = 0;
      const preventDoubleTapZoom = (event: TouchEvent) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      };
      document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });

      // Cleanup
      return () => {
        document.removeEventListener('touchend', preventDoubleTapZoom);
      };
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}


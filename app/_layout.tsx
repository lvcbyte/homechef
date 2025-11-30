import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

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
          /* Base fullscreen setup */
          html {
            height: 100%;
            height: 100dvh;
            overflow-x: hidden;
            width: 100%;
            margin: 0;
            padding: 0;
          }

          body {
            height: 100%;
            height: 100dvh;
            overflow-x: hidden;
            margin: 0;
            padding: 0;
            /* Prevent pull-to-refresh */
            overscroll-behavior: none;
            /* Prevent text selection on double tap (iOS zoom prevention) */
            touch-action: pan-y pinch-zoom;
            /* Use dynamic viewport height for mobile browsers */
            min-height: -webkit-fill-available;
          }

          /* Support for iOS Safari dynamic viewport */
          @supports (-webkit-touch-callout: none) {
            html, body {
              height: -webkit-fill-available;
            }
          }

          /* Root container - Expo Router structure */
          #root, [data-reactroot], [data-expo-root], div[style*="flex"] {
            height: 100%;
            min-height: 100%;
            display: flex;
            flex-direction: column;
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
          * {
            touch-action: manipulation;
          }
          input, textarea, select {
            touch-action: auto;
            font-size: 16px !important; /* Prevents iOS zoom on focus */
          }

          /* Ensure content doesn't get clipped by safe areas */
          .safe-area-top {
            padding-top: env(safe-area-inset-top);
          }
          .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom);
          }
          .safe-area-left {
            padding-left: env(safe-area-inset-left);
          }
          .safe-area-right {
            padding-right: env(safe-area-inset-right);
          }

          /* Navigation dock safe area handling */
          .glass-dock {
            padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)) !important;
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


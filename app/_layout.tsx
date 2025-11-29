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

      // Add/update viewport meta tag with fullscreen settings
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.getElementsByTagName('head')[0].appendChild(viewport);
      }
      // Always set viewport to prevent browser UI from showing
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui');

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

      // Add/update apple-mobile-web-app-status-bar-style
      let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (!appleStatusBar) {
        appleStatusBar = document.createElement('meta');
        appleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
        document.getElementsByTagName('head')[0].appendChild(appleStatusBar);
      }
      appleStatusBar.setAttribute('content', 'black-translucent');
      
      // Add format-detection to prevent phone number detection (can cause browser UI)
      if (!document.querySelector('meta[name="format-detection"]')) {
        const formatDetection = document.createElement('meta');
        formatDetection.name = 'format-detection';
        formatDetection.content = 'telephone=no';
        document.getElementsByTagName('head')[0].appendChild(formatDetection);
      }

      // Remove any existing apple-touch-icon links first
      const existingIcons = document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
      existingIcons.forEach(icon => icon.remove());
      
      const baseUrl = window.location.origin;
      const head = document.getElementsByTagName('head')[0];
      
      // Use apple-touch-icon.png - this is the standard iOS convention
      // iOS automatically looks for /apple-touch-icon.png in the root
      // Using a different filename helps bypass cache
      const iconPaths = [
        `${baseUrl}/apple-touch-icon.png`,
        `${baseUrl}/assets/apple-touch-icon.png`,
        `${baseUrl}/assets/icon.png`,
      ];
      
      // Add apple-touch-icon WITHOUT sizes first - iOS prefers this
      // iOS will use the first one it finds
      iconPaths.forEach((iconPath, index) => {
        const appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        appleIcon.href = iconPath;
        if (index === 0) {
          // First one without sizes - iOS default
        } else {
          appleIcon.sizes = '180x180';
        }
        head.insertBefore(appleIcon, head.firstChild);
      });
      
      // Also add precomposed version (iOS sometimes prefers this)
      iconPaths.forEach((iconPath, index) => {
        const appleIconPrecomposed = document.createElement('link');
        appleIconPrecomposed.rel = 'apple-touch-icon-precomposed';
        appleIconPrecomposed.href = iconPath;
        if (index === 0) {
          // First one without sizes
        } else {
          appleIconPrecomposed.sizes = '180x180';
        }
        head.insertBefore(appleIconPrecomposed, head.firstChild);
      });
      
      // Add apple-mobile-web-app-title
      let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (!appleTitle) {
        appleTitle = document.createElement('meta');
        appleTitle.setAttribute('name', 'apple-mobile-web-app-title');
        appleTitle.setAttribute('content', 'STOCKPIT');
        head.insertBefore(appleTitle, head.firstChild);
      } else {
        appleTitle.setAttribute('content', 'STOCKPIT');
      }
      
      console.log('Apple touch icon configured with paths:', iconPaths);
      
      // Update app title
      if (document.title !== 'STOCKPIT') {
        document.title = 'STOCKPIT';
      }

      // Prevent pull-to-refresh on mobile
      document.body.style.overscrollBehavior = 'none';
      
      // Hide browser UI ALWAYS - not just in standalone mode
      // This ensures the app looks like a native app in all browsers
      const hideBrowserUI = () => {
        // Force fullscreen styling - ALWAYS apply, not just in standalone
        // Use dynamic viewport height (dvh) for mobile, fallback to vh
        const heightValue = '100dvh';
        document.documentElement.style.height = heightValue;
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.position = 'fixed';
        document.documentElement.style.width = '100%';
        document.documentElement.style.top = '0';
        document.documentElement.style.left = '0';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        
        document.body.style.height = heightValue;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = '0';
        document.body.style.left = '0';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.touchAction = 'pan-y pinch-zoom';
        
        // Prevent address bar from showing on mobile browsers
        window.scrollTo(0, 0);
        
        // Force scroll to top on any scroll attempt
        if (window.scrollY > 0) {
          window.scrollTo(0, 0);
        }
        
        // Update viewport meta tag to ensure proper fullscreen
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui');
        }
        
        // Add CSS to prevent browser UI from showing
        const styleId = 'fullscreen-app-style';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            html, body {
              height: 100vh !important;
              height: 100dvh !important;
              overflow: hidden !important;
              position: fixed !important;
              width: 100% !important;
              top: 0 !important;
              left: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            /* Prevent Safari address bar from showing */
            @supports (-webkit-touch-callout: none) {
              html, body {
                height: -webkit-fill-available !important;
              }
            }
            /* Hide scrollbars */
            ::-webkit-scrollbar {
              display: none !important;
            }
            * {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
            }
          `;
          document.head.appendChild(style);
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
      
      // Also hide on any scroll - prevent scrolling entirely
      let scrollTimeout: ReturnType<typeof setTimeout>;
      window.addEventListener('scroll', () => {
        hideBrowserUI();
        window.scrollTo(0, 0);
        // Clear any pending scroll
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          window.scrollTo(0, 0);
        }, 10);
      }, { passive: false });
      
      // Prevent touchmove that might cause scrolling
      document.addEventListener('touchmove', (e) => {
        // Allow scrolling within scrollable containers, but prevent body scroll
        const target = e.target as HTMLElement;
        const isScrollable = target.closest('[data-scrollable="true"]') || 
                            target.closest('.scrollable') ||
                            target.closest('[style*="overflow"]');
        if (!isScrollable && target === document.body) {
          e.preventDefault();
        }
      }, { passive: false });
      
      // Prevent any resize that might show browser UI
      let resizeTimeout: ReturnType<typeof setTimeout>;
      window.addEventListener('resize', () => {
        hideBrowserUI();
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          window.scrollTo(0, 0);
          hideBrowserUI();
        }, 100);
      });
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


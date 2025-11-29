import { Platform } from 'react-native';
import { Router } from 'expo-router';

/**
 * Navigate to a route, ensuring it works correctly on web
 * This prevents issues where routes might be interpreted as absolute URLs pointing to localhost
 */
export function navigateToRoute(router: Router, route: string) {
  // On web, ensure we're using relative paths to avoid localhost redirects
  // Expo Router handles relative paths correctly, but we need to ensure
  // the route doesn't get interpreted as an absolute URL
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Ensure route starts with / for consistency
    const cleanRoute = route.startsWith('/') ? route : `/${route}`;
    // Use router.push - Expo Router will handle it correctly
    router.push(cleanRoute as any);
  } else {
    // On native, use the route as-is
    router.push(route as any);
  }
}


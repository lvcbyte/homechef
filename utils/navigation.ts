import { Platform } from 'react-native';
import { Router } from 'expo-router';

/**
 * Navigate to a route, ensuring it works correctly on web
 * This prevents issues where routes might be interpreted as absolute URLs pointing to localhost
 */
export function navigateToRoute(router: Router, route: string) {
  // Ensure route starts with / for consistency
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;
  
  // On web, use router.push which handles client-side routing
  // Expo Router should handle this correctly on both web and native
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Use router.push - Expo Router handles client-side navigation automatically
    router.push(cleanRoute as any);
  } else {
    // On native, use the route as-is
    router.push(cleanRoute as any);
  }
}


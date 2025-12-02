// Location Service - Expo Location Integration with Web Fallback
// Handles geolocation for weather-based recipe recommendations

import { Platform } from 'react-native';
import { LocationData } from './weather';

/**
 * Get location using native browser geolocation API (for web)
 */
async function getWebLocation(): Promise<LocationData | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[Location] Geolocation not supported');
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => {
      console.warn('[Location] Web geolocation timeout');
      resolve(null);
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        const { latitude, longitude } = position.coords;
        console.log('[Location] Web position obtained:', latitude, longitude);
        resolve({
          latitude,
          longitude,
        });
      },
      (error) => {
        clearTimeout(timeout);
        console.warn('[Location] Web geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes cache
      }
    );
  });
}

/**
 * Request location permissions and get current location
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    console.log('[Location] Requesting location...');
    
    // Use native browser API for web (more reliable)
    if (Platform.OS === 'web') {
      const location = await getWebLocation();
      if (location) {
        // City name will be fetched from weather API
        return location;
      }
      return null;
    }
    
    // Use Expo Location for native
    const Location = await import('expo-location');
    
    console.log('[Location] Requesting location permissions...');
    
    // Request permissions with timeout
    const permissionPromise = Location.requestForegroundPermissionsAsync();
    const timeoutPromise = new Promise<{ status: string }>((resolve) => {
      setTimeout(() => resolve({ status: 'timeout' }), 10000);
    });
    
    const { status } = await Promise.race([permissionPromise, timeoutPromise]) as any;
    
    if (status === 'timeout') {
      console.warn('[Location] Permission request timeout');
      return null;
    }
    
    if (status !== 'granted') {
      console.warn('[Location] Permission not granted, status:', status);
      return null;
    }
    
    console.log('[Location] Permission granted, getting position...');
    
    // Get current position with timeout
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeout: 10000,
    });
    
    const locationTimeout = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn('[Location] Position request timeout');
        resolve(null);
      }, 15000);
    });
    
    const location = await Promise.race([locationPromise, locationTimeout]);
    
    if (!location) {
      console.warn('[Location] Failed to get position');
      return null;
    }
    
    console.log('[Location] Position obtained:', location.coords.latitude, location.coords.longitude);
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('[Location] Error getting location:', error);
    return null;
  }
}

/**
 * Get cached location from storage (for better performance)
 */
export async function getCachedLocation(): Promise<LocationData | null> {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      const cached = localStorage.getItem('stockpit_location');
      if (cached) {
        const location = JSON.parse(cached);
        const cachedTime = location.timestamp || 0;
        const now = Date.now();
        
        // Cache valid for 1 hour
        if (now - cachedTime < 60 * 60 * 1000) {
          return location.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting cached location:', error);
    return null;
  }
}

/**
 * Cache location data
 */
export function cacheLocation(location: LocationData): void {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      localStorage.setItem('stockpit_location', JSON.stringify({
        data: location,
        timestamp: Date.now(),
      }));
    }
  } catch (error) {
    console.error('Error caching location:', error);
  }
}


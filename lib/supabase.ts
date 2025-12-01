import Constants from 'expo-constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Try to get from Constants.extra first (loaded via app.config.js), then fall back to process.env
// Also check window.__EXPO_ENV__ for runtime environment variables (Vercel)
const getEnvVar = (key: string): string | undefined => {
  // Check Constants.extra (build-time)
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key] as string;
  }
  // Check process.env (build-time and runtime)
  if (process.env[key]) {
    return process.env[key];
  }
  // Check window.__EXPO_ENV__ (runtime, for Vercel)
  if (typeof window !== 'undefined' && (window as any).__EXPO_ENV__?.[key]) {
    return (window as any).__EXPO_ENV__[key];
  }
  return undefined;
};

const SUPABASE_URL = 
  getEnvVar('supabaseUrl') || 
  getEnvVar('EXPO_PUBLIC_SUPABASE_URL') ||
  getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
  getEnvVar('SUPABASE_URL');

const SUPABASE_ANON_KEY = 
  getEnvVar('supabaseAnonKey') || 
  getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnvVar('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[supabase] Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as environment variables.'
  );
}

// Create storage adapter that works for both web and native
// Safari-compatible with fallbacks for localStorage restrictions
function createStorageAdapter() {
  // Web environment - check for window and localStorage
  if (typeof window !== 'undefined') {
    // Detect Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Try localStorage first, with Safari-specific error handling
    const tryLocalStorage = () => {
      try {
        // Test if localStorage is available and writable
        const testKey = '__supabase_storage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        // localStorage might be disabled (private browsing, ITP, etc.)
        console.warn('[supabase] localStorage not available:', e);
        return false;
      }
    };
    
    if (tryLocalStorage()) {
      // localStorage is available - use it with error handling
      return {
        getItem: (key: string) => {
          try {
            return Promise.resolve(window.localStorage.getItem(key));
          } catch (e) {
            console.error('[supabase] Error reading from localStorage:', e);
            // Fallback to sessionStorage for Safari
            try {
              return Promise.resolve(window.sessionStorage.getItem(key));
            } catch (e2) {
              return Promise.resolve(null);
            }
          }
        },
        setItem: (key: string, value: string) => {
          try {
            window.localStorage.setItem(key, value);
            // Also store in sessionStorage as backup for Safari
            if (isSafari) {
              try {
                window.sessionStorage.setItem(key, value);
              } catch (e) {
                // Ignore sessionStorage errors
              }
            }
            return Promise.resolve();
          } catch (e) {
            console.error('[supabase] Error writing to localStorage:', e);
            // Fallback to sessionStorage for Safari
            try {
              window.sessionStorage.setItem(key, value);
              return Promise.resolve();
            } catch (e2) {
              console.error('[supabase] Error writing to sessionStorage:', e2);
              return Promise.resolve(); // Don't throw, just log
            }
          }
        },
        removeItem: (key: string) => {
          try {
            window.localStorage.removeItem(key);
            // Also remove from sessionStorage if it exists
            try {
              window.sessionStorage.removeItem(key);
            } catch (e) {
              // Ignore
            }
            return Promise.resolve();
          } catch (e) {
            console.error('[supabase] Error removing from localStorage:', e);
            // Try sessionStorage
            try {
              window.sessionStorage.removeItem(key);
            } catch (e2) {
              // Ignore
            }
            return Promise.resolve();
          }
        },
      };
    } else {
      // localStorage not available - use sessionStorage as fallback
      console.warn('[supabase] Using sessionStorage as fallback (localStorage unavailable)');
      return {
        getItem: (key: string) => {
          try {
            return Promise.resolve(window.sessionStorage.getItem(key));
          } catch (e) {
            return Promise.resolve(null);
          }
        },
        setItem: (key: string, value: string) => {
          try {
            window.sessionStorage.setItem(key, value);
            return Promise.resolve();
          } catch (e) {
            console.error('[supabase] Error writing to sessionStorage:', e);
            return Promise.resolve();
          }
        },
        removeItem: (key: string) => {
          try {
            window.sessionStorage.removeItem(key);
            return Promise.resolve();
          } catch (e) {
            return Promise.resolve();
          }
        },
      };
    }
  }
  
  // Native environment - only try to require if we're not in a Node.js/SSR context
  // Check if we're in a React Native environment (not Node.js SSR)
  const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  const isNodeSSR = typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined';
  
  if (isReactNative && !isNodeSSR) {
    try {
      // Only require AsyncStorage in actual React Native environment
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return AsyncStorage;
    } catch (e) {
      // AsyncStorage not available, use fallback
    }
  }
  
  // Fallback: no-op storage (for SSR or when storage is unavailable)
  return {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve(),
  };
}

// Lazy initialization - only create client when accessed and not during SSR
let supabaseInstance: SupabaseClient<Database> | null = null;

function initSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  // Validate credentials before creating client
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const errorMsg = 'Supabase credentials are missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as environment variables in your Vercel project settings.';
    console.error('[supabase]', errorMsg);
    console.error('[supabase] SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
    console.error('[supabase] SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
    throw new Error(errorMsg);
  }
  
  console.log('[supabase] Initializing client with URL:', SUPABASE_URL.substring(0, 30) + '...');
  
  // Don't initialize during SSR (when window is undefined and we're in Node.js)
  const isSSR = typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node;
  
  if (isSSR) {
    console.log('[supabase] SSR mode - creating minimal client');
    // Return a minimal mock client for SSR
    return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: {
          getItem: () => Promise.resolve(null),
          setItem: () => Promise.resolve(),
          removeItem: () => Promise.resolve(),
        },
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  
  console.log('[supabase] Creating full client with auth');
  
  // Detect Safari for special handling
  const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    console.log('[supabase] Safari detected - using Safari-compatible settings');
  }
  
  try {
    supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: createStorageAdapter(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Enable to detect auth tokens in URL
        flowType: 'pkce', // Use PKCE flow for better security and Safari compatibility
        // Safari-specific settings
        ...(isSafari && {
          // In Safari, we might need to be more aggressive about session detection
          storageKey: 'sb-auth-token', // Use a simpler key name
        }),
      },
      global: {
        headers: {
          'x-client-info': isSafari ? 'stockpit-web-safari' : 'stockpit-web',
        },
      },
    });
    
    console.log('[supabase] Client created successfully');
    return supabaseInstance;
  } catch (error) {
    console.error('[supabase] Error creating client:', error);
    throw error;
  }
}

// Export getter that initializes on first access
// Use a more robust approach for web
let clientInstance: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
  if (!clientInstance) {
    clientInstance = initSupabase();
  }
  return clientInstance;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    try {
      // Only initialize on web if window is available
      if (typeof window === 'undefined') {
        // SSR - return a minimal mock
        if (prop === 'auth') {
          return {
            signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Server-side rendering - auth not available' } }),
            signUp: () => Promise.resolve({ data: null, error: { message: 'Server-side rendering - auth not available' } }),
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          };
        }
        return undefined;
      }
      
      // Verify credentials are available before trying to get client
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('[supabase] Missing credentials when accessing:', prop);
        if (typeof prop === 'string' && prop.includes('auth')) {
          return {
            signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase credentials niet gevonden. Ververs de pagina.' } }),
            signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase credentials niet gevonden. Ververs de pagina.' } }),
            getSession: () => Promise.resolve({ data: { session: null }, error: { message: 'Supabase credentials niet gevonden' } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          };
        }
        return undefined;
      }
      
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Failed to initialize Supabase client');
      }
      
      const value = client[prop as keyof SupabaseClient<Database>];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    } catch (error: any) {
      console.error('[supabase] Error accessing Supabase client:', error);
      console.error('[supabase] Property:', prop);
      console.error('[supabase] Error details:', {
        message: error.message,
        stack: error.stack,
        SUPABASE_URL: SUPABASE_URL ? '✅' : '❌',
        SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? '✅' : '❌',
      });
      // Return a mock that throws helpful errors
      if (typeof prop === 'string' && prop.includes('auth')) {
        return {
          signInWithPassword: () => Promise.resolve({ data: null, error: { message: error.message || 'Supabase client niet geïnitialiseerd. Ververs de pagina en probeer opnieuw.' } }),
          signUp: () => Promise.resolve({ data: null, error: { message: error.message || 'Supabase client niet geïnitialiseerd. Ververs de pagina en probeer opnieuw.' } }),
          getSession: () => Promise.resolve({ data: { session: null }, error: { message: error.message || 'Supabase client niet geïnitialiseerd' } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        };
      }
      throw error;
    }
  },
});


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
// This function is only called when creating the client, not at module load time
function createStorageAdapter() {
  // Web environment - check for window and localStorage
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return {
      getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
      setItem: (key: string, value: string) => Promise.resolve(window.localStorage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(window.localStorage.removeItem(key)),
    };
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
    throw new Error(
      'Supabase credentials are missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY as environment variables in your Vercel project settings.'
    );
  }
  
  // Don't initialize during SSR (when window is undefined and we're in Node.js)
  const isSSR = typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node;
  
  if (isSSR) {
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
  
  supabaseInstance = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  
  return supabaseInstance;
}

// Export getter that initializes on first access
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = initSupabase();
    const value = client[prop as keyof SupabaseClient<Database>];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});


import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Profile } from '../types/app';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Safari-specific: Clear any stale session data on mount
    const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari && typeof window !== 'undefined') {
      // Safari sometimes has issues with stale session data
      // We'll let Supabase handle it, but log for debugging
      console.log('[auth] Safari detected - ensuring clean session state');
    }
    
    // Wrap in try-catch to handle missing credentials gracefully
    try {
      // Add a small delay for Safari to ensure storage is ready
      const initDelay = isSafari ? 100 : 0;
      
      setTimeout(() => {
        supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;
          
          // If there's an error (like invalid refresh token), clear the session
          if (error) {
            console.warn('[auth] Error getting session, clearing:', error);
            // Clear invalid tokens from both localStorage and sessionStorage (Safari)
            if (typeof window !== 'undefined') {
              const clearStorage = (storage: Storage) => {
                try {
                  const keys = Object.keys(storage);
                  keys.forEach(key => {
                    if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
                      storage.removeItem(key);
                    }
                  });
                } catch (e) {
                  // Storage might not be accessible
                }
              };
              clearStorage(window.localStorage);
              clearStorage(window.sessionStorage);
            }
            setSession(null);
            setLoading(false);
            return;
          }
          
        setSession(data.session);
        setLoading(false);
      }).catch((error) => {
          console.error('[auth] Error getting session:', error);
        if (!mounted) return;
          // Clear invalid tokens on error
          if (typeof window !== 'undefined') {
            const clearStorage = (storage: Storage) => {
              try {
                const keys = Object.keys(storage);
                keys.forEach(key => {
                  if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
                    storage.removeItem(key);
                  }
                });
              } catch (e) {
                // Storage might not be accessible
              }
            };
            clearStorage(window.localStorage);
            clearStorage(window.sessionStorage);
          }
          setSession(null);
        setLoading(false);
      });
      }, initDelay);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        setSession(newSession);
        if (!newSession) {
          setProfile(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Refresh profile when user signs in (including after email confirmation)
          // This ensures onboarding status is up to date
          if (newSession?.user) {
            try {
              const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', newSession.user.id)
                .single();
              if (data) {
                setProfile(data as Profile);
              }
            } catch (error) {
              console.error('Error refreshing profile on auth change:', error);
            }
          }
        }
      });

      return () => {
        mounted = false;
        subscription?.unsubscribe();
      };
    } catch (error) {
      console.error('Error initializing auth:', error);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setLoading(false); // Make sure loading is false when no session
      return;
    }

    let mounted = true;
    setLoading(true);
    
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[auth] Profile loading timeout, setting loading to false');
        setLoading(false);
      }
    }, 5000); // 5 second timeout
    
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!mounted) return;
        clearTimeout(loadingTimeout);
        
        if (error) {
          console.error('[auth] Error fetching profile:', error);
          
          // If it's a "not found" error, try to create the profile
          if (error.code === 'PGRST116') {
            console.log('[auth] Profile not found, creating new profile...');
            supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email || '',
                archetype: 'Minimalist',
                dietary_restrictions: [],
                cooking_skill: 'Intermediate',
                onboarding_completed: false,
              })
              .select()
              .single()
              .then(({ data: newProfile, error: createError }) => {
                if (!mounted) return;
                if (createError) {
                  console.error('[auth] Error creating profile:', createError);
                  // Even if creation fails, set loading to false so app can continue
                  setLoading(false);
                } else if (newProfile) {
                  setProfile(newProfile as Profile);
                  setLoading(false);
                } else {
                  setLoading(false);
                }
              })
              .catch((createError) => {
                console.error('[auth] Exception creating profile:', createError);
                if (mounted) {
                  setLoading(false);
                }
              });
          } else {
            // Other errors (like RLS/permission errors) - log but don't block
            console.error('[auth] Profile fetch error (non-critical):', error.message, error.code);
            // Set loading to false so app can continue
            // Profile might load later via refreshProfile
            setLoading(false);
          }
          } else if (data) {
            setProfile(data as Profile);
            setLoading(false);
          } else {
            setLoading(false);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        clearTimeout(loadingTimeout);
        console.error('[auth] Exception fetching profile:', error);
        // Don't block the app - set loading to false
          setLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
    };
  }, [session?.user]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('[auth] Starting sign in for:', email);
      
      // Verify Supabase client is initialized
      try {
        const testSession = await supabase.auth.getSession();
        console.log('[auth] Supabase client is accessible');
      } catch (testErr: any) {
        console.error('[auth] Supabase client test failed:', testErr);
        return { error: 'Authenticatieservice niet beschikbaar. Ververs de pagina en probeer opnieuw.' };
      }
      
      // Clear any invalid tokens first
      if (typeof window !== 'undefined') {
        const clearStorage = (storage: Storage) => {
          try {
            const keys = Object.keys(storage);
            keys.forEach(key => {
              if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
                storage.removeItem(key);
              }
            });
          } catch (e) {
            // Ignore storage errors
          }
        };
        clearStorage(window.localStorage);
        clearStorage(window.sessionStorage);
      }
      
      // Call signInWithPassword directly without Promise.race
      // The Supabase client has its own timeout handling
      console.log('[auth] Calling signInWithPassword...');
      const startTime = Date.now();
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      const duration = Date.now() - startTime;
      console.log('[auth] Sign in completed in', duration, 'ms');
      
    if (error) {
        console.error('[auth] Sign in error:', error);
        return { error: error.message || 'Inloggen mislukt. Controleer je e-mail en wachtwoord.' };
    }
      
      if (!data || !data.user) {
        console.error('[auth] Sign in returned no user data');
        return { error: 'Inloggen mislukt. Geen gebruikersdata ontvangen.' };
      }
      
      console.log('[auth] Sign in successful:', data.user?.email);
      return {};
    } catch (err: any) {
      console.error('[auth] Sign in exception:', err);
      // Check if it's a network error
      if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        return { error: 'Netwerkfout. Controleer je internetverbinding en probeer opnieuw.' };
      }
      if (err.message && err.message.includes('timeout')) {
        return { error: err.message };
      }
      return { error: err.message || 'Er ging iets mis bij het inloggen. Probeer het opnieuw.' };
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      console.log('[auth] Starting sign up for:', email);
      
      // Verify Supabase client is initialized
      try {
        const testSession = await supabase.auth.getSession();
        console.log('[auth] Supabase client is accessible');
      } catch (testErr: any) {
        console.error('[auth] Supabase client test failed:', testErr);
        return { error: 'Authenticatieservice niet beschikbaar. Ververs de pagina en probeer opnieuw.' };
      }
      
    // Get the current origin for redirect URL
    const redirectTo = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth-callback`
      : '/auth-callback';
    
      console.log('[auth] Redirect URL:', redirectTo);
      
      // Call signUp directly without Promise.race
      // The Supabase client has its own timeout handling
      console.log('[auth] Calling signUp...');
      const startTime = Date.now();
      
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo: redirectTo,
      },
    });
      
      const duration = Date.now() - startTime;
      console.log('[auth] Sign up completed in', duration, 'ms');
      
    if (error) {
        console.error('[auth] Sign up error:', error);
        return { error: error.message || 'Account aanmaken mislukt. Probeer het opnieuw.' };
    }
      
      if (!data || !data.user) {
        console.error('[auth] Sign up returned no user data');
        return { error: 'Account aanmaken mislukt. Geen gebruikersdata ontvangen.' };
      }
      
      console.log('[auth] User created:', data.user.id);
      
      // Profile should be created automatically by the database trigger
      // Don't wait for it or try to create it manually - just return success
      // The trigger will handle profile creation, and if it fails, onboarding will handle it
      console.log('[auth] Sign up successful - profile will be created by trigger');
      return {};
    } catch (err: any) {
      console.error('[auth] Sign up exception:', err);
      // Check if it's a network error
      if (err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        return { error: 'Netwerkfout. Controleer je internetverbinding en probeer opnieuw.' };
      }
      if (err.message && err.message.includes('timeout')) {
        return { error: err.message };
    }
      return { error: err.message || 'Er ging iets mis bij het aanmaken van je account. Probeer het opnieuw.' };
    }
  };

  const signOut = async () => {
    try {
      console.log('[auth] Starting sign out...');
      
      // Clear profile and session state first
      setProfile(null);
      setSession(null);
      
      // Sign out from Supabase - this will trigger onAuthStateChange
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[auth] Error signing out from Supabase:', error);
      } else {
        console.log('[auth] Signed out from Supabase successfully');
      }
      
      // Clear all Supabase-related data from storage (both localStorage and sessionStorage)
      // This ensures a clean state for the next sign-in
      if (typeof window !== 'undefined') {
        const clearStorage = (storage: Storage) => {
          try {
            const keys = Object.keys(storage);
            keys.forEach(key => {
              // Remove Supabase auth tokens and related data
              if (
                key.includes('supabase') || 
                key.includes('auth-token') || 
                key.includes('auth-token-code-verifier') ||
                key.startsWith('sb-') ||
                key.includes('supabase.auth')
              ) {
                storage.removeItem(key);
              }
            });
            console.log('[auth] Cleared storage:', storage === window.localStorage ? 'localStorage' : 'sessionStorage');
          } catch (e) {
            console.warn('[auth] Error clearing storage:', e);
          }
        };
        
        clearStorage(window.localStorage);
        clearStorage(window.sessionStorage);
      }
      
      console.log('[auth] Sign out completed');
    } catch (error) {
      console.error('[auth] Error during sign out:', error);
      // Even if there's an error, clear local state and storage
      setProfile(null);
      setSession(null);
      
      // Force clear storage on error
      if (typeof window !== 'undefined') {
        try {
          const clearStorage = (storage: Storage) => {
            const keys = Object.keys(storage);
            keys.forEach(key => {
              if (
                key.includes('supabase') || 
                key.includes('auth-token') || 
                key.startsWith('sb-')
              ) {
                storage.removeItem(key);
              }
            });
          };
          clearStorage(window.localStorage);
          clearStorage(window.sessionStorage);
        } catch (e) {
          // Ignore storage errors
        }
      }
    }
  };

  const refreshProfile = async () => {
    // Use the current session, or try to get it fresh
    const currentSession = session || (await supabase.auth.getSession()).data.session;
    
    if (!currentSession?.user) {
      setProfile(null);
      return;
    }
    
    try {
      const { data, error } = await supabase
      .from('profiles')
      .select('*')
        .eq('id', currentSession.user.id)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: currentSession.user.id,
            archetype: 'Minimalist',
            dietary_restrictions: [],
            cooking_skill: 'Intermediate',
            onboarding_completed: false,
          })
          .select()
      .single();
    
        if (newProfile) {
          setProfile(newProfile as Profile);
        }
      } else if (data) {
      setProfile(data as Profile);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      // Don't throw, just log the error
    }
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}


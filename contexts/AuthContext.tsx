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
    
    // Wrap in try-catch to handle missing credentials gracefully
    try {
      supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted) return;
        
        // If there's an error (like invalid refresh token), clear the session
        if (error) {
          console.warn('Error getting session, clearing:', error);
          // Clear invalid tokens
          if (typeof window !== 'undefined' && window.localStorage) {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
              if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
                localStorage.removeItem(key);
              }
            });
          }
          setSession(null);
          setLoading(false);
          return;
        }
        
        setSession(data.session);
        setLoading(false);
      }).catch((error) => {
        console.error('Error getting session:', error);
        if (!mounted) return;
        // Clear invalid tokens on error
        if (typeof window !== 'undefined' && window.localStorage) {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
              localStorage.removeItem(key);
            }
          });
        }
        setSession(null);
        setLoading(false);
      });

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
      
      // Clear any invalid tokens first
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
      }
      
      // Add timeout to prevent hanging
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign in timeout - het duurt te lang. Controleer je internetverbinding.')), 15000)
      );
      
      const { data, error } = await Promise.race([signInPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('[auth] Sign in error:', error);
        return { error: error.message || 'Inloggen mislukt. Controleer je e-mail en wachtwoord.' };
      }
      
      console.log('[auth] Sign in successful:', data.user?.email);
      return {};
    } catch (err: any) {
      console.error('[auth] Sign in exception:', err);
      if (err.message && err.message.includes('timeout')) {
        return { error: err.message };
      }
      return { error: err.message || 'Er ging iets mis bij het inloggen. Probeer het opnieuw.' };
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      console.log('[auth] Starting sign up for:', email);
      
      // Get the current origin for redirect URL
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth-callback`
        : '/auth-callback';
      
      console.log('[auth] Redirect URL:', redirectTo);
      
      // Add timeout to prevent hanging
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: redirectTo,
        },
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign up timeout - het duurt te lang. Controleer je internetverbinding.')), 15000)
      );
      
      const { data, error } = await Promise.race([signUpPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('[auth] Sign up error:', error);
        return { error: error.message || 'Account aanmaken mislukt. Probeer het opnieuw.' };
      }
      
      if (data.user) {
        console.log('[auth] User created:', data.user.id);
        
        // Create profile with onboarding not completed
        // User will complete onboarding after email confirmation
        // Use a timeout to prevent hanging, but don't fail signup if it fails
        try {
          const profilePromise = supabase.from('profiles').upsert({
            id: data.user.id,
            archetype: 'Minimalist',
            dietary_restrictions: [],
            cooking_skill: 'Intermediate',
            onboarding_completed: false,
          }, {
            onConflict: 'id'
          });
          
          const profileTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile creation timeout')), 5000)
          );
          
          const { error: profileError } = await Promise.race([profilePromise, profileTimeoutPromise]) as any;
          
          if (profileError) {
            console.warn('[auth] Profile creation error (non-critical):', profileError);
            // Don't fail signup - profile will be created by trigger or later
          } else {
            console.log('[auth] Profile created successfully');
          }
        } catch (profileErr: any) {
          console.warn('[auth] Profile creation failed (non-critical):', profileErr);
          // Don't fail signup - profile can be created later
        }
      }
      
      console.log('[auth] Sign up successful');
      return {};
    } catch (err: any) {
      console.error('[auth] Sign up exception:', err);
      if (err.message && err.message.includes('timeout')) {
        return { error: err.message };
      }
      return { error: err.message || 'Er ging iets mis bij het aanmaken van je account. Probeer het opnieuw.' };
    }
  };

  const signOut = async () => {
    try {
      // Clear profile and session state first
      setProfile(null);
      setSession(null);
      
      // Sign out from Supabase - this will trigger onAuthStateChange
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
      
      // Clear Supabase session from localStorage on web
      // Supabase stores session in a specific format: `sb-<project-ref>-auth-token`
      if (typeof window !== 'undefined' && window.localStorage) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          // Remove Supabase auth tokens
          if (key.includes('supabase') || key.includes('auth-token') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.error('Error during sign out:', error);
      // Even if there's an error, clear local state
      setProfile(null);
      setSession(null);
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


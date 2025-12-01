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
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      }).catch((error) => {
        console.error('Error getting session:', error);
        if (!mounted) return;
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
      return;
    }

    let mounted = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (mounted) {
          if (error && error.code === 'PGRST116') {
            // Profile doesn't exist, create it with onboarding not completed
            // This will be set up during onboarding
            supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                archetype: 'Minimalist',
                dietary_restrictions: [],
                cooking_skill: 'Intermediate',
                onboarding_completed: false,
              })
              .select()
              .single()
              .then(({ data: newProfile }) => {
                if (mounted && newProfile) {
                  setProfile(newProfile as Profile);
                  setLoading(false);
                }
              })
              .catch((createError) => {
                console.error('Error creating profile:', createError);
                if (mounted) {
                  setLoading(false);
                }
              });
          } else if (data) {
            setProfile(data as Profile);
            setLoading(false);
          } else {
            setLoading(false);
          }
        }
      })
      .catch((error) => {
        console.error('Error fetching profile:', error);
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [session?.user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    return {};
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      // Get the current origin for redirect URL
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth-callback`
        : '/auth-callback';
      
      console.log('Signing up user:', email);
      
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
      
      if (error) {
        console.error('Sign up error:', error);
        return { error: error.message };
      }
      
      if (data.user) {
        console.log('User created, creating profile:', data.user.id);
        
        // Create profile with onboarding not completed
        // User will complete onboarding after email confirmation
        // Use a timeout to prevent hanging
        const profilePromise = supabase.from('profiles').upsert({
          id: data.user.id,
          archetype: 'Minimalist',
          dietary_restrictions: [],
          cooking_skill: 'Intermediate',
          onboarding_completed: false,
        }, {
          onConflict: 'id'
        });
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile creation timeout')), 5000)
        );
        
        try {
          const { error: profileError } = await Promise.race([profilePromise, timeoutPromise]) as any;
          
          if (profileError) {
            console.error('Profile creation error:', profileError);
            // Don't fail signup if profile creation fails - it can be created later
            // The profile will be created automatically when user confirms email
          } else {
            console.log('Profile created successfully');
          }
        } catch (profileErr: any) {
          console.error('Profile creation failed:', profileErr);
          // Don't fail signup - profile can be created later
        }
      }
      
      return {};
    } catch (err: any) {
      console.error('Sign up exception:', err);
      return { error: err.message || 'Er ging iets mis bij het aanmaken van je account' };
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
    if (!session?.user) {
      setProfile(null);
      return;
    }
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (data) {
      setProfile(data as Profile);
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


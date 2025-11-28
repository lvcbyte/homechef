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
      } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        if (!newSession) {
          setProfile(null);
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
            // Profile doesn't exist, create it
            supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                archetype: 'Minimalist',
                dietary_restrictions: [],
                cooking_skill: 'Intermediate',
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });
    if (error) {
      return { error: error.message };
    }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        archetype: 'Minimalist',
        dietary_restrictions: [],
        cooking_skill: 'Beginner',
      });
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
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


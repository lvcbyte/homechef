import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set up auth state change listener to catch when Supabase processes the tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session) {
        try {
          await refreshProfile();
          await new Promise(resolve => setTimeout(resolve, 500));

          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();

          if (profile && (profile.onboarding_completed === false || profile.onboarding_completed === null)) {
            router.replace('/onboarding');
          } else {
            router.replace('/');
          }
        } catch (err) {
          console.error('Error in auth state change handler:', err);
        }
      }
    });

    const handleAuthCallback = async () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        console.log('Auth callback - Full URL:', window.location.href);
        console.log('Auth callback - Hash:', window.location.hash);
        console.log('Auth callback - Search:', window.location.search);

        // Supabase automatically handles the session from URL hash/query params
        // when detectSessionInUrl is enabled, but we need to wait for it
        // Check if we have tokens in hash or query params
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(search);

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');

        console.log('Auth callback - Tokens found:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
        });

        // Wait longer for Supabase to process the session automatically
        // Supabase with detectSessionInUrl should handle this, but we give it time
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if session was set automatically by Supabase
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();

        console.log('Auth callback - Session check:', {
          hasSession: !!session,
          sessionError: sessionError?.message,
        });

        // If no session but we have tokens, try to set session manually
        if (!session && accessToken && refreshToken) {
          console.log('Auth callback - Setting session manually');
          const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            console.error('Auth callback - Error setting session:', setSessionError);
            throw setSessionError;
          }

          session = sessionData.session;
        }

        // If we still don't have a session, try using the onAuthStateChange listener
        if (!session) {
          console.log('Auth callback - Waiting for auth state change');
          // Wait a bit more and check again
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          session = retrySession;
        }

        if (session) {
          console.log('Auth callback - Session found, user:', session.user?.email);
          // Session is set, refresh profile
          await refreshProfile();

          // Wait for profile to load
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check onboarding status
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
          }

          if (profile && (profile.onboarding_completed === false || profile.onboarding_completed === null)) {
            // Redirect to onboarding
            router.replace('/onboarding');
          } else {
            // Redirect to home
            router.replace('/');
          }
        } else {
          // No session and no tokens - show helpful error
          console.error('Auth callback - No session found');
          console.error('Auth callback - URL details:', {
            hash,
            search,
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
          });
          
          setError('Geen authenticatie tokens gevonden. Controleer of je op de juiste link hebt geklikt uit de e-mail.');
          setStatus('error');
          setTimeout(() => {
            router.replace('/welcome');
          }, 3000);
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Er ging iets mis bij het inloggen. Probeer opnieuw of neem contact op met support.');
        setStatus('error');
        setTimeout(() => {
          router.replace('/welcome');
        }, 3000);
      }
    };

    handleAuthCallback();

    return () => {
      subscription.unsubscribe();
    };
  }, [router, refreshProfile]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={styles.text}>Bezig met inloggen...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
            </View>
            <Text style={styles.errorTitle}>Verificatie mislukt</Text>
            <Text style={styles.errorText}>{error || 'Er ging iets mis'}</Text>
            <View style={styles.errorInfoBox}>
              <Text style={styles.errorInfoText}>
                • Controleer of je op de juiste link hebt geklikt uit de e-mail{'\n'}
                • Zorg dat de link niet verlopen is{'\n'}
                • Probeer de link opnieuw te openen
              </Text>
            </View>
            <Pressable
              style={styles.retryButton}
              onPress={() => router.replace('/welcome')}
            >
              <Text style={styles.retryButtonText}>Terug naar start</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
  },
  errorIconContainer: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorInfoBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
    width: '100%',
    maxWidth: 400,
  },
  errorInfoText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});


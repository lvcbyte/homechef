import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isHandled = false;
    let timeoutId: NodeJS.Timeout;

    // Set up auth state change listener to catch when Supabase processes the tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event, 'Session:', !!session, 'User:', session?.user?.email);
      
      if (isHandled) {
        console.log('Already handled, ignoring event');
        return;
      }
      
      // Handle various auth events that indicate successful authentication
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        try {
          console.log('Processing sign in via auth state change, event:', event);
          setStatus('loading'); // Keep loading state visible
          
          await refreshProfile();
          await new Promise(resolve => setTimeout(resolve, 500));

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
          }

          if (profile && (profile.onboarding_completed === false || profile.onboarding_completed === null)) {
            console.log('Redirecting to onboarding');
            router.replace('/onboarding');
          } else {
            console.log('Redirecting to home');
            router.replace('/');
          }
        } catch (err) {
          console.error('Error in auth state change handler:', err);
          isHandled = false; // Allow retry
          setError('Er ging iets mis bij het inloggen.');
          setStatus('error');
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

        // For email confirmation, Supabase uses hash fragments (#access_token=...)
        // We need to explicitly handle this by calling getSession which triggers URL parsing
        // Wait a bit for Supabase to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Try to get session - this should trigger Supabase to parse the URL hash
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // If still no session, wait a bit more and try again
        if (!session) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResult = await supabase.auth.getSession();
          session = retryResult.data.session;
          sessionError = retryResult.error;
        }

        console.log('Auth callback - Session check:', {
          hasSession: !!session,
          sessionError: sessionError?.message,
        });

        // If no session but we have tokens, try to set session manually
        if (!session && accessToken && refreshToken) {
          console.log('Auth callback - Setting session manually with tokens');
          try {
            const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              console.error('Auth callback - Error setting session:', setSessionError);
              // Don't throw, continue to wait for auth state change
            } else if (sessionData?.session) {
              session = sessionData.session;
              console.log('Auth callback - Session set manually successfully');
            }
          } catch (setSessionErr) {
            console.error('Auth callback - Exception setting session:', setSessionErr);
            // Continue to wait for auth state change
          }
        }

        // If we still don't have a session, wait for auth state change
        // This handles cases where Supabase processes the URL hash asynchronously
        if (!session) {
          console.log('Auth callback - No session yet, waiting for auth state change or timeout...');
          // The auth state change listener will handle this
          // We set a timeout above to show error if nothing happens
        }

        if (session) {
          if (isHandled) return;
          isHandled = true;
          if (timeoutId) clearTimeout(timeoutId);
          
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
          // No session and no tokens - wait a bit more for auth state change
          console.log('Auth callback - No session yet, waiting for auth state change...');
          
          // Set a timeout to show error if nothing happens
          timeoutId = setTimeout(() => {
            if (isHandled) return;
            isHandled = true;
            
            console.error('Auth callback - Timeout waiting for session');
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
          }, 5000); // Wait 5 seconds before showing error
        }
      } catch (err: any) {
        if (isHandled) return;
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        
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
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router, refreshProfile]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <SafeAreaViewComponent style={styles.safeArea}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={styles.text}>Bezig met inloggen...</Text>
          </View>
        </SafeAreaViewComponent>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <SafeAreaViewComponent style={styles.safeArea}>
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
        </SafeAreaViewComponent>
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


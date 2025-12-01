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
        if (isHandled) {
          console.log('[auth-callback] Already handled, ignoring duplicate event');
          return;
        }
        
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        console.log('[auth-callback] Processing sign in via auth state change, event:', event, 'user:', session.user?.email);
        
        // For email verification (SIGNED_IN after email confirmation), always go to onboarding
        // Don't wait for profile - just redirect immediately
        if (event === 'SIGNED_IN') {
          console.log('[auth-callback] Email verification detected - redirecting to onboarding');
          // Delay to ensure router is mounted
          setTimeout(() => {
            try {
              router.replace('/onboarding');
            } catch (error) {
              console.warn('[auth-callback] Router not ready, retrying...');
              setTimeout(() => {
                try {
                  router.replace('/onboarding');
                } catch (retryError) {
                  console.error('[auth-callback] Redirect failed:', retryError);
                }
              }, 500);
            }
          }, 500);
          return;
        }
        
        // For other events, check profile status
        try {
          // Try to refresh profile, but don't wait too long
          const profileCheckPromise = refreshProfile().catch(err => {
            console.warn('[auth-callback] Profile refresh failed, continuing anyway:', err);
          });
          
          // Also check profile directly
          const profileQueryPromise = supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single()
            .catch(err => {
              console.warn('[auth-callback] Profile query failed:', err);
              return { data: null, error: err };
            });
          
          // Wait max 1 second for profile check
          const [_, profileResult] = await Promise.race([
            Promise.all([profileCheckPromise, profileQueryPromise]),
            new Promise((resolve) => setTimeout(() => resolve([null, { data: null, error: null }]), 1000))
          ]) as any;
          
          const profile = profileResult?.data;
          
          // Redirect based on profile status
          if (profile && profile.onboarding_completed === true) {
            console.log('[auth-callback] Onboarding completed - redirecting to home');
            setTimeout(() => {
              try {
                router.replace('/');
              } catch (error) {
                console.warn('[auth-callback] Router not ready, retrying...');
                setTimeout(() => router.replace('/'), 500);
              }
            }, 500);
          } else {
            // Profile doesn't exist or onboarding not completed - go to onboarding
            console.log('[auth-callback] Redirecting to onboarding');
            setTimeout(() => {
              try {
                router.replace('/onboarding');
              } catch (error) {
                console.warn('[auth-callback] Router not ready, retrying...');
                setTimeout(() => router.replace('/onboarding'), 500);
              }
            }, 500);
          }
        } catch (err) {
          console.error('[auth-callback] Error in auth state change handler:', err);
          // On error, redirect to onboarding anyway
          console.log('[auth-callback] Error occurred - redirecting to onboarding');
          setTimeout(() => {
            try {
              router.replace('/onboarding');
            } catch (error) {
              console.warn('[auth-callback] Router not ready, retrying...');
              setTimeout(() => router.replace('/onboarding'), 500);
            }
          }, 500);
        }
      }
    });

    const handleAuthCallback = async () => {
      try {
        if (typeof window === 'undefined') {
          return;
        }

        console.log('[auth-callback] Full URL:', window.location.href);
        console.log('[auth-callback] Hash:', window.location.hash);
        console.log('[auth-callback] Search:', window.location.search);

        // Extract tokens from URL hash or query params
        // Supabase email confirmation uses hash fragments: #access_token=...&refresh_token=...
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(search);

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const error = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        console.log('[auth-callback] Tokens found:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
          error,
          errorDescription,
        });

        // If there's an error in the URL, show it
        if (error) {
          console.error('[auth-callback] Error in URL:', error, errorDescription);
          isHandled = true;
          setError(errorDescription || error || 'Er ging iets mis bij de verificatie.');
          setStatus('error');
          setTimeout(() => router.replace('/welcome'), 3000);
          return;
        }

        // If we have tokens, try to set session immediately
        if (accessToken && refreshToken) {
          console.log('[auth-callback] Found tokens, setting session...');
          try {
            const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
              console.error('[auth-callback] Error setting session:', setSessionError);
              // Continue to try getSession as fallback
            } else if (sessionData?.session) {
              console.log('[auth-callback] Session set successfully via setSession');
              // Session is set - for email verification, always go to onboarding
              if (!isHandled) {
                isHandled = true;
                if (timeoutId) clearTimeout(timeoutId);
                
                // For email verification, always redirect to onboarding
                // Don't wait for profile - onboarding will handle it
                console.log('[auth-callback] Email verification - redirecting to onboarding immediately');
                setTimeout(() => {
                  router.replace('/onboarding');
                }, 300);
                return;
              }
            }
          } catch (setSessionErr: any) {
            console.error('[auth-callback] Exception setting session:', setSessionErr);
            // Continue to try getSession as fallback
          }
        }

        // Also try getSession - Supabase might have already processed the URL
        // Wait a bit for Supabase to initialize and process the URL
        await new Promise(resolve => setTimeout(resolve, 300));

        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // If still no session, wait a bit more and try again (Supabase might need more time)
        if (!session) {
          console.log('[auth-callback] No session yet, waiting and retrying...');
          await new Promise(resolve => setTimeout(resolve, 500));
          const retryResult = await supabase.auth.getSession();
          session = retryResult.data.session;
          sessionError = retryResult.error;
        }

        console.log('[auth-callback] Session check:', {
          hasSession: !!session,
          sessionError: sessionError?.message,
        });

        // If we have a session, handle it
        if (session) {
          if (isHandled) {
            console.log('[auth-callback] Already handled, skipping duplicate session handling');
            return;
          }
          
          isHandled = true;
          if (timeoutId) clearTimeout(timeoutId);
          
          console.log('[auth-callback] Session found, user:', session.user?.email);
          
          // For email verification (first time login), always redirect to onboarding
          // Don't wait for profile checks - just redirect immediately
          console.log('[auth-callback] Email verification detected - redirecting to onboarding immediately');
          setTimeout(() => {
            try {
              router.replace('/onboarding');
            } catch (error) {
              console.warn('[auth-callback] Router not ready, retrying...');
              setTimeout(() => {
                try {
                  router.replace('/onboarding');
                } catch (retryError) {
                  console.error('[auth-callback] Redirect failed:', retryError);
                }
              }, 500);
            }
          }, 500);
        } else {
          // No session yet - check if we have tokens
          if (!accessToken || !refreshToken) {
            // No tokens in URL - this is an error
            console.error('[auth-callback] No tokens found in URL');
            isHandled = true;
            setError('Geen authenticatie tokens gevonden in de URL. Controleer of je op de juiste link hebt geklikt uit de e-mail.');
          setStatus('error');
          setTimeout(() => {
            router.replace('/welcome');
            }, 3000);
            return;
          }
          
          // We have tokens but no session - wait for auth state change
          // The auth state change listener should fire when Supabase processes the tokens
          console.log('[auth-callback] Have tokens but no session yet, waiting for auth state change...');
          
          // Set a timeout - if nothing happens in 3 seconds, redirect to onboarding anyway
          timeoutId = setTimeout(() => {
            if (isHandled) return;
            isHandled = true;
            
            console.warn('[auth-callback] Timeout waiting for session after 3 seconds');
            console.warn('[auth-callback] URL details:', {
              hash: hash.substring(0, 100) + '...',
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
            });
            
            // Redirect to onboarding - user can sign in manually if needed
            console.log('[auth-callback] Timeout - redirecting to onboarding');
            setTimeout(() => {
              try {
                router.replace('/onboarding');
              } catch (error) {
                console.warn('[auth-callback] Router not ready, retrying...');
                setTimeout(() => router.replace('/onboarding'), 500);
              }
            }, 500);
          }, 3000); // Wait 3 seconds before redirecting anyway
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


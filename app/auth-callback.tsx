import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Image } from 'expo-image';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
      
      // Handle successful email verification
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        console.log('[auth-callback] Email verification successful, user:', session.user?.email);
        setUserEmail(session.user?.email || null);
        setStatus('success');
        return;
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
        const hash = window.location.hash.substring(1);
        const search = window.location.search.substring(1);
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(search);

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const code = searchParams.get('code'); // PKCE code
        const type = hashParams.get('type') || searchParams.get('type');
        const error = hashParams.get('error') || searchParams.get('error_description') || searchParams.get('error');

        console.log('[auth-callback] URL params found:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
          type,
          error,
        });

        // If there's an error in the URL, show it
        if (error) {
          console.error('[auth-callback] Error in URL:', error);
          isHandled = true;
          setError(error || 'Er ging iets mis bij de verificatie.');
          setStatus('error');
          return;
        }

        // If we have a PKCE code, exchange it for a session
        if (code) {
          console.log('[auth-callback] Found PKCE code, exchanging for session...', code.substring(0, 20) + '...');
          try {
            const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

            if (exchangeError) {
              console.error('[auth-callback] Error exchanging code for session:', exchangeError);
              console.error('[auth-callback] Error details:', {
                message: exchangeError.message,
                status: exchangeError.status,
                name: exchangeError.name,
              });
              
              // If code exchange fails, show error immediately
              isHandled = true;
              if (timeoutId) clearTimeout(timeoutId);
              setError(`Code uitwisseling mislukt: ${exchangeError.message || 'Onbekende fout'}. Probeer de link opnieuw te openen.`);
              setStatus('error');
              return;
            } else if (sessionData?.session) {
              console.log('[auth-callback] Session obtained via code exchange, user:', sessionData.session.user?.email);
              if (!isHandled) {
                isHandled = true;
                if (timeoutId) clearTimeout(timeoutId);
                setUserEmail(sessionData.session.user?.email || null);
                setStatus('success');
                return;
              }
            } else {
              console.warn('[auth-callback] Code exchange succeeded but no session returned');
            }
          } catch (exchangeErr: any) {
            console.error('[auth-callback] Exception exchanging code:', exchangeErr);
            console.error('[auth-callback] Exception details:', {
              message: exchangeErr.message,
              stack: exchangeErr.stack,
            });
            
            // If exception occurs, show error
            isHandled = true;
            if (timeoutId) clearTimeout(timeoutId);
            setError(`Fout bij code uitwisseling: ${exchangeErr.message || 'Onbekende fout'}. Probeer de link opnieuw te openen.`);
            setStatus('error');
            return;
          }
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
            } else if (sessionData?.session) {
              console.log('[auth-callback] Session set successfully via setSession');
              if (!isHandled) {
                isHandled = true;
                if (timeoutId) clearTimeout(timeoutId);
                setUserEmail(sessionData.session.user?.email || null);
                setStatus('success');
                return;
              }
            }
          } catch (setSessionErr: any) {
            console.error('[auth-callback] Exception setting session:', setSessionErr);
          }
        }

        // If we already handled via code exchange, don't continue
        if (isHandled) {
          return;
        }

        // Also try getSession - Supabase might have already processed the URL
        // But only if we didn't have a code (code exchange should have handled it)
        if (!code) {
          console.log('[auth-callback] No code found, trying getSession...');
          await new Promise(resolve => setTimeout(resolve, 300));

          let { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          // If still no session, wait a bit more and try again
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

          // If we have a session, show success
          if (session) {
            if (isHandled) {
              console.log('[auth-callback] Already handled, skipping duplicate session handling');
              return;
            }
            
            isHandled = true;
            if (timeoutId) clearTimeout(timeoutId);
            
            console.log('[auth-callback] Session found, user:', session.user?.email);
            setUserEmail(session.user?.email || null);
            setStatus('success');
          }
        }
        
        // If we still don't have a session and we have a code, that's an error
        if (!isHandled && code) {
          console.error('[auth-callback] Code found but no session after exchange');
          isHandled = true;
          setError('Code uitwisseling mislukt. Controleer of de link nog geldig is en probeer opnieuw.');
          setStatus('error');
        } else if (!isHandled && !code && !accessToken && !refreshToken) {
          // No code or tokens in URL - this is an error
          console.error('[auth-callback] No code or tokens found in URL');
          isHandled = true;
          setError('Geen authenticatie code of tokens gevonden in de URL. Controleer of je op de juiste link hebt geklikt uit de e-mail.');
          setStatus('error');
        } else if (!isHandled) {
          // We have code or tokens but no session - wait for auth state change
          console.log('[auth-callback] Have code/tokens but no session yet, waiting for auth state change...');
          
          // Set a timeout - if nothing happens in 5 seconds, show error
          timeoutId = setTimeout(() => {
            if (isHandled) return;
            isHandled = true;
            
            console.warn('[auth-callback] Timeout waiting for session after 5 seconds');
            setError('Het duurt langer dan verwacht. Probeer de link opnieuw te openen of neem contact op met support.');
            setStatus('error');
          }, 5000);
        }
      } catch (err: any) {
        if (isHandled) return;
        isHandled = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        console.error('Auth callback error:', err);
        setError(err.message || 'Er ging iets mis bij het inloggen. Probeer opnieuw of neem contact op met support.');
        setStatus('error');
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
            <Text style={styles.loadingText}>E-mail bevestigen...</Text>
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
              style={styles.primaryButton}
              onPress={() => router.replace('/welcome')}
            >
              <Text style={styles.primaryButtonText}>Terug naar start</Text>
            </Pressable>
          </View>
        </SafeAreaViewComponent>
      </View>
    );
  }

  // Success screen - professional Stockpit branded
  if (status === 'success') {
    return (
      <View style={styles.container}>
        <SafeAreaViewComponent style={styles.safeArea}>
          <View style={styles.successContent}>
            <View style={styles.successIconContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={48} color="#047857" />
              </View>
            </View>
            
            <Text style={styles.successTitle}>E-mail bevestigd!</Text>
            <Text style={styles.successSubtitle}>
              Je account is succesvol aangemaakt. Je kunt nu inloggen en beginnen met het ontdekken van heerlijke recepten.
            </Text>

            {userEmail && (
              <View style={styles.emailBox}>
                <Ionicons name="mail-outline" size={20} color="#047857" />
                <Text style={styles.emailText}>{userEmail}</Text>
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#047857" />
              <Text style={styles.infoText}>
                Na het inloggen kun je je voorkeuren instellen en beginnen met het ontdekken van recepten op basis van je voorraad.
              </Text>
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/welcome')}
            >
              <Text style={styles.primaryButtonText}>Ga naar inloggen</Text>
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
    paddingHorizontal: 24,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '500',
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  successIconContainer: {
    marginBottom: 8,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0fdf4',
    borderWidth: 3,
    borderColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 400,
  },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
    width: '100%',
    maxWidth: 400,
  },
  emailText: {
    fontSize: 15,
    color: '#047857',
    fontWeight: '600',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    width: '100%',
    maxWidth: 400,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#047857',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
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
});

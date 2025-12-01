import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaViewComponent style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>Log in</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.heroTitle}>Welkom terug</Text>
          <Text style={styles.heroSub}>Koppel je voorraad en ontdek meteen wat je kunt maken.</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="jou@stockpit.dev"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Wachtwoord</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              secureTextEntry
            />
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <Pressable
            style={[styles.primaryButton, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={async () => {
              if (!email || !password) {
                setErrorMessage('Vul alstublieft je e-mail en wachtwoord in.');
                return;
              }
              
              setSubmitting(true);
              setErrorMessage(null);
              
              let timeoutId: NodeJS.Timeout | null = null;
              
              // Add timeout to prevent infinite loading (backup timeout)
              timeoutId = setTimeout(() => {
                setErrorMessage('Het duurt langer dan verwacht. Controleer je internetverbinding en probeer het opnieuw.');
                setSubmitting(false);
              }, 20000); // 20 second backup timeout (auth call has 15s timeout)
              
              try {
                const result = await signIn(email, password);
                if (timeoutId) clearTimeout(timeoutId);
                
                if (result.error) {
                  setSubmitting(false);
                  setErrorMessage(result.error);
                } else {
                  // Wait a bit for auth state to update and profile to load
                  setTimeout(async () => {
                    try {
                      // Refresh profile to get latest onboarding status
                      await refreshProfile();
                      
                      // Small delay to ensure profile is loaded
                      setTimeout(() => {
                        setSubmitting(false);
                        // Let the index.tsx handle the redirect based on onboarding status
                        // This ensures the profile is fully loaded
                        router.replace('/');
                      }, 200);
                    } catch (profileErr) {
                      console.error('Error refreshing profile:', profileErr);
                      setSubmitting(false);
                      // Still redirect, profile will load later
                      router.replace('/');
                    }
                  }, 300);
                }
              } catch (err: any) {
                if (timeoutId) clearTimeout(timeoutId);
                console.error('Sign in error:', err);
                setErrorMessage(err.message || 'Er is een onverwachte fout opgetreden. Probeer het opnieuw.');
                setSubmitting(false);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>{submitting ? 'Aan het inloggen...' : 'Sign in'}</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/sign-up')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>
              Nog geen account? <Text style={{ color: '#047857' }}>Maak er één</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaViewComponent>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    gap: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSub: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#e11d48',
    fontWeight: '600',
    fontSize: 13,
  },
  secondaryButton: {
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    color: '#475569',
  },
});



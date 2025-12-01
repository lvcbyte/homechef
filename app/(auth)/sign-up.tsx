import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    console.log('showSuccessModal changed to:', showSuccessModal);
  }, [showSuccessModal]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaViewComponent style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>Account aanmaken</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.heroTitle}>Welkom bij STOCKPIT</Text>
          <Text style={styles.heroSub}>
            Bouw je voorraadarchief en krijg realtime inspiratie op maat van jouw keuken.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Naam</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Jouw naam"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />
          </View>

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
              placeholder="Minimaal 8 tekens"
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
              
              if (password.length < 8) {
                setErrorMessage('Wachtwoord moet minimaal 8 tekens lang zijn.');
                return;
              }
              
              setSubmitting(true);
              setErrorMessage(null);
              
              let timeoutId: NodeJS.Timeout | null = null;
              
              // Add timeout to prevent infinite loading (backup timeout)
              timeoutId = setTimeout(() => {
                setErrorMessage('Het duurt langer dan verwacht. Controleer je internetverbinding en probeer het opnieuw.');
                setSubmitting(false);
              }, 30000); // 30 second backup timeout
              
              try {
                const result = await signUp(email, password, name);
                if (timeoutId) clearTimeout(timeoutId);
                
                console.log('Sign up result:', result);
                if (result.error) {
                  setErrorMessage(result.error);
                  setSubmitting(false);
                } else {
                  // Success - show modal
                  console.log('Sign up successful, showing modal');
                  setSubmitting(false);
                  setShowSuccessModal(true);
                  console.log('showSuccessModal set to:', true);
                }
              } catch (err: any) {
                if (timeoutId) clearTimeout(timeoutId);
                console.error('Sign up error:', err);
                setErrorMessage(err.message || 'Er is een onverwachte fout opgetreden. Probeer het opnieuw.');
                setSubmitting(false);
              }
            }}
          >
            <Text style={styles.primaryButtonText}>{submitting ? 'Bezig...' : 'Account maken'}</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(auth)/sign-in')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>
              Heb je al een account? <Text style={{ color: '#047857' }}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaViewComponent>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.push(`/(auth)/verify-email?email=${encodeURIComponent(email)}`);
        }}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => {
            setShowSuccessModal(false);
            router.push(`/(auth)/verify-email?email=${encodeURIComponent(email)}`);
          }}
        >
          <Pressable 
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.successIconContainer}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={48} color="#fff" />
              </View>
            </View>
            
            <Text style={styles.successTitle}>Account aangemaakt!</Text>
            <Text style={styles.successMessage}>
              Welkom bij STOCKPIT, {name || 'gebruiker'}! Je account is succesvol aangemaakt. Je kunt nu beginnen met het opbouwen van je voorraadarchief.
            </Text>

            <Pressable
              style={styles.successButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.push(`/(auth)/verify-email?email=${encodeURIComponent(email)}`);
              }}
            >
              <Text style={styles.successButtonText}>Doorgaan</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  // Success Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  successMessage: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  successButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  successButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});



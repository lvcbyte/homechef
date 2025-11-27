import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>Account aanmaken</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.heroTitle}>Welkom bij HomeChef</Text>
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
              placeholder="jou@homechef.dev"
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
              setSubmitting(true);
              setErrorMessage(null);
              const { error } = await signUp(email, password, name);
              setSubmitting(false);
              if (error) {
                setErrorMessage(error);
              } else {
                router.replace('/');
              }
            }}
          >
            <Text style={styles.primaryButtonText}>{submitting ? 'Bezig...' : 'Account maken'}</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/sign-in')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>
              Heb je al een account? <Text style={{ color: '#047857' }}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
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



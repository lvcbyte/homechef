import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = (params.email as string) || '';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-outline" size={64} color="#047857" />
            </View>
          </View>

          <Text style={styles.title}>Bevestig je e-mailadres</Text>
          
          <Text style={styles.message}>
            We hebben een bevestigingslink gestuurd naar:
          </Text>

          {email && (
            <View style={styles.emailContainer}>
              <Text style={styles.emailText}>{email}</Text>
            </View>
          )}

          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>Volg deze stappen:</Text>
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Open je e-mail inbox</Text>
            </View>
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Zoek naar de e-mail van STOCKPIT</Text>
            </View>
            <View style={styles.stepContainer}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Klik op de bevestigingslink in de e-mail</Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#047857" />
            <Text style={styles.infoText}>
              Controleer ook je spam/junk folder als je de e-mail niet ziet.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Na bevestiging kun je inloggen en beginnen met STOCKPIT.
            </Text>
          </View>
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
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1fae5',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  emailContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
  },
  emailText: {
    fontSize: 15,
    color: '#047857',
    fontWeight: '600',
    textAlign: 'center',
  },
  instructionsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 20,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    flex: 1,
    paddingTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  infoText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    width: '100%',
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});


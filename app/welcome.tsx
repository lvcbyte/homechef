import { usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { user, profile } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Mark component as mounted after a short delay
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 100);
    
    // Reset redirect flag when we're on welcome page
    if (typeof window !== 'undefined') {
      (window as any).__redirectingToWelcome = false;
    }
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // ONLY redirect if:
    // 1. Component is mounted
    // 2. User is authenticated
    // 3. We're actually on the welcome page (pathname check)
    // 4. Profile exists (if profile is null, don't redirect - user should sign in again)
    // This prevents redirects when user is on other pages
    if (isMounted && user && profile && pathname === '/welcome') {
      const timer = setTimeout(async () => {
        try {
          // Check onboarding status before redirecting
          if (profile.onboarding_completed === false || profile.onboarding_completed === null) {
            router.replace('/onboarding');
          } else {
            router.replace('/');
          }
        } catch (error) {
          // Router might not be ready yet, ignore error
          console.log('Router not ready yet');
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // If user exists but profile is null, clear the session
    // This prevents redirect loops and ensures user needs to sign in again
    if (isMounted && user && !profile && pathname === '/welcome') {
      console.log('[welcome] User exists but profile is null, clearing session');
      // Clear auth state - user needs to sign in again
      const clearStorage = (storage: Storage) => {
        try {
          const keys = Object.keys(storage);
          keys.forEach(key => {
            if (
              key.includes('supabase') || 
              key.includes('auth-token') || 
              key.includes('auth-token-code-verifier') ||
              key.startsWith('sb-') ||
              key.includes('supabase.auth')
            ) {
              storage.removeItem(key);
            }
          });
        } catch (e) {
          // Storage might not be accessible
        }
      };
      if (typeof window !== 'undefined') {
        clearStorage(window.localStorage);
        clearStorage(window.sessionStorage);
        // Sign out from Supabase
        supabase.auth.signOut().catch((err) => {
          console.warn('[welcome] Error signing out:', err);
        });
      }
    }
  }, [user, profile, isMounted, pathname]);

  useEffect(() => {
    // Subtle fade-in animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <SafeAreaViewComponent style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>

            {/* Branding Section */}
            <View style={styles.brandingSection}>
              <Text style={styles.brandName}>STOCKPIT</Text>
              <Text style={styles.tagline}>Jouw keuken, slimmer georganiseerd.</Text>
            </View>

            {/* Mission Statement */}
            <View style={styles.missionSection}>
              <Text style={styles.missionText}>
                Slimme inventaris.{'\n'}
                Meesterlijke maaltijden.{'\n'}
                Geen verspilling.
              </Text>
            </View>

            {/* CTA Section */}
            <View style={styles.ctaSection}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push('/(auth)/sign-up')}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Account aanmaken</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push('/(auth)/sign-in')}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Ik heb al een account</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaViewComponent>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
    minHeight: SCREEN_HEIGHT - (Platform.OS === 'ios' ? 100 : 80),
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 20 : 0,
    marginBottom: 48,
  },
  logo: {
    width: 64,
    height: 64,
  },
  brandingSection: {
    alignItems: 'center',
    marginBottom: 80,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1.5,
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 17,
    color: '#64748b',
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  missionSection: {
    alignItems: 'center',
    marginBottom: 80,
    paddingHorizontal: 20,
  },
  missionText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  ctaSection: {
    gap: 16,
    paddingBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#047857',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#14b8a6',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});

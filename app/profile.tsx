import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { navigateToRoute } from '../utils/navigation';

const archetypes = [
  {
    id: 'None',
    icon: 'shuffle',
    description: 'Toon alle recepten at random',
    color: '#64748b',
  },
  {
    id: 'Minimalist',
    icon: 'flash',
    description: 'Values speed and low ingredient counts (<5 items)',
    color: '#60a5fa',
  },
  {
    id: 'Bio-Hacker',
    icon: 'fitness',
    description: 'Values macro-nutrient density and clean ingredients',
    color: '#4ade80',
  },
  {
    id: 'Flavor Hunter',
    icon: 'restaurant',
    description: 'Values complexity and taste over convenience',
    color: '#f59e0b',
  },
  {
    id: 'Meal Prepper',
    icon: 'calendar',
    description: 'Values scale and storage stability',
    color: '#a78bfa',
  },
  {
    id: 'Family Manager',
    icon: 'people',
    description: 'Values "kid-friendly" tags and bulk portions',
    color: '#f472b6',
  },
];

const dietaryRestrictions = [
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Keto',
  'Paleo',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [selectedArchetype, setSelectedArchetype] = useState('None');
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>(['Gluten-Free']);
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSelectedArchetype(profile.archetype ?? 'None');
    setSelectedRestrictions((profile.dietary_restrictions as string[]) ?? []);
    setSkillLevel(profile.cooking_skill ?? 'Intermediate');
  }, [profile]);

  const toggleRestriction = (restriction: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(restriction)
        ? prev.filter((r) => r !== restriction)
        : [...prev, restriction]
    );
  };

  const skillLevels = ['Beginner', 'Intermediate', 'Advanced'];

  const handleSave = async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        archetype: selectedArchetype,
        dietary_restrictions: selectedRestrictions,
        cooking_skill: skillLevel,
      }, {
        onConflict: 'id'
      });
      
      if (error) {
        console.error('Error saving profile:', error);
        Alert.alert('Fout', 'Kon voorkeuren niet opslaan. Probeer het opnieuw.');
        setSaving(false);
        return;
      }
      
      // Refresh profile in AuthContext
      await refreshProfile();
      
      Alert.alert('Opgeslagen', 'Je voorkeuren zijn opgeslagen en worden nu toegepast op je feed.');
    } catch (err) {
      console.error('Exception saving profile:', err);
      Alert.alert('Fout', 'Er is een fout opgetreden. Probeer het opnieuw.');
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    (user?.user_metadata?.full_name as string) ?? user?.email?.split('@')[0] ?? 'User';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView 
        style={styles.safeArea}
        // @ts-ignore - web-specific prop
        {...(Platform.OS === 'web' && {
          className: 'safe-area-top',
        })}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandLabel}>STOCKPIT</Text>
          </View>
          <View style={styles.headerIcons}>
            {profile?.is_admin && (
              <Pressable 
                onPress={() => navigateToRoute(router, '/admin')}
                style={styles.adminButton}
              >
                <Ionicons name="shield" size={20} color="#047857" />
              </Pressable>
            )}
            <Pressable onPress={() => navigateToRoute(router, '/profile')}>
              {user ? (
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>{user.email?.charAt(0).toUpperCase() ?? 'U'}</Text>
                </View>
              ) : (
                <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {user ? (
            <>
              <View style={styles.accountCard}>
                <View>
                  <Text style={styles.accountEyebrow}>Account</Text>
                  <Text style={styles.accountName}>{displayName}</Text>
                  <Text style={styles.accountEmail}>{user.email}</Text>
                </View>
                <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
                  <Text style={styles.signOutText}>Sign out</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Archetype</Text>
                <Text style={styles.sectionSub}>Bepaalt de rangschikking van je feed</Text>
                <View style={styles.archetypeGrid}>
                  {archetypes.map((archetype) => {
                    const active = selectedArchetype === archetype.id;
                    return (
                      <TouchableOpacity
                        key={archetype.id}
                        onPress={() => setSelectedArchetype(archetype.id)}
                        style={[
                          styles.archetypeCard,
                          active && { borderColor: archetype.color, backgroundColor: `${archetype.color}15` },
                        ]}
                      >
                        <View style={[styles.archetypeIcon, { backgroundColor: `${archetype.color}22` }]}>
                          <Ionicons
                            name={archetype.icon as any}
                            size={22}
                            color={active ? archetype.color : '#64748b'}
                          />
                        </View>
                        <Text style={[styles.archetypeName, active && { color: archetype.color }]}>
                          {archetype.id}
                        </Text>
                        <Text style={styles.archetypeDescription}>{archetype.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Kookniveau</Text>
                <View style={styles.skillRow}>
                  {skillLevels.map((level) => {
                    const active = skillLevel === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        onPress={() => setSkillLevel(level)}
                        style={[styles.skillChip, active && styles.skillChipActive]}
                      >
                        <Text style={[styles.skillChipText, active && styles.skillChipTextActive]}>{level}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dieet & Allergieën</Text>
                <Text style={styles.sectionSub}>Gebruik dit om je feed te filteren</Text>
                <View style={styles.restrictionsGrid}>
                  {dietaryRestrictions.map((restriction) => {
                    const selected = selectedRestrictions.includes(restriction);
                    return (
                      <TouchableOpacity
                        key={restriction}
                        onPress={() => toggleRestriction(restriction)}
                        style={[styles.restrictionChip, selected && styles.restrictionChipActive]}
                      >
                        <Text style={[styles.restrictionChipText, selected && styles.restrictionChipTextActive]}>
                          {restriction}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
                <Text style={styles.primaryButtonText}>{saving ? 'Opslaan...' : 'Bewaar voorkeuren'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.authCard}>
              <Text style={styles.sectionTitle}>Log in om verder te gaan</Text>
              <Text style={styles.sectionSub}>
                Bewaar recepten, synchroniseer boodschappenlijsten en personaliseer je feed.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/sign-up')}>
                <Text style={styles.secondaryButtonText}>Create account</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      <GlassDock />
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
    paddingTop: Platform.select({
      web: 0, // Handled by CSS safe-area-top class
      default: 8,
    }),
  },
  header: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#047857',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 28,
  },
  accountCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 20,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#047857',
    fontWeight: '700',
  },
  accountName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 6,
  },
  accountEmail: {
    fontSize: 14,
    color: '#475569',
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#e11d48',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  signOutText: {
    color: '#e11d48',
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 13,
    color: '#94a3b8',
  },
  archetypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  archetypeCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  archetypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archetypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  archetypeDescription: {
    fontSize: 13,
    color: '#475569',
  },
  skillRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skillChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  skillChipActive: {
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
  },
  skillChipText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  skillChipTextActive: {
    color: '#047857',
  },
  restrictionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  restrictionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  restrictionChipActive: {
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
  },
  restrictionChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  restrictionChipTextActive: {
    color: '#047857',
  },
  authCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
    padding: 24,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#047857',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 16,
  },
});


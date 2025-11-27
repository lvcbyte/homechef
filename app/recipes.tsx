import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';

const moodFilters = ['Alles', 'Comfort', 'High Protein', 'Plant-based', 'Feest', 'Budget'];

const chefRadar = [
  {
    id: '1',
    title: 'Miso Butter Ramen Upgrade',
    match: '93% match • 11 items on voorraad',
    time: '45 min • Moeilijk',
    image:
      'https://images.unsplash.com/photo-1470673042977-43d9b07b7103?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: '2',
    title: 'Spicy Walnut Satay Bowl',
    match: '88% match • 8 items op voorraad',
    time: '30 min • Gemiddeld',
    image:
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=1000&q=80',
  },
];

const trendingSets = [
  { id: '3', title: 'Krokante Gochujang Wings', time: '28 min', saves: 142, image: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80' },
  { id: '4', title: 'Halloumi & Harissa Traybake', time: '32 min', saves: 101, image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=800&q=80' },
  { id: '5', title: 'Shiitake Umami Pasta', time: '24 min', saves: 87, image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80' },
];

const quickFire = [
  { id: '6', title: 'Sesam Spruitjes', time: '16 min', image: 'https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80' },
  { id: '7', title: 'Soba met Tomaat', time: '18 min', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80' },
  { id: '8', title: 'Kokos Lime Shrimp', time: '20 min', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80' },
];

export default function RecipesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('Alles');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>H</Text>
              </View>
              <Text style={styles.brandLabel}>HomeChef OS</Text>
            </View>
            <View style={styles.headerIcons}>
              <Ionicons name="search" size={22} color="#0f172a" />
              <Pressable onPress={() => router.push('/profile')}>
                {user ? (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitial}>
                      {user.email?.charAt(0).toUpperCase() ?? 'U'}
                    </Text>
                  </View>
                ) : (
                  <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
                )}
              </Pressable>
            </View>
          </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>Chef Radar</Text>
            <Text style={styles.heroTitle}>Jouw voorraad, onze recepten.</Text>
            <Text style={styles.heroSubtitle}>
              De HomeChef engine sorteert alle combinaties op beschikbaarheid en vibe. Kies jouw mood en start een sessie.
            </Text>
            <View style={styles.filterRow}>
              {moodFilters.map((filter) => {
                const active = activeFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterPill, active && styles.filterPillActive]}
                    onPress={() => setActiveFilter(filter)}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{filter}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chef Radar Picks</Text>
            <View style={styles.verticalList}>
              {chefRadar.map((item) => (
                <TouchableOpacity key={item.id} style={styles.radarCard}>
                  <Image source={{ uri: item.image }} style={styles.radarImage} />
                  <View style={styles.radarBody}>
                    <Text style={styles.radarTitle}>{item.title}</Text>
                    <Text style={styles.radarMatch}>{item.match}</Text>
                    <Text style={styles.radarTime}>{item.time}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending in jouw buurt</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {trendingSets.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.recipeCard}>
                  <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                  <View style={styles.recipeBody}>
                    <Text style={styles.socialProof}>🔥 {recipe.saves}x bewaard deze week</Text>
                    <Text style={styles.recipeName}>{recipe.title}</Text>
                    <View style={styles.recipeMeta}>
                      <Text style={styles.recipeTime}>{recipe.time}</Text>
                      <Ionicons name="bookmark-outline" size={18} color="#047857" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Klaar in 30 minuten</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickFire.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.quickCard}>
                  <Image source={{ uri: recipe.image }} style={styles.quickImage} />
                  <View style={styles.quickBody}>
                    <Text style={styles.quickTitle}>{recipe.title}</Text>
                    <View style={styles.quickTag}>
                      <Text style={styles.quickTagText}>{recipe.time}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
    paddingTop: 8,
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
    borderRadius: 10,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#f0fdf4',
    fontWeight: '800',
    fontSize: 18,
  },
  brandLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
    gap: 32,
  },
  hero: {
    gap: 12,
  },
  heroEyebrow: {
    color: '#047857',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  heroTitle: {
    fontSize: 28,
    color: '#0f172a',
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterPillActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#047857',
  },
  filterText: {
    color: '#475569',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#047857',
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  verticalList: {
    gap: 16,
  },
  radarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 12,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    gap: 12,
  },
  radarImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  radarBody: {
    flex: 1,
    gap: 4,
  },
  radarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  radarMatch: {
    fontSize: 13,
    color: '#047857',
  },
  radarTime: {
    fontSize: 12,
    color: '#475569',
  },
  recipeCard: {
    width: 220,
    marginRight: 16,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  recipeImage: {
    width: '100%',
    height: 140,
  },
  recipeBody: {
    padding: 14,
    gap: 6,
  },
  socialProof: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '600',
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  recipeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeTime: {
    fontSize: 13,
    color: '#4b5563',
  },
  quickCard: {
    width: 200,
    marginRight: 16,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  quickImage: {
    width: '100%',
    height: 120,
  },
  quickBody: {
    padding: 14,
    gap: 8,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  quickTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  quickTagText: {
    color: '#fff',
    fontWeight: '600',
  },
});



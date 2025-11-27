import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';

const categoryFilters = [
  { label: 'Italiaans', color: '#047857' },
  { label: 'Aziatisch', color: '#10b981' },
  { label: 'Vegan', color: '#14b8a6' },
  { label: 'Comfort Food', color: '#0f766e' },
];

const trendingRecipes = [
  {
    id: '1',
    title: 'Snelle Kip Katsu Curry',
    time: '25 min',
    saves: 124,
    image:
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '2',
    title: 'Geroosterde Bloemkool Taco’s',
    time: '28 min',
    saves: 98,
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '3',
    title: 'Sesam Ramen Bowl',
    time: '22 min',
    saves: 76,
    image:
      'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=800&q=80',
  },
];

const quickRecipes = [
  {
    id: '4',
    title: 'Misoboter Spruitjes',
    time: '18 min',
    image:
      'https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '5',
    title: 'Griekse Flatbread Pizza',
    time: '20 min',
    image:
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
  },
];

const videoLessons = [
  {
    id: '6',
    title: 'Video: Perfect Eieren Pocheren',
    duration: '06:12',
    thumbnail:
      'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '7',
    title: 'Video: Deeg kneden als een Pro',
    duration: '08:44',
    thumbnail:
      'https://images.unsplash.com/photo-1506368083636-6defb67639b0?auto=format&fit=crop&w=800&q=80',
  },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();

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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero */}
          <View style={styles.heroCard}>
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
              }}
              style={styles.heroImage}
            />
            <View style={styles.heroContent}>
              <Text style={styles.heroTag}>RECEPT V/D DAG</Text>
              <Text style={styles.heroTitle}>Zelfgemaakte Tonkotsu Ramen</Text>
              <Text style={styles.heroDescription}>
                Een rijke, romige bouillon die 12 uur heeft getrokken. Maak indruk op je gasten.
              </Text>
              <View style={styles.heroMetaRow}>
                {['60+ min', 'Moeilijk', '4 pers.'].map((tag) => (
                  <View key={tag} style={styles.heroMetaPill}>
                    <Text style={styles.heroMetaText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Speciaal voor jou</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryRow}>
                {categoryFilters.map((cat) => (
                  <TouchableOpacity key={cat.label} style={[styles.categoryBox, { backgroundColor: cat.color }]}>
                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Trending */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending in jouw buurt</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {trendingRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.recipeCard}>
                  <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                  <View style={styles.recipeBody}>
                    <Text style={styles.socialProof}>🔥 {recipe.saves}x bewaard deze week</Text>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <View style={styles.recipeMeta}>
                      <Text style={styles.recipeTime}>{recipe.time}</Text>
                      <Ionicons name="bookmark-outline" size={18} color="#047857" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Quick */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Klaar in 30 minuten</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.recipeCard}>
                  <Image source={{ uri: recipe.image }} style={styles.recipeImage} />
                  <View style={styles.recipeBody}>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <View style={styles.quickPill}>
                      <Text style={styles.quickPillText}>{recipe.time}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Video lessons */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leer de Techniek</Text>
            <View style={styles.videoGrid}>
              {videoLessons.map((lesson) => (
                <TouchableOpacity key={lesson.id} style={styles.videoCard}>
                  <Image source={{ uri: lesson.thumbnail }} style={styles.videoThumb} />
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={20} color="#fff" />
                  </View>
                  <View style={styles.videoBody}>
                    <Text style={styles.videoTitle}>{lesson.title}</Text>
                    <Text style={styles.videoDuration}>{lesson.duration}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
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
    backgroundColor: '#ffffff',
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
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  heroContent: {
    padding: 20,
    gap: 12,
  },
  heroTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#047857',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    color: '#065f46',
    fontWeight: '800',
  },
  heroDescription: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroMetaPill: {
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroMetaText: {
    color: '#065f46',
    fontWeight: '600',
    fontSize: 13,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryBox: {
    width: 120,
    height: 120,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  categoryLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
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
  recipeTitle: {
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
  quickPill: {
    backgroundColor: '#047857',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  quickPillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  videoGrid: {
    gap: 16,
  },
  videoCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  videoThumb: {
    width: '100%',
    height: 180,
  },
  playButton: {
    position: 'absolute',
    top: '40%',
    left: '45%',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#14b8a6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBody: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  videoDuration: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
});


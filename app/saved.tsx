import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SavedRecipe {
  id: string;
  recipe_name: string;
  recipe_payload: {
    mood?: string;
    time?: string;
    image?: string;
  };
}

interface ShoppingList {
  id: string;
  name: string;
  updated_at: string;
  items_count?: number;
}

export default function SavedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);

  useEffect(() => {
    if (!user) {
      setRecipes([]);
      setLists([]);
      return;
    }

    supabase
      .from('saved_recipes')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => setRecipes((data as SavedRecipe[]) ?? []));

    supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => setLists((data as ShoppingList[]) ?? []));
  }, [user]);

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
                  <Text style={styles.avatarInitial}>{user.email?.charAt(0).toUpperCase() ?? 'U'}</Text>
                </View>
              ) : (
                <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>Saved</Text>
            <Text style={styles.heroTitle}>Alles wat je wilt bewaren, op één plek.</Text>
            <Text style={styles.heroSubtitle}>
              Recepten, boodschappenlijsten en technieken die je later opnieuw wilt openen.
            </Text>
          </View>

          {user ? (
            <>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recepten</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recipes.length === 0 && (
                    <View style={styles.placeholderCard}>
                      <Text style={styles.placeholderTitle}>Nog niets bewaard</Text>
                      <Text style={styles.placeholderCopy}>
                        Tik op het bookmark-icoon bij een recept om het hier te laten verschijnen.
                      </Text>
                    </View>
                  )}
                  {recipes.map((recipe) => (
                    <TouchableOpacity key={recipe.id} style={styles.recipeCard}>
                      <Image
                        source={{ uri: recipe.recipe_payload.image ?? 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=800&q=80' }}
                        style={styles.recipeImage}
                      />
                      <View style={styles.recipeBody}>
                        <Text style={styles.recipeMood}>{recipe.recipe_payload.mood ?? 'Mood match'}</Text>
                        <Text style={styles.recipeTitle}>{recipe.recipe_name}</Text>
                        <View style={styles.recipeMeta}>
                          <Ionicons name="time-outline" size={14} color="#475569" />
                          <Text style={styles.recipeTime}>{recipe.recipe_payload.time ?? 'n.v.t.'}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Boodschappenlijsten</Text>
                  <TouchableOpacity onPress={() => router.push('/inventory')}>
                    <Text style={styles.sectionLink}>Nieuwe lijst</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.listGrid}>
                  {lists.length === 0 && (
                    <View style={styles.placeholderCard}>
                      <Text style={styles.placeholderTitle}>Nog geen lijsten</Text>
                      <Text style={styles.placeholderCopy}>
                        Voeg ontbrekende ingrediënten toe vanuit een recept en je lijst verschijnt hier.
                      </Text>
                    </View>
                  )}
                  {lists.map((list) => (
                    <View key={list.id} style={styles.listCard}>
                      <Ionicons name="list-circle" size={26} color="#047857" />
                      <Text style={styles.listName}>{list.name}</Text>
                      <Text style={styles.listMeta}>
                        {list.items_count ?? '-'} items • {new Date(list.updated_at).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.authCard}>
              <Text style={styles.heroTitle}>Bewaar favorieten</Text>
              <Text style={styles.heroSubtitle}>Maak een account aan om recepten en lijsten te bewaren.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/auth/sign-in')}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/auth/sign-up')}>
                <Text style={styles.secondaryText}>Account maken</Text>
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
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#047857',
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  sectionLink: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
  },
  recipeCard: {
    width: 220,
    marginRight: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
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
  recipeMood: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeTime: {
    fontSize: 13,
    color: '#475569',
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listCard: {
    flexBasis: '48%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#f8fafc',
    padding: 14,
    gap: 6,
  },
  listName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  listMeta: {
    fontSize: 13,
    color: '#475569',
  },
  placeholderCard: {
    width: 220,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    marginRight: 16,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  placeholderCopy: {
    fontSize: 13,
    color: '#475569',
  },
  authCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
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
    alignItems: 'center',
  },
  secondaryText: {
    color: '#475569',
    fontSize: 15,
  },
});




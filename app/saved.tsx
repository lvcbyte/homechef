import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface SavedRecipe {
  id: string;
  recipe_name: string;
  recipe_payload: any;
  recipe_id?: string;
}

interface RecipeDetail {
  recipe_id: string;
  title: string;
  description: string | null;
  author: string;
  image_url: string | null;
  total_time_minutes: number;
  difficulty: string;
  servings: number | null;
  likes_count: number;
  ingredients?: any;
  instructions?: any;
  nutrition?: any;
  tags?: string[];
  category?: string | null;
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
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [likedRecipes, setLikedRecipes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecipes([]);
      setLists([]);
      setLoading(false);
      return;
    }

    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch saved recipes
      const { data: saved } = await supabase
        .from('saved_recipes')
        .select('*')
        .eq('user_id', user!.id);
      
      // Fetch liked recipes
      const { data: likes } = await supabase
        .from('recipe_likes')
        .select('recipe_id, recipes(*)')
        .eq('user_id', user!.id);

      // Combine saved and liked recipes
      const allRecipes: SavedRecipe[] = [];
      
      if (saved) {
        saved.forEach((item: any) => {
          allRecipes.push({
            id: item.id,
            recipe_name: item.recipe_name,
            recipe_payload: item.recipe_payload,
            recipe_id: item.recipe_payload.id || item.recipe_payload.recipe_id,
          });
        });
      }

      if (likes) {
        const likedSet = new Set<string>();
        likes.forEach((like: any) => {
          if (like.recipes) {
            likedSet.add(like.recipe_id);
            allRecipes.push({
              id: like.recipe_id,
              recipe_name: like.recipes.title,
              recipe_payload: like.recipes,
              recipe_id: like.recipe_id,
            });
          }
        });
        setLikedRecipes(likedSet);
      }

      // Remove duplicates based on recipe_id
      const uniqueRecipes = Array.from(
        new Map(allRecipes.map((r) => [r.recipe_id || r.id, r])).values()
      );

      setRecipes(uniqueRecipes);

      // Fetch shopping lists
      const { data: shoppingLists } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false });
      
      if (shoppingLists) setLists(shoppingLists as ShoppingList[]);
    } catch (error) {
      console.error('Error fetching saved data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecipePress = async (recipe: SavedRecipe) => {
    const recipeId = recipe.recipe_id || recipe.recipe_payload?.id || recipe.recipe_payload?.recipe_id;
    
    if (!recipeId) {
      // If it's a saved recipe with full payload, use that
      if (recipe.recipe_payload && recipe.recipe_payload.title) {
        setSelectedRecipe({
          recipe_id: recipeId || recipe.id,
          ...recipe.recipe_payload,
        } as RecipeDetail);
        setModalVisible(true);
        return;
      }
      return;
    }

    // Fetch full recipe data
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();
    
    if (data) {
      setSelectedRecipe(data as RecipeDetail);
      setModalVisible(true);
    } else if (recipe.recipe_payload && recipe.recipe_payload.title) {
      // Fallback to saved payload
      setSelectedRecipe({
        recipe_id: recipeId,
        ...recipe.recipe_payload,
      } as RecipeDetail);
      setModalVisible(true);
    }
  };

  const handleLike = async (recipeId: string) => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }

    try {
      const { data: isLiked } = await supabase.rpc('toggle_recipe_like', { p_recipe_id: recipeId });
      const newLiked = new Set(likedRecipes);
      
      if (isLiked) {
        newLiked.add(recipeId);
        
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', recipeId)
          .single();
        
        if (recipeData) {
          await supabase.from('saved_recipes').upsert({
            user_id: user.id,
            recipe_name: recipeData.title,
            recipe_payload: recipeData,
          }, {
            onConflict: 'user_id,recipe_name',
          });
        }
      } else {
        newLiked.delete(recipeId);
        
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('title')
          .eq('id', recipeId)
          .single();
        
        if (recipeData) {
          await supabase
            .from('saved_recipes')
            .delete()
            .eq('user_id', user.id)
            .eq('recipe_name', recipeData.title);
        }
      }
      
      setLikedRecipes(newLiked);
      
      if (selectedRecipe && selectedRecipe.recipe_id === recipeId) {
        setSelectedRecipe({
          ...selectedRecipe,
          likes_count: isLiked ? selectedRecipe.likes_count + 1 : selectedRecipe.likes_count - 1,
        });
      }
      
      // Refresh recipes list
      fetchData();
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#047857" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.brandLabel}>Stockpit</Text>
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
                  {recipes.map((recipe) => {
                    const recipeId = recipe.recipe_id || recipe.recipe_payload?.id || recipe.recipe_payload?.recipe_id;
                    return (
                      <TouchableOpacity
                        key={recipe.id}
                        style={styles.recipeCard}
                        onPress={() => handleRecipePress(recipe)}
                      >
                        <Image
                          source={{
                            uri: recipe.recipe_payload?.image_url || recipe.recipe_payload?.image || 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=800&q=80',
                          }}
                          style={styles.recipeImage}
                        />
                        {recipeId && (
                          <TouchableOpacity
                            style={styles.heartButtonCard}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleLike(recipeId);
                            }}
                          >
                            <Ionicons
                              name={likedRecipes.has(recipeId) ? 'heart' : 'heart-outline'}
                              size={22}
                              color={likedRecipes.has(recipeId) ? '#ef4444' : '#fff'}
                            />
                          </TouchableOpacity>
                        )}
                        <View style={styles.recipeBody}>
                          <Text style={styles.recipeMood}>
                            {recipe.recipe_payload?.tags?.[0] || recipe.recipe_payload?.category || recipe.recipe_payload?.mood || 'Recept'}
                          </Text>
                          <Text style={styles.recipeTitle}>{recipe.recipe_name}</Text>
                          <View style={styles.recipeMeta}>
                            <Ionicons name="time-outline" size={14} color="#475569" />
                            <Text style={styles.recipeTime}>
                              {recipe.recipe_payload?.total_time_minutes || recipe.recipe_payload?.time || 'n.v.t.'} min
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
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

      {/* Recipe Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedRecipe && (
                <>
                  <Image
                    source={{
                      uri: selectedRecipe.image_url || 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
                    }}
                    style={styles.modalImage}
                  />
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTop}>
                      <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>
                      <TouchableOpacity
                        onPress={() => setModalVisible(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color="#0f172a" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.modalAuthor}>Door {selectedRecipe.author}</Text>
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaPill}>
                        <Ionicons name="time-outline" size={16} color="#047857" />
                        <Text style={styles.modalMetaText}>{selectedRecipe.total_time_minutes} min</Text>
                      </View>
                      <View style={styles.modalMetaPill}>
                        <Ionicons name="restaurant-outline" size={16} color="#047857" />
                        <Text style={styles.modalMetaText}>{selectedRecipe.difficulty}</Text>
                      </View>
                      {selectedRecipe.servings && (
                        <View style={styles.modalMetaPill}>
                          <Ionicons name="people-outline" size={16} color="#047857" />
                          <Text style={styles.modalMetaText}>{selectedRecipe.servings} pers.</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.likeButton, likedRecipes.has(selectedRecipe.recipe_id) && styles.likeButtonActive]}
                        onPress={() => handleLike(selectedRecipe.recipe_id)}
                      >
                        <Ionicons
                          name={likedRecipes.has(selectedRecipe.recipe_id) ? 'heart' : 'heart-outline'}
                          size={20}
                          color={likedRecipes.has(selectedRecipe.recipe_id) ? '#fff' : '#047857'}
                        />
                        <Text
                          style={[
                            styles.likeButtonText,
                            likedRecipes.has(selectedRecipe.recipe_id) && styles.likeButtonTextActive,
                          ]}
                        >
                          {selectedRecipe.likes_count || 0}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {selectedRecipe.description && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Beschrijving</Text>
                      <Text style={styles.modalSectionText}>{selectedRecipe.description}</Text>
                    </View>
                  )}

                  {selectedRecipe.ingredients && Array.isArray(selectedRecipe.ingredients) && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Ingrediënten</Text>
                      {selectedRecipe.ingredients.map((ing: any, idx: number) => (
                        <View key={idx} style={styles.ingredientRow}>
                          <Text style={styles.ingredientBullet}>•</Text>
                          <Text style={styles.ingredientText}>
                            {typeof ing === 'string' 
                              ? ing 
                              : `${ing.quantity || ''} ${ing.unit || ''} ${ing.name || ''}`.trim()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {selectedRecipe.instructions && Array.isArray(selectedRecipe.instructions) && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Bereiding</Text>
                      {selectedRecipe.instructions.map((step: any, idx: number) => (
                        <View key={idx} style={styles.instructionRow}>
                          <View style={styles.instructionNumber}>
                            <Text style={styles.instructionNumberText}>{typeof step === 'object' ? (step.step || idx + 1) : idx + 1}</Text>
                          </View>
                          <Text style={styles.instructionText}>
                            {typeof step === 'string' ? step : (step.instruction || '')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {selectedRecipe.nutrition && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Voedingswaarden</Text>
                      <Text style={styles.modalSectionText}>
                        {JSON.stringify(selectedRecipe.nutrition, null, 2)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 140,
  },
  heartButtonCard: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalImage: {
    width: '100%',
    height: 250,
  },
  modalHeader: {
    padding: 20,
    gap: 12,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#065f46',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  modalAuthor: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  modalMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalMetaText: {
    color: '#065f46',
    fontWeight: '600',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    flex: 1,
    justifyContent: 'center',
  },
  likeButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  likeButtonText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 14,
  },
  likeButtonTextActive: {
    color: '#fff',
  },
  modalSection: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  modalSectionText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ingredientBullet: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '700',
  },
  ingredientText: {
    fontSize: 15,
    color: '#1f2937',
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  instructionText: {
    fontSize: 15,
    color: '#1f2937',
    flex: 1,
    lineHeight: 22,
  },
});




import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Recipe {
  recipe_id: string;
  title: string;
  description: string | null;
  author: string;
  image_url: string | null;
  total_time_minutes: number;
  difficulty: string;
  servings: number | null;
  match_score?: number;
  matched_ingredients_count?: number;
  total_ingredients_count?: number;
  likes_count: number;
  ingredients?: any;
  instructions?: any;
  nutrition?: any;
  tags?: string[];
  category?: string | null;
}

interface RecipeDetail extends Recipe {
  prep_time_minutes: number;
  cook_time_minutes: number | null;
}

interface Category {
  category: string;
  count: number;
}

const categoryColors: Record<string, string> = {
  'Italiaans': '#047857',
  'Aziatisch': '#10b981',
  'Vegan': '#14b8a6',
  'Comfort Food': '#0f766e',
  'High Protein': '#059669',
  'Plant-based': '#0d9488',
  'Feest': '#dc2626',
  'Budget': '#ea580c',
};

export default function Home() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [recipeOfTheDay, setRecipeOfTheDay] = useState<RecipeDetail | null>(null);
  const [trendingRecipes, setTrendingRecipes] = useState<Recipe[]>([]);
  const [quickRecipes, setQuickRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [likedRecipes, setLikedRecipes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      // For non-logged-in users, still fetch some data
      fetchData();
    }
  }, [user, profile]);


  // Remove auto-rotation for quick recipes - make it infinite scroll instead

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recipe of the day
      const { data: rodId } = await supabase.rpc('get_recipe_of_the_day');
      if (rodId) {
        const { data: rod } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', rodId)
          .single();
        if (rod) setRecipeOfTheDay(rod as RecipeDetail);
      }

      // Fetch trending recipes with profile filters
      if (user && profile && profile.archetype === 'None') {
        // If archetype is "None", get random recipes
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30);
        
        if (allRecipes && allRecipes.length > 0) {
          // Shuffle and take random recipes
          const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
          const withLikes = shuffled.slice(0, 30).map((r: any) => ({
            ...r,
            recipe_id: r.id,
            likes_count: 0,
          }));
          setTrendingRecipes(withLikes as Recipe[]);
        } else {
          // Fallback: use trending function
          const { data: trending } = await supabase.rpc('get_trending_recipes', { 
            p_limit: 30,
            p_user_id: null,
            p_category: null
          });
          if (trending && trending.length > 0) {
            setTrendingRecipes(trending as Recipe[]);
          }
        }
      } else {
        const { data: trending } = await supabase.rpc('get_trending_recipes', { 
          p_limit: 30, // Get more for rotation
          p_user_id: user?.id || null,
          p_category: null
        });
        if (trending && trending.length > 0) {
          setTrendingRecipes(trending as Recipe[]);
        } else {
          // Fallback: get any recipes
          const { data: fallback } = await supabase
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
          if (fallback && fallback.length > 0) {
            const withLikes = fallback.map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            }));
            setTrendingRecipes(withLikes as Recipe[]);
          }
        }
      }

      // Fetch quick recipes (<= 30 minutes) with profile filters - infinite scroll
      if (profile?.archetype === 'None') {
        // If archetype is "None", get random recipes
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .lte('total_time_minutes', 30)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (allRecipes && allRecipes.length > 0) {
          // Shuffle and take recipes
          const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
          const withLikes = shuffled.map((r: any) => ({
            ...r,
            recipe_id: r.id,
            likes_count: 0,
          }));
          setQuickRecipes(withLikes as Recipe[]);
        }
      } else {
        const { data: quick } = await supabase.rpc('get_quick_recipes', {
          p_limit: 100, // Get many for infinite scroll
          p_user_id: user?.id || null,
          p_category: null,
          p_archetype: profile?.archetype || null,
          p_cooking_skill: profile?.cooking_skill || null,
          p_dietary_restrictions: (profile?.dietary_restrictions as string[]) || null,
        });
        if (quick && quick.length > 0) {
          setQuickRecipes(quick as Recipe[]);
        } else {
          // Fallback: get all recipes <= 30 minutes
          const { data: fallback } = await supabase
            .from('recipes')
            .select('*')
            .lte('total_time_minutes', 30)
            .order('created_at', { ascending: false })
            .limit(100);
          if (fallback && fallback.length > 0) {
            const withLikes = fallback.map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            }));
            setQuickRecipes(withLikes as Recipe[]);
          }
        }
      }

      // Fetch categories
      const { data: cats } = await supabase.rpc('get_recipe_categories');
      if (cats) setCategories(cats as Category[]);

      // Fetch user's liked recipes
      if (user) {
        const { data: likes } = await supabase
          .from('recipe_likes')
          .select('recipe_id')
          .eq('user_id', user.id);
        if (likes) {
          setLikedRecipes(new Set(likes.map((l) => l.recipe_id)));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecipePress = async (recipe: Recipe) => {
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipe.recipe_id)
      .single();
    if (data) {
      setSelectedRecipe(data as RecipeDetail);
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
        // Like - also save to saved_recipes
        newLiked.add(recipeId);
        
        // Get full recipe data to save
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', recipeId)
          .single();
        
        if (recipeData) {
          // Save to saved_recipes (upsert to avoid duplicates)
          await supabase.from('saved_recipes').upsert({
            user_id: user.id,
            recipe_name: recipeData.title,
            recipe_payload: recipeData,
          }, {
            onConflict: 'user_id,recipe_name',
          });
        }
      } else {
        // Unlike - remove from saved_recipes
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
      
      // Update recipe likes count
      if (selectedRecipe && selectedRecipe.recipe_id === recipeId) {
        setSelectedRecipe({
          ...selectedRecipe,
          likes_count: isLiked ? selectedRecipe.likes_count + 1 : selectedRecipe.likes_count - 1,
        });
      }
      
      // Refresh trending recipes
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
          {/* Recipe of the Day */}
          {recipeOfTheDay && (
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => handleRecipePress(recipeOfTheDay)}
            >
              <Image
                source={{
                  uri: recipeOfTheDay.image_url || 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
                }}
                style={styles.heroImage}
              />
              <View style={styles.heroContent}>
                <Text style={styles.heroTag}>RECEPT V/D DAG</Text>
                <Text style={styles.heroTitle}>{recipeOfTheDay.title}</Text>
                <Text style={styles.heroDescription}>
                  {recipeOfTheDay.description || 'Een heerlijk recept voor vandaag.'}
                </Text>
                <View style={styles.heroMetaRow}>
                  <View style={styles.heroMetaPill}>
                    <Text style={styles.heroMetaText}>{recipeOfTheDay.total_time_minutes} min</Text>
                  </View>
                  <View style={styles.heroMetaPill}>
                    <Text style={styles.heroMetaText}>{recipeOfTheDay.difficulty}</Text>
                  </View>
                  {recipeOfTheDay.servings && (
                    <View style={styles.heroMetaPill}>
                      <Text style={styles.heroMetaText}>{recipeOfTheDay.servings} pers.</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Categories */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Speciaal voor jou</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryRow}>
                {categories.slice(0, 8).map((cat) => (
                  <TouchableOpacity
                    key={cat.category}
                    style={[
                      styles.categoryBox,
                      { backgroundColor: categoryColors[cat.category] || '#047857' },
                    ]}
                    onPress={() => router.push(`/recipes?category=${cat.category}`)}
                  >
                    <Text style={styles.categoryLabel}>{cat.category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Trending */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Recepten</Text>
            <Text style={styles.sectionSubtitle}>Meest gelikete recepten deze week</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {trendingRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.recipe_id}
                  style={styles.recipeCard}
                  onPress={() => handleRecipePress(recipe)}
                >
                  <Image
                    source={{
                      uri: recipe.image_url || 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={styles.recipeImage}
                  />
                  <TouchableOpacity
                    style={styles.heartButtonCard}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleLike(recipe.recipe_id);
                    }}
                  >
                    <Ionicons
                      name={likedRecipes.has(recipe.recipe_id) ? 'heart' : 'heart-outline'}
                      size={22}
                      color={likedRecipes.has(recipe.recipe_id) ? '#ef4444' : '#fff'}
                    />
                  </TouchableOpacity>
                  <View style={styles.recipeBody}>
                    <Text style={styles.socialProof}>
                      {recipe.likes_count}x bewaard deze week
                    </Text>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Quick */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Klaar in 30 minuten</Text>
            <Text style={styles.sectionSubtitle}>Snelle recepten voor drukke dagen</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.recipe_id}
                  style={styles.recipeCard}
                  onPress={() => handleRecipePress(recipe)}
                >
                  <Image
                    source={{
                      uri: recipe.image_url || 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={styles.recipeImage}
                  />
                  <TouchableOpacity
                    style={styles.heartButtonCard}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleLike(recipe.recipe_id);
                    }}
                  >
                    <Ionicons
                      name={likedRecipes.has(recipe.recipe_id) ? 'heart' : 'heart-outline'}
                      size={22}
                      color={likedRecipes.has(recipe.recipe_id) ? '#ef4444' : '#fff'}
                    />
                  </TouchableOpacity>
                  <View style={styles.recipeBody}>
                    <Text style={styles.recipeTitle}>{recipe.title}</Text>
                    <View style={styles.quickPill}>
                      <Text style={styles.quickPillText}>{recipe.total_time_minutes} min</Text>
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
              <TouchableOpacity style={styles.videoCard}>
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=800&q=80',
                  }}
                  style={styles.videoThumb}
                />
                <View style={styles.playButton}>
                  <Ionicons name="play" size={20} color="#fff" />
                </View>
                <View style={styles.videoBody}>
                  <Text style={styles.videoTitle}>Video: Perfect Eieren Pocheren</Text>
                  <Text style={styles.videoDuration}>06:12</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.videoCard}>
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1506368083636-6defb67639b0?auto=format&fit=crop&w=800&q=80',
                  }}
                  style={styles.videoThumb}
                />
                <View style={styles.playButton}>
                  <Ionicons name="play" size={20} color="#fff" />
                </View>
                <View style={styles.videoBody}>
                  <Text style={styles.videoTitle}>Video: Deeg kneden als een Pro</Text>
                  <Text style={styles.videoDuration}>08:44</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
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
                          {likedRecipes.has(selectedRecipe.recipe_id) ? 'Opgeslagen' : 'Opslaan'} • {selectedRecipe.likes_count}
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
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 8,
  },
  heroImage: {
    width: '100%',
    height: 280,
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
  heartButton: {
    padding: 4,
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

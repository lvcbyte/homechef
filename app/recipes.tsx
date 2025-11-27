import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export default function RecipesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const [activeFilter, setActiveFilter] = useState(params.category as string || 'Alles');
  const [recipeOfTheDay, setRecipeOfTheDay] = useState<RecipeDetail | null>(null);
  const [chefRadarRecipes, setChefRadarRecipes] = useState<Recipe[]>([]);
  const [chefRadarCarouselData, setChefRadarCarouselData] = useState<Recipe[]>([]);
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
    }
  }, [user, profile, activeFilter]);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

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

      // Fetch Chef Radar recipes (inventory-matched, loose matching enabled)
      const category = activeFilter === 'Alles' ? null : activeFilter;
      const { data: matched } = await supabase.rpc('match_recipes_with_inventory', {
        p_user_id: user.id,
        p_category: category,
        p_limit: 20, // Get more results to filter from
        p_archetype: profile?.archetype || null,
        p_cooking_skill: profile?.cooking_skill || null,
        p_dietary_restrictions: (profile?.dietary_restrictions as string[]) || null,
        p_loose_matching: true, // Enable loose matching for Chef Radar
      });
      
      if (matched && matched.length > 0) {
        // Very loose filtering: show recipes with at least 1 matched ingredient or any match score
        const goodMatches = (matched as Recipe[]).filter((r) => {
          const matchScore = r.match_score || 0;
          const matchedCount = r.matched_ingredients_count || 0;
          // Show if at least 1 ingredient matches OR match score > 5%
          return matchedCount >= 1 || matchScore >= 5;
        });
        
        // Sort by match score descending (best matches first) and take top 3
        const sorted = goodMatches.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        setChefRadarRecipes(sorted.slice(0, 3));
      } else {
        // Fallback: show general recipes if no inventory matches
        const { data: fallback } = await supabase
          .from('recipes')
          .select('*')
          .limit(3)
          .order('created_at', { ascending: false });
        
        if (fallback) {
          const fallbackRecipes = fallback.map((r: any) => ({
            ...r,
            recipe_id: r.id,
            match_score: 0,
            matched_ingredients_count: 0,
            total_ingredients_count: r.ingredients ? JSON.parse(JSON.stringify(r.ingredients)).length : 0,
            likes_count: 0,
          }));
          setChefRadarRecipes(fallbackRecipes as Recipe[]);
          setChefRadarCarouselData([...fallbackRecipes, ...fallbackRecipes, ...fallbackRecipes] as Recipe[]);
        } else {
          setChefRadarRecipes([]);
          setChefRadarCarouselData([]);
        }
      }

      // Fetch trending recipes with profile filters
      const { data: trending } = await supabase.rpc('get_trending_recipes', {
        p_limit: 10,
        p_user_id: user.id,
        p_category: category,
      });
      if (trending) {
        setTrendingRecipes(trending as Recipe[]);
      }

      // Fetch quick recipes (<= 30 minutes) with inventory matching, category filter, and profile filters
      let quick: any[] = [];
      const { data: matchedQuick } = await supabase.rpc('match_recipes_with_inventory', {
        p_user_id: user.id,
        p_category: category,
        p_max_time_minutes: 30,
        p_limit: 10,
        p_archetype: profile?.archetype || null,
        p_cooking_skill: profile?.cooking_skill || null,
        p_dietary_restrictions: (profile?.dietary_restrictions as string[]) || null,
      });
      
      if (matchedQuick && matchedQuick.length > 0) {
        quick = matchedQuick;
      } else {
        // Fallback: get all recipes <= 30 minutes, filtered by category if needed
        let query = supabase
          .from('recipes')
          .select('*')
          .lte('total_time_minutes', 30)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (category) {
          // Filter by category/tags
          const { data: categoryRecipes } = await supabase
            .from('recipe_categories')
            .select('recipe_id')
            .eq('category', category);
          
          const categoryRecipeIds = categoryRecipes?.map(r => r.recipe_id) || [];
          
          if (categoryRecipeIds.length > 0) {
            query = query.or(`category.eq.${category},tags.cs.{${category}},id.in.(${categoryRecipeIds.join(',')})`);
          } else {
            query = query.or(`category.eq.${category},tags.cs.{${category}}`);
          }
        }
        
        const { data: allQuick } = await query;
        if (allQuick) {
          // Get likes count
          const recipeIds = allQuick.map(r => r.id);
          const { data: likes } = await supabase
            .from('recipe_likes')
            .select('recipe_id')
            .in('recipe_id', recipeIds);
          
          const likesCount = new Map<string, number>();
          likes?.forEach(like => {
            likesCount.set(like.recipe_id, (likesCount.get(like.recipe_id) || 0) + 1);
          });
          
          quick = allQuick.map((r: any) => ({
            ...r,
            recipe_id: r.id,
            likes_count: likesCount.get(r.id) || 0,
          }));
        }
      }
      
      if (quick) setQuickRecipes(quick as Recipe[]);

      // Fetch categories
      const { data: cats } = await supabase.rpc('get_recipe_categories');
      if (cats) {
        const allCats = [{ category: 'Alles', count: 0 }, ...(cats as Category[])];
        setCategories(allCats);
      }

      // Fetch user's liked recipes
      const { data: likes } = await supabase
        .from('recipe_likes')
        .select('recipe_id')
        .eq('user_id', user.id);
      if (likes) {
        setLikedRecipes(new Set(likes.map((l) => l.recipe_id)));
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
      
      if (selectedRecipe && selectedRecipe.recipe_id === recipeId) {
        setSelectedRecipe({
          ...selectedRecipe,
          likes_count: isLiked ? selectedRecipe.likes_count + 1 : selectedRecipe.likes_count - 1,
        });
      }
      
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

  if (!user) {
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
                <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
              </Pressable>
            </View>
          </View>
          <View style={styles.authPrompt}>
            <Text style={styles.authPromptTitle}>Log in om recepten te zien</Text>
            <Text style={styles.authPromptText}>
              We matchen recepten met jouw voorraad voor gepersonaliseerde suggesties.
            </Text>
            <TouchableOpacity
              style={styles.authButton}
              onPress={() => router.push('/auth/sign-in')}
            >
              <Text style={styles.authButtonText}>Inloggen</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        <GlassDock />
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
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {user.email?.charAt(0).toUpperCase() ?? 'U'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>Chef Radar</Text>
            <Text style={styles.heroSectionTitle}>Jouw voorraad, onze recepten.</Text>
            <Text style={styles.heroSubtitle}>
              De Stockpit engine sorteert alle combinaties op beschikbaarheid en vibe. Kies jouw mood en start een sessie.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {categories.slice(0, 10).map((cat) => {
                  const active = activeFilter === cat.category;
                  return (
                    <TouchableOpacity
                      key={cat.category}
                      style={[styles.filterPill, active && styles.filterPillActive]}
                      onPress={() => setActiveFilter(cat.category)}
                    >
                      <Text style={[styles.filterText, active && styles.filterTextActive]}>
                        {cat.category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chef Radar Picks</Text>
            {chefRadarRecipes.length === 0 ? (
              <Text style={styles.emptyText}>Geen recepten gevonden. Voeg items toe aan je voorraad!</Text>
            ) : (
              <View style={styles.carouselContainer}>
                <FlatList
                  data={chefRadarCarouselData}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={Dimensions.get('window').width - 48}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  keyExtractor={(item, index) => `${item.recipe_id}-${index}`}
                  renderItem={({ item: recipe }) => (
                    <TouchableOpacity
                      style={styles.radarCardCarousel}
                      onPress={() => handleRecipePress(recipe)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{
                          uri: recipe.image_url || 'https://images.unsplash.com/photo-1470673042977-43d9b07b7103?auto=format&fit=crop&w=1000&q=80',
                        }}
                        style={styles.radarImageCarousel}
                      />
                      <TouchableOpacity
                        style={styles.heartButtonRadarCarousel}
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
                      <View style={styles.radarBodyCarousel}>
                        <Text style={styles.radarTitleCarousel} numberOfLines={2}>{recipe.title}</Text>
                        <Text style={styles.radarMatchCarousel}>
                          {Math.round((recipe.match_score || 0) * 100)}% match • {recipe.matched_ingredients_count || 0} items op voorraad
                        </Text>
                        <View style={styles.radarMetaCarousel}>
                          <Text style={styles.radarTimeCarousel}>
                            {recipe.total_time_minutes} min
                          </Text>
                          <Text style={styles.radarDifficultyCarousel}>
                            {recipe.difficulty}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Recepten</Text>
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
                    <Text style={styles.recipeName}>{recipe.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Klaar in 30 minuten</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickRecipes.map((recipe) => (
                <TouchableOpacity
                  key={recipe.recipe_id}
                  style={styles.quickCard}
                  onPress={() => handleRecipePress(recipe)}
                >
                  <Image
                    source={{
                      uri: recipe.image_url || 'https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80',
                    }}
                    style={styles.quickImage}
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
                  <View style={styles.quickBody}>
                    <Text style={styles.quickTitle}>{recipe.title}</Text>
                    <View style={styles.quickTag}>
                      <Text style={styles.quickTagText}>{recipe.total_time_minutes} min</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>
      <GlassDock />

      {/* Recipe Detail Modal - Same as index.tsx */}
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
                            {ing.quantity} {ing.unit} {ing.name}
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
                            <Text style={styles.instructionNumberText}>{step.step || idx + 1}</Text>
                          </View>
                          <Text style={styles.instructionText}>{step.instruction}</Text>
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
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  authPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  authPromptText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  authButton: {
    backgroundColor: '#047857',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  authButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
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
  heroSectionTitle: {
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
    gap: 8,
    paddingRight: 24,
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
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    padding: 24,
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
    position: 'relative',
  },
  radarImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  heartButtonRadar: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  heartButton: {
    padding: 4,
  },
  quickCard: {
    width: 200,
    marginRight: 16,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    position: 'relative',
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
  // Modal styles (same as index.tsx)
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

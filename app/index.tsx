import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StockpitLoader } from '../components/glass/StockpitLoader';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

import { AIChatbot } from '../components/chat/AIChatbot';
import { GlassDock } from '../components/navigation/GlassDock';
import { HeaderAvatar } from '../components/navigation/HeaderAvatar';
import { MenuMaker } from '../components/recipes/MenuMaker';
import { ExperimentalKitchen } from '../components/recipes/ExperimentalKitchen';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generateRecipesWithAI, generateRecipeImageUrl } from '../services/ai';
import { navigateToRoute } from '../utils/navigation';

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
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const [recipeOfTheDay, setRecipeOfTheDay] = useState<RecipeDetail | null>(null);
  const [dailyAIRecipe, setDailyAIRecipe] = useState<RecipeDetail | null>(null);
  const [loadingDailyAI, setLoadingDailyAI] = useState(false);
  const [trendingRecipes, setTrendingRecipes] = useState<Recipe[]>([]);
  const [quickRecipes, setQuickRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [likedRecipes, setLikedRecipes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    // Only redirect if we're on the home page (index) and user is not authenticated
    // Don't redirect if user is on other pages
    if (pathname === '/' && !user) {
      const timer = setTimeout(() => {
        try {
          router.replace('/welcome');
        } catch (error) {
          // Router might not be ready, ignore
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Check if user needs to complete onboarding
    // Only show onboarding on first login after email confirmation
    // Check for both false and null (null means not set yet)
    // But don't redirect if onboarding was just completed (indicated by query param)
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const onboardingJustCompleted = searchParams?.get('onboarding_completed') === 'true';
    
    if (user && profile && pathname === '/' && !onboardingJustCompleted && (profile.onboarding_completed === false || profile.onboarding_completed === null)) {
      const timer = setTimeout(() => {
        try {
          router.replace('/onboarding');
        } catch (error) {
          // Router might not be ready, ignore
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Clean up the query parameter after checking
    if (onboardingJustCompleted && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding_completed');
      window.history.replaceState({}, '', url.toString());
    }
    
    // Only fetch data if user is authenticated, onboarding is completed, and we're on the home page
    if (user && profile && profile.onboarding_completed === true && pathname === '/') {
      fetchData();
      fetchInventory();
    }
  }, [user, profile, pathname]);


  // Remove auto-rotation for quick recipes - make it infinite scroll instead

  const fetchData = async () => {
    setLoading(true);
    
    // Force hide loading screen after max 3 seconds
    const maxLoadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    try {
      // Fetch only essentials first, rest in background
      const fetchWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number = 2000): Promise<T | null> => {
        try {
          return await Promise.race([
            promise,
            new Promise<T | null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), timeoutMs)
            ),
          ]);
        } catch (error) {
          console.error('Fetch timeout or error:', error);
          return null;
        }
      };

      // Fetch only essentials first
      const [categoriesResult, likesResult] = await Promise.all([
        fetchWithTimeout(supabase.rpc('get_recipe_categories').then(r => r.data || [])),
        user ? fetchWithTimeout(
          supabase
            .from('recipe_likes')
            .select('recipe_id')
            .eq('user_id', user.id)
            .then(r => r.data || [])
        ) : Promise.resolve([]),
      ]);

      // Set categories (essential for page structure)
      if (categoriesResult && Array.isArray(categoriesResult)) {
        setCategories(categoriesResult as Category[]);
      }

      // Set liked recipes
      if (likesResult && Array.isArray(likesResult)) {
        setLikedRecipes(new Set(likesResult.map((l: any) => l.recipe_id)));
      }

      // Hide loading screen - page is ready
      clearTimeout(maxLoadingTimeout);
      setTimeout(() => {
        setLoading(false);
      }, 200);

      // Load everything else in background (non-blocking)
      // Recipe of the day
      fetchWithTimeout(
        supabase.rpc('get_recipe_of_the_day').then(async (result) => {
          if (result?.data) {
            const { data: rod } = await supabase
              .from('recipes')
              .select('*')
              .eq('id', result.data)
              .single();
            if (rod) setRecipeOfTheDay(rod as RecipeDetail);
          }
          return null;
        })
      ).catch(() => {});

      // Fetch trending recipes with profile filters (background, non-blocking)
      setTimeout(async () => {
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
            p_limit: 30,
            p_user_id: user?.id || null,
            p_category: null
          });
          if (trending && trending.length > 0) {
            // Sort by likes_count descending (most liked first)
            trending.sort((a: any, b: any) => (b.likes_count || 0) - (a.likes_count || 0));
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
      }, 100);

      // Fetch quick recipes (<= 30 minutes) with profile filters - infinite scroll (background)
      setTimeout(async () => {
        if (profile?.archetype === 'None') {
          // If archetype is "None", get random recipes
          const { data: allRecipes } = await supabase
            .from('recipes')
            .select('*')
            .lte('total_time_minutes', 30)
            .order('created_at', { ascending: false })
            .limit(100);
          
          if (allRecipes && allRecipes.length > 0) {
            // Random shuffle for quick recipes
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
            p_limit: 100,
            p_user_id: user?.id || null,
            p_category: null,
            p_archetype: profile?.archetype || null,
            p_cooking_skill: profile?.cooking_skill || null,
            p_dietary_restrictions: (profile?.dietary_restrictions as string[]) || null,
          });
          if (quick && quick.length > 0) {
            // Random shuffle for quick recipes
            quick.sort(() => Math.random() - 0.5);
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
              const shuffled = [...fallback].sort(() => Math.random() - 0.5);
              const withLikes = shuffled.map((r: any) => ({
                ...r,
                recipe_id: r.id,
                likes_count: 0,
              }));
              setQuickRecipes(withLikes as Recipe[]);
            }
          }
        }
      }, 200);

      // All other data loads in background
    } catch (error) {
      console.error('Error fetching data:', error);
      clearTimeout(maxLoadingTimeout);
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const fetchDailyAIRecipe = async () => {
    if (!user || !profile) return;
    
    setLoadingDailyAI(true);
    try {
      // Check if we have a recipe for today
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('daily_ai_recipes')
        .select('*')
        .eq('user_id', user.id)
        .eq('recipe_date', today)
        .single();

      if (existing) {
        // Use existing recipe
        const recipe: RecipeDetail = {
          recipe_id: existing.id,
          title: existing.title,
          description: existing.description,
          author: 'STOCKPIT AI',
          image_url: existing.image_url || generateRecipeImageUrl(existing.title),
          total_time_minutes: existing.total_time_minutes,
          difficulty: existing.difficulty || 'Gemiddeld',
          servings: existing.servings,
          prep_time_minutes: existing.prep_time_minutes || 0,
          cook_time_minutes: existing.cook_time_minutes,
          ingredients: existing.ingredients,
          instructions: existing.instructions,
          nutrition: existing.nutrition,
          tags: existing.tags,
          category: existing.category,
          likes_count: 0,
        };
        setDailyAIRecipe(recipe);
        setLoadingDailyAI(false);
        return;
      }

      // Generate new recipe for today
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Try AI generation if user has inventory
      if (inventory && inventory.length > 0) {
        try {
          const aiRecipes = await generateRecipesWithAI(
            inventory.map((item: any) => ({
              name: item.name,
              quantity_approx: item.quantity_approx,
              expires_at: item.expires_at,
              category: item.category,
            })),
            {
              archetype: profile.archetype || undefined,
              cooking_skill: profile.cooking_skill || undefined,
              dietary_restrictions: (profile.dietary_restrictions as string[]) || undefined,
            }
          );

          if (aiRecipes && aiRecipes.length > 0) {
            const recipe = aiRecipes[0]; // Take the first (best) recipe
            
            // Save to database
            const { data: saved } = await supabase
              .from('daily_ai_recipes')
              .insert({
                user_id: user.id,
                title: recipe.name,
                description: recipe.description || null,
                ingredients: recipe.ingredients || [],
                instructions: recipe.steps || [],
                prep_time_minutes: recipe.prepTime || null,
                cook_time_minutes: recipe.cookTime || null,
                total_time_minutes: recipe.totalTime || 30,
                difficulty: recipe.difficulty || 'Gemiddeld',
                servings: recipe.servings || 4,
                nutrition: recipe.macros || null,
                tags: recipe.tags || [],
                category: null,
                image_url: null,
                recipe_date: today,
              })
              .select()
              .single();

            if (saved) {
              const recipeDetail: RecipeDetail = {
                recipe_id: saved.id,
                title: saved.title,
                description: saved.description,
                author: 'STOCKPIT AI',
                image_url: saved.image_url || generateRecipeImageUrl(saved.title),
                total_time_minutes: saved.total_time_minutes,
                difficulty: saved.difficulty || 'Gemiddeld',
                servings: saved.servings,
                prep_time_minutes: saved.prep_time_minutes || 0,
                cook_time_minutes: saved.cook_time_minutes,
                ingredients: saved.ingredients,
                instructions: saved.instructions,
                nutrition: saved.nutrition,
                tags: saved.tags,
                category: saved.category,
                likes_count: 0,
              };
              setDailyAIRecipe(recipeDetail);
              setLoadingDailyAI(false);
              return;
            }
          }
        } catch (aiError) {
          console.error('AI generation failed, using fallback:', aiError);
          // Fall through to fallback logic
        }
      }

      // Fallback: Use a recipe from database based on user profile
      const { data: fallbackRecipeId } = await supabase.rpc('get_fallback_recipe_for_user', {
        p_user_id: user.id,
      });

      if (fallbackRecipeId) {
        const { data: fallbackRecipe } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', fallbackRecipeId)
          .single();

        if (fallbackRecipe) {
          // Save as daily AI recipe for consistency
          const { data: saved } = await supabase
            .from('daily_ai_recipes')
            .insert({
              user_id: user.id,
              title: fallbackRecipe.title,
              description: fallbackRecipe.description || 'Een heerlijk recept speciaal voor jou geselecteerd.',
              ingredients: fallbackRecipe.ingredients || [],
              instructions: fallbackRecipe.instructions || [],
              prep_time_minutes: fallbackRecipe.prep_time_minutes || null,
              cook_time_minutes: fallbackRecipe.cook_time_minutes || null,
              total_time_minutes: fallbackRecipe.total_time_minutes,
              difficulty: fallbackRecipe.difficulty || 'Gemiddeld',
              servings: fallbackRecipe.servings,
              nutrition: fallbackRecipe.nutrition || null,
              tags: fallbackRecipe.tags || [],
              category: fallbackRecipe.category,
              image_url: fallbackRecipe.image_url,
              recipe_date: today,
            })
            .select()
            .single();

          if (saved) {
            const recipeDetail: RecipeDetail = {
              recipe_id: saved.id,
              title: saved.title,
              description: saved.description,
              author: 'STOCKPIT AI',
              image_url: saved.image_url || 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=80',
              total_time_minutes: saved.total_time_minutes,
              difficulty: saved.difficulty || 'Gemiddeld',
              servings: saved.servings,
              prep_time_minutes: saved.prep_time_minutes || 0,
              cook_time_minutes: saved.cook_time_minutes,
              ingredients: saved.ingredients,
              instructions: saved.instructions,
              nutrition: saved.nutrition,
              tags: saved.tags,
              category: saved.category,
              likes_count: 0,
            };
            setDailyAIRecipe(recipeDetail);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching/generating daily AI recipe:', error);
      // Don't block the rest of the page if AI recipe fails
    } finally {
      setLoadingDailyAI(false);
    }
  };

  // Fetch daily AI recipe separately (non-blocking)
  useEffect(() => {
    if (user && profile) {
      fetchDailyAIRecipe();
    }
  }, [user, profile]);

  const handleRecipePress = async (recipe: Recipe | RecipeDetail) => {
    // Check if it's a daily AI recipe (has recipe_id but might not be in recipes table)
    if ('recipe_id' in recipe && recipe.author === 'STOCKPIT AI') {
      // It's a daily AI recipe, use it directly
      setSelectedRecipe(recipe as RecipeDetail);
      setModalVisible(true);
      return;
    }
    
    // Regular recipe from database
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
      router.push('/sign-in');
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

  // Only redirect if we're on the home page and not authenticated
  // Don't render anything if redirecting
  if (pathname === '/' && !user) {
    return null;
  }

  // Don't render if user needs to complete onboarding (will redirect)
  if (user && profile && (profile.onboarding_completed === false || profile.onboarding_completed === null)) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaViewComponent style={styles.safeArea}>
          <StockpitLoader variant="home" />
        </SafeAreaViewComponent>
      </View>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaViewComponent 
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
            {user ? (
              <HeaderAvatar
                userId={user.id}
                userEmail={user.email}
                avatarUrl={profile?.avatar_url}
                showNotificationBadge={true}
              />
            ) : (
              <Pressable onPress={() => navigateToRoute(router, '/profile')}>
                <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Daily AI Recipe - Personalized for user */}
          {user && profile && (
            <>
              {loadingDailyAI ? (
                <View style={styles.dailyAIHeroCard}>
                  <View style={styles.dailyAIHeroContent}>
                    <ActivityIndicator size="small" color="#047857" />
                    <Text style={styles.dailyAIHeroDescription}>Je persoonlijke recept wordt gegenereerd...</Text>
                  </View>
                </View>
              ) : dailyAIRecipe ? (
                <TouchableOpacity
                  style={styles.dailyAIHeroCard}
                  onPress={() => handleRecipePress(dailyAIRecipe)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{
                      uri: dailyAIRecipe.image_url || generateRecipeImageUrl(dailyAIRecipe.title),
                    }}
                    style={styles.dailyAIHeroImage}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
                    locations={[0, 0.5, 1]}
                    style={styles.dailyAIHeroOverlay}
                  >
                    <View style={styles.dailyAIHeroContent}>
                      <View style={styles.dailyAIHeroHeader}>
                        <View style={styles.dailyAIHeroTag}>
                          <Ionicons name="sparkles" size={16} color="#fff" />
                          <Text style={styles.dailyAIHeroTagText}>JOUW RECEPT VANDAAG</Text>
                        </View>
                        <Text style={styles.dailyAIHeroSubtitle}>Persoonlijk voor jou gemaakt</Text>
                      </View>
                      <Text style={styles.dailyAIHeroTitle}>{dailyAIRecipe.title}</Text>
                      <Text style={styles.dailyAIHeroDescription} numberOfLines={2}>
                        {dailyAIRecipe.description || 'Een speciaal recept op basis van jouw voorraad en voorkeuren.'}
                      </Text>
                      <View style={styles.dailyAIHeroMetaRow}>
                        <View style={styles.dailyAIHeroMetaPill}>
                          <Ionicons name="time-outline" size={14} color="#fff" />
                          <Text style={styles.dailyAIHeroMetaText}>{dailyAIRecipe.total_time_minutes} min</Text>
                        </View>
                        <View style={styles.dailyAIHeroMetaPill}>
                          <Ionicons name="restaurant-outline" size={14} color="#fff" />
                          <Text style={styles.dailyAIHeroMetaText}>{dailyAIRecipe.difficulty}</Text>
                        </View>
                        {dailyAIRecipe.servings && (
                          <View style={styles.dailyAIHeroMetaPill}>
                            <Ionicons name="people-outline" size={14} color="#fff" />
                            <Text style={styles.dailyAIHeroMetaText}>{dailyAIRecipe.servings} pers.</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          {/* Recipe of the Day */}
          {recipeOfTheDay && (
            <TouchableOpacity
              style={styles.heroCard}
              onPress={() => handleRecipePress(recipeOfTheDay)}
            >
              <Image
                source={{
                  uri: recipeOfTheDay.image_url || generateRecipeImageUrl(recipeOfTheDay.title),
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

          {/* Chef's Toolkit */}
          {user && (
            <View style={styles.section}>
              <View style={styles.aiFeaturesHeader}>
                <Ionicons name="construct" size={20} color="#047857" />
                <Text style={styles.sectionTitle}>Chef's Toolkit</Text>
              </View>
              <Text style={styles.aiFeaturesDescription}>
                Slimme tools om menu's te plannen en nieuwe recepten te creëren op basis van jouw voorraad en voorkeuren.
              </Text>
              
              <View style={styles.aiFeaturesGrid}>
                <MenuMaker
                  userId={user.id}
                  inventory={inventory.map((item: any) => ({
                    name: item.name,
                    quantity_approx: item.quantity_approx,
                    category: item.category,
                  }))}
                  profile={{
                    archetype: profile?.archetype || undefined,
                    cooking_skill: profile?.cooking_skill || undefined,
                    dietary_restrictions: (profile?.dietary_restrictions as string[]) || undefined,
                  }}
                  onMenuCreated={(menuPlan) => {
                    Alert.alert('Menu Gemaakt!', `Het ${menuPlan.season} menu is gegenereerd met ${menuPlan.menuItems.length} maaltijden.`);
                  }}
                />
                
                <ExperimentalKitchen
                  userId={user.id}
                  profile={{
                    archetype: profile?.archetype || undefined,
                    cooking_skill: profile?.cooking_skill || undefined,
                    dietary_restrictions: (profile?.dietary_restrictions as string[]) || undefined,
                  }}
                  onRecipeCreated={(recipe) => {
                    const recipeDetail: RecipeDetail = {
                      recipe_id: `experimental-${Date.now()}`,
                      title: recipe.name,
                      description: recipe.description || null,
                      author: 'STOCKPIT AI',
                      image_url: recipe.image_url || null,
                      total_time_minutes: recipe.totalTime || 30,
                      difficulty: recipe.difficulty || 'Gemiddeld',
                      servings: recipe.servings || 4,
                      prep_time_minutes: recipe.prepTime || 0,
                      cook_time_minutes: recipe.cookTime || recipe.totalTime || 30,
                      ingredients: recipe.ingredients || [],
                      instructions: recipe.steps || [],
                      nutrition: recipe.macros || null,
                      tags: recipe.tags || [],
                      category: recipe.tags?.[0] || null,
                      likes_count: 0,
                    };
                    setSelectedRecipe(recipeDetail);
                    setModalVisible(true);
                  }}
                />
              </View>
            </View>
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
                    onPress={() => navigateToRoute(router, `/recipes?category=${cat.category}`)}
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
                      uri: recipe.image_url || generateRecipeImageUrl(recipe.title),
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
                      uri: recipe.image_url || generateRecipeImageUrl(recipe.title),
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
        </ScrollView>
      </SafeAreaViewComponent>
      <GlassDock />
      <AIChatbot />

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
                      uri: selectedRecipe.image_url || generateRecipeImageUrl(selectedRecipe.title),
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.select({
      web: 0, // Handled by CSS safe-area-top class
      default: 8,
    }),
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    paddingBottom: Platform.select({
      web: 140, // Extra space for fixed bottom nav + safe area
      default: 120,
    }),
    gap: 32,
  },
  dailyAIHeroCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    ...(Platform.OS === 'web' && {
      maxWidth: '100%',
    }),
  },
  dailyAIHeroImage: {
    width: '100%',
    height: isMobile ? 320 : 360,
    resizeMode: 'cover',
  },
  dailyAIHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: isMobile ? 20 : 24,
    justifyContent: 'flex-end',
  },
  dailyAIHeroContent: {
    gap: 12,
  },
  dailyAIHeroHeader: {
    gap: 6,
  },
  dailyAIHeroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(4, 120, 87, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dailyAIHeroTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dailyAIHeroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },
  dailyAIHeroTitle: {
    fontSize: isMobile ? 26 : 32,
    fontWeight: '800',
    color: '#fff',
    lineHeight: isMobile ? 32 : 40,
    letterSpacing: -0.5,
  },
  dailyAIHeroDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 22,
  },
  dailyAIHeroMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dailyAIHeroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(10px)',
    }),
  },
  dailyAIHeroMetaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 12,
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
    flexDirection: 'column',
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
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 90,
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
    marginTop: 'auto',
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
  aiFeaturesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  aiFeaturesDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 16,
  },
  aiFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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

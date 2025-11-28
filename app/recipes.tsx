import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIChatbot } from '../components/chat/AIChatbot';
import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generateRecipesWithAI } from '../services/ai';

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
  matched_ingredients?: string[];
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
  const [categoryRecipes, setCategoryRecipes] = useState<Record<string, Recipe[]>>({});
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [likedRecipes, setLikedRecipes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [aiGeneratedRecipes, setAiGeneratedRecipes] = useState<Recipe[]>([]);
  const [showAIGenerated, setShowAIGenerated] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      // For non-logged-in users, still fetch some data
      fetchData();
    }
  }, [user, profile, activeFilter]);


  // Remove auto-rotation for quick recipes - make it infinite scroll instead

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const category = activeFilter === 'Alles' ? null : activeFilter;

      // Fetch critical data in parallel (recipe of the day, categories, trending, quick)
      const [
        rodResult,
        categoriesResult,
        trendingResult,
        quickResult,
        likesResult,
      ] = await Promise.all([
        // Recipe of the day
        supabase.rpc('get_recipe_of_the_day').then(async (result) => {
          if (result.data) {
            const { data: rod } = await supabase
              .from('recipes')
              .select('*')
              .eq('id', result.data)
              .single();
            return rod;
          }
          return null;
        }),
        // Categories
        supabase.rpc('get_recipe_categories'),
        // Trending recipes (non-blocking, can show loading state)
        profile?.archetype === 'None'
          ? supabase.from('recipes').select('*').limit(30)
          : supabase.rpc('get_trending_recipes', {
              p_limit: 100,
              p_category: category,
            }),
        // Quick recipes (non-blocking)
        profile?.archetype === 'None'
          ? supabase.from('recipes').select('*').lte('total_time_minutes', 30).limit(100)
          : supabase.rpc('get_quick_recipes', {
              p_limit: 100,
              p_user_id: user?.id || null,
              p_category: category,
              p_archetype: profile?.archetype || null,
              p_cooking_skill: profile?.cooking_skill || null,
              p_dietary_restrictions: (profile?.dietary_restrictions && Array.isArray(profile.dietary_restrictions) ? profile.dietary_restrictions as string[] : null),
            }),
        // User's liked recipes
        supabase
          .from('recipe_likes')
          .select('recipe_id')
          .eq('user_id', user.id),
      ]);

      // Set recipe of the day
      if (rodResult) {
        setRecipeOfTheDay(rodResult as RecipeDetail);
      }

      // Set categories
      if (categoriesResult.data) {
        const allCats: Category[] = [
          { category: 'Alles', count: 0 },
          ...(categoriesResult.data as Category[]),
        ];
        setCategories(allCats);
      }

      // Set trending recipes - always set, even if empty
      if (trendingResult.data && trendingResult.data.length > 0) {
        if (profile?.archetype === 'None') {
          const shuffled = [...trendingResult.data].sort(() => Math.random() - 0.5);
          setTrendingRecipes(
            shuffled.slice(0, 30).map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            })) as Recipe[]
          );
        } else {
          setTrendingRecipes(
            trendingResult.data.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })) as Recipe[]
          );
        }
      } else {
        // If no data, try to fetch trending recipes separately (lazy load)
        setLoadingTrending(true);
        fetchTrendingRecipes().finally(() => setLoadingTrending(false));
      }

      // Set quick recipes - always set, even if empty
      if (quickResult.data && quickResult.data.length > 0) {
        if (profile?.archetype === 'None') {
          const shuffled = [...quickResult.data].sort(() => Math.random() - 0.5);
          setQuickRecipes(
            shuffled.map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            })) as Recipe[]
          );
        } else {
          setQuickRecipes(
            quickResult.data.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })) as Recipe[]
          );
        }
      } else {
        // If no data, try to fetch quick recipes separately (lazy load)
        setLoadingQuick(true);
        fetchQuickRecipes().finally(() => setLoadingQuick(false));
      }

      // Set liked recipes
      if (likesResult.data) {
        setLikedRecipes(new Set(likesResult.data.map((l) => l.recipe_id)));
      }

      // Fetch Chef Radar recipes (non-blocking, can load after page is visible)
      // If archetype is "None", get random recipes
      if (profile?.archetype === 'None') {
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .limit(20);
        
        if (allRecipes) {
          const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
          const randomRecipes = shuffled.slice(0, 3).map((r: any) => ({
            ...r,
            recipe_id: r.id,
            match_score: 0,
            matched_ingredients_count: 0,
            total_ingredients_count: r.ingredients ? JSON.parse(JSON.stringify(r.ingredients)).length : 0,
            likes_count: 0,
          }));
          setChefRadarRecipes(randomRecipes as Recipe[]);
          setChefRadarCarouselData([]);
        }
      } else {
        const { data: matched, error: matchError } = await supabase.rpc('match_recipes_with_inventory', {
          p_user_id: user.id,
          p_category: category,
          p_limit: 3, // Only get 3 directly, no need for 20
          p_archetype: profile?.archetype || null,
          p_cooking_skill: profile?.cooking_skill || null,
          p_dietary_restrictions: (profile?.dietary_restrictions as string[]) || null,
          p_loose_matching: true,
        });
        
        if (matchError) {
          console.error('Error matching recipes with inventory:', matchError);
          // On error, try AI generation (non-blocking)
          generateAIChefRadarRecipes().catch(console.error);
        } else if (matched && matched.length > 0) {
          const goodMatches = (matched as Recipe[]).filter((r) => {
            return (r.matched_ingredients_count || 0) >= 1;
          });
          
          if (goodMatches.length > 0) {
            const sorted = goodMatches.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
            setChefRadarRecipes(sorted.slice(0, 3));
            setChefRadarCarouselData([]);
          } else {
            // No good matches, generate AI recipes (non-blocking)
            generateAIChefRadarRecipes().catch(console.error);
          }
        } else {
          // No matches, generate AI recipes (non-blocking)
          generateAIChefRadarRecipes().catch(console.error);
        }
      }

      // Don't fetch category recipes initially - they will be lazy loaded on scroll
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Lazy load functions for trending, quick, and category recipes
  const fetchTrendingRecipes = async () => {
    if (!user) return;
    try {
      const category = activeFilter === 'Alles' ? null : activeFilter;
      if (profile?.archetype === 'None') {
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .limit(30);
        
        if (allRecipes && allRecipes.length > 0) {
          const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
          setTrendingRecipes(
            shuffled.slice(0, 30).map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            })) as Recipe[]
          );
        }
      } else {
        const { data: trending } = await supabase.rpc('get_trending_recipes', {
          p_limit: 100,
          p_category: category,
        });
        if (trending && trending.length > 0) {
          setTrendingRecipes(
            trending.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })) as Recipe[]
          );
        }
      }
    } catch (error) {
      console.error('Error fetching trending recipes:', error);
    }
  };

  const fetchQuickRecipes = async () => {
    if (!user) return;
    try {
      const category = activeFilter === 'Alles' ? null : activeFilter;
      if (profile?.archetype === 'None') {
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .lte('total_time_minutes', 30)
          .limit(100);
        
        if (allRecipes && allRecipes.length > 0) {
          const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
          setQuickRecipes(
            shuffled.map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            })) as Recipe[]
          );
        }
      } else {
        const { data: quick } = await supabase.rpc('get_quick_recipes', {
          p_limit: 100,
          p_user_id: user?.id || null,
          p_category: category,
          p_archetype: profile?.archetype || null,
          p_cooking_skill: profile?.cooking_skill || null,
          p_dietary_restrictions: (profile?.dietary_restrictions as string[]) || null,
        });
        if (quick && quick.length > 0) {
          setQuickRecipes(
            quick.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })) as Recipe[]
          );
        }
      }
    } catch (error) {
      console.error('Error fetching quick recipes:', error);
    }
  };

  // Define fetchCategoryRecipes as a regular function (not useCallback) to avoid scope issues
  const fetchCategoryRecipes = async (categoryName: string) => {
    if (!user) return;
    
    // Check if already loading using functional update
    setLoadingCategories((prev) => {
      if (prev[categoryName]) return prev; // Already loading
      return { ...prev, [categoryName]: true };
    });
    
    try {
      if (profile?.archetype === 'None') {
        const { data: catRecipes } = await supabase
          .from('recipes')
          .select('*')
          .limit(100);
        
        if (catRecipes && catRecipes.length > 0) {
          const filtered = catRecipes.filter((r: any) => 
            r.category === categoryName || 
            (r.tags && Array.isArray(r.tags) && r.tags.includes(categoryName))
          );
          const shuffled = [...filtered].sort(() => Math.random() - 0.5);
          setCategoryRecipes((prev) => ({
            ...prev,
            [categoryName]: shuffled.slice(0, 100).map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            })) as Recipe[]
          }));
        }
      } else {
        // Convert dietary_restrictions from JSONB to text array
        const dietaryRestrictions = profile?.dietary_restrictions 
          ? (Array.isArray(profile.dietary_restrictions) 
              ? profile.dietary_restrictions as string[]
              : [])
          : null;

        const { data: catRecipes, error } = await supabase.rpc('get_recipes_by_category', {
          p_category: categoryName,
          p_limit: 100,
          p_user_id: user?.id || null,
          p_archetype: profile?.archetype || null,
          p_cooking_skill: profile?.cooking_skill || null,
          p_dietary_restrictions: dietaryRestrictions,
        });
        
        if (error) {
          console.error(`Error fetching recipes for category ${categoryName}:`, error);
        } else if (catRecipes && catRecipes.length > 0) {
          setCategoryRecipes((prev) => ({
            ...prev,
            [categoryName]: catRecipes.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })) as Recipe[]
          }));
        }
      }
    } catch (err) {
      console.error(`Error processing category ${categoryName}:`, err);
    } finally {
      setLoadingCategories((prev) => ({ ...prev, [categoryName]: false }));
    }
  };

  const generateAIChefRadarRecipes = async () => {
    if (!user || !profile) return;

    try {
      // Get user inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (inventory && inventory.length > 0) {
        // Generate AI recipes based on inventory
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
          },
          'inspirerend'
        );

        if (aiRecipes && aiRecipes.length > 0) {
          // Convert AI recipes to Recipe format with better images
          const convertedRecipes: Recipe[] = aiRecipes.slice(0, 3).map((recipe, index) => {
            // Generate a better image URL based on recipe name
            const recipeNameForImage = recipe.name.replace(/\s+/g, ',').toLowerCase();
            const imageUrl = recipe.image_url || `https://source.unsplash.com/featured/?${encodeURIComponent(recipeNameForImage)},food,recipe,cooking&w=1200&q=80&sig=${Date.now()}-${index}`;
            
            return {
              recipe_id: `ai-${Date.now()}-${index}`,
              title: recipe.name,
              description: recipe.description || null,
              author: 'Stockpit AI',
              image_url: imageUrl,
              total_time_minutes: recipe.totalTime || 30,
              difficulty: recipe.difficulty || 'Gemiddeld',
              servings: recipe.servings || 4,
              prep_time_minutes: recipe.prepTime || 0,
              cook_time_minutes: recipe.cookTime || recipe.totalTime || 30,
              match_score: 100, // AI recipes are 100% match since they're generated from inventory
              matched_ingredients_count: inventory.length,
              total_ingredients_count: recipe.ingredients?.length || 0,
              matched_ingredients: inventory.map((item: any) => item.name),
              likes_count: 0,
              ingredients: recipe.ingredients || [],
              instructions: recipe.steps || [],
              nutrition: recipe.macros || null,
              tags: recipe.tags || [],
              category: recipe.tags?.[0] || null,
            };
          });

          setChefRadarRecipes(convertedRecipes);
          setChefRadarCarouselData([]);
        } else {
          // Fallback to general recipes if AI generation fails
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
              matched_ingredients: [],
              likes_count: 0,
            }));
            setChefRadarRecipes(fallbackRecipes as Recipe[]);
            setChefRadarCarouselData([]);
          }
        }
      } else {
        // No inventory, show general recipes
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
            matched_ingredients: [],
            likes_count: 0,
          }));
          setChefRadarRecipes(fallbackRecipes as Recipe[]);
          setChefRadarCarouselData([]);
        }
      }
    } catch (error) {
      console.error('Error generating AI Chef Radar recipes:', error);
      // Fallback to general recipes on error
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
          matched_ingredients: [],
          likes_count: 0,
        }));
        setChefRadarRecipes(fallbackRecipes as Recipe[]);
        setChefRadarCarouselData([]);
      }
    }
  };

  const handleRecipePress = async (recipe: Recipe) => {
    // Check if it's an AI-generated recipe (starts with 'ai-')
    if (recipe.recipe_id.startsWith('ai-')) {
      // It's an AI recipe, convert it to RecipeDetail format
      const recipeDetail: RecipeDetail = {
        recipe_id: recipe.recipe_id,
        title: recipe.title,
        description: recipe.description || null,
        author: recipe.author || 'Stockpit AI',
        image_url: recipe.image_url || `https://source.unsplash.com/featured/?${encodeURIComponent(recipe.title)},food,recipe&w=1200&q=80`,
        total_time_minutes: recipe.total_time_minutes || 30,
        difficulty: recipe.difficulty || 'Gemiddeld',
        servings: recipe.servings || 4,
        prep_time_minutes: recipe.prep_time_minutes || 0,
        cook_time_minutes: recipe.cook_time_minutes || recipe.total_time_minutes || 30,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        nutrition: recipe.nutrition || null,
        tags: recipe.tags || [],
        category: recipe.category || null,
        likes_count: recipe.likes_count || 0,
      };
      setSelectedRecipe(recipeDetail);
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
              <View style={styles.verticalList}>
                {(showAIGenerated && aiGeneratedRecipes.length > 0
                  ? aiGeneratedRecipes
                  : chefRadarRecipes
                ).map((recipe) => (
                  <TouchableOpacity
                    key={recipe.recipe_id}
                    style={styles.radarCard}
                    onPress={() => handleRecipePress(recipe)}
                  >
                    <Image
                      source={{
                        uri: recipe.image_url || 'https://images.unsplash.com/photo-1470673042977-43d9b07b7103?auto=format&fit=crop&w=1000&q=80',
                      }}
                      style={styles.radarImage}
                    />
                    <TouchableOpacity
                      style={styles.heartButtonRadar}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleLike(recipe.recipe_id);
                      }}
                    >
                      <Ionicons
                        name={likedRecipes.has(recipe.recipe_id) ? 'heart' : 'heart-outline'}
                        size={20}
                        color={likedRecipes.has(recipe.recipe_id) ? '#ef4444' : '#fff'}
                      />
                    </TouchableOpacity>
                    <View style={styles.radarBody}>
                      <Text style={styles.radarTitle}>{recipe.title}</Text>
                      <Text style={styles.radarMatch}>
                        {Math.round(recipe.match_score || 0)}% match • {recipe.matched_ingredients_count || 0} items op voorraad
                      </Text>
                      {recipe.matched_ingredients && recipe.matched_ingredients.length > 0 && (
                        <Text style={styles.radarIngredients} numberOfLines={1}>
                          {recipe.matched_ingredients.slice(0, 3).join(', ')}
                          {recipe.matched_ingredients.length > 3 && '...'}
                        </Text>
                      )}
                      <Text style={styles.radarTime}>
                        {recipe.total_time_minutes} min • {recipe.difficulty}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

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
                    <Text style={styles.recipeName}>{recipe.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            )}
          </View>

          <View 
            style={styles.section}
            onLayout={() => {
              // Lazy load quick recipes when section comes into view
              if (quickRecipes.length === 0 && !loadingQuick) {
                setLoadingQuick(true);
                fetchQuickRecipes().finally(() => setLoadingQuick(false));
              }
            }}
          >
            <Text style={styles.sectionTitle}>Klaar in 30 minuten</Text>
            <Text style={styles.sectionSubtitle}>Snelle recepten voor drukke dagen</Text>
            {loadingQuick ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#047857" />
                <Text style={styles.loadingText}>Recepten laden...</Text>
              </View>
            ) : quickRecipes.length === 0 ? (
              <Text style={styles.emptyText}>Geen snelle recepten gevonden.</Text>
            ) : (
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
            )}
          </View>

          {/* Category Rows - Lazy loaded on scroll, Netflix-style */}
          {categories.slice(1, 8).map((cat) => {
            const recipes = categoryRecipes[cat.category] || [];
            const isLoading = loadingCategories[cat.category];
            const categoryName = cat.category; // Store in const to avoid closure issues
            
            return (
              <View 
                key={cat.category} 
                style={styles.section}
                onLayout={() => {
                  // Lazy load category recipes when section comes into view
                  if (recipes.length === 0 && !isLoading) {
                    // Directly call the function - it should be available in scope
                    try {
                      fetchCategoryRecipes(categoryName);
                    } catch (error) {
                      console.error('Error calling fetchCategoryRecipes:', error);
                    }
                  }
                }}
              >
                <Text style={styles.sectionTitle}>{cat.category}</Text>
                <Text style={styles.sectionSubtitle}>
                  {cat.count > 0 ? `${cat.count} recepten beschikbaar` : 'Ontdek deze categorie'}
                </Text>
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#047857" />
                    <Text style={styles.loadingText}>Recepten laden...</Text>
                  </View>
                ) : recipes.length === 0 ? null : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recipes.map((recipe) => (
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
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
      <GlassDock />
      <AIChatbot />

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
    fontSize: 22,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '400',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
  },
  categoryCard: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  categoryCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  categoryCardTextActive: {
    color: '#fff',
  },
  categoryCount: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    padding: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
  },
  verticalList: {
    gap: 16,
  },
  carouselContainer: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  radarCardCarousel: {
    width: Dimensions.get('window').width - 48,
    marginRight: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  radarImageCarousel: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  heartButtonRadarCarousel: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarBodyCarousel: {
    padding: 16,
    gap: 8,
  },
  radarTitleCarousel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 26,
  },
  radarMatchCarousel: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
  radarMetaCarousel: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  radarTimeCarousel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  radarDifficultyCarousel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
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
    fontWeight: '600',
    marginTop: 4,
  },
  radarIngredients: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontStyle: 'italic',
  },
  radarTime: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  recipeCard: {
    width: 240,
    marginRight: 16,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
    flexDirection: 'column',
  },
  quickImage: {
    width: '100%',
    height: 120,
  },
  quickBody: {
    padding: 14,
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 90,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    flexShrink: 1,
  },
  quickTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 'auto',
  },
  quickTagText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
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


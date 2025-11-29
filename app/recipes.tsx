import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StockpitLoader } from '../components/glass/StockpitLoader';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AIChatbot } from '../components/chat/AIChatbot';
import { GlassDock } from '../components/navigation/GlassDock';
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

const buildRecipeImage = (title?: string, seed?: number) => {
  return generateRecipeImageUrl(title || 'recipe', seed);
};

const canonicalCategory = (recipe: any) => {
  if (recipe?.category) return String(recipe.category).toLowerCase();
  if (Array.isArray(recipe?.tags) && recipe.tags.length > 0) {
    return String(recipe.tags[0]).toLowerCase();
  }
  return '';
};

const dedupeRecipes = (recipes: any[]): any[] => {
  const map = new Map<string, any>();
  recipes.forEach((recipe) => {
    const id = recipe.recipe_id || recipe.id;
    if (!id || map.has(id)) return;
    map.set(id, { ...recipe, recipe_id: id });
  });
  return Array.from(map.values());
};

const attachRecipeImage = (recipe: any) => ({
  ...recipe,
  recipe_id: recipe.recipe_id || recipe.id,
  image_url: recipe.image_url || buildRecipeImage(recipe.title, recipe.recipe_id || recipe.id),
});

const matchesCategoryFilter = (recipe: any, activeFilter: string) => {
  if (activeFilter === 'Alles') return true;
  return canonicalCategory(recipe) === activeFilter.toLowerCase();
};

const CHEF_RADAR_LOADING_MESSAGES = [
  'Deciding your meals...',
  'Chef Radar scant je voorraad...',
  'Zoekt naar inspiratie voor vanavond...',
];

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
  const [chefRadarLoading, setChefRadarLoading] = useState(false);
  const [chefRadarLoadingMessage, setChefRadarLoadingMessage] = useState(CHEF_RADAR_LOADING_MESSAGES[0]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);
  const [chefRadarExpanded, setChefRadarExpanded] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);

  // Load Chef Radar recipes from session storage on mount
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`chefRadarRecipes_${user?.id}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChefRadarRecipes(parsed);
            setChefRadarLoading(false);
          }
        } catch (e) {
          console.error('Error loading stored recipes:', e);
        }
      }
    }
  }, [user?.id]);

  // Save Chef Radar recipes to session storage whenever they change
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && user && chefRadarRecipes.length > 0) {
      sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(chefRadarRecipes));
    }
  }, [chefRadarRecipes, user?.id]);

  // Clear stored recipes when user logs out
  useEffect(() => {
    if (!user && Platform.OS === 'web' && typeof window !== 'undefined') {
      // Clear all chef radar recipes from session storage
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('chefRadarRecipes_')) {
          sessionStorage.removeItem(key);
        }
      });
      setChefRadarRecipes([]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      // For non-logged-in users, still fetch some data
      fetchData();
    }
  }, [user, profile, activeFilter]);


  // Remove auto-rotation for quick recipes - make it infinite scroll instead

  useEffect(() => {
    if (!chefRadarLoading) {
      setChefRadarLoadingMessage(CHEF_RADAR_LOADING_MESSAGES[0]);
      return;
    }
    const pickMessage = () =>
      setChefRadarLoadingMessage(
        CHEF_RADAR_LOADING_MESSAGES[Math.floor(Math.random() * CHEF_RADAR_LOADING_MESSAGES.length)]
      );
    pickMessage();
    const interval = setInterval(pickMessage, 2000);
    return () => clearInterval(interval);
  }, [chefRadarLoading]);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      setInventoryCount(null);
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    
    // Force hide loading screen after max 3 seconds
    const maxLoadingTimeout = setTimeout(() => {
      setLoading(false);
      setLoadingProgress(0);
    }, 3000);

    try {
      const category = activeFilter === 'Alles' ? null : activeFilter;

      setLoadingProgress(10);
      
      // Fetch critical data in parallel with shorter timeout (2 seconds max per query)
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

      // Only fetch absolute essentials for initial render
      const [
        categoriesResult,
        likesResult,
      ] = await Promise.all([
        // Categories - essential for page structure
        fetchWithTimeout(supabase.rpc('get_recipe_categories').then(r => r.data || [])),
        // User's liked recipes - essential for UI state
        fetchWithTimeout(
          supabase
            .from('recipe_likes')
            .select('recipe_id')
            .eq('user_id', user.id)
            .then(r => r.data || [])
        ),
      ]);

      setLoadingProgress(50);
      
      // Set categories (essential for page to render)
      if (categoriesResult && Array.isArray(categoriesResult)) {
        const allCats: Category[] = [
          { category: 'Alles', count: 0 },
          ...(categoriesResult as Category[]),
        ];
        setCategories(allCats);
      }

      // Set liked recipes
      if (likesResult && Array.isArray(likesResult)) {
        setLikedRecipes(new Set(likesResult.map((l: any) => l.recipe_id)));
      }
      
      setLoadingProgress(80);

      // Get inventory count (non-blocking, can be 0 initially)
      supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => {
          setInventoryCount(count ?? 0);
        });

      // Hide loading screen - page is ready to show
      clearTimeout(maxLoadingTimeout);
      setLoadingProgress(100);
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 200);

      // Load everything else in background (non-blocking)
      // Recipe of the day
      fetchWithTimeout(
        supabase.rpc('get_recipe_of_the_day').then(async (result) => {
          if (result.data && !result.error) {
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

      // Lazy load trending and quick recipes immediately after page shows
      setTimeout(() => {
        setLoadingTrending(true);
        fetchTrendingRecipes().finally(() => setLoadingTrending(false));
      }, 100);

      setTimeout(() => {
        setLoadingQuick(true);
        fetchQuickRecipes().finally(() => setLoadingQuick(false));
      }, 200);

      // Fetch Chef Radar recipes in background (non-blocking)
      // Only generate if we don't have recipes in session storage
      const hasStoredRecipes = Platform.OS === 'web' && typeof window !== 'undefined' && 
        sessionStorage.getItem(`chefRadarRecipes_${user.id}`);
      
      if (!hasStoredRecipes) {
        setChefRadarLoading(true);
        
        if (profile?.archetype === 'None') {
        supabase
          .from('recipes')
          .select('*')
          .limit(20)
          .then(({ data: allRecipes }) => {
            if (allRecipes) {
              const shuffled = [...allRecipes].sort(() => Math.random() - 0.5);
              const randomRecipes = shuffled.slice(0, 1).map((r: any) => ({
                ...r,
                recipe_id: r.id,
                match_score: 0,
                matched_ingredients_count: 0,
                total_ingredients_count: r.ingredients ? JSON.parse(JSON.stringify(r.ingredients)).length : 0,
                likes_count: 0,
                image_url: r.image_url || buildRecipeImage(r.title, r.id),
              }));
              setChefRadarRecipes(randomRecipes as Recipe[]);
              setChefRadarCarouselData([]);
              // Save to session storage
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(randomRecipes));
              }
            }
            setChefRadarLoading(false);
          })
          .catch(() => setChefRadarLoading(false));
        } else {
          supabase.rpc('match_recipes_with_inventory', {
          p_user_id: user.id,
          p_category: category,
          p_limit: 3,
          p_archetype: profile?.archetype || null,
          p_cooking_skill: profile?.cooking_skill || null,
          p_dietary_restrictions: (profile?.dietary_restrictions && Array.isArray(profile.dietary_restrictions) ? profile.dietary_restrictions as string[] : null),
          p_loose_matching: true,
        })
        .then(({ data: matched, error: matchError }) => {
          if (matchError) {
            console.error('Error matching recipes with inventory:', matchError);
            generateAIChefRadarRecipes(false).catch(() => {});
          } else if (matched && matched.length > 0) {
            const goodMatches = (matched as Recipe[]).filter((r) => {
              return (r.matched_ingredients_count || 0) >= 1;
            });
            
            if (goodMatches.length > 0) {
              const sorted = goodMatches.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
              const enriched = sorted.slice(0, 1).map((recipe) => ({
                ...recipe,
                image_url: recipe.image_url || buildRecipeImage(recipe.title, recipe.recipe_id),
              }));
              setChefRadarRecipes(enriched as Recipe[]);
              setChefRadarCarouselData([]);
              // Save to session storage
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(enriched));
              }
              setChefRadarLoading(false);
            } else {
              if (!hasStoredRecipes) {
                generateAIChefRadarRecipes(false).catch(() => {});
              }
            }
          } else {
            if (!hasStoredRecipes) {
              generateAIChefRadarRecipes(false).catch(() => {});
            }
          }
        })
        .catch(() => {
          setChefRadarLoading(false);
        });
        }
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      clearTimeout(maxLoadingTimeout);
      setLoading(false);
      setLoadingProgress(0);
    }
  };

  // Lazy load functions for trending, quick, and category recipes
  const fetchTrendingRecipes = async () => {
    if (!user) return;
    setLoadingTrending(true);
    try {
      const category = activeFilter === 'Alles' ? null : activeFilter;
      if (profile?.archetype === 'None') {
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .limit(60);
        
        if (allRecipes && allRecipes.length > 0) {
          const filtered = activeFilter === 'Alles'
            ? allRecipes
            : allRecipes.filter((r: any) => matchesCategoryFilter(r, activeFilter));

          if (filtered.length === 0 && activeFilter !== 'Alles') {
            setTrendingRecipes([]);
          } else {
            // For Trending: fetch likes count for all recipes at once
            const recipeIds = filtered.map((r: any) => r.id);
            const { data: likesData } = await supabase
              .from('recipe_likes')
              .select('recipe_id')
              .in('recipe_id', recipeIds);
            
            // Count likes per recipe
            const likesCountMap = new Map<string, number>();
            likesData?.forEach((like: any) => {
              likesCountMap.set(like.recipe_id, (likesCountMap.get(like.recipe_id) || 0) + 1);
            });
            
            // Add likes_count to recipes
            const recipesWithLikes = filtered.map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: likesCountMap.get(r.id) || 0,
            }));
            
            // Sort by likes_count descending (most liked first)
            recipesWithLikes.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
            
            let curated = dedupeRecipes(
              recipesWithLikes.slice(0, 40)
            ).map(attachRecipeImage);

            if (curated.length === 0) {
              curated = recipesWithLikes.map((r: any) => ({
                ...r,
                recipe_id: r.id,
                likes_count: r.likes_count || 0,
              })).map(attachRecipeImage);
            }
            setTrendingRecipes(curated as Recipe[]);
          }
        } else {
          setTrendingRecipes([]);
        }
      } else {
        const { data: trending } = await supabase.rpc('get_trending_recipes', {
          p_limit: 100,
          p_category: category,
        });
        if (trending && trending.length > 0) {
          let curated = dedupeRecipes(
            trending.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            }))
          ).map(attachRecipeImage);

          if (curated.length === 0) {
            curated = trending.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })).map(attachRecipeImage);
          }
          
          // Sort by likes_count descending (most liked first) for Trending Recepten
          curated.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
          
          const filteredCurated = activeFilter === 'Alles'
            ? curated
            : curated.filter((recipe) => matchesCategoryFilter(recipe, activeFilter));
          setTrendingRecipes(filteredCurated as Recipe[]);
        } else {
          setTrendingRecipes([]);
        }
      }
    } catch (error) {
      console.error('Error fetching trending recipes:', error);
    } finally {
      setLoadingTrending(false);
    }
  };

  const fetchQuickRecipes = async () => {
    if (!user) return;
    setLoadingQuick(true);
    try {
      // "Klaar in 30 minuten" should ALWAYS show recipes <= 30 minutes, regardless of category filter
      // So we pass null for category to get all quick recipes
      if (profile?.archetype === 'None') {
        const { data: allRecipes } = await supabase
          .from('recipes')
          .select('*')
          .lte('total_time_minutes', 30)
          .limit(100);
        
        if (allRecipes && allRecipes.length > 0) {
          const filtered = activeFilter === 'Alles'
            ? allRecipes
            : allRecipes.filter((r: any) => matchesCategoryFilter(r, activeFilter));

          if (filtered.length === 0 && activeFilter !== 'Alles') {
            setQuickRecipes([]);
          } else {
            // Random shuffle for "Klaar in 30 minuten" category
            const shuffled = [...filtered].sort(() => Math.random() - 0.5);
            let curated = dedupeRecipes(
              shuffled.map((r: any) => ({
                ...r,
                recipe_id: r.id,
                likes_count: 0,
              }))
            ).map(attachRecipeImage);

            if (curated.length === 0) {
              curated = filtered.map((r: any) => ({
                ...r,
                recipe_id: r.id,
                likes_count: 0,
              })).map(attachRecipeImage);
            }
            setQuickRecipes(curated as Recipe[]);
          }
        } else {
          setQuickRecipes([]);
        }
      } else {
        // Always pass null for category - we want ALL recipes <= 30 minutes
        const { data: quick } = await supabase.rpc('get_quick_recipes', {
          p_limit: 100,
          p_user_id: user?.id || null,
          p_category: null, // Always null - show all quick recipes regardless of active filter
          p_archetype: profile?.archetype || null,
          p_cooking_skill: profile?.cooking_skill || null,
          p_dietary_restrictions: (profile?.dietary_restrictions && Array.isArray(profile.dietary_restrictions) ? profile.dietary_restrictions as string[] : null),
        });
        if (quick && quick.length > 0) {
          let curated = dedupeRecipes(
            quick.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            }))
          ).map(attachRecipeImage);

          if (curated.length === 0) {
            curated = quick.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })).map(attachRecipeImage);
          }
          
          // Random shuffle for "Klaar in 30 minuten" category
          curated.sort(() => Math.random() - 0.5);
          
          const filteredCurated = activeFilter === 'Alles'
            ? curated
            : curated.filter((recipe) => matchesCategoryFilter(recipe, activeFilter));
          setQuickRecipes(filteredCurated as Recipe[]);
        } else {
          setQuickRecipes([]);
        }
      }
    } catch (error) {
      console.error('Error fetching quick recipes:', error);
    } finally {
      setLoadingQuick(false);
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
      const target = categoryName.toLowerCase();

      if (profile?.archetype === 'None') {
        const { data: catRecipes } = await supabase
          .from('recipes')
          .select('*')
          .limit(100);
        
        if (catRecipes && catRecipes.length > 0) {
          const filtered = catRecipes.filter((r: any) => canonicalCategory(r) === target);
          // Random shuffle for all category recipes
          const shuffled = [...filtered].sort(() => Math.random() - 0.5);
          let curated = dedupeRecipes(
            shuffled.slice(0, 60).map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            }))
          ).map(attachRecipeImage);

          if (curated.length === 0) {
            curated = catRecipes.map((r: any) => ({
              ...r,
              recipe_id: r.id,
              likes_count: 0,
            })).map(attachRecipeImage);
          }
          setCategoryRecipes((prev) => ({
            ...prev,
            [categoryName]: curated as Recipe[],
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
          const filtered = catRecipes.filter((r: any) => canonicalCategory(r) === target);
          let curated = dedupeRecipes(
            filtered.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            }))
          ).map(attachRecipeImage);

          if (curated.length === 0) {
            curated = catRecipes.map((r: any) => ({
              ...r,
              recipe_id: r.id || r.recipe_id,
              likes_count: r.likes_count || 0,
            })).map(attachRecipeImage);
          }
          
          // Random shuffle for all category recipes
          curated.sort(() => Math.random() - 0.5);
          
          setCategoryRecipes((prev) => ({
            ...prev,
            [categoryName]: curated as Recipe[],
          }));
        }
      }
    } catch (err) {
      console.error(`Error processing category ${categoryName}:`, err);
    } finally {
      setLoadingCategories((prev) => ({ ...prev, [categoryName]: false }));
    }
  };

  const generateAIChefRadarRecipes = async (generateMore: boolean = false) => {
    if (!user || !profile) return;

    try {
      if (generateMore) {
        setGeneratingMore(true);
      } else {
        setChefRadarLoading(true);
      }
      
      // Get user inventory
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (inventory && inventory.length > 0) {
        // Generate AI recipes based on inventory - only 1 for initial load, 3 for "generate more"
        const recipeCount = generateMore ? 3 : 1;
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
          const convertedRecipes: Recipe[] = aiRecipes.slice(0, recipeCount).map((recipe, index) => {
            // Generate a reliable image URL based on recipe name
            const imageUrl = recipe.image_url || generateRecipeImageUrl(recipe.name, index);
            
            return {
              recipe_id: `ai-${Date.now()}-${index}`,
              title: recipe.name,
              description: recipe.description || null,
              author: 'STOCKPIT AI',
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

          if (generateMore) {
            // Append to existing recipes
            setChefRadarRecipes(prev => {
              const updated = [...prev, ...convertedRecipes];
              // Save to session storage
              if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
                sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(updated));
              }
              return updated;
            });
          } else {
            setChefRadarRecipes(convertedRecipes);
            // Save to session storage
            if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
              sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(convertedRecipes));
            }
          }
          setChefRadarCarouselData([]);
        } else {
          // Fallback to general recipes if AI generation fails
          const { data: fallback } = await supabase
            .from('recipes')
            .select('*')
            .limit(1)
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
            if (generateMore) {
              setChefRadarRecipes(prev => {
                const updated = [...prev, ...fallbackRecipes];
                if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
                  sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(updated));
                }
                return updated;
              });
            } else {
              setChefRadarRecipes(fallbackRecipes as Recipe[]);
              if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
                sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(fallbackRecipes));
              }
            }
            setChefRadarCarouselData([]);
          }
        }
      } else {
        // No inventory, show general recipes
        const { data: fallback } = await supabase
          .from('recipes')
          .select('*')
          .limit(1)
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
          if (generateMore) {
            setChefRadarRecipes(prev => {
              const updated = [...prev, ...fallbackRecipes];
              if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
                sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(updated));
              }
              return updated;
            });
          } else {
            setChefRadarRecipes(fallbackRecipes as Recipe[]);
            if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
              sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(fallbackRecipes));
            }
          }
          setChefRadarCarouselData([]);
        }
      }
    } catch (error) {
      console.error('Error generating AI Chef Radar recipes:', error);
      // Fallback to general recipes on error
      const { data: fallback } = await supabase
        .from('recipes')
        .select('*')
        .limit(1)
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
        if (generateMore) {
          setChefRadarRecipes(prev => {
            const updated = [...prev, ...fallbackRecipes];
            if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
              sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(updated));
            }
            return updated;
          });
        } else {
          setChefRadarRecipes(fallbackRecipes as Recipe[]);
          if (Platform.OS === 'web' && typeof window !== 'undefined' && user) {
            sessionStorage.setItem(`chefRadarRecipes_${user.id}`, JSON.stringify(fallbackRecipes));
          }
        }
        setChefRadarCarouselData([]);
      }
    } finally {
      setChefRadarLoading(false);
      setGeneratingMore(false);
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
        author: recipe.author || 'STOCKPIT AI',
        image_url: recipe.image_url || generateRecipeImageUrl(recipe.title),
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
          <StockpitLoader variant="recipes" progress={loadingProgress} />
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
              <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandLabel}>STOCKPIT</Text>
            </View>
            <View style={styles.headerIcons}>
              <Pressable onPress={() => navigateToRoute(router, '/profile')}>
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
              De STOCKPIT engine sorteert alle combinaties op beschikbaarheid en vibe. Kies jouw mood en start een sessie.
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

          {/* Sticky Chef Radar Picks Section - Compact */}
          <View style={styles.stickyChefRadarContainer}>
            <View style={styles.stickyChefRadarHeader}>
              <View style={styles.stickyChefRadarHeaderLeft}>
                <Ionicons name="sparkles" size={16} color="#047857" />
                <Text style={styles.stickyChefRadarTitle}>Chef Radar</Text>
              </View>
              {chefRadarRecipes.length > 0 && !chefRadarLoading && (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setChefRadarExpanded(!chefRadarExpanded)}
                >
                  <Ionicons
                    name={chefRadarExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#047857"
                  />
                </TouchableOpacity>
              )}
            </View>

            {inventoryCount === null ? (
              <View style={styles.stickyChefRadarLoading}>
                <ActivityIndicator size="small" color="#047857" />
                <Text style={styles.stickyChefRadarLoadingText}>Chef Radar voorbereiden...</Text>
              </View>
            ) : inventoryCount === 0 ? (
              <View style={styles.stickyChefRadarEmpty}>
                <Text style={styles.stickyChefRadarEmptyText}>
                  Geen voorraad gevonden. Upload een shelf shot in STOCKPIT Mode om Chef Radar te activeren.
                </Text>
              </View>
            ) : chefRadarLoading ? (
              <View style={styles.stickyChefRadarLoading}>
                <StockpitLoader variant="inline" message={chefRadarLoadingMessage} />
              </View>
            ) : chefRadarRecipes.length === 0 ? (
              <View style={styles.stickyChefRadarEmpty}>
                <Text style={styles.stickyChefRadarEmptyText}>
                  Geen directe match gevonden. Probeer de AI-toggle of voeg producten toe aan je voorraad.
                </Text>
              </View>
            ) : (
              <>
                {/* Always show first recipe - compact */}
                {chefRadarRecipes.length > 0 && (
                  <TouchableOpacity
                    style={styles.stickyChefRadarCard}
                    onPress={() => handleRecipePress(chefRadarRecipes[0])}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri: chefRadarRecipes[0].image_url || 'https://images.unsplash.com/photo-1470673042977-43d9b07b7103?auto=format&fit=crop&w=1000&q=80',
                      }}
                      style={styles.stickyChefRadarImage}
                    />
                    <View style={styles.stickyChefRadarCardBody}>
                      <Text style={styles.stickyChefRadarCardTitle} numberOfLines={1}>
                        {chefRadarRecipes[0].title}
                      </Text>
                      <Text style={styles.stickyChefRadarCardMatch} numberOfLines={1}>
                        {Math.round(chefRadarRecipes[0].match_score || 0)}% match • {chefRadarRecipes[0].total_time_minutes} min
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.stickyChefRadarHeartButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleLike(chefRadarRecipes[0].recipe_id);
                      }}
                    >
                      <Ionicons
                        name={likedRecipes.has(chefRadarRecipes[0].recipe_id) ? 'heart' : 'heart-outline'}
                        size={16}
                        color={likedRecipes.has(chefRadarRecipes[0].recipe_id) ? '#ef4444' : '#64748b'}
                      />
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}

                {/* Show expanded recipes if expanded */}
                {chefRadarExpanded && chefRadarRecipes.length > 1 && (
                  <View style={styles.stickyChefRadarExpanded}>
                    {chefRadarRecipes.slice(1).map((recipe) => (
                      <TouchableOpacity
                        key={recipe.recipe_id}
                        style={styles.stickyChefRadarCard}
                        onPress={() => handleRecipePress(recipe)}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{
                            uri: recipe.image_url || 'https://images.unsplash.com/photo-1470673042977-43d9b07b7103?auto=format&fit=crop&w=1000&q=80',
                          }}
                          style={styles.stickyChefRadarImage}
                        />
                        <View style={styles.stickyChefRadarCardBody}>
                          <Text style={styles.stickyChefRadarCardTitle} numberOfLines={1}>
                            {recipe.title}
                          </Text>
                          <Text style={styles.stickyChefRadarCardMatch} numberOfLines={1}>
                            {Math.round(recipe.match_score || 0)}% match • {recipe.total_time_minutes} min
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.stickyChefRadarHeartButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleLike(recipe.recipe_id);
                          }}
                        >
                          <Ionicons
                            name={likedRecipes.has(recipe.recipe_id) ? 'heart' : 'heart-outline'}
                            size={16}
                            color={likedRecipes.has(recipe.recipe_id) ? '#ef4444' : '#64748b'}
                          />
                        </TouchableOpacity>
                        <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Generate More Button - only show when expanded */}
                {chefRadarExpanded && chefRadarRecipes.length > 0 && (
                  <TouchableOpacity
                    style={styles.generateMoreButton}
                    onPress={() => generateAIChefRadarRecipes(true)}
                    disabled={generatingMore}
                    activeOpacity={0.8}
                  >
                    {generatingMore ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.generateMoreButtonText}>Genereren...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={16} color="#fff" />
                        <Text style={styles.generateMoreButtonText}>Meer genereren</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trending Recepten</Text>
            <Text style={styles.sectionSubtitle}>Meest gelikete recepten deze week</Text>
            {loadingTrending ? (
              <StockpitLoader variant="inline" message="Trending recepten laden..." />
            ) : trendingRecipes.length === 0 ? (
              <Text style={styles.emptyText}>Geen trending recepten gevonden.</Text>
            ) : (
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
                fetchQuickRecipes();
              }
            }}
          >
            <Text style={styles.sectionTitle}>Klaar in 30 minuten</Text>
            <Text style={styles.sectionSubtitle}>Snelle recepten voor drukke dagen</Text>
            {loadingQuick ? (
              <StockpitLoader variant="inline" message="Snelle recepten laden..." />
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
                  <StockpitLoader variant="inline" message={`${cat.category} recepten laden...`} />
                ) : recipes.length === 0 ? (
                  <Text style={styles.emptyText}>Geen recepten gevonden in deze categorie.</Text>
                ) : (
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
                      {typeof selectedRecipe.nutrition === 'object' && selectedRecipe.nutrition !== null ? (
                        <View style={styles.nutritionGrid}>
                          {selectedRecipe.nutrition.protein !== undefined && (
                            <View style={styles.nutritionItem}>
                              <Text style={styles.nutritionLabel}>Eiwit</Text>
                              <Text style={styles.nutritionValue}>{selectedRecipe.nutrition.protein}g</Text>
                            </View>
                          )}
                          {selectedRecipe.nutrition.carbs !== undefined && (
                            <View style={styles.nutritionItem}>
                              <Text style={styles.nutritionLabel}>Koolhydraten</Text>
                              <Text style={styles.nutritionValue}>{selectedRecipe.nutrition.carbs}g</Text>
                            </View>
                          )}
                          {selectedRecipe.nutrition.fat !== undefined && (
                            <View style={styles.nutritionItem}>
                              <Text style={styles.nutritionLabel}>Vet</Text>
                              <Text style={styles.nutritionValue}>{selectedRecipe.nutrition.fat}g</Text>
                            </View>
                          )}
                          {selectedRecipe.nutrition.calories !== undefined && (
                            <View style={styles.nutritionItem}>
                              <Text style={styles.nutritionLabel}>Calorieën</Text>
                              <Text style={styles.nutritionValue}>{selectedRecipe.nutrition.calories}kcal</Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.modalSectionText}>
                          {JSON.stringify(selectedRecipe.nutrition, null, 2)}
                        </Text>
                      )}
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
    maxHeight: Platform.OS === 'web' ? '90%' : '95%',
    ...(Platform.OS === 'web' && {
      maxWidth: 600,
      marginHorizontal: 'auto',
    }),
  },
  modalImage: {
    width: '100%',
    height: Platform.OS === 'web' ? 300 : 220,
    backgroundColor: '#e2e8f0',
  },
  modalHeader: {
    padding: Platform.OS === 'web' ? 20 : 16,
    gap: Platform.OS === 'web' ? 12 : 10,
  },
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: '800',
    color: '#065f46',
    flex: 1,
    marginRight: 12,
    lineHeight: Platform.OS === 'web' ? 32 : 26,
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
    padding: Platform.OS === 'web' ? 20 : 16,
    paddingTop: 0,
    gap: Platform.OS === 'web' ? 12 : 10,
  },
  modalSectionTitle: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  modalSectionText: {
    fontSize: Platform.OS === 'web' ? 15 : 14,
    color: '#1f2937',
    lineHeight: Platform.OS === 'web' ? 22 : 20,
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
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nutritionValue: {
    fontSize: 18,
    color: '#047857',
    fontWeight: '700',
  },
  stickyChefRadarContainer: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    paddingHorizontal: Platform.OS === 'web' ? 20 : 16,
    marginHorizontal: Platform.OS === 'web' ? -24 : -16,
    marginBottom: Platform.OS === 'web' ? 20 : 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    ...(Platform.OS === 'web' && {
      position: 'sticky',
    }),
  },
  stickyChefRadarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stickyChefRadarHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickyChefRadarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065f46',
    letterSpacing: -0.2,
  },
  expandButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyChefRadarLoading: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  stickyChefRadarLoadingText: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
  },
  stickyChefRadarEmpty: {
    paddingVertical: 12,
  },
  stickyChefRadarEmptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  stickyChefRadarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: Platform.OS === 'web' ? 10 : 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    marginBottom: 6,
    gap: Platform.OS === 'web' ? 10 : 8,
    minHeight: Platform.OS === 'web' ? 56 : 52,
  },
  stickyChefRadarImage: {
    width: Platform.OS === 'web' ? 56 : 48,
    height: Platform.OS === 'web' ? 56 : 48,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  stickyChefRadarCardBody: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  stickyChefRadarCardTitle: {
    fontSize: Platform.OS === 'web' ? 14 : 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: Platform.OS === 'web' ? 18 : 16,
  },
  stickyChefRadarCardMatch: {
    fontSize: Platform.OS === 'web' ? 11 : 10,
    color: '#047857',
    fontWeight: '600',
    lineHeight: Platform.OS === 'web' ? 14 : 12,
  },
  stickyChefRadarHeartButton: {
    padding: 6,
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyChefRadarExpanded: {
    gap: 6,
    marginTop: 6,
  },
  generateMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 6,
    minHeight: 40,
  },
  generateMoreButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});


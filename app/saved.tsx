import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

import { GlassDock } from '../components/navigation/GlassDock';
import { HeaderAvatar } from '../components/navigation/HeaderAvatar';
import { ContextualWeatherHeader } from '../components/recipes/ContextualWeatherHeader';
import { StockpitLoader } from '../components/glass/StockpitLoader';
import { PriceComparison } from '../components/shopping/PriceComparison';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generateShoppingListFromInventory } from '../services/ai';
import { navigateToRoute } from '../utils/navigation';

interface SavedRecipe {
  id: string;
  recipe_name: string;
  recipe_payload: any;
  recipe_id?: string;
}

interface AIChatRecipe {
  id: string;
  title: string;
  description: string | null;
  ingredients: any[];
  instructions: any[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number;
  difficulty: string;
  servings: number | null;
  nutrition: any;
  tags: string[];
  category: string | null;
  image_url: string | null;
  original_message: string;
  chat_timestamp: string;
  created_at: string;
  updated_at: string;
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

interface ShoppingListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  completed: boolean;
  created_at: string;
}

export default function SavedScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [aiChatRecipes, setAiChatRecipes] = useState<AIChatRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail | null>(null);
  const [selectedAIChatRecipe, setSelectedAIChatRecipe] = useState<AIChatRecipe | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [aiRecipeModalVisible, setAiRecipeModalVisible] = useState(false);
  const [editAIModalVisible, setEditAIModalVisible] = useState(false);
  const [likedRecipes, setLikedRecipes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listName, setListName] = useState('');
  const [listFocus, setListFocus] = useState('');
  const [listItemsDraft, setListItemsDraft] = useState<Array<{ id: string; name: string; quantity: string; category?: string; reason?: string }>>([]);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('');
  const [manualItemCategory, setManualItemCategory] = useState('');
  const [listGenerating, setListGenerating] = useState(false);
  const [inventoryPreview, setInventoryPreview] = useState<Array<{ id: string; name: string; quantity_approx?: string; category?: string }>>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedList, setSelectedList] = useState<ShoppingList | null>(null);
  const [listDetailVisible, setListDetailVisible] = useState(false);
  const [listItems, setListItems] = useState<ShoppingListItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [listItemsLoading, setListItemsLoading] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);
  const [editListName, setEditListName] = useState('');
  const [editListModalVisible, setEditListModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [editingAIRecipe, setEditingAIRecipe] = useState<AIChatRecipe | null>(null);
  const [editAIRecipeData, setEditAIRecipeData] = useState({
    title: '',
    description: '',
    ingredients: '',
    instructions: '',
    prep_time: '',
    cook_time: '',
    total_time: '',
    difficulty: 'Gemiddeld' as 'Makkelijk' | 'Gemiddeld' | 'Moeilijk',
    servings: '',
  });

  useEffect(() => {
    if (!user) {
      setRecipes([]);
      setLists([]);
      setLoading(false);
      return;
    }

    fetchData();
  }, [user]);

  useEffect(() => {
    if (listModalVisible && user) {
      fetchInventoryPreview();
    }
  }, [listModalVisible, user]);

  const fetchData = async () => {
    setLoading(true);
    
    // Force hide loading screen after max 3 seconds
    const maxLoadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    try {
      // Fetch only essentials first
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

      // Fetch saved and liked recipes in parallel
      const [savedResult, likesResult] = await Promise.all([
        fetchWithTimeout(
          supabase
            .from('saved_recipes')
            .select('*')
            .eq('user_id', user!.id)
            .then(r => r.data || [])
        ),
        fetchWithTimeout(
          supabase
            .from('recipe_likes')
            .select('recipe_id, recipes(*)')
            .eq('user_id', user!.id)
            .then(r => r.data || [])
        ),
      ]);

      // Combine saved and liked recipes
      const allRecipes: SavedRecipe[] = [];
      
      if (savedResult) {
        savedResult.forEach((item: any) => {
          allRecipes.push({
            id: item.id,
            recipe_name: item.recipe_name,
            recipe_payload: item.recipe_payload,
            recipe_id: item.recipe_payload.id || item.recipe_payload.recipe_id,
          });
        });
      }

      if (likesResult) {
        const likedSet = new Set<string>();
        likesResult.forEach((like: any) => {
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

      // Hide loading screen - page is ready
      clearTimeout(maxLoadingTimeout);
      setTimeout(() => {
        setLoading(false);
      }, 200);

      // Fetch shopping lists and AI chat recipes in background (non-blocking)
      Promise.all([
        supabase
          .from('shopping_lists')
          .select('*')
          .eq('user_id', user!.id)
          .order('updated_at', { ascending: false })
          .then(({ data: shoppingLists }) => {
            if (shoppingLists && shoppingLists.length > 0) {
              const listIds = shoppingLists.map((list: any) => list.id);
              let countMap: Record<string, number> = {};
              if (listIds.length > 0) {
                return supabase
                  .from('shopping_list_items')
                  .select('list_id')
                  .in('list_id', listIds)
                  .then(({ data: counts }) => {
                    if (counts) {
                      counts.forEach((item: any) => {
                        countMap[item.list_id] = (countMap[item.list_id] || 0) + 1;
                      });
                    }

                    const enriched = shoppingLists.map((list: any) => ({
                      ...list,
                      items_count: countMap[list.id] || 0,
                    }));

                    setLists(enriched as ShoppingList[]);
                  });
              } else {
                setLists(shoppingLists.map((list: any) => ({ ...list, items_count: 0 })) as ShoppingList[]);
              }
            } else {
              setLists([]);
            }
          })
          .catch(() => {
            setLists([]);
          }),
        supabase
          .from('ai_chat_recipes')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            setAiChatRecipes(data || []);
          })
          .catch(() => {
            setAiChatRecipes([]);
          }),
      ]);
    } catch (error) {
      console.error('Error fetching saved data:', error);
      clearTimeout(maxLoadingTimeout);
      setLoading(false);
    }
  };

  const fetchInventoryPreview = async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data } = await supabase
        .from('inventory')
        .select('id, name, quantity_approx, category, expires_at')
        .eq('user_id', user.id)
        .order('expires_at', { ascending: true })
        .limit(20);
      setInventoryPreview(data || []);
    } catch (error) {
      console.error('Error fetching inventory preview:', error);
      setInventoryPreview([]);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleGenerateShoppingList = async () => {
    setListGenerating(true);
    try {
      const suggestions = await generateShoppingListFromInventory(
        inventoryPreview.map((item) => ({
          name: item.name,
          quantity_approx: item.quantity_approx,
          category: item.category,
        })),
        listFocus
      );
      if (suggestions.length === 0) {
        Alert.alert('Geen suggesties', 'AI kon geen lijst genereren. Probeer het opnieuw of vul handmatig aan.');
        return;
      }
      setListItemsDraft(
        suggestions.map((item, index) => ({
          id: `${Date.now()}-${index}`,
          name: item.name,
          quantity: item.quantity || '',
          reason: item.reason,
        }))
      );
    } catch (error) {
      console.error('Error generating shopping list:', error);
      Alert.alert('Fout', 'AI kon geen lijst genereren. Probeer later opnieuw.');
    } finally {
      setListGenerating(false);
    }
  };

  const handleAddManualListItem = () => {
    if (!manualItemName.trim()) {
      Alert.alert('Fout', 'Vul een itemnaam in');
      return;
    }
    setListItemsDraft((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        name: manualItemName.trim(),
        quantity: manualItemQuantity.trim(),
        category: manualItemCategory.trim() || undefined,
      },
    ]);
    setManualItemName('');
    setManualItemQuantity('');
    setManualItemCategory('');
  };

  const handleSaveShoppingList = async () => {
    if (!user) return;
    if (!listName.trim()) {
      Alert.alert('Fout', 'Geef je lijst een naam');
      return;
    }
    if (listItemsDraft.length === 0) {
      Alert.alert('Fout', 'Voeg minstens één item toe');
      return;
    }

    try {
      const { data: newList, error } = await supabase
        .from('shopping_lists')
        .insert({
          user_id: user.id,
          name: listName.trim(),
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Fout', `Kon lijst niet opslaan: ${error.message}`);
        return;
      }

      await supabase.from('shopping_list_items').insert(
        listItemsDraft.map((item) => ({
          list_id: newList.id,
          name: item.name,
          quantity: item.quantity || null,
          category: item.category || null,
        }))
      );

      setLists((prev) => [
        {
          ...newList,
          items_count: listItemsDraft.length,
        },
        ...prev,
      ]);

      resetListModal();
      fetchData();
    } catch (error) {
      console.error('Error saving shopping list:', error);
      Alert.alert('Fout', 'Kon de lijst niet opslaan. Probeer opnieuw.');
    }
  };

  const resetListModal = () => {
    setListModalVisible(false);
    setListName('');
    setListFocus('');
    setListItemsDraft([]);
    setManualItemName('');
    setManualItemQuantity('');
    setManualItemCategory('');
  };

  const handleListPress = async (list: ShoppingList) => {
    setSelectedList(list);
    setListDetailVisible(true);
    setListItemsLoading(true);
    setSelectedCategory(null);
    
    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', list.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setListItems(data || []);
    } catch (error) {
      console.error('Error fetching list items:', error);
      Alert.alert('Fout', 'Kon items niet laden');
    } finally {
      setListItemsLoading(false);
    }
  };

  const handleToggleItemComplete = async (itemId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ completed: !completed })
        .eq('id', itemId);
      
      if (error) throw error;
      
      setListItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, completed: !completed } : item))
      );
    } catch (error) {
      console.error('Error toggling item:', error);
      Alert.alert('Fout', 'Kon item niet updaten');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      
      setListItems((prev) => prev.filter((item) => item.id !== itemId));
      
      if (selectedList) {
        setLists((prev) =>
          prev.map((list) =>
            list.id === selectedList.id
              ? { ...list, items_count: (list.items_count || 0) - 1 }
              : list
          )
        );
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Fout', 'Kon item niet verwijderen');
    }
  };

  const categories = Array.from(new Set(listItems.map((item) => item.category).filter(Boolean))) as string[];
  const filteredItems = selectedCategory
    ? listItems.filter((item) => item.category === selectedCategory)
    : listItems;

  const performDeleteList = async (listId: string) => {
    if (!user) return;

    try {
      // First close detail modal if open
      if (selectedList?.id === listId) {
        setListDetailVisible(false);
        setSelectedList(null);
      }

      const { error } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Delete error:', error);
        throw error;
      }
      
      setLists((prev) => prev.filter((list) => list.id !== listId));
      
      if (Platform.OS !== 'web') {
        Alert.alert('Verwijderd', 'De lijst is verwijderd.');
      }
    } catch (error: any) {
      console.error('Error deleting list:', error);
      const errorMsg = `Kon de lijst niet verwijderen: ${error.message || 'Onbekende fout'}`;
      if (Platform.OS !== 'web') {
        Alert.alert('Fout', errorMsg);
      } else if (typeof window !== 'undefined') {
        alert(errorMsg);
      }
    }
  };

  const handleDeleteList = (listId: string, listName: string) => {
    if (!user) return;

    // Use confirm for web compatibility, Alert.alert for native
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`Weet je zeker dat je "${listName}" wilt verwijderen? Alle items worden ook verwijderd.`);
      if (confirmed) {
        performDeleteList(listId);
      }
    } else {
      Alert.alert(
        'Lijst verwijderen',
        `Weet je zeker dat je "${listName}" wilt verwijderen? Alle items worden ook verwijderd.`,
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Verwijderen',
            style: 'destructive',
            onPress: () => performDeleteList(listId),
          },
        ]
      );
    }
  };

  const handleEditList = (list: ShoppingList) => {
    setEditingList(list);
    setEditListName(list.name);
    setEditListModalVisible(true);
  };

  const handleSaveEditList = async () => {
    if (!editingList || !editListName.trim()) {
      Alert.alert('Fout', 'Geef de lijst een naam');
      return;
    }

    try {
      const { error } = await supabase
        .from('shopping_lists')
        .update({ name: editListName.trim() })
        .eq('id', editingList.id);
      
      if (error) throw error;
      
      setLists((prev) =>
        prev.map((list) =>
          list.id === editingList.id ? { ...list, name: editListName.trim() } : list
        )
      );
      
      if (selectedList?.id === editingList.id) {
        setSelectedList({ ...selectedList, name: editListName.trim() });
      }
      
      setEditListModalVisible(false);
      setEditingList(null);
      setEditListName('');
    } catch (error) {
      console.error('Error updating list:', error);
      Alert.alert('Fout', 'Kon de lijst niet bijwerken. Probeer opnieuw.');
    }
  };

  const handleAddItemToList = async () => {
    if (!selectedList || !newItemName.trim()) {
      Alert.alert('Fout', 'Vul een itemnaam in');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .insert({
          list_id: selectedList.id,
          name: newItemName.trim(),
          quantity: newItemQuantity.trim() || null,
          category: newItemCategory.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setListItems((prev) => [...prev, data]);
      
      // Update items count in lists
      setLists((prev) =>
        prev.map((list) =>
          list.id === selectedList.id
            ? { ...list, items_count: (list.items_count || 0) + 1 }
            : list
        )
      );

      setNewItemName('');
      setNewItemQuantity('');
      setNewItemCategory('');
    } catch (error: any) {
      console.error('Error adding item:', error);
      Alert.alert('Fout', `Kon item niet toevoegen: ${error.message || 'Onbekende fout'}`);
    }
  };

  const handleDeleteAIChatRecipe = async (recipeId: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Weet je zeker dat je dit recept wilt verwijderen?');
      if (!confirmed) return;
    } else {
      Alert.alert(
        'Recept verwijderen',
        'Weet je zeker dat je dit recept wilt verwijderen?',
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Verwijderen',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('ai_chat_recipes')
                  .delete()
                  .eq('id', recipeId);
                
                if (error) throw error;
                
                setAiChatRecipes((prev) => prev.filter((r) => r.id !== recipeId));
                if (selectedAIChatRecipe?.id === recipeId) {
                  setAiRecipeModalVisible(false);
                  setSelectedAIChatRecipe(null);
                }
              } catch (error: any) {
                console.error('Error deleting AI chat recipe:', error);
                Alert.alert('Fout', `Kon recept niet verwijderen: ${error.message}`);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_chat_recipes')
        .delete()
        .eq('id', recipeId);
      
      if (error) throw error;
      
      setAiChatRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      if (selectedAIChatRecipe?.id === recipeId) {
        setAiRecipeModalVisible(false);
        setSelectedAIChatRecipe(null);
      }
    } catch (error: any) {
      console.error('Error deleting AI chat recipe:', error);
      Alert.alert('Fout', `Kon recept niet verwijderen: ${error.message}`);
    }
  };

  const handleEditAIChatRecipe = (recipe: AIChatRecipe) => {
    setEditingAIRecipe(recipe);
    setEditAIRecipeData({
      title: recipe.title,
      description: recipe.description || '',
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((ing: any) => 
            typeof ing === 'string' 
              ? ing 
              : `${ing.quantity || ''} ${ing.unit || ''} ${ing.name || ''}`.trim()
          ).join('\n')
        : '',
      instructions: Array.isArray(recipe.instructions)
        ? recipe.instructions.map((inst: any) => 
            typeof inst === 'string' 
              ? inst 
              : inst.instruction || ''
          ).join('\n')
        : '',
      prep_time: recipe.prep_time_minutes?.toString() || '',
      cook_time: recipe.cook_time_minutes?.toString() || '',
      total_time: recipe.total_time_minutes?.toString() || '',
      difficulty: (recipe.difficulty as 'Makkelijk' | 'Gemiddeld' | 'Moeilijk') || 'Gemiddeld',
      servings: recipe.servings?.toString() || '',
    });
    setEditAIModalVisible(true);
  };

  const handleSaveEditAIRecipe = async () => {
    if (!editingAIRecipe || !editAIRecipeData.title.trim()) {
      Alert.alert('Fout', 'Vul ten minste een titel in.');
      return;
    }

    try {
      // Parse ingredients
      const ingredientsList = editAIRecipeData.ingredients
        .split(/[\n,]/)
        .map(ing => ing.trim())
        .filter(ing => ing.length > 0)
        .map(ing => {
          const parts = ing.match(/^(\d+(?:\.\d+)?)?\s*(\w+)?\s*(.+)$/);
          if (parts) {
            return {
              name: parts[3] || ing,
              quantity: parts[1] || '',
              unit: parts[2] || '',
            };
          }
          return { name: ing, quantity: '', unit: '' };
        });

      // Parse instructions
      const instructionsList = editAIRecipeData.instructions
        .split(/\n|(?=\d+[\.\)])/)
        .map(inst => inst.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(inst => inst.length > 0)
        .map((inst, idx) => ({
          step: idx + 1,
          instruction: inst,
        }));

      const totalTime = parseInt(editAIRecipeData.total_time) || 
                       (parseInt(editAIRecipeData.prep_time) || 0) + (parseInt(editAIRecipeData.cook_time) || 0) ||
                       30;

      const { error } = await supabase
        .from('ai_chat_recipes')
        .update({
          title: editAIRecipeData.title.trim(),
          description: editAIRecipeData.description.trim() || null,
          ingredients: ingredientsList,
          instructions: instructionsList,
          prep_time_minutes: parseInt(editAIRecipeData.prep_time) || null,
          cook_time_minutes: parseInt(editAIRecipeData.cook_time) || null,
          total_time_minutes: totalTime,
          difficulty: editAIRecipeData.difficulty,
          servings: parseInt(editAIRecipeData.servings) || null,
        })
        .eq('id', editingAIRecipe.id);

      if (error) throw error;

      // Refresh the list
      const { data } = await supabase
        .from('ai_chat_recipes')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      
      setAiChatRecipes(data || []);
      
      if (selectedAIChatRecipe?.id === editingAIRecipe.id) {
        const updated = data?.find(r => r.id === editingAIRecipe.id);
        if (updated) setSelectedAIChatRecipe(updated);
      }

      setEditAIModalVisible(false);
      setEditingAIRecipe(null);
      Alert.alert('Bijgewerkt!', 'Het recept is bijgewerkt.');
    } catch (error: any) {
      console.error('Error updating AI chat recipe:', error);
      Alert.alert('Fout', `Kon recept niet bijwerken: ${error.message}`);
    }
  };

  const handleRecipePress = async (recipe: SavedRecipe) => {
    const recipeId = recipe.recipe_id || recipe.recipe_payload?.id || recipe.recipe_payload?.recipe_id;
    const sourceType = recipe.recipe_payload?.source_type;
    
    // For AI-generated recipes (variations, experimental, menu items, ai_chat), use payload directly
    // They don't exist in the recipes table
    if (sourceType && ['variation', 'experimental', 'menu_item', 'ai_chat'].includes(sourceType)) {
      if (recipe.recipe_payload && recipe.recipe_payload.title) {
        setSelectedRecipe({
          recipe_id: recipeId || recipe.recipe_payload.id || recipe.id,
          title: recipe.recipe_payload.title,
          description: recipe.recipe_payload.description || null,
          author: recipe.recipe_payload.author || 'STOCKPIT AI',
          image_url: recipe.recipe_payload.image_url || null,
          total_time_minutes: recipe.recipe_payload.total_time_minutes || 30,
          difficulty: recipe.recipe_payload.difficulty || 'Gemiddeld',
          servings: recipe.recipe_payload.servings || null,
          likes_count: 0,
          ingredients: recipe.recipe_payload.ingredients || [],
          instructions: recipe.recipe_payload.instructions || [],
          nutrition: recipe.recipe_payload.nutrition || null,
          tags: recipe.recipe_payload.tags || [],
          category: recipe.recipe_payload.category || null,
        } as RecipeDetail);
        setModalVisible(true);
        return;
      }
    }
    
    if (!recipeId) {
      // If it's a saved recipe with full payload, use that
      if (recipe.recipe_payload && recipe.recipe_payload.title) {
        setSelectedRecipe({
          recipe_id: recipeId || recipe.id,
          title: recipe.recipe_payload.title,
          description: recipe.recipe_payload.description || null,
          author: recipe.recipe_payload.author || 'STOCKPIT AI',
          image_url: recipe.recipe_payload.image_url || null,
          total_time_minutes: recipe.recipe_payload.total_time_minutes || 30,
          difficulty: recipe.recipe_payload.difficulty || 'Gemiddeld',
          servings: recipe.recipe_payload.servings || null,
          likes_count: 0,
          ingredients: recipe.recipe_payload.ingredients || [],
          instructions: recipe.recipe_payload.instructions || [],
          nutrition: recipe.recipe_payload.nutrition || null,
          tags: recipe.recipe_payload.tags || [],
          category: recipe.recipe_payload.category || null,
        } as RecipeDetail);
        setModalVisible(true);
        return;
      }
      return;
    }

    // For regular recipes, try to fetch from recipes table first
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();
    
    if (data) {
      setSelectedRecipe(data as RecipeDetail);
      setModalVisible(true);
    } else if (recipe.recipe_payload && recipe.recipe_payload.title) {
      // Fallback to saved payload (for AI-generated recipes)
      setSelectedRecipe({
        recipe_id: recipeId,
        title: recipe.recipe_payload.title,
        description: recipe.recipe_payload.description || null,
        author: recipe.recipe_payload.author || 'STOCKPIT AI',
        image_url: recipe.recipe_payload.image_url || null,
        total_time_minutes: recipe.recipe_payload.total_time_minutes || 30,
        difficulty: recipe.recipe_payload.difficulty || 'Gemiddeld',
        servings: recipe.recipe_payload.servings || null,
        likes_count: 0,
        ingredients: recipe.recipe_payload.ingredients || [],
        instructions: recipe.recipe_payload.instructions || [],
        nutrition: recipe.recipe_payload.nutrition || null,
        tags: recipe.recipe_payload.tags || [],
        category: recipe.recipe_payload.category || null,
      } as RecipeDetail);
      setModalVisible(true);
    }
  };

  const handleLike = async (recipeId: string) => {
    if (!user) {
      router.push('/sign-in');
      return;
    }

    try {
      // Check if this is a regular recipe (exists in recipes table) or AI-generated
      const { data: recipeData } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();
      
      if (recipeData) {
        // Regular recipe - use toggle_recipe_like function
        const { data: isLiked } = await supabase.rpc('toggle_recipe_like', { p_recipe_id: recipeId });
        const newLiked = new Set(likedRecipes);
        
        if (isLiked) {
          newLiked.add(recipeId);
          
          // Save to saved_recipes (if not already saved by trigger)
          await supabase.from('saved_recipes').upsert({
            user_id: user.id,
            recipe_name: recipeData.title,
            recipe_payload: recipeData,
          }, {
            onConflict: 'user_id,recipe_name',
          });
        } else {
          newLiked.delete(recipeId);
          
          // Remove from saved_recipes
          await supabase
            .from('saved_recipes')
            .delete()
            .eq('user_id', user.id)
            .eq('recipe_name', recipeData.title);
        }
        
        setLikedRecipes(newLiked);
        
        if (selectedRecipe && selectedRecipe.recipe_id === recipeId) {
          setSelectedRecipe({
            ...selectedRecipe,
            likes_count: isLiked ? (selectedRecipe.likes_count || 0) + 1 : Math.max(0, (selectedRecipe.likes_count || 0) - 1),
          });
        }
      } else {
        // AI-generated recipe - already in saved_recipes, just toggle visual state
        // For AI recipes, "like" is just a visual indicator since they're already saved
        const newLiked = new Set(likedRecipes);
        if (newLiked.has(recipeId)) {
          newLiked.delete(recipeId);
        } else {
          newLiked.add(recipeId);
        }
        setLikedRecipes(newLiked);
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
        <SafeAreaViewComponent 
        style={styles.safeArea}
        // @ts-ignore - web-specific prop
        {...(Platform.OS === 'web' && {
          className: 'safe-area-top',
        })}
      >
          <StockpitLoader variant="saved" />
        </SafeAreaViewComponent>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require('../assets/gree.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
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
          <View style={styles.headerRight}>
            {/* Dynamic Island-style Weather Header */}
            {user && (
              <ContextualWeatherHeader />
            )}
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
                    const sourceType = recipe.recipe_payload?.source_type;
                    const sourceTypeLabels: Record<string, string> = {
                      'variation': 'Variatie',
                      'experimental': 'Experimenteel',
                      'menu_item': 'Menu Item',
                      'ai_chat': 'AI Chat',
                    };
                    const sourceTypeLabel = sourceType ? sourceTypeLabels[sourceType] : null;
                    
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
                        {sourceTypeLabel && (
                          <View style={styles.sourceTypeBadge}>
                            <Text style={styles.sourceTypeBadgeText}>{sourceTypeLabel}</Text>
                          </View>
                        )}
                        {recipeId && !sourceType && (
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
                            {sourceTypeLabel || recipe.recipe_payload?.tags?.[0] || recipe.recipe_payload?.category || recipe.recipe_payload?.mood || 'Recept'}
                          </Text>
                          <Text style={styles.recipeTitle}>{recipe.recipe_name}</Text>
                          <View style={styles.recipeMeta}>
                            <Ionicons name="time-outline" size={14} color="#475569" />
                            <Text style={styles.recipeTime}>
                              {recipe.recipe_payload?.total_time_minutes || recipe.recipe_payload?.time || 'n.v.t.'} min
                            </Text>
                            {recipe.recipe_payload?.difficulty && (
                              <>
                                <Text style={styles.recipeMetaSeparator}>•</Text>
                                <Text style={styles.recipeTime}>{recipe.recipe_payload.difficulty}</Text>
                              </>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>AI Chat Recepten</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {aiChatRecipes.length === 0 && (
                    <View style={styles.placeholderCard}>
                      <Text style={styles.placeholderTitle}>Nog geen AI recepten</Text>
                      <Text style={styles.placeholderCopy}>
                        Sla recepten op vanuit de AI chatbot om ze hier te zien.
                      </Text>
                    </View>
                  )}
                  {aiChatRecipes.map((recipe) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={styles.recipeCard}
                      onPress={() => {
                        setSelectedAIChatRecipe(recipe);
                        setAiRecipeModalVisible(true);
                      }}
                    >
                      <View style={styles.recipeBody}>
                        <View style={styles.recipeHeaderRow}>
                          <Text style={styles.recipeMood}>AI Chat</Text>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteAIChatRecipe(recipe.id);
                            }}
                            style={styles.deleteButton}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.recipeTitle}>{recipe.title}</Text>
                        {recipe.description && (
                          <Text style={styles.recipeDescription} numberOfLines={2}>
                            {recipe.description}
                          </Text>
                        )}
                        <View style={styles.recipeMeta}>
                          <Ionicons name="time-outline" size={14} color="#475569" />
                          <Text style={styles.recipeTime}>{recipe.total_time_minutes} min</Text>
                          {recipe.difficulty && (
                            <>
                              <Text style={styles.recipeMetaSeparator}>•</Text>
                              <Text style={styles.recipeTime}>{recipe.difficulty}</Text>
                            </>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Boodschappenlijsten</Text>
                  <TouchableOpacity onPress={() => setListModalVisible(true)}>
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
                      <TouchableOpacity 
                        style={styles.listCardContent}
                        onPress={() => handleListPress(list)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.listCardHeader}>
                          <View style={styles.listCardIconContainer}>
                            <Ionicons name="list" size={24} color="#047857" />
                          </View>
                          <View style={styles.listCardInfo}>
                            <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                            <View style={styles.listCardMetaRow}>
                              <View style={styles.listCardMetaItem}>
                                <Ionicons name="cube-outline" size={14} color="#64748b" />
                                <Text style={styles.listMeta}>
                                  {list.items_count ?? 0} {list.items_count === 1 ? 'item' : 'items'}
                                </Text>
                              </View>
                              <Text style={styles.listMetaSeparator}>•</Text>
                              <View style={styles.listCardMetaItem}>
                                <Ionicons name="calendar-outline" size={14} color="#64748b" />
                                <Text style={styles.listMeta}>
                                  {new Date(list.updated_at).toLocaleDateString('nl-NL', { 
                                    day: 'numeric', 
                                    month: 'short' 
                                  })}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                        </View>
                      </TouchableOpacity>
                      <View style={styles.listCardActions}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEditList(list);
                          }}
                          style={styles.listActionButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="create-outline" size={20} color="#047857" />
                          <Text style={styles.listActionButtonText}>Bewerken</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id, list.name);
                          }}
                          style={[styles.listActionButton, styles.listActionButtonDelete]}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={20} color="#ef4444" />
                          <Text style={[styles.listActionButtonText, styles.listActionButtonTextDelete]}>Verwijderen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.authCard}>
              <Text style={styles.heroTitle}>Bewaar favorieten</Text>
              <Text style={styles.heroSubtitle}>Maak een account aan om recepten en lijsten te bewaren.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/sign-up')}>
                <Text style={styles.secondaryText}>Account maken</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        </SafeAreaViewComponent>
        <GlassDock />
      </ImageBackground>

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

      {/* Shopping list modal */}
      <Modal
        visible={listModalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetListModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.listModalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Nieuwe boodschappenlijst</Text>
              <Text style={styles.modalSectionText}>
                Laat AI je lijst voorstellen op basis van je voorraad of voeg snel items toe.
              </Text>

              <View style={{ gap: 12, marginTop: 12 }}>
                <TextInput
                  value={listName}
                  onChangeText={setListName}
                  placeholder="Naam van de lijst (bv. Weekend brunch)"
                  placeholderTextColor="#94a3b8"
                  style={styles.listInput}
                />
                <TextInput
                  value={listFocus}
                  onChangeText={setListFocus}
                  placeholder="Focus of context (bv. tapasavond, meal prep)"
                  placeholderTextColor="#94a3b8"
                  style={styles.listInput}
                />
              </View>

              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={styles.modalSectionTitle}>Voorraad snapshot</Text>
                {inventoryLoading ? (
                  <ActivityIndicator color="#047857" />
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                    <View style={styles.inventoryChips}>
                      {inventoryPreview.length === 0 ? (
                        <Text style={{ color: '#94a3b8' }}>Geen voorraad gevonden.</Text>
                      ) : (
                        inventoryPreview.map((item) => (
                          <View key={item.id} style={styles.inventoryChip}>
                            <Text style={styles.inventoryChipName}>{item.name}</Text>
                            <Text style={styles.inventoryChipMeta}>
                              {item.quantity_approx || '–'} • {item.category || 'Onbekend'}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </ScrollView>
                )}
              </View>

              <View style={{ marginTop: 16, gap: 8 }}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.modalSectionTitle}>Items</Text>
                  <TouchableOpacity style={styles.sectionLinkButton} onPress={handleGenerateShoppingList} disabled={listGenerating}>
                    {listGenerating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.sectionLinkButtonText}>AI suggesties</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {listItemsDraft.length === 0 ? (
                  <Text style={{ color: '#94a3b8' }}>Nog geen items. Laat AI starten of voeg manueel toe.</Text>
                ) : (
                  listItemsDraft.map((item) => (
                    <View key={item.id} style={styles.listDraftItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listDraftName}>{item.name}</Text>
                        {item.reason ? (
                          <Text style={styles.listDraftReason}>{item.reason}</Text>
                        ) : null}
                      </View>
                      {item.quantity ? (
                        <Text style={styles.listDraftQuantity}>{item.quantity}</Text>
                      ) : null}
                      <TouchableOpacity onPress={() => setListItemsDraft((prev) => prev.filter((entry) => entry.id !== item.id))}>
                        <Ionicons name="close" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.manualRow}>
                <View style={{ flex: 1, gap: 8 }}>
                  <TextInput
                    value={manualItemName}
                    onChangeText={setManualItemName}
                    placeholder="Item naam"
                    placeholderTextColor="#94a3b8"
                    style={styles.listInput}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={manualItemQuantity}
                      onChangeText={setManualItemQuantity}
                      placeholder="Hoeveelheid"
                      placeholderTextColor="#94a3b8"
                      style={[styles.listInput, { flex: 1 }]}
                    />
                    <TextInput
                      value={manualItemCategory}
                      onChangeText={setManualItemCategory}
                      placeholder="Categorie (optioneel)"
                      placeholderTextColor="#94a3b8"
                      style={[styles.listInput, { flex: 1 }]}
                    />
                  </View>
                </View>
                <TouchableOpacity style={styles.addItemButton} onPress={handleAddManualListItem}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButtonPrimary]} 
                onPress={handleSaveShoppingList}
                disabled={!listName.trim() || listItemsDraft.length === 0}
              >
                <Text style={styles.saveButtonText}>
                  {listItemsDraft.length > 0 ? `Opslaan (${listItemsDraft.length} items)` : 'Lijst opslaan'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: 'transparent', marginTop: 8 }]} onPress={resetListModal}>
                <Text style={[styles.modalButtonText, { color: '#047857' }]}>Annuleren</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Shopping List Detail Modal */}
      <Modal
        visible={listDetailVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setListDetailVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.listDetailCard}>
            <View style={styles.listDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listDetailTitle}>{selectedList?.name}</Text>
                <Text style={styles.listDetailMeta}>
                  {listItems.length} items • {selectedList && new Date(selectedList.updated_at).toLocaleDateString('nl-NL')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setListDetailVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {categories.length > 0 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.categoryFilter}
                contentContainerStyle={styles.categoryFilterContent}
              >
                <TouchableOpacity
                  style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                    Alles
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {listItemsLoading ? (
              <View style={styles.listDetailLoading}>
                <ActivityIndicator size="large" color="#047857" />
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={styles.listDetailEmpty}>
                <Ionicons name="list-outline" size={48} color="#94a3b8" />
                <Text style={styles.listDetailEmptyText}>
                  {selectedCategory ? `Geen items in categorie "${selectedCategory}"` : 'Geen items in deze lijst'}
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.listDetailItems}>
                {filteredItems.map((item) => (
                  <View key={item.id}>
                    <View style={[styles.listDetailItem, item.completed && styles.listDetailItemCompleted]}>
                      <TouchableOpacity
                        style={styles.listDetailCheckbox}
                        onPress={() => handleToggleItemComplete(item.id, item.completed)}
                      >
                        <Ionicons
                          name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                          size={24}
                          color={item.completed ? '#047857' : '#94a3b8'}
                        />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listDetailItemName, item.completed && styles.listDetailItemNameCompleted]}>
                          {item.name}
                        </Text>
                        <View style={styles.listDetailItemMeta}>
                          {item.quantity && (
                            <Text style={styles.listDetailItemQuantity}>{item.quantity}</Text>
                          )}
                          {item.category && (
                          <View style={styles.listDetailItemCategory}>
                            <Text style={styles.listDetailItemCategoryText}>{item.category}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(item.id)}
                      style={styles.listDetailDelete}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  {/* Price Comparison */}
                  {!item.completed && user && (
                    <PriceComparison
                      itemName={item.name}
                      onSelect={async (productId, store, price) => {
                        // Update shopping list item with selected product
                        try {
                          await supabase
                            .from('shopping_list_items')
                            .update({
                              catalog_product_id: productId,
                              estimated_price: price,
                              store_source: store,
                            })
                            .eq('id', item.id);
                          
                          // Refresh items
                          if (selectedList) {
                            handleListPress(selectedList);
                          }
                        } catch (error) {
                          console.error('Error updating item with price:', error);
                        }
                      }}
                    />
                  )}
                </View>
                ))}
              </ScrollView>
            )}

            {/* Add Item Section */}
            <View style={styles.addItemSection}>
              <Text style={styles.addItemSectionTitle}>Item toevoegen</Text>
              <View style={styles.addItemForm}>
                <TextInput
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="Item naam"
                  placeholderTextColor="#94a3b8"
                  style={styles.addItemInput}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={newItemQuantity}
                    onChangeText={setNewItemQuantity}
                    placeholder="Hoeveelheid"
                    placeholderTextColor="#94a3b8"
                    style={[styles.addItemInput, { flex: 1 }]}
                  />
                  <TextInput
                    value={newItemCategory}
                    onChangeText={setNewItemCategory}
                    placeholder="Categorie (optioneel)"
                    placeholderTextColor="#94a3b8"
                    style={[styles.addItemInput, { flex: 1 }]}
                  />
                </View>
                <TouchableOpacity
                  style={styles.addItemButtonDetail}
                  onPress={handleAddItemToList}
                  disabled={!newItemName.trim()}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addItemButtonText}>Toevoegen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit List Modal */}
      <Modal
        visible={editListModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditListModalVisible(false);
          setEditingList(null);
          setEditListName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.listModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalSectionTitle}>Lijst bewerken</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditListModalVisible(false);
                  setEditingList(null);
                  setEditListName('');
                }}
              >
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>
            
            <View style={{ gap: 12, marginTop: 16 }}>
              <Text style={styles.label}>Naam</Text>
              <TextInput
                value={editListName}
                onChangeText={setEditListName}
                placeholder="Naam van de lijst"
                placeholderTextColor="#94a3b8"
                style={styles.listInput}
                autoFocus
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity
                style={[styles.modalButton, { flex: 1, backgroundColor: 'transparent' }]}
                onPress={() => {
                  setEditListModalVisible(false);
                  setEditingList(null);
                  setEditListName('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#64748b' }]}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButtonPrimary, { flex: 1 }]}
                onPress={handleSaveEditList}
                disabled={!editListName.trim()}
              >
                <Text style={styles.saveButtonText}>Opslaan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Chat Recipe Detail Modal */}
      <Modal
        visible={aiRecipeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAiRecipeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedAIChatRecipe && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderTop}>
                      <Text style={styles.modalTitle}>{selectedAIChatRecipe.title}</Text>
                      <TouchableOpacity
                        onPress={() => setAiRecipeModalVisible(false)}
                        style={styles.closeButton}
                      >
                        <Ionicons name="close" size={24} color="#0f172a" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.modalAuthor}>Van AI Chat</Text>
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaPill}>
                        <Ionicons name="time-outline" size={16} color="#047857" />
                        <Text style={styles.modalMetaText}>{selectedAIChatRecipe.total_time_minutes} min</Text>
                      </View>
                      <View style={styles.modalMetaPill}>
                        <Ionicons name="restaurant-outline" size={16} color="#047857" />
                        <Text style={styles.modalMetaText}>{selectedAIChatRecipe.difficulty}</Text>
                      </View>
                      {selectedAIChatRecipe.servings && (
                        <View style={styles.modalMetaPill}>
                          <Ionicons name="people-outline" size={16} color="#047857" />
                          <Text style={styles.modalMetaText}>{selectedAIChatRecipe.servings} pers.</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.likeButton, { flex: 1 }]}
                        onPress={() => handleEditAIChatRecipe(selectedAIChatRecipe)}
                      >
                        <Ionicons name="create-outline" size={20} color="#047857" />
                        <Text style={styles.likeButtonText}>Bewerken</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.likeButton, { flex: 1, borderColor: '#ef4444' }]}
                        onPress={() => handleDeleteAIChatRecipe(selectedAIChatRecipe.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        <Text style={[styles.likeButtonText, { color: '#ef4444' }]}>Verwijderen</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {selectedAIChatRecipe.description && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Beschrijving</Text>
                      <Text style={styles.modalSectionText}>{selectedAIChatRecipe.description}</Text>
                    </View>
                  )}

                  {selectedAIChatRecipe.ingredients && Array.isArray(selectedAIChatRecipe.ingredients) && selectedAIChatRecipe.ingredients.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Ingrediënten</Text>
                      {selectedAIChatRecipe.ingredients.map((ing: any, idx: number) => (
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

                  {selectedAIChatRecipe.instructions && Array.isArray(selectedAIChatRecipe.instructions) && selectedAIChatRecipe.instructions.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Bereiding</Text>
                      {selectedAIChatRecipe.instructions.map((step: any, idx: number) => (
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
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit AI Chat Recipe Modal */}
      <Modal
        visible={editAIModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setEditAIModalVisible(false);
          setEditingAIRecipe(null);
        }}
      >
        <View style={styles.saveModalOverlay}>
          <View style={styles.saveModalContent}>
            <View style={styles.saveModalHeader}>
              <Text style={styles.saveModalTitle}>Recept Bewerken</Text>
              <TouchableOpacity onPress={() => {
                setEditAIModalVisible(false);
                setEditingAIRecipe(null);
              }}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.saveModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.saveForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Titel *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editAIRecipeData.title}
                    onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, title: text }))}
                    placeholder="Bijv. Pasta Carbonara"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Beschrijving</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={editAIRecipeData.description}
                    onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, description: text }))}
                    placeholder="Korte beschrijving van het recept"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Voorbereiding (min)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editAIRecipeData.prep_time}
                      onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, prep_time: text }))}
                      placeholder="15"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Bereiding (min)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editAIRecipeData.cook_time}
                      onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, cook_time: text }))}
                      placeholder="20"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Totaal (min)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editAIRecipeData.total_time}
                      onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, total_time: text }))}
                      placeholder="35"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Moeilijkheid</Text>
                    <View style={styles.difficultyButtons}>
                      {['Makkelijk', 'Gemiddeld', 'Moeilijk'].map((diff) => (
                        <TouchableOpacity
                          key={diff}
                          style={[
                            styles.difficultyButton,
                            editAIRecipeData.difficulty === diff && styles.difficultyButtonActive,
                          ]}
                          onPress={() => setEditAIRecipeData(prev => ({ ...prev, difficulty: diff as any }))}
                        >
                          <Text
                            style={[
                              styles.difficultyButtonText,
                              editAIRecipeData.difficulty === diff && styles.difficultyButtonTextActive,
                            ]}
                          >
                            {diff}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Porties</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editAIRecipeData.servings}
                      onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, servings: text }))}
                      placeholder="4"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Ingrediënten</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={editAIRecipeData.ingredients}
                    onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, ingredients: text }))}
                    placeholder="1 el olijfolie&#10;2 teentjes knoflook&#10;200g pasta"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={6}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Bereiding</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={editAIRecipeData.instructions}
                    onChangeText={(text) => setEditAIRecipeData(prev => ({ ...prev, instructions: text }))}
                    placeholder="1. Kook de pasta volgens de verpakking&#10;2. Bak de knoflook in olijfolie&#10;3. Meng alles door elkaar"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={8}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.saveModalActions}>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonSecondary]}
                onPress={() => {
                  setEditAIModalVisible(false);
                  setEditingAIRecipe(null);
                }}
              >
                <Text style={styles.saveModalButtonTextSecondary}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonPrimary]}
                onPress={handleSaveEditAIRecipe}
                disabled={!editAIRecipeData.title.trim()}
              >
                <Text style={styles.saveModalButtonTextPrimary}>Opslaan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.select({
      web: 0, // Handled by CSS safe-area-top class
      default: 8,
    }),
    zIndex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: Platform.select({
      web: 140, // Extra space for fixed bottom nav + safe area
      default: 120,
    }),
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
  sectionLinkButton: {
    backgroundColor: '#047857',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  sectionLinkButtonText: {
    color: '#fff',
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
  sourceTypeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  sourceTypeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
  recipeMetaSeparator: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  listGrid: {
    gap: 12,
  },
  listCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  listCardContent: {
    flex: 1,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  listCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCardInfo: {
    flex: 1,
    gap: 6,
  },
  listCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  listCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  listActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  listActionButtonDelete: {
    backgroundColor: '#fef2f2',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  listActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  listActionButtonTextDelete: {
    color: '#ef4444',
  },
  listName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  listMeta: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  listMetaSeparator: {
    fontSize: 13,
    color: '#cbd5e1',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  listModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    padding: 24,
  },
  listInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  inventoryChips: {
    flexDirection: 'row',
    gap: 10,
  },
  inventoryChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 12,
    backgroundColor: '#f8fafc',
    minWidth: 140,
  },
  inventoryChipName: {
    fontWeight: '700',
    color: '#0f172a',
  },
  inventoryChipMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  listDraftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  listDraftName: {
    fontWeight: '700',
    color: '#0f172a',
  },
  listDraftReason: {
    color: '#94a3b8',
    fontSize: 12,
  },
  listDraftQuantity: {
    fontWeight: '600',
    color: '#047857',
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  addItemButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonPrimary: {
    backgroundColor: '#047857',
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  listDetailCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingTop: 20,
    paddingBottom: 40,
  },
  listDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  listDetailTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  listDetailMeta: {
    fontSize: 14,
    color: '#64748b',
  },
  categoryFilter: {
    marginBottom: 16,
  },
  categoryFilterContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  categoryChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  listDetailLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listDetailEmpty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  listDetailEmptyText: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
  },
  listDetailItems: {
    paddingHorizontal: 24,
  },
  listDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
  },
  listDetailItemCompleted: {
    opacity: 0.6,
    backgroundColor: '#f0fdf4',
  },
  listDetailCheckbox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listDetailItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  listDetailItemNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  listDetailItemMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  listDetailItemQuantity: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  listDetailItemCategory: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
  },
  listDetailItemCategoryText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  listDetailDelete: {
    padding: 8,
  },
  label: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  addItemSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#f8fafc',
  },
  addItemSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  addItemForm: {
    gap: 12,
  },
  addItemInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  addItemButtonDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  recipeDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  recipeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deleteButton: {
    padding: 4,
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  saveModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  saveModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  saveModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  saveModalScroll: {
    maxHeight: 500,
  },
  saveForm: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  difficultyButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  difficultyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  difficultyButtonTextActive: {
    color: '#fff',
  },
  saveModalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  saveModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveModalButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  saveModalButtonPrimary: {
    backgroundColor: '#047857',
  },
  saveModalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveModalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
});




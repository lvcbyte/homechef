import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { chatWithAdminAI, type AdminAIResponse } from '../services/ai';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

interface AdminLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  created_at: string;
}

interface SystemMetric {
  total_users: number;
  total_recipes: number;
  total_inventory_items: number;
  total_saved_recipes: number;
  total_likes: number;
  recent_logs_count: number;
  active_admins: number;
}

interface User {
  id: string;
  email: string;
  created_at: string;
  is_admin: boolean;
  admin_role: string | null;
  archetype: string | null;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  author: string;
  created_at: string;
  updated_at?: string;
  total_time_minutes: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  difficulty: string;
  servings: number;
  image_url?: string | null;
  ingredients?: any;
  instructions?: any;
  tags?: string[];
  category?: string | null;
  nutrition?: any;
  is_featured?: boolean;
  likes_count?: number;
}

type DashboardView = 'overview' | 'recipes' | 'users' | 'ai' | 'analytics' | 'settings';

export default function AdminPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [metrics, setMetrics] = useState<SystemMetric | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]); // Store all recipes for filtering
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterFeatured, setFilterFeatured] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'title' | 'total_time_minutes' | 'likes_count'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Recipe Detail & Edit State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeDetailVisible, setRecipeDetailVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Partial<Recipe>>({});
  const [savingRecipe, setSavingRecipe] = useState(false);
  
  // AI Chat State
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; action?: any }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user, profile]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const checkAdminAccess = async () => {
    if (!user) {
      setIsLoading(false);
      setLoginModalVisible(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, admin_role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.is_admin) {
        setIsAuthenticated(true);
        fetchDashboardData();
      } else {
        Alert.alert('Toegang geweigerd', 'Je hebt geen admin rechten.');
        router.push('/');
      }
    } catch (error: any) {
      console.error('Error checking admin access:', error);
      Alert.alert('Fout', 'Kon admin status niet verifiëren.');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!username || !password) {
      Alert.alert('Fout', 'Vul gebruikersnaam en wachtwoord in.');
      return;
    }

    setLoggingIn(true);
    try {
      let email = username;
      
      if (!username.includes('@')) {
        if (username.toUpperCase() === 'ADMIN') {
          email = 'admin@stockpit.app';
        } else {
          email = `${username}@admin.stockpit.app`;
        }
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        if (!username.includes('@')) {
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email: username,
            password: password,
          });
          
          if (retryError) throw retryError;
          
          if (retryData.user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('is_admin')
              .eq('id', retryData.user.id)
              .single();

            if (profileData?.is_admin) {
              setIsAuthenticated(true);
              setLoginModalVisible(false);
              fetchDashboardData();
              return;
            } else {
              await supabase.auth.signOut();
              Alert.alert('Toegang geweigerd', 'Dit account heeft geen admin rechten.');
              return;
            }
          }
        }
        throw error;
      }

      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              archetype: 'Minimalist',
              dietary_restrictions: [],
              cooking_skill: 'Advanced',
              is_admin: true,
              admin_role: 'owner',
              admin_permissions: {
                can_manage_users: true,
                can_manage_recipes: true,
                can_manage_inventory: true,
                can_view_logs: true,
                can_modify_database: true,
                can_access_api: true,
              },
            });
          
          if (insertError) throw new Error('Kon profiel niet aanmaken.');
          
          setIsAuthenticated(true);
          setLoginModalVisible(false);
          fetchDashboardData();
          return;
        }

        if (profileData?.is_admin) {
          setIsAuthenticated(true);
          setLoginModalVisible(false);
          fetchDashboardData();
        } else {
          await supabase.auth.signOut();
          Alert.alert('Toegang geweigerd', 'Dit account heeft geen admin rechten.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login mislukt', error.message || 'Ongeldige inloggegevens.');
    } finally {
      setLoggingIn(false);
    }
  };

  const applyFilters = (
    recipesToFilter: Recipe[],
    query: string,
    category: string | null,
    difficulty: string | null,
    tags: string[],
    featured: boolean | null,
    sort: typeof sortBy,
    order: typeof sortOrder
  ) => {
    let filtered = [...recipesToFilter];

    // Search query
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(recipe => 
        recipe.title.toLowerCase().includes(lowerQuery) ||
        recipe.description?.toLowerCase().includes(lowerQuery) ||
        recipe.author.toLowerCase().includes(lowerQuery) ||
        recipe.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
        recipe.category?.toLowerCase().includes(lowerQuery)
      );
    }

    // Category filter
    if (category) {
      filtered = filtered.filter(recipe => recipe.category === category);
    }

    // Difficulty filter
    if (difficulty) {
      filtered = filtered.filter(recipe => recipe.difficulty === difficulty);
    }

    // Tags filter
    if (tags.length > 0) {
      filtered = filtered.filter(recipe => 
        recipe.tags && tags.some(tag => recipe.tags?.includes(tag))
      );
    }

    // Featured filter
    if (featured !== null) {
      filtered = filtered.filter(recipe => recipe.is_featured === featured);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sort) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'total_time_minutes':
          aValue = a.total_time_minutes || 0;
          bValue = b.total_time_minutes || 0;
          break;
        case 'likes_count':
          aValue = a.likes_count || 0;
          bValue = b.likes_count || 0;
          break;
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    setRecipes(filtered);
  };

  const fetchDashboardData = async () => {
    try {
      const [
        statsResult,
        logsResult,
        usersListResult,
        recipesResult,
      ] = await Promise.all([
        supabase.rpc('get_admin_stats'),
        supabase
          .from('admin_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.rpc('get_all_users_for_admin'),
        supabase
          .from('recipes')
          .select('id, title, description, author, created_at, updated_at, total_time_minutes, prep_time_minutes, cook_time_minutes, difficulty, servings, image_url, ingredients, instructions, tags, category, nutrition, is_featured')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (statsResult.data) {
        setMetrics(statsResult.data as SystemMetric);
      }

      if (logsResult.data) {
        setRecentLogs(logsResult.data as AdminLog[]);
      }

      if (usersListResult.data) {
        const usersWithEmail = usersListResult.data.map((user: any) => ({
          id: user.user_id,
          email: user.email || 'N/A',
          created_at: user.created_at,
          is_admin: user.is_admin || false,
          admin_role: user.admin_role,
          archetype: user.archetype,
        }));
        setUsers(usersWithEmail as User[]);
      }

      if (recipesResult.data) {
        const recipesData = recipesResult.data as Recipe[];
        setAllRecipes(recipesData);
        
        // Extract unique categories and tags
        const categories = new Set<string>();
        const tags = new Set<string>();
        recipesData.forEach(recipe => {
          if (recipe.category) categories.add(recipe.category);
          if (recipe.tags && Array.isArray(recipe.tags)) {
            recipe.tags.forEach(tag => tags.add(tag));
          }
        });
        setAvailableCategories(Array.from(categories).sort());
        setAvailableTags(Array.from(tags).sort());
        
        // Apply initial filters
        applyFilters(recipesData, searchQuery, filterCategory, filterDifficulty, filterTags, filterFeatured, sortBy, sortOrder);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleAdminChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const recentRecipes = recipes.slice(0, 10).map(r => ({
        id: r.id,
        title: r.title,
        created_at: r.created_at,
      }));

      const recentUsers = users.slice(0, 10).map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      }));

      const aiContext = {
        databaseStats: {
          totalUsers: metrics?.total_users || 0,
          totalRecipes: metrics?.total_recipes || 0,
          totalInventoryItems: metrics?.total_inventory_items || 0,
          recentRecipes,
          recentUsers,
        },
      };

      const response = await chatWithAdminAI(userMessage, aiContext);
      
      setChatMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: response.message,
        action: response.action,
      }]);

      // Execute action if present
      if (response.action) {
        await executeAIAction(response.action);
      }
    } catch (error: any) {
      Alert.alert('Fout', error.message || 'Kon niet communiceren met AI.');
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (allRecipes.length > 0) {
      applyFilters(allRecipes, searchQuery, filterCategory, filterDifficulty, filterTags, filterFeatured, sortBy, sortOrder);
    }
  }, [searchQuery, filterCategory, filterDifficulty, filterTags, filterFeatured, sortBy, sortOrder, allRecipes]);

  const loadRecipeDetails = async (recipeId: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_get_recipe_details', {
        p_recipe_id: recipeId,
      });
      if (error) throw error;
      if (data) {
        setSelectedRecipe(data as Recipe);
        setEditingRecipe(data as Recipe);
      }
    } catch (error: any) {
      Alert.alert('Fout', error.message || 'Kon recept details niet laden.');
    }
  };

  const handleSaveRecipe = async () => {
    if (!selectedRecipe) return;

    setSavingRecipe(true);
    try {
      // Normalize ingredients and instructions
      let ingredients = editingRecipe.ingredients;
      if (typeof ingredients === 'string') {
        // Parse string to array
        ingredients = ingredients.split('\n').filter(line => line.trim()).map(line => {
          const trimmed = line.trim();
          // Try to parse structured format
          const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(\w+)?\s+(.+)$/);
          if (match) {
            return { quantity: match[1], unit: match[2] || '', name: match[3] };
          }
          return { name: trimmed, quantity: '', unit: '' };
        });
      }

      let instructions = editingRecipe.instructions;
      if (typeof instructions === 'string') {
        instructions = instructions.split('\n').filter(line => line.trim()).map((line, idx) => ({
          step: idx + 1,
          instruction: line.trim(),
        }));
      }

      const { error } = await supabase.rpc('admin_update_recipe', {
        p_recipe_id: selectedRecipe.id,
        p_title: editingRecipe.title || null,
        p_description: editingRecipe.description || null,
        p_image_url: editingRecipe.image_url || null,
        p_prep_time_minutes: editingRecipe.prep_time_minutes || null,
        p_cook_time_minutes: editingRecipe.cook_time_minutes || null,
        p_total_time_minutes: editingRecipe.total_time_minutes || null,
        p_difficulty: editingRecipe.difficulty || null,
        p_servings: editingRecipe.servings || null,
        p_ingredients: ingredients || null,
        p_instructions: instructions || null,
        p_tags: editingRecipe.tags || null,
        p_category: editingRecipe.category || null,
        p_nutrition: editingRecipe.nutrition ? (typeof editingRecipe.nutrition === 'string' ? JSON.parse(editingRecipe.nutrition) : editingRecipe.nutrition) : null,
        p_author: editingRecipe.author || null,
        p_is_featured: editingRecipe.is_featured || null,
      });

      if (error) throw error;

      Alert.alert('Succes', 'Recept bijgewerkt!');
      setEditMode(false);
      fetchDashboardData();
      if (selectedRecipe) {
        await loadRecipeDetails(selectedRecipe.id);
      }
    } catch (error: any) {
      Alert.alert('Fout', error.message || 'Kon recept niet opslaan.');
    } finally {
      setSavingRecipe(false);
    }
  };

  const executeAIAction = async (action: any) => {
    try {
      switch (action.type) {
        case 'create_recipe':
          if (action.data) {
            const { data, error } = await supabase.rpc('admin_create_recipe', {
              p_title: action.data.title,
              p_description: action.data.description || '',
              p_image_url: action.data.image_url || null,
              p_prep_time_minutes: action.data.prep_time_minutes || 15,
              p_cook_time_minutes: action.data.cook_time_minutes || 30,
              p_total_time_minutes: action.data.total_time_minutes || 45,
              p_difficulty: action.data.difficulty || 'Gemiddeld',
              p_servings: action.data.servings || 4,
              p_ingredients: action.data.ingredients || [],
              p_instructions: action.data.instructions || [],
              p_tags: action.data.tags || [],
              p_category: action.data.category || null,
              p_author: 'Admin AI',
            });
            if (error) throw error;
            Alert.alert('Succes', 'Recept toegevoegd!');
            fetchDashboardData();
          }
          break;
        case 'update_recipe':
          if (action.data?.recipe_id) {
            const { error } = await supabase.rpc('admin_update_recipe', {
              p_recipe_id: action.data.recipe_id,
              p_title: action.data.title,
              p_description: action.data.description,
              p_ingredients: action.data.ingredients,
              p_instructions: action.data.instructions,
            });
            if (error) throw error;
            Alert.alert('Succes', 'Recept bijgewerkt!');
            fetchDashboardData();
          }
          break;
        case 'delete_recipe':
          if (action.data?.recipe_id) {
            Alert.alert(
              'Recept Verwijderen',
              'Weet je zeker dat je dit recept wilt verwijderen?',
              [
                { text: 'Annuleren', style: 'cancel' },
                {
                  text: 'Verwijderen',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await supabase.rpc('admin_delete_recipe', {
                      p_recipe_id: action.data.recipe_id,
                    });
                    if (error) throw error;
                    Alert.alert('Succes', 'Recept verwijderd!');
                    fetchDashboardData();
                  },
                },
              ]
            );
          }
          break;
      }
    } catch (error: any) {
      Alert.alert('Fout', error.message || 'Kon actie niet uitvoeren.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#047857" />
            <Text style={styles.loadingText}>STOCKPIT Admin</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Modal
            visible={loginModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => router.push('/')}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.loginModal}>
                <View style={styles.loginHeader}>
                  <Image source={require('../assets/logo.png')} style={styles.loginLogo} resizeMode="contain" />
                  <Text style={styles.loginTitle}>STOCKPIT</Text>
                  <Text style={styles.loginSubtitle}>Admin Dashboard</Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gebruikersnaam</Text>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="ADMIN"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Wachtwoord</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleAdminLogin}
                  disabled={loggingIn}
                >
                  {loggingIn ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Inloggen</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.push('/')}
                >
                  <Text style={styles.cancelButtonText}>Annuleren</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#065f46" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.brandLabel}>STOCKPIT</Text>
              <Text style={styles.brandSubtitle}>Admin Foundry</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={() => setChatVisible(true)}>
              <Ionicons name="chatbubbles" size={20} color="#047857" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={fetchDashboardData}>
              <Ionicons name="refresh" size={20} color="#047857" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/')}>
              <Ionicons name="home" size={20} color="#047857" />
            </TouchableOpacity>
          </View>
        </View>


        {/* Content */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {currentView === 'overview' && (
            <View style={styles.overviewContainer}>
              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <LinearGradient colors={['#047857', '#065f46']} style={styles.metricGradient}>
                    <Ionicons name="people" size={32} color="#fff" />
                    <Text style={styles.metricValue}>{metrics?.total_users || 0}</Text>
                    <Text style={styles.metricLabel}>Gebruikers</Text>
                  </LinearGradient>
                </View>
                <View style={styles.metricCard}>
                  <LinearGradient colors={['#047857', '#065f46']} style={styles.metricGradient}>
                    <Ionicons name="restaurant" size={32} color="#fff" />
                    <Text style={styles.metricValue}>{metrics?.total_recipes || 0}</Text>
                    <Text style={styles.metricLabel}>Recepten</Text>
                  </LinearGradient>
                </View>
                <View style={styles.metricCard}>
                  <LinearGradient colors={['#047857', '#065f46']} style={styles.metricGradient}>
                    <Ionicons name="basket" size={32} color="#fff" />
                    <Text style={styles.metricValue}>{metrics?.total_inventory_items || 0}</Text>
                    <Text style={styles.metricLabel}>Inventory</Text>
                  </LinearGradient>
                </View>
                <View style={styles.metricCard}>
                  <LinearGradient colors={['#047857', '#065f46']} style={styles.metricGradient}>
                    <Ionicons name="heart" size={32} color="#fff" />
                    <Text style={styles.metricValue}>{metrics?.total_likes || 0}</Text>
                    <Text style={styles.metricLabel}>Likes</Text>
                  </LinearGradient>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Snelle Acties</Text>
                <View style={styles.actionsGrid}>
                  <TouchableOpacity style={styles.actionCard} onPress={() => setChatVisible(true)}>
                    <Ionicons name="sparkles" size={28} color="#047857" />
                    <Text style={styles.actionLabel}>AI Assistent</Text>
                    <Text style={styles.actionDescription}>Recepten beheren met AI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => setCurrentView('recipes')}>
                    <Ionicons name="restaurant" size={28} color="#047857" />
                    <Text style={styles.actionLabel}>Recepten</Text>
                    <Text style={styles.actionDescription}>Bekijk alle recepten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => setCurrentView('users')}>
                    <Ionicons name="people" size={28} color="#047857" />
                    <Text style={styles.actionLabel}>Gebruikers</Text>
                    <Text style={styles.actionDescription}>Beheer gebruikers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionCard} onPress={() => setCurrentView('analytics')}>
                    <Ionicons name="analytics" size={28} color="#047857" />
                    <Text style={styles.actionLabel}>Analytics</Text>
                    <Text style={styles.actionDescription}>Platform statistieken</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Recent Activity */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recente Activiteit</Text>
                <View style={styles.logsContainer}>
                  {recentLogs.length === 0 ? (
                    <Text style={styles.emptyText}>Geen recente activiteit</Text>
                  ) : (
                    recentLogs.slice(0, 10).map((log) => (
                      <View key={log.id} style={styles.logItem}>
                        <View style={styles.logHeader}>
                          <Text style={styles.logAction}>{log.action}</Text>
                          <Text style={styles.logTime}>
                            {new Date(log.created_at).toLocaleString('nl-NL')}
                          </Text>
                        </View>
                        {log.resource_type && (
                          <Text style={styles.logResource}>
                            {log.resource_type}: {log.resource_id?.substring(0, 8)}...
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          )}

          {currentView === 'recipes' && (
            <View style={styles.recipesContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Recepten ({recipes.length}{allRecipes.length !== recipes.length ? ` / ${allRecipes.length}` : ''})
                </Text>
                <View style={styles.sectionHeaderActions}>
                  <TouchableOpacity 
                    style={styles.filterToggleButton}
                    onPress={() => setShowFilters(!showFilters)}
                  >
                    <Ionicons name={showFilters ? "filter" : "filter-outline"} size={20} color="#047857" />
                    <Text style={styles.filterToggleText}>Filters</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addButton} onPress={() => setChatVisible(true)}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Nieuw Recept</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Zoek op titel, beschrijving, auteur, tags..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#94a3b8"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                    <Ionicons name="close-circle" size={20} color="#64748b" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Advanced Filters */}
              {showFilters && (
                <View style={styles.filtersContainer}>
                  {/* Category Filter */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Categorie</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                      <TouchableOpacity
                        style={[styles.filterChip, !filterCategory && styles.filterChipActive]}
                        onPress={() => setFilterCategory(null)}
                      >
                        <Text style={[styles.filterChipText, !filterCategory && styles.filterChipTextActive]}>
                          Alle
                        </Text>
                      </TouchableOpacity>
                      {availableCategories.map(cat => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.filterChip, filterCategory === cat && styles.filterChipActive]}
                          onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
                        >
                          <Text style={[styles.filterChipText, filterCategory === cat && styles.filterChipTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Difficulty Filter */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Moeilijkheidsgraad</Text>
                    <View style={styles.filterRow}>
                      {['Makkelijk', 'Gemiddeld', 'Moeilijk'].map(diff => (
                        <TouchableOpacity
                          key={diff}
                          style={[styles.filterChip, filterDifficulty === diff && styles.filterChipActive]}
                          onPress={() => setFilterDifficulty(filterDifficulty === diff ? null : diff)}
                        >
                          <Text style={[styles.filterChipText, filterDifficulty === diff && styles.filterChipTextActive]}>
                            {diff}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.filterChip, filterDifficulty === null && styles.filterChipActive]}
                        onPress={() => setFilterDifficulty(null)}
                      >
                        <Text style={[styles.filterChipText, filterDifficulty === null && styles.filterChipTextActive]}>
                          Alle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Tags Filter */}
                  {availableTags.length > 0 && (
                    <View style={styles.filterGroup}>
                      <Text style={styles.filterLabel}>Tags</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                        {availableTags.map(tag => {
                          const isSelected = filterTags.includes(tag);
                          return (
                            <TouchableOpacity
                              key={tag}
                              style={[styles.filterChip, isSelected && styles.filterChipActive]}
                              onPress={() => {
                                if (isSelected) {
                                  setFilterTags(filterTags.filter(t => t !== tag));
                                } else {
                                  setFilterTags([...filterTags, tag]);
                                }
                              }}
                            >
                              <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                                {tag}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Featured Filter */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Featured</Text>
                    <View style={styles.filterRow}>
                      <TouchableOpacity
                        style={[styles.filterChip, filterFeatured === null && styles.filterChipActive]}
                        onPress={() => setFilterFeatured(null)}
                      >
                        <Text style={[styles.filterChipText, filterFeatured === null && styles.filterChipTextActive]}>
                          Alle
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterChip, filterFeatured === true && styles.filterChipActive]}
                        onPress={() => setFilterFeatured(filterFeatured === true ? null : true)}
                      >
                        <Ionicons name="star" size={16} color={filterFeatured === true ? "#fff" : "#64748b"} />
                        <Text style={[styles.filterChipText, filterFeatured === true && styles.filterChipTextActive]}>
                          Featured
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.filterChip, filterFeatured === false && styles.filterChipActive]}
                        onPress={() => setFilterFeatured(filterFeatured === false ? null : false)}
                      >
                        <Text style={[styles.filterChipText, filterFeatured === false && styles.filterChipTextActive]}>
                          Niet Featured
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sort Options */}
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Sorteren op</Text>
                    <View style={styles.sortContainer}>
                      <View style={styles.sortSelect}>
                        <Text style={styles.sortLabel}>Veld:</Text>
                        <View style={styles.sortButtons}>
                          {[
                            { key: 'created_at', label: 'Datum' },
                            { key: 'title', label: 'Titel' },
                            { key: 'total_time_minutes', label: 'Tijd' },
                            { key: 'likes_count', label: 'Likes' },
                          ].map(option => (
                            <TouchableOpacity
                              key={option.key}
                              style={[styles.sortButton, sortBy === option.key && styles.sortButtonActive]}
                              onPress={() => setSortBy(option.key as typeof sortBy)}
                            >
                              <Text style={[styles.sortButtonText, sortBy === option.key && styles.sortButtonTextActive]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={styles.sortSelect}>
                        <Text style={styles.sortLabel}>Volgorde:</Text>
                        <View style={styles.sortOrderButtons}>
                          <TouchableOpacity
                            style={[styles.sortOrderButton, sortOrder === 'desc' && styles.sortOrderButtonActive]}
                            onPress={() => setSortOrder('desc')}
                          >
                            <Ionicons name="arrow-down" size={16} color={sortOrder === 'desc' ? "#fff" : "#64748b"} />
                            <Text style={[styles.sortOrderButtonText, sortOrder === 'desc' && styles.sortOrderButtonTextActive]}>
                              Aflopend
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.sortOrderButton, sortOrder === 'asc' && styles.sortOrderButtonActive]}
                            onPress={() => setSortOrder('asc')}
                          >
                            <Ionicons name="arrow-up" size={16} color={sortOrder === 'asc' ? "#fff" : "#64748b"} />
                            <Text style={[styles.sortOrderButtonText, sortOrder === 'asc' && styles.sortOrderButtonTextActive]}>
                              Oplopend
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Clear All Filters */}
                  {(searchQuery || filterCategory || filterDifficulty || filterTags.length > 0 || filterFeatured !== null) && (
                    <TouchableOpacity
                      style={styles.clearFiltersButton}
                      onPress={() => {
                        setSearchQuery('');
                        setFilterCategory(null);
                        setFilterDifficulty(null);
                        setFilterTags([]);
                        setFilterFeatured(null);
                        setSortBy('created_at');
                        setSortOrder('desc');
                      }}
                    >
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                      <Text style={styles.clearFiltersText}>Alle filters wissen</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.recipesList}>
                {recipes.length === 0 ? (
                  <Text style={styles.emptyText}>Geen recepten gevonden</Text>
                ) : (
                  recipes.map((recipe) => (
                    <TouchableOpacity 
                      key={recipe.id} 
                      style={styles.recipeCard}
                      onPress={async () => {
                        setSelectedRecipe(recipe);
                        setEditingRecipe(recipe);
                        setRecipeDetailVisible(true);
                        setEditMode(false);
                        await loadRecipeDetails(recipe.id);
                      }}
                    >
                      {recipe.image_url && (
                        <Image 
                          source={{ uri: recipe.image_url }} 
                          style={styles.recipeCardImage}
                          resizeMode="cover"
                        />
                      )}
                      <View style={styles.recipeCardContent}>
                        <View style={styles.recipeHeader}>
                          <Text style={styles.recipeTitle}>{recipe.title}</Text>
                          {recipe.is_featured && (
                            <View style={styles.featuredBadge}>
                              <Ionicons name="star" size={14} color="#f59e0b" />
                              <Text style={styles.featuredBadgeText}>Featured</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.recipeMeta}>
                          <Text style={styles.recipeMetaText}>{recipe.difficulty}</Text>
                          <Text style={styles.recipeMetaText}>•</Text>
                          <Text style={styles.recipeMetaText}>{recipe.total_time_minutes} min</Text>
                          <Text style={styles.recipeMetaText}>•</Text>
                          <Text style={styles.recipeMetaText}>{recipe.servings} porties</Text>
                        </View>
                        <Text style={styles.recipeDescription} numberOfLines={2}>
                          {recipe.description}
                        </Text>
                        <View style={styles.recipeFooter}>
                          <Text style={styles.recipeAuthor}>Door: {recipe.author}</Text>
                          <Text style={styles.recipeDate}>
                            {new Date(recipe.created_at).toLocaleDateString('nl-NL')}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          )}

          {currentView === 'users' && (
            <View style={styles.usersContainer}>
              <Text style={styles.sectionTitle}>Alle Gebruikers ({users.length})</Text>
              <View style={styles.usersList}>
                {users.length === 0 ? (
                  <Text style={styles.emptyText}>Geen gebruikers gevonden</Text>
                ) : (
                  users.map((user) => (
                    <View key={user.id} style={styles.userCard}>
                      <View style={styles.userHeader}>
                        <View style={styles.userInfo}>
                          <Text style={styles.userEmail}>{user.email}</Text>
                          {user.is_admin && (
                            <View style={styles.adminBadge}>
                              <Text style={styles.adminBadgeText}>ADMIN</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.userDate}>
                          {new Date(user.created_at).toLocaleDateString('nl-NL')}
                        </Text>
                      </View>
                      <View style={styles.userMeta}>
                        {user.archetype && (
                          <Text style={styles.userMetaText}>Archetype: {user.archetype}</Text>
                        )}
                        {user.admin_role && (
                          <Text style={styles.userMetaText}>Rol: {user.admin_role}</Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {currentView === 'ai' && (
            <View style={styles.aiContainer}>
              <Text style={styles.sectionTitle}>AI Assistent</Text>
              <Text style={styles.sectionDescription}>
                Gebruik de AI assistent om recepten te beheren, te analyseren en te verbeteren.
                De AI heeft volledige database toegang en kan acties uitvoeren.
              </Text>
              <TouchableOpacity style={styles.aiButton} onPress={() => setChatVisible(true)}>
                <Ionicons name="sparkles" size={24} color="#fff" />
                <Text style={styles.aiButtonText}>Open AI Assistent</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentView === 'analytics' && (
            <View style={styles.analyticsContainer}>
              <Text style={styles.sectionTitle}>Platform Analytics</Text>
              <View style={styles.analyticsGrid}>
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsLabel}>Totaal Gebruikers</Text>
                  <Text style={styles.analyticsValue}>{metrics?.total_users || 0}</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsLabel}>Totaal Recepten</Text>
                  <Text style={styles.analyticsValue}>{metrics?.total_recipes || 0}</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsLabel}>Opgeslagen Recepten</Text>
                  <Text style={styles.analyticsValue}>{metrics?.total_saved_recipes || 0}</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsLabel}>Totaal Likes</Text>
                  <Text style={styles.analyticsValue}>{metrics?.total_likes || 0}</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsLabel}>Recente Logs (24u)</Text>
                  <Text style={styles.analyticsValue}>{metrics?.recent_logs_count || 0}</Text>
                </View>
                <View style={styles.analyticsCard}>
                  <Text style={styles.analyticsLabel}>Actieve Admins</Text>
                  <Text style={styles.analyticsValue}>{metrics?.active_admins || 0}</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Recipe Detail & Edit Modal */}
        <Modal
          visible={recipeDetailVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setRecipeDetailVisible(false);
            setEditMode(false);
            setSelectedRecipe(null);
          }}
        >
          <View style={styles.recipeModalOverlay}>
            <View style={styles.recipeModal}>
              {selectedRecipe && (
                <>
                  <View style={styles.recipeModalHeader}>
                    <Text style={styles.recipeModalTitle}>
                      {editMode ? 'Recept Bewerken' : selectedRecipe.title}
                    </Text>
                    <View style={styles.recipeModalHeaderActions}>
                      {!editMode && (
                        <TouchableOpacity
                          style={styles.recipeModalActionButton}
                          onPress={() => setEditMode(true)}
                        >
                          <Ionicons name="create-outline" size={20} color="#047857" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.recipeModalActionButton}
                        onPress={() => {
                          setRecipeDetailVisible(false);
                          setEditMode(false);
                          setSelectedRecipe(null);
                        }}
                      >
                        <Ionicons name="close" size={24} color="#0f172a" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView 
                    showsVerticalScrollIndicator={false} 
                    style={styles.recipeModalScroll}
                    contentContainerStyle={styles.recipeModalContent}
                  >
                    {editMode ? (
                      // Edit Form
                      <View style={styles.editForm}>
                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Titel *</Text>
                          <TextInput
                            style={styles.formInput}
                            value={editingRecipe.title || ''}
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, title: text })}
                            placeholder="Recept naam"
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Beschrijving</Text>
                          <TextInput
                            style={[styles.formInput, styles.formTextArea]}
                            value={editingRecipe.description || ''}
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, description: text })}
                            placeholder="Korte beschrijving van het recept"
                            multiline
                            numberOfLines={3}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Afbeelding URL</Text>
                          <TextInput
                            style={styles.formInput}
                            value={editingRecipe.image_url || ''}
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, image_url: text })}
                            placeholder="https://example.com/image.jpg"
                          />
                        </View>

                        <View style={styles.formRow}>
                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.formLabel}>Voorbereiding (min)</Text>
                            <TextInput
                              style={styles.formInput}
                              value={editingRecipe.prep_time_minutes?.toString() || ''}
                              onChangeText={(text) => setEditingRecipe({ ...editingRecipe, prep_time_minutes: parseInt(text) || 0 })}
                              keyboardType="numeric"
                              placeholder="15"
                            />
                          </View>
                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.formLabel}>Bereiding (min)</Text>
                            <TextInput
                              style={styles.formInput}
                              value={editingRecipe.cook_time_minutes?.toString() || ''}
                              onChangeText={(text) => setEditingRecipe({ ...editingRecipe, cook_time_minutes: parseInt(text) || 0 })}
                              keyboardType="numeric"
                              placeholder="30"
                            />
                          </View>
                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.formLabel}>Totaal (min) *</Text>
                            <TextInput
                              style={styles.formInput}
                              value={editingRecipe.total_time_minutes?.toString() || ''}
                              onChangeText={(text) => setEditingRecipe({ ...editingRecipe, total_time_minutes: parseInt(text) || 0 })}
                              keyboardType="numeric"
                              placeholder="45"
                            />
                          </View>
                        </View>

                        <View style={styles.formRow}>
                          <View style={[styles.formGroup, { flex: 1 }]}>
                            <Text style={styles.formLabel}>Moeilijkheidsgraad *</Text>
                            <View style={styles.difficultyButtons}>
                              {['Makkelijk', 'Gemiddeld', 'Moeilijk'].map((diff) => (
                                <TouchableOpacity
                                  key={diff}
                                  style={[
                                    styles.difficultyButton,
                                    editingRecipe.difficulty === diff && styles.difficultyButtonActive,
                                  ]}
                                  onPress={() => setEditingRecipe({ ...editingRecipe, difficulty: diff })}
                                >
                                  <Text
                                    style={[
                                      styles.difficultyButtonText,
                                      editingRecipe.difficulty === diff && styles.difficultyButtonTextActive,
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
                              value={editingRecipe.servings?.toString() || ''}
                              onChangeText={(text) => setEditingRecipe({ ...editingRecipe, servings: parseInt(text) || 0 })}
                              keyboardType="numeric"
                              placeholder="4"
                            />
                          </View>
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Auteur</Text>
                          <TextInput
                            style={styles.formInput}
                            value={editingRecipe.author || ''}
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, author: text })}
                            placeholder="Auteur naam"
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Ingrediënten (één per regel)</Text>
                          <TextInput
                            style={[styles.formInput, styles.formTextArea]}
                            value={
                              Array.isArray(editingRecipe.ingredients)
                                ? editingRecipe.ingredients.map((ing: any) =>
                                    typeof ing === 'string'
                                      ? ing
                                      : `${ing.quantity || ''} ${ing.unit || ''} ${ing.name || ''}`.trim()
                                  ).join('\n')
                                : editingRecipe.ingredients?.toString() || ''
                            }
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, ingredients: text })}
                            placeholder="200g pasta&#10;2 teentjes knoflook&#10;1 el olijfolie"
                            multiline
                            numberOfLines={8}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Bereiding (één stap per regel)</Text>
                          <TextInput
                            style={[styles.formInput, styles.formTextArea]}
                            value={
                              Array.isArray(editingRecipe.instructions)
                                ? editingRecipe.instructions.map((step: any) =>
                                    typeof step === 'string' ? step : step.instruction || ''
                                  ).join('\n')
                                : editingRecipe.instructions?.toString() || ''
                            }
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, instructions: text })}
                            placeholder="1. Kook de pasta volgens de verpakking&#10;2. Bak de knoflook in olijfolie&#10;3. Meng alles door elkaar"
                            multiline
                            numberOfLines={10}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Tags (komma gescheiden)</Text>
                          <TextInput
                            style={styles.formInput}
                            value={Array.isArray(editingRecipe.tags) ? editingRecipe.tags.join(', ') : ''}
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, tags: text.split(',').map(t => t.trim()).filter(t => t) })}
                            placeholder="Italiaans, Vegan, Comfort Food"
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Categorie</Text>
                          <TextInput
                            style={styles.formInput}
                            value={editingRecipe.category || ''}
                            onChangeText={(text) => setEditingRecipe({ ...editingRecipe, category: text })}
                            placeholder="Italiaans"
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <Text style={styles.formLabel}>Voedingswaarden (JSON)</Text>
                          <TextInput
                            style={[styles.formInput, styles.formTextArea]}
                            value={
                              typeof editingRecipe.nutrition === 'object'
                                ? JSON.stringify(editingRecipe.nutrition, null, 2)
                                : editingRecipe.nutrition?.toString() || ''
                            }
                            onChangeText={(text) => {
                              try {
                                setEditingRecipe({ ...editingRecipe, nutrition: JSON.parse(text) });
                              } catch {
                                setEditingRecipe({ ...editingRecipe, nutrition: text });
                              }
                            }}
                            placeholder='{"calories": 500, "protein": 25, "carbs": 60, "fat": 15}'
                            multiline
                            numberOfLines={6}
                          />
                        </View>

                        <View style={styles.formGroup}>
                          <TouchableOpacity
                            style={[
                              styles.checkboxRow,
                              editingRecipe.is_featured && styles.checkboxRowActive,
                            ]}
                            onPress={() => setEditingRecipe({ ...editingRecipe, is_featured: !editingRecipe.is_featured })}
                          >
                            <Ionicons
                              name={editingRecipe.is_featured ? 'star' : 'star-outline'}
                              size={20}
                              color={editingRecipe.is_featured ? '#f59e0b' : '#64748b'}
                            />
                            <Text style={styles.checkboxLabel}>Featured recept</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.editFormActions}>
                          <TouchableOpacity
                            style={styles.cancelEditButton}
                            onPress={() => {
                              setEditMode(false);
                              setEditingRecipe(selectedRecipe);
                            }}
                          >
                            <Text style={styles.cancelEditButtonText}>Annuleren</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.saveEditButton}
                            onPress={handleSaveRecipe}
                            disabled={savingRecipe}
                          >
                            {savingRecipe ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.saveEditButtonText}>Opslaan</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      // Detail View
                      <>
                        {selectedRecipe.image_url && (
                          <Image
                            source={{ uri: selectedRecipe.image_url }}
                            style={styles.recipeDetailImage}
                            resizeMode="cover"
                          />
                        )}
                        <View style={styles.recipeDetailContent}>
                          <View style={styles.recipeDetailMeta}>
                            <View style={styles.recipeDetailMetaRow}>
                              <View style={styles.recipeDetailMetaPill}>
                                <Ionicons name="time-outline" size={16} color="#047857" />
                                <Text style={styles.recipeDetailMetaText}>
                                  {selectedRecipe.total_time_minutes} min
                                </Text>
                              </View>
                              <View style={styles.recipeDetailMetaPill}>
                                <Ionicons name="restaurant-outline" size={16} color="#047857" />
                                <Text style={styles.recipeDetailMetaText}>
                                  {selectedRecipe.difficulty}
                                </Text>
                              </View>
                              {selectedRecipe.servings && (
                                <View style={styles.recipeDetailMetaPill}>
                                  <Ionicons name="people-outline" size={16} color="#047857" />
                                  <Text style={styles.recipeDetailMetaText}>
                                    {selectedRecipe.servings} porties
                                  </Text>
                                </View>
                              )}
                              {selectedRecipe.is_featured && (
                                <View style={[styles.recipeDetailMetaPill, styles.featuredPill]}>
                                  <Ionicons name="star" size={16} color="#f59e0b" />
                                  <Text style={[styles.recipeDetailMetaText, styles.featuredText]}>
                                    Featured
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {selectedRecipe.description && (
                            <View style={styles.recipeDetailSection}>
                              <Text style={styles.recipeDetailSectionTitle}>Beschrijving</Text>
                              <Text style={styles.recipeDetailSectionText}>
                                {selectedRecipe.description}
                              </Text>
                            </View>
                          )}

                          {selectedRecipe.ingredients && Array.isArray(selectedRecipe.ingredients) && selectedRecipe.ingredients.length > 0 && (
                            <View style={styles.recipeDetailSection}>
                              <Text style={styles.recipeDetailSectionTitle}>Ingrediënten</Text>
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

                          {selectedRecipe.instructions && Array.isArray(selectedRecipe.instructions) && selectedRecipe.instructions.length > 0 && (
                            <View style={styles.recipeDetailSection}>
                              <Text style={styles.recipeDetailSectionTitle}>Bereiding</Text>
                              {selectedRecipe.instructions.map((step: any, idx: number) => (
                                <View key={idx} style={styles.instructionRow}>
                                  <View style={styles.instructionNumber}>
                                    <Text style={styles.instructionNumberText}>
                                      {typeof step === 'object' ? (step.step || idx + 1) : idx + 1}
                                    </Text>
                                  </View>
                                  <Text style={styles.instructionText}>
                                    {typeof step === 'string' ? step : (step.instruction || '')}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {selectedRecipe.nutrition && (
                            <View style={styles.recipeDetailSection}>
                              <Text style={styles.recipeDetailSectionTitle}>Voedingswaarden</Text>
                              <Text style={styles.recipeDetailSectionText}>
                                {JSON.stringify(selectedRecipe.nutrition, null, 2)}
                              </Text>
                            </View>
                          )}

                          {selectedRecipe.tags && selectedRecipe.tags.length > 0 && (
                            <View style={styles.recipeDetailSection}>
                              <Text style={styles.recipeDetailSectionTitle}>Tags</Text>
                              <View style={styles.tagsContainer}>
                                {selectedRecipe.tags.map((tag, idx) => (
                                  <View key={idx} style={styles.tagChip}>
                                    <Text style={styles.tagChipText}>{tag}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          )}

                          <View style={styles.recipeDetailFooter}>
                            <Text style={styles.recipeDetailFooterText}>
                              Door: {selectedRecipe.author}
                            </Text>
                            <Text style={styles.recipeDetailFooterText}>
                              Gemaakt: {new Date(selectedRecipe.created_at).toLocaleDateString('nl-NL')}
                            </Text>
                            {selectedRecipe.updated_at && (
                              <Text style={styles.recipeDetailFooterText}>
                                Bijgewerkt: {new Date(selectedRecipe.updated_at).toLocaleDateString('nl-NL')}
                              </Text>
                            )}
                          </View>
                        </View>
                      </>
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* AI Chat Modal */}
        <Modal
          visible={chatVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setChatVisible(false)}
        >
          <View style={styles.chatModalOverlay}>
            <View style={styles.chatModal}>
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <Ionicons name="sparkles" size={24} color="#047857" />
                  <Text style={styles.chatTitle}>STOCKPIT AI Assistent</Text>
                </View>
                <TouchableOpacity onPress={() => setChatVisible(false)}>
                  <Ionicons name="close" size={24} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
                {chatMessages.length === 0 && (
                  <View style={styles.welcomeMessage}>
                    <Text style={styles.welcomeText}>
                      Welkom bij de STOCKPIT Admin AI Assistent!{'\n\n'}
                      Ik kan je helpen met:
                      {'\n'}• Recepten toevoegen, bewerken en verwijderen
                      {'\n'}• Recepten analyseren en verbeteren
                      {'\n'}• Database queries uitvoeren
                      {'\n'}• Platform statistieken bekijken
                      {'\n'}• En meer...
                    </Text>
                  </View>
                )}
                {chatMessages.map((msg, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.chatMessage,
                      msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
                    ]}
                  >
                    <Text style={styles.chatMessageText}>{msg.content}</Text>
                  </View>
                ))}
                {chatLoading && (
                  <View style={[styles.chatMessage, styles.assistantMessage]}>
                    <ActivityIndicator size="small" color="#047857" />
                  </View>
                )}
              </ScrollView>

              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Vraag iets aan de AI..."
                  multiline
                  onSubmitEditing={handleAdminChat}
                />
                <TouchableOpacity
                  style={styles.chatSendButton}
                  onPress={handleAdminChat}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Bottom Navigation */}
        <SafeAreaView edges={['bottom']} style={styles.bottomNavSafeArea}>
          <View style={styles.bottomNav}>
            <Pressable
              style={styles.bottomNavTab}
              onPress={() => setCurrentView('overview')}
            >
              <Ionicons
                name={currentView === 'overview' ? 'grid' : 'grid-outline'}
                size={22}
                color={currentView === 'overview' ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.bottomNavLabel, currentView === 'overview' && styles.bottomNavLabelActive]}>
                Overzicht
              </Text>
            </Pressable>
            <Pressable
              style={styles.bottomNavTab}
              onPress={() => setCurrentView('recipes')}
            >
              <Ionicons
                name={currentView === 'recipes' ? 'restaurant' : 'restaurant-outline'}
                size={22}
                color={currentView === 'recipes' ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.bottomNavLabel, currentView === 'recipes' && styles.bottomNavLabelActive]}>
                Recepten
              </Text>
            </Pressable>
            <Pressable
              style={styles.bottomNavTab}
              onPress={() => setCurrentView('users')}
            >
              <Ionicons
                name={currentView === 'users' ? 'people' : 'people-outline'}
                size={22}
                color={currentView === 'users' ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.bottomNavLabel, currentView === 'users' && styles.bottomNavLabelActive]}>
                Gebruikers
              </Text>
            </Pressable>
            <Pressable
              style={styles.bottomNavTab}
              onPress={() => setCurrentView('ai')}
            >
              <Ionicons
                name={currentView === 'ai' ? 'sparkles' : 'sparkles-outline'}
                size={22}
                color={currentView === 'ai' ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.bottomNavLabel, currentView === 'ai' && styles.bottomNavLabelActive]}>
                AI
              </Text>
            </Pressable>
            <Pressable
              style={styles.bottomNavTab}
              onPress={() => setCurrentView('analytics')}
            >
              <Ionicons
                name={currentView === 'analytics' ? 'analytics' : 'analytics-outline'}
                size={22}
                color={currentView === 'analytics' ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.bottomNavLabel, currentView === 'analytics' && styles.bottomNavLabelActive]}>
                Analytics
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#047857',
  },
  header: {
    backgroundColor: '#065f46',
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
  },
  brandLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavSafeArea: {
    backgroundColor: '#fff',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
  },
  bottomNavTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    flex: 1,
    paddingVertical: 4,
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  bottomNavLabelActive: {
    color: '#047857',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  overviewContainer: {
    gap: 32,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: isMobile ? '100%' : '45%',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#047857',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  metricGradient: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  filterToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  clearSearchButton: {
    padding: 4,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    gap: 20,
  },
  filterGroup: {
    gap: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  filterChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  sortContainer: {
    gap: 16,
  },
  sortSelect: {
    gap: 8,
  },
  sortLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  sortButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  sortButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  sortOrderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  sortOrderButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  sortOrderButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  sortOrderButtonTextActive: {
    color: '#fff',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#065f46',
  },
  sectionDescription: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  actionCard: {
    flex: 1,
    minWidth: isMobile ? '100%' : '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionDescription: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  logsContainer: {
    gap: 12,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  logTime: {
    fontSize: 12,
    color: '#64748b',
  },
  logResource: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    padding: 40,
  },
  recipesContainer: {
    gap: 24,
  },
  recipesList: {
    gap: 16,
  },
  recipeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  recipeHeader: {
    marginBottom: 8,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  recipeMetaText: {
    fontSize: 13,
    color: '#64748b',
  },
  recipeDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  recipeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeAuthor: {
    fontSize: 13,
    color: '#64748b',
  },
  recipeDate: {
    fontSize: 13,
    color: '#64748b',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  usersContainer: {
    gap: 24,
  },
  usersList: {
    gap: 16,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  adminBadge: {
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userDate: {
    fontSize: 12,
    color: '#64748b',
  },
  userMeta: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  userMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  aiContainer: {
    gap: 24,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#047857',
    padding: 20,
    borderRadius: 16,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  analyticsContainer: {
    gap: 24,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  analyticsCard: {
    flex: 1,
    minWidth: isMobile ? '100%' : '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
  },
  analyticsLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  analyticsValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#047857',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    gap: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  loginHeader: {
    alignItems: 'center',
    gap: 8,
  },
  loginLogo: {
    width: 64,
    height: 64,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -1,
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  loginButton: {
    backgroundColor: '#047857',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
  },
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatModal: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    gap: 12,
    paddingBottom: 20,
  },
  welcomeMessage: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
  },
  welcomeText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
  },
  chatMessage: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#047857',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#f0fdf4',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
  },
  chatMessageText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  chatInputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: '#f8fafc',
  },
  chatSendButton: {
    backgroundColor: '#047857',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeCardImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  recipeCardContent: {
    padding: 20,
  },
  featuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#f59e0b',
  },
  recipeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  recipeModal: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  recipeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  recipeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  recipeModalHeaderActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  recipeModalActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeModalScroll: {
    flex: 1,
  },
  recipeModalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  recipeDetailImage: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    marginBottom: 20,
  },
  recipeDetailContent: {
    gap: 24,
  },
  recipeDetailMeta: {
    marginBottom: 8,
  },
  recipeDetailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recipeDetailMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  featuredPill: {
    backgroundColor: '#fef3c7',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  recipeDetailMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  featuredText: {
    color: '#f59e0b',
  },
  recipeDetailSection: {
    gap: 12,
  },
  recipeDetailSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  recipeDetailSectionText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ingredientBullet: {
    fontSize: 16,
    color: '#047857',
    fontWeight: '700',
  },
  ingredientText: {
    fontSize: 15,
    color: '#475569',
    flex: 1,
    lineHeight: 22,
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
    flexShrink: 0,
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  instructionText: {
    fontSize: 15,
    color: '#475569',
    flex: 1,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  recipeDetailFooter: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
    gap: 4,
  },
  recipeDetailFooterText: {
    fontSize: 12,
    color: '#64748b',
  },
  editForm: {
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  difficultyButtonActive: {
    borderColor: '#047857',
    backgroundColor: '#f0fdf4',
  },
  difficultyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  difficultyButtonTextActive: {
    color: '#047857',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#fff',
  },
  checkboxRowActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7',
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  editFormActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelEditButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  cancelEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  saveEditButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#047857',
    alignItems: 'center',
  },
  saveEditButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

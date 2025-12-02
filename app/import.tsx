// Recipe Import Screen
// Handles Web Share Target API for importing recipes from external sources

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { HeaderAvatar } from '../components/navigation/HeaderAvatar';
import { ContextualWeatherHeader } from '../components/recipes/ContextualWeatherHeader';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { parseRecipe, ParsedRecipe } from '../services/recipeParser';
import { navigateToRoute } from '../utils/navigation';

const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

export default function ImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [sourceText, setSourceText] = useState<string>('');
  const [editingRecipe, setEditingRecipe] = useState<ParsedRecipe | null>(null);

  useEffect(() => {
    // Get shared content from URL params (Web Share Target API)
    const url = params.url as string;
    const text = params.text as string;
    const title = params.title as string;

    if (url || text || title) {
      const source = url || text || title || '';
      setSourceUrl(url || '');
      setSourceText(text || title || '');
      loadRecipe(source, !!url);
    } else {
      setLoading(false);
    }
  }, [params]);

  const loadRecipe = async (source: string, isUrl: boolean) => {
    setLoading(true);
    try {
      const parsed = await parseRecipe(source, isUrl);
      setRecipe(parsed);
      setEditingRecipe(parsed);
    } catch (error) {
      console.error('[Import] Error loading recipe:', error);
      Alert.alert('Fout', 'Kon recept niet laden. Probeer het opnieuw.');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !editingRecipe) return;

    setSaving(true);
    try {
      // Convert ingredients to JSONB format
      const ingredientsJson = editingRecipe.ingredients.map(ing => ({
        name: ing.name,
        quantity: ing.quantity || '',
        unit: ing.unit || '',
      }));

      // Convert instructions to JSONB format
      const instructionsJson = editingRecipe.instructions.map(inst => ({
        step: inst.step,
        instruction: inst.instruction,
      }));

      // Call create_recipe function
      const { data, error } = await supabase.rpc('create_recipe', {
        p_title: editingRecipe.title,
        p_description: editingRecipe.description || null,
        p_image_url: editingRecipe.imageUrl || null,
        p_prep_time_minutes: editingRecipe.prepTime || null,
        p_cook_time_minutes: editingRecipe.cookTime || null,
        p_total_time_minutes: editingRecipe.totalTime || 30,
        p_difficulty: editingRecipe.difficulty || 'Gemiddeld',
        p_servings: editingRecipe.servings || 4,
        p_ingredients: ingredientsJson,
        p_instructions: instructionsJson,
        p_tags: [],
        p_category: 'Geïmporteerd',
        p_author: profile?.email || user.email || 'Gebruiker',
      });

      if (error) throw error;

      Alert.alert('Succes', 'Recept is opgeslagen!', [
        {
          text: 'OK',
          onPress: () => navigateToRoute(router, '/recipes'),
        },
      ]);
    } catch (error: any) {
      console.error('[Import] Error saving recipe:', error);
      Alert.alert('Fout', error.message || 'Kon recept niet opslaan.');
    } finally {
      setSaving(false);
    }
  };

  const updateIngredient = (index: number, field: 'name' | 'quantity' | 'unit', value: string) => {
    if (!editingRecipe) return;
    const updated = { ...editingRecipe };
    updated.ingredients[index] = {
      ...updated.ingredients[index],
      [field]: value,
    };
    setEditingRecipe(updated);
  };

  const updateInstruction = (index: number, value: string) => {
    if (!editingRecipe) return;
    const updated = { ...editingRecipe };
    updated.instructions[index] = {
      ...updated.instructions[index],
      instruction: value,
    };
    setEditingRecipe(updated);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <SafeAreaViewComponent style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text style={styles.brandLabel}>STOCKPIT</Text>
            </View>
          </View>
          <View style={styles.authPrompt}>
            <Text style={styles.authPromptTitle}>Log in om recepten te importeren</Text>
            <Text style={styles.authPromptText}>
              Log in om recepten van externe websites te importeren en op te slaan.
            </Text>
            <TouchableOpacity
              style={styles.authButton}
              onPress={() => navigateToRoute(router, '/profile')}
            >
              <Text style={styles.authButtonText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaViewComponent>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaViewComponent
        style={styles.safeArea}
        {...(Platform.OS === 'web' && {
          className: 'safe-area-top',
        })}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brandLabel}>STOCKPIT</Text>
          </View>
          <View style={styles.headerRight}>
            {user && <ContextualWeatherHeader />}
            <View style={styles.headerIcons}>
              <HeaderAvatar
                userId={user.id}
                userEmail={user.email}
                avatarUrl={profile?.avatar_url}
                showNotificationBadge={true}
              />
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#047857" />
              <Text style={styles.loadingText}>Recept wordt geladen...</Text>
            </View>
          ) : !editingRecipe ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="share-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Geen recept gedeeld</Text>
              <Text style={styles.emptyText}>
                Deel een recept vanuit je browser om het hier te importeren.
              </Text>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigateToRoute(router, '/recipes')}
              >
                <Text style={styles.backButtonText}>Terug naar Recepten</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Recipe Header */}
              <View style={styles.recipeHeader}>
                <Text style={styles.recipeTitle}>{editingRecipe.title}</Text>
                {editingRecipe.description && (
                  <Text style={styles.recipeDescription}>{editingRecipe.description}</Text>
                )}
                {editingRecipe.imageUrl && (
                  <Image source={{ uri: editingRecipe.imageUrl }} style={styles.recipeImage} />
                )}
              </View>

              {/* Recipe Meta */}
              <View style={styles.recipeMeta}>
                {editingRecipe.totalTime && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={16} color="#64748b" />
                    <Text style={styles.metaText}>{editingRecipe.totalTime} min</Text>
                  </View>
                )}
                {editingRecipe.servings && (
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={16} color="#64748b" />
                    <Text style={styles.metaText}>{editingRecipe.servings} personen</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Ionicons name="flag-outline" size={16} color="#64748b" />
                  <Text style={styles.metaText}>{editingRecipe.difficulty}</Text>
                </View>
              </View>

              {/* Ingredients */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ingrediënten</Text>
                {editingRecipe.ingredients.map((ing, index) => (
                  <View key={index} style={styles.ingredientRow}>
                    <View style={styles.ingredientInputs}>
                      {ing.quantity && (
                        <TextInput
                          style={[styles.input, styles.quantityInput]}
                          value={ing.quantity}
                          onChangeText={(value) => updateIngredient(index, 'quantity', value)}
                          placeholder="Hoeveelheid"
                          placeholderTextColor="#94a3b8"
                        />
                      )}
                      {ing.unit && (
                        <TextInput
                          style={[styles.input, styles.unitInput]}
                          value={ing.unit}
                          onChangeText={(value) => updateIngredient(index, 'unit', value)}
                          placeholder="Eenheid"
                          placeholderTextColor="#94a3b8"
                        />
                      )}
                      <TextInput
                        style={[styles.input, styles.nameInput]}
                        value={ing.name}
                        onChangeText={(value) => updateIngredient(index, 'name', value)}
                        placeholder="Ingrediënt"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Instructions */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bereiding</Text>
                {editingRecipe.instructions.map((inst, index) => (
                  <View key={index} style={styles.instructionRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{inst.step}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.instructionInput]}
                      value={inst.instruction}
                      onChangeText={(value) => updateInstruction(index, value)}
                      placeholder="Bereidingsstap"
                      placeholderTextColor="#94a3b8"
                      multiline
                    />
                  </View>
                ))}
              </View>

              {/* Source Info */}
              {(sourceUrl || sourceText) && (
                <View style={styles.sourceSection}>
                  <Text style={styles.sourceLabel}>Bron:</Text>
                  {sourceUrl ? (
                    <Text style={styles.sourceText} numberOfLines={1}>
                      {sourceUrl}
                    </Text>
                  ) : (
                    <Text style={styles.sourceText} numberOfLines={2}>
                      {sourceText}
                    </Text>
                  )}
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Recept Opslaan</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <GlassDock />
      </SafeAreaViewComponent>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  backButton: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  authPromptTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  authPromptText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: '#047857',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  recipeHeader: {
    marginBottom: 20,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
    marginBottom: 16,
  },
  recipeImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  recipeMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  ingredientRow: {
    marginBottom: 12,
  },
  ingredientInputs: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
  },
  quantityInput: {
    width: 80,
  },
  unitInput: {
    width: 100,
  },
  nameInput: {
    flex: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  instructionInput: {
    flex: 1,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  sourceSection: {
    marginTop: 8,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sourceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sourceText: {
    fontSize: 14,
    color: '#0f172a',
  },
  saveButton: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});


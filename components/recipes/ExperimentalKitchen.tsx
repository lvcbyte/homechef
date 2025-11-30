import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import {
  generateExperimentalRecipe,
  ExperimentalRecipeOptions,
  type GeneratedRecipe,
} from '../../services/ai';

interface ExperimentalKitchenProps {
  userId: string;
  profile: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] };
  onRecipeCreated?: (recipe: GeneratedRecipe) => void;
}

export function ExperimentalKitchen({ userId, profile, onRecipeCreated }: ExperimentalKitchenProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState<'new' | 'revived' | 'variation'>('new');
  const [options, setOptions] = useState<ExperimentalRecipeOptions>({
    sourceType: 'new',
    theme: '',
    cuisine: '',
    ingredients: [],
    dietaryRestrictions: profile.dietary_restrictions as string[] || [],
    notes: '',
  });
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [ingredientInput, setIngredientInput] = useState('');

  const handleGenerateRecipe = async () => {
    setLoading(true);
    try {
      const experimentalOptions: ExperimentalRecipeOptions = {
        ...options,
        sourceType,
        ingredients: ingredientInput
          ? ingredientInput.split(',').map((i) => i.trim()).filter(Boolean)
          : undefined,
      };

      const recipe = await generateExperimentalRecipe(profile, experimentalOptions);
      
      if (recipe) {
        setGeneratedRecipe(recipe);
        if (onRecipeCreated) {
          onRecipeCreated(recipe);
        }
      } else {
        Alert.alert('Fout', 'Kon geen recept genereren. Probeer het opnieuw.');
      }
    } catch (error: any) {
      console.error('Error generating experimental recipe:', error);
      Alert.alert('Fout', `Kon geen recept genereren: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!generatedRecipe) return;

    try {
      const { error } = await supabase.from('experimental_recipes').insert({
        user_id: userId,
        title: generatedRecipe.name,
        description: generatedRecipe.description || null,
        status: 'draft',
        source_type: sourceType,
        ingredients: generatedRecipe.ingredients || [],
        instructions: generatedRecipe.steps || [],
        prep_time_minutes: generatedRecipe.prepTime || null,
        cook_time_minutes: generatedRecipe.cookTime || null,
        total_time_minutes: generatedRecipe.totalTime || 30,
        difficulty: generatedRecipe.difficulty || 'Gemiddeld',
        servings: generatedRecipe.servings || 4,
        nutrition: generatedRecipe.macros || null,
        tags: generatedRecipe.tags || [],
        image_url: generatedRecipe.image_url || null,
        notes: {
          theme: options.theme,
          cuisine: options.cuisine,
          customNotes: options.notes,
        },
      });

      if (error) throw error;

      Alert.alert('Opgeslagen!', 'Het recept is opgeslagen in Chef\'s Lab.');
      setVisible(false);
      setGeneratedRecipe(null);
    } catch (error: any) {
      console.error('Error saving experimental recipe:', error);
      Alert.alert('Fout', `Kon recept niet opslaan: ${error.message}`);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="flask" size={20} color="#047857" />
        <Text style={styles.triggerButtonText}>Chef's Lab</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Ionicons name="flask" size={24} color="#047857" />
              <Text style={styles.headerTitle}>Chef's Lab</Text>
            </View>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!generatedRecipe ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Creëer of Herstel Recepten</Text>
                  <Text style={styles.sectionDescription}>
                    Experimenteer met nieuwe combinaties, herstel oude favorieten, of maak creatieve variaties op bestaande recepten.
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Type</Text>
                  <View style={styles.typeRow}>
                    {[
                      { type: 'new' as const, label: 'Nieuw Recept', icon: 'add-circle' },
                      { type: 'revived' as const, label: 'Herstel Oud', icon: 'refresh' },
                      { type: 'variation' as const, label: 'Variatie', icon: 'shuffle' },
                    ].map(({ type, label, icon }) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          sourceType === type && styles.typeButtonActive,
                        ]}
                        onPress={() => {
                          setSourceType(type);
                          setOptions({ ...options, sourceType: type });
                        }}
                      >
                        <Ionicons
                          name={icon as any}
                          size={20}
                          color={sourceType === type ? '#fff' : '#047857'}
                        />
                        <Text
                          style={[
                            styles.typeButtonText,
                            sourceType === type && styles.typeButtonTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Thema (optioneel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Bijv. Comfort food, Gezond, Feestelijk..."
                    value={options.theme}
                    onChangeText={(text) => setOptions({ ...options, theme: text })}
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Keuken (optioneel)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Bijv. Italiaans, Aziatisch, Mediterraan..."
                    value={options.cuisine}
                    onChangeText={(text) => setOptions({ ...options, cuisine: text })}
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Ingrediënten (optioneel, komma gescheiden)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Bijv. tomaat, knoflook, basilicum..."
                    value={ingredientInput}
                    onChangeText={setIngredientInput}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Notities (optioneel)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Extra instructies of ideeën..."
                    value={options.notes}
                    onChangeText={(text) => setOptions({ ...options, notes: text })}
                    multiline
                    numberOfLines={4}
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.generateButton, loading && styles.generateButtonDisabled]}
                  onPress={handleGenerateRecipe}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="flask" size={20} color="#fff" />
                      <Text style={styles.generateButtonText}>Recept Genereren</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.recipePreview}>
                  <Text style={styles.recipeTitle}>{generatedRecipe.name}</Text>
                  {generatedRecipe.description && (
                    <Text style={styles.recipeDescription}>{generatedRecipe.description}</Text>
                  )}
                  <View style={styles.recipeMeta}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{generatedRecipe.totalTime} min</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{generatedRecipe.difficulty}</Text>
                    </View>
                    {generatedRecipe.servings && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaText}>{generatedRecipe.servings} pers.</Text>
                      </View>
                    )}
                  </View>
                </View>

                {generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0 && (
                  <View style={styles.ingredientsSection}>
                    <Text style={styles.sectionTitle}>Ingrediënten</Text>
                    {generatedRecipe.ingredients.map((ing, index) => (
                      <View key={index} style={styles.ingredientItem}>
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

                {generatedRecipe.steps && generatedRecipe.steps.length > 0 && (
                  <View style={styles.instructionsSection}>
                    <Text style={styles.sectionTitle}>Bereiding</Text>
                    {generatedRecipe.steps.map((step, index) => (
                      <View key={index} style={styles.instructionItem}>
                        <View style={styles.instructionNumber}>
                          <Text style={styles.instructionNumberText}>{index + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveRecipe}
                  >
                    <Ionicons name="bookmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Opslaan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={() => setGeneratedRecipe(null)}
                  >
                    <Ionicons name="refresh" size={20} color="#047857" />
                    <Text style={styles.regenerateButtonText}>Nieuw Recept</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
  },
  triggerButtonText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  typeButtonText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 13,
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  recipePreview: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaText: {
    color: '#065f46',
    fontWeight: '600',
    fontSize: 13,
  },
  ingredientsSection: {
    marginBottom: 20,
  },
  ingredientItem: {
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
  instructionsSection: {
    marginBottom: 20,
  },
  instructionItem: {
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  regenerateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    paddingVertical: 14,
  },
  regenerateButtonText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 16,
  },
});


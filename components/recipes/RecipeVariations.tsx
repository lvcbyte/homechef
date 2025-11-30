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
  generateRecipeVariation,
  RecipeVariationOptions,
  translateAndLocalizeRecipe,
  type GeneratedRecipe,
} from '../../services/ai';

interface RecipeVariationsProps {
  recipe: {
    id: string;
    title: string;
    description?: string;
    ingredients: any[];
    instructions: any[];
    prep_time_minutes?: number;
    cook_time_minutes?: number;
    total_time_minutes?: number;
    difficulty?: string;
    servings?: number;
    nutrition?: any;
    tags?: string[];
    category?: string;
  };
  onVariationCreated?: (variation: GeneratedRecipe) => void;
  onClose?: () => void;
}

export function RecipeVariations({ recipe, onVariationCreated, onClose }: RecipeVariationsProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variationType, setVariationType] = useState<RecipeVariationOptions['variationType']>('seasonal');
  const [customOptions, setCustomOptions] = useState({
    localRegion: '',
    trendName: '',
    season: 'spring' as 'spring' | 'summer' | 'autumn' | 'winter',
    dietaryType: [] as string[],
    allergies: [] as string[],
    customInstructions: '',
    language: 'nl',
    unitsSystem: 'metric' as 'metric' | 'imperial',
  });
  const [generatedVariation, setGeneratedVariation] = useState<GeneratedRecipe | null>(null);

  const handleGenerateVariation = async () => {
    setLoading(true);
    try {
      const options: RecipeVariationOptions = {
        variationType: variationType,
        ...(variationType === 'local_flavor' && { localRegion: customOptions.localRegion || 'België/Nederland' }),
        ...(variationType === 'trend' && { trendName: customOptions.trendName || 'huidige food trends' }),
        ...(variationType === 'seasonal' && { season: customOptions.season }),
        ...(variationType === 'dietary' && { dietaryType: customOptions.dietaryType }),
        ...(variationType === 'allergy' && { allergies: customOptions.allergies }),
        ...(variationType === 'custom' && { customInstructions: customOptions.customInstructions }),
        language: customOptions.language,
        unitsSystem: customOptions.unitsSystem,
      };

      const variation = await generateRecipeVariation(recipe, options);
      
      if (variation) {
        setGeneratedVariation(variation);
        if (onVariationCreated) {
          onVariationCreated(variation);
        }
      } else {
        Alert.alert('Fout', 'Kon geen variatie genereren. Probeer het opnieuw.');
      }
    } catch (error: any) {
      console.error('Error generating variation:', error);
      Alert.alert('Fout', `Kon geen variatie genereren: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVariation = async () => {
    if (!generatedVariation) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Inloggen vereist', 'Je moet ingelogd zijn om variaties op te slaan.');
        return;
      }

      const { error } = await supabase.from('recipe_variations').insert({
        base_recipe_id: recipe.id,
        user_id: user.id,
        title: generatedVariation.name,
        description: generatedVariation.description || null,
        variation_type: variationType,
        variation_details: {
          localRegion: customOptions.localRegion,
          trendName: customOptions.trendName,
          season: customOptions.season,
          dietaryType: customOptions.dietaryType,
          allergies: customOptions.allergies,
          customInstructions: customOptions.customInstructions,
          language: customOptions.language,
          unitsSystem: customOptions.unitsSystem,
        },
        ingredients: generatedVariation.ingredients || [],
        instructions: generatedVariation.steps || [],
        prep_time_minutes: generatedVariation.prepTime || null,
        cook_time_minutes: generatedVariation.cookTime || null,
        total_time_minutes: generatedVariation.totalTime || 30,
        difficulty: generatedVariation.difficulty || 'Gemiddeld',
        servings: generatedVariation.servings || 4,
        nutrition: generatedVariation.macros || null,
        tags: generatedVariation.tags || [],
        category: recipe.category || null,
        image_url: generatedVariation.image_url || null,
        language: customOptions.language,
        units_system: customOptions.unitsSystem,
      });

      if (error) throw error;

      Alert.alert('Opgeslagen!', 'De recept variatie is opgeslagen.');
      setVisible(false);
      setGeneratedVariation(null);
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error saving variation:', error);
      Alert.alert('Fout', `Kon variatie niet opslaan: ${error.message}`);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="sparkles" size={20} color="#047857" />
        <Text style={styles.triggerButtonText}>Recept Aanpassen</Text>
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
              <Ionicons name="sparkles" size={24} color="#047857" />
              <Text style={styles.headerTitle}>Recept Aanpassen</Text>
            </View>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!generatedVariation ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Aanpassing Type</Text>
                  <View style={styles.typeGrid}>
                    {[
                      { type: 'seasonal' as const, label: 'Seizoensgebonden', icon: 'leaf' },
                      { type: 'local_flavor' as const, label: 'Lokale Smaken', icon: 'location' },
                      { type: 'trend' as const, label: 'Trends', icon: 'trending-up' },
                      { type: 'dietary' as const, label: 'Dieet', icon: 'restaurant' },
                      { type: 'allergy' as const, label: 'Allergieën', icon: 'warning' },
                      { type: 'custom' as const, label: 'Aangepast', icon: 'create' },
                    ].map(({ type, label, icon }) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          variationType === type && styles.typeButtonActive,
                        ]}
                        onPress={() => setVariationType(type)}
                      >
                        <Ionicons
                          name={icon as any}
                          size={20}
                          color={variationType === type ? '#fff' : '#047857'}
                        />
                        <Text
                          style={[
                            styles.typeButtonText,
                            variationType === type && styles.typeButtonTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {variationType === 'seasonal' && (
                  <View style={styles.section}>
                    <Text style={styles.label}>Seizoen</Text>
                    <View style={styles.seasonGrid}>
                      {(['spring', 'summer', 'autumn', 'winter'] as const).map((season) => (
                        <TouchableOpacity
                          key={season}
                          style={[
                            styles.seasonButton,
                            customOptions.season === season && styles.seasonButtonActive,
                          ]}
                          onPress={() => setCustomOptions({ ...customOptions, season })}
                        >
                          <Text
                            style={[
                              styles.seasonButtonText,
                              customOptions.season === season && styles.seasonButtonTextActive,
                            ]}
                          >
                            {season === 'spring' ? 'Lente' : season === 'summer' ? 'Zomer' : season === 'autumn' ? 'Herfst' : 'Winter'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {variationType === 'local_flavor' && (
                  <View style={styles.section}>
                    <Text style={styles.label}>Regio</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Bijv. België, Nederland, Vlaanderen..."
                      value={customOptions.localRegion}
                      onChangeText={(text) => setCustomOptions({ ...customOptions, localRegion: text })}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                )}

                {variationType === 'trend' && (
                  <View style={styles.section}>
                    <Text style={styles.label}>Trend Naam</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Bijv. Plant-based, Fermentatie, Zero-waste..."
                      value={customOptions.trendName}
                      onChangeText={(text) => setCustomOptions({ ...customOptions, trendName: text })}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                )}

                {variationType === 'custom' && (
                  <View style={styles.section}>
                    <Text style={styles.label}>Aangepaste Instructies</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Beschrijf hoe je het recept wilt aanpassen..."
                      value={customOptions.customInstructions}
                      onChangeText={(text) => setCustomOptions({ ...customOptions, customInstructions: text })}
                      multiline
                      numberOfLines={4}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.label}>Taal</Text>
                  <View style={styles.languageRow}>
                    {(['nl', 'fr', 'de', 'en'] as const).map((lang) => (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.languageButton,
                          customOptions.language === lang && styles.languageButtonActive,
                        ]}
                        onPress={() => setCustomOptions({ ...customOptions, language: lang })}
                      >
                        <Text
                          style={[
                            styles.languageButtonText,
                            customOptions.language === lang && styles.languageButtonTextActive,
                          ]}
                        >
                          {lang.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.generateButton, loading && styles.generateButtonDisabled]}
                  onPress={handleGenerateVariation}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.generateButtonText}>Variatie Genereren</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.variationPreview}>
                  <Text style={styles.variationTitle}>{generatedVariation.name}</Text>
                  {generatedVariation.description && (
                    <Text style={styles.variationDescription}>{generatedVariation.description}</Text>
                  )}
                  <View style={styles.variationMeta}>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{generatedVariation.totalTime} min</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>{generatedVariation.difficulty}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveVariation}
                  >
                    <Ionicons name="bookmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Opslaan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={() => setGeneratedVariation(null)}
                  >
                    <Ionicons name="refresh" size={20} color="#047857" />
                    <Text style={styles.regenerateButtonText}>Nieuwe Variatie</Text>
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
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: '#fff',
    minWidth: 100,
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
  seasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  seasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  seasonButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  seasonButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  seasonButtonTextActive: {
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
  languageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  languageButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  languageButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  languageButtonTextActive: {
    color: '#fff',
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
  variationPreview: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  variationTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  variationDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
  variationMeta: {
    flexDirection: 'row',
    gap: 8,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
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


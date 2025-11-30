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
import { generateMenuPlan, MenuPlanOptions, type MenuPlan } from '../../services/ai';

interface MenuMakerProps {
  userId: string;
  inventory: Array<{ name: string; quantity_approx?: string; category?: string }>;
  profile: { archetype?: string; cooking_skill?: string; dietary_restrictions?: string[] };
  onMenuCreated?: (menuPlan: MenuPlan) => void;
}

export function MenuMaker({ userId, inventory, profile, onMenuCreated }: MenuMakerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MenuPlanOptions>({
    season: getCurrentSeason(),
    days: 7,
    mealsPerDay: 3,
    dietaryRestrictions: profile.dietary_restrictions as string[] || [],
    cookingSkill: profile.cooking_skill || undefined,
    budget: 'medium',
  });
  const [generatedMenu, setGeneratedMenu] = useState<MenuPlan | null>(null);

  function getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  const handleGenerateMenu = async () => {
    if (loading) return; // Prevent double clicks
    
    setLoading(true);
    try {
      console.log('Generating menu with options:', options);
      console.log('Inventory:', inventory.length, 'items');
      console.log('Profile:', profile);
      
      const menuPlan = await generateMenuPlan(inventory, profile, options);
      
      if (menuPlan) {
        console.log('Menu generated successfully:', menuPlan.title);
        setGeneratedMenu(menuPlan);
        if (onMenuCreated) {
          onMenuCreated(menuPlan);
        }
      } else {
        Alert.alert('Fout', 'Kon geen menu genereren. Probeer het opnieuw.');
      }
    } catch (error: any) {
      console.error('Error generating menu:', error);
      Alert.alert(
        'Fout', 
        `Kon geen menu genereren: ${error.message || 'Onbekende fout'}\n\nControleer je internetverbinding en probeer het opnieuw.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMenu = async () => {
    if (!generatedMenu) return;

    try {
      const { error } = await supabase.from('menu_plans').insert({
        user_id: userId,
        title: generatedMenu.title,
        description: generatedMenu.description,
        season: generatedMenu.season,
        start_date: generatedMenu.startDate,
        end_date: generatedMenu.endDate,
        menu_items: generatedMenu.menuItems.map((item) => ({
          recipe_id: null, // Will be linked when recipe is saved
          day: item.day,
          meal_type: item.mealType,
          servings: item.recipe.servings || 2,
          recipe: item.recipe,
        })),
        ingredient_list: generatedMenu.ingredientList,
      });

      if (error) throw error;

      Alert.alert('Opgeslagen!', 'Het menu plan is opgeslagen.');
      setVisible(false);
      setGeneratedMenu(null);
    } catch (error: any) {
      console.error('Error saving menu:', error);
      Alert.alert('Fout', `Kon menu niet opslaan: ${error.message}`);
    }
  };

  const seasonNames: Record<string, string> = {
    spring: 'Lente',
    summer: 'Zomer',
    autumn: 'Herfst',
    winter: 'Winter',
  };

  const mealTypeNames: Record<string, string> = {
    breakfast: 'Ontbijt',
    lunch: 'Lunch',
    dinner: 'Diner',
    snack: 'Snack',
  };

  return (
    <>
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar" size={20} color="#047857" />
        <Text style={styles.triggerButtonText}>Menu Maker</Text>
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
              <Ionicons name="calendar" size={24} color="#047857" />
              <Text style={styles.headerTitle}>Menu Maker</Text>
            </View>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {!generatedMenu ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Seizoensgebonden Menu</Text>
                  <Text style={styles.sectionDescription}>
                    Genereer een compleet menu op basis van het seizoen en je voorraad.
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Seizoen</Text>
                  <View style={styles.seasonGrid}>
                    {(['spring', 'summer', 'autumn', 'winter'] as const).map((season) => (
                      <TouchableOpacity
                        key={season}
                        style={[
                          styles.seasonButton,
                          options.season === season && styles.seasonButtonActive,
                        ]}
                        onPress={() => setOptions({ ...options, season })}
                      >
                        <Text
                          style={[
                            styles.seasonButtonText,
                            options.season === season && styles.seasonButtonTextActive,
                          ]}
                        >
                          {seasonNames[season]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Aantal Dagen</Text>
                  <View style={styles.daysRow}>
                    {[3, 5, 7, 14].map((days) => (
                      <TouchableOpacity
                        key={days}
                        style={[
                          styles.daysButton,
                          options.days === days && styles.daysButtonActive,
                        ]}
                        onPress={() => setOptions({ ...options, days })}
                      >
                        <Text
                          style={[
                            styles.daysButtonText,
                            options.days === days && styles.daysButtonTextActive,
                          ]}
                        >
                          {days} dagen
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Maaltijden per Dag</Text>
                  <View style={styles.mealsRow}>
                    {[2, 3, 4].map((meals) => (
                      <TouchableOpacity
                        key={meals}
                        style={[
                          styles.mealsButton,
                          options.mealsPerDay === meals && styles.mealsButtonActive,
                        ]}
                        onPress={() => setOptions({ ...options, mealsPerDay: meals })}
                      >
                        <Text
                          style={[
                            styles.mealsButtonText,
                            options.mealsPerDay === meals && styles.mealsButtonTextActive,
                          ]}
                        >
                          {meals}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>Budget</Text>
                  <View style={styles.budgetRow}>
                    {(['low', 'medium', 'high'] as const).map((budget) => (
                      <TouchableOpacity
                        key={budget}
                        style={[
                          styles.budgetButton,
                          options.budget === budget && styles.budgetButtonActive,
                        ]}
                        onPress={() => setOptions({ ...options, budget })}
                      >
                        <Text
                          style={[
                            styles.budgetButtonText,
                            options.budget === budget && styles.budgetButtonTextActive,
                          ]}
                        >
                          {budget === 'low' ? 'Laag' : budget === 'medium' ? 'Gemiddeld' : 'Hoog'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.generateButton, loading && styles.generateButtonDisabled]}
                  onPress={handleGenerateMenu}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={20} color="#fff" />
                      <Text style={styles.generateButtonText}>Menu Genereren</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.menuPreview}>
                  <Text style={styles.menuTitle}>{generatedMenu.title}</Text>
                  {generatedMenu.description && (
                    <Text style={styles.menuDescription}>{generatedMenu.description}</Text>
                  )}
                  <View style={styles.menuMeta}>
                    <View style={styles.metaPill}>
                      <Ionicons name="calendar" size={16} color="#047857" />
                      <Text style={styles.metaText}>
                        {generatedMenu.startDate} - {generatedMenu.endDate}
                      </Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Ionicons name="restaurant" size={16} color="#047857" />
                      <Text style={styles.metaText}>
                        {generatedMenu.menuItems.length} maaltijden
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.menuItems}>
                  {Array.from({ length: options.days }, (_, dayIndex) => {
                    const dayItems = generatedMenu.menuItems.filter((item) => item.day === dayIndex + 1);
                    if (dayItems.length === 0) return null;

                    return (
                      <View key={dayIndex} style={styles.daySection}>
                        <Text style={styles.dayTitle}>Dag {dayIndex + 1}</Text>
                        {dayItems.map((item, itemIndex) => (
                          <View key={itemIndex} style={styles.menuItem}>
                            <View style={styles.menuItemHeader}>
                              <Text style={styles.mealType}>
                                {mealTypeNames[item.mealType] || item.mealType}
                              </Text>
                              <Text style={styles.menuItemTime}>{item.recipe.totalTime} min</Text>
                            </View>
                            <Text style={styles.menuItemTitle}>{item.recipe.name}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>

                {generatedMenu.ingredientList && generatedMenu.ingredientList.length > 0 && (
                  <View style={styles.ingredientList}>
                    <Text style={styles.ingredientListTitle}>Boodschappenlijst</Text>
                    {generatedMenu.ingredientList.map((ingredient, index) => (
                      <View key={index} style={styles.ingredientItem}>
                        <Text style={styles.ingredientName}>{ingredient.name}</Text>
                        <Text style={styles.ingredientQuantity}>
                          {ingredient.quantity} {ingredient.unit}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveMenu}
                  >
                    <Ionicons name="bookmark" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Opslaan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={() => setGeneratedMenu(null)}
                  >
                    <Ionicons name="refresh" size={20} color="#047857" />
                    <Text style={styles.regenerateButtonText}>Nieuw Menu</Text>
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
    marginBottom: 12,
  },
  seasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  seasonButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
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
  daysRow: {
    flexDirection: 'row',
    gap: 10,
  },
  daysButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  daysButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  daysButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  daysButtonTextActive: {
    color: '#fff',
  },
  mealsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mealsButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  mealsButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  mealsButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  mealsButtonTextActive: {
    color: '#fff',
  },
  budgetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  budgetButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  budgetButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  budgetButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  budgetButtonTextActive: {
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
  menuPreview: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  menuDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },
  menuMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  menuItems: {
    marginBottom: 20,
  },
  daySection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
    textTransform: 'uppercase',
  },
  menuItemTime: {
    fontSize: 12,
    color: '#64748b',
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  ingredientList: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  ingredientListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.05)',
  },
  ingredientName: {
    fontSize: 15,
    color: '#0f172a',
    flex: 1,
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
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


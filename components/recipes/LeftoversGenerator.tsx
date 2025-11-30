import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { generateLeftoversRecipes } from '../../services/ai';
import type { GeneratedRecipe } from '../../types/app';

interface LeftoversGeneratorProps {
  userId: string;
  onRecipeSelect?: (recipe: GeneratedRecipe) => void;
}

export function LeftoversGenerator({ userId, onRecipeSelect }: LeftoversGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [expiringItems, setExpiringItems] = useState<Array<{ name: string; expires_at: string; days_until: number }>>([]);

  useEffect(() => {
    if (userId) {
      fetchExpiringItems();
    }
  }, [userId]);

  const fetchExpiringItems = async () => {
    try {
      const { data, error } = await supabase.rpc('get_expiring_items_with_recipes', {
        p_user_id: userId,
        p_days_ahead: 7,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const items = data.map((item: any) => ({
          name: item.item_name,
          expires_at: item.expires_at,
          days_until: item.days_until_expiry,
        }));
        setExpiringItems(items);
      }
    } catch (error) {
      console.error('Error fetching expiring items:', error);
    }
  };

  const handleGenerate = async (generateMore: boolean = false) => {
    if (expiringItems.length === 0) {
      Alert.alert('Geen restjes', 'Je hebt momenteel geen items die bijna verlopen.');
      return;
    }

    if (generateMore) {
      setGeneratingMore(true);
    } else {
      setLoading(true);
    }

    try {
      // Get full inventory for AI
      const { data: inventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', userId)
        .in('name', expiringItems.map(item => item.name));

      if (!inventory || inventory.length === 0) {
        Alert.alert('Geen voorraad', 'Kon voorraad niet laden.');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Generate 1 recipe initially, 3 more when generating more
      const count = generateMore ? 3 : 1;
      const generated = await generateLeftoversRecipes(
        inventory.map(item => ({
          name: item.name,
          quantity_approx: item.quantity_approx || undefined,
          expires_at: item.expires_at || undefined,
          category: item.category || undefined,
        })),
        {
          archetype: profile?.archetype || undefined,
          cooking_skill: profile?.cooking_skill || undefined,
          dietary_restrictions: (profile?.dietary_restrictions as string[]) || undefined,
        },
        count
      );

      if (generated.length > 0) {
        if (generateMore) {
          setRecipes(prev => [...prev, ...generated]);
        } else {
          setRecipes(generated);
        }
      } else {
        Alert.alert('Geen recepten', 'Kon geen recepten genereren voor je restjes. Probeer het later opnieuw.');
      }
    } catch (error: any) {
      console.error('Error generating leftovers recipes:', error);
      Alert.alert('Fout', 'Kon recepten niet genereren: ' + (error.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
      setGeneratingMore(false);
    }
  };

  if (expiringItems.length === 0 && recipes.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="leaf-outline" size={20} color="#047857" />
          <Text style={styles.title}>Zero-Waste Restjes Generator</Text>
        </View>
        {expiringItems.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{expiringItems.length} restjes</Text>
          </View>
        )}
      </View>

      {expiringItems.length > 0 && (
        <View style={styles.expiringSection}>
          <Text style={styles.expiringTitle}>Items die bijna verlopen:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.expiringList}>
            {expiringItems.map((item, index) => (
              <View key={index} style={styles.expiringItem}>
                <Text style={styles.expiringItemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.expiringItemDays}>
                  {item.days_until === 0
                    ? 'Vandaag'
                    : item.days_until === 1
                    ? 'Morgen'
                    : `${item.days_until} dagen`}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {recipes.length === 0 ? (
        <TouchableOpacity
          style={styles.generateButton}
          onPress={() => handleGenerate(false)}
          disabled={loading || expiringItems.length === 0}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.generateButtonText}>Genereren...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.generateButtonText}>Genereer Restjes Recepten</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.recipesSection}>
          <Text style={styles.recipesTitle}>Gegenereerde Restjes Recepten:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipesList}>
            {recipes.map((recipe, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recipeCard}
                onPress={() => onRecipeSelect?.(recipe)}
              >
                {recipe.image_url && (
                  <Image source={{ uri: recipe.image_url }} style={styles.recipeImage} />
                )}
                <View style={styles.recipeContent}>
                  <Text style={styles.recipeTitle} numberOfLines={2}>
                    {recipe.name}
                  </Text>
                  {recipe.description && (
                    <Text style={styles.recipeDescription} numberOfLines={2}>
                      {recipe.description}
                    </Text>
                  )}
                  <View style={styles.recipeMeta}>
                    <Text style={styles.recipeTime}>{recipe.totalTime} min</Text>
                    <Text style={styles.recipeDifficulty}>{recipe.difficulty}</Text>
                  </View>
                  <View style={styles.zeroWasteBadge}>
                    <Ionicons name="leaf" size={12} color="#047857" />
                    <Text style={styles.zeroWasteText}>Zero-Waste</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.generateMoreButton}
            onPress={() => handleGenerate(true)}
            disabled={generatingMore}
          >
            {generatingMore ? (
              <>
                <ActivityIndicator size="small" color="#047857" />
                <Text style={styles.generateMoreButtonText}>Meer genereren...</Text>
              </>
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={18} color="#047857" />
                <Text style={styles.generateMoreButtonText}>Genereer meer recepten</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065f46',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  expiringSection: {
    marginBottom: 12,
  },
  expiringTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  expiringList: {
    marginHorizontal: -4,
  },
  expiringItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  expiringItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  expiringItemDays: {
    fontSize: 11,
    color: '#f97316',
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 14,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  recipesSection: {
    marginTop: 8,
  },
  recipesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  recipesList: {
    marginHorizontal: -4,
  },
  recipeCard: {
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  recipeImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f1f5f9',
    resizeMode: 'cover',
  },
  recipeContent: {
    padding: 12,
    gap: 6,
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  recipeDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  recipeTime: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  recipeDifficulty: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  zeroWasteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  zeroWasteText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  generateMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#047857',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  generateMoreButtonText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '600',
  },
});


// Adaptive Recipe View
// Automatically swaps ingredients based on available inventory

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
}

interface IngredientSwap {
  original: string;
  substitute: string;
  type: string;
  confidence: number;
  notes?: string;
}

interface AdaptiveRecipeViewProps {
  recipe: {
    id: string;
    title: string;
    ingredients: Ingredient[];
    instructions?: any[];
  };
  userInventory: Array<{ name: string; category?: string }>;
  onIngredientSwapped?: (swaps: IngredientSwap[]) => void;
}

export function AdaptiveRecipeView({ recipe, userInventory, onIngredientSwapped }: AdaptiveRecipeViewProps) {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState<IngredientSwap[]>([]);
  const [processedIngredients, setProcessedIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    processIngredients();
  }, [recipe.ingredients, userInventory]);

  const processIngredients = async () => {
    try {
      setLoading(true);
      const newSwaps: IngredientSwap[] = [];
      const processed: Ingredient[] = [];

      // Normalize inventory names
      const inventoryNames = userInventory.map((item) => item.name.toLowerCase().trim());

      for (const ingredient of recipe.ingredients) {
        const ingredientName = ingredient.name.toLowerCase().trim();
        let found = false;
        let substitute: IngredientSwap | null = null;

        // Check if ingredient is directly available
        if (inventoryNames.some((inv) => inv === ingredientName || inv.includes(ingredientName) || ingredientName.includes(inv))) {
          processed.push(ingredient);
          found = true;
        } else {
          // Try to find substitution
          for (const invItem of userInventory) {
            const invName = invItem.name.toLowerCase().trim();

            // Check database for substitutions
            const { data: subData, error: subError } = await supabase.rpc('can_substitute_ingredient', {
              p_recipe_ingredient: ingredient.name,
              p_available_ingredient: invItem.name,
            });

            if (!subError && subData?.can_substitute) {
              substitute = {
                original: ingredient.name,
                substitute: invItem.name,
                type: subData.substitution_type,
                confidence: subData.confidence_score,
                notes: subData.notes,
              };
              newSwaps.push(substitute);
              processed.push({
                ...ingredient,
                name: invItem.name, // Use substitute name
              });
              found = true;
              break;
            }
          }

          if (!found) {
            // No substitution found, keep original but mark as missing
            processed.push({
              ...ingredient,
              name: ingredient.name, // Keep original
            });
          }
        }
      }

      setSwaps(newSwaps);
      setProcessedIngredients(processed);
      onIngredientSwapped?.(newSwaps);
    } catch (error: any) {
      console.error('Error processing ingredients:', error);
      // Fallback: use original ingredients
      setProcessedIngredients(recipe.ingredients);
    } finally {
      setLoading(false);
    }
  };

  const acceptSwap = (swap: IngredientSwap) => {
    // Swap is already applied, just confirm
    Alert.alert('Vervanging Toegepast', `${swap.original} is vervangen door ${swap.substitute}`);
  };

  const rejectSwap = async (swap: IngredientSwap) => {
    // Remove swap and revert to original
    const newSwaps = swaps.filter((s) => s.original !== swap.original);
    setSwaps(newSwaps);

    // Revert ingredient
    const updated = processedIngredients.map((ing) => {
      if (ing.name === swap.substitute && swap.original) {
        return { ...ing, name: swap.original };
      }
      return ing;
    });
    setProcessedIngredients(updated);
    onIngredientSwapped?.(newSwaps);
  };

  const getIngredientStatus = (ingredient: Ingredient): 'available' | 'substituted' | 'missing' => {
    const ingredientName = ingredient.name.toLowerCase().trim();
    const swap = swaps.find((s) => s.substitute.toLowerCase().trim() === ingredientName);

    if (swap) {
      return 'substituted';
    }

    const isAvailable = userInventory.some(
      (inv) =>
        inv.name.toLowerCase().trim() === ingredientName ||
        inv.name.toLowerCase().trim().includes(ingredientName) ||
        ingredientName.includes(inv.name.toLowerCase().trim())
    );

    return isAvailable ? 'available' : 'missing';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#10b981';
      case 'substituted':
        return '#f59e0b';
      case 'missing':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return 'checkmark-circle';
      case 'substituted':
        return 'swap-horizontal';
      case 'missing':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Ingrediënten analyseren...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Swaps Summary */}
      {swaps.length > 0 && (
        <View style={styles.swapsCard}>
          <View style={styles.swapsHeader}>
            <Ionicons name="swap-horizontal" size={24} color="#f59e0b" />
            <Text style={styles.swapsTitle}>Ingrediënt Vervangingen</Text>
          </View>
          <Text style={styles.swapsSubtitle}>
            {swaps.length} ingrediënt{swaps.length > 1 ? 'en' : ''} automatisch vervangen op basis van je voorraad
          </Text>
          {swaps.map((swap, index) => (
            <View key={index} style={styles.swapItem}>
              <View style={styles.swapContent}>
                <View style={styles.swapNames}>
                  <Text style={styles.swapOriginal}>{swap.original}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#64748b" />
                  <Text style={styles.swapSubstitute}>{swap.substitute}</Text>
                </View>
                {swap.notes && <Text style={styles.swapNotes}>{swap.notes}</Text>}
                <View style={styles.swapMeta}>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(swap.confidence * 100)}% match
                    </Text>
                  </View>
                  <Text style={styles.swapType}>{swap.type === 'synonym' ? 'Synoniem' : 'Alternatief'}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => rejectSwap(swap)}
              >
                <Ionicons name="close" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Ingredients List */}
      <View style={styles.ingredientsCard}>
        <Text style={styles.sectionTitle}>Ingrediënten</Text>
        <ScrollView style={styles.ingredientsList}>
          {processedIngredients.map((ingredient, index) => {
            const status = getIngredientStatus(ingredient);
            const swap = swaps.find((s) => s.substitute.toLowerCase().trim() === ingredient.name.toLowerCase().trim());

            return (
              <View key={index} style={styles.ingredientItem}>
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(status) }]}>
                  <Ionicons name={getStatusIcon(status)} size={16} color="#fff" />
                </View>
                <View style={styles.ingredientContent}>
                  <Text
                    style={[
                      styles.ingredientName,
                      status === 'substituted' && styles.ingredientSubstituted,
                      status === 'missing' && styles.ingredientMissing,
                    ]}
                  >
                    {ingredient.name}
                    {swap && (
                      <Text style={styles.originalNameHint}> (was: {swap.original})</Text>
                    )}
                  </Text>
                  {(ingredient.quantity || ingredient.unit) && (
                    <Text style={styles.ingredientQuantity}>
                      {ingredient.quantity} {ingredient.unit || ''}
                    </Text>
                  )}
                </View>
                {status === 'substituted' && swap && (
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => acceptSwap(swap)}
                  >
                    <Ionicons name="checkmark" size={18} color="#10b981" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Beschikbaar</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>Vervangen</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>Niet beschikbaar</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },
  swapsCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  swapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  swapsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  swapsSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  swapItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.2)',
  },
  swapContent: {
    flex: 1,
    gap: 4,
  },
  swapNames: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  swapOriginal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  swapSubstitute: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  swapNotes: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  swapMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  confidenceBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  swapType: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  rejectButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientsCard: {
    flex: 1,
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  ingredientsList: {
    gap: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  statusIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientContent: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  ingredientSubstituted: {
    color: '#f59e0b',
  },
  ingredientMissing: {
    color: '#ef4444',
  },
  originalNameHint: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748b',
    fontStyle: 'italic',
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
  },
});


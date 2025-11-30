import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface RecipeScalingProps {
  recipeId: string;
  originalServings: number;
  onScaled?: (scaledIngredients: any[], newServings: number) => void;
}

export function RecipeScaling({ recipeId, originalServings, onScaled }: RecipeScalingProps) {
  const [servings, setServings] = useState(originalServings);
  const [scaledIngredients, setScaledIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const SERVING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    if (servings !== originalServings) {
      scaleRecipe();
    } else {
      // Reset to original
      setScaledIngredients([]);
    }
  }, [servings, recipeId]);

  const scaleRecipe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('scale_recipe_ingredients', {
        p_recipe_id: recipeId,
        p_original_servings: originalServings,
        p_new_servings: servings,
      });

      if (error) throw error;

      if (data) {
        setScaledIngredients(Array.isArray(data) ? data : []);
        onScaled?.(Array.isArray(data) ? data : [], servings);
      }
    } catch (error: any) {
      console.error('Error scaling recipe:', error);
      Alert.alert('Fout', 'Kon recept niet schalen: ' + (error.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="resize-outline" size={18} color="#047857" />
        <Text style={styles.title}>Aantal personen</Text>
      </View>

      <View style={styles.servingsGrid}>
        {SERVING_OPTIONS.map((option) => {
          const isSelected = servings === option;
          const isOriginal = option === originalServings;

          return (
            <TouchableOpacity
              key={option}
              style={[styles.servingButton, isSelected && styles.servingButtonSelected]}
              onPress={() => setServings(option)}
            >
              <Text
                style={[
                  styles.servingButtonText,
                  isSelected && styles.servingButtonTextSelected,
                ]}
              >
                {option}
              </Text>
              {isOriginal && !isSelected && (
                <View style={styles.originalBadge}>
                  <Text style={styles.originalBadgeText}>Origineel</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {servings !== originalServings && scaledIngredients.length > 0 && (
        <View style={styles.scaledInfo}>
          <Text style={styles.scaledInfoText}>
            Ingrediënten zijn aangepast voor {servings} {servings === 1 ? 'persoon' : 'personen'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  servingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  servingButton: {
    minWidth: 60,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  servingButtonSelected: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  servingButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  servingButtonTextSelected: {
    color: '#fff',
  },
  originalBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#f97316',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  originalBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  scaledInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  scaledInfoText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
    textAlign: 'center',
  },
});


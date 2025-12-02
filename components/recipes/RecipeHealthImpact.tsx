// Recipe Health Impact Simulator
// Visualizes how a recipe affects user's daily health goals

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface RecipeHealthImpactProps {
  recipeId: string;
  servings?: number;
  onClose?: () => void;
}

interface HealthImpactData {
  nutrition_per_serving: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sodium: number;
  };
  goal_progress?: {
    protein?: number;
    fiber?: number;
    calories?: number;
  };
}

export function RecipeHealthImpact({ recipeId, servings = 1, onClose }: RecipeHealthImpactProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [impact, setImpact] = useState<HealthImpactData | null>(null);
  const [servingSize, setServingSize] = useState(servings);
  const [dailyProgress, setDailyProgress] = useState<any[]>([]);

  useEffect(() => {
    loadHealthImpact();
  }, [recipeId, servingSize]);

  const loadHealthImpact = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('calculate_recipe_health_impact', {
        p_recipe_id: recipeId,
        p_servings: servingSize,
        p_user_id: user?.id || null,
      });

      if (error) throw error;

      setImpact(data);

      // Create chart data for daily progress visualization
      if (data?.goal_progress) {
        const chartData = [
          {
            name: 'Eiwit',
            value: data.goal_progress.protein || 0,
            target: 100,
            color: '#047857',
          },
          {
            name: 'Vezels',
            value: data.goal_progress.fiber || 0,
            target: 100,
            color: '#10b981',
          },
          {
            name: 'Calorieën',
            value: data.goal_progress.calories || 0,
            target: 100,
            color: '#14b8a6',
          },
        ];
        setDailyProgress(chartData);
      }
    } catch (error: any) {
      console.error('Error loading health impact:', error);
      Alert.alert('Fout', 'Kon gezondheidsimpact niet berekenen');
    } finally {
      setLoading(false);
    }
  };

  const adjustServings = (delta: number) => {
    const newServings = Math.max(0.5, Math.min(10, servingSize + delta));
    setServingSize(newServings);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gezondheidsimpact</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.loadingText}>Bereken impact...</Text>
        </View>
      </View>
    );
  }

  if (!impact) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gezondheidsimpact</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.noDataContainer}>
          <Ionicons name="information-circle" size={48} color="#94a3b8" />
          <Text style={styles.noDataText}>Geen voedingsdata beschikbaar</Text>
        </View>
      </View>
    );
  }

  const nutrition = impact.nutrition_per_serving;

  // Prepare nutrition chart data
  const nutritionData = [
    { name: 'Calorieën', value: nutrition.calories, unit: 'kcal', color: '#047857' },
    { name: 'Eiwit', value: nutrition.protein, unit: 'g', color: '#10b981' },
    { name: 'Koolhydraten', value: nutrition.carbs, unit: 'g', color: '#14b8a6' },
    { name: 'Vet', value: nutrition.fat, unit: 'g', color: '#f59e0b' },
    { name: 'Vezels', value: nutrition.fiber, unit: 'g', color: '#8b5cf6' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Gezondheidsimpact</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      {/* Serving Size Control */}
      <View style={styles.servingControl}>
        <Text style={styles.servingLabel}>Aantal porties:</Text>
        <View style={styles.servingButtons}>
          <TouchableOpacity style={styles.servingButton} onPress={() => adjustServings(-0.5)}>
            <Ionicons name="remove" size={20} color="#047857" />
          </TouchableOpacity>
          <Text style={styles.servingValue}>{servingSize}</Text>
          <TouchableOpacity style={styles.servingButton} onPress={() => adjustServings(0.5)}>
            <Ionicons name="add" size={20} color="#047857" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Nutrition Overview */}
      <View style={styles.nutritionCard}>
        <Text style={styles.sectionTitle}>Voedingswaarden per Portie</Text>
        <View style={styles.nutritionGrid}>
          {nutritionData.map((item) => (
            <View key={item.name} style={styles.nutritionItem}>
              <View style={[styles.nutritionColorBar, { backgroundColor: item.color }]} />
              <Text style={styles.nutritionName}>{item.name}</Text>
              <Text style={styles.nutritionValue}>
                {item.value.toFixed(item.name === 'Calorieën' ? 0 : 1)} {item.unit}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Goal Progress Chart */}
      {impact.goal_progress && dailyProgress.length > 0 && (
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Dagelijkse Doelvoortgang</Text>
          <Text style={styles.chartSubtitle}>
            Percentage van je dagelijkse doelen dat dit recept dekt
          </Text>
          {Platform.OS === 'web' ? (
            <View style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyProgress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="value" fill="#047857" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="target" fill="#e2e8f0" radius={[8, 8, 0, 0]} opacity={0.3} />
                </BarChart>
              </ResponsiveContainer>
            </View>
          ) : (
            <View style={styles.mobileChart}>
              {dailyProgress.map((item) => (
                <View key={item.name} style={styles.progressBarContainer}>
                  <View style={styles.progressBarHeader}>
                    <Text style={styles.progressBarLabel}>{item.name}</Text>
                    <Text style={styles.progressBarValue}>{item.value.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, item.value)}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* What-If Scenarios */}
      <View style={styles.scenariosCard}>
        <Text style={styles.sectionTitle}>Wat-als Scenario's</Text>
        <Text style={styles.scenariosSubtitle}>
          Test hoe ingrediëntvervangingen de voedingswaarden beïnvloeden
        </Text>
        <TouchableOpacity style={styles.scenarioButton}>
          <Ionicons name="flask" size={20} color="#047857" />
          <Text style={styles.scenarioButtonText}>Test Vervangingen</Text>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#64748b" />
        <Text style={styles.infoText}>
          Deze waarden zijn geschat op basis van de ingrediënten. Werkelijke waarden kunnen variëren.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
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
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  servingControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  servingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  servingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  servingButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  servingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 40,
    textAlign: 'center',
  },
  nutritionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  nutritionGrid: {
    gap: 12,
  },
  nutritionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  nutritionColorBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  nutritionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  chartCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  chartContainer: {
    height: 250,
    marginTop: 8,
  },
  mobileChart: {
    gap: 16,
    marginTop: 8,
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  progressBarValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
  },
  progressBar: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  scenariosCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  scenariosSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  scenarioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#047857',
  },
  scenarioButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});


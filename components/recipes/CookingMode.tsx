import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface CookingModeProps {
  recipe: {
    id: string;
    title: string;
    instructions: any[];
    ingredients: any[];
    servings: number;
  };
  userId: string;
  onComplete?: () => void;
  onExit?: () => void;
}

export function CookingMode({ recipe, userId, onComplete, onExit }: CookingModeProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [startedAt] = useState(new Date());
  const [wakeLock, setWakeLock] = useState<any>(null);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    // Request wake lock on mount (PWA/Browser)
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      requestWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, []);

  const requestWakeLock = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLock(lock);

        // Handle wake lock release (e.g., when screen is locked)
        lock.addEventListener('release', () => {
          console.log('Wake lock released');
        });
      }
    } catch (error: any) {
      console.error('Error requesting wake lock:', error);
      // Wake lock not supported or failed - continue anyway
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLock(null);
      }
    } catch (error) {
      console.error('Error releasing wake lock:', error);
    }
  };

  const handleNextStep = () => {
    if (currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    try {
      const duration = Math.round((new Date().getTime() - startedAt.getTime()) / 1000 / 60);

      // Save cooking session
      await supabase.from('cooking_sessions').insert({
        user_id: userId,
        recipe_id: recipe.id,
        servings: recipe.servings,
        completed_at: new Date().toISOString(),
        duration_minutes: duration,
      });

      // Track zero-waste progress
      await supabase.rpc('track_zero_waste_progress', {
        p_user_id: userId,
      });

      releaseWakeLock();
      onComplete?.();
    } catch (error: any) {
      console.error('Error completing cooking session:', error);
      Alert.alert('Fout', 'Kon sessie niet opslaan, maar je kunt wel doorgaan.');
      releaseWakeLock();
      onComplete?.();
    }
  };

  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions.map((inst, idx) => ({
        step: idx + 1,
        instruction: typeof inst === 'string' ? inst : inst.instruction || inst.step || '',
      }))
    : [];

  const currentInstruction = instructions[currentStep];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <Text style={styles.stepIndicator}>
            Stap {currentStep + 1} van {instructions.length}
          </Text>
        </View>
        {wakeLock && (
          <View style={styles.wakeLockIndicator}>
            <Ionicons name="battery-charging" size={16} color="#10b981" />
          </View>
        )}
      </View>

      {/* Current Step - Large and Clear */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{currentInstruction?.step || currentStep + 1}</Text>
          </View>
          <Text style={styles.stepInstruction}>
            {currentInstruction?.instruction || 'Geen instructie beschikbaar'}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              { width: `${((currentStep + 1) / instructions.length) * 100}%` },
            ]}
          />
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
          onPress={handlePreviousStep}
          disabled={currentStep === 0}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentStep === 0 ? '#94a3b8' : '#fff'}
          />
          <Text
            style={[
              styles.navButtonText,
              currentStep === 0 && styles.navButtonTextDisabled,
            ]}
          >
            Vorige
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.navButtonPrimary]}
          onPress={handleNextStep}
        >
          <Text style={styles.navButtonText}>
            {currentStep === instructions.length - 1 ? 'Voltooien' : 'Volgende'}
          </Text>
          <Ionicons name="chevron-forward" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.select({ web: 20, default: 60 }),
    paddingBottom: 16,
    backgroundColor: '#047857',
    gap: 12,
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  stepIndicator: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  wakeLockIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    gap: 24,
  },
  stepCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepNumberText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  stepInstruction: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 36,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 4,
  },
  navigation: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    borderRadius: 16,
  },
  navButtonPrimary: {
    backgroundColor: '#047857',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  navButtonTextDisabled: {
    color: '#94a3b8',
  },
});


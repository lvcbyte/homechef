import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65;
const SWIPE_THRESHOLD = 120;

const archetypes = [
  {
    id: 'Minimalist',
    icon: 'flash',
    title: 'Minimalist',
    description: 'Snel en simpel. Recepten met minder dan 5 ingrediënten.',
    color: '#60a5fa',
    gradient: ['#60a5fa', '#3b82f6'],
  },
  {
    id: 'Bio-Hacker',
    icon: 'fitness',
    title: 'Bio-Hacker',
    description: 'Focus op macro-nutriënten en schone ingrediënten.',
    color: '#4ade80',
    gradient: ['#4ade80', '#22c55e'],
  },
  {
    id: 'Flavor Hunter',
    icon: 'restaurant',
    title: 'Flavor Hunter',
    description: 'Complexiteit en smaak staan voorop, gemak is secundair.',
    color: '#f59e0b',
    gradient: ['#f59e0b', '#d97706'],
  },
  {
    id: 'Meal Prepper',
    icon: 'calendar',
    title: 'Meal Prepper',
    description: 'Grote porties en recepten die goed bewaren.',
    color: '#a78bfa',
    gradient: ['#a78bfa', '#8b5cf6'],
  },
  {
    id: 'Family Manager',
    icon: 'people',
    title: 'Family Manager',
    description: 'Kindvriendelijke recepten en grote porties voor het gezin.',
    color: '#f472b6',
    gradient: ['#f472b6', '#ec4899'],
  },
];

const cookingLevels = [
  {
    id: 'Beginner',
    icon: 'school',
    title: 'Beginner',
    description: 'Ik begin net met koken en leer graag nieuwe dingen.',
    color: '#10b981',
    gradient: ['#10b981', '#059669'],
  },
  {
    id: 'Intermediate',
    icon: 'restaurant',
    title: 'Gemiddeld',
    description: 'Ik kan koken en probeer graag nieuwe recepten uit.',
    color: '#047857',
    gradient: ['#047857', '#065f46'],
  },
  {
    id: 'Advanced',
    icon: 'trophy',
    title: 'Gevorderd',
    description: 'Ik ben ervaren en hou van uitdagende recepten.',
    color: '#f59e0b',
    gradient: ['#f59e0b', '#d97706'],
  },
];

const dietaryOptions = [
  {
    id: 'Vegan',
    icon: 'leaf',
    title: 'Vegan',
    description: 'Geen dierlijke producten',
    color: '#4ade80',
    gradient: ['#4ade80', '#22c55e'],
  },
  {
    id: 'Vegetarian',
    icon: 'flower',
    title: 'Vegetarisch',
    description: 'Geen vlees of vis',
    color: '#10b981',
    gradient: ['#10b981', '#059669'],
  },
  {
    id: 'Gluten-Free',
    icon: 'nutrition',
    title: 'Glutenvrij',
    description: 'Geen glutenbevattende ingrediënten',
    color: '#f59e0b',
    gradient: ['#f59e0b', '#d97706'],
  },
  {
    id: 'Dairy-Free',
    icon: 'water',
    title: 'Zuivelvrij',
    description: 'Geen zuivelproducten',
    color: '#60a5fa',
    gradient: ['#60a5fa', '#3b82f6'],
  },
  {
    id: 'Nut-Free',
    icon: 'shield-checkmark',
    title: 'Notenvrij',
    description: 'Geen noten of pinda\'s',
    color: '#a78bfa',
    gradient: ['#a78bfa', '#8b5cf6'],
  },
  {
    id: 'Keto',
    icon: 'barbell',
    title: 'Keto',
    description: 'Koolhydraatarm dieet',
    color: '#f472b6',
    gradient: ['#f472b6', '#ec4899'],
  },
  {
    id: 'Paleo',
    icon: 'fitness',
    title: 'Paleo',
    description: 'Paleolithisch dieet',
    color: '#14b8a6',
    gradient: ['#14b8a6', '#0d9488'],
  },
];

type OnboardingStep = 'welcome' | 'archetype' | 'cooking' | 'diet' | 'complete';

interface SwipeableCardProps {
  item: any;
  index: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  position: Animated.ValueXY;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotate: Animated.Value;
}

function SwipeableCard({ item, onSwipeLeft, onSwipeRight, position, opacity, scale, rotate }: SwipeableCardProps) {
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      position.setValue({ x: e.translationX, y: e.translationY });
      const rotation = e.translationX / 20;
      rotate.setValue(rotation);
      const scaleValue = 1 - Math.abs(e.translationX) / 1000;
      scale.setValue(Math.max(0.9, scaleValue));
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        if (e.translationX > 0) {
          // Swipe right (like)
          onSwipeRight();
        } else {
          // Swipe left (dislike)
          onSwipeLeft();
        }
      } else {
        // Spring back
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }).start();
        Animated.spring(rotate, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }
    });

  const rotateStr = rotate.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate: rotateStr },
            { scale },
          ],
          opacity,
        },
      ]}
    >
      <LinearGradient colors={item.gradient} style={styles.cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.cardContent}>
          <View style={styles.cardIconContainer}>
            <Ionicons name={item.icon as any} size={64} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // On web, use regular touch events as fallback
  if (Platform.OS === 'web') {
    return cardContent;
  }

  return <GestureDetector gesture={panGesture}>{cardContent}</GestureDetector>;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedCookingLevel, setSelectedCookingLevel] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Redirect if user is not authenticated
  useEffect(() => {
    if (!user) {
      router.replace('/welcome');
    }
  }, [user, router]);

  // Redirect if onboarding is already completed
  useEffect(() => {
    if (user && profile && profile.onboarding_completed === true) {
      router.replace('/');
    }
  }, [user, profile, router]);

  // Animation values for cards
  const position = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const getCurrentItems = () => {
    switch (step) {
      case 'archetype':
        return archetypes;
      case 'cooking':
        return cookingLevels;
      case 'diet':
        return dietaryOptions;
      default:
        return [];
    }
  };

  const handleSwipeLeft = () => {
    const items = getCurrentItems();
    if (currentCardIndex < items.length - 1) {
      Animated.parallel([
        Animated.timing(position, {
          toValue: { x: -SCREEN_WIDTH, y: 0 },
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentCardIndex(currentCardIndex + 1);
        position.setValue({ x: 0, y: 0 });
        opacity.setValue(1);
        scale.setValue(1);
        rotate.setValue(0);
      });
    } else {
      // No more cards, move to next step
      handleStepComplete();
    }
  };

  const handleSwipeRight = () => {
    const items = getCurrentItems();
    const selectedItem = items[currentCardIndex];

    if (step === 'archetype') {
      setSelectedArchetype(selectedItem.id);
    } else if (step === 'cooking') {
      setSelectedCookingLevel(selectedItem.id);
    } else if (step === 'diet') {
      setSelectedDietary((prev) => [...prev, selectedItem.id]);
    }

    Animated.parallel([
      Animated.timing(position, {
        toValue: { x: SCREEN_WIDTH, y: 0 },
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currentCardIndex < items.length - 1) {
        setCurrentCardIndex(currentCardIndex + 1);
        position.setValue({ x: 0, y: 0 });
        opacity.setValue(1);
        scale.setValue(1);
        rotate.setValue(0);
      } else {
        handleStepComplete();
      }
    });
  };

  const handleStepComplete = () => {
    if (step === 'welcome') {
      setStep('archetype');
      setCurrentCardIndex(0);
    } else if (step === 'archetype') {
      if (!selectedArchetype) {
        // If no archetype selected, default to Minimalist
        setSelectedArchetype('Minimalist');
      }
      setStep('cooking');
      setCurrentCardIndex(0);
    } else if (step === 'cooking') {
      if (!selectedCookingLevel) {
        // If no cooking level selected, default to Intermediate
        setSelectedCookingLevel('Intermediate');
      }
      setStep('diet');
      setCurrentCardIndex(0);
    } else if (step === 'diet') {
      setStep('complete');
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Mark onboarding as started
      await supabase.rpc('start_onboarding');

      // Complete onboarding with selected preferences
      const { error } = await supabase.rpc('complete_onboarding', {
        p_archetype: selectedArchetype || 'Minimalist',
        p_cooking_skill: selectedCookingLevel || 'Intermediate',
        p_dietary_restrictions: selectedDietary.length > 0 ? selectedDietary : [],
      });

      if (error) throw error;

      // Refresh profile
      await refreshProfile();

      // Navigate to home
      router.replace('/');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      alert('Er ging iets mis. Probeer het opnieuw.');
    } finally {
      setSaving(false);
    }
  };

  const items = getCurrentItems();
  const currentItem = items[currentCardIndex];

  if (step === 'welcome') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.welcomeContainer}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.welcomeTitle}>Welkom bij STOCKPIT!</Text>
            <Text style={styles.welcomeSubtitle}>
              Laten we je profiel personaliseren zodat we de perfecte recepten voor jou kunnen vinden.
            </Text>
            <Text style={styles.welcomeDescription}>
              Swipe naar rechts voor recepten die je leuk lijken, en naar links voor recepten die je niet interesseren.
            </Text>
            <Pressable style={styles.primaryButton} onPress={handleStepComplete}>
              <Text style={styles.primaryButtonText}>Laten we beginnen</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 'complete') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.completeContainer}>
            <View style={styles.completeIconContainer}>
              <Ionicons name="checkmark-circle" size={80} color="#047857" />
            </View>
            <Text style={styles.completeTitle}>Klaar!</Text>
            <Text style={styles.completeSubtitle}>
              Je voorkeuren zijn opgeslagen. We gaan nu de beste recepten voor jou vinden.
            </Text>
            <Pressable
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={handleComplete}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>{saving ? 'Opslaan...' : 'Naar de app'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const stepTitle =
    step === 'archetype'
      ? 'Wat voor kookstijl past bij jou?'
      : step === 'cooking'
        ? 'Wat is je kookniveau?'
        : 'Heb je dieetwensen of allergieën?';

  const stepSubtitle =
    step === 'archetype'
      ? 'Swipe naar rechts voor stijlen die je aanspreken'
      : step === 'cooking'
        ? 'Kies het niveau dat het beste bij je past'
        : 'Swipe naar rechts voor dieetwensen die op jou van toepassing zijn';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((step === 'archetype' ? 1 : step === 'cooking' ? 2 : 3) / 3) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.stepIndicator}>
            Stap {step === 'archetype' ? 1 : step === 'cooking' ? 2 : 3} van 3
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.stepTitle}>{stepTitle}</Text>
          <Text style={styles.stepSubtitle}>{stepSubtitle}</Text>

          <View style={styles.cardContainer}>
            {currentItem && (
              <SwipeableCard
                item={currentItem}
                index={currentCardIndex}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                position={position}
                opacity={opacity}
                scale={scale}
                rotate={rotate}
              />
            )}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.swipeButton} onPress={handleSwipeLeft}>
              <Ionicons name="close-circle" size={48} color="#ef4444" />
              <Text style={styles.swipeButtonText}>Nee</Text>
            </Pressable>
            <Pressable style={styles.swipeButton} onPress={handleSwipeRight}>
              <Ionicons name="heart-circle" size={48} color="#047857" />
              <Text style={styles.swipeButtonText}>Ja</Text>
            </Pressable>
          </View>

          <Text style={styles.hint}>
            {currentCardIndex + 1} van {items.length} • Swipe of gebruik de knoppen
          </Text>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 2,
  },
  stepIndicator: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'absolute',
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  cardContent: {
    alignItems: 'center',
    gap: 24,
  },
  cardIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 26,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    marginBottom: 16,
  },
  swipeButton: {
    alignItems: 'center',
    gap: 8,
  },
  swipeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 26,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  completeIconContainer: {
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: 18,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 26,
  },
  primaryButton: {
    backgroundColor: '#047857',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});


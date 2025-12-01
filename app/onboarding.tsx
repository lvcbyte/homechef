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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 400);
const CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.55, 500);
const SWIPE_THRESHOLD = 100;

const archetypes = [
  {
    id: 'Minimalist',
    icon: 'flash',
    title: 'Minimalist',
    description: 'Snel en simpel. Recepten met minder dan 5 ingrediënten.',
    color: '#047857',
    gradient: ['#047857', '#065f46'],
  },
  {
    id: 'Bio-Hacker',
    icon: 'fitness',
    title: 'Bio-Hacker',
    description: 'Focus op macro-nutriënten en schone ingrediënten.',
    color: '#10b981',
    gradient: ['#10b981', '#047857'],
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
    gradient: ['#10b981', '#047857'],
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
    color: '#10b981',
    gradient: ['#10b981', '#047857'],
  },
  {
    id: 'Vegetarian',
    icon: 'flower',
    title: 'Vegetarisch',
    description: 'Geen vlees of vis',
    color: '#14b8a6',
    gradient: ['#14b8a6', '#10b981'],
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
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
        Animated.spring(rotate, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    });

  const rotateStr = rotate.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['-8deg', '0deg', '8deg'],
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
            <Ionicons name={item.icon as any} size={56} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDescription}>{item.description}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );

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

  useEffect(() => {
    if (!user) {
      router.replace('/welcome');
    }
  }, [user, router]);

  useEffect(() => {
    if (user && profile && profile.onboarding_completed === true) {
      router.replace('/');
    }
  }, [user, profile, router]);

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
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
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
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
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
        setSelectedArchetype('Minimalist');
      }
      setStep('cooking');
      setCurrentCardIndex(0);
    } else if (step === 'cooking') {
      if (!selectedCookingLevel) {
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
      console.log('Starting onboarding completion...');
      
      try {
        await supabase.rpc('start_onboarding');
      } catch (startError) {
        console.warn('Error starting onboarding (non-critical):', startError);
      }

      const dietaryRestrictionsJsonb = selectedDietary.length > 0 ? selectedDietary : [];
      
      console.log('Completing onboarding with:', {
        archetype: selectedArchetype || 'Minimalist',
        cooking_skill: selectedCookingLevel || 'Intermediate',
        dietary_restrictions: dietaryRestrictionsJsonb,
      });

      const { data, error } = await supabase.rpc('complete_onboarding', {
        p_archetype: selectedArchetype || 'Minimalist',
        p_cooking_skill: selectedCookingLevel || 'Intermediate',
        p_dietary_restrictions: dietaryRestrictionsJsonb as any,
      });

      if (error) {
        console.error('Error completing onboarding:', error);
        throw error;
      }

      console.log('Onboarding completed successfully:', data);

      await refreshProfile();
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error verifying profile update:', profileError);
        throw new Error('Kon profiel niet verifiëren. Probeer het opnieuw.');
      }

      if (!updatedProfile || updatedProfile.onboarding_completed !== true) {
        console.error('Profile not updated correctly:', updatedProfile);
        throw new Error('Profiel is niet correct bijgewerkt. Probeer het opnieuw.');
      }

      console.log('Profile verified, refreshing profile state...');

      await refreshProfile();
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('Redirecting to home...');

      router.replace('/?onboarding_completed=true');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      alert(error.message || 'Er ging iets mis. Probeer het opnieuw.');
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
          <ScrollView 
            contentContainerStyle={styles.welcomeScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.welcomeContainer}>
              <View style={styles.logoContainer}>
                <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.welcomeTitle}>Welkom bij STOCKPIT!</Text>
              <Text style={styles.welcomeSubtitle}>
                Laten we je profiel personaliseren zodat we de perfecte recepten voor jou kunnen vinden.
              </Text>
              <View style={styles.welcomeInfoBox}>
                <Ionicons name="information-circle" size={20} color="#047857" />
                <Text style={styles.welcomeInfoText}>
                  Swipe naar rechts voor opties die je leuk lijken, en naar links om door te gaan.
                </Text>
              </View>
              <Pressable style={styles.primaryButton} onPress={handleStepComplete}>
                <Text style={styles.primaryButtonText}>Laten we beginnen</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  if (step === 'complete') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView 
            contentContainerStyle={styles.completeScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.completeContainer}>
              <View style={styles.completeIconContainer}>
                <View style={styles.completeIconCircle}>
                  <Ionicons name="checkmark" size={48} color="#fff" />
                </View>
              </View>
              <Text style={styles.completeTitle}>Klaar!</Text>
              <Text style={styles.completeSubtitle}>
                Je voorkeuren zijn opgeslagen. We gaan nu de beste recepten voor jou vinden.
              </Text>
              <View style={styles.completeSummary}>
                {selectedArchetype && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="flash" size={16} color="#047857" />
                    <Text style={styles.summaryText}>{selectedArchetype}</Text>
                  </View>
                )}
                {selectedCookingLevel && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="restaurant" size={16} color="#047857" />
                    <Text style={styles.summaryText}>{selectedCookingLevel}</Text>
                  </View>
                )}
                {selectedDietary.length > 0 && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="leaf" size={16} color="#047857" />
                    <Text style={styles.summaryText}>{selectedDietary.length} dieetwens(en)</Text>
                  </View>
                )}
              </View>
              <Pressable
                style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
                onPress={handleComplete}
                disabled={saving}
              >
                {saving ? (
                  <Text style={styles.primaryButtonText}>Opslaan...</Text>
                ) : (
                  <>
                    <Text style={styles.primaryButtonText}>Naar de app</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
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

  const progressPercentage = ((step === 'archetype' ? 1 : step === 'cooking' ? 2 : 3) / 3) * 100;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercentage}%`,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.stepIndicatorContainer}>
            <Text style={styles.stepIndicator}>
              Stap {step === 'archetype' ? 1 : step === 'cooking' ? 2 : 3} van 3
            </Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
              <Pressable 
                style={styles.swipeButton} 
                onPress={handleSwipeLeft}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.swipeButtonCircle}>
                  <Ionicons name="close" size={28} color="#ef4444" />
                </View>
                <Text style={styles.swipeButtonText}>Overslaan</Text>
              </Pressable>
              <Pressable 
                style={styles.swipeButton} 
                onPress={handleSwipeRight}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={[styles.swipeButtonCircle, styles.swipeButtonCircleActive]}>
                  <Ionicons name="heart" size={28} color="#fff" />
                </View>
                <Text style={[styles.swipeButtonText, styles.swipeButtonTextActive]}>Kies</Text>
              </Pressable>
            </View>

            <View style={styles.cardCounter}>
              <View style={styles.cardCounterDots}>
                {items.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.cardCounterDot,
                      index === currentCardIndex && styles.cardCounterDotActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.cardCounterText}>
                {currentCardIndex + 1} van {items.length}
              </Text>
            </View>
          </View>
        </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 3,
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stepIndicatorContainer: {
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  cardContainer: {
    minHeight: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 20,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  cardContent: {
    alignItems: 'center',
    gap: 20,
  },
  cardIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  cardDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 24,
  },
  swipeButton: {
    alignItems: 'center',
    gap: 8,
  },
  swipeButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  swipeButtonCircleActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  swipeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  swipeButtonTextActive: {
    color: '#047857',
  },
  cardCounter: {
    alignItems: 'center',
    gap: 12,
  },
  cardCounterDots: {
    flexDirection: 'row',
    gap: 8,
  },
  cardCounterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  cardCounterDotActive: {
    backgroundColor: '#047857',
    width: 24,
  },
  cardCounterText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  welcomeScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logo: {
    width: 72,
    height: 72,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  welcomeInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
    maxWidth: 400,
  },
  welcomeInfoText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 20,
    flex: 1,
  },
  completeScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
  },
  completeIconContainer: {
    marginBottom: 8,
  },
  completeIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  completeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  summaryText: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#047857',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    minWidth: 200,
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

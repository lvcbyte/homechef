import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

interface StockpitLoaderProps {
  message?: string;
  progress?: number; // 0-100
  variant?: 'fullscreen' | 'inline' | 'button' | 'recipes' | 'chef-radar';
}

const LOADING_MESSAGES = [
  'Stockpit engine opstarten...',
  'Recepten scannen...',
  'Voorraad analyseren...',
  'Perfecte match zoeken...',
  'Culinaire magie creëren...',
  'Ingrediënten matchen...',
  'Recepten genereren...',
  'Bijna klaar...',
];

// Chef Radar specific messages - focused on recipe matching and generation
const CHEF_RADAR_LOADING_MESSAGES = [
  'Chef Radar scant je voorraad...',
  'Ingrediënten analyseren...',
  'Perfecte matches zoeken...',
  'Recepten genereren met AI...',
  'Match score berekenen...',
  'Persoonlijke suggesties maken...',
  'Culinaire combinaties vinden...',
  'Recepten personaliseren...',
  'Ingrediëntenlijsten samenstellen...',
  'Bereidingswijzen voorbereiden...',
  'Voedingswaarden berekenen...',
  'Kooktijd optimaliseren...',
  'Bijna klaar met Chef Radar...',
  'Laatste recepten toevoegen...',
  'Chef Radar is klaar!',
];

// Extended messages for recipes page - marketing focused, engaging
const RECIPES_LOADING_MESSAGES = [
  'Chef Radar activeert...',
  'Jouw voorraad analyseren...',
  'Perfecte recepten matchen...',
  'Culinaire inspiratie genereren...',
  'Trending recepten ophalen...',
  'Snelle maaltijden vinden...',
  'Ingrediënten combineren...',
  'Persoonlijke suggesties maken...',
  'Recepten van de dag laden...',
  'Categorieën doorzoeken...',
  'Chef Radar berekent matches...',
  'AI genereert recepten...',
  'Voorraad synchroniseren...',
  'Houdbaarheidsdata checken...',
  'Beste combinaties vinden...',
  'Recepten sorteren op relevantie...',
  'Voedingswaarden berekenen...',
  'Kooktijd optimaliseren...',
  'Servings aanpassen...',
  'Moeilijkheidsgraad bepalen...',
  'Tags toevoegen...',
  'Foto\'s ophalen...',
  'Recepten filteren...',
  'Match score berekenen...',
  'Ingrediëntenlijsten samenstellen...',
  'Bereidingswijzen voorbereiden...',
  'Voedingsinformatie laden...',
  'Recepten personaliseren...',
  'Favorieten checken...',
  'Suggesties genereren...',
  'Bijna klaar met laden...',
  'Laatste recepten toevoegen...',
  'Alles is klaar!',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

export function StockpitLoader({ message, progress, variant = 'inline' }: StockpitLoaderProps) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayMessage, setDisplayMessage] = useState(message || LOADING_MESSAGES[0]);

  // Rotate messages for recipes and chef-radar variants
  useEffect(() => {
    if ((variant === 'recipes' || variant === 'chef-radar') && !message) {
      const messages = variant === 'chef-radar' ? CHEF_RADAR_LOADING_MESSAGES : RECIPES_LOADING_MESSAGES;
      let index = 0;
      
      const interval = setInterval(() => {
        // Fade out
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -20,
            duration: 0,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Change message
          index = (index + 1) % messages.length;
          setCurrentMessageIndex(index);
          setDisplayMessage(messages[index]);
          
          // Reset slide position
          slideAnim.setValue(20);
          
          // Fade in
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();
        });
      }, 2000); // Change message every 2 seconds

      return () => clearInterval(interval);
    } else if (message) {
      setDisplayMessage(message);
    } else {
      setDisplayMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    }
  }, [variant, message, fadeAnim, slideAnim]);

  useEffect(() => {
    if (progress !== undefined) {
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, animatedProgress]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (variant === 'recipes' || variant === 'chef-radar') {
      const rotate = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      rotate.start();
      return () => rotate.stop();
    }
  }, [variant, rotateAnim]);

  if (variant === 'button') {
    return (
      <View style={styles.buttonLoader}>
        <Animated.View style={[styles.buttonSpinner, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.spinnerDot} />
        </Animated.View>
        {message && <Text style={styles.buttonText}>{message}</Text>}
      </View>
    );
  }

  if (variant === 'recipes' || variant === 'chef-radar') {
    const rotateInterpolation = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const isChefRadar = variant === 'chef-radar';

    return (
      <View style={isChefRadar ? styles.chefRadarContainer : styles.recipesContainer}>
        <BlurView intensity={90} tint="light" style={isChefRadar ? styles.chefRadarBlur : styles.recipesBlur}>
          <View style={isChefRadar ? styles.chefRadarContent : styles.recipesContent}>
            {/* Animated Logo with rotation */}
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [
                    { scale: pulseAnim },
                    { rotate: rotateInterpolation },
                  ],
                },
              ]}
            >
              <View style={styles.logo}>
                <Text style={styles.logoText}>S</Text>
              </View>
              {/* Decorative circles */}
              <Animated.View
                style={[
                  styles.decorativeCircle1,
                  {
                    transform: [
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '-360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.decorativeCircle2,
                  {
                    transform: [
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['360deg', '0deg'],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>

            {/* Brand Text */}
            {!isChefRadar && (
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <Text style={styles.brandText}>Stockpit</Text>
              </Animated.View>
            )}
            
            {/* Chef Radar Title */}
            {isChefRadar && (
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <Text style={styles.chefRadarTitle}>Chef Radar</Text>
                <Text style={styles.chefRadarSubtitle}>Persoonlijke recepten voor jou</Text>
              </Animated.View>
            )}

            {/* Animated Message */}
            <Animated.View
              style={[
                styles.messageContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.messageText}>{displayMessage}</Text>
            </Animated.View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: animatedProgress.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.progressShimmer,
                    {
                      transform: [
                        {
                          translateX: animatedProgress.interpolate({
                            inputRange: [0, 100],
                            outputRange: [-100, SCREEN_WIDTH],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              {progress !== undefined && (
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
              )}
            </View>

            {/* Fun fact or tip */}
            {!isChefRadar && (
              <Animated.View
                style={[
                  styles.tipContainer,
                  {
                    opacity: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ]}
              >
                <Text style={styles.tipText}>
                  💡 Tip: Gebruik Stockpit Mode om je voorraad snel te scannen
                </Text>
              </Animated.View>
            )}
            
            {/* Chef Radar tip */}
            {isChefRadar && (
              <Animated.View
                style={[
                  styles.tipContainer,
                  {
                    opacity: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ]}
              >
                <Text style={styles.tipText}>
                  🎯 Chef Radar matcht recepten met jouw voorraad
                </Text>
              </Animated.View>
            )}
          </View>
        </BlurView>
      </View>
    );
  }

  if (variant === 'fullscreen') {
    return (
      <View style={styles.fullscreenContainer}>
        <BlurView intensity={80} tint="light" style={styles.fullscreenBlur}>
          <View style={styles.fullscreenContent}>
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>S</Text>
              </View>
            </Animated.View>
            <Text style={styles.brandText}>Stockpit</Text>
            <Text style={styles.messageText}>{displayMessage}</Text>
            {progress !== undefined && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: animatedProgress.interpolate({
                          inputRange: [0, 100],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{Math.round(progress)}%</Text>
              </View>
            )}
          </View>
        </BlurView>
      </View>
    );
  }

  // Inline variant
  return (
    <View style={styles.inlineContainer}>
      <BlurView intensity={20} tint="default" style={styles.inlineBlur}>
        <View style={styles.inlineContent}>
          <Animated.View style={[styles.spinner, { transform: [{ rotate: pulseAnim.interpolate({
            inputRange: [1, 1.15],
            outputRange: ['0deg', '360deg'],
          }) }] }]}>
            <View style={styles.spinnerDot} />
          </Animated.View>
          <Text style={styles.inlineMessage}>{displayMessage}</Text>
          {progress !== undefined && (
            <View style={styles.inlineProgressContainer}>
              <View style={styles.inlineProgressTrack}>
                <Animated.View
                  style={[
                    styles.inlineProgressBar,
                    {
                      width: animatedProgress.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  recipesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  recipesBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
  },
  recipesContent: {
    alignItems: 'center',
    gap: isMobile ? 20 : 28,
    padding: isMobile ? 24 : 40,
    maxWidth: isMobile ? SCREEN_WIDTH - 48 : 400,
    width: '100%',
  },
  logoContainer: {
    marginBottom: 8,
    position: 'relative',
    width: isMobile ? 80 : 96,
    height: isMobile ? 80 : 96,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: isMobile ? 80 : 96,
    height: isMobile ? 80 : 96,
    borderRadius: isMobile ? 20 : 24,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 2,
  },
  logoText: {
    color: '#f0fdf4',
    fontWeight: '800',
    fontSize: isMobile ? 40 : 48,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: isMobile ? 100 : 120,
    height: isMobile ? 100 : 120,
    borderRadius: isMobile ? 50 : 60,
    borderWidth: 2,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    zIndex: 1,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: isMobile ? 120 : 140,
    height: isMobile ? 120 : 140,
    borderRadius: isMobile ? 60 : 70,
    borderWidth: 1.5,
    borderColor: 'rgba(4, 120, 87, 0.15)',
    zIndex: 0,
  },
  brandText: {
    fontSize: isMobile ? 28 : 32,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 1,
    textAlign: 'center',
  },
  chefRadarTitle: {
    fontSize: isMobile ? 22 : 26,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  chefRadarSubtitle: {
    fontSize: isMobile ? 13 : 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  messageContainer: {
    minHeight: isMobile ? 50 : 60,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  messageText: {
    fontSize: isMobile ? 15 : 17,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: isMobile ? 22 : 26,
    paddingHorizontal: 16,
  },
  progressContainer: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  progressTrack: {
    height: isMobile ? 8 : 10,
    backgroundColor: '#e2e8f0',
    borderRadius: isMobile ? 4 : 5,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: isMobile ? 4 : 5,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressShimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: isMobile ? 4 : 5,
  },
  progressText: {
    fontSize: isMobile ? 13 : 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
  },
  tipContainer: {
    marginTop: isMobile ? 12 : 16,
    paddingHorizontal: isMobile ? 16 : 20,
    paddingVertical: isMobile ? 10 : 12,
    backgroundColor: 'rgba(4, 120, 87, 0.08)',
    borderRadius: isMobile ? 12 : 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.15)',
  },
  tipText: {
    fontSize: isMobile ? 12 : 13,
    color: '#047857',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: isMobile ? 18 : 20,
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  fullscreenBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  fullscreenContent: {
    alignItems: 'center',
    gap: 24,
    padding: 32,
  },
  inlineContainer: {
    marginVertical: 16,
  },
  inlineBlur: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
    backgroundColor: 'rgba(240, 253, 244, 0.5)',
    overflow: 'hidden',
  },
  inlineContent: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spinner: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#047857',
  },
  inlineMessage: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  inlineProgressContainer: {
    marginTop: 8,
    width: '100%',
  },
  inlineProgressTrack: {
    height: 3,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  inlineProgressBar: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 2,
  },
  buttonLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonSpinner: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
  },
});

import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface StockpitLoaderProps {
  message?: string;
  progress?: number; // 0-100
  variant?: 'fullscreen' | 'inline' | 'button';
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

export function StockpitLoader({ message, progress, variant = 'inline' }: StockpitLoaderProps) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const displayMessage = message || LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];

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
            inputRange: [1, 1.1],
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
  logoContainer: {
    marginBottom: 8,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  logoText: {
    color: '#f0fdf4',
    fontWeight: '800',
    fontSize: 32,
  },
  brandText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    maxWidth: 280,
  },
  progressContainer: {
    width: 280,
    gap: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '600',
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


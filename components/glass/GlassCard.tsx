import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface GlassCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function GlassCard({ children, onPress, style }: GlassCardProps) {
  const content = (
    <BlurView intensity={20} tint="default" style={[styles.card, style]}>
      <View style={styles.inner}>{children}</View>
    </BlurView>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.pressable}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  inner: {
    padding: 20,
  },
  pressable: {
    borderRadius: 24,
  },
});


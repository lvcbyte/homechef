import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

interface GlassIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}

export function GlassIcon({ name, size = 24, color = '#fff' }: GlassIconProps) {
  return (
    <View style={styles.container}>
      <BlurView intensity={15} tint="default" style={styles.blur}>
        <Ionicons name={name} size={size} color={color} />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});


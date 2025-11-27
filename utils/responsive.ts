import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const isMobile = width < 768;
export const isTablet = width >= 768 && width < 1024;
export const isDesktop = width >= 1024;

export const screenWidth = width;
export const screenHeight = height;

// Responsive padding
export const getPadding = () => {
  if (isMobile) return 16;
  if (isTablet) return 24;
  return 32;
};

// Responsive font sizes
export const getFontSize = (base: number) => {
  if (isMobile) return base;
  if (isTablet) return base * 1.1;
  return base * 1.2;
};

// Responsive card width
export const getCardWidth = (columns: number = 1) => {
  const padding = getPadding() * 2;
  const gap = 16;
  const availableWidth = width - padding - (gap * (columns - 1));
  return availableWidth / columns;
};

// Safe area insets for mobile
export const getSafeAreaPadding = () => {
  if (Platform.OS === 'ios' && isMobile) {
    return { paddingTop: 44, paddingBottom: 34 };
  }
  return { paddingTop: 0, paddingBottom: 0 };
};


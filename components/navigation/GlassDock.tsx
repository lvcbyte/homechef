import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { navigateToRoute } from '../../utils/navigation';

const tabs = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: '/' },
  { key: 'discover', label: 'Discover', icon: 'compass-outline', route: '/recipes' },
  { key: 'inventory', label: 'Inventory', icon: 'list-outline', route: '/inventory' },
  { key: 'saved', label: 'Saved', icon: 'bookmark-outline', route: '/saved' },
];

export function GlassDock() {
  const router = useRouter();
  const pathname = usePathname();

  const handleNavigation = (route: string) => {
    navigateToRoute(router, route);
  };

  // On web, use fixed positioning with CSS
  // On native, use SafeAreaView
  if (Platform.OS === 'web') {
    return (
      <View 
        style={styles.dockWeb}
        // @ts-ignore - web-specific prop
        className="glass-dock"
      >
        {tabs.map((tab) => {
          const isActive = tab.route === '/' ? pathname === '/' : pathname === tab.route;
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => handleNavigation(tab.route)}
            >
              <Ionicons
                name={tab.icon as any}
                size={22}
                color={isActive ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  // Native: use SafeAreaView
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.dock}>
        {tabs.map((tab) => {
          const isActive = tab.route === '/' ? pathname === '/' : pathname === tab.route;
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => handleNavigation(tab.route)}
            >
              <Ionicons
                name={tab.icon as any}
                size={22}
                color={isActive ? '#047857' : '#6b7280'}
              />
              <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  dock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
  },
  dockWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
    // Position will be handled by CSS class
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeLabel: {
    color: '#065f46',
  },
});




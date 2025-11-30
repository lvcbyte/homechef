import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getUnreadNotificationCount } from '../../services/notifications';
import { supabase } from '../../lib/supabase';

interface HeaderAvatarProps {
  userId: string;
  userEmail?: string | null;
  avatarUrl?: string | null;
  showNotificationBadge?: boolean;
}

export function HeaderAvatar({ userId, userEmail, avatarUrl, showNotificationBadge = true }: HeaderAvatarProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl || null);

  useEffect(() => {
    if (showNotificationBadge && userId) {
      loadUnreadCount();
      
      // Set up real-time subscription for notifications
      const channel = supabase
        .channel(`header-notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, showNotificationBadge]);

  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl || null);
  }, [avatarUrl]);

  const loadUnreadCount = async () => {
    if (!userId) return;
    try {
      const count = await getUnreadNotificationCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const handlePress = () => {
    router.push('/profile');
  };

  const initial = userEmail?.charAt(0).toUpperCase() ?? 'U';

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarContainer}>
          {currentAvatarUrl ? (
            <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>
        {showNotificationBadge && unreadCount > 0 && (
          <View style={styles.badge}>
            {unreadCount > 9 ? (
              <Text style={styles.badgeTextSmall}>9+</Text>
            ) : (
              <Text style={styles.badgeText}>{unreadCount}</Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarWrapper: {
    position: 'relative',
    width: 32,
    height: 32,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f97316',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 10,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 11,
  },
  badgeTextSmall: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 10,
  },
});


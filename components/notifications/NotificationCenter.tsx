import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { navigateToRoute } from '../../utils/navigation';
import { useRouter } from 'expo-router';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  userId: string;
  onNotificationPress?: (notification: Notification) => void;
}

export function NotificationCenter({ userId, onNotificationPress }: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      
      // Set up real-time subscription
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            console.log('Notification change:', payload);
            // Refresh notifications on any change
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('read', { ascending: true })
        .order('priority', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setNotifications(data || []);
      const unread = (data || []).filter((n: Notification) => !n.read).length;
      setUnreadCount(unread);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Fout', 'Kon notificaties niet laden: ' + (error.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      
      // Notify parent component if callback exists
      if (onNotificationPress) {
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification) {
          onNotificationPress({ ...notification, read: true });
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    setMarkingAll(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      
      // Notify parent that all notifications were marked as read
      if (onNotificationPress) {
        onNotificationPress({} as Notification);
      }
    } catch (error: any) {
      console.error('Error marking all as read:', error);
      Alert.alert('Fout', 'Kon notificaties niet markeren als gelezen.');
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      // Update unread count if it was unread
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle different notification types
    if (notification.type === 'expiry_warning' || notification.type === 'expiry_recipe_suggestion') {
      // Navigate to recipes with suggested recipe
      if (notification.data?.suggested_recipes?.[0]?.id) {
        navigateToRoute(router, `/recipes?recipe=${notification.data.suggested_recipes[0].id}`);
      } else if (notification.data?.item_id) {
        navigateToRoute(router, '/inventory');
      } else {
        navigateToRoute(router, '/inventory');
      }
    } else if (notification.type === 'badge_earned') {
      // Navigate to profile/badges
      navigateToRoute(router, '/profile');
    } else if (notification.type === 'family_inventory_update') {
      navigateToRoute(router, '/inventory');
    } else if (notification.type === 'shopping_list_reminder') {
      navigateToRoute(router, '/saved');
    }

    onNotificationPress?.(notification);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'expiry_warning':
        return 'warning';
      case 'expiry_recipe_suggestion':
        return 'restaurant';
      case 'badge_earned':
        return 'trophy';
      case 'challenge_completed':
        return 'checkmark-circle';
      case 'family_inventory_update':
        return 'people';
      case 'shopping_list_reminder':
        return 'cart';
      case 'household_invitation':
        return 'people';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'expiry_warning':
        return '#f97316';
      case 'expiry_recipe_suggestion':
        return '#047857';
      case 'badge_earned':
        return '#fbbf24';
      case 'challenge_completed':
        return '#10b981';
      case 'household_invitation':
        return '#047857';
      default:
        return '#64748b';
    }
  };

  const handleInvitationAction = async (notification: Notification, action: 'accept' | 'reject') => {
    const invitationId = notification.data?.invitation_id;
    if (!invitationId) {
      Alert.alert('Fout', 'Uitnodiging ID niet gevonden');
      return;
    }

    try {
      if (action === 'accept') {
        const { error } = await supabase.rpc('accept_household_invitation', {
          p_invitation_id: invitationId,
        });

        if (error) throw error;

        Alert.alert('Succes', 'Uitnodiging geaccepteerd! Je bent nu lid van het gezin.');
        // Navigate to family tab
        router.push('/profile?tab=family');
      } else {
        const { error } = await supabase.rpc('reject_household_invitation', {
          p_invitation_id: invitationId,
        });

        if (error) throw error;

        Alert.alert('Uitnodiging geweigerd', 'De uitnodiging is geweigerd.');
      }

      // Mark notification as read and remove it
      await markAsRead(notification.id);
      await deleteNotification(notification.id);
      fetchNotifications();
    } catch (error: any) {
      console.error('Error handling invitation:', error);
      Alert.alert('Fout', 'Kon uitnodiging niet verwerken: ' + (error.message || 'Onbekende fout'));
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Zojuist';
    if (diffMins < 60) return `${diffMins} min geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`;
    
    return notificationDate.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.loadingText}>Notificaties laden...</Text>
        </View>
      </View>
    );
  }

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
          </View>
          <Text style={styles.emptyTitle}>Geen meldingen</Text>
          <Text style={styles.emptySubtext}>
            Je ontvangt hier meldingen over vervaldatums, badges, uitdagingen en meer
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with unread count and mark all button */}
      {unreadCount > 0 && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
            <Text style={styles.headerText}>
              {unreadCount === 1 ? 'ongelezen' : 'ongelezen'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}
            disabled={markingAll}
            activeOpacity={0.7}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color="#047857" />
                <Text style={styles.markAllButtonText}>Alles gelezen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <ScrollView 
        style={styles.list} 
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {notifications.map((notification) => {
          const iconColor = getNotificationColor(notification.type);
          const isUnread = !notification.read;
          const iconName = getNotificationIcon(notification.type);

          return (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}
              onPress={() => handleNotificationPress(notification)}
              activeOpacity={0.7}
            >
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                <Ionicons name={iconName as any} size={22} color={iconColor} />
              </View>

              {/* Content */}
              <View style={styles.content}>
                <View style={styles.contentHeader}>
                  <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={2}>
                    {notification.title}
                  </Text>
                  {isUnread && <View style={styles.unreadDot} />}
                </View>
                
                <Text style={styles.message} numberOfLines={3}>
                  {notification.message}
                </Text>
                
                <View style={styles.footer}>
                  <Text style={styles.time}>{formatTimeAgo(notification.created_at)}</Text>
                  
                  {/* Show suggested recipes if available */}
                  {notification.type === 'expiry_recipe_suggestion' && 
                   (notification.data?.suggested_recipes?.[0] || notification.data?.suggested_recipe) && (
                    <View style={styles.recipeBadge}>
                      <Ionicons name="restaurant" size={12} color="#047857" />
                      <Text style={styles.recipeBadgeText} numberOfLines={1}>
                        {notification.data?.suggested_recipes?.[0]?.title || 
                         notification.data?.suggested_recipe?.title || 
                         'Recept beschikbaar'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Show invitation actions */}
                {notification.type === 'household_invitation' && !notification.read && (
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleInvitationAction(notification, 'accept');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accepteren</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleInvitationAction(notification, 'reject');
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={16} color="#ef4444" />
                      <Text style={styles.rejectButtonText}>Weigeren</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Delete Button */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  deleteNotification(notification.id);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(4, 120, 87, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBadge: {
    backgroundColor: '#047857',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  markAllButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 80,
  },
  notificationCardUnread: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#047857',
    paddingLeft: 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(4, 120, 87, 0.1)',
  },
  content: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    lineHeight: 20,
  },
  titleUnread: {
    fontWeight: '700',
    color: '#065f46',
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#047857',
    marginTop: 6,
    flexShrink: 0,
  },
  recipeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    maxWidth: '100%',
  },
  recipeBadgeText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    flex: 1,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#047857',
    minHeight: 44,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    backgroundColor: '#fff',
    minHeight: 44,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
    flexShrink: 0,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 64,
    gap: 20,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
});

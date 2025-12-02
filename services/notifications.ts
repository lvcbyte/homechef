import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  priority?: number;
  created_at: string;
}

/**
 * Fetch notifications for a user
 */
export async function fetchUserNotifications(
  userId: string,
  limit: number = 100,
  offset: number = 0,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('read', { ascending: true })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) throw error;

    let notifications = (data || []) as Notification[];

    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.read);
    }

    return notifications;
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
      p_user_id: userId,
    });

    if (error) throw error;

    return data || 0;
  } catch (error: any) {
    console.error('Error getting unread count:', error);
    // Fallback to direct query
    try {
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (countError) throw countError;
      return count || 0;
    } catch (fallbackError) {
      console.error('Error in fallback unread count:', fallbackError);
      return 0;
    }
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userId,
    });

    if (error) throw error;
    return data || 0;
  } catch (error: any) {
    console.error('Error marking all as read:', error);
    // Fallback to direct update
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (updateError) throw updateError;
      return 0; // We don't know the count in fallback
    } catch (fallbackError) {
      console.error('Error in fallback mark all as read:', fallbackError);
      return 0;
    }
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

/**
 * Trigger expiry notifications check (for manual trigger or testing)
 */
export async function triggerExpiryNotificationsCheck(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('create_expiry_notifications');

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('Error triggering expiry notifications:', error);
    return false;
  }
}

/**
 * Create all notifications for a specific user (including daily summary)
 */
export async function createAllNotificationsForUser(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('create_all_notifications_for_user', {
      p_user_id: userId,
    });

    if (error) throw error;
    const count = data || 0;
    console.log(`[notifications] Created ${count} notifications for user ${userId}`);
    return count;
  } catch (error: any) {
    console.error('Error creating all notifications for user:', error);
    return 0;
  }
}

/**
 * Create daily inventory summary for a user
 */
export async function createDailyInventorySummary(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('create_daily_inventory_summary', {
      p_user_id: userId,
    });

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('Error creating daily inventory summary:', error);
    return false;
  }
}

/**
 * Create a custom notification
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: any = {},
  priority: number = 0
): Promise<Notification | null> {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        priority,
        read: false,
      })
      .select()
      .single();

    if (error) throw error;
    return notification as Notification;
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return null;
  }
}


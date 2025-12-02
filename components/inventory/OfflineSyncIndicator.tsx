import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { syncManager, SyncStatus } from '../../services/syncManager';

interface OfflineSyncIndicatorProps {
  onPress?: () => void;
}

export function OfflineSyncIndicator({ onPress }: OfflineSyncIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

  useEffect(() => {
    // Initialize sync manager
    syncManager.init();

    // Subscribe to status changes
    const unsubscribe = syncManager.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Don't show if online and no pending items
  if (status.isOnline && status.pendingCount === 0 && !status.isSyncing) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (!status.isOnline) {
      // Show offline message
    } else if (status.pendingCount > 0 && !status.isSyncing) {
      // Trigger manual sync
      syncManager.sync();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !status.isOnline && styles.containerOffline,
        status.isSyncing && styles.containerSyncing,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {status.isSyncing ? (
        <>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.text}>Synchroniseren...</Text>
        </>
      ) : !status.isOnline ? (
        <>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.text}>Offline</Text>
          {status.pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{status.pendingCount}</Text>
            </View>
          )}
        </>
      ) : status.pendingCount > 0 ? (
        <>
          <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
          <Text style={styles.text}>
            {status.pendingCount} {status.pendingCount === 1 ? 'wijziging' : 'wijzigingen'} wachten
          </Text>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={(e) => {
              e.stopPropagation();
              syncManager.sync();
            }}
          >
            <Text style={styles.syncButtonText}>Sync nu</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#047857',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 24,
    marginVertical: 8,
  },
  containerOffline: {
    backgroundColor: '#64748b',
  },
  containerSyncing: {
    backgroundColor: '#f59e0b',
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  badge: {
    backgroundColor: '#fff',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});


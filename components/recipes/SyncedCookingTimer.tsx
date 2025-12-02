// Synced Cooking Timer Component
// Timer that syncs across multiple PWA instances

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getTimerSyncService, Timer } from '../../services/timerSync';

interface SyncedCookingTimerProps {
  timerName: string;
  durationSeconds: number;
  recipeId?: string;
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function SyncedCookingTimer({
  timerName,
  durationSeconds,
  recipeId,
  onComplete,
  onDismiss,
}: SyncedCookingTimerProps) {
  const { user } = useAuth();
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [timerId, setTimerId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [syncedTimers, setSyncedTimers] = useState<Timer[]>([]);

  useEffect(() => {
    if (user) {
      const syncService = getTimerSyncService();
      syncService.connect(user.id);

      // Listen for timer updates from other devices
      syncService.on('timer_updated', (timer: Timer) => {
        if (timer.id === timerId) {
          const now = new Date().getTime();
          const expires = new Date(timer.expiresAt).getTime();
          const remaining = Math.max(0, Math.floor((expires - now) / 1000));
          setRemainingSeconds(remaining);
        }
      });

      syncService.on('timer_completed', (timer: Timer) => {
        if (timer.id === timerId) {
          handleComplete();
        }
      });

      return () => {
        syncService.off('timer_updated', () => {});
        syncService.off('timer_completed', () => {});
      };
    }
  }, [user, timerId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && !isPaused && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, isPaused, remainingSeconds]);

  const startTimer = async () => {
    if (!user) return;

    try {
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);

      const timer: Timer = {
        id: `timer_${Date.now()}`,
        name: timerName,
        durationSeconds,
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        recipeId,
      };

      const syncService = getTimerSyncService();
      await syncService.startTimer(timer);

      setTimerId(timer.id);
      setIsRunning(true);
      setIsPaused(false);
      setRemainingSeconds(durationSeconds);
    } catch (error: any) {
      console.error('Error starting timer:', error);
      Alert.alert('Fout', 'Kon timer niet starten');
    }
  };

  const pauseTimer = () => {
    setIsPaused(true);
  };

  const resumeTimer = () => {
    setIsPaused(false);
  };

  const stopTimer = async () => {
    if (timerId && user) {
      try {
        const syncService = getTimerSyncService();
        await syncService.completeTimer(timerId);
      } catch (error) {
        console.error('Error stopping timer:', error);
      }
    }
    setIsRunning(false);
    setRemainingSeconds(durationSeconds);
    setTimerId(null);
  };

  const handleComplete = async () => {
    setIsRunning(false);
    setRemainingSeconds(0);

    if (timerId && user) {
      try {
        const syncService = getTimerSyncService();
        await syncService.completeTimer(timerId);
      } catch (error) {
        console.error('Error completing timer:', error);
      }
    }

    // Play sound or vibration
    if (Platform.OS === 'web') {
      // Web Audio API
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    }

    Alert.alert('Timer Afgelopen!', timerName);
    onComplete?.();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = durationSeconds > 0 ? (remainingSeconds / durationSeconds) * 100 : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.timerName}>{timerName}</Text>
          <View style={styles.syncIndicator}>
            <Ionicons name="sync" size={14} color="#10b981" />
            <Text style={styles.syncText}>Gesynchroniseerd</Text>
          </View>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.timerDisplay}>
        <Text style={styles.timeText}>{formatTime(remainingSeconds)}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.controls}>
        {!isRunning ? (
          <TouchableOpacity style={styles.startButton} onPress={startTimer}>
            <Ionicons name="play" size={32} color="#fff" />
            <Text style={styles.startButtonText}>Start Timer</Text>
          </TouchableOpacity>
        ) : (
          <>
            {isPaused ? (
              <TouchableOpacity style={styles.controlButton} onPress={resumeTimer}>
                <Ionicons name="play" size={24} color="#047857" />
                <Text style={styles.controlButtonText}>Hervatten</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.controlButton} onPress={pauseTimer}>
                <Ionicons name="pause" size={24} color="#047857" />
                <Text style={styles.controlButtonText}>Pauzeren</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.controlButton, styles.stopButton]} onPress={stopTimer}>
              <Ionicons name="stop" size={24} color="#ef4444" />
              <Text style={[styles.controlButtonText, styles.stopButtonText]}>Stop</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {remainingSeconds === 0 && isRunning && (
        <View style={styles.completeCard}>
          <Ionicons name="checkmark-circle" size={48} color="#10b981" />
          <Text style={styles.completeText}>Timer Afgelopen!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerContent: {
    flex: 1,
  },
  timerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timeText: {
    fontSize: 64,
    fontWeight: '800',
    color: '#047857',
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#047857',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#047857',
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#047857',
  },
  stopButton: {
    borderColor: '#ef4444',
  },
  stopButtonText: {
    color: '#ef4444',
  },
  completeCard: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  completeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
  },
});


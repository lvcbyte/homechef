// PWA Cooking Timer Sync Service
// Synchronizes cooking timers across multiple PWA instances using WebSockets

import { io, Socket } from 'socket.io-client';
import { supabase } from '../lib/supabase';

export interface Timer {
  id: string;
  name: string;
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  recipeId?: string;
  metadata?: any;
}

export interface TimerSyncMessage {
  type: 'timer_started' | 'timer_completed' | 'timer_updated' | 'sync_request';
  timer?: Timer;
  userId: string;
  deviceId: string;
}

class TimerSyncService {
  private socket: Socket | null = null;
  private deviceId: string;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(timer: Timer) => void>> = new Map();

  constructor() {
    // Generate or retrieve device ID
    this.deviceId = this.getOrCreateDeviceId();
  }

  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server';
    
    let deviceId = localStorage.getItem('stockpit_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('stockpit_device_id', deviceId);
    }
    return deviceId;
  }

  async connect(userId: string): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    this.userId = userId;

    try {
      // Note: Supabase Edge Functions don't natively support WebSockets
      // We'll use polling for cross-device sync (works online, no Docker needed)
      // Polling checks database every 5 seconds for timer updates
      
      // Start polling immediately - this works online without any extra setup
      this.startPolling();
      
      // Optional: Try to connect to a dedicated WebSocket server if available
      // You can set up a separate WebSocket server (e.g., using Socket.IO on a separate service)
      // For now, we'll skip WebSocket and use polling + Supabase Realtime
      
      // Uncomment below if you have a dedicated WebSocket server:
      /*
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const wsUrl = 'wss://your-websocket-server.com'; // Your dedicated WebSocket server
      
      this.socket = io(wsUrl, {
        transports: ['websocket'],
        auth: {
          userId,
          deviceId: this.deviceId,
        },
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('Timer sync connected');
        this.reconnectAttempts = 0;
        this.requestSync();
      });

      this.socket.on('disconnect', () => {
        console.log('Timer sync disconnected');
      });

      this.socket.on('timer_sync', (message: TimerSyncMessage) => {
        this.handleSyncMessage(message);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Timer sync connection error:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.warn('Max reconnection attempts reached, using polling');
          this.startPolling();
        }
      });
      */
    } catch (error) {
      console.error('Error connecting to timer sync:', error);
      // Fallback: use polling with Supabase
      this.startPolling();
    }
  }

  private startPolling() {
    // Fallback polling mechanism using Supabase
    setInterval(async () => {
      if (!this.userId) return;
      
      try {
        const { data } = await supabase.rpc('get_active_timers', {
          p_user_id: this.userId,
        });

        if (data) {
          data.forEach((timer: any) => {
            this.notifyListeners('timer_updated', timer);
          });
        }
      } catch (error) {
        console.error('Error polling timers:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  private handleSyncMessage(message: TimerSyncMessage) {
    // Ignore messages from same device
    if (message.deviceId === this.deviceId) {
      return;
    }

    if (message.timer) {
      switch (message.type) {
        case 'timer_started':
        case 'timer_updated':
          this.notifyListeners('timer_updated', message.timer);
          break;
        case 'timer_completed':
          this.notifyListeners('timer_completed', message.timer);
          break;
      }
    }
  }

  private notifyListeners(event: string, timer: Timer) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(timer));
    }
  }

  async startTimer(timer: Timer): Promise<void> {
    if (!this.userId) {
      throw new Error('Not connected. Call connect() first.');
    }

    // Save to database
    const { error } = await supabase.from('cooking_timers').insert({
      user_id: this.userId,
      recipe_id: timer.recipeId,
      timer_name: timer.name,
      duration_seconds: timer.durationSeconds,
      started_at: timer.startedAt,
      expires_at: timer.expiresAt,
      device_id: this.deviceId,
      is_active: true,
      metadata: timer.metadata,
    });

    if (error) throw error;

    // Broadcast to other devices
    if (this.socket?.connected) {
      this.socket.emit('timer_sync', {
        type: 'timer_started',
        timer,
        userId: this.userId,
        deviceId: this.deviceId,
      } as TimerSyncMessage);
    }
  }

  async completeTimer(timerId: string): Promise<void> {
    if (!this.userId) {
      throw new Error('Not connected. Call connect() first.');
    }

    // Update in database
    const { error } = await supabase.rpc('complete_timer', {
      p_timer_id: timerId,
      p_user_id: this.userId,
    });

    if (error) throw error;

    // Get timer details for broadcast
    const { data } = await supabase
      .from('cooking_timers')
      .select('*')
      .eq('id', timerId)
      .single();

    if (data && this.socket?.connected) {
      this.socket.emit('timer_sync', {
        type: 'timer_completed',
        timer: {
          id: data.id,
          name: data.timer_name,
          durationSeconds: data.duration_seconds,
          startedAt: data.started_at,
          expiresAt: data.expires_at,
          recipeId: data.recipe_id,
          metadata: data.metadata,
        },
        userId: this.userId,
        deviceId: this.deviceId,
      } as TimerSyncMessage);
    }
  }

  on(event: 'timer_started' | 'timer_updated' | 'timer_completed', callback: (timer: Timer) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: 'timer_started' | 'timer_updated' | 'timer_completed', callback: (timer: Timer) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
    }
  }

  private requestSync(): void {
    if (this.socket?.connected && this.userId) {
      this.socket.emit('timer_sync', {
        type: 'sync_request',
        userId: this.userId,
        deviceId: this.deviceId,
      } as TimerSyncMessage);
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  getDeviceId(): string {
    return this.deviceId;
  }
}

// Singleton instance
let timerSyncInstance: TimerSyncService | null = null;

export function getTimerSyncService(): TimerSyncService {
  if (!timerSyncInstance) {
    timerSyncInstance = new TimerSyncService();
  }
  return timerSyncInstance;
}


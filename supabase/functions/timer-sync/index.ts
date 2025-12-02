// Timer Sync WebSocket Server
// Handles real-time synchronization of cooking timers across devices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Simple in-memory store for active connections
// In production, use Redis or similar for multi-instance support
const connections = new Map<string, WebSocket>();

serve(async (req) => {
  // Handle WebSocket upgrade
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, userId, deviceId, timer } = message;

        // Store connection
        const connectionKey = `${userId}_${deviceId}`;
        connections.set(connectionKey, socket);

        switch (type) {
          case 'sync_request':
            // Send all active timers to requesting device
            await sendActiveTimers(userId, deviceId, socket);
            break;

          case 'timer_started':
          case 'timer_updated':
          case 'timer_completed':
            // Broadcast to all other devices for this user
            await broadcastToOtherDevices(userId, deviceId, message);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        socket.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed');
      // Remove from connections map
      for (const [key, ws] of connections.entries()) {
        if (ws === socket) {
          connections.delete(key);
          break;
        }
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return response;
  }

  // Handle HTTP requests (health check, etc.)
  return new Response(JSON.stringify({ status: 'ok', connections: connections.size }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function sendActiveTimers(userId: string, deviceId: string, socket: WebSocket) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('get_active_timers', {
      p_user_id: userId,
    });

    if (error) throw error;

    if (data && data.length > 0) {
      socket.send(
        JSON.stringify({
          type: 'timers_sync',
          timers: data,
        })
      );
    }
  } catch (error) {
    console.error('Error sending active timers:', error);
  }
}

async function broadcastToOtherDevices(
  userId: string,
  senderDeviceId: string,
  message: any
) {
  // Find all connections for this user except the sender
  for (const [key, socket] of connections.entries()) {
    if (key.startsWith(`${userId}_`) && !key.endsWith(`_${senderDeviceId}`)) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    }
  }
}


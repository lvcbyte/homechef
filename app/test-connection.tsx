import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../components/glass/GlassCard';
import { supabase } from '../lib/supabase';

export default function TestConnection() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function testConnection() {
      try {
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) throw error;
        setStatus('connected');
        setMessage('Successfully connected to Supabase!');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Failed to connect to Supabase');
      }
    }
    testConnection();
  }, []);

  return (
    <View style={styles.container}>
      <GlassCard>
        <Text style={styles.title}>Connection Test</Text>
        {status === 'loading' && <ActivityIndicator size="large" color="#fff" />}
        {status === 'connected' && <Text style={styles.success}>✓ {message}</Text>}
        {status === 'error' && <Text style={styles.error}>✗ {message}</Text>}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  success: {
    color: '#4ade80',
    fontSize: 16,
  },
  error: {
    color: '#f87171',
    fontSize: 16,
  },
});


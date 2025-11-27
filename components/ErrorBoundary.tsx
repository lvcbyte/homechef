import React, { Component, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unknown error occurred';
      const isSupabaseError = errorMessage.includes('Supabase') || errorMessage.includes('supabaseUrl');

      return (
        <View style={styles.container}>
          <View style={styles.errorBox}>
            <Text style={styles.title}>⚠️ Configuration Error</Text>
            {isSupabaseError ? (
              <>
                <Text style={styles.message}>
                  Supabase credentials are missing. Please configure the following environment variables in your Vercel project:
                </Text>
                <View style={styles.codeBlock}>
                  <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL</Text>
                  <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
                </View>
                <Text style={styles.instructions}>
                  To fix this:{'\n'}
                  1. Go to your Vercel project settings{'\n'}
                  2. Navigate to Environment Variables{'\n'}
                  3. Add the required variables{'\n'}
                  4. Redeploy your application
                </Text>
              </>
            ) : (
              <Text style={styles.message}>{errorMessage}</Text>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050915',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    maxWidth: 500,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  title: {
    color: '#ef4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  message: {
    color: '#e2e8f0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  codeBlock: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  code: {
    color: '#10b981',
    fontFamily: 'monospace',
    fontSize: 14,
    marginBottom: 4,
  },
  instructions: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
});


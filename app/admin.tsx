import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { chatWithAI } from '../services/ai';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;

interface AdminLog {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  created_at: string;
}

interface SystemMetric {
  total_users: number;
  total_recipes: number;
  total_inventory_items: number;
  total_api_calls: number;
  active_sessions: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  
  const [metrics, setMetrics] = useState<SystemMetric | null>(null);
  const [recentLogs, setRecentLogs] = useState<AdminLog[]>([]);
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user, profile]);

  const checkAdminAccess = async () => {
    if (!user) {
      setIsLoading(false);
      setLoginModalVisible(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, admin_role')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.is_admin) {
        setIsAuthenticated(true);
        fetchDashboardData();
      } else {
        Alert.alert('Toegang geweigerd', 'Je hebt geen admin rechten.');
        router.push('/');
      }
    } catch (error: any) {
      console.error('Error checking admin access:', error);
      Alert.alert('Fout', 'Kon admin status niet verifiëren.');
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!username || !password) {
      Alert.alert('Fout', 'Vul gebruikersnaam en wachtwoord in.');
      return;
    }

    setLoggingIn(true);
    try {
      // Try to sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@admin.stockpit.app`,
        password: password,
      });

      if (error) throw error;

      // Check if user is admin
      if (data.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .single();

        if (profileData?.is_admin) {
          setIsAuthenticated(true);
          setLoginModalVisible(false);
          fetchDashboardData();
        } else {
          await supabase.auth.signOut();
          Alert.alert('Toegang geweigerd', 'Dit account heeft geen admin rechten.');
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login mislukt', error.message || 'Ongeldige inloggegevens.');
    } finally {
      setLoggingIn(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch metrics
      const [usersResult, recipesResult, inventoryResult, logsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
        supabase.from('inventory').select('id', { count: 'exact', head: true }),
        supabase
          .from('admin_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setMetrics({
        total_users: usersResult.count || 0,
        total_recipes: recipesResult.count || 0,
        total_inventory_items: inventoryResult.count || 0,
        total_api_calls: 0, // TODO: Implement API call tracking
        active_sessions: 0, // TODO: Implement session tracking
      });

      if (logsResult.data) {
        setRecentLogs(logsResult.data as AdminLog[]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleAdminChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      // Get database context for the AI
      const [recipes, inventory, users] = await Promise.all([
        supabase.from('recipes').select('id, title, created_at').limit(10),
        supabase.from('inventory').select('id, name, created_at').limit(10),
        supabase.from('profiles').select('id, email, created_at').limit(10),
      ]);

      const context = {
        inventory: inventory.data || [],
        profile: { archetype: 'admin', cooking_skill: 'admin' },
        recentRecipes: recipes.data || [],
        databaseContext: {
          totalRecipes: metrics?.total_recipes || 0,
          totalUsers: metrics?.total_users || 0,
          totalInventory: metrics?.total_inventory_items || 0,
        },
      };

      // Enhanced prompt for admin AI
      const adminPrompt = `${userMessage}

Je bent een admin AI assistent voor Stockpit met volledige database toegang. Je kunt:
- Recepten toevoegen, bewerken of verwijderen
- Gebruikers beheren
- Inventory items beheren
- Database queries uitvoeren
- Statistieken bekijken

Geef concrete SQL queries of acties die uitgevoerd moeten worden. Antwoord in het Nederlands.`;

      const response = await chatWithAI(adminPrompt, context);
      
      setChatMessages((prev) => [...prev, { role: 'assistant', content: response }]);

      // Try to execute SQL if the AI suggests it
      if (response.includes('INSERT') || response.includes('UPDATE') || response.includes('DELETE')) {
        // Extract SQL from response (basic implementation)
        const sqlMatch = response.match(/(?:INSERT|UPDATE|DELETE|SELECT).*?;/is);
        if (sqlMatch) {
          Alert.alert(
            'SQL Query gedetecteerd',
            'Wil je deze query uitvoeren?\n\n' + sqlMatch[0].substring(0, 200),
            [
              { text: 'Annuleren', style: 'cancel' },
              {
                text: 'Uitvoeren',
                onPress: async () => {
                  try {
                    // Execute via RPC or direct query
                    const { error } = await supabase.rpc('execute_admin_query', {
                      p_query: sqlMatch[0],
                    });
                    if (error) throw error;
                    Alert.alert('Succes', 'Query uitgevoerd.');
                    fetchDashboardData();
                  } catch (error: any) {
                    Alert.alert('Fout', error.message);
                  }
                },
              },
            ]
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Fout', error.message || 'Kon niet communiceren met AI.');
    } finally {
      setChatLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#047857" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Modal
            visible={loginModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => router.push('/')}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.loginModal}>
                <Text style={styles.loginTitle}>Admin Login</Text>
                <Text style={styles.loginSubtitle}>Stockpit Admin Dashboard</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gebruikersnaam</Text>
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="ADMINDIETMAR"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Wachtwoord</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleAdminLogin}
                  disabled={loggingIn}
                >
                  {loggingIn ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Inloggen</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.push('/')}
                >
                  <Text style={styles.cancelButtonText}>Annuleren</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.brandLabel}>Admin Dashboard</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/')}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Metrics Cards */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="people" size={32} color="#047857" />
              <Text style={styles.metricValue}>{metrics?.total_users || 0}</Text>
              <Text style={styles.metricLabel}>Gebruikers</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="restaurant" size={32} color="#047857" />
              <Text style={styles.metricValue}>{metrics?.total_recipes || 0}</Text>
              <Text style={styles.metricLabel}>Recepten</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="basket" size={32} color="#047857" />
              <Text style={styles.metricValue}>{metrics?.total_inventory_items || 0}</Text>
              <Text style={styles.metricLabel}>Inventory Items</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="analytics" size={32} color="#047857" />
              <Text style={styles.metricValue}>{metrics?.total_api_calls || 0}</Text>
              <Text style={styles.metricLabel}>API Calls</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Snelle Acties</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionCard} onPress={() => setChatVisible(true)}>
                <Ionicons name="chatbubbles" size={24} color="#047857" />
                <Text style={styles.actionLabel}>AI Assistent</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={fetchDashboardData}>
                <Ionicons name="refresh" size={24} color="#047857" />
                <Text style={styles.actionLabel}>Vernieuwen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="settings" size={24} color="#047857" />
                <Text style={styles.actionLabel}>Instellingen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="key" size={24} color="#047857" />
                <Text style={styles.actionLabel}>API Keys</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Logs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recente Activiteit</Text>
            <View style={styles.logsContainer}>
              {recentLogs.length === 0 ? (
                <Text style={styles.emptyText}>Geen recente activiteit</Text>
              ) : (
                recentLogs.map((log) => (
                  <View key={log.id} style={styles.logItem}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logAction}>{log.action}</Text>
                      <Text style={styles.logTime}>
                        {new Date(log.created_at).toLocaleString('nl-NL')}
                      </Text>
                    </View>
                    {log.resource_type && (
                      <Text style={styles.logResource}>
                        {log.resource_type}: {log.resource_id?.substring(0, 8)}...
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        </ScrollView>

        {/* AI Chat Modal */}
        <Modal
          visible={chatVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setChatVisible(false)}
        >
          <View style={styles.chatModalOverlay}>
            <View style={styles.chatModal}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>Admin AI Assistent</Text>
                <TouchableOpacity onPress={() => setChatVisible(false)}>
                  <Ionicons name="close" size={24} color="#0f172a" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
                {chatMessages.map((msg, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.chatMessage,
                      msg.role === 'user' ? styles.userMessage : styles.assistantMessage,
                    ]}
                  >
                    <Text style={styles.chatMessageText}>{msg.content}</Text>
                  </View>
                ))}
                {chatLoading && (
                  <View style={[styles.chatMessage, styles.assistantMessage]}>
                    <ActivityIndicator size="small" color="#047857" />
                  </View>
                )}
              </ScrollView>

              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Vraag iets aan de AI..."
                  multiline
                  onSubmitEditing={handleAdminChat}
                />
                <TouchableOpacity
                  style={styles.chatSendButton}
                  onPress={handleAdminChat}
                  disabled={chatLoading}
                >
                  <Ionicons name="send" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
    flex: 1,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#f0fdf4',
    fontWeight: '800',
    fontSize: 18,
  },
  brandLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 32,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: isMobile ? '100%' : '45%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    alignItems: 'center',
    gap: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#047857',
  },
  metricLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065f46',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: isMobile ? '45%' : '22%',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  logsContainer: {
    gap: 12,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  logTime: {
    fontSize: 12,
    color: '#64748b',
  },
  logResource: {
    fontSize: 14,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  loginButton: {
    backgroundColor: '#047857',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748b',
    fontSize: 14,
  },
  chatModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatModal: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    gap: 12,
    paddingBottom: 20,
  },
  chatMessage: {
    padding: 12,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#047857',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#f0fdf4',
    alignSelf: 'flex-start',
  },
  chatMessageText: {
    fontSize: 14,
    color: '#0f172a',
  },
  chatInputContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-end',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    maxHeight: 100,
  },
  chatSendButton: {
    backgroundColor: '#047857',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


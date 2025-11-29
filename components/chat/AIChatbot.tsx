import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isMobile = SCREEN_WIDTH < 768;
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { chatWithAI } from '../../services/ai';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  saved?: boolean; // Track if this message has been saved
}

const STANDARD_QUESTIONS = [
  'Wat kan ik maken met mijn voorraad?',
  'Welke ingrediënten vervallen binnenkort?',
  'Geef me kooktips voor beginners',
  'Wat zijn gezonde recepten voor vanavond?',
  'Hoe bewaar ik voedsel het beste?',
];

export function AIChatbot() {
  const { user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  const [recipeData, setRecipeData] = useState({
    title: '',
    description: '',
    ingredients: '',
    instructions: '',
    prep_time: '',
    cook_time: '',
    total_time: '',
    difficulty: 'Gemiddeld',
    servings: '4',
  });

  useEffect(() => {
    if (visible && user) {
      fetchInventory();
      // Add welcome message
      if (messages.length === 0) {
        setMessages([
          {
            id: '1',
            text: 'Hoi! Ik ben STOCKPIT, je AI-keukenassistent. Hoe kan ik je helpen?',
            isUser: false,
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [visible, user]);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  const fetchInventory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setInventory(data || []);
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await chatWithAI(inputText, {
        inventory: inventory.map((item) => ({
          name: item.name,
          quantity_approx: item.quantity_approx,
          expires_at: item.expires_at,
          category: item.category,
        })),
        profile: {
          archetype: profile?.archetype || undefined,
          cooking_skill: profile?.cooking_skill || undefined,
          dietary_restrictions: (profile?.dietary_restrictions as string[]) || undefined,
        },
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, er is een fout opgetreden. Probeer het later opnieuw.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleStandardQuestion = (question: string) => {
    setInputText(question);
    // Auto-send after a short delay
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  const handleSaveMessage = (message: Message) => {
    if (!user) {
      Alert.alert('Inloggen vereist', 'Je moet ingelogd zijn om recepten op te slaan.');
      return;
    }
    setSelectedMessage(message);
    // Try to extract basic info from message text
    const text = message.text;
    // Simple extraction - look for common patterns
    const titleMatch = text.match(/(?:recept|gerecht):\s*([^\n]+)/i) || 
                      text.match(/^([^\n]+?)(?:\n|$)/);
    if (titleMatch) {
      setRecipeData(prev => ({ ...prev, title: titleMatch[1].trim() }));
    }
    setRecipeData(prev => ({ ...prev, description: text.substring(0, 200) }));
    setSaveModalVisible(true);
  };

  const handleSaveRecipe = async () => {
    if (!user || !selectedMessage || !recipeData.title.trim()) {
      Alert.alert('Fout', 'Vul ten minste een titel in.');
      return;
    }

    setSaving(true);
    try {
      // Parse ingredients (split by newlines or commas)
      const ingredientsList = recipeData.ingredients
        .split(/[\n,]/)
        .map(ing => ing.trim())
        .filter(ing => ing.length > 0)
        .map(ing => {
          // Try to parse "quantity unit name" format
          const parts = ing.match(/^(\d+(?:\.\d+)?)?\s*(\w+)?\s*(.+)$/);
          if (parts) {
            return {
              name: parts[3] || ing,
              quantity: parts[1] || '',
              unit: parts[2] || '',
            };
          }
          return { name: ing, quantity: '', unit: '' };
        });

      // Parse instructions (split by newlines or numbers)
      const instructionsList = recipeData.instructions
        .split(/\n|(?=\d+[\.\)])/)
        .map(inst => inst.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(inst => inst.length > 0)
        .map((inst, idx) => ({
          step: idx + 1,
          instruction: inst,
        }));

      const totalTime = parseInt(recipeData.total_time) || 
                       (parseInt(recipeData.prep_time) || 0) + (parseInt(recipeData.cook_time) || 0) ||
                       30;

      const { error } = await supabase
        .from('ai_chat_recipes')
        .insert({
          user_id: user.id,
          title: recipeData.title.trim(),
          description: recipeData.description.trim() || null,
          ingredients: ingredientsList,
          instructions: instructionsList,
          prep_time_minutes: parseInt(recipeData.prep_time) || null,
          cook_time_minutes: parseInt(recipeData.cook_time) || null,
          total_time_minutes: totalTime,
          difficulty: recipeData.difficulty as 'Makkelijk' | 'Gemiddeld' | 'Moeilijk',
          servings: parseInt(recipeData.servings) || null,
          original_message: selectedMessage.text,
          chat_timestamp: selectedMessage.timestamp,
        });

      if (error) throw error;

      // Mark message as saved
      setMessages(prev =>
        prev.map(msg =>
          msg.id === selectedMessage.id ? { ...msg, saved: true } : msg
        )
      );

      Alert.alert('Opgeslagen!', 'Het recept is opgeslagen in je bewaarde items.');
      setSaveModalVisible(false);
      setSelectedMessage(null);
      setRecipeData({
        title: '',
        description: '',
        ingredients: '',
        instructions: '',
        prep_time: '',
        cook_time: '',
        total_time: '',
        difficulty: 'Gemiddeld',
        servings: '4',
      });
    } catch (error: any) {
      console.error('Error saving recipe:', error);
      Alert.alert('Fout', `Kon recept niet opslaan: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <View style={styles.headerIcon}>
                  <Ionicons name="sparkles" size={24} color="#047857" />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>STOCKPIT AI</Text>
                  <Text style={styles.headerSubtitle}>Je keukenassistent</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Standard Questions */}
            {messages.length <= 1 && (
              <View style={styles.standardQuestions}>
                <Text style={styles.standardQuestionsTitle}>Standaardvragen:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.questionsScroll}>
                  {STANDARD_QUESTIONS.map((question, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.questionChip}
                      onPress={() => handleStandardQuestion(question)}
                    >
                      <Text style={styles.questionChipText}>{question}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageWrapper,
                    message.isUser ? styles.userMessageWrapper : styles.aiMessageWrapper,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      message.isUser ? styles.userBubble : styles.aiBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.isUser ? styles.userMessageText : styles.aiMessageText,
                      ]}
                    >
                      {message.text}
                    </Text>
                    {!message.isUser && user && (
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={() => handleSaveMessage(message)}
                        disabled={message.saved}
                      >
                        <Ionicons
                          name={message.saved ? 'checkmark-circle' : 'bookmark-outline'}
                          size={18}
                          color={message.saved ? '#047857' : '#6b7280'}
                        />
                        <Text style={[styles.saveButtonText, message.saved && styles.saveButtonTextSaved]}>
                          {message.saved ? 'Opgeslagen' : 'Opslaan'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {loading && (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="small" color="#047857" />
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Stel een vraag..."
                placeholderTextColor="#9ca3af"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || loading}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={!inputText.trim() || loading ? '#9ca3af' : '#fff'}
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Save Recipe Modal */}
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.saveModalOverlay}>
          <View style={styles.saveModalContent}>
            <View style={styles.saveModalHeader}>
              <Text style={styles.saveModalTitle}>Recept Opslaan</Text>
              <TouchableOpacity onPress={() => setSaveModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.saveModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.saveForm}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Titel *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={recipeData.title}
                    onChangeText={(text) => setRecipeData(prev => ({ ...prev, title: text }))}
                    placeholder="Bijv. Pasta Carbonara"
                    placeholderTextColor="#9ca3af"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Beschrijving</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={recipeData.description}
                    onChangeText={(text) => setRecipeData(prev => ({ ...prev, description: text }))}
                    placeholder="Korte beschrijving van het recept"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Voorbereiding (min)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={recipeData.prep_time}
                      onChangeText={(text) => setRecipeData(prev => ({ ...prev, prep_time: text }))}
                      placeholder="15"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Bereiding (min)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={recipeData.cook_time}
                      onChangeText={(text) => setRecipeData(prev => ({ ...prev, cook_time: text }))}
                      placeholder="20"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Totaal (min)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={recipeData.total_time}
                      onChangeText={(text) => setRecipeData(prev => ({ ...prev, total_time: text }))}
                      placeholder="35"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Moeilijkheid</Text>
                    <View style={styles.difficultyButtons}>
                      {['Makkelijk', 'Gemiddeld', 'Moeilijk'].map((diff) => (
                        <TouchableOpacity
                          key={diff}
                          style={[
                            styles.difficultyButton,
                            recipeData.difficulty === diff && styles.difficultyButtonActive,
                          ]}
                          onPress={() => setRecipeData(prev => ({ ...prev, difficulty: diff }))}
                        >
                          <Text
                            style={[
                              styles.difficultyButtonText,
                              recipeData.difficulty === diff && styles.difficultyButtonTextActive,
                            ]}
                          >
                            {diff}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Porties</Text>
                    <TextInput
                      style={styles.formInput}
                      value={recipeData.servings}
                      onChangeText={(text) => setRecipeData(prev => ({ ...prev, servings: text }))}
                      placeholder="4"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Ingrediënten</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={recipeData.ingredients}
                    onChangeText={(text) => setRecipeData(prev => ({ ...prev, ingredients: text }))}
                    placeholder="1 el olijfolie&#10;2 teentjes knoflook&#10;200g pasta"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={6}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Bereiding</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={recipeData.instructions}
                    onChangeText={(text) => setRecipeData(prev => ({ ...prev, instructions: text }))}
                    placeholder="1. Kook de pasta volgens de verpakking&#10;2. Bak de knoflook in olijfolie&#10;3. Meng alles door elkaar"
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={8}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.saveModalActions}>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonSecondary]}
                onPress={() => setSaveModalVisible(false)}
              >
                <Text style={styles.saveModalButtonTextSecondary}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalButton, styles.saveModalButtonPrimary]}
                onPress={handleSaveRecipe}
                disabled={saving || !recipeData.title.trim()}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveModalButtonTextPrimary}>Opslaan</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: isMobile ? 90 : 100,
    right: isMobile ? 16 : 20,
    width: isMobile ? 52 : 56,
    height: isMobile ? 52 : 56,
    borderRadius: isMobile ? 26 : 28,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
    ...(Platform.OS === 'web' && {
      position: 'fixed',
    }),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  standardQuestions: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  standardQuestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
  },
  questionsScroll: {
    flexDirection: 'row',
  },
  questionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#047857',
  },
  questionChipText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  aiMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#047857',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: '#111827',
  },
  loadingWrapper: {
    padding: 16,
    alignItems: 'flex-start',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  saveButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  saveButtonTextSaved: {
    color: '#047857',
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  saveModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  saveModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  saveModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  saveModalScroll: {
    maxHeight: 500,
  },
  saveForm: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  formInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  difficultyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  difficultyButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  difficultyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  difficultyButtonTextActive: {
    color: '#fff',
  },
  saveModalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  saveModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveModalButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  saveModalButtonPrimary: {
    backgroundColor: '#047857',
  },
  saveModalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveModalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});


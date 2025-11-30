import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { transcribeVoiceCommand, parseVoiceCommandWithAI } from '../../services/ai';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../../constants/categories';

interface VoiceInputProps {
  userId: string;
  onItemsAdded?: (count: number) => void;
}

interface ParsedItem {
  name: string;
  quantity?: string;
  category?: string;
  expires_at?: string;
}

export function VoiceInput({ userId, onItemsAdded }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState<number | null>(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [improvedTranscript, setImprovedTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize speech recognition on web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'nl-NL';
        recognitionRef.current.maxAlternatives = 1;

        recognitionRef.current.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcript + ' ';
            } else {
              interim += transcript;
            }
          }

          if (interim) {
            setInterimTranscript(interim);
          }
          if (final) {
            setFinalTranscript(prev => prev + final);
            setInterimTranscript('');
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            if (finalTranscript || interimTranscript) {
              handleStopListening();
            }
          } else {
            setIsListening(false);
            Alert.alert('Fout', 'Kon spraak niet herkennen. Probeer het opnieuw.');
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = async () => {
    if (Platform.OS === 'web') {
      if (!recognitionRef.current) {
        Alert.alert(
          'Niet ondersteund',
          'Spraakherkenning wordt niet ondersteund in je browser. Gebruik Chrome of Edge.'
        );
        return;
      }

      try {
        setIsListening(true);
        setTranscript('');
        setInterimTranscript('');
        setFinalTranscript('');
        setImprovedTranscript('');
        setParsedItems([]);
        recognitionRef.current.start();
      } catch (error: any) {
        console.error('Error starting recognition:', error);
        setIsListening(false);
        Alert.alert('Fout', 'Kon spraakherkenning niet starten.');
      }
    } else {
      Alert.alert(
        'Binnenkort beschikbaar',
        'Spraakherkenning op native devices komt binnenkort beschikbaar.'
      );
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleStopListening = async () => {
    stopListening();
    
    const fullTranscript = (finalTranscript + ' ' + interimTranscript).trim();
    if (!fullTranscript) {
      return;
    }

    setIsProcessing(true);
    setTranscript(fullTranscript);

    try {
      // Improve transcription with AI
      let improved = fullTranscript;
      try {
        improved = await transcribeVoiceCommand(fullTranscript);
        setImprovedTranscript(improved);
      } catch (error) {
        console.log('AI transcription improvement failed:', error);
        setImprovedTranscript(fullTranscript);
      }

      // Parse with AI
      const aiParsed = await parseVoiceCommandWithAI(improved || fullTranscript);
      
      if (aiParsed.length > 0) {
        // Enrich items with category and expiry
        const enrichedItems = await Promise.all(
          aiParsed.map(async (item) => {
            try {
              const { data: detection } = await supabase.rpc('detect_category', {
                item_name: item.name,
              });

              const suggestion = detection?.[0];
              
              const { data: expiryData } = await supabase.rpc('estimate_expiry_date', {
                category_slug: suggestion?.category || 'pantry',
              });

              return {
                name: item.name,
                quantity: item.quantity || '1',
                category: suggestion?.category || 'pantry',
                expires_at: expiryData || null,
              };
            } catch (error) {
              return {
                name: item.name,
                quantity: item.quantity || '1',
                category: 'pantry',
                expires_at: null,
              };
            }
          })
        );

        setParsedItems(enrichedItems);
        // Select all items by default
        setSelectedItems(new Set(enrichedItems.map((_, idx) => idx)));
        setShowDetailModal(true);
      } else {
        Alert.alert(
          'Geen items gevonden',
          'Ik kon geen items uit je commando halen. Probeer bijvoorbeeld: "voeg een banaan toe" of "twee uien en één kilo rijst"'
        );
      }
    } catch (error: any) {
      console.error('Error processing transcript:', error);
      Alert.alert('Fout', 'Kon commando niet verwerken: ' + (error.message || 'Onbekende fout'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTranscriptPress = () => {
    if (transcript && !isProcessing && !isListening) {
      handleStopListening();
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const startEditingItem = (index: number) => {
    setEditingItem(index);
    setEditingName(parsedItems[index].name);
    setEditingCategory(parsedItems[index].category || 'pantry');
  };

  const saveItemEdit = (index: number) => {
    const updated = [...parsedItems];
    updated[index] = {
      ...updated[index],
      name: editingName.trim() || updated[index].name,
      category: editingCategory || updated[index].category,
    };
    setParsedItems(updated);
    setEditingItem(null);
    setEditingName('');
    setEditingCategory('');
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditingName('');
    setEditingCategory('');
  };

  const handleConfirmAdd = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('Geen items geselecteerd', 'Selecteer minimaal één item om toe te voegen.');
      return;
    }

    setShowDetailModal(false);
    setIsProcessing(true);

    try {
      // Get only selected items
      const itemsToAdd = Array.from(selectedItems)
        .map(idx => parsedItems[idx])
        .filter(item => item && item.name);

      if (itemsToAdd.length === 0) {
        Alert.alert('Geen items', 'Geen geldige items om toe te voegen.');
        setIsProcessing(false);
        return;
      }

      // Log voice command (non-blocking, ignore errors)
      try {
        await supabase.from('voice_commands').insert({
          user_id: userId,
          command_text: transcript,
          improved_transcript: improvedTranscript || transcript,
          parsed_data: { items: itemsToAdd },
          parsed_items: itemsToAdd,
          success: true,
        });
      } catch (logError) {
        // Ignore logging errors
        console.warn('Failed to log voice command:', logError);
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const item of itemsToAdd) {
        try {
          if (!item.name || !item.name.trim()) {
            console.warn('Skipping item with empty name:', item);
            continue;
          }

          // Re-estimate expiry if category changed
          let expiresAt = item.expires_at;
          if (item.category) {
            try {
              const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
                category_slug: item.category,
              });
              if (!expiryError && expiryData) {
                expiresAt = expiryData;
              }
            } catch (expiryErr) {
              console.warn('Error estimating expiry date:', expiryErr);
              // Continue without expiry date
            }
          }

          // Format quantity properly
          let quantityLabel: string | null = null;
          if (item.quantity && item.quantity.trim()) {
            const qty = item.quantity.trim();
            // Check if quantity already has a unit
            if (qty.includes('kg') || qty.includes('l') || qty.includes('g') || qty.includes('ml') || qty.includes('liter') || qty.includes('gram')) {
              quantityLabel = qty;
            } else if (qty.match(/^\d+$/)) {
              // Just a number, add "stuks"
              quantityLabel = `${qty} stuks`;
            } else {
              // Use as is
              quantityLabel = qty;
            }
          }

          const insertData: any = {
            user_id: userId,
            name: item.name.trim(),
            category: item.category || 'pantry',
            confidence_score: 0.9, // Real number between 0 and 1
          };

          // Only add quantity_approx if we have a value
          if (quantityLabel) {
            insertData.quantity_approx = quantityLabel;
          }

          // Only add expires_at if we have a value
          if (expiresAt) {
            insertData.expires_at = expiresAt;
          }

          console.log('Inserting inventory item:', insertData);

          const { data: insertedData, error: insertError } = await supabase
            .from('inventory')
            .insert(insertData)
            .select()
            .single();

          if (insertError) {
            console.error(`Error adding item ${item.name}:`, insertError);
            console.error('Insert data was:', JSON.stringify(insertData, null, 2));
            console.error('Error details:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint,
            });
            errors.push(`${item.name}: ${insertError.message || insertError.code || 'Onbekende fout'}`);
          } else {
            console.log('Successfully added item:', insertedData);
            successCount++;
          }
        } catch (error: any) {
          console.error(`Error adding item ${item.name}:`, error);
          errors.push(`${item.name}: ${error.message || 'Onbekende fout'}`);
        }
      }

      if (successCount > 0) {
        // Call callback first to refresh inventory
        onItemsAdded?.(successCount);
        
        // Show success message
        if (errors.length > 0) {
          Alert.alert(
            'Gedeeltelijk toegevoegd', 
            `${successCount} item(s) toegevoegd aan je voorraad.\n\n${errors.length} item(s) konden niet worden toegevoegd:\n${errors.join('\n')}`
          );
        } else {
          Alert.alert('Toegevoegd', `${successCount} item(s) toegevoegd aan je voorraad.`);
        }
        
        // Reset
        setTranscript('');
        setInterimTranscript('');
        setFinalTranscript('');
        setImprovedTranscript('');
        setParsedItems([]);
        setSelectedItems(new Set());
      } else {
        Alert.alert(
          'Fout', 
          `Kon items niet toevoegen.${errors.length > 0 ? `\n\nFouten:\n${errors.join('\n')}` : '\n\nControleer de console voor meer details.'}`
        );
      }
    } catch (error: any) {
      console.error('Error confirming items:', error);
      Alert.alert('Fout', 'Kon items niet toevoegen: ' + (error.message || 'Onbekende fout'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowDetailModal(false);
    setTranscript('');
    setInterimTranscript('');
    setFinalTranscript('');
    setImprovedTranscript('');
    setParsedItems([]);
    setSelectedItems(new Set());
    setEditingItem(null);
    setEditingName('');
    setEditingCategory('');
    setShowCategoryPicker(null);
  };

  if (Platform.OS !== 'web') {
    return null;
  }

  const displayTranscript = transcript || interimTranscript || finalTranscript;
  const isActive = isListening || isProcessing;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isActive && styles.buttonListening]}
        onPress={isListening ? handleStopListening : startListening}
        disabled={isProcessing}
      >
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={24}
          color={isActive ? '#fff' : '#047857'}
        />
        <Text style={[styles.buttonText, isActive && styles.buttonTextListening]}>
          {isProcessing 
            ? 'Verwerken...' 
            : isListening 
            ? 'Stop luisteren' 
            : 'Spraak invoer'}
        </Text>
      </TouchableOpacity>

      {(displayTranscript || isProcessing) && (
        <TouchableOpacity
          style={styles.transcriptContainer}
          onPress={handleTranscriptPress}
          disabled={isListening || isProcessing}
          activeOpacity={!isListening && !isProcessing ? 0.7 : 1}
        >
          <View style={styles.transcriptHeader}>
            <Text style={styles.transcriptLabel}>
              {isProcessing ? 'Verwerken...' : isListening ? 'Luisteren...' : 'Transcriptie:'}
            </Text>
            {!isListening && !isProcessing && displayTranscript && (
              <Ionicons name="chevron-forward" size={16} color="#047857" />
            )}
          </View>
          <Text style={[styles.transcriptText, interimTranscript && styles.transcriptTextInterim]}>
            {displayTranscript || 'Wachten op spraak...'}
          </Text>
          {interimTranscript && (
            <View style={styles.listeningIndicator}>
              <View style={styles.listeningDot} />
              <Text style={styles.listeningText}>Luisteren...</Text>
            </View>
          )}
          {isProcessing && (
            <View style={styles.processingIndicator}>
              <ActivityIndicator size="small" color="#047857" />
              <Text style={styles.processingText}>AI verwerkt je commando...</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.hint}>
        Zeg bijvoorbeeld: "voeg een banaan toe" of "twee uien en één kilo rijst"
      </Text>

      {/* Detail Modal - STOCKPIT Style */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCancel} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconContainer}>
                  <Ionicons name="mic" size={24} color="#047857" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Spraakcommando</Text>
                  <Text style={styles.modalSubtitle}>Bevestig items om toe te voegen</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleCancel} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.transcriptSection}>
                <Text style={styles.sectionLabel}>Wat je zei:</Text>
                <View style={styles.transcriptBox}>
                  <Text style={styles.transcriptBoxText}>{improvedTranscript || transcript}</Text>
                </View>
              </View>

              <View style={styles.itemsSection}>
                <View style={styles.itemsSectionHeader}>
                  <Text style={styles.sectionLabel}>Gedetecteerde items:</Text>
                  <Text style={styles.selectedCount}>
                    {selectedItems.size} van {parsedItems.length} geselecteerd
                  </Text>
                </View>
                {parsedItems.map((item, index) => {
                  const isSelected = selectedItems.has(index);
                  const isEditing = editingItem === index;
                  
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.itemCard,
                        isSelected && styles.itemCardSelected,
                        !isSelected && styles.itemCardDeselected
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.itemCardHeader}
                        onPress={() => toggleItemSelection(index)}
                        activeOpacity={0.7}
                      >
                        <TouchableOpacity
                          onPress={() => toggleItemSelection(index)}
                          style={styles.checkboxContainer}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={16} color="#fff" />
                            )}
                          </View>
                        </TouchableOpacity>
                        
                        <View style={styles.itemIconContainer}>
                          <Ionicons name="cube-outline" size={20} color={isSelected ? "#047857" : "#94a3b8"} />
                        </View>
                        
                        <View style={styles.itemInfo}>
                          {isEditing ? (
                            <View style={styles.editContainer}>
                              <TextInput
                                style={styles.editInput}
                                value={editingName}
                                onChangeText={setEditingName}
                                placeholder="Item naam"
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.categoryButton}
                                onPress={() => setShowCategoryPicker(showCategoryPicker === index ? null : index)}
                              >
                                <Ionicons name="folder-outline" size={16} color="#047857" />
                                <Text style={styles.categoryButtonText}>
                                  {getCategoryLabel(editingCategory)}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color="#047857" />
                              </TouchableOpacity>
                              {showCategoryPicker === index && (
                                <View style={styles.categoryPicker}>
                                  <ScrollView style={styles.categoryPickerScroll}>
                                    {CATEGORY_OPTIONS.map((cat) => (
                                      <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                          styles.categoryOption,
                                          editingCategory === cat.id && styles.categoryOptionSelected
                                        ]}
                                        onPress={() => {
                                          setEditingCategory(cat.id);
                                          setShowCategoryPicker(null);
                                        }}
                                      >
                                        <Text style={[
                                          styles.categoryOptionText,
                                          editingCategory === cat.id && styles.categoryOptionTextSelected
                                        ]}>
                                          {cat.label}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>
                                </View>
                              )}
                              <View style={styles.editActions}>
                                <TouchableOpacity
                                  style={styles.editActionButton}
                                  onPress={cancelEdit}
                                >
                                  <Ionicons name="close" size={16} color="#64748b" />
                                  <Text style={styles.editActionText}>Annuleren</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.editActionButton, styles.editActionButtonSave]}
                                  onPress={() => saveItemEdit(index)}
                                >
                                  <Ionicons name="checkmark" size={16} color="#fff" />
                                  <Text style={[styles.editActionText, styles.editActionTextSave]}>Opslaan</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <>
                              <Text style={[styles.itemName, !isSelected && styles.itemNameDeselected]}>
                                {item.name}
                              </Text>
                              <View style={styles.itemMeta}>
                                {item.quantity && (
                                  <View style={styles.itemMetaPill}>
                                    <Ionicons name="scale-outline" size={12} color={isSelected ? "#047857" : "#94a3b8"} />
                                    <Text style={[styles.itemMetaText, !isSelected && styles.itemMetaTextDeselected]}>
                                      {item.quantity}
                                    </Text>
                                  </View>
                                )}
                                {item.category && (
                                  <View style={styles.itemMetaPill}>
                                    <Ionicons name="folder-outline" size={12} color={isSelected ? "#047857" : "#94a3b8"} />
                                    <Text style={[styles.itemMetaText, !isSelected && styles.itemMetaTextDeselected]}>
                                      {getCategoryLabel(item.category)}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </>
                          )}
                        </View>
                        
                        {!isEditing && (
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => startEditingItem(index)}
                          >
                            <Ionicons name="create-outline" size={18} color={isSelected ? "#047857" : "#94a3b8"} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCancel}
              >
                <Text style={styles.modalButtonTextCancel}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  styles.modalButtonConfirm,
                  selectedItems.size === 0 && styles.modalButtonDisabled
                ]}
                onPress={handleConfirmAdd}
                disabled={selectedItems.size === 0}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.modalButtonTextConfirm}>
                  {selectedItems.size} {selectedItems.size === 1 ? 'item toevoegen' : 'items toevoegen'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    marginVertical: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#047857',
    paddingVertical: 14,
    borderRadius: 14,
  },
  buttonListening: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  buttonTextListening: {
    color: '#fff',
  },
  transcriptContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
  },
  transcriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  transcriptText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  transcriptTextInterim: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#047857',
  },
  listeningText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  processingText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  modalClose: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  transcriptSection: {
    padding: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.1)',
  },
  transcriptBoxText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  itemsSection: {
    padding: 20,
    paddingTop: 12,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    padding: 16,
    marginBottom: 12,
  },
  itemCardSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#047857',
  },
  itemCardDeselected: {
    backgroundColor: '#f8fafc',
    borderColor: 'rgba(15,23,42,0.1)',
    opacity: 0.6,
  },
  itemCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  itemInfo: {
    flex: 1,
    gap: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemNameDeselected: {
    color: '#64748b',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  itemMetaText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  itemMetaTextDeselected: {
    color: '#94a3b8',
  },
  itemsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectedCount: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  editContainer: {
    flex: 1,
    gap: 8,
  },
  editInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  categoryButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  categoryPicker: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    maxHeight: 200,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  categoryPickerScroll: {
    maxHeight: 200,
  },
  categoryOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.05)',
  },
  categoryOptionSelected: {
    backgroundColor: '#f0fdf4',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#0f172a',
  },
  categoryOptionTextSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  editActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editActionButtonSave: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  editActionText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  editActionTextSave: {
    color: '#fff',
  },
  editButton: {
    padding: 4,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#047857',
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalButtonTextCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  modalButtonTextConfirm: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

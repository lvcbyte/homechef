import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../../constants/categories';

interface ReceiptOCRProps {
  userId: string;
  onItemsAdded?: (count: number) => void;
}

interface ParsedReceiptItem {
  name: string;
  quantity?: string;
  price?: number;
  category?: string;
  confidence?: number;
}

export function ReceiptOCR({ userId, onItemsAdded }: ReceiptOCRProps) {
  const [processing, setProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedReceiptItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [ocrText, setOcrText] = useState('');

  const handleSelectReceipt = async () => {
    if (Platform.OS === 'web') {
      // For web, use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const imageUrl = event.target?.result as string;
            await processReceipt(imageUrl);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // For native, use image picker
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Toestemming nodig', 'Camera roll toegang is nodig om bonnen te selecteren.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await processReceipt(result.assets[0].uri);
      }
    }
  };

  const processReceipt = async (imageUri: string) => {
    setProcessing(true);
    setReceiptImage(imageUri);
    setShowModal(true);
    setParsedItems([]);
    setSelectedItems(new Set());
    setOcrText('');

    try {
      if (Platform.OS === 'web') {
        // Use Tesseract.js for web
        const Tesseract = await import('tesseract.js');
        
        const { data: { text } } = await Tesseract.recognize(imageUri, 'nld', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        setOcrText(text);
        await parseReceiptText(text);
      } else {
        // For native, we could use a native OCR library or send to backend
        Alert.alert(
          'Binnenkort beschikbaar',
          'Receipt OCR op native devices komt binnenkort beschikbaar. Gebruik de web versie voor nu.'
        );
        setProcessing(false);
        return;
      }
    } catch (error: any) {
      console.error('Error processing receipt:', error);
      Alert.alert('Fout', 'Kon bon niet verwerken: ' + (error.message || 'Onbekende fout'));
      setProcessing(false);
    }
  };

  const parseReceiptText = async (text: string) => {
    try {
      // Call backend function to parse receipt
      const { data, error } = await supabase.rpc('parse_receipt_items', {
        p_receipt_text: text,
        p_user_id: userId,
      });

      if (error) {
        console.error('Error calling parse_receipt_items:', error);
        // Fallback: try to parse manually
        return parseReceiptTextManually(text);
      }

      if (data && (Array.isArray(data) || (typeof data === 'object' && data !== null))) {
        const itemsArray = Array.isArray(data) ? data : (data.items || []);
        
        if (itemsArray.length > 0) {
          // Enrich items with category detection
          const enrichedItems = await Promise.all(
            itemsArray.map(async (item: any) => {
              try {
                const { data: detection } = await supabase.rpc('detect_category', {
                  item_name: item.name,
                });
                const suggestion = detection?.[0];
                
                return {
                  ...item,
                  category: suggestion?.category || 'pantry',
                };
              } catch (error) {
                return {
                  ...item,
                  category: 'pantry',
                };
              }
            })
          );

          setParsedItems(enrichedItems);
          setSelectedItems(new Set(enrichedItems.map((_, idx) => idx)));
        } else {
          // Fallback to manual parsing
          parseReceiptTextManually(text);
        }
      } else {
        // Fallback to manual parsing
        parseReceiptTextManually(text);
      }
    } catch (error: any) {
      console.error('Error parsing receipt:', error);
      // Try manual parsing as fallback
      parseReceiptTextManually(text);
    } finally {
      setProcessing(false);
    }
  };

  const parseReceiptTextManually = async (text: string) => {
    try {
      // Simple regex-based parsing as fallback
      const lines = text.split('\n');
      const items: ParsedReceiptItem[] = [];
      
      const pricePattern = /(\d+[,\.]\d{2})/;
      const quantityPattern = /(\d+)\s*(x|×|stuks?|st\.?|kg|g|liter|l|ml)/i;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length < 3) continue;
        
        // Skip headers/footers
        if (trimmed.match(/^(totaal|total|bedrag|subtotaal|btw|vat|korting|discount|bon|receipt|datum|date|kassier|cashier)/i)) {
          continue;
        }
        
        const priceMatch = trimmed.match(pricePattern);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(',', '.'));
          let itemName = trimmed.replace(pricePattern, '').trim();
          itemName = itemName.replace(/\s+/g, ' ');
          
          let quantity = '1';
          const qtyMatch = itemName.match(quantityPattern);
          if (qtyMatch) {
            quantity = qtyMatch[1] + (qtyMatch[2] || '');
            itemName = itemName.replace(quantityPattern, '').trim();
          }
          
          if (itemName.length >= 2) {
            items.push({
              name: itemName,
              quantity,
              price,
              confidence: 0.6,
            });
          }
        }
      }
      
      if (items.length > 0) {
        // Enrich with categories
        const enrichedItems = await Promise.all(
          items.map(async (item) => {
            try {
              const { data: detection } = await supabase.rpc('detect_category', {
                item_name: item.name,
              });
              const suggestion = detection?.[0];
              
              return {
                ...item,
                category: suggestion?.category || 'pantry',
              };
            } catch (error) {
              return {
                ...item,
                category: 'pantry',
              };
            }
          })
        );
        
        setParsedItems(enrichedItems);
        setSelectedItems(new Set(enrichedItems.map((_, idx) => idx)));
      } else {
        Alert.alert('Geen items gevonden', 'Kon geen items uit de bon halen. Probeer een duidelijkere foto.');
        setProcessing(false);
      }
    } catch (error: any) {
      console.error('Error in manual parsing:', error);
      Alert.alert('Fout', 'Kon bon niet parseren: ' + (error.message || 'Onbekende fout'));
      setProcessing(false);
    }
  };

  const handleConfirmAdd = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('Geen items geselecteerd', 'Selecteer minimaal één item om toe te voegen.');
      return;
    }

    setProcessing(true);

    try {
      // Upload receipt image to storage
      let storagePath: string | null = null;
      if (receiptImage) {
        const filePath = `${userId}/receipts/${Date.now()}.jpg`;
        const response = await fetch(receiptImage);
        const blob = await response.blob();
        
        const { error: uploadError } = await supabase.storage
          .from('inventory-scans')
          .upload(filePath, blob, { contentType: 'image/jpeg' });
        
        if (!uploadError) {
          storagePath = filePath;
        }
      }

      // Create receipt upload record
      const itemsToAdd = Array.from(selectedItems)
        .map(idx => parsedItems[idx])
        .filter(item => item && item.name);

      const { data: receiptRecord, error: receiptError } = await supabase
        .from('receipt_uploads')
        .insert({
          user_id: userId,
          source: 'receipt-ocr',
          storage_path: storagePath,
          items_detected: itemsToAdd,
          status: 'processing',
          parsed_payload: {
            ocr_text: ocrText,
            items_count: itemsToAdd.length,
          },
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Add items to inventory
      let successCount = 0;
      for (const item of itemsToAdd) {
        try {
          const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
            category_slug: item.category || 'pantry',
            product_name: item.name || null,
          });

          if (expiryError) {
            console.error('Error estimating expiry:', expiryError);
          }

          const { error: insertError } = await supabase.from('inventory').insert({
            user_id: userId,
            name: item.name,
            category: item.category || 'pantry',
            quantity_approx: item.quantity || '1',
            confidence_score: item.confidence || 0.7,
            expires_at: expiryData || null,
          });

          if (!insertError) {
            successCount++;
          }
        } catch (error) {
          console.error('Error adding item:', error);
        }
      }

      // Update receipt status
      if (receiptRecord) {
        await supabase
          .from('receipt_uploads')
          .update({
            status: 'completed',
            parsed_payload: {
              ...receiptRecord.parsed_payload,
              items_added: successCount,
            },
          })
          .eq('id', receiptRecord.id);
      }

      onItemsAdded?.(successCount);
      setShowModal(false);
      setReceiptImage(null);
      setParsedItems([]);
      setSelectedItems(new Set());
      setOcrText('');

      Alert.alert('Toegevoegd', `${successCount} item(s) toegevoegd aan je voorraad.`);
    } catch (error: any) {
      console.error('Error confirming receipt items:', error);
      Alert.alert('Fout', 'Kon items niet toevoegen: ' + (error.message || 'Onbekende fout'));
    } finally {
      setProcessing(false);
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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleSelectReceipt}
        disabled={processing}
      >
        <Ionicons name="receipt-outline" size={24} color="#047857" />
        <Text style={styles.buttonText}>Scan Kassabon</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!processing) {
            setShowModal(false);
            setReceiptImage(null);
            setParsedItems([]);
            setSelectedItems(new Set());
            setOcrText('');
          }
        }}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="receipt" size={24} color="#047857" />
                <Text style={styles.modalTitle}>Kassabon Scan</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!processing) {
                    setShowModal(false);
                    setReceiptImage(null);
                    setParsedItems([]);
                    setSelectedItems(new Set());
                    setOcrText('');
                  }
                }}
                disabled={processing}
              >
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {receiptImage && (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: receiptImage }} style={styles.receiptImage} resizeMode="contain" />
                </View>
              )}

              {processing && parsedItems.length === 0 && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#047857" />
                  <Text style={styles.processingText}>OCR verwerking...</Text>
                  <Text style={styles.processingSubtext}>Dit kan even duren</Text>
                </View>
              )}

              {parsedItems.length > 0 && (
                <View style={styles.itemsSection}>
                  <View style={styles.itemsHeader}>
                    <Text style={styles.sectionLabel}>Gedetecteerde items:</Text>
                    <Text style={styles.selectedCount}>
                      {selectedItems.size} van {parsedItems.length} geselecteerd
                    </Text>
                  </View>
                  {parsedItems.map((item, index) => {
                    const isSelected = selectedItems.has(index);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.itemCard,
                          isSelected && styles.itemCardSelected,
                        ]}
                        onPress={() => toggleItemSelection(index)}
                      >
                        <View style={styles.checkbox}>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={20} color="#047857" />
                          )}
                          {!isSelected && (
                            <Ionicons name="ellipse-outline" size={20} color="#94a3b8" />
                          )}
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <View style={styles.itemMeta}>
                            {item.quantity && (
                              <Text style={styles.itemMetaText}>Hoeveelheid: {item.quantity}</Text>
                            )}
                            {item.price && (
                              <Text style={styles.itemMetaText}>€{item.price.toFixed(2)}</Text>
                            )}
                            {item.category && (
                              <Text style={styles.itemMetaText}>{getCategoryLabel(item.category)}</Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {parsedItems.length > 0 && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowModal(false);
                    setReceiptImage(null);
                    setParsedItems([]);
                    setSelectedItems(new Set());
                    setOcrText('');
                  }}
                  disabled={processing}
                >
                  <Text style={styles.modalButtonTextCancel}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalButtonConfirm,
                    selectedItems.size === 0 && styles.modalButtonDisabled,
                  ]}
                  onPress={handleConfirmAdd}
                  disabled={processing || selectedItems.size === 0}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color="#fff" />
                      <Text style={styles.modalButtonTextConfirm}>
                        {selectedItems.size} {selectedItems.size === 1 ? 'item toevoegen' : 'items toevoegen'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
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
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#065f46',
  },
  modalScroll: {
    flex: 1,
  },
  imageContainer: {
    padding: 20,
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    maxWidth: 400,
    height: 300,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
  },
  processingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  processingSubtext: {
    fontSize: 13,
    color: '#64748b',
  },
  itemsSection: {
    padding: 20,
    gap: 12,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedCount: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  itemCardSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#047857',
    borderWidth: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
  itemMeta: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  itemMetaText: {
    fontSize: 12,
    color: '#64748b',
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
  },
  modalButtonDisabled: {
    opacity: 0.5,
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


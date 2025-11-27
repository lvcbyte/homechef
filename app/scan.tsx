import { Ionicons } from '@expo/vector-icons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../constants/categories';

interface LocalPhoto {
  id: string;
  preview: string;
}

interface CatalogMatch {
  id: string;
  product_name: string;
  brand: string | null;
  category: string;
  barcode: string | null;
  price: number | null;
  unit_size: string | null;
  image_url: string | null;
  source?: string | null;
  match_score?: number | null;
}

const QUANTITY_UNITS = ['pieces', 'kg', 'g', 'liter', 'ml', 'bunch', 'pack', 'box'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getStoreLabel = (source?: string | null) => {
  if (!source) return 'Albert Heijn';
  const storeMap: Record<string, string> = {
    'albert-heijn': 'Albert Heijn',
    'colruyt': 'Colruyt',
    'lidl': 'Lidl',
    'aldi': 'Aldi',
    'delhaize': 'Delhaize',
    'carrefour': 'Carrefour',
    'jumbo': 'Jumbo',
    'open-food-facts': 'Open Food Facts',
  };
  return storeMap[source] || source;
};

const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const getMonthCalendar = (offset: number) => {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  
  // Get first day of month and what day of week it is (0 = Sunday, 1 = Monday, etc.)
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
  // Convert to Monday = 0
  const firstDayMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  
  // Get number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Get days from previous month to fill first week
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();
  const prevMonthDays: (Date | null)[] = [];
  for (let i = firstDayMonday - 1; i >= 0; i--) {
    prevMonthDays.push(new Date(year, month - 1, daysInPrevMonth - i));
  }
  
  // Get all days in current month
  const currentMonthDays: Date[] = [];
  const now = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    // Only include future dates for current month (offset === 0)
    if (offset === 0 && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      currentMonthDays.push(null as any);
    } else {
      currentMonthDays.push(date);
    }
  }
  
  // Get days from next month to fill last week
  const totalCells = prevMonthDays.length + currentMonthDays.length;
  const remainingCells = 42 - totalCells; // 6 weeks * 7 days
  const nextMonthDays: (Date | null)[] = [];
  for (let i = 1; i <= Math.min(remainingCells, 7); i++) {
    nextMonthDays.push(new Date(year, month + 1, i));
  }
  
  return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
};

const formatDisplayDate = (date: Date | null) => {
  if (!date) return 'Geen datum geselecteerd';
  return `${MONTH_LABELS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const getMonthMeta = (offset: number) => {
  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return {
    label: `${MONTH_LABELS[target.getMonth()]} ${target.getFullYear()}`,
    monthIndex: target.getMonth(),
    year: target.getFullYear(),
  };
};

const isSameDay = (a: Date | null, b: Date | null) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export default function ScanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<LocalPhoto[]>([]);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [hasScannerPermission, setHasScannerPermission] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('pantry');
  const [manualQuantityValue, setManualQuantityValue] = useState('');
  const [manualUnit, setManualUnit] = useState('pieces');
  const [manualExpiryDate, setManualExpiryDate] = useState<Date | null>(null);
  const [expiryMonthOffset, setExpiryMonthOffset] = useState(0);
  const [manualIsFood, setManualIsFood] = useState(true);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualStep, setManualStep] = useState(0);
  const [productMatches, setProductMatches] = useState<CatalogMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<CatalogMatch | null>(null);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const [categoryLocked, setCategoryLocked] = useState(false);
  const visibleMonthCalendar = useMemo(
    () => getMonthCalendar(expiryMonthOffset),
    [expiryMonthOffset]
  );
  const currentMonthMeta = useMemo(
    () => getMonthMeta(expiryMonthOffset),
    [expiryMonthOffset]
  );
  const dayCellSize = useMemo(() => {
    const horizontalPadding = 48; // ScrollView padding (24) on both sides
    const gap = 8;
    const columns = 7;
    const availableWidth = Math.max(windowWidth - horizontalPadding - gap * (columns - 1), 280);
    return Math.max(Math.min(availableWidth / columns, 60), 42);
  }, [windowWidth]);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) =>
      setHasScannerPermission(status === 'granted')
    );
    ImagePicker.requestCameraPermissionsAsync();
  }, []);

  const ensureAuth = () => {
    if (!user) {
      router.push('/auth/sign-in');
      return false;
    }
    return true;
  };

  const ensureSession = async () => {
    if (!ensureAuth() || !user) return null;
    if (sessionId) return sessionId;
    const { data, error } = await supabase
      .from('scan_sessions')
      .insert({ user_id: user.id, processed_status: 'pending' })
      .select('id')
      .single();
    if (error || !data) {
      Alert.alert('Fout', 'Kon geen scansessie starten.');
      return null;
    }
    setSessionId(data.id);
    return data.id;
  };

  const handleBarcode = async ({ data: ean }: { data: string }) => {
    if (!user) return;
    const targetSession = await ensureSession();
    if (!targetSession) return;
    
    // Normalize barcode (remove spaces, ensure it's a string)
    const normalizedBarcode = String(ean).trim().replace(/\s/g, '');
    
    // Save barcode scan
    const { error: scanError } = await supabase.from('barcode_scans').insert({
      user_id: user.id,
      ean: normalizedBarcode,
      session_id: targetSession,
    });
    
    if (scanError) {
      console.error('Error saving barcode scan:', scanError);
    }
    
    // Try to match with product catalog
    const { data: catalogMatch, error: matchError } = await supabase.rpc('match_product_by_barcode', { 
      barcode: normalizedBarcode 
    });
    
    if (catalogMatch && !matchError) {
      // Product found in catalog - add to inventory
      const { error: insertError } = await supabase.from('inventory').insert({
        user_id: user.id,
        name: catalogMatch.product_name,
        category: catalogMatch.category,
        quantity_approx: catalogMatch.unit_size || null,
        confidence_score: 0.98,
        catalog_product_id: catalogMatch.id,
        catalog_price: catalogMatch.price || null,
        catalog_image_url: catalogMatch.image_url || null,
      });
      
      if (insertError) {
        Alert.alert('Fout', `Kon product niet toevoegen: ${insertError.message}`);
      } else {
        Alert.alert('Toegevoegd', `${catalogMatch.product_name} is toegevoegd aan je voorraad.`);
      }
    } else {
      // Product not found - just save the barcode
      Alert.alert('Barcode opgeslagen', `EAN ${normalizedBarcode} is opgeslagen. Product niet gevonden in catalogus.`);
    }
    
    setBarcodeMode(false);
  };

  const handlePhotoCapture = async () => {
    const session = await ensureSession();
    if (!session || !user) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);
    const filePath = `${user.id}/${session}/${Date.now()}.jpg`;
    const file = await fetch(asset.uri).then((res) => res.blob());
    const { error } = await supabase.storage
      .from('inventory-scans')
      .upload(filePath, file, { contentType: 'image/jpeg' });

    if (error) {
      Alert.alert('Upload mislukt', error.message);
    } else {
      await supabase.from('scan_photos').insert({
        session_id: session,
        storage_path: filePath,
      });
      setCapturedPhotos((prev) => [...prev, { id: filePath, preview: asset.uri }]);
    }
    setUploading(false);
  };

  const detectCategory = async (name: string) => {
    const { data } = await supabase.rpc('detect_category', { item_name: name });
    const suggestion = data?.[0];
    if (!categoryLocked) {
      setManualCategory(suggestion?.category ?? 'pantry');
    }
    setManualIsFood(suggestion?.is_food ?? true);
  };

  const startManualWizard = async () => {
    if (!ensureAuth()) return;
    await ensureSession();
    setManualName('');
    setManualCategory('pantry');
    setManualQuantityValue('');
    setManualUnit('pieces');
    setManualExpiryDate(null);
    setExpiryMonthOffset(0);
    setManualIsFood(true);
    setManualStep(0);
    setManualModalVisible(true);
    setProductMatches([]);
    setSelectedMatch(null);
    setCategoryLocked(false);
  };

  const handleManualAdd = async (expiryOverride?: Date | null) => {
    if (!ensureAuth() || !user) return;
    if (!manualName) {
      Alert.alert('Ontbrekende naam', 'Geef het item een naam.');
      return;
    }

    let expires: string | null = null;
    let quantityLabel: string;
    let catalogPrice: number | null = null;
    let catalogImageUrl: string | null = null;

    // If we have a catalog match, use its data and auto-calculate expiry
    if (selectedMatch) {
      // Get expiry date from FAVV/HACCP estimation
      const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
        category_slug: selectedMatch.category || manualCategory || 'pantry',
      });
      if (expiryError) {
        console.error('Error estimating expiry:', expiryError);
        // Fallback: add 7 days if RPC fails
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 7);
        expires = fallbackDate.toISOString();
      } else if (expiryData) {
        // RPC returns timestamptz as string
        expires = expiryData;
      }

      // Use quantity from catalog (unit_size) or default to 1
      quantityLabel = selectedMatch.unit_size || '1 piece';
      catalogPrice = selectedMatch.price || null;
      catalogImageUrl = selectedMatch.image_url || null;
    } else {
      // Manual entry: use user input
      const selectedExpiryRaw =
        typeof expiryOverride !== 'undefined' ? expiryOverride : manualExpiryDate;
      const selectedExpiry =
        selectedExpiryRaw instanceof Date
          ? selectedExpiryRaw
          : selectedExpiryRaw
          ? new Date(selectedExpiryRaw)
          : null;
      expires = selectedExpiry ? selectedExpiry.toISOString() : null;
      quantityLabel = manualQuantityValue ? `${manualQuantityValue} ${manualUnit}` : manualUnit;
    }

    const { error: insertError } = await supabase.from('inventory').insert({
      user_id: user.id,
      name: selectedMatch?.product_name || manualName,
      category: selectedMatch?.category || manualCategory || 'pantry',
      quantity_approx: quantityLabel,
      confidence_score: 1,
      expires_at: expires,
      catalog_product_id: selectedMatch?.id ?? null,
      catalog_price: catalogPrice,
      catalog_image_url: catalogImageUrl,
    });

    if (insertError) {
      console.error('Error adding item:', insertError);
      Alert.alert('Fout', `Kon item niet toevoegen: ${insertError.message}`);
      return;
    }

    setManualName('');
    setManualCategory('pantry');
    setManualQuantityValue('');
    setManualUnit('pieces');
    setManualExpiryDate(null);
    setExpiryMonthOffset(0);
    setManualIsFood(true);
    setManualModalVisible(false);
    setProductMatches([]);
    setSelectedMatch(null);
    setCategoryLocked(false);
    Alert.alert('Toegevoegd', 'Het item is aan je voorraad toegevoegd.');
  };

  useEffect(() => {
    if (!manualName || manualName.length < 2) {
      setProductMatches([]);
      setSelectedMatch(null);
      setProductLookupLoading(false);
      return;
    }
    
    // Debounce search for better performance (300ms delay)
    const timeoutId = setTimeout(() => {
      let active = true;
      setProductLookupLoading(true);
      
      // Use RPC with explicit error handling for Vercel compatibility
      supabase
        .rpc('match_product_catalog', { search_term: manualName.trim() })
        .then(({ data, error }) => {
          if (!active) return;
          
          if (error) {
            console.error('Search error:', error);
            setProductMatches([]);
            setSelectedMatch(null);
            return;
          }
          
          if (data && data.length > 0) {
            const matches = data as CatalogMatch[];
            // Results are already sorted by match_score from the RPC function
            // Limit to maximum 10 results
            const limitedMatches = matches.slice(0, 10);
            setProductMatches(limitedMatches);
            
            // Auto-select best match (first one, already sorted by score)
            if (!selectedMatch && limitedMatches.length > 0) {
              setSelectedMatch(limitedMatches[0]);
              if (!categoryLocked) {
                setManualCategory(limitedMatches[0].category ?? 'pantry');
              }
            }
          } else {
            setProductMatches([]);
            setSelectedMatch(null);
          }
        })
        .catch((err) => {
          console.error('Search exception:', err);
          if (active) {
            setProductMatches([]);
            setSelectedMatch(null);
          }
        })
        .finally(() => {
          if (active) setProductLookupLoading(false);
        });
      
      return () => {
        active = false;
      };
    }, 300); // 300ms debounce
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [manualName, categoryLocked]);

  const renderAuthCTA = () => (
    <View style={styles.authCard}>
      <Text style={styles.heroTitle}>Activeer je Stockpit</Text>
      <Text style={styles.heroSubtitle}>Log in om barcodes, shelf shots en snelle invoer te combineren.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/auth/sign-in')}>
        <Text style={styles.primaryButtonText}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/auth/sign-up')}>
        <Text style={styles.secondaryText}>Account maken</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <Text style={styles.brandLabel}>HomeChef OS</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => router.push('/inventory')} style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color="#0f172a" />
              <Text style={styles.backLabel}>Voorraad</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>STOCKPIT</Text>
            <Text style={styles.heroSubtitle}>Pick your lane</Text>
            <Text style={styles.heroDescription}>
              De Stockpit voor merkproducten en packaged goods
            </Text>
          </View>

          {!user ? (
            renderAuthCTA()
          ) : (
            <>
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={async () => {
                    if (!ensureAuth()) return;
                    const session = await ensureSession();
                    if (!session) return;
                    
                    // Request permission if not yet checked
                    if (hasScannerPermission === null) {
                      const { status } = await BarCodeScanner.requestPermissionsAsync();
                      setHasScannerPermission(status === 'granted');
                      if (status !== 'granted') {
                        Alert.alert('Geen camera toegang', 'Sta camera toegang toe in je instellingen.');
                        return;
                      }
                    }
                    
                    if (hasScannerPermission === false) {
                      Alert.alert('Geen camera toegang', 'Sta camera toegang toe in je instellingen.');
                      return;
                    }
                    
                    setBarcodeMode(true);
                  }}
                >
                  <Ionicons name="barcode-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Scan barcode</Text>
                    <Text style={styles.actionCopy}>
                      Richt je camera op EAN-codes, wij vullen metadata, merk en maat automatisch aan.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handlePhotoCapture}
                  disabled={uploading}
                >
                  <Ionicons name="camera-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Maak Shelf shot</Text>
                    <Text style={styles.actionCopy}>
                      {uploading ? 'Bezig met uploaden…' : 'Perfect voor groentelades, leftovers en mix-zones'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
                {capturedPhotos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                    {capturedPhotos.map((photo) => (
                      <Image key={photo.id} source={{ uri: photo.preview }} style={styles.photoThumb} />
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.section}>
                <TouchableOpacity 
                  style={styles.actionCard} 
                  onPress={startManualWizard}
                >
                  <Ionicons name="create-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Snelle invoer</Text>
                    <Text style={styles.actionCopy}>Drie stappen. Wij detecteren food vs non-food, categorie en opslagadvies.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <TouchableOpacity 
                  style={styles.actionCard} 
                  onPress={() => router.push('/recipes?create=true')}
                >
                  <Ionicons name="restaurant-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Recept toevoegen</Text>
                    <Text style={styles.actionCopy}>Deel je favoriete recepten met de community. Voeg ingrediënten, stappen en foto's toe.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {sessionId && (
                <View style={styles.sessionCard}>
                  <Text style={styles.sessionLabel}>Stockpit session ID</Text>
                  <Text style={styles.sessionValue}>{sessionId}</Text>
                  <Text style={styles.sessionCopy}>
                    Je Stockpit sessie wordt automatisch geprocessed zodra je klaar bent. Resultaten vind je in “Voorraad”.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <GlassDock />

      <Modal visible={barcodeMode} animationType="slide" onRequestClose={() => setBarcodeMode(false)}>
        <View style={styles.barcodeContainer}>
          {hasScannerPermission ? (
            <>
              <BarCodeScanner
                onBarCodeScanned={handleBarcode}
                style={{ flex: 1 }}
                barCodeTypes={[
                  BarCodeScanner.Constants.BarCodeType.ean13,
                  BarCodeScanner.Constants.BarCodeType.ean8,
                  BarCodeScanner.Constants.BarCodeType.upc_a,
                  BarCodeScanner.Constants.BarCodeType.upc_e,
                ]}
              />
              <View style={styles.barcodeOverlay}>
                <View style={styles.barcodeFrame} />
                <Pressable style={styles.closeOverlay} onPress={() => setBarcodeMode(false)}>
                  <View style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </View>
                  <Text style={styles.closeOverlayText}>Stop scannen</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.barcodePermissionPrompt}>
              <Ionicons name="camera-outline" size={64} color="#94a3b8" />
              <Text style={styles.permissionTitle}>Camera toegang vereist</Text>
              <Text style={styles.permissionText}>
                Sta camera toegang toe om barcodes te kunnen scannen.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={async () => {
                  const { status } = await BarCodeScanner.requestPermissionsAsync();
                  setHasScannerPermission(status === 'granted');
                  if (status !== 'granted') {
                    Alert.alert('Geen toegang', 'Camera toegang is vereist om barcodes te scannen.');
                  }
                }}
              >
                <Text style={styles.permissionButtonText}>Toegang verlenen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionCancelButton}
                onPress={() => setBarcodeMode(false)}
              >
                <Text style={styles.permissionCancelText}>Annuleren</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {manualStep === 0 && (
              <>
                <Text style={styles.modalTitle}>Wat voeg je toe?</Text>
                <TextInput
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="bijv. verse koriander"
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                />
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={async () => {
                    if (!manualName) return;
                    
                    // If a catalog match is selected, save directly
                    if (selectedMatch) {
                      await handleManualAdd();
                      return;
                    }
                    
                    // Otherwise, continue with manual entry flow
                    await detectCategory(manualName);
                    setManualStep(1);
                  }}
                >
                  <Text style={styles.modalButtonText}>
                    {selectedMatch ? 'Toevoegen aan voorraad' : 'Doorgaan'}
                  </Text>
                </TouchableOpacity>
                {productLookupLoading && (
                  <View style={styles.lookupRow}>
                    <ActivityIndicator color="#047857" size="small" />
                    <Text style={styles.lookupText}>Zoeken in onze catalogus…</Text>
                  </View>
                )}
                {productMatches.length > 0 && (
                  <View style={styles.matchesContainer}>
                    <Text style={styles.matchesTitle}>
                      {productMatches.length} match{productMatches.length > 1 ? 'es' : ''} gevonden
                    </Text>
                    <ScrollView style={styles.matchesList} showsVerticalScrollIndicator={false}>
                      {productMatches.map((match, index) => {
                        const isSelected = selectedMatch?.id === match.id;
                        return (
                          <Pressable
                            key={match.id || index}
                            style={[styles.matchCard, isSelected && styles.matchCardSelected]}
                            onPress={() => {
                              if (isSelected) {
                                // Deselect if already selected
                                setSelectedMatch(null);
                              } else {
                                // Select this match
                                setSelectedMatch(match);
                                if (!categoryLocked) {
                                  setManualCategory(match.category ?? 'pantry');
                                }
                              }
                            }}
                          >
                            {match.image_url ? (
                              <Image source={{ uri: match.image_url }} style={styles.matchImage} />
                            ) : (
                              <View style={styles.matchPlaceholder}>
                                <Ionicons name="image" size={22} color="#94a3b8" />
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.matchName}>{match.product_name}</Text>
                              <Text style={styles.matchBrand}>{match.brand ?? 'Onbekend merk'}</Text>
                              <Text style={styles.matchMeta}>
                                {match.price ? `€${match.price.toFixed(2)}` : 'Prijs n.v.t.'} ·{' '}
                                {match.unit_size ?? 'Maat n.v.t.'}
                              </Text>
                              <Text style={styles.matchMeta}>
                                {getCategoryLabel(match.category)} · {getStoreLabel(match.source)}
                              </Text>
                            </View>
                            {isSelected ? (
                              <Ionicons name="checkmark-circle" size={22} color="#047857" />
                            ) : (
                              <Ionicons name="ellipse-outline" size={22} color="#94a3b8" />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            {manualStep === 1 && (
              <>
                <Text style={styles.modalTitle}>Kies een Stockpit lane</Text>
                <Text style={styles.modalCopy}>
                  {manualCategory
                    ? `Gedetecteerd: ${getCategoryLabel(manualCategory)} (${manualIsFood ? 'voeding' : 'non-food'})`
                    : 'Kies de categorie die het beste bij dit item past.'}
                </Text>
                <View style={styles.categoryGrid}>
                  {CATEGORY_OPTIONS.map((category) => {
                    const isActive = manualCategory === category.id;
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => {
                          setManualCategory(category.id);
                          setCategoryLocked(true);
                        }}
                        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      >
                        <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                          {category.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TouchableOpacity style={styles.modalButton} onPress={() => setManualStep(2)}>
                  <Text style={styles.modalButtonText}>Doorgaan</Text>
                </TouchableOpacity>
              </>
            )}

            {manualStep === 2 && (
              <>
                <Text style={styles.modalTitle}>Hoeveel heb je?</Text>
                <TextInput
                  value={manualQuantityValue}
                  onChangeText={setManualQuantityValue}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                />
                <View style={styles.unitRow}>
                  {QUANTITY_UNITS.map((unit) => {
                    const active = manualUnit === unit;
                    return (
                      <Pressable
                        key={unit}
                        style={[styles.unitChip, active && styles.unitChipActive]}
                        onPress={() => setManualUnit(unit)}
                      >
                        <Text style={[styles.unitChipText, active && styles.unitChipTextActive]}>{unit}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TouchableOpacity style={styles.modalButton} onPress={() => setManualStep(3)}>
                  <Text style={styles.modalButtonText}>Doorgaan</Text>
                </TouchableOpacity>
              </>
            )}

            {manualStep === 3 && (
              <>
                <Text style={styles.modalTitle}>Vervaldatum</Text>
                <Text style={styles.modalCopy}>{formatDisplayDate(manualExpiryDate)}</Text>
                <View style={styles.monthNav}>
                  <Pressable
                    style={[styles.monthPill, expiryMonthOffset === 0 && styles.monthPillDisabled]}
                    disabled={expiryMonthOffset === 0}
                    onPress={() => setExpiryMonthOffset((prev) => Math.max(prev - 1, 0))}
                  >
                    <Ionicons name="chevron-back" size={18} color="#0f172a" />
                  </Pressable>
                  <Text style={styles.monthLabel}>{currentMonthMeta.label}</Text>
                  <Pressable
                    style={styles.monthPill}
                    onPress={() => setExpiryMonthOffset((prev) => Math.min(prev + 1, 5))}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#0f172a" />
                  </Pressable>
                </View>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((day) => (
                    <View key={day} style={styles.weekdayCell}>
                      <Text style={styles.weekdayText}>{day}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {visibleMonthCalendar.map((date, index) => {
                    if (!date) {
                      return <View key={`empty-${index}`} style={[styles.calendarDayCell, { width: dayCellSize, height: dayCellSize }]} />;
                    }
                    const isCurrentMonth = date.getMonth() === currentMonthMeta.monthIndex;
                    const isToday = isSameDay(date, new Date());
                    const isSelected = isSameDay(date, manualExpiryDate);
                    return (
                      <Pressable
                        key={date.toISOString()}
                        style={[
                          styles.calendarDayCell,
                          { width: dayCellSize, height: dayCellSize },
                          !isCurrentMonth && styles.calendarDayCellOtherMonth,
                          isToday && styles.calendarDayCellToday,
                          isSelected && styles.calendarDayCellSelected,
                        ]}
                        onPress={() => {
                          if (isCurrentMonth) {
                            setManualExpiryDate(date);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            !isCurrentMonth && styles.calendarDayTextOtherMonth,
                            isToday && styles.calendarDayTextToday,
                            isSelected && styles.calendarDayTextSelected,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, { opacity: manualExpiryDate ? 1 : 0.6 }]}
                  onPress={() => handleManualAdd()}
                  disabled={!manualExpiryDate}
                >
                  <Text style={styles.modalButtonText}>Opslaan in voorraad</Text>
                </TouchableOpacity>
                <Pressable style={styles.skipLink} onPress={() => handleManualAdd(null)}>
                  <Text style={styles.skipLinkText}>Datum overslaan</Text>
                </Pressable>
              </>
            )}

            <Pressable style={styles.modalSecondary} onPress={() => setManualModalVisible(false)}>
              <Text style={styles.modalSecondaryText}>Annuleren</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    flex: 1,
    paddingTop: 8,
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
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 24,
  },
  hero: {
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#047857',
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#047857',
    marginTop: 8,
  },
  heroDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSub: {
    fontSize: 13,
    color: '#94a3b8',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 16,
    backgroundColor: '#fff',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionCopy: {
    fontSize: 13,
    color: '#475569',
  },
  photoStrip: {
    marginTop: 12,
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: 18,
    marginRight: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#047857',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 15,
  },
  authCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 24,
    gap: 12,
  },
  sessionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 20,
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  sessionLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#047857',
    fontWeight: '700',
  },
  sessionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  sessionCopy: {
    fontSize: 13,
    color: '#475569',
  },
  barcodeContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  barcodeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#047857',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  closeOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeOverlayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  barcodePermissionPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  permissionText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  permissionCancelButton: {
    marginTop: 8,
  },
  permissionCancelText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 15,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalCopy: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  modalInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 15,
  },
  modalButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  lookupText: {
    fontSize: 13,
    color: '#475569',
  },
  matchesContainer: {
    marginTop: 12,
  },
  matchesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  matchesList: {
    maxHeight: 300,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  matchCardSelected: {
    borderColor: '#047857',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  matchImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  matchPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  matchBrand: {
    fontSize: 12,
    color: '#475569',
  },
  matchMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  monthPill: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  monthPillDisabled: {
    opacity: 0.3,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarDayCell: {
    borderRadius: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayCellOtherMonth: {
    opacity: 0.3,
  },
  calendarDayCellToday: {
    backgroundColor: '#f0fdf4',
  },
  calendarDayCellSelected: {
    backgroundColor: '#047857',
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  calendarDayTextOtherMonth: {
    color: '#94a3b8',
  },
  calendarDayTextToday: {
    color: '#047857',
    fontWeight: '700',
  },
  calendarDayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  unitChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  unitChipText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  unitChipTextActive: {
    color: '#fff',
  },
  modalSecondary: {
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: '#64748b',
    fontWeight: '600',
  },
  skipLink: {
    marginTop: 8,
    alignItems: 'center',
  },
  skipLinkText: {
    color: '#0f172a',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});


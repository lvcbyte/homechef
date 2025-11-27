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

const getMonthDates = (offset: number) => {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(year, month, index + 1);
    if (offset === 0 && date < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return null;
    }
    return date;
  }).filter(Boolean) as Date[];
};

const formatDisplayDate = (date: Date | null) => {
  if (!date) return 'No date selected';
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
  const [productMatch, setProductMatch] = useState<CatalogMatch | null>(null);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const [categoryLocked, setCategoryLocked] = useState(false);
  const visibleMonthDates = useMemo(
    () => getMonthDates(expiryMonthOffset),
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
    const targetSession = await ensureSession();
    if (!targetSession || !user) return;
    await supabase.from('barcode_scans').insert({
      user_id: user.id,
      ean,
    });
    const { data: catalogMatch } = await supabase.rpc('match_product_by_barcode', { barcode: ean });
    if (catalogMatch) {
      await supabase.from('inventory').insert({
        user_id: user.id,
        name: catalogMatch.product_name,
        category: catalogMatch.category,
        quantity_approx: catalogMatch.unit_size,
        confidence_score: 0.98,
        catalog_product_id: catalogMatch.id,
      });
      Alert.alert('Stockpit update', `${catalogMatch.product_name} is toegevoegd aan je voorraad.`);
    } else {
      Alert.alert('Barcode opgeslagen', `EAN ${ean} is toegevoegd aan de sessie.`);
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
    setProductMatch(null);
    setCategoryLocked(false);
  };

  const handleManualAdd = async (expiryOverride?: Date | null) => {
    if (!ensureAuth() || !user) return;
    if (!manualName) {
      Alert.alert('Ontbrekende naam', 'Geef het item een naam.');
      return;
    }
    const selectedExpiryRaw =
      typeof expiryOverride !== 'undefined' ? expiryOverride : manualExpiryDate;
    const selectedExpiry =
      selectedExpiryRaw instanceof Date
        ? selectedExpiryRaw
        : selectedExpiryRaw
        ? new Date(selectedExpiryRaw)
        : null;
    const expires = selectedExpiry ? selectedExpiry.toISOString() : null;
    const quantityLabel = manualQuantityValue ? `${manualQuantityValue} ${manualUnit}` : manualUnit;
    await supabase.from('inventory').insert({
      user_id: user.id,
      name: manualName,
      category: manualCategory || 'pantry',
      quantity_approx: quantityLabel,
      confidence_score: 1,
      expires_at: expires,
      catalog_product_id: productMatch?.id ?? null,
    });
    setManualName('');
    setManualCategory('pantry');
    setManualQuantityValue('');
    setManualUnit('pieces');
    setManualExpiryDate(null);
    setExpiryMonthOffset(0);
    setManualIsFood(true);
    setManualModalVisible(false);
    setProductMatch(null);
    setCategoryLocked(false);
    Alert.alert('Toegevoegd', 'Het item is aan je voorraad toegevoegd.');
  };

  useEffect(() => {
    if (!manualName || manualName.length < 3) {
      setProductMatch(null);
      return;
    }
    let active = true;
    setProductLookupLoading(true);
    supabase
      .rpc('match_product_catalog', { search_term: manualName })
      .then(({ data }) => {
        if (!active) return;
        if (data && data.length > 0) {
          const match = data[0] as CatalogMatch;
          setProductMatch(match);
          if (!categoryLocked) {
            setManualCategory(match.category ?? 'pantry');
          }
        } else {
          setProductMatch(null);
        }
      })
      .finally(() => {
        if (active) setProductLookupLoading(false);
      });
    return () => {
      active = false;
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
              <Text style={styles.backLabel}>Inventory</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>Stockpit cockpit</Text>
            <Text style={styles.heroTitle}>Drie kanalen in je Stockpit.</Text>
            <Text style={styles.heroSubtitle}>
              Start vanuit barcodes, shelf shots of snelle invoer. Alles komt samen in dezelfde Stockpit sessie.
            </Text>
          </View>

          {!user ? (
            renderAuthCTA()
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lane 1 · Barcodes</Text>
                <Text style={styles.sectionSub}>De Stockpit voor merkproducten en packaged goods</Text>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={async () => {
                    if (!ensureAuth()) return;
                    const session = await ensureSession();
                    if (!session) return;
                    if (hasScannerPermission === false) {
                      Alert.alert('Geen camera toegang', 'Sta camera toegang toe in je instellingen.');
                      return;
                    }
                    setBarcodeMode(true);
                  }}
                >
                  <Ionicons name="barcode-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Open Barcode lane</Text>
                    <Text style={styles.actionCopy}>
                      Richt je camera op EAN-codes, wij vullen metadata, merk en maat automatisch aan.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lane 2 · Shelf shots</Text>
                <Text style={styles.sectionSub}>Perfect voor groentelades, leftovers en mix-zones</Text>
                <TouchableOpacity
                  style={[styles.actionCard, { backgroundColor: '#f0fdf4' }]}
                  onPress={handlePhotoCapture}
                  disabled={uploading}
                >
                  <Ionicons name="camera-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Maak Shelf shot</Text>
                    <Text style={styles.actionCopy}>
                      {uploading ? 'Bezig met uploaden…' : 'Max. 5 foto’s per sessie, wij slaan ze versleuteld op.'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                  {capturedPhotos.map((photo) => (
                    <Image key={photo.id} source={{ uri: photo.preview }} style={styles.photoThumb} />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lane 3 · Quick entry</Text>
                <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#fff' }]} onPress={startManualWizard}>
                  <Ionicons name="create-outline" size={24} color="#047857" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>Launch quick entry</Text>
                    <Text style={styles.actionCopy}>Drie stappen. Wij detecteren food vs non-food, categorie en opslagadvies.</Text>
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

      <Modal visible={barcodeMode} animationType="slide">
        <View style={styles.barcodeContainer}>
          <BarCodeScanner
            onBarCodeScanned={handleBarcode}
            style={{ flex: 1 }}
            barCodeTypes={[BarCodeScanner.Constants.BarCodeType.ean13]}
          />
          <Pressable style={styles.closeOverlay} onPress={() => setBarcodeMode(false)}>
            <Text style={styles.closeOverlayText}>Stop scannen</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={manualModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {manualStep === 0 && (
              <>
                <Text style={styles.modalTitle}>What are you adding?</Text>
                <TextInput
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="e.g. fresh cilantro"
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                />
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={async () => {
                    if (!manualName) return;
                    await detectCategory(manualName);
                    setManualStep(1);
                  }}
                >
                  <Text style={styles.modalButtonText}>Continue</Text>
                </TouchableOpacity>
                {productLookupLoading && (
                  <View style={styles.lookupRow}>
                    <ActivityIndicator color="#047857" size="small" />
                    <Text style={styles.lookupText}>Searching Albert Heijn catalog…</Text>
                  </View>
                )}
                {productMatch && (
                  <View style={styles.matchCard}>
                    {productMatch.image_url ? (
                      <Image source={{ uri: productMatch.image_url }} style={styles.matchImage} />
                    ) : (
                      <View style={styles.matchPlaceholder}>
                        <Ionicons name="image" size={22} color="#94a3b8" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchName}>{productMatch.product_name}</Text>
                      <Text style={styles.matchBrand}>{productMatch.brand ?? 'Unknown brand'}</Text>
                      <Text style={styles.matchMeta}>
                        {productMatch.price ? `€${productMatch.price.toFixed(2)}` : 'Price n/a'} ·{' '}
                        {productMatch.unit_size ?? 'Size n/a'}
                      </Text>
                      <Text style={styles.matchMeta}>{getCategoryLabel(productMatch.category)}</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color="#047857" />
                  </View>
                )}
              </>
            )}

            {manualStep === 1 && (
              <>
                <Text style={styles.modalTitle}>Choose a Stockpit lane</Text>
                <Text style={styles.modalCopy}>
                  {manualCategory
                    ? `Detected ${getCategoryLabel(manualCategory)} (${manualIsFood ? 'food' : 'non-food'})`
                    : 'Pick the category that fits this item best.'}
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
                  <Text style={styles.modalButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}

            {manualStep === 2 && (
              <>
                <Text style={styles.modalTitle}>How much do you have?</Text>
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
                  <Text style={styles.modalButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            )}

            {manualStep === 3 && (
              <>
                <Text style={styles.modalTitle}>Expiry date</Text>
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
                <View style={styles.dayGrid}>
                  {visibleMonthDates.map((date) => (
                    <Pressable
                      key={date.toISOString()}
                      style={[
                        styles.dayCell,
                        { width: dayCellSize, height: dayCellSize },
                        isSameDay(date, manualExpiryDate) && styles.dayCellActive,
                      ]}
                      onPress={() => setManualExpiryDate(date)}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isSameDay(date, manualExpiryDate) && styles.dayCellTextActive,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, { opacity: manualExpiryDate ? 1 : 0.6 }]}
                  onPress={() => handleManualAdd()}
                  disabled={!manualExpiryDate}
                >
                  <Text style={styles.modalButtonText}>Save to inventory</Text>
                </TouchableOpacity>
                <Pressable style={styles.skipLink} onPress={() => handleManualAdd(null)}>
                  <Text style={styles.skipLinkText}>Skip date</Text>
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
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
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
  closeOverlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  closeOverlayText: {
    color: '#fff',
    fontWeight: '600',
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
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    borderRadius: 18,
    padding: 12,
    marginTop: 12,
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
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    justifyContent: 'center',
    gap: 8,
  },
  dayCell: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  dayCellText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayCellTextActive: {
    color: '#fff',
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


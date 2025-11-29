import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { navigateToRoute } from '../utils/navigation';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { StockpitLoader } from '../components/glass/StockpitLoader';
import { useAuth } from '../contexts/AuthContext';

// QuaggaScanner will be loaded dynamically only on web
// This prevents native builds from trying to load web-only dependencies
import { supabase } from '../lib/supabase';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../constants/categories';
import { generateRecipeFromDescription, runInventoryScan } from '../services/ai';
import type { InventoryItem } from '../types/app';

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

const RECIPE_CATEGORIES = [
  'Comfort Food', 'Vlees', 'Vis', 'Feest', 'High Protein', 
  'Italiaans', 'Aziatisch', 'Plant-based', 'Budget', 'Quick',
  'Vegan', 'Vegetarian', 'Gezond', 'Dessert', 'Soep', 'Salade'
];

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
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<CatalogMatch | null>(null);
  const [scanningProduct, setScanningProduct] = useState(false);
  const [showScanAnimation, setShowScanAnimation] = useState(false);
  const scanAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const [QuaggaScannerComponent, setQuaggaScannerComponent] = useState<React.ComponentType<any> | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const scanningLineAnimation = useRef(new Animated.Value(0)).current;
  const [productDetailModalVisible, setProductDetailModalVisible] = useState(false);
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
  // Recipe creation states
  const [recipeModalVisible, setRecipeModalVisible] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [recipeCategory, setRecipeCategory] = useState('Comfort Food');
  const [recipeDescriptionText, setRecipeDescriptionText] = useState('');
  const [recipeGenerating, setRecipeGenerating] = useState(false);
  const [recipeGenerated, setRecipeGenerated] = useState<any>(null);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [savingMessage, setSavingMessage] = useState('');
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
    // Request camera permissions on mount
    if (permission && !permission.granted && !permission.canAskAgain) {
      // Permission was denied, can't ask again
    } else if (permission && !permission.granted) {
      requestPermission();
    }
    ImagePicker.requestCameraPermissionsAsync();
  }, [permission, requestPermission]);

  // Continuous scanning line animation
  useEffect(() => {
    if (barcodeMode && !showScanAnimation) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanningLineAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanningLineAnimation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [barcodeMode, showScanAnimation, scanningLineAnimation]);

  // Dynamically load QuaggaScanner only on web
  // Using .web.tsx extension ensures it's only loaded on web platform
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      import('../components/barcode/QuaggaScanner.web')
        .then((module) => {
          setQuaggaScannerComponent(() => module.QuaggaScanner);
        })
        .catch((error) => {
          console.warn('Failed to load QuaggaScanner:', error);
        });
    }
  }, []);

  const ensureAuth = () => {
    if (!user) {
      navigateToRoute(router, '/auth/sign-in');
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

  const handleBarcode = async (result: string | BarcodeScanningResult) => {
    // Handle both QuaggaJS (string) and expo-camera (BarcodeScanningResult) formats
    const ean = typeof result === 'string' ? result : result.data;
    console.log('Barcode scanned:', ean);
    
    // Prevent multiple scans of the same barcode
    if (scannedBarcode === ean || scanningProduct) {
      console.log('Skipping duplicate scan or already processing');
      return;
    }
    
    if (!user) {
      console.log('No user, skipping scan');
      return;
    }
    
    // Normalize barcode (remove spaces, ensure it's a string)
    const normalizedBarcode = String(ean).trim().replace(/\s/g, '');
    console.log('Normalized barcode:', normalizedBarcode);
    
    // Set scanned state to prevent duplicate scans
    setScannedBarcode(normalizedBarcode);
    setScanningProduct(true);
    
    // Start scan animation
    setShowScanAnimation(true);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scanAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnimation, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnimation, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 }
        ),
      ]),
    ]).start();
    
    // Don't close scanner immediately - keep it open to show animation
    
    try {
      const targetSession = await ensureSession();
      
      // Use enhanced barcode matching (like Yuka app)
      const { data: matchResult, error: matchError } = await supabase.rpc('match_product_by_barcode_enhanced', { 
        p_barcode: normalizedBarcode 
      });
      
      if (matchResult && matchResult.length > 0 && !matchError) {
        const catalogMatch = matchResult[0];
        
        // Log the scan with product info
        if (targetSession) {
          await supabase.rpc('log_barcode_scan', {
            p_user_id: user.id,
            p_barcode: normalizedBarcode,
            p_product_id: catalogMatch.id,
            p_product_name: catalogMatch.name,
            p_product_brand: catalogMatch.brand,
            p_match_confidence: catalogMatch.match_score,
          });
        }
        
        if (catalogMatch) {
          // Product found - show detail modal (Yuka-style)
          const product: CatalogMatch = {
            id: catalogMatch.id,
            product_name: catalogMatch.name || catalogMatch.product_name,
            brand: catalogMatch.brand,
            category: catalogMatch.category,
            barcode: catalogMatch.barcode || normalizedBarcode,
            price: (catalogMatch as any).price,
            unit_size: (catalogMatch as any).unit_size,
            image_url: catalogMatch.image_url,
            source: (catalogMatch as any).source,
          };
          setScannedProduct(product);
          // Stop animation
          setShowScanAnimation(false);
          scanAnimation.setValue(0);
          pulseAnimation.setValue(1);
          setBarcodeMode(false);
          setScanningProduct(false);
          
          // Show product detail modal for confirmation
          setProductDetailModalVisible(true);
        }
      } else {
        // Product not found - log scan anyway
        if (targetSession) {
          await supabase.rpc('log_barcode_scan', {
            p_user_id: user.id,
            p_barcode: normalizedBarcode,
            p_product_id: null,
            p_product_name: null,
            p_product_brand: null,
            p_match_confidence: null,
          });
        }
        
        // Product not found
        Alert.alert(
          'Product niet gevonden',
          `Barcode ${normalizedBarcode} is niet gevonden in onze catalogus. Je kunt het product handmatig toevoegen.`,
          [
            {
              text: 'Handmatig toevoegen',
              onPress: () => {
                setManualName('');
                setManualCategory('pantry');
                setManualModalVisible(true);
                setScannedBarcode(null);
                setScanningProduct(false);
              },
            },
            {
              text: 'OK',
              style: 'cancel',
              onPress: () => {
                setScannedBarcode(null);
                setScanningProduct(false);
                setShowScanAnimation(false);
                scanAnimation.setValue(0);
                pulseAnimation.setValue(1);
              },
            },
          ]
        );
        // Stop animation
        setShowScanAnimation(false);
        scanAnimation.setValue(0);
        pulseAnimation.setValue(1);
      }
    } catch (error) {
      console.error('Error handling barcode:', error);
      Alert.alert('Fout', `Er is een fout opgetreden bij het scannen van de barcode: ${error instanceof Error ? error.message : 'Onbekende fout'}`);
      setScannedBarcode(null);
      setScanningProduct(false);
      setShowScanAnimation(false);
      scanAnimation.setValue(0);
      pulseAnimation.setValue(1);
    }
  };

  const handleAddProductToInventory = async () => {
    if (!user || !scannedProduct) return;
    
    try {
      // Get expiry date from FAVV/HACCP estimation
      const { data: expiryData } = await supabase.rpc('estimate_expiry_date', {
        category_slug: scannedProduct.category || 'pantry',
      });
      
      const expires = expiryData ? expiryData : null;
      
      const { error: insertError } = await supabase.from('inventory').insert({
        user_id: user.id,
        name: scannedProduct.product_name,
        category: scannedProduct.category || 'pantry',
        quantity_approx: scannedProduct.unit_size || null,
        confidence_score: 0.98,
        catalog_product_id: scannedProduct.id,
        catalog_price: scannedProduct.price || null,
        catalog_image_url: scannedProduct.image_url || null,
        expires_at: expires,
      });
      
      if (insertError) {
        console.error('Error adding product:', insertError);
        Alert.alert('Fout', `Kon product niet toevoegen: ${insertError.message}`);
      } else {
        Alert.alert('Toegevoegd', `${scannedProduct.product_name} is toegevoegd aan je voorraad.`, [
          {
            text: 'OK',
            onPress: () => {
              setProductDetailModalVisible(false);
              setScannedProduct(null);
              setScannedBarcode(null);
              setScanningProduct(false);
              navigateToRoute(router, '/inventory');
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error adding product to inventory:', error);
      Alert.alert('Fout', 'Er is een fout opgetreden bij het toevoegen van het product.');
    }
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
      const { data: publicUrlData } = supabase.storage
        .from('inventory-scans')
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl;

      setCapturedPhotos((prev) => [...prev, { id: filePath, preview: asset.uri }]);

      if (publicUrl) {
        try {
          const detectedItems = await runInventoryScan([publicUrl]);
          await insertDetectedInventoryItems(detectedItems, 'shelf-scan');
        } catch (scanError) {
          console.error('Error running shelf scan AI:', scanError);
        }
      }
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

  const insertDetectedInventoryItems = async (items: InventoryItem[], contextLabel: string) => {
    if (!user || !items.length) return 0;

    let successCount = 0;
    for (const item of items) {
      try {
        const { data: detection } = await supabase.rpc('detect_category', { item_name: item.name });
        const suggestion = detection?.[0];
        const expiresAt = item.daysUntilExpiry
          ? new Date(Date.now() + item.daysUntilExpiry * 24 * 60 * 60 * 1000).toISOString()
          : null;
        const { error } = await supabase.from('inventory').insert({
          user_id: user.id,
          name: item.name,
          category: suggestion?.category ?? 'pantry',
          quantity_approx: item.quantityEstimate || null,
          confidence_score: 0.8,
          expires_at: expiresAt,
        });
        if (!error) {
          successCount += 1;
        }
      } catch (error) {
        console.error(`Error inserting detected item (${contextLabel}):`, error);
      }
    }

    if (successCount > 0) {
      Alert.alert('Shelf scan', `${successCount} items toegevoegd aan je voorraad.`);
    } else {
      Alert.alert('Shelf scan', 'Geen nieuwe items gedetecteerd. Probeer een duidelijke foto.');
    }

    return successCount;
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
      <Text style={styles.heroTitle}>Activeer je STOCKPIT</Text>
      <Text style={styles.heroSubtitle}>Log in om barcodes, shelf shots en snelle invoer te combineren.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigateToRoute(router, '/auth/sign-in')}>
        <Text style={styles.primaryButtonText}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigateToRoute(router, '/auth/sign-up')}>
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
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandLabel}>STOCKPIT</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => navigateToRoute(router, '/inventory')} style={styles.backButton}>
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
              De STOCKPIT voor merkproducten en packaged goods
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
                    
                    // Request permission if not granted
                    if (!permission?.granted) {
                      const result = await requestPermission();
                      if (!result.granted) {
                        Alert.alert('Geen camera toegang', 'Sta camera toegang toe in je instellingen.');
                        return;
                      }
                    }
                    
                    // Reset scan state
                    setScannedBarcode(null);
                    setScannedProduct(null);
                    setScanningProduct(false);
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
                  onPress={() => setRecipeModalVisible(true)}
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
                  <Text style={styles.sessionLabel}>STOCKPIT session ID</Text>
                  <Text style={styles.sessionValue}>{sessionId}</Text>
                  <Text style={styles.sessionCopy}>
                    Je STOCKPIT sessie wordt automatisch geprocessed zodra je klaar bent. Resultaten vind je in "Voorraad".
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <GlassDock />

      <Modal visible={barcodeMode} animationType="slide" onRequestClose={() => {
        setBarcodeMode(false);
        setScannedBarcode(null);
      }}>
        <View style={styles.barcodeContainer}>
          {Platform.OS === 'web' && QuaggaScannerComponent ? (
            // Use QuaggaJS for web
            <QuaggaScannerComponent
              onDetected={(code) => {
                if (!scannedBarcode && !scanningProduct) {
                  handleBarcode(code);
                }
              }}
              onError={(error) => {
                console.error('Quagga error:', error);
                Alert.alert('Camera fout', 'Kon camera niet starten. Controleer je browser instellingen.');
              }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : Platform.OS !== 'web' && permission?.granted ? (
            // Use expo-camera for native
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                    'code128',
                    'code39',
                    'qr',
                  ],
                }}
                onBarcodeScanned={scannedBarcode || scanningProduct ? undefined : (result) => handleBarcode(result)}
              />
            </>
          ) : null}
          
          {/* Overlay is shown for both web and native - pointer-events: none so it doesn't block camera */}
          {Platform.OS === 'web' || permission?.granted ? (
            <View style={styles.barcodeOverlay} pointerEvents="box-none">
              <Animated.View 
                style={[
                  styles.barcodeFrame,
                  {
                    transform: [
                      { scale: pulseAnimation },
                    ],
                    opacity: scanAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, showScanAnimation ? 0.7 : 1],
                    }),
                  },
                ]}
                pointerEvents="none"
              >
                {/* Top-left corner */}
                <View style={[styles.barcodeCorner, styles.cornerTopLeft]} />
                {/* Top-right corner */}
                <View style={[styles.barcodeCorner, styles.cornerTopRight]} />
                {/* Bottom-left corner */}
                <View style={[styles.barcodeCorner, styles.cornerBottomLeft]} />
                {/* Bottom-right corner */}
                <View style={[styles.barcodeCorner, styles.cornerBottomRight]} />
                
                {/* Always visible scanning line animation */}
                {!showScanAnimation && (
                  <Animated.View
                    style={[
                      styles.scanningOverlay,
                      {
                        opacity: 0.8,
                        transform: [
                          {
                            translateY: scanningLineAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-140, 140],
                            }),
                          },
                        ],
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <View style={styles.scanningLine} />
                  </Animated.View>
                )}
                
                {/* Scanning animation overlay when barcode detected */}
                {showScanAnimation && (
                  <Animated.View
                    style={[
                      styles.scanningOverlay,
                      {
                        opacity: scanAnimation,
                        transform: [
                          {
                            translateY: scanAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-140, 140],
                            }),
                          },
                        ],
                      },
                    ]}
                    pointerEvents="none"
                  >
                    <View style={[styles.scanningLine, styles.scanningLineActive]} />
                  </Animated.View>
                )}
              </Animated.View>
              
              {showScanAnimation ? (
                <View style={styles.scanningStatus} pointerEvents="none">
                  <ActivityIndicator size="large" color="#047857" />
                  <Text style={styles.scanningText}>Barcode gedetecteerd...</Text>
                  <Text style={styles.scanningSubtext}>Product wordt opgezocht</Text>
                </View>
              ) : (
                <Text style={styles.barcodeHint} pointerEvents="none">Richt de camera op de barcode</Text>
              )}
              
              {/* Flash toggle button */}
              <Pressable
                style={styles.flashButton}
                onPress={() => setFlashEnabled(!flashEnabled)}
                pointerEvents="auto"
              >
                <View style={[styles.flashButtonInner, flashEnabled && styles.flashButtonActive]}>
                  <Ionicons 
                    name={flashEnabled ? "flash" : "flash-off"} 
                    size={24} 
                    color={flashEnabled ? "#047857" : "#fff"} 
                  />
                </View>
              </Pressable>
              
              {/* Close button */}
              <View style={styles.closeOverlay} pointerEvents="box-none">
                <Pressable 
                  onPress={() => {
                    setBarcodeMode(false);
                    setScannedBarcode(null);
                    setShowScanAnimation(false);
                    setFlashEnabled(false);
                    scanAnimation.setValue(0);
                    pulseAnimation.setValue(1);
                    scanningLineAnimation.setValue(0);
                  }}
                  disabled={showScanAnimation}
                  pointerEvents="auto"
                >
                  <View style={[styles.closeButton, showScanAnimation && styles.closeButtonDisabled]}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </View>
                  <Text style={styles.closeOverlayText}>Stop scannen</Text>
                </Pressable>
              </View>
            </View>
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
                  const result = await requestPermission();
                  if (!result.granted) {
                    Alert.alert('Geen toegang', 'Camera toegang is vereist om barcodes te scannen.');
                  }
                }}
              >
                <Text style={styles.permissionButtonText}>Toegang verlenen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionCancelButton}
                onPress={() => {
                  setBarcodeMode(false);
                  setScannedBarcode(null);
                }}
              >
                <Text style={styles.permissionCancelText}>Annuleren</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Product Detail Modal (Yuka-style) */}
      <Modal visible={productDetailModalVisible} transparent animationType="slide" onRequestClose={() => {
        setProductDetailModalVisible(false);
        setScannedProduct(null);
        setScannedBarcode(null);
        setScanningProduct(false);
      }}>
        <View style={styles.productDetailBackdrop}>
          <View style={styles.productDetailCard}>
            {scannedProduct && (
              <>
                <Pressable
                  style={styles.productDetailClose}
                  onPress={() => {
                    setProductDetailModalVisible(false);
                    setScannedProduct(null);
                    setScannedBarcode(null);
                    setScanningProduct(false);
                  }}
                >
                  <Ionicons name="close" size={24} color="#0f172a" />
                </Pressable>
                
                {scannedProduct.image_url ? (
                  <Image source={{ uri: scannedProduct.image_url }} style={styles.productDetailImage} />
                ) : (
                  <View style={styles.productDetailImagePlaceholder}>
                    <Ionicons name="image-outline" size={64} color="#94a3b8" />
                  </View>
                )}
                
                <View style={styles.productDetailContent}>
                  <Text style={styles.productDetailBrand}>{scannedProduct.brand || 'Onbekend merk'}</Text>
                  <Text style={styles.productDetailName}>{scannedProduct.product_name}</Text>
                  
                  <View style={styles.productDetailMeta}>
                    {scannedProduct.price && (
                      <View style={styles.productDetailMetaItem}>
                        <Ionicons name="pricetag-outline" size={18} color="#047857" />
                        <Text style={styles.productDetailMetaText}>€{scannedProduct.price.toFixed(2)}</Text>
                      </View>
                    )}
                    {scannedProduct.unit_size && (
                      <View style={styles.productDetailMetaItem}>
                        <Ionicons name="cube-outline" size={18} color="#047857" />
                        <Text style={styles.productDetailMetaText}>{scannedProduct.unit_size}</Text>
                      </View>
                    )}
                    <View style={styles.productDetailMetaItem}>
                      <Ionicons name="grid-outline" size={18} color="#047857" />
                      <Text style={styles.productDetailMetaText}>{getCategoryLabel(scannedProduct.category)}</Text>
                    </View>
                  </View>
                  
                  {scannedProduct.barcode && (
                    <View style={styles.productDetailBarcode}>
                      <Text style={styles.productDetailBarcodeLabel}>EAN</Text>
                      <Text style={styles.productDetailBarcodeValue}>{scannedProduct.barcode}</Text>
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={styles.productDetailAddButton}
                    onPress={handleAddProductToInventory}
                  >
                    <Ionicons name="add-circle" size={24} color="#fff" />
                    <Text style={styles.productDetailAddButtonText}>Toevoegen aan voorraad</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
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
                <Text style={styles.modalTitle}>Kies een STOCKPIT lane</Text>
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

      {/* Recipe Creation Modal */}
      <Modal visible={recipeModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Recept toevoegen</Text>
              
              {!recipeGenerated ? (
                <>
                  <Text style={styles.modalSubtitle}>
                    Beschrijf je recept of laat AI je helpen
                  </Text>
                  
                  <TextInput
                    value={recipeDescriptionText}
                    onChangeText={setRecipeDescriptionText}
                    placeholder="bijv. Een snelle pasta met kip en groenten, 30 minuten, makkelijk"
                    placeholderTextColor="#94a3b8"
                    style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
                    multiline
                  />
                  
                  <Text style={[styles.modalSubtitle, { marginTop: 16, marginBottom: 8 }]}>
                    Categorie
                  </Text>
                  <View style={styles.recipeCategoryRow}>
                    {RECIPE_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.recipeCategoryChip,
                          recipeCategory === cat && styles.recipeCategoryChipActive,
                        ]}
                        onPress={() => setRecipeCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.recipeCategoryChipText,
                            recipeCategory === cat && styles.recipeCategoryChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, { marginTop: 24, opacity: recipeGenerating ? 0.6 : 1 }]}
                    onPress={async () => {
                      if (!recipeDescriptionText.trim()) {
                        Alert.alert('Fout', 'Beschrijf je recept eerst');
                        return;
                      }
                      
                      setRecipeGenerating(true);
                      try {
                        const generated = await generateRecipeFromDescription(
                          recipeDescriptionText,
                          recipeCategory
                        );
                        
                        if (generated) {
                          setRecipeGenerated(generated);
                          setRecipeTitle(generated.name || '');
                          setRecipeDescription(generated.description || '');
                        } else {
                          Alert.alert('Fout', 'Kon recept niet genereren. Probeer het opnieuw.');
                        }
                      } catch (error) {
                        console.error('Error generating recipe:', error);
                        Alert.alert('Fout', 'Er is een fout opgetreden bij het genereren van het recept.');
                      } finally {
                        setRecipeGenerating(false);
                      }
                    }}
                    disabled={recipeGenerating}
                  >
                    {recipeGenerating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonText}>Genereer met AI</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {recipeGenerated.image_url && (
                    <Image
                      source={{ uri: recipeGenerated.image_url }}
                      style={{ width: '100%', height: 180, borderRadius: 20, marginBottom: 16 }}
                    />
                  )}
                  <View style={{ gap: 6, marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a' }}>
                      {recipeGenerated.name}
                    </Text>
                    <Text style={{ color: '#475569' }}>{recipeGenerated.description}</Text>
                    <Text style={{ color: '#047857', fontWeight: '600' }}>
                      {recipeGenerated.totalTime || 30} min • {recipeGenerated.difficulty || 'Gemiddeld'}
                    </Text>
                    {recipeGenerated.ingredients && recipeGenerated.ingredients.length > 0 && (
                      <View style={{ marginTop: 6, gap: 4 }}>
                        {recipeGenerated.ingredients.slice(0, 5).map((ing: any, idx: number) => (
                          <Text key={idx} style={{ color: '#475569' }}>
                            • {ing.quantity ? `${ing.quantity} ` : ''}{ing.unit ? `${ing.unit} ` : ''}{ing.name}
                          </Text>
                        ))}
                        {recipeGenerated.ingredients.length > 5 && (
                          <Text style={{ color: '#94a3b8' }}>
                            +{recipeGenerated.ingredients.length - 5} extra ingrediënten
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <TextInput
                    value={recipeTitle}
                    onChangeText={setRecipeTitle}
                    placeholder="Recept naam"
                    placeholderTextColor="#94a3b8"
                    style={styles.modalInput}
                  />
                  
                  <TextInput
                    value={recipeDescription}
                    onChangeText={setRecipeDescription}
                    placeholder="Beschrijving"
                    placeholderTextColor="#94a3b8"
                    style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    multiline
                  />
                  
                  {savingRecipe && (
                    <StockpitLoader
                      variant="inline"
                      message={savingMessage}
                      progress={savingProgress}
                    />
                  )}
                  <TouchableOpacity
                    style={[styles.modalButton, savingRecipe && { opacity: 0.6 }]}
                    disabled={savingRecipe}
                    onPress={async () => {
                      if (!recipeTitle.trim()) {
                        Alert.alert('Fout', 'Vul een recept naam in');
                        return;
                      }
                      
                      if (!user) {
                        Alert.alert('Fout', 'Je moet ingelogd zijn om recepten toe te voegen');
                        return;
                      }
                      if (savingRecipe) return;
                      setSavingRecipe(true);
                      setSavingProgress(0);
                      setSavingMessage('Recept opslaan...');
                      
                      try {
                        const ingredients = recipeGenerated.ingredients || [];
                        const instructions = (recipeGenerated.steps || []).map((inst: string, idx: number) => ({
                          step: idx + 1,
                          instruction: inst,
                        }));
                        
                        setSavingProgress(20);
                        setSavingMessage('Recept aanmaken in database...');
                        
                        const { data: newRecipeId, error } = await supabase.rpc('create_recipe', {
                          p_title: recipeTitle,
                          p_description: recipeDescription || null,
                          p_image_url: recipeGenerated.image_url || null,
                          p_prep_time_minutes: recipeGenerated.prepTime || 0,
                          p_cook_time_minutes: recipeGenerated.cookTime || 0,
                          p_total_time_minutes: recipeGenerated.totalTime || 30,
                          p_difficulty: recipeGenerated.difficulty || 'Gemiddeld',
                          p_servings: recipeGenerated.servings || 4,
                          p_ingredients: JSON.stringify(ingredients),
                          p_instructions: JSON.stringify(instructions),
                          p_tags: recipeGenerated.tags || [recipeCategory],
                          p_category: recipeCategory,
                          p_author: user.email?.split('@')[0] || 'Gebruiker',
                        });
                        
                        if (error) {
                          console.error('Error creating recipe:', error);
                          setSavingRecipe(false);
                          setSavingProgress(0);
                          Alert.alert('Fout', `Kon recept niet opslaan: ${error.message}`);
                          return;
                        }

                        if (!newRecipeId) {
                          console.error('No recipe ID returned');
                          setSavingRecipe(false);
                          setSavingProgress(0);
                          Alert.alert('Fout', 'Kon recept niet opslaan: Geen ID ontvangen');
                          return;
                        }
                        
                        setSavingProgress(50);
                        setSavingMessage('Recept toevoegen aan opgeslagen...');
                        
                        const recipePayload = {
                          id: newRecipeId,
                          title: recipeTitle,
                          description: recipeDescription,
                          image_url: recipeGenerated.image_url,
                          total_time_minutes: recipeGenerated.totalTime || 30,
                          difficulty: recipeGenerated.difficulty || 'Gemiddeld',
                          servings: recipeGenerated.servings || 4,
                          ingredients,
                          instructions,
                          tags: recipeGenerated.tags || [recipeCategory],
                          category: recipeCategory,
                        };

                        // Save to saved_recipes with upsert to avoid duplicates
                        const { error: saveError } = await supabase
                          .from('saved_recipes')
                          .upsert({
                            user_id: user.id,
                            recipe_name: recipeTitle,
                            recipe_payload: recipePayload,
                          }, {
                            onConflict: 'user_id,recipe_name',
                          });

                        if (saveError) {
                          console.error('Error saving to saved_recipes:', saveError);
                          // Don't fail the whole operation if saved_recipes insert fails
                          // The recipe is already created in the recipes table
                        }

                        setSavingProgress(75);
                        setSavingMessage('Recept liken...');

                        // Also like the recipe automatically
                        try {
                          await supabase.rpc('toggle_recipe_like', { p_recipe_id: newRecipeId });
                        } catch (likeError) {
                          console.error('Error liking recipe:', likeError);
                          // Non-critical, continue
                        }

                        setSavingProgress(100);
                        setSavingMessage('Klaar!');
                        
                        // Small delay to show completion
                        await new Promise(resolve => setTimeout(resolve, 300));

                        // Close modal and reset state
                        setRecipeModalVisible(false);
                        setRecipeTitle('');
                        setRecipeDescription('');
                        setRecipeDescriptionText('');
                        setRecipeGenerated(null);
                        setRecipeCategory('Comfort Food');
                        setSavingRecipe(false);
                        setSavingProgress(0);
                        setSavingMessage('');

                        // Show success and navigate
                        Alert.alert('Opgeslagen', 'Je AI-recept staat nu bij Saved.', [
                          {
                            text: 'OK',
                            onPress: () => {
                              navigateToRoute(router, '/saved');
                            },
                          },
                        ]);
                      } catch (error: any) {
                        console.error('Error saving recipe:', error);
                        setSavingRecipe(false);
                        setSavingProgress(0);
                        setSavingMessage('');
                        Alert.alert('Fout', `Er is een fout opgetreden: ${error.message || 'Onbekende fout'}`);
                      }
                    }}
                  >
                    {savingRecipe ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.modalButtonText}>Opslaan...</Text>
                      </View>
                    ) : (
                      <Text style={styles.modalButtonText}>Recept opslaan</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: 'transparent', marginTop: 8 }]}
                    onPress={() => {
                      setRecipeGenerated(null);
                      setRecipeTitle('');
                      setRecipeDescription('');
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#047857' }]}>Opnieuw genereren</Text>
                  </TouchableOpacity>
                </>
              )}
              
              <Pressable style={styles.modalSecondary} onPress={() => {
                setRecipeModalVisible(false);
                setRecipeTitle('');
                setRecipeDescription('');
                setRecipeDescriptionText('');
                setRecipeGenerated(null);
                setRecipeCategory('Comfort Food');
              }}>
                <Text style={styles.modalSecondaryText}>Annuleren</Text>
              </Pressable>
            </ScrollView>
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
    zIndex: 10,
  },
  barcodeFrame: {
    width: 280,
    height: 280,
    borderWidth: 2,
    borderColor: '#047857',
    borderRadius: 20,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningLine: {
    width: '90%',
    height: 3,
    backgroundColor: '#047857',
    borderRadius: 2,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  scanningLineActive: {
    backgroundColor: '#10b981',
    height: 4,
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  scanningLineActive: {
    backgroundColor: '#10b981',
    height: 4,
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  scanningStatus: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  scanningText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  scanningSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  closeButtonDisabled: {
    opacity: 0.5,
  },
  barcodeCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#047857',
    borderWidth: 4,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 20,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 20,
  },
  barcodeHint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  flashButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 20,
  },
  flashButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(4, 120, 87, 0.3)',
    borderColor: '#047857',
  },
  flashButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 20,
  },
  flashButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(4, 120, 87, 0.3)',
    borderColor: '#047857',
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
  recipeCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  recipeCategoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  recipeCategoryChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  recipeCategoryChipText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 14,
  },
  recipeCategoryChipTextActive: {
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '500',
  },
  productDetailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  productDetailCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  productDetailClose: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  productDetailImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    backgroundColor: '#f8fafc',
  },
  productDetailImagePlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetailContent: {
    padding: 24,
    gap: 16,
  },
  productDetailBrand: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productDetailName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 32,
  },
  productDetailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  productDetailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  productDetailMetaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  productDetailBarcode: {
    marginTop: 8,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    gap: 4,
  },
  productDetailBarcodeLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productDetailBarcodeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: 'monospace',
  },
  productDetailAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#047857',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  productDetailAddButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});


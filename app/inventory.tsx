import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fallback SafeAreaView for web
const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

import { GlassDock } from '../components/navigation/GlassDock';
import { HeaderAvatar } from '../components/navigation/HeaderAvatar';
import { StockpitLoader } from '../components/glass/StockpitLoader';
import { VoiceInput } from '../components/inventory/VoiceInput';
import { OfflineSyncIndicator } from '../components/inventory/OfflineSyncIndicator';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InventoryRecord, InventoryItem } from '../types/app';
import { runInventoryScan, analyzeShelfPhoto } from '../services/ai';
import { offlineStorage } from '../services/offlineStorage';
import { syncManager } from '../services/syncManager';
import * as ImagePicker from 'expo-image-picker';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../constants/categories';
import { navigateToRoute } from '../utils/navigation';

const categoryFilters = [{ id: 'all', label: 'All' }, ...CATEGORY_OPTIONS];
const viewModeOptions = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categorieën' },
  { id: 'expiry', label: 'Vervaldatum' },
];

const MONTH_LABELS = [
  'Januari',
  'Februari',
  'Maart',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Augustus',
  'September',
  'Oktober',
  'November',
  'December',
];

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

const automations = [
  {
    title: 'E-commerce integratie',
    description:
      'Koppel Albert Heijn, Jumbo of Picnic. Na elke bestelling importeren we automatisch merk, aantal en aankoopdatum.',
    action: 'Koppeling instellen',
  },
  {
    title: 'Kassabon / mail OCR',
    description:
      'Maak één foto van je papieren bon of stuur de digitale mail door. Wij parseren de producten en jij vult enkel de datums aan.',
    action: 'Bon scannen',
  },
];

const valueFeatures = [
  {
    title: 'Wat kan ik nu maken?',
    copy: 'Instant lijst van 100% haalbare recepten. Geen denkwerk nodig.',
    icon: 'restaurant-outline',
  },
  {
    title: 'Vervaldatum alarmen',
    copy: 'Teal notificaties 2 dagen vooraf, inclusief suggestie wat je ermee maakt.',
    icon: 'notifications-outline',
  },
  {
    title: 'Boodschappenlijst sync',
    copy: 'Ontbreekt er iets? Zet het met merknaam op je lijst in één tik.',
    icon: 'cart-outline',
  },
  {
    title: 'Herhaalitems check',
    copy: 'Maandelijkse reminder om voorraad te bevestigen. Nooit meer “stond dit er nog?”.',
    icon: 'refresh-outline',
  },
];

interface ShelfPhoto {
  id: string;
  user_id: string;
  storage_path: string;
  file_size_bytes: number;
  notes: string | null;
  analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  analyzed_at: string | null;
  items_detected_count: number;
  items_matched_count: number;
  created_at: string;
  updated_at: string;
  url: string;
  week_start?: string;
  week_label?: string;
}

interface ShelfPhotoGroup {
  week_label: string;
  week_start: string;
  photos: ShelfPhoto[];
}

export default function InventoryScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'items' | 'categories' | 'expiry'>('items');
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedNutritionItem, setSelectedNutritionItem] = useState<InventoryRecord | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryRecord | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiry, setEditExpiry] = useState<Date | null>(null);
  const [editExpiryMonthOffset, setEditExpiryMonthOffset] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [shelfPhotos, setShelfPhotos] = useState<ShelfPhoto[]>([]);
  const [shelfPhotoGroups, setShelfPhotoGroups] = useState<ShelfPhotoGroup[]>([]);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [processingPhotoId, setProcessingPhotoId] = useState<string | null>(null);
  const [selectedShelfPhoto, setSelectedShelfPhoto] = useState<ShelfPhoto | null>(null);
  const [shelfPhotoModalVisible, setShelfPhotoModalVisible] = useState(false);
  const [shelfPhotoNotes, setShelfPhotoNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ total_files: number; total_size_mb: number; max_size_mb: number; used_percentage: number } | null>(null);

  const visibleMonthCalendar = useMemo(
    () => getMonthCalendar(editExpiryMonthOffset),
    [editExpiryMonthOffset]
  );
  const currentMonthMeta = useMemo(
    () => getMonthMeta(editExpiryMonthOffset),
    [editExpiryMonthOffset]
  );
  const dayCellSize = useMemo(() => {
    const horizontalPadding = 48;
    const gap = 8;
    const columns = 7;
    const availableWidth = Math.max(windowWidth - horizontalPadding - gap * (columns - 1), 280);
    return Math.max(Math.min(availableWidth / columns, 60), 42);
  }, [windowWidth]);

  useEffect(() => {
    if (!user) {
      setInventory([]);
      setShelfPhotos([]);
      setInitialLoading(false);
      return;
    }
    const loadData = async () => {
      setInitialLoading(true);
      
      // Force hide loading screen after max 3 seconds
      const maxLoadingTimeout = setTimeout(() => {
        setInitialLoading(false);
      }, 3000);

      try {
        // Fetch inventory first (essential)
        await fetchInventory();
        
        // Hide loading screen - page is ready
        clearTimeout(maxLoadingTimeout);
        setTimeout(() => {
          setInitialLoading(false);
        }, 200);

        // Fetch shelf photos in background (non-blocking)
        fetchShelfPhotos();
      } catch (error) {
        console.error('Error loading inventory:', error);
        clearTimeout(maxLoadingTimeout);
        setInitialLoading(false);
      }
    };
    loadData();
  }, [user]);

  const fetchInventory = async () => {
    if (!user) return;
    setLoadingInventory(true);
    const { data } = await supabase
      .from('inventory')
      .select(`
        *,
        catalog:product_catalog!catalog_product_id (
          nutrition,
          metadata
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // Flatten the catalog data into inventory items
    const flattened = (data ?? []).map((item: any) => ({
      ...item,
      catalog_nutrition: item.catalog?.nutrition,
      catalog_metadata: item.catalog?.metadata,
    }));
    
    setInventory(flattened as InventoryRecord[]);
    setLoadingInventory(false);
  };

  const fetchShelfPhotos = async () => {
    if (!user) return;
    setShelfLoading(true);
    try {
      // Fetch shelf photos from new table
      const { data: photos, error } = await supabase
        .from('shelf_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching shelf photos:', error);
        setShelfPhotos([]);
        setShelfPhotoGroups([]);
        return;
      }

      if (!photos || photos.length === 0) {
        setShelfPhotos([]);
        setShelfPhotoGroups([]);
        return;
      }

      // Get public URLs for photos
      const mapped = photos
        .map((photo: any) => {
          const { data: publicUrlData } = supabase.storage
            .from('shelf-photos')
            .getPublicUrl(photo.storage_path);
          const url = publicUrlData?.publicUrl;
          if (!url) return null;
          
          // Calculate week info
          const date = new Date(photo.created_at);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay() + 1); // Monday
          const weekLabel = `${weekStart.getFullYear()}-W${String(Math.ceil((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 / 7)).padStart(2, '0')}`;
          
          return {
            ...photo,
            url,
            week_start: weekStart.toISOString(),
            week_label: weekLabel,
          } as ShelfPhoto;
        })
        .filter(Boolean) as ShelfPhoto[];

      setShelfPhotos(mapped);

      // Group photos by week
      const grouped = mapped.reduce((acc, photo) => {
        const weekLabel = photo.week_label || 'Unknown';
        const existingGroup = acc.find(g => g.week_label === weekLabel);
        if (existingGroup) {
          existingGroup.photos.push(photo);
        } else {
          acc.push({
            week_label: weekLabel,
            week_start: photo.week_start || photo.created_at,
            photos: [photo],
          });
        }
        return acc;
      }, [] as ShelfPhotoGroup[]);

      // Sort groups by week (newest first)
      grouped.sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
      setShelfPhotoGroups(grouped);

      // Fetch storage usage
      const { data: usage } = await supabase.rpc('get_user_shelf_storage_usage', { p_user_id: user.id });
      if (usage) {
        setStorageUsage(usage);
      }
    } catch (error) {
      console.error('Error fetching shelf photos:', error);
      setShelfPhotos([]);
      setShelfPhotoGroups([]);
    } finally {
      setShelfLoading(false);
    }
  };

  const insertDetectedShelfItems = async (items: InventoryItem[], contextLabel: string) => {
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
          expires_at: expiresAt,
          confidence_score: 0.8,
        });
        if (!error) successCount += 1;
      } catch (error) {
        console.error(`Error inserting shelf item (${contextLabel}):`, error);
      }
    }

    if (successCount > 0) {
      Alert.alert('Shelf scan', `${successCount} items toegevoegd uit je foto.`);
    } else {
      Alert.alert('Shelf scan', 'Geen items gedetecteerd op deze foto.');
    }
    return successCount;
  };

  const handleUploadShelfPhoto = async () => {
    if (!user) return;
    
    // Check photo limit
    if (shelfPhotos.length >= 10) {
      Alert.alert('Limiet bereikt', 'Je kunt maximaal 10 shelf foto\'s hebben. Verwijder eerst een oude foto.');
      return;
    }

    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Toestemming nodig', 'Camera toestemming is nodig om foto\'s te maken.');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets?.[0]) {
        setUploadingPhoto(false);
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        setUploadingPhoto(false);
        return;
      }

      // Get file size
      const fileInfo = await fetch(asset.uri).then(r => r.blob());
      const fileSizeBytes = fileInfo.size;

      // Check file size (5MB limit)
      if (fileSizeBytes > 5242880) {
        Alert.alert('Bestand te groot', 'Foto\'s mogen maximaal 5MB zijn. Probeer een foto met lagere kwaliteit.');
        setUploadingPhoto(false);
        return;
      }

      // Upload to storage
      const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('shelf-photos')
        .upload(filePath, fileInfo, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Create shelf photo record
      const { data: newPhoto, error: insertError } = await supabase
        .from('shelf_photos')
        .insert({
          user_id: user.id,
          storage_path: filePath,
          file_size_bytes: fileSizeBytes,
          analysis_status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Refresh photos
      await fetchShelfPhotos();

      // Start analysis in background
      analyzeShelfPhotoAndMatch(newPhoto.id, filePath);
    } catch (error: any) {
      console.error('Error uploading shelf photo:', error);
      Alert.alert('Upload mislukt', error.message || 'Kon foto niet uploaden. Probeer het opnieuw.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const analyzeShelfPhotoAndMatch = async (photoId: string, storagePath: string) => {
    if (!user) return;

    try {
      // Update status to processing
      await supabase.rpc('update_shelf_photo_analysis', {
        p_shelf_photo_id: photoId,
        p_status: 'processing',
      });

      // Get photo URL
      const { data: urlData } = supabase.storage
        .from('shelf-photos')
        .getPublicUrl(storagePath);
      
      if (!urlData?.publicUrl) {
        throw new Error('Could not get photo URL');
      }

      // Analyze photo with AI
      const analysisResults = await analyzeShelfPhoto(urlData.publicUrl);
      
      if (analysisResults.length === 0) {
        await supabase.rpc('update_shelf_photo_analysis', {
          p_shelf_photo_id: photoId,
          p_status: 'completed',
          p_items_detected: 0,
          p_items_matched: 0,
        });
        return;
      }

      let matchedCount = 0;

      // Match each detected item with product catalog
      for (const item of analysisResults) {
        // Try to match with product catalog
        const { data: matches } = await supabase.rpc('match_shelf_item_to_catalog', {
          p_item_name: item.item_name,
          p_user_id: user.id,
        });

        let matchedProductId: string | null = null;
        let matchedProductName: string | null = null;
        let inventoryItemId: string | null = null;

        if (matches && matches.length > 0 && matches[0].match_score > 70) {
          const bestMatch = matches[0];
          matchedProductId = bestMatch.product_id;
          matchedProductName = bestMatch.product_name;

          // Add to inventory
          const { data: detection } = await supabase.rpc('detect_category', { item_name: item.item_name });
          const suggestion = detection?.[0];
          
          const { data: inventoryItem } = await supabase
            .from('inventory')
            .insert({
              user_id: user.id,
              name: matchedProductName,
              category: item.category || suggestion?.category || 'pantry',
              quantity_approx: item.quantity_estimate || null,
              catalog_product_id: matchedProductId,
              confidence_score: item.confidence_score / 100,
            })
            .select()
            .single();

          if (inventoryItem) {
            inventoryItemId = inventoryItem.id;
            matchedCount++;
          }
        }

        // Save analysis result
        await supabase.from('shelf_photo_analysis').insert({
          shelf_photo_id: photoId,
          detected_item_name: item.item_name,
          detected_quantity: item.quantity_estimate || null,
          confidence_score: item.confidence_score,
          matched_product_id: matchedProductId,
          matched_product_name: matchedProductName,
          inventory_item_id: inventoryItemId,
        });
      }

      // Update analysis status
      await supabase.rpc('update_shelf_photo_analysis', {
        p_shelf_photo_id: photoId,
        p_status: 'completed',
        p_items_detected: analysisResults.length,
        p_items_matched: matchedCount,
      });

      // Refresh inventory and photos
      fetchInventory();
      fetchShelfPhotos();
    } catch (error) {
      console.error('Error analyzing shelf photo:', error);
      await supabase.rpc('update_shelf_photo_analysis', {
        p_shelf_photo_id: photoId,
        p_status: 'failed',
      });
    }
  };

  const processShelfPhoto = async (photo: ShelfPhoto) => {
    if (!requireAuth() || !user) return;
    setProcessingPhotoId(photo.id);
    try {
      // Re-analyze the photo
      await analyzeShelfPhotoAndMatch(photo.id, photo.storage_path);
      Alert.alert('Analyse gestart', 'De foto wordt opnieuw geanalyseerd. Dit kan even duren.');
    } catch (error) {
      console.error('Error processing shelf photo:', error);
      Alert.alert('Fout', 'Kon deze foto niet verwerken. Probeer het later opnieuw.');
    } finally {
      setProcessingPhotoId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedShelfPhoto || !user) return;

    try {
      const { error } = await supabase
        .from('shelf_photos')
        .update({ notes: shelfPhotoNotes })
        .eq('id', selectedShelfPhoto.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setEditingNotes(false);
      await fetchShelfPhotos();
      Alert.alert('Opgeslagen', 'Notities zijn opgeslagen.');
    } catch (error: any) {
      console.error('Error saving notes:', error);
      Alert.alert('Fout', 'Kon notities niet opslaan.');
    }
  };

  const handleDeleteShelfPhoto = async (photo: ShelfPhoto) => {
    if (!user) return;

    Alert.alert(
      'Foto verwijderen',
      'Weet je zeker dat je deze foto wilt verwijderen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from storage
              await supabase.storage
                .from('shelf-photos')
                .remove([photo.storage_path]);

              // Delete from database
              const { error } = await supabase
                .from('shelf_photos')
                .delete()
                .eq('id', photo.id)
                .eq('user_id', user.id);

              if (error) throw error;

              await fetchShelfPhotos();
            } catch (error: any) {
              console.error('Error deleting photo:', error);
              Alert.alert('Fout', 'Kon foto niet verwijderen.');
            }
          },
        },
      ]
    );
  };

  const requireAuth = () => {
    if (!user) {
      router.push('/sign-in');
      return false;
    }
    return true;
  };

  const handleCommerceConnect = async () => {
    if (!requireAuth() || !user) return;
    await supabase.from('commerce_connections').insert({
      user_id: user.id,
      provider: 'albert-heijn',
      status: 'pending',
    });
    Alert.alert('Koppeling gestart', 'We synchroniseren je laatste bestelling zodra de koppeling rond is.');
  };

  const handleReceiptUpload = async () => {
    if (!requireAuth() || !user) return;
    await supabase.from('receipt_uploads').insert({
      user_id: user.id,
      source: 'receipt-photo',
      status: 'processing',
    });
    Alert.alert('Bon ontvangen', 'We sturen een melding zodra de items zijn toegevoegd.');
  };

  const getExpiryColor = (days: number) => {
    if (days <= 3) return '#f87171';
    if (days <= 7) return '#fbbf24';
    return '#4ade80';
  };

  const getExpiryLabel = (days: number) => {
    if (days <= 3) return 'Binnenkort vervallen';
    if (days <= 7) return 'Deze week';
    if (days <= 30) return 'Deze maand';
    return 'Vers';
  };

  const daysUntil = (date: string | null) => {
    if (!date) return 30;
    const diff = Math.ceil(
      (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  const filteredInventory = useMemo(() => {
    if (selectedCategory === 'all') return inventory;
    return inventory.filter((item) => item.category === selectedCategory);
  }, [inventory, selectedCategory]);

  const categoryBreakdown = useMemo(() => {
    return CATEGORY_OPTIONS.map((option) => ({
      id: option.id,
      label: option.label,
      count: inventory.filter((item) => item.category === option.id).length,
    })).filter((item) => item.count > 0);
  }, [inventory]);

  const expiryOrdered = useMemo(() => {
    return [...inventory].sort((a, b) => daysUntil(a.expires_at) - daysUntil(b.expires_at));
  }, [inventory]);

  const expiringSoon = useMemo(
    () => inventory.filter((item) => daysUntil(item.expires_at) <= 3).length,
    [inventory]
  );

  const usableItems = useMemo(
    () => inventory.filter((item) => daysUntil(item.expires_at) > 3).length,
    [inventory]
  );

  const usablePercentage = inventory.length
    ? Math.round((usableItems / inventory.length) * 100)
    : 0;

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaViewComponent style={styles.safeArea}>
          <StockpitLoader variant="inventory" />
        </SafeAreaViewComponent>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaViewComponent 
        style={styles.safeArea}
        // @ts-ignore - web-specific prop
        {...(Platform.OS === 'web' && {
          className: 'safe-area-top',
        })}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandLabel}>STOCKPIT</Text>
          </View>
          <View style={styles.headerIcons}>
            {profile?.is_admin && (
              <Pressable 
                onPress={() => navigateToRoute(router, '/admin')}
                style={styles.adminButton}
              >
                <Ionicons name="shield" size={20} color="#047857" />
              </Pressable>
            )}
            {user ? (
              <HeaderAvatar
                userId={user.id}
                userEmail={user.email}
                avatarUrl={profile?.avatar_url}
                showNotificationBadge={true}
              />
            ) : (
              <Pressable onPress={() => navigateToRoute(router, '/profile')}>
                <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topIntro}>
            <Text style={styles.topIntroEyebrow}>Voorraad cockpit</Text>
            <Text style={styles.topIntroTitle}>Overzicht van alles wat klaarstaat.</Text>
            <Text style={styles.topIntroSubtitle}>
              Synchroniseer scans, volg houdbaarheden en plan een sessie op basis van de realiteit.
            </Text>
          </View>

          <OfflineSyncIndicator />

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{inventory.length}</Text>
              <Text style={styles.statLabel}>Items beschikbaar</Text>
              <Text style={styles.statDetail}>
                {inventory.length ? `${usablePercentage}% bruikbaar deze week` : 'Voeg je eerste scan toe'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#f97316' }]}>{expiringSoon}</Text>
              <Text style={styles.statLabel}>Binnenkort vervallen</Text>
              <Text style={styles.statDetail}>
                {expiringSoon > 0 ? 'Plan voor vanavond' : 'Alles op schema'}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categoryFilters.map((category) => {
              const active = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.stockpitButton}
            onPress={async () => {
              if (!user) return router.push('/sign-in');
              await supabase.from('scan_sessions').insert({ user_id: user.id, processed_status: 'pending' });
              router.push('/scan');
            }}
          >
            <Text style={styles.stockpitTitle}>STOCKPIT MODE</Text>
          </TouchableOpacity>

          {/* Voice Input */}
          {user && (
            <VoiceInput
              userId={user.id}
              onItemsAdded={async (count) => {
                // Refresh inventory after items are added
                await fetchInventory();
              }}
            />
          )}

          {user ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>My Shelf</Text>
                  {storageUsage && (
                    <Text style={styles.storageUsageText}>
                      {storageUsage.total_files}/10 foto's • {storageUsage.total_size_mb.toFixed(1)}MB gebruikt
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUploadShelfPhoto}
                  disabled={uploadingPhoto || shelfPhotos.length >= 10}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="camera" size={18} color="#fff" />
                      <Text style={styles.uploadButtonText}>Foto</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              {shelfLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#047857" />
                  <Text style={styles.loadingText}>Shelf shots laden...</Text>
                </View>
              ) : shelfPhotoGroups.length === 0 ? (
                <View style={styles.emptyShelfContainer}>
                  <Ionicons name="images-outline" size={48} color="#94a3b8" />
                  <Text style={styles.emptyShelfText}>
                    Maak je eerste shelf foto om je voorraad visueel bij te houden.
                  </Text>
                  <Text style={styles.emptyShelfSubtext}>
                    Upload maximaal 10 foto's. AI analyseert automatisch en voegt producten toe aan je voorraad.
                  </Text>
                </View>
              ) : (
                <View style={styles.shelfGroupsContainer}>
                  {shelfPhotoGroups.map((group) => (
                    <View key={group.week_label} style={styles.shelfWeekGroup}>
                      <View style={styles.weekHeader}>
                        <Text style={styles.weekLabel}>{group.week_label}</Text>
                        <Text style={styles.weekPhotoCount}>{group.photos.length} foto{group.photos.length !== 1 ? "'s" : ''}</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfScroll}>
                        {group.photos.map((photo) => (
                          <TouchableOpacity
                            key={photo.id}
                            style={styles.shelfCard}
                            onPress={() => {
                              setSelectedShelfPhoto(photo);
                              setShelfPhotoNotes(photo.notes || '');
                              setShelfPhotoModalVisible(true);
                            }}
                          >
                            <Image source={{ uri: photo.url }} style={styles.shelfImage} />
                            <View style={styles.shelfCardOverlay}>
                              {photo.analysis_status === 'completed' && (
                                <View style={styles.analysisBadge}>
                                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                  <Text style={styles.analysisBadgeText}>
                                    {photo.items_matched_count}/{photo.items_detected_count}
                                  </Text>
                                </View>
                              )}
                              {photo.analysis_status === 'processing' && (
                                <View style={styles.analysisBadgeProcessing}>
                                  <ActivityIndicator size="small" color="#fff" />
                                </View>
                              )}
                              {photo.notes && (
                                <View style={styles.notesIndicator}>
                                  <Ionicons name="document-text" size={14} color="#047857" />
                                </View>
                              )}
                            </View>
                            <Text style={styles.shelfTimestamp}>
                              {new Date(photo.created_at).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.inventoryHeaderRow}>
                <Text style={styles.sectionTitle}>
                  {viewMode === 'items'
                    ? 'Voorraad per item'
                    : viewMode === 'categories'
                    ? 'Voorraad per categorie'
                    : 'Binnenkort vervallen'}
                </Text>
                <Text style={styles.sectionSub}>
                  {viewMode === 'items'
                    ? 'Live score en houdbaarheid'
                    : viewMode === 'categories'
                    ? 'Geclusterd per STOCKPIT lane'
                    : 'Sortering op dichtstbijzijnde houdbaarheid'}
                </Text>
              </View>
              <View style={styles.viewToggle}>
                {viewModeOptions.map((option) => {
                  const active = viewMode === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.viewChip, active && styles.viewChipActive]}
                      onPress={() => setViewMode(option.id as typeof viewMode)}
                    >
                      <Text style={[styles.viewChipText, active && styles.viewChipTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {viewMode === 'items' && (
                <>
                  <View style={styles.inventoryList}>
                    {filteredInventory.map((item) => {
                      const expiresIn = daysUntil(item.expires_at);
                      return (
                        <View key={item.id} style={styles.inventoryCard}>
                          <View style={styles.inventoryCardContent}>
                            {/* Product Image */}
                            <View style={styles.imageContainer}>
                              {item.catalog_image_url ? (
                                <Image
                                  source={{ uri: item.catalog_image_url }}
                                  style={styles.itemImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <View style={styles.itemImagePlaceholder}>
                                  <Ionicons name="cube-outline" size={24} color="#94a3b8" />
                                </View>
                              )}
                              {/* Nutrition button */}
                              {(item as any).catalog_nutrition && (
                                <TouchableOpacity
                                  style={styles.nutritionButton}
                                  onPress={() => setSelectedNutritionItem(item)}
                                >
                                  <Ionicons name="nutrition-outline" size={16} color="#047857" />
                                </TouchableOpacity>
                              )}
                            </View>

                            {/* Product Info */}
                            <View style={styles.itemInfo}>
                              <View style={styles.inventoryTopRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.itemName}>{item.name}</Text>
                                  <Text style={styles.itemCategory}>{getCategoryLabel(item.category)}</Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.editButton}
                                  onPress={() => {
                                    setEditingItem(item);
                                    setEditQuantity(item.quantity_approx || '');
                                    setEditExpiry(item.expires_at ? new Date(item.expires_at) : null);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={16} color="#047857" />
                                </TouchableOpacity>
                              </View>

                              {/* Price */}
                              {item.catalog_price && (
                                <View style={styles.priceRow}>
                                  <Ionicons name="pricetag" size={14} color="#047857" />
                                  <Text style={styles.priceText}>€{item.catalog_price.toFixed(2)}</Text>
                                </View>
                              )}

                              <View style={styles.itemStatsRow}>
                                <View style={styles.itemStat}>
                                  <Text style={styles.itemStatLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>HOEVEELHEID</Text>
                                  <Text style={styles.itemStatValue}>{item.quantity_approx ?? '-'}</Text>
                                </View>
                                <View style={styles.itemStat}>
                                  <Text style={styles.itemStatLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>HOUDBAAR</Text>
                                  <Text style={[styles.itemStatValue, { color: getExpiryColor(expiresIn) }]}>
                                    {isFinite(expiresIn) ? `${expiresIn} dagen` : 'Onbekend'}
                                  </Text>
                                  <Text style={styles.itemStatHelper}>{getExpiryLabel(expiresIn)}</Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={styles.markUsed}
                            onPress={async () => {
                              if (!user) return router.push('/sign-in');
                              
                              // Check if online
                              const isOnline = syncManager.getStatus().isOnline;
                              
                              if (isOnline) {
                                // Online: delete directly
                                const { error } = await supabase.from('inventory').delete().eq('id', item.id);
                                if (error) {
                                  Alert.alert('Fout', `Kon item niet verwijderen: ${error.message}`);
                                  return;
                                }
                                fetchInventory();
                              } else {
                                // Offline: queue for sync
                                await offlineStorage.addPendingSync({
                                  table: 'inventory',
                                  operation: 'delete',
                                  data: { id: item.id },
                                });
                                
                                // Remove from local state immediately for better UX
                                setInventory(prev => prev.filter(i => i.id !== item.id));
                                Alert.alert('Offline', 'Item wordt verwijderd zodra je weer online bent.');
                              }
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={20} color="#047857" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                  {filteredInventory.length === 0 && (
                    <View style={styles.emptyState}>
                      <Ionicons name="cube-outline" size={48} color="#94a3b8" />
                      <Text style={styles.emptyTitle}>Geen items in deze categorie</Text>
                      <Text style={styles.emptySubtitle}>Start een scansessie om voorraad toe te voegen.</Text>
                    </View>
                  )}
                </>
              )}

              {viewMode === 'categories' && (
                <View style={styles.breakdownGrid}>
                  {categoryBreakdown.map((category) => (
                    <View key={category.id} style={styles.breakdownCard}>
                      <Text style={styles.breakdownCount}>{category.count}</Text>
                      <Text style={styles.breakdownLabel}>{category.label}</Text>
                    </View>
                  ))}
                  {categoryBreakdown.length === 0 && (
                    <Text style={styles.emptySubtitle}>Nog geen data per categorie beschikbaar.</Text>
                  )}
                </View>
              )}

              {viewMode === 'expiry' && (
                <View style={styles.inventoryList}>
                  {expiryOrdered.map((item) => {
                    const expiresIn = daysUntil(item.expires_at);
                    return (
                      <View key={`${item.id}-expiry`} style={styles.inventoryCard}>
                        <View style={styles.inventoryTopRow}>
                          <View>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemCategory}>{getCategoryLabel(item.category)}</Text>
                          </View>
                        </View>
                        <View style={styles.itemStatsRow}>
                          <View style={styles.itemStat}>
                            <Text style={styles.itemStatLabel}>Houdbaar</Text>
                            <Text style={[styles.itemStatValue, { color: getExpiryColor(expiresIn) }]}>
                              {isFinite(expiresIn) ? `${expiresIn} dagen` : 'Onbekend'}
                            </Text>
                            <Text style={styles.itemStatHelper}>{getExpiryLabel(expiresIn)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <View style={styles.authCard}>
              <Text style={styles.topIntroTitle}>Voorraad bijhouden</Text>
              <Text style={styles.topIntroSubtitle}>
                Log in om je voorraad te synchroniseren en recepten 1-op-1 te laten aansluiten.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/sign-in')}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/sign-up')}>
                <Text style={styles.secondaryText}>Account maken</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </SafeAreaViewComponent>
      <GlassDock />

      {/* Shelf Photo Detail Modal */}
      <Modal
        visible={shelfPhotoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShelfPhotoModalVisible(false);
          setSelectedShelfPhoto(null);
          setEditingNotes(false);
        }}
      >
        <View style={styles.shelfPhotoModalOverlay}>
          <View style={styles.shelfPhotoModalContent}>
            {selectedShelfPhoto && (
              <>
                <View style={styles.shelfPhotoModalHeader}>
                  <Text style={styles.shelfPhotoModalTitle}>Shelf Foto</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShelfPhotoModalVisible(false);
                      setSelectedShelfPhoto(null);
                      setEditingNotes(false);
                    }}
                  >
                    <Ionicons name="close" size={24} color="#0f172a" />
                  </TouchableOpacity>
                </View>

                <Image source={{ uri: selectedShelfPhoto.url }} style={styles.shelfPhotoModalImage} />

                <View style={styles.shelfPhotoModalInfo}>
                  <Text style={styles.shelfPhotoModalDate}>
                    {new Date(selectedShelfPhoto.created_at).toLocaleDateString('nl-NL', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  {selectedShelfPhoto.analysis_status === 'completed' && (
                    <View style={styles.analysisInfo}>
                      <View style={styles.analysisInfoRow}>
                        <Ionicons name="checkmark-circle" size={20} color="#047857" />
                        <Text style={styles.analysisInfoText}>
                          {selectedShelfPhoto.items_matched_count} van {selectedShelfPhoto.items_detected_count} producten toegevoegd
                        </Text>
                      </View>
                    </View>
                  )}

                  {selectedShelfPhoto.analysis_status === 'processing' && (
                    <View style={styles.analysisInfo}>
                      <ActivityIndicator size="small" color="#047857" />
                      <Text style={styles.analysisInfoText}>Foto wordt geanalyseerd...</Text>
                    </View>
                  )}

                  <View style={styles.notesSection}>
                    <View style={styles.notesHeader}>
                      <Text style={styles.notesTitle}>Notities</Text>
                      {!editingNotes && (
                        <TouchableOpacity onPress={() => setEditingNotes(true)}>
                          <Ionicons name="create-outline" size={20} color="#047857" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {editingNotes ? (
                      <View style={styles.notesEditContainer}>
                        <TextInput
                          style={styles.notesInput}
                          value={shelfPhotoNotes}
                          onChangeText={setShelfPhotoNotes}
                          placeholder="Voeg notities toe aan deze foto..."
                          multiline
                          numberOfLines={4}
                          placeholderTextColor="#94a3b8"
                        />
                        <View style={styles.notesActions}>
                          <TouchableOpacity
                            style={styles.notesCancelButton}
                            onPress={() => {
                              setEditingNotes(false);
                              setShelfPhotoNotes(selectedShelfPhoto.notes || '');
                            }}
                          >
                            <Text style={styles.notesCancelText}>Annuleren</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.notesSaveButton}
                            onPress={handleSaveNotes}
                          >
                            <Text style={styles.notesSaveText}>Opslaan</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.notesText}>
                        {selectedShelfPhoto.notes || 'Geen notities. Tik op het potlood icoon om notities toe te voegen.'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.shelfPhotoModalActions}>
                    <TouchableOpacity
                      style={styles.shelfPhotoActionButton}
                      onPress={() => {
                        setShelfPhotoModalVisible(false);
                        processShelfPhoto(selectedShelfPhoto);
                      }}
                      disabled={processingPhotoId === selectedShelfPhoto.id}
                    >
                      {processingPhotoId === selectedShelfPhoto.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={18} color="#fff" />
                          <Text style={styles.shelfPhotoActionText}>Opnieuw analyseren</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.shelfPhotoActionButton, styles.shelfPhotoDeleteButton]}
                      onPress={() => {
                        setShelfPhotoModalVisible(false);
                        handleDeleteShelfPhoto(selectedShelfPhoto);
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Text style={styles.shelfPhotoActionText}>Verwijderen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Nutrition Modal */}
      {selectedNutritionItem && (selectedNutritionItem as any).catalog_nutrition && (
        <Modal visible={!!selectedNutritionItem} transparent animationType="fade" onRequestClose={() => setSelectedNutritionItem(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.nutritionModal}>
              <View style={styles.nutritionHeader}>
                <Text style={styles.nutritionTitle}>Voedingswaarden</Text>
                <TouchableOpacity onPress={() => setSelectedNutritionItem(null)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.nutritionProductName}>{selectedNutritionItem.name}</Text>
              {selectedNutritionItem.quantity_approx && (
                <Text style={styles.nutritionQuantity}>
                  Voedingswaarden per {selectedNutritionItem.quantity_approx}
                </Text>
              )}
              <ScrollView style={styles.nutritionContent}>
                {(() => {
                  const nutrition = (selectedNutritionItem as any).catalog_nutrition;
                  if (!nutrition || typeof nutrition !== 'object') {
                    return <Text style={styles.nutritionEmpty}>Geen voedingswaarden beschikbaar</Text>;
                  }
                  return Object.entries(nutrition).map(([key, value]) => (
                    <View key={key} style={styles.nutritionRow}>
                      <Text style={styles.nutritionKey}>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text>
                      <Text style={styles.nutritionValue}>{String(value)}</Text>
                    </View>
                  ));
                })()}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <Modal visible={!!editingItem} transparent animationType="fade" onRequestClose={() => setEditingItem(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.editModal}>
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Item bewerken</Text>
                <TouchableOpacity onPress={() => setEditingItem(null)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <Text style={styles.editProductName}>{editingItem.name}</Text>
              
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Hoeveelheid</Text>
                <View style={styles.editInput}>
                  <TextInput
                    value={editQuantity}
                    onChangeText={setEditQuantity}
                    placeholder="bijv. 500g, 2 stuks"
                    style={styles.editInputText}
                  />
                </View>
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Vervaldatum</Text>
                <TouchableOpacity
                  style={styles.editInput}
                  onPress={() => {
                    setShowDatePicker(!showDatePicker);
                    if (!showDatePicker && editExpiry) {
                      // Calculate month offset based on selected date
                      const today = new Date();
                      const selected = editExpiry;
                      const monthDiff = (selected.getFullYear() - today.getFullYear()) * 12 + (selected.getMonth() - today.getMonth());
                      setEditExpiryMonthOffset(Math.max(0, monthDiff));
                    }
                  }}
                >
                  <Text style={styles.editInputText}>
                    {editExpiry ? formatDisplayDate(editExpiry) : 'Geen datum'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#64748b" />
                </TouchableOpacity>
                {showDatePicker && (
                  <View style={styles.datePickerContainer}>
                    <View style={styles.monthNav}>
                      <Pressable
                        style={[styles.monthPill, editExpiryMonthOffset === 0 && styles.monthPillDisabled]}
                        disabled={editExpiryMonthOffset === 0}
                        onPress={() => setEditExpiryMonthOffset((prev) => Math.max(prev - 1, 0))}
                      >
                        <Ionicons name="chevron-back" size={18} color="#0f172a" />
                      </Pressable>
                      <Text style={styles.monthLabel}>{currentMonthMeta.label}</Text>
                      <Pressable
                        style={styles.monthPill}
                        onPress={() => setEditExpiryMonthOffset((prev) => Math.min(prev + 1, 5))}
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
                        const isSelected = isSameDay(date, editExpiry);
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
                                setEditExpiry(date);
                                setShowDatePicker(false);
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
                  </View>
                )}
              </View>

              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.editCancelButton}
                  onPress={() => setEditingItem(null)}
                >
                  <Text style={styles.editCancelText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editSaveButton}
                  onPress={async () => {
                    if (!user || !editingItem) return;
                    
                    const updateData = {
                      quantity_approx: editQuantity || null,
                      expires_at: editExpiry ? editExpiry.toISOString() : null,
                    };
                    
                    // Check if online
                    const isOnline = syncManager.getStatus().isOnline;
                    
                    if (isOnline) {
                      // Online: update directly
                      const { error } = await supabase
                        .from('inventory')
                        .update(updateData)
                        .eq('id', editingItem.id);
                      
                      if (error) {
                        Alert.alert('Fout', `Kon item niet bijwerken: ${error.message}`);
                        return;
                      }
                      
                      fetchInventory();
                      setEditingItem(null);
                      Alert.alert('Opgeslagen', 'Item is bijgewerkt.');
                    } else {
                      // Offline: queue for sync
                      await offlineStorage.addPendingSync({
                        table: 'inventory',
                        operation: 'update',
                        data: {
                          id: editingItem.id,
                          ...updateData,
                        },
                      });
                      
                      // Update local state immediately
                      setInventory(prev => prev.map(i => 
                        i.id === editingItem.id 
                          ? { ...i, ...updateData } 
                          : i
                      ));
                      
                      setEditingItem(null);
                      Alert.alert('Offline opgeslagen', 'Wijziging wordt gesynchroniseerd zodra je weer online bent.');
                    }
                  }}
                >
                  <Text style={styles.editSaveText}>Opslaan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    paddingTop: Platform.select({
      web: 0, // Handled by CSS safe-area-top class
      default: 8,
    }),
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
    gap: 12,
  },
  adminButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#047857',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: Platform.select({
      web: 140, // Extra space for fixed bottom nav + safe area
      default: 120,
    }),
    gap: 24,
  },
  topIntro: {
    gap: 8,
  },
  topIntroEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    color: '#047857',
  },
  topIntroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
  },
  topIntroSubtitle: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    maxWidth: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 16,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  statValue: {
    fontSize: 32,
    color: '#065f46',
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  statDetail: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
  },
  categoryScroll: {
    paddingVertical: 4,
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#047857',
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#047857',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  viewChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
  },
  viewChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  viewChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  viewChipTextActive: {
    color: '#fff',
  },
  stockpitButton: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockpitTitle: {
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#047857',
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionLink: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#047857',
    fontWeight: '600',
  },
  emptyShelfText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  shelfScroll: {
    paddingVertical: 8,
  },
  shelfCard: {
    width: 220,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 12,
    backgroundColor: '#fff',
    marginRight: 12,
    gap: 8,
  },
  shelfImage: {
    width: '100%',
    height: 140,
    borderRadius: 16,
  },
  shelfTimestamp: {
    fontSize: 12,
    color: '#475569',
  },
  shelfButton: {
    backgroundColor: '#047857',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  shelfButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  inventoryList: {
    gap: 12,
  },
  inventoryCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 18,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  inventoryCardContent: {
    flexDirection: 'row',
    gap: 16,
  },
  imageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  itemImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutritionButton: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  itemInfo: {
    flex: 1,
  },
  inventoryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
  },
  itemName: {
    fontSize: 18,
    color: '#0f172a',
    fontWeight: '700',
  },
  itemCategory: {
    fontSize: 13,
    color: '#64748b',
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  breakdownCard: {
    flexBasis: '48%',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    padding: 16,
  },
  breakdownCount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#047857',
  },
  breakdownLabel: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '700',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  itemStat: {
    flex: 1,
    minWidth: 0, // Prevent overflow
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    borderRadius: 18,
    padding: 10,
  },
  itemStatLabel: {
    fontSize: 9,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '700',
    flexShrink: 1,
    lineHeight: 12,
  },
  itemStatValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemStatHelper: {
    marginTop: 2,
    fontSize: 11,
    color: '#64748b',
  },
  inventoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
  },
  sectionSub: {
    fontSize: 13,
    color: '#94a3b8',
  },
  section: {
    gap: 12,
  },
  automationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  automationCard: {
    flex: 1,
    minWidth: '48%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  automationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  automationDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  automationButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#047857',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  automationButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  valueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  valueCard: {
    flexBasis: '48%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#f8fafc',
    padding: 14,
    gap: 8,
  },
  valueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  valueCopy: {
    fontSize: 13,
    color: '#475569',
  },
  markUsed: {
    alignSelf: 'flex-end',
    marginTop: 12,
    padding: 4,
  },
  markUsedText: {
    color: '#047857',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  nutritionModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 24,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nutritionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  nutritionProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  nutritionQuantity: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  nutritionContent: {
    maxHeight: 400,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  nutritionKey: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  nutritionEmpty: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  editModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  editProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 24,
  },
  editField: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  editInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },
  editInputText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  editSaveButton: {
    flex: 1,
    backgroundColor: '#047857',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  datePickerContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPillDisabled: {
    opacity: 0.4,
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
  authCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    backgroundColor: '#fff',
    padding: 24,
    gap: 12,
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
    fontSize: 16,
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
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  // Shelf photos enhanced styles
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  storageUsageText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  emptyShelfContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyShelfSubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  shelfGroupsContainer: {
    gap: 24,
  },
  shelfWeekGroup: {
    gap: 12,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  weekPhotoCount: {
    fontSize: 13,
    color: '#64748b',
  },
  shelfCardOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  analysisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(4, 120, 87, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  analysisBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  analysisBadgeProcessing: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    padding: 6,
    borderRadius: 12,
  },
  notesIndicator: {
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#047857',
  },
  // Shelf Photo Modal styles
  shelfPhotoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  shelfPhotoModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  shelfPhotoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  shelfPhotoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  shelfPhotoModalImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#f1f5f9',
  },
  shelfPhotoModalInfo: {
    padding: 20,
    gap: 16,
  },
  shelfPhotoModalDate: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  analysisInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 12,
  },
  analysisInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisInfoText: {
    fontSize: 14,
    color: '#065f46',
    fontWeight: '600',
  },
  notesSection: {
    gap: 8,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    minHeight: 60,
  },
  notesEditContainer: {
    gap: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  notesActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  notesCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.15)',
  },
  notesCancelText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  notesSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#047857',
  },
  notesSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  shelfPhotoModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  shelfPhotoActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingVertical: 12,
    borderRadius: 12,
  },
  shelfPhotoDeleteButton: {
    backgroundColor: '#ef4444',
  },
  shelfPhotoActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});


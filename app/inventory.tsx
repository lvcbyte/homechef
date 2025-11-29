import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { StockpitLoader } from '../components/glass/StockpitLoader';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InventoryRecord, InventoryItem } from '../types/app';
import { runInventoryScan } from '../services/ai';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../constants/categories';

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
  storage_path: string;
  url: string;
  created_at: string;
}

export default function InventoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
  const [shelfLoading, setShelfLoading] = useState(false);
  const [processingPhotoId, setProcessingPhotoId] = useState<string | null>(null);

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
      const { data: sessions } = await supabase
        .from('scan_sessions')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!sessions || sessions.length === 0) {
        setShelfPhotos([]);
        return;
      }

      const sessionIds = sessions.map((session) => session.id);
      const { data: photos } = await supabase
        .from('scan_photos')
        .select('id, storage_path, created_at, session_id')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!photos) {
        setShelfPhotos([]);
        return;
      }

      const mapped = photos
        .map((photo: any) => {
          const { data: publicUrlData } = supabase.storage
            .from('inventory-scans')
            .getPublicUrl(photo.storage_path);
          const url = publicUrlData?.publicUrl;
          if (!url) return null;
          return {
            id: photo.id,
            storage_path: photo.storage_path,
            created_at: photo.created_at,
            url,
          } as ShelfPhoto;
        })
        .filter(Boolean) as ShelfPhoto[];

      setShelfPhotos(mapped);
    } catch (error) {
      console.error('Error fetching shelf photos:', error);
      setShelfPhotos([]);
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

  const processShelfPhoto = async (photo: ShelfPhoto) => {
    if (!requireAuth() || !user) return;
    setProcessingPhotoId(photo.id);
    try {
      const detectedItems = await runInventoryScan([photo.url]);
      await insertDetectedShelfItems(detectedItems, photo.storage_path);
      fetchInventory();
    } catch (error) {
      console.error('Error processing shelf photo:', error);
      Alert.alert('Fout', 'Kon deze foto niet verwerken. Probeer het later opnieuw.');
    } finally {
      setProcessingPhotoId(null);
    }
  };

  const requireAuth = () => {
    if (!user) {
      router.push('/auth/sign-in');
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
        <SafeAreaView style={styles.safeArea}>
          <StockpitLoader variant="inventory" />
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
            <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandLabel}>STOCKPIT</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable onPress={() => router.push('/profile')}>
              {user ? (
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>{user.email?.charAt(0).toUpperCase() ?? 'U'}</Text>
                </View>
              ) : (
                <Ionicons name="person-circle-outline" size={32} color="#0f172a" />
              )}
            </Pressable>
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
              if (!user) return router.push('/auth/sign-in');
              await supabase.from('scan_sessions').insert({ user_id: user.id, processed_status: 'pending' });
              router.push('/scan');
            }}
          >
            <Text style={styles.stockpitTitle}>STOCKPIT MODE</Text>
          </TouchableOpacity>

          {user ? (
            <>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>My Shelf</Text>
              </View>
              {shelfLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#047857" />
                  <Text style={styles.loadingText}>Shelf shots laden...</Text>
                </View>
              ) : shelfPhotos.length === 0 ? (
                <Text style={styles.emptyShelfText}>
                  Maak een shelf shot in STOCKPIT mode om een visueel archief op te bouwen.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfScroll}>
                  {shelfPhotos.map((photo) => (
                    <View key={photo.id} style={styles.shelfCard}>
                      <Image source={{ uri: photo.url }} style={styles.shelfImage} />
                      <Text style={styles.shelfTimestamp}>
                        {new Date(photo.created_at).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.shelfButton,
                          processingPhotoId === photo.id && { opacity: 0.6 },
                        ]}
                        disabled={processingPhotoId === photo.id}
                        onPress={() => processShelfPhoto(photo)}
                      >
                        {processingPhotoId === photo.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.shelfButtonText}>Detecteer opnieuw</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
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
                              if (!user) return router.push('/auth/sign-in');
                              await supabase.from('inventory').delete().eq('id', item.id);
                              fetchInventory();
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
              <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/auth/sign-in')}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/auth/sign-up')}>
                <Text style={styles.secondaryText}>Account maken</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
      <GlassDock />

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
                    await supabase
                      .from('inventory')
                      .update({
                        quantity_approx: editQuantity || null,
                        expires_at: editExpiry ? editExpiry.toISOString() : null,
                      })
                      .eq('id', editingItem.id);
                    fetchInventory();
                    setEditingItem(null);
                    Alert.alert('Opgeslagen', 'Item is bijgewerkt.');
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
    paddingBottom: 120,
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
});


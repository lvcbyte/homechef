import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassDock } from '../components/navigation/GlassDock';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { InventoryRecord } from '../types/app';
import { CATEGORY_OPTIONS, getCategoryLabel } from '../constants/categories';

const categoryFilters = [{ id: 'all', label: 'All' }, ...CATEGORY_OPTIONS];
const viewModeOptions = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categories' },
  { id: 'expiry', label: 'Expiry' },
];

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

export default function InventoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'items' | 'categories' | 'expiry'>('items');
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  useEffect(() => {
    if (!user) {
      setInventory([]);
      return;
    }
    fetchInventory();
  }, [user]);

  const fetchInventory = async () => {
    if (!user) return;
    setLoadingInventory(true);
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setInventory((data as InventoryRecord[]) ?? []);
    setLoadingInventory(false);
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
    if (days <= 3) return 'Expiring Soon';
    if (days <= 7) return 'This Week';
    if (days <= 30) return 'This Month';
    return 'Fresh';
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
            <Ionicons name="search" size={22} color="#0f172a" />
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
              <Text style={styles.statLabel}>Expiring soon</Text>
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
                    ? 'Geclusterd per Stockpit lane'
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
                          <View style={styles.inventoryTopRow}>
                            <View>
                              <Text style={styles.itemName}>{item.name}</Text>
                              <Text style={styles.itemCategory}>{getCategoryLabel(item.category)}</Text>
                            </View>
                            <View style={styles.confidencePill}>
                              <Ionicons name="shield-checkmark" size={14} color="#047857" />
                              <Text style={styles.confidenceText}>
                                {Math.round((item.confidence_score ?? 0) * 100)}%
                              </Text>
                            </View>
                          </View>
                          <View style={styles.itemStatsRow}>
                            <View style={styles.itemStat}>
                              <Text style={styles.itemStatLabel}>Hoeveelheid</Text>
                              <Text style={styles.itemStatValue}>{item.quantity_approx ?? '-'}</Text>
                            </View>
                            <View style={styles.itemStat}>
                              <Text style={styles.itemStatLabel}>Houdbaar</Text>
                              <Text style={[styles.itemStatValue, { color: getExpiryColor(expiresIn) }]}>
                                {isFinite(expiresIn) ? `${expiresIn} dagen` : 'Onbekend'}
                              </Text>
                              <Text style={styles.itemStatHelper}>{getExpiryLabel(expiresIn)}</Text>
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
                            <Ionicons name="checkmark-circle" size={18} color="#047857" />
                            <Text style={styles.markUsedText}>Markeer als gebruikt</Text>
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Slimme invoer</Text>
            <Text style={styles.sectionSub}>Kies de methode die het beste bij jou past</Text>
            <View style={styles.automationGrid}>
              {automations.map((item) => (
                <View key={item.title} style={styles.automationCard}>
                  <Text style={styles.automationTitle}>{item.title}</Text>
                  <Text style={styles.automationDescription}>{item.description}</Text>
                  <TouchableOpacity
                    style={styles.automationButton}
                    onPress={() =>
                      item.title === 'E-commerce integratie'
                        ? handleCommerceConnect()
                        : handleReceiptUpload()
                    }
                  >
                    <Text style={styles.automationButtonText}>{item.action}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waarom het moeite loont</Text>
            <View style={styles.valueGrid}>
              {valueFeatures.map((feature) => (
                <View key={feature.title} style={styles.valueCard}>
                  <Ionicons name={feature.icon as any} size={22} color="#047857" />
                  <Text style={styles.valueTitle}>{feature.title}</Text>
                  <Text style={styles.valueCopy}>{feature.copy}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <GlassDock />
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
  },
  statCard: {
    flex: 1,
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
  inventoryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
  },
  itemStatsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  itemStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    borderRadius: 18,
    padding: 12,
  },
  itemStatLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemStatValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemStatHelper: {
    marginTop: 2,
    fontSize: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  markUsedText: {
    color: '#047857',
    fontWeight: '600',
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


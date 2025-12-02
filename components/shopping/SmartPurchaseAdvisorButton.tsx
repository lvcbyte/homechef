// Smart Purchase Advisor Button Component
// Professional button/lane for accessing Smart Purchase Advisor from scan page

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SmartPurchaseAdvisor } from './SmartPurchaseAdvisor';
import { supabase } from '../../lib/supabase';

interface SmartPurchaseAdvisorButtonProps {
  userId: string;
}

interface Product {
  id: string;
  product_name: string;
  price: number | null;
  image_url: string | null;
  brand: string | null;
}

export function SmartPurchaseAdvisorButton({ userId }: SmartPurchaseAdvisorButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; price?: number } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenAdvisor = () => {
    setShowProductSelector(true);
    loadProducts();
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('product_catalog')
        .select('id, product_name, price, image_url, brand')
        .not('price', 'is', null)
        .gt('price', 0)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.ilike('product_name', `%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error loading products:', error);
      Alert.alert('Fout', 'Kon producten niet laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showProductSelector && searchQuery) {
      const timeout = setTimeout(() => {
        loadProducts();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct({
      id: product.id,
      name: product.product_name,
      price: product.price || undefined,
    });
    setShowProductSelector(false);
    setShowModal(true);
  };

  const SafeAreaViewComponent = Platform.OS === 'web' ? View : SafeAreaView;

  return (
    <>
      <TouchableOpacity
        style={styles.actionCard}
        onPress={handleOpenAdvisor}
        disabled={loading}
      >
        <Ionicons name="trending-up" size={24} color="#047857" />
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Slimme Aankoop Adviseur</Text>
          <Text style={styles.actionCopy}>
            Ontdek het beste koopmoment voor producten. ML-powered prijsvoorspellingen helpen je geld te besparen.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* Product Selector Modal */}
      <Modal
        visible={showProductSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowProductSelector(false);
          setSearchQuery('');
        }}
      >
        <SafeAreaViewComponent style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.selectorHeader}>
            <View style={styles.selectorHeaderContent}>
              <Text style={styles.selectorTitle}>Kies een Product</Text>
              <Text style={styles.selectorSubtitle}>Selecteer een product voor prijsvoorspelling</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowProductSelector(false);
                setSearchQuery('');
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder="Zoek product..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#047857" />
              <Text style={styles.loadingText}>Producten laden...</Text>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={64} color="#94a3b8" />
              <Text style={styles.emptyText}>Geen producten gevonden</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Probeer een andere zoekterm'
                  : 'Er zijn geen producten met prijsdata beschikbaar'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.productList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productCard}
                  onPress={() => handleSelectProduct(item)}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="cube-outline" size={24} color="#94a3b8" />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.product_name}
                    </Text>
                    {item.brand && (
                      <Text style={styles.productBrand} numberOfLines={1}>
                        {item.brand}
                      </Text>
                    )}
                    {item.price && (
                      <Text style={styles.productPrice}>€{item.price.toFixed(2)}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaViewComponent>
      </Modal>

      {/* Smart Purchase Advisor Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowModal(false);
          setSelectedProduct(null);
        }}
      >
        <SafeAreaViewComponent style={{ flex: 1, backgroundColor: '#fff' }}>
          {selectedProduct && (
            <SmartPurchaseAdvisor
              productId={selectedProduct.id}
              productName={selectedProduct.name}
              currentPrice={selectedProduct.price}
              onDismiss={() => {
                setShowModal(false);
                setSelectedProduct(null);
              }}
            />
          )}
        </SafeAreaViewComponent>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    marginBottom: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  actionCopy: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: Platform.select({ web: 20, default: 60 }),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.08)',
  },
  selectorHeaderContent: {
    flex: 1,
  },
  selectorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  selectorSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  productList: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  productBrand: {
    fontSize: 13,
    color: '#64748b',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
    marginTop: 4,
  },
});


import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface PriceComparisonProps {
  itemName: string;
  onSelect?: (productId: string, store: string, price: number) => void;
}

interface StorePrice {
  store: string;
  price: number;
  product_id: string;
  image_url: string | null;
  product_name: string;
}

const STORE_LABELS: Record<string, string> = {
  'albert-heijn': 'Albert Heijn',
  'colruyt': 'Colruyt',
  'lidl': 'Lidl',
  'jumbo': 'Jumbo',
  'delhaize': 'Delhaize',
  'carrefour': 'Carrefour',
};

export function PriceComparison({ itemName, onSelect }: PriceComparisonProps) {
  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemName || itemName.length < 2) {
      setPrices([]);
      return;
    }

    const fetchPrices = async () => {
      setLoading(true);
      setError(null);

      try {
        // Search product catalog for matches
        const { data, error: searchError } = await supabase.rpc('match_product_catalog', {
          search_term: itemName.trim(),
        });

        if (searchError) throw searchError;

        if (data && data.length > 0) {
          // Group by store and get best price per store
          const storeMap = new Map<string, StorePrice>();

          for (const product of data.slice(0, 20)) {
            const store = product.source || 'unknown';
            const price = product.price;

            if (!price) continue;

            const existing = storeMap.get(store);
            if (!existing || price < existing.price) {
              storeMap.set(store, {
                store,
                price,
                product_id: product.id,
                image_url: product.image_url,
                product_name: product.product_name,
              });
            }
          }

          // Sort by price (cheapest first)
          const sortedPrices = Array.from(storeMap.values()).sort((a, b) => a.price - b.price);
          setPrices(sortedPrices.slice(0, 5)); // Top 5 cheapest
        } else {
          setPrices([]);
        }
      } catch (err: any) {
        console.error('Error fetching prices:', err);
        setError('Kon prijzen niet laden');
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timeoutId = setTimeout(fetchPrices, 500);
    return () => clearTimeout(timeoutId);
  }, [itemName]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#047857" />
        <Text style={styles.loadingText}>Prijzen vergelijken...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (prices.length === 0) {
    return null;
  }

  const cheapest = prices[0];
  const otherStores = prices.slice(1);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>💰 Prijsvergelijking</Text>
      
      {/* Cheapest option - highlighted */}
      <TouchableOpacity
        style={[styles.priceCard, styles.cheapestCard]}
        onPress={() => onSelect?.(cheapest.product_id, cheapest.store, cheapest.price)}
      >
        <View style={styles.priceCardContent}>
          {cheapest.image_url && (
            <Image source={{ uri: cheapest.image_url }} style={styles.productImage} />
          )}
          <View style={styles.priceInfo}>
            <Text style={styles.storeName}>{STORE_LABELS[cheapest.store] || cheapest.store}</Text>
            <Text style={styles.productName} numberOfLines={1}>
              {cheapest.product_name}
            </Text>
            <Text style={styles.cheapestPrice}>€{cheapest.price.toFixed(2)}</Text>
            <View style={styles.badge}>
              <Ionicons name="trophy" size={12} color="#fff" />
              <Text style={styles.badgeText}>Goedkoopste</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Other stores */}
      {otherStores.length > 0 && (
        <View style={styles.otherStores}>
          <Text style={styles.otherStoresTitle}>Andere opties:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {otherStores.map((storePrice, index) => (
              <TouchableOpacity
                key={index}
                style={styles.otherStoreCard}
                onPress={() => onSelect?.(storePrice.product_id, storePrice.store, storePrice.price)}
              >
                <Text style={styles.otherStoreName} numberOfLines={1}>
                  {STORE_LABELS[storePrice.store] || storePrice.store}
                </Text>
                <Text style={styles.otherStorePrice}>€{storePrice.price.toFixed(2)}</Text>
                <Text style={styles.priceDiff}>
                  +€{(storePrice.price - cheapest.price).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
  },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  cheapestCard: {
    borderColor: '#047857',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  priceCardContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  priceInfo: {
    flex: 1,
    gap: 4,
  },
  storeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  cheapestPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#047857',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  otherStores: {
    marginTop: 12,
  },
  otherStoresTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  otherStoreCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    minWidth: 100,
    alignItems: 'center',
  },
  otherStoreName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  otherStorePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  priceDiff: {
    fontSize: 10,
    color: '#f97316',
    marginTop: 2,
  },
});


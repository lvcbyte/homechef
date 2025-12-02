// Smart Purchase Advisor Component
// Shows ML-powered price predictions and purchase recommendations

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { getPricePredictor, PriceDataPoint, PricePrediction } from '../../services/ml/pricePredictor';

interface SmartPurchaseAdvisorProps {
  productId: string;
  productName: string;
  currentPrice?: number;
  onDismiss?: () => void;
}

export function SmartPurchaseAdvisor({ productId, productName, currentPrice, onDismiss }: SmartPurchaseAdvisorProps) {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<PricePrediction | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);

  useEffect(() => {
    loadPriceData();
  }, [productId]);

  const loadPriceData = async () => {
    try {
      setLoading(true);

      // Fetch price history from database
      const { data, error } = await supabase.rpc('get_price_trend', {
        p_product_id: productId,
        p_days: 30,
      });

      if (error) throw error;

      // Transform to PriceDataPoint format
      const history: PriceDataPoint[] =
        data?.map((row: any) => ({
          date: row.date,
          price: parseFloat(row.avg_price) || 0,
        })) || [];

      // Add current price if available
      if (currentPrice && history.length > 0) {
        const lastDate = new Date(history[history.length - 1].date);
        const today = new Date();
        if (today.toDateString() !== lastDate.toDateString()) {
          history.push({
            date: today.toISOString().split('T')[0],
            price: currentPrice,
          });
        }
      }

      setPriceHistory(history);

      // Always try to make a prediction, even with limited data
      if (history.length >= 7) {
        // Full ML prediction with TensorFlow.js
        const predictor = getPricePredictor();
        await predictor.loadModel();
        await predictor.trainModel(history);
        const pred = await predictor.predict(history);
        setPrediction(pred);
      } else if (history.length >= 2) {
        // Simple trend analysis with limited data
        const prices = history.map((p) => p.price);
        const currentPrice = prices[prices.length - 1];
        const previousPrice = prices[prices.length - 2];
        const priceChange = currentPrice - previousPrice;
        const priceChangePercent = (priceChange / previousPrice) * 100;
        
        // Calculate average price
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const predictedPrice = currentPrice + (priceChange * 0.5); // Simple extrapolation
        
        // Determine recommendation based on trend
        let recommendation: 'buy_now' | 'wait' | 'urgent' = 'buy_now';
        if (priceChangePercent > 5) {
          recommendation = 'urgent';
        } else if (priceChangePercent < -3) {
          recommendation = 'wait';
        }
        
        // Lower confidence with less data
        const confidence = Math.min(0.7, 0.3 + (history.length / 10));
        
        setPrediction({
          predictedPrice: Math.max(0, predictedPrice),
          priceChangePercent: Math.round(priceChangePercent * 10) / 10,
          recommendation,
          confidence: Math.round(confidence * 100) / 100,
          daysUntilOptimal: recommendation === 'wait' ? 3 : 0,
        });
      } else if (history.length === 1) {
        // Only one data point - show current price
        const currentPrice = history[0].price;
        setPrediction({
          predictedPrice: currentPrice,
          priceChangePercent: 0,
          recommendation: 'buy_now',
          confidence: 0.3,
          daysUntilOptimal: 0,
        });
      } else {
        // No data at all
        setPrediction(null);
      }
    } catch (error: any) {
      console.error('Error loading price data:', error);
      Alert.alert('Fout', 'Kon prijsdata niet laden');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'urgent':
        return '#ef4444'; // Red
      case 'buy_now':
        return '#10b981'; // Green
      case 'wait':
        return '#f59e0b'; // Amber
      default:
        return '#64748b';
    }
  };

  const getRecommendationText = (rec: string) => {
    switch (rec) {
      case 'urgent':
        return 'Koop Nu!';
      case 'buy_now':
        return 'Goed Moment';
      case 'wait':
        return 'Wacht Even';
      default:
        return 'Onbekend';
    }
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'urgent':
        return 'flash';
      case 'buy_now':
        return 'checkmark-circle';
      case 'wait':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Slimme Aankoop Adviseur</Text>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#047857" />
          <Text style={styles.loadingText}>Analyseer prijstrends...</Text>
        </View>
      </View>
    );
  }

  if (!prediction) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Slimme Aankoop Adviseur</Text>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.noDataContainer}>
          <Ionicons name="information-circle" size={48} color="#94a3b8" />
          <Text style={styles.noDataText}>Geen prijsdata beschikbaar</Text>
          <Text style={styles.noDataSubtext}>
            {priceHistory.length === 0
              ? 'Er is nog geen prijsgeschiedenis voor dit product. Prijzen worden automatisch bijgehouden wanneer ze worden bijgewerkt.'
              : 'Er is onvoldoende prijsdata voor een voorspelling. Meer data wordt automatisch verzameld.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Slimme Aankoop Adviseur</Text>
          <Text style={styles.productName}>{productName}</Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      {/* Recommendation Card */}
      <View style={[styles.recommendationCard, { borderColor: getRecommendationColor(prediction.recommendation) }]}>
        <View style={styles.recommendationHeader}>
          <Ionicons name={getRecommendationIcon(prediction.recommendation)} size={32} color={getRecommendationColor(prediction.recommendation)} />
          <View style={styles.recommendationTextContainer}>
            <Text style={[styles.recommendationTitle, { color: getRecommendationColor(prediction.recommendation) }]}>
              {getRecommendationText(prediction.recommendation)}
            </Text>
            <Text style={styles.recommendationSubtitle}>
              {prediction.recommendation === 'wait'
                ? `Wacht ${prediction.daysUntilOptimal} dagen voor betere prijs`
                : prediction.recommendation === 'urgent'
                ? 'Prijs stijgt waarschijnlijk binnenkort'
                : 'Goed moment om te kopen'}
            </Text>
          </View>
        </View>
      </View>

      {/* Price Prediction */}
      <View style={styles.predictionCard}>
        <Text style={styles.sectionTitle}>Prijsvoorspelling</Text>
        <View style={styles.priceRow}>
          <View style={styles.priceItem}>
            <Text style={styles.priceLabel}>Huidige Prijs</Text>
            <Text style={styles.priceValue}>
              €{currentPrice?.toFixed(2) || priceHistory[priceHistory.length - 1]?.price.toFixed(2) || '0.00'}
            </Text>
          </View>
          <View style={styles.priceItem}>
            <Text style={styles.priceLabel}>Verwachte Prijs</Text>
            <Text style={[styles.priceValue, prediction.priceChangePercent > 0 && styles.priceIncrease]}>
              €{prediction.predictedPrice.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={styles.changeRow}>
          <Ionicons
            name={prediction.priceChangePercent > 0 ? 'trending-up' : 'trending-down'}
            size={20}
            color={prediction.priceChangePercent > 0 ? '#ef4444' : '#10b981'}
          />
          <Text
            style={[
              styles.changeText,
              { color: prediction.priceChangePercent > 0 ? '#ef4444' : '#10b981' },
            ]}
          >
            {prediction.priceChangePercent > 0 ? '+' : ''}
            {prediction.priceChangePercent.toFixed(1)}% verwachte verandering
          </Text>
        </View>
      </View>

      {/* Confidence */}
      <View style={styles.confidenceCard}>
        <Text style={styles.sectionTitle}>Betrouwbaarheid</Text>
        <View style={styles.confidenceBar}>
          <View style={[styles.confidenceFill, { width: `${prediction.confidence * 100}%` }]} />
        </View>
        <Text style={styles.confidenceText}>
          {Math.round(prediction.confidence * 100)}% betrouwbaarheid ({priceHistory.length} datapunten)
        </Text>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#64748b" />
        <Text style={styles.infoText}>
          Deze voorspelling is gebaseerd op historische prijsdata en machine learning. Resultaten kunnen variëren.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
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
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
  },
  noDataSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  recommendationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  recommendationTextContainer: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  recommendationSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  predictionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  priceIncrease: {
    color: '#ef4444',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  changeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confidenceCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#047857',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    color: '#64748b',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});


// Smart Purchase Advisor - TensorFlow.js Price Prediction Model
// Client-side ML model for predicting optimal purchase moments

// Dynamic import for TensorFlow.js (web only)
// This will be loaded asynchronously when needed
let tfPromise: Promise<any> | null = null;
let tf: any = null;

function getTensorFlow(): Promise<any> {
  if (tf) {
    return Promise.resolve(tf);
  }
  
  if (!tfPromise) {
    // Only load on web platform
    if (typeof window !== 'undefined') {
      tfPromise = import('@tensorflow/tfjs')
        .then((module) => {
          tf = module;
          return tf;
        })
        .catch((e) => {
          console.warn('TensorFlow.js not available:', e);
          return null;
        });
    } else {
      tfPromise = Promise.resolve(null);
    }
  }
  
  return tfPromise;
}

export interface PriceDataPoint {
  date: string;
  price: number;
}

export interface PricePrediction {
  predictedPrice: number;
  priceChangePercent: number;
  recommendation: 'buy_now' | 'wait' | 'urgent';
  confidence: number;
  daysUntilOptimal: number;
}

class PricePredictorModel {
  private model: any = null;
  private isLoaded = false;
  private sequenceLength = 7; // Use last 7 days to predict next day

  async loadModel(): Promise<void> {
    if (this.isLoaded && this.model) {
      return;
    }

    // Load TensorFlow.js dynamically (web only)
    const tensorFlow = await getTensorFlow();
    if (!tensorFlow) {
      console.warn('TensorFlow.js not available - ML predictions disabled');
      return;
    }

    try {
      // Try to load pre-trained model from Supabase storage
      // For now, we'll create a simple model architecture
      this.model = this.createModel(tensorFlow);
      this.isLoaded = true;
    } catch (error) {
      console.error('Error loading price prediction model:', error);
      // Fallback: create a new model
      this.model = this.createModel(tensorFlow);
      this.isLoaded = true;
    }
  }

  private createModel(tfLib: any): any {
    if (!tfLib) return null;
    
    const model = tfLib.sequential({
      layers: [
        tfLib.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [this.sequenceLength, 1],
        }),
        tfLib.layers.dropout({ rate: 0.2 }),
        tfLib.layers.lstm({
          units: 50,
          returnSequences: false,
        }),
        tfLib.layers.dropout({ rate: 0.2 }),
        tfLib.layers.dense({ units: 25 }),
        tfLib.layers.dense({ units: 1 }),
      ],
    });

    model.compile({
      optimizer: tfLib.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['meanAbsoluteError'],
    });

    return model;
  }

  async trainModel(priceHistory: PriceDataPoint[]): Promise<void> {
    const tensorFlow = await getTensorFlow();
    if (!tensorFlow) {
      console.warn('TensorFlow.js not available - skipping training');
      return;
    }

    if (!this.model) {
      await this.loadModel();
    }

    if (!this.model) {
      console.warn('Model not available - skipping training');
      return;
    }

    if (priceHistory.length < this.sequenceLength + 1) {
      console.warn('Insufficient data for training');
      return;
    }

    // Prepare training data
    const prices = priceHistory.map((p) => p.price);
    const { sequences, targets } = this.prepareSequences(prices);

    if (sequences.length === 0) {
      return;
    }

    const xs = tensorFlow.tensor3d(sequences);
    const ys = tensorFlow.tensor2d(targets);

    // Normalize data
    const { normalizedXs, normalizedYs, priceMin, priceMax } = this.normalizeData(tensorFlow, xs, ys);

    try {
      // Train model (with minimal epochs for client-side)
      await this.model!.fit(normalizedXs, normalizedYs, {
        epochs: 10,
        batchSize: 8,
        shuffle: true,
        verbose: 0,
      });

      // Denormalize for future predictions
      (this.model as any).priceMin = priceMin;
      (this.model as any).priceMax = priceMax;
    } finally {
      xs.dispose();
      ys.dispose();
      normalizedXs.dispose();
      normalizedYs.dispose();
    }
  }

  private prepareSequences(prices: number[]): { sequences: number[][]; targets: number[] } {
    const sequences: number[][] = [];
    const targets: number[] = [];

    for (let i = this.sequenceLength; i < prices.length; i++) {
      sequences.push(prices.slice(i - this.sequenceLength, i));
      targets.push(prices[i]);
    }

    return { sequences, targets };
  }

  private normalizeData(
    tfLib: any,
    xs: any,
    ys: any
  ): {
    normalizedXs: any;
    normalizedYs: any;
    priceMin: number;
    priceMax: number;
  } {
    const priceMin = Math.min(...Array.from(ys.dataSync()));
    const priceMax = Math.max(...Array.from(ys.dataSync()));
    const range = priceMax - priceMin || 1;

    const normalizedXs = xs.sub(priceMin).div(range);
    const normalizedYs = ys.sub(priceMin).div(range);

    return { normalizedXs, normalizedYs, priceMin, priceMax };
  }

  async predict(priceHistory: PriceDataPoint[]): Promise<PricePrediction> {
    const tensorFlow = await getTensorFlow();
    
    if (!tensorFlow) {
      // Fallback prediction without ML
      const currentPrice = priceHistory[priceHistory.length - 1]?.price || 0;
      return {
        predictedPrice: currentPrice,
        priceChangePercent: 0,
        recommendation: 'buy_now',
        confidence: 0.3,
        daysUntilOptimal: 0,
      };
    }

    if (!this.model) {
      await this.loadModel();
    }

    if (!this.model || priceHistory.length < this.sequenceLength) {
      // Not enough data, return default prediction
      const currentPrice = priceHistory[priceHistory.length - 1]?.price || 0;
      return {
        predictedPrice: currentPrice,
        priceChangePercent: 0,
        recommendation: 'buy_now',
        confidence: 0.5,
        daysUntilOptimal: 0,
      };
    }

    // Get last sequence
    const prices = priceHistory.slice(-this.sequenceLength).map((p) => p.price);
    const currentPrice = prices[prices.length - 1];

    // Normalize input
    const priceMin = (this.model as any).priceMin || Math.min(...prices);
    const priceMax = (this.model as any).priceMax || Math.max(...prices);
    const range = priceMax - priceMin || 1;

    const normalizedPrices = prices.map((p) => (p - priceMin) / range);
    const input = tensorFlow.tensor3d([normalizedPrices.map((p) => [p])]);

    try {
      // Predict
      const prediction = this.model!.predict(input);
      const predictedValue = (await prediction.data())[0];

      // Denormalize
      const predictedPrice = predictedValue * range + priceMin;
      const priceChangePercent = ((predictedPrice - currentPrice) / currentPrice) * 100;

      // Determine recommendation
      let recommendation: 'buy_now' | 'wait' | 'urgent' = 'buy_now';
      let daysUntilOptimal = 0;

      if (priceChangePercent > 10) {
        recommendation = 'urgent';
        daysUntilOptimal = 0;
      } else if (priceChangePercent > 5) {
        recommendation = 'buy_now';
        daysUntilOptimal = 0;
      } else if (priceChangePercent < -5) {
        recommendation = 'wait';
        daysUntilOptimal = 3; // Wait a few days
      }

      // Calculate confidence based on data quality
      const confidence = Math.min(0.95, Math.max(0.5, priceHistory.length / 30));

      prediction.dispose();
      input.dispose();

      return {
        predictedPrice,
        priceChangePercent: Math.round(priceChangePercent * 10) / 10,
        recommendation,
        confidence: Math.round(confidence * 100) / 100,
        daysUntilOptimal,
      };
    } catch (error) {
      console.error('Error making prediction:', error);
      return {
        predictedPrice: currentPrice,
        priceChangePercent: 0,
        recommendation: 'buy_now',
        confidence: 0.5,
        daysUntilOptimal: 0,
      };
    }
  }
}

// Singleton instance
let pricePredictorInstance: PricePredictorModel | null = null;

export function getPricePredictor(): PricePredictorModel {
  if (!pricePredictorInstance) {
    pricePredictorInstance = new PricePredictorModel();
  }
  return pricePredictorInstance;
}


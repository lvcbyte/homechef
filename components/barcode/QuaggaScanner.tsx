import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Quagga from '@ericblade/quagga2';

interface QuaggaScannerProps {
  onDetected: (code: string) => void;
  onError?: (error: Error) => void;
  style?: any;
}

export function QuaggaScanner({ onDetected, onError, style }: QuaggaScannerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedCode = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);

  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const initQuagga = async () => {
      try {
        await Quagga.init(
          {
            inputStream: {
              name: 'Live',
              type: 'LiveStream',
              target: container,
              constraints: {
                width: 640,
                height: 480,
                facingMode: 'environment', // Use back camera
              },
              area: {
                // Define scanning area (optional)
                top: '20%',
                right: '10%',
                bottom: '20%',
                left: '10%',
              },
            },
            locator: {
              patchSize: 'medium',
              halfSample: true,
            },
            numOfWorkers: 2,
            decoder: {
              readers: [
                'ean_reader',
                'ean_8_reader',
                'code_128_reader',
                'code_39_reader',
                'upc_reader',
                'upc_e_reader',
              ],
            },
            locate: true,
          },
          (err: any) => {
            if (err) {
              console.error('Quagga initialization error:', err);
              onError?.(new Error(`Quagga initialization failed: ${err.message || err}`));
              return;
            }
            console.log('Quagga initialized successfully');
            Quagga.start();
            setIsInitialized(true);
          }
        );

        Quagga.onDetected((result: any) => {
          const code = result.codeResult.code;
          const now = Date.now();

          // Prevent duplicate scans within 2 seconds
          if (lastScannedCode.current === code && now - lastScanTime.current < 2000) {
            return;
          }

          lastScannedCode.current = code;
          lastScanTime.current = now;

          console.log('Quagga detected barcode:', code);
          onDetected(code);
        });
      } catch (error) {
        console.error('Error initializing Quagga:', error);
        onError?.(error instanceof Error ? error : new Error('Unknown error'));
      }
    };

    initQuagga();

    return () => {
      if (isInitialized) {
        Quagga.stop();
        Quagga.offDetected();
      }
    };
  }, [onDetected, onError, isInitialized]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <div ref={containerRef} style={styles.quaggaContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  quaggaContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
});


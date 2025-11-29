import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

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

    // Dynamically import Quagga only on web
    let Quagga: any;
    const loadQuagga = async () => {
      try {
        Quagga = (await import('@ericblade/quagga2')).default;
      } catch (error) {
        console.error('Failed to load Quagga:', error);
        onError?.(new Error('Failed to load barcode scanner library'));
        return;
      }

      const container = containerRef.current;
      if (!container) {
        // Create container if it doesn't exist
        const div = document.createElement('div');
        div.id = 'quagga-scanner-container';
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.position = 'relative';
        const parent = document.getElementById('quagga-parent');
        if (parent) {
          parent.appendChild(div);
          containerRef.current = div;
        } else {
          onError?.(new Error('Scanner container not found'));
          return;
        }
      }

      const initQuagga = () => {
        try {
          Quagga.init(
            {
              inputStream: {
                name: 'Live',
                type: 'LiveStream',
                target: containerRef.current!,
                constraints: {
                  width: { min: 640, ideal: 1280, max: 1920 },
                  height: { min: 480, ideal: 720, max: 1080 },
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
    };

    loadQuagga();

    return () => {
      if (isInitialized && typeof window !== 'undefined') {
        try {
          const QuaggaModule = require('@ericblade/quagga2');
          if (QuaggaModule.default) {
            QuaggaModule.default.stop();
            QuaggaModule.default.offDetected();
          }
        } catch (error) {
          console.error('Error stopping Quagga:', error);
        }
      }
    };
  }, [onDetected, onError, isInitialized]);

  if (Platform.OS !== 'web') {
    return null;
  }

  // Use a web-compatible approach
  return (
    <View 
      style={[styles.container, style]}
      // @ts-ignore - web-only prop
      id="quagga-parent"
      // @ts-ignore - web-only prop
      ref={(ref: any) => {
        if (ref && typeof document !== 'undefined') {
          const element = document.getElementById('quagga-parent');
          if (element && !containerRef.current) {
            const div = document.createElement('div');
            div.id = 'quagga-scanner-container';
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.position = 'relative';
            element.appendChild(div);
            containerRef.current = div;
          }
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});


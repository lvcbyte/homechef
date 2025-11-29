import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface QuaggaScannerProps {
  onDetected: (code: string) => void;
  onError?: (error: Error) => void;
  style?: any;
}

export function QuaggaScanner({ onDetected, onError, style }: QuaggaScannerProps) {
  const containerId = 'quagga-scanner-container-' + Math.random().toString(36).substr(2, 9);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedCode = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);
  const quaggaRef = useRef<any>(null);

  useEffect(() => {
    // Only run on web
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const initQuagga = async () => {
      try {
        // Dynamically import Quagga
        const QuaggaModule = await import('@ericblade/quagga2');
        const Quagga = QuaggaModule.default;
        quaggaRef.current = Quagga;

        // Wait for container to be available
        const checkContainer = () => {
          const container = document.getElementById(containerId);
          if (!container) {
            setTimeout(checkContainer, 100);
            return;
          }

          try {
            Quagga.init(
              {
                inputStream: {
                  name: 'Live',
                  type: 'LiveStream',
                  target: container,
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

        checkContainer();
      } catch (error) {
        console.error('Error loading Quagga:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to load barcode scanner'));
      }
    };

    initQuagga();

    return () => {
      if (isInitialized && quaggaRef.current) {
        try {
          quaggaRef.current.stop();
          quaggaRef.current.offDetected();
        } catch (error) {
          console.error('Error stopping Quagga:', error);
        }
      }
    };
  }, [onDetected, onError, isInitialized, containerId]);

  useEffect(() => {
    // Create container div when component mounts (web only)
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const parent = document.getElementById('quagga-parent');
      if (parent && !document.getElementById(containerId)) {
        const div = document.createElement('div');
        div.id = containerId;
        div.style.width = '100%';
        div.style.height = '100%';
        div.style.position = 'relative';
        div.style.backgroundColor = '#000';
        parent.appendChild(div);
      }
    }
  }, [containerId]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View 
      style={[styles.container, style]}
      // @ts-ignore - web-only prop
      id="quagga-parent"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

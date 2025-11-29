// Web-only implementation of QuaggaScanner
// This file is only loaded on web platform, preventing native bundling issues

import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

interface QuaggaScannerProps {
  onDetected: (code: string) => void;
  onError?: (error: Error) => void;
  style?: any;
  flashEnabled?: boolean;
}

export function QuaggaScanner({ onDetected, onError, style, flashEnabled = false }: QuaggaScannerProps) {
  const containerId = 'quagga-scanner-container-' + Math.random().toString(36).substr(2, 9);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastScannedCode = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);
  const quaggaRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const initQuagga = async () => {
      try {
        // Dynamically import Quagga only on web
        let Quagga: any;
        try {
          const QuaggaModule = await import('@ericblade/quagga2');
          Quagga = QuaggaModule.default || QuaggaModule;
        } catch (importError) {
          console.error('Failed to import Quagga:', importError);
          onError?.(new Error('Barcode scanner library kon niet worden geladen. Probeer de pagina te verversen.'));
          return;
        }
        
        if (!Quagga) {
          onError?.(new Error('Barcode scanner niet beschikbaar'));
          return;
        }
        
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
                    advanced: flashEnabled ? [{ torch: true }] : [],
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
                
                // Get the video stream for flash control
                const videoElement = container.querySelector('video');
                if (videoElement && videoElement.srcObject) {
                  streamRef.current = videoElement.srcObject as MediaStream;
                }
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
      // Stop stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [onDetected, onError, isInitialized, containerId]);

  // Update flash when it changes
  useEffect(() => {
    if (streamRef.current && typeof navigator !== 'undefined') {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && 'applyConstraints' in videoTrack) {
        const capabilities = videoTrack.getCapabilities();
        if (capabilities && 'torch' in capabilities) {
          videoTrack.applyConstraints({
            advanced: [{ torch: flashEnabled }] as any,
          } as any).catch((err: any) => {
            console.log('Flash not supported or failed:', err);
          });
        }
      }
    }
  }, [flashEnabled]);

  useEffect(() => {
    // Create container div when component mounts (web only)
    if (typeof document !== 'undefined') {
      const parent = document.getElementById('quagga-parent');
      if (parent && !document.getElementById(containerId)) {
        const div = document.createElement('div');
        div.id = containerId;
        div.style.width = '100vw';
        div.style.height = '100vh';
        div.style.position = 'fixed';
        div.style.top = '0';
        div.style.left = '0';
        div.style.backgroundColor = '#000';
        div.style.overflow = 'hidden';
        div.style.zIndex = '1';
        // Ensure video is visible
        const styleId = `quagga-style-${containerId}`;
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            #${containerId} {
              width: 100vw !important;
              height: 100vh !important;
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              overflow: hidden !important;
              z-index: 1 !important;
            }
            #${containerId} video,
            #${containerId} canvas {
              width: 100vw !important;
              height: 100vh !important;
              object-fit: cover !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              z-index: 1 !important;
            }
            #${containerId} canvas {
              z-index: 2 !important;
            }
            #${containerId} > div {
              width: 100vw !important;
              height: 100vh !important;
            }
          `;
          document.head.appendChild(style);
        }
        parent.appendChild(div);
      }
    }
  }, [containerId]);

  return (
    <View 
      style={[styles.container, style]}
      // @ts-ignore - web-only prop
      id="quagga-parent"
      pointerEvents="box-none"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});


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

        // Wait for container to be available and have dimensions
        let retryCount = 0;
        const maxRetries = 5;
        
        const checkContainer = () => {
          const container = document.getElementById(containerId);
          if (!container) {
            if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(checkContainer, 200);
            } else {
              onError?.(new Error('Container kon niet worden gevonden'));
            }
            return;
          }

          // Ensure container has dimensions before initializing Quagga
          const rect = container.getBoundingClientRect();
          const hasDimensions = rect.width > 0 && rect.height > 0;
          
          if (!hasDimensions) {
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Container has no dimensions yet, waiting... (attempt ${retryCount}/${maxRetries})`, rect);
              setTimeout(checkContainer, 200);
            } else {
              // Use window dimensions as fallback
              const width = window.innerWidth || 640;
              const height = window.innerHeight || 480;
              container.style.width = `${width}px`;
              container.style.height = `${height}px`;
              console.log('Using window dimensions as fallback:', width, height);
            }
          } else {
            // Use actual dimensions
            container.style.width = `${rect.width}px`;
            container.style.height = `${rect.height}px`;
          }

          // Ensure container is visible and has proper styling
          container.style.position = 'fixed';
          container.style.top = '0';
          container.style.left = '0';
          container.style.backgroundColor = '#000';
          container.style.overflow = 'hidden';
          container.style.display = 'block';
          container.style.visibility = 'visible';

          // Force a reflow to ensure styles are applied
          void container.offsetWidth;
          void container.offsetHeight;

          // Get final dimensions after style application
          const finalRect = container.getBoundingClientRect();
          const finalWidth = finalRect.width || window.innerWidth || 640;
          const finalHeight = finalRect.height || window.innerHeight || 480;

          console.log('Initializing Quagga with container dimensions:', {
            width: finalWidth,
            height: finalHeight,
            containerId,
          });

          try {
            // Initialize Quagga with explicit dimensions
            Quagga.init(
              {
                inputStream: {
                  name: 'Live',
                  type: 'LiveStream',
                  target: container,
                  constraints: {
                    width: { min: 640, ideal: Math.min(finalWidth, 1280), max: 1920 },
                    height: { min: 480, ideal: Math.min(finalHeight, 720), max: 1080 },
                    facingMode: 'environment', // Use back camera
                    aspectRatio: { ideal: finalWidth / finalHeight },
                    advanced: flashEnabled ? [{ torch: true }] : [],
                  },
                  singleChannel: false, // Use color for better detection
                },
                locator: {
                  patchSize: 'large', // Larger patch size for better detection
                  halfSample: false, // Don't half sample for better quality
                },
                numOfWorkers: 4, // More workers for better performance
                frequency: 10, // Check every 10 frames for better responsiveness
                decoder: {
                  readers: [
                    'ean_reader',
                    'ean_8_reader',
                    'code_128_reader',
                    'code_39_reader',
                    'upc_reader',
                    'upc_e_reader',
                    'codabar_reader',
                    'i2of5_reader',
                  ],
                  debug: {
                    drawBoundingBox: false,
                    showFrequency: false,
                    drawScanline: false,
                    showPattern: false,
                  },
                },
                locate: true,
              },
              (err: any) => {
                if (err) {
                  console.error('Quagga initialization error:', err);
                  // Don't retry if we've already retried multiple times
                  if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(() => {
                      console.log(`Retrying Quagga initialization... (attempt ${retryCount}/${maxRetries})`);
                      checkContainer();
                    }, 1000);
                  } else {
                    onError?.(new Error(`Quagga initialization failed: ${err.message || err}`));
                  }
                  return;
                }
                console.log('Quagga initialized successfully');
                
                // Start Quagga after a small delay to ensure everything is ready
                setTimeout(() => {
                  try {
                    Quagga.start();
                    setIsInitialized(true);
                    retryCount = 0; // Reset retry count on success
                    console.log('✅ Quagga scanner started successfully');
                    
                    // Get the video stream for flash control
                    // Wait a bit for video element to be created
                    setTimeout(() => {
                      const videoElement = container.querySelector('video');
                      if (videoElement && videoElement.srcObject) {
                        streamRef.current = videoElement.srcObject as MediaStream;
                        console.log('✅ Video stream captured for flash control');
                        
                        // Verify video is actually playing
                        if (videoElement.readyState >= 2) {
                          console.log('✅ Video stream is active and ready');
                        } else {
                          console.warn('⚠️ Video stream may not be ready yet');
                        }
                      } else {
                        console.warn('⚠️ Video element not found or no stream available');
                      }
                    }, 1000);
                  } catch (startError) {
                    console.error('❌ Error starting Quagga:', startError);
                    // Retry starting once
                    setTimeout(() => {
                      try {
                        console.log('🔄 Retrying Quagga start...');
                        Quagga.start();
                        setIsInitialized(true);
                      } catch (retryError) {
                        console.error('❌ Retry failed:', retryError);
                        onError?.(new Error(`Failed to start scanner: ${startError}`));
                      }
                    }, 1000);
                  }
                }, 300);
              }
            );

            // Track processing state for health monitoring
            let lastProcessedTime = Date.now();
            let consecutiveErrors = 0;
            const maxConsecutiveErrors = 10;
            
            Quagga.onDetected((result: any) => {
              try {
                if (!result || !result.codeResult) {
                  return;
                }
                
                const code = result.codeResult.code;
                if (!code || typeof code !== 'string' || code.trim().length === 0) {
                  return;
                }
                
                // Validate barcode format (EAN should be 8 or 13 digits, UPC 12 digits)
                const cleanCode = code.trim().replace(/\s/g, '');
                const isValidFormat = /^\d{8,13}$/.test(cleanCode) || /^[A-Z0-9\-]+$/.test(cleanCode);
                
                if (!isValidFormat) {
                  console.warn('Invalid barcode format:', cleanCode);
                  return;
                }
                
                const now = Date.now();

                // Prevent duplicate scans within 1 second (reduced from 2 for better responsiveness)
                if (lastScannedCode.current === cleanCode && now - lastScanTime.current < 1000) {
                  return;
                }

                // Reset error counter on successful detection
                consecutiveErrors = 0;
                lastProcessedTime = now;
                
                lastScannedCode.current = cleanCode;
                lastScanTime.current = now;

                console.log('✅ Quagga detected barcode:', cleanCode, 'confidence:', result.codeResult.decodedCodes?.length || 'N/A');
                onDetected(cleanCode);
              } catch (error) {
                consecutiveErrors++;
                console.error('Error processing Quagga detection:', error);
                if (consecutiveErrors >= maxConsecutiveErrors) {
                  console.warn('Too many consecutive errors, scanner may need restart');
                }
              }
            });
            
            // Monitor processing health
            Quagga.onProcessed((result: any) => {
              lastProcessedTime = Date.now();
              
              // Check if scanner is still processing frames
              if (result) {
                consecutiveErrors = 0; // Reset on successful frame processing
              }
            });
            
            // Health check: restart if scanner stops processing
            const healthCheckInterval = setInterval(() => {
              const timeSinceLastProcess = Date.now() - lastProcessedTime;
              
              // If no processing for 5 seconds and scanner is initialized, restart
              if (timeSinceLastProcess > 5000 && isInitialized) {
                console.warn('Scanner health check: No processing detected, restarting...');
                try {
                  Quagga.stop();
                  setTimeout(() => {
                    Quagga.start();
                    lastProcessedTime = Date.now();
                  }, 500);
                } catch (error) {
                  console.error('Error during health check restart:', error);
                }
              }
            }, 5000);
            
            // Store interval for cleanup
            (quaggaRef.current as any).healthCheckInterval = healthCheckInterval;
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
      // Clear health check interval
      if (quaggaRef.current && (quaggaRef.current as any).healthCheckInterval) {
        clearInterval((quaggaRef.current as any).healthCheckInterval);
      }
      
      if (isInitialized && quaggaRef.current) {
        try {
          quaggaRef.current.stop();
          quaggaRef.current.offDetected();
          quaggaRef.current.offProcessed();
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

  // Update flash when it changes - actually control device torch
  useEffect(() => {
    const updateFlash = async () => {
      if (!isInitialized) return;
      
      // Try to get the video element from Quagga container
      const container = document.getElementById(containerId);
      if (!container) return;
      
      const videoElement = container.querySelector('video') as HTMLVideoElement;
      if (!videoElement || !videoElement.srcObject) {
        // Try to get stream from Quagga's internal state
        setTimeout(updateFlash, 500);
        return;
      }
      
      const stream = videoElement.srcObject as MediaStream;
      if (!stream) return;
      
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;
      
      try {
        const capabilities = videoTrack.getCapabilities();
        console.log('Video track capabilities:', capabilities);
        
        // Check if torch is supported
        if (capabilities && 'torch' in capabilities && capabilities.torch) {
          // Use applyConstraints to control torch
          await videoTrack.applyConstraints({
            advanced: [{ torch: flashEnabled }] as any,
          } as any);
          console.log('Flash toggled:', flashEnabled);
        } else {
          // Fallback: try to get new stream with torch constraint
          if (flashEnabled) {
            try {
              const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: 'environment',
                  torch: true,
                } as any,
              });
              
              // Replace the track
              if (newStream.getVideoTracks().length > 0) {
                const newTrack = newStream.getVideoTracks()[0];
                videoTrack.replaceTrack(newTrack).catch((err) => {
                  console.log('Could not replace track:', err);
                });
              }
            } catch (err) {
              console.log('Could not enable torch:', err);
            }
          }
        }
      } catch (error) {
        console.log('Flash control error:', error);
      }
    };
    
    updateFlash();
  }, [flashEnabled, isInitialized, containerId]);

  useEffect(() => {
    // Create container div when component mounts (web only)
    if (typeof document !== 'undefined') {
      let createAttempts = 0;
      const maxCreateAttempts = 10;
      
      const createContainer = () => {
        const parent = document.getElementById('quagga-parent');
        if (!parent) {
          if (createAttempts < maxCreateAttempts) {
            createAttempts++;
            setTimeout(createContainer, 100);
            return;
          }
          console.error('Quagga parent container not found after', maxCreateAttempts, 'attempts');
          return;
        }
        
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div');
          container.id = containerId;
          
          // Use explicit pixel dimensions based on window size
          const width = window.innerWidth || 640;
          const height = window.innerHeight || 480;
          
          container.style.width = `${width}px`;
          container.style.height = `${height}px`;
          container.style.position = 'fixed';
          container.style.top = '0';
          container.style.left = '0';
          container.style.backgroundColor = '#000';
          container.style.overflow = 'hidden';
          container.style.zIndex = '1';
          container.style.display = 'block';
          container.style.visibility = 'visible';
          
          // Ensure video is visible
          const styleId = `quagga-style-${containerId}`;
          if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
              #${containerId} {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                overflow: hidden !important;
                z-index: 1 !important;
                display: block !important;
                visibility: visible !important;
                background-color: #000 !important;
              }
              #${containerId} video,
              #${containerId} canvas {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                z-index: 1 !important;
                display: block !important;
              }
              #${containerId} canvas {
                z-index: 2 !important;
              }
              #${containerId} > div {
                width: 100% !important;
                height: 100% !important;
              }
            `;
            document.head.appendChild(style);
          }
          parent.appendChild(container);
          
          // Force a reflow to ensure dimensions are calculated
          void container.offsetWidth;
          void container.offsetHeight;
          
          // Update dimensions on window resize
          const updateDimensions = () => {
            const newWidth = window.innerWidth || 640;
            const newHeight = window.innerHeight || 480;
            container.style.width = `${newWidth}px`;
            container.style.height = `${newHeight}px`;
          };
          window.addEventListener('resize', updateDimensions);
          
          console.log('Quagga container created:', containerId, {
            width: container.offsetWidth,
            height: container.offsetHeight,
            rect: container.getBoundingClientRect(),
          });
        }
      };
      
      // Wait a bit for React to render the parent, but start immediately
      if (document.getElementById('quagga-parent')) {
        createContainer();
      } else {
        setTimeout(createContainer, 100);
      }
    }
  }, [containerId]);

  return (
    <View 
      style={[styles.container, style]}
      // @ts-ignore - web-only prop
      id="quagga-parent"
      style={{ pointerEvents: 'box-none' }}
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


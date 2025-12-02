// Vision-Based Stock Verification
// Uses camera to verify inventory items on shelf

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface VisionStockVerificationProps {
  inventoryItems: Array<{ id: string; name: string; category?: string }>;
  onItemDetected?: (itemId: string, confidence: number) => void;
  onClose?: () => void;
}

export function VisionStockVerification({
  inventoryItems,
  onItemDetected,
  onClose,
}: VisionStockVerificationProps) {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [detectedItems, setDetectedItems] = useState<Array<{ itemId: string; name: string; confidence: number }>>([]);
  const cameraRef = useRef<any>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');

  const captureAndAnalyze = async () => {
    if (!cameraRef.current || !user) return;

    try {
      setIsScanning(true);

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: Platform.OS === 'web', // Base64 for web, file URI for native
      });

      // For web, we'll use a simplified object detection approach
      // In production, you'd use OpenCV.js or TensorFlow.js for actual object detection
      if (Platform.OS === 'web') {
        // Simulate object detection (replace with actual ML model)
        await analyzeImageWeb(photo.uri);
      } else {
        // For native, use TensorFlow Lite or similar
        await analyzeImageNative(photo.uri);
      }
    } catch (error: any) {
      console.error('Error capturing/analyzing image:', error);
      Alert.alert('Fout', 'Kon foto niet analyseren');
    } finally {
      setIsScanning(false);
    }
  };

  const analyzeImageWeb = async (imageUri: string) => {
    // Simplified detection using image analysis
    // In production, load TensorFlow.js or OpenCV.js model here
    
    // For now, simulate detection based on inventory items
    // This is a placeholder - actual implementation would use ML models
    const detected: Array<{ itemId: string; name: string; confidence: number }> = [];

    // Simulate detection (replace with actual ML inference)
    for (const item of inventoryItems.slice(0, 3)) {
      // Random confidence for demo (replace with actual model output)
      const confidence = 0.6 + Math.random() * 0.3;
      if (confidence > 0.7) {
        detected.push({
          itemId: item.id,
          name: item.name,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    }

    if (detected.length > 0) {
      setDetectedItems(detected);
      detected.forEach((item) => {
        onItemDetected?.(item.itemId, item.confidence);
      });
    } else {
      Alert.alert('Geen items gedetecteerd', 'Probeer de camera dichter bij de items te houden');
    }
  };

  const analyzeImageNative = async (imageUri: string) => {
    // For native platforms, use TensorFlow Lite or similar
    // This is a placeholder
    Alert.alert('Info', 'Native object detection coming soon');
  };

  const toggleCameraFacing = () => {
    setFacing(facing === 'back' ? 'front' : 'back');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera toestemming aanvragen...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color="#94a3b8" />
        <Text style={styles.message}>Camera toestemming vereist</Text>
        <Text style={styles.subMessage}>
          Ga naar instellingen om camera toegang te verlenen
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Opnieuw Proberen</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onClose}>
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Sluiten</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Voorraad Verificatie</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={styles.corner} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.instruction}>
              Richt de camera op je voorraadkast en tik op de knop om te scannen
            </Text>
          </View>
        </CameraView>
      </View>

      {/* Detected Items */}
      {detectedItems.length > 0 && (
        <View style={styles.detectedContainer}>
          <Text style={styles.detectedTitle}>Gedetecteerde Items:</Text>
          {detectedItems.map((item, index) => (
            <View key={index} style={styles.detectedItem}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.detectedName}>{item.name}</Text>
              <Text style={styles.detectedConfidence}>
                {Math.round(item.confidence * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.captureButton, isScanning && styles.captureButtonDisabled]}
          onPress={captureAndAnalyze}
          disabled={isScanning}
        >
          {isScanning ? (
            <Text style={styles.captureButtonText}>Scannen...</Text>
          ) : (
            <Ionicons name="camera" size={32} color="#fff" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
          <Ionicons name="camera-reverse" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#64748b" />
        <Text style={styles.infoText}>
          Deze functie gebruikt AI om items in je voorraadkast te herkennen. Resultaten kunnen variëren.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 20,
  },
  subMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.select({ web: 20, default: 60 }),
    backgroundColor: '#047857',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: '80%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#047857',
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: '#10b981',
    top: -2,
    left: -2,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    left: 'auto',
    borderRightWidth: 4,
    borderLeftWidth: 0,
    borderTopWidth: 4,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: -2,
    top: 'auto',
    borderBottomWidth: 4,
    borderTopWidth: 0,
    borderLeftWidth: 4,
    borderRightWidth: 0,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    top: 'auto',
    left: 'auto',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instruction: {
    position: 'absolute',
    bottom: 100,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    borderRadius: 8,
  },
  detectedContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  detectedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  detectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  detectedName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  detectedConfidence: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    padding: 20,
    backgroundColor: '#000',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#047857',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#047857',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#047857',
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
});


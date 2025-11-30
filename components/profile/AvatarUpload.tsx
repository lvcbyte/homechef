import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl?: string | null;
  onAvatarChange?: (localUri: string | null) => void; // Called when user selects a new image (local URI)
  onAvatarUploaded?: (avatarUrl: string | null) => void; // Called after successful upload
}

export function AvatarUpload({ userId, currentAvatarUrl, onAvatarChange, onAvatarUploaded }: AvatarUploadProps) {
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Update preview when currentAvatarUrl changes
  useEffect(() => {
    if (currentAvatarUrl) {
      setLocalPreviewUri(currentAvatarUrl);
    }
  }, [currentAvatarUrl]);

  const pickImage = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Toestemming nodig', 'We hebben toegang tot je foto\'s nodig om een profielfoto te uploaden.');
      return;
    }

    // Launch image picker with aggressive compression
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4, // Very low quality for maximum compression
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return;
    }

    // Show preview immediately with local URI
    setLocalPreviewUri(asset.uri);
    onAvatarChange?.(asset.uri);
  };

  const takePhoto = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Toestemming nodig', 'We hebben toegang tot je camera nodig om een foto te maken.');
      return;
    }

    // Launch camera with aggressive compression
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4, // Very low quality for maximum compression
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return;
    }

    // Show preview immediately with local URI
    setLocalPreviewUri(asset.uri);
    onAvatarChange?.(asset.uri);
  };

  const removeAvatar = async () => {
    Alert.alert(
      'Profielfoto verwijderen',
      'Weet je zeker dat je je profielfoto wilt verwijderen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from storage
              if (currentAvatarUrl && currentAvatarUrl.startsWith('http')) {
                try {
                  const urlParts = currentAvatarUrl.split('/profile-avatars/');
                  if (urlParts.length > 1) {
                    const oldPath = urlParts[1];
                    await supabase.storage.from('profile-avatars').remove([oldPath]);
                  }
                } catch (error) {
                  console.log('Could not delete avatar from storage:', error);
                }
              }

              // Update profile
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', userId);

              if (error) throw error;

              setLocalPreviewUri(null);
              onAvatarChange?.(null);
              onAvatarUploaded?.(null);
            } catch (error: any) {
              console.error('Error removing avatar:', error);
              Alert.alert('Fout', 'Kon profielfoto niet verwijderen.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Profielfoto</Text>
      <View style={styles.avatarSection}>
        <View style={styles.avatarContainer}>
          {localPreviewUri ? (
            <Image 
              source={{ uri: localPreviewUri }} 
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="#94a3b8" />
            </View>
          )}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={pickImage}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={18} color="#047857" />
            <Text style={styles.actionButtonText}>Kies foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={takePhoto}
            disabled={uploading}
          >
            <Ionicons name="camera-outline" size={18} color="#047857" />
            <Text style={styles.actionButtonText}>Maak foto</Text>
          </TouchableOpacity>
          {localPreviewUri && (
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={removeAvatar}
              disabled={uploading}
            >
              <Ionicons name="trash-outline" size={18} color="#e11d48" />
              <Text style={[styles.actionButtonText, styles.removeButtonText]}>Verwijder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// Helper function to compress image - ALWAYS succeeds, even for 10MB+ photos
async function compressImageToBlob(uri: string, maxSizeBytes: number = 1500000): Promise<Blob> {
  const isWeb = Platform.OS === 'web';
  
  if (isWeb && typeof window !== 'undefined' && typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    // Web: Use canvas for aggressive compression
    return new Promise((resolve) => {
      // Use window.Image for browser compatibility (React Native Web)
      // Get Image constructor safely, handling default exports
      let ImageConstructor: any = null;
      
      try {
        if (typeof window !== 'undefined' && (window as any).Image) {
          ImageConstructor = (window as any).Image;
        } else if (typeof global !== 'undefined' && (global as any).Image) {
          ImageConstructor = (global as any).Image;
        } else if (typeof globalThis !== 'undefined' && (globalThis as any).Image) {
          ImageConstructor = (globalThis as any).Image;
        }
        
        // Handle case where Image might be a default export (Image.default)
        if (ImageConstructor && typeof ImageConstructor === 'object' && ImageConstructor.default) {
          ImageConstructor = ImageConstructor.default;
        }
        
        // Ensure it's a function
        if (ImageConstructor && typeof ImageConstructor !== 'function') {
          ImageConstructor = null;
        }
      } catch (e) {
        console.log('Error getting Image constructor:', e);
        ImageConstructor = null;
      }
      
      if (!ImageConstructor) {
        // Fallback: fetch as blob
        fetch(uri).then(r => r.blob()).then(resolve).catch(() => resolve(new Blob()));
        return;
      }
      
      const img = new ImageConstructor();
      if (img && typeof img.crossOrigin !== 'undefined') {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => {
        // Start with small dimensions
        let targetWidth = Math.min(400, img.width);
        let targetHeight = Math.min(400, img.height);
        
        // Maintain aspect ratio
        if (img.width > img.height) {
          targetHeight = Math.round((img.height / img.width) * targetWidth);
        } else {
          targetWidth = Math.round((img.width / img.height) * targetHeight);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          // Fallback: fetch as blob
          fetch(uri).then(r => r.blob()).then(resolve);
          return;
        }
        
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Try compression with decreasing quality until size is acceptable
        let quality = 0.5;
        const tryCompress = (): void => {
          canvas.toBlob((blob) => {
            if (!blob) {
              // If toBlob fails, reduce dimensions and try again
              if (targetWidth > 200) {
                targetWidth = Math.round(targetWidth * 0.8);
                targetHeight = Math.round(targetHeight * 0.8);
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                ctx.clearRect(0, 0, targetWidth, targetHeight);
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                quality = 0.3;
                tryCompress();
              } else {
                // Last resort: create tiny version
                canvas.width = 200;
                canvas.height = 200;
                ctx.clearRect(0, 0, 200, 200);
                ctx.drawImage(img, 0, 0, 200, 200);
                canvas.toBlob((tinyBlob) => resolve(tinyBlob || new Blob()), 'image/jpeg', 0.1);
              }
              return;
            }
            
            // If size is acceptable, return it
            if (blob.size <= maxSizeBytes) {
              resolve(blob);
              return;
            }
            
            // If too large, reduce quality or dimensions
            if (quality > 0.1) {
              quality = Math.max(0.1, quality - 0.1);
              tryCompress();
            } else if (targetWidth > 200) {
              // Quality is already very low, reduce dimensions
              targetWidth = Math.round(targetWidth * 0.85);
              targetHeight = Math.round(targetHeight * 0.85);
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              ctx.clearRect(0, 0, targetWidth, targetHeight);
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
              quality = 0.3;
              tryCompress();
            } else {
              // Very small dimensions, create tiny version
              canvas.width = 200;
              canvas.height = 200;
              ctx.clearRect(0, 0, 200, 200);
              ctx.drawImage(img, 0, 0, 200, 200);
              canvas.toBlob((tinyBlob) => {
                // Always resolve, even if slightly over limit
                resolve(tinyBlob || blob);
              }, 'image/jpeg', 0.1);
            }
          }, 'image/jpeg', quality);
        };
        
        tryCompress();
      };
      
      img.onerror = () => {
        // Fallback: fetch as blob
        fetch(uri).then(r => r.blob()).then(resolve).catch(() => resolve(new Blob()));
      };
      
      img.src = uri;
    });
  } else {
    // Native: fetch blob (already compressed by ImagePicker)
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error('Kon foto niet laden');
    }
    
    const blob = await response.blob();
    
    // If too large, try base64 re-encoding (sometimes helps)
    if (blob.size > maxSizeBytes) {
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Conversion failed'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        const reencodedBlob = await fetch(base64).then(r => r.blob());
        if (reencodedBlob.size < blob.size) {
          return reencodedBlob;
        }
      } catch (error) {
        console.log('Re-encoding failed:', error);
      }
    }
    
    // Return blob (even if slightly over limit, we'll try to upload)
    return blob;
  }
}

// Export upload function for parent to call
export async function uploadAvatarImage(
  userId: string,
  localUri: string | null,
  currentAvatarUrl?: string | null
): Promise<string | null> {
  if (!localUri) {
    return currentAvatarUrl || null;
  }

  // If it's already a URL (from Supabase), don't upload again
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    return localUri;
  }

  try {
    // Compress image - ALWAYS succeeds
    console.log('Compressing image...');
    let blob = await compressImageToBlob(localUri, 1500000);
    console.log('Compressed size:', blob.size, 'bytes');
    
    // If still too large, compress more aggressively
    if (blob.size > 1500000) {
      console.log('Still too large, compressing more aggressively...');
      blob = await compressImageToBlob(localUri, 1000000);
      console.log('Re-compressed size:', blob.size, 'bytes');
    }
    
    // If STILL too large, create tiny version as absolute last resort
    if (blob.size > 1500000 && Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      console.log('Creating tiny version as last resort...');
      try {
        let ImageConstructor: any = null;
        try {
          if (typeof window !== 'undefined' && (window as any).Image) {
            ImageConstructor = (window as any).Image;
          } else if (typeof global !== 'undefined' && (global as any).Image) {
            ImageConstructor = (global as any).Image;
          } else if (typeof globalThis !== 'undefined' && (globalThis as any).Image) {
            ImageConstructor = (globalThis as any).Image;
          }
          
          // Handle case where Image might be a default export
          if (ImageConstructor && typeof ImageConstructor === 'object' && ImageConstructor.default) {
            ImageConstructor = ImageConstructor.default;
          }
        } catch (e) {
          console.log('Error getting Image constructor:', e);
        }
        
        if (ImageConstructor && typeof ImageConstructor === 'function') {
          const img = new ImageConstructor();
          img.src = localUri;
          await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 2000);
          });
          
          if (img.complete && img.width > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, 200, 200);
              const tinyBlob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.1);
              });
              if (tinyBlob.size > 0) {
                blob = tinyBlob;
                console.log('Tiny version created, size:', blob.size, 'bytes');
              }
            }
          }
        }
      } catch (error) {
        console.log('Tiny version creation failed:', error);
      }
    }

    // Delete old avatar if exists
    if (currentAvatarUrl && currentAvatarUrl.startsWith('http')) {
      try {
        const urlParts = currentAvatarUrl.split('/profile-avatars/');
        if (urlParts.length > 1) {
          const oldPath = urlParts[1];
          await supabase.storage.from('profile-avatars').remove([oldPath]);
        }
      } catch (error) {
        console.log('Could not delete old avatar:', error);
      }
    }

    // Upload new avatar
    const fileName = `avatar_${Date.now()}.jpg`;
    const filePath = `${userId}/${fileName}`;

    console.log('Uploading to:', filePath, 'Size:', blob.size, 'bytes');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-avatars')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      // If file too large error, try even smaller version
      if (uploadError.message?.includes('maximum allowed size') || uploadError.message?.includes('too large')) {
        console.log('File too large error, creating even smaller version...');
        
        // Create very small version (150x150, quality 0.1)
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
          try {
            let ImageConstructor: any = null;
            try {
              if (typeof window !== 'undefined' && (window as any).Image) {
                ImageConstructor = (window as any).Image;
              } else if (typeof global !== 'undefined' && (global as any).Image) {
                ImageConstructor = (global as any).Image;
              } else if (typeof globalThis !== 'undefined' && (globalThis as any).Image) {
                ImageConstructor = (globalThis as any).Image;
              }
              
              // Handle case where Image might be a default export
              if (ImageConstructor && typeof ImageConstructor === 'object' && ImageConstructor.default) {
                ImageConstructor = ImageConstructor.default;
              }
            } catch (e) {
              console.log('Error getting Image constructor:', e);
            }
            
            if (!ImageConstructor || typeof ImageConstructor !== 'function') {
              throw uploadError;
            }
            
            const img = new ImageConstructor();
            img.src = localUri;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 2000);
            });
            
            if (img.complete) {
              const canvas = document.createElement('canvas');
              canvas.width = 150;
              canvas.height = 150;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, 150, 150);
                const verySmallBlob = await new Promise<Blob>((resolve) => {
                  canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.1);
                });
                
                // Retry upload with very small version
                const { error: retryError } = await supabase.storage
                  .from('profile-avatars')
                  .upload(filePath, verySmallBlob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                  });
                
                if (retryError) {
                  throw new Error('Kon foto niet uploaden na compressie: ' + retryError.message);
                }
                
                blob = verySmallBlob;
                console.log('Upload successful with very small version');
              } else {
                throw uploadError;
              }
            } else {
              throw uploadError;
            }
          } catch (retryError: any) {
            throw new Error('Kon foto niet uploaden: ' + (retryError.message || uploadError.message));
          }
        } else {
          throw new Error('Foto is te groot. Probeer een kleinere foto.');
        }
      } else if (uploadError.message?.includes('already exists')) {
        // File exists, remove and retry
        await supabase.storage.from('profile-avatars').remove([filePath]);
        const { error: retryError } = await supabase.storage
          .from('profile-avatars')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });
        if (retryError) {
          throw new Error(retryError.message || 'Upload mislukt');
        }
      } else {
        throw new Error(uploadError.message || 'Upload mislukt');
      }
    }

    console.log('Upload successful');

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-avatars')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      throw new Error('Kon public URL niet ophalen');
    }

    console.log('Public URL:', publicUrl);

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      throw new Error(updateError.message || 'Kon profiel niet updaten');
    }

    return publicUrl;
  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flex: 1,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: '#fff',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
  },
  removeButton: {
    borderColor: '#e11d48',
    backgroundColor: '#fff',
  },
  removeButtonText: {
    color: '#e11d48',
  },
});

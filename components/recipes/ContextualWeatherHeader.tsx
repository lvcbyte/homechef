// Contextual Weather Header Component
// Compact Dynamic Island-style weather display for header

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCurrentLocation, cacheLocation, getCachedLocation } from '../../services/location';
import { fetchWeatherData, getTimeOfDay, WeatherData } from '../../services/weather';

interface ContextualWeatherHeaderProps {
  onContextChange?: (timeOfDay: string, weatherCondition: string) => void;
}

export function ContextualWeatherHeader({ onContextChange }: ContextualWeatherHeaderProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(() => getTimeOfDay());
  const [location, setLocation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const hasLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    // Only load once
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadContext();
    }
    
    // Update time of day every minute (but don't reload context)
    const timeInterval = setInterval(() => {
      if (!mountedRef.current) return;
      const newTimeOfDay = getTimeOfDay();
      setTimeOfDay(prev => {
        // Only update if changed and trigger context change
        if (prev !== newTimeOfDay && onContextChange) {
          // Use current weather state from closure
          setWeather(currentWeather => {
            const recipeCondition = currentWeather?.recipeCondition || 
              (currentWeather?.isRaining ? 'rain' : 
               currentWeather?.isWarm ? 'warm' : 
               currentWeather?.isCold ? 'cold' : 'sunny');
            onContextChange(newTimeOfDay, recipeCondition);
            return currentWeather; // Don't change weather state
          });
        }
        return newTimeOfDay;
      });
    }, 60000);
    
    return () => {
      mountedRef.current = false;
      clearInterval(timeInterval);
    };
  }, []); // Only run once on mount

  const loadContext = async () => {
    // Only show loading if we have no data at all
    if (!weather && !location) {
      setLoading(true);
    }
    
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      if (!location) {
        setLocation('Locatie niet beschikbaar');
        const currentTimeOfDay = getTimeOfDay();
        setTimeOfDay(currentTimeOfDay);
        if (onContextChange && !weather) {
          onContextChange(currentTimeOfDay, 'sunny');
        }
      }
    }, 15000);
    
    try {
      const currentTimeOfDay = getTimeOfDay();
      // Always set time of day correctly
      setTimeOfDay(currentTimeOfDay);
      
      // Try cached location first
      let userLocation = await getCachedLocation();
      
      if (!userLocation) {
        userLocation = await getCurrentLocation();
        if (userLocation) {
          cacheLocation(userLocation);
        }
      }
      
      clearTimeout(loadingTimeout);
      
      if (userLocation) {
        // Only fetch weather if we don't have it yet
        if (!weather) {
          const weatherData = await fetchWeatherData(userLocation);
          if (weatherData) {
            setLocation(weatherData.cityName || userLocation.city || 'Jouw locatie');
            setWeather(weatherData);
            if (onContextChange) {
              const recipeCondition = weatherData.recipeCondition || 
                (weatherData.isRaining ? 'rain' : 
                 weatherData.isWarm ? 'warm' : 
                 weatherData.isCold ? 'cold' : 'sunny');
              onContextChange(currentTimeOfDay, recipeCondition);
            }
          } else {
            if (!location) {
              setLocation(userLocation.city || 'Jouw locatie');
            }
            if (onContextChange) {
              onContextChange(currentTimeOfDay, 'sunny');
            }
          }
        } else {
          // We already have weather, just update location if needed
          if (!location) {
            setLocation(userLocation.city || 'Jouw locatie');
          }
        }
      } else {
        if (!location) {
          setLocation('Locatie niet beschikbaar');
          if (onContextChange && !weather) {
            onContextChange(currentTimeOfDay, 'sunny');
          }
        }
      }
    } catch (error) {
      console.error('[ContextualWeatherHeader] Error loading context:', error);
    } finally {
      clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const getTimeOfDayIcon = () => {
    switch (timeOfDay) {
      case 'breakfast':
        return 'sunny';
      case 'lunch':
        return 'partly-sunny';
      case 'dinner':
        return 'moon';
      default:
        return 'time';
    }
  };

  const getTimeOfDayLabel = () => {
    switch (timeOfDay) {
      case 'breakfast':
        return 'Ontbijt';
      case 'lunch':
        return 'Lunch';
      case 'dinner':
        return 'Diner';
      default:
        return 'Snack';
    }
  };

  const getWeatherIcon = () => {
    if (!weather) return 'partly-sunny';
    if (weather.isRaining) return 'rainy';
    if (weather.isWarm) return 'sunny';
    if (weather.isCold) return 'snow';
    return 'partly-sunny';
  };

  // Only show loading spinner if we have no data at all
  if (loading && !weather && !location) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#047857" />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setExpanded(true)}
        activeOpacity={0.8}
      >
        {/* Compact View - Always visible in header */}
        <View style={styles.compactContent}>
          <View style={styles.timeSection}>
            <Ionicons name={getTimeOfDayIcon()} size={14} color="#047857" />
            <Text style={styles.timeLabel}>{getTimeOfDayLabel()}</Text>
            <Text style={styles.timeText}>
              {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          {weather && (
            <View style={styles.weatherSection}>
              <Ionicons name={getWeatherIcon()} size={14} color="#047857" />
              <Text style={styles.tempText}>{weather.temperature}°C</Text>
            </View>
          )}
          
          {location && location !== 'Locatie niet beschikbaar' && (
            <View style={styles.locationSection}>
              <Ionicons name="location" size={10} color="#64748b" />
              <Text style={styles.locationText} numberOfLines={1}>
                {location}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded View - In Modal */}
      <Modal
        visible={expanded}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExpanded(false)}
        >
          <View style={styles.expandedContent} onStartShouldSetResponder={() => true}>
            <View style={styles.expandedHeader}>
              <Text style={styles.expandedTitle}>Weer & Context</Text>
              <TouchableOpacity
                onPress={() => setExpanded(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={styles.expandedRow}>
              <View style={styles.expandedTimeSection}>
                <Ionicons name={getTimeOfDayIcon()} size={24} color="#047857" />
                <View>
                  <Text style={styles.expandedTimeLabel}>{getTimeOfDayLabel()}</Text>
                  <Text style={styles.expandedTimeText}>
                    {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
              
              {weather && (
                <View style={styles.expandedWeatherSection}>
                  <Ionicons name={getWeatherIcon()} size={24} color="#047857" />
                  <View>
                    <Text style={styles.expandedTempText}>{weather.temperature}°C</Text>
                    <Text style={styles.expandedWeatherDesc} numberOfLines={1}>
                      {weather.description}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            
            {location && location !== 'Locatie niet beschikbaar' && (
              <View style={styles.expandedLocationSection}>
                <Ionicons name="location" size={16} color="#64748b" />
                <Text style={styles.expandedLocationText}>{location}</Text>
              </View>
            )}
            
            {weather && (
              <Text style={styles.expandedMessage}>
                {weather.isRaining && timeOfDay === 'dinner' ? 'Perfect voor comfort food!' :
                 weather.isWarm ? 'Tijd voor lichte maaltijden' :
                 weather.isCold ? 'Verwarm jezelf met warme maaltijden' :
                 'Perfect moment voor een maaltijd'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0fdf4',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
    minHeight: 34,
    justifyContent: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 1,
    maxWidth: '100%',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  timeText: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 2,
  },
  weatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(4, 120, 87, 0.2)',
    flexShrink: 0,
  },
  tempText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(4, 120, 87, 0.2)',
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: 10,
    color: '#64748b',
    flexShrink: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  expandedContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  expandedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  expandedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  expandedTimeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  expandedTimeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  expandedTimeText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  expandedWeatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  expandedTempText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  expandedWeatherDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  expandedLocationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 120, 87, 0.1)',
    marginTop: 8,
  },
  expandedLocationText: {
    fontSize: 14,
    color: '#64748b',
  },
  expandedMessage: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 120, 87, 0.1)',
  },
});

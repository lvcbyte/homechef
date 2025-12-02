// Contextual Weather Card Component
// Displays current weather and time of day for contextual recipe recommendations

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { getCurrentLocation, cacheLocation, getCachedLocation } from '../../services/location';
import { fetchWeatherData, getTimeOfDay, WeatherData } from '../../services/weather';

interface ContextualWeatherCardProps {
  onContextChange?: (timeOfDay: string, weatherCondition: string) => void;
}

export function ContextualWeatherCard({ onContextChange }: ContextualWeatherCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner');
  const [location, setLocation] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContext();
    
    // Update time of day every minute
    const timeInterval = setInterval(() => {
      const newTimeOfDay = getTimeOfDay();
      setTimeOfDay(newTimeOfDay);
      if (onContextChange) {
        onContextChange(newTimeOfDay, weather?.condition || 'sunny');
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(timeInterval);
  }, []);

  const loadContext = async () => {
    setLoading(true);
    
    // Set timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('[ContextualWeatherCard] Loading timeout - proceeding without location');
      setLoading(false);
      setLocation('Locatie niet beschikbaar');
      const currentTimeOfDay = getTimeOfDay();
      setTimeOfDay(currentTimeOfDay);
      if (onContextChange) {
        onContextChange(currentTimeOfDay, 'sunny');
      }
    }, 20000); // 20 second timeout
    
    try {
      // Get time of day
      const currentTimeOfDay = getTimeOfDay();
      setTimeOfDay(currentTimeOfDay);
      console.log('[ContextualWeatherCard] Time of day:', currentTimeOfDay);
      
      // Try to get cached location first
      let userLocation = await getCachedLocation();
      console.log('[ContextualWeatherCard] Cached location:', userLocation);
      
      // If no cached location, get current location
      if (!userLocation) {
        console.log('[ContextualWeatherCard] Requesting current location...');
        userLocation = await getCurrentLocation();
        console.log('[ContextualWeatherCard] Current location:', userLocation);
        if (userLocation) {
          cacheLocation(userLocation);
        }
      }
      
      // Clear timeout if we got location
      clearTimeout(loadingTimeout);
      
      if (userLocation) {
        // Fetch weather data (this will also provide city name)
        console.log('[ContextualWeatherCard] Fetching weather for:', userLocation.latitude, userLocation.longitude);
        const weatherData = await fetchWeatherData(userLocation);
        if (weatherData) {
          console.log('[ContextualWeatherCard] ✅ Weather data loaded:', weatherData);
          // Use city name from weather API or fallback
          setLocation(weatherData.cityName || userLocation.city || 'Jouw locatie');
          setWeather(weatherData);
          if (onContextChange) {
            // Use recipeCondition for better recipe matching
            const recipeCondition = weatherData.recipeCondition || 
              (weatherData.isRaining ? 'rain' : 
               weatherData.isWarm ? 'warm' : 
               weatherData.isCold ? 'cold' : 'sunny');
            onContextChange(currentTimeOfDay, recipeCondition);
          }
        } else {
          console.warn('[ContextualWeatherCard] ⚠️ No weather data available - check API key and restart app');
          // Still set location even without weather
          setLocation(userLocation.city || 'Jouw locatie');
          // Still trigger context change with default weather
          if (onContextChange) {
            onContextChange(currentTimeOfDay, 'sunny');
          }
        }
      } else {
        // No location permission, use default
        console.warn('[ContextualWeatherCard] ⚠️ No location available - check permissions');
        setLocation('Locatie niet beschikbaar');
        if (onContextChange) {
          onContextChange(currentTimeOfDay, 'sunny');
        }
      }
    } catch (error) {
      console.error('[ContextualWeatherCard] ❌ Error loading context:', error);
      clearTimeout(loadingTimeout);
      setLocation('Locatie niet beschikbaar');
      const currentTimeOfDay = getTimeOfDay();
      setTimeOfDay(currentTimeOfDay);
      if (onContextChange) {
        onContextChange(currentTimeOfDay, 'sunny');
      }
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

  const getContextualMessage = () => {
    if (loading) {
      return 'Context laden...';
    }
    
    if (!weather) {
      // Check if we have location but no weather (API issue)
      if (location && location !== 'Locatie niet beschikbaar' && location !== 'Jouw locatie') {
        return 'Weerdata wordt geladen...';
      }
      return 'Perfect moment voor een maaltijd';
    }
    
    if (weather.isRaining && timeOfDay === 'dinner') {
      return 'Regenachtige avond? Perfect voor comfort food!';
    }
    if (weather.isWarm) {
      return 'Warm weer? Tijd voor lichte maaltijden';
    }
    if (weather.isCold) {
      return 'Koud buiten? Verwarm jezelf met een warme maaltijd';
    }
    return 'Perfect moment voor een maaltijd';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#047857" />
        <Text style={styles.loadingText}>Context laden...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Time of Day */}
        <View style={styles.timeSection}>
          <Ionicons name={getTimeOfDayIcon()} size={24} color="#047857" />
          <View style={styles.timeInfo}>
            <Text style={styles.timeLabel}>{getTimeOfDayLabel()}</Text>
            <Text style={styles.timeSubtext}>
              {new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* Weather */}
        {weather && (
          <View style={styles.weatherSection}>
            <Ionicons name={getWeatherIcon()} size={24} color="#047857" />
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
              <Text style={styles.weatherDescription} numberOfLines={1}>
                {weather.description}
              </Text>
            </View>
          </View>
        )}

        {/* Location */}
        {location && (
          <View style={styles.locationSection}>
            <Ionicons name="location" size={16} color="#64748b" />
            <Text style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        )}
      </View>

      {/* Contextual Message */}
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>{getContextualMessage()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 120, 87, 0.2)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  timeInfo: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  timeSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  weatherSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 16,
  },
  weatherInfo: {
    flex: 1,
  },
  weatherTemp: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  weatherDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
    maxWidth: 100,
  },
  messageContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 120, 87, 0.1)',
  },
  messageText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});


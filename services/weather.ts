// Weather Service - OpenWeatherMap API Integration
// Fetches weather data based on user location for contextual recipe recommendations

export interface WeatherData {
  temperature: number; // Celsius
  condition: string; // 'rain', 'sunny', 'cloudy', 'snow', etc.
  description: string; // Human readable description
  isRaining: boolean;
  isWarm: boolean; // > 25°C
  isCold: boolean; // < 10°C
  humidity: number;
  windSpeed: number;
  cityName?: string; // City name from weather API
  recipeCondition?: string; // 'rain', 'warm', 'cold', 'sunny' - for recipe filtering
}

export interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

// Get OpenWeatherMap API key from environment or use a default
// For production, add this to your .env file: OPENWEATHER_API_KEY=your_key_here
const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || 'demo_key';

/**
 * Fetch weather data from OpenWeatherMap API
 * Free tier: 60 calls/minute, 1,000,000 calls/month
 */
export async function fetchWeatherData(location: LocationData): Promise<WeatherData | null> {
  try {
    // Check if API key is set
    if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'demo_key') {
      console.warn('OpenWeatherMap API key not set. Add EXPO_PUBLIC_OPENWEATHER_API_KEY to .env');
      return null;
    }
    
    // Use OpenWeatherMap Current Weather API
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${location.latitude}&lon=${location.longitude}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=nl`;
    
    console.log('[Weather] Fetching weather data for:', location.latitude, location.longitude);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Weather] API error:', response.status, errorText);
      
      // If API key is invalid or rate limited, return null (graceful degradation)
      if (response.status === 401) {
        console.warn('[Weather] Invalid API key. Check your EXPO_PUBLIC_OPENWEATHER_API_KEY');
        return null;
      }
      if (response.status === 429) {
        console.warn('[Weather] Rate limit exceeded');
        return null;
      }
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Weather] Successfully fetched weather:', data.weather[0].main, data.main.temp + '°C');
    
    // Extract weather information
    const temperature = Math.round(data.main.temp);
    const condition = data.weather[0].main.toLowerCase();
    const description = data.weather[0].description;
    const isRaining = condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunderstorm');
    const isWarm = temperature > 25;
    const isCold = temperature < 10;
    
    // Determine weather condition for recipe filtering
    let weatherConditionForRecipes = 'sunny';
    if (isRaining) {
      weatherConditionForRecipes = 'rain';
    } else if (isWarm) {
      weatherConditionForRecipes = 'warm';
    } else if (isCold) {
      weatherConditionForRecipes = 'cold';
    }
    const humidity = data.main.humidity;
    const windSpeed = data.wind?.speed || 0;
    
    // Extract city name from weather API response (more reliable than reverse geocoding)
    const cityName = data.name || location.city;
    
    return {
      temperature,
      condition,
      description,
      isRaining,
      isWarm,
      isCold,
      humidity,
      windSpeed,
      cityName, // Add city name to response
      recipeCondition: weatherConditionForRecipes, // Add recipe condition
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

/**
 * Get time of day category
 */
export function getTimeOfDay(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 11) {
    return 'breakfast';
  } else if (hour >= 11 && hour < 15) {
    return 'lunch';
  } else if (hour >= 17 && hour < 22) {
    return 'dinner';
  } else {
    return 'snack';
  }
}

/**
 * Get contextual recipe category based on weather and time
 */
export function getContextualRecipeCategory(
  weather: WeatherData | null,
  timeOfDay: 'breakfast' | 'lunch' | 'dinner' | 'snack'
): string[] {
  const categories: string[] = [];
  
  // Time-based categories
  if (timeOfDay === 'breakfast') {
    categories.push('Ontbijt');
  } else if (timeOfDay === 'lunch') {
    categories.push('Lunch');
  } else if (timeOfDay === 'dinner') {
    categories.push('Diner');
  }
  
  // Weather-based categories
  if (weather) {
    // Rain + evening = Comfort Food
    if (weather.isRaining && timeOfDay === 'dinner') {
      categories.push('Comfort Food');
      categories.push('Stoofpot');
    }
    
    // Warm weather = Salads and light meals
    if (weather.isWarm) {
      categories.push('Salade');
      categories.push('Lichte Maaltijd');
    }
    
    // Cold weather = Warm meals
    if (weather.isCold) {
      categories.push('Soep');
      categories.push('Warme Maaltijd');
    }
    
    // Rainy = Comfort food
    if (weather.isRaining) {
      categories.push('Comfort Food');
    }
  }
  
  // Default fallback
  if (categories.length === 0) {
    categories.push('Alles');
  }
  
  return categories;
}

/**
 * Get contextual recipe tags based on weather and time
 */
export function getContextualRecipeTags(
  weather: WeatherData | null,
  timeOfDay: 'breakfast' | 'lunch' | 'dinner' | 'snack'
): string[] {
  const tags: string[] = [];
  
  if (weather) {
    if (weather.isRaining && timeOfDay === 'dinner') {
      tags.push('comfort');
      tags.push('warm');
      tags.push('stevige maaltijd');
    }
    
    if (weather.isWarm) {
      tags.push('licht');
      tags.push('fris');
      tags.push('verfrissend');
    }
    
    if (weather.isCold) {
      tags.push('warm');
      tags.push('verwarmend');
    }
  }
  
  return tags;
}


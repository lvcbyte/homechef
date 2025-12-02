# 🔧 Fix Weer Data - Stap voor Stap

## ✅ API Key Gevonden!

Je API key is aanwezig in `.env.local`. Nu moet je:

### Stap 1: Herstart de App (BELANGRIJK!)

**Expo laadt env variabelen alleen bij start!**

1. Stop de app volledig:
   ```bash
   # Druk op Ctrl+C in terminal waar npm start draait
   ```

2. Start opnieuw:
   ```bash
   npm start
   ```

3. Refresh je browser/app

### Stap 2: Check Browser Console

Open browser console (F12) en zoek naar:

**Goed teken:**
```
[ContextualWeatherCard] Time of day: breakfast
[ContextualWeatherCard] Requesting current location...
[Weather] Fetching weather data for: 52.3676 4.9041
[Weather] Successfully fetched weather: Clear 15°C
[ContextualWeatherCard] ✅ Weather data loaded: {...}
```

**Probleem teken:**
```
[Weather] API error: 401 ...
[ContextualWeatherCard] ⚠️ No weather data available
```

### Stap 3: Test API Key Direct

Test je API key in browser console:
```javascript
fetch('https://api.openweathermap.org/data/2.5/weather?lat=52.3676&lon=4.9041&appid=9ce9a6c0189cedafb7022167c35f0fb8&units=metric&lang=nl')
  .then(r => r.json())
  .then(console.log)
```

Als je een error ziet, is de API key mogelijk ongeldig.

### Stap 4: Check Locatie Permissie

1. **Browser**: 
   - Chrome: Klik op slot icoon in adresbalk > Locatie > Toestaan
   - Of: Settings > Privacy > Location > Allow

2. **Check console voor**: 
   ```
   [ContextualWeatherCard] ⚠️ No location available
   ```

### Stap 5: Als het nog steeds niet werkt

1. **Check OpenWeatherMap Dashboard:**
   - Ga naar https://home.openweathermap.org/api_keys
   - Check of je key actief is
   - Check of je niet over rate limit bent

2. **Check .env bestand:**
   - Zorg dat het `.env.local` is (niet alleen `.env`)
   - Of maak `.env` aan met dezelfde key

3. **Hard refresh:**
   - Browser: Ctrl+Shift+R (Windows) of Cmd+Shift+R (Mac)
   - Of: Clear cache en reload

### Debug Commando's:

In browser console:
```javascript
// Check of API key geladen is
console.log('API Key loaded:', process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY);

// Test weather fetch direct
import { fetchWeatherData } from './services/weather';
fetchWeatherData({ latitude: 52.3676, longitude: 4.9041 })
  .then(console.log)
  .catch(console.error);
```

---

## 🎯 Meest Waarschijnlijke Oplossing:

**Herstart de app!** Expo laadt env variabelen alleen bij start.

1. Stop app (Ctrl+C)
2. Start opnieuw: `npm start`
3. Refresh browser
4. Check console logs

Als het dan nog niet werkt, check de console logs voor specifieke errors!


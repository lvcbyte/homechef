# Debug Weer Data

## Probleem: Geen weer data zichtbaar

Als je alleen "Ontbijt 09:59 Jouw locatie Perfect moment voor een maaltijd" ziet zonder weer informatie:

### Stap 1: Check API Key

1. **Check of API key correct is ingesteld:**
   - Open `.env` of `.env.local` in project root
   - Zorg dat je hebt: `EXPO_PUBLIC_OPENWEATHER_API_KEY=your_actual_key_here`
   - **BELANGRIJK**: Moet `EXPO_PUBLIC_` prefix hebben voor Expo!

2. **Herstart de app:**
   - Stop de app volledig (Ctrl+C)
   - Start opnieuw: `npm start`
   - **Expo laadt env variabelen alleen bij start!**

### Stap 2: Check Console Logs

Open browser console (F12) of terminal en zoek naar:
- `[Weather] Fetching weather data for:`
- `[Weather] API error:`
- `[Weather] Successfully fetched weather:`

### Stap 3: Test API Key Direct

Test je API key in browser:
```
https://api.openweathermap.org/data/2.5/weather?lat=52.3676&lon=4.9041&appid=YOUR_API_KEY&units=metric&lang=nl
```

Vervang `YOUR_API_KEY` met je echte key. Je zou JSON moeten zien.

### Stap 4: Check Locatie Permissie

1. **Browser**: Check of locatie permissie is gegeven
   - Chrome: Settings > Privacy > Location
   - Firefox: Settings > Privacy > Permissions > Location

2. **Check console voor**: `[ContextualWeatherCard] No location available`

### Stap 5: Check OpenWeatherMap Account

1. Ga naar [OpenWeatherMap Dashboard](https://home.openweathermap.org/api_keys)
2. Check of je API key actief is
3. Check of je niet over rate limit bent (60 calls/min)

### Veelvoorkomende Problemen:

1. **API key niet herkend:**
   - ✅ Zorg dat het `EXPO_PUBLIC_` prefix heeft
   - ✅ Herstart de app na toevoegen
   - ✅ Check `.env` bestand (niet alleen `.env.local`)

2. **401 Unauthorized:**
   - API key is ongeldig
   - Check OpenWeatherMap dashboard

3. **429 Too Many Requests:**
   - Rate limit bereikt
   - Wacht even en probeer opnieuw

4. **Geen locatie:**
   - Geef locatie permissie in browser
   - Check browser console voor errors

### Debug Mode:

Open browser console en type:
```javascript
console.log('API Key:', process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY);
```

Als dit `undefined` of `demo_key` toont, is de env variabele niet geladen.

### Oplossing:

1. Stop app volledig
2. Check `.env` bestand
3. Herstart: `npm start`
4. Refresh browser/app
5. Check console logs


# Setup OpenWeatherMap API

## Stap 1: API Key Aanmaken

1. Ga naar [OpenWeatherMap](https://openweathermap.org/api)
2. Maak een gratis account aan
3. Ga naar "API Keys" in je dashboard
4. Genereer een nieuwe API key (gratis tier: 60 calls/minuut, 1M calls/maand)

## Stap 2: API Key Toevoegen

### Optie A: Environment Variable (Aanbevolen)

Voeg toe aan je `.env` of `.env.local` bestand:

```env
EXPO_PUBLIC_OPENWEATHER_API_KEY=your_api_key_here
```

### Optie B: Direct in Code (Alleen voor testen)

In `services/weather.ts`, vervang:
```typescript
const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || 'demo_key';
```

Door:
```typescript
const OPENWEATHER_API_KEY = 'your_api_key_here';
```

## Stap 3: Testen

1. Start de app: `npm start`
2. Ga naar de home pagina
3. Geef locatie permissie
4. Je zou nu weer informatie moeten zien!

## Troubleshooting

- **"Weather API error: 401"**: API key is ongeldig of niet ingesteld
- **"Location permission not granted"**: Geef locatie permissie in browser/app instellingen
- **Geen weer data**: Controleer of API key correct is ingesteld

## Gratis Tier Limieten

- 60 API calls per minuut
- 1,000,000 calls per maand
- Genoeg voor normale gebruik!


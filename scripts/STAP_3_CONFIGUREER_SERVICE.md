# Stap 3: Configureer Timer Sync Service

## ✅ Actie Vereist

Update de WebSocket URL in `services/timerSync.ts`:

### Stap 1: Vind je Supabase Project URL

1. Ga naar je Supabase Dashboard
2. Klik op **Settings** → **API**
3. Kopieer je **Project URL** (bijv. `https://xxxxx.supabase.co`)

### Stap 2: Update timerSync.ts

Open `services/timerSync.ts` en zoek naar regel ~45 waar de WebSocket URL wordt geconfigureerd.

Vervang:
```typescript
const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
```

Met:
```typescript
// Use Supabase Edge Function WebSocket endpoint
const wsUrl = supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/functions/v1/timer-sync';
```

**OF** als je een specifieke URL wilt gebruiken:

```typescript
const wsUrl = 'wss://YOUR_PROJECT_REF.supabase.co/functions/v1/timer-sync';
```

## ✅ Test de Configuratie

1. Start je app: `npm start`
2. Open een recept in cooking mode
3. Start een timer
4. Open dezelfde app op een ander apparaat/tab
5. De timer zou gesynchroniseerd moeten zijn

## 📝 Volgende Stap

Als de service is geconfigureerd, ga door naar **Stap 4: Test Componenten**


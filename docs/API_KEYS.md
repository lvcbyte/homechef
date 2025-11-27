# API Keys Setup Guide

Dit document beschrijft waar je alle benodigde API keys kunt vinden en hoe je ze toevoegt aan je `.env.local` bestand.

## Locatie van .env.local

Maak een bestand genaamd `.env.local` in de root van je project (naast `package.json`).

## Benodigde API Keys

### 1. Supabase Keys

**Waar te vinden:**
1. Ga naar [https://supabase.com](https://supabase.com)
2. Log in op je account
3. Selecteer je project (of maak een nieuw project)
4. Ga naar **Settings** → **API**
5. Je vindt daar:
   - **Project URL** → Dit is je `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → Dit is je `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Toevoegen aan .env.local:**
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. OpenAI Key (Optioneel - voor geavanceerde AI features)

**Waar te vinden:**
1. Ga naar [https://platform.openai.com](https://platform.openai.com)
2. Log in of maak een account
3. Ga naar **API Keys** in het menu
4. Klik op **Create new secret key**
5. Kopieer de key (je ziet hem maar één keer!)

**Toevoegen aan .env.local:**
```env
EXPO_PUBLIC_OPENAI_KEY=sk-...
```

### 3. OpenRouter Key (Voor gratis AI chatbot en receptgeneratie)

**Waar te vinden:**
1. Ga naar [https://openrouter.ai](https://openrouter.ai)
2. Log in of maak een account (gratis)
3. Ga naar **Keys** in het dashboard
4. Klik op **Create Key**
5. Kopieer de key (begint met `sk-or-v1-`)

**Gratis tier:**
- 20 requests per minuut
- 50 requests per dag
- Tot 1000 requests per dag met $10 lifetime topup

**Toevoegen aan .env.local:**
```env
EXPO_PUBLIC_OPENROUTER_KEY=sk-or-v1-...
```

## Volledige .env.local Voorbeeld

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (Optioneel)
EXPO_PUBLIC_OPENAI_KEY=sk-...

# OpenRouter (Voor gratis AI)
EXPO_PUBLIC_OPENROUTER_KEY=sk-or-v1-...
```

## Belangrijke Opmerkingen

1. **Nooit commit .env.local naar Git!** Het bestand staat al in `.gitignore`
2. **Herstart de development server** na het toevoegen van nieuwe keys
3. **Voor Vercel deployment:** Voeg de keys toe in Vercel Dashboard → Settings → Environment Variables
4. **Voor productie:** Gebruik altijd environment variables, nooit hardcode keys in code

## Verificatie

Na het toevoegen van de keys, herstart je Expo server:
```bash
npm start
```

De app zou nu moeten werken met alle geconfigureerde services.


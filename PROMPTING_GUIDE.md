# STOCKPIT - Complete Prompting Guide voor App Development

**Versie:** 1.0  
**Datum:** 2025-01-28  
**Doel:** Volledige, contextuele guide om de STOCKPIT app van scratch te bouwen

---

## Inhoudsopgave

1. [Project Setup & Initialisatie](#1-project-setup--initialisatie)
2. [Database Schema & Migrations](#2-database-schema--migrations)
3. [Authenticatie & Gebruikersprofielen](#3-authenticatie--gebruikersprofielen)
4. [Voorraadbeheer (Inventory)](#4-voorraadbeheer-inventory)
5. [Product Catalogus & Barcode Scanning](#5-product-catalogus--barcode-scanning)
6. [Recepten Systeem](#6-recepten-systeem)
7. [AI Integratie](#7-ai-integratie)
8. [UI/UX & Design System](#8-uiux--design-system)
9. [PWA Implementatie](#9-pwa-implementatie)
10. [Advanced Features](#10-advanced-features)
11. [Admin Dashboard](#11-admin-dashboard)
12. [Deployment & Configuratie](#12-deployment--configuratie)

---

## 1. Project Setup & Initialisatie

### Stap 1.1: Expo Project Aanmaken

**Prompt:**
```
Maak een nieuw Expo Router project aan met de volgende specificaties:

- Project naam: "STOCKPIT" (slug: "stockpit")
- Framework: Expo Router (file-based routing)
- TypeScript: Ja
- Styling: NativeWind (Tailwind CSS voor React Native)
- Platforms: iOS, Android, Web (PWA)

Project structuur:
- app/ (Expo Router pages)
- components/ (herbruikbare componenten)
- lib/ (utilities en configuratie)
- contexts/ (React Context providers)
- services/ (API services en AI integraties)
- types/ (TypeScript type definities)
- assets/ (afbeeldingen en iconen)
- supabase/ (database migrations en functions)

Installeer de volgende dependencies:
- expo-router voor routing
- @supabase/supabase-js voor database
- nativewind voor styling
- expo-barcode-scanner voor barcode scanning
- expo-camera voor camera functionaliteit
- expo-image-picker voor foto selectie
- openai voor AI integratie
- @expo/vector-icons voor iconen
- react-native-safe-area-context voor safe area handling
```

### Stap 1.2: Basis Configuratie Bestanden

**Prompt:**
```
Maak de volgende configuratie bestanden aan:

1. app.config.js:
   - App naam: "STOCKPIT"
   - Theme color: #047857 (emerald groen)
   - Background color: #ffffff (wit)
   - PWA configuratie met standalone display mode
   - iOS en Android configuratie
   - Environment variables voor Supabase en OpenAI keys

2. tailwind.config.js:
   - NativeWind configuratie
   - Custom kleuren: emerald (#047857), teal (#14b8a6)
   - Custom spacing en border radius

3. tsconfig.json:
   - TypeScript configuratie voor Expo
   - Path aliases voor imports

4. .env.local (template):
   - EXPO_PUBLIC_SUPABASE_URL
   - EXPO_PUBLIC_SUPABASE_ANON_KEY
   - EXPO_PUBLIC_OPENAI_KEY (optioneel)
   - EXPO_PUBLIC_OPENROUTER_KEY (optioneel)
```

### Stap 1.3: Basis Project Structuur

**Prompt:**
```
Maak de volgende directory structuur en basis bestanden aan:

app/
  _layout.tsx (root layout met AuthProvider)
  index.tsx (home pagina)
  welcome.tsx (welcome/onboarding pagina)
  (auth)/
    sign-in.tsx
    sign-up.tsx
  inventory.tsx
  recipes.tsx
  saved.tsx
  scan.tsx
  profile.tsx
  admin.tsx

components/
  navigation/
    GlassDock.tsx (bottom navigation)
    HeaderAvatar.tsx
  glass/
    GlassButton.tsx
    GlassCard.tsx
    StockpitLoader.tsx
  inventory/
    VoiceInput.tsx
  chat/
    AIChatbot.tsx
  recipes/
    CookingMode.tsx
    LeftoversGenerator.tsx
    RecipeScaling.tsx

lib/
  supabase.ts (Supabase client configuratie)

contexts/
  AuthContext.tsx (authentication context)

services/
  ai.ts (AI service integraties)

types/
  app.ts (app-specifieke types)
  database.ts (database types - gegenereerd)
```

---

## 2. Database Schema & Migrations

### Stap 2.1: Initial Database Schema

**Prompt:**
```
Maak een Supabase migration bestand (01_init.sql) met het volgende schema:

1. Extensies:
   - pgcrypto voor password hashing

2. Tabellen:
   - profiles (id UUID PK, archetype TEXT, dietary_restrictions JSONB, cooking_skill TEXT, created_at TIMESTAMPTZ)
   - inventory (id UUID PK, user_id UUID FK, name TEXT, category TEXT, quantity_approx TEXT, confidence_score REAL, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
   - recipes_cache (id UUID PK, user_id UUID FK, name TEXT, ingredients_json JSONB, steps_json JSONB, macros JSONB, relevance_score REAL, generated_at TIMESTAMPTZ)
   - scan_sessions (id UUID PK, user_id UUID FK, photo_urls TEXT[], processed_status TEXT, created_at TIMESTAMPTZ)

3. Row Level Security (RLS):
   - Enable RLS op alle tabellen
   - Policies: gebruikers kunnen alleen hun eigen data lezen/schrijven
   - Policies gebruiken auth.uid() voor user isolation

4. Seed Data:
   - 5 test gebruikers met verschillende archetypes (Minimalist, Bio-Hacker, Flavor Hunter, Meal Prepper, Family Manager)
   - Voorbeeld inventory items voor elke gebruiker
```

### Stap 2.2: Product Catalogus Schema

**Prompt:**
```
Maak een migration (02_product_catalog.sql) voor product catalogus:

1. Tabel: product_catalog
   - id UUID PK
   - name TEXT (product naam)
   - brand TEXT (merk)
   - barcode TEXT (EAN/barcode, uniek)
   - price DECIMAL (prijs)
   - image_url TEXT (product foto)
   - category TEXT (categorie)
   - source TEXT (winkel: 'ah', 'colruyt', 'lidl', 'jumbo', 'carrefour', 'openfoodfacts')
   - nutrition JSONB (voedingswaarden)
   - unit_size TEXT (verpakking grootte)
   - created_at TIMESTAMPTZ
   - updated_at TIMESTAMPTZ

2. Indexen:
   - Index op barcode voor snelle lookups
   - Index op name voor zoeken
   - Index op source voor filtering
   - Full-text search index op name en brand

3. Functies:
   - match_product(barcode_or_name TEXT) - zoek product op barcode of naam
   - search_products(query TEXT, limit INT) - full-text search
```

### Stap 2.3: Recepten Systeem Schema

**Prompt:**
```
Maak een migration (03_recipes_system.sql) voor het recepten systeem:

1. Tabellen:
   - recipes (id UUID PK, title TEXT, description TEXT, author TEXT, image_url TEXT, ingredients JSONB, instructions JSONB, prep_time_minutes INT, cook_time_minutes INT, total_time_minutes INT, difficulty TEXT, servings INT, nutrition JSONB, tags TEXT[], category TEXT, likes_count INT DEFAULT 0, created_at TIMESTAMPTZ)
   - recipe_likes (user_id UUID FK, recipe_id UUID FK, created_at TIMESTAMPTZ, PRIMARY KEY (user_id, recipe_id))
   - saved_recipes (user_id UUID FK, recipe_name TEXT, recipe_payload JSONB, created_at TIMESTAMPTZ, PRIMARY KEY (user_id, recipe_name))
   - daily_ai_recipes (id UUID PK, user_id UUID FK, title TEXT, description TEXT, ingredients JSONB, instructions JSONB, prep_time_minutes INT, cook_time_minutes INT, total_time_minutes INT, difficulty TEXT, servings INT, nutrition JSONB, tags TEXT[], category TEXT, image_url TEXT, recipe_date DATE, created_at TIMESTAMPTZ)

2. Functies:
   - get_recipe_of_the_day() - retourneert random recept ID
   - get_trending_recipes(p_limit INT, p_user_id UUID, p_category TEXT) - meest gelikete recepten
   - get_quick_recipes(p_limit INT, p_user_id UUID, p_category TEXT, p_archetype TEXT, p_cooking_skill TEXT, p_dietary_restrictions TEXT[]) - recepten <= 30 minuten met profiel filters
   - get_chef_radar_recipes(p_user_id UUID, p_limit INT) - recepten op basis van voorraad matching
   - toggle_recipe_like(p_recipe_id UUID) - toggle like status
   - get_recipe_categories() - alle unieke categorieën

3. Triggers:
   - Update likes_count automatisch bij like/unlike
```

### Stap 2.4: Shelf Photos & AI Analyse Schema

**Prompt:**
```
Maak een migration (04_shelf_photos.sql) voor shelf photo analyse:

1. Tabellen:
   - shelf_photos (id UUID PK, user_id UUID FK, photo_url TEXT, storage_path TEXT, week_number INT, year INT, analysis_status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ)
   - shelf_photo_analysis (id UUID PK, shelf_photo_id UUID FK, item_name TEXT, quantity_estimate TEXT, confidence_score REAL, brand TEXT, category TEXT, matched_product_id UUID FK, created_at TIMESTAMPTZ)

2. Storage Bucket:
   - Maak Supabase Storage bucket: 'shelf-photos'
   - RLS policies: gebruikers kunnen alleen hun eigen foto's uploaden/lezen

3. Functies:
   - get_shelf_photos_by_week(p_user_id UUID, p_week INT, p_year INT) - foto's per week
   - match_analysis_to_catalog(p_analysis_id UUID) - match AI analyse met product catalogus
```

---

## 3. Authenticatie & Gebruikersprofielen

### Stap 3.1: Supabase Client Setup

**Prompt:**
```
Maak lib/supabase.ts aan met:

1. Supabase client configuratie:
   - Gebruik environment variables voor URL en anon key
   - Support voor zowel web (localStorage) als native (AsyncStorage)
   - Type-safe client met Database types
   - Lazy initialization voor SSR compatibility

2. Storage adapter:
   - Web: gebruik window.localStorage
   - Native: gebruik @react-native-async-storage/async-storage
   - Fallback: no-op storage voor SSR

3. Error handling:
   - Validatie van credentials
   - Duidelijke error messages bij ontbrekende configuratie
```

### Stap 3.2: Auth Context

**Prompt:**
```
Maak contexts/AuthContext.tsx aan met:

1. AuthContext Provider:
   - State: user, profile, loading
   - Functies: signIn, signUp, signOut, updateProfile
   - Auto-refresh van session
   - Real-time profile updates via Supabase subscriptions

2. Profile Management:
   - Fetch profile bij login
   - Create profile als deze niet bestaat
   - Update profile (archetype, dietary_restrictions, cooking_skill)
   - Avatar URL management

3. Protected Routes:
   - Redirect naar /welcome als niet ingelogd
   - Redirect naar / als ingelogd en op /welcome
```

### Stap 3.3: Welcome & Auth Pages

**Prompt:**
```
Maak app/welcome.tsx aan met:

1. Welcome Screen:
   - STOCKPIT logo en branding
   - Mission statement: "Jouw voorraad, onze recepten"
   - Call-to-action buttons: "Inloggen" en "Registreren"
   - Modern, minimalistisch design met emerald groen accent

2. Maak app/(auth)/sign-in.tsx aan:
   - Email en password input velden
   - "Inloggen" button
   - Link naar sign-up pagina
   - Error handling en loading states
   - Gebruik GlassCard component voor form styling

3. Maak app/(auth)/sign-up.tsx aan:
   - Email en password input velden
   - "Registreren" button
   - Link naar sign-in pagina
   - Auto-create profile na registratie
   - Error handling en loading states
```

---

## 4. Voorraadbeheer (Inventory)

### Stap 4.1: Inventory Page Basis

**Prompt:**
```
Maak app/inventory.tsx aan met:

1. Layout:
   - Header met "Voorraad" titel en avatar
   - SafeAreaView met safe-area-top class op web
   - ScrollView met content
   - GlassDock bottom navigation

2. Drie weergaven (tabs):
   - Items: lijst met alle inventory items
   - Categorieën: gegroepeerd per categorie
   - Vervaldatum: gesorteerd op expires_at

3. Inventory Item Card:
   - Product naam en categorie
   - Hoeveelheid (quantity_approx)
   - Vervaldatum met kleurcodering (rood = binnen 2 dagen, oranje = binnen 5 dagen, groen = langer)
   - Confidence score indicator
   - Edit en delete buttons

4. Statistieken:
   - Totaal items
   - Items die binnenkort vervallen (<= 3 dagen)
   - Percentage bruikbaar
```

### Stap 4.2: Inventory Toevoegen - Barcode Scanner

**Prompt:**
```
Maak app/scan.tsx aan met barcode scanner functionaliteit:

1. Barcode Scanner:
   - Gebruik expo-barcode-scanner voor native
   - Gebruik @ericblade/quagga2 voor web
   - Camera preview met scan overlay
   - Auto-focus en scan feedback

2. Scan Flow:
   - Scan barcode
   - Zoek product in catalogus via match_product functie
   - Toon product informatie (naam, merk, prijs, foto)
   - Laat gebruiker hoeveelheid en vervaldatum instellen
   - Voeg toe aan inventory

3. Fallback:
   - Als product niet gevonden: toon "Product niet gevonden" met optie om handmatig toe te voegen
   - Link naar handmatige invoer
```

### Stap 4.3: Inventory Toevoegen - Shelf Photo Analyse

**Prompt:**
```
Voeg shelf photo functionaliteit toe aan app/inventory.tsx:

1. Foto Upload:
   - Button "Maak foto van voorraadkast"
   - Gebruik expo-image-picker voor foto selectie
   - Upload naar Supabase Storage bucket 'shelf-photos'
   - Sla op in shelf_photos tabel met week_number en year

2. AI Analyse:
   - Na upload: roep analyzeShelfPhoto functie aan (services/ai.ts)
   - Gebruik GPT-4 Vision voor product detectie
   - Sla analyse op in shelf_photo_analysis tabel
   - Match met product catalogus via match_analysis_to_catalog

3. Review & Toevoegen:
   - Toon gedetecteerde producten met confidence scores
   - Laat gebruiker items selecteren om toe te voegen
   - Batch toevoegen aan inventory

4. Week Overzicht:
   - Toon foto's gegroepeerd per week
   - Historisch overzicht van voorraad foto's
```

### Stap 4.4: Inventory Toevoegen - Handmatige Invoer

**Prompt:**
```
Voeg handmatige invoer functionaliteit toe:

1. Handmatige Invoer Modal:
   - Product naam input met autocomplete
   - Zoek in product catalogus terwijl gebruiker typt
   - Toon suggesties met product foto's
   - Categorie selectie (dropdown)
   - Hoeveelheid input
   - Vervaldatum picker (kalender)

2. AI-Assisted Matching:
   - Gebruik search_products functie voor suggesties
   - Multi-language support (Nederlands, Frans, Duits)
   - Automatische categorie detectie
   - Confidence score op basis van match

3. Voice Input (optioneel):
   - Gebruik expo-speech voor voice input
   - Parse voice commando met AI (parseVoiceCommandWithAI)
   - Extract product naam en hoeveelheid
   - Auto-fill formulier
```

---

## 5. Product Catalogus & Barcode Scanning

### Stap 5.1: Product Catalogus Import Scripts

**Prompt:**
```
Maak scripts/ voor product catalogus import:

1. scrape-openfoodfacts.js:
   - Import producten van Open Food Facts API
   - Focus op Nederlandse/Belgische producten
   - Import: naam, barcode, foto, voedingswaarden, categorie
   - Batch insert in product_catalog tabel
   - Progress logging

2. scrape-ah-catalog.ts (Albert Heijn):
   - Scrape Albert Heijn website of gebruik API
   - Import producten met prijzen
   - Match op barcode waar mogelijk
   - Source: 'ah'

3. scrape-colruyt-direct.ts (Colruyt):
   - Scrape Colruyt website
   - Import producten met prijzen
   - Source: 'colruyt'

4. scrape-lidl-direct.ts (Lidl):
   - Scrape Lidl website
   - Import producten met prijzen
   - Source: 'lidl'

5. Bulk import script:
   - Run alle scrapers in parallel
   - Error handling en retry logic
   - Progress tracking
   - Logging naar logs/ directory
```

### Stap 5.2: Product Matching & Search

**Prompt:**
```
Verbeter product matching in database:

1. Migration: improve_product_search.sql
   - Voeg full-text search index toe
   - Voeg product_translations tabel toe voor multi-language support
   - Verbeter match_product functie met fuzzy matching
   - Voeg similarity scoring toe

2. Search Functies:
   - search_products(query TEXT, limit INT) - full-text search
   - match_product_fuzzy(barcode_or_name TEXT) - fuzzy matching
   - get_product_suggestions(partial_name TEXT, limit INT) - autocomplete

3. Multi-Store Support:
   - Voeg source filtering toe
   - Prioriteer producten op basis van gebruiker voorkeur
   - Toon prijs vergelijking tussen winkels
```

---

## 6. Recepten Systeem

### Stap 6.1: Recepten Database Seed

**Prompt:**
```
Maak migration: seed_recipes.sql met:

1. Seed Data:
   - 50+ diverse recepten in verschillende categorieën:
     * Italiaans (pasta, pizza, risotto)
     * Aziatisch (curry, stir-fry, sushi)
     * Comfort Food (stamppot, stoofpot)
     * Vegan (plant-based recepten)
     * High Protein (vlees, vis, eiwitrijk)
     * Snelle recepten (<= 30 minuten)
   
2. Recept Structuur:
   - Titel (Nederlands)
   - Beschrijving (1-2 zinnen)
   - Auteur ("STOCKPIT Team" of "Community")
   - Ingrediënten (JSONB array met {name, quantity, unit})
   - Instructies (JSONB array met {step, instruction})
   - Tijden (prep, cook, total in minuten)
   - Moeilijkheidsgraad (Makkelijk, Gemiddeld, Moeilijk)
   - Porties
   - Voedingswaarden (JSONB met protein, carbs, fat, calories)
   - Tags (TEXT[] array)
   - Categorie
   - Image URL (Unsplash food images)

3. Variatie:
   - Verschillende moeilijkheidsgraden
   - Verschillende bereidingstijden
   - Verschillende porties
   - Diverse ingrediënten combinaties
```

### Stap 6.2: Recepten Home Page

**Prompt:**
```
Maak app/index.tsx (home pagina) aan met:

1. Header:
   - STOCKPIT logo en branding
   - Avatar met notification badge
   - Admin button (als is_admin)

2. Hero Secties:
   - Daily AI Recipe: persoonlijk gegenereerd recept voor vandaag
   - Recipe of the Day: dagelijks wisselend recept
   - Beide met grote hero cards met foto's

3. Categorieën:
   - Horizontale scroll met categorie badges
   - Kleuren per categorie (emerald, teal, etc.)
   - Link naar /recipes?category=X

4. Trending Recepten:
   - Horizontale scroll met recept cards
   - Sorteer op likes_count
   - Heart icon voor like/unlike
   - Match score indicator (als beschikbaar)

5. Quick Recepten (<= 30 minuten):
   - Horizontale scroll
   - Infinite scroll mogelijkheid
   - Random shuffle voor variatie

6. Recept Card Component:
   - Product foto
   - Titel
   - Meta informatie (tijd, moeilijkheid, porties)
   - Like button
   - Tap om details te zien (modal)
```

### Stap 6.3: Recepten Detail Modal

**Prompt:**
```
Voeg recept detail modal toe aan app/index.tsx:

1. Modal Component:
   - Slide-up modal (90% hoogte)
   - Volledige recept informatie
   - Scrollable content

2. Recept Details:
   - Grote hero foto
   - Titel en auteur
   - Meta informatie (tijd, moeilijkheid, porties)
   - Like/Save button
   - Beschrijving
   - Ingrediëntenlijst (met hoeveelheden)
   - Stap-voor-stap instructies (genummerd)
   - Voedingswaarden

3. Actions:
   - Like/Unlike (toggle_recipe_like)
   - Save to Saved Recipes
   - Share (native share API)
   - Cooking Mode (link naar cooking mode component)
```

### Stap 6.4: Recepten Discovery Page

**Prompt:**
```
Maak app/recipes.tsx aan met:

1. Filters:
   - Categorie filter (dropdown)
   - Tijd filter (<= 30 min, 30-60 min, > 60 min)
   - Moeilijkheidsgraad filter
   - Archetype filter (op basis van profiel)
   - Dieetbeperkingen filter

2. Chef Radar:
   - Recepten die perfect passen bij voorraad
   - Match score percentage
   - Aantal gematchte ingrediënten
   - Sorteer op match score

3. Recept Grid:
   - 2-koloms grid op mobile
   - 3-koloms grid op desktop
   - Infinite scroll
   - Loading states

4. Search:
   - Zoekbalk voor recept titel
   - Real-time filtering
   - Highlight search terms
```

### Stap 6.5: Chef Radar - Voorraad Matching

**Prompt:**
```
Implementeer Chef Radar matching logica:

1. Database Functie: get_chef_radar_recipes
   - Haal gebruiker inventory op
   - Match ingrediënten met recept ingrediënten
   - Bereken match score: (gematchte ingrediënten / totale ingrediënten) * 100
   - Filter op profiel (archetype, dietary_restrictions, cooking_skill)
   - Sorteer op match score (hoogste eerst)
   - Limiteer resultaten

2. Matching Algoritme:
   - Fuzzy matching voor ingrediënt namen
   - Ignoreer kleine verschillen (meervoud, hoofdletters)
   - Match op basis van categorie als naam niet matcht
   - Weeg belangrijke ingrediënten zwaarder

3. UI Indicator:
   - Toon match score percentage
   - Toon "X van Y ingrediënten beschikbaar"
   - Kleurcode: groen (80%+), oranje (50-80%), rood (<50%)
```

---

## 7. AI Integratie

### Stap 7.1: AI Service Setup

**Prompt:**
```
Maak services/ai.ts aan met:

1. OpenAI Client:
   - Initialize OpenAI client met API key
   - Support voor zowel OpenAI als OpenRouter
   - Fallback naar OpenRouter gratis model (Grok 4.1 Fast)
   - Environment variable support

2. Vision AI (GPT-4 Vision):
   - analyzeShelfPhoto(photoUri): analyseer shelf foto en detecteer producten
   - runInventoryScan(photoUris): batch analyse van meerdere foto's
   - Return: product naam, hoeveelheid, confidence score, brand, categorie

3. Recipe Generation AI:
   - generateRecipesWithAI(inventory, profile, mood): genereer recepten op basis van voorraad
   - generateLeftoversRecipes(inventory, profile): zero-waste recepten voor restjes
   - generateRecipeFromDescription(description): genereer recept uit beschrijving
   - Return: gestructureerde recept data (titel, ingrediënten, instructies, voedingswaarden)

4. Chat AI:
   - chatWithAI(message, context): conversational AI assistent
   - Context: inventory, profile, recent recipes
   - Return: natuurlijke taal antwoord in Nederlands
   - Geen markdown formatting

5. Voice Input AI:
   - transcribeVoiceCommand(rawTranscript): verbeter spraaktranscriptie
   - parseVoiceCommandWithAI(command): parseer voice commando naar structuur
   - Return: array van {name, quantity} items
```

### Stap 7.2: Daily AI Recipe Generation

**Prompt:**
```
Implementeer daily AI recipe generatie:

1. Database Functie: generate_daily_ai_recipe
   - Check of er al een recept is voor vandaag (daily_ai_recipes tabel)
   - Als niet: genereer nieuw recept met generateRecipesWithAI
   - Gebruik gebruiker inventory en profiel
   - Sla op in daily_ai_recipes met recipe_date = vandaag
   - Return recept data

2. Frontend Implementatie (app/index.tsx):
   - Fetch daily AI recipe bij page load
   - Toon in hero sectie met speciale styling
   - "JOUW RECEPT VANDAAG" badge
   - Loading state tijdens generatie
   - Fallback naar database recept als AI faalt

3. Caching:
   - Cache recept voor de dag
   - Refresh alleen bij nieuwe dag
   - Gebruik Supabase real-time voor updates
```

### Stap 7.3: AI Chatbot Component

**Prompt:**
```
Maak components/chat/AIChatbot.tsx aan:

1. Floating Chat Button:
   - Fixed position (bottom right)
   - Chat icon
   - Notification badge voor nieuwe berichten
   - Tap om chat te openen

2. Chat Modal:
   - Slide-up modal
   - Chat history
   - Input veld met send button
   - Loading indicator tijdens AI response

3. Chat Functionaliteit:
   - Gebruik chatWithAI functie
   - Context: huidige inventory, profiel, recente recepten
   - Toon standaard vragen (quick actions):
     * "Wat kan ik maken met mijn voorraad?"
     * "Geef me kooktips"
     * "Hoe lang blijft X goed?"
   - Save chat history in localStorage
   - Parse recepten uit chat en bied aan om op te slaan

4. Recept Parsing:
   - Detecteer wanneer AI een recept beschrijft
   - Extract structuur met AI
   - Toon "Opslaan als recept" button
   - Gebruik generateRecipeFromDescription
```

---

## 8. UI/UX & Design System

### Stap 8.1: Brand Guide Implementatie

**Prompt:**
```
Implementeer STOCKPIT brand guide:

1. Kleuren:
   - Primaire kleur: #047857 (STOCKPIT Emerald)
   - Secundaire kleuren: #10b981 (Emerald Light), #14b8a6 (Teal)
   - Neutrale kleuren: #0f172a (donkergrijs), #475569 (middengrijs), #ffffff (wit)
   - Achtergrond: #f0fdf4 (licht groen), #f8fafc (lichtgrijs)

2. Typografie:
   - Font: System default (San Francisco iOS, Roboto Android)
   - Headers: 700-800 weight
   - Body: 400-500 weight
   - Brand naam: altijd "STOCKPIT" in hoofdletters

3. Spacing:
   - Consistent: 8px, 12px, 16px, 20px, 24px, 32px
   - Sectie spacing: 32px
   - Card padding: 16-24px

4. Border Radius:
   - Cards: 20-24px
   - Buttons: 14-28px
   - Avatars: 50% (circular)

5. Shadows:
   - Subtle shadow voor cards
   - Medium shadow voor elevated elements
   - Logo shadow met emerald tint
```

### Stap 8.2: Glass Components

**Prompt:**
```
Maak glassmorphism componenten:

1. components/glass/GlassCard.tsx:
   - Semi-transparante achtergrond met blur
   - Subtiele border
   - Shadow voor diepte
   - Support voor children en custom styling

2. components/glass/GlassButton.tsx:
   - Primary button: emerald achtergrond (#047857)
   - Secondary button: transparant met emerald border
   - Loading state
   - Disabled state
   - Touch feedback

3. components/glass/StockpitLoader.tsx:
   - Loading spinner met STOCKPIT branding
   - Varianten: home, page, button
   - Smooth animations
   - Emerald kleur accent

4. Glassmorphism Effect:
   - Web: backdrop-filter: blur(10px)
   - Native: expo-blur BlurView component
   - Fallback voor oudere browsers
```

### Stap 8.3: Navigation Components

**Prompt:**
```
Maak navigation componenten:

1. components/navigation/GlassDock.tsx:
   - Bottom navigation bar
   - 4 tabs: Home, Discover, Inventory, Saved
   - Active state indicator (emerald kleur)
   - Fixed position op web (CSS)
   - SafeAreaView op native
   - Smooth transitions

2. components/navigation/HeaderAvatar.tsx:
   - Avatar met initialen of foto
   - Notification badge
   - Tap om naar profile te gaan
   - Admin indicator (als is_admin)

3. Navigation Utilities (utils/navigation.ts):
   - navigateToRoute(router, route) functie
   - Platform-aware navigation
   - Scroll to top op web bij navigatie
```

### Stap 8.4: Responsive Design

**Prompt:**
```
Implementeer responsive design:

1. Breakpoints:
   - Mobile: < 768px
   - Desktop: >= 768px

2. Responsive Utilities (utils/responsive.ts):
   - useResponsive() hook
   - isMobile, isTablet, isDesktop
   - Responsive font sizes
   - Responsive spacing

3. Layout Aanpassingen:
   - Mobile: 1 kolom, compact spacing
   - Desktop: 2-3 kolommen, meer spacing
   - Cards: full width op mobile, fixed width op desktop
   - Navigation: bottom dock op mobile, sidebar op desktop (optioneel)
```

---

## 9. PWA Implementatie

### Stap 9.1: PWA Manifest & Meta Tags

**Prompt:**
```
Configureer PWA in app.config.js:

1. Web Configuratie:
   - display: "standalone" (verberg browser UI)
   - themeColor: "#047857"
   - backgroundColor: "#ffffff"
   - startUrl: "/"
   - scope: "/"
   - Icons: 180x180, 192x192, 512x512

2. iOS Meta Tags:
   - apple-mobile-web-app-capable: "yes"
   - apple-mobile-web-app-status-bar-style: "black-translucent"
   - apple-touch-icon
   - viewport-fit=cover (voor safe areas)

3. Android:
   - Adaptive icon
   - Theme color
   - Shortcuts (optioneel)
```

### Stap 9.2: Safe Area Handling

**Prompt:**
```
Implementeer safe area handling in app/_layout.tsx:

1. CSS voor Web:
   - .safe-area-top: padding-top met env(safe-area-inset-top)
   - .safe-area-bottom: padding-bottom met env(safe-area-inset-bottom)
   - .glass-dock: fixed position met safe area inset
   - Prevent zoom op double tap
   - Hide scrollbars maar allow scrolling

2. Native:
   - SafeAreaView van react-native-safe-area-context
   - Platform.select voor platform-specifieke styling
   - edges prop voor welke edges safe area nodig hebben

3. Consistent Pattern:
   - Alle pagina's gebruiken SafeAreaView
   - safe-area-top class op web
   - Extra padding-bottom op web voor fixed bottom nav
```

### Stap 9.3: PWA Best Practices

**Prompt:**
```
Implementeer PWA best practices:

1. Offline Support:
   - Service worker voor caching (Expo automatisch)
   - Cache belangrijke assets
   - Offline fallback pagina

2. Performance:
   - Lazy loading van images
   - Code splitting
   - Optimized bundle size

3. Install Prompt:
   - Detecteer of app geïnstalleerd is
   - Toon install prompt op web
   - Custom install UI (optioneel)

4. App-like Experience:
   - Prevent pull-to-refresh
   - Smooth scrolling
   - Native-like transitions
   - Haptic feedback (native)
```

---

## 10. Advanced Features

### Stap 10.1: Notificaties Systeem

**Prompt:**
```
Implementeer notificaties systeem:

1. Database Schema (migration: notifications_system.sql):
   - notifications tabel (id, user_id, type, title, message, data JSONB, read BOOLEAN, created_at)
   - Types: expiry_reminder, recipe_suggestion, achievement, system
   - Functie: create_notification(user_id, type, title, message, data)

2. Edge Function (supabase/functions/expiry-notifications):
   - Cron job (dagelijks)
   - Check inventory items die binnen 2-3 dagen vervallen
   - Genereer notificaties
   - Optioneel: push notificaties (Expo Notifications)

3. Frontend (components/notifications/NotificationCenter.tsx):
   - Notification bell icon in header
   - Badge met unread count
   - Dropdown met recente notificaties
   - Mark as read functionaliteit
   - Real-time updates via Supabase subscriptions
```

### Stap 10.2: Profile & Avatar Upload

**Prompt:**
```
Implementeer profiel pagina:

1. app/profile.tsx:
   - Profiel informatie weergave
   - Edit mode
   - Archetype selector (dropdown)
   - Cooking skill selector
   - Dietary restrictions (multi-select checkboxes)
   - Avatar upload

2. Avatar Upload (components/profile/AvatarUpload.tsx):
   - Image picker (expo-image-picker)
   - Upload naar Supabase Storage bucket 'avatars'
   - Crop/resize functionaliteit
   - Update profile.avatar_url
   - Fallback naar initialen

3. Profile Updates:
   - Real-time sync met database
   - Optimistic updates
   - Error handling
```

### Stap 10.3: Saved Recipes Page

**Prompt:**
```
Maak app/saved.tsx aan:

1. Saved Recipes Lijst:
   - Fetch saved_recipes voor gebruiker
   - Grid layout (2 kolommen mobile, 3 desktop)
   - Recept cards met foto en titel
   - Remove button

2. Filtering:
   - Zoek in opgeslagen recepten
   - Sorteer op datum (nieuwste eerst)
   - Filter op categorie

3. Actions:
   - Open recept detail
   - Remove from saved
   - Share recept
```

### Stap 10.4: Voice Input

**Prompt:```
```
Implementeer voice input voor inventory:

1. components/inventory/VoiceInput.tsx:
   - Microphone button
   - Recording state
   - Visual feedback tijdens opname
   - Stop recording button

2. Voice Processing:
   - Gebruik expo-speech of Web Speech API
   - Transcribe naar tekst
   - Verbeter transcriptie met transcribeVoiceCommand
   - Parse commando met parseVoiceCommandWithAI
   - Extract items en hoeveelheden

3. Auto-fill Form:
   - Vul inventory formulier automatisch
   - Laat gebruiker bevestigen/aanpassen
   - Batch toevoegen mogelijk
```

---

## 11. Admin Dashboard

### Stap 11.1: Admin System Setup

**Prompt:**
```
Maak admin systeem aan:

1. Database Schema (migration: admin_system.sql):
   - Voeg is_admin BOOLEAN toe aan profiles tabel
   - Admin functies met SECURITY DEFINER
   - admin_get_users(): haal alle gebruikers op
   - admin_get_stats(): platform statistieken
   - admin_create_recipe(): maak recept aan
   - admin_update_recipe(): update recept
   - admin_delete_recipe(): verwijder recept

2. RLS Policies:
   - Admin functies zijn alleen toegankelijk voor is_admin = true
   - Gebruik security definer voor admin functies

3. Admin Account Setup:
   - Migration om admin account aan te maken
   - Grant admin rechten aan specifieke gebruiker
```

### Stap 11.2: Admin Dashboard Page

**Prompt:**
```
Maak app/admin.tsx aan:

1. Dashboard Overview:
   - Statistieken: totaal gebruikers, recepten, inventory items
   - Recente activiteit
   - Charts/graphs (optioneel)

2. User Management:
   - Lijst van alle gebruikers
   - Search en filter
   - Grant/revoke admin rechten
   - View user details

3. Recipe Management:
   - Lijst van alle recepten
   - Create, edit, delete recepten
   - Bulk operations
   - Import/export (optioneel)

4. Admin AI Assistant:
   - Chat interface voor admin taken
   - "Voeg een nieuw recept toe: Pasta Carbonara"
   - Database queries
   - Statistieken genereren
   - Gebruik chatWithAdminAI functie
```

---

## 12. Deployment & Configuratie

### Stap 12.1: Environment Variables

**Prompt:**
```
Configureer environment variables:

1. .env.local (lokaal):
   - EXPO_PUBLIC_SUPABASE_URL
   - EXPO_PUBLIC_SUPABASE_ANON_KEY
   - EXPO_PUBLIC_OPENAI_KEY (optioneel)
   - EXPO_PUBLIC_OPENROUTER_KEY (aanbevolen voor gratis tier)

2. Vercel Environment Variables:
   - Zelfde variabelen als .env.local
   - Configureer in Vercel dashboard
   - Support voor preview deployments

3. Supabase Environment Variables:
   - Voor Edge Functions
   - APIFY_TOKEN (voor scraping)
   - OPENAI_KEY (voor server-side AI)
```

### Stap 12.2: Build & Deploy

**Prompt:**
```
Configureer build en deployment:

1. Build Script (package.json):
   - "build": "expo export -p web && cp public/apple-touch-icon.png dist/apple-touch-icon.png"
   - Export static files voor web
   - Copy PWA assets

2. Vercel Deployment:
   - vercel.json configuratie
   - Rewrites voor SPA routing
   - Headers voor PWA
   - Environment variables

3. Supabase Migrations:
   - Run migrations in Supabase dashboard
   - Of gebruik Supabase CLI: supabase db push
   - Test migrations in development eerst

4. Edge Functions:
   - Deploy naar Supabase: supabase functions deploy
   - Configureer cron jobs in Supabase dashboard
   - Test functions lokaal eerst
```

### Stap 12.3: Testing & Quality Assurance

**Prompt:**
```
Implementeer testing strategie:

1. Manual Testing Checklist:
   - [ ] Alle pagina's laden correct
   - [ ] Authenticatie werkt (sign in/up/out)
   - [ ] Inventory CRUD operaties
   - [ ] Barcode scanning werkt
   - [ ] Shelf photo analyse werkt
   - [ ] Recepten worden correct getoond
   - [ ] Chef Radar matching werkt
   - [ ] AI chatbot werkt
   - [ ] Daily AI recipe generatie
   - [ ] Notificaties werken
   - [ ] PWA installatie werkt
   - [ ] Responsive design op verschillende schermen
   - [ ] Safe areas werken op iOS

2. Error Handling:
   - Network errors
   - API errors
   - Authentication errors
   - Image loading errors
   - AI generation failures

3. Performance:
   - Page load times
   - Image optimization
   - Bundle size
   - Database query performance
```

---

## Prompting Best Practices

### Algemene Richtlijnen

1. **Contextueel**: Geef altijd context over wat je al hebt en wat je wilt bereiken
2. **Stapsgewijs**: Begin met basis en bouw geleidelijk op
3. **Specifiek**: Wees specifiek over requirements en constraints
4. **Iteratief**: Test elke stap voordat je doorgaat naar de volgende
5. **Documenteer**: Houd bij wat werkt en wat niet

### Voorbeeld Prompts per Fase

**Fase 1 - Setup:**
```
Ik wil een nieuwe Expo Router app maken genaamd STOCKPIT. 
Het is een keukenapp voor voorraadbeheer en recepten.
Gebruik TypeScript, NativeWind voor styling, en Supabase voor backend.
Maak de basis project structuur aan met app/, components/, lib/, contexts/ directories.
```

**Fase 2 - Database:**
```
Ik heb een Supabase project. Maak een migration voor het initial schema:
- profiles tabel met archetype, dietary_restrictions, cooking_skill
- inventory tabel voor voorraad items
- RLS policies zodat gebruikers alleen hun eigen data zien
- Seed data met 5 test gebruikers
```

**Fase 3 - Features:**
```
Ik heb de basis app structuur. Voeg nu inventory functionaliteit toe:
- Inventory pagina met lijst van items
- Barcode scanner pagina
- Handmatige invoer modal
- Shelf photo upload en AI analyse
Gebruik de bestaande GlassCard en GlassButton componenten voor styling.
```

### Troubleshooting Prompts

**Als iets niet werkt:**
```
Ik heb [beschrijf probleem]. 
De code staat in [bestand/locatie].
De error is: [error message].
Wat ik probeerde te doen: [actie].
Help me dit op te lossen met [specifieke oplossing of alternatief].
```

**Voor nieuwe features:**
```
Ik wil [feature] toevoegen aan STOCKPIT.
De bestaande codebase heeft [beschrijf relevante delen].
De nieuwe feature moet [requirements].
Gebruik dezelfde patterns als [verwijzing naar bestaande code].
```

---

## Conclusie

Deze guide biedt een complete, stapsgewijze aanpak om de STOCKPIT app te bouwen. Elke stap bouwt voort op de vorige en gebruikt dezelfde patterns en best practices.

**Belangrijkste Principes:**
1. Start met basis setup en database
2. Bouw core features eerst (auth, inventory, recipes)
3. Voeg AI integratie toe voor intelligentie
4. Verbeter UX met design system en PWA
5. Voeg advanced features toe (notificaties, admin)
6. Test en deploy

**Volgende Stappen:**
- Begin met Stap 1 en werk systematisch door
- Test elke stap voordat je doorgaat
- Pas aan waar nodig voor jouw specifieke requirements
- Documenteer wijzigingen en learnings

**Support:**
- Raadpleeg PRODUCT_DOCUMENTATIE.md voor product context
- Raadpleeg BRAND_GUIDE.md voor design specificaties
- Raadpleeg PWA_IMPLEMENTATION_STATUS.md voor PWA details

---

**Document Versie:** 1.0  
**Laatste Update:** 2025-01-28  
**Auteur:** STOCKPIT Development Team


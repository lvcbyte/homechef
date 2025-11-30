# STOCKPIT - Product Documentatie

**Versie:** 1.0  
**Datum:** 2025-01-28  
**Status:** Actief in ontwikkeling

---

## Inhoudsopgave

1. [Executive Summary](#executive-summary)
2. [Product Overzicht](#product-overzicht)
3. [Branding & Design](#branding--design)
4. [Functionaliteiten](#functionaliteiten)
5. [AI Integratie & Unieke Use Cases](#ai-integratie--unieke-use-cases)
6. [Technische Architectuur](#technische-architectuur)
7. [Toekomstvisie](#toekomstvisie)
8. [Roadmap](#roadmap)
9. [Product Requirements Document (PRD)](#product-requirements-document-prd)
10. [Concurrentie Analyse](#concurrentie-analyse)

---

## Executive Summary

**STOCKPIT** is een intelligente keukenapp die gebruikers helpt hun voorraad te beheren, recepten te ontdekken op basis van beschikbare ingrediënten, en voedselverspilling te verminderen. De app combineert geavanceerde AI-technologie met een intuïtieve gebruikerservaring om koken toegankelijker, efficiënter en duurzamer te maken.

### Kernwaarden
- **Slim**: AI-gestuurde receptsuggesties op basis van voorraad
- **Praktisch**: Eenvoudige voorraadbeheer met barcode scanning en foto-analyse
- **Duurzaam**: Voedselverspilling verminderen door vervaldatum tracking
- **Persoonlijk**: Gepersonaliseerde ervaring op basis van kookniveau en voorkeuren

---

## Product Overzicht

### Wat is STOCKPIT?

STOCKPIT is een cross-platform applicatie (iOS, Android, Web) die gebruikers helpt:
1. **Voorraad bijhouden** via barcode scanning, foto-analyse en handmatige invoer
2. **Recepten ontdekken** die perfect aansluiten op beschikbare ingrediënten
3. **Voedselverspilling voorkomen** door slimme vervaldatum tracking
4. **Boodschappen plannen** met intelligente suggesties
5. **Kookvaardigheden ontwikkelen** met gepersonaliseerde recepten en tips

### Doelgroep

**Primaire doelgroep:**
- Huishoudens die voedselverspilling willen verminderen
- Mensen die efficiënt willen koken met wat ze in huis hebben
- Beginnende koks die begeleiding zoeken
- Gezinnen die maaltijdplanning willen optimaliseren

**Secundaire doelgroep:**
- Ervaren koks die nieuwe inspiratie zoeken
- Mensen met dieetbeperkingen (vegan, vegetarisch, allergieën)
- Studenten en alleenstaanden met beperkt budget

### Probleemstelling

1. **Voedselverspilling**: Gemiddeld gooit een huishouden 30% van gekocht voedsel weg
2. **Gebrek aan inspiratie**: Mensen weten niet wat ze moeten maken met wat ze hebben
3. **Inefficiënte planning**: Boodschappen worden gekocht zonder te weten wat er al is
4. **Tijdgebrek**: Mensen hebben geen tijd om recepten te zoeken die passen bij hun voorraad

### Oplossing

STOCKPIT lost deze problemen op door:
- Automatische voorraad tracking via AI-visie
- Intelligente recept matching op basis van beschikbare ingrediënten
- Proactieve notificaties voor vervaldatums
- Gepersonaliseerde suggesties op basis van kookniveau en voorkeuren

---

## Branding & Design

### Brand Identiteit

**Naam:** STOCKPIT  
**Tagline:** "Jouw voorraad, onze recepten"  
**Missie:** Voedselverspilling verminderen en koken toegankelijker maken voor iedereen

### Visuele Identiteit

#### Kleurenpalet

**Primaire Kleur - STOCKPIT Emerald**
- Hex: `#047857`
- RGB: `rgb(4, 120, 87)`
- Gebruik: Primaire buttons, actieve states, branding elementen

**Secundaire Kleuren**
- Emerald Light (`#10b981`): Hover states, accenten
- Teal (`#14b8a6`): Secundaire accenten, categorie badges
- Emerald Dark (`#065f46`): Tekst op lichte achtergronden

**Neutrale Kleuren**
- Zwart/Donkergrijs (`#0f172a`): Primaire tekst, headers
- Middengrijs (`#475569`): Secundaire tekst
- Wit (`#FFFFFF`): Achtergronden, cards

#### Typografie

- **Font Familie**: System default (San Francisco op iOS, Roboto op Android)
- **Stijl**: Sans-serif, modern, clean
- **Gewichten**: 300 (Light) tot 800 (Extra Bold)
- **Brand naam**: Altijd in hoofdletters "STOCKPIT"

#### Design Principes

1. **Minimalistisch**: Clean, onopgesmukte interface
2. **Glassmorphism**: Subtiele blur effecten voor diepte
3. **Consistentie**: Uniforme spacing, border radius en shadows
4. **Toegankelijkheid**: WCAG AA/AAA contrast ratios, touch-friendly targets (min. 44px)

#### Logo

- **Bestand**: `/assets/logo.png`
- **Gebruik**: Header (36x36px), Welcome page (64x64px), Loading screens (80-96px)
- **Styling**: Resize mode: contain, altijd met brand naam "STOCKPIT"

---

## Functionaliteiten

### 1. Voorraadbeheer (Inventory)

#### STOCKPIT Mode - Barcode Scanning
- **Barcode scanner**: Scan producten met camera
- **Automatische productherkenning**: Match met productcatalogus (12.000+ producten)
- **Multi-store support**: Albert Heijn, Colruyt, Lidl, Jumbo, Carrefour, Open Food Facts
- **Automatische data**: Productnaam, merk, prijs, voedingswaarden, categorie

#### Shelf Photo Analyse
- **Foto upload**: Maak foto's van je voorraadkast/koelkast
- **AI-visie analyse**: Automatische productherkenning via GPT-4 Vision
- **Batch processing**: Meerdere producten tegelijk detecteren
- **Matching**: Automatische koppeling met productcatalogus
- **Week-overzicht**: Foto's gegroepeerd per week voor historisch overzicht

#### Handmatige Invoer
- **Snelle invoer**: Type productnaam, AI zoekt beste match
- **Multi-language**: Ondersteunt Nederlands, Frans, Duits
- **Categorie detectie**: Automatische categorie suggestie
- **Vervaldatum**: Kalender picker voor houdbaarheid

#### Voorraad Overzicht
- **Drie weergaven**:
  - Items: Lijst met alle producten
  - Categorieën: Geclusterd per categorie
  - Vervaldatum: Gesorteerd op houdbaarheid
- **Statistieken**: Totaal items, percentage bruikbaar, items die binnenkort vervallen
- **Filters**: Filter op categorie (pantry, dairy, vegetables, etc.)
- **Bewerken**: Pas hoeveelheid en vervaldatum aan
- **Verwijderen**: Markeer items als gebruikt

### 2. Recepten (Recipes)

#### Chef Radar
- **Slimme matching**: Recepten die perfect passen bij je voorraad
- **Match score**: Percentage ingrediënten die je hebt
- **AI-generatie**: Unieke recepten gegenereerd op basis van je voorraad
- **Persoonlijk**: Aangepast aan kookniveau, dieetbeperkingen en archetype
- **Uitbreidbaar**: "Meer genereren" voor extra suggesties

#### Recept van de Dag
- **Dagelijks nieuw recept**: Geselecteerd op basis van trending en kwaliteit
- **Persoonlijk AI-recept**: Dagelijks uniek recept gegenereerd voor jou
- **Hero weergave**: Grote, visuele presentatie op home screen

#### Trending Recepten
- **Meest gelikete recepten**: Populaire recepten van de week
- **Social proof**: Aantal likes en bewaarde recepten
- **Categorie filters**: Filter op Italiaans, Aziatisch, Vegan, etc.

#### Snelle Recepten
- **Klaar in 30 minuten**: Recepten voor drukke dagen
- **Infinite scroll**: Oneindig scrollen door snelle recepten
- **Random shuffle**: Variatie in suggesties

#### Recept Details
- **Volledige informatie**: 
  - Titel, beschrijving, auteur
  - Bereidingstijd, moeilijkheidsgraad, porties
  - Ingrediëntenlijst met hoeveelheden
  - Stap-voor-stap instructies
  - Voedingswaarden (eiwit, koolhydraten, vet, calorieën)
- **Opslaan**: Like en bewaar favoriete recepten
- **Afbeeldingen**: Hoge kwaliteit food photography

### 3. AI Chatbot

#### Conversational Interface
- **Floating button**: Altijd toegankelijk via chat icoon
- **Context-aware**: Kennis van je voorraad en profiel
- **Nederlandse taal**: Volledig in het Nederlands
- **Standaardvragen**: Quick access tot veelgestelde vragen

#### Mogelijkheden
- Recepten vinden op basis van voorraad
- Kooktips en technieken
- Voedselveiligheid en houdbaarheid
- Dieetadvies en voedingsinformatie
- Kookplanning en meal prep

#### Recept Opslaan
- **Direct opslaan**: Bewaar AI-suggesties als recept
- **Formulier**: Vul details aan (titel, ingrediënten, instructies)
- **Automatische parsing**: AI helpt met structureren

### 4. Profiel & Personalisatie

#### Gebruikersprofiel
- **Archetype**: Kookstijl (Comfort Food, Healthy, Experimental, etc.)
- **Kookniveau**: Beginner, Gemiddeld, Gevorderd
- **Dieetbeperkingen**: Vegan, Vegetarisch, Glutenvrij, etc.
- **Voorkeuren**: Categorieën die je leuk vindt

#### Personalisatie
- **Gepersonaliseerde feed**: Recepten aangepast aan profiel
- **Archetype matching**: Recepten die passen bij je stijl
- **Skill-based filtering**: Recepten op jouw niveau
- **Dieet compliance**: Automatische filtering op beperkingen

### 5. Admin Dashboard

#### Beheer Functionaliteiten
- **Dashboard metrics**: Totaal gebruikers, recepten, inventory items
- **Recept beheer**: Toevoegen, bewerken, verwijderen
- **AI Assistent**: Conversational interface voor admin taken
- **Monitoring**: Recente activiteit, error tracking
- **Security**: Row Level Security (RLS), activity logging

#### Admin AI
- **Recept creatie**: "Voeg een nieuw recept toe: Pasta Carbonara"
- **Database queries**: Veilige SELECT queries
- **Statistieken**: "Hoeveel gebruikers hebben we?"
- **Bulk operaties**: Meerdere recepten tegelijk beheren

---

## AI Integratie & Unieke Use Cases

### Huidige AI Functionaliteiten

#### 1. Vision AI (GPT-4 Vision)
- **Shelf Photo Analyse**: Detecteert producten in foto's van voorraadkast/koelkast
- **Productherkenning**: Identificeert merk, productnaam, hoeveelheid
- **Confidence scoring**: Betrouwbaarheidsscore per detectie
- **Batch processing**: Meerdere producten tegelijk analyseren

#### 2. Recipe Generation AI (OpenRouter/Grok)
- **Voorraad-gebaseerde generatie**: Recepten op basis van beschikbare ingrediënten
- **Profiel-aware**: Houdt rekening met kookniveau, dieetbeperkingen, archetype
- **Structured output**: Genereert complete recepten met ingrediënten, instructies, voedingswaarden
- **Multi-recipe generation**: Genereert 3-5 recepten tegelijk

#### 3. Conversational AI (OpenRouter/Grok)
- **Context-aware chat**: Kennis van voorraad, profiel, recente recepten
- **Nederlandse taal**: Volledig in het Nederlands
- **Multi-purpose**: Recepten, tips, voedselveiligheid, planning
- **Recept parsing**: Extraheert structuur uit conversaties

#### 4. Admin AI
- **Database operations**: Veilige CRUD operaties via natuurlijke taal
- **Analytics**: Statistieken en insights genereren
- **Content management**: Recepten beheren via chat interface

### Unieke AI Use Cases

#### Use Case 1: "Zero-Waste Chef Mode"
**Probleem**: Gebruiker heeft ingrediënten die binnen 2-3 dagen vervallen en weet niet wat te maken.

**AI Oplossing**:
1. AI analyseert voorraad en identificeert items die binnenkort vervallen
2. Genereert 3-5 recepten die ALLE vervallende items gebruiken
3. Prioriteert recepten op basis van:
   - Aantal vervallende items gebruikt
   - Kookniveau gebruiker
   - Beschikbare tijd
   - Voorkeuren (archetype, dieet)
4. Biedt meal prep suggesties: "Maak dit recept vandaag, bewaar voor morgen"

**Unieke waarde**: Voorkomt voedselverspilling door proactieve actie, niet alleen tracking.

---

#### Use Case 2: "Ingredient Substitution Intelligence"
**Probleem**: Gebruiker wil een recept maken maar mist 1-2 ingrediënten.

**AI Oplossing**:
1. Gebruiker selecteert recept
2. AI identificeert ontbrekende ingrediënten
3. Analyseert beschikbare voorraad voor substituties:
   - "Je hebt geen room, maar wel crème fraîche - dat werkt perfect!"
   - "Geen koriander? Gebruik peterselie met een snufje komijn"
4. Genereert aangepaste versie van recept met substituties
5. Legt uit waarom substitutie werkt (smaak, textuur, functie)

**Unieke waarde**: Maakt elk recept haalbaar met wat je hebt, geen extra boodschappen nodig.

---

#### Use Case 3: "Culinary Skill Progression"
**Probleem**: Beginner wil leren koken maar weet niet waar te beginnen.

**AI Oplossing**:
1. AI analyseert kookniveau gebruiker (beginner)
2. Stelt leerpad voor: "Laten we beginnen met basis technieken"
3. Genereert progressieve recepten:
   - Week 1: "Perfect gekookte eieren" (basis)
   - Week 2: "Pasta met tomatensaus" (intermediate)
   - Week 3: "Risotto" (advanced technique)
4. Elke recept bevat:
   - Techniek uitleg: "Waarom roeren belangrijk is"
   - Veelgemaakte fouten: "Let op: niet te veel zout"
   - Tips: "Pro-tip: gebruik warme bouillon"
5. Tracks progressie en past moeilijkheid aan

**Unieke waarde**: Persoonlijke kookleraar die meegroeit met je vaardigheden.

---

#### Use Case 4: "Dietary Compliance Guardian"
**Probleem**: Gebruiker heeft meerdere dieetbeperkingen (vegan + glutenvrij) en vindt het moeilijk recepten te vinden.

**AI Oplossing**:
1. AI kent alle dieetbeperkingen uit profiel
2. Filtert automatisch alle recepten op compliance
3. Genereert aangepaste versies van niet-compliant recepten:
   - "Dit recept bevat kaas, maar hier is een vegan versie met cashew cream"
   - "Gebruik glutenvrije pasta in plaats van gewone pasta"
4. Waarschuwt voor verborgen ingrediënten:
   - "Let op: dit product bevat melkpoeder (check label)"
5. Biedt alternatieven voor elk niet-compliant ingrediënt

**Unieke waarde**: Volledige dieet compliance zonder handmatig checken.

---

#### Use Case 5: "Flavor Profile Matching"
**Probleem**: Gebruiker houdt van bepaalde smaken maar weet niet welke recepten passen.

**AI Oplossing**:
1. Gebruiker beschrijft voorkeur: "Ik hou van umami, zoutig, hartig"
2. AI analyseert smaakprofielen van alle recepten
3. Matcht recepten op basis van:
   - Smaakprofiel (umami, zoet, zuur, bitter, zout)
   - Textuur (creamy, crunchy, soft)
   - Intensiteit (mild, medium, strong)
4. Genereert nieuwe recepten met gewenste smaakprofiel
5. Leert van feedback: "Meer van dit soort recepten"

**Unieke waarde**: Ontdek nieuwe recepten op basis van smaakvoorkeur, niet alleen ingrediënten.

---

#### Use Case 6: "Meal Prep Optimization"
**Probleem**: Gebruiker wil meal prep doen maar weet niet hoe te plannen.

**AI Oplossing**:
1. AI analyseert voorraad en beschikbare tijd
2. Genereert meal prep plan voor hele week:
   - "Maak dit op zondag, eet maandag en dinsdag"
   - "Dit recept kan je invriezen voor volgende week"
3. Optimaliseert op:
   - Minimale kooktijd
   - Maximale variatie
   - Houdbaarheid na bereiding
4. Biedt stap-voor-stap meal prep gids:
   - "Kook eerst de rijst (kan koud bewaard)"
   - "Bak de groenten als laatste (vers blijven)"
5. Genereert boodschappenlijst voor ontbrekende items

**Unieke waarde**: Complete meal prep planning met optimale efficiëntie.

---

#### Use Case 7: "Cultural Cuisine Explorer"
**Probleem**: Gebruiker wil nieuwe keukens ontdekken maar weet niet waar te beginnen.

**AI Oplossing**:
1. AI identificeert beschikbare ingrediënten
2. Matcht met culturele keukens:
   - "Je hebt tomaten, knoflook, olijfolie - perfect voor Italiaans!"
   - "Met deze ingrediënten kan je ook Thais maken"
3. Genereert authentieke recepten met:
   - Culturele context: "Dit is een klassiek Italiaans gerecht"
   - Techniek uitleg: "In Italië doen we dit zo..."
   - Variaties: "Regionale verschillen: in het noorden..."
4. Stelt ingrediënten voor voor volledige ervaring:
   - "Voor authentieke smaak: voeg basilicum toe"
5. Leert gebruiker over keuken terwijl ze koken

**Unieke waarde**: Culturele educatie gecombineerd met praktisch koken.

---

#### Use Case 8: "Nutritional Goal Assistant"
**Probleem**: Gebruiker wil gezonder eten maar weet niet welke recepten passen bij doelen.

**AI Oplossing**:
1. Gebruiker stelt doel: "Meer eiwit, minder koolhydraten"
2. AI analyseert voedingswaarden van alle recepten
3. Genereert aangepaste recepten:
   - "Dit recept heeft 30g eiwit, perfect voor je doel"
   - "Vervang rijst door bloemkoolrijst voor minder carbs"
4. Tracks macro's over tijd:
   - "Vandaag: 80g eiwit, 150g carbs - op schema!"
5. Biedt suggesties voor balans:
   - "Je hebt veel eiwit gegeten, probeer dit vezelrijke recept"

**Unieke waarde**: Voedingsdoelen behalen zonder handmatig tellen.

---

#### Use Case 9: "Leftover Transformation Engine"
**Probleem**: Gebruiker heeft restjes maar weet niet wat te maken.

**AI Oplossing**:
1. Gebruiker uploadt foto van restjes of beschrijft wat over is
2. AI identificeert restjes en hoeveelheid
3. Genereert transformatie recepten:
   - "Vanavond: Pasta Carbonara"
   - "Morgen: Carbonara frittata (gebruik restjes pasta)"
   - "Overmorgen: Pasta soep (gebruik laatste restjes)"
4. Elke transformatie gebruikt ALLE restjes
5. Biedt variaties: "Of maak dit er van voor andere smaak"

**Unieke waarde**: Geen restjes meer weggooien, alles wordt gebruikt.

---

#### Use Case 10: "Seasonal Ingredient Optimizer"
**Probleem**: Gebruiker wil seizoensgebonden koken maar weet niet wat in seizoen is.

**AI Oplossing**:
1. AI kent seizoenskalender voor alle ingrediënten
2. Analyseert huidige voorraad op seizoensgebondenheid
3. Genereert recepten die:
   - Gebruik maken van in-seizoen ingrediënten
   - Voorkeur geven aan lokale, seizoensgebonden producten
4. Waarschuwt voor out-of-season items:
   - "Tomaten zijn nu duur, overweeg dit alternatief"
5. Biedt seizoensgebonden boodschappenlijsten:
   - "Deze week in seizoen: asperges, spinazie, radijs"

**Unieke waarde**: Duurzaam en budgetvriendelijk koken met seizoensproducten.

---

## Technische Architectuur

### Tech Stack

#### Frontend
- **Framework**: React Native (Expo)
- **Navigation**: Expo Router
- **Styling**: NativeWind (Tailwind CSS)
- **State Management**: React Context API
- **Platforms**: iOS, Android, Web (PWA)

#### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (voor foto's)
- **Real-time**: Supabase Realtime subscriptions
- **Edge Functions**: Supabase Edge Functions

#### AI Services
- **Vision**: OpenAI GPT-4 Vision (shelf photo analyse)
- **LLM**: OpenRouter (Grok 4.1 Fast - free tier)
- **Fallback**: OpenAI GPT-4o-mini

#### Integraties
- **Product Catalog**: 
  - Albert Heijn
  - Colruyt
  - Lidl
  - Jumbo
  - Carrefour
  - Open Food Facts API
- **Barcode Scanning**: Expo Barcode Scanner, Quagga2 (web)

### Database Schema

#### Belangrijkste Tabellen
- `users`: Gebruikersprofielen
- `inventory`: Voorraad items
- `recipes`: Recepten database
- `recipe_likes`: Gebruiker likes
- `saved_recipes`: Bewaarde recepten
- `product_catalog`: Product catalogus (12.000+ producten)
- `shelf_photos`: Shelf foto's met analyse status
- `shelf_photo_analysis`: AI analyse resultaten
- `daily_ai_recipes`: Dagelijkse AI gegenereerde recepten
- `ai_chat_recipes`: Recepten uit AI chat
- `shopping_list`: Boodschappenlijsten

### Security

- **Row Level Security (RLS)**: Alle tabellen hebben RLS policies
- **Admin System**: Gescheiden admin functies met security definer
- **API Keys**: Veilig opgeslagen in environment variables
- **Authentication**: Supabase Auth met email/password

---

## Toekomstvisie

### Visie 2025-2026

**STOCKPIT wordt de intelligente keukenassistent die voedselverspilling elimineert en koken toegankelijk maakt voor iedereen.**

### Strategische Doelen

#### 1. Voedselverspilling Elimineren
- **Doel**: 50% reductie in voedselverspilling voor actieve gebruikers
- **Methode**: 
  - Proactieve notificaties
  - Zero-waste recept generatie
  - Leftover transformation engine
  - Seizoensgebonden optimalisatie

#### 2. Persoonlijke Kookleraar
- **Doel**: Gebruikers helpen kookvaardigheden ontwikkelen
- **Methode**:
  - Skill progression system
  - Video tutorials geïntegreerd
  - Techniek uitleg in recepten
  - Feedback loops voor verbetering

#### 3. Community Platform
- **Doel**: Gebruikers delen recepten en tips
- **Methode**:
  - User-generated content
  - Social features (volgen, delen)
  - Recept ratings en reviews
  - Community challenges

#### 4. Smart Home Integratie
- **Doel**: Automatische voorraad tracking
- **Methode**:
  - IoT sensor integratie (slimme koelkast)
  - E-commerce API koppelingen (automatische import)
  - Voice assistants (Alexa, Google Home)
  - Smart shopping lists

#### 5. Duurzaamheid Focus
- **Doel**: Duurzaam koken promoten
- **Methode**:
  - Carbon footprint tracking
  - Lokale producten prioriteren
  - Seizoensgebonden suggesties
  - Plant-based opties promoten

### Lange Termijn Visie (2027+)

1. **AI Chef in je keuken**: Real-time kookassistentie via AR/VR
2. **Global Platform**: Uitbreiding naar internationale markten
3. **B2B Solutions**: Voor restaurants en catering
4. **Research Partner**: Samenwerking met universiteiten voor voedselonderzoek
5. **Sustainability Leader**: Leidende rol in voedselverspilling bestrijding

---

## Roadmap

### Q1 2025 (Huidig)

#### ✅ Voltooid
- [x] Basis voorraadbeheer met barcode scanning
- [x] Recept matching engine
- [x] AI chatbot integratie
- [x] Shelf photo analyse
- [x] Admin dashboard
- [x] Product catalogus (12.000+ producten)
- [x] Multi-store support

#### 🔄 In Ontwikkeling
- [ ] Push notificaties voor vervaldatums
- [ ] Boodschappenlijst functionaliteit
- [ ] Recept sharing tussen gebruikers
- [ ] Verbeterde AI recipe generation

### Q2 2025

#### Geplande Features
- [ ] **Video Tutorials**: Geïntegreerde kookvideo's in recepten
- [ ] **Meal Planning**: Weekplanning met automatische boodschappenlijst
- [ ] **Nutrition Tracking**: Macro tracking en doelen
- [ ] **Social Features**: Volgen, delen, reviews
- [ ] **E-commerce Integratie**: Direct bestellen bij supermarkten
- [ ] **Voice Commands**: "STOCKPIT, wat kan ik maken met tomaten?"

#### Technische Verbeteringen
- [ ] Performance optimalisatie (lazy loading, caching)
- [ ] Offline mode voor basis functionaliteiten
- [ ] Verbeterde AI accuracy (fine-tuning)
- [ ] Multi-language support (FR, DE, EN)

### Q3 2025

#### Geplande Features
- [ ] **AR Kookassistent**: Real-time instructies via camera
- [ ] **Smart Home Integratie**: IoT sensor support
- [ ] **Community Challenges**: "Zero Waste Week"
- [ ] **Recipe Collections**: Gebruikers kunnen collecties maken
- [ ] **Advanced Analytics**: Persoonlijke insights en trends
- [ ] **Subscription Tiers**: Premium features

#### Uitbreidingen
- [ ] Uitbreiding product catalogus (50.000+ producten)
- [ ] Meer supermarkt integraties (Picnic, Deliveroo)
- [ ] Internationale markten (Duitsland, Frankrijk)

### Q4 2025

#### Geplande Features
- [ ] **AI Personal Chef**: Volledig gepersonaliseerde meal planning
- [ ] **Sustainability Dashboard**: Carbon footprint tracking
- [ ] **B2B Platform**: Voor restaurants en catering
- [ ] **API voor Developers**: Open platform voor integraties
- [ ] **Mobile Apps**: Native iOS en Android apps

#### Strategische Doelen
- [ ] 10.000 actieve gebruikers
- [ ] 50% voedselverspilling reductie (gemeten)
- [ ] Partnership met supermarkten
- [ ] Funding ronde voor schaling

### 2026+

#### Lange Termijn
- [ ] **Global Expansion**: Uitbreiding naar 10+ landen
- [ ] **AI Research**: Samenwerking met universiteiten
- [ ] **Hardware**: STOCKPIT smart devices
- [ ] **Acquisitions**: Overname van complementaire apps
- [ ] **IPO Consideration**: Publieke markt evaluatie

---

## Product Requirements Document (PRD)

### PRD: Zero-Waste Chef Mode

#### Overzicht
Feature die gebruikers helpt voedselverspilling te voorkomen door proactieve actie op basis van vervaldatums.

#### Probleem
Gebruikers zien dat items vervallen maar weten niet wat te maken, resulterend in verspilling.

#### Oplossing
AI-gegenereerde recepten die ALLE vervallende items gebruiken, geprioriteerd op urgentie.

#### User Stories

**Als gebruiker wil ik:**
1. Een overzicht zien van items die binnen 3 dagen vervallen
2. Recepten krijgen die deze items gebruiken
3. Een meal plan krijgen voor de komende dagen
4. Notificaties krijgen 2 dagen voor vervaldatum

#### Functionaliteiten

1. **Vervaldatum Dashboard**
   - Visuele weergave van items per urgentie (rood, oranje, groen)
   - Filter op dagen tot vervaldatum
   - Quick actions: "Genereer recepten"

2. **Zero-Waste Recipe Generation**
   - AI analyseert vervallende items
   - Genereert 3-5 recepten die ALLE items gebruiken
   - Prioriteert op:
     - Aantal vervallende items gebruikt
     - Kookniveau
     - Beschikbare tijd
     - Voorkeuren

3. **Meal Planning**
   - Weekplanning met vervallende items
   - Suggesties voor meal prep
   - Boodschappenlijst voor ontbrekende items

4. **Notificaties**
   - Push notificatie 2 dagen voor vervaldatum
   - Suggestie: "Je tomaten vervallen morgen, maak dit recept!"
   - Reminder: "Nog 1 dag tot vervaldatum"

#### Technische Specificaties

**API Endpoints:**
- `GET /api/inventory/expiring?days=3` - Items die binnen X dagen vervallen
- `POST /api/recipes/zero-waste` - Genereer zero-waste recepten
- `GET /api/meal-plan/week` - Weekplanning

**AI Prompt:**
```
Gebruiker heeft deze items die binnen 3 dagen vervallen: [items]
Genereer 3-5 recepten die:
1. ALLE vervallende items gebruiken
2. Passen bij kookniveau: [niveau]
3. Rekening houden met: [dieetbeperkingen]
4. Klaar zijn in: [beschikbare tijd]
```

**Database:**
- Nieuwe tabel: `expiry_alerts`
- Nieuwe functie: `get_expiring_items(days)`
- Nieuwe functie: `generate_zero_waste_recipes(items, profile)`

#### Success Metrics
- **Voedselverspilling reductie**: 30% minder weggegooid voedsel
- **Feature adoption**: 60% van gebruikers gebruikt feature wekelijks
- **User satisfaction**: 4.5+ sterren rating
- **Recipe success rate**: 80% van gegenereerde recepten worden gemaakt

#### Prioriteit
**High** - Kernfunctionaliteit voor voedselverspilling reductie

---

### PRD: Ingredient Substitution Intelligence

#### Overzicht
AI-systeem dat automatisch ingrediënt substituties voorstelt wanneer gebruiker items mist.

#### Probleem
Gebruiker wil recept maken maar mist 1-2 ingrediënten, moet naar winkel of geeft op.

#### Oplossing
Intelligente substitutie suggesties op basis van beschikbare voorraad en kookkennis.

#### User Stories

**Als gebruiker wil ik:**
1. Zien welke ingrediënten ik mis voor een recept
2. Substitutie suggesties krijgen op basis van wat ik WEL heb
3. Een aangepaste versie van het recept krijgen met substituties
4. Uitleg krijgen waarom substitutie werkt

#### Functionaliteiten

1. **Missing Ingredients Detection**
   - Automatische check bij recept selectie
   - Highlight ontbrekende items
   - "Vind substituties" button

2. **Substitution Engine**
   - AI analyseert beschikbare voorraad
   - Matcht op basis van:
     - Smaakprofiel
     - Textuur
     - Kookfunctie (binding, smaakmaker, etc.)
   - Genereert substitutie suggesties met uitleg

3. **Adapted Recipe View**
   - Origineel recept met substituties gemarkeerd
   - Side-by-side vergelijking
   - Aangepaste instructies indien nodig

4. **Learning System**
   - Gebruiker feedback: "Dit werkte goed/slecht"
   - AI leert van feedback
   - Persoonlijke substitutie voorkeuren

#### Technische Specificaties

**AI Model:**
- Fine-tuned model op kookkennis database
- Ingrediënt substitutie matrix
- Smaakprofiel matching

**Database:**
- Tabel: `ingredient_substitutions`
- Tabel: `substitution_feedback`
- Functie: `find_substitutions(missing_item, available_items)`

#### Success Metrics
- **Substitution rate**: 70% van gebruikers gebruikt substituties
- **Success rate**: 85% van substituties werkt goed
- **User satisfaction**: 4.3+ sterren
- **Recipe completion**: 40% meer recepten voltooid

#### Prioriteit
**Medium** - Verhoogt recipe completion rate

---

### PRD: Culinary Skill Progression

#### Overzicht
Gepersonaliseerd leerpad dat gebruikers helpt kookvaardigheden ontwikkelen.

#### Probleem
Beginners weten niet waar te beginnen en blijven hangen op basis niveau.

#### Oplossing
Progressief leerpad met recepten die vaardigheden opbouwen.

#### User Stories

**Als beginner wil ik:**
1. Een leerpad krijgen op basis van mijn niveau
2. Recepten krijgen die mijn vaardigheden opbouwen
3. Uitleg krijgen over technieken
4. Mijn progressie zien

#### Functionaliteiten

1. **Skill Assessment**
   - Quiz bij eerste gebruik
   - Analyse van gemaakte recepten
   - Automatische niveau detectie

2. **Learning Path**
   - Week-over-week progressie
   - Technieken per niveau:
     - Beginner: Koken, bakken, snijden
     - Intermediate: Sauteren, braiseren, emulgeren
     - Advanced: Sous vide, fermenteren, moleculair

3. **Recipe Integration**
   - Techniek highlights in recepten
   - Video tutorials voor technieken
   - Veelgemaakte fouten waarschuwingen
   - Pro tips

4. **Progress Tracking**
   - Skills unlocked dashboard
   - Badges voor milestones
   - Streak tracking
   - Personal bests

#### Technische Specificaties

**Database:**
- Tabel: `cooking_skills`
- Tabel: `user_skill_progress`
- Tabel: `learning_paths`
- Functie: `get_next_recipe_for_skill(user_id, skill)`

**AI:**
- Skill gap analysis
- Personalized learning path generation
- Adaptive difficulty

#### Success Metrics
- **Skill progression**: 50% van beginners naar intermediate in 3 maanden
- **Engagement**: 70% voltooit leerpad
- **Retention**: 40% hogere retention voor gebruikers met leerpad
- **Satisfaction**: 4.6+ sterren

#### Prioriteit
**High** - Verhoogt user engagement en retention

---

## Concurrentie Analyse

### Directe Concurrenten

#### 1. Paprika Recipe Manager
**Sterktes:**
- Uitgebreide recipe management
- Meal planning
- Shopping lists

**Zwaktes:**
- Geen AI integratie
- Geen voorraadbeheer
- Geen automatische matching

**STOCKPIT Differentiatie:**
- AI-powered voorraad matching
- Automatische recept generatie
- Voedselverspilling focus

#### 2. AnyList
**Sterktes:**
- Shopping lists
- Meal planning
- Family sharing

**Zwaktes:**
- Geen recept matching
- Geen voorraadbeheer
- Geen AI

**STOCKPIT Differentiatie:**
- Complete voorraadbeheer
- AI recept matching
- Zero-waste focus

#### 3. Yuka
**Sterktes:**
- Barcode scanning
- Product informatie
- Health scores

**Zwaktes:**
- Geen recepten
- Geen voorraadbeheer
- Geen meal planning

**STOCKPIT Differentiatie:**
- Complete keuken ecosystem
- Recept generatie
- Meal planning

### Indirecte Concurrenten

#### Supermarkt Apps (Albert Heijn, Jumbo)
**Sterktes:**
- Directe bestelling
- Loyalty programs
- Product catalogus

**Zwaktes:**
- Geen voorraadbeheer
- Geen recept matching
- Vendor lock-in

**STOCKPIT Differentiatie:**
- Multi-store support
- Vendor-agnostic
- Focus op gebruik, niet kopen

### Concurrentievoordeel

1. **AI-First Approach**: Unieke AI integratie voor alle features
2. **Zero-Waste Mission**: Enige app met focus op voedselverspilling
3. **Complete Ecosystem**: Voorraad + Recepten + Planning in één
4. **Multi-Store**: Niet gebonden aan één supermarkt
5. **Personalization**: Diepe personalisatie op basis van profiel

---

## Conclusie

STOCKPIT is een innovatieve keukenapp die AI-technologie combineert met praktische functionaliteiten om voedselverspilling te verminderen en koken toegankelijker te maken. Met unieke features zoals Zero-Waste Chef Mode, Ingredient Substitution Intelligence, en Culinary Skill Progression, onderscheidt STOCKPIT zich van concurrenten door een complete, geïntegreerde ervaring te bieden.

De toekomstvisie richt zich op het elimineren van voedselverspilling, het ontwikkelen van een community platform, en het worden van de persoonlijke kookleraar voor miljoenen gebruikers wereldwijd.

---

**Document Versie:** 1.0  
**Laatste Update:** 2025-01-28  
**Auteur:** STOCKPIT Development Team  
**Status:** Actief in ontwikkeling


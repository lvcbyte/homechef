# PWA Implementation Status - STOCKPIT App

## Overzicht
Dit document beschrijft de huidige staat van de PWA (Progressive Web App) implementatie voor de STOCKPIT app. De app is gebouwd met Expo Router en moet een native-app-achtige ervaring bieden wanneer deze wordt geopend vanuit het home screen op iOS en Android.

## Technische Stack
- **Framework**: Expo Router (React Native)
- **Platform**: Web (PWA), iOS, Android
- **Styling**: React Native StyleSheet + CSS (voor web safe areas)
- **Navigation**: Expo Router met custom navigation utility

## Huidige Implementatie

### 1. Manifest Configuratie (`app.config.js`)
- ✅ `display: "standalone"` - Verbergt browser UI
- ✅ `scope: "/"` - Correct ingesteld
- ✅ `themeColor: "#047857"` - Brand kleur (groen)
- ✅ `backgroundColor: "#ffffff"` - Witte achtergrond
- ✅ `startUrl: "/"` - Start op home pagina
- ✅ `viewport-fit=cover` - Voor iOS safe areas (notch, home indicator)

### 2. Meta Tags (via `app.config.js`)
- ✅ `apple-mobile-web-app-capable: "yes"` - iOS standalone mode
- ✅ `apple-mobile-web-app-status-bar-style: "black-translucent"` - Status bar styling
- ✅ `viewport-fit=cover` - Voor safe area support
- ✅ `format-detection: telephone=no` - Voorkomt telefoonnummer detectie

### 3. CSS Safe Area Handling (`app/_layout.tsx`)
De app gebruikt CSS `env()` functies voor safe area insets:

```css
.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px) !important;
}

.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px) !important;
}

.glass-dock {
  position: fixed !important;
  bottom: 0 !important;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px)) !important;
}
```

### 4. Component Structuur

#### Root Layout (`app/_layout.tsx`)
- Voegt globale CSS toe voor safe area handling
- Minimal interference met native layout
- Voorkomt pull-to-refresh en zoom op double-tap

#### Bottom Navigation (`components/navigation/GlassDock.tsx`)
- **Web**: Gebruikt `position: fixed` via CSS class `.glass-dock`
- **Native**: Gebruikt `SafeAreaView` met `edges={['bottom']}`
- Zit altijd onderaan het scherm
- Respecteert iOS home indicator safe area

#### Page Components
Alle pagina's volgen dit patroon:
```tsx
<SafeAreaView 
  style={styles.safeArea}
  className="safe-area-top" // Alleen op web
>
  <View style={styles.header}>
    {/* Header content */}
  </View>
  <ScrollView contentContainerStyle={styles.scrollContent}>
    {/* Page content */}
  </ScrollView>
</SafeAreaView>
<GlassDock />
```

### 5. Styling Patterns

#### SafeAreaView Styles
```typescript
safeArea: {
  flex: 1,
  paddingTop: Platform.select({
    web: 0, // Handled by CSS safe-area-top class
    default: 8,
  }),
}
```

#### ScrollView Content Styles
```typescript
scrollContent: {
  paddingHorizontal: 24,
  paddingBottom: Platform.select({
    web: 140, // Extra space for fixed bottom nav + safe area
    default: 120,
  }),
  gap: 32,
}
```

## Huidige Status per Pagina

### ✅ Volledig Geïmplementeerd
- `/` (index.tsx) - Home pagina
- `/recipes` - Recepten pagina
- `/inventory` - Voorraad pagina
- `/saved` - Opgeslagen recepten
- `/scan` - Scan pagina
- `/profile` - Profiel pagina
- `/admin` - Admin pagina

Alle pagina's hebben:
- ✅ SafeAreaView met `safe-area-top` class op web
- ✅ Correcte `paddingTop` (0 op web, 8 op native)
- ✅ ScrollView met extra `paddingBottom` op web (140px)
- ✅ GlassDock component voor bottom navigation

## Bekende Issues & Verbeterpunten

### 1. Header Positionering
**Probleem**: Header staat mogelijk nog te laag op iOS devices met Dynamic Island/notch.

**Huidige Oplossing**: 
- CSS gebruikt `env(safe-area-inset-top)` voor top padding
- Geen extra 8px padding op web (alleen safe area inset)

**Mogelijke Verbetering**:
- Testen op verschillende iOS devices (iPhone X, 11, 12, 13, 14, 15)
- Mogelijk extra kleine padding toevoegen voor visuele balans

### 2. Navigatie Consistentie
**Probleem**: Bij navigatie via bottom nav kunnen er inconsistenties optreden.

**Huidige Oplossing**:
- `navigateToRoute()` utility functie gebruikt `router.push()`
- Werkt op zowel web als native

**Mogelijke Verbetering**:
- Testen of navigatie smooth is tussen pagina's
- Mogelijk scroll positie resetten bij navigatie

### 3. Safari UI Elementen
**Probleem**: Sommige pagina's tonen nog Safari UI elementen (address bar, etc.)

**Huidige Oplossing**:
- `display: "standalone"` in manifest
- `apple-mobile-web-app-capable: "yes"` meta tag
- Viewport meta tag met `viewport-fit=cover`

**Mogelijke Verbetering**:
- Verifiëren dat app correct wordt geïnstalleerd als PWA
- Testen in standalone mode (niet in Safari browser)
- Mogelijk extra CSS toevoegen om browser UI te verbergen

## Test Checklist

### iOS Testing
- [ ] iPhone met notch (X, 11, 12, 13, 14, 15)
- [ ] iPhone met Dynamic Island (14 Pro, 15 Pro)
- [ ] iPad (als tablet support nodig is)
- [ ] Testen in standalone mode (toegevoegd aan home screen)
- [ ] Testen in Safari browser (moet ook werken)

### Android Testing
- [ ] Verschillende Android versies (10, 11, 12, 13, 14)
- [ ] Verschillende schermformaten
- [ ] Testen in Chrome standalone mode
- [ ] Testen in Chrome browser

### Functionaliteit
- [ ] Navigatie tussen alle pagina's werkt
- [ ] Bottom nav blijft zichtbaar en klikbaar
- [ ] Content scrollt correct zonder achter nav te verdwijnen
- [ ] Header blijft zichtbaar en correct gepositioneerd
- [ ] Safe areas werken correct (geen clipping)
- [ ] Geen browser UI zichtbaar in standalone mode

## Best Practices Gevolgd

1. **Minimale CSS Interference**: CSS wordt alleen gebruikt waar nodig, native layout blijft intact
2. **Platform-Specific Code**: Gebruik van `Platform.select()` voor platform-specifieke styling
3. **Safe Area Support**: Correct gebruik van `env(safe-area-inset-*)` voor iOS
4. **Fixed Bottom Nav**: Bottom navigation is fixed op web, gebruikt SafeAreaView op native
5. **Consistent Patterns**: Alle pagina's volgen hetzelfde patroon

## Code Locaties

### Belangrijke Bestanden
- `app.config.js` - PWA manifest configuratie
- `app/_layout.tsx` - Root layout met globale CSS
- `components/navigation/GlassDock.tsx` - Bottom navigation component
- `utils/navigation.ts` - Navigation utility functie
- `app/index.tsx` - Home pagina (voorbeeld implementatie)
- `app/recipes.tsx` - Recepten pagina
- `app/inventory.tsx` - Voorraad pagina
- `app/saved.tsx` - Opgeslagen pagina
- `app/scan.tsx` - Scan pagina
- `app/profile.tsx` - Profiel pagina
- `app/admin.tsx` - Admin pagina

## Voor Hulp Vragen aan Gemini

Wanneer je hulp nodig hebt, gebruik deze context:

**Prompt Template**:
```
Ik werk aan een PWA (Progressive Web App) gebouwd met Expo Router. 
De app moet een native-app-achtige ervaring bieden op iOS en Android.

Huidige situatie:
- [Beschrijf het specifieke probleem]
- [Welke pagina's zijn betrokken]
- [Wat werkt wel en wat niet]

Technische details:
- Expo Router voor routing
- React Native StyleSheet voor styling
- CSS voor web safe area handling
- Bottom navigation is fixed op web
- SafeAreaView gebruikt op native

Zie PWA_IMPLEMENTATION_STATUS.md voor volledige implementatie details.

[Specifieke vraag of probleem]
```

## Conclusie

De PWA implementatie is grotendeels compleet. Alle pagina's hebben de juiste safe area handling en bottom navigation. De belangrijkste verbeterpunten zijn:
1. Testen op verschillende devices
2. Verifiëren dat Safari UI elementen volledig verborgen zijn
3. Mogelijk fine-tuning van header positionering

De codebase volgt consistente patronen en is goed onderhoudbaar.


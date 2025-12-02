# Baanbrekende STOCKPIT Features - Implementatie Guide

## Overzicht

Deze documentatie beschrijft de nieuwe baanbrekende features die zijn geïmplementeerd voor STOCKPIT:

1. **Slimme Aankoop Adviseur** - ML-powered prijsvoorspelling
2. **Recept Gezondheidsimpact Simulator** - Visualisatie van voedingsimpact
3. **Adaptieve Recepten UI** - Automatische ingrediënt vervanging
4. **Vision-Based Voorraadverificatie** - Camera-gebaseerde voorraadcheck
5. **PWA Kooktijd Sync** - Timer synchronisatie tussen apparaten
6. **Web Serial API voor Smart Appliances** - Slimme keukenapparaten controle

---

## 1. Database Migratie

### Uitvoeren

```bash
# Migratie uitvoeren via Supabase CLI
supabase migration up

# Of via Supabase Dashboard
# Upload: supabase/migrations/93_baanbrekende_stockpit_features.sql
```

### Nieuwe Tabellen

- `price_history` - Historische prijsdata voor voorspellingen
- `ingredient_substitutions` - Ingrediënt vervangingen database
- `cooking_timers` - Timer synchronisatie data
- `user_health_goals` - Gebruikers gezondheidsdoelen
- `recipe_consumption` - Recept consumptie tracking
- `ml_model_metadata` - ML model metadata

---

## 2. Dependencies Installeren

```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native recharts socket.io-client zustand
```

**Opmerking**: Voor TensorFlow.js op React Native, zie [TensorFlow.js React Native Setup](https://www.tensorflow.org/js/guide/react_native).

---

## 3. Feature Implementaties

### 3.1 Slimme Aankoop Adviseur

**Component**: `components/shopping/SmartPurchaseAdvisor.tsx`  
**Service**: `services/ml/pricePredictor.ts`

**Gebruik**:

```tsx
import { SmartPurchaseAdvisor } from '../components/shopping/SmartPurchaseAdvisor';

<SmartPurchaseAdvisor
  productId="product-123"
  productName="Rijst"
  currentPrice={2.99}
  onDismiss={() => setShowAdvisor(false)}
/>
```

**Features**:
- Client-side ML model training met TensorFlow.js
- Prijsvoorspelling op basis van historische data
- Aankoop aanbevelingen (koop nu, wacht, urgent)
- Betrouwbaarheidsscore

**Database Functies**:
- `get_price_trend(product_id, days)` - Haal prijstrends op
- Automatische prijs tracking via trigger

---

### 3.2 Recept Gezondheidsimpact Simulator

**Component**: `components/recipes/RecipeHealthImpact.tsx`

**Gebruik**:

```tsx
import { RecipeHealthImpact } from '../components/recipes/RecipeHealthImpact';

<RecipeHealthImpact
  recipeId="recipe-123"
  servings={2}
  onClose={() => setShowImpact(false)}
/>
```

**Features**:
- Interactieve grafieken met Recharts
- Portiegrootte aanpassing
- Dagelijkse doelvoortgang visualisatie
- Wat-als scenario's voor ingrediënt vervangingen

**Database Functies**:
- `calculate_recipe_health_impact(recipe_id, servings, user_id)` - Bereken impact

---

### 3.3 Adaptieve Recepten UI

**Component**: `components/recipes/AdaptiveRecipeView.tsx`

**Gebruik**:

```tsx
import { AdaptiveRecipeView } from '../components/recipes/AdaptiveRecipeView';

<AdaptiveRecipeView
  recipe={recipe}
  userInventory={inventory}
  onIngredientSwapped={(swaps) => console.log('Swaps:', swaps)}
/>
```

**Features**:
- Automatische ingrediënt detectie
- Database-gestuurde vervangingen
- Visuele status indicatoren
- Accepteer/verwerp swaps

**Database Functies**:
- `find_ingredient_substitutions(ingredient_name, min_confidence)`
- `can_substitute_ingredient(recipe_ingredient, available_ingredient)`

**Seed Data**: 
- Standaard substituties zijn al ingevoerd (uien, zuivel, meel, etc.)

---

### 3.4 Vision-Based Voorraadverificatie

**Component**: `components/inventory/VisionStockVerification.tsx`

**Gebruik**:

```tsx
import { VisionStockVerification } from '../components/inventory/VisionStockVerification';

<VisionStockVerification
  inventoryItems={inventory}
  onItemDetected={(itemId, confidence) => {
    console.log('Detected:', itemId, confidence);
  }}
  onClose={() => setShowVision(false)}
/>
```

**Features**:
- Camera-gebaseerde object detectie
- Real-time item herkenning
- Confidence scores
- Multi-item detectie

**Opmerking**: 
- Volledige ML implementatie vereist TensorFlow.js of OpenCV.js model training
- Huidige implementatie bevat placeholder logica
- Voor productie: train custom object detection model

---

### 3.5 PWA Kooktijd Sync

**Component**: `components/recipes/SyncedCookingTimer.tsx`  
**Service**: `services/timerSync.ts`

**Gebruik**:

```tsx
import { SyncedCookingTimer } from '../components/recipes/SyncedCookingTimer';

<SyncedCookingTimer
  timerName="Oven 180°C"
  durationSeconds={1800}
  recipeId="recipe-123"
  onComplete={() => console.log('Timer done!')}
  onDismiss={() => setShowTimer(false)}
/>
```

**Features**:
- Real-time synchronisatie tussen apparaten
- WebSocket-based communicatie
- Fallback naar polling
- Cross-device timer updates

**Setup WebSocket Server**:

1. Deploy Supabase Edge Function:
```bash
supabase functions deploy timer-sync
```

2. Configureer WebSocket URL in `services/timerSync.ts`:
```typescript
const wsUrl = 'wss://your-project.supabase.co/functions/v1/timer-sync';
```

**Database Functies**:
- `get_active_timers(user_id)` - Haal actieve timers op
- `complete_timer(timer_id, user_id)` - Voltooi timer

---

### 3.6 Web Serial API voor Smart Appliances

**Component**: `components/recipes/SmartApplianceControl.tsx`

**Gebruik**:

```tsx
import { SmartApplianceControl } from '../components/recipes/SmartApplianceControl';

<SmartApplianceControl
  applianceType="oven"
  recipeId="recipe-123"
  onClose={() => setShowControl(false)}
/>
```

**Features**:
- Web Serial API integratie
- Oven, fornuis, magnetron ondersteuning
- Real-time commando's
- Status feedback

**Ondersteuning**:
- Alleen beschikbaar in Chrome, Edge, Opera (desktop)
- Vereist USB/Serial verbinding
- Apparaat-specifieke protocollen nodig

**Commando Formaten**:
- Oven: `PREHEAT:180`, `COOK:180:30`, `STOP`
- Fornuis: `HEAT:200`, `OFF`
- Magnetron: `COOK:120`, `STOP`

---

## 4. Integratie in Bestaande App

### 4.1 Recept Detail Pagina

```tsx
// app/recipes.tsx of recipe detail component
import { AdaptiveRecipeView } from '../components/recipes/AdaptiveRecipeView';
import { RecipeHealthImpact } from '../components/recipes/RecipeHealthImpact';
import { SyncedCookingTimer } from '../components/recipes/SyncedCookingTimer';

// In je component:
const [showHealthImpact, setShowHealthImpact] = useState(false);
const [showTimer, setShowTimer] = useState(false);

// In render:
{showHealthImpact && (
  <RecipeHealthImpact
    recipeId={recipe.id}
    servings={recipe.servings || 1}
    onClose={() => setShowHealthImpact(false)}
  />
)}

{showTimer && (
  <SyncedCookingTimer
    timerName={`${recipe.title} - Oven`}
    durationSeconds={recipe.cook_time_minutes * 60}
    recipeId={recipe.id}
    onComplete={() => setShowTimer(false)}
    onDismiss={() => setShowTimer(false)}
  />
)}

<AdaptiveRecipeView
  recipe={recipe}
  userInventory={inventory}
/>
```

### 4.2 Product/Scan Pagina

```tsx
// app/scan.tsx of product detail
import { SmartPurchaseAdvisor } from '../components/shopping/SmartPurchaseAdvisor';

{product && (
  <SmartPurchaseAdvisor
    productId={product.id}
    productName={product.product_name}
    currentPrice={product.price}
  />
)}
```

### 4.3 Inventory Pagina

```tsx
// app/inventory.tsx
import { VisionStockVerification } from '../components/inventory/VisionStockVerification';

{showVisionCheck && (
  <VisionStockVerification
    inventoryItems={inventory}
    onItemDetected={(itemId, confidence) => {
      // Update inventory status
    }}
    onClose={() => setShowVisionCheck(false)}
  />
)}
```

---

## 5. Styling & Theming

Alle componenten volgen het STOCKPIT design system:
- **Primaire kleur**: `#047857` (STOCKPIT Emerald)
- **Secundaire kleuren**: `#10b981`, `#14b8a6`
- **Glassmorphism**: Subtiele blur effecten
- **Mobile-first**: Responsive design

---

## 6. Performance Overwegingen

### ML Model Training
- Training gebeurt client-side (privacy-vriendelijk)
- Model wordt gecached na eerste training
- Training duurt ~5-10 seconden (afhankelijk van data)

### WebSocket Connecties
- Automatische reconnectie bij disconnect
- Fallback naar polling als WebSocket faalt
- Max 5 reconnectie pogingen

### Camera/Vision
- Foto's worden gecomprimeerd voor snellere verwerking
- Object detectie kan 2-5 seconden duren
- Overweeg background processing voor betere UX

---

## 7. Toekomstige Verbeteringen

1. **ML Models**:
   - Pre-trained models in Supabase Storage
   - Model versioning en updates
   - A/B testing van modellen

2. **Vision Detection**:
   - Custom TensorFlow.js model training
   - Real-time object tracking
   - Barcode + vision combinatie

3. **Smart Appliances**:
   - Bluetooth Low Energy (BLE) ondersteuning
   - Apparaat-specifieke plugins
   - Voice control integratie

4. **Timer Sync**:
   - Push notifications bij timer completion
   - Multi-user timer sharing
   - Timer templates

---

## 8. Troubleshooting

### TensorFlow.js werkt niet
- Controleer of `@tensorflow/tfjs` correct is geïnstalleerd
- Voor React Native: installeer `@tensorflow/tfjs-react-native`
- Check browser console voor errors

### WebSocket verbinding faalt
- Controleer Supabase Edge Function deployment
- Verify WebSocket URL in `timerSync.ts`
- Check firewall/proxy instellingen

### Camera permissions
- Controleer browser/device permissions
- Voor web: HTTPS vereist
- Voor native: Check `Info.plist` / `AndroidManifest.xml`

### Web Serial API niet beschikbaar
- Alleen beschikbaar in Chrome/Edge/Opera (desktop)
- Vereist HTTPS verbinding
- Check browser console voor errors

---

## 9. Support & Contact

Voor vragen of problemen:
- Check de code comments in componenten
- Review database functies in migration file
- Test individuele componenten in isolatie

---

**Laatste Update**: 2025-01-28  
**Versie**: 1.0.0


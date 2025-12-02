# Stap 4: Test Componenten in de App

## ✅ Test Checklist

### 1. Smart Purchase Advisor

**Locatie**: Product detail pagina of scan pagina

**Test**:
1. Open een product in de catalogus
2. Klik op "Slimme Aankoop Adviseur" (als knop beschikbaar is)
3. Controleer of:
   - Prijsvoorspelling wordt getoond
   - Aanbeveling wordt gegeven (koop nu/wacht/urgent)
   - Betrouwbaarheidsscore wordt getoond

**Integratie**:
```tsx
import { SmartPurchaseAdvisor } from '../components/shopping/SmartPurchaseAdvisor';

// In je product detail component:
<SmartPurchaseAdvisor
  productId={product.id}
  productName={product.product_name}
  currentPrice={product.price}
/>
```

### 2. Recipe Health Impact

**Locatie**: Recept detail pagina

**Test**:
1. Open een recept
2. Klik op "Gezondheidsimpact" (als knop beschikbaar is)
3. Controleer of:
   - Voedingswaarden worden getoond
   - Grafieken worden gerenderd (web) of progress bars (mobile)
   - Portiegrootte kan worden aangepast

**Integratie**:
```tsx
import { RecipeHealthImpact } from '../components/recipes/RecipeHealthImpact';

// In je recipe detail component:
<RecipeHealthImpact
  recipeId={recipe.id}
  servings={recipe.servings || 1}
/>
```

### 3. Adaptive Recipe View

**Locatie**: Recept detail pagina

**Test**:
1. Open een recept
2. Controleer of:
   - Ingrediënten worden geanalyseerd tegen je voorraad
   - Vervangingen worden voorgesteld
   - Je kunt swaps accepteren/verwerpen

**Integratie**:
```tsx
import { AdaptiveRecipeView } from '../components/recipes/AdaptiveRecipeView';

// In je recipe detail component:
<AdaptiveRecipeView
  recipe={recipe}
  userInventory={inventory}
  onIngredientSwapped={(swaps) => console.log('Swaps:', swaps)}
/>
```

### 4. Vision Stock Verification

**Locatie**: Inventory pagina

**Test**:
1. Ga naar inventory pagina
2. Klik op "Controleer met Camera" (als knop beschikbaar is)
3. Controleer of:
   - Camera permissies worden gevraagd
   - Camera interface wordt getoond
   - Scan functionaliteit werkt

**Integratie**:
```tsx
import { VisionStockVerification } from '../components/inventory/VisionStockVerification';

// In je inventory component:
<VisionStockVerification
  inventoryItems={inventory}
  onItemDetected={(itemId, confidence) => {
    // Update inventory
  }}
/>
```

### 5. Synced Cooking Timer

**Locatie**: Cooking mode of recept detail

**Test**:
1. Start cooking mode voor een recept
2. Start een timer
3. Open dezelfde app op een ander apparaat/tab
4. Controleer of:
   - Timer wordt gesynchroniseerd
   - Updates worden getoond op beide apparaten

**Integratie**:
```tsx
import { SyncedCookingTimer } from '../components/recipes/SyncedCookingTimer';

// In cooking mode:
<SyncedCookingTimer
  timerName="Oven 180°C"
  durationSeconds={1800}
  recipeId={recipe.id}
  onComplete={() => console.log('Timer done!')}
/>
```

### 6. Smart Appliance Control

**Locatie**: Cooking mode

**Test**:
1. Open cooking mode
2. Klik op "Slimme Apparaten" (als knop beschikbaar is)
3. Controleer of:
   - Web Serial API wordt gedetecteerd
   - Apparaat kan worden verbonden (als beschikbaar)
   - Commando's kunnen worden verzonden

**Integratie**:
```tsx
import { SmartApplianceControl } from '../components/recipes/SmartApplianceControl';

// In cooking mode:
<SmartApplianceControl
  applianceType="oven"
  recipeId={recipe.id}
/>
```

## 🐛 Troubleshooting

### Componenten worden niet getoond
- Controleer of de imports correct zijn
- Controleer of de componenten zijn geëxporteerd
- Check browser console voor errors

### Database functies werken niet
- Verifieer dat migratie 93 is uitgevoerd (zie Stap 1)
- Check Supabase logs voor errors
- Test functies direct in SQL Editor

### WebSocket verbinding faalt
- Controleer of Edge Function is gedeployed (zie Stap 2)
- Check WebSocket URL in timerSync.ts (zie Stap 3)
- Fallback naar polling zou moeten werken

## 📝 Volgende Stap

Als alles werkt, ga door naar **Stap 5: Performance Optimalisatie**


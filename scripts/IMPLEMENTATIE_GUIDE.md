# Baanbrekende Features - Stap-voor-Stap Implementatie Guide

## 📋 Overzicht

Deze guide helpt je stap voor stap door de implementatie van alle nieuwe features. Volg de stappen in volgorde.

---

## ✅ Stap 1: Verifieer Database Functies

**Bestand**: `scripts/STAP_1_VERIFICEER_DATABASE.md`

1. Open Supabase Dashboard → SQL Editor
2. Voer het verificatie SQL script uit (zie STAP_1_VERIFICEER_DATABASE.md)
3. Controleer of alle 8 functies en 6 tabellen bestaan

**Verwachte Resultaten**:
- ✅ 8 functies gevonden
- ✅ 6 tabellen gevonden
- ✅ Geen errors

**Als er functies ontbreken**: 
- Controleer of migratie 93 volledig is uitgevoerd
- Check Supabase logs voor errors
- Voer migratie opnieuw uit indien nodig

---

## ✅ Stap 2: Deploy Edge Function

**Bestand**: `scripts/STAP_2_DEPLOY_EDGE_FUNCTION.md`

**Opmerking**: Supabase Edge Functions ondersteunen geen native WebSockets. De timer sync gebruikt daarom:
- **Primair**: Supabase Realtime subscriptions (via database)
- **Fallback**: Polling mechanisme (elke 5 seconden)

De Edge Function is optioneel en kan worden gebruikt voor andere doeleinden.

**Als je de Edge Function toch wilt deployen**:

```bash
supabase functions deploy timer-sync
```

**Test**:
```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/timer-sync \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## ✅ Stap 3: Configureer Timer Sync Service

**Bestand**: `scripts/STAP_3_CONFIGUREER_SERVICE.md`

De timer sync service is al geconfigureerd om polling te gebruiken. Geen extra configuratie nodig!

**Huidige Implementatie**:
- ✅ Polling elke 5 seconden
- ✅ Automatische sync tussen apparaten
- ✅ Geen WebSocket server nodig

**Optioneel**: Als je later een dedicated WebSocket server wilt toevoegen, zie `services/timerSync.ts` voor instructies.

---

## ✅ Stap 4: Test Componenten

**Bestand**: `scripts/STAP_4_TEST_COMPONENTEN.md`

Test alle componenten in de app:

### Quick Test Checklist:

1. **Smart Purchase Advisor**
   - [ ] Component laadt zonder errors
   - [ ] Prijsvoorspelling wordt getoond
   - [ ] Aanbevelingen worden gegeven

2. **Recipe Health Impact**
   - [ ] Component laadt zonder errors
   - [ ] Grafieken worden gerenderd
   - [ ] Portiegrootte kan worden aangepast

3. **Adaptive Recipe View**
   - [ ] Ingrediënten worden geanalyseerd
   - [ ] Vervangingen worden voorgesteld
   - [ ] Swaps kunnen worden geaccepteerd/verworpen

4. **Vision Stock Verification**
   - [ ] Camera permissies worden gevraagd
   - [ ] Camera interface wordt getoond
   - [ ] Scan functionaliteit werkt

5. **Synced Cooking Timer**
   - [ ] Timer kan worden gestart
   - [ ] Timer wordt gesynchroniseerd (test op 2 apparaten/tabs)
   - [ ] Updates worden getoond

6. **Smart Appliance Control**
   - [ ] Component laadt zonder errors
   - [ ] Web Serial API wordt gedetecteerd (Chrome/Edge desktop)
   - [ ] Apparaat kan worden verbonden (als beschikbaar)

---

## ✅ Stap 5: Performance Optimalisatie

**Bestand**: `scripts/STAP_5_PERFORMANCE.md`

Optionele optimalisaties voor betere performance:

1. **ML Model Caching** - Cache getrainde modellen
2. **Image Compression** - Optimaliseer camera foto's
3. **Lazy Loading** - Load componenten on-demand
4. **Database Indexes** - Verifieer indexes (al aanwezig in migratie)

---

## 🚀 Integratie in Bestaande App

### Voorbeeld: Recept Detail Pagina

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
  <Modal visible={showHealthImpact} onRequestClose={() => setShowHealthImpact(false)}>
    <RecipeHealthImpact
      recipeId={recipe.id}
      servings={recipe.servings || 1}
      onClose={() => setShowHealthImpact(false)}
    />
  </Modal>
)}

{showTimer && (
  <Modal visible={showTimer} onRequestClose={() => setShowTimer(false)}>
    <SyncedCookingTimer
      timerName={`${recipe.title} - Oven`}
      durationSeconds={recipe.cook_time_minutes * 60}
      recipeId={recipe.id}
      onComplete={() => setShowTimer(false)}
      onDismiss={() => setShowTimer(false)}
    />
  </Modal>
)}

<AdaptiveRecipeView
  recipe={recipe}
  userInventory={inventory}
/>
```

### Voorbeeld: Product/Scan Pagina

```tsx
// app/scan.tsx of product detail
import { SmartPurchaseAdvisor } from '../components/shopping/SmartPurchaseAdvisor';

{product && (
  <Modal visible={showAdvisor} onRequestClose={() => setShowAdvisor(false)}>
    <SmartPurchaseAdvisor
      productId={product.id}
      productName={product.product_name}
      currentPrice={product.price}
      onDismiss={() => setShowAdvisor(false)}
    />
  </Modal>
)}
```

---

## 🐛 Troubleshooting

### Database functies werken niet
- ✅ Verifieer migratie 93 is uitgevoerd (Stap 1)
- ✅ Check Supabase logs voor errors
- ✅ Test functies direct in SQL Editor

### Componenten worden niet getoond
- ✅ Controleer imports
- ✅ Check browser console voor errors
- ✅ Verifieer dat dependencies zijn geïnstalleerd: `npm install`

### Timer sync werkt niet
- ✅ Check of gebruiker is ingelogd
- ✅ Verifieer database connectie
- ✅ Check browser console voor errors
- ✅ Test op 2 verschillende tabs/apparaten

### ML model training faalt
- ✅ Check of TensorFlow.js is geïnstalleerd
- ✅ Verifieer dat er voldoende prijsdata is (minimaal 7 datapunten)
- ✅ Check browser console voor errors

---

## 📝 Volgende Stappen (Optioneel)

Na basis implementatie kun je:

1. **ML Models Trainen**: Train en deploy pre-trained models
2. **Vision Detection**: Train custom object detection model
3. **WebSocket Server**: Set up dedicated WebSocket server voor real-time sync
4. **Testing**: Voeg unit/integration tests toe
5. **Monitoring**: Set up error tracking en performance monitoring

---

## ✅ Voltooiing

Als alle stappen zijn voltooid:

- ✅ Database functies geverifieerd
- ✅ Componenten getest
- ✅ Integratie voltooid
- ✅ Performance geoptimaliseerd (optioneel)

**Je bent klaar!** 🎉

Alle baanbrekende features zijn nu volledig geïmplementeerd en klaar voor gebruik.


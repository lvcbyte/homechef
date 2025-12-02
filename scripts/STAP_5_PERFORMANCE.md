# Stap 5: Performance Optimalisatie

## ✅ Aanbevolen Optimalisaties

### 1. ML Model Caching

**Bestand**: `services/ml/pricePredictor.ts`

Voeg model caching toe om training te vermijden bij elke pagina load:

```typescript
// In pricePredictor.ts, voeg toe:
private modelCache: { [key: string]: tf.Sequential } = {};

async loadModel(cacheKey: string = 'default'): Promise<void> {
  if (this.modelCache[cacheKey]) {
    this.model = this.modelCache[cacheKey];
    this.isLoaded = true;
    return;
  }
  
  // ... existing load logic ...
  
  // Cache the model
  this.modelCache[cacheKey] = this.model!;
}
```

### 2. Image Compression

**Bestand**: `components/inventory/VisionStockVerification.tsx`

Optimaliseer image compression:

```typescript
const photo = await cameraRef.current.takePictureAsync({
  quality: 0.6, // Verlaag van 0.8 naar 0.6 voor snellere verwerking
  base64: Platform.OS === 'web',
  skipProcessing: true, // Skip extra processing voor snelheid
});
```

### 3. WebSocket Reconnection

**Bestand**: `services/timerSync.ts`

De reconnection logica is al geïmplementeerd, maar je kunt de delays aanpassen:

```typescript
reconnectionAttempts: this.maxReconnectAttempts,
reconnectionDelay: 1000, // Verhoog naar 2000 voor minder agressieve reconnecties
reconnectionDelayMax: 10000, // Max delay tussen reconnecties
```

### 4. Database Query Optimalisatie

Zorg dat indexes zijn aangemaakt (zijn al in migratie 93):

```sql
-- Check indexes
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'price_history',
    'ingredient_substitutions',
    'cooking_timers'
);
```

### 5. Component Lazy Loading

Voor betere initial load performance, gebruik lazy loading:

```tsx
// In je route component:
const SmartPurchaseAdvisor = lazy(() => import('../components/shopping/SmartPurchaseAdvisor'));
const RecipeHealthImpact = lazy(() => import('../components/recipes/RecipeHealthImpact'));

// Wrap in Suspense:
<Suspense fallback={<ActivityIndicator />}>
  <SmartPurchaseAdvisor {...props} />
</Suspense>
```

## 📊 Monitoring

### Check Performance

1. **Browser DevTools**:
   - Network tab: Check load times
   - Performance tab: Check render times
   - Memory tab: Check memory usage

2. **Supabase Dashboard**:
   - Database → Performance: Check query times
   - Edge Functions → Logs: Check function execution times

3. **React DevTools**:
   - Profiler: Check component render times
   - Components: Check re-renders

## ✅ Voltooiing

Als alle stappen zijn voltooid:

1. ✅ Database functies geverifieerd
2. ✅ Edge Function gedeployed
3. ✅ Timer Sync service geconfigureerd
4. ✅ Componenten getest
5. ✅ Performance geoptimaliseerd

**Je bent klaar!** 🎉

Alle baanbrekende features zijn nu volledig geïmplementeerd en getest.


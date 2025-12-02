# Cursor Prompt: Implementeer Slimme Gebruiksprioriteit (Eet-Mij-Eerst-Index)

## Context

Je gaat de **Slimme Gebruiksprioriteit** feature implementeren voor StockPit. Dit is een intelligent sorting systeem dat de voorraad sorteert op basis van een samengestelde score (Eet-Mij-Eerst-Index) in plaats van alleen vervaldatum. Het doel is voedselverspilling te minimaliseren door items met korte houdbaarheid én die matchen met recepten bovenaan te tonen.

## Belangrijke Richtlijnen

⚠️ **KRITIEK:**
- **VERWIJDER NIETS** uit de bestaande codebase
- **PAS ZORGVULDIG AAN** - behoud alle bestaande functionaliteit
- **ANALYSEER EERST** de huidige implementatie voordat je wijzigingen maakt
- **TEST** alle wijzigingen grondig
- **MOBILE FIRST** - alle UI moet perfect werken op mobiel
- **STOCKPIT BRANDING** - gebruik de bestaande kleuren en styling (`#047857` teal, moderne UI)

## Taak 1: Analyseer Huidige Implementatie

### Stap 1.1: Inventory Sorting
Analyseer hoe de inventory momenteel wordt gesorteerd:
- Bekijk `app/inventory.tsx` regel 280-304 (`fetchInventory`)
- Bekijk regel 755-757 (`expiryOrdered` useMemo)
- Identificeer alle plaatsen waar inventory wordt gesorteerd

### Stap 1.2: Houdbaarheidsdatum Berekening
Analyseer hoe houdbaarheidsdatums worden berekend:
- Bekijk `supabase/migrations/07_expiry_estimation.sql` (functie `estimate_expiry_date`)
- Bekijk `app/scan.tsx` regel 577-609 (`handleAddProductToInventory`)
- Bekijk `app/inventory.tsx` regel 391-422 (`insertDetectedShelfItems`)
- Bekijk `components/inventory/VoiceInput.tsx` regel 296-310
- Bekijk `components/inventory/ReceiptOCR.tsx` regel 296-307

### Stap 1.3: Recept Matching
Analyseer hoe recepten worden gematcht met inventory:
- Bekijk `supabase/migrations/19_recipes_system.sql` (functie `match_recipes_with_inventory`)
- Identificeer alle SQL functies die recepten matchen met inventory items
- Begrijp de matching logica (exact, partial, word-based)

## Taak 2: Implementeer Database Functie

### Stap 2.1: Maak SQL Migratie
Maak een nieuwe migratie file: `supabase/migrations/96_smart_usage_priority.sql`

Implementeer:
1. **Functie `get_inventory_recipe_match_count`**:
   - Accepteert `p_inventory_item_id uuid` en `p_user_id uuid`
   - Retourneert `integer` (aantal recepten die dit item gebruiken)
   - Gebruik dezelfde matching logica als `match_recipes_with_inventory`:
     - Exact match op ingredient naam
     - Partial match (contains)
     - Word-based matching (split op spaties)
   - Filter alleen op actieve, niet-vervallen inventory items
   - Gebruik `STABLE` functie voor performance

2. **Verbeter `estimate_expiry_date` functie**:
   - Voeg optionele parameters toe: `product_name text DEFAULT NULL`, `purchase_date timestamptz DEFAULT NULL`
   - Verbeter logica met product-specifieke regels:
     - Gerookt/gedroogd vlees: 5 dagen (i.p.v. 2)
     - Kaas: 14 dagen (i.p.v. 5)
     - Yoghurt: 7 dagen
     - Harde groenten/fruit (appel, wortel, ui): 14 dagen
   - Gebruik `purchase_date` als beschikbaar, anders `base_date`

3. **Grant permissions**:
   - `GRANT EXECUTE ON FUNCTION ... TO authenticated`
   - `GRANT EXECUTE ON FUNCTION ... TO anon`

### Stap 2.2: Test SQL Functies
Test de functies in Supabase SQL editor:
```sql
-- Test recipe match count
SELECT get_inventory_recipe_match_count('inventory-item-id', 'user-id');

-- Test improved expiry estimation
SELECT estimate_expiry_date('dairy_eggs', now(), 'Goudse kaas', now());
SELECT estimate_expiry_date('proteins', now(), 'Gerookte ham', now());
```

## Taak 3: Implementeer Client-Side Sorting

### Stap 3.1: Maak Utility Functies
In `app/inventory.tsx`, voeg toe na regel 740 (na `daysUntil` functie):

```typescript
// Normaliseer dagen tot vervaldatum naar 0-100 schaal (inverse: lager = hogere prioriteit)
const normalizeExpiryDays = (days: number): number => {
  if (days <= 0) return 0; // Vandaag of vervallen = hoogste prioriteit
  if (days <= 3) return 10; // Binnen 3 dagen = zeer urgent
  if (days <= 7) return 30; // Binnen week = urgent
  if (days <= 14) return 50; // Binnen 2 weken = aandacht
  if (days <= 30) return 70; // Binnen maand = normaal
  return 100; // >30 dagen = lage prioriteit
};

// Normaliseer recept matches naar 0-100 schaal (inverse)
const normalizeRecipeMatches = (matches: number): number => {
  if (matches === 0) return 100; // Geen matches = lage prioriteit
  if (matches >= 5) return 0; // 5+ matches = hoogste prioriteit
  return 100 - (matches * 20); // Lineair tussen 0-4 matches
};

// Normaliseer voorraad niveau naar 0-100 schaal (inverse)
const normalizeStockLevel = (quantity: string | null): number => {
  if (!quantity) return 50; // Onbekend = gemiddeld
  const qty = quantity.toLowerCase();
  const numMatch = qty.match(/(\d+)/);
  if (!numMatch) return 50;
  const num = parseInt(numMatch[1], 10);
  if (num <= 1) return 0; // Zeer laag = hoge prioriteit
  if (num <= 2) return 20; // Laag
  if (num <= 5) return 50; // Gemiddeld
  return 100; // Hoog = lage prioriteit
};

// Bereken Eet-Mij-Eerst-Index
// Lagere index = hogere prioriteit (moet eerst gebruikt worden)
const calculateEatMeFirstIndex = (
  daysUntilExpiry: number,
  recipeMatches: number,
  quantity: string | null
): number => {
  const expiryScore = normalizeExpiryDays(daysUntilExpiry);
  const recipeScore = normalizeRecipeMatches(recipeMatches);
  const stockScore = normalizeStockLevel(quantity);
  
  return (0.5 * expiryScore) + (0.3 * recipeScore) + (0.2 * stockScore);
};
```

### Stap 3.2: Update Inventory Type
Voeg `recipe_match_count` toe aan `InventoryRecord` type (in `types/app.ts`):
```typescript
recipe_match_count?: number;
eat_me_first_index?: number; // Optioneel: cache de berekende index
```

### Stap 3.3: Update fetchInventory
Wijzig `fetchInventory` functie (regel 280-304) om recipe matches te fetchen:

```typescript
const fetchInventory = async () => {
  if (!user) return;
  setLoadingInventory(true);
  
  // Fetch inventory
  const { data } = await supabase
    .from('inventory')
    .select(`
      *,
      catalog:product_catalog!catalog_product_id (
        nutrition,
        metadata
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (!data) {
    setInventory([]);
    setLoadingInventory(false);
    return;
  }
  
  // Fetch recipe matches voor alle items (parallel voor performance)
  const itemsWithMatches = await Promise.all(
    data.map(async (item: any) => {
      try {
        const { data: matchCount, error } = await supabase.rpc('get_inventory_recipe_match_count', {
          p_inventory_item_id: item.id,
          p_user_id: user.id,
        });
        
        if (error) {
          console.error('Error fetching recipe matches:', error);
          return {
            ...item,
            catalog_nutrition: item.catalog?.nutrition,
            catalog_metadata: item.catalog?.metadata,
            recipe_match_count: 0,
          };
        }
        
        return {
          ...item,
          catalog_nutrition: item.catalog?.nutrition,
          catalog_metadata: item.catalog?.metadata,
          recipe_match_count: matchCount || 0,
        };
      } catch (error) {
        console.error('Error in recipe match fetch:', error);
        return {
          ...item,
          catalog_nutrition: item.catalog?.nutrition,
          catalog_metadata: item.catalog?.metadata,
          recipe_match_count: 0,
        };
      }
    })
  );
  
  setInventory(itemsWithMatches as InventoryRecord[]);
  setLoadingInventory(false);
};
```

### Stap 3.4: Maak Smart Sorted Inventory
Voeg nieuwe `useMemo` toe na regel 767 (na `usablePercentage`):

```typescript
// Smart sorted inventory op basis van Eet-Mij-Eerst-Index
const smartSortedInventory = useMemo(() => {
  return [...inventory].map(item => {
    const days = daysUntil(item.expires_at);
    const matches = (item as any).recipe_match_count || 0;
    const index = calculateEatMeFirstIndex(days, matches, item.quantity_approx);
    
    return {
      ...item,
      eat_me_first_index: index,
    };
  }).sort((a, b) => {
    const indexA = (a as any).eat_me_first_index || 999;
    const indexB = (b as any).eat_me_first_index || 999;
    return indexA - indexB; // Sorteer op laagste index eerst (hoogste prioriteit)
  });
}, [inventory]);
```

### Stap 3.5: Update View Mode
Voeg nieuwe view mode toe aan `viewModeOptions` (regel 29-33):
```typescript
const viewModeOptions = [
  { id: 'items', label: 'Items' },
  { id: 'categories', label: 'Categorieën' },
  { id: 'expiry', label: 'Vervaldatum' },
  { id: 'eat_me_first', label: 'Eet-Mij-Eerst' }, // NIEUW
];
```

Update `viewMode` type (regel 204):
```typescript
const [viewMode, setViewMode] = useState<'items' | 'categories' | 'expiry' | 'eat_me_first'>('items');
```

### Stap 3.6: Implementeer Eet-Mij-Eerst View
Voeg nieuwe view sectie toe na regel 1218 (na `viewMode === 'expiry'`):

```typescript
{viewMode === 'eat_me_first' && (
  <View style={styles.inventoryList}>
    {smartSortedInventory.map((item) => {
      const expiresIn = daysUntil(item.expires_at);
      const matches = (item as any).recipe_match_count || 0;
      const index = (item as any).eat_me_first_index || 999;
      
      // Bepaal prioriteit kleur
      const getPriorityColor = (idx: number) => {
        if (idx <= 20) return '#ef4444'; // Rood: zeer urgent
        if (idx <= 40) return '#f97316'; // Oranje: urgent
        if (idx <= 60) return '#fbbf24'; // Geel: aandacht
        return '#4ade80'; // Groen: normaal
      };
      
      return (
        <View key={`${item.id}-eat-me-first`} style={styles.inventoryCard}>
          <View style={styles.inventoryCardContent}>
            {/* Product Image */}
            <View style={styles.imageContainer}>
              {item.catalog_image_url ? (
                <Image
                  source={{ uri: item.catalog_image_url }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Ionicons name="cube-outline" size={24} color="#94a3b8" />
                </View>
              )}
            </View>

            {/* Product Info */}
            <View style={styles.itemInfo}>
              <View style={styles.inventoryTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{getCategoryLabel(item.category)}</Text>
                </View>
                {/* Priority Badge */}
                {index <= 30 && (
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(index) }]}>
                    <Ionicons name="alert-circle" size={14} color="#fff" />
                    <Text style={styles.priorityBadgeText}>Eet eerst</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setEditingItem(item);
                    setEditQuantity(item.quantity_approx || '');
                    setEditExpiry(item.expires_at ? new Date(item.expires_at) : null);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color="#047857" />
                </TouchableOpacity>
              </View>

              {/* Priority Score */}
              <View style={styles.priorityScoreRow}>
                <View style={styles.priorityScoreItem}>
                  <Text style={styles.priorityScoreLabel}>Prioriteit</Text>
                  <Text style={[styles.priorityScoreValue, { color: getPriorityColor(index) }]}>
                    {Math.round(index)}/100
                  </Text>
                </View>
                {matches > 0 && (
                  <View style={styles.priorityScoreItem}>
                    <Ionicons name="restaurant" size={14} color="#047857" />
                    <Text style={styles.priorityScoreText}>{matches} recept{matches !== 1 ? 'en' : ''}</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemStatsRow}>
                <View style={styles.itemStat}>
                  <Text style={styles.itemStatLabel}>HOEVEELHEID</Text>
                  <Text style={styles.itemStatValue}>{item.quantity_approx ?? '-'}</Text>
                </View>
                <View style={styles.itemStat}>
                  <Text style={styles.itemStatLabel}>HOUDBAAR</Text>
                  <Text style={[styles.itemStatValue, { color: getExpiryColor(expiresIn) }]}>
                    {isFinite(expiresIn) ? `${expiresIn} dagen` : 'Onbekend'}
                  </Text>
                  <Text style={styles.itemStatHelper}>{getExpiryLabel(expiresIn)}</Text>
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.markUsed}
            onPress={async () => {
              // ... bestaande markUsed logica
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#047857" />
          </TouchableOpacity>
        </View>
      );
    })}
  </View>
)}
```

### Stap 3.7: Voeg Styles Toe
Voeg nieuwe styles toe aan `styles` object (einde van file):

```typescript
priorityBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  marginRight: 8,
},
priorityBadgeText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: '700',
  textTransform: 'uppercase',
},
priorityScoreRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
  paddingVertical: 8,
  paddingHorizontal: 12,
  backgroundColor: '#f8fafc',
  borderRadius: 12,
},
priorityScoreItem: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
priorityScoreLabel: {
  fontSize: 11,
  color: '#64748b',
  textTransform: 'uppercase',
  fontWeight: '600',
  marginRight: 4,
},
priorityScoreValue: {
  fontSize: 16,
  fontWeight: '800',
},
priorityScoreText: {
  fontSize: 13,
  color: '#047857',
  fontWeight: '600',
},
```

## Taak 4: Verbeter Houdbaarheidsdatum Berekening

### Stap 4.1: Update Scan Screen
In `app/scan.tsx`, update `handleAddProductToInventory` (regel 577-609):

```typescript
if (isOnline) {
  // Verbeterde expiry schatting met product naam
  const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
    category_slug: scannedProduct.category || 'pantry',
    product_name: scannedProduct.product_name || null,
    purchase_date: new Date().toISOString(),
  });
  
  if (expiryError) {
    console.error('Error estimating expiry:', expiryError);
    // Fallback naar basis schatting
    const { data: fallbackData } = await supabase.rpc('estimate_expiry_date', {
      category_slug: scannedProduct.category || 'pantry',
    });
    expires = fallbackData || null;
  } else {
    expires = expiryData || null;
  }
}
```

### Stap 4.2: Update Inventory Screen
In `app/inventory.tsx`, update `insertDetectedShelfItems` (regel 391-422):

```typescript
const expiresAt = item.daysUntilExpiry
  ? new Date(Date.now() + item.daysUntilExpiry * 24 * 60 * 60 * 1000).toISOString()
  : null;

// Als we online zijn, gebruik verbeterde schatting
if (!expiresAt && isOnline) {
  try {
    const { data: expiryData } = await supabase.rpc('estimate_expiry_date', {
      category_slug: suggestion?.category ?? 'pantry',
      product_name: item.name || null,
    });
    expiresAt = expiryData || null;
  } catch (error) {
    console.error('Error estimating expiry:', error);
  }
}
```

### Stap 4.3: Update VoiceInput
In `components/inventory/VoiceInput.tsx`, update regel 296-310:

```typescript
// Re-estimate expiry if category changed (met product naam)
let expiresAt = item.expires_at;
if (item.category) {
  try {
    const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
      category_slug: item.category,
      product_name: item.name || null,
    });
    if (!expiryError && expiryData) {
      expiresAt = expiryData;
    }
  } catch (expiryErr) {
    console.warn('Error estimating expiry date:', expiryErr);
  }
}
```

### Stap 4.4: Update ReceiptOCR
In `components/inventory/ReceiptOCR.tsx`, update regel 296-307:

```typescript
const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
  category_slug: item.category || 'pantry',
  product_name: item.name || null,
});

if (expiryError) {
  console.error('Error estimating expiry:', expiryError);
}
```

## Taak 5: Update Section Header

Update `inventoryHeaderRow` (regel 1011-1026) om nieuwe view mode te ondersteunen:

```typescript
<View style={styles.inventoryHeaderRow}>
  <Text style={styles.sectionTitle}>
    {viewMode === 'items'
      ? 'Voorraad per item'
      : viewMode === 'categories'
      ? 'Voorraad per categorie'
      : viewMode === 'expiry'
      ? 'Binnenkort vervallen'
      : 'Eet-Mij-Eerst Prioriteit'}
  </Text>
  <Text style={styles.sectionSub}>
    {viewMode === 'items'
      ? 'Live score en houdbaarheid'
      : viewMode === 'categories'
      ? 'Geclusterd per STOCKPIT lane'
      : viewMode === 'expiry'
      ? 'Sortering op dichtstbijzijnde houdbaarheid'
      : 'Intelligente sortering op basis van vervaldatum, recept matches en voorraad'}
  </Text>
</View>
```

## Taak 6: Testing & Validatie

### Test Checklist:
1. ✅ SQL functie `get_inventory_recipe_match_count` werkt
2. ✅ Verbeterde `estimate_expiry_date` werkt met product naam
3. ✅ Smart sorting sorteert correct (laagste index eerst)
4. ✅ Eet-Mij-Eerst view toont correcte prioriteit scores
5. ✅ Houdbaarheidsdatum wordt beter berekend in scan/inventory/voice/receipt
6. ✅ Offline mode werkt met fallback logica
7. ✅ Performance is acceptabel (<1s voor 100 items)
8. ✅ UI is mobile-first en responsive
9. ✅ Edge cases werken: geen datum, geen matches, lege voorraad
10. ✅ Bestaande functionaliteit blijft werken

### Performance Optimalisaties:
- Overweeg caching van recipe matches (5 minuten)
- Batch queries waar mogelijk
- Lazy loading voor grote inventories

## Belangrijke Notities

1. **Geen Breaking Changes**: Alle bestaande functionaliteit moet blijven werken
2. **Backward Compatible**: Oude inventory items zonder `recipe_match_count` moeten werken (default 0)
3. **Error Handling**: Alle database calls moeten error handling hebben
4. **Mobile First**: Alle UI moet perfect werken op kleine schermen
5. **StockPit Branding**: Gebruik bestaande kleuren en styling

## Volgorde van Implementatie

1. **Eerst**: Maak SQL migratie en test functies
2. **Dan**: Implementeer client-side sorting utilities
3. **Dan**: Update fetchInventory met recipe matches
4. **Dan**: Voeg Eet-Mij-Eerst view mode toe
5. **Dan**: Verbeter houdbaarheidsdatum berekening
6. **Laatste**: Test alles grondig

## Vragen?

Als je onduidelijkheden hebt:
- Bekijk eerst de bestaande code
- Test in kleine stappen
- Behoud bestaande functionaliteit
- Documenteer wijzigingen

**Succes met de implementatie! 🚀**


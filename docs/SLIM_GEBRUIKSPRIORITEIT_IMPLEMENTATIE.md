# Slimme Gebruiksprioriteit - Eet-Mij-Eerst-Index Implementatie

## Overzicht

Dit document beschrijft de implementatie van het **Slimme Gebruiksprioriteit** systeem voor StockPit. Dit systeem sorteert de voorraad niet alleen op vervaldatum, maar op een intelligente samengestelde score die meerdere factoren meeweegt om voedselverspilling te minimaliseren.

## Concept: Eet-Mij-Eerst-Index

De **Eet-Mij-Eerst-Index** is een samengestelde score die bepaalt welke producten prioriteit moeten krijgen:

```
Eet-Mij-Eerst-Index = (0.5 × Dagen tot Vervaldatum) + (0.3 × Aantal Recept Matches) + (0.2 × Lage Voorraad Threshold)
```

### Componenten:

1. **Dagen tot Vervaldatum (50% gewicht)**
   - Items met korte houdbaarheid krijgen hogere prioriteit
   - Genormaliseerd op schaal 0-100 (0 = vandaag vervallen, 100 = >30 dagen)

2. **Aantal Recept Matches (30% gewicht)**
   - Items die in geplande of beschikbare recepten voorkomen krijgen hogere prioriteit
   - Genormaliseerd op schaal 0-100 (0 = geen matches, 100 = 5+ matches)

3. **Lage Voorraad Threshold (20% gewicht)**
   - Items met lage voorraad (bijv. <2 stuks) krijgen hogere prioriteit
   - Genormaliseerd op schaal 0-100

**Lagere index = hogere prioriteit** (moet eerst gebruikt worden)

---

## Implementatie Stappen

### Stap 1: Database Functie - Recept Matches per Inventory Item

Maak een SQL functie die voor elk inventory item het aantal recept matches berekent:

```sql
-- Functie om aantal recept matches per inventory item te berekenen
CREATE OR REPLACE FUNCTION public.get_inventory_recipe_match_count(
    p_inventory_item_id uuid,
    p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_item_name text;
    v_match_count integer := 0;
BEGIN
    -- Haal item naam op
    SELECT name INTO v_item_name
    FROM public.inventory
    WHERE id = p_inventory_item_id AND user_id = p_user_id;
    
    IF v_item_name IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Tel aantal recepten die dit item gebruiken
    SELECT COUNT(DISTINCT r.id) INTO v_match_count
    FROM public.recipes r
    WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(r.ingredients) AS ing
        WHERE 
            -- Exact match
            lower(trim(ing->>'name')) = lower(trim(v_item_name))
            -- Partial match (contains)
            OR lower(trim(ing->>'name')) LIKE '%' || lower(trim(v_item_name)) || '%'
            OR lower(trim(v_item_name)) LIKE '%' || lower(trim(ing->>'name')) || '%'
            -- Word-based matching
            OR EXISTS (
                SELECT 1
                FROM unnest(string_to_array(lower(trim(ing->>'name')), ' ')) AS ing_word
                CROSS JOIN unnest(string_to_array(lower(trim(v_item_name)), ' ')) AS inv_word
                WHERE length(ing_word) >= 3 AND length(inv_word) >= 3
                AND (ing_word = inv_word OR ing_word LIKE '%' || inv_word || '%' OR inv_word LIKE '%' || ing_word || '%')
            )
    );
    
    RETURN COALESCE(v_match_count, 0);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO anon;
```

### Stap 2: Client-Side Sorting Algoritme

Implementeer in `app/inventory.tsx` een `useMemo` hook die de inventory sorteert op basis van de Eet-Mij-Eerst-Index:

```typescript
// Utility functie om dagen tot vervaldatum te berekenen
const daysUntil = (date: string | null): number => {
  if (!date) return 999; // Geen datum = lage prioriteit
  const diff = Math.ceil(
    (new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff < 0 ? 0 : diff; // Negatief = al vervallen
};

// Normaliseer waarde naar 0-100 schaal (inverse: lager = hogere prioriteit)
const normalizeExpiryDays = (days: number): number => {
  if (days <= 0) return 0; // Vandaag of vervallen
  if (days <= 3) return 10; // Binnen 3 dagen
  if (days <= 7) return 30; // Binnen week
  if (days <= 14) return 50; // Binnen 2 weken
  if (days <= 30) return 70; // Binnen maand
  return 100; // >30 dagen
};

// Normaliseer recept matches (0-100, inverse)
const normalizeRecipeMatches = (matches: number): number => {
  if (matches === 0) return 100; // Geen matches = lage prioriteit
  if (matches >= 5) return 0; // 5+ matches = hoge prioriteit
  return 100 - (matches * 20); // Lineair tussen 0-4 matches
};

// Normaliseer voorraad niveau (0-100, inverse)
const normalizeStockLevel = (quantity: string | null): number => {
  if (!quantity) return 50; // Onbekend = gemiddeld
  const qty = quantity.toLowerCase();
  // Extract number from quantity string
  const numMatch = qty.match(/(\d+)/);
  if (!numMatch) return 50;
  const num = parseInt(numMatch[1], 10);
  if (num <= 1) return 0; // Zeer laag = hoge prioriteit
  if (num <= 2) return 20; // Laag
  if (num <= 5) return 50; // Gemiddeld
  return 100; // Hoog = lage prioriteit
};

// Bereken Eet-Mij-Eerst-Index
const calculateEatMeFirstIndex = (
  daysUntilExpiry: number,
  recipeMatches: number,
  quantity: string | null
): number => {
  const expiryScore = normalizeExpiryDays(daysUntilExpiry);
  const recipeScore = normalizeRecipeMatches(recipeMatches);
  const stockScore = normalizeStockLevel(quantity);
  
  // Lagere index = hogere prioriteit
  return (0.5 * expiryScore) + (0.3 * recipeScore) + (0.2 * stockScore);
};

// Sorteer inventory op Eet-Mij-Eerst-Index
const smartSortedInventory = useMemo(() => {
  // Fetch recipe matches voor alle items (kan geoptimaliseerd worden met batch query)
  // Voor nu: bereken per item
  return [...inventory].map(item => ({
    ...item,
    daysUntilExpiry: daysUntil(item.expires_at),
    // TODO: Fetch recipe matches from database
    recipeMatches: 0, // Placeholder - moet geïmplementeerd worden
  })).sort((a, b) => {
    const indexA = calculateEatMeFirstIndex(
      a.daysUntilExpiry,
      a.recipeMatches,
      a.quantity_approx
    );
    const indexB = calculateEatMeFirstIndex(
      b.daysUntilExpiry,
      b.recipeMatches,
      b.quantity_approx
    );
    return indexA - indexB; // Sorteer op laagste index eerst
  });
}, [inventory]);
```

### Stap 3: Verbeter Houdbaarheidsdatum Berekening

Verbeter de `estimate_expiry_date` functie en de logica in `/scan` en `/inventory`:

#### 3.1 Verbeter SQL Functie

```sql
-- Verbeterde estimate_expiry_date met meer context
CREATE OR REPLACE FUNCTION public.estimate_expiry_date(
    category_slug text,
    base_date timestamptz DEFAULT timezone('utc', now()),
    product_name text DEFAULT NULL,
    purchase_date timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    days_to_add integer;
    actual_base_date timestamptz;
BEGIN
    -- Gebruik purchase_date als beschikbaar, anders base_date
    actual_base_date := COALESCE(purchase_date, base_date);
    
    -- FAVV/HACCP norms + product-specifieke logica
    CASE category_slug
        -- Highly perishable (1-3 days)
        WHEN 'proteins' THEN 
            -- Check if it's processed meat (longer shelf life)
            IF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%gerookt%' OR 
                lower(product_name) LIKE '%gedroogd%' OR
                lower(product_name) LIKE '%worst%'
            ) THEN
                days_to_add := 5; -- Processed meats last longer
            ELSE
                days_to_add := 2; -- Fresh meat
            END IF;
        WHEN 'seafood' THEN days_to_add := 1;
        
        -- Perishable (3-7 days)
        WHEN 'dairy_eggs' THEN 
            IF product_name IS NOT NULL AND lower(product_name) LIKE '%kaas%' THEN
                days_to_add := 14; -- Cheese lasts longer
            ELSIF product_name IS NOT NULL AND lower(product_name) LIKE '%yoghurt%' THEN
                days_to_add := 7; -- Yogurt
            ELSE
                days_to_add := 5; -- Default dairy
            END IF;
        WHEN 'fresh_produce' THEN 
            IF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%appel%' OR
                lower(product_name) LIKE '%wortel%' OR
                lower(product_name) LIKE '%ui%'
            ) THEN
                days_to_add := 14; -- Hard vegetables/fruits
            ELSE
                days_to_add := 5; -- Soft produce
            END IF;
        WHEN 'ready_meals' THEN days_to_add := 2;
        
        -- Short shelf life (2-5 days)
        WHEN 'bakery' THEN days_to_add := 3;
        
        -- Long shelf life (weeks to months)
        WHEN 'pantry' THEN days_to_add := 90;
        WHEN 'spices_condiments' THEN days_to_add := 180;
        WHEN 'snacks' THEN days_to_add := 60;
        WHEN 'beverages' THEN days_to_add := 180;
        
        -- Very long shelf life
        WHEN 'frozen' THEN days_to_add := 180;
        WHEN 'baby' THEN days_to_add := 30;
        WHEN 'personal_care' THEN days_to_add := 365;
        WHEN 'household' THEN days_to_add := 365;
        
        -- Default: 7 days for unknown categories
        ELSE days_to_add := 7;
    END CASE;
    
    RETURN actual_base_date + (days_to_add || ' days')::interval;
END;
$$;
```

#### 3.2 Update Scan Screen

In `app/scan.tsx`, verbeter de `handleAddProductToInventory` functie:

```typescript
const handleAddProductToInventory = async () => {
  if (!user || !scannedProduct) return;
  
  try {
    const isOnline = syncManager.getStatus().isOnline;
    let expires: string | null = null;
    
    if (isOnline) {
      // Verbeterde expiry schatting met product naam
      const { data: expiryData, error: expiryError } = await supabase.rpc('estimate_expiry_date', {
        category_slug: scannedProduct.category || 'pantry',
        product_name: scannedProduct.product_name || null,
        purchase_date: new Date().toISOString(), // Aankoopdatum = nu
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
    } else {
      // Offline: gebruik categorie-gebaseerde schatting
      const categoryDays: Record<string, number> = {
        'proteins': 2,
        'seafood': 1,
        'dairy_eggs': 5,
        'fresh_produce': 5,
        'ready_meals': 2,
        'bakery': 3,
        'pantry': 90,
        'spices_condiments': 180,
        'snacks': 60,
        'beverages': 180,
        'frozen': 180,
      };
      const days = categoryDays[scannedProduct.category || 'pantry'] || 7;
      const fallbackDate = new Date();
      fallbackDate.setDate(fallbackDate.getDate() + days);
      expires = fallbackDate.toISOString();
    }
    
    // ... rest van de code
  } catch (error) {
    // Error handling
  }
};
```

### Stap 4: Batch Recipe Match Fetching

Voor performance, fetch alle recipe matches in één query:

```typescript
// In inventory.tsx, voeg toe aan fetchInventory:
const fetchInventoryWithRecipeMatches = async () => {
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
  
  // Fetch recipe matches voor alle items in batch
  const itemsWithMatches = await Promise.all(
    data.map(async (item: any) => {
      const { data: matchCount } = await supabase.rpc('get_inventory_recipe_match_count', {
        p_inventory_item_id: item.id,
        p_user_id: user.id,
      });
      
      return {
        ...item,
        catalog_nutrition: item.catalog?.nutrition,
        catalog_metadata: item.catalog?.metadata,
        recipe_match_count: matchCount || 0,
      };
    })
  );
  
  setInventory(itemsWithMatches as InventoryRecord[]);
  setLoadingInventory(false);
};
```

---

## UI/UX Verbeteringen

### Visuele Indicatoren

1. **Eet-Mij-Eerst Badge**: Toon een badge op items met hoge prioriteit (index < 30)
2. **Kleurcodering**: 
   - Rood: Index 0-20 (zeer urgent)
   - Oranje: Index 21-40 (urgent)
   - Geel: Index 41-60 (aandacht)
   - Groen: Index 61-100 (normaal)

3. **Tooltip/Info**: Toon de index score en componenten bij hover/long press

### Sorteer Opties

Voeg een nieuwe sorteer optie toe aan de view toggle:
- "Items" (huidige)
- "Categorieën" (huidige)
- "Vervaldatum" (huidige)
- **"Eet-Mij-Eerst"** (nieuw - gebruikt smart sorting)

---

## Performance Optimalisaties

1. **Caching**: Cache recipe matches voor X minuten
2. **Batch Queries**: Fetch alle matches in één query i.p.v. per item
3. **Indexing**: Zorg voor goede database indexes op `inventory.name` en `recipes.ingredients`
4. **Lazy Loading**: Bereken index alleen voor zichtbare items

---

## Testing Checklist

- [ ] SQL functie `get_inventory_recipe_match_count` werkt correct
- [ ] Sorting algoritme sorteert correct (laagste index eerst)
- [ ] Houdbaarheidsdatum berekening is accurater
- [ ] Offline mode werkt met fallback logica
- [ ] Performance is acceptabel (<500ms voor 100 items)
- [ ] UI toont correcte prioriteit indicatoren
- [ ] Edge cases: geen datum, geen matches, lege voorraad

---

## Branding & Theming

- Gebruik StockPit kleuren: `#047857` (teal) voor hoge prioriteit
- Mobile-first design
- Professionele, moderne UI
- Consistent met bestaande StockPit componenten

---

## Volgende Stappen

1. Implementeer SQL functie
2. Update client-side sorting
3. Verbeter expiry estimation
4. Voeg UI indicatoren toe
5. Test en optimaliseer
6. Documenteer voor gebruikers


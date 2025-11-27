# 🔧 Fix Migrations - Correcte Volgorde

## Probleem
De migrations hadden een volgordeprobleem:
1. Migration 15 probeerde data in te voegen voordat de table bestond
2. Migration 16 riep functies aan die nog niet bestonden

## Oplossing

### Stap 1: Run FIXED Migration 15

**Run dit bestand in Supabase SQL Editor:**
```
supabase/migrations/15_product_translations_FIXED.sql
```

Dit:
- ✅ Maakt de table aan VOORDAT data wordt ingevoegd
- ✅ Maakt alle translation functies aan
- ✅ Voegt 100+ vertalingen toe

### Stap 2: Run FIXED Migration 16

**Run dit bestand in Supabase SQL Editor:**
```
supabase/migrations/16_improve_match_with_translations_FIXED.sql
```

Dit:
- ✅ Checkt of translation functies bestaan
- ✅ Gebruikt ze alleen als ze bestaan
- ✅ Werkt ook zonder translations (fallback)

## Test

Na het runnen van beide migrations:

```sql
-- Test translation
SELECT public.translate_to_dutch('fromage');
-- Should return: 'kaas'

-- Test search
SELECT * FROM public.match_product_catalog('kaas') LIMIT 5;
-- Should find products with 'kaas', 'fromage', 'käse'
```

## Belangrijk

**Run de FIXED versies, niet de originele!**

- ✅ `15_product_translations_FIXED.sql`
- ✅ `16_improve_match_with_translations_FIXED.sql`

De originele versies hebben bugs en werken niet correct.


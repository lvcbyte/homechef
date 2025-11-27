# 🔧 Fix Instructions - Database Setup

## Probleem
Je ziet alleen Albert Heijn producten omdat:
1. De database constraint nieuwe sources blokkeert
2. De upsert functie de source field niet correct gebruikt

## Oplossing - Run deze SQL scripts in Supabase:

### Stap 1: Check huidige situatie
```bash
node scripts/check-database.js
```

### Stap 2: Run migrations in Supabase SQL Editor

**Migration 1: Voeg nieuwe sources toe**
```sql
-- Run: supabase/migrations/13_add_more_stores.sql
-- Dit voegt 'open-food-facts', 'carrefour', 'jumbo' toe aan allowed sources
```

**Migration 2: Fix upsert functie**
```sql
-- Run: supabase/migrations/14_fix_upsert_source.sql
-- Dit zorgt dat de source field correct wordt opgeslagen
```

### Stap 3: Test opnieuw
```bash
# Check database
node scripts/check-database.js

# Run Open Food Facts scraper (meeste producten)
node scripts/scrape-openfoodfacts.js
```

## Verwachte resultaten na fix:

- **Open Food Facts**: 10,000+ producten (met barcodes en foto's)
- **Lidl**: 500-1,000 producten
- **Colruyt**: 500-1,000 producten
- **Jumbo**: 500-1,000 producten
- **Carrefour**: 500-1,000 producten

**Totaal: 12,000-15,000 producten** 🎉

## Quick Fix Commands:

```bash
# 1. Check wat er nu in de database staat
node scripts/check-database.js

# 2. Run de migrations in Supabase SQL Editor (zie boven)

# 3. Run Open Food Facts (meeste producten)
node scripts/scrape-openfoodfacts.js

# 4. Check opnieuw
node scripts/check-database.js
```


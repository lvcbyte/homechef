# Store Catalog Import Guide

Import volledige product catalogi van Lidl, Colruyt en Delhaize, net zoals bij Albert Heijn.

## Overzicht

Voor elke winkel hebben we:
- ✅ Edge Function voor bulk import
- ✅ Import script (TypeScript)
- ✅ Database structuur met `source` field

## Stap 1: Maak Apify Actors

Je moet Apify actors maken/gebruiken om de websites te scrapen:

### Lidl (lidl.be)
1. Ga naar [Apify Store](https://apify.com/store)
2. Zoek "Lidl" of maak een nieuwe actor
3. Actor moet scrapen:
   - Product naam
   - Prijs
   - Foto URL
   - Barcode/EAN
   - Categorie
   - Merk
   - Unit size
   - Beschrijving

### Colruyt (colruyt.be)
1. Zoek "Colruyt" actor of maak er een
2. Zelfde data structuur als Lidl

### Delhaize (delhaize.be)
1. Zoek "Delhaize" actor of maak er een
2. Zelfde data structuur als Lidl

## Stap 2: Run de Actors

Voor elke winkel:

1. **Run de Apify actor** via Apify dashboard
2. **Wacht tot scraping klaar is**
3. **Kopieer de Dataset ID** van de actor run

## Stap 3: Import naar Supabase

### Optie A: Via TypeScript Script (Aanbevolen)

**Lidl:**
```bash
export LIDL_DATASET_ID="your-dataset-id"
npx ts-node scripts/sync-lidl-catalog.ts
```

**Colruyt:**
```bash
export COLRUYT_DATASET_ID="your-dataset-id"
npx ts-node scripts/sync-colruyt-catalog.ts
```

**Delhaize:**
```bash
export DELHAIZE_DATASET_ID="your-dataset-id"
npx ts-node scripts/sync-delhaize-catalog.ts
```

### Optie B: Via Edge Function

1. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy lidl-catalog-sync
   supabase functions deploy colruyt-catalog-sync
   supabase functions deploy delhaize-catalog-sync
   ```

2. **Set environment variables in Supabase**:
   - `APIFY_TOKEN`
   - `LIDL_DATASET_ID` (of `LIDL_APIFY_ACTOR_ID` om actor te runnen)
   - `COLRUYT_DATASET_ID` (of `COLRUYT_APIFY_ACTOR_ID`)
   - `DELHAIZE_DATASET_ID` (of `DELHAIZE_APIFY_ACTOR_ID`)

3. **Trigger import**:
   ```bash
   # Lidl
   curl -X POST https://your-project.supabase.co/functions/v1/lidl-catalog-sync \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"mode": "dataset"}'
   
   # Colruyt
   curl -X POST https://your-project.supabase.co/functions/v1/colruyt-catalog-sync \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"mode": "dataset"}'
   
   # Delhaize
   curl -X POST https://your-project.supabase.co/functions/v1/delhaize-catalog-sync \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"mode": "dataset"}'
   ```

## Apify Actor Data Structuur

Je Apify actor moet producten returnen in dit formaat:

```json
{
  "id": "product-id",
  "name": "Product naam",
  "title": "Product naam (alternatief)",
  "productName": "Product naam (alternatief)",
  "brand": "Merk",
  "category": "Categorie",
  "mainCategory": "Hoofdcategorie",
  "barcode": "1234567890123",
  "ean": "1234567890123",
  "gtin": "1234567890123",
  "description": "Product beschrijving",
  "imageUrl": "https://example.com/image.jpg",
  "image": "https://example.com/image.jpg",
  "image_url": "https://example.com/image.jpg",
  "unitSize": "500g",
  "unit_size": "500g",
  "size": "500g",
  "price": 2.99,
  "priceCurrent": 2.99,
  "currentPrice": 2.99,
  "nutrition": {...},
  "available": true,
  "isAvailable": true
}
```

## Environment Variables

```bash
# Required for all
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
APIFY_TOKEN=your-apify-token

# Per store (dataset ID of actor ID)
LIDL_DATASET_ID=your-dataset-id
COLRUYT_DATASET_ID=your-dataset-id
DELHAIZE_DATASET_ID=your-dataset-id

# Or use actor IDs to run actors automatically
LIDL_APIFY_ACTOR_ID=your-actor-id
COLRUYT_APIFY_ACTOR_ID=your-actor-id
DELHAIZE_APIFY_ACTOR_ID=your-actor-id
```

## Resultaat

Na import:
- ✅ Alle producten in `product_catalog` met `source='lidl'`, `source='colruyt'`, of `source='delhaize'`
- ✅ Foto's, prijzen, barcodes, categorieën
- ✅ Zoeken werkt op alle producten (bijv. "kaas" vindt kaas van alle winkels)
- ✅ Filteren op winkel mogelijk via `source` field

## Troubleshooting

- **Geen Apify actors gevonden?** Maak ze zelf met Apify's Web Scraper template
- **Dataset ID niet gevonden?** Check de Apify actor run output
- **Import faalt?** Check of product data structuur overeenkomt met verwachte format
- **Geen producten gevonden?** Check of de actor correct heeft gescraped

## Related Files

- `scripts/sync-lidl-catalog.ts` - Lidl import script
- `scripts/sync-colruyt-catalog.ts` - Colruyt import script
- `scripts/sync-delhaize-catalog.ts` - Delhaize import script
- `supabase/functions/lidl-catalog-sync/index.ts` - Lidl Edge Function
- `supabase/functions/colruyt-catalog-sync/index.ts` - Colruyt Edge Function
- `supabase/functions/delhaize-catalog-sync/index.ts` - Delhaize Edge Function
- `supabase/migrations/11_multi_store_support.sql` - Database structuur


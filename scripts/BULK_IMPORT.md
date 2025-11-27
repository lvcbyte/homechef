# Bulk Product Import Guide

Deze scripts importeren producten van meerdere bronnen naar je Supabase `product_catalog` tabel.

## 🚀 Quick Start

**Importeer alles in één keer:**
```bash
cd /Users/dietmar/chef
node scripts/bulk-import-all.js
```

Dit script runt alle scrapers automatisch en importeert duizenden producten.

## 📦 Beschikbare Scrapers

### 1. Open Food Facts (Aanbevolen - Start hier!)
**Grootste database met barcodes, foto's en voedingswaarden**
```bash
node scripts/scrape-openfoodfacts.js
```
- ✅ **10,000+ producten** uit België
- ✅ Barcodes, foto's, voedingswaarden
- ✅ Geen scraping nodig (API)
- ⚠️ Geen prijzen (database heeft geen prijzen)

### 2. Lidl (België)
```bash
node scripts/scrape-lidl-direct.js
```
- ✅ Producten met prijzen
- ✅ Foto's
- ✅ Meerdere categorieën en pagina's

### 3. Colruyt (België)
```bash
node scripts/scrape-colruyt-direct.js
```
- ✅ Producten met prijzen
- ✅ Foto's

### 4. Jumbo (Nederland)
```bash
node scripts/scrape-jumbo.js
```
- ✅ Nederlandse producten
- ✅ Prijzen en foto's

### 5. Carrefour (België)
```bash
node scripts/scrape-carrefour.js
```
- ✅ Belgische producten
- ✅ Prijzen en foto's

## 📊 Verwachte Aantallen

Na het runnen van alle scrapers zou je moeten hebben:
- **Open Food Facts**: ~10,000 producten
- **Lidl**: ~500-1,000 producten
- **Colruyt**: ~500-1,000 producten
- **Jumbo**: ~500-1,000 producten
- **Carrefour**: ~500-1,000 producten

**Totaal: ~12,000-15,000 producten** 🎉

## 🔍 Producten Bekijken

### In Supabase Dashboard:
1. Ga naar je Supabase project
2. Klik op **"Table Editor"**
3. Open de tabel **`product_catalog`**

### SQL Queries:

```sql
-- Totaal aantal producten per winkel
SELECT source, COUNT(*) as count 
FROM product_catalog 
GROUP BY source 
ORDER BY count DESC;

-- Laatste 20 geïmporteerde producten
SELECT product_name, brand, price, source, image_url, updated_at 
FROM product_catalog 
ORDER BY updated_at DESC 
LIMIT 20;

-- Producten met foto's
SELECT COUNT(*) 
FROM product_catalog 
WHERE image_url IS NOT NULL;

-- Producten met barcodes
SELECT COUNT(*) 
FROM product_catalog 
WHERE barcode IS NOT NULL;
```

## ⚙️ Database Setup

Run deze migration om nieuwe winkels toe te voegen:

```sql
-- In Supabase SQL Editor
-- Run: supabase/migrations/13_add_more_stores.sql
```

## 🐛 Troubleshooting

### "0 products found"
- Website structuur kan veranderd zijn
- Check de debug output
- Screenshots worden opgeslagen voor inspectie

### "Too many requests"
- Scripts wachten automatisch tussen requests
- Als je geblokkeerd wordt, wacht een paar uur

### "Missing environment variables"
- Zorg dat `.env.local` bestaat met:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## 💡 Tips

1. **Start met Open Food Facts** - Dit geeft de meeste producten snel
2. **Run scrapers 's nachts** - Minder server load
3. **Check regelmatig** - Sommige websites veranderen structuur
4. **Gebruik bulk-import-all.js** - Runt alles automatisch

## 🔄 Updates

Om producten bij te werken, run de scrapers opnieuw. De `upsert_product_catalog` functie update bestaande producten automatisch.


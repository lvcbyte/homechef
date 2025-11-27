# 🚀 Quick Start - Importeer Duizenden Producten

## ✅ Database is al klaar!

De migrations zijn al gerund. Je kunt nu direct beginnen met importeren.

## 📦 Optie 1: Open Food Facts (Aanbevolen - Meeste Producten)

Dit importeert **10,000-50,000 producten** met barcodes, foto's en voedingswaarden:

```bash
cd /Users/dietmar/chef
node scripts/scrape-openfoodfacts.js
```

**Let op:** Dit kan 30-60 minuten duren. Laat het rustig draaien.

## 📦 Optie 2: Alles tegelijk (Achtergrond)

```bash
cd /Users/dietmar/chef
./scripts/run-imports.sh
```

Dit start alle scrapers in de achtergrond. Check de logs:
```bash
tail -f logs/openfoodfacts.log
```

## 📊 Check Progress

```bash
# Check hoeveel producten er zijn
node scripts/check-database.js

# Of in Supabase SQL Editor:
SELECT source, COUNT(*) as count 
FROM product_catalog 
GROUP BY source 
ORDER BY count DESC;
```

## 🎯 Verwachte Resultaten

Na het runnen van Open Food Facts:
- **Open Food Facts**: 10,000-50,000 producten ✅
- **Lidl**: 500-1,000 producten
- **Colruyt**: 500-1,000 producten  
- **Jumbo**: 500-1,000 producten
- **Carrefour**: 500-1,000 producten

**Totaal: 12,000-55,000 producten** 🎉

## 💡 Tip

Start met Open Food Facts alleen. Die geeft de meeste producten en heeft barcodes + foto's. De andere scrapers kunnen later.


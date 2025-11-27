# 🌍 Product Translation & Improved Matching Setup

## Wat is er toegevoegd:

### 1. Translation System
- **Translation table** met FR/DE → NL vertalingen
- **Automatische vertaling** van productnamen
- **Reverse lookup**: zoeken in NL vindt ook FR/DE producten

### 2. Verbeterde Match Functie
- **Match scoring**: beste matches krijgen hogere score
- **Multi-language support**: zoekt in alle talen
- **Slimme prioriteit**: exacte matches eerst, dan fuzzy matches
- **Top 20 resultaten** in plaats van 10

### 3. Frontend Updates
- Sorteert matches op score (beste eerst)
- Auto-selecteert beste match
- Toont alle nieuwe stores (Carrefour, Jumbo, Open Food Facts)

## 📋 Setup Instructions

### Stap 1: Run Migrations in Supabase SQL Editor

**Migration 15: Product Translations**
```sql
-- Run: supabase/migrations/15_product_translations.sql
-- Dit voegt translation table en functies toe
```

**Migration 16: Improved Matching**
```sql
-- Run: supabase/migrations/16_improve_match_with_translations.sql
-- Dit verbetert de match functie met translations en scoring
```

### Stap 2: Test

```sql
-- Test translation
SELECT public.translate_to_dutch('fromage');
-- Should return: 'kaas'

-- Test search
SELECT * FROM public.match_product_catalog('kaas') LIMIT 5;
-- Should find products with 'kaas', 'fromage', 'käse'
```

### Stap 3: Test in App

1. Ga naar `/scan`
2. Klik "3. Snelle manuele invoer"
3. Type een woord (Nederlands, Frans of Duits)
4. Beste matches worden automatisch geselecteerd!

## 🎯 Hoe het werkt:

### Voorbeeld 1: Zoeken in Nederlands
- User zoekt: **"kaas"**
- Systeem vindt:
  - Producten met "kaas" in naam (score 100)
  - Producten met "fromage" (FR) → vertaald naar "kaas" (score 45)
  - Producten met "käse" (DE) → vertaald naar "kaas" (score 45)
- **Beste match wordt automatisch geselecteerd**

### Voorbeeld 2: Zoeken in Frans
- User zoekt: **"pomme"**
- Systeem vertaalt naar: **"appel"**
- Vindt alle producten met "appel" in naam
- **Beste match wordt automatisch geselecteerd**

### Voorbeeld 3: Zoeken in Duits
- User zoekt: **"milch"**
- Systeem vertaalt naar: **"melk"**
- Vindt alle producten met "melk" in naam
- **Beste match wordt automatisch geselecteerd**

## 📊 Match Scoring:

- **100**: Exacte match op productnaam
- **90**: Exacte match op merk
- **80**: Productnaam begint met zoekterm
- **70**: Productnaam bevat zoekterm
- **60**: Merk bevat zoekterm
- **50**: Woord match in productnaam
- **45**: Translation match
- **40-10**: Similarity scores (fuzzy matching)

## 🔧 Uitbreiden:

Om meer vertalingen toe te voegen:

```sql
INSERT INTO public.product_translations (source_language, source_term, dutch_term, category)
VALUES ('fr', 'nieuw_frans_woord', 'nederlands_woord', 'category');
```

## ✅ Resultaat:

- ✅ Producten in FR/DE worden gevonden bij zoeken in NL
- ✅ Beste matches worden automatisch geselecteerd
- ✅ Multi-language support
- ✅ Betere search results


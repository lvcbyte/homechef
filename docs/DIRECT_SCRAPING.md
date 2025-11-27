# Direct Web Scraping Guide

Scrape product catalogi direct van de websites (lidl.be, colruyt.be, delhaize.be) zonder Apify.

## Overzicht

We gebruiken directe web scraping met:
- **Cheerio** voor HTML parsing
- **Fetch** voor HTTP requests
- **TypeScript scripts** die direct naar Supabase schrijven

## Installatie

```bash
npm install
# Cheerio is al geïnstalleerd
```

## Gebruik

### Lidl

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run scraper
npx ts-node scripts/scrape-lidl-direct.ts
```

### Colruyt

```bash
npx ts-node scripts/scrape-colruyt-direct.ts
```

### Delhaize

```bash
npx ts-node scripts/scrape-delhaize-direct.ts
```

## Hoe het werkt

1. **Script haalt HTML op** van categorie pagina's
2. **Cheerio parseert HTML** en extraheert product informatie
3. **Producten worden genormaliseerd** naar ons database format
4. **Direct geïmporteerd** naar Supabase via RPC

## Website Selectors

De scripts gebruiken CSS selectors om producten te vinden. Als de websites veranderen, moet je de selectors aanpassen:

### Lidl (scrape-lidl-direct.ts)
- Product containers: `.product-item, .product-tile, [data-product-id]`
- Product naam: `.product-name, .product-title, h3, h4`
- Prijs: `.price, .product-price, [data-price]`
- Foto: `img` src attribute

### Colruyt (scrape-colruyt-direct.ts)
- Product containers: `.product-item, .product-card, .product-tile, [data-product]`
- Product naam: `.product-name, .product-title, .name, h3, h4`
- Prijs: `.price, .product-price, .current-price, [data-price]`
- Foto: `img` src attribute

### Delhaize (scrape-delhaize-direct.ts)
- Product containers: `.product-item, .product-card, .product-tile, [data-product], .product-wrapper`
- Product naam: `.product-name, .product-title, .name, h3, h4, .title`
- Prijs: `.price, .product-price, .current-price, [data-price], .price-value`
- Foto: `img` src attribute

## Aanpassen van Selectors

Als de websites veranderen:

1. **Open de website** in je browser
2. **Inspect element** op een product
3. **Vind de CSS classes/attributes**
4. **Update de selectors** in het script

Bijvoorbeeld, als Lidl de class verandert van `.product-item` naar `.product-card`:

```typescript
// In scrape-lidl-direct.ts
$('.product-card, .product-tile, [data-product-id]').each((_, element) => {
  // ...
});
```

## Categorie URLs

De scripts scrapen verschillende categorie pagina's. Als URLs veranderen, update ze in het script:

```typescript
const categoryUrls = [
  `${baseUrl}/c/fresh-produce/a10005965`,
  `${baseUrl}/c/dairy-eggs/a10005966`,
  // ... etc
];
```

## Rate Limiting

De scripts wachten 1 seconde tussen requests om de servers niet te overbelasten:

```typescript
await new Promise(resolve => setTimeout(resolve, 1000));
```

## Troubleshooting

### Geen producten gevonden?
- Check of de website structuur is veranderd
- Inspect de HTML in browser DevTools
- Update de CSS selectors in het script

### Import faalt?
- Check Supabase RLS policies
- Check of `upsert_product_catalog` RPC bestaat
- Check console errors voor details

### Te weinig producten?
- Check of alle categorie URLs correct zijn
- Check of paginering nodig is (meerdere pagina's per categorie)
- Voeg paginering logica toe aan het script

## Resultaat

Na scraping:
- ✅ Alle producten in `product_catalog` met `source='lidl'`, `source='colruyt'`, of `source='delhaize'`
- ✅ Foto's, prijzen, categorieën
- ✅ Zoeken werkt op alle producten
- ✅ Filteren op winkel mogelijk

## Related Files

- `scripts/scrape-lidl-direct.ts` - Lidl scraper
- `scripts/scrape-colruyt-direct.ts` - Colruyt scraper
- `scripts/scrape-delhaize-direct.ts` - Delhaize scraper
- `supabase/migrations/11_multi_store_support.sql` - Database structuur


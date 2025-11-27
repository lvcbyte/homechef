# Lidl Catalog Integration

Import de volledige Lidl product catalogus, net zoals bij Albert Heijn.

## Methode: Apify Actor

Net zoals bij Albert Heijn gebruiken we een Apify actor om de volledige Lidl catalogus te scrapen.

### Stap 1: Vind of maak een Apify Actor

1. Ga naar [Apify Store](https://apify.com/store)
2. Zoek naar "Lidl" scrapers
3. Of maak je eigen actor om Lidl producten te scrapen
4. Noteer de Actor ID

### Stap 2: Run de Actor

Run de Apify actor om de volledige Lidl catalogus te scrapen. Dit kan via:
- Apify web interface
- Of via de Edge Function (zie hieronder)

### Stap 3: Import naar Supabase

**Optie A: Via TypeScript Script (Aanbevolen)**

1. **Set environment variables**:
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   export APIFY_TOKEN="your-apify-token"
   export LIDL_DATASET_ID="your-dataset-id"  # Van Apify actor run
   ```

2. **Run het script**:
   ```bash
   npx ts-node scripts/sync-lidl-catalog.ts
   ```

**Optie B: Via Edge Function**

1. **Deploy de Edge Function**:
   ```bash
   supabase functions deploy lidl-catalog-sync
   ```

2. **Set environment variables in Supabase**:
   - `APIFY_TOKEN`
   - `LIDL_APIFY_ACTOR_ID` (of `LIDL_DATASET_ID` als je al een dataset hebt)

3. **Trigger de import**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/lidl-catalog-sync \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"mode": "dataset"}'  # of "actor" om eerst te scrapen
   ```

## Volledige Catalogus Import

Net zoals bij Albert Heijn:

1. **Run Apify actor** om volledige catalogus te scrapen
2. **Krijg dataset ID** van de actor run
3. **Import dataset** naar Supabase via script of Edge Function

## Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
APIFY_TOKEN=your-apify-token

# For script
LIDL_DATASET_ID=your-dataset-id

# For Edge Function (optional)
LIDL_APIFY_ACTOR_ID=your-actor-id  # Als je de actor via Edge Function wilt runnen
```

## Resultaat

Na import zie je alle Lidl producten in je catalogus met `source='lidl'`. Je kunt dan zoeken op producten zoals "kaas" en alle Lidl kaassoorten worden gevonden, net zoals bij Albert Heijn.

## Troubleshooting

- **Geen Apify actor gevonden?** Zoek op Apify Store of maak er zelf een
- **Dataset ID niet gevonden?** Check de Apify actor run output
- **Import faalt?** Check of de product data structuur overeenkomt met wat het script verwacht

## Related Files

- `scripts/sync-lidl-catalog.ts` - Import script (net zoals sync-ah-catalog.ts)
- `supabase/functions/lidl-catalog-sync/index.ts` - Edge Function voor bulk import
- `supabase/migrations/11_multi_store_support.sql` - Database structuur

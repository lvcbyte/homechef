# Test Translations

## Run deze SQL in Supabase om te testen:

```sql
-- Test translation function
SELECT public.translate_to_dutch('pomme');
-- Should return: 'appel'

SELECT public.translate_to_dutch('fromage');
-- Should return: 'kaas'

SELECT public.translate_to_dutch('milch');
-- Should return: 'melk'

-- Test search variants
SELECT public.get_search_variants('kaas');
-- Should return: ['kaas', 'fromage', 'käse']

-- Test match function
SELECT * FROM public.match_product_catalog('kaas') LIMIT 5;
-- Should find products with 'kaas', 'fromage', 'käse' in name

SELECT * FROM public.match_product_catalog('pomme') LIMIT 5;
-- Should find products with 'appel' in name (translated)
```

## Test in de app:

1. Ga naar `/scan`
2. Klik op "3. Snelle manuele invoer"
3. Type een Frans of Duits woord (bijv. "fromage", "pomme", "milch")
4. Het zou Nederlandse producten moeten vinden!


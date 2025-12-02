# Stap 1: Verifieer Database Functies

## ✅ Actie Vereist

Voer dit SQL script uit in je Supabase SQL Editor om te controleren of alle functies en tabellen zijn aangemaakt:

```sql
-- Check alle functies
SELECT 
    routine_name as "Functie Naam",
    routine_type as "Type"
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_price_trend',
    'record_price_change',
    'find_ingredient_substitutions',
    'can_substitute_ingredient',
    'get_active_timers',
    'complete_timer',
    'calculate_recipe_health_impact',
    'get_latest_ml_model'
)
ORDER BY routine_name;

-- Check alle tabellen
SELECT 
    table_name as "Tabel Naam"
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'price_history',
    'ingredient_substitutions',
    'cooking_timers',
    'user_health_goals',
    'recipe_consumption',
    'ml_model_metadata'
)
ORDER BY table_name;

-- Test een functie (moet geen error geven)
SELECT find_ingredient_substitutions('rode ui', 0.7) LIMIT 1;
```

## ✅ Verwachte Resultaten

Je zou moeten zien:
- **8 functies** in de eerste query
- **6 tabellen** in de tweede query
- **Geen errors** bij de test query

Als je minder ziet, dan is de migratie niet volledig uitgevoerd. Controleer dan:
1. Of er errors waren tijdens de migratie
2. Of alle statements in de migratie zijn uitgevoerd

## 📝 Volgende Stap

Als alles klopt, ga door naar **Stap 2: Deploy Edge Function**


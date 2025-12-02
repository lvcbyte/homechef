# Test Notificaties - Debug Guide

## Probleem: Geen notificaties na migratie 97

Als je geen notificaties ziet na het uitvoeren van migratie 97, volg deze stappen:

## Stap 1: Check Inventory Status

Voer deze query uit in Supabase SQL Editor om te zien welke items notificaties zouden moeten triggeren:

```sql
-- Vervang 'YOUR_USER_ID' met je eigen user ID
SELECT * FROM debug_inventory_status('YOUR_USER_ID'::uuid);
```

Dit toont:
- Welke items binnen 7 dagen vervallen
- Welke items al vervallen zijn
- Welke items lage voorraad hebben
- Welke items veel recept matches hebben

## Stap 2: Test Notificaties Forceren

Als je items hebt die notificaties zouden moeten triggeren, forceer ze met:

```sql
-- Vervang 'YOUR_USER_ID' met je eigen user ID
SELECT * FROM test_create_notifications('YOUR_USER_ID'::uuid);
```

Dit maakt notificaties aan zonder duplicaat checks (voor testing).

## Stap 3: Check Bestaande Notificaties

Check of er al notificaties zijn:

```sql
-- Vervang 'YOUR_USER_ID' met je eigen user ID
SELECT 
    type,
    title,
    message,
    created_at,
    read
FROM notifications
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 20;
```

## Stap 4: Check Inventory Items

Check of je inventory items hebt met expiry dates:

```sql
-- Vervang 'YOUR_USER_ID' met je eigen user ID
SELECT 
    name,
    expires_at,
    quantity_approx,
    CASE 
        WHEN expires_at IS NULL THEN NULL
        WHEN expires_at <= now() THEN EXTRACT(day FROM (now() - expires_at))::integer
        ELSE EXTRACT(day FROM (expires_at - now()))::integer
    END as days_until_expiry
FROM inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY expires_at ASC NULLS LAST;
```

## Stap 5: Test Functie Handmatig Aanroepen

Test de hoofdnotificatie functie:

```sql
-- Voor alle gebruikers
SELECT create_expiry_notifications();

-- Voor specifieke gebruiker
SELECT create_all_notifications_for_user('YOUR_USER_ID'::uuid);
```

## Stap 6: Check Recipe Matches

Check of recipe matching werkt:

```sql
-- Vervang 'YOUR_USER_ID' en 'ITEM_ID' met echte IDs
SELECT get_inventory_recipe_match_count('ITEM_ID'::uuid, 'YOUR_USER_ID'::uuid);
```

## Veelvoorkomende Problemen

### 1. Geen items met expiry dates
**Oplossing**: Voeg items toe met `expires_at` in de toekomst (binnen 7 dagen)

```sql
-- Test: Update een item om binnen 3 dagen te vervallen
UPDATE inventory
SET expires_at = now() + interval '2 days'
WHERE user_id = 'YOUR_USER_ID'::uuid
AND name = 'Test Product'
LIMIT 1;
```

### 2. Duplicaat checks blokkeren notificaties
**Oplossing**: Gebruik `test_create_notifications()` functie die duplicaat checks overslaat

### 3. Functie wordt niet aangeroepen
**Oplossing**: 
- Check of `create_all_notifications_for_user` wordt aangeroepen in profile.tsx
- Roep handmatig aan via SQL Editor
- Check browser console voor errors

### 4. Permissions probleem
**Oplossing**: Check of de functies correct permissions hebben:

```sql
-- Check permissions
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%notification%';
```

## Debug in App

In de app, open de Profile pagina en ga naar de Notifications tab. Dit zou automatisch `create_all_notifications_for_user` moeten aanroepen.

Check de browser console voor errors.

## Test Data Aanmaken

Maak test data aan om notificaties te triggeren:

```sql
-- Vervang 'YOUR_USER_ID' met je eigen user ID
INSERT INTO inventory (user_id, name, category, expires_at, quantity_approx)
VALUES 
    ('YOUR_USER_ID'::uuid, 'Test Product 1', 'dairy_eggs', now() + interval '2 days', '1 stuk'),
    ('YOUR_USER_ID'::uuid, 'Test Product 2', 'proteins', now() - interval '1 day', '500g'),
    ('YOUR_USER_ID'::uuid, 'Test Product 3', 'pantry', now() + interval '5 days', '2 stuks');
```

Dan test notificaties:
```sql
SELECT * FROM test_create_notifications('YOUR_USER_ID'::uuid);
```


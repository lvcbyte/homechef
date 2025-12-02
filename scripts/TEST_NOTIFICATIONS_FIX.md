# Test Notificaties Fix

Na het uitvoeren van migratie `99_fix_notification_functions.sql`, volg deze stappen om te testen:

## Stap 1: Vind je User ID

```sql
SELECT id, email FROM auth.users WHERE email = 'diet.je@hotmail.com';
```

Kopieer je `id` (UUID).

## Stap 2: Test get_inventory_recipe_match_count

**Vervang `YOUR_USER_ID` en `ITEM_ID` met echte waarden.**

```sql
-- Eerst, vind een inventory item ID
SELECT id, name, category FROM public.inventory 
WHERE user_id = 'YOUR_USER_ID'::uuid 
LIMIT 1;

-- Test de functie
SELECT public.get_inventory_recipe_match_count(
    'ITEM_ID'::uuid,
    'YOUR_USER_ID'::uuid
) as match_count;
```

**Verwachte output:** Een getal (0 of hoger). Als dit werkt, dan is de functie correct.

## Stap 3: Test create_all_notifications_for_user

**Vervang `YOUR_USER_ID` met je echte user ID.**

```sql
-- Test de functie
SELECT public.create_all_notifications_for_user('YOUR_USER_ID'::uuid);
```

**Verwachte output:** Geen error. Als er een error is, kopieer de volledige error message.

## Stap 4: Controleer Aangemaakte Notificaties

```sql
SELECT 
    type, 
    title, 
    message, 
    priority,
    created_at,
    read
FROM public.notifications
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 20;
```

**Verwachte output:** Een lijst van notificaties. Als je hier notificaties ziet, dan werkt het systeem!

## Stap 5: Controleer Inventory Items

Zorg ervoor dat je inventory items hebt die notificaties zouden moeten triggeren:

```sql
-- Items die binnen 7 dagen vervallen
SELECT 
    id,
    name,
    expires_at,
    EXTRACT(day FROM (expires_at - now()))::integer as days_until_expiry
FROM public.inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
AND expires_at IS NOT NULL
AND expires_at <= now() + interval '7 days'
AND expires_at > now()
ORDER BY expires_at ASC;

-- Vervallen items
SELECT 
    id,
    name,
    expires_at
FROM public.inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
AND expires_at IS NOT NULL
AND expires_at <= now()
ORDER BY expires_at DESC;

-- Items met lage voorraad
SELECT 
    id,
    name,
    quantity_approx
FROM public.inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
AND quantity_approx IS NOT NULL
AND quantity_approx != ''
AND (
    quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR 
    quantity_approx ~ '^[12]\s*$'
);
```

## Stap 6: Test in de App

1. Open de StockPit app
2. Ga naar Profile
3. Klik op de "Notifications" tab
4. Je zou nu nieuwe notificaties moeten zien

## Troubleshooting

### Error 22023: invalid parameter value

Dit betekent dat de functie parameters niet kloppen. Controleer:
- Is de user ID een geldige UUID?
- Bestaat de user in auth.users?
- Zijn er inventory items voor deze user?

### Geen notificaties

Mogelijke oorzaken:
1. **Geen items voldoen aan criteria**: Zorg ervoor dat je items hebt die:
   - Binnen 7 dagen vervallen
   - Al vervallen zijn
   - Lage voorraad hebben (1 of 2 stuks)
   - Matchen met recepten (3+ matches)

2. **Duplicaat checks**: De functie voorkomt duplicaten binnen:
   - 12 uur voor expiry warnings
   - 6 uur voor expired items
   - 2 dagen voor low stock
   - 3 dagen voor recipe matches
   - 1 dag voor eat-me-first reminders
   - 20 uur voor daily summary

3. **Functie wordt niet aangeroepen**: Controleer de browser console voor errors wanneer je naar de notifications tab gaat.

### Functie bestaat niet

Als je een error krijgt dat de functie niet bestaat:
1. Controleer of migratie `99_fix_notification_functions.sql` is uitgevoerd
2. Controleer of de functie bestaat:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE '%notification%';
   ```

### Permissions error

Als je een permissions error krijgt:
```sql
-- Check permissions
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name IN (
    'create_all_notifications_for_user',
    'get_inventory_recipe_match_count',
    'create_daily_inventory_summary'
);
```

Als `authenticated` niet in de lijst staat, voer dan uit:
```sql
GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_daily_inventory_summary(uuid) TO authenticated;
```


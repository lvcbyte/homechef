# Test Notificaties - Stap voor Stap

Volg deze stappen om te debuggen waarom er geen notificaties worden aangemaakt.

## Stap 1: Vind je User ID

```sql
SELECT id, email FROM auth.users WHERE email = 'diet.je@hotmail.com';
```

Kopieer je `id` (UUID). Bijvoorbeeld: `bff189d1-5455-4bd2-b01e-a797a72ca3cc`

## Stap 2: Check je Inventory Items

**Vervang `YOUR_USER_ID` met je echte user ID uit stap 1.**

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
```

**Als deze query GEEN resultaten geeft**, dan heb je geen items die binnen 7 dagen vervallen. Voeg dan handmatig een test item toe:

```sql
-- Voeg test item toe dat morgen vervalt
INSERT INTO public.inventory (user_id, name, category, expires_at, quantity_approx)
VALUES (
    'YOUR_USER_ID'::uuid,
    'Test Product - Melk',
    'dairy_eggs',
    now() + interval '1 day',
    '1 stuks'
);
```

## Stap 3: Test de Functie Direct

**Vervang `YOUR_USER_ID` met je echte user ID.**

```sql
-- Test de functie en krijg het aantal aangemaakte notificaties terug
SELECT public.create_all_notifications_for_user('YOUR_USER_ID'::uuid) as notifications_created;
```

**Verwachte output:** Een getal (bijvoorbeeld `3`). Dit is het aantal notificaties dat is aangemaakt.

**Als je `0` krijgt**, dan zijn er geen items die voldoen aan de criteria OF er zijn al recente notificaties (binnen de duplicate check window).

## Stap 4: Check Aangemaakte Notificaties

```sql
SELECT 
    type,
    title,
    message,
    priority,
    read,
    created_at
FROM public.notifications
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 20;
```

**Als je hier notificaties ziet**, dan werkt het systeem! Check of ze in de app worden getoond.

## Stap 5: Gebruik Debug Functie

**Eerst, voer migratie 100 uit om de debug functie te krijgen:**

```sql
-- Voer migratie 100_debug_notifications.sql uit in Supabase SQL Editor
```

**Dan, gebruik de debug functie:**

```sql
SELECT * FROM public.debug_notification_creation('YOUR_USER_ID'::uuid);
```

**Deze functie toont:**
- Welke items voldoen aan de criteria
- Of er al notificaties bestaan (duplicate check)
- Waarom items wel/niet notificaties zouden triggeren

## Stap 6: Verwijder Oude Notificaties (voor testing)

**Als je wilt testen zonder duplicate checks:**

```sql
-- Verwijder alle notificaties van de laatste 24 uur
DELETE FROM public.notifications 
WHERE user_id = 'YOUR_USER_ID'::uuid 
AND created_at > now() - interval '24 hours';
```

**Dan, test opnieuw:**

```sql
SELECT public.create_all_notifications_for_user('YOUR_USER_ID'::uuid);
```

## Stap 7: Check in de App

1. Open de StockPit app
2. Ga naar Profile → Notifications tab
3. De functie wordt automatisch aangeroepen wanneer je naar de notifications tab gaat
4. Check de browser console voor errors

## Veelvoorkomende Problemen

### Probleem: Functie retourneert 0

**Oorzaken:**
1. Geen items voldoen aan criteria
2. Duplicate checks blokkeren (binnen 12 uur voor expiry warnings)
3. Items hebben geen `expires_at` datum

**Oplossing:**
- Voeg test items toe met `expires_at` in de toekomst
- Verwijder oude notificaties (stap 6)
- Check je inventory items (stap 2)

### Probleem: Notificaties worden aangemaakt maar niet getoond in app

**Oorzaken:**
1. App laadt oude data (refresh nodig)
2. Real-time subscription werkt niet
3. Permissions probleem

**Oplossing:**
- Refresh de app (F5 of reload)
- Check browser console voor errors
- Check of `user_id` in notificaties overeenkomt met ingelogde user

### Probleem: Error bij aanroepen functie

**Check:**
- Is migratie 99 of 101 uitgevoerd?
- Bestaat de functie?
  ```sql
  SELECT routine_name 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name = 'create_all_notifications_for_user';
  ```

## Test Checklist

- [ ] User ID gevonden
- [ ] Inventory items hebben `expires_at` datums
- [ ] Functie `create_all_notifications_for_user` bestaat
- [ ] Functie retourneert een getal (niet 0)
- [ ] Notificaties worden aangemaakt in database
- [ ] Notificaties worden getoond in app
- [ ] Geen errors in browser console


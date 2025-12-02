-- ============================================
-- Debug Notifications - Test Script
-- ============================================
-- Gebruik dit script om te debuggen waarom er geen notificaties worden aangemaakt

-- ============================================
-- 1. CHECK INVENTORY ITEMS
-- ============================================
-- Vervang 'YOUR_USER_ID' met je echte user ID

-- Items die binnen 7 dagen vervallen
SELECT 
    'Items binnen 7 dagen' as check_type,
    id,
    name,
    expires_at,
    EXTRACT(day FROM (expires_at - now()))::integer as days_until_expiry,
    category,
    quantity_approx
FROM public.inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
AND expires_at IS NOT NULL
AND expires_at <= now() + interval '7 days'
AND expires_at > now()
ORDER BY expires_at ASC;

-- Vervallen items
SELECT 
    'Vervallen items' as check_type,
    id,
    name,
    expires_at,
    EXTRACT(day FROM (now() - expires_at))::integer as days_expired,
    category
FROM public.inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
AND expires_at IS NOT NULL
AND expires_at <= now()
ORDER BY expires_at DESC;

-- Items met lage voorraad
SELECT 
    'Lage voorraad' as check_type,
    id,
    name,
    quantity_approx,
    category
FROM public.inventory
WHERE user_id = 'YOUR_USER_ID'::uuid
AND quantity_approx IS NOT NULL
AND quantity_approx != ''
AND (
    quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR 
    quantity_approx ~ '^[12]\s*$' OR
    LOWER(quantity_approx) LIKE '%1%' AND (LOWER(quantity_approx) LIKE '%stuk%' OR LOWER(quantity_approx) LIKE '%x%') OR
    LOWER(quantity_approx) LIKE '%2%' AND (LOWER(quantity_approx) LIKE '%stuk%' OR LOWER(quantity_approx) LIKE '%x%')
);

-- ============================================
-- 2. TEST get_inventory_recipe_match_count
-- ============================================
-- Vervang 'ITEM_ID' en 'YOUR_USER_ID' met echte waarden

SELECT 
    i.id,
    i.name,
    public.get_inventory_recipe_match_count(i.id, 'YOUR_USER_ID'::uuid) as recipe_match_count
FROM public.inventory i
WHERE i.user_id = 'YOUR_USER_ID'::uuid
AND (i.expires_at IS NULL OR i.expires_at > now())
LIMIT 5;

-- ============================================
-- 3. CHECK EXISTING NOTIFICATIONS
-- ============================================
-- Kijk welke notificaties er al zijn

SELECT 
    type,
    title,
    message,
    priority,
    read,
    created_at,
    data->>'item_id' as item_id,
    data->>'item_name' as item_name
FROM public.notifications
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- 4. TEST create_all_notifications_for_user MANUEEL
-- ============================================
-- Dit zou notificaties moeten aanmaken

-- Eerst, verwijder oude test notificaties (optioneel)
-- DELETE FROM public.notifications 
-- WHERE user_id = 'YOUR_USER_ID'::uuid 
-- AND created_at > now() - interval '1 hour';

-- Test de functie
DO $$
DECLARE
    v_user_id uuid := 'YOUR_USER_ID'::uuid;
    v_result text;
BEGIN
    -- Roep de functie aan
    PERFORM public.create_all_notifications_for_user(v_user_id);
    
    -- Check hoeveel notificaties zijn aangemaakt
    SELECT COUNT(*)::text INTO v_result
    FROM public.notifications
    WHERE user_id = v_user_id
    AND created_at > now() - interval '1 minute';
    
    RAISE NOTICE 'Aantal notificaties aangemaakt in laatste minuut: %', v_result;
END $$;

-- ============================================
-- 5. DETAILED DEBUG FUNCTION
-- ============================================
-- Deze functie toont precies wat er gebeurt

CREATE OR REPLACE FUNCTION public.debug_notification_creation(p_user_id uuid)
RETURNS TABLE (
    step text,
    item_id uuid,
    item_name text,
    check_result text,
    reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
    v_days_until integer;
    v_match_count integer;
    v_count integer;
BEGIN
    -- Check 1: Items binnen 7 dagen
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND expires_at IS NOT NULL
        AND expires_at <= now() + interval '7 days'
        AND expires_at > now()
    LOOP
        v_days_until := EXTRACT(day FROM (v_item.expires_at - now()))::integer;
        
        -- Check if notification already exists
        SELECT COUNT(*) INTO v_count
        FROM public.notifications n
        WHERE n.user_id = p_user_id
        AND n.type = 'expiry_warning'
        AND (n.data->>'item_id')::uuid = v_item.id
        AND n.created_at > now() - interval '12 hours';
        
        step := 'EXPIRY_WARNING';
        item_id := v_item.id;
        item_name := v_item.name;
        check_result := CASE WHEN v_count > 0 THEN 'SKIP (duplicate)' ELSE 'SHOULD CREATE' END;
        reason := 'Expires in ' || v_days_until || ' days. Existing notifications: ' || v_count;
        RETURN NEXT;
    END LOOP;
    
    -- Check 2: Vervallen items
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND expires_at IS NOT NULL
        AND expires_at <= now()
    LOOP
        SELECT COUNT(*) INTO v_count
        FROM public.notifications n
        WHERE n.user_id = p_user_id
        AND n.type = 'expired_item_alert'
        AND (n.data->>'item_id')::uuid = v_item.id
        AND n.created_at > now() - interval '6 hours';
        
        step := 'EXPIRED_ITEM';
        item_id := v_item.id;
        item_name := v_item.name;
        check_result := CASE WHEN v_count > 0 THEN 'SKIP (duplicate)' ELSE 'SHOULD CREATE' END;
        reason := 'Expired. Existing notifications: ' || v_count;
        RETURN NEXT;
    END LOOP;
    
    -- Check 3: Lage voorraad
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND quantity_approx IS NOT NULL
        AND quantity_approx != ''
    LOOP
        IF v_item.quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR 
           v_item.quantity_approx ~ '^[12]\s*$' OR
           LOWER(v_item.quantity_approx) LIKE '%1%' AND (LOWER(v_item.quantity_approx) LIKE '%stuk%' OR LOWER(v_item.quantity_approx) LIKE '%x%') OR
           LOWER(v_item.quantity_approx) LIKE '%2%' AND (LOWER(v_item.quantity_approx) LIKE '%stuk%' OR LOWER(v_item.quantity_approx) LIKE '%x%')
        THEN
            SELECT COUNT(*) INTO v_count
            FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'low_stock_warning'
            AND (n.data->>'item_id')::uuid = v_item.id
            AND n.created_at > now() - interval '2 days';
            
            step := 'LOW_STOCK';
            item_id := v_item.id;
            item_name := v_item.name;
            check_result := CASE WHEN v_count > 0 THEN 'SKIP (duplicate)' ELSE 'SHOULD CREATE' END;
            reason := 'Quantity: ' || v_item.quantity_approx || '. Existing notifications: ' || v_count;
            RETURN NEXT;
        END IF;
    END LOOP;
    
    -- Check 4: Recipe matches
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > now())
    LOOP
        BEGIN
            SELECT get_inventory_recipe_match_count(v_item.id, p_user_id) INTO v_match_count;
        EXCEPTION WHEN OTHERS THEN
            v_match_count := 0;
        END;
        
        IF v_match_count >= 3 THEN
            SELECT COUNT(*) INTO v_count
            FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'recipe_match_opportunity'
            AND (n.data->>'item_id')::uuid = v_item.id
            AND n.created_at > now() - interval '3 days';
            
            step := 'RECIPE_MATCH';
            item_id := v_item.id;
            item_name := v_item.name;
            check_result := CASE WHEN v_count > 0 THEN 'SKIP (duplicate)' ELSE 'SHOULD CREATE' END;
            reason := 'Matches ' || v_match_count || ' recipes. Existing notifications: ' || v_count;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.debug_notification_creation IS 'Debug functie om te zien welke notificaties zouden moeten worden aangemaakt en waarom ze wel/niet worden aangemaakt.';

GRANT EXECUTE ON FUNCTION public.debug_notification_creation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_notification_creation(uuid) TO service_role;

-- ============================================
-- 6. GEBRUIK DE DEBUG FUNCTIE
-- ============================================
-- Vervang 'YOUR_USER_ID' met je echte user ID

-- SELECT * FROM public.debug_notification_creation('YOUR_USER_ID'::uuid);


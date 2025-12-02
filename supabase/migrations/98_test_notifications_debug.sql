-- ============================================
-- Test & Debug Notifications
-- ============================================
-- Helper functies om notificaties te testen en debuggen

-- ============================================
-- 1. TEST FUNCTIE: Check inventory status voor gebruiker
-- ============================================

CREATE OR REPLACE FUNCTION public.debug_inventory_status(p_user_id uuid)
RETURNS TABLE (
    item_name text,
    expires_at timestamptz,
    days_until_expiry integer,
    quantity_approx text,
    recipe_match_count integer,
    should_notify_expiry boolean,
    should_notify_expired boolean,
    should_notify_low_stock boolean,
    should_notify_recipe_match boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.name::text,
        i.expires_at,
        CASE 
            WHEN i.expires_at IS NULL THEN NULL::integer
            WHEN i.expires_at <= now() THEN EXTRACT(day FROM (now() - i.expires_at))::integer
            ELSE EXTRACT(day FROM (i.expires_at - now()))::integer
        END as days_until_expiry,
        i.quantity_approx,
        get_inventory_recipe_match_count(i.id, p_user_id) as recipe_match_count,
        -- Should notify expiry (binnen 7 dagen)
        (i.expires_at IS NOT NULL AND i.expires_at > now() AND i.expires_at <= now() + interval '7 days')::boolean as should_notify_expiry,
        -- Should notify expired
        (i.expires_at IS NOT NULL AND i.expires_at <= now())::boolean as should_notify_expired,
        -- Should notify low stock
        (i.quantity_approx IS NOT NULL AND (
            i.quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR 
            i.quantity_approx ~ '^[12]\s*$'
        ))::boolean as should_notify_low_stock,
        -- Should notify recipe match (3+ matches)
        (get_inventory_recipe_match_count(i.id, p_user_id) >= 3)::boolean as should_notify_recipe_match
    FROM public.inventory i
    WHERE i.user_id = p_user_id
    ORDER BY i.expires_at ASC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.debug_inventory_status IS 'Debug functie om te zien welke items notificaties zouden moeten triggeren.';

GRANT EXECUTE ON FUNCTION public.debug_inventory_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_inventory_status(uuid) TO service_role;

-- ============================================
-- 2. TEST FUNCTIE: Force create notifications voor gebruiker (zonder duplicaat checks)
-- ============================================

CREATE OR REPLACE FUNCTION public.test_create_notifications(p_user_id uuid)
RETURNS TABLE (
    notification_type text,
    items_processed integer,
    notifications_created integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
    v_days_until integer;
    v_match_count integer;
    v_expiry_count integer := 0;
    v_expired_count integer := 0;
    v_low_stock_count integer := 0;
    v_recipe_match_count integer := 0;
    v_notifications_created integer := 0;
BEGIN
    -- Test expiry warnings
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND expires_at IS NOT NULL
        AND expires_at > now()
        AND expires_at <= now() + interval '7 days'
    LOOP
        v_expiry_count := v_expiry_count + 1;
        v_days_until := EXTRACT(day FROM (v_item.expires_at - now()))::integer;
        SELECT get_inventory_recipe_match_count(v_item.id, p_user_id) INTO v_match_count;
        
        INSERT INTO public.notifications (user_id, type, title, message, data, priority)
        VALUES (
            p_user_id,
            'expiry_warning',
            CASE 
                WHEN v_days_until = 0 THEN '🚨 Vandaag vervalt: ' || v_item.name
                WHEN v_days_until = 1 THEN '⚠️ Morgen vervalt: ' || v_item.name
                ELSE '⏰ Over ' || v_days_until || ' dagen vervalt: ' || v_item.name
            END,
            'Je ' || v_item.name || ' vervalt over ' || v_days_until || ' dagen.',
            jsonb_build_object(
                'item_id', v_item.id,
                'item_name', v_item.name,
                'days_until_expiry', v_days_until,
                'recipe_match_count', v_match_count
            ),
            CASE WHEN v_days_until <= 3 THEN 3 ELSE 1 END
        );
        v_notifications_created := v_notifications_created + 1;
    END LOOP;
    
    -- Test expired items
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND expires_at IS NOT NULL
        AND expires_at <= now()
    LOOP
        v_expired_count := v_expired_count + 1;
        v_days_until := EXTRACT(day FROM (now() - v_item.expires_at))::integer;
        
        INSERT INTO public.notifications (user_id, type, title, message, data, priority)
        VALUES (
            p_user_id,
            'expired_item_alert',
            '❌ Vervallen: ' || v_item.name,
            'Je ' || v_item.name || ' is vervallen.',
            jsonb_build_object(
                'item_id', v_item.id,
                'item_name', v_item.name,
                'days_expired', v_days_until
            ),
            4
        );
        v_notifications_created := v_notifications_created + 1;
    END LOOP;
    
    -- Test low stock
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND quantity_approx IS NOT NULL
        AND (quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR quantity_approx ~ '^[12]\s*$')
    LOOP
        v_low_stock_count := v_low_stock_count + 1;
        
        INSERT INTO public.notifications (user_id, type, title, message, data, priority)
        VALUES (
            p_user_id,
            'low_stock_warning',
            '📦 Lage voorraad: ' || v_item.name,
            'Je hebt nog maar ' || v_item.quantity_approx || ' van ' || v_item.name || '.',
            jsonb_build_object(
                'item_id', v_item.id,
                'item_name', v_item.name,
                'quantity_approx', v_item.quantity_approx
            ),
            1
        );
        v_notifications_created := v_notifications_created + 1;
    END LOOP;
    
    -- Test recipe matches
    FOR v_item IN
        SELECT i.*, get_inventory_recipe_match_count(i.id, p_user_id) as match_count
        FROM public.inventory i
        WHERE i.user_id = p_user_id
        AND get_inventory_recipe_match_count(i.id, p_user_id) >= 3
    LOOP
        v_recipe_match_count := v_recipe_match_count + 1;
        
        INSERT INTO public.notifications (user_id, type, title, message, data, priority)
        VALUES (
            p_user_id,
            'recipe_match_opportunity',
            '⭐ ' || v_item.match_count || ' recepten beschikbaar voor ' || v_item.name,
            'Je ' || v_item.name || ' kan gebruikt worden in ' || v_item.match_count || ' verschillende recepten!',
            jsonb_build_object(
                'item_id', v_item.id,
                'item_name', v_item.name,
                'recipe_match_count', v_item.match_count
            ),
            2
        );
        v_notifications_created := v_notifications_created + 1;
    END LOOP;
    
    -- Return results
    RETURN QUERY SELECT 'expiry_warning'::text, v_expiry_count, 
        (SELECT COUNT(*) FROM public.notifications WHERE user_id = p_user_id AND type = 'expiry_warning' AND created_at > now() - interval '1 minute');
    RETURN QUERY SELECT 'expired_item_alert'::text, v_expired_count,
        (SELECT COUNT(*) FROM public.notifications WHERE user_id = p_user_id AND type = 'expired_item_alert' AND created_at > now() - interval '1 minute');
    RETURN QUERY SELECT 'low_stock_warning'::text, v_low_stock_count,
        (SELECT COUNT(*) FROM public.notifications WHERE user_id = p_user_id AND type = 'low_stock_warning' AND created_at > now() - interval '1 minute');
    RETURN QUERY SELECT 'recipe_match_opportunity'::text, v_recipe_match_count,
        (SELECT COUNT(*) FROM public.notifications WHERE user_id = p_user_id AND type = 'recipe_match_opportunity' AND created_at > now() - interval '1 minute');
END;
$$;

COMMENT ON FUNCTION public.test_create_notifications IS 'Test functie om notificaties te forceren voor een gebruiker (zonder duplicaat checks). Gebruik voor debugging.';

GRANT EXECUTE ON FUNCTION public.test_create_notifications(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_create_notifications(uuid) TO service_role;


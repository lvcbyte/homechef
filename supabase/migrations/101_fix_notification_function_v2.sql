-- ============================================
-- Fix Notification Function V2
-- ============================================
-- Verbeterde versie met return value en betere error handling

-- Drop existing function first (because we're changing return type)
DROP FUNCTION IF EXISTS public.create_all_notifications_for_user(uuid);

CREATE OR REPLACE FUNCTION public.create_all_notifications_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
    v_days_until integer;
    v_match_count integer;
    v_priority integer;
    v_eat_me_first_index numeric;
    v_recipes jsonb;
    v_recipe record;
    v_notifications_created integer := 0;
BEGIN
    -- Check if user has any inventory items
    IF NOT EXISTS (SELECT 1 FROM public.inventory WHERE user_id = p_user_id) THEN
        RETURN 0;
    END IF;

    -- ============================================
    -- 1. EXPIRY WARNINGS (binnen 7 dagen)
    -- ============================================
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND expires_at IS NOT NULL
        AND expires_at <= now() + interval '7 days'
        AND expires_at > now()
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'expiry_warning'
            AND (n.data->>'item_id')::uuid = inventory.id
            AND n.created_at > now() - interval '12 hours'
        )
    LOOP
        BEGIN
            v_days_until := EXTRACT(day FROM (v_item.expires_at - now()))::integer;
            
            -- Bepaal prioriteit
            v_priority := CASE 
                WHEN v_days_until = 0 THEN 4
                WHEN v_days_until = 1 THEN 3
                WHEN v_days_until <= 3 THEN 2
                ELSE 1
            END;
            
            -- Get recipe match count (met error handling)
            BEGIN
                SELECT get_inventory_recipe_match_count(v_item.id, p_user_id) INTO v_match_count;
            EXCEPTION WHEN OTHERS THEN
                v_match_count := 0;
            END;
            
            -- Get suggested recipes (simplified - skip if function doesn't exist)
            v_recipes := '[]'::jsonb;
            
            -- Create expiry warning notification
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                p_user_id,
                'expiry_warning',
                CASE 
                    WHEN v_days_until = 0 THEN '🚨 Vandaag vervalt: ' || v_item.name
                    WHEN v_days_until = 1 THEN '⚠️ Morgen vervalt: ' || v_item.name
                    WHEN v_days_until <= 3 THEN '⏰ Over ' || v_days_until || ' dagen vervalt: ' || v_item.name
                    ELSE '📅 Over ' || v_days_until || ' dagen vervalt: ' || v_item.name
                END,
                CASE 
                    WHEN v_days_until = 0 THEN 'Je ' || v_item.name || ' vervalt vandaag! Gebruik het NU om verspilling te voorkomen.' || 
                        CASE WHEN v_match_count > 0 THEN ' Er zijn ' || v_match_count || ' recepten beschikbaar!' ELSE '' END
                    WHEN v_days_until = 1 THEN 'Je ' || v_item.name || ' vervalt morgen. Plan vandaag nog een recept!' ||
                        CASE WHEN v_match_count > 0 THEN ' Er zijn ' || v_match_count || ' recepten beschikbaar.' ELSE '' END
                    WHEN v_days_until <= 3 THEN 'Je ' || v_item.name || ' vervalt over ' || v_days_until || ' dagen. Bekijk recept suggesties.' ||
                        CASE WHEN v_match_count > 0 THEN ' Er zijn ' || v_match_count || ' recepten beschikbaar.' ELSE '' END
                    ELSE 'Je ' || v_item.name || ' vervalt over ' || v_days_until || ' dagen. Plan tijdig een recept.'
                END,
                jsonb_build_object(
                    'item_id', v_item.id,
                    'item_name', v_item.name,
                    'expires_at', v_item.expires_at,
                    'days_until_expiry', v_days_until,
                    'recipe_match_count', COALESCE(v_match_count, 0),
                    'suggested_recipes', v_recipes
                ),
                v_priority
            );
            
            v_notifications_created := v_notifications_created + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue
            RAISE WARNING 'Error creating expiry warning for item %: %', v_item.id, SQLERRM;
        END;
    END LOOP;
    
    -- ============================================
    -- 2. EXPIRED ITEMS ALERT
    -- ============================================
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND expires_at IS NOT NULL
        AND expires_at <= now()
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'expired_item_alert'
            AND (n.data->>'item_id')::uuid = inventory.id
            AND n.created_at > now() - interval '6 hours'
        )
    LOOP
        BEGIN
            v_days_until := EXTRACT(day FROM (now() - v_item.expires_at))::integer;
            
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                p_user_id,
                'expired_item_alert',
                '❌ Vervallen: ' || v_item.name,
                CASE 
                    WHEN v_days_until = 0 THEN 'Je ' || v_item.name || ' is vandaag vervallen. Controleer of het nog bruikbaar is.'
                    WHEN v_days_until = 1 THEN 'Je ' || v_item.name || ' is gisteren vervallen. Controleer of het nog bruikbaar is.'
                    ELSE 'Je ' || v_item.name || ' is ' || v_days_until || ' dagen geleden vervallen. Verwijder het als het niet meer bruikbaar is.'
                END,
                jsonb_build_object(
                    'item_id', v_item.id,
                    'item_name', v_item.name,
                    'expires_at', v_item.expires_at,
                    'days_expired', v_days_until
                ),
                4
            );
            
            v_notifications_created := v_notifications_created + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creating expired item alert for item %: %', v_item.id, SQLERRM;
        END;
    END LOOP;
    
    -- ============================================
    -- 3. LOW STOCK WARNINGS
    -- ============================================
    FOR v_item IN
        SELECT *
        FROM public.inventory
        WHERE user_id = p_user_id
        AND quantity_approx IS NOT NULL
        AND quantity_approx != ''
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'low_stock_warning'
            AND (n.data->>'item_id')::uuid = inventory.id
            AND n.created_at > now() - interval '2 days'
        )
    LOOP
        BEGIN
            -- Check if quantity is low (1 of 2 stuks)
            IF v_item.quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR 
               v_item.quantity_approx ~ '^[12]\s*$' OR
               LOWER(v_item.quantity_approx) LIKE '%1%' AND (LOWER(v_item.quantity_approx) LIKE '%stuk%' OR LOWER(v_item.quantity_approx) LIKE '%x%') OR
               LOWER(v_item.quantity_approx) LIKE '%2%' AND (LOWER(v_item.quantity_approx) LIKE '%stuk%' OR LOWER(v_item.quantity_approx) LIKE '%x%')
            THEN
                INSERT INTO public.notifications (user_id, type, title, message, data, priority)
                VALUES (
                    p_user_id,
                    'low_stock_warning',
                    '📦 Lage voorraad: ' || v_item.name,
                    'Je hebt nog maar ' || v_item.quantity_approx || ' van ' || v_item.name || 
                    '. Overweeg om meer te kopen bij je volgende boodschappen.',
                    jsonb_build_object(
                        'item_id', v_item.id,
                        'item_name', v_item.name,
                        'quantity_approx', v_item.quantity_approx
                    ),
                    1
                );
                
                v_notifications_created := v_notifications_created + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creating low stock warning for item %: %', v_item.id, SQLERRM;
        END;
    END LOOP;
    
    -- ============================================
    -- 4. RECIPE MATCH OPPORTUNITIES
    -- ============================================
    FOR v_item IN
        SELECT i.*
        FROM public.inventory i
        WHERE i.user_id = p_user_id
        AND (i.expires_at IS NULL OR i.expires_at > now())
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'recipe_match_opportunity'
            AND (n.data->>'item_id')::uuid = i.id
            AND n.created_at > now() - interval '3 days'
        )
    LOOP
        BEGIN
            -- Get match count with error handling
            BEGIN
                SELECT get_inventory_recipe_match_count(v_item.id, p_user_id) INTO v_match_count;
            EXCEPTION WHEN OTHERS THEN
                v_match_count := 0;
            END;
            
            IF v_match_count >= 3 THEN
                INSERT INTO public.notifications (user_id, type, title, message, data, priority)
                VALUES (
                    p_user_id,
                    'recipe_match_opportunity',
                    '⭐ ' || v_match_count || ' recepten beschikbaar voor ' || v_item.name,
                    'Je ' || v_item.name || ' kan gebruikt worden in ' || v_match_count || 
                    ' verschillende recepten! Bekijk de recepten om verspilling te voorkomen.',
                    jsonb_build_object(
                        'item_id', v_item.id,
                        'item_name', v_item.name,
                        'recipe_match_count', v_match_count
                    ),
                    2
                );
                
                v_notifications_created := v_notifications_created + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creating recipe match opportunity for item %: %', v_item.id, SQLERRM;
        END;
    END LOOP;
    
    -- ============================================
    -- 5. EAT-ME-FIRST REMINDERS
    -- ============================================
    FOR v_item IN
        SELECT 
            i.*,
            CASE 
                WHEN i.expires_at IS NULL THEN 999
                WHEN i.expires_at <= now() THEN 0
                ELSE EXTRACT(day FROM (i.expires_at - now()))::integer
            END as days_until_expiry
        FROM public.inventory i
        WHERE i.user_id = p_user_id
        AND i.expires_at IS NOT NULL
        AND i.expires_at > now()
        AND i.expires_at <= now() + interval '14 days'
        AND NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'eat_me_first_reminder'
            AND (n.data->>'item_id')::uuid = i.id
            AND n.created_at > now() - interval '1 day'
        )
    LOOP
        BEGIN
            -- Get match count
            BEGIN
                SELECT get_inventory_recipe_match_count(v_item.id, p_user_id) INTO v_match_count;
            EXCEPTION WHEN OTHERS THEN
                v_match_count := 0;
            END;
            
            -- Bereken Eet-Mij-Eerst-Index
            v_eat_me_first_index := 
                (0.5 * CASE 
                    WHEN v_item.days_until_expiry <= 0 THEN 0
                    WHEN v_item.days_until_expiry <= 3 THEN 10
                    WHEN v_item.days_until_expiry <= 7 THEN 30
                    WHEN v_item.days_until_expiry <= 14 THEN 50
                    ELSE 70
                END) +
                (0.3 * CASE 
                    WHEN v_match_count = 0 THEN 100
                    WHEN v_match_count >= 5 THEN 0
                    ELSE 100 - (v_match_count * 20)
                END) +
                (0.2 * 50);
            
            -- Alleen notificeren als index <= 40
            IF v_eat_me_first_index <= 40 THEN
                INSERT INTO public.notifications (user_id, type, title, message, data, priority)
                VALUES (
                    p_user_id,
                    'eat_me_first_reminder',
                    '🎯 Eet eerst: ' || v_item.name,
                    'Je ' || v_item.name || ' heeft hoge prioriteit! ' ||
                    CASE 
                        WHEN v_item.days_until_expiry <= 3 THEN 'Vervalt binnen ' || v_item.days_until_expiry || ' dagen. '
                        ELSE 'Vervalt over ' || v_item.days_until_expiry || ' dagen. '
                    END ||
                    CASE 
                        WHEN v_match_count > 0 THEN 'Er zijn ' || v_match_count || ' recepten beschikbaar.'
                        ELSE 'Bekijk recept suggesties.'
                    END,
                    jsonb_build_object(
                        'item_id', v_item.id,
                        'item_name', v_item.name,
                        'days_until_expiry', v_item.days_until_expiry,
                        'recipe_match_count', v_match_count,
                        'eat_me_first_index', v_eat_me_first_index
                    ),
                    CASE WHEN v_eat_me_first_index <= 20 THEN 3 ELSE 2 END
                );
                
                v_notifications_created := v_notifications_created + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Error creating eat-me-first reminder for item %: %', v_item.id, SQLERRM;
        END;
    END LOOP;
    
    -- ============================================
    -- 6. DAGELIJKSE SAMENVATTING
    -- ============================================
    BEGIN
        PERFORM public.create_daily_inventory_summary(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error creating daily summary: %', SQLERRM;
    END;
    
    RETURN v_notifications_created;
EXCEPTION
    WHEN OTHERS THEN
        -- Return aantal tot nu toe aangemaakte notificaties
        RETURN v_notifications_created;
END;
$$;

COMMENT ON FUNCTION public.create_all_notifications_for_user IS 'Maakt alle notificaties voor een specifieke gebruiker. Retourneert het aantal aangemaakte notificaties.';

-- Update service function to handle return value
GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO service_role;


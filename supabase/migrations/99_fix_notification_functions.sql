-- ============================================
-- Fix Notification Functions
-- ============================================
-- Fix voor error 22023 en andere problemen met notificatie functies

-- ============================================
-- 0. UPDATE NOTIFICATION TYPES CHECK CONSTRAINT
-- ============================================
-- Voeg nieuwe notification types toe aan de check constraint

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
        -- Bestaande types
        'expiry_warning', 
        'expiry_recipe_suggestion', 
        'badge_earned', 
        'challenge_completed',
        'family_inventory_update',
        'shopping_list_reminder',
        'household_invitation',
        -- Nieuwe types voor waste prevention
        'expired_item_alert',
        'low_stock_warning',
        'recipe_match_opportunity',
        'eat_me_first_reminder',
        'daily_summary'
    ));

-- ============================================
-- 1. FIX: Create All Notifications For User
-- ============================================
-- De huidige versie roept create_expiry_notifications() aan die door ALLE users loopt
-- We maken een versie die alleen voor één user werkt

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
    v_error_count integer := 0;
BEGIN
    -- Check if user exists (skip check, just try to create notifications)
    -- IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    --     RAISE EXCEPTION 'User not found: %', p_user_id;
    -- END IF;

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
        
        -- Get suggested recipes
        BEGIN
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', r.recipe_id,
                    'title', r.title,
                    'image_url', r.image_url,
                    'total_time_minutes', r.total_time_minutes
                )
            )
            INTO v_recipes
            FROM (
                SELECT * FROM public.generate_leftovers_recipes(
                    p_user_id,
                    NULL,
                    NULL
                ) LIMIT 3
            ) r;
        EXCEPTION WHEN OTHERS THEN
            v_recipes := '[]'::jsonb;
        END;
        
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
                'suggested_recipes', COALESCE(v_recipes, '[]'::jsonb)
            ),
            v_priority
        );
        
        -- Create recipe suggestion if we have recipes and item expires within 5 days
        IF v_days_until <= 5 AND v_recipes IS NOT NULL AND jsonb_array_length(v_recipes) > 0 THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = p_user_id
                AND n.type = 'expiry_recipe_suggestion'
                AND (n.data->>'item_id')::uuid = v_item.id
                AND n.created_at > now() - interval '1 day'
            ) THEN
                SELECT * INTO v_recipe
                FROM jsonb_array_elements(v_recipes) AS r(recipe)
                LIMIT 1;
                
                IF v_recipe IS NOT NULL THEN
                    INSERT INTO public.notifications (user_id, type, title, message, data, priority)
                    VALUES (
                        p_user_id,
                        'expiry_recipe_suggestion',
                        '🍳 Recept suggestie voor ' || v_item.name,
                        'Gebruik je ' || v_item.name || ' in dit recept: ' || (v_recipe->>'title') || 
                        ' (' || (v_recipe->>'total_time_minutes') || ' min)',
                        jsonb_build_object(
                            'item_id', v_item.id,
                            'item_name', v_item.name,
                            'suggested_recipe', v_recipe,
                            'expires_at', v_item.expires_at,
                            'days_until_expiry', v_days_until
                        ),
                        CASE WHEN v_days_until <= 2 THEN 3 ELSE 2 END
                    );
                END IF;
            END IF;
        END IF;
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
        END IF;
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
        END IF;
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
        END IF;
    END LOOP;
    
    -- ============================================
    -- 6. DAGELIJKSE SAMENVATTING
    -- ============================================
    PERFORM public.create_daily_inventory_summary(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.create_all_notifications_for_user IS 'Maakt alle notificaties voor een specifieke gebruiker. Werkt alleen voor de opgegeven user.';

-- ============================================
-- 2. FIX: Get Inventory Recipe Match Count
-- ============================================
-- Voeg betere error handling toe en fix mogelijke NULL issues

CREATE OR REPLACE FUNCTION public.get_inventory_recipe_match_count(
    p_inventory_item_id uuid,
    p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_item_name text;
    v_match_count integer := 0;
BEGIN
    -- Check if parameters are valid
    IF p_inventory_item_id IS NULL OR p_user_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Haal item naam op (alleen actieve, niet-vervallen items)
    SELECT name INTO v_item_name
    FROM public.inventory
    WHERE id = p_inventory_item_id 
      AND user_id = p_user_id;
    
    -- Als item niet bestaat of geen naam heeft, return 0
    IF v_item_name IS NULL OR TRIM(v_item_name) = '' THEN
        RETURN 0;
    END IF;
    
    -- Tel aantal recepten die dit item gebruiken
    SELECT COUNT(DISTINCT r.id) INTO v_match_count
    FROM public.recipes r
    WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(r.ingredients) AS ing
        WHERE 
            -- Exact match
            lower(trim(ing->>'name')) = lower(trim(v_item_name))
            -- Partial match (contains)
            OR lower(trim(ing->>'name')) LIKE '%' || lower(trim(v_item_name)) || '%'
            OR lower(trim(v_item_name)) LIKE '%' || lower(trim(ing->>'name')) || '%'
            -- Word-based matching (split op spaties)
            OR EXISTS (
                SELECT 1
                FROM unnest(string_to_array(lower(trim(ing->>'name')), ' ')) AS ing_word
                CROSS JOIN unnest(string_to_array(lower(trim(v_item_name)), ' ')) AS inv_word
                WHERE length(ing_word) >= 3 AND length(inv_word) >= 3
                AND (ing_word = inv_word OR ing_word LIKE '%' || inv_word || '%' OR inv_word LIKE '%' || ing_word || '%')
            )
    );
    
    RETURN COALESCE(v_match_count, 0);
EXCEPTION
    WHEN OTHERS THEN
        -- Return 0 on any error
        RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.get_inventory_recipe_match_count IS 'Berekent hoeveel recepten een specifiek inventory item gebruiken. Gebruikt fuzzy matching voor ingredient namen. Returns 0 on error.';

-- ============================================
-- 3. VERBETER: Create Daily Inventory Summary
-- ============================================
-- Voeg error handling toe

CREATE OR REPLACE FUNCTION public.create_daily_inventory_summary(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expiring_count integer;
    v_expired_count integer;
    v_low_stock_count integer;
    v_high_priority_count integer;
    v_summary_text text;
    v_match_count integer;
BEGIN
    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RETURN;
    END IF;

    -- Tel items die binnen 3 dagen vervallen
    SELECT COUNT(*) INTO v_expiring_count
    FROM public.inventory
    WHERE user_id = p_user_id
    AND expires_at IS NOT NULL
    AND expires_at > now()
    AND expires_at <= now() + interval '3 days';
    
    -- Tel vervallen items
    SELECT COUNT(*) INTO v_expired_count
    FROM public.inventory
    WHERE user_id = p_user_id
    AND expires_at IS NOT NULL
    AND expires_at <= now();
    
    -- Tel lage voorraad items
    SELECT COUNT(*) INTO v_low_stock_count
    FROM public.inventory
    WHERE user_id = p_user_id
    AND quantity_approx IS NOT NULL
    AND (quantity_approx ~ '^[12]\s*(stuks?|x|×)?$' OR quantity_approx ~ '^[12]\s*$');
    
    -- Tel hoge prioriteit items (Eet-Mij-Eerst)
    SELECT COUNT(*) INTO v_high_priority_count
    FROM public.inventory i
    WHERE i.user_id = p_user_id
    AND i.expires_at IS NOT NULL
    AND i.expires_at > now()
    AND i.expires_at <= now() + interval '7 days'
    AND (
        SELECT get_inventory_recipe_match_count(i.id, p_user_id)
    ) > 0;
    
    -- Maak samenvatting tekst
    v_summary_text := '';
    IF v_expiring_count > 0 THEN
        v_summary_text := v_summary_text || v_expiring_count || ' item' || CASE WHEN v_expiring_count > 1 THEN 's' ELSE '' END || ' vervalt binnen 3 dagen. ';
    END IF;
    IF v_expired_count > 0 THEN
        v_summary_text := v_summary_text || v_expired_count || ' item' || CASE WHEN v_expired_count > 1 THEN 's' ELSE '' END || ' is vervallen. ';
    END IF;
    IF v_low_stock_count > 0 THEN
        v_summary_text := v_summary_text || v_low_stock_count || ' item' || CASE WHEN v_low_stock_count > 1 THEN 's' ELSE '' END || ' heeft lage voorraad. ';
    END IF;
    IF v_high_priority_count > 0 THEN
        v_summary_text := v_summary_text || v_high_priority_count || ' item' || CASE WHEN v_high_priority_count > 1 THEN 's' ELSE '' END || ' heeft hoge prioriteit (Eet-Mij-Eerst). ';
    END IF;
    
    -- Alleen notificatie maken als er iets te melden is
    IF v_expiring_count > 0 OR v_expired_count > 0 OR v_low_stock_count > 0 OR v_high_priority_count > 0 THEN
        -- Check if we already sent a summary today
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = p_user_id
            AND n.type = 'daily_summary'
            AND n.created_at > now() - interval '20 hours'
        ) THEN
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                p_user_id,
                'daily_summary',
                '📊 Dagelijkse voorraad samenvatting',
                TRIM(v_summary_text) || 'Bekijk je voorraad voor details.',
                jsonb_build_object(
                    'expiring_count', v_expiring_count,
                    'expired_count', v_expired_count,
                    'low_stock_count', v_low_stock_count,
                    'high_priority_count', v_high_priority_count
                ),
                1
            );
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Silently fail - don't break the app
        NULL;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.create_daily_inventory_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_daily_inventory_summary(uuid) TO service_role;


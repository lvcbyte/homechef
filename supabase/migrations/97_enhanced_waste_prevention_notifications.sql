-- ============================================
-- Enhanced Waste Prevention Notifications
-- ============================================
-- Uitgebreid notificatiesysteem om voedselverspilling te minimaliseren
-- Meer proactieve meldingen gebaseerd op inventory status

-- ============================================
-- 1. VERBETER: CREATE EXPIRY NOTIFICATIONS
-- ============================================
-- Uitgebreide versie die meer soorten meldingen maakt

CREATE OR REPLACE FUNCTION public.create_expiry_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user record;
    v_item record;
    v_days_until integer;
    v_recipes jsonb;
    v_recipe record;
    v_match_count integer;
    v_priority integer;
    v_eat_me_first_index numeric;
BEGIN
    -- Get all users with inventory items
    FOR v_user IN 
        SELECT DISTINCT user_id 
        FROM public.inventory
    LOOP
        -- ============================================
        -- 1. EXPIRY WARNINGS (binnen 7 dagen)
        -- ============================================
        FOR v_item IN
            SELECT *
            FROM public.inventory
            WHERE user_id = v_user.user_id
            AND expires_at IS NOT NULL
            AND expires_at <= now() + interval '7 days'
            AND expires_at > now()
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = v_user.user_id
                AND n.type = 'expiry_warning'
                AND (n.data->>'item_id')::uuid = inventory.id
                AND n.created_at > now() - interval '12 hours'
            )
        LOOP
            v_days_until := EXTRACT(day FROM (v_item.expires_at - now()))::integer;
            
            -- Bepaal prioriteit op basis van dagen
            v_priority := CASE 
                WHEN v_days_until = 0 THEN 4  -- Vandaag = hoogste prioriteit
                WHEN v_days_until = 1 THEN 3  -- Morgen = zeer hoog
                WHEN v_days_until <= 3 THEN 2 -- Binnen 3 dagen = hoog
                ELSE 1                         -- Binnen 7 dagen = normaal
            END;
            
            -- Get recipe match count
            SELECT get_inventory_recipe_match_count(v_item.id, v_user.user_id) INTO v_match_count;
            
            -- Get suggested recipes
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
                    v_user.user_id,
                    NULL,
                    NULL
                ) LIMIT 3
            ) r;
            
            -- Create expiry warning notification
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                v_user.user_id,
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
                    'recipe_match_count', v_match_count,
                    'suggested_recipes', COALESCE(v_recipes, '[]'::jsonb)
                ),
                v_priority
            );
            
            -- Create recipe suggestion if we have recipes and item expires within 5 days
            IF v_days_until <= 5 AND v_recipes IS NOT NULL AND jsonb_array_length(v_recipes) > 0 THEN
                -- Check if we already sent a recipe suggestion today for this item
                IF NOT EXISTS (
                    SELECT 1 FROM public.notifications n
                    WHERE n.user_id = v_user.user_id
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
                            v_user.user_id,
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
            WHERE user_id = v_user.user_id
            AND expires_at IS NOT NULL
            AND expires_at <= now()
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = v_user.user_id
                AND n.type = 'expired_item_alert'
                AND (n.data->>'item_id')::uuid = inventory.id
                AND n.created_at > now() - interval '6 hours'
            )
        LOOP
            v_days_until := EXTRACT(day FROM (now() - v_item.expires_at))::integer;
            
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                v_user.user_id,
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
                4  -- Hoge prioriteit
            );
        END LOOP;
        
        -- ============================================
        -- 3. LOW STOCK WARNINGS
        -- ============================================
        FOR v_item IN
            SELECT *
            FROM public.inventory
            WHERE user_id = v_user.user_id
            AND quantity_approx IS NOT NULL
            AND quantity_approx != ''
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = v_user.user_id
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
                    v_user.user_id,
                    'low_stock_warning',
                    '📦 Lage voorraad: ' || v_item.name,
                    'Je hebt nog maar ' || v_item.quantity_approx || ' van ' || v_item.name || 
                    '. Overweeg om meer te kopen bij je volgende boodschappen.',
                    jsonb_build_object(
                        'item_id', v_item.id,
                        'item_name', v_item.name,
                        'quantity_approx', v_item.quantity_approx
                    ),
                    1  -- Normale prioriteit
                );
            END IF;
        END LOOP;
        
        -- ============================================
        -- 4. RECIPE MATCH OPPORTUNITIES
        -- ============================================
        -- Items met veel recept matches die nog niet gebruikt zijn
        FOR v_item IN
            SELECT i.*, get_inventory_recipe_match_count(i.id, v_user.user_id) as match_count
            FROM public.inventory i
            WHERE i.user_id = v_user.user_id
            AND (i.expires_at IS NULL OR i.expires_at > now())
            AND get_inventory_recipe_match_count(i.id, v_user.user_id) >= 3
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = v_user.user_id
                AND n.type = 'recipe_match_opportunity'
                AND (n.data->>'item_id')::uuid = i.id
                AND n.created_at > now() - interval '3 days'
            )
        LOOP
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                v_user.user_id,
                'recipe_match_opportunity',
                '⭐ ' || v_item.match_count || ' recepten beschikbaar voor ' || v_item.name,
                'Je ' || v_item.name || ' kan gebruikt worden in ' || v_item.match_count || 
                ' verschillende recepten! Bekijk de recepten om verspilling te voorkomen.',
                jsonb_build_object(
                    'item_id', v_item.id,
                    'item_name', v_item.name,
                    'recipe_match_count', v_item.match_count
                ),
                2  -- Hoge prioriteit
            );
        END LOOP;
        
        -- ============================================
        -- 5. EAT-ME-FIRST REMINDERS
        -- ============================================
        -- Items met hoge Eet-Mij-Eerst-Index (lage score = hoge prioriteit)
        FOR v_item IN
            SELECT 
                i.*,
                EXTRACT(day FROM (i.expires_at - now()))::integer as days_until,
                get_inventory_recipe_match_count(i.id, v_user.user_id) as match_count,
                CASE 
                    WHEN i.expires_at IS NULL THEN 999
                    WHEN i.expires_at <= now() THEN 0
                    ELSE EXTRACT(day FROM (i.expires_at - now()))::integer
                END as days_until_expiry
            FROM public.inventory i
            WHERE i.user_id = v_user.user_id
            AND i.expires_at IS NOT NULL
            AND i.expires_at > now()
            AND i.expires_at <= now() + interval '14 days'
            AND NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = v_user.user_id
                AND n.type = 'eat_me_first_reminder'
                AND (n.data->>'item_id')::uuid = i.id
                AND n.created_at > now() - interval '1 day'
            )
        LOOP
            -- Bereken Eet-Mij-Eerst-Index (vereenvoudigd)
            v_eat_me_first_index := 
                (0.5 * CASE 
                    WHEN v_item.days_until_expiry <= 0 THEN 0
                    WHEN v_item.days_until_expiry <= 3 THEN 10
                    WHEN v_item.days_until_expiry <= 7 THEN 30
                    WHEN v_item.days_until_expiry <= 14 THEN 50
                    ELSE 70
                END) +
                (0.3 * CASE 
                    WHEN v_item.match_count = 0 THEN 100
                    WHEN v_item.match_count >= 5 THEN 0
                    ELSE 100 - (v_item.match_count * 20)
                END) +
                (0.2 * 50); -- Default stock level
            
            -- Alleen notificeren als index <= 40 (hoge prioriteit)
            IF v_eat_me_first_index <= 40 THEN
                INSERT INTO public.notifications (user_id, type, title, message, data, priority)
                VALUES (
                    v_user.user_id,
                    'eat_me_first_reminder',
                    '🎯 Eet eerst: ' || v_item.name,
                    'Je ' || v_item.name || ' heeft hoge prioriteit! ' ||
                    CASE 
                        WHEN v_item.days_until_expiry <= 3 THEN 'Vervalt binnen ' || v_item.days_until_expiry || ' dagen. '
                        ELSE 'Vervalt over ' || v_item.days_until_expiry || ' dagen. '
                    END ||
                    CASE 
                        WHEN v_item.match_count > 0 THEN 'Er zijn ' || v_item.match_count || ' recepten beschikbaar.'
                        ELSE 'Bekijk recept suggesties.'
                    END,
                    jsonb_build_object(
                        'item_id', v_item.id,
                        'item_name', v_item.name,
                        'days_until_expiry', v_item.days_until_expiry,
                        'recipe_match_count', v_item.match_count,
                        'eat_me_first_index', v_eat_me_first_index
                    ),
                    CASE WHEN v_eat_me_first_index <= 20 THEN 3 ELSE 2 END
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_expiry_notifications IS 'Uitgebreide functie die meerdere soorten notificaties maakt: expiry warnings, expired items, low stock, recipe matches, en eat-me-first reminders. Run als cron job (elke 6-12 uur).';

-- ============================================
-- 2. DAGELIJKSE SAMENVATTING FUNCTIE
-- ============================================

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
BEGIN
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
    AND get_inventory_recipe_match_count(i.id, p_user_id) > 0;
    
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
                1  -- Normale prioriteit
            );
        END IF;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.create_daily_inventory_summary IS 'Maakt een dagelijkse samenvatting van inventory status voor een gebruiker. Run dagelijks in de ochtend.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_daily_inventory_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_daily_inventory_summary(uuid) TO service_role;

-- ============================================
-- 3. VERBETER TRIGGER VOOR AUTOMATISCHE NOTIFICATIES
-- ============================================

CREATE OR REPLACE FUNCTION public.check_and_create_expiry_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_days_until integer;
    v_match_count integer;
BEGIN
    -- Check voor expiry warnings (binnen 7 dagen)
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at > now() AND NEW.expires_at <= now() + interval '7 days' THEN
        v_days_until := EXTRACT(day FROM (NEW.expires_at - now()))::integer;
        
        -- Create notification voor items binnen 7 dagen (niet alleen 3)
        IF v_days_until <= 7 THEN
            -- Check if notification already exists
            IF NOT EXISTS (
                SELECT 1 FROM public.notifications n
                WHERE n.user_id = NEW.user_id
                AND n.type = 'expiry_warning'
                AND (n.data->>'item_id')::uuid = NEW.id
                AND n.created_at > now() - interval '12 hours'
            ) THEN
                -- Get recipe match count
                SELECT get_inventory_recipe_match_count(NEW.id, NEW.user_id) INTO v_match_count;
                
                INSERT INTO public.notifications (user_id, type, title, message, data, priority)
                VALUES (
                    NEW.user_id,
                    'expiry_warning',
                    CASE 
                        WHEN v_days_until = 0 THEN '🚨 Vandaag vervalt: ' || NEW.name
                        WHEN v_days_until = 1 THEN '⚠️ Morgen vervalt: ' || NEW.name
                        WHEN v_days_until <= 3 THEN '⏰ Over ' || v_days_until || ' dagen vervalt: ' || NEW.name
                        ELSE '📅 Over ' || v_days_until || ' dagen vervalt: ' || NEW.name
                    END,
                    CASE 
                        WHEN v_days_until = 0 THEN 'Je ' || NEW.name || ' vervalt vandaag! Gebruik het NU om verspilling te voorkomen.' ||
                            CASE WHEN v_match_count > 0 THEN ' Er zijn ' || v_match_count || ' recepten beschikbaar!' ELSE '' END
                        WHEN v_days_until = 1 THEN 'Je ' || NEW.name || ' vervalt morgen. Plan vandaag nog een recept!' ||
                            CASE WHEN v_match_count > 0 THEN ' Er zijn ' || v_match_count || ' recepten beschikbaar.' ELSE '' END
                        ELSE 'Je ' || NEW.name || ' vervalt over ' || v_days_until || ' dagen. Plan tijdig een recept.' ||
                            CASE WHEN v_match_count > 0 THEN ' Er zijn ' || v_match_count || ' recepten beschikbaar.' ELSE '' END
                    END,
                    jsonb_build_object(
                        'item_id', NEW.id,
                        'item_name', NEW.name,
                        'expires_at', NEW.expires_at,
                        'days_until_expiry', v_days_until,
                        'recipe_match_count', v_match_count
                    ),
                    CASE 
                        WHEN v_days_until = 0 THEN 4
                        WHEN v_days_until = 1 THEN 3
                        WHEN v_days_until <= 3 THEN 2
                        ELSE 1
                    END
                );
            END IF;
        END IF;
    END IF;
    
    -- Check voor expired items
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.user_id = NEW.user_id
            AND n.type = 'expired_item_alert'
            AND (n.data->>'item_id')::uuid = NEW.id
            AND n.created_at > now() - interval '6 hours'
        ) THEN
            v_days_until := EXTRACT(day FROM (now() - NEW.expires_at))::integer;
            
            INSERT INTO public.notifications (user_id, type, title, message, data, priority)
            VALUES (
                NEW.user_id,
                'expired_item_alert',
                '❌ Vervallen: ' || NEW.name,
                'Je ' || NEW.name || ' is vervallen. Controleer of het nog bruikbaar is of verwijder het.',
                jsonb_build_object(
                    'item_id', NEW.id,
                    'item_name', NEW.name,
                    'expires_at', NEW.expires_at,
                    'days_expired', v_days_until
                ),
                4
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update trigger
DROP TRIGGER IF EXISTS trigger_check_expiry_notification ON public.inventory;
CREATE TRIGGER trigger_check_expiry_notification
    AFTER INSERT OR UPDATE OF expires_at, quantity_approx ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION check_and_create_expiry_notification();

COMMENT ON FUNCTION public.check_and_create_expiry_notification IS 'Trigger functie die automatisch notificaties maakt bij inventory wijzigingen. Checkt expiry warnings, expired items, en andere alerts.';

-- ============================================
-- 4. FUNCTIE OM ALLE NOTIFICATIES TE CREËREN VOOR EEN GEBRUIKER
-- ============================================

CREATE OR REPLACE FUNCTION public.create_all_notifications_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Roep de uitgebreide expiry notifications functie aan
    -- (deze werkt per user via de loop)
    PERFORM public.create_expiry_notifications();
    
    -- Maak dagelijkse samenvatting
    PERFORM public.create_daily_inventory_summary(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.create_all_notifications_for_user IS 'Maakt alle notificaties voor een specifieke gebruiker. Handig voor manual triggers.';

GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_all_notifications_for_user(uuid) TO service_role;


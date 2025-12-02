-- ============================================
-- Slimme Gebruiksprioriteit - Eet-Mij-Eerst-Index
-- ============================================
-- Deze migratie voegt functionaliteit toe voor intelligente sortering
-- van inventory items op basis van vervaldatum, recept matches en voorraad niveau.

-- ============================================
-- 1. FUNCTIE: Get Inventory Recipe Match Count
-- ============================================
-- Berekent hoeveel recepten een specifiek inventory item gebruiken
-- Gebruikt dezelfde matching logica als match_recipes_with_inventory

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
    -- Haal item naam op (alleen actieve, niet-vervallen items)
    SELECT name INTO v_item_name
    FROM public.inventory
    WHERE id = p_inventory_item_id 
      AND user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > now());
    
    IF v_item_name IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Tel aantal recepten die dit item gebruiken
    -- Gebruik dezelfde matching logica als match_recipes_with_inventory
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
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_recipe_match_count(uuid, uuid) TO anon;

COMMENT ON FUNCTION public.get_inventory_recipe_match_count IS 'Berekent hoeveel recepten een specifiek inventory item gebruiken. Gebruikt fuzzy matching voor ingredient namen.';

-- ============================================
-- 2. VERBETER: Estimate Expiry Date
-- ============================================
-- Verbeterde versie met product-specifieke logica en purchase_date support
-- Drop ALL bestaande versies eerst om conflicten te voorkomen

DROP FUNCTION IF EXISTS public.estimate_expiry_date(text, timestamptz, text, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.estimate_expiry_date(text, timestamptz, text) CASCADE;
DROP FUNCTION IF EXISTS public.estimate_expiry_date(text, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.estimate_expiry_date(text) CASCADE;

-- Hoofdfunctie met alle parameters (intern gebruikt)
CREATE OR REPLACE FUNCTION public._estimate_expiry_date_internal(
    category_slug text,
    base_date timestamptz,
    product_name text DEFAULT NULL,
    purchase_date timestamptz DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    days_to_add integer;
    actual_base_date timestamptz;
BEGIN
    -- Gebruik purchase_date als beschikbaar, anders base_date
    actual_base_date := COALESCE(purchase_date, base_date);
    
    -- FAVV/HACCP norms + product-specifieke logica
    CASE category_slug
        -- Highly perishable (1-3 days)
        WHEN 'proteins' THEN 
            -- Check if it's processed meat (longer shelf life)
            IF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%gerookt%' OR 
                lower(product_name) LIKE '%gedroogd%' OR
                lower(product_name) LIKE '%worst%' OR
                lower(product_name) LIKE '%salami%' OR
                lower(product_name) LIKE '%ham%'
            ) THEN
                days_to_add := 5; -- Processed meats last longer
            ELSE
                days_to_add := 2; -- Fresh meat
            END IF;
        WHEN 'seafood' THEN days_to_add := 1;
        
        -- Perishable (3-7 days)
        WHEN 'dairy_eggs' THEN 
            IF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%kaas%' OR
                lower(product_name) LIKE '%cheese%'
            ) THEN
                days_to_add := 14; -- Cheese lasts longer
            ELSIF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%yoghurt%' OR
                lower(product_name) LIKE '%yogurt%'
            ) THEN
                days_to_add := 7; -- Yogurt
            ELSIF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%melk%' OR
                lower(product_name) LIKE '%milk%'
            ) THEN
                days_to_add := 5; -- Milk
            ELSE
                days_to_add := 5; -- Default dairy
            END IF;
        WHEN 'fresh_produce' THEN 
            IF product_name IS NOT NULL AND (
                lower(product_name) LIKE '%appel%' OR
                lower(product_name) LIKE '%apple%' OR
                lower(product_name) LIKE '%wortel%' OR
                lower(product_name) LIKE '%carrot%' OR
                lower(product_name) LIKE '%ui%' OR
                lower(product_name) LIKE '%onion%' OR
                lower(product_name) LIKE '%aardappel%' OR
                lower(product_name) LIKE '%potato%'
            ) THEN
                days_to_add := 14; -- Hard vegetables/fruits
            ELSE
                days_to_add := 5; -- Soft produce
            END IF;
        WHEN 'ready_meals' THEN days_to_add := 2;
        
        -- Short shelf life (2-5 days)
        WHEN 'bakery' THEN days_to_add := 3;
        
        -- Long shelf life (weeks to months)
        WHEN 'pantry' THEN days_to_add := 90;
        WHEN 'spices_condiments' THEN days_to_add := 180;
        WHEN 'snacks' THEN days_to_add := 60;
        WHEN 'beverages' THEN days_to_add := 180;
        
        -- Very long shelf life
        WHEN 'frozen' THEN days_to_add := 180;
        WHEN 'baby' THEN days_to_add := 30;
        WHEN 'personal_care' THEN days_to_add := 365;
        WHEN 'household' THEN days_to_add := 365;
        
        -- Default: 7 days for unknown categories
        ELSE days_to_add := 7;
    END CASE;
    
    RETURN actual_base_date + (days_to_add || ' days')::interval;
END;
$$;

-- Overloaded versies voor backward compatibility
-- Versie 1: Alleen category_slug
CREATE OR REPLACE FUNCTION public.estimate_expiry_date(
    category_slug text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN public._estimate_expiry_date_internal(
        category_slug,
        timezone('utc', now()),
        NULL,
        NULL
    );
END;
$$;

-- Versie 2: category_slug + base_date
CREATE OR REPLACE FUNCTION public.estimate_expiry_date(
    category_slug text,
    base_date timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN public._estimate_expiry_date_internal(
        category_slug,
        base_date,
        NULL,
        NULL
    );
END;
$$;

-- Versie 3: category_slug + base_date + product_name
CREATE OR REPLACE FUNCTION public.estimate_expiry_date(
    category_slug text,
    base_date timestamptz,
    product_name text
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN public._estimate_expiry_date_internal(
        category_slug,
        base_date,
        product_name,
        NULL
    );
END;
$$;

-- Versie 4: Alle parameters
CREATE OR REPLACE FUNCTION public.estimate_expiry_date(
    category_slug text,
    base_date timestamptz,
    product_name text,
    purchase_date timestamptz
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN public._estimate_expiry_date_internal(
        category_slug,
        base_date,
        product_name,
        purchase_date
    );
END;
$$;

-- Comments voor alle versies
COMMENT ON FUNCTION public.estimate_expiry_date(text) IS 'Berekent geschatte vervaldatum op basis van categorie. Ondersteunt product-specifieke logica voor betere schattingen.';
COMMENT ON FUNCTION public.estimate_expiry_date(text, timestamptz) IS 'Berekent geschatte vervaldatum op basis van categorie en base datum. Ondersteunt product-specifieke logica voor betere schattingen.';
COMMENT ON FUNCTION public.estimate_expiry_date(text, timestamptz, text) IS 'Berekent geschatte vervaldatum op basis van categorie, base datum en product naam. Ondersteunt product-specifieke logica voor betere schattingen.';
COMMENT ON FUNCTION public.estimate_expiry_date(text, timestamptz, text, timestamptz) IS 'Berekent geschatte vervaldatum op basis van categorie, base datum, product naam en purchase datum. Ondersteunt product-specifieke logica voor betere schattingen.';

-- Grant permissions (voor alle signatures)
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text) TO anon;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text, timestamptz, text) TO anon;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text, timestamptz, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estimate_expiry_date(text, timestamptz, text, timestamptz) TO anon;


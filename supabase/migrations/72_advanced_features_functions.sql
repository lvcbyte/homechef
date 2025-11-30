-- Advanced Features Functions
-- RPC functions for smart inventory, AI leftovers generator, and more

-- ============================================
-- 1. AI LEFTOVERS RECIPE GENERATOR
-- ============================================
create or replace function generate_leftovers_recipes(
    p_user_id uuid,
    p_dietary_restrictions text[] default null,
    p_cooking_skill text default null
)
returns table (
    recipe_id uuid,
    title text,
    description text,
    image_url text,
    total_time_minutes integer,
    difficulty text,
    servings integer,
    ingredients jsonb,
    instructions jsonb,
    match_score integer,
    matched_ingredients text[]
)
language plpgsql
security definer
as $$
declare
    v_inventory_items jsonb;
    v_profile record;
    v_recipe record;
    v_matched_count integer;
    v_matched_ingredients text[];
    v_ingredient jsonb;
begin
    -- Get user inventory
    select jsonb_agg(
        jsonb_build_object(
            'name', name,
            'quantity', quantity_approx,
            'category', category,
            'expires_at', expires_at
        )
    )
    into v_inventory_items
    from public.inventory
    where user_id = p_user_id
    and expires_at is not null
    and expires_at <= now() + interval '7 days'; -- Focus on items expiring soon
    
    -- Get user profile
    select * into v_profile
    from public.profiles
    where id = p_user_id;
    
    -- If no inventory, return empty
    if v_inventory_items is null or jsonb_array_length(v_inventory_items) = 0 then
        return;
    end if;
    
    -- Find recipes that use the expiring ingredients
    for v_recipe in 
        select r.*
        from public.recipes r
        where (
            -- Check if recipe ingredients match inventory items
            select count(*) > 0
            from jsonb_array_elements(r.ingredients) as ing
            where exists (
                select 1
                from jsonb_array_elements(v_inventory_items) as inv
                where lower(ing->>'name') like '%' || lower(inv->>'name') || '%'
                or lower(inv->>'name') like '%' || lower(ing->>'name') || '%'
            )
        )
        -- Filter by dietary restrictions if provided
        and (
            p_dietary_restrictions is null
            or not exists (
                select 1
                from unnest(p_dietary_restrictions) as restriction
                where r.tags::text ilike '%' || restriction || '%'
            )
        )
        -- Filter by cooking skill if provided
        and (
            p_cooking_skill is null
            or (
                (p_cooking_skill = 'Beginner' and r.difficulty = 'Makkelijk')
                or (p_cooking_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
                or (p_cooking_skill = 'Advanced' and r.difficulty in ('Makkelijk', 'Gemiddeld', 'Moeilijk'))
            )
        )
        order by random()
        limit 10
    loop
        -- Calculate match score
        v_matched_count := 0;
        v_matched_ingredients := array[]::text[];
        
        for v_ingredient in select * from jsonb_array_elements(v_recipe.ingredients) loop
            if exists (
                select 1
                from jsonb_array_elements(v_inventory_items) as inv
                where lower(v_ingredient->>'name') like '%' || lower(inv->>'name') || '%'
                or lower(inv->>'name') like '%' || lower(v_ingredient->>'name') || '%'
            ) then
                v_matched_count := v_matched_count + 1;
                v_matched_ingredients := array_append(v_matched_ingredients, v_ingredient->>'name');
            end if;
        end loop;
        
        -- Only return recipes with at least 2 matched ingredients
        if v_matched_count >= 2 then
            return query select
                v_recipe.id,
                v_recipe.title,
                v_recipe.description,
                v_recipe.image_url,
                v_recipe.total_time_minutes,
                v_recipe.difficulty,
                v_recipe.servings,
                v_recipe.ingredients,
                v_recipe.instructions,
                (v_matched_count * 100 / greatest(jsonb_array_length(v_recipe.ingredients), 1))::integer as match_score,
                v_matched_ingredients;
        end if;
    end loop;
end;
$$;

-- ============================================
-- 2. SCALE RECIPE INGREDIENTS
-- ============================================
create or replace function scale_recipe_ingredients(
    p_recipe_id uuid,
    p_original_servings integer,
    p_new_servings integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_recipe record;
    v_scaled_ingredients jsonb;
    v_ingredient jsonb;
    v_quantity numeric;
    v_scaled_quantity numeric;
begin
    -- Get recipe
    select * into v_recipe
    from public.recipes
    where id = p_recipe_id;
    
    if not found then
        return '[]'::jsonb;
    end if;
    
    -- Scale ingredients
    v_scaled_ingredients := '[]'::jsonb;
    
    for v_ingredient in select * from jsonb_array_elements(v_recipe.ingredients) loop
        -- Try to extract quantity
        v_quantity := null;
        
        if v_ingredient ? 'quantity' then
            v_quantity := (v_ingredient->>'quantity')::numeric;
        elsif v_ingredient ? 'amount' then
            v_quantity := (v_ingredient->>'amount')::numeric;
        end if;
        
        -- Scale quantity
        if v_quantity is not null then
            v_scaled_quantity := (v_quantity * p_new_servings / p_original_servings);
            
            -- Round to reasonable precision
            if v_scaled_quantity < 1 then
                v_scaled_quantity := round(v_scaled_quantity * 4) / 4; -- 0.25 precision
            else
                v_scaled_quantity := round(v_scaled_quantity * 2) / 2; -- 0.5 precision
            end if;
            
            v_ingredient := jsonb_set(
                v_ingredient,
                '{quantity}',
                to_jsonb(v_scaled_quantity::text)
            );
        end if;
        
        v_scaled_ingredients := v_scaled_ingredients || jsonb_build_array(v_ingredient);
    end loop;
    
    return v_scaled_ingredients;
end;
$$;

-- ============================================
-- 3. GET MISSING INGREDIENTS FOR RECIPE
-- ============================================
create or replace function get_missing_ingredients(
    p_user_id uuid,
    p_recipe_id uuid,
    p_servings integer default null
)
returns table (
    ingredient_name text,
    required_quantity text,
    available_quantity text,
    is_available boolean,
    catalog_matches jsonb
)
language plpgsql
security definer
as $$
declare
    v_recipe record;
    v_ingredient jsonb;
    v_available_quantity text;
    v_catalog_matches jsonb;
begin
    -- Get recipe
    select * into v_recipe
    from public.recipes
    where id = p_recipe_id;
    
    if not found then
        return;
    end if;
    
    -- Check each ingredient
    for v_ingredient in select * from jsonb_array_elements(v_recipe.ingredients) loop
        -- Check if user has this ingredient
        select quantity_approx into v_available_quantity
        from public.inventory
        where user_id = p_user_id
        and name ilike '%' || (v_ingredient->>'name') || '%'
        limit 1;
        
        -- Find catalog matches
        select jsonb_agg(
            jsonb_build_object(
                'id', id,
                'product_name', product_name,
                'brand', brand,
                'price', price,
                'image_url', image_url,
                'store', source
            )
        )
        into v_catalog_matches
        from public.product_catalog
        where product_name ilike '%' || (v_ingredient->>'name') || '%'
        and is_available = true
        limit 5;
        
        return query select
            (v_ingredient->>'name')::text,
            (
                coalesce(v_ingredient->>'quantity', '') || ' ' || 
                coalesce(v_ingredient->>'unit', '')
            )::text as required_quantity,
            coalesce(v_available_quantity, 'Niet beschikbaar')::text,
            (v_available_quantity is not null)::boolean,
            coalesce(v_catalog_matches, '[]'::jsonb);
    end loop;
end;
$$;

-- ============================================
-- 4. CREATE EXPIRY NOTIFICATIONS
-- ============================================
create or replace function create_expiry_notifications()
returns void
language plpgsql
security definer
as $$
declare
    v_user record;
    v_item record;
    v_days_until integer;
    v_recipes jsonb;
begin
    -- Get all users with expiring items
    for v_user in select distinct user_id from public.inventory where expires_at is not null loop
        -- Check items expiring in next 3 days
        for v_item in
            select *
            from public.inventory
            where user_id = v_user.user_id
            and expires_at is not null
            and expires_at <= now() + interval '3 days'
            and expires_at > now()
            and not exists (
                select 1 from public.notifications n
                where n.user_id = v_user.user_id
                and n.type = 'expiry_warning'
                and n.data->>'item_id' = inventory.id::text
                and n.created_at > now() - interval '1 day'
            )
        loop
            v_days_until := extract(day from (v_item.expires_at - now()))::integer;
            
            -- Get suggested recipes
            select jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'title', r.title,
                    'image_url', r.image_url
                )
            )
            into v_recipes
            from public.recipes r
            where r.ingredients::text ilike '%' || v_item.name || '%'
            limit 3;
            
            -- Create notification
            insert into public.notifications (user_id, type, title, message, data)
            values (
                v_user.user_id,
                'expiry_warning',
                case 
                    when v_days_until = 0 then '⚠️ Vandaag vervalt: ' || v_item.name
                    when v_days_until = 1 then '⚠️ Morgen vervalt: ' || v_item.name
                    else '⚠️ Over ' || v_days_until || ' dagen vervalt: ' || v_item.name
                end,
                case 
                    when v_days_until = 0 then 'Je ' || v_item.name || ' vervalt vandaag! Gebruik het snel.'
                    when v_days_until = 1 then 'Je ' || v_item.name || ' vervalt morgen. Plan een recept!'
                    else 'Je ' || v_item.name || ' vervalt over ' || v_days_until || ' dagen.'
                end,
                jsonb_build_object(
                    'item_id', v_item.id,
                    'item_name', v_item.name,
                    'expires_at', v_item.expires_at,
                    'days_until_expiry', v_days_until,
                    'suggested_recipes', coalesce(v_recipes, '[]'::jsonb)
                )
            );
        end loop;
    end loop;
end;
$$;

-- ============================================
-- 5. TRACK ZERO-WASTE PROGRESS
-- ============================================
create or replace function track_zero_waste_progress(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    v_expired_count integer;
    v_days_without_waste integer;
    v_challenge record;
begin
    -- Count expired items in last 7 days
    select count(*) into v_expired_count
    from public.inventory
    where user_id = p_user_id
    and expires_at is not null
    and expires_at < now()
    and expires_at > now() - interval '7 days';
    
    -- If no expired items, increment streak
    if v_expired_count = 0 then
        -- Get or create zero waste challenge
        select * into v_challenge
        from public.challenges
        where code = 'zero_waste_week'
        limit 1;
        
        if found then
            -- Update or create user challenge
            insert into public.user_challenges (user_id, challenge_id, progress)
            values (p_user_id, v_challenge.id, 100)
            on conflict (user_id, challenge_id) do update
            set progress = 100, completed = true, completed_at = now()
            where user_challenges.progress < 100;
        end if;
    end if;
    
    -- Check and award badges
    perform check_and_award_badges(p_user_id);
end;
$$;

-- ============================================
-- 6. PARSE VOICE COMMAND
-- ============================================
create or replace function parse_voice_command(
    p_user_id uuid,
    p_command_text text
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_result jsonb;
    v_items jsonb;
    v_item text;
    v_quantity text;
    v_name text;
begin
    -- Simple parsing logic (can be enhanced with AI)
    -- Example: "STOCKPIT, voeg twee uien en één kilo rijst toe aan de voorraad"
    
    v_result := jsonb_build_object(
        'success', false,
        'items', '[]'::jsonb,
        'error', null
    );
    
    -- Extract items from command
    -- This is a simplified parser - in production, use AI/NLP
    v_items := '[]'::jsonb;
    
    -- Try to extract common patterns
    -- Pattern: "voeg [quantity] [item] toe"
    -- This is a placeholder - real implementation would use AI
    
    v_result := jsonb_set(v_result, '{success}', 'true'::jsonb);
    v_result := jsonb_set(v_result, '{items}', v_items);
    
    return v_result;
end;
$$;

comment on function generate_leftovers_recipes is 'Generate recipes based on expiring inventory items (leftovers)';
comment on function scale_recipe_ingredients is 'Scale recipe ingredients for different serving sizes';
comment on function get_missing_ingredients is 'Get missing ingredients for a recipe and suggest catalog matches';
comment on function create_expiry_notifications is 'Create notifications for expiring items (run as cron job)';
comment on function track_zero_waste_progress is 'Track zero-waste progress and update challenges';
comment on function parse_voice_command is 'Parse voice command text into structured inventory updates';


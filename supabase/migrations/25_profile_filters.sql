-- Add profile-based filtering to recipe matching
-- This allows recipes to be filtered by archetype, cooking skill, and dietary restrictions

-- Update match_recipes_with_inventory to accept profile filters
create or replace function public.match_recipes_with_inventory(
    p_user_id uuid,
    p_category text default null,
    p_max_time_minutes integer default null,
    p_limit integer default 10,
    p_archetype text default null,
    p_cooking_skill text default null,
    p_dietary_restrictions text[] default null
)
returns table (
    recipe_id uuid,
    title text,
    description text,
    author text,
    image_url text,
    total_time_minutes integer,
    difficulty text,
    servings integer,
    match_score numeric,
    matched_ingredients_count integer,
    total_ingredients_count integer,
    likes_count bigint
)
language plpgsql
as $$
declare
    v_user_archetype text;
    v_user_skill text;
    v_user_restrictions text[];
    -- Archetype preferences mapping
    v_archetype_tags text[];
    v_archetype_max_time integer;
    v_archetype_max_ingredients integer;
begin
    -- Get user profile if not provided
    if p_archetype is null or p_cooking_skill is null or p_dietary_restrictions is null then
        select 
            archetype,
            cooking_skill,
            dietary_restrictions::text[]
        into v_user_archetype, v_user_skill, v_user_restrictions
        from public.profiles
        where id = p_user_id;
    else
        v_user_archetype := p_archetype;
        v_user_skill := p_cooking_skill;
        v_user_restrictions := p_dietary_restrictions;
    end if;
    
    -- Set defaults if profile doesn't exist
    v_user_archetype := coalesce(v_user_archetype, 'Bio-Hacker');
    v_user_skill := coalesce(v_user_skill, 'Intermediate');
    v_user_restrictions := coalesce(v_user_restrictions, ARRAY[]::text[]);
    
    -- Map archetype to preferences
    case v_user_archetype
        when 'Minimalist' then
            v_archetype_tags := ARRAY['Budget', 'Comfort Food'];
            v_archetype_max_time := 30;
            v_archetype_max_ingredients := 5;
        when 'Bio-Hacker' then
            v_archetype_tags := ARRAY['High Protein', 'Plant-based'];
            v_archetype_max_time := null; -- No limit
            v_archetype_max_ingredients := null; -- No limit
        when 'Flavor Hunter' then
            v_archetype_tags := ARRAY['Comfort Food', 'Feest'];
            v_archetype_max_time := null; -- No limit
            v_archetype_max_ingredients := null; -- No limit
        when 'Meal Prepper' then
            v_archetype_tags := ARRAY['Budget', 'Comfort Food'];
            v_archetype_max_time := null; -- No limit
            v_archetype_max_ingredients := null; -- No limit
        when 'Family Manager' then
            v_archetype_tags := ARRAY['Comfort Food', 'Budget'];
            v_archetype_max_time := 45;
            v_archetype_max_ingredients := null; -- No limit
        else
            v_archetype_tags := ARRAY[]::text[];
            v_archetype_max_time := null;
            v_archetype_max_ingredients := null;
    end case;
    
    -- Map cooking skill to difficulty
    -- Beginner -> only 'Makkelijk'
    -- Intermediate -> 'Makkelijk' or 'Gemiddeld'
    -- Advanced -> all difficulties
    
    return query
    with user_inventory as (
        select distinct lower(name) as ingredient_name
        from public.inventory
        where user_id = p_user_id
          and expires_at > now() -- Only non-expired items
    ),
    recipe_matches as (
        select
            r.id as recipe_id,
            r.title,
            r.description,
            r.author,
            r.image_url,
            r.total_time_minutes,
            r.difficulty,
            r.servings,
            r.tags,
            r.category,
            r.ingredients,
            -- Count matched ingredients
            (
                select count(*)
                from jsonb_array_elements(r.ingredients) as ing
                cross join user_inventory ui
                where lower(ing->>'name') = ui.ingredient_name
                   or lower(ing->>'name') like '%' || ui.ingredient_name || '%'
                   or ui.ingredient_name like '%' || lower(ing->>'name') || '%'
            ) as matched_ingredients_count,
            jsonb_array_length(r.ingredients) as total_ingredients_count,
            -- Calculate base match score
            case
                when jsonb_array_length(r.ingredients) = 0 then 0.0
                else (
                    select count(*)::numeric / greatest(jsonb_array_length(r.ingredients), 1)
                    from jsonb_array_elements(r.ingredients) as ing
                    cross join user_inventory ui
                    where lower(ing->>'name') = ui.ingredient_name
                       or lower(ing->>'name') like '%' || ui.ingredient_name || '%'
                       or ui.ingredient_name like '%' || lower(ing->>'name') || '%'
                )
            end as base_match_score
        from public.recipes r
        where 1=1
          -- Category filter
          and (p_category is null 
               or r.category = p_category 
               or p_category = any(r.tags)
               or exists (
                   select 1 from public.recipe_categories rc
                   where rc.recipe_id = r.id and rc.category = p_category
               ))
          -- Time filter
          and (p_max_time_minutes is null or r.total_time_minutes <= p_max_time_minutes)
          -- Archetype time filter
          and (v_archetype_max_time is null or r.total_time_minutes <= v_archetype_max_time)
          -- Archetype ingredient count filter
          and (v_archetype_max_ingredients is null or jsonb_array_length(r.ingredients) <= v_archetype_max_ingredients)
          -- Cooking skill filter (difficulty)
          and (
              v_user_skill = 'Advanced'
              or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
              or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
          )
          -- Dietary restrictions filter
          and (
              array_length(v_user_restrictions, 1) is null
              or array_length(v_user_restrictions, 1) = 0
              or (
                  -- If user has restrictions, recipe must match at least one tag
                  exists (
                      select 1 from unnest(v_user_restrictions) as restriction
                      where restriction = any(r.tags)
                      or (
                          restriction = 'Vegan' and 'Vegan' = any(r.tags)
                      )
                      or (
                          restriction = 'Vegetarian' and ('Vegetarian' = any(r.tags) or 'Vegan' = any(r.tags))
                      )
                      or (
                          restriction = 'Gluten-Free' and 'Gluten-Free' = any(r.tags)
                      )
                      or (
                          restriction = 'Dairy-Free' and ('Dairy-Free' = any(r.tags) or 'Vegan' = any(r.tags))
                      )
                      or (
                          restriction = 'Nut-Free' and 'Nut-Free' = any(r.tags)
                      )
                      or (
                          restriction = 'Keto' and 'Keto' = any(r.tags)
                      )
                      or (
                          restriction = 'Paleo' and 'Paleo' = any(r.tags)
                      )
                  )
              )
          )
    )
    select
        rm.recipe_id,
        rm.title,
        rm.description,
        rm.author,
        rm.image_url,
        rm.total_time_minutes,
        rm.difficulty,
        rm.servings,
        -- Enhanced match score with archetype bonus
        (
            rm.base_match_score * 100.0
            + case
                -- Bonus for archetype-preferred tags
                when exists (
                    select 1 from unnest(v_archetype_tags) as tag
                    where tag = any(rm.tags)
                ) then 15.0
                else 0.0
            end
            -- Bonus for good ingredient match
            + case
                when rm.matched_ingredients_count >= rm.total_ingredients_count - 2 then 10.0
                when rm.matched_ingredients_count >= rm.total_ingredients_count - 3 then 5.0
                else 0.0
            end
        ) as match_score,
        rm.matched_ingredients_count,
        rm.total_ingredients_count,
        coalesce(l.likes_count, 0) as likes_count
    from recipe_matches rm
    left join (
        select recipe_id, count(*) as likes_count
        from public.recipe_likes
        group by recipe_id
    ) l on l.recipe_id = rm.recipe_id
    where rm.base_match_score > 0.1 -- At least 10% ingredient match
    order by match_score desc, likes_count desc
    limit p_limit;
end;
$$;

-- Update get_trending_recipes to accept profile filters
create or replace function public.get_trending_recipes(
    p_limit integer default 10,
    p_user_id uuid default null,
    p_category text default null
)
returns table (
    recipe_id uuid,
    title text,
    description text,
    author text,
    image_url text,
    total_time_minutes integer,
    difficulty text,
    servings integer,
    likes_count bigint
)
language plpgsql
as $$
declare
    v_user_skill text;
    v_user_restrictions text[];
begin
    -- Get user profile if provided
    if p_user_id is not null then
        select 
            cooking_skill,
            dietary_restrictions::text[]
        into v_user_skill, v_user_restrictions
        from public.profiles
        where id = p_user_id;
    end if;
    
    -- Set defaults
    v_user_skill := coalesce(v_user_skill, 'Intermediate');
    v_user_restrictions := coalesce(v_user_restrictions, ARRAY[]::text[]);
    
    return query
    select
        r.id as recipe_id,
        r.title,
        r.description,
        r.author,
        r.image_url,
        r.total_time_minutes,
        r.difficulty,
        r.servings,
        count(rl.id) as likes_count
    from public.recipes r
    left join public.recipe_likes rl on rl.recipe_id = r.id
        and rl.created_at > now() - interval '7 days'
    where 1=1
      -- Category filter
      and (p_category is null 
           or r.category = p_category 
           or p_category = any(r.tags)
           or exists (
               select 1 from public.recipe_categories rc
               where rc.recipe_id = r.id and rc.category = p_category
           ))
      -- Cooking skill filter (if user provided)
      and (
          p_user_id is null
          or v_user_skill = 'Advanced'
          or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
          or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
      )
      -- Dietary restrictions filter (if user provided)
      and (
          p_user_id is null
          or array_length(v_user_restrictions, 1) is null
          or array_length(v_user_restrictions, 1) = 0
          or exists (
              select 1 from unnest(v_user_restrictions) as restriction
              where restriction = any(r.tags)
              or (restriction = 'Vegetarian' and ('Vegetarian' = any(r.tags) or 'Vegan' = any(r.tags)))
              or (restriction = 'Dairy-Free' and ('Dairy-Free' = any(r.tags) or 'Vegan' = any(r.tags)))
          )
      )
    group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
    order by likes_count desc, r.created_at desc
    limit p_limit;
end;
$$;

-- Grant permissions
grant execute on function public.match_recipes_with_inventory(uuid, text, integer, integer, text, text, text[]) to authenticated;
grant execute on function public.match_recipes_with_inventory(uuid, text, integer, integer, text, text, text[]) to anon;
grant execute on function public.get_trending_recipes(integer, uuid, text) to authenticated;
grant execute on function public.get_trending_recipes(integer, uuid, text) to anon;


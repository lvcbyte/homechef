-- Improve Chef Radar Picks matching to accurately match ingredients
-- Ensure recipes match actual inventory items (e.g., rijst + kip = recipe with rijst and kip)

-- Drop existing function first to change return type
drop function if exists public.match_recipes_with_inventory(uuid, text, integer, integer, text, text, text[], boolean);

create or replace function public.match_recipes_with_inventory(
    p_user_id uuid,
    p_category text default null,
    p_max_time_minutes integer default null,
    p_limit integer default 10,
    p_archetype text default null,
    p_cooking_skill text default null,
    p_dietary_restrictions text[] default null,
    p_loose_matching boolean default false
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
    matched_ingredients text[],
    likes_count bigint
)
language plpgsql
as $$
declare
    v_user_archetype text;
    v_user_skill text;
    v_user_restrictions text[];
    v_archetype_tags text[];
    v_match_threshold numeric;
begin
    -- Get user profile if not provided
    if p_archetype is null or p_cooking_skill is null then
        select archetype, cooking_skill, dietary_restrictions::text[]
        into v_user_archetype, v_user_skill, v_user_restrictions
        from public.profiles
        where id = p_user_id;
    else
        v_user_archetype := p_archetype;
        v_user_skill := p_cooking_skill;
        v_user_restrictions := p_dietary_restrictions;
    end if;

    -- Override with parameters if provided
    if p_archetype is not null then
        v_user_archetype := p_archetype;
    end if;
    if p_cooking_skill is not null then
        v_user_skill := p_cooking_skill;
    end if;
    if p_dietary_restrictions is not null then
        v_user_restrictions := p_dietary_restrictions;
    end if;

    -- Set defaults
    v_user_archetype := coalesce(v_user_archetype, 'Minimalist');
    v_user_skill := coalesce(v_user_skill, 'Intermediate');
    v_user_restrictions := coalesce(v_user_restrictions, ARRAY[]::text[]);

    -- Map archetype to tags
    case v_user_archetype
        when 'Minimalist' then
            v_archetype_tags := ARRAY['Budget', 'Comfort Food', 'Quick'];
        when 'Bio-Hacker' then
            v_archetype_tags := ARRAY['High Protein', 'Plant-based', 'Healthy'];
        when 'Flavor Hunter' then
            v_archetype_tags := ARRAY['Comfort Food', 'Feest', 'Italiaans', 'Aziatisch'];
        when 'Meal Prepper' then
            v_archetype_tags := ARRAY['Budget', 'Comfort Food', 'High Protein'];
        when 'Family Manager' then
            v_archetype_tags := ARRAY['Comfort Food', 'Budget', 'Quick'];
        else
            v_archetype_tags := ARRAY[]::text[];
    end case;

    -- Set match threshold based on loose matching
    v_match_threshold := case when p_loose_matching then 0.05 else 0.1 end;

    return query
    with user_inventory as (
        select 
            lower(trim(name)) as ingredient_name,
            category as category_name,
            name as original_name
        from public.inventory
        where user_id = p_user_id
          and (expires_at is null or expires_at > now())
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
            -- Get matched ingredients list (only if inventory exists)
            case 
                when exists (select 1 from user_inventory limit 1) then
                    array_agg(distinct ui.original_name) filter (
                        where exists (
                            select 1
                            from jsonb_array_elements(r.ingredients) as ing
                            where 
                                -- Exact match (case-insensitive)
                                lower(trim(ing->>'name')) = ui.ingredient_name
                                -- Partial match (contains)
                                or lower(trim(ing->>'name')) like '%' || ui.ingredient_name || '%'
                                or ui.ingredient_name like '%' || lower(trim(ing->>'name')) || '%'
                                -- Word-based matching (split by spaces)
                                or exists (
                                    select 1
                                    from unnest(string_to_array(lower(trim(ing->>'name')), ' ')) as ing_word
                                    cross join unnest(string_to_array(ui.ingredient_name, ' ')) as inv_word
                                    where length(ing_word) >= 3 and length(inv_word) >= 3
                                    and (ing_word = inv_word 
                                         or ing_word like '%' || inv_word || '%' 
                                         or inv_word like '%' || ing_word || '%')
                                )
                                -- Category-based matching
                                or (ui.category_name is not null and r.category = ui.category_name)
                        )
                    )
                else ARRAY[]::text[]
            end as matched_ingredients,
            -- Count matched ingredients (only if inventory exists)
            case 
                when exists (select 1 from user_inventory limit 1) then
                    (
                        select count(distinct ing->>'name')
                        from jsonb_array_elements(r.ingredients) as ing
                        cross join user_inventory ui
                        where 
                            lower(trim(ing->>'name')) = ui.ingredient_name
                            or lower(trim(ing->>'name')) like '%' || ui.ingredient_name || '%'
                            or ui.ingredient_name like '%' || lower(trim(ing->>'name')) || '%'
                            or exists (
                                select 1
                                from unnest(string_to_array(lower(trim(ing->>'name')), ' ')) as ing_word
                                cross join unnest(string_to_array(ui.ingredient_name, ' ')) as inv_word
                                where length(ing_word) >= 3 and length(inv_word) >= 3
                                and (ing_word = inv_word 
                                     or ing_word like '%' || inv_word || '%' 
                                     or inv_word like '%' || ing_word || '%')
                            )
                            or (ui.category_name is not null and r.category = ui.category_name)
                    )
                else 0
            end as matched_ingredients_count,
            jsonb_array_length(r.ingredients) as total_ingredients_count,
            -- Calculate base match score (percentage of ingredients matched)
            case
                when not exists (select 1 from user_inventory limit 1) then 0.0
                when jsonb_array_length(r.ingredients) = 0 then 0.0
                else (
                    select count(distinct ing->>'name')::numeric / greatest(jsonb_array_length(r.ingredients), 1)
                    from jsonb_array_elements(r.ingredients) as ing
                    cross join user_inventory ui
                    where 
                        lower(trim(ing->>'name')) = ui.ingredient_name
                        or lower(trim(ing->>'name')) like '%' || ui.ingredient_name || '%'
                        or ui.ingredient_name like '%' || lower(trim(ing->>'name')) || '%'
                        or exists (
                            select 1
                            from unnest(string_to_array(lower(trim(ing->>'name')), ' ')) as ing_word
                            cross join unnest(string_to_array(ui.ingredient_name, ' ')) as inv_word
                            where length(ing_word) >= 3 and length(inv_word) >= 3
                            and (ing_word = inv_word 
                                 or ing_word like '%' || inv_word || '%' 
                                 or inv_word like '%' || ing_word || '%')
                        )
                        or (ui.category_name is not null and r.category = ui.category_name)
                )
            end as base_match_score
        from public.recipes r
        where (p_category is null or r.category = p_category or p_category = any(r.tags))
          and (p_max_time_minutes is null or r.total_time_minutes <= p_max_time_minutes)
          and (
              v_user_skill = 'Advanced'
              or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
              or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
              or v_user_skill is null
          )
          and (
              array_length(v_user_restrictions, 1) is null
              or array_length(v_user_restrictions, 1) = 0
              or not exists (
                  select 1 from unnest(v_user_restrictions) as restriction
                  where restriction = any(r.tags)
              )
          )
        group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, 
                 r.difficulty, r.servings, r.tags, r.category, r.ingredients
        having 
            -- If no inventory, show all recipes (base_match_score will be 0)
            not exists (select 1 from user_inventory limit 1)
            -- If inventory exists, require at least 1 match
            or (
                select count(distinct ing->>'name')
                from jsonb_array_elements(r.ingredients) as ing
                cross join user_inventory ui
                where 
                    lower(trim(ing->>'name')) = ui.ingredient_name
                    or lower(trim(ing->>'name')) like '%' || ui.ingredient_name || '%'
                    or ui.ingredient_name like '%' || lower(trim(ing->>'name')) || '%'
                    or exists (
                        select 1
                        from unnest(string_to_array(lower(trim(ing->>'name')), ' ')) as ing_word
                        cross join unnest(string_to_array(ui.ingredient_name, ' ')) as inv_word
                        where length(ing_word) >= 3 and length(inv_word) >= 3
                        and (ing_word = inv_word 
                             or ing_word like '%' || inv_word || '%' 
                             or inv_word like '%' || ing_word || '%')
                    )
                    or (ui.category_name is not null and r.category = ui.category_name)
            ) >= 1
        having (
            select count(distinct ing->>'name')
            from jsonb_array_elements(r.ingredients) as ing
            cross join user_inventory ui
            where 
                lower(trim(ing->>'name')) = ui.ingredient_name
                or lower(trim(ing->>'name')) like '%' || ui.ingredient_name || '%'
                or ui.ingredient_name like '%' || lower(trim(ing->>'name')) || '%'
                or exists (
                    select 1
                    from unnest(string_to_array(lower(trim(ing->>'name')), ' ')) as ing_word
                    cross join unnest(string_to_array(ui.ingredient_name, ' ')) as inv_word
                    where length(ing_word) >= 3 and length(inv_word) >= 3
                    and (ing_word = inv_word 
                         or ing_word like '%' || inv_word || '%' 
                         or inv_word like '%' || ing_word || '%')
                )
                or (ui.category_name is not null and r.category = ui.category_name)
        ) >= 1 -- At least 1 ingredient must match
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
        -- Enhanced match score (0-100 scale)
        (
            rm.base_match_score * 100.0
            + case
                when exists (
                    select 1 from unnest(v_archetype_tags) as tag
                    where tag = any(rm.tags)
                ) then 15.0
                else 0.0
            end
            + case
                when rm.matched_ingredients_count >= rm.total_ingredients_count - 1 then 10.0
                when rm.matched_ingredients_count >= rm.total_ingredients_count - 2 then 5.0
                when rm.matched_ingredients_count >= 1 then 2.0
                else 0.0
            end
        ) as match_score,
        rm.matched_ingredients_count,
        rm.total_ingredients_count,
        coalesce(rm.matched_ingredients, ARRAY[]::text[]) as matched_ingredients,
        coalesce(l.likes_count, 0) as likes_count
    from recipe_matches rm
    left join (
        select recipe_id, count(*) as likes_count
        from public.recipe_likes
        group by recipe_id
    ) l on l.recipe_id = rm.recipe_id
    where rm.base_match_score > v_match_threshold
       or (p_loose_matching and rm.matched_ingredients_count >= 1)
    order by match_score desc, likes_count desc
    limit p_limit;
end;
$$;

grant execute on function public.match_recipes_with_inventory(uuid, text, integer, integer, text, text, text[], boolean) to authenticated;
grant execute on function public.match_recipes_with_inventory(uuid, text, integer, integer, text, text, text[], boolean) to anon;


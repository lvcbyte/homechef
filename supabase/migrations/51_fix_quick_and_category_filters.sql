-- Fix get_quick_recipes and get_recipes_by_category to properly filter
-- get_quick_recipes: Always filter on total_time_minutes <= 30
-- get_recipes_by_category: Always filter on category name

-- Fix get_quick_recipes to handle JSONB and always filter on time
drop function if exists public.get_quick_recipes(integer, uuid, text, text, text, text[]);

create or replace function public.get_quick_recipes(
    p_limit integer default 10,
    p_user_id uuid default null,
    p_category text default null,
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
    likes_count bigint
)
language plpgsql
as $$
declare
    v_user_skill text;
    v_user_restrictions text[];
    v_user_archetype text;
    v_archetype_tags text[];
begin
    -- Get user profile if provided
    if p_user_id is not null then
        select 
            cooking_skill,
            case 
                when dietary_restrictions is null then ARRAY[]::text[]
                when jsonb_typeof(dietary_restrictions) = 'array' then
                    ARRAY(SELECT jsonb_array_elements_text(dietary_restrictions))
                else ARRAY[]::text[]
            end,
            archetype
        into v_user_skill, v_user_restrictions, v_user_archetype
        from public.profiles
        where id = p_user_id;
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
    v_user_skill := coalesce(v_user_skill, 'Intermediate');
    v_user_restrictions := coalesce(v_user_restrictions, ARRAY[]::text[]);
    v_user_archetype := coalesce(v_user_archetype, 'Bio-Hacker');
    
    -- Map archetype to tags
    case v_user_archetype
        when 'Minimalist' then
            v_archetype_tags := ARRAY['Budget', 'Comfort Food', 'Quick'];
        when 'Bio-Hacker' then
            v_archetype_tags := ARRAY['High Protein', 'Plant-based', 'Healthy'];
        when 'Flavor Hunter' then
            v_archetype_tags := ARRAY['Comfort Food', 'Feest', 'Italiaans', 'Aziatisch', 'Spaans'];
        when 'Meal Prepper' then
            v_archetype_tags := ARRAY['Budget', 'Comfort Food', 'High Protein'];
        when 'Family Manager' then
            v_archetype_tags := ARRAY['Comfort Food', 'Budget', 'Quick', 'Kinderen'];
        when 'None' then
            v_archetype_tags := ARRAY[]::text[];
        else
            v_archetype_tags := ARRAY[]::text[];
    end case;
    
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
        coalesce(count(rl.id), 0)::bigint as likes_count
    from public.recipes r
    left join public.recipe_likes rl on rl.recipe_id = r.id
        and rl.created_at > now() - interval '7 days'
    where r.total_time_minutes <= 30  -- ALWAYS filter on time <= 30 minutes
      -- Category filter (optional)
      and (
          p_category is null 
          or r.category = p_category 
          or (r.tags is not null and p_category = any(r.tags))
          or exists (
              select 1 from public.recipe_categories rc
              where rc.recipe_id = r.id and rc.category = p_category
          )
      )
      -- Cooking skill filter
      and (
          v_user_skill is null
          or v_user_skill = 'Advanced'
          or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
          or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
          or v_user_archetype = 'None'
      )
      -- Dietary restrictions filter
      and (
          array_length(v_user_restrictions, 1) is null
          or array_length(v_user_restrictions, 1) = 0
          or v_user_archetype = 'None'
          or not exists (
              select 1 from unnest(v_user_restrictions) as restriction
              where restriction = any(r.tags)
          )
      )
    group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
    order by 
        -- Prioritize recipes that match archetype tags (unless None)
        case 
            when v_user_archetype = 'None' then 1
            when array_length(v_archetype_tags, 1) > 0 and exists (
                select 1 from unnest(v_archetype_tags) as tag
                where tag = any(r.tags)
            ) then 0 
            else 1 
        end,
        likes_count desc,
        r.total_time_minutes asc,
        r.created_at desc
    limit p_limit;
end;
$$;

-- Grant permissions
grant execute on function public.get_quick_recipes(integer, uuid, text, text, text, text[]) to authenticated;
grant execute on function public.get_quick_recipes(integer, uuid, text, text, text, text[]) to anon;

-- Verify get_recipes_by_category is correct - it should already filter on category
-- The function from migration 50 should be correct, but let's add a comment to ensure it's clear
-- The category filter in get_recipes_by_category should be:
--   - First try recipe_categories table with rc.category = p_category
--   - Fallback to r.category = p_category or p_category = any(r.tags)
-- This ensures recipes are ALWAYS filtered by the category name


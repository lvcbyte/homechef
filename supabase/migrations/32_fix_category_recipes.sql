-- Fix get_recipes_by_category to work better and ensure it returns results
-- Also add a simpler fallback function

-- Improve get_recipes_by_category to be more lenient
create or replace function public.get_recipes_by_category(
    p_category text,
    p_limit integer default 50,
    p_user_id uuid default null,
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
    v_result_count integer := 0;
begin
    -- Get user profile if provided
    if p_user_id is not null then
        select 
            cooking_skill,
            dietary_restrictions::text[],
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
        else
            v_archetype_tags := ARRAY[]::text[];
    end case;
    
    -- Try to get recipes from recipe_categories first
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
    inner join public.recipe_categories rc on rc.recipe_id = r.id
    left join public.recipe_likes rl on rl.recipe_id = r.id
        and rl.created_at > now() - interval '30 days'
    where rc.category = p_category
      -- Cooking skill filter (more lenient)
      and (
          v_user_skill = 'Advanced'
          or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
          or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
          or v_user_skill is null
      )
      -- Dietary restrictions filter (more lenient)
      and (
          array_length(v_user_restrictions, 1) is null
          or array_length(v_user_restrictions, 1) = 0
          or exists (
              select 1 from unnest(v_user_restrictions) as restriction
              where restriction = any(r.tags)
              or (restriction = 'Vegetarian' and ('Vegetarian' = any(r.tags) or 'Vegan' = any(r.tags)))
              or (restriction = 'Dairy-Free' and ('Dairy-Free' = any(r.tags) or 'Vegan' = any(r.tags)))
          )
      )
    group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
    order by 
        -- Prioritize recipes that match archetype tags
        case when array_length(v_archetype_tags, 1) > 0 and exists (
            select 1 from unnest(v_archetype_tags) as tag
            where tag = any(r.tags)
        ) then 0 else 1 end,
        likes_count desc,
        r.created_at desc
    limit p_limit;
    
    -- Get count of results
    get diagnostics v_result_count = row_count;
    
    -- If no results from recipe_categories, try direct category/tags match
    if v_result_count = 0 then
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
            and rl.created_at > now() - interval '30 days'
        where r.category = p_category
           or p_category = any(r.tags)
        group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
        order by likes_count desc, r.created_at desc
        limit p_limit;
    end if;
end;
$$;

-- Grant permissions
grant execute on function public.get_recipes_by_category(text, integer, uuid, text, text, text[]) to authenticated;
grant execute on function public.get_recipes_by_category(text, integer, uuid, text, text, text[]) to anon;


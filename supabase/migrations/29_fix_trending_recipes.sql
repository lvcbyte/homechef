-- Fix get_trending_recipes to work without user_id and ensure it always returns recipes
-- Also fix the function to handle null user_id properly

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
    v_user_archetype text;
    v_archetype_tags text[];
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
            v_archetype_tags := ARRAY['Comfort Food', 'Budget', 'Quick'];
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
    order by 
        -- Prioritize recipes that match archetype tags (if user provided)
        case when p_user_id is not null and array_length(v_archetype_tags, 1) > 0 and exists (
            select 1 from unnest(v_archetype_tags) as tag
            where tag = any(r.tags)
        ) then 0 else 1 end,
        likes_count desc, 
        r.created_at desc
    limit p_limit;
    
    -- If no results, return general trending recipes (fallback)
    if not found then
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
        where (p_category is null 
               or r.category = p_category 
               or p_category = any(r.tags))
        group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
        order by likes_count desc, r.created_at desc
        limit p_limit;
    end if;
end;
$$;

-- Grant permissions
grant execute on function public.get_trending_recipes(integer, uuid, text) to authenticated;
grant execute on function public.get_trending_recipes(integer, uuid, text) to anon;


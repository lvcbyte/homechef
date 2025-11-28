-- Fix get_quick_recipes to include likes_count from last 7 days
-- This ensures "x keer bewaard deze week" works for quick recipes

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
        count(rl.id) as likes_count -- Count likes from last 7 days
    from public.recipes r
    left join public.recipe_likes rl on rl.recipe_id = r.id
        and rl.created_at > now() - interval '7 days'
    where r.total_time_minutes <= 30
      -- Category filter
      and (p_category is null 
           or r.category = p_category 
           or p_category = any(r.tags))
      -- Cooking skill filter
      and (
          v_user_skill is null
          or v_user_skill = 'Advanced'
          or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
          or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
      )
      -- Dietary restrictions filter
      and (
          array_length(v_user_restrictions, 1) is null
          or array_length(v_user_restrictions, 1) = 0
          or not exists (
              select 1 from unnest(v_user_restrictions) as restriction
              where restriction = any(r.tags)
          )
      )
    group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
    order by likes_count desc, r.created_at desc
    limit p_limit;
end;
$$;

grant execute on function public.get_quick_recipes(integer, uuid, text, text, text, text[]) to authenticated;
grant execute on function public.get_quick_recipes(integer, uuid, text, text, text, text[]) to anon;


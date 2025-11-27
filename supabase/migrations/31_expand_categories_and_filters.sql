-- Expand categories and improve filtering with archetype support
-- Add more detailed categories that fit the Stockpit theme

-- First, ensure all recipes have proper category mappings
insert into public.recipe_categories (recipe_id, category)
select 
    r.id,
    unnest(ARRAY[
        'Italiaans', 'Aziatisch', 'Spaans', 'Frans', 'Belgisch', 'Grieks', 'Mexicaans', 'Thais', 'Japans', 'Indiaas',
        'Comfort Food', 'Feest', 'Budget', 'Quick', 'High Protein', 'Low Carb', 'Keto', 'Paleo',
        'Plant-based', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Healthy',
        'Dessert', 'Ontbijt', 'Lunch', 'Diner', 'Snack', 'Brunch', 'Borrel',
        'Soep', 'Salade', 'Pasta', 'Rijst', 'Vis', 'Vlees', 'Kip', 'Vegetarisch',
        'Bakken', 'Grillen', 'Stoven', 'Rauw', 'Koud', 'Warm', 'Zoet', 'Zout',
        'Kinderen', 'Gezond', 'Traditioneel', 'Modern', 'Fusion', 'Klassiek'
    ])
from public.recipes r
where exists (
    select 1 from unnest(r.tags) as tag
    where tag = any(ARRAY[
        'Italiaans', 'Aziatisch', 'Spaans', 'Frans', 'Belgisch', 'Grieks', 'Mexicaans', 'Thais', 'Japans', 'Indiaas',
        'Comfort Food', 'Feest', 'Budget', 'Quick', 'High Protein', 'Low Carb', 'Keto', 'Paleo',
        'Plant-based', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Healthy',
        'Dessert', 'Ontbijt', 'Lunch', 'Diner', 'Snack', 'Brunch', 'Borrel',
        'Soep', 'Salade', 'Pasta', 'Rijst', 'Vis', 'Vlees', 'Kip', 'Vegetarisch',
        'Bakken', 'Grillen', 'Stoven', 'Rauw', 'Koud', 'Warm', 'Zoet', 'Zout',
        'Kinderen', 'Gezond', 'Traditioneel', 'Modern', 'Fusion', 'Klassiek'
    ])
)
on conflict (recipe_id, category) do nothing;

-- Also map based on category field
insert into public.recipe_categories (recipe_id, category)
select 
    r.id,
    r.category
from public.recipes r
where r.category is not null
  and not exists (
      select 1 from public.recipe_categories rc
      where rc.recipe_id = r.id and rc.category = r.category
  )
on conflict (recipe_id, category) do nothing;

-- Create function to get recipes by category with archetype filtering
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
      -- Cooking skill filter
      and (
          v_user_skill = 'Advanced'
          or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
          or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
      )
      -- Dietary restrictions filter
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
end;
$$;

-- Create function to get quick recipes (<= 30 min) with all filters
create or replace function public.get_quick_recipes(
    p_limit integer default 100,
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
    where r.total_time_minutes <= 30
      -- Category filter
      and (
          p_category is null
          or r.category = p_category
          or p_category = any(r.tags)
          or exists (
              select 1 from public.recipe_categories rc
              where rc.recipe_id = r.id and rc.category = p_category
          )
      )
      -- Cooking skill filter
      and (
          v_user_skill = 'Advanced'
          or (v_user_skill = 'Intermediate' and r.difficulty in ('Makkelijk', 'Gemiddeld'))
          or (v_user_skill = 'Beginner' and r.difficulty = 'Makkelijk')
      )
      -- Dietary restrictions filter
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
        r.total_time_minutes asc,
        r.created_at desc
    limit p_limit;
end;
$$;

-- Grant permissions
grant execute on function public.get_recipes_by_category(text, integer, uuid, text, text, text[]) to authenticated;
grant execute on function public.get_recipes_by_category(text, integer, uuid, text, text, text[]) to anon;
grant execute on function public.get_quick_recipes(integer, uuid, text, text, text, text[]) to authenticated;
grant execute on function public.get_quick_recipes(integer, uuid, text, text, text, text[]) to anon;


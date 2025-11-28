-- Fix Recipe Likes Count: Show likes from last 7 days for all recipes
-- This ensures "x keer bewaard deze week" works correctly

-- Function to get recipe likes count for last 7 days
create or replace function get_recipe_likes_count_week(p_recipe_id uuid)
returns bigint
language sql
stable
as $$
    select count(*)
    from public.recipe_likes
    where recipe_id = p_recipe_id
      and created_at > now() - interval '7 days';
$$;

-- Update get_trending_recipes to include likes_count for all recipes
-- (This already exists but ensure it's correct)

-- Function to get all recipes with likes count (for use in recipe cards)
create or replace function get_recipes_with_likes(
    p_limit integer default 100,
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
    likes_count bigint,
    likes_count_week bigint
)
language sql
stable
as $$
    select
        r.id as recipe_id,
        r.title,
        r.description,
        r.author,
        r.image_url,
        r.total_time_minutes,
        r.difficulty,
        r.servings,
        count(rl_all.id) as likes_count, -- Total likes
        count(rl_week.id) as likes_count_week -- Likes in last 7 days
    from public.recipes r
    left join public.recipe_likes rl_all on rl_all.recipe_id = r.id
    left join public.recipe_likes rl_week on rl_week.recipe_id = r.id
        and rl_week.created_at > now() - interval '7 days'
    where (p_category is null or p_category = any(r.tags) or r.category = p_category)
    group by r.id, r.title, r.description, r.author, r.image_url, r.total_time_minutes, r.difficulty, r.servings
    order by r.created_at desc
    limit p_limit;
$$;

-- Grant execute permissions
grant execute on function get_recipe_likes_count_week(uuid) to authenticated, anon;
grant execute on function get_recipes_with_likes(integer, text) to authenticated, anon;


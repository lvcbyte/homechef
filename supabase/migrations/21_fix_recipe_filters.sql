-- Fix recipe filters to work with both tags and recipe_categories table
-- This migration improves the get_recipe_categories function and adds a helper function for filtering

-- Update get_recipe_categories to include both tags and recipe_categories table
create or replace function public.get_recipe_categories()
returns table (
    category text,
    count bigint
)
language sql
as $$
    select
        category,
        count(*) as count
    from (
        -- Get categories from tags array
        select unnest(tags) as category
        from public.recipes
        where tags is not null and array_length(tags, 1) > 0
        union all
        -- Get categories from recipe_categories table
        select category
        from public.recipe_categories
    ) as all_categories
    group by category
    order by count desc;
$$;

-- Helper function to filter recipes by category (checks both tags and recipe_categories)
create or replace function public.filter_recipes_by_category(
    p_category text
)
returns table (
    recipe_id uuid,
    title text,
    description text,
    author text,
    image_url text,
    prep_time_minutes integer,
    cook_time_minutes integer,
    total_time_minutes integer,
    difficulty text,
    servings integer,
    ingredients jsonb,
    instructions jsonb,
    nutrition jsonb,
    tags text[],
    category text,
    is_featured boolean,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
as $$
    select distinct r.*
    from public.recipes r
    where 
        -- Match by main category
        r.category = p_category
        -- Match by tags array
        or (r.tags is not null and p_category = any(r.tags))
        -- Match by recipe_categories table
        or exists (
            select 1
            from public.recipe_categories rc
            where rc.recipe_id = r.id
            and rc.category = p_category
        );
$$;

-- Grant execute permissions
grant execute on function public.filter_recipes_by_category(text) to anon, authenticated;


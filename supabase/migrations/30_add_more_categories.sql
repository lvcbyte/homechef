-- Add more logical recipe categories that fit the app theme
-- Also ensure categories are properly seeded

-- Insert additional categories into recipe_categories table
insert into public.recipe_categories (recipe_id, category)
select 
    r.id,
    unnest(ARRAY[
        'Italiaans', 'Aziatisch', 'Spaans', 'Frans', 'Belgisch',
        'Comfort Food', 'Feest', 'Budget', 'Quick', 'High Protein',
        'Plant-based', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free',
        'Keto', 'Paleo', 'Healthy', 'Dessert', 'Ontbijt', 'Lunch', 'Diner',
        'Snack', 'Soep', 'Salade', 'Pasta', 'Rijst', 'Vis', 'Vlees', 'Kip'
    ])
from public.recipes r
where exists (
    select 1 from unnest(r.tags) as tag
    where tag = any(ARRAY[
        'Italiaans', 'Aziatisch', 'Spaans', 'Frans', 'Belgisch',
        'Comfort Food', 'Feest', 'Budget', 'Quick', 'High Protein',
        'Plant-based', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free',
        'Keto', 'Paleo', 'Healthy', 'Dessert', 'Ontbijt', 'Lunch', 'Diner',
        'Snack', 'Soep', 'Salade', 'Pasta', 'Rijst', 'Vis', 'Vlees', 'Kip'
    ])
)
on conflict (recipe_id, category) do nothing;

-- Create a function to get popular categories with counts
create or replace function public.get_popular_categories(
    p_limit integer default 15
)
returns table (
    category text,
    count bigint
)
language sql
stable
as $$
    select 
        rc.category,
        count(distinct rc.recipe_id) as count
    from public.recipe_categories rc
    group by rc.category
    order by count desc
    limit p_limit;
$$;

-- Grant permissions
grant execute on function public.get_popular_categories(integer) to authenticated;
grant execute on function public.get_popular_categories(integer) to anon;


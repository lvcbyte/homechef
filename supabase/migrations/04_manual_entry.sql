create table if not exists public.category_keywords (
    keyword text primary key,
    category text not null,
    is_food boolean not null default true
);

insert into public.category_keywords (keyword, category, is_food) values
    ('melk', 'Dairy', true),
    ('yoghurt', 'Dairy', true),
    ('kaas', 'Dairy', true),
    ('appel', 'Produce', true),
    ('sla', 'Produce', true),
    ('koriander', 'Produce', true),
    ('zeep', 'Household', false),
    ('spons', 'Household', false)
on conflict (keyword) do nothing;

create or replace function public.detect_category(item_name text)
returns table(category text, is_food boolean)
language sql
stable
as $$
with match as (
    select category, is_food
    from public.category_keywords
    where lower(item_name) like '%' || lower(keyword) || '%'
    order by length(keyword) desc
    limit 1
)
select
    coalesce((select category from match), 'Pantry') as category,
    coalesce((select is_food from match), true) as is_food;
$$;


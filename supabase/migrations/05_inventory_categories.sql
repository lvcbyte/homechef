create table if not exists public.inventory_categories (
    id text primary key,
    label text not null,
    created_at timestamptz not null default timezone('utc', now())
);

insert into public.inventory_categories (id, label)
values
    ('fresh_produce', 'Fresh Produce'),
    ('dairy_eggs', 'Dairy & Eggs'),
    ('proteins', 'Proteins'),
    ('seafood', 'Seafood'),
    ('bakery', 'Bakery'),
    ('pantry', 'Pantry Staples'),
    ('spices_condiments', 'Spices & Condiments'),
    ('frozen', 'Frozen'),
    ('ready_meals', 'Ready Meals'),
    ('beverages', 'Beverages'),
    ('snacks', 'Snacks & Treats'),
    ('baby', 'Baby'),
    ('personal_care', 'Personal Care'),
    ('household', 'Household')
on conflict (id) do update set label = excluded.label;

update public.inventory
set category =
    case lower(coalesce(category, ''))
        when 'produce' then 'fresh_produce'
        when 'fresh produce' then 'fresh_produce'
        when 'dairy' then 'dairy_eggs'
        when 'dairy & eggs' then 'dairy_eggs'
        when 'protein' then 'proteins'
        when 'proteins' then 'proteins'
        when 'seafood' then 'seafood'
        when 'beverages' then 'beverages'
        when 'bakery' then 'bakery'
        when 'frozen' then 'frozen'
        when 'household' then 'household'
        when 'snacks' then 'snacks'
        when 'spices' then 'spices_condiments'
        when 'condiments' then 'spices_condiments'
        else 'pantry'
    end
where category is null
   or category not in (
        'fresh_produce',
        'dairy_eggs',
        'pantry',
        'proteins',
        'seafood',
        'spices_condiments',
        'frozen',
        'ready_meals',
        'beverages',
        'snacks',
        'bakery',
        'baby',
        'personal_care',
        'household'
    );

update public.inventory
set category = 'pantry'
where category is null;

alter table public.inventory
    alter column category set default 'pantry';

alter table public.inventory
    drop constraint if exists inventory_category_fk;

alter table public.inventory
    add constraint inventory_category_fk
        foreign key (category) references public.inventory_categories(id) on update cascade;

update public.category_keywords
set category =
    case lower(category)
        when 'fresh produce' then 'fresh_produce'
        when 'produce' then 'fresh_produce'
        when 'dairy' then 'dairy_eggs'
        when 'dairy & eggs' then 'dairy_eggs'
        when 'bakery' then 'bakery'
        when 'protein' then 'proteins'
        when 'proteins' then 'proteins'
        when 'seafood' then 'seafood'
        when 'spices' then 'spices_condiments'
        when 'condiments' then 'spices_condiments'
        when 'frozen' then 'frozen'
        when 'ready meals' then 'ready_meals'
        when 'beverages' then 'beverages'
        when 'snacks' then 'snacks'
        when 'baby' then 'baby'
        when 'personal care' then 'personal_care'
        when 'household' then 'household'
        else 'pantry'
    end
where category is not null;

alter table public.category_keywords
    drop constraint if exists category_keywords_category_fkey;

alter table public.category_keywords
    add constraint category_keywords_category_fkey
        foreign key (category) references public.inventory_categories(id) on update cascade;

create extension if not exists pg_trgm;

create table if not exists public.product_catalog (
    id text primary key,
    product_name text not null,
    brand text,
    category text not null references public.inventory_categories(id) on update cascade,
    barcode text,
    description text,
    image_url text,
    unit_size text,
    nutrition jsonb,
    price numeric,
    is_available boolean not null default true,
    metadata jsonb,
    updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists product_catalog_barcode_key on public.product_catalog (barcode)
    where barcode is not null;

create index if not exists product_catalog_name_trgm on public.product_catalog using gin (product_name gin_trgm_ops);

insert into public.product_catalog (id, product_name, brand, category, barcode, description, unit_size, price)
values
    ('wi193679', 'Lay''s Paprika Chips', 'Lay''s', 'snacks', '8722700227217', 'Crispy paprika chips', '225 g', 1.49),
    ('wi234500', 'AH Halfvolle Melk', 'AH', 'dairy_eggs', '8718909771444', 'Dutch semi-skimmed milk', '1 L', 1.09),
    ('wi200122', 'AH Volkorenbrood heel', 'AH Bakkerij', 'bakery', '8710400112233', 'Whole wheat bread', '800 g', 2.49),
    ('wi188812', 'AH Zalmfilet vers', 'AH Vis', 'seafood', '2345001888123', 'Fresh salmon fillet', '2 stuks', 8.95),
    ('wi109900', 'AH Spinazie vers', 'AH', 'fresh_produce', '8710400032111', 'Fresh spinach leaves', '300 g', 1.79)
on conflict (id) do update
set product_name = excluded.product_name,
    brand = excluded.brand,
    category = excluded.category,
    barcode = excluded.barcode,
    description = excluded.description,
    unit_size = excluded.unit_size,
    price = excluded.price,
    updated_at = excluded.updated_at;

delete from public.category_keywords;

insert into public.category_keywords (keyword, category, is_food)
values
    ('milk', 'dairy_eggs', true),
    ('cheese', 'dairy_eggs', true),
    ('yogurt', 'dairy_eggs', true),
    ('egg', 'dairy_eggs', true),
    ('butter', 'dairy_eggs', true),
    ('apple', 'fresh_produce', true),
    ('lettuce', 'fresh_produce', true),
    ('herbs', 'fresh_produce', true),
    ('banana', 'fresh_produce', true),
    ('salmon', 'seafood', true),
    ('shrimp', 'seafood', true),
    ('chicken', 'proteins', true),
    ('beef', 'proteins', true),
    ('tofu', 'proteins', true),
    ('ham', 'proteins', true),
    ('pasta', 'pantry', true),
    ('rice', 'pantry', true),
    ('beans', 'pantry', true),
    ('flour', 'pantry', true),
    ('pepper', 'spices_condiments', true),
    ('salt', 'spices_condiments', true),
    ('ketchup', 'spices_condiments', true),
    ('soda', 'beverages', true),
    ('coffee', 'beverages', true),
    ('tea', 'beverages', true),
    ('smoothie', 'beverages', true),
    ('frozen', 'frozen', true),
    ('ice cream', 'frozen', true),
    ('pizza', 'ready_meals', true),
    ('meal kit', 'ready_meals', true),
    ('bread', 'bakery', true),
    ('bagel', 'bakery', true),
    ('baby', 'baby', true),
    ('diaper', 'baby', false),
    ('soap', 'household', false),
    ('detergent', 'household', false),
    ('wipes', 'personal_care', false),
    ('toothpaste', 'personal_care', false),
    ('chips', 'snacks', true),
    ('chocolate', 'snacks', true),
    ('candy', 'snacks', true)
on conflict (keyword) do update set
    category = excluded.category,
    is_food = excluded.is_food;

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
    coalesce((select category from match), 'pantry') as category,
    coalesce((select is_food from match), true) as is_food;
$$;

create or replace function public.match_product_catalog(search_term text)
returns table (
    id text,
    product_name text,
    brand text,
    category text,
    barcode text,
    price numeric,
    unit_size text,
    image_url text
)
language sql
stable
as $$
select
    pc.id,
    pc.product_name,
    pc.brand,
    pc.category,
    pc.barcode,
    pc.price,
    pc.unit_size,
    pc.image_url
from public.product_catalog pc
where pc.product_name % search_term
   or pc.brand % search_term
order by greatest(similarity(pc.product_name, search_term), similarity(coalesce(pc.brand, ''), search_term)) desc
limit 5;
$$;

create or replace function public.match_product_by_barcode(barcode text)
returns public.product_catalog
language sql
stable
as $$
    select *
    from public.product_catalog
    where public.product_catalog.barcode = barcode
    limit 1;
$$;

create or replace function public.upsert_product_catalog(payload jsonb)
returns public.product_catalog
language plpgsql
as $$
declare
    inserted public.product_catalog;
begin
    insert into public.product_catalog (
        id,
        product_name,
        brand,
        category,
        barcode,
        description,
        image_url,
        unit_size,
        nutrition,
        price,
        is_available,
        metadata
    )
    values (
        payload->>'id',
        payload->>'product_name',
        payload->>'brand',
        payload->>'category',
        payload->>'barcode',
        payload->>'description',
        payload->>'image_url',
        payload->>'unit_size',
        payload->'nutrition',
        (payload->>'price')::numeric,
        coalesce((payload->>'is_available')::boolean, true),
        payload
    )
    on conflict (id) do update
    set product_name   = excluded.product_name,
        brand          = excluded.brand,
        category       = excluded.category,
        barcode        = excluded.barcode,
        description    = excluded.description,
        image_url      = excluded.image_url,
        unit_size      = excluded.unit_size,
        nutrition      = excluded.nutrition,
        price          = excluded.price,
        is_available   = excluded.is_available,
        metadata       = excluded.metadata,
        updated_at     = timezone('utc', now())
    returning * into inserted;

    return inserted;
end;
$$;

alter table public.inventory
    add column if not exists catalog_product_id text references public.product_catalog(id);


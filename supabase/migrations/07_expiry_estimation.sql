-- Function to estimate expiry date based on FAVV/HACCP norms for Belgium
-- Based on category and current date
create or replace function public.estimate_expiry_date(
    category_slug text,
    base_date timestamptz default timezone('utc', now())
)
returns timestamptz
language plpgsql
stable
as $$
declare
    days_to_add integer;
begin
    -- FAVV/HACCP norms for Belgium (in days from purchase/opening)
    case category_slug
        -- Highly perishable (1-3 days)
        when 'proteins' then days_to_add := 2; -- Meat, poultry: 1-3 days, use 2 as default
        when 'seafood' then days_to_add := 1; -- Fish, seafood: 1-2 days, use 1 as default
        
        -- Perishable (3-7 days)
        when 'dairy_eggs' then days_to_add := 5; -- Dairy, eggs: 3-7 days, use 5 as default
        when 'fresh_produce' then days_to_add := 5; -- Fresh vegetables, fruits: 3-7 days, use 5 as default
        when 'ready_meals' then days_to_add := 2; -- Ready meals: 1-3 days, use 2 as default
        
        -- Short shelf life (2-5 days)
        when 'bakery' then days_to_add := 3; -- Bread, pastries: 2-5 days, use 3 as default
        
        -- Long shelf life (weeks to months)
        when 'pantry' then days_to_add := 90; -- Pantry staples: 30-365 days, use 90 as default
        when 'spices_condiments' then days_to_add := 180; -- Spices: 180-365 days, use 180 as default
        when 'snacks' then days_to_add := 60; -- Snacks: 30-180 days, use 60 as default
        when 'beverages' then days_to_add := 180; -- Beverages: 30-365 days, use 180 as default
        
        -- Very long shelf life
        when 'frozen' then days_to_add := 180; -- Frozen: 90-365 days, use 180 as default
        when 'baby' then days_to_add := 30; -- Baby food: 30-90 days, use 30 as default
        when 'personal_care' then days_to_add := 365; -- Personal care: 365+ days
        when 'household' then days_to_add := 365; -- Household: 365+ days
        
        -- Default: 7 days for unknown categories
        else days_to_add := 7;
    end case;
    
    -- Return base_date + estimated days
    return base_date + (days_to_add || ' days')::interval;
end;
$$;

-- Update inventory table to include catalog reference columns if not exists
alter table public.inventory
    add column if not exists catalog_product_id text references public.product_catalog(id) on delete set null,
    add column if not exists catalog_price numeric,
    add column if not exists catalog_image_url text;

-- Create index for faster lookups
create index if not exists idx_inventory_catalog_product_id on public.inventory(catalog_product_id);


-- Add more store sources to product_catalog
alter table public.product_catalog
    drop constraint if exists product_catalog_source_check;

alter table public.product_catalog
    add constraint product_catalog_source_check 
    check (source in (
        'albert-heijn', 
        'colruyt', 
        'lidl', 
        'aldi', 
        'delhaize',
        'carrefour',
        'jumbo',
        'open-food-facts'
    ));

-- Update get_store_label function
create or replace function public.get_store_label(store_source text)
returns text
language sql
stable
as $$
    select case store_source
        when 'albert-heijn' then 'Albert Heijn'
        when 'colruyt' then 'Colruyt'
        when 'lidl' then 'Lidl'
        when 'aldi' then 'Aldi'
        when 'delhaize' then 'Delhaize'
        when 'carrefour' then 'Carrefour'
        when 'jumbo' then 'Jumbo'
        when 'open-food-facts' then 'Open Food Facts'
        else 'Unknown'
    end;
$$;


-- Add source field to product_catalog to track which store the product comes from
alter table public.product_catalog
    add column if not exists source text default 'albert-heijn';

-- Create index for faster lookups by source
create index if not exists idx_product_catalog_source on public.product_catalog(source);

-- Update existing products to have source
update public.product_catalog
set source = 'albert-heijn'
where source is null;

-- Add constraint to ensure valid sources
alter table public.product_catalog
    add constraint product_catalog_source_check 
    check (source in ('albert-heijn', 'colruyt', 'lidl', 'aldi', 'delhaize'));

-- Create a function to get store label (for display)
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
        else 'Unknown'
    end;
$$;

-- Update match_product_catalog to work with all sources
-- The function already works with all sources, but we can add source filtering if needed
-- For now, we'll search across all sources

-- Create a function to upsert products from any source
create or replace function public.upsert_product_catalog_multi_source(
    payload jsonb,
    store_source text default 'albert-heijn'
)
returns public.product_catalog
language plpgsql
as $$
declare
    inserted public.product_catalog;
begin
    -- Ensure source is set
    payload := payload || jsonb_build_object('source', store_source);
    
    -- Use existing upsert function
    select * into inserted
    from public.upsert_product_catalog(payload);
    
    return inserted;
end;
$$;

-- Grant permissions
grant execute on function public.get_store_label(text) to authenticated;
grant execute on function public.get_store_label(text) to anon;
grant execute on function public.upsert_product_catalog_multi_source(jsonb, text) to authenticated;


-- Improve match_product_catalog to use translations and give best matches
-- NOTE: This migration requires migration 15_product_translations.sql to be run first!

-- Drop existing function
drop function if exists public.match_product_catalog(text);

create or replace function public.match_product_catalog(search_term text)
returns table (
    id text,
    product_name text,
    brand text,
    category text,
    barcode text,
    price numeric,
    unit_size text,
    image_url text,
    source text,
    match_score numeric
)
language plpgsql
stable
as $$
declare
    search_lower text;
    search_words text[];
    search_variants text[];
    variant text;
begin
    -- Normalize search term
    search_lower := lower(trim(search_term));
    
    -- Get search variants (original + translations)
    -- Check if translation functions exist, if not use simple search
    begin
        search_variants := public.get_search_variants(search_lower);
        if search_variants is null or array_length(search_variants, 1) = 0 then
            search_variants := ARRAY[search_lower];
        end if;
    exception when others then
        -- If translation functions don't exist yet, just use original term
        search_variants := ARRAY[search_lower];
    end;
    
    -- Split search term into words
    search_words := string_to_array(search_lower, ' ');
    
    return query
    with matches as (
        select
            pc.id,
            pc.product_name,
            pc.brand,
            pc.category,
            pc.barcode,
            pc.price,
            pc.unit_size,
            pc.image_url,
            pc.source,
            -- Calculate match score (higher = better)
            case
                -- Exact match on product name (score 100)
                when lower(pc.product_name) = search_lower then 100.0
                -- Exact match on brand (score 90)
                when lower(coalesce(pc.brand, '')) = search_lower then 90.0
                -- Product name starts with search term (score 80)
                when lower(pc.product_name) like search_lower || '%' then 80.0
                -- Product name contains search term (score 70)
                when lower(pc.product_name) like '%' || search_lower || '%' then 70.0
                -- Brand contains search term (score 60)
                when lower(coalesce(pc.brand, '')) like '%' || search_lower || '%' then 60.0
                -- Word match in product name (score 50)
                when exists (
                    select 1 
                    from unnest(search_words) as word
                    where lower(pc.product_name) like '%' || word || '%'
                ) then 50.0
                -- Translation match (score 45)
                when exists (
                    select 1 
                    from unnest(search_variants) as variant
                    where lower(pc.product_name) like '%' || variant || '%'
                ) then 45.0
                -- High similarity (score 40)
                when similarity(lower(pc.product_name), search_lower) > 0.5 then 40.0
                -- Medium similarity (score 30)
                when similarity(lower(pc.product_name), search_lower) > 0.3 then 30.0
                -- Trigram match (score 20)
                when pc.product_name % search_term then 20.0
                -- Low similarity (score 10)
                when similarity(lower(pc.product_name), search_lower) > 0.2 then 10.0
                else 0.0
            end as match_score
        from public.product_catalog pc
        where pc.is_available = true
          and (
            -- Match on original search term
            lower(pc.product_name) = search_lower
            or lower(coalesce(pc.brand, '')) = search_lower
            or lower(pc.product_name) like '%' || search_lower || '%'
            or lower(coalesce(pc.brand, '')) like '%' || search_lower || '%'
            or exists (
                select 1 
                from unnest(search_words) as word
                where lower(pc.product_name) like '%' || word || '%'
            )
            or pc.product_name % search_term
            or similarity(lower(pc.product_name), search_lower) > 0.2
            -- Match on translated variants
            or exists (
                select 1 
                from unnest(search_variants) as variant
                where lower(pc.product_name) like '%' || variant || '%'
                or lower(coalesce(pc.brand, '')) like '%' || variant || '%'
            )
            -- Also check if product name translates to search term (if function exists)
            or (
                exists (select 1 from pg_proc where proname = 'translate_to_dutch')
                and public.translate_to_dutch(pc.product_name) like '%' || search_lower || '%'
            )
          )
    )
    select
        m.id,
        m.product_name,
        m.brand,
        m.category,
        m.barcode,
        m.price,
        m.unit_size,
        m.image_url,
        m.source,
        m.match_score
    from matches m
    where m.match_score > 0
    order by 
        m.match_score desc, -- Best matches first
        m.product_name -- Alphabetical for same score
    limit 20; -- Return top 20 matches
end;
$$;

-- Grant permissions
grant execute on function public.match_product_catalog(text) to authenticated;
grant execute on function public.match_product_catalog(text) to anon;
grant execute on function public.translate_to_dutch(text) to authenticated;
grant execute on function public.translate_to_dutch(text) to anon;
grant execute on function public.get_search_variants(text) to authenticated;
grant execute on function public.get_search_variants(text) to anon;

-- Create index for better performance
create index if not exists idx_product_catalog_name_lower on public.product_catalog(lower(product_name));
create index if not exists idx_product_catalog_brand_lower on public.product_catalog(lower(brand));


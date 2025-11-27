-- Fix match_product_catalog - make it work again with simpler logic
-- This ensures products are found even if translations don't work

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
    translation_func_exists boolean;
begin
    -- Normalize search term
    search_lower := lower(trim(search_term));
    
    if search_lower is null or length(search_lower) < 1 then
        return;
    end if;
    
    -- Split search term into words
    search_words := string_to_array(search_lower, ' ');
    
    -- Try to get search variants (translations) if function exists
    select exists (
        select 1 from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid
        where n.nspname = 'public' and p.proname = 'get_search_variants'
    ) into translation_func_exists;
    
    if translation_func_exists then
        begin
            search_variants := public.get_search_variants(search_lower);
            if search_variants is null or array_length(search_variants, 1) = 0 then
                search_variants := ARRAY[search_lower];
            end if;
        exception when others then
            search_variants := ARRAY[search_lower];
        end;
    else
        search_variants := ARRAY[search_lower];
    end if;
    
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
                    where length(word) > 2  -- Only match words longer than 2 chars
                    and lower(pc.product_name) like '%' || word || '%'
                ) then 50.0
                -- Translation match (score 45) - only if we have variants
                when array_length(search_variants, 1) > 1 and exists (
                    select 1 
                    from unnest(search_variants) as trans_variant
                    where trans_variant != search_lower
                    and length(trans_variant) > 2
                    and lower(pc.product_name) like '%' || trans_variant || '%'
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
            -- Basic matches (these should always work)
            lower(pc.product_name) = search_lower
            or lower(coalesce(pc.brand, '')) = search_lower
            or lower(pc.product_name) like '%' || search_lower || '%'
            or lower(coalesce(pc.brand, '')) like '%' || search_lower || '%'
            or exists (
                select 1 
                from unnest(search_words) as word
                where length(word) > 2
                and lower(pc.product_name) like '%' || word || '%'
            )
            or pc.product_name % search_term
            or similarity(lower(pc.product_name), search_lower) > 0.2
            -- Translation matches (only if variants exist and are different)
            or (array_length(search_variants, 1) > 1 and exists (
                select 1 
                from unnest(search_variants) as trans_variant
                where trans_variant != search_lower
                and length(trans_variant) > 2
                and (
                    lower(pc.product_name) like '%' || trans_variant || '%'
                    or lower(coalesce(pc.brand, '')) like '%' || trans_variant || '%'
                )
            ))
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

-- Test the function
do $$
begin
    -- Test if function works
    if exists (
        select 1 from public.match_product_catalog('test') limit 1
    ) then
        raise notice 'Function works (found test results)';
    else
        raise notice 'Function works (no test results, but no error)';
    end if;
end $$;


-- Smart search ranking with SEO-like logic
-- Prioritizes fresh/raw products over processed ones
-- Example: "mango" -> fresh mango first, "brood" -> normal bread first

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
    -- Keywords that indicate fresh/raw products (higher priority)
    fresh_keywords text[] := ARRAY['vers', 'fresh', 'rauw', 'raw', 'heel', 'whole', 'ongepeld', 'unpeeled', 'ongekookt', 'uncooked'];
    -- Keywords that indicate processed products (lower priority)
    processed_keywords text[] := ARRAY['bewerkt', 'processed', 'gekookt', 'cooked', 'gepeld', 'peeled', 'gesneden', 'sliced', 'gehakt', 'chopped', 'puree', 'pureed', 'sap', 'juice', 'saus', 'sauce', 'mix', 'mix', 'kant-en-klaar', 'ready-made'];
    -- Categories that are typically fresh (higher priority)
    fresh_categories text[] := ARRAY['fresh_produce', 'seafood', 'meat_poultry', 'dairy_eggs', 'bakery'];
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
            -- Base match score (higher = better)
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
                    where length(word) >= 2
                    and lower(pc.product_name) like '%' || word || '%'
                ) then 50.0
                -- Translation match (score 45)
                when array_length(search_variants, 1) > 1 and exists (
                    select 1 
                    from unnest(search_variants) as trans_variant
                    where trans_variant != search_lower
                    and length(trans_variant) >= 2
                    and lower(pc.product_name) like '%' || trans_variant || '%'
                ) then 45.0
                -- High similarity (score 40)
                when similarity(lower(pc.product_name), search_lower) > 0.4 then 40.0
                -- Medium similarity (score 30)
                when similarity(lower(pc.product_name), search_lower) > 0.25 then 30.0
                -- Trigram match (score 20)
                when pc.product_name % search_term then 20.0
                -- Low similarity (score 10)
                when similarity(lower(pc.product_name), search_lower) > 0.15 then 10.0
                else 0.0
            end as base_score,
            -- Smart ranking bonus/penalty based on product type
            case
                -- Bonus for fresh/raw products (SEO-like: prioritize natural products)
                when exists (
                    select 1 from unnest(fresh_keywords) as keyword
                    where lower(pc.product_name) like '%' || keyword || '%'
                ) then 15.0
                -- Bonus for fresh categories
                when pc.category = any(fresh_categories) then 10.0
                -- Penalty for processed products
                when exists (
                    select 1 from unnest(processed_keywords) as keyword
                    where lower(pc.product_name) like '%' || keyword || '%'
                ) then -10.0
                else 0.0
            end as smart_ranking
        from public.product_catalog pc
        where pc.is_available = true
          and (
            -- Basic matches (these should always work)
            lower(pc.product_name) = search_lower
            or lower(coalesce(pc.brand, '')) = search_lower
            or lower(pc.product_name) like '%' || search_lower || '%'
            or lower(coalesce(pc.brand, '')) like '%' || search_lower || '%'
            -- Word match
            or exists (
                select 1 
                from unnest(search_words) as word
                where length(word) >= 2
                and lower(pc.product_name) like '%' || word || '%'
            )
            -- Trigram match (fuzzy)
            or pc.product_name % search_term
            -- Similarity match
            or similarity(lower(pc.product_name), search_lower) > 0.15
            -- Translation matches
            or (array_length(search_variants, 1) > 1 and exists (
                select 1 
                from unnest(search_variants) as trans_variant
                where trans_variant != search_lower
                and length(trans_variant) >= 2
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
        -- Final score = base score + smart ranking
        (m.base_score + m.smart_ranking) as match_score
    from matches m
    where m.base_score > 0
    order by 
        (m.base_score + m.smart_ranking) desc, -- Best matches first (with smart ranking)
        m.product_name -- Alphabetical for same score
    limit 10; -- Maximum 10 results
end;
$$;

-- Create indexes for better performance
create index if not exists idx_product_catalog_name_lower_trgm on public.product_catalog using gin (lower(product_name) gin_trgm_ops);
create index if not exists idx_product_catalog_brand_lower_trgm on public.product_catalog using gin (lower(brand) gin_trgm_ops);
create index if not exists idx_product_catalog_category_available on public.product_catalog (category, is_available) where is_available = true;
create index if not exists idx_product_catalog_name_pattern on public.product_catalog (lower(product_name) text_pattern_ops) where is_available = true;

-- Grant permissions
grant execute on function public.match_product_catalog(text) to authenticated;
grant execute on function public.match_product_catalog(text) to anon;


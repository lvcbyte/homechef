-- Fix match_product_catalog function - ensure it works correctly
-- Drop and recreate to fix any issues

drop function if exists public.match_product_catalog(text);

-- Recreate the match function with proper return type
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
    match_score numeric
)
language plpgsql
stable
as $$
declare
    translated_terms text[];
    search_variants text[];
begin
    -- Get Dutch translations for English terms
    select array_agg(unnest(dutch_terms))
    into translated_terms
    from public.product_translations
    where english_term = lower(search_term);

    -- Build search variants: original + translations
    search_variants := ARRAY[lower(search_term)];
    if translated_terms is not null then
        search_variants := search_variants || translated_terms;
    end if;

    -- Search with all variants and return multiple results
    return query
    select
        pc.id,
        pc.product_name,
        pc.brand,
        pc.category,
        pc.barcode,
        pc.price,
        pc.unit_size,
        pc.image_url,
        greatest(
            -- Exact match on product name
            case when exists (select 1 from unnest(search_variants) as v where lower(pc.product_name) = v) then 1.0
                 when exists (select 1 from unnest(search_variants) as v where lower(pc.product_name) like '%' || v || '%') then 0.8
                 else 0.0 end,
            -- Similarity match
            similarity(lower(pc.product_name), lower(search_term)),
            similarity(lower(coalesce(pc.brand, '')), lower(search_term)),
            -- Translation match
            case when translated_terms is not null then
                greatest(
                    (select max(similarity(lower(pc.product_name), lower(term))) from unnest(translated_terms) as term),
                    (select max(similarity(lower(coalesce(pc.brand, '')), lower(term))) from unnest(translated_terms) as term)
                )
            else 0.0 end
        ) as match_score
    from public.product_catalog pc
    where pc.is_available = true
      and (
        -- Match on any search variant
        exists (select 1 from unnest(search_variants) as v where lower(pc.product_name) like '%' || v || '%')
        or exists (select 1 from unnest(search_variants) as v where lower(pc.brand) like '%' || v || '%')
        or exists (select 1 from unnest(search_variants) as v where pc.product_name % v)
        or exists (select 1 from unnest(search_variants) as v where pc.brand % v)
        -- Or similarity match
        or similarity(lower(pc.product_name), lower(search_term)) > 0.2
        or similarity(lower(coalesce(pc.brand, '')), lower(search_term)) > 0.2
      )
    order by match_score desc, pc.product_name
    limit 10;
end;
$$;

-- Grant permissions
grant execute on function public.match_product_catalog(text) to authenticated;
grant execute on function public.match_product_catalog(text) to anon;


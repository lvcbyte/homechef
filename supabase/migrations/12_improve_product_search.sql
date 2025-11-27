-- Improve product search to match on words within product names
-- This allows searching "kaas" and finding "AH Goudse kaas" etc.

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
    image_url text
)
language plpgsql
stable
as $$
declare
    search_lower text;
    search_words text[];
begin
    -- Normalize search term
    search_lower := lower(trim(search_term));
    
    -- Split search term into words (for better matching)
    search_words := string_to_array(search_lower, ' ');
    
    return query
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
    where pc.is_available = true
      and (
        -- Exact match (highest priority)
        lower(pc.product_name) = search_lower
        or lower(coalesce(pc.brand, '')) = search_lower
        
        -- Product name contains search term (high priority)
        or lower(pc.product_name) like '%' || search_lower || '%'
        
        -- Brand contains search term
        or lower(coalesce(pc.brand, '')) like '%' || search_lower || '%'
        
        -- Any word in product name matches (for "kaas" finding "AH Goudse kaas")
        or exists (
            select 1 
            from unnest(search_words) as word
            where lower(pc.product_name) like '%' || word || '%'
        )
        
        -- Trigram similarity match (fuzzy matching)
        or pc.product_name % search_term
        or pc.brand % search_term
        
        -- Similarity threshold match
        or similarity(lower(pc.product_name), search_lower) > 0.2
        or similarity(lower(coalesce(pc.brand, '')), search_lower) > 0.2
      )
    order by 
        -- Priority 1: Exact matches
        case 
            when lower(pc.product_name) = search_lower then 1
            when lower(coalesce(pc.brand, '')) = search_lower then 2
            else 3
        end,
        -- Priority 2: Starts with search term
        case 
            when lower(pc.product_name) like search_lower || '%' then 1
            else 2
        end,
        -- Priority 3: Contains search term (word match)
        case 
            when lower(pc.product_name) like '%' || search_lower || '%' then 1
            when exists (
                select 1 
                from unnest(search_words) as word
                where lower(pc.product_name) like '%' || word || '%'
            ) then 2
            else 3
        end,
        -- Priority 4: Similarity score
        greatest(
            similarity(lower(pc.product_name), search_lower),
            similarity(lower(coalesce(pc.brand, '')), search_lower)
        ) desc,
        -- Priority 5: Alphabetical
        pc.product_name
    limit 10;
end;
$$;

-- Grant permissions
grant execute on function public.match_product_catalog(text) to authenticated;
grant execute on function public.match_product_catalog(text) to anon;


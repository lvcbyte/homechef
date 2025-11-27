-- Restore the EXACT original working function from migration 05
-- Only change: limit 10 instead of 5 for more results
-- This is the simple version that worked before

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
where pc.is_available = true
  and (pc.product_name % search_term
   or pc.brand % search_term)
order by greatest(similarity(pc.product_name, search_term), similarity(coalesce(pc.brand, ''), search_term)) desc
limit 10;
$$;

-- Grant permissions
grant execute on function public.match_product_catalog(text) to authenticated;
grant execute on function public.match_product_catalog(text) to anon;

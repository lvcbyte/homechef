-- Improve barcode scanner to work like Yuka app
-- Better matching, faster lookups, and product information

-- Enhanced barcode matching function with better scoring
create or replace function public.match_product_by_barcode_enhanced(p_barcode text)
returns table (
    id text,
    name text,
    brand text,
    barcode text,
    image_url text,
    category text,
    nutrition jsonb,
    match_type text,
    match_score numeric
) as $$
declare
    normalized_barcode text;
begin
    -- Normalize barcode: remove spaces, leading zeros handling
    normalized_barcode = trim(p_barcode);
    
    return query
    with matches as (
        select 
            pc.id,
            pc.product_name,
            pc.brand,
            pc.barcode,
            pc.image_url,
            pc.category,
            pc.nutrition,
            case 
                when pc.barcode = normalized_barcode then 'exact'
                when pc.barcode = lpad(normalized_barcode, 13, '0') then 'ean13_padded'
                when pc.barcode = lpad(normalized_barcode, 8, '0') then 'ean8_padded'
                when pc.barcode = regexp_replace(normalized_barcode, '^0+', '') then 'leading_zeros_removed'
                else 'partial'
            end as match_type,
            case 
                when pc.barcode = normalized_barcode then 100.0
                when pc.barcode = lpad(normalized_barcode, 13, '0') then 95.0
                when pc.barcode = lpad(normalized_barcode, 8, '0') then 95.0
                when pc.barcode = regexp_replace(normalized_barcode, '^0+', '') then 90.0
                else 50.0
            end as match_score
        from public.product_catalog pc
        where (
            pc.barcode = normalized_barcode
            or pc.barcode = lpad(normalized_barcode, 13, '0')
            or pc.barcode = lpad(normalized_barcode, 8, '0')
            or pc.barcode = regexp_replace(normalized_barcode, '^0+', '')
        )
        and pc.is_available = true
    )
    select 
        m.id,
        m.product_name as name,
        m.brand,
        m.barcode,
        m.image_url,
        m.category,
        m.nutrition,
        m.match_type,
        m.match_score
    from matches m
    order by m.match_score desc, m.product_name
    limit 1;
end;
$$ language plpgsql stable security definer;

-- Function to get product details by barcode (for display)
create or replace function public.get_product_by_barcode(p_barcode text)
returns jsonb as $$
declare
    result jsonb;
begin
    select jsonb_build_object(
        'id', pc.id,
        'name', pc.product_name,
        'brand', pc.brand,
        'barcode', pc.barcode,
        'image_url', pc.image_url,
        'category', pc.category,
        'nutrition', pc.nutrition,
        'price', pc.price,
        'metadata', pc.metadata,
        'is_available', pc.is_available
    ) into result
    from public.product_catalog pc
    where (
        pc.barcode = p_barcode
        or pc.barcode = lpad(p_barcode, 13, '0')
        or pc.barcode = lpad(p_barcode, 8, '0')
        or pc.barcode = regexp_replace(p_barcode, '^0+', '')
    )
    and pc.is_available = true
    limit 1;
    
    return coalesce(result, 'null'::jsonb);
end;
$$ language plpgsql stable security definer;

-- Update barcode_scans to store more information
alter table public.barcode_scans
    add column if not exists product_name text,
    add column if not exists product_brand text,
    add column if not exists match_confidence numeric(5, 2);

-- Drop old versions of function if they exist (with different signatures)
drop function if exists public.log_barcode_scan(uuid, text, uuid, text, text, numeric);
drop function if exists public.log_barcode_scan(uuid, text, text, text, text, numeric);

-- Function to log barcode scan with product info
create or replace function public.log_barcode_scan(
    p_user_id uuid,
    p_barcode text,
    p_product_id text default null,
    p_product_name text default null,
    p_product_brand text default null,
    p_match_confidence numeric default null
)
returns uuid as $$
declare
    scan_id uuid;
begin
    insert into public.barcode_scans (
        user_id,
        ean,
        catalog_product_id,
        product_name,
        product_brand,
        product_found,
        match_confidence,
        created_at
    ) values (
        p_user_id,
        p_barcode,
        p_product_id,
        p_product_name,
        p_product_brand,
        p_product_id is not null,
        p_match_confidence,
        timezone('utc', now())
    )
    returning id into scan_id;
    
    return scan_id;
end;
$$ language plpgsql security definer;

-- Grant permissions
grant execute on function public.match_product_by_barcode_enhanced(text) to authenticated;
grant execute on function public.match_product_by_barcode_enhanced(text) to anon;
grant execute on function public.get_product_by_barcode(text) to authenticated;
grant execute on function public.get_product_by_barcode(text) to anon;
grant execute on function public.log_barcode_scan(uuid, text, text, text, text, numeric) to authenticated;

-- Add comments
comment on function public.match_product_by_barcode_enhanced(text) is 'Enhanced barcode matching with multiple format support and scoring, similar to Yuka app';
comment on function public.get_product_by_barcode(text) is 'Get complete product information by barcode for display';
comment on function public.log_barcode_scan(uuid, text, text, text, text, numeric) is 'Log a barcode scan with product matching information';


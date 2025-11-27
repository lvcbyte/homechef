-- Fix upsert_product_catalog to include source field
create or replace function public.upsert_product_catalog(payload jsonb)
returns public.product_catalog
language plpgsql
as $$
declare
    inserted public.product_catalog;
begin
    insert into public.product_catalog (
        id,
        product_name,
        brand,
        category,
        barcode,
        description,
        image_url,
        unit_size,
        nutrition,
        price,
        is_available,
        source,
        metadata
    )
    values (
        payload->>'id',
        payload->>'product_name',
        payload->>'brand',
        payload->>'category',
        payload->>'barcode',
        payload->>'description',
        payload->>'image_url',
        payload->>'unit_size',
        payload->'nutrition',
        (payload->>'price')::numeric,
        coalesce((payload->>'is_available')::boolean, true),
        coalesce(payload->>'source', 'albert-heijn'), -- Default to albert-heijn if not specified
        payload
    )
    on conflict (id) do update
    set product_name   = excluded.product_name,
        brand          = excluded.brand,
        category       = excluded.category,
        barcode        = excluded.barcode,
        description    = excluded.description,
        image_url      = excluded.image_url,
        unit_size      = excluded.unit_size,
        nutrition      = excluded.nutrition,
        price          = excluded.price,
        is_available   = excluded.is_available,
        source         = excluded.source, -- Update source on conflict
        metadata       = excluded.metadata,
        updated_at     = timezone('utc', now())
    returning * into inserted;

    return inserted;
end;
$$;


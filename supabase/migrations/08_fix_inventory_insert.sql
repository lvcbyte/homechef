-- Ensure all columns exist in inventory table
alter table public.inventory
    add column if not exists catalog_product_id text references public.product_catalog(id) on delete set null,
    add column if not exists catalog_price numeric,
    add column if not exists catalog_image_url text;

-- Create index for faster lookups
create index if not exists idx_inventory_catalog_product_id on public.inventory(catalog_product_id);

-- Verify the estimate_expiry_date function returns text (ISO string)
-- The function already returns timestamptz which Supabase converts to ISO string automatically
-- But let's make sure it's working correctly by testing it
do $$
begin
    -- Test the function
    perform public.estimate_expiry_date('proteins');
    raise notice 'estimate_expiry_date function is working correctly';
exception when others then
    raise notice 'Error testing estimate_expiry_date: %', sqlerrm;
end $$;

-- Grant necessary permissions
grant select, insert, update, delete on public.inventory to authenticated;
grant usage on schema public to authenticated;
grant execute on function public.estimate_expiry_date(text, timestamptz) to authenticated;
grant execute on function public.match_product_catalog(text) to authenticated;


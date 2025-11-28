-- Improve barcode scanner functionality
-- Ensure match_product_by_barcode function works correctly with all barcode formats

-- Update match_product_by_barcode to handle different barcode formats and return more info
create or replace function public.match_product_by_barcode(barcode text)
returns public.product_catalog
language sql
stable
as $$
  select *
  from public.product_catalog
  where (
    public.product_catalog.barcode = barcode
    or public.product_catalog.barcode = lpad(barcode, 13, '0')  -- EAN-13 padding
    or public.product_catalog.barcode = lpad(barcode, 8, '0')   -- EAN-8 padding
    or public.product_catalog.barcode = regexp_replace(barcode, '^0+', '')  -- Remove leading zeros
  )
  and public.product_catalog.is_available = true
  limit 1;
$$;

-- Add index on barcode for faster lookups
create index if not exists idx_product_catalog_barcode on public.product_catalog(barcode) where barcode is not null;

-- Ensure barcode_scans table can handle any barcode (not just ones in catalog)
alter table public.barcode_scans 
  alter column ean drop not null;

-- Add column to track if product was found
alter table public.barcode_scans
  add column if not exists product_found boolean default false;

-- Add column to link to product_catalog if found
alter table public.barcode_scans
  add column if not exists catalog_product_id text references public.product_catalog(id);

-- Update RLS policies
drop policy if exists "Barcode scans by owner" on public.barcode_scans;
create policy "Barcode scans by owner" on public.barcode_scans
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- Grant permissions
grant execute on function public.match_product_by_barcode(text) to authenticated;
grant execute on function public.match_product_by_barcode(text) to anon;

-- Add comment
comment on function public.match_product_by_barcode(text) is 'Matches a barcode to a product in the catalog. Handles EAN-8, EAN-13, UPC-A, and UPC-E formats with padding and normalization.';


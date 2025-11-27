-- Fix barcode_scans table to support session_id and remove foreign key constraint
-- This allows barcodes to be scanned even if not in barcode_catalog

alter table public.barcode_scans 
  drop constraint if exists barcode_scans_ean_fkey;

alter table public.barcode_scans
  add column if not exists session_id uuid references public.scan_sessions(id) on delete cascade;

-- Update RLS policy to include session_id
drop policy if exists "Barcode scans by owner" on public.barcode_scans;
create policy "Barcode scans by owner" on public.barcode_scans
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- Ensure match_product_by_barcode function exists and works correctly
create or replace function public.match_product_by_barcode(barcode text)
returns public.product_catalog
language sql
stable
as $$
  select *
  from public.product_catalog
  where public.product_catalog.barcode = barcode
    and public.product_catalog.is_available = true
  limit 1;
$$;

-- Grant permissions
grant execute on function public.match_product_by_barcode(text) to authenticated;
grant execute on function public.match_product_by_barcode(text) to anon;


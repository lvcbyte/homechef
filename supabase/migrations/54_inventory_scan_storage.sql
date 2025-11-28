-- Ensure the inventory-scans bucket exists (idempotent)
do $$
begin
    insert into storage.buckets (id, name, public)
    values ('inventory-scans', 'inventory-scans', true)
    on conflict (id) do update set public = true;
end $$;

-- Drop policies if they already exist (CREATE POLICY has no IF NOT EXISTS)
drop policy if exists "inventory scans upload" on storage.objects;
drop policy if exists "inventory scans select" on storage.objects;

-- Allow authenticated users to upload shelf shots
create policy "inventory scans upload"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'inventory-scans'
        and owner = auth.uid()
    );

-- Allow authenticated users to view their own shelf shots
create policy "inventory scans select"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'inventory-scans'
        and owner = auth.uid()
    );

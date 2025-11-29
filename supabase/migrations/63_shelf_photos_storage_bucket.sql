-- Storage bucket configuration for shelf photos
-- Separate bucket for shelf photos with size limits

-- Create shelf-photos bucket (separate from inventory-scans for better organization)
do $$
begin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
        'shelf-photos', 
        'shelf-photos', 
        true,
        5242880, -- 5MB limit per file
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    )
    on conflict (id) do update 
    set 
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
end $$;

-- Drop existing policies if they exist
drop policy if exists "shelf photos upload" on storage.objects;
drop policy if exists "shelf photos select" on storage.objects;
drop policy if exists "shelf photos update" on storage.objects;
drop policy if exists "shelf photos delete" on storage.objects;

-- Allow authenticated users to upload shelf photos (max 5MB)
-- Note: File size limit is enforced by bucket configuration, not in policy
create policy "shelf photos upload"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'shelf-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to view their own shelf photos
create policy "shelf photos select"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'shelf-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to update their own shelf photos
create policy "shelf photos update"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'shelf-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'shelf-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to delete their own shelf photos
create policy "shelf photos delete"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'shelf-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Function to get storage usage for a user
create or replace function get_user_shelf_storage_usage(p_user_id uuid)
returns jsonb as $$
declare
    total_files integer;
    total_size_mb numeric;
    max_size_mb numeric := 50.0; -- 50MB total limit per user
begin
    select 
        count(*),
        coalesce(sum(file_size_bytes), 0)::numeric / 1024 / 1024
    into total_files, total_size_mb
    from public.shelf_photos
    where user_id = p_user_id;
    
    return jsonb_build_object(
        'total_files', total_files,
        'total_size_mb', round(total_size_mb, 2),
        'max_size_mb', max_size_mb,
        'used_percentage', round((total_size_mb / max_size_mb * 100), 1),
        'remaining_mb', round(greatest(0, max_size_mb - total_size_mb), 2)
    );
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function get_user_shelf_storage_usage(uuid) to authenticated;


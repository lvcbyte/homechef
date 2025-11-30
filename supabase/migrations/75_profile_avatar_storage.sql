-- Profile Avatar Storage and Database Updates
-- Adds avatar_url to profiles table and creates storage bucket

-- ============================================
-- 1. ADD AVATAR_URL TO PROFILES TABLE
-- ============================================

alter table public.profiles
    add column if not exists avatar_url text;

-- Create index for faster lookups
create index if not exists idx_profiles_avatar_url on public.profiles(avatar_url) where avatar_url is not null;

-- ============================================
-- 2. CREATE PROFILE AVATARS STORAGE BUCKET
-- ============================================

-- Create profile-avatars bucket
do $$
begin
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
        'profile-avatars', 
        'profile-avatars', 
        true,
        1572864, -- 1.5MB limit per file (well under 2MB to avoid errors)
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    )
    on conflict (id) do update 
    set 
        public = true,
        file_size_limit = 1572864,
        allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
end $$;

-- ============================================
-- 3. STORAGE POLICIES FOR PROFILE AVATARS
-- ============================================

-- Drop existing policies if they exist
drop policy if exists "profile avatars upload" on storage.objects;
drop policy if exists "profile avatars select" on storage.objects;
drop policy if exists "profile avatars update" on storage.objects;
drop policy if exists "profile avatars delete" on storage.objects;

-- Allow authenticated users to upload their own profile avatar
create policy "profile avatars upload"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'profile-avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or name like auth.uid()::text || '/%'
        )
    );

-- Allow anyone to view profile avatars (public bucket)
create policy "profile avatars select"
    on storage.objects
    for select
    to public
    using (bucket_id = 'profile-avatars');

-- Allow authenticated users to update their own profile avatar
create policy "profile avatars update"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or name like auth.uid()::text || '/%'
        )
    )
    with check (
        bucket_id = 'profile-avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or name like auth.uid()::text || '/%'
        )
    );

-- Allow authenticated users to delete their own profile avatar
create policy "profile avatars delete"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or name like auth.uid()::text || '/%'
        )
    );

-- ============================================
-- 4. FUNCTION TO UPDATE PROFILE AVATAR URL
-- ============================================

create or replace function update_profile_avatar_url(
    p_user_id uuid,
    p_avatar_url text
)
returns void
language plpgsql
security definer
as $$
begin
    update public.profiles
    set avatar_url = p_avatar_url
    where id = p_user_id;
end;
$$;

grant execute on function update_profile_avatar_url(uuid, text) to authenticated;

-- Comments
comment on column public.profiles.avatar_url is 'URL to the user profile avatar image stored in profile-avatars bucket';
comment on function update_profile_avatar_url is 'Updates the avatar URL for a user profile';


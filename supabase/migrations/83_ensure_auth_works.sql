-- Ensure auth works correctly
-- This migration ensures all necessary policies and functions are in place

-- Ensure profiles table exists and has correct structure
-- This is a safety check
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    raise exception 'Profiles table does not exist. Please run earlier migrations first.';
  end if;
end $$;

-- Ensure RLS is enabled on profiles
alter table public.profiles enable row level security;

-- Drop existing policies if they exist and recreate them to ensure they're correct
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;

-- Create policy for users to insert their own profile
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Create policy for users to update their own profile
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Create policy for users to view their own profile
create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Ensure the trigger function exists and works
create or replace function ensure_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert profile if it doesn't exist
  insert into public.profiles (
    id,
    archetype,
    cooking_skill,
    dietary_restrictions,
    onboarding_completed
  )
  values (
    new.id,
    'Minimalist',
    'Intermediate',
    '[]'::jsonb,
    false
  )
  on conflict (id) do nothing;
  
  return new;
end;
$$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function ensure_user_profile();

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant all on public.profiles to authenticated;

-- Ensure all required columns exist with defaults
do $$
begin
  -- Add columns if they don't exist
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'archetype') then
    alter table public.profiles add column archetype text default 'Minimalist';
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'cooking_skill') then
    alter table public.profiles add column cooking_skill text default 'Intermediate';
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'dietary_restrictions') then
    alter table public.profiles add column dietary_restrictions jsonb default '[]'::jsonb;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_completed') then
    alter table public.profiles add column onboarding_completed boolean default false;
  end if;
  
  -- Set defaults for existing columns
  alter table public.profiles 
    alter column archetype set default 'Minimalist',
    alter column cooking_skill set default 'Intermediate',
    alter column dietary_restrictions set default '[]'::jsonb,
    alter column onboarding_completed set default false;
end $$;


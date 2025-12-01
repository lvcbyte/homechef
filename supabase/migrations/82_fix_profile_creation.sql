-- Fix profile creation for sign-up
-- This ensures profiles can be created during sign-up without issues

-- Ensure profiles table has all required columns with defaults
alter table public.profiles 
  alter column archetype set default 'Minimalist',
  alter column cooking_skill set default 'Intermediate',
  alter column dietary_restrictions set default '[]'::jsonb,
  alter column onboarding_completed set default false;

-- Create or replace function to ensure profile exists
-- This can be called from triggers or manually
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

-- Create trigger to automatically create profile when user signs up
-- This ensures profile is always created, even if the app code fails
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function ensure_user_profile();

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant all on public.profiles to authenticated;

-- Ensure RLS policies allow profile creation
-- Check if policy exists, if not create it
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'profiles' 
    and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
      on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;
end $$;

-- Ensure users can update their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'profiles' 
    and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile"
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- Ensure users can select their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'profiles' 
    and policyname = 'Users can view their own profile'
  ) then
    create policy "Users can view their own profile"
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;
end $$;


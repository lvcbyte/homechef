-- Ensure profiles table has correct schema for preferences
-- This migration ensures all necessary columns exist and have correct types

-- Check if columns exist, if not add them
do $$
begin
    -- Ensure archetype column exists
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'profiles' 
        and column_name = 'archetype'
    ) then
        alter table public.profiles add column archetype text;
    end if;
    
    -- Ensure dietary_restrictions column exists
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'profiles' 
        and column_name = 'dietary_restrictions'
    ) then
        alter table public.profiles add column dietary_restrictions jsonb not null default '[]'::jsonb;
    end if;
    
    -- Ensure cooking_skill column exists
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'profiles' 
        and column_name = 'cooking_skill'
    ) then
        alter table public.profiles add column cooking_skill text;
    end if;
end $$;

-- Ensure archetype has a default value if null
update public.profiles
set archetype = 'Bio-Hacker'
where archetype is null;

-- Ensure cooking_skill has a default value if null
update public.profiles
set cooking_skill = 'Intermediate'
where cooking_skill is null;

-- Ensure dietary_restrictions is always an array
update public.profiles
set dietary_restrictions = '[]'::jsonb
where dietary_restrictions is null;

-- Add constraint to ensure valid archetype values
do $$
begin
    if not exists (
        select 1 from pg_constraint 
        where conname = 'profiles_archetype_check'
    ) then
        alter table public.profiles
        add constraint profiles_archetype_check
        check (archetype in ('Minimalist', 'Bio-Hacker', 'Flavor Hunter', 'Meal Prepper', 'Family Manager'));
    end if;
end $$;

-- Add constraint to ensure valid cooking_skill values
do $$
begin
    if not exists (
        select 1 from pg_constraint 
        where conname = 'profiles_cooking_skill_check'
    ) then
        alter table public.profiles
        add constraint profiles_cooking_skill_check
        check (cooking_skill in ('Beginner', 'Intermediate', 'Advanced'));
    end if;
end $$;

-- Ensure RLS policies allow users to update their own profile
drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner" on public.profiles
    for update using (auth.uid() = id);

-- Ensure RLS policies allow users to insert their own profile
drop policy if exists "Profiles are insertable by owner" on public.profiles;
create policy "Profiles are insertable by owner" on public.profiles
    for insert with check (auth.uid() = id);


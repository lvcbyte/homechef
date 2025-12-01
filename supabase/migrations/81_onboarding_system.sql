-- Onboarding System
-- This migration adds onboarding tracking to profiles

-- Add onboarding_completed flag to profiles
alter table public.profiles 
add column if not exists onboarding_completed boolean default false;

-- Add onboarding_started_at timestamp
alter table public.profiles 
add column if not exists onboarding_started_at timestamptz;

-- Add onboarding_completed_at timestamp
alter table public.profiles 
add column if not exists onboarding_completed_at timestamptz;

-- Set onboarding_completed to false for all existing users (they can complete it if they want)
-- New users will have it set to false by default
update public.profiles
set onboarding_completed = false
where onboarding_completed is null;

-- Create function to mark onboarding as completed
create or replace function complete_onboarding(
    p_archetype text,
    p_cooking_skill text,
    p_dietary_restrictions jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Update profile with preferences and mark onboarding as completed
    update public.profiles
    set 
        archetype = p_archetype,
        cooking_skill = p_cooking_skill,
        dietary_restrictions = p_dietary_restrictions,
        onboarding_completed = true,
        onboarding_completed_at = timezone('utc', now())
    where id = v_user_id;
    
    -- If profile doesn't exist, create it
    if not found then
        insert into public.profiles (
            id,
            archetype,
            cooking_skill,
            dietary_restrictions,
            onboarding_completed,
            onboarding_completed_at
        )
        values (
            v_user_id,
            p_archetype,
            p_cooking_skill,
            p_dietary_restrictions,
            true,
            timezone('utc', now())
        );
    end if;
    
    return true;
end;
$$;

-- Grant execute permission
grant execute on function complete_onboarding(text, text, jsonb) to authenticated;

-- Create function to mark onboarding as started
create or replace function start_onboarding()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
begin
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'User must be authenticated';
    end if;
    
    -- Update profile to mark onboarding as started
    update public.profiles
    set onboarding_started_at = timezone('utc', now())
    where id = v_user_id;
    
    return true;
end;
$$;

-- Grant execute permission
grant execute on function start_onboarding() to authenticated;


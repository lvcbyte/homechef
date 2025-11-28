-- Ensure all auth users have a profile
-- This trigger automatically creates a profile when a new user signs up

-- Function to create profile for new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.profiles (id, archetype, dietary_restrictions, cooking_skill)
    values (
        new.id,
        'Minimalist', -- Default archetype
        '[]'::jsonb, -- Default dietary restrictions
        'Intermediate' -- Default cooking skill
    )
    on conflict (id) do nothing; -- Don't overwrite if profile already exists
    return new;
end;
$$;

-- Drop trigger if exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger to automatically create profile for new users
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- Also create profiles for existing users who don't have one
insert into public.profiles (id, archetype, dietary_restrictions, cooking_skill)
select 
    u.id,
    'Minimalist',
    '[]'::jsonb,
    'Intermediate'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


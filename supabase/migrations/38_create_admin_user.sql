-- Create Admin User Script
-- Run this AFTER creating the auth user in Supabase Auth

-- Step 1: Create the auth user first (do this in Supabase Dashboard > Authentication)
-- Email: ADMINDIETMAR@admin.stockpit.app (or your email)
-- Password: [your password]

-- Step 2: After creating the auth user, get their UUID and run:
-- SELECT set_admin_user('USER_UUID_HERE', 'owner');

-- Or manually update the profile:
-- UPDATE public.profiles
-- SET 
--   is_admin = true,
--   admin_role = 'owner',
--   admin_permissions = jsonb_build_object(
--     'can_manage_users', true,
--     'can_manage_recipes', true,
--     'can_manage_inventory', true,
--     'can_view_logs', true,
--     'can_modify_database', true,
--     'can_access_api', true
--   )
-- WHERE id = 'USER_UUID_HERE';

-- Helper: Find user by email and set as admin
create or replace function set_admin_by_email(p_email text, p_role text default 'owner')
returns void
language plpgsql
security definer
as $$
declare
    v_user_id uuid;
begin
    -- Find user by email
    select id into v_user_id
    from auth.users
    where email = p_email
    limit 1;

    if v_user_id is null then
        raise exception 'User with email % not found', p_email;
    end if;

    -- Ensure profile exists
    insert into public.profiles (id, email, is_admin, admin_role, admin_permissions)
    values (
        v_user_id,
        p_email,
        true,
        p_role,
        jsonb_build_object(
            'can_manage_users', true,
            'can_manage_recipes', true,
            'can_manage_inventory', true,
            'can_view_logs', true,
            'can_modify_database', true,
            'can_access_api', true
        )
    )
    on conflict (id) do update
    set
        is_admin = true,
        admin_role = p_role,
        admin_permissions = jsonb_build_object(
            'can_manage_users', true,
            'can_manage_recipes', true,
            'can_manage_inventory', true,
            'can_view_logs', true,
            'can_modify_database', true,
            'can_access_api', true
        );

    raise notice 'Admin user % set with role %', p_email, p_role;
end;
$$;

-- Usage:
-- SELECT set_admin_by_email('ADMINDIETMAR@admin.stockpit.app', 'owner');
-- Or with your actual email:
-- SELECT set_admin_by_email('your-email@example.com', 'owner');


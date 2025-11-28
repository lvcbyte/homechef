-- Create Admin Account for dietmar@stockpit.com
-- This script sets up the admin account after the auth user is created

-- IMPORTANT: First create the auth user in Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add User" > "Create new user"
-- 3. Email: dietmar@stockpit.com
-- 4. Password: Ikbendebeste
-- 5. Click "Create User"
-- 6. Copy the User UUID

-- Then run this script to set admin permissions:

-- Option 1: If you know the UUID, use this:
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

-- Option 2: Use the helper function (recommended)
-- This will find the user by email and set admin permissions
DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'dietmar@stockpit.com';
BEGIN
    -- Find user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found. Please create the auth user first in Supabase Dashboard > Authentication > Users', v_email;
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, email, is_admin, admin_role, admin_permissions)
    VALUES (
        v_user_id,
        v_email,
        true,
        'owner',
        jsonb_build_object(
            'can_manage_users', true,
            'can_manage_recipes', true,
            'can_manage_inventory', true,
            'can_view_logs', true,
            'can_modify_database', true,
            'can_access_api', true
        )
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = v_email,
        is_admin = true,
        admin_role = 'owner',
        admin_permissions = jsonb_build_object(
            'can_manage_users', true,
            'can_manage_recipes', true,
            'can_manage_inventory', true,
            'can_view_logs', true,
            'can_modify_database', true,
            'can_access_api', true
        );

    RAISE NOTICE 'Admin account created successfully for % with UUID: %', v_email, v_user_id;
END $$;

-- Verify the admin account was created
SELECT 
    p.id,
    p.email,
    p.is_admin,
    p.admin_role,
    p.admin_permissions
FROM public.profiles p
WHERE p.email = 'dietmar@stockpit.com';


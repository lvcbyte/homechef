-- Fix: Grant Admin Rights to diet.je@hotmail.com (without email column)
-- This script gives admin permissions to an existing user

DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'diet.je@hotmail.com';
BEGIN
    -- Find user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email % not found in auth.users. Please check the email address.', v_email;
    END IF;

    -- Ensure profile exists and set admin permissions (without email column)
    INSERT INTO public.profiles (id, is_admin, admin_role, admin_permissions)
    VALUES (
        v_user_id,
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

    RAISE NOTICE 'Admin rights granted successfully to % (UUID: %)', v_email, v_user_id;
END $$;

-- Verify the admin account was created
SELECT 
    p.id,
    u.email,
    p.is_admin,
    p.admin_role,
    p.admin_permissions
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'diet.je@hotmail.com';


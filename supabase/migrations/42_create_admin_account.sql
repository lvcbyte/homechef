-- Create Admin Account: ADMIN / ADMIN123
-- This script creates a complete admin account from scratch

DO $$
DECLARE
    v_user_id uuid;
    v_email text := 'admin@stockpit.app';
    v_password text := 'ADMIN123';
    v_encrypted_password text;
BEGIN
    -- Check if user already exists
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = v_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        -- Generate a UUID for the new user
        v_user_id := gen_random_uuid();
        
        -- Create auth user
        -- Note: We can't directly insert into auth.users with encrypted password
        -- This needs to be done via Supabase Auth API or Dashboard
        -- So we'll create the profile and the user needs to be created via Dashboard first
        
        RAISE EXCEPTION 'Please create the auth user first in Supabase Dashboard:
1. Go to Authentication > Users
2. Click "Add User" > "Create new user"
3. Email: admin@stockpit.app
4. Password: ADMIN123
5. Auto Confirm User: Yes
6. Click "Create User"
7. Then run this script again to set admin permissions.';
    END IF;

    -- Now set admin permissions on the profile
    -- Use a valid archetype value (check constraint allows: Minimalist, Bio-Hacker, Flavor Hunter, Meal Prepper, Family Manager, None)
    INSERT INTO public.profiles (
        id, 
        archetype, 
        dietary_restrictions, 
        cooking_skill,
        is_admin, 
        admin_role, 
        admin_permissions
    )
    VALUES (
        v_user_id,
        'Minimalist', -- Valid archetype value
        '[]'::jsonb,
        'Advanced',
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
        archetype = COALESCE(profiles.archetype, 'Minimalist'),
        dietary_restrictions = COALESCE(profiles.dietary_restrictions, '[]'::jsonb),
        cooking_skill = COALESCE(profiles.cooking_skill, 'Advanced'),
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

    RAISE NOTICE 'Admin account configured successfully for % (UUID: %)', v_email, v_user_id;
    RAISE NOTICE 'Login credentials:';
    RAISE NOTICE '  Email: admin@stockpit.app';
    RAISE NOTICE '  Password: ADMIN123';
END $$;

-- Verify the admin account
SELECT 
    p.id,
    u.email,
    p.is_admin,
    p.admin_role,
    p.archetype
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@stockpit.app';


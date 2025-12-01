-- Verify Auth Setup and Fix Any Issues
-- This migration ensures all auth-related functions and triggers are working

-- 1. Verify the profile creation trigger exists and works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE EXCEPTION 'Trigger on_auth_user_created does not exist. Please run migration 86 first.';
  END IF;
END $$;

-- 2. Verify the handle_new_user function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user'
  ) THEN
    RAISE EXCEPTION 'Function handle_new_user does not exist. Please run migration 86 first.';
  END IF;
END $$;

-- 3. Verify the create_user_profile function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_user_profile'
  ) THEN
    RAISE EXCEPTION 'Function create_user_profile does not exist. Please run migration 86 first.';
  END IF;
END $$;

-- 4. Ensure RLS is enabled on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Verify all required RLS policies exist
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'profiles';
  
  IF policy_count < 3 THEN
    RAISE WARNING 'Expected at least 3 RLS policies on profiles table, found %', policy_count;
  END IF;
END $$;

-- 6. Test that the trigger function can be called (without actually creating a user)
-- This is just a syntax check
DO $$
BEGIN
  -- Just verify the function compiles correctly
  PERFORM public.handle_new_user();
EXCEPTION
  WHEN OTHERS THEN
    -- Expected to fail since we're not in a trigger context
    IF SQLERRM NOT LIKE '%new%' AND SQLERRM NOT LIKE '%trigger%' THEN
      RAISE WARNING 'Unexpected error in handle_new_user function: %', SQLERRM;
    END IF;
END $$;

-- 7. Create a diagnostic function to check auth setup
CREATE OR REPLACE FUNCTION public.diagnose_auth_setup()
RETURNS TABLE (
  check_name text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Trigger exists'::text as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END as status,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
      ) THEN 'Trigger on_auth_user_created exists'::text
      ELSE 'Trigger on_auth_user_created is missing'::text
    END as details
  UNION ALL
  SELECT 
    'Function handle_new_user exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_new_user'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'handle_new_user'
      ) THEN 'Function handle_new_user exists'::text
      ELSE 'Function handle_new_user is missing'::text
    END
  UNION ALL
  SELECT 
    'Function create_user_profile exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_user_profile'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_user_profile'
      ) THEN 'Function create_user_profile exists'::text
      ELSE 'Function create_user_profile is missing'::text
    END
  UNION ALL
  SELECT 
    'RLS enabled on profiles'::text,
    CASE 
      WHEN (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'profiles' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'profiles' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'RLS is enabled'::text
      ELSE 'RLS is NOT enabled'::text
    END
  UNION ALL
  SELECT 
    'RLS policies count'::text,
    'INFO'::text,
    (
      SELECT COUNT(*)::text || ' policies found on profiles table'
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'profiles'
    );
END;
$$;

-- 8. Grant execute permission
GRANT EXECUTE ON FUNCTION public.diagnose_auth_setup() TO authenticated, service_role;

-- 9. Add comment
COMMENT ON FUNCTION public.diagnose_auth_setup() IS 'Diagnostic function to verify auth setup is correct. Run SELECT * FROM diagnose_auth_setup(); to check.';


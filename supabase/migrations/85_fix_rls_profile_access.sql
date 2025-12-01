-- Fix RLS Policies for Profile Access
-- This ensures authenticated users can always access their own profile

-- 1. Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Authenticated users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can delete their own profile." ON public.profiles;

-- 3. Create comprehensive RLS policies
-- Policy for SELECT (view own profile)
CREATE POLICY "Authenticated users can view their own profile."
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy for UPDATE (update own profile)
CREATE POLICY "Authenticated users can update their own profile."
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy for INSERT (create own profile)
CREATE POLICY "Authenticated users can insert their own profile."
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy for DELETE (delete own profile) - optional but good practice
CREATE POLICY "Authenticated users can delete their own profile."
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- 4. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- 5. Ensure the trigger function can bypass RLS (it already has SECURITY DEFINER)
-- The handle_new_user function already has SECURITY DEFINER, so it can bypass RLS
-- This is correct - we want the trigger to be able to create profiles

-- 6. Create a helper function to verify RLS setup
CREATE OR REPLACE FUNCTION public.verify_rls_setup()
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
    'RLS enabled on profiles'::text as check_name,
    CASE 
      WHEN (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'profiles' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END as status,
    CASE 
      WHEN (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'profiles' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'RLS is enabled'::text
      ELSE 'RLS is NOT enabled'::text
    END as details
  UNION ALL
  SELECT 
    'SELECT policy exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Authenticated users can view their own profile.'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Authenticated users can view their own profile.'
      ) THEN 'SELECT policy exists'::text
      ELSE 'SELECT policy missing'::text
    END
  UNION ALL
  SELECT 
    'UPDATE policy exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Authenticated users can update their own profile.'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Authenticated users can update their own profile.'
      ) THEN 'UPDATE policy exists'::text
      ELSE 'UPDATE policy missing'::text
    END
  UNION ALL
  SELECT 
    'INSERT policy exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Authenticated users can insert their own profile.'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Authenticated users can insert their own profile.'
      ) THEN 'INSERT policy exists'::text
      ELSE 'INSERT policy missing'::text
    END;
END;
$$;

-- 7. Grant execute permission
GRANT EXECUTE ON FUNCTION public.verify_rls_setup() TO authenticated;

-- 8. Add comments
COMMENT ON POLICY "Authenticated users can view their own profile." ON public.profiles IS 'Allows authenticated users to view their own profile. Prevents access denied errors.';
COMMENT ON POLICY "Authenticated users can update their own profile." ON public.profiles IS 'Allows authenticated users to update their own profile.';
COMMENT ON POLICY "Authenticated users can insert their own profile." ON public.profiles IS 'Allows authenticated users to create their own profile.';
COMMENT ON FUNCTION public.verify_rls_setup() IS 'Helper function to verify RLS policies are correctly set up for profile access.';


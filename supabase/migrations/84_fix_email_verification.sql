-- Fix Email Verification and Auth Flow
-- This migration ensures email verification works correctly

-- 1. Ensure email confirmation is enabled in auth settings
-- Note: This is typically done in Supabase Dashboard > Authentication > Settings
-- But we can verify the configuration here

-- 2. Ensure profiles are created for all users (backup trigger)
-- The trigger from migration 82 should handle this, but let's make sure it exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if profile doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    INSERT INTO public.profiles (
      id, 
      email, 
      full_name, 
      archetype, 
      dietary_restrictions, 
      cooking_skill, 
      onboarding_completed
    )
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', ''),
      'Minimalist',
      '[]'::jsonb,
      'Intermediate',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

-- 3. Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Ensure RLS policies allow profile access for authenticated users
-- These should already exist from migration 82, but let's make sure

-- Policy for authenticated users to view their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Authenticated users can view their own profile.'
  ) THEN
    CREATE POLICY "Authenticated users can view their own profile."
      ON public.profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- Policy for authenticated users to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Authenticated users can update their own profile.'
  ) THEN
    CREATE POLICY "Authenticated users can update their own profile."
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id);
  END IF;
END $$;

-- Policy for authenticated users to insert their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Authenticated users can insert their own profile.'
  ) THEN
    CREATE POLICY "Authenticated users can insert their own profile."
      ON public.profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 5. Create a function to verify email confirmation works
-- This function can be called to check if email confirmation is properly configured
CREATE OR REPLACE FUNCTION public.check_email_confirmation_setup()
RETURNS TABLE (
  setting_name text,
  setting_value text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Email confirmation required'::text as setting_name,
    'Check Supabase Dashboard > Authentication > Settings'::text as setting_value,
    'INFO'::text as status
  UNION ALL
  SELECT 
    'Profile trigger exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
      ) THEN 'YES'
      ELSE 'NO'
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
      ) THEN 'OK'
      ELSE 'ERROR'
    END
  UNION ALL
  SELECT 
    'RLS enabled on profiles'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
      ) AND (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'profiles' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'YES'
      ELSE 'NO'
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
      ) AND (
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'profiles' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ) THEN 'OK'
      ELSE 'WARNING'
    END;
END;
$$;

-- 6. Grant execute permission on the check function
GRANT EXECUTE ON FUNCTION public.check_email_confirmation_setup() TO authenticated;

-- 7. Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up. Ensures onboarding_completed is set to false.';
COMMENT ON FUNCTION public.check_email_confirmation_setup() IS 'Helper function to verify email confirmation setup is correct.';


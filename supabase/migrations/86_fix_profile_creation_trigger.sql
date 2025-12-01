-- Fix Profile Creation Trigger
-- Ensure profile is always created when a user signs up

-- 1. Drop and recreate the trigger function with better error handling
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
      COALESCE(new.email, ''),
      COALESCE(new.raw_user_meta_data->>'full_name', NULL),
      'Minimalist',
      '[]'::jsonb,
      'Intermediate',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- 2. Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;

-- 4. Ensure the profiles table has all required columns with defaults
DO $$
BEGIN
  -- Set defaults if they don't exist
  ALTER TABLE public.profiles 
    ALTER COLUMN archetype SET DEFAULT 'Minimalist',
    ALTER COLUMN cooking_skill SET DEFAULT 'Intermediate',
    ALTER COLUMN dietary_restrictions SET DEFAULT '[]'::jsonb,
    ALTER COLUMN onboarding_completed SET DEFAULT false;
EXCEPTION
  WHEN OTHERS THEN
    -- Column might not exist or already have default, ignore
    NULL;
END $$;

-- 5. Ensure RLS policies allow the trigger to create profiles
-- The trigger runs with SECURITY DEFINER, so it should bypass RLS
-- But let's make sure the policies are correct for manual creation

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
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 6. Create a helper function to manually create a profile if needed
CREATE OR REPLACE FUNCTION public.create_user_profile(p_user_id uuid, p_email text DEFAULT NULL, p_full_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
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
      p_user_id,
      COALESCE(p_email, ''),
      p_full_name,
      'Minimalist',
      '[]'::jsonb,
      'Intermediate',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- 7. Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.create_user_profile(uuid, text, text) TO authenticated, service_role;

-- 8. Add comments
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up. Includes error handling to prevent user creation from failing.';
COMMENT ON FUNCTION public.create_user_profile(uuid, text, text) IS 'Helper function to manually create a profile for a user if the trigger failed.';


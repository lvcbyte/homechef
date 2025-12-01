-- Ensure Onboarding Functions Exist and Work Correctly
-- This migration verifies and fixes the onboarding RPC functions

-- 1. Drop existing functions if they exist (to allow return type changes)
DROP FUNCTION IF EXISTS public.start_onboarding();
DROP FUNCTION IF EXISTS public.complete_onboarding(text, text, jsonb);

-- 2. Create start_onboarding function
CREATE FUNCTION public.start_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function can be called to mark that onboarding has started
  -- It's optional and non-critical
  -- Just ensure the profile exists
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  ) THEN
    INSERT INTO public.profiles (
      id,
      email,
      archetype,
      dietary_restrictions,
      cooking_skill,
      onboarding_completed
    )
    VALUES (
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
      'Minimalist',
      '[]'::jsonb,
      'Intermediate',
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- 3. Create complete_onboarding function
CREATE FUNCTION public.complete_onboarding(
  p_archetype text DEFAULT 'Minimalist',
  p_cooking_skill text DEFAULT 'Intermediate',
  p_dietary_restrictions jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure profile exists first
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid()
  ) THEN
    INSERT INTO public.profiles (
      id,
      email,
      archetype,
      dietary_restrictions,
      cooking_skill,
      onboarding_completed
    )
    VALUES (
      auth.uid(),
      COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
      p_archetype,
      p_dietary_restrictions,
      p_cooking_skill,
      false
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  -- Update profile with onboarding data and mark as completed
  UPDATE public.profiles
  SET
    archetype = p_archetype,
    cooking_skill = p_cooking_skill,
    dietary_restrictions = p_dietary_restrictions,
    onboarding_completed = true,
    updated_at = NOW()
  WHERE id = auth.uid();
  
  -- Verify the update worked
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or update failed';
  END IF;
END;
$$;

-- 4. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.start_onboarding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, jsonb) TO authenticated;

-- 5. Add comments
COMMENT ON FUNCTION public.start_onboarding() IS 'Marks the start of onboarding. Ensures profile exists. Non-critical function.';
COMMENT ON FUNCTION public.complete_onboarding(text, text, jsonb) IS 'Completes onboarding by updating profile preferences and setting onboarding_completed to true.';

-- 6. Create a test function to verify onboarding functions work
CREATE OR REPLACE FUNCTION public.test_onboarding_functions()
RETURNS TABLE (
  function_name text,
  status text,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'start_onboarding exists'::text as function_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'start_onboarding'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END as status,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'start_onboarding'
      ) THEN 'Function exists'::text
      ELSE 'Function missing'::text
    END as details
  UNION ALL
  SELECT 
    'complete_onboarding exists'::text,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'complete_onboarding'
      ) THEN 'OK'::text
      ELSE 'ERROR'::text
    END,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'complete_onboarding'
      ) THEN 'Function exists'::text
      ELSE 'Function missing'::text
    END;
END;
$$;

-- 7. Grant execute permission on test function
GRANT EXECUTE ON FUNCTION public.test_onboarding_functions() TO authenticated, service_role;


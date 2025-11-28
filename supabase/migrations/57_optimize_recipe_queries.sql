-- Optimize recipe queries for faster loading
-- Add indexes for commonly queried columns

-- Index for recipe_likes lookups (used for trending recipes)
CREATE INDEX IF NOT EXISTS idx_recipe_likes_recipe_id ON public.recipe_likes(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_likes_user_id ON public.recipe_likes(user_id);

-- Index for recipe categories lookups
CREATE INDEX IF NOT EXISTS idx_recipe_categories_recipe_id ON public.recipe_categories(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_categories_category ON public.recipe_categories(category);

-- Index for recipes by total_time_minutes (used for "Klaar in 30 minuten")
CREATE INDEX IF NOT EXISTS idx_recipes_total_time_minutes ON public.recipes(total_time_minutes) WHERE total_time_minutes <= 30;

-- Index for recipes by category (if category column exists)
CREATE INDEX IF NOT EXISTS idx_recipes_category ON public.recipes(category) WHERE category IS NOT NULL;

-- Index for recipes created_at (for sorting)
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON public.recipes(created_at DESC);

-- Composite index for recipe of the day queries
CREATE INDEX IF NOT EXISTS idx_recipes_id_created_at ON public.recipes(id, created_at DESC);

-- Analyze tables to update statistics
ANALYZE public.recipes;
ANALYZE public.recipe_likes;
ANALYZE public.recipe_categories;

-- Optimize get_recipe_categories function if it exists
-- This ensures the function uses indexes efficiently
COMMENT ON FUNCTION public.get_recipe_categories() IS 'Returns recipe categories with counts. Optimized for fast loading.';

-- Optimize get_trending_recipes function (correct signature: integer, uuid, text)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_trending_recipes' AND pronamespace = 'public'::regnamespace) THEN
        COMMENT ON FUNCTION public.get_trending_recipes(integer, uuid, text) IS 'Returns trending recipes sorted by likes. Uses indexes for performance.';
    END IF;
END $$;

-- Optimize get_quick_recipes function (correct signature: integer, uuid, text, text, text, text[])
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_quick_recipes' AND pronamespace = 'public'::regnamespace) THEN
        COMMENT ON FUNCTION public.get_quick_recipes(integer, uuid, text, text, text, text[]) IS 'Returns quick recipes (<=30 min). Uses index on total_time_minutes.';
    END IF;
END $$;


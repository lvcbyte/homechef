-- Verify Database Functions
-- Run this in Supabase SQL Editor to check if all functions exist

-- Check price history functions
SELECT 
    routine_name,
    routine_type,
    routine_schema
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_price_trend',
    'record_price_change',
    'find_ingredient_substitutions',
    'can_substitute_ingredient',
    'get_active_timers',
    'complete_timer',
    'calculate_recipe_health_impact',
    'get_latest_ml_model'
)
ORDER BY routine_name;

-- Check tables
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'price_history',
    'ingredient_substitutions',
    'cooking_timers',
    'user_health_goals',
    'recipe_consumption',
    'ml_model_metadata'
)
ORDER BY table_name;

-- Check triggers
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'product_catalog_price_change_trigger';

-- Test a simple function
SELECT get_price_trend('test-product-id', 30) LIMIT 1;


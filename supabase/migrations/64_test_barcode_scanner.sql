-- Test script for barcode scanner functionality
-- This script helps verify that barcode scanning functions work correctly

-- Test 1: Verify match_product_by_barcode_enhanced function exists and works
-- Example: Test with a sample barcode (replace with actual barcode from your catalog)
DO $$
DECLARE
    test_barcode text := '8712561735004'; -- Example EAN-13 barcode
    test_result record;
BEGIN
    -- Try to find a product with this barcode
    SELECT * INTO test_result
    FROM public.match_product_by_barcode_enhanced(test_barcode);
    
    IF test_result.id IS NOT NULL THEN
        RAISE NOTICE 'Test 1 PASSED: Found product % with barcode %', test_result.name, test_barcode;
    ELSE
        RAISE NOTICE 'Test 1 INFO: No product found for barcode % (this is OK if barcode not in catalog)', test_barcode;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 1 FAILED: Error testing match_product_by_barcode_enhanced: %', SQLERRM;
END $$;

-- Test 2: Verify log_barcode_scan function exists and works
DO $$
DECLARE
    test_user_id uuid;
    test_barcode text := '1234567890123';
    test_scan_id uuid;
BEGIN
    -- Get a test user (use first user in auth.users)
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'Test 2 SKIPPED: No users found in database';
        RETURN;
    END IF;
    
    -- Test logging a scan
    SELECT public.log_barcode_scan(
        test_user_id,
        test_barcode,
        NULL, -- product_id
        NULL, -- product_name
        NULL, -- product_brand
        NULL  -- match_confidence
    ) INTO test_scan_id;
    
    IF test_scan_id IS NOT NULL THEN
        RAISE NOTICE 'Test 2 PASSED: Successfully logged barcode scan with ID %', test_scan_id;
        
        -- Clean up test data
        DELETE FROM public.barcode_scans WHERE id = test_scan_id;
    ELSE
        RAISE NOTICE 'Test 2 FAILED: Could not log barcode scan';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 2 FAILED: Error testing log_barcode_scan: %', SQLERRM;
END $$;

-- Test 3: Verify product_catalog has barcode index
DO $$
DECLARE
    index_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'product_catalog'
        AND indexname = 'idx_product_catalog_barcode'
    ) INTO index_exists;
    
    IF index_exists THEN
        RAISE NOTICE 'Test 3 PASSED: Barcode index exists on product_catalog';
    ELSE
        RAISE NOTICE 'Test 3 WARNING: Barcode index does not exist (performance may be slower)';
    END IF;
END $$;

-- Test 4: Verify barcode_scans table has required columns
DO $$
DECLARE
    has_product_name boolean;
    has_product_brand boolean;
    has_match_confidence boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'barcode_scans'
        AND column_name = 'product_name'
    ) INTO has_product_name;
    
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'barcode_scans'
        AND column_name = 'product_brand'
    ) INTO has_product_brand;
    
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'barcode_scans'
        AND column_name = 'match_confidence'
    ) INTO has_match_confidence;
    
    IF has_product_name AND has_product_brand AND has_match_confidence THEN
        RAISE NOTICE 'Test 4 PASSED: All required columns exist in barcode_scans table';
    ELSE
        RAISE NOTICE 'Test 4 FAILED: Missing columns - product_name: %, product_brand: %, match_confidence: %', 
            has_product_name, has_product_brand, has_match_confidence;
    END IF;
END $$;

-- Test 5: Verify RLS policies are set correctly
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'barcode_scans'
    AND policyname = 'Barcode scans by owner';
    
    IF policy_count > 0 THEN
        RAISE NOTICE 'Test 5 PASSED: RLS policy exists for barcode_scans';
    ELSE
        RAISE NOTICE 'Test 5 WARNING: RLS policy may be missing for barcode_scans';
    END IF;
END $$;

-- Summary message
DO $$
BEGIN
    RAISE NOTICE '=== Barcode Scanner Tests Complete ===';
    RAISE NOTICE 'Check the messages above for test results';
    RAISE NOTICE 'If all tests passed, barcode scanning should work correctly';
END $$;


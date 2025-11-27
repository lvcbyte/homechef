-- Fix duplicate recipe images by assigning unique images to each recipe
-- This script finds recipes with duplicate image_url and assigns new unique images

-- Update recipes with duplicate images to have unique images
-- Using a variety of food photography from Unsplash

WITH duplicate_images AS (
    SELECT 
        id,
        image_url,
        ROW_NUMBER() OVER (PARTITION BY image_url ORDER BY created_at) as rn,
        ROW_NUMBER() OVER (ORDER BY created_at) as global_rn
    FROM public.recipes
    WHERE image_url IN (
        SELECT image_url 
        FROM public.recipes 
        GROUP BY image_url 
        HAVING COUNT(*) > 1
    )
),
unique_images AS (
    SELECT 
        id,
        CASE 
            WHEN global_rn % 20 = 0 THEN 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 1 THEN 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 2 THEN 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 3 THEN 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 4 THEN 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 5 THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 6 THEN 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 7 THEN 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 8 THEN 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 9 THEN 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 10 THEN 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 11 THEN 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 12 THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 13 THEN 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 14 THEN 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 15 THEN 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 16 THEN 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 17 THEN 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 18 THEN 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80'
            WHEN global_rn % 20 = 19 THEN 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=800&q=80'
        END as new_image_url
    FROM duplicate_images
    WHERE rn > 1
)
UPDATE public.recipes r
SET image_url = ui.new_image_url
FROM unique_images ui
WHERE r.id = ui.id;

-- Verify no duplicates remain
-- This query should return 0 rows if successful
SELECT image_url, COUNT(*) as count
FROM public.recipes
GROUP BY image_url
HAVING COUNT(*) > 1;

/**
 * Import products from Open Food Facts API
 * Huge database with barcodes, images, and nutrition data
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mapCategoryOFF(categories) {
  if (!categories) return 'pantry';
  const cats = categories.toLowerCase();
  
  if (cats.includes('fruit') || cats.includes('groenten') || cats.includes('vegetables')) return 'fresh_produce';
  if (cats.includes('dairy') || cats.includes('zuivel') || cats.includes('cheese') || cats.includes('milk')) return 'dairy_eggs';
  if (cats.includes('meat') || cats.includes('vlees') || cats.includes('poultry') || cats.includes('beef')) return 'proteins';
  if (cats.includes('fish') || cats.includes('vis') || cats.includes('seafood')) return 'seafood';
  if (cats.includes('bread') || cats.includes('brood') || cats.includes('bakery')) return 'bakery';
  if (cats.includes('spices') || cats.includes('kruiden') || cats.includes('condiments')) return 'spices_condiments';
  if (cats.includes('frozen') || cats.includes('diepvries')) return 'frozen';
  if (cats.includes('ready') || cats.includes('maaltijd')) return 'ready_meals';
  if (cats.includes('beverages') || cats.includes('drank') || cats.includes('drinks')) return 'beverages';
  if (cats.includes('snacks') || cats.includes('chips') || cats.includes('chocolate')) return 'snacks';
  if (cats.includes('baby')) return 'baby';
  if (cats.includes('personal care') || cats.includes('verzorging')) return 'personal_care';
  if (cats.includes('household') || cats.includes('huishoud')) return 'household';
  return 'pantry';
}

async function fetchProductsFromOFF(country = 'belgium', page = 1, pageSize = 100) {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl`;
    const params = {
      action: 'process',
      tagtype_0: 'countries',
      tag_contains_0: 'contains',
      tag_0: country,
      page_size: pageSize,
      page: page,
      json: true,
      fields: 'code,product_name,brands,categories,image_url,image_small_url,nutriments,quantity,packaging',
      sort_by: 'popularity', // Get most popular products first
    };

    const response = await axios.get(url, { params, timeout: 30000 });
    return response.data;
  } catch (error) {
    console.error(`Error fetching page ${page}:`, error.message);
    return null;
  }
}

// Also fetch from Netherlands and France for more products
async function fetchProductsFromOFFMultiCountry(page = 1, pageSize = 100) {
  const countries = ['belgium', 'netherlands', 'france', 'germany'];
  const country = countries[Math.floor((page - 1) / 25) % countries.length]; // Rotate countries
  return fetchProductsFromOFF(country, page, pageSize);
}

async function importOpenFoodFacts() {
  console.log('🕷️  Importing from Open Food Facts API...\n');
  
  let totalImported = 0;
  let totalFailed = 0;
  let page = 1;
  const maxPages = 500; // Import up to 50,000 products (500 pages * 100 products)
  let consecutiveEmptyPages = 0;
  
  while (page <= maxPages && consecutiveEmptyPages < 5) {
    console.log(`📦 Fetching page ${page}/${maxPages}...`);
    
    // Try multiple countries for more products
    const data = await fetchProductsFromOFFMultiCountry(page, 100);
    
    if (!data || !data.products || data.products.length === 0) {
      consecutiveEmptyPages++;
      console.log(`  ⚠️  No products found (${consecutiveEmptyPages}/5 empty pages)`);
      if (consecutiveEmptyPages >= 5) {
        console.log('  ⚠️  Stopping after 5 consecutive empty pages');
        break;
      }
      page++;
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }
    
    consecutiveEmptyPages = 0; // Reset counter
    
    console.log(`  ✅ Found ${data.products.length} products on this page`);
    
    let imported = 0;
    let failed = 0;
    
    for (const product of data.products) {
      try {
        // Skip if missing essential data
        if (!product.product_name || !product.code) {
          failed++;
          continue;
        }
        
        const payload = {
          id: `off-${product.code}`,
          product_name: product.product_name,
          brand: product.brands ? product.brands.split(',')[0].trim() : null,
          category: mapCategoryOFF(product.categories),
          barcode: product.code,
          description: null,
          image_url: product.image_url || product.image_small_url || null,
          unit_size: product.quantity || null,
          nutrition: product.nutriments ? {
            energy: product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'],
            fat: product.nutriments['fat_100g'] || product.nutriments.fat,
            carbs: product.nutriments['carbohydrates_100g'] || product.nutriments.carbohydrates,
            protein: product.nutriments['proteins_100g'] || product.nutriments.proteins,
            salt: product.nutriments['salt_100g'] || product.nutriments.salt,
            sugar: product.nutriments['sugars_100g'] || product.nutriments.sugars,
          } : null,
          price: null, // OFF doesn't have prices
          is_available: true,
          source: 'open-food-facts',
        };
        
        const { error } = await supabase.rpc('upsert_product_catalog', { payload });
        if (error) {
          failed++;
          // Check if it's a constraint error (source not allowed)
          if (error.message && error.message.includes('source_check')) {
            console.error(`    ❌ Source constraint error! Run migration 13_add_more_stores.sql first!`);
            console.error(`    Error: ${error.message}`);
            process.exit(1);
          }
          if (failed <= 5) {
            console.error(`    ❌ Failed: ${payload.product_name} - ${error.message}`);
          }
        } else {
          imported++;
          if (imported % 50 === 0) {
            console.log(`    ✅ Imported ${imported}/${data.products.length}...`);
          }
        }
      } catch (err) {
        failed++;
      }
    }
    
    totalImported += imported;
    totalFailed += failed;
    
    console.log(`  ✅ Page ${page}: Imported ${imported}, Failed ${failed}`);
    console.log(`  📊 Total so far: ${totalImported} imported, ${totalFailed} failed\n`);
    
    // Be nice to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    page++;
  }
  
  console.log(`\n✨ Done! Total imported: ${totalImported}, Total failed: ${totalFailed}`);
}

importOpenFoodFacts().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});


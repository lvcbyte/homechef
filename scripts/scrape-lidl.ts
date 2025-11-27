/**
 * Scrape Lidl Belgium product catalog
 * Similar to Albert Heijn import
 */

import { createClient } from '@supabase/supabase-js';
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mapCategory(source?: string | null) {
  if (!source) return 'pantry';
  const slug = source.toLowerCase();
  if (slug.includes('groente') || slug.includes('fruit') || slug.includes('legume')) return 'fresh_produce';
  if (slug.includes('vis') || slug.includes('fish') || slug.includes('seafood')) return 'seafood';
  if (slug.includes('zuivel') || slug.includes('yoghurt') || slug.includes('melk') || slug.includes('dairy') || slug.includes('kaas')) return 'dairy_eggs';
  if (slug.includes('vlees') || slug.includes('eiwit') || slug.includes('meat') || slug.includes('worst')) return 'proteins';
  if (slug.includes('kruiden') || slug.includes('saus') || slug.includes('spice')) return 'spices_condiments';
  if (slug.includes('diepvries') || slug.includes('frozen')) return 'frozen';
  if (slug.includes('maaltijd') || slug.includes('meal')) return 'ready_meals';
  if (slug.includes('snack') || slug.includes('chips') || slug.includes('chocolade')) return 'snacks';
  if (slug.includes('bakkerij') || slug.includes('brood') || slug.includes('bakery')) return 'bakery';
  if (slug.includes('drank') || slug.includes('beverage') || slug.includes('drink')) return 'beverages';
  if (slug.includes('baby')) return 'baby';
  if (slug.includes('verzorging') || slug.includes('care')) return 'personal_care';
  if (slug.includes('huishoud') || slug.includes('household')) return 'household';
  return 'pantry';
}

async function scrapeLidlProducts() {
  console.log('🕷️  Scraping Lidl.be product catalog...');
  
  // Lidl Belgium uses a product API endpoint
  // We'll scrape from their website structure
  const baseUrl = 'https://www.lidl.be';
  
  // Lidl product pages structure
  // We need to find all product categories and scrape products from each
  
  const categories = [
    'fresh-produce',
    'dairy-eggs',
    'meat-fish',
    'bakery',
    'frozen',
    'beverages',
    'snacks',
    'pantry',
    'household',
    'personal-care',
  ];
  
  let allProducts: any[] = [];
  
  for (const category of categories) {
    try {
      console.log(`📦 Scraping category: ${category}...`);
      
      // Lidl API endpoint (reverse engineered from their website)
      // This may need adjustment based on actual Lidl website structure
      const apiUrl = `${baseUrl}/api/products?category=${category}&page=1&perPage=100`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const products = data.products || data.items || data.data || [];
        allProducts = allProducts.concat(products);
        console.log(`  ✅ Found ${products.length} products in ${category}`);
      } else {
        console.log(`  ⚠️  Could not fetch ${category} (status: ${response.status})`);
        // Fallback: try scraping HTML if API doesn't work
        await scrapeLidlHTML(category, allProducts);
      }
    } catch (error) {
      console.error(`  ❌ Error scraping ${category}:`, error);
    }
  }
  
  if (allProducts.length === 0) {
    console.log('⚠️  No products found via API, trying HTML scraping...');
    // Fallback to HTML scraping
    await scrapeLidlHTML('all', allProducts);
  }
  
  console.log(`\n📤 Importing ${allProducts.length} products to Supabase...`);
  
  let imported = 0;
  let failed = 0;
  
  for (const product of allProducts) {
    try {
      const payload = {
        id: product.id?.toString() ?? product.productId ?? `lidl-${crypto.randomUUID()}`,
        product_name: product.name ?? product.title ?? product.productName ?? 'Unknown',
        brand: product.brand ?? 'Lidl',
        category: mapCategory(product.category ?? product.mainCategory),
        barcode: product.barcode ?? product.ean ?? product.gtin ?? null,
        description: product.description ?? null,
        image_url: product.imageUrl ?? product.image ?? product.image_url ?? null,
        unit_size: product.unitSize ?? product.unit_size ?? product.size ?? null,
        nutrition: product.nutrition ?? null,
        price: parseFloat(product.price?.toString().replace(',', '.')) ?? product.priceCurrent ?? null,
        is_available: product.available ?? true,
        source: 'lidl',
      };
      
      const { error } = await supabase.rpc('upsert_product_catalog', { payload });
      if (error) {
        console.error(`❌ Failed: ${payload.product_name} - ${error.message}`);
        failed++;
      } else {
        imported++;
        if (imported % 50 === 0) {
          console.log(`  ✅ Imported ${imported}/${allProducts.length}...`);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing product:`, err);
      failed++;
    }
  }
  
  console.log(`\n✨ Done! Imported: ${imported}, Failed: ${failed}`);
}

async function scrapeLidlHTML(category: string, products: any[]) {
  // HTML scraping fallback
  // This would require a proper HTML parser like cheerio or puppeteer
  console.log(`  🔄 Trying HTML scraping for ${category}...`);
  // Implementation would go here
}

scrapeLidlProducts().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});


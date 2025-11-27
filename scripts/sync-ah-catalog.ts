import { createClient } from '@supabase/supabase-js';
import { CATEGORY_OPTIONS } from '../constants/categories';

const mapCategoryLabel = (source?: string | null) => {
  if (!source) return 'pantry';
  const slug = source.toLowerCase();
  if (slug.includes('groente') || slug.includes('fruit')) return 'fresh_produce';
  if (slug.includes('kaas') || slug.includes('zuivel') || slug.includes('dairy')) return 'dairy_eggs';
  if (slug.includes('vlees') || slug.includes('proteine') || slug.includes('meat')) return 'proteins';
  if (slug.includes('vis') || slug.includes('fish') || slug.includes('seafood')) return 'seafood';
  if (slug.includes('bakkerij') || slug.includes('brood') || slug.includes('bakery')) return 'bakery';
  if (slug.includes('kruiden') || slug.includes('saus') || slug.includes('spice')) return 'spices_condiments';
  if (slug.includes('diepvries') || slug.includes('frozen')) return 'frozen';
  if (slug.includes('maaltijd') || slug.includes('meal')) return 'ready_meals';
  if (slug.includes('drank') || slug.includes('beverage') || slug.includes('drink')) return 'beverages';
  if (slug.includes('snack') || slug.includes('chips') || slug.includes('chocolate')) return 'snacks';
  if (slug.includes('baby')) return 'baby';
  if (slug.includes('verzorging') || slug.includes('care')) return 'personal_care';
  if (slug.includes('huishoud') || slug.includes('household')) return 'household';
  return 'pantry';
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APIFY_TOKEN = process.env.APIFY_TOKEN!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('📥 Downloading AH dataset...');
  const response = await fetch(
    `https://api.apify.com/v2/datasets/V7VW6P5MJk59WJ9a8/items?clean=1&format=json&token=${APIFY_TOKEN}`
  );
  if (!response.ok) {
    throw new Error(`Failed to download dataset: ${response.statusText}`);
  }
  const products = await response.json();
  console.log(`✅ Downloaded ${products.length} products`);

  console.log('📤 Importing to Supabase...');
  let imported = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const payload = {
        id: product.webshopId?.toString() ?? crypto.randomUUID(),
        product_name: product.title,
        brand: product.brand || 'AH',
        category: mapCategoryLabel(product.mainCategory ?? product.taxonomy),
        barcode: product.ean ?? null,
        description: product.descriptionFull ?? product.descriptionHighlights ?? null,
        image_url: product.imageUrl ?? product.images?.[0]?.url ?? null,
        unit_size: product.salesUnitSize ?? null,
        nutrition: product.nutrition ?? null,
        price: product.priceBeforeBonus ?? product.priceCurrent ?? null,
        is_available: product.isOrderable ?? true,
      };

      const { error } = await supabase.rpc('upsert_product_catalog', { payload });
      if (error) {
        console.error(`❌ Failed: ${payload.product_name} - ${error.message}`);
        failed++;
      } else {
        imported++;
        if (imported % 100 === 0) {
          console.log(`  ✅ Imported ${imported}/${products.length}...`);
        }
      }
    } catch (err) {
      console.error(`❌ Error processing ${product.title}:`, err);
      failed++;
    }
  }

  console.log(`\n✨ Done! Imported: ${imported}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});


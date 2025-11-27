// scripts/import-ah.ts
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { CATEGORY_OPTIONS } from '../constants/categories';

const mapCategoryLabel = (source?: string | null) => {
  if (!source) return 'pantry';
  const slug = source.toLowerCase();
  if (slug.includes('groente') || slug.includes('fruit')) return 'fresh_produce';
  if (slug.includes('kaas') || slug.includes('zuivel')) return 'dairy_eggs';
  if (slug.includes('vlees') || slug.includes('proteine')) return 'proteins';
  if (slug.includes('vis')) return 'seafood';
  if (slug.includes('bakkerij') || slug.includes('brood')) return 'bakery';
  if (slug.includes('kruiden') || slug.includes('saus')) return 'spices_condiments';
  if (slug.includes('diepvries') || slug.includes('frozen')) return 'frozen';
  if (slug.includes('maaltijd')) return 'ready_meals';
  if (slug.includes('drank')) return 'beverages';
  if (slug.includes('snack') || slug.includes('chips')) return 'snacks';
  if (slug.includes('baby')) return 'baby';
  if (slug.includes('verzorging')) return 'personal_care';
  if (slug.includes('huishoud')) return 'household';
  return 'pantry';
};

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const file = path.resolve('/tmp/ah-products.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));

  for (const product of raw) {
    const payload = {
      id: product.webshopId?.toString() ?? crypto.randomUUID(),
      product_name: product.title,
      brand: product.brand,
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
      console.error('Failed for', payload.product_name, error.message);
    } else {
      console.log('Imported', payload.product_name);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
/**
 * Direct web scraper for Colruyt Belgium
 * Scrapes colruyt.be directly and imports to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mapCategory(source?: string | null) {
  if (!source) return 'pantry';
  const slug = source.toLowerCase();
  if (slug.includes('groente') || slug.includes('fruit')) return 'fresh_produce';
  if (slug.includes('kaas') || slug.includes('zuivel') || slug.includes('dairy')) return 'dairy_eggs';
  if (slug.includes('vlees') || slug.includes('proteine') || slug.includes('meat') || slug.includes('worst')) return 'proteins';
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
}

async function scrapeColruytCategory(categoryUrl: string) {
  try {
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${categoryUrl}: ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products: any[] = [];

    // Colruyt product structure - adjust selectors based on actual website
    $('.product-item, .product-card, .product-tile, [data-product], .product').each((_, element) => {
      const $el = $(element);
      
      const product = {
        id: $el.attr('data-product-id') || 
              $el.attr('data-id') ||
              $el.find('[data-product-id]').attr('data-product-id') || 
              `colruyt-${crypto.randomUUID()}`,
        name: $el.find('.product-name, .product-title, .name, h3, h4, .title').first().text().trim() || 
              $el.attr('data-product-name') || 
              $el.find('[data-product-name]').attr('data-product-name') || 
              'Unknown',
        price: parseFloat(
          ($el.find('.price, .product-price, .current-price, [data-price]').first().text().trim() || 
           $el.attr('data-price') || 
           '0')
          .replace(/[^\d,.-]/g, '')
          .replace(',', '.')
        ) || null,
        imageUrl: $el.find('img').first().attr('src') || 
                  $el.find('img').first().attr('data-src') ||
                  $el.find('img').first().attr('data-lazy-src') ||
                  $el.find('[data-image]').attr('data-image') ||
                  null,
        category: $el.attr('data-category') || 
                  $el.closest('[data-category]').attr('data-category') ||
                  null,
        barcode: $el.attr('data-barcode') || 
                 $el.attr('data-ean') ||
                 $el.find('[data-barcode]').attr('data-barcode') ||
                 null,
        unitSize: $el.find('.unit-size, .size, .unit').first().text().trim() || null,
        brand: $el.find('.brand').first().text().trim() || 'Colruyt',
      };

      if (product.name && product.name !== 'Unknown') {
        products.push(product);
      }
    });

    return products;
  } catch (error) {
    console.error(`Error scraping ${categoryUrl}:`, error);
    return [];
  }
}

async function scrapeColruytCatalog() {
  console.log('🕷️  Scraping Colruyt.be directly...');
  
  const baseUrl = 'https://www.colruyt.be';
  
  // Colruyt category pages - adjust URLs based on actual website structure
  const categoryUrls = [
    `${baseUrl}/nl/online-boodschappen/fruit-groenten`,
    `${baseUrl}/nl/online-boodschappen/zuivel-eieren`,
    `${baseUrl}/nl/online-boodschappen/vlees-vis`,
    `${baseUrl}/nl/online-boodschappen/brood-bakkerij`,
    `${baseUrl}/nl/online-boodschappen/diepvries`,
    `${baseUrl}/nl/online-boodschappen/dranken`,
    `${baseUrl}/nl/online-boodschappen/snoep-snacks`,
    `${baseUrl}/nl/online-boodschappen/droogwaren`,
    `${baseUrl}/nl/online-boodschappen/huishoud`,
    `${baseUrl}/nl/online-boodschappen/verzorging`,
  ];

  let allProducts: any[] = [];

  for (const url of categoryUrls) {
    console.log(`📦 Scraping: ${url}...`);
    const products = await scrapeColruytCategory(url);
    allProducts = allProducts.concat(products);
    console.log(`  ✅ Found ${products.length} products`);
    
    // Be nice to the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📤 Importing ${allProducts.length} products to Supabase...`);

  let imported = 0;
  let failed = 0;

  for (const product of allProducts) {
    try {
      const payload = {
        id: product.id,
        product_name: product.name,
        brand: product.brand || 'Colruyt',
        category: mapCategory(product.category),
        barcode: product.barcode || null,
        description: null,
        image_url: product.imageUrl ? (product.imageUrl.startsWith('http') ? product.imageUrl : `https://www.colruyt.be${product.imageUrl}`) : null,
        unit_size: product.unitSize || null,
        nutrition: null,
        price: product.price,
        is_available: true,
        source: 'colruyt',
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
      console.error(`❌ Error processing ${product.name}:`, err);
      failed++;
    }
  }

  console.log(`\n✨ Done! Imported: ${imported}, Failed: ${failed}`);
}

scrapeColruytCatalog().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});


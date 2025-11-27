/**
 * Direct web scraper for Delhaize Belgium using Puppeteer
 * Scrapes delhaize.be with JavaScript rendering and imports to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mapCategory(source) {
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

async function scrapeDelhaizeCategory(page, categoryUrl) {
  try {
    console.log(`  🔄 Loading: ${categoryUrl}...`);
    
    await page.goto(categoryUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    try {
      await page.waitForSelector('.product, .product-item, .product-card, [data-product], article', {
        timeout: 10000,
      });
    } catch (e) {
      console.log(`    ⚠️  No products selector found, trying to extract anyway...`);
    }

    await page.evaluate(() => {
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const products = await page.evaluate(() => {
      const results = [];
      
      const selectors = [
        '.product-item',
        '.product-card',
        '.product-tile',
        '[data-product]',
        '.product',
        '.product-wrapper',
        'article[data-product]',
        '[class*="product"]',
      ];

      let elements = [];
      for (const selector of selectors) {
        elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) break;
      }

      elements.forEach((el) => {
        try {
          const nameEl = el.querySelector('.product-name, .product-title, .name, h3, h4, .title, .product-link, a[href*="/product"]') ||
                        el.querySelector('[data-product-name]') ||
                        el;
          const name = nameEl?.textContent?.trim() || 
                      el.getAttribute('data-product-name') ||
                      el.getAttribute('aria-label') ||
                      'Unknown';

          const priceEl = el.querySelector('.price, .product-price, .current-price, [data-price], .price-value, [class*="price"]');
          let price = null;
          if (priceEl) {
            const priceText = priceEl.textContent || priceEl.getAttribute('data-price') || '';
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            if (priceMatch) {
              price = parseFloat(priceMatch[0].replace(',', '.'));
            }
          }

          const imgEl = el.querySelector('img');
          const imageUrl = imgEl?.getAttribute('src') ||
                          imgEl?.getAttribute('data-src') ||
                          imgEl?.getAttribute('data-lazy-src') ||
                          null;

          const id = el.getAttribute('data-product-id') ||
                    el.getAttribute('data-id') ||
                    el.getAttribute('data-sku') ||
                    `delhaize-${Math.random().toString(36).substr(2, 9)}`;

          const barcode = el.getAttribute('data-barcode') ||
                         el.getAttribute('data-ean') ||
                         null;

          const unitSizeEl = el.querySelector('.unit-size, .size, .unit, .product-size');
          const unitSize = unitSizeEl?.textContent?.trim() || null;

          if (name && name !== 'Unknown' && name.length > 2) {
            results.push({
              id,
              name,
              price,
              imageUrl,
              barcode,
              unitSize,
              category: el.getAttribute('data-category') || null,
            });
          }
        } catch (err) {
          // Skip invalid products
        }
      });

      return results;
    });

    console.log(`    ✅ Found ${products.length} products`);
    return products;
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return [];
  }
}

async function scrapeDelhaizeCatalog() {
  console.log('🕷️  Scraping Delhaize.be with Puppeteer (JavaScript rendering)...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const baseUrl = 'https://www.delhaize.be';
    
    const categoryUrls = [
      `${baseUrl}/nl/shop/fruit-groenten`,
      `${baseUrl}/nl/shop/zuivel-eieren`,
      `${baseUrl}/nl/shop/vlees-vis`,
      `${baseUrl}/nl/shop/brood-bakkerij`,
      `${baseUrl}/nl/shop/diepvries`,
      `${baseUrl}/nl/shop/dranken`,
    ];

    let allProducts = [];

    for (const url of categoryUrls) {
      console.log(`📦 Scraping: ${url}`);
      const products = await scrapeDelhaizeCategory(page, url);
      allProducts = allProducts.concat(products);
      console.log(`  ✅ Total: ${products.length} products\n`);
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const uniqueProducts = [];
    const seenIds = new Set();
    for (const product of allProducts) {
      if (!seenIds.has(product.id) && product.name !== 'Unknown') {
        seenIds.add(product.id);
        uniqueProducts.push(product);
      }
    }

    console.log(`\n📤 Importing ${uniqueProducts.length} unique products to Supabase...`);

    if (uniqueProducts.length === 0) {
      console.log('\n⚠️  No products found.');
      return;
    }

    let imported = 0;
    let failed = 0;

    for (const product of uniqueProducts) {
      try {
        const payload = {
          id: product.id,
          product_name: product.name,
          brand: 'Delhaize',
          category: mapCategory(product.category),
          barcode: product.barcode || null,
          description: null,
          image_url: product.imageUrl ? (product.imageUrl.startsWith('http') ? product.imageUrl : `https://www.delhaize.be${product.imageUrl}`) : null,
          unit_size: product.unitSize || null,
          nutrition: null,
          price: product.price,
          is_available: true,
          source: 'delhaize',
        };

        const { error } = await supabase.rpc('upsert_product_catalog', { payload });
        if (error) {
          console.error(`❌ Failed: ${payload.product_name} - ${error.message}`);
          failed++;
        } else {
          imported++;
          if (imported % 50 === 0) {
            console.log(`  ✅ Imported ${imported}/${uniqueProducts.length}...`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${product.name}:`, err);
        failed++;
      }
    }

    console.log(`\n✨ Done! Imported: ${imported}, Failed: ${failed}`);
  } finally {
    await browser.close();
  }
}

scrapeDelhaizeCatalog().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

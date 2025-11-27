/**
 * Scraper for Carrefour (Belgium) using Puppeteer
 */

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function mapCategory(source) {
  if (!source) return 'pantry';
  const slug = source.toLowerCase();
  if (slug.includes('groente') || slug.includes('fruit')) return 'fresh_produce';
  if (slug.includes('kaas') || slug.includes('zuivel') || slug.includes('dairy')) return 'dairy_eggs';
  if (slug.includes('vlees') || slug.includes('proteine') || slug.includes('meat')) return 'proteins';
  if (slug.includes('vis') || slug.includes('fish')) return 'seafood';
  if (slug.includes('bakkerij') || slug.includes('brood')) return 'bakery';
  if (slug.includes('diepvries') || slug.includes('frozen')) return 'frozen';
  if (slug.includes('drank') || slug.includes('beverage')) return 'beverages';
  if (slug.includes('snack')) return 'snacks';
  return 'pantry';
}

async function scrapeCarrefourCategory(page, categoryUrl) {
  try {
    console.log(`  🔄 Loading: ${categoryUrl}...`);
    await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll to load all
    let previousHeight = 0;
    for (let i = 0; i < 15; i++) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      await page.evaluate(() => window.scrollBy(0, 500));
      await new Promise(resolve => setTimeout(resolve, 500));
      previousHeight = currentHeight;
    }
    
    const products = await page.evaluate(() => {
      const results = [];
      const selectors = [
        '[data-product-id]',
        '.product-item',
        '.product-card',
        '[class*="ProductCard"]',
        '[class*="product-tile"]',
      ];
      
      let elements = [];
      for (const selector of selectors) {
        elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) break;
      }
      
      elements.forEach((el) => {
        try {
          const name = el.querySelector('.product-name, h3, h4, [data-product-name]')?.textContent?.trim() || 'Unknown';
          const priceEl = el.querySelector('.price, [data-price], [class*="Price"]');
          const priceText = priceEl?.textContent || '';
          const priceMatch = priceText.match(/[\d,]+\.?\d*/);
          const price = priceMatch ? parseFloat(priceMatch[0].replace(',', '.')) : null;
          const img = el.querySelector('img');
          const imageUrl = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
          const id = el.getAttribute('data-product-id') || `carrefour-${Math.random().toString(36).substr(2, 9)}`;
          
          if (name && name !== 'Unknown') {
            results.push({ id, name, price, imageUrl });
          }
        } catch (e) {}
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

async function scrapeCarrefour() {
  console.log('🕷️  Scraping Carrefour.be...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    const baseUrl = 'https://www.carrefour.be';
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const categoryUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/c/"], a[href*="/category"], nav a'));
      const urls = new Set();
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.includes('/c/') || href.includes('category'))) {
          urls.add(href.startsWith('http') ? href : `https://www.carrefour.be${href}`);
        }
      });
      return Array.from(urls).slice(0, 30);
    });
    
    if (categoryUrls.length === 0) {
      categoryUrls.push(
        `${baseUrl}/c/fruit-groenten`,
        `${baseUrl}/c/zuivel-eieren`,
        `${baseUrl}/c/vlees-vis`,
      );
    }
    
    console.log(`  ✅ Found ${categoryUrls.length} categories\n`);
    
    let allProducts = [];
    for (const url of categoryUrls) {
      const products = await scrapeCarrefourCategory(page, url);
      allProducts = allProducts.concat(products);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Import to Supabase
    console.log(`\n📤 Importing ${allProducts.length} products...`);
    let imported = 0;
    let failed = 0;
    
    for (const product of allProducts) {
      try {
        const payload = {
          id: product.id,
          product_name: product.name,
          brand: 'Carrefour',
          category: mapCategory(null),
          barcode: null,
          description: null,
          image_url: product.imageUrl,
          unit_size: null,
          nutrition: null,
          price: product.price,
          is_available: true,
          source: 'carrefour',
        };
        
        const { error } = await supabase.rpc('upsert_product_catalog', { payload });
        if (error) failed++;
        else imported++;
      } catch (e) {
        failed++;
      }
    }
    
    console.log(`\n✨ Done! Imported: ${imported}, Failed: ${failed}`);
  } finally {
    await browser.close();
  }
}

scrapeCarrefour().catch(console.error);


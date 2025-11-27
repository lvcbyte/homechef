/**
 * Direct web scraper for Lidl Belgium using Puppeteer
 * Scrapes lidl.be with JavaScript rendering and imports to Supabase
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

async function scrapeLidlCategory(page, categoryUrl) {
  try {
    console.log(`  🔄 Loading: ${categoryUrl}...`);
    
    await page.goto(categoryUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check what's actually on the page for debugging
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 500),
        hasProducts: document.querySelectorAll('.product, .product-item, .product-card, [data-product], article, [class*="product"]').length,
      };
    });
    
    console.log(`    📄 Page: ${pageInfo.title}`);
    console.log(`    🔍 Found ${pageInfo.hasProducts} potential product elements`);

    // Scroll multiple times to load all lazy-loaded content
    let previousHeight = 0;
    let stableCount = 0;
    for (let i = 0; i < 20; i++) { // Max 20 scrolls
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      
      if (currentHeight === previousHeight) {
        stableCount++;
        if (stableCount >= 3) break; // Stop if height stable 3 times
      } else {
        stableCount = 0;
      }
      
      await page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      previousHeight = currentHeight;
    }
    
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try clicking "Load more" or "Show more" buttons
    try {
      const loadMoreButtons = await page.$$('button:has-text("Meer"), button:has-text("Load more"), button:has-text("Toon meer"), [aria-label*="more"], [class*="load-more"]');
      for (const button of loadMoreButtons) {
        await button.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {
      // No load more buttons found
    }

    // Extract products using multiple strategies
    const products = await page.evaluate(() => {
      const results = [];
      
      // Try multiple selectors - be more aggressive
      const selectors = [
        '.product-item',
        '.product-tile',
        '.product-card',
        '[data-product-id]',
        '[data-product]',
        '.product',
        'article[data-product]',
        '.item-product',
        '[class*="product"]',
        '[class*="Product"]',
        '[class*="item"]',
        'article',
        '.card',
        '[role="listitem"]',
      ];

      let elements = [];
      let usedSelector = null;
      for (const selector of selectors) {
        const found = Array.from(document.querySelectorAll(selector));
        if (found.length > 0) {
          usedSelector = selector;
          elements = found;
          break;
        }
      }
      
      // If still no elements, try to find any clickable items that might be products
      if (elements.length === 0) {
        const allLinks = Array.from(document.querySelectorAll('a[href*="/product"], a[href*="/p/"], a[href*="/item"]'));
        if (allLinks.length > 0) {
          usedSelector = 'product-links';
          elements = allLinks.map(link => link.closest('div, article, li, section') || link).filter(Boolean);
        }
      }
      
      // Return selector info for debugging
      window._scraperInfo = { usedSelector, elementCount: elements.length };

      elements.forEach((el) => {
        try {
          // Extract product name
          const nameEl = el.querySelector('.product-name, .product-title, h3, h4, .name, .title, a[href*="/product"]') ||
                        el.querySelector('[data-product-name]') ||
                        el;
          const name = nameEl?.textContent?.trim() || 
                      el.getAttribute('data-product-name') ||
                      el.getAttribute('aria-label') ||
                      'Unknown';

          // Extract price
          const priceEl = el.querySelector('.price, .product-price, [data-price], .current-price, .price-value, [class*="price"]');
          let price = null;
          if (priceEl) {
            const priceText = priceEl.textContent || priceEl.getAttribute('data-price') || '';
            const priceMatch = priceText.match(/[\d,]+\.?\d*/);
            if (priceMatch) {
              price = parseFloat(priceMatch[0].replace(',', '.'));
            }
          }

          // Extract image
          const imgEl = el.querySelector('img');
          const imageUrl = imgEl?.getAttribute('src') ||
                          imgEl?.getAttribute('data-src') ||
                          imgEl?.getAttribute('data-lazy-src') ||
                          null;

          // Extract ID
          const id = el.getAttribute('data-product-id') ||
                    el.getAttribute('data-id') ||
                    el.getAttribute('data-sku') ||
                    `lidl-${Math.random().toString(36).substr(2, 9)}`;

          // Extract barcode
          const barcode = el.getAttribute('data-barcode') ||
                         el.getAttribute('data-ean') ||
                         null;

          // Extract unit size
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

      return { products: results, info: window._scraperInfo };
    });

    if (products.info) {
      console.log(`    🔍 Used selector: ${products.info.usedSelector || 'none'}, Elements: ${products.info.elementCount || 0}`);
    }
    
    const productList = products.products || products;
    console.log(`    ✅ Found ${productList.length} products`);
    return productList;
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return [];
  }
}

async function scrapeLidlCatalog() {
  console.log('🕷️  Scraping Lidl.be with Puppeteer (JavaScript rendering)...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const baseUrl = 'https://www.lidl.be';
    
    // First, go to homepage to find actual category URLs
    console.log(`📦 Loading homepage to find categories...`);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract category links from homepage
    let categoryUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/c/"], a[href*="/category"], nav a, [class*="category"] a'));
      const urls = new Set();
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.includes('/c/') || href.includes('category') || href.includes('product'))) {
          const fullUrl = href.startsWith('http') ? href : `https://www.lidl.be${href}`;
          urls.add(fullUrl);
        }
      });
      return Array.from(urls).slice(0, 50); // Get up to 50 categories
    });
    
    if (categoryUrls.length === 0) {
      // Fallback to common patterns
      categoryUrls = [
        `${baseUrl}/c/fruit-groenten`,
        `${baseUrl}/c/zuivel-eieren`,
        `${baseUrl}/c/vlees-vis`,
        `${baseUrl}/c/bakkerij`,
        `${baseUrl}/c/diepvries`,
      ];
    }
    
    console.log(`  ✅ Found ${categoryUrls.length} category URLs to scrape\n`);

    let allProducts = [];

    // Also try pagination if available
    for (const url of categoryUrls) {
      console.log(`📦 Scraping: ${url}`);
      let products = await scrapeLidlCategory(page, url);
      allProducts = allProducts.concat(products);
      console.log(`  ✅ Found ${products.length} products on page 1`);
      
      // Try to find and scrape additional pages
      let pageNum = 2;
      let hasMorePages = true;
      while (hasMorePages && pageNum <= 10) { // Max 10 pages per category
        try {
          // Try different pagination patterns
          const nextPageUrl = url.includes('?') 
            ? `${url}&page=${pageNum}`
            : `${url}?page=${pageNum}`;
          
          await page.goto(nextPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const nextProducts = await scrapeLidlCategory(page, nextPageUrl);
          if (nextProducts.length === 0) {
            hasMorePages = false;
          } else {
            products = products.concat(nextProducts);
            allProducts = allProducts.concat(nextProducts);
            console.log(`  ✅ Found ${nextProducts.length} products on page ${pageNum}`);
            pageNum++;
          }
        } catch (e) {
          hasMorePages = false;
        }
      }
      
      console.log(`  ✅ Total from this category: ${products.length} products\n`);
      
      // Be nice to the server
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Remove duplicates
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
      console.log('\n⚠️  No products found. Possible reasons:');
      console.log('   1. Website structure has changed');
      console.log('   2. Website requires login or blocks bots');
      console.log('   3. Products are loaded via API (check Network tab)');
      return;
    }

    let imported = 0;
    let failed = 0;

    for (const product of uniqueProducts) {
      try {
        const payload = {
          id: product.id,
          product_name: product.name,
          brand: 'Lidl',
          category: mapCategory(product.category),
          barcode: product.barcode || null,
          description: null,
          image_url: product.imageUrl ? (product.imageUrl.startsWith('http') ? product.imageUrl : `https://www.lidl.be${product.imageUrl}`) : null,
          unit_size: product.unitSize || null,
          nutrition: null,
          price: product.price,
          is_available: true,
          source: 'lidl',
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

scrapeLidlCatalog().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

/**
 * Direct web scraper for Colruyt Belgium using Puppeteer
 * Scrapes colruyt.be with JavaScript rendering and imports to Supabase
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

async function scrapeColruytCategory(page, categoryUrl) {
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
      // Try to find any product-like elements
      const allPossibleSelectors = [
        '.product', '.product-item', '.product-card', '.product-tile',
        '[data-product]', '[data-product-id]', 'article', 
        '[class*="product"]', '[class*="Product"]', '[class*="item"]',
        '.card', '[role="listitem"]', '.grid-item', '.list-item'
      ];
      
      const selectorCounts = {};
      allPossibleSelectors.forEach(sel => {
        selectorCounts[sel] = document.querySelectorAll(sel).length;
      });
      
      // Get some sample HTML to see structure
      const bodyHTML = document.body.innerHTML.substring(0, 2000);
      
      // Look for common product indicators in text
      const bodyText = document.body.innerText.toLowerCase();
      const hasProductKeywords = bodyText.includes('product') || 
                                 bodyText.includes('prijs') || 
                                 bodyText.includes('euro') ||
                                 bodyText.includes('€');
      
      return {
        title: document.title,
        url: window.location.href,
        selectorCounts,
        hasProductKeywords,
        bodyTextSample: document.body.innerText.substring(0, 300),
        bodyHTMLSample: bodyHTML,
      };
    });
    
    console.log(`    📄 Page: ${pageInfo.title}`);
    console.log(`    🔍 Selector counts:`, pageInfo.selectorCounts);
    console.log(`    🔍 Has product keywords: ${pageInfo.hasProductKeywords}`);
    
    // If no products found, show sample HTML and take screenshot
    if (Object.values(pageInfo.selectorCounts).every(count => count === 0)) {
      console.log(`    ⚠️  No product elements found. Sample text:`, pageInfo.bodyTextSample);
      // Check for API requests
      const apiCalls = await page.evaluate(() => {
        // Try to intercept fetch/XHR calls if possible
        return window.__apiCalls || [];
      });
      if (apiCalls.length > 0) {
        console.log(`    🔍 Found ${apiCalls.length} API calls - products might be loaded via API`);
      }
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: 'colruyt-debug.png', fullPage: false });
        console.log(`    📸 Screenshot saved to colruyt-debug.png`);
      } catch (e) {
        // Ignore screenshot errors
      }
    }

    // Scroll to load lazy-loaded content
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
      
      // Try multiple selectors - be more aggressive for Colruyt
      const selectors = [
        // Colruyt specific
        '[data-testid*="product"]',
        '[data-testid*="Product"]',
        '.product-item',
        '.product-card',
        '.product-tile',
        '.product-wrapper',
        '[data-product-id]',
        '[data-product]',
        '[data-sku]',
        '.product',
        'article[data-product]',
        '[class*="product"]',
        '[class*="Product"]',
        '[class*="ProductCard"]',
        '[class*="productCard"]',
        '[class*="item"]',
        '[class*="Item"]',
        'article',
        '.card',
        '.grid-item',
        '.list-item',
        '[role="listitem"]',
        '[role="article"]',
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
        // Try finding links with product indicators
        const allLinks = Array.from(document.querySelectorAll('a[href*="/product"], a[href*="/p/"], a[href*="/item"], a[href*="/shop"]'));
        if (allLinks.length > 0) {
          usedSelector = 'product-links';
          elements = allLinks.map(link => {
            const parent = link.closest('div, article, li, section, [class*="card"], [class*="item"]');
            return parent || link;
          }).filter(Boolean);
        }
      }
      
      // Last resort: find any element with price-like content
      if (elements.length === 0) {
        const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || '';
          // Look for price patterns: €X.XX or X,XX €
          return /€\s*\d+[,.]?\d*|\d+[,.]?\d*\s*€/.test(text) && 
                 text.length < 200 && // Not too long
                 el.children.length < 10; // Not too nested
        });
        if (priceElements.length > 0) {
          usedSelector = 'price-elements';
          elements = priceElements.slice(0, 50); // Limit to 50
        }
      }
      
      // Return selector info for debugging
      window._scraperInfo = { usedSelector, elementCount: elements.length };

      elements.forEach((el) => {
        try {
          const nameEl = el.querySelector('.product-name, .product-title, .name, h3, h4, .title, a[href*="/product"]') ||
                        el.querySelector('[data-product-name]') ||
                        el;
          const name = nameEl?.textContent?.trim() || 
                      el.getAttribute('data-product-name') ||
                      el.getAttribute('aria-label') ||
                      'Unknown';

          const priceEl = el.querySelector('.price, .product-price, .current-price, [data-price], [class*="price"]');
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
                    `colruyt-${Math.random().toString(36).substr(2, 9)}`;

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

async function scrapeColruytCatalog() {
  console.log('🕷️  Scraping Colruyt.be with Puppeteer (JavaScript rendering)...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Monitor network requests to see if products are loaded via API
    const apiRequests = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('api') || url.includes('product') || url.includes('catalog') || url.includes('search')) {
        apiRequests.push({ url, status: response.status() });
      }
    });

    const baseUrl = 'https://www.colruyt.be';
    
    // First, go to homepage to find actual category URLs
    console.log(`📦 Loading homepage to find categories...`);
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract category links from homepage - be more aggressive
    let categoryUrls = await page.evaluate(() => {
      // Try multiple strategies to find category links
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const urls = new Set();
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.toLowerCase() || '';
        
        // Look for category indicators
        if (href && (
          href.includes('/nl/online-boodschappen') ||
          href.includes('/category') ||
          href.includes('/c/') ||
          href.includes('fruit') ||
          href.includes('groenten') ||
          href.includes('zuivel') ||
          href.includes('vlees') ||
          href.includes('dranken') ||
          text.includes('fruit') ||
          text.includes('groenten') ||
          text.includes('zuivel') ||
          text.includes('vlees')
        )) {
          const fullUrl = href.startsWith('http') ? href : `https://www.colruyt.be${href}`;
          // Only add if it looks like a category page, not a product page
          if (!fullUrl.match(/\/product\/|\/p\//)) {
            urls.add(fullUrl);
          }
        }
      });
      
      return Array.from(urls).slice(0, 10); // Get more URLs
    });
    
    console.log(`  🔍 Found ${categoryUrls.length} potential category URLs`);
    if (categoryUrls.length > 0) {
      console.log(`  📋 Sample URLs:`, categoryUrls.slice(0, 3));
    }
    
    if (categoryUrls.length === 0) {
      // Fallback to common patterns - try different URL structures
      categoryUrls = [
        `${baseUrl}/nl/online-boodschappen`,
        `${baseUrl}/nl/online-boodschappen/fruit-groenten`,
        `${baseUrl}/nl/online-boodschappen/zuivel-eieren`,
        `${baseUrl}/nl/online-boodschappen/vlees-vis`,
        `${baseUrl}/nl/online-boodschappen/brood-bakkerij`,
        `${baseUrl}/nl/online-boodschappen/diepvries`,
        `${baseUrl}/nl/online-boodschappen/dranken`,
        `${baseUrl}/nl/shop`,
        `${baseUrl}/nl/shop/fruit-groenten`,
      ];
      console.log(`  ⚠️  Using fallback URLs`);
    }
    
    console.log(`  ✅ Found ${categoryUrls.length} category URLs to scrape\n`);

    let allProducts = [];

    for (const url of categoryUrls) {
      console.log(`📦 Scraping: ${url}`);
      const products = await scrapeColruytCategory(page, url);
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
          brand: 'Colruyt',
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

scrapeColruytCatalog().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

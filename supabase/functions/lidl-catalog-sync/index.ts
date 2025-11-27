import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function mapCategoryLabel(source?: string | null) {
  if (!source) return 'pantry';
  const value = source.toLowerCase();
  if (value.includes('groente') || value.includes('fruit')) return 'fresh_produce';
  if (value.includes('kaas') || value.includes('zuivel') || value.includes('dairy')) return 'dairy_eggs';
  if (value.includes('vlees') || value.includes('proteine') || value.includes('meat') || value.includes('worst')) return 'proteins';
  if (value.includes('vis') || value.includes('fish') || value.includes('seafood')) return 'seafood';
  if (value.includes('bakkerij') || value.includes('brood') || value.includes('bakery')) return 'bakery';
  if (value.includes('kruiden') || value.includes('saus') || value.includes('spice')) return 'spices_condiments';
  if (value.includes('diepvries') || value.includes('frozen')) return 'frozen';
  if (value.includes('maaltijd') || value.includes('meal')) return 'ready_meals';
  if (value.includes('drank') || value.includes('beverage') || value.includes('drink')) return 'beverages';
  if (value.includes('snack') || value.includes('chips') || value.includes('chocolate')) return 'snacks';
  if (value.includes('baby')) return 'baby';
  if (value.includes('verzorging') || value.includes('care')) return 'personal_care';
  if (value.includes('huishoud') || value.includes('household')) return 'household';
  return 'pantry';
}

// Simple HTML parser for Deno
function parseHTML(html: string) {
  // Extract products using regex (simple approach for Deno)
  const products: any[] = [];
  
  // Try to find product containers - adjust patterns based on actual HTML structure
  const productPattern = /<[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/[^>]*>/gi;
  const matches = html.match(productPattern) || [];
  
  for (const match of matches) {
    // Extract product name
    const nameMatch = match.match(/<[^>]*class="[^"]*(?:product-name|product-title|name|title)[^"]*"[^>]*>([^<]+)<\/[^>]*>/i);
    const name = nameMatch ? nameMatch[1].trim() : null;
    
    // Extract price
    const priceMatch = match.match(/<[^>]*class="[^"]*(?:price|product-price)[^"]*"[^>]*>([^<€]+)<\/[^>]*>/i);
    const priceStr = priceMatch ? priceMatch[1].trim().replace(/[^\d,.-]/g, '').replace(',', '.') : '0';
    const price = parseFloat(priceStr) || null;
    
    // Extract image
    const imgMatch = match.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    const imageUrl = imgMatch ? imgMatch[1] : null;
    
    // Extract product ID
    const idMatch = match.match(/data-product-id="([^"]+)"/i) || match.match(/data-id="([^"]+)"/i);
    const id = idMatch ? idMatch[1] : `lidl-${crypto.randomUUID()}`;
    
    if (name && name.length > 0) {
      products.push({
        id,
        name,
        price,
        imageUrl,
        brand: 'Lidl',
      });
    }
  }
  
  return products;
}

async function scrapeLidlCategory(categoryUrl: string) {
  try {
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parseHTML(html);
  } catch (error) {
    console.error(`Error scraping ${categoryUrl}:`, error);
    return [];
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const baseUrl = 'https://www.lidl.be';
    const categoryUrls = [
      `${baseUrl}/c/fresh-produce/a10005965`,
      `${baseUrl}/c/dairy-eggs/a10005966`,
      `${baseUrl}/c/meat-fish/a10005967`,
      `${baseUrl}/c/bakery/a10005968`,
      `${baseUrl}/c/frozen/a10005969`,
      `${baseUrl}/c/beverages/a10005970`,
      `${baseUrl}/c/snacks/a10005971`,
      `${baseUrl}/c/pantry/a10005972`,
    ];

    let allProducts: any[] = [];

    for (const url of categoryUrls) {
      const products = await scrapeLidlCategory(url);
      allProducts = allProducts.concat(products);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (allProducts.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No products found',
        note: 'Website structure may have changed. Check selectors in scrape-lidl-direct.ts'
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    let imported = 0;
    let failed = 0;

    for (const product of allProducts) {
      try {
        const normalized = {
          id: product.id,
          product_name: product.name,
          brand: product.brand || 'Lidl',
          category: mapCategoryLabel(product.category),
          barcode: null,
          description: null,
          image_url: product.imageUrl ? (product.imageUrl.startsWith('http') ? product.imageUrl : `https://www.lidl.be${product.imageUrl}`) : null,
          unit_size: null,
          nutrition: null,
          price: product.price,
          is_available: true,
          source: 'lidl',
        };

        const { error } = await supabase.rpc('upsert_product_catalog', {
          payload: normalized,
        });
        
        if (error) {
          failed++;
        } else {
          imported++;
        }
      } catch (err) {
        failed++;
      }
    }

    return new Response(JSON.stringify({ 
      imported,
      failed,
      total: allProducts.length,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ 
      error: String(error),
      note: 'Use scripts/scrape-lidl-direct.ts for better scraping with cheerio'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

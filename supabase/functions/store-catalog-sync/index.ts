import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Store configuration
const STORE_CONFIG: Record<string, {
  name: string;
  apifyActorId?: string;
  baseUrl: string;
  categoryMapper: (category: string | null) => string;
}> = {
  'colruyt': {
    name: 'Colruyt',
    baseUrl: 'https://www.colruyt.be',
    categoryMapper: (cat) => mapCategory(cat),
  },
  'lidl': {
    name: 'Lidl',
    baseUrl: 'https://www.lidl.be',
    apifyActorId: undefined, // TODO: Add Apify actor ID if available
    categoryMapper: (cat) => mapCategory(cat),
  },
  'aldi': {
    name: 'Aldi',
    baseUrl: 'https://www.aldi.be',
    categoryMapper: (cat) => mapCategory(cat),
  },
  'delhaize': {
    name: 'Delhaize',
    baseUrl: 'https://www.delhaize.be',
    categoryMapper: (cat) => mapCategory(cat),
  },
};

function mapCategory(source?: string | null) {
  if (!source) return 'pantry';
  const value = source.toLowerCase();
  if (value.includes('groente') || value.includes('fruit') || value.includes('vegetable') || value.includes('fruit')) return 'fresh_produce';
  if (value.includes('vis') || value.includes('fish') || value.includes('seafood')) return 'seafood';
  if (value.includes('zuivel') || value.includes('yoghurt') || value.includes('melk') || value.includes('dairy') || value.includes('lait')) return 'dairy_eggs';
  if (value.includes('vlees') || value.includes('eiwit') || value.includes('meat') || value.includes('viande')) return 'proteins';
  if (value.includes('kruiden') || value.includes('saus') || value.includes('condiment') || value.includes('spice')) return 'spices_condiments';
  if (value.includes('diepvries') || value.includes('frozen') || value.includes('congelé')) return 'frozen';
  if (value.includes('maaltijd') || value.includes('meal') || value.includes('repas')) return 'ready_meals';
  if (value.includes('snack') || value.includes('chips') || value.includes('chocolade') || value.includes('chocolate')) return 'snacks';
  if (value.includes('bakkerij') || value.includes('brood') || value.includes('bakery') || value.includes('boulangerie')) return 'bakery';
  if (value.includes('drank') || value.includes('beverage') || value.includes('drink') || value.includes('boisson')) return 'beverages';
  if (value.includes('baby')) return 'baby';
  if (value.includes('verzorging') || value.includes('care') || value.includes('soin')) return 'personal_care';
  if (value.includes('huishoud') || value.includes('household') || value.includes('ménage')) return 'household';
  return 'pantry';
}

// Generic product fetcher - to be implemented per store
async function fetchProduct(store: string, productPath: string): Promise<any> {
  const config = STORE_CONFIG[store];
  if (!config) {
    throw new Error(`Unknown store: ${store}`);
  }

  // Special handling for Lidl (use dedicated Edge Function)
  if (store === 'lidl') {
    try {
      const lidlResponse = await fetch(`${SUPABASE_URL}/functions/v1/lidl-catalog-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ productId: productPath }),
      });
      
      if (lidlResponse.ok) {
        const data = await lidlResponse.json();
        if (data.products && data.products.length > 0) {
          return data.products[0];
        }
      }
    } catch (error) {
      console.error('Lidl Edge Function failed, trying alternatives:', error);
    }
  }
  
  // Option 1: If Apify actor exists for this store
  if (config.apifyActorId) {
    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    if (APIFY_TOKEN) {
      try {
        // Start Apify actor run
        const startRun = await fetch(
          `https://api.apify.com/v2/acts/${config.apifyActorId}/runs?token=${APIFY_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              input: { 
                productUrl: productPath.startsWith('http') ? productPath : `${config.baseUrl}${productPath}` 
              } 
            }),
          }
        ).then((res) => res.json());

        // Wait for completion (simplified - in production, use proper polling)
        // ... implement Apify polling logic similar to AH function
      } catch (error) {
        console.error(`Apify actor failed for ${store}:`, error);
      }
    }
  }
  
  // Option 2: Direct API call (if available)
  // const response = await fetch(`${config.baseUrl}/api/products/${productPath}`);
  // return await response.json();
  
  // Option 3: Web scraping (if needed)
  // Use a scraping library or service
  
  throw new Error(`Product fetching not yet implemented for ${store}. Lidl API access may be blocked.`);
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const store: string = payload.store || 'colruyt';
    const productPath: string | undefined = payload.path || payload.url || payload.productId;
    
    if (!productPath) {
      return new Response('Missing product path, url, or productId', { status: 400 });
    }

    if (!STORE_CONFIG[store]) {
      return new Response(`Unknown store: ${store}`, { status: 400 });
    }

    const product = await fetchProduct(store, productPath);
    const config = STORE_CONFIG[store];

    if (!product) {
      return new Response('No product found', { status: 404 });
    }

    // Normalize product data (adjust based on actual API response structure)
    const normalized = {
      id: product.id ?? `${store}-${crypto.randomUUID()}`,
      product_name: product.name ?? product.title ?? product.product_name ?? 'Unknown product',
      brand: product.brand ?? null,
      category: config.categoryMapper(product.category ?? product.mainCategory),
      barcode: product.barcode ?? product.ean ?? product.gtin ?? null,
      description: product.description ?? product.summary ?? null,
      image_url: product.image_url ?? product.image ?? product.imageUrl ?? null,
      unit_size: product.unit_size ?? product.unitSize ?? product.size ?? null,
      nutrition: product.nutrition ?? null,
      price: product.price ?? product.price_current ?? product.currentPrice ?? null,
      is_available: product.is_available ?? product.available ?? true,
      source: store,
    };

    const { data, error } = await supabase.rpc('upsert_product_catalog', {
      payload: normalized,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ product: data, store }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});


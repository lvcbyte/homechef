import { serve } from 'https://deno.land/std/http/server.ts';
import { delay } from 'https://deno.land/std/async/delay.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APIFY_ACTOR_ID = 'oVW5PcdZ3Da0Q3bYh';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function mapCategoryLabel(source?: string | null) {
  if (!source) return 'pantry';
  const value = source.toLowerCase();
  if (value.includes('groente') || value.includes('fruit')) return 'fresh_produce';
  if (value.includes('vis')) return 'seafood';
  if (value.includes('zuivel') || value.includes('yoghurt') || value.includes('melk')) return 'dairy_eggs';
  if (value.includes('vlees') || value.includes('eiwit')) return 'proteins';
  if (value.includes('kruiden') || value.includes('saus') || value.includes('condiment')) return 'spices_condiments';
  if (value.includes('diepvries') || value.includes('frozen')) return 'frozen';
  if (value.includes('maaltijd')) return 'ready_meals';
  if (value.includes('snack') || value.includes('chips') || value.includes('chocolade')) return 'snacks';
  if (value.includes('bakkerij') || value.includes('brood')) return 'bakery';
  if (value.includes('drank') || value.includes('beverage')) return 'beverages';
  if (value.includes('baby')) return 'baby';
  if (value.includes('verzorging')) return 'personal_care';
  if (value.includes('huishoud')) return 'household';
  return 'pantry';
}

async function runActor(input: Record<string, unknown>) {
  if (!APIFY_TOKEN) throw new Error('Missing APIFY_TOKEN');
  const startRun = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    }
  ).then((res) => res.json());

  let run = startRun;
  while (
    run?.data?.status &&
    !['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.data.status)
  ) {
    await delay(1500);
    run = await fetch(`https://api.apify.com/v2/actor-runs/${run.data.id}?token=${APIFY_TOKEN}`).then((res) =>
      res.json()
    );
  }
  if (run?.data?.status !== 'SUCCEEDED') {
    throw new Error(`Apify actor failed with status ${run?.data?.status}`);
  }
  const datasetId = run.data.defaultDatasetId;
  const datasetItems = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
  ).then((res) => res.json());
  return datasetItems?.[0];
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    const productPath: string | undefined = payload.path || payload.url;
    if (!productPath) {
      return new Response('Missing product path or url', { status: 400 });
    }

    const ahInput = productPath.startsWith('http')
      ? productPath
      : `https://www.ah.nl${productPath}`;
    const product = await runActor({ productUrl: ahInput });

    if (!product) {
      return new Response('No product found', { status: 404 });
    }

    const normalized = {
      id: product.id ?? crypto.randomUUID(),
      product_name: product.description ?? product.summary ?? 'Unknown product',
      brand: product.brand ?? null,
      category: mapCategoryLabel(product.category),
      barcode: product.barcode ?? null,
      description: product.summary ?? null,
      image_url: product.image_url ?? null,
      unit_size: product.unit_size ?? null,
      nutrition: product.nutrition ?? null,
      price: product.price_current ?? null,
      is_available: product.is_available ?? true,
    };

    const { data, error } = await supabase.rpc('upsert_product_catalog', {
      payload: normalized,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ product: data }), {
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


/**
 * Check what's actually in the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkDatabase() {
  console.log('🔍 Checking database...\n');
  
  // Count by source
  const { data: counts, error: countError } = await supabase
    .from('product_catalog')
    .select('source')
    .then(result => {
      if (result.error) throw result.error;
      const grouped = {};
      result.data.forEach(row => {
        grouped[row.source] = (grouped[row.source] || 0) + 1;
      });
      return { data: grouped, error: null };
    });
  
  if (countError) {
    console.error('❌ Error:', countError);
    return;
  }
  
  console.log('📊 Products by source:');
  Object.entries(counts).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`\n📦 Total: ${total} products\n`);
  
  // Sample products
  const { data: samples, error: sampleError } = await supabase
    .from('product_catalog')
    .select('product_name, source, brand, price, image_url')
    .order('updated_at', { ascending: false })
    .limit(10);
  
  if (!sampleError && samples) {
    console.log('📋 Latest 10 products:');
    samples.forEach(p => {
      console.log(`  - ${p.product_name} (${p.source}) - ${p.brand || 'N/A'} - €${p.price || 'N/A'}`);
    });
  }
}

checkDatabase().catch(console.error);


/**
 * Test if upsert function saves source field correctly
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

async function testUpsertSource() {
  console.log('🧪 Testing if upsert saves source field...\n');
  
  const testPayload = {
    id: 'test-source-99999',
    product_name: 'Test Product Source',
    brand: 'Test Brand',
    category: 'pantry',
    barcode: '9999999999',
    description: null,
    image_url: null,
    unit_size: null,
    nutrition: null,
    price: 5.99,
    is_available: true,
    source: 'open-food-facts',
  };
  
  console.log('📤 Inserting test product with source: open-food-facts...');
  
  const { data, error } = await supabase.rpc('upsert_product_catalog', { payload: testPayload });
  
  if (error) {
    console.error('❌ ERROR:', error.message);
    return false;
  }
  
  console.log('✅ Product inserted. Checking if source was saved...');
  
  // Check what was actually saved
  const { data: saved, error: fetchError } = await supabase
    .from('product_catalog')
    .select('id, product_name, source')
    .eq('id', 'test-source-99999')
    .single();
  
  if (fetchError) {
    console.error('❌ Error fetching:', fetchError);
    return false;
  }
  
  console.log('📋 Saved product:', saved);
  
  if (saved.source === 'open-food-facts') {
    console.log('✅ SUCCESS! Source field is correctly saved.\n');
    
    // Clean up
    await supabase.from('product_catalog').delete().eq('id', 'test-source-99999');
    console.log('🧹 Test product verwijderd.\n');
    return true;
  } else {
    console.error(`❌ PROBLEEM! Source was saved as: "${saved.source}" instead of "open-food-facts"`);
    console.error('💡 OPLOSSING: Run migration 14_fix_upsert_source.sql in Supabase SQL Editor\n');
    return false;
  }
}

testUpsertSource().catch(console.error);


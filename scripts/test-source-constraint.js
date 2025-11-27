/**
 * Test if source constraint is blocking new sources
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

async function testSourceConstraint() {
  console.log('🧪 Testing source constraint...\n');
  
  // Try to insert a test product with 'open-food-facts' source
  const testPayload = {
    id: 'test-off-12345',
    product_name: 'Test Product',
    brand: 'Test Brand',
    category: 'pantry',
    barcode: '1234567890',
    description: null,
    image_url: null,
    unit_size: null,
    nutrition: null,
    price: null,
    is_available: true,
    source: 'open-food-facts',
  };
  
  console.log('📤 Trying to insert test product with source: open-food-facts...');
  
  const { data, error } = await supabase.rpc('upsert_product_catalog', { payload: testPayload });
  
  if (error) {
    console.error('❌ ERROR:', error.message);
    
    if (error.message.includes('source_check') || error.message.includes('constraint')) {
      console.error('\n🔴 PROBLEEM: De source constraint blokkeert nieuwe sources!');
      console.error('💡 OPLOSSING: Run migration 13_add_more_stores.sql in Supabase SQL Editor\n');
      console.error('📋 Ga naar: Supabase Dashboard → SQL Editor');
      console.error('📋 Kopieer de inhoud van: supabase/migrations/13_add_more_stores.sql');
      console.error('📋 Plak en run in SQL Editor\n');
    } else {
      console.error('\n❌ Andere error:', error);
    }
    return false;
  } else {
    console.log('✅ SUCCESS! Source constraint werkt. Test product toegevoegd.');
    
    // Clean up test product
    await supabase.from('product_catalog').delete().eq('id', 'test-off-12345');
    console.log('🧹 Test product verwijderd.\n');
    return true;
  }
}

testSourceConstraint().catch(console.error);


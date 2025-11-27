/**
 * Test the match_product_catalog function
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

async function testMatch() {
  console.log('🧪 Testing match_product_catalog function...\n');
  
  const testTerms = ['kaas', 'melk', 'brood', 'appel', 'test'];
  
  for (const term of testTerms) {
    console.log(`🔍 Searching for: "${term}"`);
    
    const { data, error } = await supabase.rpc('match_product_catalog', { 
      search_term: term 
    });
    
    if (error) {
      console.error(`  ❌ ERROR: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  ✅ Found ${data.length} results`);
      console.log(`  📋 Top 3:`);
      data.slice(0, 3).forEach((p, i) => {
        console.log(`     ${i + 1}. ${p.product_name} (score: ${p.match_score || 'N/A'})`);
      });
    } else {
      console.log(`  ⚠️  No results found`);
    }
    console.log('');
  }
  
  // Also check total products in catalog
  const { count } = await supabase
    .from('product_catalog')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total products in catalog: ${count || 0}`);
}

testMatch().catch(console.error);


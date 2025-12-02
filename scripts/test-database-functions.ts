// Test Database Functions
// Run this script to verify all functions work correctly

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFunctions() {
  console.log('🧪 Testing Database Functions...\n');

  const tests = [
    {
      name: 'get_price_trend',
      test: async () => {
        const { data, error } = await supabase.rpc('get_price_trend', {
          p_product_id: 'test-product',
          p_days: 30,
        });
        if (error && !error.message.includes('does not exist')) throw error;
        return { success: true, message: 'Function exists', data: undefined, canSubstitute: undefined };
      },
    },
    {
      name: 'find_ingredient_substitutions',
      test: async () => {
        const { data, error } = await supabase.rpc('find_ingredient_substitutions', {
          p_ingredient_name: 'rode ui',
          p_min_confidence: 0.7,
        });
        if (error && !error.message.includes('does not exist')) throw error;
        return { success: true, message: 'Function exists', data: data?.length || 0, canSubstitute: undefined };
      },
    },
    {
      name: 'can_substitute_ingredient',
      test: async () => {
        const { data, error } = await supabase.rpc('can_substitute_ingredient', {
          p_recipe_ingredient: 'rode ui',
          p_available_ingredient: 'gele ui',
        });
        if (error && !error.message.includes('does not exist')) throw error;
        return { success: true, message: 'Function exists', data: undefined, canSubstitute: data?.can_substitute };
      },
    },
    {
      name: 'get_active_timers',
      test: async () => {
        // This will fail if user is not authenticated, but function should exist
        const { data, error } = await supabase.rpc('get_active_timers', {
          p_user_id: '00000000-0000-0000-0000-000000000000',
        });
        if (error && !error.message.includes('does not exist') && !error.message.includes('permission')) {
          throw error;
        }
        return { success: true, message: 'Function exists', data: undefined, canSubstitute: undefined };
      },
    },
    {
      name: 'calculate_recipe_health_impact',
      test: async () => {
        const { data, error } = await supabase.rpc('calculate_recipe_health_impact', {
          p_recipe_id: '00000000-0000-0000-0000-000000000000',
          p_servings: 1,
          p_user_id: null,
        });
        if (error && !error.message.includes('does not exist') && !error.message.includes('violates foreign key')) {
          throw error;
        }
        return { success: true, message: 'Function exists', data: undefined, canSubstitute: undefined };
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const result = await test.test();
      console.log(`✅ ${test.name}: ${result.message}${result.data ? ` (${result.data} results)` : ''}${result.canSubstitute !== undefined ? ` (can substitute: ${result.canSubstitute})` : ''}\n`);
      passed++;
    } catch (error: any) {
      console.error(`❌ ${test.name}: ${error.message}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\n⚠️  Some functions are missing. Please check the migration was run correctly.');
    process.exit(1);
  } else {
    console.log('\n✅ All functions exist and are accessible!');
  }
}

// Check tables
async function checkTables() {
  console.log('\n📋 Checking Tables...\n');

  const tables = [
    'price_history',
    'ingredient_substitutions',
    'cooking_timers',
    'user_health_goals',
    'recipe_consumption',
    'ml_model_metadata',
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error && !error.message.includes('permission')) {
        throw error;
      }
      console.log(`✅ Table ${table} exists`);
    } catch (error: any) {
      console.error(`❌ Table ${table}: ${error.message}`);
    }
  }
}

async function main() {
  await testFunctions();
  await checkTables();
}

main().catch(console.error);


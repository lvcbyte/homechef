/**
 * Master script to run all scrapers and import products from multiple sources
 * This will build a massive product catalog
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const scrapers = [
  { name: 'Open Food Facts', script: 'scrape-openfoodfacts.js', priority: 1 },
  { name: 'Lidl', script: 'scrape-lidl-direct.js', priority: 2 },
  { name: 'Colruyt', script: 'scrape-colruyt-direct.js', priority: 2 },
  { name: 'Jumbo', script: 'scrape-jumbo.js', priority: 3 },
  { name: 'Carrefour', script: 'scrape-carrefour.js', priority: 3 },
];

async function runScraper(name, script) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting: ${name}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    const { stdout, stderr } = await execAsync(`node scripts/${script}`, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log(`\n✅ Completed: ${name}\n`);
    return { success: true, name };
  } catch (error) {
    console.error(`\n❌ Failed: ${name}`);
    console.error(error.message);
    return { success: false, name, error: error.message };
  }
}

async function bulkImport() {
  console.log('🎯 Starting Bulk Product Import');
  console.log(`📦 Running ${scrapers.length} scrapers...\n`);
  
  const results = [];
  
  // Sort by priority
  const sortedScrapers = scrapers.sort((a, b) => a.priority - b.priority);
  
  for (const scraper of sortedScrapers) {
    const result = await runScraper(scraper.name, scraper.script);
    results.push(result);
    
    // Wait between scrapers to be nice to servers
    if (scraper !== sortedScrapers[sortedScrapers.length - 1]) {
      console.log('⏸️  Waiting 5 seconds before next scraper...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 IMPORT SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  successful.forEach(r => console.log(`   - ${r.name}`));
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`   - ${r.name}: ${r.error}`));
  }
  
  console.log(`\n🎉 Bulk import completed!`);
  console.log(`\n💡 Check your Supabase product_catalog table to see all imported products.`);
}

bulkImport().catch(console.error);


/**
 * Test script to inspect Colruyt website structure
 */

const puppeteer = require('puppeteer');

async function testColruyt() {
  console.log('🔍 Testing Colruyt.be structure...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    const url = 'https://www.colruyt.be/nl/online-boodschappen';
    console.log(`📦 Loading: ${url}...`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer
    
    const info = await page.evaluate(() => {
      // Get all links
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const productLinks = allLinks.filter(link => {
        const href = link.getAttribute('href') || '';
        return href.includes('product') || href.includes('/p/') || href.includes('/item');
      });
      
      // Get all elements with class containing "product"
      const productElements = Array.from(document.querySelectorAll('[class*="product"], [class*="Product"], [class*="item"], [class*="Item"]'));
      
      // Get page structure
      const structure = {
        title: document.title,
        url: window.location.href,
        totalLinks: allLinks.length,
        productLinks: productLinks.length,
        productElements: productElements.length,
        sampleLinks: productLinks.slice(0, 5).map(l => ({
          href: l.getAttribute('href'),
          text: l.textContent?.trim().substring(0, 50)
        })),
        sampleClasses: Array.from(new Set(
          productElements.slice(0, 20).map(el => el.className).filter(Boolean)
        )).slice(0, 10),
        bodyText: document.body.innerText.substring(0, 1000),
      };
      
      return structure;
    });
    
    console.log('\n📊 Page Structure:');
    console.log(`  Title: ${info.title}`);
    console.log(`  URL: ${info.url}`);
    console.log(`  Total links: ${info.totalLinks}`);
    console.log(`  Product links: ${info.productLinks}`);
    console.log(`  Product elements: ${info.productElements}`);
    
    if (info.sampleLinks.length > 0) {
      console.log('\n🔗 Sample Product Links:');
      info.sampleLinks.forEach(link => {
        console.log(`  - ${link.text}: ${link.href}`);
      });
    }
    
    if (info.sampleClasses.length > 0) {
      console.log('\n🎨 Sample CSS Classes:');
      info.sampleClasses.forEach(cls => {
        console.log(`  - ${cls}`);
      });
    }
    
    console.log('\n📄 Page Text Sample:');
    console.log(info.bodyText.substring(0, 500));
    
    // Take screenshot
    await page.screenshot({ path: 'colruyt-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved to colruyt-test.png');
    
    console.log('\n⏸️  Browser will stay open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } finally {
    await browser.close();
  }
}

testColruyt().catch(console.error);


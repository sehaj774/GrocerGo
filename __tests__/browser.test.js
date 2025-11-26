const puppeteer = require('puppeteer');

(async () => {
  // 1. Launch the browser with security warnings DISABLED
  const browser = await puppeteer.launch({ 
      headless: false, // Show the browser so you can see it working
      slowMo: 50,      // Slow down actions so you can follow along
      ignoreHTTPSErrors: true, // <--- TELL PUPPETEER TO IGNORE SSL ERRORS
      args: [
        '--ignore-certificate-errors',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
  });
  const page = await browser.newPage();

  try {
    console.log('🔵 Opening Homepage...');
    
    // Ensure this matches your server's running port (3000 based on your logs)
    await page.goto('https://localhost:3000', { waitUntil: 'networkidle2' });

    // 2. Test Page Title
    const title = await page.title();
    console.log(`Page Title is: "${title}"`);
    
    if (title.includes('GrocerGo')) {
        console.log('✅ Title Check PASSED');
    } else {
        console.error('❌ Title Check FAILED');
    }

    // 3. Test Search Functionality
    console.log('🔵 Testing Search...');
    
    // Wait for the search input to be rendered
    await page.waitForSelector('input[name="q"]');
    
    // Type "Milk"
    await page.type('input[name="q"]', 'Milk'); 
    
    // Click Search
    await page.click('.search-button'); 
    
    // Wait for the results header
    await page.waitForSelector('h1');
    
    const heading = await page.$eval('h1', el => el.textContent);
    if (heading.includes('Search Results')) {
        console.log('✅ Search Interaction PASSED');
    } else {
        console.error('❌ Search Interaction FAILED - Wrong page loaded');
    }

  } catch (error) {
    console.error('❌ Browser Test Failed:', error);
  } finally {
    console.log('🔵 Closing Browser...');
    await browser.close();
  }
})();
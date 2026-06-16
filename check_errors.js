const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching puppeteer...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.log(`[BROWSER ERROR] ${err.toString()}`);
  });
  
  console.log('Navigating to localhost:5173...');
  try {
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Navigation error:', e.message);
  }
  
  console.log('Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
})();

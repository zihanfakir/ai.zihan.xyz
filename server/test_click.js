const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('http://localhost:5000/index.html');
  
  // Wait for load
  await new Promise(r => setTimeout(r, 2000));
  
  // Type something and submit
  await page.type('#userInput', 'Hello');
  await page.click('#sendBtn');
  
  // Wait for response
  await new Promise(r => setTimeout(r, 5000));
  
  await browser.close();
  console.log('Test completed.');
})();

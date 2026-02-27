const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to the app (assuming server is running on localhost:3000)
  await page.goto('http://localhost:3000');

  // Take a screenshot of the Dashboard
  await page.screenshot({ path: 'verification/dashboard.png', fullPage: true });
  console.log('Dashboard screenshot taken.');

  // Interact: Go to Food Log
  await page.click('text=Food');
  await page.waitForTimeout(500); // Wait for transition
  await page.screenshot({ path: 'verification/food_log.png', fullPage: true });
  console.log('Food Log screenshot taken.');

  // Interact: Search for food
  await page.fill('#food-search', 'Chicken');
  await page.waitForSelector('.list-item'); // Wait for results
  await page.screenshot({ path: 'verification/food_search.png', fullPage: true });
  console.log('Food Search screenshot taken.');

  await browser.close();
})();

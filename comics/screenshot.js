const puppeteer = require('puppeteer-core');
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9333' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('file:///C:/Users/user/Desktop/social-skills-app/comics/flex-1.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(3000);

  // Full page screenshot in sections
  await page.screenshot({ path: 'C:/Users/user/Desktop/social-skills-app/comics/ss1.png' });
  await page.evaluate(() => window.scrollTo(0, 700));
  await delay(800);
  await page.screenshot({ path: 'C:/Users/user/Desktop/social-skills-app/comics/ss2.png' });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await delay(800);
  await page.screenshot({ path: 'C:/Users/user/Desktop/social-skills-app/comics/ss3.png' });
  await page.evaluate(() => window.scrollTo(0, 9999));
  await delay(800);
  await page.screenshot({ path: 'C:/Users/user/Desktop/social-skills-app/comics/ss4.png' });

  await page.close();
  await browser.disconnect();
  console.log('✅ Done');
})();

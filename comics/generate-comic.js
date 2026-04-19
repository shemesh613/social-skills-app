const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const outputDir = path.join(__dirname, 'images');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const prompts = [
  {
    name: 'panel1_situation',
    prompt: 'Kawaii anime style, children illustration. Three cute 8-year-old kids standing on a school soccer field during recess, arguing and pointing at the goal. One kid has arms crossed stubbornly. Bright sunny day, school building in background. Big expressive eyes, round faces, colorful school uniforms. Soft pastel colors, clean lines, adorable style. No text.'
  },
  {
    name: 'panel2_red',
    prompt: 'Kawaii anime style, children illustration. Three sad 8-year-old kids sitting on the ground next to a soccer field, looking dejected and angry. A school bell icon showing recess is OVER. The soccer ball sits untouched. Dark clouds above them symbolizing bad mood. Big expressive sad angry eyes, round faces. Red-tinted border atmosphere. No text.'
  },
  {
    name: 'panel3_green',
    prompt: 'Kawaii anime style, children illustration. Three happy 8-year-old kids on a soccer field, one is the goalkeeper making a fun save, the others cheer. A small cute clock timer showing they take turns. Sparkles and stars around them. Big happy eyes, round faces, huge smiles. Green-tinted bright atmosphere, sunshine. No text.'
  },
  {
    name: 'panel4_result',
    prompt: 'Kawaii anime style, children illustration. Three 8-year-old kids celebrating together on a soccer field, group hug, jumping with joy. Confetti, stars, hearts floating around them. Golden warm sunset light. Super happy kawaii expressions, sparkly eyes, biggest smiles. Magical warm atmosphere. No text.'
  }
];

async function waitForSelector(page, selector, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) return el;
    await delay(2000);
  }
  return null;
}

async function scanPage(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role="button"]')]
      .filter(el => el.getBoundingClientRect().width > 0)
      .map(el => ({ text: (el.textContent || '').trim().substring(0, 50), aria: el.getAttribute('aria-label') || '' }));
    const tas = [...document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]')].map(el => ({
      tag: el.tagName, placeholder: el.placeholder || '', visible: el.getBoundingClientRect().width > 0, role: el.getAttribute('role') || '',
    }));
    return { buttons: btns, inputs: tas, url: window.location.href };
  });
}

(async () => {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir: path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'GrokProfile2'),
    args: ['--start-maximized', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
    timeout: 60000,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await browser.newPage();
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: outputDir });

  for (let i = 0; i < prompts.length; i++) {
    const { name, prompt } = prompts[i];
    console.log(`\n🎨 Panel ${i + 1}/4: ${name}`);

    // Navigate to Grok imagine
    try {
      await page.goto('https://grok.com/imagine', { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch(e) {
      console.log('⚠️ Navigation timeout, continuing...');
    }

    console.log('⏳ Waiting for page to load...');
    await delay(20000); // Long wait for full load

    // Debug: scan page
    const scan = await scanPage(page);
    console.log('📋 Page URL:', scan.url);
    console.log('📋 Inputs found:', JSON.stringify(scan.inputs, null, 2));
    console.log('📋 Buttons:', scan.buttons.map(b => b.aria || b.text).join(', '));

    // Try multiple selectors for the input
    let textarea = await page.$('textarea');
    if (!textarea) textarea = await page.$('[contenteditable="true"]');
    if (!textarea) textarea = await page.$('input[type="text"]');
    if (!textarea) {
      // Try waiting longer
      console.log('⏳ Textarea not found, waiting more...');
      textarea = await waitForSelector(page, 'textarea', 30000);
    }

    if (!textarea) {
      console.log('❌ No input found! Skipping...');
      continue;
    }

    console.log('✅ Found input, typing prompt...');
    await textarea.click();
    await delay(500);
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await delay(200);
    await page.keyboard.press('Backspace');
    await delay(200);
    await textarea.type(prompt, { delay: 3 });
    await delay(1000);

    // Submit
    let submitBtn = await page.$('button[aria-label="Submit"]');
    if (!submitBtn) {
      // Try find by text
      submitBtn = await page.evaluateHandle(() => {
        const btns = [...document.querySelectorAll('button')];
        return btns.find(b => b.getBoundingClientRect().width > 0 &&
          (b.getAttribute('aria-label') || '').toLowerCase().includes('submit')) ||
          btns.find(b => b.querySelector('svg') && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().width < 80);
      });
    }
    if (submitBtn && submitBtn.asElement()) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log('⏳ Waiting for image generation...');

    // Wait for URL change to /imagine/post/
    const start = Date.now();
    let generated = false;
    while (Date.now() - start < 180000) {
      const url = page.url();
      if (/\/imagine\/post\//.test(url) || /\/imagine\/[a-zA-Z0-9]/.test(url)) {
        generated = true;
        break;
      }
      await delay(3000);
    }

    if (!generated) {
      console.log('❌ Timeout waiting for generation');
      console.log('Current URL:', page.url());
      continue;
    }
    console.log('✅ Image generated at:', page.url());
    await delay(8000);

    // Download the image
    const imgSrc = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')];
      let best = null, bestSize = 0;
      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        const size = rect.width * rect.height;
        if (size > bestSize && img.src && !img.src.includes('avatar') && !img.src.includes('logo') && !img.src.includes('profile') && rect.width > 200) {
          best = img;
          bestSize = size;
        }
      }
      return best ? best.src : null;
    });

    if (imgSrc) {
      try {
        const response = await page.evaluate(async (url) => {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const reader = new FileReader();
          return new Promise(resolve => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }, imgSrc);

        const base64Data = response.replace(/^data:image\/\w+;base64,/, '');
        const ext = response.includes('png') ? 'png' : 'jpg';
        const filePath = path.join(outputDir, `${name}.${ext}`);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        console.log(`💾 Saved: ${filePath}`);
      } catch(e) {
        console.log('⚠️ Error saving image:', e.message);
      }
    } else {
      console.log('⚠️ No image src found on page');
    }

    await delay(3000);
  }

  console.log('\n🎉 Done! Check:', outputDir);
  await browser.close();
})();

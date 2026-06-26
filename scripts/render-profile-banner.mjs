import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const htmlPath = resolve('assets/profile-banner.html');
const outputPath = resolve('assets/profile-banner.png');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: {
    width: 1200,
    height: 300,
    deviceScaleFactor: 2,
  },
});

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });

const banner = page.locator('.banner');
await banner.screenshot({
  path: outputPath,
  omitBackground: true,
});

await browser.close();
console.log(`Rendered ${outputPath}`);

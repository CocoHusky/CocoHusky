import { chromium } from 'playwright';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const htmlPath = resolve('assets/profile-banner.html');
const pngPath = resolve('assets/profile-banner.png');
const staleSvgPath = resolve('assets/profile-banner.svg');
const readmePath = resolve('README.md');

for (const path of [pngPath, staleSvgPath]) {
  try {
    await unlink(path);
    console.log(`Removed existing generated asset: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const htmlUrl = pathToFileURL(htmlPath).href;
const cacheKey = `html-v009-${process.env.GITHUB_RUN_NUMBER || 'local'}`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: {
    width: 1200,
    height: 300,
    deviceScaleFactor: 2,
  },
});

await page.goto(htmlUrl, { waitUntil: 'networkidle' });

const banner = page.locator('.banner');
await banner.screenshot({
  path: pngPath,
  omitBackground: true,
});

await browser.close();

const readme = `<img src="./assets/profile-banner.png?v=${cacheKey}" alt="Alex Burton biomedical sensing systems banner" width="100%" />\n`;
await writeFile(readmePath, readme);

console.log(`Rendered real image: ${pngPath}`);
console.log(`Removed stale SVG path if present: ${staleSvgPath}`);
console.log(`Updated README.md with PNG cache key: ${cacheKey}`);

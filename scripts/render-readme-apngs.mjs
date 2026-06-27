import { mkdir, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-src');
const tmpDir = path.join(root, '.tmp-readme-apng-frames');
const ASSETS = ['hero-banner', 'active-projects-card', 'section-divider'];
const args = process.argv.slice(2);

const readArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const hasArg = (name) => args.includes(name);
const fail = (message) => { throw new Error(message); };

function selectedAssets() {
  const asset = readArg('--asset', 'all');
  if (asset === 'all') return ASSETS;
  if (!ASSETS.includes(asset)) fail(`Unknown asset "${asset}". Valid assets: ${ASSETS.join(', ')}`);
  return [asset];
}

function extractDimensions(name, html) {
  const width = html.match(/data-width=["'](\d+)["']/i)?.[1]
    ?? html.match(/\bwidth=["'](\d+)["']/i)?.[1];
  const height = html.match(/data-height=["'](\d+)["']/i)?.[1]
    ?? html.match(/\bheight=["'](\d+)["']/i)?.[1];

  if (!width || !height) {
    fail(`${name}.html must define data-width/data-height or width/height.`);
  }

  return { width: Number(width), height: Number(height) };
}

async function renderAssetApng(browser, name, outputDir, writeOutput) {
  const sourcePath = path.join(sourceDir, `${name}.html`);
  const html = await readFile(sourcePath, 'utf8');
  const { width, height } = extractDimensions(name, html);

  if (!writeOutput) {
    console.log(`Validated ${name}.html for ${width}x${height} APNG capture.`);
    return;
  }

  const assetFrameDir = path.join(tmpDir, name);
  await rm(assetFrameDir, { recursive: true, force: true });
  await mkdir(assetFrameDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  await page.goto(pathToFileURL(sourcePath).href, { waitUntil: 'load' });
  await page.setViewportSize({ width, height });

  const handle = await page.locator('[data-width][data-height], svg').first().elementHandle();
  if (!handle) fail(`${name}.html does not contain a capturable asset root.`);

  const frameCount = Number(readArg('--frames', '36'));
  const frameDelayMs = Number(readArg('--delay-ms', '60'));
  const fps = Number((1000 / frameDelayMs).toFixed(3));

  for (let frame = 0; frame < frameCount; frame += 1) {
    if (frame > 0) await page.waitForTimeout(frameDelayMs);
    const framePath = path.join(assetFrameDir, `frame-${String(frame).padStart(3, '0')}.png`);
    await handle.screenshot({ path: framePath, animations: 'allow' });
  }

  await page.close();

  const outputPath = path.join(outputDir, `${name}.png`);
  await rm(outputPath, { force: true });

  await execFileAsync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(assetFrameDir, 'frame-%03d.png'),
    '-plays', '0',
    '-f', 'apng',
    outputPath
  ], { maxBuffer: 1024 * 1024 * 16 });

  console.log(`Rendered ${name}.html -> ${outputPath}`);
}

async function main() {
  const outputDir = path.resolve(root, readArg('--out', 'assets'));
  const checkOnly = hasArg('--check');
  const cleanOutput = hasArg('--clean');
  const assets = selectedAssets();

  if (cleanOutput && !checkOnly) {
    await Promise.all(assets.map((asset) => rm(path.join(outputDir, `${asset}.png`), { force: true })));
  }

  if (checkOnly) {
    for (const asset of assets) {
      const html = await readFile(path.join(sourceDir, `${asset}.html`), 'utf8');
      const { width, height } = extractDimensions(asset, html);
      console.log(`Validated ${asset}.html for ${width}x${height} APNG capture.`);
    }
    return;
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const asset of assets) {
      await renderAssetApng(browser, asset, outputDir, true);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

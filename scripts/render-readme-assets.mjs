import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-src');
const defaultAssetDir = path.join(root, 'assets');

const GENERATED_HTML_ASSETS = ['hero-banner', 'active-projects-card', 'section-divider'];
const STALE_GENERATED_ASSETS = [
  'profile-card.svg',
  'profile-card.png',
  'github-stats-card.svg',
  'activity-card.svg',
  'cta-portfolio.svg',
  'cta-linkedin.svg',
  'cta-scholar.svg'
];

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const hasArg = (name) => args.includes(name);
const fail = (message) => { throw new Error(message); };

function selectedAssets() {
  const asset = readArg('--asset', 'all');
  if (asset === 'all') return GENERATED_HTML_ASSETS;
  if (!GENERATED_HTML_ASSETS.includes(asset)) {
    fail(`Unknown asset "${asset}". Valid assets: ${GENERATED_HTML_ASSETS.join(', ')}`);
  }
  return [asset];
}

function extractReadmeSvg(name, html) {
  if (new RegExp('<' + 'script[\\s>]', 'i').test(html)) {
    fail(`${name}.html includes inline script. README SVG assets must use SVG/CSS-native animation.`);
  }

  if (new RegExp('<' + 'canvas[\\s>]', 'i').test(html)) {
    fail(`${name}.html includes canvas. Translate canvas visuals into SVG elements and CSS/SVG animation.`);
  }

  const idMatch = html.match(/<svg\b(?=[^>]*\bid=["']readme-asset["'])[^>]*>[\s\S]*?<\/svg>/i);
  const firstSvgMatch = html.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i);
  const svg = idMatch?.[0] ?? firstSvgMatch?.[0];

  if (!svg) {
    fail(`${name}.html must contain an inline <svg id="readme-asset"> visual.`);
  }

  return svg.trim();
}

function validateSvg(name, svg) {
  if (!svg.startsWith('<svg')) fail(`${name}.svg did not render as SVG.`);
  if (!svg.includes('</svg>')) fail(`${name}.svg is missing the closing SVG tag.`);
  if (!/\bxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(svg)) {
    fail(`${name}.svg must include xmlns="http://www.w3.org/2000/svg".`);
  }
  if (!/\bwidth=["']\d+/.test(svg)) fail(`${name}.svg must define a numeric width.`);
  if (!/\bheight=["']\d+/.test(svg)) fail(`${name}.svg must define a numeric height.`);
  if (!/\bviewBox=["'][^"']+["']/i.test(svg)) fail(`${name}.svg must define a viewBox.`);
  if (new RegExp('<' + 'script[\\s>]', 'i').test(svg)) fail(`${name}.svg must not contain inline script.`);
  if (new RegExp('<' + 'canvas[\\s>]', 'i').test(svg)) fail(`${name}.svg must not contain canvas.`);

  if (name === 'hero-banner' && !svg.includes('@keyframes')) {
    fail(`${name}.svg must include SVG/CSS-native animation keyframes.`);
  }

  if (name === 'section-divider' && !svg.includes('divider-dot')) {
    fail(`${name}.svg must include the animated divider dot.`);
  }
}

async function cleanGeneratedAssets(outputDir, assets) {
  const currentGeneratedAssets = assets.map((asset) => `${asset}.svg`);
  const staleAssets = outputDir === defaultAssetDir ? STALE_GENERATED_ASSETS : [];
  await Promise.all([...staleAssets, ...currentGeneratedAssets].map((file) => rm(path.join(outputDir, file), { force: true })));
}

async function renderHtmlAsset(name, outputDir, writeOutput) {
  const html = await readFile(path.join(sourceDir, `${name}.html`), 'utf8');
  const svg = extractReadmeSvg(name, html);
  validateSvg(name, svg);

  if (writeOutput) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, `${name}.svg`), `${svg}\n`, 'utf8');
  }

  console.log(`${writeOutput ? 'Rendered' : 'Validated'} ${name}.html -> ${name}.svg (inline SVG source)`);
}

async function main() {
  const outputDir = path.resolve(root, readArg('--out', 'assets'));
  const checkOnly = hasArg('--check');
  const cleanOutput = hasArg('--clean');
  const assets = selectedAssets();

  if (cleanOutput && !checkOnly) {
    await cleanGeneratedAssets(outputDir, assets);
  }

  for (const asset of assets) {
    await renderHtmlAsset(asset, outputDir, !checkOnly);
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });

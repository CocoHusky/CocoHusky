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

function extractInlineSvg(html) {
  const idMatch = html.match(/<svg\b(?=[^>]*\bid=["']readme-asset["'])[^>]*>[\s\S]*?<\/svg>/i);
  const firstSvgMatch = html.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/i);
  return (idMatch?.[0] ?? firstSvgMatch?.[0] ?? '').trim();
}

function extractDimensions(name, html) {
  const width = html.match(/data-width=["'](\d+)["']/i)?.[1]
    ?? html.match(/\bwidth=["'](\d+)["']/i)?.[1];
  const height = html.match(/data-height=["'](\d+)["']/i)?.[1]
    ?? html.match(/\bheight=["'](\d+)["']/i)?.[1];

  if (!width || !height) {
    fail(`${name}.html must include data-width/data-height for legacy HTML or width/height for inline SVG.`);
  }

  return { width, height };
}

function extractBodyMarkup(html) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? html.trim();
}

function legacyHtmlToSvg(name, html) {
  const { width, height } = extractDimensions(name, html);
  const bodyMarkup = extractBodyMarkup(html);

  if (!bodyMarkup) {
    fail(`${name}.html did not contain renderable HTML.`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${name}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
${bodyMarkup}
    </div>
  </foreignObject>
</svg>`;
}

function renderSvgFromHtmlSource(name, html) {
  const inlineSvg = extractInlineSvg(html);
  if (inlineSvg) return inlineSvg;

  console.warn(`${name}.html is using legacy HTML-to-SVG wrapping. Convert to inline SVG later for full README animation support.`);
  return legacyHtmlToSvg(name, html);
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
}

async function cleanGeneratedAssets(outputDir, assets) {
  const currentGeneratedAssets = assets.map((asset) => `${asset}.svg`);
  const staleAssets = outputDir === defaultAssetDir ? STALE_GENERATED_ASSETS : [];
  await Promise.all([...staleAssets, ...currentGeneratedAssets].map((file) => rm(path.join(outputDir, file), { force: true })));
}

async function renderHtmlAsset(name, outputDir, writeOutput) {
  const html = await readFile(path.join(sourceDir, `${name}.html`), 'utf8');
  const svg = renderSvgFromHtmlSource(name, html);
  validateSvg(name, svg);

  if (writeOutput) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, `${name}.svg`), `${svg}\n`, 'utf8');
  }

  console.log(`${writeOutput ? 'Rendered' : 'Validated'} ${name}.html -> ${name}.svg`);
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

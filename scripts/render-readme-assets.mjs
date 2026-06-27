import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-src');
const defaultAssetDir = path.join(root, 'assets');

const GENERATED_HTML_ASSETS = ['hero-banner', 'active-projects-card', 'section-divider'];
const STALE_GENERATED_ASSETS = ['profile-card.svg', 'profile-card.png', 'github-stats-card.svg', 'activity-card.svg', 'cta-portfolio.svg', 'cta-linkedin.svg', 'cta-scholar.svg'];

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const hasArg = (name) => args.includes(name);
const fail = (message) => { throw new Error(message); };

function readDimension(html, name, fallback) {
  const dataMatch = html.match(new RegExp(`data-${name}="(\\d+)"`));
  if (dataMatch) return Number(dataMatch[1]);
  const cssMatch = html.match(new RegExp(`${name}:\\s*(\\d+)px`, 'i'));
  return cssMatch ? Number(cssMatch[1]) : fallback;
}

function readTitle(html, fallback) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
    || html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    || fallback;
}

function bodyMarkup(html) {
  const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((match) => match[0]).join('\n');
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? html.trim();
  return `${styles}\n${body}`.trim();
}

function validateHtml(name, html) {
  if (!html.includes('data-width="')) fail(`${name}.html must define data-width on the visual root.`);
  if (!html.includes('data-height="')) fail(`${name}.html must define data-height on the visual root.`);
  if (/<script[\s>]/i.test(html)) {
    fail(`${name}.html includes <script>, which cannot run reliably when the SVG is embedded in a GitHub README. Use declarative HTML/CSS/SVG animation instead.`);
  }
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function htmlToSvg(name, html, fallbackWidth = 1200, fallbackHeight = 320) {
  validateHtml(name, html);
  const width = readDimension(html, 'width', fallbackWidth);
  const height = readDimension(html, 'height', fallbackHeight);
  if (!Number.isFinite(width) || width <= 0) fail(`${name}.html has an invalid width.`);
  if (!Number.isFinite(height) || height <= 0) fail(`${name}.html has an invalid height.`);
  const title = escapeXml(readTitle(html, name));
  const markup = bodyMarkup(html);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">
<title id="title">${title}</title>
<foreignObject x="0" y="0" width="${width}" height="${height}">
  <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;">
${markup}
  </div>
</foreignObject>
</svg>`;
}

function validateSvg(name, svg) {
  if (!svg.startsWith('<svg ')) fail(`${name}.svg did not render as SVG.`);
  if (!svg.includes('<foreignObject')) fail(`${name}.svg must be direct HTML-driven SVG using foreignObject.`);
  if (!svg.includes('</svg>')) fail(`${name}.svg is missing the closing SVG tag.`);
  if (name === 'hero-banner' && !svg.includes('animation:')) fail(`${name}.svg must include the source HTML/CSS animation.`);
}

function selectedAssets() {
  const asset = readArg('--asset', 'all');
  if (asset === 'all') return GENERATED_HTML_ASSETS;
  if (!GENERATED_HTML_ASSETS.includes(asset)) fail(`Unknown asset "${asset}". Valid assets: ${GENERATED_HTML_ASSETS.join(', ')}`);
  return [asset];
}

async function renderHtmlAsset(name, outputDir, writeOutput) {
  const html = await readFile(path.join(sourceDir, `${name}.html`), 'utf8');
  const svg = htmlToSvg(name, html);
  validateSvg(name, svg);
  if (writeOutput) {
    await mkdir(outputDir, { recursive: true });
    await writeFile(path.join(outputDir, `${name}.svg`), `${svg}\n`, 'utf8');
  }
  console.log(`${writeOutput ? 'Rendered' : 'Validated'} ${name}.html -> ${name}.svg (HTML-driven foreignObject)`);
}

async function main() {
  const outputDir = path.resolve(root, readArg('--out', 'assets'));
  const checkOnly = hasArg('--check');
  const cleanOutput = hasArg('--clean');
  const assets = selectedAssets();
  if (cleanOutput && outputDir === defaultAssetDir) {
    const currentGeneratedAssets = assets.map((asset) => `${asset}.svg`);
    await Promise.all([...STALE_GENERATED_ASSETS, ...currentGeneratedAssets].map((file) => rm(path.join(outputDir, file), { force: true })));
  }
  await Promise.all(assets.map((asset) => renderHtmlAsset(asset, outputDir, !checkOnly)));
}

main().catch((error) => { console.error(error.message); process.exit(1); });

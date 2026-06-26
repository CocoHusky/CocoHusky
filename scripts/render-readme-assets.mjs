import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-src');
const defaultAssetDir = path.join(root, 'assets');

const GENERATED_HTML_ASSETS = ['hero-banner', 'active-projects-card', 'section-divider'];
const STALE_GENERATED_ASSETS = ['profile-card.svg', 'profile-card.png', 'github-stats-card.svg', 'activity-card.svg', 'cta-portfolio.svg', 'cta-linkedin.svg', 'cta-scholar.svg'];

const C = {
  bg0: '#010409', bg1: '#06101c', bg2: '#0d1117', text: '#f5f7fb', quiet: '#7e8a9b',
  orange: '#e8834a', orange2: '#ffb26d', green: '#22c55e'
};

const args = process.argv.slice(2);
const readArg = (name, fallback = null) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const hasArg = (name) => args.includes(name);
const fail = (message) => { throw new Error(message); };

function attr(fragment, name, fallback = '') {
  return fragment.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? fallback;
}

function readDimension(html, name, fallback) {
  const dataMatch = html.match(new RegExp(`data-${name}="(\\d+)"`));
  if (dataMatch) return Number(dataMatch[1]);
  const cssMatch = html.match(new RegExp(`${name}:\\s*(\\d+)px`, 'i'));
  return cssMatch ? Number(cssMatch[1]) : fallback;
}

function readRootAttr(html, name, fallback = '') {
  const rootOpen = html.match(/<(?:div|section)[^>]*class="[^"]*asset[^"]*"[^>]*>/i)?.[0] ?? '';
  return attr(rootOpen, name, fallback);
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function clean(value) {
  return String(value).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function firstTag(html, tag, className = null) {
  const classPattern = className ? `[^>]*class="[^"]*${className}[^"]*"[^>]*` : '[^>]*';
  const match = html.match(new RegExp(`<${tag}${classPattern}>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function validateHtml(name, html) {
  if (name === 'hero-banner') {
    if (!html.includes('class="hero-banner"')) fail('hero-banner.html must contain .hero-banner.');
    if (!html.includes('<canvas')) fail('hero-banner.html must contain the uploaded canvas background.');
    return;
  }
  if (!html.includes('class="asset')) fail(`${name}.html must have a root class containing "asset".`);
  if (!html.includes('data-width="')) fail(`${name}.html must define data-width.`);
  if (!html.includes('data-height="')) fail(`${name}.html must define data-height.`);
  if (/<script[\s>]/i.test(html)) fail(`${name}.html must not include script tags.`);
  if (/<svg[\s>]/i.test(html)) fail(`${name}.html must stay HTML-only; generated SVG belongs in assets/.`);
}

function svgShell(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.bg0}"/><stop offset="0.56" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
  <linearGradient id="dividerLine" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${C.orange}" stop-opacity="0.04"/><stop offset="0.5" stop-color="${C.orange2}" stop-opacity="1"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0.04"/></linearGradient>
  <filter id="orangeBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <style>.ui{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif}.sectionTitle{fill:${C.text};font-size:24px;font-weight:800}.subtle{fill:${C.quiet};font-size:12px;font-weight:700;letter-spacing:1.5px}.projectTitle{fill:${C.text};font-size:21px;font-weight:760}.summary{fill:${C.orange2};font-size:13.2px;font-weight:650}.bullet{fill:#d7dfec;font-size:14.2px}.card{fill:rgba(17,24,33,.78);stroke:rgba(232,131,74,.18);stroke-width:1}</style>
</defs>
${body}
</svg>`;
}

async function renderHeroWithBrowser(html, width, height) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    fail('hero-banner.html uses canvas/script. Install Playwright before rendering.');
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: width + 40, height: height + 40 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero-banner');
  await page.waitForTimeout(900);
  const png = await page.locator('.hero-banner').first().screenshot({ type: 'png' });
  await browser.close();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <image href="data:image/png;base64,${png.toString('base64')}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
}

function activeProjectsToSvg(html, width, height) {
  const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? '';
  const headerTitle = firstTag(header, 'h2') || 'Active Projects';
  const headerSub = firstTag(header, 'p');
  const projects = [...html.matchAll(/<article([^>]*)>([\s\S]*?)<\/article>/gi)].map((match) => {
    const attrs = match[1];
    const body = match[2];
    return {
      status: attr(attrs, 'data-status', firstTag(body, 'span', 'status') || 'ACTIVE'),
      dot: attr(attrs, 'data-dot', 'green') === 'orange' ? C.orange : C.green,
      title: firstTag(body, 'h3'),
      summary: firstTag(body, 'p', 'summary'),
      lines: [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => clean(li[1]))
    };
  });
  const card = (project, index) => {
    const x = 36 + index * 389;
    return `<g transform="translate(${x} 96)"><rect width="350" height="300" rx="18" class="card"/><circle cx="28" cy="30" r="5" fill="${project.dot}"/><text x="46" y="35" class="ui subtle">${escapeXml(project.status)}</text><text x="24" y="74" class="ui projectTitle">${escapeXml(project.title)}</text><text x="24" y="108" class="ui summary">${escapeXml(project.summary)}</text>${project.lines.map((line, i) => `<text x="24" y="${152 + i * 30}" class="ui bullet"><tspan fill="${C.orange2}">•</tspan><tspan dx="8">${escapeXml(line)}</tspan></text>`).join('')}</g>`;
  };
  return svgShell(width, height, `<rect width="${width}" height="${height}" rx="22" fill="url(#bg)"/><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="22" fill="none" stroke="rgba(232,131,74,.16)"/><g class="ui"><text x="36" y="54" class="sectionTitle">${escapeXml(headerTitle)}</text><text x="36" y="80" class="subtle">${escapeXml(headerSub)}</text></g>${projects.map(card).join('')}`);
}

function sectionDividerToSvg(html, width, height) {
  const duration = readRootAttr(html, 'data-duration', '22s');
  const centerY = Math.round(height / 2);
  const left = 64;
  const right = width - 64;
  const mid = Math.round(width / 2);
  return svgShell(width, height, `<rect width="${width}" height="${height}" fill="transparent"/><rect x="${left}" y="${centerY - 1}" width="${right - left}" height="2" rx="1" fill="url(#dividerLine)" filter="url(#softGlow)"/><circle cx="${left}" cy="${centerY}" r="2.2" fill="${C.orange}" filter="url(#orangeBlur)" opacity="0.35"><animate attributeName="cx" values="${left};${mid};${right};${mid};${left}" dur="${duration}" repeatCount="indefinite"/><animate attributeName="r" values="2.1;4.2;2.1;4.2;2.1" dur="${duration}" repeatCount="indefinite"/><animate attributeName="opacity" values="0.20;0.95;0.20;0.95;0.20" dur="${duration}" repeatCount="indefinite"/></circle>`);
}

async function htmlToSvg(name, html, fallbackWidth = 1200, fallbackHeight = 320) {
  validateHtml(name, html);
  const width = readDimension(html, 'width', fallbackWidth);
  const height = readDimension(html, 'height', fallbackHeight);
  if (!Number.isFinite(width) || width <= 0) fail(`${name}.html has an invalid width.`);
  if (!Number.isFinite(height) || height <= 0) fail(`${name}.html has an invalid height.`);
  if (name === 'hero-banner') return renderHeroWithBrowser(html, width, height);
  if (name === 'active-projects-card') return activeProjectsToSvg(html, width, height);
  if (name === 'section-divider') return sectionDividerToSvg(html, width, height);
  fail(`No renderer exists for ${name}.`);
}

function validateSvg(name, svg) {
  if (!svg.startsWith('<svg ')) fail(`${name}.svg did not render as SVG.`);
  if (svg.includes('<foreignObject')) fail(`${name}.svg must not use foreignObject.`);
  if (!svg.includes('</svg>')) fail(`${name}.svg is missing the closing SVG tag.`);
  if (name === 'hero-banner' && !svg.includes('<image ')) fail(`${name}.svg must include the browser-rendered hero image.`);
  if (name === 'active-projects-card' && !svg.includes('<text ')) fail(`${name}.svg is missing rendered text.`);
}

function selectedAssets() {
  const asset = readArg('--asset', 'all');
  if (asset === 'all') return GENERATED_HTML_ASSETS;
  if (!GENERATED_HTML_ASSETS.includes(asset)) fail(`Unknown asset "${asset}". Valid assets: ${GENERATED_HTML_ASSETS.join(', ')}`);
  return [asset];
}

async function renderHtmlAsset(name, outputDir, writeOutput) {
  const html = await readFile(path.join(sourceDir, `${name}.html`), 'utf8');
  const svg = await htmlToSvg(name, html);
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
  if (cleanOutput && outputDir === defaultAssetDir) await Promise.all(STALE_GENERATED_ASSETS.map((file) => rm(path.join(outputDir, file), { force: true })));
  await Promise.all(assets.map((asset) => renderHtmlAsset(asset, outputDir, !checkOnly)));
}

main().catch((error) => { console.error(error.message); process.exit(1); });

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-src');
const defaultAssetDir = path.join(root, 'assets');

const GENERATED_HTML_ASSETS = [
  'hero-banner',
  'active-projects-card',
  'section-divider'
];

const STALE_GENERATED_ASSETS = [
  'profile-card.svg',
  'profile-card.png',
  'github-stats-card.svg',
  'activity-card.svg',
  'cta-portfolio.svg',
  'cta-linkedin.svg',
  'cta-scholar.svg'
];

const C = {
  bg0: '#010409',
  bg1: '#06101c',
  bg2: '#0d1117',
  text: '#f5f7fb',
  muted: '#b6c2d4',
  quiet: '#7e8a9b',
  orange: '#e8834a',
  orange2: '#ffb26d',
  blue: '#4c8dff',
  cyan: '#6fd3ff',
  green: '#22c55e'
};

const args = process.argv.slice(2);

function readArg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function hasArg(name) {
  return args.includes(name);
}

function fail(message) {
  throw new Error(message);
}

function readDimension(html, name, fallback) {
  const match = html.match(new RegExp(`data-${name}="(\\d+)"`));
  return match ? Number(match[1]) : fallback;
}

function readRootAttr(html, name, fallback = '') {
  const rootOpen = html.match(/<(?:div|section)[^>]*class="[^"]*asset[^"]*"[^>]*>/i)?.[0] ?? '';
  return attr(rootOpen, name, fallback);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function clean(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(fragment, name, fallback = '') {
  return fragment.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? fallback;
}

function numAttr(fragment, name, fallback = 0) {
  const value = Number(attr(fragment, name, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function firstTag(html, tag, className = null) {
  const classPattern = className ? `[^>]*class="[^"]*${className}[^"]*"[^>]*` : '[^>]*';
  const match = html.match(new RegExp(`<${tag}${classPattern}>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return match ? clean(match[1]) : '';
}

function spanLines(fragment) {
  const spans = [...fragment.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => clean(match[1]))
    .filter(Boolean);
  return spans.length ? spans : [clean(fragment)].filter(Boolean);
}

function validateHtml(name, html) {
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
  <radialGradient id="blueGlow" cx="82%" cy="28%" r="38%"><stop stop-color="${C.blue}" stop-opacity="0.16"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <radialGradient id="orangeGlow" cx="10%" cy="96%" r="42%"><stop stop-color="${C.orange}" stop-opacity="0.10"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
  <filter id="orangeBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <style>.ui{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif}.heroTitle{fill:${C.text};font-size:54px;font-weight:820;letter-spacing:-2.3px}.eyebrow{fill:${C.orange2};font-size:13px;font-weight:800;letter-spacing:3px}.body{fill:${C.muted};font-size:19px}.sectionTitle{fill:${C.text};font-size:24px;font-weight:800}.subtle{fill:${C.quiet};font-size:12px;font-weight:700;letter-spacing:1.5px}.projectTitle{fill:${C.text};font-size:21px;font-weight:760}.summary{fill:${C.orange2};font-size:13.2px;font-weight:650}.bullet{fill:#d7dfec;font-size:14.2px}.card{fill:rgba(17,24,33,.78);stroke:rgba(232,131,74,.18);stroke-width:1}.networkLine{stroke:${C.cyan};stroke-width:1;stroke-linecap:round}.networkNode{fill:${C.orange};filter:url(#orangeBlur)}</style>
</defs>
${body}
</svg>`;
}

function parseNetworkNodes(html) {
  return [...html.matchAll(/<span([^>]*)class="[^"]*network-node[^"]*"([^>]*)><\/span>/gi)].map((match) => {
    const attrs = `${match[1]} ${match[2]}`;
    return {
      x: numAttr(attrs, 'data-x'),
      y: numAttr(attrs, 'data-y'),
      dx: numAttr(attrs, 'data-dx', 0),
      dy: numAttr(attrs, 'data-dy', 0),
      duration: attr(attrs, 'data-duration', '44s')
    };
  });
}

function parseNetworkLinks(html) {
  return [...html.matchAll(/<span([^>]*)class="[^"]*network-link[^"]*"([^>]*)><\/span>/gi)].map((match) => {
    const attrs = `${match[1]} ${match[2]}`;
    return {
      from: numAttr(attrs, 'data-from'),
      to: numAttr(attrs, 'data-to'),
      delay: attr(attrs, 'data-delay', '0s'),
      duration: attr(attrs, 'data-duration', '16s')
    };
  });
}

function heroToSvg(html, width, height) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';
  const body = html.match(/<p[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
  const titleLines = spanLines(h1);
  const bodyLines = spanLines(body);
  const eyebrow = firstTag(html, 'p', 'eyebrow');
  const orbitDuration = readRootAttr(html, 'data-orbit-duration', '64s');
  const nodes = parseNetworkNodes(html);
  const links = parseNetworkLinks(html);

  const networkLines = links.map((link, index) => {
    const a = nodes[link.from];
    const b = nodes[link.to];
    if (!a || !b) return '';
    return `<line class="networkLine" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" opacity="0.08"><animate attributeName="opacity" values="0.04;0.38;0.08;0.32;0.04" dur="${link.duration}" begin="${link.delay}" repeatCount="indefinite"/></line>`;
  }).join('\n');

  const networkNodes = nodes.map((node, index) => `<circle class="networkNode" cx="${node.x}" cy="${node.y}" r="3.2" opacity="0.85">
  <animate attributeName="cx" values="${node.x};${node.x + node.dx};${node.x - node.dx * 0.45};${node.x}" dur="${node.duration}" repeatCount="indefinite"/>
  <animate attributeName="cy" values="${node.y};${node.y + node.dy};${node.y - node.dy * 0.45};${node.y}" dur="${node.duration}" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.45;0.9;0.62;0.85;0.45" dur="${index % 2 ? '19s' : '23s'}" repeatCount="indefinite"/>
</circle>`).join('\n');

  return svgShell(width, height, `<rect width="${width}" height="${height}" rx="22" fill="url(#bg)"/>
<rect width="${width}" height="${height}" rx="22" fill="url(#blueGlow)"/>
<rect width="${width}" height="${height}" rx="22" fill="url(#orangeGlow)"/>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="22" fill="none" stroke="rgba(232,131,74,.16)"/>
<g opacity="0.22">${Array.from({ length: Math.ceil(width / 52) + 1 }, (_, i) => `<path d="M${i * 52} 0V${height}" stroke="${C.cyan}" opacity=".08"/>`).join('')}${Array.from({ length: Math.ceil(height / 52) + 1 }, (_, i) => `<path d="M0 ${i * 52}H${width}" stroke="${C.cyan}" opacity=".08"/>`).join('')}</g>
<g opacity="0.78">
  <g transform="translate(770 62)">
    <g transform="rotate(-18 195 130)">
      <ellipse cx="195" cy="130" rx="195" ry="130" fill="none" stroke="rgba(76,141,255,.28)" stroke-width="1.4"/>
      <animateTransform attributeName="transform" type="rotate" values="-18 195 130;-5 195 130;-18 195 130;-31 195 130;-18 195 130" dur="${orbitDuration}" repeatCount="indefinite"/>
    </g>
    <g transform="rotate(20 195 130)">
      <ellipse cx="195" cy="130" rx="152" ry="96" fill="none" stroke="rgba(111,211,255,.22)"/>
      <animateTransform attributeName="transform" type="rotate" values="20 195 130;35 195 130;20 195 130;8 195 130;20 195 130" dur="78s" repeatCount="indefinite"/>
    </g>
    <g transform="rotate(-38 195 130)">
      <ellipse cx="195" cy="130" rx="220" ry="70" fill="none" stroke="rgba(232,131,74,.30)"/>
      <animateTransform attributeName="transform" type="rotate" values="-38 195 130;-24 195 130;-38 195 130;-51 195 130;-38 195 130" dur="92s" repeatCount="indefinite"/>
    </g>
  </g>
</g>
<g>${networkLines}\n${networkNodes}</g>
<g class="ui">
  <text x="44" y="78" class="eyebrow">${escapeXml(eyebrow)}</text>
  <text x="44" y="152" class="heroTitle">${titleLines.map((line, index) => `<tspan x="44"${index ? ' dy="60"' : ''}>${escapeXml(line)}</tspan>`).join('')}</text>
  <text x="44" y="300" class="body">${bodyLines.map((line, index) => `<tspan x="44"${index ? ' dy="30"' : ''}>${escapeXml(line)}</tspan>`).join('')}</text>
</g>`);
}

function activeProjectsToSvg(html, width, height) {
  const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? '';
  const headerTitle = firstTag(header, 'h2') || 'Active Projects';
  const headerSub = firstTag(header, 'p');
  const projects = [...html.matchAll(/<article([^>]*)>([\s\S]*?)<\/article>/gi)].map((match) => {
    const attrs = match[1];
    const body = match[2];
    const dot = attr(attrs, 'data-dot', 'green') === 'orange' ? C.orange : C.green;
    return {
      status: attr(attrs, 'data-status', firstTag(body, 'span', 'status') || 'ACTIVE'),
      dot,
      title: firstTag(body, 'h3'),
      summary: firstTag(body, 'p', 'summary'),
      lines: [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((li) => clean(li[1]))
    };
  });

  const card = (project, index) => {
    const x = 36 + index * 389;
    return `<g transform="translate(${x} 96)">
  <rect width="350" height="300" rx="18" class="card"/>
  <circle cx="28" cy="30" r="5" fill="${project.dot}"/>
  <text x="46" y="35" class="ui subtle">${escapeXml(project.status)}</text>
  <text x="24" y="74" class="ui projectTitle">${escapeXml(project.title)}</text>
  <text x="24" y="108" class="ui summary">${escapeXml(project.summary)}</text>
  ${project.lines.map((line, i) => `<text x="24" y="${152 + i * 30}" class="ui bullet"><tspan fill="${C.orange2}">•</tspan><tspan dx="8">${escapeXml(line)}</tspan></text>`).join('\n  ')}
</g>`;
  };

  return svgShell(width, height, `<rect width="${width}" height="${height}" rx="22" fill="url(#bg)"/>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="22" fill="none" stroke="rgba(232,131,74,.16)"/>
<g class="ui">
  <text x="36" y="54" class="sectionTitle">${escapeXml(headerTitle)}</text>
  <text x="36" y="80" class="subtle">${escapeXml(headerSub)}</text>
</g>
${projects.map(card).join('\n')}`);
}

function sectionDividerToSvg(html, width, height) {
  const duration = readRootAttr(html, 'data-duration', '22s');
  const centerY = Math.round(height / 2);
  const left = 64;
  const right = width - 64;
  const mid = Math.round(width / 2);
  return svgShell(width, height, `<rect width="${width}" height="${height}" fill="transparent"/>
<rect x="${left}" y="${centerY - 1}" width="${right - left}" height="2" rx="1" fill="url(#dividerLine)" filter="url(#softGlow)"/>
<circle cx="${left}" cy="${centerY}" r="2.2" fill="${C.orange}" filter="url(#orangeBlur)" opacity="0.35">
  <animate attributeName="cx" values="${left};${mid};${right};${mid};${left}" dur="${duration}" repeatCount="indefinite"/>
  <animate attributeName="r" values="2.1;4.2;2.1;4.2;2.1" dur="${duration}" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="0.20;0.95;0.20;0.95;0.20" dur="${duration}" repeatCount="indefinite"/>
</circle>`);
}

function htmlToSvg(name, html, fallbackWidth = 1200, fallbackHeight = 320) {
  validateHtml(name, html);

  const width = readDimension(html, 'width', fallbackWidth);
  const height = readDimension(html, 'height', fallbackHeight);

  if (!Number.isFinite(width) || width <= 0) fail(`${name}.html has an invalid data-width.`);
  if (!Number.isFinite(height) || height <= 0) fail(`${name}.html has an invalid data-height.`);

  if (name === 'hero-banner') return heroToSvg(html, width, height);
  if (name === 'active-projects-card') return activeProjectsToSvg(html, width, height);
  if (name === 'section-divider') return sectionDividerToSvg(html, width, height);
  fail(`No renderer exists for ${name}.`);
}

function validateSvg(name, svg) {
  if (!svg.startsWith('<svg ')) fail(`${name}.svg did not render as SVG.`);
  if (svg.includes('<foreignObject')) fail(`${name}.svg must be pure SVG, not foreignObject HTML.`);
  if (!svg.includes('</svg>')) fail(`${name}.svg is missing the closing SVG tag.`);
  if (name !== 'section-divider' && !svg.includes('<text ')) fail(`${name}.svg is missing rendered text.`);
}

function selectedAssets() {
  const asset = readArg('--asset', 'all');
  if (asset === 'all') return GENERATED_HTML_ASSETS;
  if (!GENERATED_HTML_ASSETS.includes(asset)) {
    fail(`Unknown asset "${asset}". Valid assets: ${GENERATED_HTML_ASSETS.join(', ')}`);
  }
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

  console.log(`${writeOutput ? 'Rendered' : 'Validated'} ${name}.html -> ${name}.svg`);
}

async function removeStaleAssets(outputDir) {
  await Promise.all(STALE_GENERATED_ASSETS.map((file) => rm(path.join(outputDir, file), { force: true })));
}

async function main() {
  const outputDir = path.resolve(root, readArg('--out', 'assets'));
  const checkOnly = hasArg('--check');
  const cleanOutput = hasArg('--clean');
  const assets = selectedAssets();

  if (cleanOutput && outputDir === defaultAssetDir) {
    await removeStaleAssets(outputDir);
  }

  await Promise.all(assets.map((asset) => renderHtmlAsset(asset, outputDir, !checkOnly)));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

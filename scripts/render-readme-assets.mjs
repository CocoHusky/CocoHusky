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

function tagLines(html, tag, className = null) {
  const classPattern = className ? `[^>]*class="[^"]*${className}[^"]*"[^>]*` : '[^>]*';
  const match = html.match(new RegExp(`<${tag}${classPattern}>([\\s\\S]*?)<\/${tag}>`, 'i'));
  if (!match) return [];
  const spans = [...match[1].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map((span) => clean(span[1])).filter(Boolean);
  return spans.length ? spans : [clean(match[1])].filter(Boolean);
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

function seededRandomFactory(seed = 1027) {
  return () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function buildOriginalHeroNodes() {
  const random = seededRandomFactory();
  return Array.from({ length: 38 }, (_, i) => ({
    bx: random(),
    by: random(),
    r1: 30 + random() * 90,
    r2: 15 + random() * 50,
    s1: (random() * 0.0004 + 0.0001) * (random() < 0.5 ? 1 : -1),
    s2: (random() * 0.0007 + 0.0002) * (random() < 0.5 ? 1 : -1),
    a1: random() * Math.PI * 2,
    a2: random() * Math.PI * 2,
    dx: (random() - 0.5) * 0.04,
    dy: (random() - 0.5) * 0.04,
    isAccent: i % 9 === 0,
    size: i % 9 === 0 ? 2.5 : 1.2 + random() * 1.6,
    pulse: random() * Math.PI * 2,
    pulseSpeed: 0.008 + random() * 0.012
  }));
}

function originalNodePosition(node, tMs, width, height) {
  const frameEstimate = tMs / (1000 / 60);
  const bx = wrap01(node.bx + node.dx * 0.0005 * frameEstimate);
  const by = wrap01(node.by + node.dy * 0.0005 * frameEstimate);
  const xBase = width * (0.52 + bx * 0.48);
  const yBase = height * (0.05 + by * 0.90);
  const a1 = node.a1 + node.s1 * tMs;
  const a2 = node.a2 + node.s2 * tMs;
  const pulse = node.pulse + node.pulseSpeed * frameEstimate;
  const p = 0.7 + 0.3 * Math.sin(pulse);
  return {
    x: xBase + Math.cos(a1) * node.r1 + Math.cos(a2) * node.r2,
    y: yBase + Math.sin(a1) * node.r1 * 0.6 + Math.sin(a2) * node.r2 * 0.7,
    coreR: node.size * p,
    glowR: node.size * p * 4,
    opacity: node.isAccent ? 0.9 : 0.8,
    color: node.isAccent ? C.orange : '#3b82f6'
  };
}

function svgValues(values, precision = 1) {
  return values.map((value) => Number(value).toFixed(precision)).join(';');
}

function edgeOpacity(distance) {
  if (distance > 180) return 0;
  return Math.pow(1 - distance / 180, 1.6) * 0.55;
}

function animatedHeroNetwork(width, height) {
  const nodes = buildOriginalHeroNodes();
  const duration = 26;
  const sampleCount = 18;
  const times = Array.from({ length: sampleCount }, (_, i) => (i / (sampleCount - 1)) * duration * 1000);
  const positions = nodes.map((node) => times.map((time) => originalNodePosition(node, time, width, height)));
  const nodeSvg = nodes.map((node, i) => {
    const pos = positions[i];
    const coreOpacity = node.isAccent ? 0.9 : 0.78;
    return `<g>
  <circle fill="${node.isAccent ? C.orange : '#3b82f6'}" opacity="0.18">
    <animate attributeName="cx" values="${svgValues(pos.map((p) => p.x))}" dur="${duration}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${svgValues(pos.map((p) => p.y))}" dur="${duration}s" repeatCount="indefinite"/>
    <animate attributeName="r" values="${svgValues(pos.map((p) => p.glowR))}" dur="${duration}s" repeatCount="indefinite"/>
  </circle>
  <circle fill="${node.isAccent ? C.orange : '#3b82f6'}" opacity="${coreOpacity}">
    <animate attributeName="cx" values="${svgValues(pos.map((p) => p.x))}" dur="${duration}s" repeatCount="indefinite"/>
    <animate attributeName="cy" values="${svgValues(pos.map((p) => p.y))}" dur="${duration}s" repeatCount="indefinite"/>
    <animate attributeName="r" values="${svgValues(pos.map((p) => p.coreR))}" dur="${duration}s" repeatCount="indefinite"/>
  </circle>
</g>`;
  }).join('\n');

  const edgeCandidates = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const opacitySamples = times.map((_, k) => Math.hypot(positions[i][k].x - positions[j][k].x, positions[i][k].y - positions[j][k].y)).map(edgeOpacity);
      const maxOpacity = Math.max(...opacitySamples);
      if (maxOpacity > 0.04) edgeCandidates.push({ i, j, maxOpacity, opacitySamples });
    }
  }

  const edgeSvg = edgeCandidates
    .sort((a, b) => b.maxOpacity - a.maxOpacity)
    .slice(0, 72)
    .map(({ i, j, opacitySamples }) => {
      const a = positions[i];
      const b = positions[j];
      const hot = nodes[i].isAccent || nodes[j].isAccent;
      return `<line stroke="${hot ? C.orange : '#3b82f6'}" stroke-width="${hot ? 0.8 : 0.5}" stroke-linecap="round">
  <animate attributeName="x1" values="${svgValues(a.map((p) => p.x))}" dur="${duration}s" repeatCount="indefinite"/>
  <animate attributeName="y1" values="${svgValues(a.map((p) => p.y))}" dur="${duration}s" repeatCount="indefinite"/>
  <animate attributeName="x2" values="${svgValues(b.map((p) => p.x))}" dur="${duration}s" repeatCount="indefinite"/>
  <animate attributeName="y2" values="${svgValues(b.map((p) => p.y))}" dur="${duration}s" repeatCount="indefinite"/>
  <animate attributeName="opacity" values="${svgValues(opacitySamples, 2)}" dur="${duration}s" repeatCount="indefinite"/>
</line>`;
    }).join('\n');

  return `${edgeSvg}\n${nodeSvg}`;
}

async function renderHeroWithBrowser(html, width, height) {
  const radius = 22;
  const eyebrow = firstTag(html, 'p', 'eyebrow') || 'BIOMEDICAL ENGINEERING FULL STACK';
  const titleLines = tagLines(html, 'h1').slice(0, 2);
  const bodyLines = tagLines(html, 'p', 'body').slice(0, 2);
  const networkSvg = animatedHeroNetwork(width, height);
  const titleSvg = titleLines.map((line, i) => `<text x="44" y="${96 + i * 48}" class="heroTitle">${escapeXml(line)}</text>`).join('');
  const bodySvg = bodyLines.map((line, i) => `<text x="44" y="${238 + i * 25}" class="heroBody">${escapeXml(line)}</text>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
<defs>
  <clipPath id="heroClip"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></clipPath>
  <linearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.bg0}"/><stop offset="0.58" stop-color="${C.bg1}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
  <radialGradient id="blueGlow"><stop stop-color="#3b82f6" stop-opacity="0.15"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
  <radialGradient id="orangeGlow"><stop stop-color="${C.orange}" stop-opacity="0.11"/><stop offset="1" stop-color="${C.orange}" stop-opacity="0"/></radialGradient>
  <linearGradient id="textShade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#010409" stop-opacity="0.98"/><stop offset="0.58" stop-color="#010409" stop-opacity="0.86"/><stop offset="1" stop-color="#010409" stop-opacity="0"/></linearGradient>
  <linearGradient id="accentLine" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${C.orange}" stop-opacity="0"/><stop offset="0.3" stop-color="${C.orange}" stop-opacity="0.55"/><stop offset="0.7" stop-color="#3b82f6" stop-opacity="0.55"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></linearGradient>
  <style>.heroUi{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif}.heroEyebrow{fill:${C.orange2};font-size:12px;font-weight:800;letter-spacing:3px}.heroTitle{fill:${C.text};font-size:43px;font-weight:820;letter-spacing:-1.8px}.heroBody{fill:#b6c2d4;font-size:16px;font-weight:450}</style>
</defs>
<g clip-path="url(#heroClip)">
  <rect width="${width}" height="${height}" fill="url(#heroBg)"/>
  <circle cx="${width - 85}" cy="40" r="240" fill="url(#blueGlow)"/>
  <circle cx="120" cy="${height + 40}" r="190" fill="url(#orangeGlow)"/>
  <g opacity="0.86">${networkSvg}</g>
  <rect width="${Math.round(width * 0.62)}" height="${height}" fill="url(#textShade)"/>
  <rect x="24" y="44" width="2" height="248" rx="1" fill="url(#accentLine)"/>
  <g class="heroUi"><text x="44" y="52" class="heroEyebrow">${escapeXml(eyebrow)}</text>${titleSvg}${bodySvg}</g>
  <image x="0" y="0" width="1" height="1" opacity="0"/>
</g>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${radius}" ry="${radius}" fill="none" stroke="rgba(232,131,74,.16)"/>
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
  if (name === 'hero-banner' && !svg.includes('<animate')) fail(`${name}.svg must include native SVG animation.`);
  if (name === 'hero-banner' && !svg.includes('clip-path="url(#heroClip)"')) fail(`${name}.svg must clip content to rounded corners.`);
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

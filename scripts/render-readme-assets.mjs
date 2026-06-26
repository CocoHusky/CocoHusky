import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'assets');
const svgPath = path.join(outputDir, 'profile-card.svg');
const archivedPngPath = path.join(outputDir, 'profile-card.png');

const WIDTH = 1200;
const HEIGHT = 1660;
const USERNAME = 'CocoHusky';

const colors = {
  navy: '#010409', navy2: '#06101c', navy3: '#0d1117', panel: '#0d1117', border: '#2a3a4d',
  blue: '#4c8dff', cyan: '#6fd3ff', orange: '#e8834a', orange2: '#ffae72',
  green: '#22c55e', text: '#f4f7fb', text2: '#aab8cc', text3: '#738198'
};

const fallbackStats = {
  stars: 6, commits: 367, yearCommits: 364, prs: 45, issues: 0,
  languages: [
    { name: 'HTML', value: 23, color: '#e34c26' },
    { name: 'C', value: 21, color: '#555555' },
    { name: 'JavaScript', value: 16, color: '#f1e05a' },
    { name: 'C++', value: 14, color: '#f34b7d' },
    { name: 'TypeScript', value: 11, color: '#3178c6' },
    { name: 'Other', value: 15, color: '#6e7681' }
  ]
};

const projects = [
  ['active', '60 GHz mmWave radar sensor system', 'ESP32-C6 · live dashboard · WiFi provisioning · sensor testing'],
  ['active', 'Proxmox homelab and self-hosted stack', 'TrueNAS · Nextcloud · Immich · containers · virtual machines'],
  ['wip', 'Portfolio rebuild and GitHub profile system', 'Astro · GitHub Pages · animated README SVG']
];

const tech = [
  ['TypeScript', 'hot'], ['JavaScript', 'hot'], ['Python', 'blue'], ['C++', 'blue'], ['C', 'blue'], ['JSON', ''],
  ['Git', ''], ['GitHub', ''], ['Docker', ''], ['SQL', ''], ['Proxmox', ''], ['TrueNAS', ''],
  ['Containers', ''], ['Virtual Machines', ''], ['Networking', ''], ['Embedded C', ''], ['BLE / NFC', ''], ['PCB Bring-up', '']
];

const languageColors = { Python: '#3572a5', JavaScript: '#f1e05a', TypeScript: '#3178c6', 'C++': '#f34b7d', C: '#555555', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Dockerfile: '#384d54', Other: '#6e7681' };

function esc(value = '') { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function compactNumber(value) { const n = Number(value ?? 0); return Number.isFinite(n) ? (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)) : '0'; }
function wrap(value, max = 55, maxLines = 3) { const words = String(value).split(/\s+/).filter(Boolean); const lines = []; let line = ''; for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > max && line) { lines.push(line); line = word; } else line = next; } if (line) lines.push(line); return lines.slice(0, maxLines); }
function text(x, y, body, cls, attrs = '') { return `<text x="${x}" y="${y}" class="${cls}"${attrs}>${esc(body)}</text>`; }
function multiText(x, y, lines, cls, lineHeight = 24, attrs = '') { return `<text x="${x}" y="${y}" class="${cls}"${attrs}>${lines.map((line, i) => `<tspan x="${x}"${attrs.includes('text-anchor') ? ` text-anchor="middle"` : ''}${i ? ` dy="${lineHeight}"` : ''}>${esc(line)}</tspan>`).join('')}</text>`; }

async function githubJson(url, fallback = null) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.warn(`GitHub API fallback for ${url}: ${error.message}`);
    return fallback;
  }
}

async function searchCount(endpoint, query, fallback = 0) {
  const data = await githubJson(`https://api.github.com/search/${endpoint}?q=${encodeURIComponent(query)}&per_page=1`, { total_count: fallback });
  return data?.total_count ?? fallback;
}

async function collectStats() {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const repos = await githubJson(`https://api.github.com/users/${USERNAME}/repos?per_page=100&type=owner&sort=updated`, []);
  if (!Array.isArray(repos) || repos.length === 0) return fallbackStats;

  const ownedRepos = repos.filter((repo) => !repo.fork);
  const stars = ownedRepos.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0);
  const [commits, yearCommits, prs, issues] = await Promise.all([
    searchCount('commits', `author:${USERNAME}`, fallbackStats.commits),
    searchCount('commits', `author:${USERNAME} committer-date:>=${since}`, fallbackStats.yearCommits),
    searchCount('issues', `author:${USERNAME} type:pr`, fallbackStats.prs),
    searchCount('issues', `author:${USERNAME} type:issue`, fallbackStats.issues)
  ]);

  const languageTotals = new Map();
  for (const repo of ownedRepos.slice(0, 35)) {
    const langs = await githubJson(repo.languages_url, {});
    for (const [name, bytes] of Object.entries(langs ?? {})) languageTotals.set(name, (languageTotals.get(name) ?? 0) + bytes);
  }

  const totalBytes = [...languageTotals.values()].reduce((sum, value) => sum + value, 0);
  if (!totalBytes) return { stars, commits, yearCommits, prs, issues, languages: fallbackStats.languages };
  const top = [...languageTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topBytes = top.reduce((sum, [, bytes]) => sum + bytes, 0);
  const languages = top.map(([name, bytes]) => ({ name, value: Math.round((bytes / totalBytes) * 100), color: languageColors[name] ?? languageColors.Other }));
  languages.push({ name: 'Other', value: Math.max(0, Math.round(((totalBytes - topBytes) / totalBytes) * 100)), color: languageColors.Other });
  return { stars, commits, yearCommits, prs, issues, languages };
}

function icon(kind, x, y) {
  const paths = {
    active: '<path d="M4 12h4l2-7 4 14 2-7h4"/><path d="M3 20h18"/>',
    about: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/>',
    stack: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    stats: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 17v-5"/><path d="M12 17V8"/><path d="M16 17v-7"/>',
    connect: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>'
  };
  return `<g transform="translate(${x} ${y})" class="icon" fill="none" stroke="currentColor" stroke-width="2">${paths[kind]}</g>`;
}
function heading(label, kind, y) { return `<g>${icon(kind, 470, y - 22)}${text(506, y, label, 'heading')}</g>`; }
function projectCard(project, x, y) { const [status, title, subtitle] = project; const dot = status === 'active' ? colors.green : colors.orange; return `<g transform="translate(${x} ${y})"><rect width="350" height="158" rx="16" class="panel"/><circle cx="28" cy="29" r="5" fill="${dot}"><animate attributeName="opacity" values="0.7;1;0.7" dur="5s" repeatCount="indefinite"/></circle>${text(46, 34, status === 'active' ? 'ACTIVE' : 'IN PROGRESS', 'tiny')}${multiText(24, 76, wrap(title, 28, 2), 'cardTitle', 25)}${multiText(24, 128, wrap(subtitle, 34, 2), 'mono', 18)}</g>`; }
function techTile(item, i) { const [label, tier] = item; const size = 100; const gap = 20; const x = 56 + (i % 9) * (size + gap); const y = 1010 + Math.floor(i / 9) * (size + gap); const cls = tier === 'hot' ? 'tile hot' : tier === 'blue' ? 'tile blue' : 'tile'; return `<g transform="translate(${x} ${y})"><rect width="${size}" height="${size}" rx="16" class="${cls}"/>${multiText(size / 2, 54, wrap(label, 12, 2), 'tileText', 16, ' text-anchor="middle"')}</g>`; }

function statsCard(stats) {
  const rows = [['Stars earned', compactNumber(stats.stars)], ['Total commits', compactNumber(stats.commits)], ['Total PRs', compactNumber(stats.prs)], ['Total issues', compactNumber(stats.issues)], ['Contributed last year', compactNumber(stats.yearCommits)]];
  return `<g transform="translate(56 1316)"><rect width="618" height="210" rx="16" class="panel"/>${text(28, 42, `CocoHusky's GitHub Stats`, 'statTitle')}${rows.map(([label, value], i) => `${text(30, 82 + i * 25, label, 'statLabel')}${text(340, 82 + i * 25, value, 'statValue')}`).join('')}<circle cx="520" cy="108" r="43" fill="none" stroke="${colors.orange}" stroke-opacity=".28" stroke-width="8"/><path d="M520 65a43 43 0 0 1 43 43a43 43 0 0 1-17 34" fill="none" stroke="${colors.orange}" stroke-width="8" stroke-linecap="round"><animate attributeName="stroke" values="${colors.orange};${colors.blue};${colors.orange}" dur="8s" repeatCount="indefinite"/></path>${text(520, 118, 'B+', 'grade', ' text-anchor="middle"')}</g>`;
}

function languagesCard(stats) {
  const maxWidth = 388;
  const total = stats.languages.reduce((sum, lang) => sum + Math.max(0, Number(lang.value) || 0), 0) || 100;
  let x = 0;
  const bars = stats.languages.map((lang, i) => {
    const width = i === stats.languages.length - 1 ? Math.max(0, maxWidth - x) : Math.max(0, Math.round((lang.value / total) * maxWidth * 10) / 10);
    const part = `<rect x="${x.toFixed(1)}" y="0" width="${width.toFixed(1)}" height="10" fill="${lang.color}"/>`;
    x += width;
    return part;
  }).join('');
  const list = stats.languages.slice(0, 6).map((lang, i) => text(28 + (i % 2) * 220, 106 + Math.floor(i / 2) * 29, `${lang.name} ${lang.value}%`, 'languageText')).join('');
  return `<g transform="translate(700 1316)"><rect width="444" height="210" rx="16" class="panel"/>${text(28, 42, 'Most Used Languages', 'statTitle')}<g transform="translate(28 66)"><rect width="${maxWidth}" height="10" rx="5" fill="${colors.navy3}"/>${bars}</g>${list}</g>`;
}

function svg(stats) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Alex Burton biomedical engineering profile">
<defs><style><![CDATA[.ui{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}.mono{fill:${colors.text3};font:14px "SFMono-Regular",Consolas,monospace}.title{fill:${colors.text};font-size:56px;font-weight:820;letter-spacing:-2.5px}.body{fill:${colors.text2};font-size:19px}.eyebrow{fill:${colors.orange2};font-size:13px;font-weight:800;letter-spacing:3.1px}.heading{fill:${colors.text};font-size:26px;font-weight:820}.icon{color:${colors.orange};animation:iconShift 7s ease-in-out infinite}.panel{fill:${colors.panel};fill-opacity:.76;stroke:${colors.border};stroke-width:1}.tiny{fill:${colors.text3};font:12px "SFMono-Regular",Consolas,monospace;font-weight:700;letter-spacing:1.6px}.cardTitle{fill:${colors.text};font-size:20px;font-weight:760}.tile{fill:${colors.panel};fill-opacity:.76;stroke:${colors.border};stroke-width:1}.tile.hot{stroke:rgba(232,131,74,.46);fill:rgba(232,131,74,.08)}.tile.blue{stroke:rgba(76,141,255,.42);fill:rgba(76,141,255,.07)}.tileText{fill:${colors.text2};font:13px "SFMono-Regular",Consolas,monospace;font-weight:700}.statTitle{fill:${colors.orange2};font-size:22px;font-weight:800}.statLabel{fill:${colors.text2};font-size:15px;font-weight:650}.statValue{fill:${colors.text};font-size:15px;font-weight:800}.grade{fill:${colors.text};font-size:24px;font-weight:850}.languageText{fill:${colors.text2};font-size:14px}.torus{fill:none;stroke-linecap:round;stroke-linejoin:round;animation:trace 12s linear infinite}.pulse{animation:pulseColor 8s ease-in-out infinite}@keyframes iconShift{0%,100%{color:${colors.orange}}50%{color:${colors.blue}}}@keyframes trace{to{stroke-dashoffset:-860}}@keyframes pulseColor{0%,100%{opacity:.42}50%{opacity:.78}}]]></style><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#010409"/><stop offset=".55" stop-color="#06101c"/><stop offset="1" stop-color="#0d1117"/></linearGradient><linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${colors.orange}" stop-opacity=".12"><animate attributeName="stop-opacity" values=".12;.9;.12" dur="5s" repeatCount="indefinite"/></stop><stop offset=".48" stop-color="${colors.orange}"/><stop offset=".7" stop-color="${colors.blue}"/><stop offset="1" stop-color="${colors.orange}" stop-opacity=".12"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/><circle cx="860" cy="170" r="280" fill="${colors.blue}" opacity=".08"/><circle cx="170" cy="310" r="220" fill="${colors.cyan}" opacity=".07"/><circle cx="1000" cy="1030" r="240" fill="${colors.orange}" opacity=".06"/><g opacity=".35">${Array.from({ length: 33 }, (_, i) => `<path d="M0 ${i * 52}H1200" stroke="${colors.cyan}" opacity=".05"/>`).join('')}${Array.from({ length: 24 }, (_, i) => `<path d="M${i * 52} 0V1660" stroke="${colors.cyan}" opacity=".05"/>`).join('')}</g><g transform="translate(650 8) rotate(-9)" opacity=".66"><path class="torus pulse" d="M62 202 C96 96 232 88 298 168 C350 232 292 310 190 286 C86 262 86 142 188 102 C332 46 484 126 500 222 C514 310 402 334 326 260 C250 186 300 96 404 104 C502 112 548 206 484 274 C404 360 202 334 142 238" stroke="${colors.blue}" stroke-width="2.1" stroke-dasharray="860" filter="url(#glow)"/><path class="torus" d="M86 210 C122 132 232 126 286 184 C330 232 288 282 208 268 C130 252 136 168 216 136 C334 90 454 144 468 220 C480 286 398 304 338 248 C278 190 320 132 402 138 C476 144 508 210 460 258 C396 322 236 306 176 236" stroke="${colors.cyan}" stroke-width="1.4" stroke-opacity=".34" stroke-dasharray="620"/><path class="torus" d="M34 184 C150 260 292 92 408 158 C518 222 438 342 286 302 C124 260 136 76 304 96 C472 116 544 300 362 326 C206 348 66 282 92 188" stroke="${colors.orange}" stroke-width="1.3" stroke-opacity=".28" stroke-dasharray="720"/></g>
<g class="ui">${text(56, 92, 'BIOMEDICAL ENGINEERING FULL STACK', 'eyebrow')}${multiText(56, 165, ['Medical sensor systems from prototype', 'to real-world study devices.'], 'title', 60)}${multiText(56, 300, wrap('I build the hardware, firmware, data workflows, housings, and validation paths that turn miniature sensing ideas into usable wearable and implantable medical systems.', 82, 2), 'body', 28)}<rect x="56" y="365" width="1088" height="3" rx="2" fill="url(#rule)" filter="url(#glow)"/>${heading('Active Projects', 'active', 435)}${projects.map((project, i) => projectCard(project, 56 + i * 369, 465)).join('')}${heading('About Me', 'about', 700)}<rect x="56" y="728" width="1088" height="160" rx="18" class="panel" stroke="rgba(232,131,74,.26)"/>${multiText(90, 777, wrap('University of Arizona biomedical engineer focused on implantable and wearable medical systems, miniaturized devices, and full-stack biomedical product development.', 96, 2), 'body', 28)}${multiText(90, 838, wrap('I build across electronics, housings, embedded firmware, applications, data pipelines, and validation — turning complex sensing problems into simple, usable systems.', 96, 2), 'body', 28)}${heading('Tech Stack', 'stack', 970)}${tech.map(techTile).join('')}${heading('GitHub Stats', 'stats', 1290)}${statsCard(stats)}${languagesCard(stats)}${heading('Connect With Me', 'connect', 1590)}<rect x="322" y="1610" width="556" height="1" rx="1" fill="url(#rule)" opacity=".8"/>${text(600, 1638, 'LinkedIn · Website · Scholar', 'body', ' text-anchor="middle"')}</g></svg>`;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const stats = await collectStats();
  await Promise.all([rm(svgPath, { force: true }), rm(archivedPngPath, { force: true })]);
  await writeFile(svgPath, `${svg(stats)}\n`, 'utf8');
  console.log(`Rendered ${path.relative(repoRoot, svgPath)} with live GitHub stats`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

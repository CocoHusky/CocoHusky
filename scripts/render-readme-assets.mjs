import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const dataPath = path.join(repoRoot, 'src', 'profile-card-data.json');
const outputDir = path.join(repoRoot, 'assets');
const svgPath = path.join(outputDir, 'profile-card.svg');
const archivedPngPath = path.join(outputDir, 'profile-card.png');

const WIDTH = 1200;
const HEIGHT = 700;

const palette = {
  navy: '#0d1117',
  navy2: '#161b22',
  navy3: '#21262d',
  border: '#30363d',
  accent: '#3b82f6',
  orange: '#e8834a',
  orangeSoft: '#211812',
  teal: '#14b8a6',
  text: '#e6edf3',
  text2: '#8b949e',
  text3: '#6e7681',
  green: '#22c55e',
  amber: '#e8834a'
};

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function truncate(value, max = 64) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function wrapWords(value, max = 58, maxLines = 2) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);

  return lines.slice(0, maxLines).map((line, index, visible) => {
    if (index === maxLines - 1 && visible.length < lines.length) return truncate(line, max - 1);
    return line;
  });
}

function monthWindows(count = 12, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const windows = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  cursor.setUTCMonth(cursor.getUTCMonth() - (count - 1));

  for (let i = 0; i < count; i += 1) {
    const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    windows.push({ label: formatter.format(start), start, end, count: 0 });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return windows;
}

function fallbackCommits(config) {
  const fallback = config.commitFallback ?? {};
  return {
    labels: fallback.months ?? monthWindows().map((month) => month.label),
    counts: fallback.counts ?? [18, 25, 12, 30, 22, 35, 28, 45, 52, 38, 60, 48],
    activeRepos: fallback.activeRepos ?? []
  };
}

async function githubJson(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${url}`);
  return response.json();
}

async function fetchCommitData(config) {
  const username = config.username;
  if (!username) return fallbackCommits(config);

  try {
    const windows = monthWindows(12);
    const since = windows[0].start.toISOString().slice(0, 10);
    const repoCounts = new Map();
    let page = 1;

    while (page <= 5) {
      const query = encodeURIComponent(`author:${username} committer-date:>=${since}`);
      const data = await githubJson(`https://api.github.com/search/commits?q=${query}&per_page=100&page=${page}`);
      const items = data.items ?? [];

      for (const item of items) {
        const dateValue = item.commit?.author?.date ?? item.commit?.committer?.date;
        const date = dateValue ? new Date(dateValue) : null;
        if (!date || Number.isNaN(date.getTime())) continue;

        const match = windows.find((window) => date >= window.start && date < window.end);
        if (match) match.count += 1;

        const repoName = item.repository?.name;
        if (repoName) repoCounts.set(repoName, (repoCounts.get(repoName) ?? 0) + 1);
      }

      if (items.length < 100) break;
      page += 1;
    }

    const counts = windows.map((window) => window.count);
    if (!counts.some((count) => count > 0)) return fallbackCommits(config);

    const activeRepos = [...repoCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return {
      labels: windows.map((window) => window.label),
      counts,
      activeRepos: activeRepos.length ? activeRepos : fallbackCommits(config).activeRepos
    };
  } catch (error) {
    console.warn(`Using fallback commit data: ${error.message}`);
    return fallbackCommits(config);
  }
}

function fallbackDomains(config) {
  return (config.domains ?? []).map((domain) => ({
    label: domain.label,
    color: domain.color,
    value: domain.fallback ?? 50
  }));
}

function categorizeRepo(repo, languages) {
  const name = `${repo.name ?? ''} ${repo.description ?? ''}`.toLowerCase();
  const languageNames = Object.keys(languages).map((language) => language.toLowerCase());
  const hasLanguage = (...needles) => needles.some((needle) => languageNames.includes(needle));
  const score = {
    'Wearable sensing': 0,
    'Embedded firmware': 0,
    'ML / signal proc.': 0,
    'V&V / med-dev': 0,
    'Self-hosted infra': 0
  };

  if (/mmwave|sensor|radar|wearable|implant|medical|device|vizlog/.test(name)) score['Wearable sensing'] += 3;
  if (/esp32|xiao|zephyr|firmware|arduino|ble|nfc|embedded/.test(name)) score['Embedded firmware'] += 3;
  if (/signal|ml|ai|model|analytics|python|data/.test(name)) score['ML / signal proc.'] += 2;
  if (/validation|test|fda|iso|docs|quality|requirement|risk/.test(name)) score['V&V / med-dev'] += 2;
  if (/homelab|proxmox|truenas|server|infra|zfs|docker|self-host/.test(name)) score['Self-hosted infra'] += 3;

  if (hasLanguage('c', 'c++', 'arduino', 'cmake')) {
    score['Embedded firmware'] += 2;
    score['Wearable sensing'] += 1;
  }
  if (hasLanguage('python', 'jupyter notebook', 'r', 'matlab')) score['ML / signal proc.'] += 2;
  if (hasLanguage('shell', 'dockerfile', 'hcl', 'nix')) score['Self-hosted infra'] += 2;
  if (hasLanguage('markdown', 'html', 'css', 'javascript', 'typescript')) score['V&V / med-dev'] += 1;

  return score;
}

async function fetchDomainData(config) {
  const username = config.username;
  const fallback = fallbackDomains(config);
  if (!username) return fallback;

  try {
    const repos = await githubJson(`https://api.github.com/users/${username}/repos?per_page=30&sort=updated&type=owner`);
    const totals = Object.fromEntries(fallback.map((domain) => [domain.label, 0]));

    for (const repo of repos.slice(0, 18)) {
      if (repo.fork) continue;
      let languages = {};
      try {
        languages = await githubJson(repo.languages_url);
      } catch {
        languages = {};
      }
      const scores = categorizeRepo(repo, languages);
      for (const [label, score] of Object.entries(scores)) {
        if (label in totals) totals[label] += score;
      }
    }

    const max = Math.max(...Object.values(totals), 1);
    return fallback.map((domain) => {
      const score = totals[domain.label] ?? 0;
      const value = score > 0 ? clamp(Math.round((score / max) * 88), 22, 88) : domain.value;
      return { ...domain, value };
    });
  } catch (error) {
    console.warn(`Using fallback domain data: ${error.message}`);
    return fallback;
  }
}

function text(x, y, content, className, extra = '') {
  return `<text x="${x}" y="${y}" class="${className}"${extra}>${esc(content)}</text>`;
}

function tspans(x, y, lines, className, dy = 18) {
  return `<text x="${x}" y="${y}" class="${className}">${lines
    .map((line, i) => `<tspan x="${x}"${i ? ` dy="${dy}"` : ''}>${esc(line)}</tspan>`)
    .join('')}</text>`;
}

function linkButton(link, x, y, width, type) {
  const primary = link.primary;
  const stroke = primary ? palette.orange : palette.border;
  const fill = primary ? palette.orangeSoft : palette.navy2;
  const color = primary ? palette.orange : palette.text;
  const icon = type === 'portfolio'
    ? `<path d="M20 18v18a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V27" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><path d="M34 14h16v16" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><path d="M29 35 50 14" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`
    : type === 'linkedin'
      ? `<rect x="20" y="16" width="24" height="24" rx="2" fill="${color}" opacity="0.95"/><text x="25" y="35" fill="${palette.navy}" font-size="17" font-weight="800" font-family="Arial, sans-serif">in</text>`
      : `<path d="M18 17h14a8 8 0 0 1 8 8v22a6 6 0 0 0-6-6H18z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/><path d="M56 17H42a8 8 0 0 0-8 8v22a6 6 0 0 1 6-6h16z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;

  return `<a href="${esc(link.url)}" target="_blank"><g transform="translate(${x} ${y})">
    <rect width="${width}" height="48" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <g transform="scale(0.58)">${icon}</g>
    ${text(50, 31, link.label + (primary ? ' →' : ''), primary ? 'buttonPrimary' : 'button')}
  </g></a>`;
}

function section(x, y, width, height, title, body) {
  return `<g transform="translate(${x} ${y})">
    <rect width="${width}" height="${height}" rx="12" fill="${palette.navy2}" stroke="${palette.border}" stroke-width="1.35"/>
    ${text(28, 39, title, 'sectionLabel')}
    ${body}
  </g>`;
}

function renderSkills(skills) {
  const rowH = 38;
  const colW = 158;
  const pieces = [];

  for (const skill of (skills ?? []).slice(0, 10)) {
    const label = truncate(skill.label, 22);
    const width = colW;
    const col = pieces.length % 2;
    const row = Math.floor(pieces.length / 2);
    const x = 28 + col * 168;
    const y = 68 + row * rowH;
    const tier = skill.tier ?? 'support';
    const stroke = tier === 'primary' ? '#315fbd' : tier === 'signal' ? '#187d75' : palette.border;
    const fill = tier === 'primary' ? '#111d2e' : tier === 'signal' ? '#102420' : palette.navy3;
    const cls = tier === 'primary' ? 'tagPrimary' : tier === 'signal' ? 'tagSignal' : 'tagSupport';
    pieces.push(`<g transform="translate(${x} ${y})"><rect width="${width}" height="30" rx="15" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>${text(16, 21, label, cls)}</g>`);
  }
  return pieces.join('\n');
}

function renderCommitActivity(commitData) {
  const max = Math.max(...commitData.counts, 1);
  const barWidth = 30;
  const gap = 9;
  const bars = commitData.counts.slice(0, 12).map((count, i) => {
    const h = clamp(Math.round((count / max) * 74), 12, 74);
    const x = 28 + i * (barWidth + gap);
    const y = 120 - h;
    const fill = h > 54 ? palette.accent : h > 32 ? '#31599a' : '#18345a';
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" fill="${fill}"/>`;
  }).join('\n');

  const labels = commitData.labels
    .slice(0, 12)
    .map((label, i) => text(43 + i * (barWidth + gap), 146, label, 'monthLabel', ' text-anchor="middle"'))
    .join('\n');

  const repoLine = `Active: ${(commitData.activeRepos ?? []).slice(0, 3).join(' · ') || 'hardware · infra · tooling'}`;
  return `${bars}\n${labels}\n${tspans(28, 174, wrapWords(repoLine, 56, 2), 'monoMuted', 18)}`;
}

function renderDomains(domains) {
  return (domains ?? []).slice(0, 5).map((domain, i) => {
    const y = 64 + i * 28;
    const fillWidth = clamp(domain.value ?? domain.fallback ?? 50, 0, 100);
    return `<g transform="translate(28 ${y})">
      <circle cx="6" cy="6" r="5.5" fill="${domain.color}"/>
      ${text(24, 11, domain.label, 'domainLabel')}
      <rect x="220" y="2.5" width="96" height="7" rx="3.5" fill="${palette.navy3}"/>
      <rect x="220" y="2.5" width="${fillWidth}" height="7" rx="3.5" fill="${domain.color}"/>
    </g>`;
  }).join('\n');
}

function renderBuilding(items) {
  return (items ?? []).slice(0, 3).map((item, i) => {
    const y = 70 + i * 82;
    const dot = item.status === 'active' ? palette.green : palette.amber;
    const subtitleLines = wrapWords(item.subtitle, 58, 2);
    const divider = i < 2 ? `<line x1="28" y1="${y + 62}" x2="650" y2="${y + 62}" stroke="${palette.border}"/>` : '';
    return `<g transform="translate(28 ${y})">
      <circle cx="8" cy="8" r="7" fill="${dot}" opacity="0.24"/>
      <circle cx="8" cy="8" r="4.3" fill="${dot}"/>
      ${text(32, 14, truncate(item.title, 52), 'buildingTitle')}
      ${tspans(32, 39, subtitleLines, 'buildingSub', 17)}
    </g>${divider}`;
  }).join('\n');
}

function renderSvg(config, commitData, domains) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Alex Burton GitHub profile dashboard">
  <defs>
    <style>
      .ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
      .button { fill: ${palette.text}; font-size: 20px; font-weight: 650; }
      .buttonPrimary { fill: ${palette.orange}; font-size: 20px; font-weight: 750; }
      .sectionLabel { fill: ${palette.text3}; font-size: 14px; font-weight: 760; letter-spacing: 3.4px; }
      .tagPrimary { fill: #93c5fd; font-size: 13.5px; font-weight: 650; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .tagSignal { fill: #5eead4; font-size: 13.5px; font-weight: 650; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .tagSupport { fill: ${palette.text2}; font-size: 13.5px; font-weight: 650; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .monthLabel { fill: ${palette.text3}; font-size: 12px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .monoMuted { fill: ${palette.text3}; font-size: 14px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .domainLabel { fill: ${palette.text2}; font-size: 15px; font-weight: 620; }
      .buildingTitle { fill: ${palette.text}; font-size: 20px; font-weight: 760; }
      .buildingSub { fill: ${palette.text3}; font-size: 14px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    </style>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" rx="14" fill="${palette.navy}"/>
  <rect x="0.75" y="0.75" width="${WIDTH - 1.5}" height="${HEIGHT - 1.5}" rx="14" fill="none" stroke="${palette.border}" stroke-width="1.5"/>
  <g class="ui">
    ${linkButton(config.links?.[0] ?? { label: 'Portfolio', url: 'https://burtonmakes.github.io/', primary: true }, 54, 42, 190, 'portfolio')}
    ${linkButton(config.links?.[1] ?? { label: 'LinkedIn', url: '#', primary: false }, 264, 42, 168, 'linkedin')}
    ${linkButton(config.links?.[2] ?? { label: 'Scholar', url: '#', primary: false }, 452, 42, 158, 'scholar')}

    ${section(54, 116, 680, 300, 'CURRENTLY BUILDING', renderBuilding(config.building))}
    ${section(760, 116, 386, 300, 'CORE SKILLS', renderSkills(config.skills))}
    ${section(54, 442, 535, 200, 'COMMIT ACTIVITY — 12 MONTHS', renderCommitActivity(commitData))}
    ${section(615, 442, 531, 200, 'DOMAIN FOCUS', renderDomains(domains))}
  </g>
</svg>`;
}

async function render() {
  await mkdir(outputDir, { recursive: true });
  const config = JSON.parse(await readFile(dataPath, 'utf8'));
  const [commitData, domains] = await Promise.all([
    fetchCommitData(config),
    fetchDomainData(config)
  ]);
  const svg = renderSvg(config, commitData, domains);

  await Promise.all([
    rm(svgPath, { force: true }),
    rm(archivedPngPath, { force: true })
  ]);
  await writeFile(svgPath, `${svg}\n`, 'utf8');
  console.log(`Rendered ${path.relative(repoRoot, svgPath)}`);
}

render().catch((error) => {
  console.error(error);
  process.exit(1);
});

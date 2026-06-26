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
const HEIGHT = 900;

const palette = {
  navy: '#0d1117',
  navy2: '#161b22',
  navy3: '#21262d',
  border: '#30363d',
  accent: '#3b82f6',
  accentDim: '#1d4ed8',
  teal: '#14b8a6',
  coral: '#f97316',
  text: '#e6edf3',
  text2: '#8b949e',
  text3: '#6e7681',
  green: '#22c55e',
  amber: '#f97316'
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

function monthWindows(count = 12, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
  const windows = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  cursor.setUTCMonth(cursor.getUTCMonth() - (count - 1));

  for (let i = 0; i < count; i += 1) {
    const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    windows.push({
      label: formatter.format(start),
      start,
      end,
      count: 0
    });
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

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${url}`);
  }
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
      const url = `https://api.github.com/search/commits?q=${query}&per_page=100&page=${page}`;
      const data = await githubJson(url);
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
    const hasActivity = counts.some((count) => count > 0);
    if (!hasActivity) return fallbackCommits(config);

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
    const dynamic = fallback.map((domain) => {
      const score = totals[domain.label] ?? 0;
      const value = score > 0 ? clamp(Math.round((score / max) * 90), 25, 90) : domain.value;
      return { ...domain, value };
    });

    return dynamic;
  } catch (error) {
    console.warn(`Using fallback domain data: ${error.message}`);
    return fallback;
  }
}

function text(x, y, content, className, extra = '') {
  return `<text x="${x}" y="${y}" class="${className}"${extra}>${esc(content)}</text>`;
}

function linkButton(link, x, y, width, type) {
  const primary = link.primary;
  const stroke = primary ? palette.accent : palette.border;
  const fill = primary ? 'rgba(59,130,246,0.06)' : palette.navy2;
  const color = primary ? palette.accent : palette.text;
  const icon = type === 'portfolio'
    ? `<path d="M24 20v18a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V27" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><path d="M38 14h16v16" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><path d="M33 35 54 14" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`
    : type === 'linkedin'
      ? `<rect x="22" y="17" width="25" height="25" rx="2" fill="${color}" opacity="0.95"/><text x="27" y="37" fill="${palette.navy}" font-size="18" font-weight="800" font-family="Arial, sans-serif">in</text>`
      : `<path d="M20 17h14a8 8 0 0 1 8 8v24a6 6 0 0 0-6-6H20z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/><path d="M58 17H44a8 8 0 0 0-8 8v24a6 6 0 0 1 6-6h16z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;

  return `<a href="${esc(link.url)}" target="_blank">
    <g transform="translate(${x} ${y})">
      <rect width="${width}" height="52" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <g transform="scale(0.62)">${icon}</g>
      ${text(56, 33, link.label + (primary ? ' →' : ''), primary ? 'buttonPrimary' : 'button')}
    </g>
  </a>`;
}

function section(x, y, width, height, title, body) {
  return `<g transform="translate(${x} ${y})">
    <rect width="${width}" height="${height}" rx="10" fill="${palette.navy2}" stroke="${palette.border}" stroke-width="1.5"/>
    ${text(32, 46, title, 'sectionLabel')}
    ${body}
  </g>`;
}

function renderSkills(skills) {
  const widths = [186, 230, 214, 178, 190, 226, 214, 168, 164, 228];
  const positions = [
    [32, 78], [226, 78], [32, 124], [258, 124], [32, 170], [226, 170], [32, 216], [258, 216], [32, 262], [226, 262]
  ];

  return (skills ?? []).slice(0, 10).map((skill, i) => {
    const [x, y] = positions[i];
    const tier = skill.tier ?? 'support';
    const stroke = tier === 'primary' ? 'rgba(59,130,246,0.55)' : tier === 'signal' ? 'rgba(20,184,166,0.55)' : palette.border;
    const fill = tier === 'primary' ? 'rgba(59,130,246,0.08)' : tier === 'signal' ? 'rgba(20,184,166,0.08)' : palette.navy3;
    const cls = tier === 'primary' ? 'tagPrimary' : tier === 'signal' ? 'tagSignal' : 'tagSupport';
    return `<g transform="translate(${x} ${y})">
      <rect width="${widths[i]}" height="34" rx="17" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
      ${text(18, 23, skill.label, cls)}
    </g>`;
  }).join('\n');
}

function renderCommitActivity(commitData) {
  const max = Math.max(...commitData.counts, 1);
  const barWidth = 36;
  const gap = 8;
  const bars = commitData.counts.map((count, i) => {
    const h = clamp(Math.round((count / max) * 108), 16, 108);
    const x = 32 + i * (barWidth + gap);
    const y = 154 - h;
    const fill = h > 74 ? palette.accent : h > 44 ? 'rgba(59,130,246,0.66)' : 'rgba(59,130,246,0.24)';
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" fill="${fill}"/>`;
  }).join('\n');

  const labels = commitData.labels.map((label, i) => {
    const x = 50 + i * (barWidth + gap);
    return text(x, 184, label, 'monthLabel', ' text-anchor="middle"');
  }).join('\n');

  const repos = (commitData.activeRepos ?? []).slice(0, 3);
  const repoLine = repos.length ? `Active across ${repos.join(' · ')}` : 'Active across hardware, homelab, and tooling repos';
  return `${bars}\n${labels}\n${text(32, 230, repoLine, 'monoMuted')}`;
}

function renderDomains(domains) {
  return (domains ?? []).slice(0, 5).map((domain, i) => {
    const y = 78 + i * 50;
    const fillWidth = clamp(domain.value ?? domain.fallback ?? 50, 0, 100);
    return `<g transform="translate(32 ${y})">
      <circle cx="7" cy="7" r="6" fill="${domain.color}"/>
      ${text(32, 13, domain.label, 'domainLabel')}
      <rect x="222" y="4" width="100" height="6" rx="3" fill="${palette.navy3}"/>
      <rect x="222" y="4" width="${fillWidth}" height="6" rx="3" fill="${domain.color}"/>
    </g>`;
  }).join('\n');
}

function wrapText(value, limit = 60) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > limit && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function renderBuilding(items) {
  return (items ?? []).slice(0, 3).map((item, i) => {
    const y = 76 + i * 92;
    const active = item.status === 'active';
    const dot = active ? palette.green : palette.amber;
    const subtitles = wrapText(item.subtitle, 66);
    const subtitleText = subtitles.map((line, lineIndex) => text(52, 56 + lineIndex * 20, line, 'monoMuted')).join('\n');
    const divider = i < 2 ? `<line x1="0" y1="${y + 70}" x2="640" y2="${y + 70}" stroke="${palette.border}"/>` : '';
    return `<g transform="translate(32 ${y})">
      <circle cx="8" cy="8" r="7" fill="${dot}" opacity="0.28"/>
      <circle cx="8" cy="8" r="4.5" fill="${dot}"/>
      ${text(32, 14, item.title, 'buildingTitle')}
      ${subtitleText}
    </g>${divider}`;
  }).join('\n');
}

function renderSvg(config, commitData, domains) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Alex Burton GitHub profile dashboard">
  <defs>
    <style>
      .ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
      .mono { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .button { fill: ${palette.text}; font-size: 22px; font-weight: 650; }
      .buttonPrimary { fill: ${palette.accent}; font-size: 22px; font-weight: 650; }
      .sectionLabel { fill: ${palette.text3}; font-size: 17px; font-weight: 760; letter-spacing: 4px; }
      .tagPrimary { fill: #93c5fd; font-size: 17px; font-weight: 650; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .tagSignal { fill: #5eead4; font-size: 17px; font-weight: 650; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .tagSupport { fill: ${palette.text2}; font-size: 17px; font-weight: 650; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .monthLabel { fill: ${palette.text3}; font-size: 15px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .monoMuted { fill: ${palette.text3}; font-size: 18px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
      .domainLabel { fill: ${palette.text2}; font-size: 20px; font-weight: 600; }
      .buildingTitle { fill: ${palette.text}; font-size: 22px; font-weight: 750; }
    </style>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="${palette.navy}"/>
  <rect x="0.75" y="0.75" width="${WIDTH - 1.5}" height="${HEIGHT - 1.5}" rx="14" fill="none" stroke="${palette.border}" stroke-width="1.5"/>

  <g class="ui">
    ${linkButton(config.links?.[0] ?? { label: 'Portfolio', url: 'https://burtonmakes.github.io/', primary: true }, 54, 58, 190, 'portfolio')}
    ${linkButton(config.links?.[1] ?? { label: 'LinkedIn', url: '#', primary: false }, 262, 58, 166, 'linkedin')}
    ${linkButton(config.links?.[2] ?? { label: 'Scholar', url: '#', primary: false }, 446, 58, 156, 'scholar')}

    ${section(54, 168, 534, 302, 'CORE SKILLS', renderSkills(config.skills))}
    ${section(616, 168, 530, 302, 'COMMIT ACTIVITY — LAST 12 MONTHS', renderCommitActivity(commitData))}
    ${section(54, 500, 350, 350, 'DOMAIN FOCUS', renderDomains(domains))}
    ${section(430, 500, 716, 350, 'CURRENTLY BUILDING', renderBuilding(config.building))}
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

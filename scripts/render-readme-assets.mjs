import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets-src');
const assetDir = path.join(root, 'assets');

const GENERATED_HTML_ASSETS = [
  'hero-banner',
  'active-projects-card'
];

function readDimension(html, name, fallback) {
  const match = html.match(new RegExp(`data-${name}="(\\d+)"`));
  return match ? Number(match[1]) : fallback;
}

function htmlToSvg(html, fallbackWidth = 1200, fallbackHeight = 320) {
  const width = readDimension(html, 'width', fallbackWidth);
  const height = readDimension(html, 'height', fallbackHeight);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml">
${html.trim()}
    </div>
  </foreignObject>
</svg>`;
}

async function renderHtmlAsset(name) {
  const html = await readFile(path.join(sourceDir, `${name}.html`), 'utf8');
  const svg = htmlToSvg(html);
  await writeFile(path.join(assetDir, `${name}.svg`), `${svg}\n`, 'utf8');
}

async function main() {
  await mkdir(assetDir, { recursive: true });

  await Promise.all([
    rm(path.join(assetDir, 'profile-card.svg'), { force: true }),
    rm(path.join(assetDir, 'profile-card.png'), { force: true }),
    rm(path.join(assetDir, 'github-stats-card.svg'), { force: true }),
    rm(path.join(assetDir, 'activity-card.svg'), { force: true }),
    rm(path.join(assetDir, 'cta-portfolio.svg'), { force: true }),
    rm(path.join(assetDir, 'cta-linkedin.svg'), { force: true }),
    rm(path.join(assetDir, 'cta-scholar.svg'), { force: true })
  ]);

  await Promise.all(GENERATED_HTML_ASSETS.map(renderHtmlAsset));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

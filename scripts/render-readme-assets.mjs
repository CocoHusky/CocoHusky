import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const sourcePath = path.join(repoRoot, 'src', 'profile-card.html');
const outputDir = path.join(repoRoot, 'assets');
const svgPath = path.join(outputDir, 'profile-card.svg');
const archivedPngPath = path.join(outputDir, 'profile-card.png');

function extractInlineSvg(html) {
  const match = html.match(/<svg\b[\s\S]*<\/svg>/i);
  if (!match) {
    throw new Error(`${sourcePath} must include an inline <svg> element.`);
  }

  const svg = match[0].trim();
  if (!svg.includes('viewBox="0 0 1200 300"')) {
    throw new Error('Profile SVG must keep viewBox="0 0 1200 300" for README scaling.');
  }
  return svg;
}

async function render() {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    rm(svgPath, { force: true }),
    rm(archivedPngPath, { force: true })
  ]);

  const sourceHtml = await readFile(sourcePath, 'utf8');
  const svg = extractInlineSvg(sourceHtml);
  await writeFile(svgPath, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`, 'utf8');
  console.log(`Rendered ${path.relative(repoRoot, svgPath)}`);
}

render().catch((error) => {
  console.error(error);
  process.exit(1);
});

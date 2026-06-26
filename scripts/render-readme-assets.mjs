import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const width = Number(process.env.README_CARD_WIDTH ?? 1200);
const height = Number(process.env.README_CARD_HEIGHT ?? 300);

const sourcePath = path.join(repoRoot, 'src', 'profile-card.html');
const outputDir = path.join(repoRoot, 'assets');
const svgPath = path.join(outputDir, 'profile-card.svg');
const archivedPngPath = path.join(outputDir, 'profile-card.png');

function extractTagContent(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  if (!match) {
    throw new Error(`${sourcePath} must include a <${tagName}> element.`);
  }
  return match[1].trim();
}

function svgDocument({ width, height, styles, body }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Alex Burton profile README banner">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;">
      <style>
${styles}
      </style>
${body}
    </div>
  </foreignObject>
</svg>
`;
}

async function render() {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    rm(svgPath, { force: true }),
    rm(archivedPngPath, { force: true })
  ]);

  const sourceHtml = await readFile(sourcePath, 'utf8');
  const styles = extractTagContent(sourceHtml, 'style');
  const body = extractTagContent(sourceHtml, 'body');

  await writeFile(svgPath, svgDocument({ width, height, styles, body }), 'utf8');
  console.log(`Rendered ${path.relative(repoRoot, svgPath)}`);
}

render().catch((error) => {
  console.error(error);
  process.exit(1);
});

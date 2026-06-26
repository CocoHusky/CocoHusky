import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const width = Number(process.env.README_CARD_WIDTH ?? 1200);
const height = Number(process.env.README_CARD_HEIGHT ?? 630);

const sourcePath = path.join(repoRoot, 'src', 'profile-card.html');
const outputDir = path.join(repoRoot, 'assets');
const pngPath = path.join(outputDir, 'profile-card.png');
const svgPath = path.join(outputDir, 'profile-card.svg');

async function removeOldGeneratedFiles() {
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    rm(pngPath, { force: true }),
    rm(svgPath, { force: true })
  ]);
}

function svgDocument({ width, height, html }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Alex Burton profile README card">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;padding:0;overflow:hidden;">
${html}
    </div>
  </foreignObject>
</svg>
`;
}

async function render() {
  await removeOldGeneratedFiles();

  const sourceHtml = await readFile(sourcePath, 'utf8');
  if (!sourceHtml.includes('<body')) {
    throw new Error(`${sourcePath} must be a complete HTML document with a body element.`);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    await page.goto(pathToFileURL(sourcePath).href, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    });

    await page.screenshot({
      path: pngPath,
      clip: { x: 0, y: 0, width, height },
      omitBackground: false
    });

    const embeddedHtml = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style'))
        .map((style) => style.outerHTML)
        .join('\n');
      return `${styles}\n${document.body.innerHTML}`;
    });

    await writeFile(svgPath, svgDocument({ width, height, html: embeddedHtml }), 'utf8');
  } finally {
    await browser.close();
  }

  console.log(`Rendered ${path.relative(repoRoot, pngPath)}`);
  console.log(`Rendered ${path.relative(repoRoot, svgPath)}`);
}

render().catch((error) => {
  console.error(error);
  process.exit(1);
});

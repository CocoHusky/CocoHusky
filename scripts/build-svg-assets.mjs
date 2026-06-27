import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'assets-src');
const outDir = path.join(root, 'assets');
const tokenPath = path.join(root, 'config', 'svg-tokens.json');

function renderTemplate(source, tokens) {
  let output = source;
  for (const [key, value] of Object.entries(tokens)) {
    output = output.split(`{{${key}}}`).join(String(value));
  }
  return output;
}

function validateSvg(name, svg) {
  const trimmed = svg.trim();
  if (!trimmed.startsWith('<svg')) throw new Error(`${name} does not start with svg markup.`);
  if (!trimmed.endsWith('</svg>')) throw new Error(`${name} does not end with svg markup.`);
  if (!trimmed.includes('xmlns="http://www.w3.org/2000/svg"')) throw new Error(`${name} is missing the SVG namespace.`);
  if (!trimmed.includes('viewBox=')) throw new Error(`${name} is missing viewBox.`);
  if (trimmed.includes('{{')) throw new Error(`${name} still contains unresolved template tokens.`);
}

async function main() {
  const tokens = JSON.parse(await readFile(tokenPath, 'utf8'));
  const entries = await readdir(srcDir);
  const svgFiles = entries.filter((name) => name.endsWith('.svg')).sort();

  if (svgFiles.length === 0) {
    throw new Error('No SVG source files found in assets-src/.');
  }

  await mkdir(outDir, { recursive: true });

  for (const file of svgFiles) {
    const source = await readFile(path.join(srcDir, file), 'utf8');
    const output = renderTemplate(source, tokens);
    validateSvg(file, output);
    await writeFile(path.join(outDir, file), output.trim() + '\n', 'utf8');
    console.log(`Built assets/${file}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
const destination = path.join(root, 'dist');
const result = await build({
  entryPoints: [path.join(source, 'main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'inline',
  alias: {
    'three/addons': path.join(source, 'vendor/addons'),
    'three': path.join(source, 'vendor/three.module.js'),
  },
});
const javascript = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await fs.readFile(path.join(source, 'style.css'), 'utf8');
let html = await fs.readFile(path.join(source, 'index.html'), 'utf8');
html = html
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace('<script type="module" src="main.js"></script>', () => `<script>${javascript}</script>`);
await fs.mkdir(destination, { recursive: true });
await fs.writeFile(path.join(destination, 'index.html'), html);
await fs.writeFile(path.join(destination, '.nojekyll'), '');
await fs.copyFile(path.join(source, 'vendor/LICENSE-three.txt'), path.join(destination, 'LICENSE-three.txt'));
console.log(`Built dist/index.html (${Math.round(Buffer.byteLength(html) / 1024)} KiB), with no external runtime dependencies.`);

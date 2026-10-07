#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@vue/compiler-sfc';
import vue from '@vitejs/plugin-vue';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--out' || !args[1]) throw new Error('Usage: node src/ext/modules/loot/tools/loot-ui-preview.mjs --out <directory outside repository>');
const out = path.resolve(args[1]);
const relative = path.relative(root, out);
if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('--out must be outside the repository; generated HTML is not committed');
const ui = path.join(root, 'src/ext/modules/loot/ui');
const gallery = path.join(root, 'src/ext/modules/loot/tools/preview/LootUiGallery.vue');
const files = [...(await readdir(ui)).filter(file => file.endsWith('.vue')).sort().map(file => path.join(ui, file)), gallery];
const css = (await Promise.all(files.map(async file => parse(await readFile(file, 'utf8'), { filename: file }).descriptor.styles.map(style => style.content).join('\n')))).join('\n');
let server;
try {
  server = await createServer({ configFile: false, root, plugins: [vue()], logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
  const { renderLootUiPreview } = await server.ssrLoadModule('/src/ext/modules/loot/tools/preview/render.ts');
  const html = await renderLootUiPreview({ css });
  await mkdir(out, { recursive: true });
  const output = path.join(out, 'loot-ui-preview.html');
  await writeFile(output, html, 'utf8');
  console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), states: (html.match(/data-loot-state=/g) ?? []).length, frames: (html.match(/data-loot-frame=/g) ?? []).length }));
} finally {
  await server?.close();
}

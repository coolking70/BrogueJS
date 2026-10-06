#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const args = process.argv.slice(2);
const options = { runs: 300, seedBase: 1 };
let out = null;
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  const value = args[i + 1];
  if (value === undefined) throw new Error(`Missing value for ${key}`);
  if (key === '--runs') options.runs = Number(value);
  else if (key === '--seed-base') options.seedBase = Number(value);
  else if (key === '--out') out = path.resolve(value);
  else throw new Error(`Unknown option ${key}`);
}
if (!out) throw new Error('--out is required');
let server;
try {
  server = await createServer({ configFile: false, root, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const { computeLootStats, renderLootStatsMarkdown } = await server.ssrLoadModule('/src/ext/modules/loot/tools/stats.ts');
  const report = computeLootStats(options);
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'loot-stats.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(out, 'loot-stats.md'), renderLootStatsMarkdown(report));
  console.log(JSON.stringify({ output: out, ...report.summary }));
  if (report.summary.validationFailures !== 0) process.exitCode = 1;
} finally {
  await server?.close();
}

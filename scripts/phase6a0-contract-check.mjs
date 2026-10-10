/** Read-only documentation/type probe, intentionally not a test-suite member. */
import ts from 'typescript';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

assert.equal(process.version, 'v24.19.0');
assert.equal(process.env.NODE_OPTIONS, '--max-old-space-size=3072');
const files = ['docs/ext/phase6a-contract.md', 'docs/ext/phase6a0.report.md'];
let source = '', anchors = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  assert.ok(!text.includes('\r'), `${file}: CRLF`);
  assert.ok(!/^(<<<<<<< |=======\s*$|>>>>>>> )/m.test(text), `${file}: conflict marker`);
  assert.equal((text.match(/^```/gm) ?? []).length % 2, 0, `${file}: unclosed fence`);
  for (const [, path, line] of text.matchAll(/`((?:src|scripts)\/[^`\s:]+):(\d+)`/g)) {
    const rows = (await readFile(path, 'utf8')).split('\n');
    assert.ok(Number(line) > 0 && Number(line) <= rows.length, `${path}:${line}: missing anchor`);
    anchors++;
  }
  for (const [, target] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(https?:|#)/.test(target)) continue;
    const path = resolve(file, '..', target.split('#')[0]);
    await readFile(path);
  }
  if (file.endsWith('phase6a-contract.md')) {
    source = text.match(/```ts\n(\/\/ C6-1 declarations:[\s\S]*?)\n```/)?.[1] ?? '';
  }
}
assert.ok(source);
// Compile the actual fenced declarations as a virtual file. No emitted output,
// tsbuildinfo, repository writes, project build or test runner.
const virtual = resolve('/private/tmp/phase6a0-contract.virtual.ts');
const options = { strict: true, noEmit: true, skipLibCheck: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  types: [], lib: ['lib.es2022.d.ts'] };
const host = ts.createCompilerHost(options);
const original = host.getSourceFile.bind(host);
host.getSourceFile = (name, language, onError, createNew) => name === virtual
  ? ts.createSourceFile(name, source, language, true) : original(name, language, onError, createNew);
const program = ts.createProgram([virtual], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: x => x, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n'
  }));
  process.exitCode = 1;
} else process.stdout.write(JSON.stringify({ documents: files.length, anchors,
  contractTypeErrors: 0, note: 'Self-contained proposed declarations only; no production SDK integration claim.' }) + '\n');

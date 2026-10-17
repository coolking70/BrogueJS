/** Local one-round candidate witness; formal/cloud runs still require clean commits. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function sourceSnapshot(root) {
  const rows = [];
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const child = resolve(path, name),
        stat = lstatSync(child);
      assert.ok(!stat.isSymbolicLink(), 'Source symlink is not a snapshot');
      if (stat.isDirectory()) walk(child);
      else {
        assert.ok(stat.isFile(), 'Non-file source');
        rows.push([relative(root, child).replaceAll('\\', '/'), hash(readFileSync(child))]);
      }
    }
  }
  walk(resolve(root, 'src'));
  return { hash: hash(JSON.stringify(rows)), files: rows };
}
export function assertCandidateSnapshot(options, actual, env = process.env) {
  assert.ok(!env.GITHUB_ACTIONS, 'Uncommitted candidate smoke is local only');
  assert.equal(options.rounds, 1);
  assert.ok(Number.isSafeInteger(options.limit) && options.limit >= 0 && options.limit <= 1714);
  assert.deepEqual(options.cases, ['classic', 'all']);
  assert.match(options.headSourceHash, /^[a-f0-9]{64}$/);
  assert.equal(actual.hash, options.headSourceHash, 'Candidate source changed');
}

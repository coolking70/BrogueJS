/** 6A1 production codec measurement. Pinned pure loot values are owned by a
 * test-only c6fixture validator; no loot module is installed. No DTO overlay. */
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

assert.equal(process.version, 'v24.19.0');
assert.equal(process.env.NODE_OPTIONS, '--max-old-space-size=3072');
const root = process.cwd();
const output = resolve(process.argv[2] ?? '/private/tmp/phase6a1-size.json');
assert.ok(output.startsWith('/private/tmp/'), 'Evidence must stay outside the repository');
const coreCommit = '93523fc596b173396a0d526ab2073b327ff7cf3e';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const sha = data => createHash('sha256').update(data).digest('hex');
const nativeFiles = git('ls-files', 'src', 'package.json', 'package-lock.json').trim().split('\n');
async function sourceHash() {
  const rows = [];
  for (const path of nativeFiles) rows.push([path, sha(await readFile(join(root, path)))]);
  return sha(JSON.stringify(rows));
}
const before = await sourceHash();
const scratch = await mkdtemp('/private/tmp/brogue-6a1-probe-');
let server;
const encoder = new TextEncoder();
const encode = value => encoder.encode(JSON.stringify(value));
const samples = 15, warmups = 3;
function bench(fn) {
  for (let i = 0; i < warmups; i++) fn();
  const times = [];
  for (let i = 0; i < samples; i++) { const t = performance.now(); fn(); times.push(performance.now() - t); }
  times.sort((a, b) => a - b);
  return { samples, medianMs: times[Math.floor(samples / 2)], p95Ms: times[Math.ceil(samples * .95) - 1], maxMs: times.at(-1) };
}
try {
  // Only the pure core closure is extracted. No worktree checkout or package install.
  const paths = git('ls-tree', '-r', '--name-only', coreCommit, 'src/ext/modules/loot').trim().split('\n')
    .filter(p => /^src\/ext\/modules\/loot\/[^/]+\.ts$/.test(p) || /\/(data|locales)\/[^/]+\.json$/.test(p));
  for (const path of paths) {
    const target = join(scratch, path.replace('src/ext/modules/loot/', 'src/ext/inputs/loot/')); await mkdir(dirname(target), { recursive: true });
    await writeFile(target, git('show', `${coreCommit}:${path}`));
  }
  for (const path of ['src/ext/json.ts', 'src/ext/fingerprint.ts', 'src/data/weapons.json', 'src/data/armors.json', 'src/data/arcana.json']) {
    await mkdir(dirname(join(scratch, path)), { recursive: true });
    await writeFile(join(scratch, path), await readFile(join(root, path)));
  }
  server = await createServer({ root, configFile: false, cacheDir: join(scratch, 'vite-cache'),
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  const load = path => server.ssrLoadModule(path);
  const core = path => load(join(scratch, 'src/ext/inputs/loot', path));
  const { loadLootPack, getLootPackIdentity } = await core('definitions.ts');
  const { buildEffectiveLootCatalog } = await core('catalog.ts');
  const { rollLoot } = await core('generator.ts');
  const { validateLootItemData } = await core('item.ts');
  const catalog = buildEffectiveLootCatalog(loadLootPack(), { combat: null, growth: null, giants: null });
  await load('/src/test/harness.ts');
  const { assembleWorldItem } = await load('/src/engine/Items/WorldItems.ts');
  const { serializeItem, deserializeItem } = await load('/src/engine/Core/EntitySnapshot.ts');
  const { getNextEntityId, restoreNextEntityId } = await load('/src/entities/Creature.ts');
  const { createItemHarness } = await load('/src/ext/testing/itemHarness.ts');
  const { descriptor } = await load('/src/ext/testing/fixtures/itemFixture/index.ts');
  const { rng } = await load('/src/engine/Random.ts');
  const harness = createItemHarness({seed:61002000,mode:'wizard'}, [{...descriptor,create:()=>({id:'c6fixture',version:'1.0.0',initialState:()=>({}),validateState:v=>!!v&&typeof v==='object'&&!Object.keys(v).length,itemDataValidators:{c6fixture:data=>validateLootItemData(data,catalog)}})}]);
  const game = harness.game();
  game.animationEnabled = false; game.onRenderRequested = () => {};
  for (let depth = 2; depth <= 4; depth++) { game.depth = depth; game.generateDepth(false, false); }
  const levels = [...game.levels].filter(([d]) => d !== game.currentLevelDepth).map(([, l]) => l);
  levels.push({ items: game.items, grid: game.grid });
  assert.equal(levels.length, 4);
  const definition = { owner: 'probe', id: 'probe.dagger', nameKey: 'probe.name', descriptionKey: 'probe.description',
    category: 'native', glyph: ')', color: '#cccccc', maxStack: 1, nativeTemplate: 'dagger', tags: [], tool: null };
  let items = Array.from({ length: 2000 }, () => assembleWorldItem(definition));
  game.player.inventory.items = items.slice(0, 26);
  game.player.inventory.items.forEach((item, i) => { item.inventoryLetter = String.fromCharCode(97 + i); });
  game.player.equippedWeapon = items[0]; game.player.equippedArmor = undefined;
  game.player.ringLeft = undefined; game.player.ringRight = undefined;
  let offset = 26;
  levels.forEach((level, index) => {
    const count = [494, 494, 493, 493][index];
    const positions = [];
    for (let y = 1; y < level.grid.height - 1; y++) for (let x = 1; x < level.grid.width - 1; x++)
      if (level.grid.getCell(x, y).isPassable) positions.push({ x, y });
    assert.ok(positions.length);
    level.items.splice(0, level.items.length, ...items.slice(offset, offset + count));
    level.items.forEach((item, i) => { item.loc = { ...positions[i % positions.length] }; });
    offset += count;
  });
  assert.equal(offset, 2000);
  // Native unrelated graph references are retained. The 2000 designated IDs
  // occur once each in owning rows; shared equipment refs stay scalar IDs.
  const base = game.toSnapshot(); base.savedAt = 0;
  const ids = new Set(items.map(i => i.id));
  function rows(snapshot) {
    return [...snapshot.items, ...snapshot.player.inventory, ...snapshot.levels.flatMap(l => l.items),
      ...snapshot.entityGraph.items, ...snapshot.pendingFallenItemsByDepth.flatMap(l => l.items)];
  }
  const designated = rows(base).filter(row => ids.has(row.id));
  assert.equal(designated.length, 2000);
  assert.equal(new Set(designated.map(r => r.id)).size, 2000);
  const rngBefore = JSON.stringify(rng.getState());
  let tape = 61002000, calls = 0;
  const random = { randomInt(lo, hi) { calls++; tape = (Math.imul(tape, 1664525) + 1013904223) >>> 0; return lo + Math.floor(tape / 2 ** 32 * (hi - lo + 1)); } };
  const cases = [];
  for (const spec of [{ name: 'mixed-vault', affixes: null, preset: 'standard', depth: 26 },
    { name: 'rare-five', affixes: 5, preset: 'standard', depth: 26 },
    { name: 'rare-six', affixes: 6, preset: 'bountiful', depth: 40 }]) {
    const data = [], claimed = new Set(); let attempts = 0;
    const callsBefore = calls;
    while (data.length < 2000) {
      assert.ok(++attempts < 200000, 'Rejection sampling unexpectedly expensive');
      const result = rollLoot(catalog, { v: 1, source: 'vault', depth: spec.depth, presetId: spec.preset,
        rarityFindBp: 0, claimedUniqueIds: [...claimed], itemClass: 'weapon', baseId: 'dagger', highValue: false }, random);
      for (const generated of result.items) {
        if (spec.affixes !== null && (generated.data.rarity !== 'rare' || generated.data.affixes.length !== spec.affixes)) continue;
        assert.ok(validateLootItemData(generated.data, catalog));
        data.push(generated); if (generated.data.uniqueId) claimed.add(generated.data.uniqueId);
      }
    }
    assert.equal(data.length, 2000);
    function project(withData) {
      items.forEach((item,index)=>{
        const generated=data[index];
        item.identified=generated.native.identified; item.canBeIdentified=!item.identified;
        item.isCursed=generated.native.isCursed; item.enchantment=generated.native.enchantment;
        if(generated.native.runicType!==null)item.runicType=generated.native.runicType;else delete item.runicType;
        if(withData)item.moduleData={c6fixture:structuredClone(generated.data)};else delete item.moduleData;
      });
      const snapshot=game.toSnapshot();snapshot.savedAt=0;return snapshot;
    }
    const control = project(false), candidate = project(true);
    const controlBytes = encode(control), candidateBytes = encode(candidate);
    const parsed = JSON.parse(new TextDecoder().decode(candidateBytes));
    assert.deepEqual(rows(parsed).filter(r => ids.has(r.id)).map(r => r.moduleData),
      rows(candidate).filter(r => ids.has(r.id)).map(r => r.moduleData));
    const itemRows=items.map(serializeItem), allocator=getNextEntityId();
    const decodeItems=()=>{const decoded=itemRows.map(row=>deserializeItem(row));restoreNextEntityId(allocator);return decoded;};
    assert.deepEqual(decodeItems().map(i=>i.moduleData),items.map(i=>i.moduleData));
    const wholeProjection=bench(()=>game.toSnapshot());
    const serializeTiming=bench(()=>items.map(serializeItem));
    const deserializeTiming=bench(decodeItems);
    const encodeTiming=bench(()=>encode(game.toSnapshot()));
    const decodeWhole=bench(()=>{assert.ok(game.loadSnapshot(JSON.parse(new TextDecoder().decode(candidateBytes))));});
    assert.deepEqual(rows(game.toSnapshot()).filter(r=>ids.has(r.id)).map(r=>r.moduleData),rows(candidate).filter(r=>ids.has(r.id)).map(r=>r.moduleData));
    const histogram = {};
    data.forEach(({ data: d }) => { const key = `${d.rarity}:${d.affixes.length}`; histogram[key] = (histogram[key] ?? 0) + 1; });
    const row = { name: spec.name, attempts, randomCalls: calls - callsBefore, histogram,
      bytes: { controlSnapshot: controlBytes.length, candidateSnapshot: candidateBytes.length,
        delta: candidateBytes.length - controlBytes.length, perItemDelta: (candidateBytes.length - controlBytes.length) / 2000,
        itemDataOnly: data.reduce((n, x) => n + encode(x.data).length, 0) },
      candidateSha256: sha(candidateBytes), timing: {
        controlEncode: bench(() => encode(control)), candidateEncode: bench(() => encode(candidate)),
        candidateParse: bench(() => JSON.parse(new TextDecoder().decode(candidateBytes))),
        wholeProjection, serialize2000:serializeTiming, deserialize2000:deserializeTiming, productionProjectionAndEncode:encodeTiming, productionParseAndLoad:decodeWhole } };
    cases.push(row);
    const current=[];const {forEachItemRoot}=await load('/src/engine/Core/WorldItemRoots.ts');forEachItemRoot(game,i=>{if(ids.has(i.id))current.push(i);});const currentById=new Map(current.map(i=>[i.id,i]));items=items.map(i=>currentById.get(i.id));
    process.stdout.write(JSON.stringify(row) + '\n');
  }
  const nativeTiming = { serialize2000Items: bench(() => items.map(serializeItem)),
    toSnapshot: bench(() => game.toSnapshot()) };
  assert.equal(JSON.stringify(rng.getState()), rngBefore);
  const after = await sourceHash(); assert.equal(after, before);
  const result = { schema: 1, baseline: git('rev-parse', 'HEAD').trim(), coreCommit,
    node: process.version, nodeOptions: process.env.NODE_OPTIONS, cpu: os.cpus()[0].model,
    platform: `${os.platform()}-${os.arch()}`, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(),
    sourceBefore: before, sourceAfter: after, coreIdentity: getLootPackIdentity(), effectiveFingerprint: catalog.fingerprint,
    scale: { designatedItems: 2000, inventory: 26, floorCounts: [494,494,493,493], nativeSnapshotItemRows: rows(base).length },
    warmups, samples, nativeTiming, cases, rngUnchangedDuringMeasurements: true,
    limitations: 'Synthetic ownership/placement, all dagger bases, sampled vault data; no natural distribution claim. Production Item serialize/deserialize and Game save validation/load used. Pinned loot pure validator runs under c6fixture ownership, not a real loot manifest. No natural distribution, replay, worker transport, compression, durable storage or UI performance claim. Concurrent external test load may affect timings.' };
  harness.dispose();
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output, sourceUnchanged: true, nativeTiming }) + '\n');
} finally { await server?.close(); await rm(scratch, { recursive: true, force: true }); }

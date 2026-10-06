/** 5A0 read-only volume probe. No test/build membership; no browser storage.
 * Run from repository root with Node 24.19.0 and NODE_OPTIONS=--max-old-space-size=3072.
 * node scripts/phase5a0-size-probe.mjs <frozen-source-root> <output-json>
 * The in-memory registry instrumentation installs a data-only volume fixture.
 * Native Game/level/entity/checkpoint/save/export implementations stay unchanged.
 * Simulated construction/container/work data is NOT an implemented C5 capability.
 */
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { writeFile, readFile, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import assert from 'node:assert/strict';

assert.equal(process.version, 'v24.19.0', 'Use the task-specified Node version');
assert.equal(process.env.NODE_OPTIONS, '--max-old-space-size=3072');
const root = resolve(process.argv[2] ?? '.');
const output = resolve(process.argv[3] ?? '/private/tmp/phase5a0-size-results.json');
const fixtureKey = '__broguePhase5a0VolumeFixture';
globalThis[fixtureKey] = {};
let injected = 0;
const server = await createServer({ root, configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
  plugins: [{ name: 'phase5a0-memory-only-registry', enforce: 'pre',
    transform(code, id) {
      if (id !== join(root, 'src/ext/catalog.ts')) return;
      const needle = 'return registryFromDescriptors(descriptors);';
      assert.equal(code.split(needle).length, 2);
      injected++;
      return code.replace(needle, `const registry = registryFromDescriptors(descriptors);
        registry.register('sizeprobe', '1.0.0', () => ({ id:'sizeprobe', version:'1.0.0',
          initialState:()=>globalThis.${fixtureKey},
          validateState: v => v !== null && typeof v === 'object' }));
        return registry;`);
    } }],
});
const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { n: values.length, medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1) };
};
function bench(fn, n = 9, warmup = 2) {
  for (let i = 0; i < warmup; i++) fn();
  const values = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now(); fn(); values.push(performance.now() - start);
  }
  return stats(values);
}
async function sourceHash() {
  const rows = [];
  async function scan(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (entry.isFile()) rows.push([relative(root, file), sha(await readFile(file))]);
    }
  }
  for (const folder of ['src', 'scripts', 'public']) await scan(join(root, folder));
  for (const file of ['package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json']) {
    rows.push([file, sha(await readFile(join(root, file)))]);
  }
  rows.sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
  return { files: rows.length, sha256: sha(JSON.stringify(rows)) };
}
const sourceBefore = await sourceHash();
try {
  const { createHeadlessGame } = await server.ssrLoadModule('/src/test/harness.ts');
  const { Monster } = await server.ssrLoadModule('/src/entities/Monster.ts');
  const { Item, ItemCategory } = await server.ssrLoadModule('/src/engine/Items/Item.ts');
  const { serializeItem } = await server.ssrLoadModule('/src/engine/Core/EntitySnapshot.ts');
  const { rng } = await server.ssrLoadModule('/src/engine/Random.ts');
  const { canonical } = await server.ssrLoadModule('/src/ext/json.ts');
  const { logger } = await server.ssrLoadModule('/src/engine/Systems/Logger.ts');
  const monsterData = (await server.ssrLoadModule('/src/data/monsters.json')).default;
  const rat = monsterData.find(row => row.id === 'rat');
  assert.ok(rat);
  assert.equal(injected, 1);
  const results = [];
  const cases = [
    { name: 'control-1-floor', camps: 0, floors: 1, residentsPerCamp: 0, cellsPerCamp: 0, boxesPerCamp: 0, stacksPerBox: 0, ordersPerCamp: 0 },
    { name: 'one-camp', camps: 1, floors: 1, residentsPerCamp: 16, cellsPerCamp: 384, boxesPerCamp: 16, stacksPerBox: 64, ordersPerCamp: 32 },
    { name: 'eight-camps-legal', camps: 8, floors: 8, residentsPerCamp: 8, cellsPerCamp: 384, boxesPerCamp: 16, stacksPerBox: 63, ordersPerCamp: 32 },
    { name: 'eight-camps-stress-not-legal', camps: 8, floors: 8, residentsPerCamp: 16, cellsPerCamp: 480, boxesPerCamp: 16, stacksPerBox: 63, ordersPerCamp: 32 },
  ];
  for (const spec of cases) {
    globalThis[fixtureKey] = {};
    const g = createHeadlessGame(51005000, 'wizard');
    g.startNewGame({ seed: 51005000, mode: 'wizard', ruleSet: 'extended', extensions: ['sizeprobe'] });
    g.animationEnabled = false;
    g.onRenderRequested = () => {};
    // Native generated maps and ownership handoff, synthetic travel only.
    for (let depth = 2; depth <= spec.floors; depth++) {
      g.depth = depth; g.generateDepth(false, false); g.update();
    }
    const levels = [...g.levels].map(([depth, level]) => ({ depth, ...level }));
    levels.push({ depth: g.depth, grid: g.grid, monsters: g.monsters, items: g.items });
    levels.sort((a,b) => a.depth - b.depth);
    const fixture = { schema: 1, simulationTicks: 32000, levelDirectory: [], structures: [],
      containers: [], itemRows: [], resourceNodes: [], workTickets: [], offlineLedgers: [],
      camps: [], residents: [], orders: [], nextWorldId: 1, nextPlanId: 9, history: [] };
    let worldId = 1;
    for (let camp = 0; camp < spec.camps; camp++) {
      const level = levels[camp], levelRef = { kind: 'dungeon', depth: level.depth };
      const regionId = camp + 1, campId = `settlement.slot.${camp + 1}.instance.1`;
      fixture.levelDirectory.push({ levelRef, generated: true, generatedBy: `dungeon.seed.${level.depth}`,
        residence: level.depth === g.depth ? 'active' : 'cached', revision: 37,
        lastDepartedTick: 1000, persistenceReasons: ['camp','container','resident','work'],
        policy: 'frozen-ecology-economy-v1' });
      fixture.camps.push({ id: campId, slot: camp, regionId, levelRef,
        bounds: { x: 2, y: 2, width: 24, height: 20 }, revision: 37, creationOrdinal: 1, lastEventOrdinal: 32 });
      for (let cell = 0; cell < spec.cellsPerCamp; cell++) {
        const id = worldId++, at = { x: 2 + cell % 24, y: 2 + Math.floor(cell / 24) };
        const part = slot => ({ id: `${id}.${slot}`, definitionId: `settlement.${slot}.wood`,
          hp: 80, maxHp: 100, revision: 4, doorOpen: null,
          materials: [{ itemDefinitionId: 'crafting.wood', count: 2 }] });
        fixture.structures.push({ id, owner: 'settlement', regionId, levelRef, at,
          floor: part('floor'), barrier: part('wall'), roof: part('roof'), fixture: part('bed') });
      }
      const floorCells = [];
      for (let y = 1; y < level.grid.height - 1; y++) for (let x = 1; x < level.grid.width - 1; x++) {
        if (level.grid.getCell(x,y).isPassable) floorCells.push({x,y});
      }
      assert.ok(floorCells.length >= spec.residentsPerCamp);
      const residentIds = [];
      for (let resident = 0; resident < spec.residentsPerCamp; resident++) {
        const at = floorCells[resident], actor = new Monster(at.x, at.y, rat);
        actor.isAlly = true; actor.boundToPlayer = false; actor.doesNotTrackLeader = true;
        level.monsters.push(actor); residentIds.push(actor.id);
        fixture.residents.push({ actorId: actor.id, campId, levelRef, bedStructureId: resident + camp * spec.cellsPerCamp + 1,
          shortage: 0, foodUnits: 32, schedule: 'work-rest-guard', ticketId: resident + camp * 16 + 1, revision: 17 });
      }
      const containerIds = [];
      for (let box = 0; box < spec.boxesPerCamp; box++) {
        const id = worldId++, itemIds = [];
        for (let slot = 0; slot < spec.stacksPerBox; slot++) {
          // Real native Item construction/explicit serializer; future MATERIAL
          // fields exist only in the data fixture. Item rows have one simulated
          // container owner and are not additionally placed in native floor roots.
          const item = new Item('probe-material', '%', 0xaaaaaa, ItemCategory.FOOD);
          item.quantity = 99; item.identified = true; item.loc = { x: 0, y: 0 };
          itemIds.push(item.id);
          fixture.itemRows.push({ ...serializeItem(item), definitionId: 'crafting.wood', quality: 'basic', category: 'MATERIAL' });
        }
        containerIds.push(id);
        fixture.containers.push({ id, owner: 'settlement', levelRef, at: { x: 3 + box, y: 3 },
          structureId: camp * spec.cellsPerCamp + box + 1, kind: 'chest', capacity: 64,
          itemIds, revision: 17, outputReservedSlots: 1 });
      }
      for (let node = 0; node < 32; node++) fixture.resourceNodes.push({ id: worldId++, owner: 'sizeprobe',
        definitionId: 'crafting.wood-node', instanceKey: `resource.${camp}.${node}`, levelRef,
        at: { x: 2 + node % 24, y: 2 + Math.floor(node / 24) }, capacity: 20,
        remaining: 12, reservedUnits: 1, regenRemainder: 731, lastSettledTick: 32000, revision: 17 });
      for (let ticket = 0; ticket < spec.residentsPerCamp; ticket++) fixture.workTickets.push({
        ticketId: ticket + camp * 16 + 1, owner: 'sizeprobe', actorId: residentIds[ticket], levelRef,
        sourceIds: [containerIds[ticket % containerIds.length]], definitionId: 'crafting.kit-bed',
        inputEscrow: { itemIds: [], reservedUnits: [{ itemDefinitionId: 'crafting.wood', count: 4 }] },
        outputReservation: { containerId: containerIds[ticket % containerIds.length], slots: 1 },
        remainingTicks: 300, completedBatches: 3, totalBatches: 16, status: 'suspended', revision: 17 });
      for (let order = 0; order < spec.ordersPerCamp; order++) fixture.orders.push({ id: `order.${camp}.${order}`,
        campId, actorId: residentIds[order % residentIds.length], definitionId: 'crafting.kit-bed', priority: order,
        remainingEpochs: 29, producedNextEpoch: [], status: 'working', revision: 17 });
      fixture.offlineLedgers.push({ levelRef, lastSettledTick: 32000, epochRemainder: 0, revision: 17,
        planId: camp + 1, remainingEpochs: 29, seedKey: sha(campId), lastEventOrdinal: 32,
        structureRevision: 37, routes: residentIds.map(actorId => ({actorId, distance: 10, reachable: true})),
        pendingOutputs: [], residentIds, stoppedReason: null });
    }
    fixture.nextWorldId = worldId;
    for (let i = 0; i < (spec.camps ? 128 : 0); i++) fixture.history.push({ ordinal: i + 1,
      levelRef: { kind: 'dungeon', depth: i % spec.floors + 1 }, kind: 'work-stopped', reason: 'needs-resupply', tick: 32000 });
    // Rehydrate the same production runtime using a proper registered module
    // state. The initial world was generated before the volume fixture; this is
    // deliberately not a naturally reachable recording or replay acceptance test.
    const { ExtensionRuntime } = await server.ssrLoadModule('/src/ext/runtime.ts');
    const { createExtensionRegistry } = await server.ssrLoadModule('/src/ext/catalog.ts');
    const old = g.extensionRuntime.snapshot();
    old.modules.sizeprobe = JSON.parse(JSON.stringify(fixture));
    g.extensionRuntime.unload();
    g.extensionRuntime = new ExtensionRuntime(createExtensionRegistry(), old.manifest,
      { depth: () => g.depth, playerId: () => g.player.id, turn: () => g.absoluteTurnNumber,
        randomInt: () => { throw new Error('Volume fixture must not draw RNG'); }, message: () => {} }, old);
    const nativeSnapshot = g.toSnapshot();
    const nativeItems = new Set([nativeSnapshot.items, nativeSnapshot.player.inventory,
      ...nativeSnapshot.levels.map(level => level.items), nativeSnapshot.entityGraph.items]
      .flat().map(item => item.id)).size;
    const scale = { ...spec, residents: fixture.residents.length, structureCells: fixture.structures.length,
      structureParts: fixture.structures.length * 4, boxes: fixture.containers.length,
      simulatedStacks: fixture.itemRows.length, nativeItemRoots: nativeItems,
      totalItemRoots: nativeItems + fixture.itemRows.length, resourceNodes: fixture.resourceNodes.length,
      tickets: fixture.workTickets.length, orders: fixture.orders.length, regionArea: spec.camps * 480 };
    if (spec.name === 'eight-camps-legal') {
      assert.ok(scale.totalItemRoots <= 8192); assert.equal(scale.residents, 64);
      assert.equal(scale.structureCells, 3072); assert.equal(scale.structureParts, 12288);
    }
    const rngBefore = JSON.stringify(rng.getState());
    // Use the actual JSON boundary before canonical hashing: native explicit
    // field projections may contain undefined, which JSON saves omit.
    const worldBefore = JSON.parse(JSON.stringify(g.toSnapshot()));
    const snapshotAtZero = g.toSaveSnapshot();
    const recordAtZero = g.exportRecording();
    const extension = g.extensionRuntime.snapshot();
    const summary = { algorithm: 'sha256-c5-state-v1', digest: sha(canonical(worldBefore)),
      foundation: 5, simulationTicks: fixture.simulationTicks, levelRef: { kind: 'dungeon', depth: g.depth },
      worldRevision: 37, nextWorldId: worldId, offlineSeedDigest: sha(canonical(fixture.offlineLedgers)) };
    const canonicalText = canonical(worldBefore);
    const row = { name: spec.name, scale, bytes: { fixture: bytes(fixture), extensionCheckpoint: bytes(extension),
      worldAtZero: bytes(worldBefore), saveAtZero: bytes(snapshotAtZero), recordingAtZero: bytes(recordAtZero),
      canonicalWorld: Buffer.byteLength(canonicalText), digestSummary: bytes(summary) },
      timing: { extensionSnapshot: bench(() => g.extensionRuntime.snapshot()),
        toSnapshot: bench(() => g.toSnapshot()), toSaveSnapshotAtZero: bench(() => g.toSaveSnapshot()),
        stringifySaveAtZero: bench(() => JSON.stringify(snapshotAtZero)), parseSaveAtZero: bench(() => JSON.parse(JSON.stringify(snapshotAtZero)), 9, 2),
        canonicalWorld: bench(() => canonical(worldBefore)), sha256Preencoded: bench(() => sha(canonicalText)),
        canonicalAndHash: bench(() => sha(canonical(worldBefore))) }, prefixes: [] };
    // parse cost separately from stringify (above combined row is labelled).
    const saveText = JSON.stringify(snapshotAtZero);
    row.timing.parseOnlySaveAtZero = bench(() => JSON.parse(saveText));
    // 64 actual zero-time public commands, deliberately identical large state.
    // No huge 10,000-event array or GiB artifact is allocated: that row is an
    // constant-state byte calculation, explicitly an extrapolation.
    for (let index = 1; index <= 64; index++) {
      while (logger.pendingAcknowledgment) logger.acknowledgeNext();
      const start = performance.now(); g.executeCommand('escape');
      (row.commandMs ??= []).push(performance.now() - start);
      assert.equal(g.recordedInputEvents.length, index);
      if (![1,16,64].includes(index)) continue;
      const recording = g.exportRecording(), save = g.toSaveSnapshot();
      row.prefixes.push({ commands: index, recordingBytes: bytes(recording), saveBytes: bytes(save),
        hasRecordingOrigin: !!save.run.recordingOrigin,
        exportRecording: bench(() => g.exportRecording(), 5, 1),
        stringifyRecording: bench(() => JSON.stringify(recording), 5, 1),
        toSaveSnapshot: bench(() => g.toSaveSnapshot(), 5, 1),
        stringifySave: bench(() => JSON.stringify(save), 5, 1) });
    }
    row.timing.executeEscape = stats(row.commandMs); delete row.commandMs;
    assert.equal(JSON.stringify(rng.getState()), rngBefore, 'Encoding/probe commands consumed RNG');
    const event = g.exportRecording().events.at(-1), reduced = { ...event, extensions: summary };
    row.bytes.fullEvent = bytes(event); row.bytes.summaryEvent = bytes(reduced);
    const projectedLength = (count, eventRow) => {
      const { index: ignored, ...rest } = eventRow;
      return row.bytes.recordingAtZero - 2 + 2 + (count ? count - 1 : 0)
        + count * (bytes({ index: 0, ...rest }) - 1)
        + Array.from({length:count}, (_,i) => String(i).length).reduce((a,b) => a+b, 0);
    };
    const seekSnapshot = structuredClone(worldBefore);
    seekSnapshot.run.recordedInputEvents = [];
    delete seekSnapshot.run.recordingOrigin;
    row.bytes.seekSnapshot = bytes(seekSnapshot);
    row.projections = [1000,10000].map(commands => ({ commands, fullRecordingBytes: projectedLength(commands, event),
      summaryRecordingBytes: projectedLength(commands, reduced),
      periodic: [256,1024,2048].map(period => ({ period, snapshotsIncludingInitial: 1 + Math.floor(commands / period),
        bytes: projectedLength(commands, reduced) + (1 + Math.floor(commands / period)) * row.bytes.seekSnapshot })) }));
    row.rngUnchangedDuringMeasurements = true;
    row.initialRecordingNote = 'Synthetic world/state installed after new-game origin; exported checkpoints and save-prefix bytes are real, but reachability/replay/load/continuation are not tested.';
    results.push(row);
    process.stdout.write(JSON.stringify({ case: row.name, scale, bytes: row.bytes, timing: row.timing,
      prefixes: row.prefixes.map(({commands, recordingBytes,saveBytes,hasRecordingOrigin}) => ({commands,recordingBytes,saveBytes,hasRecordingOrigin})) }) + '\n');
    g.extensionRuntime.unload();
    g.recordedInputEvents.length = 0;
    globalThis[fixtureKey] = {};
    globalThis.gc?.();
  }
  const sourceAfter = await sourceHash();
  assert.deepEqual(sourceAfter, sourceBefore);
  const report = { schema: 1, runtime: process.version, nodeOptions: process.env.NODE_OPTIONS, root,
    cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(), platform: `${os.platform()}-${os.arch()}`,
    sourceBefore, sourceAfter, cases: results, method: '2 warmups/9 samples; prefix export/save 1 warmup/5 samples. Native generated 79x29 floors; in-memory data-only module and synthetic residents/container/work state. Byte projections assume constant state and measured event layout. No compression/storage IO/UI/natural long play/new mechanics acceptance.' };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output, sourceBefore, sourceAfter }) + '\n');
} finally {
  await server.close(); delete globalThis[fixtureKey];
}

import { getBoltForItem } from '../engine/Combat/Bolt';
import { traceBolt } from '../engine/Combat/BoltTrajectory';
import { c5Canonical } from '../engine/Core/WorldCanonical';
import { referenceDigest, referenceMerkle } from './support/recordingDigestPreReview';
import { afterEach, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import { worldWorkLastError, withWorldActorScope } from '../engine/Core/WorldWork';
import { exposeTileToFire } from '../engine/Map/Promotion';
import { TerrainType, DungeonLayer } from '../engine/Map/Grid';
import {
  bindWorldStructures,
  settleStructureFoundations,
  computeRooms,
  planRegionChange
} from '../engine/Map/StructureWorld';
import { sha256 } from '../ext/fingerprint';
import {
  world5DigestLeaves,
  world5CanonicalLeaf,
  eventDigest,
  mechanicalDigest
} from '../engine/Core/RecordingDigest';
import { cellAppearance } from '../engine/UI/Appearance';
import { knownCellFlags } from '../engine/Map/CellProperties';
import { T_OBSTRUCTS_PASSABILITY } from '../engine/Map/TerrainCatalog';
import { spawnMapDF } from '../engine/Map/DungeonFeature';
import { assembleWorldItem } from '../engine/Items/WorldItems';
import { itemDefinition, putContainer, clearWorldCell } from '../engine/Core/WorldWorkWorld';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Monster, MonsterState } from '../entities/Monster';
import monsters from '../data/monsters.json';
import type { MonsterData } from '../entities/Monster';
afterEach(() => vi.restoreAllMocks());
it('P1-1 native writes only enqueue; one settlement refreshes a dirty layer once', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'floor');
  const spy = vi.spyOn(g, 'refreshStructureDerivedState');
  for (let x = 40; x < 70; x++)
    g.grid.setTerrainLayer(x, 5, DungeonLayer.LIQUID, TerrainType.WATER_DEEP);
  expect(spy).not.toHaveBeenCalled();
  settleStructureFoundations(g);
  expect(spy).toHaveBeenCalledOnce();
  settleStructureFoundations(g);
  expect(spy).toHaveBeenCalledOnce();
});
it('P1-1 R9 settles at the boundary and a publication fault preserves items, native foundation and elapsed command', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'chest')!.fixture!;
  const e = g.extensionRuntime!.worldWorkEntities().find((e) => e.x === 21 && e.y === 10)!;
  const chest = g.world5!.containers.find(
    (v) => v.position?.kind === 'interactable' && v.position.interactableId === e.id
  )!;
  const item = assembleWorldItem(itemDefinition(g, 'c5fixture.stone'), 7);
  putContainer(g, chest.id, item);
  const original = g.grid.getCell(21, 10)!.layers.slice(),
    remove = g.extensionRuntime!.worldStructureRemoveInteractable.bind(g.extensionRuntime!);
  vi.spyOn(g.extensionRuntime!, 'worldStructureRemoveInteractable').mockImplementation((id) => {
    remove(id);
    throw Error('publish');
  });
  g.grid.setTerrainLayer(21, 10, DungeonLayer.LIQUID, TerrainType.WATER_DEEP);
  expect(g.world5!.structures[0]!.fixture!.id).toBe(c.id);
  const tick = g.world5!.simulationTicks;
  expect(() => g.executeCommand('wait')).not.toThrow();
  expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
  expect(g.grid.getCell(21, 10)!.layers).toEqual(original);
  expect(g.worldContainerItems!.get(item.id)).toBe(item);
  expect(chest.itemIds).toContain(item.id);
  expect(g.world5!.receipts.filter((r) => r.reason === 'C5_TRANSACTION')).toHaveLength(1);
  expect(() => g.toSaveSnapshot()).not.toThrow();
});
it('P1-2 clock writes reuse per-layer structures and dirty/full domains agree', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'floor')!.floor!;
  const first = world5DigestLeaves(g.world5!, null, null, true);
  g.executeCommand('wait');
  expect(world5DigestLeaves(g.world5!, null, null, true)['structures.1']).toBe(
    first['structures.1']
  );
  c.hp--;
  c.revision++;
  bindWorldStructures(g, 1);
  g.executeCommand('escape');
  const full = mechanicalDigest((g as any).projectWholeRun(), (g as any).recordingInputState());
  expect((g as any).recordingEventDigest(g.extensionRuntime!.manifest).domains.world5).toBe(
    full.domains.world5
  );
  expect(
    eventDigest(
      g.extensionRuntime!.snapshot(),
      g.world5!,
      g.extensionRuntime!.manifest,
      g.actorActions ?? null,
      g.worldWorkFacts ?? null,
      g.worldWorkDetails ?? null
    )!.domains.world5
  ).toBe(full.domains.world5);
});
it('P1-3 player can close an enclosure door and construct while it is shut', () => {
  const { g } = structureHarness();
  createCamp(g);
  const door = build(g, 'door')!.barrier!;
  fixture(g, 'structure', {
    kind: 'door',
    componentId: door.id,
    revision: door.revision,
    open: true
  });
  for (const [dx, dy] of [
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [0, -1],
    [-1, 0],
    [0, 1]
  ]) {
    build(g, 'wall', { x: 20 + dx!, y: 10 + dy! });
    expect(worldWorkLastError(g)).toBeNull();
  }
  fixture(g, 'structure', {
    kind: 'door',
    componentId: door.id,
    revision: door.revision,
    open: false
  });
  expect(worldWorkLastError(g)).toBeNull();
  expect(g.grid.getCell(21, 10)!.isPassable).toBe(false);
  build(g, 'roof', { x: 21, y: 10 });
  expect(worldWorkLastError(g)).toBeNull();
});
it('P2-1 generation nodes and outside-region orders do not reserve an empty camp', () => {
  const { g } = structureHarness();
  const e = g
    .extensionRuntime!.worldWorkEntities()
    .find((e) => g.world5!.nodes.some((n) => n.interactableId === e.id))!;
  Object.assign(e, { x: 21, y: 12 });
  g.world5!.nodes.find((n) => n.interactableId === e.id)!.at = { x: 21, y: 12 };
  const region = createCamp(g);
  expect(worldWorkLastError(g)).toBeNull();
  fixture(g, 'region', { kind: 'retire', regionId: region.id, revision: region.revision });
  expect(worldWorkLastError(g)).toBeNull();
});
it('P2-2 remains is reachable outside camp and overflow retains a native floor owner', () => {
  const { g } = structureHarness();
  const r = createCamp(g),
    c = build(g, 'chest')!.fixture!;
  const remains = g.world5!.containers.find((v) => v.kind === 'remains')!,
    e = g
      .extensionRuntime!.worldWorkEntities()
      .find((e) => e.id === (remains.position as { interactableId: number }).interactableId)!;
  expect(
    e.x < r.bounds.x ||
      e.y < r.bounds.y ||
      e.x >= r.bounds.x + r.bounds.width ||
      e.y >= r.bounds.y + r.bounds.height
  ).toBe(true);
  const up: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < 28; y++)
    for (let x = 1; x < 78; x++)
      if (g.grid.getCell(x, y)!.layers.includes(TerrainType.STAIRS_UP)) up.push({ x, y });
  const near = (p: { x: number; y: number }) =>
    Math.min(...up.map((s) => Math.abs(p.x - s.x) + Math.abs(p.y - s.y)));
  const distances: number[] = [];
  for (let y = 1; y < 28; y++)
    for (let x = 1; x < 35; x++)
      if (
        (x < 17 || x >= 26 || y < 7 || y >= 16) &&
        (g.grid.getCell(x, y)!.hasMemory ||
          g.grid.getCell(x, y)!.isExplored ||
          g.grid.getCell(x, y)!.isVisible) &&
        clearWorldCell(g, { x, y })
      )
        distances.push(near({ x, y }));
  expect(near(e)).toBeLessThanOrEqual(Math.min(...distances));
  const chest = g.world5!.containers.find(
    (v) =>
      v.kind === 'chest' &&
      v.position?.kind === 'interactable' &&
      g
        .extensionRuntime!.worldWorkEntities()
        .some(
          (e) =>
            e.id === (v.position as { interactableId: number }).interactableId &&
            e.x === 21 &&
            e.y === 10
        )
  )!;
  const item = assembleWorldItem(itemDefinition(g, 'c5fixture.stone'), 7);
  putContainer(g, chest.id, item);
  remains.capacity = 1;
  putContainer(g, remains.id, assembleWorldItem(itemDefinition(g, 'c5fixture.stone'), 1));
  for (let y = 9; y <= 11; y++)
    for (let x = 20; x <= 22; x++)
      if (x !== 21 || y !== 10) g.grid.setTerrain(x, y, TerrainType.WALL);
  fixture(g, 'structure', {
    kind: 'damage',
    componentId: c.id,
    revision: 0,
    amount: 100,
    damageKind: 'physical'
  });
  expect(worldWorkLastError(g)).toBeNull();
  expect(g.items.filter((i) => i.id === item.id)).toEqual([item]);
  expect(g.worldContainerItems!.has(item.id)).toBe(false);
  expect(item.quantity).toBe(7);
});
it('P2-3 surface wave cannot propagate through a structure wall but may originate there', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'wall');
  for (let y = 1; y < 28; y++)
    for (let x = 1; x < 78; x++)
      if (y !== 10 || x < 20 || x > 22) g.grid.setTerrain(x, y, TerrainType.WALL);
  const wave = new Uint8Array(79 * 29);
  spawnMapDF(g.grid, 20, 10, TerrainType.NOTHING, false, 100, 100, wave);
  expect(wave[10 * 79 + 21]).toBe(0);
  expect(wave[10 * 79 + 22]).toBe(0);
  const source = new Uint8Array(79 * 29);
  spawnMapDF(g.grid, 21, 10, TerrainType.NOTHING, false, 100, 100, source);
  expect(source[10 * 79 + 21]).toBe(1);
});
it('P2-4 clean room reads reuse the same immutable layer result', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'floor');
  const a = computeRooms(g, { kind: 'dungeon', depth: 1 });
  expect(computeRooms(g, { kind: 'dungeon', depth: 1 })).toBe(a);
  g.grid.setTerrain(22, 10, TerrainType.WALL);
  const b = computeRooms(g, { kind: 'dungeon', depth: 1 });
  expect(b).not.toBe(a);
  expect(computeRooms(g, { kind: 'dungeon', depth: 1 })).toBe(b);
});
it('P2-5 SHA bytes match an independent implementation for Unicode and block boundaries', () => {
  for (const text of [
    '',
    '中文🎲',
    ...Array.from({ length: 140 }, (_, n) => 'x'.repeat(n)),
    'z'.repeat(1048576)
  ])
    expect(sha256(text)).toBe(createHash('sha256').update(text).digest('hex'));
});
it('P3 memory preserves a structure glyph and zero-time render does not consult definitions', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'wall');
  const cell = g.grid.getCell(21, 10)!;
  expect(cell.rememberedAppearance!.char).toBe('#');
  vi.spyOn(g.extensionRuntime!, 'worldDefinitionPacks').mockImplementation(() => {
    throw Error('render must use the published appearance');
  });
  expect(cellAppearance(cell, { depth: 1 } as any)!.char).toBe('#');
  cell.isVisible = false;
  expect(cellAppearance(cell, { depth: 1 } as any)!.char).toBe('#');
  expect(knownCellFlags(cell) & T_OBSTRUCTS_PASSABILITY).not.toBe(0);
});
it.each(['tunnel', 'shatter'])('P3 %s destroys a structural barrier', (kind) => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'wall');
  g.executeCommand('escape', undefined, () =>
    kind === 'tunnel' ? (g as any).tunnelAt({ x: 21, y: 10 }) : (g as any).crystalizeFromPlayer(2)
  );
  expect(g.world5!.structures).toHaveLength(0);
  expect(g.grid.getCell(21, 10)!.isPassable).toBe(true);
});
it('P3 unseen actual work cells give the same error before inspecting hidden actors/machines', () => {
  const { g } = structureHarness();
  createCamp(g);
  g.grid.getCell(21, 10)!.isVisible = false;
  build(g, 'floor');
  expect(worldWorkLastError(g)).toBe('C5_BLOCKED');
  g.grid.getCell(21, 10)!.machineNumber = 99;
  build(g, 'floor');
  expect(worldWorkLastError(g)).toBe('C5_BLOCKED');
});

it('runtime monster sealed behind a closed structural door advances forty turns without passing or stalling', () => {
  const { g } = structureHarness();
  createCamp(g);
  const door = build(g, 'door')!.barrier!;
  for (const [x, y, px, py] of [
    [21, 9, 20, 9],
    [21, 11, 20, 11],
    [22, 9, 22, 8],
    [23, 9, 23, 8],
    [22, 11, 22, 12],
    [23, 11, 23, 12],
    [23, 10, 24, 10]
  ]) {
    g.player.loc = { x: px!, y: py! };
    (g as any).updateVision();
    build(g, 'wall', { x: x!, y: y! });
    expect(worldWorkLastError(g)).toBeNull();
  }
  g.player.loc = { x: 20, y: 10 };
  const rat = new Monster(22, 10, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
  rat.state = MonsterState.HUNTING;
  rat.ticksUntilTurn = 0;
  g.monsters.push(rat);
  g.player.hp = g.player.maxHp;
  const start = g.world5!.simulationTicks;
  for (let n = 0; n < 40; n++) {
    expect(() => g.executeCommand('wait')).not.toThrow();
    expect(rat.loc).toEqual({ x: 22, y: 10 });
    expect(door.doorOpen).toBe(false);
    expect(g.grid.getCell(21, 10)!.isPassable).toBe(false);
  }
  expect(g.world5!.simulationTicks).toBeGreaterThanOrEqual(start + 4000);
  expect(rat.hp).toBeGreaterThan(0);
});

it('P3 magic mapping records structural obstruction and glyphs', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'wall');
  const c = g.grid.getCell(21, 10)!;
  c.isVisible = c.isExplored = c.hasMemory = false;
  const scroll = ItemLoader.spawnScroll('scroll_of_magic_mapping', -1, -1)!;
  g.player.inventory.addItem(scroll);
  g.readItem(scroll);
  expect(c.isMagicMapped).toBe(true);
  expect(c.rememberedTerrainFlags & T_OBSTRUCTS_PASSABILITY).not.toBe(0);
  expect(c.rememberedAppearance!.char).toBe('#');
});

it('P2-5 projection and SHA preserve every unaffected v4 digest byte', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'wall');
  const s = (g as any).projectWholeRun(),
    input = (g as any).recordingInputState(),
    before = JSON.stringify(s),
    old = referenceDigest(s, input),
    next = mechanicalDigest(s, input);
  for (const domain of ['native', 'extensions', 'actorActions', 'knowledge', 'random'] as const)
    expect(next.domains[domain]).toBe(old.domains[domain]);
  expect(next.domains.world5).toBe(
    referenceMerkle(
      'world5',
      world5DigestLeaves(s.run.world5, s.run.worldWorkFacts, s.run.worldWorkDetails)
    )
  );
  expect(JSON.stringify(s)).toBe(before);
});
it('P2-5 2048 snapshot and full digest use one world projection', () => {
  const { g } = structureHarness();
  g.executeCommand('escape');
  const r = g.exportRecording(),
    event = { ...r.events[0]!, index: 2047 },
    spy = vi.spyOn(g as any, 'projectWholeRun');
  (g as any).updateRecordedCheckpoint(event);
  expect(spy).toHaveBeenCalledOnce();
  const exported = g.exportRecording(),
    snapshot = exported.snapshots[exported.snapshots.length - 1]!;
  expect(snapshot.afterCommand).toBe(2048);
  expect(snapshot.checkpoint).toEqual(event.fullCheckpoint);
  const x = snapshot.world.player.loc.x;
  g.player.loc = { x: 9, y: 9 };
  expect(snapshot.world.player.loc.x).toBe(x);
});

it.each(['orders', 'tickets'] as const)(
  'P2-1 only jobs inside the retiring region reserve it: %s',
  (kind) => {
    const { g } = structureHarness(),
      r = createCamp(g),
      actor = g.monsters[0]!;
    actor.loc = { x: 30, y: 20 };
    g.world5!.residents.push({
      owner: 'c5fixture',
      actorId: actor.id,
      campSlotId: 1,
      levelRef: { kind: 'dungeon', depth: 1 },
      revision: 0
    });
    if (kind === 'orders')
      g.world5!.orders.push({
        id: g.world5!.nextWorldId++,
        owner: 'c5fixture',
        actorId: actor.id,
        levelRef: { kind: 'dungeon', depth: 1 },
        definitionId: 'c5fixture.stone-work',
        priority: 0,
        planId: g.world5!.nextPlanId++,
        remainingEpochs: 1,
        ticketId: null,
        status: 'working',
        stopReason: null,
        revision: 0
      });
    else
      g.world5!.tickets.push({
        ticketId: g.world5!.nextWorldId++,
        owner: 'c5fixture',
        actorId: actor.id,
        levelRef: { kind: 'dungeon', depth: 1 },
        kind: 'craft',
        nodeId: null,
        stationId: null,
        sourceContainerId: null,
        definitionId: 'c5fixture.stone-work',
        inputEscrowId: null,
        outputReservation: null,
        refundReservation: null,
        resourceReservation: null,
        totalBatches: 1,
        completedBatches: 0,
        remainingTicks: 100,
        laborCreditTicks: 0,
        bundleActionId: null,
        revision: 0,
        status: 'suspended',
        stopReason: null,
        lastCompletionOrdinal: 0
      });
    const plan = () =>
      withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
        planRegionChange({ kind: 'retire', regionId: r.id, revision: r.revision }, scope)
      );
    expect(plan().ok).toBe(true);
    actor.loc = { x: 22, y: 12 };
    expect(plan()).toMatchObject({ ok: false, code: 'C5_RESERVED' });
  }
);

it('P1-3 a newly built door is an escapable exit for both player and resident', () => {
  const { g } = structureHarness();
  createCamp(g);
  for (let y = 9; y <= 12; y++)
    for (let x = 19; x <= 21; x++)
      if (!((x === 20 && (y === 10 || y === 11)) || (x === 21 && y === 10)))
        g.grid.setTerrain(x, y, TerrainType.WALL);
  const actor = g.monsters[0]!;
  actor.loc = { x: 20, y: 11 };
  g.world5!.residents.push({
    owner: 'c5fixture',
    actorId: actor.id,
    campSlotId: 0,
    levelRef: { kind: 'dungeon', depth: 1 },
    revision: 0
  });
  build(g, 'door');
  expect(worldWorkLastError(g)).toBeNull();
  expect(g.grid.getCell(21, 10)!.isPassable).toBe(false);
  build(g, 'roof');
  expect(worldWorkLastError(g)).toBeNull();
});

it('P1/P2 nonlethal fire changes only HP/revision and the affected digest leaf', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'wall')!.barrier!;
  exposeTileToFire(g.grid, 21, 10, true);
  const spy = vi.spyOn(g, 'refreshStructureDerivedState');
  settleStructureFoundations(g, true);
  expect(c.hp).toBe(90);
  expect(c.revision).toBe(1);
  expect(spy).not.toHaveBeenCalled();
});

it('P3 tunneling excavates a magic-transparent structural window along its travelled ray', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'window');
  g.executeCommand('escape', undefined, () =>
    traceBolt(
      g.grid,
      getBoltForItem('staff_of_tunneling')!,
      g.player.loc,
      { x: 24, y: 10 },
      { caster: g.player, creatureAt: () => undefined },
      { onCell: () => undefined, onTunnel: (p) => (g as any).tunnelAt(p) }
    )
  );
  expect(g.world5!.structures).toHaveLength(0);
});

it('P1-2 cached sparse-row strings match independent canonical bytes before and after HP damage', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'floor')!.floor!;
  const rows = world5DigestLeaves(g.world5!)['structures.1'];
  expect(world5CanonicalLeaf('structures.1', rows)).toBe(
    c5Canonical(['c5-leaf-v1', 'world5', 'structures.1', rows], true)
  );
  c.hp--;
  c.revision++;
  expect(world5CanonicalLeaf('structures.1', rows)).toBe(
    c5Canonical(['c5-leaf-v1', 'world5', 'structures.1', rows], true)
  );
});

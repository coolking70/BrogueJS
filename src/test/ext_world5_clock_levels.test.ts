import { continuingPrefix } from './support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as catalog from '../ext/catalog';
import { ExtensionRegistry } from '../ext/registry';
import { createWorld5Module, fixtureRulesIdentity } from './fixtures/world5-module';
import { createHeadlessGame } from './harness';
import {
  advanceWorldClock,
  assertWorldLevelOwnership,
  checkedAdd,
  compareLevelRefs,
  createWorld5,
  indexWorldLevels,
  levelKey,
  requireDungeon,
  validateWorld5
} from '../ext/world5';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { bodyFixtureDescriptor } from './fixtures/bodyModule';
import { TerrainType } from '../engine/Map/Grid';
import { advancementLoop } from '../engine/Core/TimeCoordinator';
import { Game } from '../engine/Core/Game';
import { c5Canonical } from '../engine/Core/WorldCanonical';
import { logger } from '../engine/Systems/Logger';
import { registerWorld5Fixture, isWorld5Fixture } from '../ext/world5Fixture';
import { getNextEntityId } from '../entities/Creature';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import {
  auditFullObjectGraph,
  fullGenerationRoots
} from './support/fullGenerationCheckpointOracle';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function fixture() {
  const r = new ExtensionRegistry();
  r.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
  vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(r);
  const g = createHeadlessGame(51005001, 'test');
  g.startNewGame({
    seed: 51005001,
    mode: 'test',
    ruleSet: 'extended',
    extensions: ['world5-fixture']
  });
  g.animationEnabled = false;
  return g;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('C5 world clock and layer identity', () => {
  it('review L4: production mode cannot register a module with world5 fixture capabilities', () => {
    const module = { id: 'production-probe', version: '1.0.0', initialState: () => null, validateState: (value: unknown): value is null => value === null };
    vi.stubEnv('DEV', false);
    expect(() => registerWorld5Fixture(module)).toThrow('unavailable');
    expect(isWorld5Fixture(module)).toBe(false);
  });
  it('review H3: a real nine-member body falls into pending before a cached managed lower floor settles', () => {
    const registry = new ExtensionRegistry(), body = bodyFixtureDescriptor();
    registry.register(body.id, body.version, body.create, body.rules);
    registry.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    const g = createHeadlessGame(51005008, 'wizard');
    g.startNewGame({ seed: 51005008, mode: 'wizard', ruleSet: 'extended', extensions: ['world5-fixture', body.id] });
    g.animationEnabled = false;
    g.depth = 2; (g as any).generateDepth(false); g.executeCommand('world5:fixture');
    g.depth = 1; (g as any).generateDepth(true);
    for (let x = 1; x < g.grid.width - 1; x++) for (let y = 1; y < g.grid.height - 1; y++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
    g.monsters = []; g.dormantMonsters = [];
    const core = g.createCompositeMonster('body-fixture.shale-weaver-body', { x: 20, y: 12 })!;
    const actors = [...g.monsters]; expect(actors).toHaveLength(9);
    core.hp = core.maxHp = 500; core.falling = true;
    (g as any).monstersFall();
    expect((g as any).pendingFallenByDepth.get(2)).toEqual(actors);
    expect(actors.every(m => !g.levels.get(2)!.monsters.includes(m))).toBe(true);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
    g.depth = 2; (g as any).generateDepth(false);
    expect((g as any).pendingFallenByDepth.has(2)).toBe(false);
    expect(actors.every(m => g.monsters.some(a => a.id === m.id && !a.preplaced))).toBe(true);
    expect(g.bodyGroups![0]!.members).toHaveLength(9);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
  it('canonical input rejects unsafe numbers and getters and sorts Unicode keys by code point', () => {
    expect(c5Canonical({ '\u{10000}': 2, '\ue000': 1 })).toBe('{"\ue000":1,"\u{10000}":2}');
    expect(c5Canonical(['营地', '\n\b\t\u0001', 0])).toBe('["营地","\\n\\b\\t\\u0001",0]');
    const getter = vi.fn(() => 'dungeon');
    const bad = Object.defineProperty({ depth: 1 }, 'kind', { enumerable: true, get: getter });
    expect(() => c5Canonical(bad)).toThrow();
    expect(() => levelKey(bad as never)).toThrow('C5_BAD_PAYLOAD');
    expect(getter).not.toHaveBeenCalled();
    for (const value of [1.1, Number.MAX_SAFE_INTEGER + 1, { '\ud800': 0 }, '\udc00'])
      expect(() => c5Canonical(value)).toThrow();
  });
  it('encodes and sorts dungeon/site; rejects malformed identities and unsupported mechanics', () => {
    expect(levelKey({ kind: 'dungeon', depth: 40 })).toBe('dungeon.40');
    expect(levelKey({ kind: 'site', id: 'fixture.outpost' })).toBe('site.fixture.outpost');
    expect(
      compareLevelRefs({ kind: 'dungeon', depth: 9 }, { kind: 'dungeon', depth: 10 })
    ).toBeLessThan(0);
    expect(
      compareLevelRefs({ kind: 'dungeon', depth: 40 }, { kind: 'site', id: 'a' })
    ).toBeLessThan(0);
    for (const depth of [0, -1, 41, 1.1, NaN, Number.MAX_SAFE_INTEGER])
      expect(() => levelKey({ kind: 'dungeon', depth })).toThrow('C5_BAD_PAYLOAD');
    expect(() => levelKey({ kind: 'site', id: '营地' })).toThrow('C5_BAD_PAYLOAD');
    expect(() => levelKey({ kind: 'dungeon', depth: 1, extra: 1 } as never)).toThrow(
      'C5_BAD_PAYLOAD'
    );
    expect(() => requireDungeon({ kind: 'site', id: 'fixture.outpost' })).toThrow('C5_UNSUPPORTED');
  });
  it('one elapsed clock covers a real nine-member body, two NPCs and forced paralysis blocks', () => {
    const registry = new ExtensionRegistry(),
      body = bodyFixtureDescriptor();
    registry.register(body.id, body.version, body.create, body.rules);
    registry.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    const g = createHeadlessGame(51005008, 'test');
    g.startNewGame({
      seed: 51005008,
      mode: 'test',
      ruleSet: 'extended',
      extensions: ['world5-fixture', body.id]
    });
    g.animationEnabled = false;
    g.monsters = [];
    g.dormantMonsters = [];
    g.items = [];
    for (let x = 1; x < g.grid.width - 1; x++)
      for (let y = 1; y < g.grid.height - 1; y++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
    g.player.loc = { x: 60, y: 14 };
    const core = g.createCompositeMonster('body-fixture.shale-weaver-body', { x: 20, y: 12 });
    expect(core).not.toBeNull();
    const npc = Array.from(
      { length: 2 },
      (_, n) => new Monster(40 + n * 3, 10, monsters.find((m) => m.id === 'rat')! as MonsterData)
    );
    g.monsters.push(...npc);
    for (const m of g.monsters) m.ticksUntilTurn = 10000;
    g.executeCommand('wait');
    expect(g.world5!.simulationTicks).toBe(100);
    expect(npc.map((m) => m.ticksUntilTurn)).toEqual([9900, 9900]);
    g.player.applyStatus('paralyzed', 3);
    g.executeCommand('wait');
    expect(g.isAdvancing).toBe(false);
    expect(g.world5!.simulationTicks).toBe(400);
    expect(timeSystem.currentTick).toBe(200);
    expect(g.absoluteTurnNumber).toBe(4);
    expect(g.bodyGroups![0]!.members).toHaveLength(9);
  });
  it('No confirmation completes the 2048th input without advancing the clock or taking a suspended snapshot', () => {
    const g = fixture();
    g.monsters = [];
    const at = { x: g.player.x + 1, y: g.player.y };
    g.grid.setTerrain(at.x, at.y, TerrainType.CHASM);
    const c = g.grid.getCell(at.x, at.y)!;
    c.hasMemory = true;
    c.isExplored = true;
    c.isVisible = true;
    c.isDiscovered = true;
    for (let n = 0; n < 2047; n++) g.executeCommand('escape');
    g.onCommandConfirmRequest = () => {};
    const tick = timeSystem.currentTick,
      random = rng.getState();
    g.executeCommand('move', { x: 1, y: 0 });
    expect(g.pendingCommandConfirmation).not.toBeNull();
    expect(g.recordedInputEvents).toHaveLength(2047);
    expect(g.world5!.simulationTicks).toBe(0);
    expect(g.resolveCommandDecision(g.pendingCommandConfirmation!.token, false)).toBe(true);
    expect(g.recordedInputEvents).toHaveLength(2048);
    expect(g.recordedInputEvents[2047]!.decisions).toEqual([false]);
    expect(g.exportRecording().snapshots.map((s) => s.afterCommand)).toEqual([2048]);
    expect(g.world5!.simulationTicks).toBe(0);
    expect(timeSystem.currentTick).toBe(tick);
    expect(rng.getState()).toEqual(random);
  });
  it('real surprise falling and generated-floor warmup add no extra elapsed', () => {
    const g = fixture();
    g.monsters = [];
    const at = { x: g.player.x + 1, y: g.player.y };
    g.grid.setTerrain(at.x, at.y, TerrainType.CHASM);
    g.grid.getCell(at.x, at.y)!.hasMemory = false;
    g.grid.getCell(at.x, at.y)!.isExplored = false;
    g.onConfirmRequest = () => true;
    g.executeCommand('move', { x: 1, y: 0 });
    expect(g.depth).toBe(2);
    expect(g.world5!.simulationTicks).toBe(0);
    expect(timeSystem.currentTick).toBe(100);
    expect(g.absoluteTurnNumber).toBe(0);
    expect(g.world5!.levels.map((l) => levelKey(l.levelRef))).toEqual(['dungeon.1', 'dungeon.2']);
  });
  it('a falling continue resumes the remaining accepted elapsed without charging the landing callback', () => {
    const g = fixture();
    g.monsters = [];
    g.player.ticksUntilTurn = 250;
    const ports = (g as any).timePorts();
    let fell = false;
    const land = vi.fn(() => {
      (g as any).playerFalling = false;
    });
    ports.effects.objectiveTimeBlock = () => {
      if (!fell) {
        (g as any).playerFalling = true;
        fell = true;
      }
    };
    ports.effects.playerFalls = land;
    ports.effects.hasPendingPlayerAction = () => true;
    // The accepted phased owner commits its native timer mirror before a fall.
    ports.actions = {
      cancelDeadActions: () => {},
      isBusy: () => g.player.ticksUntilTurn > 0,
      isDecisionOwner: () => true,
      nextActionBoundary: () => g.player.ticksUntilTurn,
      advanceActionTime: (elapsed: number) => {
        g.player.ticksUntilTurn -= elapsed;
      },
      dispatchActorBoundary: () => 'native-fallback'
    };
    const iterator = advancementLoop(ports, 1);
    while (!iterator.next().done) {}
    expect(land).toHaveBeenCalledTimes(1);
    expect(g.world5!.simulationTicks).toBe(250);
    expect(g.player.ticksUntilTurn).toBe(0);
    expect(timeSystem.currentTick).toBe(0);
  });
  it('clock checks overflow before either field is published', () => {
    const w = createWorld5();
    w.simulationTicks = Number.MAX_SAFE_INTEGER;
    const before = clone(w);
    expect(() => advanceWorldClock(w, 1)).toThrow('C5_OVERFLOW');
    expect(w).toEqual(before);
    w.simulationTicks = 0;
    w.revision = Number.MAX_SAFE_INTEGER;
    expect(() => advanceWorldClock(w, 100)).toThrow('C5_OVERFLOW');
    expect(w.simulationTicks).toBe(0);
    expect(() => checkedAdd(1, -1)).toThrow('C5_BAD_PAYLOAD');
  });
  it('positive elapsed advances once without an actions port; zero input and load do not advance', () => {
    const g = fixture();
    expect(g.world5?.simulationTicks).toBe(0);
    expect(g.extensionRuntime?.actorActionBinding()).toBeNull();
    const before = rng.getState();
    g.executeCommand('escape');
    expect(g.world5?.simulationTicks).toBe(0);
    expect(rng.getState()).toEqual(before);
    for (let i = 0; i < 10; i++) g.executeCommand('wait');
    expect(g.world5!.simulationTicks).toBe(1000);
    expect(g.absoluteTurnNumber).toBe(10);
    expect(timeSystem.currentTick).toBe(1000);
    const save = g.toSaveSnapshot(),
      tick = g.world5!.simulationTicks;
    expect(g.loadSnapshot(save)).toBe(true);
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(g.loadReplay(g.exportRecording())).toBe(true);
    while (g.replayCursor < g.replayEvents.length && !g.replayErrorDisplay) g.replayStep(true);
    expect(g.replayErrorDisplay).toBeNull();
    expect(g.world5!.simulationTicks).toBe(tick);
    g.replaySeek(1);
    expect(g.world5!.simulationTicks).toBe(0);
  });
  it('classic and old extension combinations omit the capability entirely', () => {
    const g = createHeadlessGame(51005002, 'test');
    const before = clone(g.toSnapshot());
    g.executeCommand('wait');
    expect(Object.prototype.hasOwnProperty.call(g, 'world5')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(g.toSnapshot().run, 'world5')).toBe(false);
    const bad = clone(before);
    bad.run.world5 = createWorld5();
    expect(g.loadSnapshot(bad)).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(g, 'world5')).toBe(false);
  });
  it('checks manifest presence, unknown keys, visited index and one writable carrier before retiring the live run', () => {
    const g = fixture(),
      s = g.toSnapshot(),
      player = g.player,
      grid = g.grid,
      w = g.world5;
    expect(s.run.world5!.levels.map((l) => levelKey(l.levelRef))).toEqual(['dungeon.1']);
    for (const mutate of [
      (v: typeof s) => {
        delete v.run.world5;
      },
      (v: typeof s) => {
        (v.run.world5 as any).surprise = 1;
      },
      (v: typeof s) => {
        v.run.world5!.levels[0]!.residence = 'cached';
      },
      (v: typeof s) => {
        v.run.world5!.levels.push({
          ...v.run.world5!.levels[0]!,
          levelRef: { kind: 'dungeon', depth: 2 }
        });
      },
      (v: typeof s) => {
        v.run.world5!.structures.push({} as never);
      },
      (v: typeof s) => {
        v.run.world5!.simulationTicks = -1;
      }
    ]) {
      const bad = clone(s);
      mutate(bad);
      expect(g.loadSnapshot(bad)).toBe(false);
      expect(g.player).toBe(player);
      expect(g.grid).toBe(grid);
      expect(g.world5).toBe(w);
    }
    const active = { grid: {}, monsters: [{ id: 1 }], items: [] };
    expect(() => assertWorldLevelOwnership(active, new Map([[2, active]]))).toThrow(
      'C5_BAD_OWNERSHIP'
    );
    expect(Game.isSnapshot({ ...s, version: 3, schema: 'brogue-web-whole-run-v3' })).toBe(false);
  });
  it('index covers visited levels only and ownership validation rejects orphan records', () => {
    const w = createWorld5(),
      visited = Array.from({ length: 40 }, (_, i) => ({ visited: i === 0 || i === 8 }));
    indexWorldLevels(w, visited, 9);
    expect(w.levels.map((l) => levelKey(l.levelRef))).toEqual(['dungeon.1', 'dungeon.9']);
    const c = {
      active: 9,
      visited,
      cachedDepths: [1],
      owners: [],
      actors: new Map<number, number>()
    };
    expect(() => validateWorld5(w, c)).not.toThrow();
    w.levels[0]!.persistenceReasons = ['resident'];
    expect(() => validateWorld5(w, c)).toThrow('C5_BAD_REFERENCE');
  });
  it('animation yield/resume and iterator retirement retain exactly the elapsed already committed', () => {
    const g = fixture();
    g.animationEnabled = true;
    g.player.applyStatus('slowed', 30);
    const m = new Monster(
      g.player.x + 2,
      g.player.y,
      monsters.find((m) => m.id === 'rat')! as MonsterData
    );
    m.ticksUntilTurn = 150;
    g.monsters = [m];
    g.executeCommand('wait');
    expect(g.isAdvancing).toBe(true);
    g.stepAdvancement();
    expect(g.world5!.simulationTicks).toBe(100);
    expect(m.ticksUntilTurn).toBe(50);
    const root = g.world5!;
    for (let i = 0; i < 20 && g.isAdvancing; i++) g.stepAdvancement();
    expect(g.isAdvancing).toBe(false);
    expect(root.simulationTicks).toBe(200);
    g.executeCommand('wait');
    expect(g.isAdvancing).toBe(true);
    g.stepAdvancement();
    const committed = root.simulationTicks,
      timer = m.ticksUntilTurn;
    (g as any).discardInFlightAdvancement();
    expect(root.simulationTicks).toBe(committed);
    expect(m.ticksUntilTurn).toBe(timer);
  });
  it('real cached travel preserves one carrier, visited index and departure time across save/load', () => {
    const g = fixture();
    g.startNewGame({
      seed: 51005003,
      mode: 'wizard',
      ruleSet: 'extended',
      extensions: ['world5-fixture']
    });
    g.animationEnabled = false;
    const first = g.grid;
    g.executeCommand('wait');
    const departed = g.world5!.simulationTicks;
    g.depth = 2;
    (g as any).generateDepth(false);
    const second = g.grid;
    expect(g.levels.get(1)!.grid).toBe(first);
    expect(g.levels.has(2)).toBe(false);
    expect(second).not.toBe(first);
    expect(g.world5!.levels[0]!.lastDepartedTick).toBe(departed);
    const s = g.toSnapshot();
    expect(g.loadSnapshot(s)).toBe(true);
    expect(g.world5!.simulationTicks).toBe(departed);
    const cached = g.levels.get(1)!.grid;
    g.depth = 1;
    (g as any).generateDepth(true);
    expect(g.grid).toBe(cached);
    expect(g.levels.has(1)).toBe(false);
    expect(g.world5!.levels.map((l) => l.residence)).toEqual(['active', 'cached']);
  });
  it('entry publication failure restores the entire object graph including world5 identity and ID counters', () => {
    let fail = false;
    const r = new ExtensionRegistry();
    r.register(
      'world5-fixture',
      '1.0.0',
      () => {
        const m = createWorld5Module(),
          entered = m.hooks!.enteredLevel!;
        m.hooks!.enteredLevel = (e, c) => {
          entered(e, c);
          if (fail) throw new Error('world5 entry failure');
        };
        return m;
      },
      fixtureRulesIdentity
    );
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(r);
    const g = createHeadlessGame(51005004, 'test');
    g.startNewGame({
      seed: 51005004,
      mode: 'wizard',
      ruleSet: 'extended',
      extensions: ['world5-fixture']
    });
    const root = g.world5!,
      grid = g.grid,
      player = g.player,
      expected = clone(root),
      random = rng.getState(),
      nextId = getNextEntityId();
    const audit = auditFullObjectGraph(fullGenerationRoots(g), [g.extensionRuntime!]);
    fail = true;
    g.depth = 2;
    expect(() => (g as any).generateDepth(false)).toThrow('world5 entry failure');
    expect(g.depth).toBe(1);
    expect(g.grid).toBe(grid);
    expect(g.player).toBe(player);
    expect(g.world5).toBe(root);
    expect(root).toEqual(expected);
    expect(rng.getState()).toEqual(random);
    expect(audit.differences()).toEqual([]);
    expect(getNextEntityId()).toBe(nextId);
  });
  it('rejects shared dormant and pending carriers before retiring the current run', () => {
    const g = fixture(),
      s = clone(g.toSnapshot()),
      player = g.player,
      world = g.world5;
    const m = new Monster(
      g.player.x + 2,
      g.player.y,
      monsters.find((m) => m.id === 'rat')! as MonsterData
    );
    g.monsters.push(m);
    const saved = clone(g.toSnapshot());
    const duplicate = clone(saved);
    duplicate.dormantMonsters.push(clone(duplicate.monsters[0]!));
    expect(g.loadSnapshot(duplicate)).toBe(false);
    const pending = clone(saved);
    pending.pendingFallenByDepth.push({ depth: 2, monsters: [clone(pending.monsters[0]!)] });
    expect(g.loadSnapshot(pending)).toBe(false);
    expect(g.player).toBe(player);
    expect(g.world5).toBe(world);
    expect(() =>
      assertWorldLevelOwnership(
        { grid: {}, monsters: [], dormantMonsters: [{ id: 4 }], items: [] },
        new Map(),
        { monsters: [{ id: 4 }], items: [] }
      )
    ).toThrow('C5_BAD_OWNERSHIP');
    expect(s.run.world5!.levels).toHaveLength(1);
  });
});

const installed = catalog.getInstalledModuleDescriptors().map((d) => d.id);
const smokePlans = [
  [],
  ...installed.map((id) => [id]),
  installed,
  ['world5-fixture'],
  ['world5-fixture', ...installed.filter((id) => id === 'combat' || id === 'giants')]
];
describe('C5 related real-Game combinations (engine only, v4 recording path)', () => {
  it.each(smokePlans.map((ids) => [ids.join('+') || 'empty', ids] as const))(
    '%s: play/save/load/replay/seek/continuation',
    (_name, ids) => {
      const registry = catalog.createExtensionRegistry();
      registry.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
      vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
      const initialCommands = registry
        .create(registry.manifest(ids))
        .flatMap((m) =>
          m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []
        );
      const g = createHeadlessGame(51005005, 'test');
      g.startNewGame({
        seed: 51005005,
        mode: 'test',
        ruleSet: 'extended',
        extensions: ids,
        initialCommands
      });
      g.animationEnabled = false;
      const enabled = ids.includes('world5-fixture');
      const state = () => ({
        tick: timeSystem.currentTick,
        turn: g.absoluteTurnNumber,
        rng: rng.getState(),
        extensions: g.extensionRuntime!.snapshot(),
        world5: g.world5 ? clone(g.world5) : null
      });
      const play = () => {
        while (logger.pendingAcknowledgment) logger.acknowledgeNext();
        g.executeCommand('wait');
      };
      play();
      play();
      expect(Object.prototype.hasOwnProperty.call(g, 'world5')).toBe(enabled);
      const saved = clone(g.toSaveSnapshot()),
        recording = clone(g.exportRecording()),
        expected = state();
      expect(g.loadSnapshot(saved)).toBe(true);
      expect(state()).toEqual(expected);
      play();
      const continued = clone(g.exportRecording()),
        continuationState = state();
      expect(continued.events.slice(0, recording.events.length)).toEqual(continuingPrefix(recording));
      expect(continued.events.length).toBe(recording.events.length + 1);
      const replay = (value: typeof recording) => {
        expect(g.loadReplay(value)).toBe(true);
        g.animationEnabled = false;
        for (const e of value.events) {
          g.replayStep(true);
          expect(g.replayErrorDisplay).toBeNull();
          expect(g.replayCursor).toBe(e.index + 1);
          expect(rng.getState()).toEqual(e.rng);
          if (enabled) expect(g.world5!.simulationTicks).toBe(e.tick);
          else expect(Object.prototype.hasOwnProperty.call(g, 'world5')).toBe(false);
        }
      };
      replay(recording);
      expect(state()).toEqual(expected);
      g.replaySeek(0);
      expect(g.world5?.simulationTicks ?? 0).toBe(0);
      g.replaySeek(recording.events.length);
      expect(state()).toEqual(expected);
      replay(continued);
      expect(state()).toEqual(continuationState);
    }
  );
});

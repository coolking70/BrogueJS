// 明确的诊断布景；公开输入、生产结算与退休入口仍使用真实 Game。
import { afterEach, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { createExtensionRegistry } from '../ext/catalog';
import { markCreatureBirth } from '../ext/birth';
import { statQuery, nativeStat, nativeStatRevision } from '../engine/Stats/NativeStatSources';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { applyActorPoiseDamage } from '../engine/Core/PhasedAttackProduction';
import { logger } from '../engine/Systems/Logger';
import type { Game } from '../engine/Core/Game';
import { installRecordingScene } from './support/recordingV4';
import { timeSystem } from '../engine/Systems/Time';
import { TerrainType } from '../engine/Map/Grid';
import {
  CreatureSpatial,
  actorSourceRevision,
  footprintOf,
  commitCreatureAnchor
} from '../engine/Movement/CreatureSpatial';
import * as actorProduction from '../engine/Core/ActorActionProduction';
import { rng } from '../engine/Random';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
function start(ids: readonly string[]) {
  const game = createHeadlessGame(1, 'test'),
    registry = createExtensionRegistry();
  const initialCommands = registry
    .create(registry.manifest(ids))
    .flatMap((m) =>
      m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []
    );
  game.startNewGame({
    seed: 1,
    mode: 'wizard',
    ruleSet: 'extended',
    extensions: ids,
    initialCommands
  });
  game.animationEnabled = false;
  return game;
}
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x));
afterEach(() => {
  logger.reset();
  vi.restoreAllMocks();
});
it('SDK01：一次安全边界收集移除不可达死亡来源，完整扩展状态重复收集幂等', () => {
  const game = start(['growth']),
    runtime = game.extensionRuntime!;
  const actor = new Monster(
    game.player.x - 1,
    game.player.y,
    (monsters as MonsterData[]).find((m) => m.id === 'rat')!
  );
  game.monsters.push(actor);
  runtime.attachCreature(actor);
  const origin = runtime.causality.create('melee', actor.id);
  runtime.causality.withOrigin(origin, () => actor.takeDamage(1000, true));
  game.killMonster(actor);
  (game as any).removeDeadMonsters();
  (game as any).collectExtensionComponents();
  const once = json(runtime.snapshot());
  (game as any).collectExtensionComponents();
  const twice = json(runtime.snapshot());
  expect((once.modules.growth as any).actors[actor.id]).toBeUndefined();
  expect(twice).toEqual(once);
});

const clockScenes = new WeakMap<Game, { hits: number; elapsedTimer: number; debt: number }>();
function clockScene(game: Game) {
  if (!game.extensionRuntime?.actorActionBinding()) return;
  const actor = new Monster(
    game.player.x - 1,
    game.player.y,
    (monsters as MonsterData[]).find((m) => m.id === 'jackal')!
  );
  game.monsters.push(actor);
  game.extensionRuntime.attachCreature(actor);
  actor.state = MonsterState.HUNTING;
  for (const other of game.monsters) other.ticksUntilTurn = 10000;
  actor.ticksUntilTurn = 50;
  const observed = { hits: 0, elapsedTimer: -1, debt: 0 };
  clockScenes.set(game, observed);
  actor.prepareNativeDecision = () => false;
  actor.takeNativeDecision = () => {
    if (!observed.hits++) {
      observed.elapsedTimer = game.player.ticksUntilTurn;
      applyActorPoiseDamage(game, game.player.id, 999);
      observed.debt = game.player.ticksUntilTurn;
    }
    actor.ticksUntilTurn = 10000;
  };
}
function finish(game: Game) {
  for (let n = 0; n < 1000 && game.isAdvancing; n++) {
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    game.tickAdvancement(1000);
  }
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
  expect(game.isAdvancing).toBe(false);
  expect(game.lastAdvancementError).toBeNull();
}
it.each([false, true])(
  'SDK02: 同边界原生破韧完整偿还新债务，动画=%s，存读/回放/续录一致',
  (animated) => {
    installRecordingScene(clockScene);
    const game = start(['combat']);
    game.animationEnabled = animated;
    const tick = timeSystem.currentTick;
    game.executeCommand('wait');
    if (animated) {
      expect(game.isInputLocked()).toBe(true);
      const count = game.recordedInputEvents.length;
      game.executeCommand('wait');
      expect(game.recordedInputEvents).toHaveLength(count);
    }
    finish(game);
    const observed = clockScenes.get(game)!;
    expect(observed.hits).toBe(1);
    expect(observed.elapsedTimer).toBe(50);
    expect(observed.debt).toBe(50);
    expect(timeSystem.currentTick - tick).toBe(100);
    const row = game
      .extensionRuntime!.actorActionBinding()!
      .state.actors.find((a) => a.actorId === game.player.id)!;
    expect(row.staggerRemainingTicks).toBe(0);
    expect(game.player.ticksUntilTurn).toBe(0);
    expect(game.isInputLocked()).toBe(false);
    const saved = json(game.toSaveSnapshot()),
      extensions = json(game.extensionRuntime!.snapshot());
    expect(game.loadSnapshot(saved)).toBe(true);
    expect(game.extensionRuntime!.snapshot()).toEqual(extensions);
    const n = game.exportRecording().events.length;
    game.executeCommand('wait');
    finish(game);
    expect(game.exportRecording().events).toHaveLength(n + 1);
    const recording = json(game.exportRecording()),
      expected = json(game.toSnapshot());
    expected.savedAt = 0;
    const replay = createHeadlessGame(2, 'test');
    expect(replay.loadReplay(recording)).toBe(true);
    while (replay.replayCursor < recording.events.length && !replay.replayError)
      replay.replayStep(true);
    expect(replay.replayError).toBeNull();
    const actual = json(replay.toSnapshot());
    actual.savedAt = 0;
    expect(actual).toEqual(expected);
  }
);

function passengerScene(square = true) {
  const game = start(['growth']);
  for (let x = 10; x <= 24; x++)
    for (let y = 10; y <= 16; y++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
  const carrier = new Monster(12, 12, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
  game.monsters.push(carrier);
  game.extensionRuntime!.attachCreature(carrier);
  const passenger = square
    ? game.createSquareMonster((monsters as MonsterData[]).find((m) => m.id === 'rat')!, 2, {
        x: 20,
        y: 12
      })!
    : new Monster(20, 12, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
  if (!square) game.monsters.push(passenger);
  expect(passenger).toBeTruthy();
  game.monsters.splice(game.monsters.indexOf(passenger), 1);
  carrier.carriedMonster = passenger;
  const index = new CreatureSpatial({ grid: game.grid, monsters: [passenger] });
  expect(index.creatureAtCell(square ? { x: 21, y: 13 } : passenger.loc)).toBe(passenger);
  return { game, carrier, passenger, index };
}
it('SPATIAL: 行政退休通过真实提交搬出整足迹，索引与来源同步，保留乘客身份及存读', () => {
  const { game, carrier, passenger, index } = passengerScene(),
    revision = actorSourceRevision(passenger),
    random = rng.getState();
  const notified = vi.spyOn(actorProduction, 'notifyProductionActorSourceChanged');
  game.executeCommand('foundation-retire-fixture', undefined, () =>
    game.retireDepartingActors(new Set([carrier.id]))
  );
  expect(game.monsters).not.toContain(carrier);
  expect(carrier.carriedMonster).toBeNull();
  expect(game.monsters.filter((a) => a === passenger)).toHaveLength(1);
  expect(passenger.loc).toEqual({ x: 12, y: 12 });
  expect(actorSourceRevision(passenger)).toBe(revision + 1);
  expect(notified).toHaveBeenCalledWith(game, passenger.id);
  expect(index.creatureAtCell({ x: 21, y: 13 })).toBeUndefined();
  for (const at of footprintOf(passenger)) {
    expect(index.creatureAtCell(at)).toBe(passenger);
    expect(game.getMonsterAt(at.x, at.y)).toBe(passenger);
  }
  expect(rng.getState()).toEqual(random);
  expect(game.extensionRuntime!.snapshot().components[passenger.id]).toBeDefined();
  expect(game.extensionRuntime!.snapshot().components[carrier.id]).toBeUndefined();
  expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
  index.dispose();
});
it.each(['tail-wall', 'tail-occupant', 'tail-dormant', 'late-attach'] as const)(
  'SPATIAL: %s 失败不改变完整图、所有权、索引、来源或随机数',
  (defect) => {
    const { game, carrier, passenger, index } = passengerScene();
    if (defect === 'tail-wall') game.grid.setTerrain(13, 13, TerrainType.WALL);
    if (defect === 'tail-occupant' || defect === 'tail-dormant') {
      const blocker = new Monster(13, 13, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
      if (defect === 'tail-dormant') {
        blocker.isDormant = true;
        game.dormantMonsters.push(blocker);
      } else game.monsters.push(blocker);
    }
    const error = new Error('diagnostic late attach');
    if (defect === 'late-attach')
      vi.spyOn(game.extensionRuntime!, 'attachCreature').mockImplementationOnce(() => {
        throw error;
      });
    const audit = auditFullObjectGraph(game),
      revision = actorSourceRevision(passenger),
      random = rng.getState();
    expect(() => game.retireDepartingActors(new Set([carrier.id]))).toThrow(
      defect === 'late-attach' ? error : 'No safe'
    );
    expect(audit.differences()).toEqual([]);
    expect(actorSourceRevision(passenger)).toBe(revision);
    expect(index.creatureAtCell({ x: 21, y: 13 })).toBe(passenger);
    expect(index.creatureAtCell({ x: 13, y: 13 })).toBeUndefined();
    expect(carrier.carriedMonster).toBe(passenger);
    expect(rng.getState()).toEqual(random);
    index.dispose();
  }
);

it.each(['burning', 'displacement'] as const)(
  'SDK01: %s 的存活目标保留已死盟友来源，存读后延迟终结仍支付玩家分成且收集幂等',
  (kind) => {
    const game = start(['growth']),
      runtime = game.extensionRuntime!;
    const source = new Monster(15, 12, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
    const target = new Monster(18, 12, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
    source.isAlly = true;
    source.doesNotResurrect = true;
    for (const actor of [source, target]) {
      markCreatureBirth(actor, 'natural');
      game.monsters.push(actor);
      runtime.attachCreature(actor);
    }
    const origin = runtime.causality.create(
      kind === 'burning' ? 'bolt' : 'displacement',
      source.id,
      source.id,
      source.extensionHooks!.partyId(source)
    );
    if (kind === 'burning')
      runtime.causality.withOrigin(origin, () => game.exposeCreatureToFire(target));
    else runtime.causality.markDisplacement(target.id, origin);
    source.takeDamage(1000, true);
    game.killMonster(source);
    (game as any).removeDeadMonsters();
    (game as any).collectExtensionComponents();
    const once = json(runtime.snapshot());
    expect((once.modules.growth as any).actors[source.id]).toMatchObject({
      allied: true,
      alive: false
    });
    expect(once.components[source.id]).toBeUndefined();
    (game as any).collectExtensionComponents();
    expect(runtime.snapshot()).toEqual(once);
    expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    const loadedRuntime = game.extensionRuntime!,
      loaded = game.monsters.find((a) => a.id === target.id)!;
    const delayed =
      kind === 'burning'
        ? loadedRuntime.causality.statusOrigin(target.id, 'burning')
        : loadedRuntime.causality.consumeDisplacement(target.id);
    expect(delayed).toEqual(origin);
    loadedRuntime.causality.withOrigin(delayed, () => loaded.takeDamage(1000, true));
    game.killMonster(loaded);
    expect(
      (loadedRuntime.snapshot().components[game.player.id]!['growth:progression'] as any).experience
    ).toBe(0);
    (game as any).removeDeadMonsters();
    (game as any).collectExtensionComponents();
    const paid = json(loadedRuntime.snapshot());
    expect((paid.components[game.player.id]!['growth:progression'] as any).experience).toBe(6);
    expect((paid.modules.growth as any).rewardReceipts).toContain(`birth:${target.id}`);
    expect((paid.modules.growth as any).actors[source.id]).toBeUndefined();
    (game as any).collectExtensionComponents();
    expect(loadedRuntime.snapshot()).toEqual(paid);
    expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    expect(game.extensionRuntime!.snapshot()).toEqual(paid);
  }
);

it.each(['dormant', 'cached'] as const)(
  'SPATIAL: %s 携带者退休仅发布到原层所有权，存读保持整足迹',
  (layer) => {
    const { game, carrier, passenger, index } = passengerScene();
    if (layer === 'dormant') {
      game.monsters.splice(game.monsters.indexOf(carrier), 1);
      carrier.isDormant = true;
      game.dormantMonsters.push(carrier);
    } else {
      const stairs = [...Array(game.grid.width)]
        .flatMap((_, x) => [...Array(game.grid.height)].map((_, y) => ({ x, y })))
        .find((at) => game.grid.getCell(at.x, at.y)!.layers.includes(TerrainType.STAIRS_DOWN))!;
      expect(stairs).toBeDefined();
      for (const actor of game.monsters) actor.ticksUntilTurn = 10000;
      commitCreatureAnchor(game.player, { ...stairs });
      game.executeCommand('stairs_down');
      finish(game);
      expect(game.depth).toBe(2);
      expect(game.levels.get(1)!.monsters).toContain(carrier);
    }
    game.executeCommand('foundation-retire-fixture', undefined, () =>
      game.retireDepartingActors(new Set([carrier.id]))
    );
    const target = layer === 'cached' ? game.levels.get(1)!.monsters : game.monsters;
    expect(target.filter((a) => a === passenger)).toHaveLength(1);
    expect(game.departureActors()).not.toContain(carrier);
    expect(carrier.carriedMonster).toBeNull();
    expect(passenger.loc).toEqual({ x: 12, y: 12 });
    for (const at of footprintOf(passenger)) expect(index.creatureAtCell(at)).toBe(passenger);
    expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    index.dispose();
  }
);

it.each([true, false])(
  'SPATIAL: 真正第二位乘客身份故障恢复已退休携带者的绑定、缓存及存读，方形=%s',
  (square) => {
    const { game, carrier, passenger, index } = passengerScene(square);
    const data = (monsters as MonsterData[]).find((m) => m.id === 'rat')!;
    const second = new Monster(15, 12, data);
    game.monsters.push(second);
    const other = square
      ? game.createSquareMonster(data, 2, { x: 20, y: 15 })!
      : new Monster(20, 15, data);
    if (!square) game.monsters.push(other);
    game.monsters.splice(game.monsters.indexOf(other), 1);
    second.carriedMonster = other;
    const runtime = game.extensionRuntime!,
      attach = runtime.attachCreature.bind(runtime),
      retire = runtime.retireEdibleActor.bind(runtime);
    const query = statQuery(carrier),
      playerQuery = statQuery(game.player);
    const evasion = nativeStat(carrier, 'native.evasion'),
      maximum = query.value(carrier.id, 'native.max-hp');
    expect(evasion).toBe(500);
    const cached = query.breakdown(carrier.id, 'native.evasion'),
      cacheSize = runtime.stats.cacheSize(carrier.id);
    const nativeRevision = nativeStatRevision(carrier),
      playerRevision = nativeStatRevision(game.player);
    const anchorRevision = actorSourceRevision(passenger),
      oldCells = footprintOf(passenger).map((at) => ({ ...at }));
    const error = new Error('diagnostic second passenger identity'),
      retired: Monster[] = [];
    const retiredSpy = vi.spyOn(runtime, 'retireEdibleActor').mockImplementation((actor) => {
      retire(actor);
      if (actor instanceof Monster) retired.push(actor);
    });
    let failedAfterRetirement = false;
    const attachSpy = vi.spyOn(runtime, 'attachCreature').mockImplementation((actor, ...rest) => {
      if (actor === other) {
        expect(retired).toEqual([carrier]);
        expect(carrier.extensionHooks).toBeUndefined();
        expect(runtime.snapshot().components[carrier.id]).toBeUndefined();
        expect(statQuery(carrier)).not.toBe(query);
        expect(nativeStat(carrier, 'native.evasion')).toBe(0);
        expect(() => query.value(carrier.id, 'native.max-hp')).toThrow('ext.stats.errors.source');
        failedAfterRetirement = true;
        throw error;
      }
      return attach(actor, ...rest);
    });
    const audit = auditFullObjectGraph(game),
      before = json(runtime.snapshot()),
      random = rng.getState();
    expect(() => game.retireDepartingActors(new Set([carrier.id, second.id]))).toThrow(error);
    expect(failedAfterRetirement).toBe(true);
    expect(audit.differences()).toEqual([]);
    expect(runtime.snapshot()).toEqual(before);
    expect(statQuery(carrier)).toBe(query);
    expect(statQuery(game.player)).toBe(playerQuery);
    expect(nativeStatRevision(carrier)).toBe(nativeRevision);
    expect(nativeStatRevision(game.player)).toBe(playerRevision);
    expect(runtime.stats.cacheSize(carrier.id)).toBe(cacheSize);
    expect(query.breakdown(carrier.id, 'native.evasion')).toBe(cached);
    expect(query.value(carrier.id, 'native.max-hp')).toBe(maximum);
    expect(nativeStat(carrier, 'native.evasion')).toBe(evasion);
    expect(actorSourceRevision(passenger)).toBe(anchorRevision);
    for (const at of oldCells) expect(index.creatureAtCell(at)).toBe(passenger);
    expect(index.creatureAtCell({ x: 12, y: 12 })).toBeUndefined();
    expect(carrier.carriedMonster).toBe(passenger);
    expect(second.carriedMonster).toBe(other);
    expect(game.monsters).toContain(carrier);
    expect(game.monsters).toContain(second);
    expect(rng.getState()).toEqual(random);
    attachSpy.mockRestore();
    retiredSpy.mockRestore();
    // 原生单格携带可立即存读；方形携带仍未开放，先重试合法退休再存读。
    if (!square) {
      expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
      const restored = game.monsters.find((actor) => actor.id === carrier.id)!;
      expect(nativeStat(restored, 'native.evasion')).toBe(evasion);
      expect(restored.carriedMonster!.id).toBe(passenger.id);
    }
    game.executeCommand('foundation-retire-fixture', undefined, () =>
      game.retireDepartingActors(new Set([carrier.id, second.id]))
    );
    const saved = json(game.toSaveSnapshot());
    expect(game.loadSnapshot(saved)).toBe(true);
    const survivors = game.monsters.filter((actor) => [passenger.id, other.id].includes(actor.id));
    expect(survivors).toHaveLength(2);
    expect(survivors.find((actor) => actor.id === passenger.id)!.loc).toEqual({ x: 12, y: 12 });
    expect(survivors.find((actor) => actor.id === other.id)!.loc).toEqual({ x: 15, y: 12 });
    index.dispose();
  }
);

it('SDK01：封入原点的自源毒伤在公开wait中终结，录制、一次收集回放和存读摘要一致', () => {
  const sourceIds = new WeakMap<Game, number>();
  installRecordingScene((game) => {
    const runtime = game.extensionRuntime;
    if (!runtime?.snapshot().modules.growth) return;
    const source = new Monster(
      game.player.x - 1,
      game.player.y,
      (monsters as MonsterData[]).find((m) => m.id === 'rat')!
    );
    markCreatureBirth(source, 'natural');
    game.monsters.push(source);
    runtime.attachCreature(source);
    source.hp = 1;
    source.doesNotResurrect = true;
    for (const actor of game.monsters) actor.ticksUntilTurn = 10000;
    const origin = runtime.causality.create('bolt', source.id);
    runtime.causality.withOrigin(origin, () => source.addPoison(2));
    sourceIds.set(game, source.id);
  });
  const game = start(['growth']),
    sourceId = sourceIds.get(game)!;
  game.executeCommand('wait');
  finish(game);
  expect(game.monsters.some((a) => a.id === sourceId)).toBe(false);
  const expected = json(game.extensionRuntime!.snapshot());
  expect((expected.modules.growth as any).actors[sourceId]).toBeUndefined();
  const recording = json(game.exportRecording());
  expect(game.hasCompleteRecording).toBe(true);
  const replay = createHeadlessGame(3, 'test');
  expect(replay.loadReplay(recording)).toBe(true);
  while (replay.replayCursor < recording.events.length && !replay.replayError)
    replay.replayStep(true);
  expect(replay.replayError).toBeNull();
  expect(replay.extensionRuntime!.snapshot()).toEqual(expected);
  expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
  expect(game.extensionRuntime!.snapshot()).toEqual(expected);
});

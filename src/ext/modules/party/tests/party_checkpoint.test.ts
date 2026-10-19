import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { checkpointGenerationWorld } from '../../../../engine/Core/WorldCheckpoint';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { logger } from '../../../../engine/Systems/Logger';
import { rng, RNGType } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { getNextEntityId } from '../../../../entities/Creature';
import { Item, ItemCategory } from '../../../../engine/Items/Item';

const games: Game[] = [];
const clear = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function fresh() { const g = new Game({ seed: 1 }); games.push(g); return g; }
function start() {
    const g = fresh();
    g.startNewGame({ seed: 42, mode: 'wizard', ruleSet: 'extended', extensions: ['party'],
        extensionConfigurations: { party: { schema: 1, members: 4 } },
        initialCommands: [JSON.stringify({ module: 'party', action: 'create', payload: { schema: 1, members: 4 } })] });
    g.animationEnabled = false; clear(); return g;
}
const digest = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
const batch = (g: Game) => ({ kind: 'party:window', schema: 2, seq: g.party!.state.window.seq + 1,
    expectedRevision: g.party!.state.revision, issuerSlot: 'local:0', startTick: timeSystem.currentTick,
    length: { kind: 'ticks', ticks: 300 }, fineActorId: null, automatic: false, trigger: 'manual', plans: [] });
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1792252800000));
afterEach(() => { games.splice(0).forEach(g => g.disposeRecording()); vi.restoreAllMocks(); clear(); });

it.each([false, true])('descriptor capture retains cycles, aliases, flags, symbols, sparse arrays and independent nested savepoints: ordered=%s', ordered => {
    let reads = 0;
    const symbol = Symbol('child'), child = { n: 1 }, opaque = { n: 2 }, shallow = { child: opaque };
    const array: any[] = []; array.length = 8; array[3] = child;
    const root: any = { child, alias: child, array, map: new Map([[child, array]]), set: new Set([child]), bytes: new Uint16Array([2, 7]), opaque, shallow };
    root.self = root; root[symbol] = child;
    Object.defineProperty(root, 'hidden', { value: child, writable: true, configurable: true });
    Object.defineProperty(root, 'accessor', { get: () => { reads++; return child; }, configurable: true });
    Object.defineProperty(root, 'constant', { value: 12 });
    const audit = auditFullObjectGraph(root, [opaque]);
    const select = () => ({ shallow: [shallow], deep: [root], references: [opaque] });
    const outer = checkpointGenerationWorld(select, ordered);
    child.n = 5; root.bytes[1] = 17; root.map.clear(); root.array.push(7); root.extra = true;
    const inner = checkpointGenerationWorld(select, ordered);
    child.n = 8; root.bytes[1] = 19; root.set.clear(); root.array[3] = 4;
    Object.defineProperty(root, 'accessor', { value: 99, configurable: true });
    inner(); expect(child.n).toBe(5); expect(root.bytes[1]).toBe(17); expect(root.array[3]).toBe(child);
    outer(); expect(reads).toBe(0); expect(audit.differences()).toEqual([]);
    child.n = 9; outer(); expect(audit.differences()).toEqual([]);
});

it.each(['single', 'window'] as const)('rolls back a late secondary failure at the %s savepoint with graph identity and both RNG streams', mode => {
    const g = start(), target = g.controlledActors[1]!;
    if (mode === 'single') { g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!); clear(); }
    const native = (g as any).partyWaitStages;
    let failed = false, restored = 0, savedRandom: ReturnType<typeof rng.getState>, savedId = 0, savedTick = 0;
    const capture = (g as any).checkpointCombatFactWorld;
    vi.spyOn(g as any, 'checkpointCombatFactWorld').mockImplementation(function (...args: unknown[]) {
        const restore = capture.apply(g, args);
        const audit = auditFullObjectGraph({ party: g.party, grid: g.grid, items: g.items, monsters: g.monsters,
            stats: g.stats, environment: g.environment, world: g.world5 }, [g.extensionRuntime!]);
        savedRandom = rng.getState(); savedId = getNextEntityId(); savedTick = timeSystem.currentTick;
        return () => { restore(); expect(audit.differences()).toEqual([]); restored++; };
    });
    vi.spyOn(g as any, 'partyWaitStages').mockImplementation(function* (actor: any) {
        yield* native.call(g, actor);
        if (actor.id !== target.id) return;
        actor.inventory.items[0].quantity += 7;
        actor.setStatusDuration('poisoned', 8);
        g.grid.getCell(actor.x, actor.y)!.machineNumber = 987;
        g.items.push(new Item('checkpoint probe', '?', 0xffffff, ItemCategory.FOOD));
        rng.setRNG(RNGType.RNG_COSMETIC); rng.randRange(1, 100); rng.setRNG(RNGType.RNG_SUBSTANTIVE); rng.randRange(1, 100);
        failed = true; throw new Error('checkpoint injected failure');
    });
    const execute = () => mode === 'single' ? g.submitPartyIntent({ kind: 'wait' }, target.id) : g.executeCommand('party:window', batch(g));
    expect(execute).toThrow('checkpoint injected failure');
    expect(failed).toBe(true); expect(restored).toBe(1);
    expect(rng.getState()).toEqual(savedRandom!); expect(getNextEntityId()).toBe(savedId); expect(timeSystem.currentTick).toBe(savedTick);
    expect(g.controlledActors[1]).toBe(target);
    // In a window the primary's accepted action precedes this savepoint.
    expect(g.controlledActors[0]!.ticksUntilTurn).toBeGreaterThan(0);
    if (mode === 'window') expect(g.party!.state.window.receipt!.trace.filter(t => t.outcome === 'accepted').map(t => t.actorId)).toEqual([g.player.id]);
});

it('four-member mixed commands retain every digest domain and RNG across save/load continuation, seed replay and backward/forward seek', () => {
    const g = start();
    for (let i = 0; i < 8; i++) { clear(); g.submitPartyIntent({ kind: i % 3 === 0 ? 'search' : 'wait' }, g.readyPartyActorId!); }
    const saved = JSON.parse(JSON.stringify(g.toSaveSnapshot())), before = digest(g), beforeRng = rng.getState(), count = g.exportRecording().events.length;
    clear(); g.executeCommand('party:window', batch(g));
    const after = digest(g), random = rng.getState(), recording = g.exportRecording();
    expect(saved.run.recordingOrigin).toBeTruthy();
    const loaded = fresh(); expect(loaded.loadSnapshot(saved)).toBe(true); loaded.animationEnabled = false;
    expect(digest(loaded)).toEqual(before); expect(rng.getState()).toEqual(beforeRng);
    clear(); loaded.executeCommand('party:window', batch(loaded));
    expect(digest(loaded)).toEqual(after); expect(rng.getState()).toEqual(random); expect(loaded.exportRecording().events).toEqual(recording.events);
    const replay = fresh(); expect(replay.loadReplay(recording)).toBe(true);
    while (replay.replayCursor < recording.events.length && !replay.replayError) { clear(); replay.replayStep(true); }
    expect(replay.replayError).toBeNull(); expect(digest(replay)).toEqual(after); expect(rng.getState()).toEqual(random);
    replay.replaySeek(count); expect(replay.replayError).toBeNull(); expect(digest(replay)).toEqual(before); expect(rng.getState()).toEqual(beforeRng);
    replay.replaySeek(recording.events.length); expect(replay.replayError).toBeNull(); expect(digest(replay)).toEqual(after); expect(rng.getState()).toEqual(random);
});

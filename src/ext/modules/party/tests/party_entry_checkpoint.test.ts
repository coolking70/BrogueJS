import { afterEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { getNextMachineNumber, getRewardRoomsGenerated } from '../../../../engine/Generator/BlueprintEngine';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType } from '../../../../engine/Map/Grid';
import { createExtensionRegistry } from '../../../catalog';
import { auditFullObjectGraph, fullGenerationRoots } from '../../../../test/support/fullGenerationCheckpointOracle';

const games: Game[] = [];
const clear = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
afterEach(() => { games.splice(0).forEach(g => g.disposeRecording()); vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
function start(combat = false) {
    const ids = combat ? ['party', 'combat'] : ['party'], registry = createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(m => m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
    const g = new Game({ seed: 1 }); games.push(g);
    g.startNewGame({ seed: 42, mode: 'wizard', ruleSet: 'extended', extensions: ids, initialCommands });
    g.animationEnabled = false; clear(); return g;
}
function travel(g: Game, depth: number, leavingBehind: number[] = [], actorId = g.player.id) {
    clear(); g.executeCommand('party:control', { kind: 'party:control', schema: 1, expectedRevision: g.party!.state.revision,
        issuerSlot: 'local:0', actorId, change: { kind: 'travel-party', destination: { kind: 'dungeon', depth }, leavingBehind } });
}
function enteredCombatFloor(g: Game) {
    const state = g.extensionRuntime!.actorActionBinding()!.state.bonfires!;
    // A natural floor may legitimately skip/defer placement when no cell qualifies.
    expect(state.placements.some(p => p.depth === 2) || state.pending.some(p => p.attemptedDepths.includes(2))).toBe(true);
    return structuredClone(state);
}
const globals = () => ({ random: rng.getState(), entity: getNextEntityId(), machine: getNextMachineNumber(), rewards: getRewardRoomsGenerated() });
function auditRollback(g: Game) {
    const capture = (g as any).checkpointCombatFactWorld;
    const differences: string[] = []; let restores = 0;
    vi.spyOn(g as any, 'checkpointCombatFactWorld').mockImplementation((...args: unknown[]) => {
        const restore = capture.apply(g, args), audit = auditFullObjectGraph(fullGenerationRoots(g), [g.extensionRuntime!]);
        return () => { restore(); differences.push(...audit.differences()); restores++; };
    });
    return () => { expect(restores).toBeGreaterThan(0); expect(differences).toEqual([]); };
}

it.each([
    ['emit', false, true], ['emit', false, false],
    ['dispatch', true, true], ['dispatch', true, false],
    ['render', true, true], ['render', true, false],
] as const)('travel rollback and retry: failure=%s combat=%s firstVisit=%s', (phase, combat, firstVisit) => {
    const g = start(combat), secondary = g.controlledActors[1]!;
    commitCreatureAnchor(g.player, g.levelSeeds[0]!.downStairsLoc);
    if (!firstVisit) { travel(g, 2, [secondary.id]); commitCreatureAnchor(g.player, g.levelSeeds[1]!.upStairsLoc); }
    clear(); const runtime = g.extensionRuntime!, before = runtime.snapshot(), saved = globals();
    const seeds = structuredClone(g.levelSeeds), metered = structuredClone((g as any).meteredItems), checkAudit = auditRollback(g);
    let injected = false;
    const fail = () => { injected = true; throw new Error('late party entry'); };
    if (phase === 'render') g.onRenderRequested = () => { if (g.depth !== (firstVisit ? 1 : 2)) fail(); };
    else {
        const original = (runtime as any)[phase].bind(runtime);
        vi.spyOn(runtime as any, phase).mockImplementation((...args: unknown[]) => {
            const result = original(...args); if (args[0] === 'enteredLevel') fail(); return result;
        });
    }
    const run = () => travel(g, firstVisit ? 2 : 1, firstVisit ? [secondary.id] : []);
    expect(run).toThrow('late party entry'); expect(injected).toBe(true); checkAudit();
    expect(g.depth).toBe(firstVisit ? 1 : 2); expect(g.levelSeeds).toEqual(seeds); expect((g as any).meteredItems).toEqual(metered);
    expect(runtime.snapshot()).toEqual(before); expect(globals()).toEqual(saved); expect(g.controlledActors[1]).toBe(secondary);
    expect(g.party!.state.members[1]!.life).toBe(firstVisit ? 'active' : 'frozen');
    if (firstVisit) { expect(g.levelSeeds[1]!.visited).toBe(false); expect(g.levels.has(2)).toBe(false); }
    vi.restoreAllMocks(); g.onRenderRequested = null;
    expect(run).not.toThrow(); expect(g.depth).toBe(firstVisit ? 2 : 1);
    expect(g.party!.state.members[1]!.life).toBe(firstVisit ? 'frozen' : 'active');
    const save = JSON.parse(JSON.stringify(g.toSaveSnapshot()));
    const loaded = new Game({ seed: 1 }); games.push(loaded); expect(loaded.loadSnapshot(save)).toBe(true);
    expect(loaded.levelSeeds).toEqual(g.levelSeeds); expect((loaded as any).meteredItems).toEqual((g as any).meteredItems);
    expect(loaded.extensionRuntime!.snapshot()).toEqual(runtime.snapshot());
});

it.each([0, 1])('party + combat publishes first entry after member %i placement, once, and revisits without duplication', index => {
    const g = start(true), actor = g.controlledActors[index]!, other = g.controlledActors[1 - index]!;
    commitCreatureAnchor(actor, g.levelSeeds[0]!.downStairsLoc);
    const runtime = g.extensionRuntime!, dispatch = (runtime as any).dispatch.bind(runtime), entries: number[][] = [];
    vi.spyOn(runtime as any, 'dispatch').mockImplementation((...args: any[]) => {
        if (args[0] === 'enteredLevel') {
            expect(args[1].actorIds).toEqual(g.activeControlledActors.map(a => a.id).sort((a, b) => a - b));
            entries.push(args[1].actorIds);
        }
        return dispatch(...args);
    });
    travel(g, 2, [other.id], actor.id); expect(entries).toEqual([[actor.id]]);
    const fires = runtime.worldWorkEntities().filter(e => e.owner === 'combat' && e.depth === 2);
    const ledger = enteredCombatFloor(g);
    expect(fires.every(e => !g.activeControlledActors.some(a => a.x === e.x && a.y === e.y))).toBe(true);
    commitCreatureAnchor(actor, g.levelSeeds[1]!.upStairsLoc); travel(g, 1, [], actor.id);
    commitCreatureAnchor(actor, g.levelSeeds[0]!.downStairsLoc); travel(g, 2, [other.id], actor.id);
    expect(entries).toHaveLength(3); expect(enteredCombatFloor(g)).toEqual(ledger); expect(runtime.worldWorkEntities().filter(e => e.owner === 'combat' && e.depth === 2)).toEqual(fires);
});

it.each([false, true])('secondary party + combat fall publishes atomically, lateFailure=%s', lateFailure => {
    const g = start(true), primary = g.player, secondary = g.controlledActors[1]!;
    for (let y = secondary.y - 1; y <= secondary.y + 1; y++) for (let x = secondary.x - 1; x <= secondary.x + 1; x++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
    g.grid.setTerrain(secondary.x - 1, secondary.y, TerrainType.CHASM); g.monsters.length = 0;
    g.submitPartyIntent({ kind: 'wait' }, primary.id); clear();
    const before = globals(), state = g.extensionRuntime!.snapshot(), checkAudit = auditRollback(g);
    const runtime = g.extensionRuntime!, dispatch = (runtime as any).dispatch.bind(runtime); let entered = 0;
    vi.spyOn(runtime as any, 'dispatch').mockImplementation((...args: any[]) => {
        const result = dispatch(...args);
        if (args[0] === 'enteredLevel') { entered++; expect(args[1].actorIds).toEqual([secondary.id]); if (lateFailure) throw Error('late fall entry'); }
        return result;
    });
    const run = () => g.submitPartyIntent({ kind: 'move', dx: -1, dy: 0 }, secondary.id);
    if (lateFailure) {
        expect(run).toThrow('late fall entry'); checkAudit(); expect(globals()).toEqual(before);
        expect(g.extensionRuntime!.snapshot()).toEqual(state); expect(g.depth).toBe(1);
        vi.restoreAllMocks(); clear();
    }
    expect(run).not.toThrow(); expect(entered).toBe(1); expect(g.depth).toBe(2);
    expect(g.party!.state.members[0]!.life).toBe('frozen'); expect(g.activeControlledActors).toEqual([secondary]);
    enteredCombatFloor(g);
});

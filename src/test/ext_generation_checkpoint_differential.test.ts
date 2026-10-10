import {checkpointGenerationWorld,checkpointGenerationWorldGroups} from '../engine/Core/GenerationCoordinator';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, type LevelState } from '../engine/Core/Game';
import * as generation from '../engine/Core/GenerationCoordinator';
import { DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { GasType } from '../engine/Environment/Gas';
import { getNextMachineNumber } from '../engine/Generator/BlueprintEngine';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Monster, type MonsterData } from '../entities/Monster';
import { getNextEntityId } from '../entities/Creature';
import monsterData from '../data/monsters.json';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { Json } from '../ext/types';
import { rng, RNGType } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { createHeadlessGame } from './harness';
import { auditFullObjectGraph, checkpointFullGenerationWorld, checkpointFullObjectGraph,
    fullGenerationRoots, projectGenerationWorld } from './support/fullGenerationCheckpointOracle';

const narrowCheckpoint = generation.checkpointGenerationWorld;
afterEach(() => { vi.restoreAllMocks(); logger.presentAcknowledgments(null); });

type Failure = 'generation' | 'publication';
type Mode = 'full-oracle' | 'narrow' | 'omit-gas-cell';
type Scenario = { seed: number; route: number[]; target: number; kind: 'new' | 'revisit' | 'same-depth' | 'cached-fall' };
const scenarios: readonly Scenario[] = [
    { seed: 517, route: [], target: 2, kind: 'new' },
    { seed: 1701, route: [2, 3, 4], target: 5, kind: 'new' },
    { seed: 424242, route: [2, 3], target: 2, kind: 'revisit' },
    { seed: 9001, route: [2, 3, 1], target: 2, kind: 'cached-fall' },
    { seed: 1977, route: [2, 3], target: 3, kind: 'same-depth' },
];

function enter(game: Game, depth: number, fell = false): void {
    const goingUp = depth < game.depth;
    game.depth = depth;
    (game as any).generateDepth(goingUp, false, fell);
}

function floor(level: Pick<LevelState, 'grid'>, x: number, y: number): void {
    for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS]) {
        level.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING);
    }
    level.grid.getCell(x, y)!.machineNumber = 0;
}

function rat(runtime: ExtensionRuntime, x = 10, y = 10): Monster {
    const monster = new Monster(x, y, (monsterData as MonsterData[]).find(row => row.id === 'rat')!);
    monster.hp = monster.maxHp = 1000;
    runtime.attachCreature(monster, false);
    return monster;
}

/** Observe private Logger buffers through their public effects, inside a
 * checkpoint. Disable disturbance only during observation so flushing cannot
 * change Game. Compare archive, IDs/turn, complete acknowledgment queue, pending
 * combat and the heard-combat latch, not just logger.messages. */
function messageState() {
    const restore = logger.checkpoint();
    const onDisturb = logger.onDisturb;
    logger.onDisturb = null;
    try {
        const archive = logger.messages.map(message => ({ ...message }));
        const acknowledgments = [];
        while (logger.pendingAcknowledgment) {
            acknowledgments.push({ ...logger.pendingAcknowledgment });
            logger.acknowledgeNext();
        }
        const flushed = logger.getState();
        logger.hearCombat('differential heard-combat sentinel');
        const afterHear = logger.getState();
        return { archive, acknowledgments, flushed, afterHear, blockCombatText: logger.blockCombatText };
    } finally { restore(); expect(logger.onDisturb).toBe(onDisturb); }
}

function setup(scenario: Scenario) {
    const game = createHeadlessGame(scenario.seed, 'normal');
    let failPublication = false;
    const publication = { calls: 0, mutated: false };
    const registry = new ExtensionRegistry();
    registry.register('differential-checkpoint', '1.0.0', () => ({
        id: 'differential-checkpoint', version: '1.0.0', initialState: () => ({ entered: 0 }),
        validateState: (value: unknown): value is Json => value !== null && typeof value === 'object',
        hooks: { enteredLevel: (_event, context) => {
            publication.calls++;
            if (!failPublication) return;
            context.setState({ entered: 999 });
            context.setComponent(game.player.id, 'failed-publication', { draw: context.randomInt(1, 999) });
            const before = rng.getState();
            rng.setRNG(RNGType.RNG_COSMETIC); rng.randRange(1, 999); rng.setRNG(before.currentRNG);
            context.message('differential publication message');
            logger.log('differential publication acknowledgment', '#ffffff', { acknowledge: true });
            logger.combat('differential publication combat');
            publication.mutated = true;
            throw new Error('differential publication failure');
        } },
    }));
    const runtime = new ExtensionRuntime(registry, registry.manifest(['differential-checkpoint']), {
        depth: () => game.depth, playerId: () => game.player.id,
        randomInt: (min, max) => {
            const stream = rng.getState().currentRNG;
            rng.setRNG(RNGType.RNG_SUBSTANTIVE);
            try { return rng.randRange(min, max); } finally { rng.setRNG(stream); }
        },
        message: text => logger.log(text),
    });
    game.extensionRuntime = runtime;
    runtime.attachCreature(game.player, false);
    for (const depth of scenario.route) enter(game, depth);
    // Deterministic terrain/entities isolate the particular real catch-up write
    // while retaining all generated geometry, caches and other subsystem state.
    game.monsters = []; game.dormantMonsters = [];
    for (const level of game.levels.values()) { level.monsters = []; level.dormantMonsters = []; }

    // Nontrivial full entity graph: carried/leader cycle, shared carried item,
    // detached purgatory and observation-only roots, beyond active floor rows.
    const leader = rat(runtime, 20, 10), carried = rat(runtime, 21, 10), historical = rat(runtime, 22, 10);
    const shared = new Item('differential shared gold', '$', 0xffff00, ItemCategory.GOLD);
    leader.carriedMonster = carried; carried.leader = leader;
    leader.carriedItem = shared; carried.carriedItem = shared;
    game.purgatory.push(leader); game.everSeenMonsters.add(historical); game.everSeenItems.add(shared);
    // An unregistered nested field proves the descriptor audit is more complete
    // than any maintained serialization-field whitelist.
    Object.defineProperty(carried, 'differentialUnregistered', {
        value: { bytes: new Uint16Array([17, 31]), links: new Map([[leader, shared]]) },
        writable: true, configurable: true, enumerable: false,
    });

    let gasCell: ReturnType<Game['grid']['getCell']> | undefined;
    let assertCatchUp: () => void;
    if (scenario.kind === 'new') {
        const fallen = rat(runtime); fallen.falling = true;
        game.monsters.push(fallen);
        const item = new Item('differential fallen gold', '$', 0xffff00, ItemCategory.GOLD);
        item.loc = { x: 11, y: 10 }; floor(game, 11, 10);
        game.grid.setTerrainLayer(11, 10, DungeonLayer.SURFACE, TerrainType.HOLE);
        game.items.push(item);
        (game as any).monstersFall(); (game as any).fallFloorItems();
        expect((game as any).pendingFallenByDepth.get(scenario.target)).toContain(fallen);
        expect((game as any).pendingFallenItemsByDepth.get(scenario.target)).toContain(item);
        assertCatchUp = () => {
            expect((game as any).pendingFallenByDepth.has(scenario.target)).toBe(false);
            expect((game as any).pendingFallenItemsByDepth.has(scenario.target)).toBe(false);
            expect(game.monsters).toContain(fallen); expect(game.items).toContain(item);
        };
    } else if (scenario.kind === 'cached-fall') {
        const target = game.levels.get(scenario.target)!, below = game.levels.get(scenario.target + 1)!;
        const falling = rat(runtime), resident = rat(runtime, 12, 10);
        floor(target, 10, 10);
        target.grid.setTerrainLayer(10, 10, DungeonLayer.SURFACE, TerrainType.HOLE);
        target.monsters.push(falling); below.monsters.push(resident);
        const destination = below.monsters;
        game.absoluteTurnNumber += 1;
        assertCatchUp = () => {
            expect(game.monsters).not.toContain(falling);
            expect(below.monsters).toBe(destination); expect(destination).toEqual([resident, falling]);
            expect(falling.hp).toBeLessThan(1000); expect(falling.preplaced).toBe(true);
        };
    } else {
        const target = scenario.kind === 'same-depth' ? game : game.levels.get(scenario.target)!;
        for (let x = 8; x <= 12; x++) for (let y = 8; y <= 12; y++) floor(target, x, y);
        target.environment.addGas(10, 10, GasType.POISON, 300);
        gasCell = target.grid.getCell(10, 10)!;
        const volume = gasCell.volume;
        game.absoluteTurnNumber += 2;
        assertCatchUp = () => { expect(game.grid).toBe(target.grid); expect(gasCell!.volume).not.toBe(volume); };
    }
    logger.presentAcknowledgments(() => true);
    logger.log('differential baseline acknowledgment one', '#ffffff', { acknowledge: true });
    logger.log('differential baseline acknowledgment two', '#ffffff', { acknowledge: true });
    logger.hearCombat('differential baseline buffered combat');
    game.disturbed = false;
    return { game, runtime, gasCell, publication, assertCatchUp,
        failPublication: () => { failPublication = true; },
        assertAliases: () => {
            expect(leader.carriedMonster).toBe(carried); expect(carried.leader).toBe(leader);
            expect(leader.carriedItem).toBe(shared); expect(carried.carriedItem).toBe(shared);
            expect(game.purgatory).toContain(leader); expect(game.everSeenMonsters.has(historical)).toBe(true);
        } };
}

function runFailure(scenario: Scenario, failure: Failure, mode: Mode,
    unexpectedWrite?: (game: Game) => void) {
    const fixture = setup(scenario), { game, runtime, publication } = fixture;
    const beforePublication = publication.calls;
    const catchUp = (game as any).catchUpEnvironment.bind(game);
    const reached = vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation((timeAway: unknown) => {
        catchUp(timeAway);
        fixture.assertCatchUp();
        unexpectedWrite?.(game);
        if (failure === 'generation') {
            const stream = rng.getState().currentRNG;
            rng.setRNG(RNGType.RNG_SUBSTANTIVE); rng.randRange(1, 999);
            rng.setRNG(RNGType.RNG_COSMETIC); rng.randRange(1, 999); rng.setRNG(stream);
            logger.log('differential generation acknowledgment', '#ffffff', { acknowledge: true });
            logger.combat('differential generation combat');
            throw new Error('differential generation failure');
        }
    });
    if (failure === 'publication') fixture.failPublication();
    const checkpoint = vi.spyOn(generation, 'checkpointGenerationWorld').mockImplementation(select => {
        if (mode === 'full-oracle') return checkpointFullGenerationWorld(game);
        if (mode === 'omit-gas-cell') {
            // Deliberately break only capture, never generation or its observed
            // projection. Real catch-up writes this cell through Grid aliases.
            expect(fixture.gasCell).toBeDefined();
            return narrowCheckpoint(() => {
                const roots = select();
                return { ...roots, references: [...(roots.references ?? []), fixture.gasCell] };
            });
        }
        return narrowCheckpoint(select);
    });
    const observe = () => ({ world: projectGenerationWorld(game), random: rng.getState(),
        messages: messageState(), modules: runtime.snapshot() });
    const before = observe();
    const graph = auditFullObjectGraph(fullGenerationRoots(game), [runtime]);
    expect(graph.objects).toBeGreaterThan(1000);
    const allocatorsBefore = { entity: getNextEntityId(), machine: getNextMachineNumber() };
    expect(() => enter(game, scenario.target, scenario.kind === 'cached-fall')).toThrow(`differential ${failure} failure`);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(publication.calls - beforePublication).toBe(failure === 'publication' ? 1 : 0);
    expect(publication.mutated).toBe(failure === 'publication');
    expect(game.extensionRuntime).toBe(runtime);
    fixture.assertAliases();
    // Audit BEFORE projecting; a save/display helper cannot hide a leaked write.
    const differences = graph.differences();
    const after = observe();
    expect(rng.getState()).toEqual(after.random);
    const allocatorsAfter = { entity: getNextEntityId(), machine: getNextMachineNumber() };
    expect(allocatorsAfter.entity).toBeGreaterThanOrEqual(allocatorsBefore.entity);
    reached.mockRestore(); checkpoint.mockRestore();
    return { before, after, differences, allocators: { before: allocatorsBefore, after: allocatorsAfter } };
}

describe('full-graph oracle versus narrowed generation rollback', () => {
    for (const scenario of scenarios) for (const failure of ['generation', 'publication'] as const) {
        it(`matches original full capture: seed ${scenario.seed}, ${scenario.kind} D${scenario.target}, ${failure} failure`, () => {
            // Independent fresh fixed-seed worlds run the identical real entry.
            // The oracle branch never evaluates the narrowed root selector.
            const reference = runFailure(scenario, failure, 'full-oracle');
            expect(reference.differences).toEqual([]);
            expect(reference.after).toEqual(reference.before);
            const narrowed = runFailure(scenario, failure, 'narrow');
            expect(narrowed.differences).toEqual([]);
            expect(narrowed.before).toEqual(reference.before);
            expect(narrowed.after).toEqual(reference.after);
            // Allocators intentionally are not restored, but the two real
            // generation paths must have exactly the same allocation outcome.
            expect(narrowed.allocators).toEqual(reference.allocators);
        });
    }

    it('detects a real catch-up gas write when its mutable cell is omitted from the write-set', () => {
        const scenario = scenarios[2]!;
        const reference = runFailure(scenario, 'generation', 'full-oracle');
        expect(reference.differences).toEqual([]);
        expect(reference.after).toEqual(reference.before);
        const mutant = runFailure(scenario, 'generation', 'omit-gas-cell');
        expect(mutant.before).toEqual(reference.before);
        expect(mutant.differences.some(path => path.endsWith('.volume value'))).toBe(true);
        expect(mutant.after.world).not.toEqual(reference.after.world);
        expect(mutant.after.random).toEqual(reference.after.random);
        expect(mutant.after.messages).toEqual(reference.after.messages);
        expect(mutant.after.modules).toEqual(reference.after.modules);
    });

    it('detects a newly introduced generation write absent from both the write-set and save schema', () => {
        const scenario = scenarios[1]!;
        const futureWrite = (game: Game) => {
            // A hypothetical new generation hook touches detached D1 geometry.
            // Its field is intentionally NOT a registered save/projection field.
            Object.defineProperty(game.levels.get(1)!.grid.getCell(10, 10)!, 'futureGenerationWrite', {
                value: { changed: true }, configurable: true, enumerable: false,
            });
        };
        const reference = runFailure(scenario, 'publication', 'full-oracle', futureWrite);
        expect(reference.differences).toEqual([]);
        expect(reference.after).toEqual(reference.before);
        const mutant = runFailure(scenario, 'publication', 'narrow', futureWrite);
        expect(mutant.before).toEqual(reference.before);
        // This is the important counterexample: serializers agree, but full
        // independent object observation correctly rejects the missing write.
        expect(mutant.after).toEqual(reference.after);
        expect(mutant.differences.some(path => path.endsWith(' own keys'))).toBe(true);
    });

    it('the retained oracle itself restores shared cycles, descriptor changes and typed bytes in place', () => {
        const item = { bytes: new Uint16Array([17, 31]), value: 4 };
        const root = { item, alias: item, items: new Map<object, object>([[item, item]]) };
        Object.assign(item, { owner: root });
        Object.defineProperty(item, 'hidden', { value: 9, writable: false, enumerable: false, configurable: true });
        const audit = auditFullObjectGraph(root);
        const restore = checkpointFullObjectGraph(root, []);
        item.value = 99; item.bytes.fill(0); root.alias = { bytes: new Uint16Array(), value: 1 };
        root.items.clear(); Object.defineProperty(item, 'hidden', { value: 8, writable: true });
        Object.assign(item, { added: true });
        expect(audit.differences().length).toBeGreaterThan(0);
        restore();
        expect(audit.differences()).toEqual([]);
        expect(root.item).toBe(item); expect(root.alias).toBe(item); expect(root.items.get(item)).toBe(item);
    });
});

it('preserves independent shallow/reference stops, shared identities and full descriptors across cyclic overlapping write sets',()=>{
 for(const grouped of [false,true]){
  const leaf={value:1},excluded={value:1},key={value:1},bytes=new Uint8Array([1,2]);
  const shared:any={leaf,bytes,map:new Map([[key,leaf]]),set:new Set([leaf])};shared.self=shared;
  const symbol=Symbol('owned');Object.defineProperty(shared,symbol,{value:leaf,enumerable:false,writable:true,configurable:true});
  let reads=0;Object.defineProperty(shared,'getter',{get(){reads++;return excluded;},enumerable:true,configurable:true});
  const root={shared,excluded},first=()=>({shallow:[root,shared],deep:[shared.map],references:[leaf]}),second=()=>({shallow:[root],deep:[shared],references:[excluded]});
  const audit=auditFullObjectGraph(root,[excluded]);
  const undo=grouped?checkpointGenerationWorldGroups([first,second]):(()=>{const a=checkpointGenerationWorld(first),b=checkpointGenerationWorld(second);return()=>{a();b();};})();
  root.shared={} as any;shared.leaf={value:2};leaf.value=2;key.value=2;bytes.fill(9);shared.map.clear();shared.set.clear();shared.extra=3;delete shared[symbol];excluded.value=2;
  undo();expect(audit.differences()).toEqual([]);expect(excluded.value).toBe(2);expect(reads).toBe(0);
 }
});
it('does not promote a reference-only descendant or a shallow-only root while another selection owns their containers',()=>{
 const reference={value:1},shallow={leaf:{value:1}},map=new Map([[reference,shallow]]),root={map};
 const undo=checkpointGenerationWorldGroups([()=>({shallow:[shallow],deep:[root],references:[reference]}),()=>({shallow:[map],deep:[],references:[]})]);
 reference.value=2;shallow.leaf.value=2;map.clear();undo();
 expect(reference.value).toBe(2);expect(shallow.leaf.value).toBe(2);expect([...map]).toEqual([[reference,shallow]]);
});

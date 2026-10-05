import { createCombatModuleFromPack } from '../module';
import { initialActorResources } from '../../../../engine/Core/ActorResources';
import { describe, expect, it, vi } from 'vitest';
import definitions from '../data/definitions.json';
import locale from '../locales/zh_CN.json';
import { loadCombatDefinitionPack } from '../definitions';
import { CombatValidationError, loadCombatPack } from '../schema';
import { enterCombatLevel, removeCombatBonfires, validateCombatBonfireWorldBindings } from '../bonfires';
import { bonfireInstanceKey, initialBonfireState, validateBonfireConfig, validateBonfireState,
    type BonfireConfig, type BonfireState } from '../../../worldRest';
import { ExtensionRegistry } from '../../../registry';
import { ExtensionRuntime, type ExtensionPorts } from '../../../runtime';
import type { ExtensionModule, Json } from '../../../types';
import { extensionDataFingerprint } from '../../../fingerprint';
import { getNextEntityId } from '../../../../entities/Creature';
import { rng } from '../../../../engine/Random';
import { Grid, TerrainType } from '../../../../engine/Map/Grid';
import { interactablePlacementCells } from '../../../worldSpatial';
import type { CombatPack } from '../types';

const pack = () => loadCombatDefinitionPack();
const raw = () => structuredClone(definitions) as CombatPack;
const invalid = (mutate: (config: BonfireConfig) => void) => {
    const value = raw(); mutate(value.bonfires); expect(() => loadCombatPack(value, locale)).toThrow(CombatValidationError);
};
function ledger(): BonfireState {
    const state = initialBonfireState(), instanceKey = bonfireInstanceKey('combat.bonfire', 1);
    state.bindings['100'] = { definitionId: 'combat.bonfire', instanceKey };
    state.placements.push({ ...state.bindings['100']!, depth: 1, result: 'placed', visits: 0, completedRests: 0 });
    return state;
}
function fixture(options: { mutate?: (pack: CombatPack) => void; fail?: boolean; cells?: {x:number;y:number}[] } = {}) {
    const value = raw(); options.mutate?.(value); const definitionPack = loadCombatPack(value, locale);
    let depth = 1, candidates = options.cells ?? [{ x: 3, y: 3 }, { x: 4, y: 3 }];
    const services: ExtensionPorts = { depth: () => depth, playerId: () => 1,
        randomInt: vi.fn(() => { throw new Error('placement must not draw RNG'); }), message: vi.fn(),
        interactableCandidates: vi.fn(() => candidates), isInteractableVisible: () => true, canInteractWith: () => true };
    const module: ExtensionModule = { id: 'combat', version: '1.5.0', worldInteractables: true,
        initialState: () => ({ revision: 0, nextActionId: 1, bonfires: initialBonfireState() as unknown as Json }),
        validateState: (value): value is Json => {
            try { validateBonfireState((value as {bonfires:unknown}).bonfires, definitionPack.bonfires, 1); return true; } catch { return false; }
        },
        validateComponents: (state, _components, foundation) => validateCombatBonfireWorldBindings(definitionPack, (state as {bonfires:Json}).bonfires, foundation.world),
        validateWorld: (state, _components, _actors, world) => validateCombatBonfireWorldBindings(definitionPack, (state as {bonfires:Json}).bonfires, world),
        hooks: { enteredLevel: (event, context) => { enterCombatLevel(definitionPack, event, context); if (options.fail) throw new Error('after bonfire placement'); },
            interactablesRemoved: (event, context) => removeCombatBonfires(definitionPack, event, context) } };
    const registry = new ExtensionRegistry(); registry.register(module.id, module.version, () => module);
    const runtime = new ExtensionRuntime(registry, registry.manifest(['combat']), services);
    const enter = (nextDepth: number, firstVisit = true) => {
        depth = nextDepth; const token = runtime.beginGeneration('bonfire-entry');
        runtime.emit('enteredLevel', { depth, firstVisit });
        try { runtime.commitGeneration(token); } catch (error) { runtime.rollbackGeneration(token); throw error; }
    };
    return { runtime, enter, registry, services, pack: definitionPack, setCells: (cells: typeof candidates) => { candidates = cells; },
        state: () => (runtime.snapshot().modules.combat as unknown as {bonfires:BonfireState}).bonfires };
}

describe('3e finite bonfire definitions', () => {
    it('declares versioned safe placement, 500-tick completion-only full recovery and no world reset', () => {
        const value = pack(); expect(value.moduleVersion).toBe('1.5.0'); expect(value.rulesVersion).toBe('1.5.0');
        expect(value.bonfires.definitions).toHaveLength(1);
        expect(value.bonfires.definitions[0]).toMatchObject({ restTicks: 500, interactionDistance: 1,
            restorePolicy: { hp: 'full', stamina: 'full', poise: 'full' }, resetPolicy: 'none',
            placement: { minDepth: 1, maxDepth: 40, maxPerDepth: 1, maxPerRun: 40, onNoSpace: 'skip' } });
        expect(value.bonfires.limits).toEqual({ maxActive: 40, maxPlacements: 40, maxRestReceipts: 128 });
        expect(Object.isFrozen(value.bonfires.definitions[0]!.placement)).toBe(true);
    });
    it.each(['restTicks','interactionDistance'] as const)('rejects unsafe %s and nested undeclared keys', field => {
        invalid(config => { config.definitions[0]![field] = -1; });
        invalid(config => { config.definitions[0]![field] = Number.MAX_SAFE_INTEGER; });
        invalid(config => Object.assign(config.definitions[0]!.placement, { script: 'reset()' }));
        invalid(config => { delete (config.definitions[0] as unknown as Record<string, unknown>).restorePolicy; });
    });
    it('rejects unsupported recovery/reset policy, empty content, unknown locale and global ID collisions', () => {
        invalid(config => { config.definitions[0]!.restTicks = 0; });
        invalid(config => { config.definitions[0]!.restTicks = 1.5; });
        invalid(config => Object.assign(config.definitions[0]!, { resetPolicy: 'respawn' }));
        invalid(config => Object.assign(config.definitions[0]!.restorePolicy, { hp: 'per-tick' }));
        invalid(config => Object.assign(config.definitions[0]!.restorePolicy, { poison: 'clear' }));
        invalid(config => { config.definitions = []; });
        invalid(config => { config.definitions[0]!.nameKey = 'ext.combat.missing'; });
        invalid(config => { config.definitions[0]!.id = 'fixture.resources'; });
        invalid(config => { config.definitions[0]!.glyph = 'ab'; });
        invalid(config => { config.definitions[0]!.color = 'red'; });
    });
    it('rejects unbounded placement, impossible range, oversized aggregate and receipt limits', () => {
        invalid(config => { config.definitions[0]!.placement.maxDepth = 41; });
        invalid(config => { config.definitions[0]!.placement.minDepth = 0; });
        invalid(config => { config.definitions[0]!.placement.minDepth = 3; config.definitions[0]!.placement.maxDepth = 2; });
        invalid(config => { config.definitions[0]!.placement.maxPerDepth = 0; });
        invalid(config => { config.definitions[0]!.placement.maxPerRun = 41; });
        invalid(config => { config.definitions[0]!.placement.maxEntranceDistance = 1; });
        invalid(config => { config.limits.maxActive = 41; });
        invalid(config => { config.limits.maxRestReceipts = 4097; });
        invalid(config => { config.definitions.push({ ...structuredClone(config.definitions[0]!), id: 'combat.second' }); });
    });
    it('accepts explicit full/none recovery selection without adding native status effects', () => {
        const value = raw(); value.bonfires.definitions[0]!.restorePolicy = {hp:'none',stamina:'full',poise:'none'};
        expect(loadCombatPack(value,locale).bonfires.definitions[0]!.restorePolicy).toEqual({hp:'none',stamina:'full',poise:'none'});
        invalid(config => Object.assign(config.definitions[0]!.restorePolicy,{hunger:'full'}));
    });
    it('puts mechanical rest and placement values into the rules fingerprint', () => {
        const value = raw(), before = extensionDataFingerprint(pack()); value.bonfires.definitions[0]!.restTicks++;
        expect(extensionDataFingerprint(loadCombatPack(value, locale))).not.toBe(before);
        value.bonfires.definitions[0]!.restTicks--; value.bonfires.definitions[0]!.placement.maxEntranceDistance++;
        expect(extensionDataFingerprint(loadCombatPack(value, locale))).not.toBe(before);
    });
    it('strict generic DTOs reject accessors and cycles without running code', () => {
        let reads = 0; const value = structuredClone(pack().bonfires);
        Object.defineProperty(value, 'limits', { enumerable: true, get: () => { reads++; return {}; } });
        expect(() => validateBonfireConfig(value)).toThrow(); expect(reads).toBe(0);
        const state = initialBonfireState(); Object.assign(state, { cycle: state });
        expect(() => validateBonfireState(state, pack().bonfires)).toThrow();
    });
});

describe('3e bonfire ledger validation', () => {
    it('validates a detached initial/placed ledger without restoring resources or mutating source', () => {
        const value = ledger(), before = structuredClone(value), random = rng.getState();
        const result = validateBonfireState(value, pack().bonfires, 1);
        expect(result).toEqual(before); expect(result).not.toBe(value); expect(result.bindings).not.toBe(value.bindings);
        expect(value).toEqual(before); expect(rng.getState()).toEqual(random);
    });
    it('rejects duplicate or orphan slots, IDs, receipts and unsupported pending placements', () => {
        const cases = [
            (value: BonfireState) => { value.placements.push({ ...value.placements[0]! }); },
            (value: BonfireState) => { value.bindings['101'] = { ...value.bindings['100']! }; },
            (value: BonfireState) => { value.bindings['100']!.instanceKey = 'combat.bonfire.slot.2'; },
            (value: BonfireState) => { value.placements[0]!.result = 'skipped'; },
            (value: BonfireState) => { value.placements[0]!.visits = 1; },
            (value: BonfireState) => { value.placements[0]!.completedRests = 1; },
            (value: BonfireState) => { value.pending.push({ definitionId: 'combat.bonfire', instanceKey: 'combat.bonfire.slot.2', attemptedDepths: [1] }); },
        ];
        for (const mutate of cases) { const value = ledger(); mutate(value); expect(() => validateBonfireState(value, pack().bonfires, 2)).toThrow(); }
    });
    it('accepts in-flight sole-clock metadata and validates visit, binding, source and terminal receipt', () => {
        const value = ledger(), binding = value.bindings['100']!; value.placements[0]!.visits = 1;
        value.active = { ...binding, actionId: 1, bonfireId: 100, visit: 1, actorId: 2, depth: 1,
            phase: 'resting', startHp: 4, anchor: {x:2,y:2}, interrupted: null };
        expect(() => validateBonfireState(value, pack().bonfires, 2)).not.toThrow();
        value.active.phase = 'settling'; expect(() => validateBonfireState(value, pack().bonfires, 2)).not.toThrow();
        for (const mutation of [{ remaining: 500 }, { visit: 2 }, { actionId: 2 }, { bonfireId: 101 }, { interrupted: 'poison' }]) {
            const bad = structuredClone(value); Object.assign(bad.active!, mutation); expect(() => validateBonfireState(bad, pack().bonfires, 2)).toThrow();
        }
        value.active = null; value.placements[0]!.completedRests = 1;
        value.receipts.push({ ...binding, actionId: 1, bonfireId: 100, visit: 1, actorId: 2, depth: 1, result: 'completed', reason: null });
        expect(() => validateBonfireState(value, pack().bonfires, 2)).not.toThrow();
        value.receipts[0]!.reason = 'damage'; expect(() => validateBonfireState(value, pack().bonfires, 2)).toThrow();
    });
    it('rejects gaps in retained per-bonfire visits and more historical visits than allocated actions', () => {
        const config = structuredClone(pack().bonfires); config.limits.maxRestReceipts = 2;
        const value = ledger(); value.placements[0]!.visits = value.placements[0]!.completedRests = 10;
        value.receipts = [9,10].map(visit => ({ ...value.bindings['100']!, actionId: visit, bonfireId: 100, visit, actorId: 2, depth: 1, result: 'completed', reason: null }));
        const gap = structuredClone(value); gap.receipts[0]!.visit = 8;
        expect(() => validateBonfireState(gap, config, 11)).toThrow('duplicate/unordered receipt');
        value.receipts[0]!.actionId = 1; value.receipts[1]!.actionId = 2;
        expect(() => validateBonfireState(value, config, 3)).toThrow('visits exceed allocated actions');
    });
    it('rejects excess pending attempts at the same depth and pending/placed overlap', () => {
        const config = structuredClone(pack().bonfires); config.definitions[0]!.placement.onNoSpace = 'defer';
        const value = initialBonfireState();
        value.pending = [1,2].map(ordinal => ({definitionId:'combat.bonfire',instanceKey:bonfireInstanceKey('combat.bonfire',ordinal),attemptedDepths:[1]}));
        expect(() => validateBonfireState(value,config,1)).toThrow('depth attempt budget');
        const overlap=ledger();overlap.pending=[value.pending[1]!];
        expect(() => validateBonfireState(overlap,config,1)).toThrow('depth attempt budget');
    });
    it('allows transient interrupted target removal in both scheduler phases without repairing the supplied ledger', () => {
        const value=ledger(),binding=value.bindings['100']!;value.placements[0]!.visits=1;
        value.active={...binding,actionId:1,bonfireId:100,visit:1,actorId:2,depth:1,phase:'resting',startHp:4,anchor:{x:2,y:2},interrupted:'target-removed'};
        delete value.bindings['100'];
        for(const phase of ['resting','settling'] as const){value.active.phase=phase;const before=structuredClone(value);
            expect(validateBonfireState(value,pack().bonfires,2)).toEqual(before);expect(value).toEqual(before);}
        value.active.interrupted=null;expect(()=>validateBonfireState(value,pack().bonfires,2)).toThrow('missing active binding');
    });
    it('rejects changing a surviving or archived bonfire identity inside a receipt', () => {
        const value=ledger(),binding=value.bindings['100']!;value.placements[0]!.visits=value.placements[0]!.completedRests=2;
        value.receipts=[1,2].map(visit=>({...binding,actionId:visit,bonfireId:100,visit,actorId:2,depth:1,result:'completed',reason:null}));
        value.receipts[1]!.bonfireId=101;
        expect(()=>validateBonfireState(value,pack().bonfires,3)).toThrow('reused entity ID');
        delete value.bindings['100'];expect(()=>validateBonfireState(value,pack().bonfires,3)).toThrow('reused entity ID');
    });
    it('keeps an explicit rolling history while totals prevent lifetime reset after eviction or GC', () => {
        const config = structuredClone(pack().bonfires); config.limits.maxRestReceipts = 2;
        const value = ledger(); value.placements[0]!.visits = value.placements[0]!.completedRests = 10;
        value.receipts = [9,10].map(visit => ({ ...value.bindings['100']!, actionId: visit, bonfireId: 100, visit, actorId: 2, depth: 1, result: 'completed', reason: null }));
        expect(() => validateBonfireState(value, config, 11)).not.toThrow(); delete value.bindings['100'];
        expect(() => validateBonfireState(value, config, 11)).not.toThrow();
        const bad = structuredClone(value); bad.receipts[1]!.visit = 9; expect(() => validateBonfireState(bad, config, 11)).toThrow();
        value.receipts.pop(); expect(() => validateBonfireState(value, config, 11)).toThrow();
    });
});

describe('3e committed safe placement and lifetime', () => {
    it('allocates one shared world ID per eligible depth and leaves both random streams unchanged', () => {
        const f = fixture(), before = rng.getState(), nextId = getNextEntityId();
        f.enter(1); const world = f.runtime.snapshot().foundation.world;
        expect(world.entities).toHaveLength(1); expect(world.entities[0]!.id).toBe(nextId);
        expect(world.entities[0]).toMatchObject({ owner: 'combat', contentId: 'combat.bonfire', depth: 1, x: 3, y: 3, priority: 0 });
        expect(f.state().placements).toEqual([{ definitionId: 'combat.bonfire', instanceKey: 'combat.bonfire.slot.1', depth: 1, result: 'placed', visits: 0, completedRests: 0 }]);
        f.enter(2); expect(f.runtime.snapshot().foundation.world.entities).toHaveLength(2);
        expect(getNextEntityId()).toBe(nextId + 2); expect(rng.getState()).toEqual(before);
        expect(f.services.randomInt).not.toHaveBeenCalled(); expect(f.services.message).not.toHaveBeenCalled();
    });
    it.each([257,1024])('places %i configured objects in bounded batches with stable order and cross-batch collisions', count => {
        const cells=Array.from({length:count},(_,index)=>({x:index%32,y:Math.floor(index/32)}));
        const f=fixture({cells,mutate:value=>{Object.assign(value.bonfires.limits,{maxActive:count,maxPlacements:count});
            Object.assign(value.bonfires.definitions[0]!.placement,{maxPerDepth:count,maxPerRun:count});}});
        const firstId=getNextEntityId(),random=rng.getState();f.enter(1);
        const entities=f.runtime.snapshot().foundation.world.entities,keys=Array.from({length:count},(_,index)=>bonfireInstanceKey('combat.bonfire',index+1)).sort();
        expect(entities.map(entity=>entity.instanceKey)).toEqual(keys);
        expect(entities.map(entity=>entity.id)).toEqual(Array.from({length:count},(_,index)=>firstId+index));
        expect(entities.map(({x,y})=>({x,y}))).toEqual(cells);
        expect(new Set(entities.map(entity=>`${entity.x},${entity.y}`)).size).toBe(count);
        expect(f.state().placements).toHaveLength(count);expect(Object.keys(f.state().bindings)).toHaveLength(count);
        expect(f.services.interactableCandidates).toHaveBeenCalledTimes(count);expect(rng.getState()).toEqual(random);
    });
    it('rolls back earlier placement batches and their entity IDs when a later batch fails', () => {
        const cells=Array.from({length:257},(_,index)=>({x:index%32,y:Math.floor(index/32)}));
        const f=fixture({cells,mutate:value=>{Object.assign(value.bonfires.limits,{maxActive:257,maxPlacements:257});
            Object.assign(value.bonfires.definitions[0]!.placement,{maxPerDepth:257,maxPerRun:257});}});
        let calls=0;(f.services.interactableCandidates as ReturnType<typeof vi.fn>).mockImplementation(()=>{
            if(++calls===257)throw new Error('second placement batch failed');return cells;});
        const before=f.runtime.snapshot(),nextId=getNextEntityId(),random=rng.getState();
        expect(()=>f.enter(1)).toThrow('second placement batch failed');expect(calls).toBe(257);
        expect(f.runtime.snapshot()).toEqual(before);expect(getNextEntityId()).toBe(nextId);expect(rng.getState()).toEqual(random);
    });
    it('does not place on attach/load, cached revisit, or duplicate committed firstVisit', () => {
        const f = fixture(), initial = f.runtime.snapshot(); f.runtime.newGame(); f.runtime.loaded(); expect(f.runtime.snapshot()).toEqual(initial);
        f.enter(1); const before = f.runtime.snapshot(), nextId = getNextEntityId();
        f.enter(1, false); f.enter(1, true); expect(f.runtime.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(nextId);
        const loaded = new ExtensionRuntime(f.registry, f.registry.manifest(['combat']), f.services, before);
        loaded.loaded(); expect(loaded.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(nextId);
    });
    it('skips no-space placements permanently without consuming IDs or altering terrain', () => {
        const f = fixture({cells:[]}), nextId = getNextEntityId(); f.enter(1);
        expect(f.state().placements[0]!.result).toBe('skipped'); expect(f.state().pending).toEqual([]); expect(getNextEntityId()).toBe(nextId);
        const before = f.runtime.snapshot(); f.setCells([{x:2,y:2}]); f.enter(1, false); f.enter(1, true);
        expect(f.runtime.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(nextId);
    });
    it('defers a finite run slot forward once per new depth, then places or terminates at expiry', () => {
        const mutate = (value: CombatPack) => Object.assign(value.bonfires.definitions[0]!.placement, { maxDepth: 3, maxPerRun: 1, onNoSpace: 'defer' });
        const f = fixture({mutate,cells:[]}); f.enter(1); f.enter(1, true); f.enter(2);
        expect(f.state().pending).toEqual([{ definitionId:'combat.bonfire',instanceKey:'combat.bonfire.slot.1',attemptedDepths:[1,2] }]);
        f.setCells([{x:2,y:2}]); f.enter(3); expect(f.state().pending).toEqual([]); expect(f.state().placements[0]).toMatchObject({depth:3,result:'placed'});
        const g = fixture({mutate,cells:[]}); g.enter(1); g.enter(3); expect(g.state().placements[0]).toMatchObject({depth:3,result:'skipped'});
        const h = fixture({mutate,cells:[]}); h.enter(1); h.enter(4); expect(h.state().pending).toEqual([]); expect(h.state().placements[0]).toMatchObject({depth:4,result:'skipped'});
    });
    it('retains cached bindings, collects missing-depth bindings, and never reclaims a spent run slot', () => {
        const f = fixture({mutate:value=>{value.bonfires.definitions[0]!.placement.maxPerRun=1;}}); f.enter(1);
        const before = f.runtime.snapshot(); f.runtime.collectWorld([1,2], false); expect(f.runtime.snapshot()).toEqual(before);
        f.runtime.collectWorld([2],false); expect(f.state().bindings).toEqual({}); expect(f.state().placements).toEqual((before.modules.combat as unknown as {bonfires:BonfireState}).bonfires.placements);
        f.enter(2); f.enter(1,false); expect(f.runtime.snapshot().foundation.world.entities).toEqual([]); expect(f.state().placements).toHaveLength(1);
    });
    it('turns active-capacity exhaustion into configured no-space outcome while respecting max placements', () => {
        const f = fixture({mutate:value=>{value.bonfires.limits.maxActive=1;}}); f.enter(1); f.enter(2);
        expect(f.runtime.snapshot().foundation.world.entities).toHaveLength(1);
        expect(f.state().placements.map(row=>row.result)).toEqual(['placed','skipped']);
    });
    it('rolls back the world, module ledger and global entity counter if the hook fails after placement', () => {
        const f = fixture({fail:true}), before = f.runtime.snapshot(), nextId = getNextEntityId(), random = rng.getState();
        expect(()=>f.enter(1)).toThrow('after bonfire placement'); expect(f.runtime.snapshot()).toEqual(before);
        expect(getNextEntityId()).toBe(nextId); expect(rng.getState()).toEqual(random);
    });
    it('validates exact mutual ownership/content/depth bindings and refuses a combat interaction gate', () => {
        const f=fixture();f.enter(1);const world=f.runtime.snapshot().foundation.world, state=f.state();
        expect(validateCombatBonfireWorldBindings(f.pack,state,world)).toBe(true);
        for(const mutation of [{contentId:'combat.missing'},{depth:2},{glyph:'?'},{interactionDistance:2},{instanceKey:'combat.bonfire.slot.2'}]) {
            const bad=structuredClone(world);Object.assign(bad.entities[0]!,mutation);expect(validateCombatBonfireWorldBindings(f.pack,state,bad)).toBe(false);
        }
        expect(validateCombatBonfireWorldBindings(f.pack,state,{entities:[],gate:null})).toBe(false);
        expect(validateCombatBonfireWorldBindings(f.pack,state,{...world,gate:{owner:'combat'}})).toBe(false);
    });
    it('rejects duplicate world rows that would hide a second orphaned binding', () => {
        const f=fixture();f.enter(1);f.enter(2);const world=f.runtime.snapshot().foundation.world;
        expect(validateCombatBonfireWorldBindings(f.pack,f.state(),world)).toBe(true);
        world.entities[1]=structuredClone(world.entities[0]!);
        expect(validateCombatBonfireWorldBindings(f.pack,f.state(),world)).toBe(false);
    });
    it('uses safe existing floor candidates without editing map cells, consuming dice or blocking native movement', () => {
        const f=fixture(),map=new Grid(12,10);
        for(let y=0;y<10;y++)for(let x=0;x<12;x++){map.setTerrain(x,y,TerrainType.FLOOR);map.getCell(x,y)!.isVisible=true;}
        map.setTerrain(5,5,TerrainType.STAIRS_UP);map.setTerrain(3,3,TerrainType.LAVA);map.getCell(3,4)!.machineNumber=1;map.getCell(3,5)!.isVisible=false;
        const cells=()=>Array.from({length:map.height},(_,y)=>Array.from({length:map.width},(_,x)=>structuredClone(map.getCell(x,y))));
        const source=cells(),random=rng.getState();
        (f.services.interactableCandidates as ReturnType<typeof vi.fn>).mockImplementation(request=>interactablePlacementCells(map,{x:5,y:5},[{x:4,y:3}],request));
        f.enter(1);const entity=f.runtime.snapshot().foundation.world.entities[0]!;
        expect(Math.max(Math.abs(entity.x-5),Math.abs(entity.y-5))).toBeGreaterThanOrEqual(2);
        expect([{x:3,y:3},{x:3,y:4},{x:3,y:5},{x:4,y:3}]).not.toContainEqual({x:entity.x,y:entity.y});
        expect(map.getCell(entity.x,entity.y)!.isPassable).toBe(true);expect(cells()).toEqual(source);expect(rng.getState()).toEqual(random);
    });
});


describe('3e generic actor-ledger transaction identity rollback',()=>{
    it.each(['command','settle','collect'] as const)('restores retained scheduler/resource/bonfire references after a later %s hook fails',kind=>{
        const definitionPack=pack(),base=createCombatModuleFromPack(definitionPack);
        const mutate=(context:import('../../../types').ExtensionContext)=>{
            const next=context.state as unknown as import('../../../actorActions').ProductionActorAttackState;
            next.revision++;next.actors[0]!.stamina--;context.setState(next as unknown as Json);throw new Error('after in-place actor state');
        };
        const module:ExtensionModule={...base,commands:{fault:(_payload,context)=>mutate(context)},hooks:{...base.hooks,
            simulationSettled:(_event,context)=>{if(kind==='settle')mutate(context);},
            interactablesRemoved:(event,context)=>{base.hooks!.interactablesRemoved!(event,context);throw new Error('after in-place actor state');}}};
        const registry=new ExtensionRegistry();registry.register(module.id,module.version,()=>module,module.rules);
        const runtime=new ExtensionRuntime(registry,registry.manifest(['combat']),{depth:()=>1,playerId:()=>1,randomInt:()=>{throw new Error('unexpected RNG');},message:()=>{},
            interactableCandidates:()=>[{x:3,y:3}],isInteractableVisible:()=>true,canInteractWith:()=>true});
        const root=runtime.actorActionBinding()!.state;
        root.actors.push({actorId:1,profileId:definitionPack.playerProfileId,...initialActorResources(definitionPack.resourcePolicies[0]!)});
        const token=runtime.beginGeneration('identity-rest-point');runtime.emit('enteredLevel',{depth:1,firstVisit:true});runtime.commitGeneration(token);
        const before=runtime.snapshot(),scheduler=root.scheduler,actors=root.actors,actor=actors[0]!,bonfires=root.bonfires!,bindings=bonfires.bindings;
        const fail=()=>kind==='command'?runtime.command(JSON.stringify({module:'combat',action:'fault',payload:{}}))
            :kind==='settle'?runtime.settle([]):runtime.collectWorld([],false);
        expect(fail).toThrow('after in-place actor state');expect(runtime.snapshot()).toEqual(before);
        expect(runtime.actorActionBinding()!.state).toBe(root);expect(root.scheduler).toBe(scheduler);expect(root.actors).toBe(actors);
        expect(root.actors[0]).toBe(actor);expect(root.bonfires).toBe(bonfires);expect(root.bonfires!.bindings).toBe(bindings);
    });
});

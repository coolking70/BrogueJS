import { describe, expect, it, vi } from 'vitest';
import { ExtensionRuntime, type ExtensionPorts } from '../../../runtime';
import { registryFromDescriptors } from '../../../descriptor';
import { descriptor } from '../descriptor';
import type { NarrativeState } from '../state';
import { loadNarrativeDefinitionPack } from '../definitions';

// Diagnostic foundation-port fixtures, NOT natural Game/placement evidence.
// The unmodified installed pack remains authoritative; only available world
// candidates are controlled here to reach no-space and depth endpoints.
const rows = [
    { id: 'cord.mender', min: 2, max: 3 },
    { id: 'cistern.listener', min: 3, max: 4 },
    { id: 'bone.clerk', min: 4, max: 6 },
    { id: 'salt.warden', min: 6, max: 8 },
    { id: 'letter.carrier', min: 8, max: 10 },
] as const;
function fixture() {
    let depth = 1, space = true;
    const candidates = vi.fn(() => space ? Array.from({ length: 16 }, (_, index) => ({ x: index + 2, y: 2 })) : []);
    const randomInt = vi.fn(() => { throw new Error('Placement must not request RNG'); });
    const ports: ExtensionPorts = { depth: () => depth, playerId: () => 1, randomInt, message: vi.fn(),
        interactableCandidates: candidates, isInteractableVisible: () => true, canInteractWith: () => true };
    const registry = registryFromDescriptors([descriptor]);
    const runtime = new ExtensionRuntime(registry, registry.manifest(['narrative']), ports);
    return {
        runtime, candidates, randomInt,
        state: () => runtime.snapshot().modules.narrative as unknown as NarrativeState,
        space(value: boolean) { space = value; },
        enter(value: number, firstVisit = true) {
            depth = value;
            const token = runtime.beginGeneration(`diagnostic-${value}`);
            runtime.emit('enteredLevel', { depth, firstVisit });
            runtime.commitGeneration(token);
        },
    };
}

describe.each(rows)('N2-WORLD production placement bounds for $id (diagnostic ports)', row => {
    it('places once at each inclusive endpoint, never outside, and keeps binding and receipt on revisit', () => {
        for (const endpoint of [row.min, row.max]) {
            const f = fixture(); f.enter(row.min - 1);
            expect(f.runtime.snapshot().foundation.world.entities.filter(entity => entity.contentId === row.id)).toEqual([]);
            f.enter(endpoint);
            const before = f.runtime.snapshot();
            const entities = before.foundation.world.entities.filter(entity => entity.contentId === row.id);
            expect(entities).toHaveLength(1);
            const entity = entities[0]!;
            expect(entity).toMatchObject({ owner: 'narrative', contentId: row.id, instanceKey: `${row.id}.first.slot.1`, depth: endpoint,
                interactionDistance: 1, priority: 0 });
            expect(f.state().npcBindings[entity.id]).toEqual({ npcId: row.id, placementId: `${row.id}.first`, instanceKey: `${row.id}.first.slot.1` });
            const receipts = f.state().placementReceipts.filter(receipt => receipt.npcId === row.id);
            expect(receipts).toEqual([{ npcId: row.id, placementId: `${row.id}.first`, instanceKey: `${row.id}.first.slot.1`, depth: endpoint, result: 'placed' }]);
            for (const depth of [endpoint, row.max + 1, endpoint]) f.enter(depth, false);
            expect(f.runtime.snapshot().foundation.world.entities.filter(value => value.contentId === row.id)).toEqual(entities);
            expect(f.state().placementReceipts.filter(value => value.npcId === row.id)).toEqual(receipts);
            expect(f.runtime.snapshot().components).toEqual({});
            expect(f.randomInt).not.toHaveBeenCalled();
            f.runtime.unload();
        }
        const outside = fixture(); outside.enter(row.max + 1);
        expect(outside.state().placementReceipts.filter(value => value.npcId === row.id)).toEqual([]);
        expect(outside.runtime.snapshot().foundation.world.entities.filter(value => value.contentId === row.id)).toEqual([]);
        outside.runtime.unload();
    });

    it('defers only to forward first visits and finalizes no-space at max depth without regenerating', () => {
        const f = fixture(); f.space(false); f.enter(row.min);
        expect(f.state().pendingPlacements.find(value => value.npcId === row.id)?.attemptedDepths).toEqual([row.min]);
        f.enter(row.min, false); f.enter(row.min, true);
        expect(f.state().pendingPlacements.find(value => value.npcId === row.id)?.attemptedDepths).toEqual([row.min]);
        f.enter(row.max);
        expect(f.state().pendingPlacements.filter(value => value.npcId === row.id)).toEqual([]);
        expect(f.state().placementReceipts.filter(value => value.npcId === row.id)).toEqual([
            { npcId: row.id, placementId: `${row.id}.first`, instanceKey: `${row.id}.first.slot.1`, depth: row.max, result: 'skipped' },
        ]);
        f.space(true); f.enter(row.min, false); f.enter(row.max, false);
        expect(f.runtime.snapshot().foundation.world.entities.filter(value => value.contentId === row.id)).toEqual([]);
        expect(f.randomInt).not.toHaveBeenCalled(); f.runtime.unload();
    });

    it('expires a deferred slot when the next first visit jumps past its maximum', () => {
        const f = fixture(); f.space(false); f.enter(row.min); f.space(true); f.enter(row.max + 1);
        expect(f.state().pendingPlacements.filter(value => value.npcId === row.id)).toEqual([]);
        expect(f.state().placementReceipts.filter(value => value.npcId === row.id)).toEqual([
            { npcId: row.id, placementId: `${row.id}.first`, instanceKey: `${row.id}.first.slot.1`, depth: row.max + 1, result: 'skipped' },
        ]);
        expect(f.runtime.snapshot().foundation.world.entities.filter(value => value.contentId === row.id)).toEqual([]);
        f.runtime.unload();
    });
});

it('N2-WORLD uses unchanged stationary/passable foundation requests with exact stair/entrance budgets', () => {
    const pack = loadNarrativeDefinitionPack();
    for (const row of rows) {
        const npc = pack.npcs.find(value => value.id === row.id)!;
        expect(npc.presence).toBe('stationary-interactable');
        expect(npc.interactionDistance).toBe(1);
        expect(npc.placements).toEqual([{ id: `${row.id}.first`, minDepth: row.min, maxDepth: row.max,
            maxPerRun: 1, maxPerDepth: 1, minStairDistance: 1, maxEntranceDistance: 8, onNoSpace: 'defer' }]);
        for (const forbidden of ['hp', 'ai', 'professionId', 'residentId', 'recruitable', 'blocking']) expect(npc).not.toHaveProperty(forbidden);
    }
});

import { afterEach, expect, it, vi } from 'vitest';
import * as catalog from '../../../catalog';
import { actorActionProtocolFixture } from '../../../../test/fixtures/actorActionProtocol';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { residentScene } from './residentHelpers';
import { current, travelScenes } from './helpers';
import { advanceWorldClock } from '../../../world5';
import { campRaid, frozenRaidActors, validateRaidReferences } from '../../../../engine/Core/SettlementRaids';
import { productionActorActionScheduler, validateProductionActorActionSession } from '../../../../engine/Core/ActorActionProduction';
import { validateProductionActorAttackState } from '../../../actorActionValidation';
import { MonsterState } from '../../../../entities/Monster';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import type { Game } from '../../../../engine/Core/Game';

afterEach(() => { logger.reset(); logger.onDisturb = null; });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function activeRaid() {
    // Settlement's real configured rules, paid home/resident and native wave
    // admission remain authoritative. Only the optional action backend is an
    // independent protocol fixture; no installed combat content is borrowed.
    const installed = catalog.getInstalledModuleDescriptors();
    vi.spyOn(catalog, 'getInstalledModuleDescriptors').mockReturnValue([
        ...installed.filter(d => d.id !== 'combat'), actorActionProtocolFixture
    ]);
    travelScenes();
    const s = residentScene(['settlement', 'combat'], true), { g, h } = s;
    g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState();
    advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks);
    h.command('wait');
    for (let n = 0; n < 40 && campRaid(g, current(g).slot)!.event?.phase !== 'active'; n++) h.command('wait');
    const raid = campRaid(g, current(g).slot)!;
    expect(raid.event!.phase).toBe('active');
    expect(raid.event!.actorIds).toHaveLength(raid.event!.budget);
    expect(raid.pauseFrom).toBeNull(); validateRaidReferences(g);
    return { ...s, slot: raid.slot, eventId: raid.event!.id };
}
function fullSave(game: Game) {
    const saved = clone(game.toSaveSnapshot()); saved.savedAt = 0; return saved;
}

it.each([false, true])('SDK1 R1-C1 real frozen raid windup survives generation rollback, full frozen save/load and one completion (replace live session=%s)', replaceSession => {
    const { g, h, slot, eventId } = activeRaid();
    const raid = campRaid(g, slot)!, enemy = g.monsters.find(m => m.id === raid.event!.actorIds[0])!;
    const actorId = enemy.id;
    expect(['rat', 'kobold']).toContain(enemy.typeId);
    for (const monster of g.monsters) monster.ticksUntilTurn = 100000;
    g.player.loc = { x: 30, y: 25 }; g.player.hp = g.player.maxHp = 1000;
    enemy.loc = { x: 29, y: 25 }; enemy.hp = enemy.maxHp = 100;
    enemy.state = MonsterState.HUNTING; enemy.ticksUntilTurn = 99;
    g.refreshStructureDerivedState();
    const binding = g.extensionRuntime!.actorActionBinding()!, policy = binding.definition.resourcePolicies[0]!;
    const staminaBefore = binding.state.actors.find(a => a.actorId === actorId)?.stamina ?? policy.initialStamina;
    h.command('wait'); // The real native decision pays and starts the warning.
    const bundle = g.actorActions!.bundles.find(b => b.decisionOwnerId === actorId)!;
    const id = bundle.actionId;
    const read = () => {
        const live = g.extensionRuntime!.actorActionBinding()!.state;
        const actor = [...g.monsters, ...[...g.levels.values()].flatMap(l => l.monsters)].find(a => a.id === actorId)!;
        return { bundle: g.actorActions!.bundles.find(b => b.actionId === id),
            metadata: live.actions.find(a => a.actionId === id), resource: live.actors.find(a => a.actorId === actorId),
            native: { ticks: actor.ticksUntilTurn, hp: actor.hp, loc: clone(actor.loc), statuses: clone(actor.statusDurations) } };
    };
    const original = clone(read());
    const attack = binding.definition.attacks.find(a => a.id === original.metadata!.subactions[0]!.attackId)!;
    expect(original.metadata!.paidCost).toBe(attack.cost);
    expect(original.resource!.stamina).toBe(staminaBefore - attack.cost);
    expect(original.bundle!.subactions[0]!.phases[original.bundle!.subactions[0]!.phaseIndex]!.kind).toBe('windup');
    expect(original.bundle!.subactions[0]!.phases.filter(p => p.segmentIndex !== null)).toHaveLength(2);
    const raidCosts = () => ({ eventId: campRaid(g, slot)!.event!.id, ordinal: campRaid(g, slot)!.lastOrdinal,
        lostUnits: campRaid(g, slot)!.event!.lostUnits,
        consumed: g.extensionRuntime!.worldCampRecords('settlement').find(c => c.slot === slot)!.consumedLockedUnits,
        gold: g.stats.gold });
    const costs = clone(raidCosts());
    // Prepare the actual public stair entry after the native wait. This is the
    // same controlled landing preparation as the existing raid freeze test;
    // it changes neither the raid actor nor its already locked attack cells.
    g.player.loc = { x: 30, y: 25 }; g.refreshStructureDerivedState();
    h.command('stairs_down');
    while (g.pendingCommandConfirmation) g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
    expect(g.depth, JSON.stringify({at:g.player.loc,locked:g.isInputLocked(),pending:g.hasPendingConfirmation,
        ack:logger.pendingAcknowledgment,terrain:g.grid.getCell(g.player.x,g.player.y)?.layers,error:g.lastAdvancementError,
        bundle:read().bundle})).toBe(2); expect(campRaid(g, slot)!.pauseFrom).not.toBeNull();
    validateRaidReferences(g);
    expect(frozenRaidActors(g)).toContain(actorId);
    expect(g.actorActionWorld().frozenRaidActorIds).toContain(actorId);
    expect(read()).toEqual(original);
    expect(read().bundle!.subactions[0]!.phases.some(p => p.kind === 'break-recovery')).toBe(false);

    const runtime = g.extensionRuntime!, ledger = runtime.actorActionBinding()!.state,
        action = ledger.actions.find(a => a.actionId === id)!, resource = ledger.actors.find(a => a.actorId === actorId)!,
        values = clone(ledger), root = g.actorActions!, scheduler = productionActorActionScheduler(g)!,
        graph = auditFullObjectGraph({ ledger, root }), before = fullSave(g), random = rng.getState();
    const parent = runtime.beginGeneration('floor'), child = runtime.beginGeneration('blueprint');
    runtime.rollbackGeneration(child); runtime.commitGeneration(parent);
    expect(runtime.actorActionBinding()!.state).toBe(ledger);
    expect(ledger).toEqual(values); expect(graph.differences()).toEqual([]);
    expect(ledger.actions.find(a => a.actionId === id)).toBe(action);
    expect(ledger.actors.find(a => a.actorId === actorId)).toBe(resource);
    expect(g.actorActions).toBe(root); expect(productionActorActionScheduler(g)).toBe(scheduler);
    validateProductionActorAttackState(ledger, binding.definition, new Set(), root);
    validateProductionActorActionSession(g); validateRaidReferences(g);
    expect(rng.getState()).toEqual(random); expect(fullSave(g)).toEqual(before);

    const nextActionId = root.nextActionId;
    advanceWorldClock(g.world5!, 96000); h.command('wait');
    for (let n = 0; n < 5; n++) h.command('wait');
    expect(read()).toEqual(original); expect(raidCosts()).toEqual(costs);
    expect(g.actorActions!.nextActionId).toBe(nextActionId);
    expect(frozenRaidActors(g)).toContain(actorId);
    const saved = fullSave(g);
    if (replaceSession) {
        h.load(JSON.stringify(saved)); expect(fullSave(g)).toEqual(saved);
    } else {
        // The native candidate scope restores global services afterwards. This
        // real load validates the entire frozen world while preserving the old
        // live finishAction closure for the subsequent no-rebind continuation.
        (g as any).withReplayCandidate((candidate: Game) => {
            expect(candidate.loadSnapshot(saved)).toBe(true);
            expect(fullSave(candidate)).toEqual(saved);
        });
        expect(productionActorActionScheduler(g)).toBe(scheduler);
        expect(runtime.actorActionBinding()!.state).toBe(ledger);
    }
    expect(read()).toEqual(original); expect(frozenRaidActors(g)).toContain(actorId);
    g.player.loc = { x: 2, y: 2 }; g.refreshStructureDerivedState(); h.command('stairs_up');
    expect(g.depth).toBe(1); expect(campRaid(g, slot)!.pauseFrom).toBeNull();
    expect(frozenRaidActors(g)).not.toContain(actorId); expect(read()).toEqual(original);
    if (!replaceSession) {
        expect(productionActorActionScheduler(g)).toBe(scheduler);
        expect(runtime.actorActionBinding()!.state).toBe(ledger);
        expect(ledger.actions.find(a => a.actionId === id)).toBe(action);
        expect(ledger.actors.find(a => a.actorId === actorId)).toBe(resource);
    }
    // Native stair landing is beside the stair; the paid locked-world attack
    // still targets its original cell. Stage a legal target there, without
    // moving the source or rewriting either saved segment's metadata.
    g.player.loc = { ...original.metadata!.subactions[0]!.lockedCells[0]! };
    g.refreshStructureDerivedState();
    const melee = vi.spyOn(g, 'resolveActorNativeMelee'), finish = vi.spyOn(g, 'finishActorActionSweep');
    const resumed = productionActorActionScheduler(g)!, released: number[] = [];
    for (let n = 0; n < 10 && g.actorActions!.bundles.some(b => b.actionId === id); n++) {
        const currentBundle = read().bundle!, source = currentBundle.subactions[0]!;
        expect(source.phases[source.phaseIndex]!.kind).not.toBe('break-recovery');
        resumed.advanceActionTime(resumed.nextActionBoundary()!);
        const due = source.phases[source.phaseIndex]!;
        if (source.phaseRemainingTicks === 0 && due.segmentIndex !== null) released.push(due.segmentIndex);
        resumed.dispatchActorBoundary(actorId);
    }
    expect(g.actorActions!.bundles.some(b => b.actionId === id)).toBe(false);
    const live = g.extensionRuntime!.actorActionBinding()!.state;
    expect(live.actions.some(a => a.actionId === id)).toBe(false);
    expect(released).toEqual([0, 1]);
    expect(melee.mock.calls.filter(call => call[1].id === actorId), JSON.stringify({
        cells: original.metadata!.subactions[0]!.lockedCells, facing: original.metadata!.subactions[0]!.facing,
        player: g.player.loc, source: g.monsters.find(a => a.id === actorId)?.loc,
        finish: finish.mock.calls.filter(call => call[0] === actorId)
    })).toHaveLength(attack.segments.length);
    expect(finish.mock.calls.filter(call => call[0] === actorId)).toEqual([[actorId, 1, attack.windupTicks + attack.segments[1]!.delayTicks + attack.recoveryTicks]]);
    expect(live.actors.find(a => a.actorId === actorId)!.stamina).toBe(original.resource!.stamina + Math.floor(attack.recoveryTicks / policy.regenPerTickDenominator));
    expect(g.actorActions!.nextActionId).toBe(nextActionId); expect(raidCosts()).toEqual(costs);
    expect(campRaid(g, slot)!.event!.id).toBe(eventId); expect(g.lastAdvancementError).toBeNull();
    const completed = fullSave(g); h.load(JSON.stringify(completed)); expect(fullSave(g)).toEqual(completed);
    expect(g.extensionRuntime!.actorActionBinding()!.state.actions.some(a => a.actionId === id)).toBe(false);
});

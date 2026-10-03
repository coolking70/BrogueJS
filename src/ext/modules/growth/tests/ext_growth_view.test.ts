import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack, GrowthSkill } from '../types';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import { ExtensionRuntime } from '../../../../ext/runtime';
import * as catalog from '../../../../ext/catalog';
import { readGrowthCharacterView, createGrowthAllocationDraft, buildGrowthAllocateCommand, buildGrowthRespecCommand } from '../view';

const con = 'growth.attribute.constitution', str = 'growth.attribute.strength-training', will = 'growth.attribute.will';
function configured(change?: (pack: GrowthDefinitionPack) => void): GrowthDefinitionPack {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.attributePoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 20 };
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 4 };
    pack.config.experience.sources.firstVisits = false;
    change?.(pack);
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
    });
    return pack;
}
function game(): Game {
    const g = createHeadlessGame(6721, 'test');
    g.startNewGame({ seed: 6721, mode: 'test', ruleSet: 'extended' });
    g.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
    return g;
}
function proposal(g: Game, attributes: Record<string, number>) {
    const draft = createGrowthAllocationDraft(readGrowthCharacterView(g)!); draft.attributes = attributes;
    return { draft, view: readGrowthCharacterView(g, draft)! };
}
function confirm(g: Game, attributes: Record<string, number>): void {
    const command = buildGrowthAllocateCommand(proposal(g, attributes).view, g);
    expect(command).not.toBeNull(); g.executeCommand('ext:command', command!);
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1c immutable configured growth character readmodel', () => {
    it('returns null in classic and absent modules without entering a growth projection', () => {
        const read = vi.spyOn(ExtensionRuntime.prototype, 'readModuleView');
        const g = createHeadlessGame(1, 'test');
        expect(readGrowthCharacterView(null)).toBeNull(); expect(readGrowthCharacterView(g)).toBeNull();
        expect(read).not.toHaveBeenCalled();
        g.startNewGame({ seed: 1, mode: 'test', ruleSet: 'extended', extensions: [] });
        expect(readGrowthCharacterView(g)).toBeNull();
    });
    it('reads the actual session pack and renders added/removed attributes, skills, identities and changed slot counts', () => {
        const pack = configured(pack => {
            const extra = structuredClone(pack.config.attributes.find(attribute => attribute.id === con)!);
            extra.id = 'growth.attribute.resolve'; extra.nameKey = 'ext.growth.custom.resolve'; extra.pointCost = 2;
            for (const effect of extra.effects) {
                effect.magnitude.source = { kind: 'attribute', attributeId: extra.id }; effect.magnitude.coefficient = 7;
            }
            pack.config.attributes.push(extra);
            pack.config.strengthTraining = { enabled: false, attributeId: null, pointCost: 3, cap: 4 };
            pack.config.attributes = pack.config.attributes.filter(attribute => attribute.id !== str);
            for (const definition of pack.definitions) if (definition.kind !== 'skill') {
                definition.attributes = definition.attributes.filter(grant => grant.attributeId !== str);
                definition.recommendedAttributes = definition.recommendedAttributes.filter(id => id !== str);
                definition.choices.forEach(choice => { choice.attributeIds = choice.attributeIds.filter(id => id !== str); });
            }
            const removed = pack.definitions.find(definition => definition.kind === 'skill')!.id;
            pack.definitions = pack.definitions.filter(definition => definition.id !== removed);
            for (const definition of pack.definitions) if (definition.kind !== 'skill') {
                definition.gifts = definition.gifts.filter(gift => gift.skillId !== removed);
                definition.recommendedSkills = definition.recommendedSkills.filter(id => id !== removed);
            }
            const skill = structuredClone(pack.definitions.find(definition => definition.kind === 'skill') as GrowthSkill);
            skill.id = 'growth.skill.custom'; skill.nameKey = 'ext.growth.custom.skill'; skill.cost = 3;
            skill.prerequisites = [{ kind: 'attribute', attributeId: extra.id, min: 2 }]; pack.definitions.push(skill);
            const identity = structuredClone(pack.definitions.find(definition => definition.kind === 'faith')!);
            identity.id = 'growth.faith.custom'; identity.nameKey = 'ext.growth.custom.faith'; pack.definitions.push(identity);
            pack.config.skills.activeSlots = 1; pack.config.skills.passiveSlots = 0;
            pack.config.identities.enabled.lineages = false;
        });
        const g = game(), before = readGrowthCharacterView(g)!;
        expect(before.attributes.map(row => row.id)).toEqual(pack.config.attributes.map(row => row.id));
        expect(before.attributes.some(row => row.id === str)).toBe(false);
        const { view } = proposal(g, { 'growth.attribute.resolve': 2 });
        expect(view.draft).toMatchObject({ valid: true, cost: 4, remainingPoints: 16 });
        expect(view.preview.maxHp.delta).toBe(14);
        expect(view.skills.map(skill => skill.id)).toEqual(pack.definitions.filter(definition => definition.kind === 'skill').map(skill => skill.id));
        expect(view.skills.find(skill => skill.id === 'growth.skill.custom')).toMatchObject({ cost: 3, prerequisitesMet: true, available: false, learned: false, equipped: false, canUse: false });
        expect(view.slots.map(slot => [slot.mode, slot.count])).toEqual([['active', 1], ['passive', 0]]);
        expect(view.identities.find(group => group.kind === 'faith')!.definitions.some(definition => definition.id === 'growth.faith.custom')).toBe(true);
        expect(view.identities.find(group => group.kind === 'lineage')).toMatchObject({ enabled: false, selectedId: null });
        expect(view.identities.every(group => group.futurePhase === null && !group.available && group.selectedId === null)).toBe(true);
    });
    it('matches configured allocation previews to actual atomic commands, with exact revision payloads and native wounds', () => {
        configured(); const g = game(); g.player.hp -= 7; g.player.weaknessAmount = 2;
        const { view } = proposal(g, { [con]: 2, [str]: 1, [will]: 2 });
        expect(view.draft).toMatchObject({ valid: true, cost: 7, remainingPoints: 13 });
        expect(view.preview.maxHp.delta).toBe(6); expect(view.preview.hp.delta).toBe(0);
        expect(view.preview.strength.delta).toBe(1); expect(view.preview.focusCapacity.delta).toBe(1);
        const command = buildGrowthAllocateCommand(view, g)!;
        expect(JSON.parse(command)).toEqual({ module: 'growth', action: 'allocate', payload: { revision: view.revision, attributes: { [con]: 2, [str]: 1, [will]: 2 } } });
        g.executeCommand('ext:command', command);
        const after = readGrowthCharacterView(g)!;
        expect(g.player.maxHp).toBe(view.preview.maxHp.preview); expect(g.player.hp).toBe(view.preview.hp.preview);
        expect(g.player.effectiveStrength).toBe(view.preview.strength.preview); expect(after.focus.capacity).toBe(view.preview.focusCapacity.preview);
        expect(after.attributePoints).toBe(view.draft.remainingPoints); expect(after.revision).toBe(view.revision + 1);
        expect(buildGrowthAllocateCommand(view, g)).toBeNull();
        const recorded = g.recordedInputEvents.length; g.executeCommand('ext:command', command);
        expect(g.recordedInputEvents).toHaveLength(recorded);
    });
    it('shows configured recovery rather than assuming allocation never heals', () => {
        configured(pack => { pack.config.levels.recovery.allocationHp = 'increase'; pack.config.levels.recovery.allocationFocus = 'full'; });
        const g = game(); g.player.hp -= 5;
        const { view } = proposal(g, { [con]: 1, [will]: 2 });
        expect(view.preview.hp.delta).toBe(3); expect(view.preview.focus.delta).toBe(1); expect(view.recovery).toMatchObject({ hp: 'increase', focus: 'full' });
        g.executeCommand('ext:command', buildGrowthAllocateCommand(view, g)!);
        expect(g.player.hp).toBe(view.preview.hp.preview); expect(readGrowthCharacterView(g)!.focus.current).toBe(view.preview.focusCapacity.preview);
    });
    it.each([{ unknown: 1 }, { [con]: -1 }, { [con]: 0.5 }, { [con]: NaN }, { [con]: Infinity }, { [con]: 9 }, { [str]: 4, [con]: 8, [will]: 1 }])('rejects invalid draft %j without command data', attributes => {
        configured(); const g = game(), { view } = proposal(g, attributes as unknown as Record<string, number>);
        expect(view.draft.valid).toBe(false); expect(view.draft.errorKey).toBe('ext.growth.view.error.invalid');
        expect(buildGrowthAllocateCommand(view, g)).toBeNull();
    });
    it('keeps repeated browsing, editing, reset and cancel detached from world, recordings, components and both RNG streams', () => {
        configured(); const g = game(); vi.spyOn(Date, 'now').mockReturnValue(123456);
        const saved = g.toSaveSnapshot(), extension = g.extensionRuntime!.snapshot(), random = rng.getState(), tick = timeSystem.currentTick;
        const snapshot = vi.spyOn(g.extensionRuntime!, 'snapshot');
        const policy = vi.spyOn(g.extensionRuntime!, 'rule');
        for (let index = 0; index < 25; index++) {
            const view = proposal(g, { [con]: index % 3 }).view;
            expect(Object.isFrozen(view)).toBe(true); expect(Object.isFrozen(view.attributes)).toBe(true);
            expect(Object.isFrozen(view.skills[0]!.lock)).toBe(true);
            expect(() => { (view.attributes[0] as { value: number }).value = 100; }).toThrow();
            const reset = createGrowthAllocationDraft(view);
            expect(readGrowthCharacterView(g, reset)!.draft.changed).toBe(false);
            expect(readGrowthCharacterView(g)!.attributePoints).toBe(20);
        }
        expect(snapshot).not.toHaveBeenCalled(); expect(policy).not.toHaveBeenCalled();
        snapshot.mockRestore(); expect(g.extensionRuntime!.snapshot()).toEqual(extension);
        expect(g.toSaveSnapshot()).toEqual(saved); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    });
    it('rejects stale revisions and session reuse after new game, load, null or retired runtime', () => {
        configured(); const g = game(), old = proposal(g, { [con]: 1 });
        confirm(g, { [will]: 1 });
        expect(readGrowthCharacterView(g, old.draft)!.draft.stale).toBe(true);
        expect(buildGrowthAllocateCommand(old.view, g)).toBeNull();
        const next = proposal(g, { [con]: 1 }), saved = g.toSaveSnapshot();
        expect(g.loadSnapshot(saved)).toBe(true);
        expect(readGrowthCharacterView(g, next.draft)!.draft.stale).toBe(true);
        expect(buildGrowthAllocateCommand(next.view, g)).toBeNull();
        const loaded = proposal(g, { [con]: 1 });
        g.startNewGame({ seed: 6721, mode: 'test', ruleSet: 'extended' });
        g.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
        expect(readGrowthCharacterView(g, old.draft)!.revision).toBe(old.view.revision);
        expect(readGrowthCharacterView(g, old.draft)!.draft.stale).toBe(true);
        expect(buildGrowthAllocateCommand(loaded.view, g)).toBeNull(); expect(buildGrowthAllocateCommand(old.view, null)).toBeNull();
        g.extensionRuntime!.unload(); expect(readGrowthCharacterView(g)).toBeNull();
    });
    it('reads the exact native availability gate, preserves replay read-only, and catches changes immediately before submit', () => {
        configured(); const g = game(), { view } = proposal(g, { [con]: 1 });
        g.pendingIdentify = true; expect(readGrowthCharacterView(g)!.disabledReason).toBe('unavailable');
        expect(buildGrowthAllocateCommand(view, g)).toBeNull(); g.pendingIdentify = false;
        const recording = g.exportRecording(); expect(g.loadReplay(recording)).toBe(true); g.replayStep(true);
        const replay = readGrowthCharacterView(g)!;
        expect(replay.disabledReason).toBe('replay'); expect(replay.readOnly).toBe(true);
        expect(replay.attributes.every(attribute => !attribute.canIncrease && !attribute.canDecrease)).toBe(true);
        expect(buildGrowthAllocateCommand(view, g)).toBeNull();
    });
    it.each(['gold', 'attribute-points', 'skill-points', 'focus'] as const)('derives respec cost/refund/availability from configured %s fees', resource => {
        configured(pack => { pack.config.respec = { enabled: true, cost: { resource, amount: 2 }, refundBasisPoints: 5000, clearCooldowns: false };
            pack.config.levels.recovery.allocationFocus = 'full'; });
        const g = game(); g.stats.gold = 5; confirm(g, { [con]: 2, [str]: 1, [will]: 2 }); g.player.hp = g.player.maxHp - 1;
        const view = readGrowthCharacterView(g)!;
        expect(view.respec).toMatchObject({ enabled: true, available: true, refund: 3, refundBasisPoints: 5000, cost: { resource, amount: 2 } });
        const command = buildGrowthRespecCommand(view, g)!;
        expect(JSON.parse(command)).toEqual({ module: 'growth', action: 'respec', payload: { revision: view.revision } });
        g.executeCommand('ext:command', command);
        const after = readGrowthCharacterView(g)!;
        expect(after.attributes.every(attribute => attribute.allocated === 0)).toBe(true);
        expect(view.respec.preview).not.toBeNull();
        expect(g.player.hp).toBe(view.respec.preview!.hp.preview); expect(view.respec.preview!.hp.delta).toBe(-5);
        expect(g.player.maxHp).toBe(view.respec.preview!.maxHp.preview); expect(g.player.effectiveStrength).toBe(view.respec.preview!.strength.preview);
        expect(after.focus.current).toBe(view.respec.preview!.focus.preview); expect(after.focus.capacity).toBe(view.respec.preview!.focusCapacity.preview);
        expect(buildGrowthRespecCommand(view, g)).toBeNull();
    });
    it('handles disabled training, combined caps, disabled and unaffordable respec using data', () => {
        configured(pack => { pack.config.attributeTotalCap = 2; pack.config.strengthTraining.enabled = false;
            pack.config.respec = { enabled: true, cost: { resource: 'gold', amount: 100 }, refundBasisPoints: 10000, clearCooldowns: true }; });
        const g = game(), initial = readGrowthCharacterView(g)!;
        expect(initial.attributes.find(attribute => attribute.id === str)).toMatchObject({ enabled: false, canIncrease: false });
        expect(initial.respec.available).toBe(false); expect(buildGrowthRespecCommand(initial, g)).toBeNull();
        const { view } = proposal(g, { [con]: 2 });
        expect(view.attributes.every(attribute => !attribute.canIncrease)).toBe(true);
        expect(view.attributes.find(attribute => attribute.id === con)!.canDecrease).toBe(true);
    });
    it('uses configured XP thresholds and represents max level without division by zero', () => {
        configured(pack => { pack.config.levels.cap = 1; pack.config.levels.experience = { kind: 'table', cumulative: [0] }; pack.config.levels.maxHp.grants = { kind: 'table', grants: [0] };
            for (const definition of pack.definitions) if (definition.kind === 'skill') for (const requirement of definition.prerequisites) if (requirement.kind === 'level') requirement.min = 1; });
        const view = readGrowthCharacterView(game())!;
        expect(view).toMatchObject({ level: 1, levelCap: 1, experience: 0, experienceInLevel: 0, experienceToNext: null, atLevelCap: true });
    });
    it('previews positive search reference inputs and distinguishes concrete data-driven attack contexts', () => {
        const agility = 'growth.attribute.agility', perception = 'growth.attribute.perception';
        configured(pack => {
            const search = pack.config.attributes.find(attribute => attribute.id === perception)!.effects[0]!;
            search.operation = 'multiply'; search.slot = 'growth.slot.final'; search.magnitude.coefficient = 1;
            search.magnitude.min = 1; search.magnitude.max = 4; search.conditions = [{ kind: 'search-mode', value: 'manual' }];
            const attribute = pack.config.attributes.find(attribute => attribute.id === agility)!;
            const thrown = structuredClone(attribute.effects[0]!); thrown.magnitude.coefficient = 200;
            thrown.conditions = thrown.conditions.map(condition => condition.kind === 'attack-kind' ? { ...condition, values: ['thrown'] } : condition);
            attribute.effects.push(thrown);
        });
        const g = game(), { view } = proposal(g, { [perception]: 2, [agility]: 1 });
        const search = view.preview.ports.find(port => port.port === 'searchStrength')!;
        expect(search).toMatchObject({ baseValue: 100, current: 100, preview: 200, delta: 100, reference: true, facts: { searchMode: 'manual' } });
        const attacks = view.preview.ports.filter(port => port.port === 'hitChance' && port.subject === 'actor');
        expect(attacks.find(port => port.facts.attackKind === 'melee')!.delta).toBe(100);
        expect(attacks.find(port => port.facts.attackKind === 'thrown')!.delta).toBe(300);
        expect(new Set(view.preview.ports.map(port => port.contextKey)).size).toBe(view.preview.ports.length);
    });
    it('keeps guaranteed-hit precedence in a custom non-probability hit preview', () => {
        const agility = 'growth.attribute.agility';
        configured(pack => {
            const modifier = pack.config.attributes.find(attribute => attribute.id === agility)!.effects[0]!;
            modifier.conditions = modifier.conditions.map(condition => condition.kind === 'probability-roll' ? { ...condition, value: false } : condition);
        });
        const { view } = proposal(game(), { [agility]: 1 });
        const rows = view.preview.ports.filter(port => port.port === 'hitChance' && port.subject === 'actor');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(row => row.baseValue === 10000 && row.current === 10000 && row.preview === 10000 && row.delta === 0)).toBe(true);
    });
    it('uses custom non-cap XP costs and exposes default disabled respec', () => {
        configured(pack => { pack.config.levels.experience = { kind: 'curve', base: 9, linear: 0, quadratic: 0 }; });
        const view = readGrowthCharacterView(game())!;
        expect(view).toMatchObject({ experienceToNext: 9, experienceInLevel: 0, atLevelCap: false });
        expect(view.respec).toMatchObject({ enabled: false, available: false });
    });
    it('exposes immutable player-only selection and reuses its frozen pack rather than cloning the run per read', () => {
        configured(); const g = game(), first = g.extensionRuntime!.readModuleView('growth')!, second = g.extensionRuntime!.readModuleView('growth')!;
        expect(Object.keys(first.state).sort()).toEqual(['created', 'objectiveClock', 'revision']);
        expect(Object.keys(first.components).sort()).toEqual(['attributes', 'derived', 'focus', 'identity', 'progression', 'skill-build', 'skills']);
        expect(first.definitions).toBe(second.definitions); expect(first.session).toBe(second.session);
        expect(Object.isFrozen(first.components['skill-build'])).toBe(true);
        expect(Object.isFrozen(first.components.identity)).toBe(true);
        expect(Object.isFrozen((first.components.identity as Record<string, unknown>).choices)).toBe(true);
        for (const field of ['learned', 'inherited', 'active', 'passive', 'effects']) {
            expect(Object.isFrozen((first.components['skill-build'] as Record<string, unknown>)[field])).toBe(true);
        }
        expect(typeof first.state.objectiveClock).toBe('number');
        expect(Object.isFrozen(first.components.attributes)).toBe(true); expect(Object.isFrozen(first.state)).toBe(true);
        expect(first.playerId).toBe(g.player.id);
    });
});

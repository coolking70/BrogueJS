import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import zhCN from '../locales/zh_CN.json';
import data from '../ext/modules/growth/definitions.json';
import type { GrowthDefinitionPack, GrowthIdentity, GrowthSkill } from '../ext/modules/growth/types';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { createGrowthEffectInstance, initialGrowthSkillBuild, growthSkillScopes, type GrowthSkillBuild } from '../ext/modules/growth/skills';
import { evaluateGrowthPort } from '../ext/modules/growth/evaluator';
import { growthScalarInput } from '../ext/modules/growth/attributes';
import type { GrowthState } from '../ext/modules/growth/state';
import { createGrowthIdentityBuild } from '../ext/modules/growth/identities';
import { createGrowthCreationDraft, readGrowthCreationView, adjustGrowthCreationChoice, selectGrowthCreationIdentity,
    buildGrowthCreationCommands, loadGrowthCreationContext, readGrowthCharacterView, createGrowthAllocationDraft } from '../ext/modules/growth/view';
import { describeGrowthIdentity } from '../ext/modules/growth/describe';
import { ExtensionRegistry } from '../ext/registry';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import { extensionDataFingerprint } from '../ext/fingerprint';
import * as catalog from '../ext/catalog';
import { Game } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';

const rawPack = () => structuredClone(data) as unknown as GrowthDefinitionPack;
const pack = (edit?: (value: GrowthDefinitionPack) => void) => { const value = rawPack(); edit?.(value); return parseGrowthDefinitionPack(value, { moduleVersion: value.moduleVersion, hasText: () => true }); };
const id = (name: string) => `growth.attribute.${name}`;
beforeAll(async () => { await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false }); });
afterEach(() => vi.restoreAllMocks());

describe('EXT-1e pure new-character projection', () => {
    it('uses explicit configured defaults, all four choices per dimension, weighted grants and an exact first command', () => {
        const p = pack(), draft = createGrowthCreationDraft(p), before = JSON.stringify(draft);
        const view = readGrowthCreationView(p, draft), commands = buildGrowthCreationCommands({ pack: p, otherInitialCommands: [] }, draft)!;
        expect(view.valid).toBe(true); expect(view.groups.map(group => group.definitions.length)).toEqual([4, 4, 4]);
        expect(view.groups.map(group => group.selectedId)).toEqual(Object.values(p.config.identities.defaults));
        expect(view.attributes.find(attribute => attribute.id === id('constitution'))!.value).toBe(2 + (draft.choices[0]!.attributes[id('constitution')] ?? 0));
        expect(view.gifts.map(gift => gift.id).sort()).toEqual(['growth.skill.brace', 'growth.skill.close-guard']);
        expect(JSON.parse(commands[0]!)).toEqual({ module: 'growth', action: 'create-character', payload: { revision: 0, ...draft } });
        expect(JSON.stringify(draft)).toBe(before); expect(Object.isFrozen(view)).toBe(true); expect(Object.isFrozen(view.groups[0]!.definitions)).toBe(true);
    });
    it('reads the configured registry without creating a runtime or changing an existing run/RNG', () => {
        const p = pack(value => { value.config.identities.defaults.professionId = 'growth.profession.scout'; value.config.skills.activeSlots = 4; });
        const identity = { schema: 1, version: p.moduleVersion, fingerprint: extensionDataFingerprint(p) };
        vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
            const registry = new ExtensionRegistry(); registry.register('growth', p.moduleVersion, () => createGrowthGameplay(p, identity), identity); return registry;
        });
        const game = new Game(); game.startNewGame({ seed: '981', mode: 'test' });
        vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
        const state = game.toSaveSnapshot(), random = rng.getState();
        const context = loadGrowthCreationContext(), draft = createGrowthCreationDraft(context.pack);
        for (let index = 0; index < 20; index++) readGrowthCreationView(context.pack, draft);
        expect(context.pack).toBe(p); expect(draft.professionId).toBe('growth.profession.scout'); expect(readGrowthCreationView(context.pack, draft).activeSlots).toBe(4);
        expect(game.toSaveSnapshot()).toEqual(state); expect(rng.getState()).toEqual(random);
    });
    it('changes and cancels free-choice drafts without mutating pack/input, and rejects incomplete budgets', () => {
        const p = pack(), draft = createGrowthCreationDraft(p), immutable = JSON.stringify(draft);
        const empty = adjustGrowthCreationChoice(p, draft, draft.lineageId!, 0, Object.keys(draft.choices[0]!.attributes)[0]!, -1);
        expect(readGrowthCreationView(p, empty).valid).toBe(false); expect(buildGrowthCreationCommands({ pack: p, otherInitialCommands: [] }, empty)).toBeNull();
        const changed = adjustGrowthCreationChoice(p, empty, empty.lineageId!, 0, id('will'), 1);
        expect(readGrowthCreationView(p, changed).valid).toBe(true); expect(changed.choices[0]!.attributes).toEqual({ [id('will')]: 1 });
        expect(adjustGrowthCreationChoice(p, changed, changed.lineageId!, 0, id('will'), 1)).toBe(changed);
        expect(JSON.stringify(draft)).toBe(immutable); expect(createGrowthCreationDraft(p)).toEqual(draft);
    });
    it('honors disabled dimensions, data additions, custom defaults and point prices', () => {
        const p = pack(value => {
            value.config.identities.enabled.professions = false; value.config.identities.budgets.profession = 3;
            const human = value.definitions.find(entry => entry.id === 'growth.lineage.human') as GrowthIdentity;
            human.choices[0]!.attributeIds = [id('will')]; human.choices[0]!.points = 2;
            value.config.attributes.find(attribute => attribute.id === id('will'))!.pointCost = 2; value.config.identities.budgets.lineage = 2;
            const custom = structuredClone(value.definitions.find(entry => entry.id === 'growth.faith.unaffiliated')!) as GrowthIdentity;
            custom.id = 'growth.faith.custom'; value.definitions.push(custom); value.config.identities.defaults.faithId = custom.id;
        });
        const draft = createGrowthCreationDraft(p), view = readGrowthCreationView(p, draft);
        expect(view.valid).toBe(true); expect(draft.professionId).toBeNull(); expect(view.groups[0]).toMatchObject({ enabled: false, selectedId: null });
        expect(view.groups[2]!.definitions).toHaveLength(5); expect(draft.faithId).toBe('growth.faith.custom');
        expect(view.choices[0]).toMatchObject({ spent: 2, points: 2 }); expect(view.choices[0]!.attributes[0]).toMatchObject({ cost: 2, amount: 1, canIncrease: false });
        expect(selectGrowthCreationIdentity(p, draft, 'profession', 'growth.profession.scout')).toBe(draft);
    });
    it('keeps the required dimension/index ordering when replacing identities with custom choices', () => {
        const p = pack(value => {
            const guardian = value.definitions.find(entry => entry.id === 'growth.profession.guardian') as GrowthIdentity;
            guardian.attributes = []; guardian.choices = [{ attributeIds: [id('constitution')], points: 2, perAttributeCap: 2 }];
        });
        let draft = createGrowthCreationDraft(p);
        draft = selectGrowthCreationIdentity(p, draft, 'profession', 'growth.profession.scout');
        draft = selectGrowthCreationIdentity(p, draft, 'profession', 'growth.profession.guardian');
        draft = adjustGrowthCreationChoice(p, draft, draft.professionId!, 0, id('constitution'), 1);
        draft = adjustGrowthCreationChoice(p, draft, draft.professionId!, 0, id('constitution'), 1);
        expect(draft.choices.map(choice => choice.identityId)).toEqual([draft.professionId, draft.lineageId]);
        expect(() => createGrowthIdentityBuild(p, draft)).not.toThrow();
    });
    it('checks unwaived gift prerequisites at preview/submit as well as identity arithmetic', () => {
        const p = pack(value => {
            const guardian = value.definitions.find(entry => entry.id === 'growth.profession.guardian') as GrowthIdentity;
            guardian.gifts[0]!.waivePrerequisites = false;
            (value.definitions.find(entry => entry.id === guardian.gifts[0]!.skillId) as GrowthSkill).prerequisites = [{ kind: 'level', min: 2 }];
        });
        const draft = createGrowthCreationDraft(p);
        expect(() => createGrowthIdentityBuild(p, draft)).not.toThrow();
        expect(readGrowthCreationView(p, draft).valid).toBe(false); expect(buildGrowthCreationCommands({ pack: p, otherInitialCommands: [] }, draft)).toBeNull();
    });
    it('describes all identity effects, gift exceptions, budgets and oath costs from edited data', () => {
        const p = pack(value => {
            const faith = value.definitions.find(entry => entry.id === 'growth.faith.path') as GrowthIdentity;
            const resource = faith.oaths[0]!.effects.find(effect => effect.kind === 'resource')!;
            if (resource.kind === 'resource') { resource.amount = 3; resource.trigger.minDepth = 4; resource.trigger.maxDepth = 11; }
        });
        const all = p.definitions.filter(entry => entry.kind !== 'skill');
        expect(all.flatMap(identity => describeGrowthIdentity(p, identity)).join(' ')).not.toContain('ext.growth.');
        const path = all.find(entry => entry.id === 'growth.faith.path')!;
        const description = describeGrowthIdentity(p, path).join(' ');
        expect(description).toContain('首次到达深度 4–11：专注 +3'); expect(description).toContain('专注上限'); expect(description).toContain('-1');
        const guardian = describeGrowthIdentity(p, all.find(entry => entry.id === 'growth.profession.guardian')!).join(' ');
        expect(guardian).toContain('技能基础规则（需叠加所选身份／誓约修正）'); expect(guardian).toContain('使用 2 / 上限 2'); expect(guardian).toContain('免费赠送'); expect(guardian).toContain('仅本次赠予豁免前置');
    });
    it('projects only confirmed player identity fields with frozen public choices, no NPC build or receipt/source ledger', () => {
        const p = pack(value => { value.config.monsters.templates.find(template => template.id === value.config.monsters.defaultTemplateId)!.faithId = 'growth.faith.watch'; });
        const rules = { schema: 1, version: p.moduleVersion, fingerprint: extensionDataFingerprint(p) };
        vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
            const registry = new ExtensionRegistry(); registry.register('growth', p.moduleVersion, () => createGrowthGameplay(p, rules), rules); return registry;
        });
        const context = loadGrowthCreationContext(); let draft = createGrowthCreationDraft(context.pack);
        draft = selectGrowthCreationIdentity(context.pack, draft, 'faith', 'growth.faith.path');
        const game = new Game(); game.startNewGame({ seed: '982', mode: 'test', ruleSet: 'extended', initialCommands: buildGrowthCreationCommands(context, draft)! });
        game.clearRecording();
        const npc = new Monster(game.player.x + 1, game.player.y, (monsters as MonsterData[]).find(monster => monster.id === 'rat')!); game.monsters.push(npc);
        const runtime = game.extensionRuntime!;
        expect(runtime.snapshot().components[npc.id]!['growth:identity']).toMatchObject({ faithId: 'growth.faith.watch' });
        // Private provenance deliberately contains an unmistakable sentinel; the
        // public whitelist must not depend on a currently empty receipt ledger.
        const internal = runtime as unknown as { states: { growth: { storyReceipts: string[] } } };
        internal.states.growth.storyReceipts.push('private-identity-receipt-sentinel');
        const snapshot = runtime.snapshot(), random = rng.getState(), source = runtime.readModuleView('growth')!;
        const identity = source.components.identity as Record<string, unknown>, choices = identity.choices as Record<string, unknown>[];
        expect(Object.keys(identity).sort()).toEqual(['choices', 'faithId', 'lineageId', 'professionId']);
        expect(identity).toEqual(draft); expect(Object.keys(choices[0]!).sort()).toEqual(['attributes', 'choiceIndex', 'identityId']);
        expect(Object.isFrozen(identity)).toBe(true); expect(Object.isFrozen(choices)).toBe(true); expect(Object.isFrozen(choices[0])).toBe(true); expect(Object.isFrozen(choices[0]!.attributes)).toBe(true);
        expect(Object.keys(source.state).sort()).toEqual(['created', 'objectiveClock', 'revision']);
        expect(JSON.stringify({ state: source.state, identity })).not.toContain('private-identity-receipt-sentinel');
        expect(JSON.stringify(identity)).not.toContain('templateId'); expect(JSON.stringify(identity)).not.toContain('growth.faith.watch');
        expect(source.playerId).toBe(game.player.id); expect(Object.keys(source.components)).not.toContain(String(npc.id));
        expect(Object.keys(source.components['skill-build'] as object)).not.toContain('gifted');
        const character = readGrowthCharacterView(game)!;
        expect(character.identities.find(group => group.kind === 'lineage')!.chosenAttributes).toEqual(Object.entries(draft.choices[0]!.attributes).map(([attributeId, amount]) => ({ attributeId, amount })));
        const oath = character.identities.find(group => group.kind === 'faith')!.definitions.find(definition => definition.id === draft.faithId)!;
        expect(oath.description.join(' ')).toContain('首次到达深度'); expect(oath.description.join(' ')).toContain('专注上限 -1');
        expect(runtime.snapshot()).toEqual(snapshot); expect(rng.getState()).toEqual(random);
    });
    it('redacts foreign NPC effect identity/source metadata through actual runtime projection while preserving numeric preview', () => {
        const p = pack(value => {
            value.config.monsters.templates.find(template => template.id === value.config.monsters.defaultTemplateId)!.faithId = 'growth.faith.watch';
            const watch = value.definitions.find(definition => definition.id === 'growth.faith.watch') as GrowthIdentity;
            const tagged = watch.oaths[0]!.effects.find(effect => effect.kind === 'tagged-modifier' && effect.property === 'intensity')!;
            if (tagged.kind === 'tagged-modifier') {
                tagged.tag = 'growth.tag.pressure-target'; tagged.magnitude.coefficient = -300; tagged.magnitude.min = -300; tagged.magnitude.max = -300;
                tagged.conditions = [{ kind: 'attack-kind', values: ['melee'] }];
            }
        });
        const rules = { schema: 1, version: p.moduleVersion, fingerprint: extensionDataFingerprint(p) };
        vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
            const registry = new ExtensionRegistry(); registry.register('growth', p.moduleVersion, () => createGrowthGameplay(p, rules), rules); return registry;
        });
        const context = loadGrowthCreationContext(); let draft = createGrowthCreationDraft(context.pack);
        draft = selectGrowthCreationIdentity(context.pack, draft, 'faith', 'growth.faith.path');
        const game = new Game(); game.startNewGame({ seed: '983', mode: 'test', ruleSet: 'extended', initialCommands: buildGrowthCreationCommands(context, draft)! });
        game.clearRecording();
        const npc = new Monster(game.player.x + 1, game.player.y, (monsters as MonsterData[]).find(monster => monster.id === 'rat')!); game.monsters.push(npc);
        const saved = game.toSaveSnapshot(), extension = saved.extensions!, state = extension.modules.growth as unknown as GrowthState;
        const npcIdentity = extension.components[npc.id]!['growth:identity'] as unknown as ReturnType<typeof createGrowthIdentityBuild>;
        expect(npcIdentity.faithId).toBe('growth.faith.watch');
        const pressure = p.definitions.find(definition => definition.id === 'growth.skill.pressure') as unknown as GrowthSkill;
        const targetEffect = pressure.effects.find(effect => effect.kind === 'timed' && effect.recipient === 'target')!;
        if (targetEffect.kind !== 'timed') throw new Error('Expected target effect');
        const castSource = { id: npc.id, level: 1, attributes: Object.fromEntries(p.config.attributes.map(attribute => [attribute.id, attribute.initial])) };
        const rawBuild = extension.components[game.player.id]!['growth:skill-build'] as unknown as GrowthSkillBuild;
        rawBuild.effects.push(createGrowthEffectInstance(p, pressure, targetEffect, castSource, initialGrowthSkillBuild(), state.objectiveClock, 1, state.nextEffectId++, npcIdentity));
        expect(rawBuild.effects[0]!.taggedSources).toContain('growth.faith.watch');
        expect(game.loadSnapshot(saved)).toBe(true);
        const runtime = game.extensionRuntime!, before = runtime.snapshot(), random = rng.getState();
        const source = runtime.readModuleView('growth')!, projectedBuild = source.components['skill-build'] as unknown as { effects: Record<string, unknown>[] };
        const effect = projectedBuild.effects[0]!;
        expect(Object.keys(effect).sort()).toEqual(['expiresAt', 'modifiers', 'taggedModifiers', 'tags']);
        expect(Object.isFrozen(effect)).toBe(true); expect(Object.isFrozen(effect.modifiers)).toBe(true); expect(Object.isFrozen(effect.taggedModifiers)).toBe(true);
        const serialized = JSON.stringify(effect);
        for (const forbidden of ['growth.faith.watch', 'taggedSources', 'instanceId', 'sourceId', 'attributes', 'startedAt', 'actionId', 'skillId', 'effectId']) expect(serialized).not.toContain(forbidden);
        const model = readGrowthCharacterView(game)!, row = model.preview.ports.find(port => port.port === 'hitChance' && port.subject === 'actor' && port.facts.attackKind === 'melee')!;
        const attributes = before.components[game.player.id]!['growth:attributes'] as unknown as { values: Record<string, number> };
        const actor = { id: game.player.id, level: model.level, attributes: attributes.values }, neutral = { id: 0, level: 1, attributes: Object.fromEntries(p.config.attributes.map(attribute => [attribute.id, 0])) };
        const expected = evaluateGrowthPort(p, 'hitChance', { ...growthScalarInput(actor, row.baseValue), target: neutral, baseCooldown: row.baseValue, rollMode: 'roll-probability' }, growthSkillScopes(p, rawBuild, state.objectiveClock, 'actor', createGrowthIdentityBuild(p, draft)), row.facts);
        expect(row.current).toBe(expected); expect(row.current).toBeLessThan(row.baseValue);
        expect(runtime.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
    });
    it('labels base effect duration separately from the actual identity-adjusted cooldown and runtime duration', () => {
        const context = loadGrowthCreationContext(); let draft = createGrowthCreationDraft(context.pack);
        draft = selectGrowthCreationIdentity(context.pack, draft, 'lineage', 'growth.lineage.stoneborn');
        draft = selectGrowthCreationIdentity(context.pack, draft, 'faith', 'growth.faith.watch');
        const game = new Game(); game.startNewGame({ seed: '982', mode: 'test', ruleSet: 'extended', initialCommands: buildGrowthCreationCommands(context, draft)! });
        game.animationEnabled = false;
        const model = readGrowthCharacterView(game)!, brace = model.skills.find(skill => skill.id === 'growth.skill.brace')!;
        expect(brace.adjustedCooldown.current).toBe(12);
        expect(brace.description.join(' ')).toContain('冷却 12 个客观时间块');
        expect(brace.description.join(' ')).toContain('以下效果与持续时间为基础定义');
        expect(brace.description.join(' ')).toContain('持续 2 个客观时间块');
        const guardian = model.identities[0]!.definitions.find(identity => identity.id === draft.professionId)!;
        expect(guardian.description.join(' ')).toContain('技能基础规则（需叠加所选身份／誓约修正）');
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'use-skill', payload: { revision: model.revision, skillId: brace.id, target: { kind: 'self' } } }));
        for (let index = 0; index < 50 && game.isAdvancing; index++) game.stepAdvancement();
        expect(game.isAdvancing).toBe(false);
        const build = game.extensionRuntime!.snapshot().components[game.player.id]!['growth:skill-build'] as unknown as { effects: { expiresAt: number; startedAt: number }[] };
        expect(build.effects[0]!.expiresAt - build.effects[0]!.startedAt).toBe(3);
    });
    it('shows selected identities, real faith resources and identity-aware allocation after the first recorded creation', () => {
        const context = loadGrowthCreationContext(); let draft = createGrowthCreationDraft(context.pack);
        draft = selectGrowthCreationIdentity(context.pack, draft, 'faith', 'growth.faith.path');
        const initialCommands = buildGrowthCreationCommands(context, draft)!;
        const game = new Game(); game.startNewGame({ seed: '982', mode: 'test', ruleSet: 'extended', initialCommands });
        const view = readGrowthCharacterView(game)!;
        expect(view.created).toBe(true); expect(view.identities.map(group => group.selectedId)).toEqual([draft.professionId, draft.lineageId, draft.faithId]);
        expect(view.focus.capacity).toBe(7); expect(view.skills.find(skill => skill.id === 'growth.skill.brace')!.learned).toBe(true);
        const allocation = createGrowthAllocationDraft(view); allocation.attributes[id('constitution')] = 1;
        const preview = readGrowthCharacterView(game, allocation)!;
        if (view.attributePoints > 0) expect(preview.draft.valid).toBe(true);
        expect(game.hasCompleteRecording).toBe(true);
    });
});

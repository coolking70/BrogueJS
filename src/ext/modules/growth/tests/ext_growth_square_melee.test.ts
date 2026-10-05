import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack, GrowthSkill } from '../types';
import type { GrowthState } from '../state';
import type { GrowthSkillBuild } from '../skills';
import data from '../data/definitions.json';

const skillId = (name: string) => `growth.skill.${name}`;
const state = (g: Game) => g.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
function setup(size: 2 | 3 = 2, acid = true) {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 30 };
    pack.config.experience.sources.firstVisits = false; pack.config.skills.equipTime = 'none';
    const pressure = pack.definitions.find(d => d.id === skillId('pressure')) as GrowthSkill;
    pressure.prerequisites = [];
    for (const effect of pressure.effects) if (effect.kind === 'timed' && effect.consume.event === 'physical-probability-roll') {
        effect.consume.count = 2; effect.duration = { kind: 'objective-blocks', blocks: 10, cap: 10 };
    }
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
    });
    const g = createHeadlessGame(402204, 'test');
    g.startNewGame({ seed: 402204, mode: 'test', ruleSet: 'extended', extensions: ['growth'] });
    g.animationEnabled = false; g.monsters = []; g.dormantMonsters = []; g.items = [];
    for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) {
        g.grid.setTerrain(x, y, x === 0 || y === 0 || x === g.grid.width - 1 || y === g.grid.height - 1 ? T.WALL : T.FLOOR);
        Object.assign(g.grid.getCell(x, y)!, { machineNumber: 0, isVisible: true, hasMemory: true });
    }
    commitCreatureAnchor(g.player, { x: 60, y: 14 }); g.player.hp = g.player.maxHp = 1000;
    g.environment = new EnvironmentManager(g.grid); g.waypoints = new WaypointSystem();
    (g as any).machineCells = new Set(); (g as any).bindDungeonFeatureEffects();
    const m = g.createSquareMonster(monsters.find(d => d.id === 'rat')! as MonsterData, size, { x: 12, y: 12 })!;
    m.hp = m.maxHp = 10000; m.state = MonsterState.HUNTING; m.defense = -1000; m.regenTurns = 0; m.ticksUntilTurn = 10000;
    if (acid) m.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
    commitCreatureAnchor(g.player, { x: 12 + size, y: 11 + size });
    const command = (action: string, payload: Record<string, unknown>) => g.executeCommand('ext:command', JSON.stringify({ module: 'growth', action, payload: { revision: state(g).revision, ...payload } }));
    command('create-character', { revision: 0 });
    command('learn-skill', { skillId: skillId('measured-strike') }); command('learn-skill', { skillId: skillId('pressure') });
    command('equip-skills', { active: [skillId('measured-strike'), skillId('pressure')], passive: [] });
    const w = ItemLoader.spawnWeapon('spear', -1, -1)!; w.strengthRequired = g.player.effectiveStrength; w.damage = '2-2'; w.enchantment = 0;
    g.player.inventory.addItem(w); g.player.equippedWeapon = w;
    return { g, m, w, command, use: () => command('use-skill', { skillId: skillId('measured-strike'), target: { kind: 'creature', id: m.id } }) };
}
const build = (g: Game, id = g.player.id) => g.extensionRuntime!.snapshot().components[id]!['growth:skill-build'] as unknown as GrowthSkillBuild;
afterEach(() => vi.restoreAllMocks());

describe('4a-2 real growth native body target preparation/consumption', () => {
    it.each([2, 3] as const)('%s-square tail target: No retains resources, cooldown, revisions, RNG and time', size => {
        const { g, m, use } = setup(size); g.onCommandConfirmRequest = () => {};
        expect(g.validateControlledAction({ actorId: g.player.id, action: 'attack', target: { kind: 'creature', id: m.id } })).toBe(true);
        const extension = g.extensionRuntime!.snapshot(), random = rng.getState(), tick = timeSystem.currentTick, turns = g.stats.turns, count = g.recordedInputEvents.length;
        use(); expect(g.pendingCommandConfirmation?.message).toContain('Degrade your');
        expect(g.extensionRuntime!.snapshot()).toEqual(extension);
        g.resolveCommandDecision(g.pendingCommandConfirmation!.token, false);
        expect(g.extensionRuntime!.snapshot()).toEqual(extension); expect(rng.getState()).toEqual(random);
        expect(timeSystem.currentTick).toBe(tick); expect(g.stats.turns).toBe(turns); expect(m.hp).toBe(10000);
        expect(g.recordedInputEvents[count]!.decisions).toEqual([false]);
    });
    it.each(['moved', 'out-and-back', 'shape', 'corner'] as const)('pending square target %s invalidates approval before payment', change => {
        const { g, m, use } = setup(); g.onCommandConfirmRequest = () => {};
        const extension = g.extensionRuntime!.snapshot(), count = g.recordedInputEvents.length, tick = timeSystem.currentTick;
        use(); const token = g.pendingCommandConfirmation!.token;
        if (change === 'shape') m.spatial = { schema: 1, footprintId: 'builtin:square-3', pose: 'r0' };
        else if (change === 'corner') g.grid.setTerrain(13, 13, T.WALL);
        else { const old = { ...m.loc }; commitCreatureAnchor(m, { x: 11, y: 12 }); if (change === 'out-and-back') commitCreatureAnchor(m, old); }
        expect(g.resolveCommandDecision(token, true)).toBe(true); expect(g.pendingCommandConfirmation).toBeNull();
        expect(g.extensionRuntime!.snapshot()).toEqual(extension); expect(g.recordedInputEvents).toHaveLength(count); expect(timeSystem.currentTick).toBe(tick);
    });
    it('Yes pays once and runs one physicalResolved and one real acid degradation despite two spear contact cells', () => {
        const { g, m, w, use } = setup(); g.onCommandConfirmRequest = () => {};
        const fact = vi.spyOn(g.player.extensionHooks!, 'physicalResolved'), damage = vi.spyOn(m, 'takeDamage'), revision = state(g).revision;
        use(); g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
        expect(fact).toHaveBeenCalledTimes(1); expect(damage).toHaveBeenCalledTimes(1); expect(w.enchantment).toBe(-1);
        expect(state(g).revision).toBe(revision + 1); expect(g.extensionRuntime!.snapshot().components[g.player.id]!['growth:skills']).toMatchObject({ readyAt: { [skillId('measured-strike')]: expect.any(Number) } });
    });
    it('real pressure target budget consumes once per square native strike and twice for independent strikes', () => {
        const { g, m, command } = setup(2, false);
        command('use-skill', { skillId: skillId('pressure'), target: { kind: 'creature', id: m.id } });
        const effect = build(g, m.id).effects.find(e => e.remaining === 2)!; expect(effect).toBeDefined();
        const id = effect.effectId, count = () => build(g, m.id).effects.find(e => e.effectId === id)?.remaining;
        const facts = vi.spyOn(m.extensionHooks!, 'physicalResolved'); m.accuracy = 1000; m.damageString = '2-2';
        (m as any).resolveBodyMeleeAdjacent(g, g.player, 'hostile'); expect(facts).toHaveBeenCalledTimes(1); expect(count()).toBe(1);
        (m as any).resolveBodyMeleeAdjacent(g, g.player, 'hostile'); expect(facts).toHaveBeenCalledTimes(2); expect(count()).toBeUndefined(); expect(g.player.hp).toBeLessThan(g.player.maxHp);
    });
    it('a visible far body cell does not authorize an entity-targeted skill through an adjacent hidden tail', () => {
        const { g, m, use } = setup(2, false);
        for (const at of g.footprintOf(m)) g.grid.getCell(at.x, at.y)!.isVisible = false;
        g.grid.getCell(m.x, m.y)!.isVisible = true; // two cells from the player; adjacent contacts remain hidden
        const extension = g.extensionRuntime!.snapshot(), random = rng.getState(), tick = timeSystem.currentTick;
        expect(g.validateControlledAction({ actorId: g.player.id, action: 'attack', target: { kind: 'creature', id: m.id } })).toBe(false);
        use(); expect(g.extensionRuntime!.snapshot()).toEqual(extension); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    });
    it('losing public body contact during prepared confirmation invalidates Yes without charging or recording a stale command', () => {
        const { g, m, use } = setup(); g.onCommandConfirmRequest = () => {};
        const extension = g.extensionRuntime!.snapshot(), random = rng.getState(), tick = timeSystem.currentTick, count = g.recordedInputEvents.length;
        use(); const token = g.pendingCommandConfirmation!.token;
        for (const at of g.footprintOf(m)) g.grid.getCell(at.x, at.y)!.isVisible = false;
        g.resolveCommandDecision(token, true);
        expect(g.pendingCommandConfirmation).toBeNull(); expect(g.extensionRuntime!.snapshot()).toEqual(extension);
        expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick); expect(g.recordedInputEvents).toHaveLength(count);
    });
});

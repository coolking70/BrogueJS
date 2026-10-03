import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import data from '../ext/modules/growth/definitions.json';
import type { GrowthDefinitionPack } from '../ext/modules/growth/types';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import { buildGrowthSkillCommand, readGrowthCharacterView, readGrowthSkillTargets } from '../ext/modules/growth/view';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';

function scene() {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 4 };
    for (const definition of pack.definitions) if (definition.kind === 'skill') definition.prerequisites = [];
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
    });
    const game = createHeadlessGame(6721, 'test'); game.startNewGame({ seed: 6721, mode: 'test', ruleSet: 'extended' });
    const command = (action: string, payload: object) => game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action,
        payload: { revision: readGrowthCharacterView(game)?.revision ?? 0, ...payload } }));
    command('create-character', { revision: 0 }); game.monsters = []; game.dormantMonsters = []; game.items = [];
    command('learn-skill', { skillId: 'growth.skill.withdraw' }); command('learn-skill', { skillId: 'growth.skill.measured-strike' });
    command('equip-skills', { active: ['growth.skill.withdraw', 'growth.skill.measured-strike'], passive: [] });
    const x = game.player.x + 1, y = game.player.y;
    game.grid.setTerrain(x, y, TerrainType.FLOOR); const cell = game.grid.getCell(x, y)!;
    cell.isVisible = true; cell.isExplored = true; cell.isDiscovered = true; cell.hasMemory = true; cell.rememberedLayers = [...cell.layers];
    const choices = (skill = 'withdraw') => readGrowthSkillTargets(game, readGrowthCharacterView(game)!, `growth.skill.${skill}`);
    const enemy = () => {
        const enemy = new Monster(x, y, monsters.find(row => row.id === 'rat') as MonsterData);
        enemy.setStatusDuration('invisible', 100); game.monsters.push(enemy); game.extensionRuntime!.attachCreature(enemy); return enemy;
    };
    return { game, cell, x, y, choices, enemy };
}
afterEach(() => vi.restoreAllMocks());
describe('EXT-1d knowledge-bounded target candidates', () => {
    it('has identical movement DTOs and availability for an empty tile and an unobservable occupant', () => {
        const f = scene(), before = f.choices(); expect(before.find(row => row.direction === 'e')!.enabled).toBe(true);
        const hidden = f.enemy(), saved = f.game.extensionRuntime!.snapshot(), random = rng.getState(), count = f.game.recordedInputEvents.length;
        const validator = vi.spyOn(f.game, 'validateControlledAction');
        expect(f.choices()).toEqual(before); expect(validator).not.toHaveBeenCalled();
        expect(f.game.extensionRuntime!.snapshot()).toEqual(saved); expect(rng.getState()).toEqual(random); expect(f.game.recordedInputEvents).toHaveLength(count);
        const view = readGrowthCharacterView(f.game)!;
        expect(buildGrowthSkillCommand(view, f.game, 'use', 'growth.skill.withdraw', { kind: 'cell', x: f.x, y: f.y })).toBeNull();
        expect(validator).toHaveBeenCalled(); expect(f.game.recordedInputEvents).toHaveLength(count);
        hidden.setStatusDuration('invisible', 0); expect(f.choices().find(row => row.direction === 'e')!.enabled).toBe(false);
    });
    it('does not reveal unknown or memory-obscured terrain changes through direction availability', () => {
        const f = scene(); f.cell.isVisible = false; f.cell.hasMemory = false; f.cell.isMagicMapped = false; f.cell.isExplored = false;
        const unknownFloor = f.choices(); f.game.grid.setTerrain(f.x, f.y, TerrainType.WALL); expect(f.choices()).toEqual(unknownFloor);
        f.cell.hasMemory = true; f.cell.rememberedLayers = [TerrainType.FLOOR, TerrainType.NOTHING, TerrainType.NOTHING, TerrainType.NOTHING];
        const rememberedFloor = f.choices(); f.game.grid.setTerrain(f.x, f.y, TerrainType.FLOOR); expect(f.choices()).toEqual(rememberedFloor);
        f.cell.isVisible = true; f.game.grid.setTerrain(f.x, f.y, TerrainType.WALL); expect(f.choices().find(row => row.direction === 'e')!.enabled).toBe(false);
    });
    it('preserves native through-wall attack eligibility for an observed creature at a known blocked corner', () => {
        const f = scene(), enemy = f.enemy(); enemy.setStatusDuration('invisible', 0);
        enemy.loc.y += 1; enemy.behaviorFlags.add('MONST_ATTACKABLE_THRU_WALLS');
        f.game.grid.setTerrain(f.x, f.y, TerrainType.WALL);
        f.game.grid.setTerrain(enemy.x, enemy.y, TerrainType.WALL); f.game.grid.getCell(enemy.x, enemy.y)!.isVisible = true;
        expect(f.game.validateControlledAction({ actorId: f.game.player.id, action: 'attack', target: { kind: 'creature', id: enemy.id } })).toBe(true);
        expect(f.choices('measured-strike').find(row => row.direction === 'se')).toMatchObject({ enabled: true, target: { kind: 'creature', id: enemy.id } });
        enemy.setStatusDuration('invisible', 100);
        expect(f.choices('measured-strike').find(row => row.direction === 'se')).toMatchObject({ enabled: false, target: { kind: 'creature', id: 0 } });
    });
    it('never exposes hidden attack creature IDs, including in disabled choices', () => {
        const f = scene(), empty = f.choices('measured-strike'), hidden = f.enemy();
        expect(f.choices('measured-strike')).toEqual(empty); expect(empty.every(row => row.target.kind === 'creature' && row.target.id === 0)).toBe(true);
        hidden.setStatusDuration('invisible', 0); const known = f.choices('measured-strike').find(row => row.direction === 'e')!;
        expect(known).toMatchObject({ enabled: true, target: { kind: 'creature', id: hidden.id } });
        expect(Object.isFrozen(known)).toBe(true); expect(Object.isFrozen(known.target)).toBe(true);
    });
});

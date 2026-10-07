import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { TerrainType } from '../../../../engine/Map/Grid';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { ExtensionRuntime } from '../../../../ext/runtime';
import * as evaluator from '../evaluator';
import * as catalog from '../../../../ext/catalog';

afterEach(() => vi.restoreAllMocks());
describe('EXT-1b classic evaluator isolation',() => {
    it('never evaluates growth during classic birth, native actions, floor entry, save/load or replay/seek',() => {
        const spies = [vi.spyOn(evaluator,'evaluateGrowthPort'),vi.spyOn(evaluator,'evaluateGrowthPhysicalDamage'),
            vi.spyOn(evaluator,'evaluateGrowthMagnitude'),vi.spyOn(evaluator,'evaluateGrowthModifiers'),
            vi.spyOn(evaluator,'evaluateGrowthPort'),vi.spyOn(ExtensionRuntime.prototype,'queryOptionalActor'),
            vi.spyOn(catalog,'createExtensionRegistry')];
        const game=createHeadlessGame(5318,'test');
        const target=new Monster(game.player.x+1,game.player.y,(monsters as MonsterData[]).find(monster=>monster.id==='rat')!);
        target.hp=target.maxHp=1000;
        const attack=CombatSystem.attack;attack(game.player,target);
        const dart=ItemLoader.spawnWeapon('dart',game.player.x,game.player.y)!;
        CombatSystem.resolveThrownWeapon(game.player,target,dart);
        game.executeCommand('search');
        (game as unknown as {calculateStealthRange():number}).calculateStealthRange();
        game.grid.setTerrain(game.player.x,game.player.y,TerrainType.STAIRS_DOWN);
        game.executeCommand('stairs_down');expect(game.depth).toBe(2);
        expect(game.extensionRuntime).toBeNull();expect('extensions' in game.toSaveSnapshot()).toBe(false);
        // Separate natural recording: no fixture-created combat bodies are claimed as replay inputs.
        const recorded=createHeadlessGame(5319,'test');recorded.executeCommand('wait');recorded.executeCommand('search');
        const saved=recorded.toSaveSnapshot(),recording=recorded.exportRecording(),loaded=createHeadlessGame(9,'test');
        expect(loaded.loadSnapshot(saved)).toBe(true);expect(loaded.extensionRuntime).toBeNull();
        const replay=createHeadlessGame(10,'test');expect(replay.loadReplay(recording)).toBe(true);
        while(replay.replayCursor<recording.events.length&&!replay.replayError)replay.replayStep(true);
        expect(replay.replayError).toBeNull();replay.replaySeek(0);
        while(replay.replayCursor<recording.events.length&&!replay.replayError)replay.replayStep(true);
        expect(replay.replayError).toBeNull();
        for(const spy of spies)expect(spy).not.toHaveBeenCalled();
    });
});

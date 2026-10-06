import { afterEach, expect, it, vi } from 'vitest';
import "../../../../i18n";
import { installProductionAttackBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { MonsterState } from '../../../../entities/Monster';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';

afterEach(()=>{vi.restoreAllMocks();logger.reset();});
const json=<T>(v:T):T=>JSON.parse(JSON.stringify(v));

it('core native magic precedes declared member attacks and pays only the core cast clock',()=>{
    installProductionAttackBody();const game=startProductionGame(['body-fixture','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,clocks=game.monsters.slice(1).map(a=>a.ticksUntilTurn);
    core.state=MonsterState.HUNTING;core.givenUpOnScent=true;core.bolts=['FIRE'];core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.behaviorFlags.add('MONST_ALWAYS_USE_ABILITY');
    commitCreatureAnchor(game.player,{x:22,y:12});const cast=vi.spyOn(game,'castMonsterBolt');game.executeCommand('wait');
    expect(cast).toHaveBeenCalledOnce();expect(cast.mock.calls[0]![0]).toBe(core);expect(cast.mock.calls[0]![1]).toBe(game.player);
    expect(game.actorActions!.bundles).toEqual([]);expect(game.monsters.slice(1).map(a=>a.ticksUntilTurn)).toEqual(clocks);expect(core.ticksUntilTurn).toBeGreaterThan(0);
});

it('a real staircase follower migration cancels previously paid member shapes and preserves loadable source ledgers',()=>{
    installProductionAttackBody();const game=startProductionGame(['body-fixture','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');commitCreatureAnchor(game.player,{x:14,y:10});
    game.executeCommand('wait');const initial=game.extensionRuntime!.actorActionBinding()!.state;
    expect(initial.actions[0]!.paidCost).toBeGreaterThan(0);const paidId=initial.actions[0]!.actionId;
    game.becomeAllyWith(core);game.grid.setTerrain(game.player.x,game.player.y,T.STAIRS_DOWN);game.levelSeeds[0]!.downStairsLoc={...game.player.loc};
    game.executeCommand('stairs_down');const source=game.levels.get(1)!;
    for(let n=0;n<150&&source.monsters.includes(core);n++)game.executeCommand('wait');
    expect(source.monsters.some(a=>a.spatial?.bodyMember?.groupId===core.id)).toBe(false);expect(game.monsters.filter(a=>a.spatial?.bodyMember?.groupId===core.id)).toHaveLength(9);
    const state=game.extensionRuntime!.actorActionBinding()!.state;
    expect(state.actions.filter(a=>a.actionId===paidId).flatMap(a=>a.subactions).every(s=>s.lockedCells.length===0)).toBe(true);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();
});
it('a failed whole staircase restores a paid session and can execute the old plan after the fault is removed',()=>{
    installProductionAttackBody();const game=startProductionGame(['body-fixture','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');commitCreatureAnchor(game.player,{x:14,y:10});
    game.executeCommand('wait');expect(game.extensionRuntime!.actorActionBinding()!.state.actions[0]!.paidCost).toBeGreaterThan(0);
    game.grid.setTerrain(game.player.x,game.player.y,T.STAIRS_DOWN);game.levelSeeds[0]!.downStairsLoc={...game.player.loc};
    const saved=game.toSaveSnapshot(),native=json(game.extensionRuntime!.actorActionBinding()!.state),random=rng.getState(),beforeDepth=game.depth;
    const fail=vi.spyOn(game.extensionRuntime!,'commitGeneration').mockImplementation(()=>{throw Error('stairs fault');});
    expect(()=>game.executeCommand('stairs_down')).toThrow('stairs fault');fail.mockRestore();
    expect(game.depth).toBe(beforeDepth);expect(game.extensionRuntime!.actorActionBinding()!.state).toEqual(native);expect(rng.getState()).toEqual(random);
    game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();const expected=json(game.toSaveSnapshot());
    expect(game.loadSnapshot(saved)).toBe(true);game.executeCommand('wait');const actual=json(game.toSaveSnapshot());actual.savedAt=expected.savedAt;
    // The generic thrown command invalidates recording provenance. Compare
    // its complete mechanical world; successful recording paths are separate.
    delete expected.run.recordingOrigin;delete actual.run.recordingOrigin;expect(actual).toEqual(expected);
});

import { monsterBlinkImpact } from '../engine/Combat/MonsterBlink';
import { boltLine, traceBolt } from '../engine/Combat/BoltTrajectory';
import { getBoltForItem } from '../engine/Combat/Bolt';
import { canSeeMonster, canDisplayMonster } from '../engine/UI/MonsterVisibility';
import { CombatSystem } from '../engine/Combat/Combat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Grid, TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { TERRAIN_FLAGS } from '../engine/Map/TerrainCatalog';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { catalogFeature, spawnDungeonFeature } from '../engine/Map/DungeonFeature';
import { promoteTile } from '../engine/Map/Promotion';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import mutations from '../data/mutations.json';
import { rng } from '../engine/Random';
import { LightKind } from '../engine/Map/LightCatalog';
import { cellAppearance } from '../engine/UI/Appearance';
afterEach(() => vi.restoreAllMocks());
function scene() {
    const g = createHeadlessGame(20260927, 'test');
    g.monsters = []; g.dormantMonsters = []; g.items = [];
    for (let x=0;x<g.grid.width;x++) for(let y=0;y<g.grid.height;y++) {
        g.grid.setTerrain(x,y,T.FLOOR);
        Object.assign(g.grid.getCell(x,y)!, {machineNumber:0,hasDormantMonster:false,isPowered:false,isVisible:true});
    }
    g.player.loc={x:10,y:10};g.player.inventory.items=[];g.animationEnabled=false;
    return g;
}
function add(g: Game, id: string, x=11, y=10) {
    const m = new Monster(x,y,(monsters as MonsterData[]).find(m=>m.id===id)!);
    m.ticksUntilTurn=10000;g.monsters.push(m);return m;
}
function potion(g: Game,id: string) {const i=ItemLoader.spawnPotion(`potion_of_${id}`,-1,-1)!;g.player.inventory.addItem(i);return i;}

describe('X2g native effects',()=>{

    it('quaff, throw and infested death plant real terrain; contact caps duration without adding concentration',()=>{
        const g=scene();g.quaffItem(potion(g,'creeping_death'),true);
        expect(g.grid.getCell(10,10)!.layers[L.SURFACE]).toBe(T.LICHEN);
        expect(g.player.hasStatus('poisoned')).toBe(true);expect(g.player.poisonAmount).toBe(1);
        g.player.addPoison(12,2);const duration=g.player.getStatusDuration('poisoned');
        (g as any).applyEnvironmentalEffects(g.player);
        expect(g.player.getStatusDuration('poisoned')).toBe(duration);expect(g.player.poisonAmount).toBe(3);
        const h=scene();h.throwItemAt(potion(h,'creeping_death'),15,10);
        expect(h.grid.getCell(15,10)!.layers[L.SURFACE]).toBe(T.LICHEN);
        expect(ItemLoader.identifiedItems.has('potion_of_creeping_death')).toBe(true);
        const m=add(h,'rat',30,10);m.mutate(mutations.find(m=>m.id==='infested')!);m.hp=0;
        (h as any).triggerDeathFeatures(m);expect(h.grid.getCell(30,10)!.layers[L.SURFACE]).toBe(T.LICHEN);
    });
    it('lichen regrows at the old cell, spreads at 2%, cannot cross lava, and respects flight/inanimate immunity',()=>{
        const g=scene();g.player.applyStatus('levitating',30);g.grid.setTerrain(10,10,T.LICHEN);g.grid.setTerrain(11,10,T.LAVA);
        vi.spyOn(rng,'randPercent').mockReturnValue(true);
        promoteTile(g.grid,10,10,L.SURFACE,false);
        expect(g.grid.getCell(10,10)!.layers[L.SURFACE]).toBe(T.LICHEN);
        expect(g.grid.getCell(9,10)!.layers[L.SURFACE]).toBe(T.LICHEN);
        expect(g.grid.getCell(11,10)!.layers[L.SURFACE]).not.toBe(T.LICHEN);
        g.player.applyStatus('levitating',30);(g as any).applyEnvironmentalEffects(g.player);expect(g.player.hasStatus('poisoned')).toBe(false);
        const m=add(g,'rat',9,10);m.behaviorFlags.add('MONST_INANIMATE');(g as any).applyEnvironmentalEffects(m);expect(m.hasStatus('poisoned')).toBe(false);
    });
    it('darkness throw creates a negative light gas, drinking keeps its own status; terrain and statuses survive save',()=>{
        const g=scene();(g as any).updateVision();const before=g.lightMap.lightSumAt(14,10);
        g.throwItemAt(potion(g,'darkness'),14,10);(g as any).updateVision();
        expect(g.lightMap.lightSumAt(14,10)).toBeLessThan(before);
        expect(g.grid.getCell(14,10)!.layers[L.GAS]).toBe(T.DARKNESS_CLOUD);
        expect(ItemLoader.identifiedItems.has('potion_of_darkness')).toBe(true);
        expect(g.player.hasStatus('darkness')).toBe(false);
        expect(TERRAIN_FLAGS[T.DARKNESS_CLOUD].glowLight).toBe(LightKind.DARKNESS_CLOUD_LIGHT);
        expect(catalogFeature(DF.DF_DARKNESS_POTION)).toMatchObject({layer:L.GAS,startProbability:200,probabilityDecrement:0});
        g.quaffItem(potion(g,'darkness'),true);expect(g.player.hasStatus('darkness')).toBe(true);
        g.grid.setTerrain(25,25,T.LICHEN);g.player.addPoison(5,0);
        const s=g.toSnapshot();g.loadSnapshot(s);expect({...g.toSnapshot(), savedAt:s.savedAt}).toEqual(s);
    });
});

describe('X2g rot gas and MB_SUBMERGED',()=>{
    it('fully shielded hits do not bleed through the actual damage path',()=>{
        const grid = new Grid(5,5);grid.setTerrain(2,2,T.FLOOR);
        const m=new Monster(2,2,(monsters as MonsterData[]).find(m=>m.id==='zombie')!);
        grid.getCell(2,2)!.volume=0;m.hp=80;m.applyShield(1000);m.takeDamage(20,false,grid);
        expect(grid.getCell(2,2)!.volume).toBe(0);
    });
    it('CE inflictLethalDamage from quietus/slaying still emits zombie blood and bypasses shields',()=>{
        const g=scene();const weapon=ItemLoader.spawnWeapon('dagger',-1,-1)!;
        g.player.equippedWeapon=weapon;g.player.inventory.addItem(weapon);
        for(const effect of ['quietus','slaying']) {
            const z=add(g,'zombie',15,10);z.hp=80;z.applyShield(1000);
            g.grid.getCell(15,10)!.volume=0;
            (g as any).applyWeaponRunicEffect(z,0,effect);
            expect(z.hp).toBe(0);expect(z.getStatusDuration('shielded')).toBe(1000);
            expect(g.grid.getCell(15,10)!.volume).toBe(1600); // CE 12*(15+80*3/2)/100, then ×100.
            expect(g.grid.getCell(15,10)!.layers[L.GAS]).toBe(T.ROT_GAS);
        }
    });
    it('zombies emit 15 volume per objective tick; living contact causes nausea, inanimate and respiration are immune; gas burns and saves',()=>{
        const g=scene();const z=add(g,'zombie',10,10);
        (g as any).tickCreatureStatuses();expect(g.grid.getCell(10,10)!.volume).toBe(15);
        (g as any).applyEnvironmentalEffects(g.player);expect(g.player.getStatusDuration('nauseous')).toBe(20);
        (g as any).applyEnvironmentalEffects(z);expect(z.getStatusDuration('nauseous')).toBe(20);
        z.behaviorFlags.add('MONST_INANIMATE');z.setStatusDuration('nauseous',0);
        (g as any).applyEnvironmentalEffects(z);expect(z.hasStatus('nauseous')).toBe(false);
        const armor=ItemLoader.spawnArmor('leather_armor',-1,-1)!;armor.runicType='respiration';g.player.equippedArmor=armor;g.player.inventory.addItem(armor);
        g.player.setStatusDuration('nauseous',0);(g as any).applyEnvironmentalEffects(g.player);expect(g.player.hasStatus('nauseous')).toBe(false);expect(armor.runicKnown).toBe(true);
        (g as any).updateVision();const s=g.toSnapshot();g.loadSnapshot(s);expect({...g.toSnapshot(),savedAt:s.savedAt}).toEqual(s);
        g.environment.ignite(10,10);expect(g.grid.getCell(10,10)!.layers[L.SURFACE]).toBe(T.GAS_FIRE);
        expect(g.grid.getCell(10,10)!.volume).toBe(0);
    });

    it('submerges at 20%, surfaces on attack/dry placement, retains seizure exception, and saves the actual runtime bit',()=>{
        const g=scene();g.grid.setTerrain(11,10,T.WATER_DEEP);const m=add(g,'eel');
        m.state=MonsterState.HUNTING;const roll=vi.spyOn(rng,'randPercent').mockReturnValue(false);
        m.updateSubmersion(g.grid);expect(m.state).toBe(MonsterState.FLEEING);expect(roll).toHaveBeenCalledExactlyOnceWith(20);
        roll.mockClear().mockReturnValue(true);m.updateSubmersion(g.grid);expect(m.submerged).toBe(true);expect(m.state).toBe(MonsterState.HUNTING);
        roll.mockClear();m.updateSubmersion(g.grid);expect(roll).not.toHaveBeenCalled();
        const s=g.toSnapshot();g.loadSnapshot(s);const restored=g.monsters[0]!;expect(restored.submerged).toBe(true);
        CombatSystem.attack(restored,g.player,{grid:g.grid});expect(restored.submerged).toBe(false);
        restored.submerged=true;restored.abilityFlags.add('MA_SEIZES');restored.seizing=false;g.player.seized=false;
        CombatSystem.attack(restored,g.player,{grid:g.grid});expect(restored.submerged).toBe(true);
        restored.seizing=false;g.player.seized=false;g.grid.setTerrain(10,10,T.WATER_DEEP);(g as any).updateVision();
        CombatSystem.attack(restored,g.player,{grid:g.grid});expect(restored.submerged).toBe(false);
        restored.submerged=true;restored.seizing=false;g.player.seized=false;restored.applyStatus('invisible',20);
        CombatSystem.attack(restored,g.player,{grid:g.grid});expect(restored.submerged).toBe(true);
        restored.submerged=true;g.placeCreature(restored,{x:12,y:10});expect(restored.submerged).toBe(false);
    });
    it('hides identity above water, telepathy only marks location, underwater observers see; throws and bolts pass through even when seen',()=>{
        const g=scene();g.grid.setTerrain(11,10,T.WATER_DEEP);const m=add(g,'eel');m.submerged=true;
        expect(canSeeMonster(g.player,g.grid,m)).toBe(false);g.player.applyStatus('telepathy',20);
        expect(canDisplayMonster(g.player,g.grid,m)).toBe(true);expect(canSeeMonster(g.player,g.grid,m)).toBe(false);
        g.grid.setTerrain(10,10,T.WATER_DEEP);expect(canSeeMonster(g.player,g.grid,m)).toBe(true);
        g.player.applyStatus('levitating',20);expect(canSeeMonster(g.player,g.grid,m)).toBe(false);
        const bolt=getBoltForItem('staff_of_lightning')!;const behind=add(g,'rat',14,10);
        const result=traceBolt(g.grid,bolt,g.player.loc,behind.loc,{caster:g.player,creatureAt:p=>g.getMonsterAt(p.x,p.y)});
        expect(result.hits.map(h=>h.creature)).not.toContain(m);expect(result.hits.map(h=>h.creature)).toContain(behind);g.monsters=g.monsters.filter(other=>other!==behind);
        g.throwItemAt(potion(g,'darkness'),14,10);expect(g.grid.getCell(14,10)!.layers[L.GAS]).toBe(T.DARKNESS_CLOUD);
        expect(g.grid.getCell(11,10)!.layers[L.GAS]).not.toBe(T.DARKNESS_CLOUD);
    });
    it('submerged creatures resist nausea, damage, paralysis, explosions, fire and webs but not confusion',()=>{
        const g=scene();g.grid.setTerrain(11,10,T.WATER_DEEP);const m=add(g,'eel');m.submerged=true;
        spawnDungeonFeature(g.grid,11,10,catalogFeature(DF.DF_ROT_GAS_PUFF),false);
        (g as any).applyEnvironmentalEffects(m);expect(m.hasStatus('nauseous')).toBe(false);
        for(const gas of [T.PARALYSIS_GAS,T.POISON_GAS]) {
            g.grid.getCell(11,10)!.layers[L.GAS]=gas;const hp=m.hp;(g as any).applyEnvironmentalEffects();
            expect(m.hp).toBe(hp);expect(m.hasStatus('paralyzed')).toBe(false);
        }
        g.grid.getCell(11,10)!.layers[L.GAS]=T.NOTHING;
        g.grid.getCell(11,10)!.layers[L.SURFACE]=T.WEB;g.applyEntanglementFromTerrain(m);expect(m.hasStatus('stuck')).toBe(false);
        g.grid.getCell(11,10)!.layers[L.SURFACE]=T.GAS_EXPLOSION;expect((g as any).resolveExplosionDamage(m)).toBe(false);
        (g as any).exposeCreatureToFire(m);expect((m.statusDurations as any).burning).toBeUndefined();
        g.grid.getCell(11,10)!.layers[L.GAS]=T.CONFUSION_GAS;(g as any).applyEnvironmentalEffects(m);expect(m.hasStatus('confused')).toBe(true);
    });
    it('renders rot tint from the live gas layer before mirror refresh, preserving glyph and using CE density weight',()=>{
        const grid=new Grid(5,5);grid.setTerrain(2,2,T.FLOOR);const c=grid.getCell(2,2)!;c.isVisible=true;
        const ctx={gas:undefined,lightChannels:{r:100,g:100,b:100},groundItem:null,carriedItem:null,hallucinating:false,cosmetic:{percent:()=>false,pick:<T>(a:readonly T[])=>a[0]!}};
        const base=cellAppearance(c,ctx)!;spawnDungeonFeature(grid,2,2,catalogFeature(DF.DF_ROT_GAS_PUFF),false);
        const result=cellAppearance(c,ctx)!;expect(result.char).toBe(base.char);
        // IO.c min(90,30+volume); independent integer-channel interpolation.
        const mix=(a:number,b:number)=>Math.floor(a*.55+b*.45);
        const bg=base.bgColor??0,expected=(mix((bg>>16)&255,153)<<16)|(mix((bg>>8)&255,127)<<8)|mix(bg&255,12);
        expect(result.bgColor).toBe(expected);expect(result.color).not.toBe(base.color);
        c.layers[L.GAS]=T.DARKNESS_CLOUD;expect(cellAppearance(c,ctx)!.char).toBe(base.char);
    });
    it('same-version next turn preserves gas, lichen and surfaced state through full load',()=>{
        const g=scene();g.grid.setTerrain(11,10,T.WATER_DEEP);add(g,'eel').submerged=false;
        spawnDungeonFeature(g.grid,30,15,catalogFeature(DF.DF_ROT_GAS_PUFF),false);
        spawnDungeonFeature(g.grid,35,15,catalogFeature(DF.DF_LICHEN_PLANTED),false);
        (g as any).updateVision();const initial=g.toSnapshot();
        // A loaded synthetic snapshot is not a new-game recording; compare the same system command on both paths.
        const next=()=>{g.handlePlayerAction('wait',undefined,'system');return {...g.toSnapshot(),savedAt:0};};
        const uninterrupted=next();expect(g.loadSnapshot(initial)).toBe(true);const resumed=next();
        const differences=(a:any,b:any,path=''):string[]=>{
            if(JSON.stringify(a)===JSON.stringify(b))return [];
            if(a&&b&&typeof a==='object'&&typeof b==='object')return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>differences(a[k],b[k],`${path}/${k}`));
            return [`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
        };
        expect(differences(uninterrupted,resumed)).toEqual([]);
    });
});

describe('X2g submerged interaction edge cases',()=>{
    it('submerged creatures never alter bolt tuning or blink impact, even for underwater observers',()=>{
        const g=scene();g.grid.setTerrain(10,10,T.WATER_DEEP);
        const m=add(g,'eel',13,11);g.grid.setTerrain(13,11,T.WATER_DEEP);m.submerged=true;
        const bolt=getBoltForItem('staff_of_lightning')!;
        for(let x=16;x<26;x++)for(let y=8;y<19;y++) {
            const aim={x,y},empty={caster:g.player,creatureAt:()=>undefined};
            expect(boltLine(g.grid,g.player.loc,aim,bolt,{caster:g.player,creatureAt:p=>g.getMonsterAt(p.x,p.y)}))
                .toEqual(boltLine(g.grid,g.player.loc,aim,bolt,empty));
        }
        const caster=add(g,'imp',10,10);g.player.loc={x:30,y:20};m.loc={x:11,y:10};g.grid.setTerrain(11,10,T.WATER_DEEP);
        const submergedImpact=monsterBlinkImpact(g,caster,{x:25,y:10});m.hp=0;
        expect(submergedImpact).toEqual(monsterBlinkImpact(g,caster,{x:25,y:10}));
        m.hp=80;m.submerged=false;expect(monsterBlinkImpact(g,caster,{x:25,y:10})).toEqual(caster.loc);
    });
    it('blink lands on submerged occupants after CE shuffled Manhattan relocation; no home is silent administrative death',()=>{
        const g=scene();const m=add(g,'eel',15,10);g.grid.setTerrain(15,10,T.WATER_DEEP);g.grid.setTerrain(16,10,T.WATER_DEEP);m.submerged=true;
        const shuffle=vi.spyOn(rng,'shuffleList');
        expect((g as any).finishBlink({caster:g.player,landingPos:{x:15,y:10}})).toBe(true);
        expect(g.player.loc).toEqual({x:15,y:10});expect(m.loc).toEqual({x:16,y:10});expect(m.submerged).toBe(true);
        expect(shuffle.mock.calls.map(c=>c[0].length)).toEqual([g.grid.width,g.grid.height]);
        const h=scene();const trapped=add(h,'eel',15,10);h.grid.setTerrain(15,10,T.WATER_DEEP);trapped.submerged=true;
        trapped.mutate(mutations.find(m=>m.id==='infested')!);trapped.carriedItem=ItemLoader.spawnWeapon('dagger',-1,-1)!;
        expect((h as any).finishBlink({caster:h.player,landingPos:{x:15,y:10}})).toBe(true);
        expect(trapped.hp).toBe(0);expect(trapped.deathProcessed).toBe(true);expect(trapped.carriedItem).toBeNull();
        (h as any).triggerDeathFeatures(trapped);expect(h.grid.getCell(15,10)!.layers[L.SURFACE]).toBe(T.NOTHING);expect(h.items).toHaveLength(0);
    });
    it('submerged and surfaced aquatic creatures on submergible terrain do not press either legacy or CE plates',()=>{
        const g=scene();const m=add(g,'eel',15,10);g.grid.setTerrain(15,10,T.WATER_DEEP);
        const legacy=vi.spyOn(g as any,'triggerTrap');const pressure=vi.spyOn(g as any,'triggerPressurePlate');
        for(const submerged of [false,true])for(const tile of [T.TRAP,T.PRESSURE_PLATE,T.GAS_TRAP_POISON]) {
            m.submerged=submerged;g.grid.setTerrainLayer(15,10,L.DUNGEON,tile);
            (g as any).applyDisplacementTileEntry(m);
            expect(g.grid.getCell(15,10)!.layers[L.GAS]).toBe(T.NOTHING);
        }
        expect(legacy).not.toHaveBeenCalled();expect(pressure).not.toHaveBeenCalled();
        g.grid.setTerrainLayer(15,10,L.LIQUID,T.NOTHING);m.submerged=false;
        g.grid.setTerrainLayer(15,10,L.DUNGEON,T.GAS_TRAP_POISON);(g as any).applyDisplacementTileEntry(m);
        expect(g.grid.getCell(15,10)!.layers[L.GAS]).toBe(T.POISON_GAS);
    });
});

describe('X2g damage ownership regression',()=>{
    it('lethal rot blood from burning, explosion and gradual terrain has exactly one death callback',()=>{
        for(const source of ['burning','explosion','terrain']) {
            const g=scene();const m=add(g,'zombie',15,10);m.hp=1;
            const death=vi.spyOn(m as any,'die');
            if(source==='burning') { (m.statusDurations as any).burning=3;(g as any).resolveBurningDamage(m); }
            else if(source==='explosion') {g.grid.setTerrain(15,10,T.GAS_EXPLOSION);(g as any).resolveExplosionDamage(m);}
            else {g.grid.setTerrainLayer(15,10,L.SURFACE,T.ANCIENT_SPIRIT_VINES);(g as any).applyEnvironmentalEffects();}
            expect(m.hp,source).toBe(0);expect(death,source).toHaveBeenCalledTimes(1);
            expect(g.grid.getCell(15,10)!.layers[L.GAS],source).toBe(T.ROT_GAS);
        }
    });
});

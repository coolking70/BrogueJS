import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createHeadlessGame } from './harness';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import species from '../data/monsters.json';
import { DungeonLayer as Layer, TerrainType as T } from '../engine/Map/Grid';
import { EnvironmentManager } from '../engine/Environment/Gas';
import { WaypointSystem } from '../engine/Map/WaypointMap';
import { SpatialCatalog } from '../engine/Movement/SpatialSchema';
import { bindSpatialCatalog, commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { compileRigidFootprint, RIGID_POSES, type RigidPose } from '../engine/Movement/RigidFootprint';
import { footprintExposure } from '../engine/Movement/FootprintExposure';
import { teleportCandidates } from '../engine/Movement/CreaturePlacement';
import { publicMonsterBody } from '../engine/UI/MonsterBody';
import { observeDisplayFrame } from '../ui/displayProjection';
import { bodyEdges, paintBody } from '../ui/bodyDrawing';
import { mapModes } from '../ui/mapTiles';
import { logger } from '../engine/Systems/Logger';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { getBoltForItem } from '../engine/Combat/Bolt';
import { rng } from '../engine/Random';
import { MASKS } from './support/rigidScene';

const rat = species.find(m => m.id === 'rat')! as MonsterData;
function scene(cells = MASKS.bar, pose: RigidPose = 'r0') {
    const g = createHeadlessGame(44004,'test'); g.animationEnabled=false; g.monsters=[];g.dormantMonsters=[];g.items=[];
    for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++) {
        g.grid.setTerrain(x,y,x===0||y===0||x===g.grid.width-1||y===g.grid.height-1?T.WALL:T.FLOOR);
        for(const layer of [Layer.LIQUID,Layer.SURFACE,Layer.GAS])g.grid.setTerrainLayer(x,y,layer,T.NOTHING);
        Object.assign(g.grid.getCell(x,y)!,{machineNumber:0,isVisible:true,hasMemory:true});
    }
    g.environment=new EnvironmentManager(g.grid);g.waypoints=new WaypointSystem();
    (g as any).machineCells=new Set();(g as any).bindDungeonFeatureEffects();
    commitCreatureAnchor(g.player,{x:65,y:14});g.player.hp=g.player.maxHp=100000;
    const definition={id:'geometry.body',owner:'geometry',geometry:{kind:'mask' as const,cells},poses:RIGID_POSES};
    compileRigidFootprint(definition);
    const catalog=new SpatialCatalog(false,['geometry']);catalog.registerFootprint(definition);
    vi.spyOn(g,'spatialCatalog','get').mockReturnValue(catalog);
    const m=new Monster(12,12,{...rat,id:definition.id,statusImmunities:[],statusResistTurns:{}});m.spatial={schema:1,footprintId:definition.id,pose};bindSpatialCatalog(m,catalog);
    Object.assign(m,{hp:10000,maxHp:10000,regenTurns:0,defense:-1000,state:MonsterState.HUNTING});
    m.behaviorFlags.add('MONST_ALWAYS_HUNTING');m.givenUpOnScent=true;
    expect(g.publishSquareMonster(m)).toBe(true);
    return {g,m,catalog};
}
afterEach(()=>vi.restoreAllMocks());

describe('4b registered mask in actual Game rules and display',()=>{
    it.each(Object.entries(MASKS))('%s across four poses uses exact contacts, environment union and holes',(_name,cells)=>{
        for(const pose of RIGID_POSES) {
            const {g,m}=scene(cells,pose), body=footprintOf(m);
            for(const p of body)expect(g.getMonsterAt(p.x,p.y)).toBe(m);
            const box=[];for(let y=Math.min(...body.map(p=>p.y));y<=Math.max(...body.map(p=>p.y));y++)for(let x=Math.min(...body.map(p=>p.x));x<=Math.max(...body.map(p=>p.x));x++)box.push({x,y});
            for(const p of box.filter(p=>!body.some(c=>c.x===p.x&&c.y===p.y))) {
                g.grid.setTerrain(p.x,p.y,T.LAVA);expect(g.getMonsterAt(p.x,p.y)).toBeUndefined();
            }
            expect(footprintExposure(g.grid,m).contacts).toHaveLength(cells.length);
            (g as any).applyEnvironmentalEffects(m);expect(m.hp).toBe(10000);
            for(const p of body)g.grid.setTerrainLayer(p.x,p.y,Layer.GAS,T.CONFUSION_GAS);
            const status=vi.spyOn(m,'applyStatus');(g as any).applyEnvironmentalEffects(m);
            expect(status.mock.calls.filter(c=>c[0]==='confused')).toHaveLength(1);
            for(const p of body)g.grid.setTerrain(p.x,p.y,T.CHASM);
            expect(footprintExposure(g.grid,m).allUnsupported).toBe(true);
            g.grid.setTerrain(body[0]!.x,body[0]!.y,T.FLOOR);expect(footprintExposure(g.grid,m).allUnsupported).toBe(false);
        }
    });
    it.each(Object.entries(MASKS))('%s drawing in four maps, hidden tails, D08 and tail inspection share real mask',(_name,cells)=>{
        const {g,m}=scene(cells,'r270');const body=footprintOf(m), before=rng.getState();
        const frame=observeDisplayFrame(g,logger), publicBody=publicMonsterBody(g.player,g.grid,m)!;
        expect(publicBody.cellCount).toBe(cells.length);expect(publicBody.size).toBeNull();
        expect(frame.rows.filter(r=>r.kind==='monster')).toHaveLength(1);expect(frame.map.bodies[0]!.cells).toEqual(body.map(({x,y})=>({x,y})));
        const paintings: unknown[]=[];
        for(const _mode of mapModes) {
            const rect=vi.fn().mockReturnThis(), fill=vi.fn().mockReturnThis(), moveTo=vi.fn().mockReturnThis(), lineTo=vi.fn().mockReturnThis(), stroke=vi.fn().mockReturnThis();
            paintBody({rect,fill,moveTo,lineTo,stroke} as never,{...publicBody,color:'#fff'},16);
            expect(rect.mock.calls).toEqual(publicBody.cells.map(p=>[p.x*16,p.y*16,16,16]));paintings.push(lineTo.mock.calls);
        }
        expect(paintings.every(p=>JSON.stringify(p)===JSON.stringify(paintings[0]))).toBe(true);expect(bodyEdges(body)).toHaveLength(_name==='bar'?10:_name==='ring'?16:_name==='cross'?12:8);
        expect(g.collectBodyTargets(body,{effect:'area-damage'})).toHaveLength(1);
        const tail=body[body.length-1]!;for(const p of body)g.grid.getCell(p.x,p.y)!.isVisible=false;g.grid.getCell(tail.x,tail.y)!.isVisible=true;
        expect(publicMonsterBody(g.player,g.grid,m)).toMatchObject({cells:[{x:tail.x,y:tail.y}],glyph:{x:tail.x,y:tail.y},cellCount:null});
        g.handleInspectAt(tail.x,tail.y);expect(g.inspectTarget?.name).toBe(m.name);expect(rng.getState()).toEqual(before);
    });
    it('tail melee and first fire collision hit once; a ring hole can contain another creature',()=>{
        const {g,m}=scene(MASKS.ring);const other=new Monster(m.x+1,m.y+1,rat);g.monsters.push(other);
        expect(g.getMonsterAt(other.x,other.y)).toBe(other);expect(g.getMonsterAt(m.x+2,m.y+1)).toBe(m);
        commitCreatureAnchor(g.player,{x:m.x+3,y:m.y+1});expect(g.meleeContact(g.player,m)?.to).toMatchObject({x:m.x+2,y:m.y});
        m.ticksUntilTurn=10000;const attack=vi.spyOn(g,'reportAttack');g.executeCommand('move',{x:-1,y:0});expect(attack.mock.calls.filter(c=>c[1]===m)).toHaveLength(1);
        const item=ItemLoader.spawnStaff('staff_of_fire',-1,-1)!;g.player.inventory.addItem(item);ItemLoader.identifyItemKind(item);item.charges=20;
        const result=g.zapBoltFromPlayer(getBoltForItem(item.identityId!)!,item,{x:m.x,y:m.y+1});
        expect(result.hits.map(h=>h.creature)).toEqual([m]);expect(result.landingPos).toEqual({x:m.x+2,y:m.y+1});expect(other.hp).toBe(other.maxHp);
    });
    it.each(Object.entries(MASKS))('%s tail lava kills once and drops one carried item',(_name,cells)=>{
        const {g,m}=scene(cells,'r90'),body=footprintOf(m);m.carriedItem=ItemLoader.spawnWeapon('dart',-1,-1)!;const item=m.carriedItem.id,kill=vi.spyOn(g,'killMonster');
        g.grid.setTerrain(body[body.length-1]!.x,body[body.length-1]!.y,T.LAVA);(g as any).applyEnvironmentalEffects(m);
        expect(m.hp).toBe(0);expect(kill).toHaveBeenCalledTimes(1);expect(g.items.filter(i=>i.id===item)).toHaveLength(1);
    });
    it('clone, displacement and teleport preserve r270; actual cells filter tail walls and dormant reservations',()=>{
        const {g,m}=scene(MASKS.L,'r270'), clone=g.cloneMonster(m)!;expect(clone.spatial).toEqual(m.spatial);expect(clone.spatial).not.toBe(m.spatial);
        expect(footprintOf(clone).some(p=>footprintOf(m).some(q=>p.x===q.x&&p.y===q.y))).toBe(false);
        const at={x:30,y:12}, cells=footprintOf({loc:at,spatial:m.spatial}), tail=cells[cells.length-1]!;
        g.grid.setTerrain(tail.x,tail.y,T.WALL);expect(g.placeCreature(m,at)).toBe(false);expect(teleportCandidates(g,m)).not.toContainEqual(at);
        g.grid.setTerrain(tail.x,tail.y,T.FLOOR);const dormant=new Monster(tail.x,tail.y,rat);dormant.isDormant=true;g.dormantMonsters.push(dormant);expect(g.placeCreature(m,at)).toBe(false);
        g.dormantMonsters=[];expect(g.placeCreature(m,at)).toBe(true);expect(m.spatial!.pose).toBe('r270');
    });
    it('NPC rotation consumes a real actor action, has no intermediate environment contacts and rechecks blockers',()=>{
        const {g,m}=scene();
        for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++)g.grid.setTerrain(x,y,T.WALL);
        for(let y=3;y<=12;y++)for(let x=3;x<=12;x++)g.grid.setTerrain(x,y,T.FLOOR);
        for(let x=13;x<=22;x++)g.grid.setTerrain(x,7,T.FLOOR);
        commitCreatureAnchor(m,{x:7,y:7});m.spatial!.pose='r90';commitCreatureAnchor(g.player,{x:21,y:7});
        m.ticksUntilTurn=0;const effects=vi.spyOn(g as any,'applyEnvironmentalEffects');
        const rotate=g.rotateSpatialActor.bind(g), turns: unknown[]=[];
        vi.spyOn(g,'rotateSpatialActor').mockImplementation((actor,direction)=>{
            const before={...actor.loc},calls=effects.mock.calls.filter(c=>c[0]===actor).length;
            const result=rotate(actor,direction);
            if(result)turns.push({before,after:{...actor.loc},cost:actor.ticksUntilTurn,contacts:effects.mock.calls.filter(c=>c[0]===actor).length-calls});
            return result;
        });
        g.executeCommand('wait');expect(turns).toHaveLength(1);const turn=turns[0] as {before:unknown;after:unknown;cost:number;contacts:number};expect(turn.before).toEqual(turn.after);expect(turn.cost).toBe(m.movementSpeed);expect(turn.contacts).toBe(1);expect(m.spatial!.pose).toBe('r0');
        expect(g.rigidPathingStats()?.terrainBuilds).toBe(1);
        const next=g.planSquareStep(m,{kind:'anchors',anchors:[{...m.loc,pose:'r90'}]});expect(next.kind).toBe('rotate');
        const blocker=new Monster(m.x+2,m.y+2,rat);g.monsters.push(blocker);expect(g.rotateSpatialActor(m,1)).toBe(false);expect(m.spatial!.pose).toBe('r0');
    });
});

it('records actual Game cold/warm planning, spatial work and whole command separately',()=>{
    const rows=[];
    for(const [name,cells] of [['bar',MASKS.bar],['L',MASKS.L],['16-cells',Array.from({length:16},(_,i)=>({x:i%4,y:Math.floor(i/4)}))]] as const) {
        const {g,m}=scene(cells), planning:number[]=[], commands:number[]=[];
        const plan=g.planSquareStep.bind(g);vi.spyOn(g,'planSquareStep').mockImplementation((...args)=>{const start=performance.now();try{return plan(...args);}finally{planning.push(performance.now()-start);}});
        for(let i=0;i<30;i++){const start=performance.now();g.executeCommand('wait');commands.push(performance.now()-start);}
        expect(m.x).toBeGreaterThan(12);expect(planning).toHaveLength(30);expect(g.rigidPathingStats()?.terrainBuilds).toBe(1);
        const q=(v:number[],p:number)=>[...v].sort((a,b)=>a-b)[Math.floor(v.length*p)]!;
        const stats=g.rigidPathingStats(),next=g.planSquareStep(m,{kind:'contact',target:g.player});expect(next.kind).toBe('step');
        const old=footprintOf(m),blockAt=footprintOf({loc:next.at!,spatial:m.spatial}).find(p=>!old.some(o=>o.x===p.x&&o.y===p.y))!;
        g.monsters.push(new Monster(blockAt.x,blockAt.y,rat));const blockedStart=performance.now(),dynamic=g.planSquareStep(m,{kind:'contact',target:g.player});const dynamicReplanMs=performance.now()-blockedStart;
        expect(dynamic.replanned).toBe(true);expect(['step','rotate','blocked']).toContain(dynamic.kind);
        rows.push({name,commands:30,dynamicReplanMs,dynamicResult:dynamic.kind,coldPlanningMs:planning[0],warmPlanningP50Ms:q(planning.slice(1,30),.5),warmPlanningP95Ms:q(planning.slice(1,30),.95),coldCommandMs:commands[0],warmCommandP50Ms:q(commands.slice(1),.5),warmCommandP95Ms:q(commands.slice(1),.95),stats,dynamicStats:g.rigidPathingStats(),planning,command:commands});vi.restoreAllMocks();
    }
    writeFileSync(join(tmpdir(), 'p4b-game-performance.json'),JSON.stringify({scope:'actual Game executeCommand / NPC / environment; planning measured separately; excludes browser renderer',node:process.version,rows},null,2)+'\n');
});

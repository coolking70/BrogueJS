import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { RigidPosePathing, type RigidPoseGoal } from '../engine/Map/RigidPosePathing';
import { FootprintPathing } from '../engine/Map/FootprintPathing';
import { TerrainType as T } from '../engine/Map/Grid';
import { cellTerrainFlags } from '../engine/Map/DungeonFeature';
import { T_IS_FIRE, T_OBSTRUCTS_PASSABILITY } from '../engine/Map/TerrainCatalog';
import { RIGID_POSES, type RigidPose, turnedPose } from '../engine/Movement/RigidFootprint';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { rng } from '../engine/Random';
import type { Pos } from '../types';
import { MASKS, definition, rigidScene } from './support/rigidScene';

type Scene = ReturnType<typeof rigidScene>;
function corridor() {
    const s=rigidScene();
    for(let y=0;y<20;y++)for(let x=0;x<20;x++)s.grid.setTerrain(x,y,T.WALL);
    for(let y=3;y<=12;y++)for(let x=3;x<=12;x++)s.grid.setTerrain(x,y,T.FLOOR);
    for(let x=13;x<=18;x++)s.grid.setTerrain(x,7,T.FLOOR);
    commitCreatureAnchor(s.actor,{x:7,y:7},'mutate',true);
    s.spatial.setSpatial(s.actor,{schema:1,footprintId:'fixture:body',pose:'r90'});
    return s;
}
function walk(s: Scene, pathing: RigidPosePathing, goal: RigidPoseGoal) {
    const actions: {kind:string; at:Pos; pose:RigidPose}[]=[];
    for(let n=0;n<100;n++) {
        const step=pathing.planStep(s.actor,goal);
        if(step.kind==='arrived')return actions;
        expect(['step','rotate']).toContain(step.kind);
        const plan=step.kind==='rotate'?s.spatial.planRotationPlacement(s.actor,step.quarterTurns!):s.spatial.planRigidStepPlacement(s.actor,step.at!);
        expect(plan).not.toBeNull();expect(s.spatial.commitPlacement(plan!)).toBe(true);
        if(step.kind==='rotate'){expect(step.actionCost).toBe(plan!.actionCost);expect(step.actionCost).toBeGreaterThan(0);}
        actions.push({kind:step.kind,at:{...s.actor.loc},pose:s.actor.spatial!.pose as RigidPose});
    }
    throw new Error('bounded fixture route did not arrive');
}

/** Independent forward Dijkstra, no production terrain/distance tables,
 * index encoding, heap or reverse relaxation. Edges use the checked spatial
 * predicates so this specifically cross-checks graph/path/cache correctness. */
function referenceDistance(s: Scene, target: Pos, targetPose: RigidPose, fireCost=1): number {
    const key=(at:Pos,pose:RigidPose)=>`${at.x},${at.y},${pose}`;
    const open=[{at:{...s.actor.loc},pose:s.actor.spatial!.pose as RigidPose,cost:0}], best=new Map<string,number>([[key(s.actor.loc,s.actor.spatial!.pose as RigidPose),0]]);
    const allowsTerrain=(p:Pos)=>!(cellTerrainFlags(s.grid,p.x,p.y)&T_OBSTRUCTS_PASSABILITY);
    while(open.length) {
        open.sort((a,b)=>a.cost-b.cost);const current=open.shift()!;
        if(current.cost!==best.get(key(current.at,current.pose)))continue;
        if(current.at.x===target.x&&current.at.y===target.y&&current.pose===targetPose)return current.cost;
        const next:{at:Pos;pose:RigidPose;cost:number}[]=[];
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
            if(!dx&&!dy)continue;
            const at={x:current.at.x+dx,y:current.at.y+dy};
            if(!s.spatial.canFitTerrainAt(s.actor,at,{allowsTerrain},current.pose))continue;
            if(dx&&dy&&(!s.spatial.canFitTerrainAt(s.actor,{x:at.x,y:current.at.y},{allowsTerrain},current.pose)
                ||!s.spatial.canFitTerrainAt(s.actor,{x:current.at.x,y:at.y},{allowsTerrain},current.pose)))continue;
            const cost=s.catalog.cells(s.actor.spatial!.footprintId,current.pose).some(o=>cellTerrainFlags(s.grid,at.x+o.x,at.y+o.y)&T_IS_FIRE)?fireCost:1;
            next.push({at,pose:current.pose,cost:current.cost+cost});
        }
        for(const turn of [1,-1] as const)if(s.spatial.canRotateBetween(s.actor,current.at,current.pose,turn,{allowsTerrain},true))
            next.push({at:current.at,pose:turnedPose(current.pose,turn),cost:current.cost+1});
        for(const node of next)if(node.cost<(best.get(key(node.at,node.pose))??Infinity)){best.set(key(node.at,node.pose),node.cost);open.push(node);}
    }
    return Infinity;
}

describe('4b-0 bounded fixture pose graph', () => {
    it('rotates in a chamber to enter a one-cell corridor; shortest cost includes the turn', () => {
        const s=corridor(), pathing=new RigidPosePathing(s.spatial), before=rng.getState();
        const goal={kind:'anchors' as const,anchors:[{x:15,y:7,pose:'r0' as const}]};
        expect(pathing.planStep(s.actor,goal,{},true).distance).toBe(9);
        const actions=walk(s,pathing,goal);
        expect(actions).toHaveLength(9);expect(actions.filter(a=>a.kind==='rotate')).toHaveLength(1);
        expect(s.actor.loc).toEqual({x:15,y:7});expect(s.actor.spatial!.pose).toBe('r0');
        expect(pathing.stats.terrainBuilds).toBe(1);expect(pathing.stats.distanceBuilds).toBe(1);expect(rng.getState()).toEqual(before);
    });
    it('endpoint-only L corridor cannot rotate even though both endpoint poses fit', () => {
        const s=rigidScene();for(let y=0;y<20;y++)for(let x=0;x<20;x++)s.grid.setTerrain(x,y,T.WALL);
        for(let n=0;n<4;n++){s.grid.setTerrain(10+n,10,T.FLOOR);s.grid.setTerrain(10,10+n,T.FLOOR);}
        expect(s.spatial.canFitAt(s.actor,s.actor.loc,{},'r90')).toBe(true);
        const pathing=new RigidPosePathing(s.spatial);
        expect(pathing.planStep(s.actor,{kind:'anchors',anchors:[{x:10,y:10,pose:'r90'}]}).kind).toBe('unreachable');
    });
    it.each(Object.entries(MASKS))('%s route cost equals an independent forward graph across poses and terrain weights', (_name,cells) => {
        const s=rigidScene(cells,12,12), pathing=new RigidPosePathing(s.spatial);
        s.grid.setTerrain(3,4,T.PLAIN_FIRE);s.grid.setTerrain(4,5,T.PLAIN_FIRE);s.grid.setTerrain(5,5,T.PLAIN_FIRE);
        for(const pose of RIGID_POSES)for(const cost of [1,7]) {
            const at={x:3,y:4}, expected=referenceDistance(s,at,pose,cost);
            const result=pathing.planStep(s.actor,{kind:'anchors',anchors:[{...at,pose}]},{costs:[{flags:T_IS_FIRE,cost}]},true);
            expect(result.distance).toBe(expected);
        }
        const goal={kind:'anchors' as const,anchors:[{x:3,y:4,pose:'r0' as const}]};
        const cheap=pathing.planStep(s.actor,goal,{},true).distance!;
        expect(pathing.planStep(s.actor,goal,{costs:[{flags:T_IS_FIRE,cost:7}]},true).distance!).toBeGreaterThan(cheap);
    });
    it('dynamic blockage rechecks sweep occupancy, replans once and permits a newly dead obstacle', () => {
        const s=rigidScene(), pathing=new RigidPosePathing(s.spatial), goal={kind:'anchors' as const,anchors:[{x:10,y:10,pose:'r90' as const}]};
        expect(pathing.planStep(s.actor,goal).kind).toBe('rotate');
        const blocker=new Monster(12,12,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
        s.world.monsters.push(blocker);s.spatial.replaceWorld(s.world);
        const detour=pathing.planStep(s.actor,goal);expect(detour.replanned).toBe(true);expect(detour.kind).toBe('rotate');
        expect(detour.quarterTurns).toBe(-1);expect(s.spatial.planRotationPlacement(s.actor,detour.quarterTurns!)).not.toBeNull();
        expect(pathing.stats.dynamicReplans).toBe(1);expect(pathing.stats.terrainBuilds).toBe(1);
        blocker.hp=0;expect(pathing.planStep(s.actor,goal).quarterTurns).toBe(1);expect(pathing.stats.terrainBuilds).toBe(1);
    });
    it('blocked corridor is bounded and occupancy is never retained in the terrain cache', () => {
        const s=corridor(), pathing=new RigidPosePathing(s.spatial);
        commitCreatureAnchor(s.actor,{x:10,y:7},'mutate',true);s.spatial.setSpatial(s.actor,{schema:1,footprintId:'fixture:body',pose:'r0'});
        const blocker=new Monster(14,7,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
        s.world.monsters.push(blocker);s.spatial.replaceWorld(s.world);
        const goal={kind:'anchors' as const,anchors:[{x:15,y:7,pose:'r0' as const}]};
        const result=pathing.planStep(s.actor,goal);expect(result.kind).toBe('blocked');expect(result.replanned).toBe(true);
        expect(pathing.stats.dynamicReplans).toBe(1);expect(pathing.stats.visitedNodes).toBeLessThanOrEqual(20*20*4*2);
        blocker.hp=0;expect(pathing.planStep(s.actor,goal).kind).toBe('step');expect(pathing.stats.terrainBuilds).toBe(1);
    });
    it('target pose changes distance goals; terrain revisions invalidate while actor pose changes reuse a four-pose graph', () => {
        const s=rigidScene(), target=new Monster(16,10,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
        target.spatial={schema:1,footprintId:'fixture:body',pose:'r90'};
        s.world.monsters.push(target);s.spatial.replaceWorld(s.world);const pathing=new RigidPosePathing(s.spatial);
        const goal={kind:'contact' as const,target};const first=pathing.planStep(s.actor,goal,{},true);
        const captured=first.distanceAt!({x:10,y:10},'r0');
        s.spatial.setSpatial(target,{schema:1,footprintId:'fixture:body',pose:'r270'});
        pathing.planStep(s.actor,goal);expect(pathing.stats.distanceBuilds).toBe(2);expect(pathing.stats.terrainBuilds).toBe(1);
        expect(first.distanceAt!({x:10,y:10},'r0')).toBe(captured);
        const plan=s.spatial.planRotationPlacement(s.actor,1)!;expect(s.spatial.commitPlacement(plan)).toBe(true);
        pathing.planStep(s.actor,goal);expect(pathing.stats.terrainBuilds).toBe(1);
        s.grid.setTerrain(2,2,T.WALL);pathing.planStep(s.actor,goal);expect(pathing.stats.terrainBuilds).toBe(2);
    });
    it('LRU 8 groups and explicit clear change only cache counters, never the selected action', () => {
        const s=rigidScene(MASKS.L), pathing=new RigidPosePathing(s.spatial), goal={kind:'anchors' as const,anchors:[{x:4,y:5,pose:'r180' as const}]};
        const before=pathing.planStep(s.actor,goal,{costs:[{flags:T_IS_FIRE,cost:1}]});
        for(let cost=2;cost<=10;cost++)pathing.planStep(s.actor,goal,{costs:[{flags:T_IS_FIRE,cost}]});
        expect(pathing.stats.cachedGraphs).toBe(8);expect(pathing.stats.terrainBuilds).toBe(10);
        expect(pathing.planStep(s.actor,goal,{costs:[{flags:T_IS_FIRE,cost:1}]})).toEqual(before);
        expect(pathing.stats.terrainBuilds).toBe(11);pathing.clear();expect(pathing.stats.cachedGraphs).toBe(0);
        expect(pathing.planStep(s.actor,goal,{costs:[{flags:T_IS_FIRE,cost:1}]})).toEqual(before);
    });
    it('shape/fixed pose set/region/policy are separate graph identities; invalid targets/policies fail', () => {
        const s=rigidScene(MASKS.L), pathing=new RigidPosePathing(s.spatial), goal={kind:'anchors' as const,anchors:[{x:6,y:7}]};
        pathing.planStep(s.actor,goal);
        s.catalog.registerFootprint({...definition('fixed',MASKS.L),poses:['r0']});s.spatial.setSpatial(s.actor,{schema:1,footprintId:'fixed',pose:'r0'});
        pathing.planStep(s.actor,goal);expect(pathing.stats.terrainBuilds).toBe(2);
        s.actor.spatial!.movementRegionId=1;s.spatial.replaceWorld({...s.world,inRegion:(_id,p)=>p.x>=4&&p.x<16&&p.y>=4&&p.y<16});
        pathing.planStep(s.actor,goal);expect(pathing.stats.terrainBuilds).toBe(3);
        expect(()=>pathing.planStep(s.actor,{kind:'anchors',anchors:[{x:6,y:7,pose:'m0' as any}]})).toThrow('pose');
        expect(()=>pathing.planStep(s.actor,goal,{costs:[{flags:1,cost:0}]})).toThrow('cost');
        expect(()=>pathing.planStep(s.actor,goal,{unknown:true} as any)).toThrow('policy');
        s.actor.movementSpeed=0;expect(()=>pathing.planStep(s.actor,goal)).toThrow('positive');
    });
    it('fixed square fixture decisions match the existing r0 graph without extra nodes or turn edges', () => {
        const s=rigidScene();s.spatial.setSpatial(s.actor,{schema:1,footprintId:'builtin:square-2',pose:'r0'});
        s.grid.setTerrain(6,8,T.WALL);const rigid=new RigidPosePathing(s.spatial), square=new FootprintPathing(s.spatial), goal={kind:'anchors' as const,anchors:[{x:3,y:4}]};
        for(let n=0;n<20;n++) {
            const a=rigid.planStep(s.actor,goal), b=square.planStep(s.actor,goal);expect(a.kind).toBe(b.kind);expect(a.at).toEqual(b.at);
            if(a.kind==='arrived')break;
            const plan=s.spatial.planRigidStepPlacement(s.actor,a.at!)!;expect(s.spatial.commitPlacement(plan)).toBe(true);
        }
        expect(s.actor.loc).toEqual({x:3,y:4});expect(rigid.stats.visitedNodes).toBeLessThanOrEqual(20*20);
    });
    it('ordinary worlds read no cells and allocate no graph/index; production masks remain closed', () => {
        const s=rigidScene();s.spatial.setSpatial(s.actor);const pathing=new RigidPosePathing(s.spatial);
        let reads=0;const get=s.grid.getCell.bind(s.grid);s.grid.getCell=(x,y)=>{reads++;return get(x,y);};const before=rng.getState();
        for(let n=0;n<5;n++)expect(pathing.planStep(s.actor,{kind:'anchors',anchors:[{x:12,y:12}]}).kind).toBe('unsupported');
        expect(reads).toBe(0);expect(s.spatial.hasIndex).toBe(false);expect(pathing.stats).toEqual({terrainBuilds:0,distanceBuilds:0,dynamicReplans:0,cacheHits:0,visitedNodes:0,cachedGraphs:0});
        expect(rng.getState()).toEqual(before);
    });
});

it('records long-bar and L fixture pursuit costs separately from native Game scheduling', () => {
    const rows=[];
    for(const [name,cells] of [['bar',MASKS.bar],['L',MASKS.L]] as const) {
        const s=rigidScene(cells,79,29);commitCreatureAnchor(s.actor,{x:5,y:14},'mutate',true);
        const target=new Monster(67,14,(monsters as MonsterData[]).find(m=>m.id==='rat')!);s.world.monsters.push(target);s.spatial.replaceWorld(s.world);
        const pathing=new RigidPosePathing(s.spatial), samples:number[]=[], before=rng.getState();
        for(let n=0;n<30;n++) {
            const start=performance.now(), step=pathing.planStep(s.actor,{kind:'contact',target});
            expect(['step','rotate']).toContain(step.kind);
            const plan=step.kind==='rotate'?s.spatial.planRotationPlacement(s.actor,step.quarterTurns!):s.spatial.planRigidStepPlacement(s.actor,step.at!);
            expect(plan).not.toBeNull();expect(s.spatial.commitPlacement(plan!)).toBe(true);samples.push(performance.now()-start);
        }
        expect(rng.getState()).toEqual(before);const sorted=samples.slice(1).sort((a,b)=>a-b);
        rows.push({name,commands:30,coldMs:samples[0],warmP50Ms:sorted[Math.floor(sorted.length*.5)],warmP95Ms:sorted[Math.floor(sorted.length*.95)],...pathing.stats,substantiveRngDelta:0,cosmeticRngDelta:0});
    }
    writeFileSync('/private/tmp/p4b-pose-performance.json',JSON.stringify({scope:'fixture pose planning+checked commit, 79x29; excludes Game/AI/environment/render',node:process.version,nodeOptions:process.env.NODE_OPTIONS,rows},null,2)+'\n');
});

import { describe, expect, it } from 'vitest';
import { rigidMovementFootprint, squareAnchorRevision } from '../engine/Movement/CreatureSpatial';
import { compileQuarterSweep, compileRigidFootprint, rigidFootprint, rotationStages, RIGID_POSES } from '../engine/Movement/RigidFootprint';
import { SpatialCatalog, type FootprintDefinition } from '../engine/Movement/SpatialSchema';
import { TerrainType as T } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import { rng } from '../engine/Random';
import monsters from '../data/monsters.json';
import { entityCodecDeps, restoreEntityGraph, serializeMonsterRow } from '../engine/Core/EntitySnapshot';
import { decodeWholeRunWorld, isWholeRunSnapshot, snapshotNativeSpatialWorld } from '../engine/Core/WholeRunSnapshot';
import { createHeadlessGame } from './harness';
import { bodyEdges } from '../ui/bodyDrawing';
import type { Pos } from '../types';

const rat = (x = 8, y = 8) => new Monster(x, y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
import { MASKS, definition, rigidScene } from './support/rigidScene';

// Independent polygon clipping oracle, deliberately not SAT or contact roots.
function clippedArea(cell: Pos, tile: Pos, angle: number): number {
    const c = Math.cos(angle), s = Math.sin(angle);
    let polygon = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([dx,dy]) =>
        ({ x:(cell.x+dx!)*c-(cell.y+dy!)*s, y:(cell.x+dx!)*s+(cell.y+dy!)*c }));
    for (const [axis, sign, bound] of [['x',1,tile.x+.5],['x',-1,.5-tile.x],['y',1,tile.y+.5],['y',-1,.5-tile.y]] as const) {
        const output: Pos[] = [];
        for (let i=0;i<polygon.length;i++) {
            const a=polygon[i]!, b=polygon[(i+1)%polygon.length]!;
            const da=sign*a[axis]-bound, db=sign*b[axis]-bound;
            if (da<=0) output.push(a);
            if ((da<0 && db>0) || (da>0 && db<0)) {
                const t=da/(da-db); output.push({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t });
            }
        }
        polygon=output;
    }
    return Math.abs(polygon.reduce((a,p,i) => { const q=polygon[(i+1)%polygon.length]!; return a+p.x*q.y-p.y*q.x; },0))/2;
}

describe('4b-0 continuous sweep compiler and fixture capability', () => {
    it.each(Object.entries(MASKS))('%s sweep covers independently clipped polygons throughout both directions', (id,cells) => {
        const shape=compileRigidFootprint(definition(id,cells));
        const sweep=shape.sweeps.get('r0:r90')!, keys=new Set(sweep.map(p=>`${p.x},${p.y}`));
        expect(shape.sweeps.get('r90:r0')).toBe(sweep);
        for (let n=0;n<=160;n++) for (const cell of cells) for (let y=-5;y<=5;y++) for (let x=-5;x<=5;x++) {
            if (clippedArea(cell,{x,y},n*Math.PI/320)>1e-8) expect(keys.has(`${x},${y}`),`${id} angle=${n} tile=${x},${y}`).toBe(true);
        }
        expect(sweep).toEqual([...sweep].sort((a,b)=>a.y-b.y||a.x-b.x));
        expect(sweep.length).toBeLessThanOrEqual(256);
    });
    it('long bar sweep contains the middle arc which neither endpoint occupies', () => {
        const d=definition(), shape=compileRigidFootprint(d), sweep=shape.sweeps.get('r0:r90')!;
        expect(sweep).toContainEqual({x:2,y:2});
        expect(shape.cells.get('r0')!.some(p=>p.x===2&&p.y===2)).toBe(false);
        expect(shape.cells.get('r90')!.some(p=>p.x===2&&p.y===2)).toBe(false);
        expect(rotationStages('r0',2)).toEqual(['r90','r180']);
        expect(rotationStages('r0',-2)).toEqual(['r270','r180']);
    });
    it('square and fixed shapes allocate no rotational edges; compiled data cannot be mutated', () => {
        const catalog=new SpatialCatalog(true), shape=rigidFootprint(catalog,'builtin:square-3');
        expect(shape.poses).toEqual(['r0']); expect(shape.sweeps.size).toBe(0);
        expect(rigidFootprint(catalog,'builtin:square-3')).toBe(shape);
        expect((shape.sweeps as any).set).toBeUndefined(); expect((shape.cells as any).clear).toBeUndefined();
        expect(Object.isFrozen(shape.cells.get('r0')![0])).toBe(true);
        const fixed=compileRigidFootprint({...definition(),poses:['r90']}); expect(fixed.sweeps.size).toBe(0);
    });
    it('strict compilation rejects malformed masks, partial pose sets, mirrors and future local health', () => {
        const badCells=[[],[{x:0,y:0},{x:2,y:0}],[{x:1,y:0}],[{x:0,y:0},{x:.5,y:0}],
            [{x:0,y:0},{x:0,y:0}],Array.from({length:17},(_,x)=>({x,y:0})),[{x:0,y:0},{x:16,y:0}]];
        for (const cells of badCells) expect(()=>compileRigidFootprint(definition('bad',cells))).toThrow();
        for (const poses of [['r0','r90'],['r0','m0'],['m0']] as FootprintDefinition['poses'][])
            expect(()=>compileRigidFootprint({...definition(),poses})).toThrow(/poses|mirrors/);
        const zone={id:'head',nameKey:'head',health:{kind:'local' as const,maxHp:5,ownerTransfer:{numerator:1,denominator:1}},armor:0,damageMultiplier:{numerator:1,denominator:1},breakRuleId:'foundation:keep-zone'};
        expect(()=>compileRigidFootprint({...definition(),zones:[zone],zoneCells:[{x:0,y:0,zoneId:'head'}]})).toThrow('local zone');
    });
    it('sweep budget rejects rather than truncates even for a connected 16-cell mask', () => {
        const cells=Array.from({length:16},(_,x)=>({x,y:0}));
        expect(()=>compileQuarterSweep(cells)).toThrow('sweep budget exceeded');
        expect(()=>compileRigidFootprint(definition('long',cells))).toThrow('sweep budget exceeded');
        expect(compileRigidFootprint({...definition('fixed-long',cells),poses:['r0']}).cells.get('r0')).toHaveLength(16);
        expect(()=>compileQuarterSweep(MASKS.bar,4)).toThrow('budget exceeded');
        expect(()=>compileQuarterSweep(cells,257)).toThrow('budget');
        expect(()=>compileQuarterSweep([{x:10000,y:0}])).toThrow('budget');
    });
});

describe('4b-0 explicit atomic fixture rotation (native Game gate stays closed)', () => {
    it('final fit cannot bypass a wall or another creature in the swept arc', () => {
        const s=rigidScene(), p={x:s.actor.x+2,y:s.actor.y+2};
        s.grid.setTerrain(p.x,p.y,T.WALL);
        expect(s.spatial.canFitAt(s.actor,s.actor.loc,{},'r90')).toBe(true);
        expect(s.spatial.planRotationPlacement(s.actor,1)).toBeNull();
        s.grid.setTerrain(p.x,p.y,T.FLOOR); const blocker=rat(p.x,p.y);
        s.world.monsters.push(blocker); s.spatial.replaceWorld(s.world);
        expect(s.spatial.planRotationPlacement(s.actor,1)).toBeNull();
        blocker.hp=0; expect(s.spatial.planRotationPlacement(s.actor,1)).not.toBeNull();
    });
    it('a half turn checks the second quarter and costs two positive quarter actions', () => {
        const s=rigidScene(); s.grid.setTerrain(s.actor.x-2,s.actor.y+2,T.WALL);
        expect(s.spatial.canRotateFootprint(s.actor,1)).toBe(true);
        expect(s.spatial.canFitAt(s.actor,s.actor.loc,{},'r180')).toBe(true);
        expect(s.spatial.planRotationPlacement(s.actor,2)).toBeNull();
        // The other declared direction has a different swept volume.
        const alternate=s.spatial.planRotationPlacement(s.actor,-2)!;
        expect(alternate.actionCost).toBe(s.actor.movementSpeed*2);
        expect(s.spatial.commitPlacement(alternate)).toBe(true); expect(s.actor.spatial!.pose).toBe('r180');
        expect(s.actor.loc).toEqual({x:10,y:10});
    });
    it('rotation is one-use, leaves the pivot fixed and invalidates body revision/index with no RNG', () => {
        const s=rigidScene(), before=rng.getState(), anchor=s.actor.loc, revision=s.spatial.occupancyRevision, bodyRevision=squareAnchorRevision(s.actor);
        s.spatial.creatureAtCell(s.actor.loc); expect(s.spatial.hasIndex).toBe(true);
        const plan=s.spatial.planRotationPlacement(s.actor,1)!;
        expect(plan.actionCost).toBe(s.actor.movementSpeed); expect(plan.actionCost).toBeGreaterThan(0);
        expect(s.actor.spatial!.pose).toBe('r0');
        expect(s.spatial.commitPlacement(plan)).toBe(true); expect(s.spatial.commitPlacement(plan)).toBe(false);
        expect(s.actor.loc).toBe(anchor); expect(s.actor.spatial!.pose).toBe('r90');
        expect(s.spatial.hasIndex).toBe(false); expect(s.spatial.occupancyRevision).toBeGreaterThan(revision);
        expect(squareAnchorRevision(s.actor)).toBe(bodyRevision+1);
        expect(s.spatial.creatureAtCell({x:13,y:10})).toBeUndefined(); expect(s.spatial.creatureAtCell({x:10,y:13})).toBe(s.actor);
        expect(rng.getState()).toEqual(before);
    });
    it.each(['terrain','revived','reservation','actor','speed','ownership','frozen'] as const)('commit rechecks %s without partially publishing a pose', change => {
        const s=rigidScene(), blocker=rat(s.actor.x+2,s.actor.y+2); blocker.hp=0;
        s.world.monsters.push(blocker); s.spatial.replaceWorld(s.world);
        const plan=s.spatial.planRotationPlacement(s.actor,1)!; expect(plan).not.toBeNull();
        if(change==='terrain')s.grid.setTerrain(blocker.x,blocker.y,T.WALL);
        if(change==='revived')blocker.hp=1; // eligibility changed without a position revision
        if(change==='reservation'){s.world.dormantMonsters.push(rat(blocker.x,blocker.y));s.spatial.replaceWorld(s.world);}
        if(change==='actor')s.actor.hp=0;
        if(change==='speed')s.actor.movementSpeed++;
        if(change==='ownership')s.spatial.replaceWorld({...s.world,monsters:[blocker]});
        if(change==='frozen')Object.freeze(s.actor.spatial);
        expect(s.spatial.commitPlacement(plan)).toBe(false); expect(s.actor.spatial!.pose).toBe('r0'); expect(s.actor.loc).toEqual({x:10,y:10});
    });
    it('sweep also obeys map boundaries/regions; no ignored stationary obstacle or combined step/rotation', () => {
        const s=rigidScene(); s.actor.spatial!.movementRegionId=1;
        s.spatial.replaceWorld({...s.world,inRegion:(_id,p)=>p.x>=10&&p.y>=10&&p.x<14&&p.y<14});
        expect(s.spatial.canFitAt(s.actor,s.actor.loc,{},'r90')).toBe(true);
        expect(s.spatial.planRotationPlacement(s.actor,1)).toBeNull(); // pivot square sweeps outside the region
        delete s.actor.spatial!.movementRegionId; s.spatial.replaceWorld(s.world);
        const other=rat(0,0);
        expect(s.spatial.planRotationPlacement(s.actor,1,{ignore:new Set([other])})).toBeNull();
        expect(()=>s.spatial.planPlacement([{creature:s.actor,at:{x:11,y:10},pose:'r90'}])).toThrow('Rotation');
        expect(()=>s.spatial.planRotationPlacement(s.actor,0 as any)).toThrow('rotation');
        expect(()=>rotationStages('m0',1)).toThrow('mirror');
        const edge=rigidScene(MASKS.bar,8,8); edge.actor.loc.x=0;
        edge.spatial.replaceWorld(edge.world); expect(edge.spatial.canFitAt(edge.actor,edge.actor.loc,{},'r90')).toBe(true);
        expect(edge.spatial.planRotationPlacement(edge.actor,1)).toBeNull();
    });
    it.each(Object.entries(MASKS))('%s keeps holes/concave cells empty in every pose and permits another creature there', (name,cells) => {
        const s=rigidScene(cells);
        for (const pose of RIGID_POSES) {
            s.spatial.setSpatial(s.actor,{schema:1,footprintId:'fixture:body',pose});
            const body=s.spatial.footprintOf(s.actor), occupied=new Set(body.map(p=>`${p.x},${p.y}`));
            const empty=name==='bar'?{x:s.actor.x+1,y:s.actor.y+1}:name==='cross'?{x:s.actor.x+1,y:s.actor.y+1}:
                (()=>{const p=pose==='r0'?{x:1,y:1}:pose==='r90'?{x:-1,y:1}:pose==='r180'?{x:-1,y:-1}:{x:1,y:-1};return{x:s.actor.x+p.x,y:s.actor.y+p.y};})();
            expect(occupied.has(`${empty.x},${empty.y}`)).toBe(false);
            const other=rat(empty.x,empty.y); s.spatial.replaceWorld({...s.world,monsters:[s.actor,other]});
            expect(s.spatial.creatureAtCell(empty)).toBe(other);
            expect(s.spatial.collectBodyTargets(body,{effect:'area-damage'})).toHaveLength(1);
            expect(s.spatial.collectBodyTargets(body,{effect:'area-damage'})[0]!.entity).toBe(s.actor);
            const edges=bodyEdges(body);
            for(const edge of edges)expect(edge.from.x===edge.to.x||edge.from.y===edge.to.y).toBe(true);
            expect(edges).toHaveLength(name==='bar'?10:name==='ring'?16: name==='cross'?12:8);
            s.spatial.replaceWorld(s.world);
        }
    });
    it('native labels rotate with their cells; codec/clone preserve pose and independent containers', () => {
        const s=rigidScene(), d=definition('fixture:labels',MASKS.L);
        d.zones=[{id:'tail',nameKey:'tail',health:{kind:'native'},armor:0,damageMultiplier:{numerator:1,denominator:1},breakRuleId:'foundation:keep-zone'}];
        d.zoneCells=[{x:1,y:0,zoneId:'tail'}];s.catalog.registerFootprint(d);
        s.spatial.setSpatial(s.actor,{schema:1,footprintId:d.id,pose:'r0'});
        const plan=s.spatial.planRotationPlacement(s.actor,1)!;expect(s.spatial.commitPlacement(plan)).toBe(true);
        expect(s.spatial.occupantsAtCell({x:10,y:11})[0]!.zoneId).toBe('tail');
        expect(s.spatial.occupantsAtCell({x:11,y:10})).toHaveLength(0);
        const row=serializeMonsterRow(s.actor), loaded=restoreEntityGraph([row],[],[],[],{...entityCodecDeps,spatialCatalog:s.catalog}).monsters.get(s.actor.id)!;
        expect(loaded.spatial).toEqual(s.actor.spatial);expect(loaded.spatial).not.toBe(s.actor.spatial);
        const clone=s.actor.copyForClone();expect(clone.spatial).toEqual(s.actor.spatial);expect(clone.spatial).not.toBe(s.actor.spatial);
        expect(()=>rigidMovementFootprint(s.actor,new SpatialCatalog())).toThrow('not open');
    });
    it('fixed orientation, body members, locks and mirrored schema fixtures cannot obtain a rotation plan', () => {
        const s=rigidScene(); s.spatial.setSpatial(s.actor,{schema:1,footprintId:'builtin:square-2',pose:'r0'});
        expect(s.spatial.planRotationPlacement(s.actor,1)).toBeNull();
        for (const fields of [{actionLockInTicks:0},{bodyMember:{groupId:s.actor.id,partId:'core'}}]) {
            s.actor.spatial={schema:1,footprintId:'fixture:body',pose:'r0',...fields};
            expect(()=>s.spatial.planRotationPlacement(s.actor,1)).toThrow('independent');
        }
        s.catalog.registerFootprint({...definition('mirror'),poses:['r0','m0']});
        s.actor.spatial={schema:1,footprintId:'mirror',pose:'r0'};
        expect(()=>s.spatial.planRotationPlacement(s.actor,1)).toThrow('mirrors');
    });
    it('rotated fixture world codec rebuilds the same occupancy; native load rejects it before retiring the old run', () => {
        const game=createHeadlessGame(7301,'test'), s=rigidScene(MASKS.L);
        const plan=s.spatial.planRotationPlacement(s.actor,-1)!;expect(s.spatial.commitPlacement(plan)).toBe(true);
        const saved=JSON.parse(JSON.stringify(game.toSnapshot()));
        saved.monsters=[serializeMonsterRow(s.actor)];saved.dormantMonsters=[];
        saved.run.spatialWorld=snapshotNativeSpatialWorld(new Map([[game.depth,s.spatial]]));
        expect(isWholeRunSnapshot(saved,s.catalog)).toBe(true);
        const before=rng.getState(), oldPlayer=game.player;
        const loaded=decodeWholeRunWorld(saved,{...entityCodecDeps,spatialCatalog:s.catalog});
        const service=loaded.spatialLevels!.get(game.depth)!;
        expect(service.footprintOf(loaded.entityGraph.monsters.get(s.actor.id)!)).toEqual(s.spatial.footprintOf(s.actor));
        expect(snapshotNativeSpatialWorld(loaded.spatialLevels!)).toEqual(saved.run.spatialWorld);
        expect(game.loadSnapshot(saved)).toBe(false);expect(game.player).toBe(oldPlayer);expect(rng.getState()).toEqual(before);
        for(const mutate of [(v:typeof saved)=>{v.monsters[0].spatial.pose='m0';},(v:typeof saved)=>{v.run.spatialWorld.definitions.footprints[0].geometry.cells.push({x:30,y:30});}]) {
            const bad=structuredClone(saved);mutate(bad);expect(()=>decodeWholeRunWorld(bad,{...entityCodecDeps,spatialCatalog:s.catalog})).toThrow();
        }
    });
});

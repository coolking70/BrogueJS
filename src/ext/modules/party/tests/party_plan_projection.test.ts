import { expect, it } from 'vitest';
import { projectPartyPlans } from '../ui/planProjection';
import type { KnownPartyWorld } from '../../../../engine/Core/PartyPlanning';
import type { PartyPlan } from '../../../partyWindow';
import { visibleStationedResidents } from '../../../../ui/partyResidentMap';
import { PartyMember } from '../../../../engine/Core/PartyRuntime';
import { Grid } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
const view = (): KnownPartyWorld => ({baseRevision:3,level:1,cells:[{x:0,y:0,passable:true,hazard:false},{x:1,y:0,passable:true,hazard:false},{x:2,y:0,passable:true,hazard:false}],members:[{id:1,x:0,y:0,moveTicks:100,remaining:0,plan:{kind:'queue',actions:[{kind:'move',dx:1,dy:0},{kind:'move',dx:1,dy:0},{kind:'move',dx:1,dy:0}]},cursor:0}],enemies:[]});
it('clips unknown queue paths and never exposes an unknown target',()=>{
 const v=view(),before=JSON.stringify(v);
 expect(projectPartyPlans(v,new Map())[0]).toMatchObject({draft:false,points:[{x:0,y:0},{x:1,y:0},{x:2,y:0}],status:'unknown',target:null});
 const draft=new Map<number,PartyPlan>([[1,{kind:'travel',level:{kind:'dungeon',depth:1},target:{x:99,y:99}}]]);
 expect(projectPartyPlans(v,draft)[0]).toMatchObject({draft:true,points:[{x:0,y:0}],status:'unknown',target:null});
 expect(JSON.stringify(v)).toBe(before);
});
it('projects accepted tail and draft separately, blocks known enemies and diagonal corners',()=>{
 const v=view();v.members[0]!.cursor=2;
 expect(projectPartyPlans(v,new Map())[0]!.points).toHaveLength(2);
 v.enemies=[{id:9,x:1,y:0}];
 expect(projectPartyPlans(v,new Map())[0]).toMatchObject({status:'blocked',points:[{x:0,y:0}]});
 v.enemies=[];v.cells.push({x:1,y:1,passable:true,hazard:false});
 expect(projectPartyPlans(v,new Map([[1,{kind:'queue',actions:[{kind:'move',dx:1,dy:1}]}]]))[0]).toMatchObject({status:'blocked',points:[{x:0,y:0}]});
});
it('finds only known travel route and omits hidden attack identities',()=>{
 const v=view();
 expect(projectPartyPlans(v,new Map([[1,{kind:'travel',level:{kind:'dungeon',depth:1},target:{x:2,y:0}}]]))[0]).toMatchObject({points:[{x:0,y:0},{x:1,y:0},{x:2,y:0}],target:{x:2,y:0},status:'known'});
 expect(projectPartyPlans(v,new Map([[1,{kind:'queue',actions:[{kind:'attack',targetId:99}]}]]))[0]).toMatchObject({target:null,status:'unknown'});
});
it('maps only visible living stationed residents with an active home on this floor', () => {
 const grid=new Grid(8,8), actors=Array.from({length:6},(_,index)=>new PartyMember(index+1,1));
 for(const actor of actors)grid.getCell(actor.x,actor.y)!.isVisible=true;
 actors[1]!.hp=0;
 grid.getCell(actors[2]!.x,actors[2]!.y)!.isVisible=false;
 const game={
  depth:1,grid,
  party:{state:{retired:[{actorId:actors[3]!.id}]},stationed:new Map(actors.map(actor=>[actor.id,actor]))},
  world5:{residents:actors.slice(0,5).map((actor,index)=>({actorId:actor.id,levelRef:{kind:'dungeon',depth:index===4?2:1}}))}
 } as unknown as Parameters<typeof visibleStationedResidents>[0];
 const before=JSON.stringify({party:game.party,world:game.world5}), random=rng.getState();
 expect(visibleStationedResidents(game)).toEqual([actors[0]]);
 expect(JSON.stringify({party:game.party,world:game.world5})).toBe(before);
 expect(rng.getState()).toEqual(random);
 expect(visibleStationedResidents({...game,party:undefined})).toEqual([]);
 expect(visibleStationedResidents({...game,world5:undefined})).toEqual([]);
});

import { it, expect } from 'vitest';
import { initialResidentNeed, assertResidentNeedsInput, planResidentNeeds, type ResidentNeedsInput } from '../engine/Core/ResidentEconomy';
import type { OfflineResidentState } from '../ext/world5';
const input = (toTick:number,ids=[1]):ResidentNeedsInput=>({schema:2,fromTick:0,toTick,
  residents:ids.map(initialResidentNeed),rations:[],beds:ids.map(actorId=>({actorId,bedId:actorId+100})),eligibleBeds:ids.map(id=>id+100)});
// Independent short reference: explicit time boundaries, single unit effects.
function reference(v:ResidentNeedsInput){
  const s=structuredClone(v);s.residents.sort((a,b)=>a.actorId-b.actorId);s.beds.sort((a,b)=>a.actorId-b.actorId);
  const allocate=()=>{const used=new Set<number>();for(const b of s.beds){
    if(s.residents.find(r=>r.actorId===b.actorId)?.departed||b.bedId===null||!s.eligibleBeds.includes(b.bedId)||used.has(b.bedId))b.bedId=null;
    else used.add(b.bedId);
  }for(const b of s.beds)if(b.bedId===null&&!s.residents.find(r=>r.actorId===b.actorId)!.departed){
    const id=s.eligibleBeds.slice().sort((a,b)=>a-b).find(id=>!used.has(id));if(id!==undefined){b.bedId=id;used.add(id);}}};
  allocate();
  for(let t=(Math.floor(v.fromTick/1000)+1)*1000;t<=v.toTick;t+=1000){
    if(t%32000===0)for(const r of s.residents.filter(r=>r.alive&&!r.departed)){
      const stock=s.rations.filter(i=>i.quantity>0).sort((a,b)=>Number(b.lockedQuantity>0)-Number(a.lockedQuantity>0)||
        (a.lockedQuantity&&b.lockedQuantity?a.itemId-b.itemId:a.containerId-b.containerId||a.itemId-b.itemId))[0];
      if(stock){stock.quantity--;if(stock.lockedQuantity)stock.lockedQuantity--;r.foodShortage=Math.max(0,r.foodShortage-1) as 0|1|2|3;r.unfedDays=0;}
      else {if(r.foodShortage===3)r.departed=true;r.foodShortage=Math.min(3,r.foodShortage+1) as 0|1|2|3;r.unfedDays=Math.min(4,r.unfedDays+1);}
    }
    allocate();
    for(const r of s.residents.filter(r=>r.alive&&!r.departed)){
      const housed=s.beds.find(b=>b.actorId===r.actorId)!.bedId!==null;
      r.housingShortage=Math.max(0,Math.min(3,r.housingShortage+(housed?-1:1))) as 0|1|2|3;
    }
  }
  return s;
}
it('B01/B02: food3 eating recovers one; departure tests old f3 rather than unfedDays',()=>{
  const a=input(128000);expect(planResidentNeeds(a).effects).toEqual([{kind:'resident-departure',actorId:1,atTick:128000,reason:'starvation'}]);
  const b=input(64000);b.residents[0]={...initialResidentNeed(1),foodShortage:3,unfedDays:3};
  b.rations=[{containerId:1,itemId:90,quantity:1,lockedQuantity:0}];
  expect(planResidentNeeds(b).residents[0]).toMatchObject({foodShortage:3,unfedDays:1,departed:false});
  b.toTick=96000;expect(planResidentNeeds(b).effects.filter(e=>e.kind==='resident-departure')).toHaveLength(1);
});
it('B03/B04/C03: housing recovers by epochs; departure frees bed before same-time housing',()=>{
  const s=input(4500);s.eligibleBeds=[];let p=planResidentNeeds(s);expect(p.residents[0]?.housingShortage).toBe(3);
  p=planResidentNeeds({...s,fromTick:4500,toTick:7000,residents:p.residents,beds:p.beds,eligibleBeds:[101]});
  expect(p.residents[0]?.housingShortage).toBe(0);
  const c=input(32000,[10,20]);c.fromTick=31999;c.beds=[{actorId:10,bedId:100},{actorId:20,bedId:null}];c.eligibleBeds=[100];
  c.residents[0]={...initialResidentNeed(10),foodShortage:3,unfedDays:3};c.residents[1]!.housingShortage=2;
  p=planResidentNeeds(c);expect(p.beds).toEqual([{actorId:10,bedId:null},{actorId:20,bedId:100}]);
  expect(p.residents[1]).toMatchObject({foodShortage:1,housingShortage:1,unfedDays:1});
});
it('D03: actor order, locked prefixes, free container order and no split IDs',()=>{
  const s=input(32000,[9,2,7]);s.rations=[{containerId:30,itemId:90,quantity:1,lockedQuantity:1},
    {containerId:30,itemId:100,quantity:2,lockedQuantity:1},{containerId:10,itemId:1,quantity:1,lockedQuantity:0}];
  const p=planResidentNeeds(s);expect(p.effects.map(e=>e.kind==='ration-consume'?[e.actorId,e.itemId]:[])).toEqual([[2,90],[7,100],[9,1]]);
  expect(p.rations.map(i=>[i.itemId,i.quantity,i.lockedQuantity])).toEqual([[90,0,0],[100,1,0],[1,0,0]]);
});
it('matches independent short reference and split high-water for varied populations/stocks',()=>{
  for(let population=1;population<=16;population+=3)for(let days=0;days<=8;days++){
    const v=input(days*32000+1713,Array.from({length:population},(_,n)=>n+1));v.fromTick=950;
    v.residents.forEach((r,n)=>{r.foodShortage=n%4 as OfflineResidentState['foodShortage'];r.housingShortage=(n+1)%4 as OfflineResidentState['housingShortage'];});
    v.eligibleBeds=v.eligibleBeds.slice(0,Math.ceil(population/2));v.rations=[{containerId:2,itemId:80,quantity:39,lockedQuantity:2},{containerId:1,itemId:3,quantity:7,lockedQuantity:0}];
    const ref=reference(v),p=planResidentNeeds(v);expect(p.residents).toEqual(ref.residents);expect(p.rations).toEqual(ref.rations);expect(p.beds).toEqual(ref.beds);
    const middle=Math.floor((v.fromTick+v.toTick)/2),first=planResidentNeeds({...v,toTick:middle});
    const last=planResidentNeeds({...v,fromTick:middle,residents:first.residents,rations:first.rations.filter(r=>r.quantity>0),beds:first.beds});
    expect(last.residents).toEqual(p.residents);expect(last.beds).toEqual(p.beds);
    expect(first.epochCount+last.epochCount).toBe(p.epochCount);
  }
});
it('E02 and full legal 16x64 FOOD stock: long jump scales with stock chunks, not days',()=>{
  const t=performance.now();for(let camp=0;camp<4;camp++){
    const v=input(1_000_000_000,Array.from({length:16},(_,n)=>camp*16+n+1));
    v.rations=Array.from({length:16},(_,n)=>({containerId:n+1,itemId:n+1000,quantity:64,lockedQuantity:n===0?2:0}));
    const p=planResidentNeeds(v);expect(p.rations.reduce((n,r)=>n+r.quantity,0)).toBe(0);
    expect(p.residents.every(r=>r.departed)).toBe(true);
    expect(p.effects.filter(e=>e.kind==='resident-departure').every(e=>e.atTick===68*32000)).toBe(true);
    expect(p.effects.length).toBeLessThan(300);
  }expect(performance.now()-t).toBeLessThanOrEqual(50);
});

it('K1: rejects custom array prototype before inherited getters or forged uniqueness methods execute',()=>{
 const v=input(32000);let calls=0;
 const proto=Object.create(Array.prototype);Object.defineProperty(proto,'map',{get(){calls++;return Array.prototype.map;}});
 Object.setPrototypeOf(v.residents,proto);expect(()=>assertResidentNeedsInput(v)).toThrow();expect(calls).toBe(0);
 const forged=input(32000,[1,1]);forged.beds=[{actorId:1,bedId:101},{actorId:2,bedId:102}];
 const methods=Object.create(Array.prototype);Object.defineProperties(methods,{map:{value(){calls++;return [1,2];}},some:{value(){calls++;return true;}}});
 Object.setPrototypeOf(forged.residents,methods);expect(()=>planResidentNeeds(forged)).toThrow();expect(calls).toBe(0);
});

import { describe, expect, it, vi } from 'vitest';
import { createSupport } from '../module';
import { loadSupport, SUPPORTS } from '../definitions';
import { DamageResolutionAuthority } from '../../../../engine/Combat/DamageResolution';
import { createShooterArena } from '../../../../products/shooter/ShooterArena';
import type { SupportHost } from '../../../../engine/Simulation/SupportRuntime';
import type { CombatEffect } from '../../../../engine/Simulation/RangedRuntime';
import { SpatialHash } from '../../../../engine/Movement/SpatialHash';
function room() {
    let tick=0; const positions=[{x:5632,y:10752},{x:8704,y:10752},{x:15360,y:10752}];
    const damage=new DamageResolutionAuthority({schema:1,nextResolutionId:1,actors:positions.map((_,i)=>({id:i+1,team:i?1:0,hp:i?200:100,maxHp:i?200:100,revision:0}))});
    const effects:CombatEffect[]=[], clearHazards=vi.fn(), replenish=vi.fn(()=>{damage.restoreHealth(1);return true;});
    const host:SupportHost={seed:7,ownerId:1,world:{grid:createShooterArena(),bodies:new SpatialHash()},tick:()=>tick,
        health:id=>damage.read(id),body:id=>{const hp=damage.read(id);return hp?{id,team:hp.team,hp:hp.hp,pose:{...positions[id-1]!,facing:0},radius:280}:undefined;},
        bodies:()=>positions.map((_,i)=>host.body!(i+1)!),damage:intent=>{const plan=damage.prepareDamageResolution(intent);return plan&&damage.commitDamageResolution(plan);},
        emit:e=>effects.push(e),clearHazards,replenish};
    const runtime=createSupport(host);
    const step=(slot?:number,x=5632,y=10752,interact=false)=>{tick++;return runtime.advance(slot===undefined?[]:[{tick,kind:'support',slot,x,y}],interact);};
    const run=(n:number)=>{for(let i=0;i<n;i++)step();};
    return {host,runtime,step,run,damage,effects,clearHazards,replenish,positions};
}
describe('Support authoritative lifecycle',()=>{
    it('delays delivery, keeps independent cooldowns, rejects invalid landings without spending a call',()=>{
        const r=room();r.step(0);expect(r.runtime.view().deployments[0]).toMatchObject({phase:'inbound',remaining:60});
        r.step(0);expect(r.runtime.view().notice!.code).toBe('cooldown');expect((r.runtime.snapshot() as any).nextId).toBe(2);
        r.step(1,12800,9728);expect(r.runtime.view().notice!.code).toBe('blocked');expect(r.runtime.view().abilities[1]!.remaining).toBe(0);
        r.step(3,35000,10000);expect(r.runtime.view().notice!.code).toBe('range');r.run(57);
        expect(r.runtime.view().deployments[0]).toMatchObject({phase:'active',remaining:2700,charges:2});
    });
    it('uses two nearby supply interactions and consumes neither charges nor overlapping objectives when no resource changes',()=>{
        const r=room();r.step(0);r.run(60);r.replenish.mockReturnValueOnce(false);
        expect(r.step(undefined,0,0,true)).toBe(false);expect(r.runtime.view().deployments[0]!.charges).toBe(2);
        r.step(undefined,0,0,true);expect(r.runtime.view().deployments[0]!.charges).toBe(1);
        r.step(undefined,0,0,true);expect(r.runtime.view().deployments).toHaveLength(0);expect(r.runtime.view().notice!.code).toBe('supplied');
    });
    it('fires a finite turret at visible hostile targets, respects walls, and never attacks its owner',()=>{
        const r=room();r.step(1,6656,10752);r.run(90);expect(r.damage.read(2)!.hp).toBe(175);expect(r.damage.read(1)!.hp).toBe(100);
        expect(r.damage.read(3)!.hp).toBe(200);expect(r.runtime.view().deployments[0]!.charges).toBe(89);
        r.run(105);expect(r.damage.read(2)!.hp).toBe(0);expect(r.damage.read(3)!.hp).toBe(200);expect(r.effects).toHaveLength(8);
        r.run(1350);expect(r.runtime.view().deployments).toHaveLength(0);
    });
    it('warns before a blast, applies damage once with self damage and wall occlusion, and requests an environment change',()=>{
        const r=room();r.step(2,5632,10752);r.run(89);expect(r.damage.read(1)!.hp).toBe(100);expect(r.effects).toHaveLength(0);
        r.run(1);expect(r.damage.read(1)!.hp).toBe(0);expect(r.damage.read(2)!.hp).toBeLessThan(200);
        expect(r.damage.read(3)!.hp).toBe(200);expect(r.clearHazards).toHaveBeenCalledExactlyOnceWith({x:5632,y:10752},3072);
        expect(r.runtime.view().deployments).toHaveLength(0);const hp=r.damage.read(2)!.hp;r.run(10);expect(r.damage.read(2)!.hp).toBe(hp);
    });
    it('reveals hostile actors across walls only during the scan, with no damage or RNG',()=>{
        const r=room();r.step(3);expect(r.runtime.view().revealed).toEqual([]);r.run(30);expect(r.runtime.view().revealed).toEqual([2,3]);
        expect(r.damage.read(2)!.hp).toBe(200);r.run(600);expect(r.runtime.view().revealed).toEqual([]);
    });
    it('roundtrips inbound and active deployments, rejects invalid lifecycle bindings and returns detached views',()=>{
        const r=room();r.step(1);r.run(17);expect(createSupport(r.host,r.runtime.snapshot()).view()).toEqual(r.runtime.view());r.run(73);
        expect(createSupport(r.host,r.runtime.snapshot()).view()).toEqual(r.runtime.view());
        for(const mutate of [(s:any)=>s.deployments[0].arrived=false,(s:any)=>s.ready[1]++,(s:any)=>s.deployments[0].pose.x=0,(s:any)=>s.deployments[0].charges=999,(s:any)=>s.nextId=1]){
            const s=r.runtime.snapshot();mutate(s);expect(()=>createSupport(r.host,s)).toThrow();
        }
        const view=r.runtime.view();view.abilities[0]!.remaining=999;view.deployments[0]!.pose.x=0;expect(r.runtime.view().deployments[0]!.pose.x).toBe(5632);
    });
    it('validates the entire data pack and its numeric budgets',()=>{
        const good={schema:1,abilities:SUPPORTS.map(a=>({...a}))};expect(loadSupport(good)).toEqual(SUPPORTS);
        for(const mutate of [(p:any)=>p.abilities[0].cooldown=0,(p:any)=>p.abilities[2].lifetime=1,(p:any)=>p.abilities[1].interval=0,(p:any)=>p.abilities.reverse(),(p:any)=>p.abilities[0].range=Infinity]){
            const p=structuredClone(good);mutate(p);expect(()=>loadSupport(p)).toThrow();
        }
    });
});

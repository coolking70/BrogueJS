import { describe, expect, it } from 'vitest';
import { ShooterSession, replayShooter } from '../../../../products/shooter/ShooterSession';
import { idleInput } from '../../../../products/shooter/input/InputFrame';
import { InputFrameAssembler } from '../../../../products/shooter/input/InputFrameAssembler';
import { getRealtimeModules } from '../../../realtimeCatalog';
import { RealtimeSimulationDriver } from '../../../../engine/Simulation/RealtimeSimulationDriver';
const run=(s:ShooterSession,n:number)=>{for(let i=0;i<n;i++)s.advanceTick(idleInput(s.tick+1));};
const call=(s:ShooterSession,slot:number,x=5632,y=10752)=>s.advanceTick(idleInput(s.tick+1),[{tick:s.tick+1,kind:'support',slot,x,y}]);
describe('S5 product support and persistence',()=>{
    it('plays support alone, with the empty set, and all installed realtime subsets',()=>{
        const ids=getRealtimeModules().map(d=>d.id),sets=ids.reduce<string[][]>((sets,id)=>[...sets,...sets.map(s=>[...s,id])],[[]]);
        expect(sets).toHaveLength(2**ids.length);
        for(const modules of sets){const s=new ShooterSession(7,{modules});
            if(modules.includes('support'))call(s,3);else run(s,1);
            run(s,40);expect(ShooterSession.fromSnapshot(s.snapshot()).snapshot()).toEqual(s.snapshot());expect(replayShooter(s.exportReplay()).snapshot()).toEqual(s.snapshot());
        }
    });
    it('clears fire/gas in the authoritative Grid, persists contacts, and rejects foreign hazard edits',()=>{
        const s=new ShooterSession(7,{modules:['support']});
        call(s,2,16896,11264);run(s,90);const saved=s.snapshot();expect(saved.clearedHazards).toHaveLength(9);
        expect(saved.support!.deployments).toHaveLength(0);expect(ShooterSession.fromSnapshot(saved).snapshot()).toEqual(saved);expect(replayShooter(s.exportReplay()).snapshot()).toEqual(saved);
        for(const mutate of [(v:any)=>v.clearedHazards.push({x:1,y:1}),(v:any)=>v.clearedHazards.push({...v.clearedHazards[0]}),(v:any)=>v.support.abilities[0].remaining++]){
            const v=structuredClone(saved);mutate(v);expect(()=>ShooterSession.fromSnapshot(v)).toThrow();
        }
    });
    it('refills magazines and safely cancels a running reload through an optional ranged provider',()=>{
        const ranged=getRealtimeModules().find(d=>d.kind==='ranged');if(!ranged)return;
        const s=new ShooterSession(7,{modules:['support',ranged.id]});call(s,0);run(s,59);
        s.advanceTick({...idleInput(s.tick+1),buttons:1});run(s,8);s.advanceTick(idleInput(s.tick+1),[{tick:s.tick+1,kind:'reload'}]);
        expect(s.snapshot().ranged!.reloadRemaining).toBeGreaterThan(0);
        s.advanceTick(idleInput(s.tick+1),[{tick:s.tick+1,kind:'interact'}]);const saved=s.snapshot();
        expect(saved.ranged!.reloadRemaining).toBe(0);expect(saved.ranged!.weapons.every(w=>w.ammo===w.capacity)).toBe(true);
        expect(saved.support!.deployments[0]!.charges).toBe(1);expect(ShooterSession.fromSnapshot(saved).snapshot()).toEqual(saved);expect(replayShooter(s.exportReplay()).snapshot()).toEqual(saved);
    });
    it.each([30,60,144])('produces exact support and environment state at %i render FPS',fps=>{
        const s=new ShooterSession(7,{modules:['support']}), driver=new RealtimeSimulationDriver({id:'s5',ticksPerSecond:30},()=>{
            const tick=s.tick+1;s.advanceTick(idleInput(tick),tick===1?[{tick,kind:'support',slot:2,x:16896,y:11264},{tick,kind:'support',slot:3,x:5632,y:10752}]:[]);
        });driver.pump(0);let peak=0;for(let f=1;f<=5*fps;f++)peak=Math.max(peak,driver.pump(Math.round(f*1e6/fps)).backlogTicks);
        expect(s.tick).toBe(150);expect(peak).toBe(0);expect(replayShooter(s.exportReplay()).snapshot()).toEqual(s.snapshot());expect(s.snapshot().clearedHazards).toHaveLength(9);
        const headless=new ShooterSession(7,{modules:['support']});headless.advanceTick(idleInput(1),[{tick:1,kind:'support',slot:2,x:16896,y:11264},{tick:1,kind:'support',slot:3,x:5632,y:10752}]);run(headless,149);
        expect(s.snapshot()).toEqual(headless.snapshot());
    });
    it('rejects malformed or unsupported commands before mutation and incompatible S4 saves',()=>{
        const s=new ShooterSession(7,{modules:[]}),before=s.snapshot();
        expect(()=>call(s,0)).toThrow('support');expect(s.snapshot()).toEqual(before);
        const active=new ShooterSession(7,{modules:['support']}), good=active.snapshot();
        for(const c of [{tick:1,kind:'support',slot:4,x:1,y:1},{tick:1,kind:'support',slot:0,x:NaN,y:1},{tick:2,kind:'support',slot:0,x:1,y:1}])
            expect(()=>active.advanceTick(idleInput(1),[c as any])).toThrow();
        expect(active.snapshot()).toEqual(good);
        expect(()=>ShooterSession.fromSnapshot({...good,format:'broguejs-shooter-s4',version:5})).toThrow();
        expect(()=>ShooterSession.fromSnapshot(good,getRealtimeModules().filter(d=>d.id!=='support'))).toThrow('Missing');
    });
    it('records and clears target confirmations through the same input boundary',()=>{
        const input=new InputFrameAssembler();input.requestSupport(2,16896,11264);expect(input.nextCommands(1)).toEqual([{tick:1,kind:'support',slot:2,x:16896,y:11264}]);
        input.requestSupport(0,5632,10752);input.clear();expect(input.nextCommands(2)).toEqual([]);
    });
});

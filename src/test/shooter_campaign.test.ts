import type { RangedDescriptor, RangedHost } from '../engine/Simulation/RangedRuntime';
import {describe,it,expect} from 'vitest';
import {CampaignSession} from '../products/shooter/CampaignSession';
import {getStrategicModules,getRealtimeModules} from '../ext/realtimeCatalog';
import {ShooterSession,replayShooter,canonicalState} from '../products/shooter/ShooterSession';
const frame=(tick:number)=>({tick,moveX:0,moveY:0,aimAngle:0,buttons:0});
describe('S6 strategy composition and independent mechanical replay',()=>{
    it('all installed strategic subsets restore exactly and missing manifests reject',()=>{const descriptors=getStrategicModules();const sets=descriptors.reduce((sets,d)=>[...sets,...sets.map(s=>[...s,d])],[[]] as typeof descriptors[]);
        for(const installed of sets){const c=new CampaignSession(installed);expect(new CampaignSession(installed,c.snapshot()).snapshot()).toEqual(c.snapshot());if(installed.length)expect(()=>new CampaignSession([],c.snapshot())).toThrow();}
    });
    it('rolls back strategic transactions and freezes loadout during a deployed ticket',()=>{const c=new CampaignSession();if(!c.view().operation){expect(()=>c.execute({kind:'start',region:0,difficulty:0})).toThrow('Operations unavailable');return;}if(c.view().meta){expect(()=>c.execute({kind:'start',region:0,difficulty:1})).toThrow();expect(c.view().operation!.status).toBe('idle');}
        c.execute({kind:'start',region:0,difficulty:0});const sortie=c.deploy();if(c.view().meta)expect(()=>c.execute({kind:'purchase',type:'weapon',slot:2})).toThrow();expect(c.view().operation!.ticket).toEqual(sortie.ticket);
    });
    it('keeps battle setup immutable, denies absent weapons/support, replays with no strategic account',()=>{const ids=getRealtimeModules().map(d=>d.id);const setup={variant:1,difficulty:1,weapons:[0,1],support:[1,-1,-1,0]};const s=new ShooterSession(7,{modules:ids,setup});setup.weapons[0]=3;
        for(let tick=1;tick<=10;tick++)s.advanceTick(frame(tick),ids.includes('firearms')&&tick===1?[{tick,kind:'equip',slot:2}]:ids.includes('support')&&tick===2?[{tick,kind:'support',slot:1,x:s.snapshot().actors[0]!.pose.x,y:s.snapshot().actors[0]!.pose.y}]:[]);
        const p=s.snapshot();expect(p.setup!.weapons).toEqual([0,1]);if(p.ranged){expect(p.ranged.weapons.map(w=>w.slot)).toEqual([0,1]);expect(p.ranged.weapons.find(w=>w.selected)!.slot).toBe(0);}
        if(p.support){expect(p.support.abilities.map(a=>a.slot)).toEqual([0,3]);expect(p.support.abilities[0]!.cooldown).toBe(2295);expect(p.support.deployments.length).toBe(0);}
        expect(canonicalState(ShooterSession.fromSnapshot(p).snapshot())).toBe(canonicalState(p));expect(canonicalState(replayShooter(s.exportReplay()).snapshot())).toBe(canonicalState(p));
    });
    it('module reads cannot mutate or alias the frozen deployment configuration',()=>{
        let captured:RangedHost|null=null;
        const descriptor:RangedDescriptor={id:'fixture-reader',runtime:'realtime',kind:'ranged',foundation:4,version:'1.0.0',rules:{schema:1,version:'1.0.0',fingerprint:'sha256:'+ '0'.repeat(64)},labelKey:'fixture',uiKeys:[],locales:{},
            create(host){captured=host;return {advance(){},snapshot(){return {};},view(){return {weapons:[],reloadRemaining:0,reloadTotal:0,cooldownRemaining:0,recoil:0,shots:0,projectiles:[]};}};}};
        const setup={variant:1,difficulty:0,weapons:[0,1],support:[0,-1,-1,0]},s=new ShooterSession(1,{installed:[descriptor],setup});
        const equipment=(captured! as RangedHost).equipment!;
        expect(Reflect.set(equipment,'variant',2)).toBe(false);expect(equipment.variant).toBe(1);
        expect(()=>Array.prototype.pop.call(equipment.weapons)).toThrow();expect(()=>Array.prototype.fill.call(equipment.support,2)).toThrow();
        setup.weapons.pop();expect(s.snapshot().setup!.weapons).toEqual([0,1]);expect(s.snapshot().setup!.support).toEqual([0,-1,-1,0]);
        s.advanceTick(frame(1));expect(canonicalState(ShooterSession.fromSnapshot(s.snapshot(),[descriptor]).snapshot())).toBe(canonicalState(s.snapshot()));
    });
    it('rejects malformed setup and prior S5 snapshots',()=>{expect(()=>new ShooterSession(1,{setup:{variant:3,difficulty:0,weapons:[0],support:[0,0,0,0]}})).toThrow();const s=new ShooterSession().snapshot();expect(()=>ShooterSession.fromSnapshot({...s,format:'broguejs-shooter-s5',version:6})).toThrow();});
});

import {describe,it,expect} from 'vitest';
import {createMeta} from '../module';
const grant=(id:string,completed=false)=>({id,credits:500,samples:8,completed,difficulty:0});
describe('account resources, unlocks and frozen loadout',()=>{
    it('spends once, guards funds, grants once and unlocks next difficulty on operation completion',()=>{const m=createMeta();m.purchase('weapon',2);expect(m.view().credits).toBe(20);expect(()=>m.purchase('weapon',2)).toThrow();expect(()=>m.purchase('support',1)).toThrow();
        m.grant(grant('operation-1-0'));m.grant(grant('operation-1-0'));expect(m.view().credits).toBe(520);expect(m.view().difficulty).toBe(0);m.grant(grant('operation-1-2',true));expect(m.view().difficulty).toBe(1);expect(m.view().completed).toBe(1);
        expect(createMeta(m.snapshot()).view()).toEqual(m.view());});
    it('supports unlock then two upgrades and snapshots immutable effective setup',()=>{const m=createMeta();m.grant(grant('operation-1-0'));m.purchase('support',1);m.purchase('support',1);m.purchase('support',1);expect(m.view().support[1]).toBe(2);expect(()=>m.purchase('support',1)).toThrow();
        m.purchase('weapon',2);m.equip([0,2]);const setup=m.setup({id:'operation-1-1',seed:1,variant:2,difficulty:0});m.equip([0,1]);expect(setup.weapons).toEqual([0,2]);expect(setup.support).toEqual([0,2,-1,0]);});
    it('rejects duplicate slots, locked weapons, tampered account state and malformed grants',()=>{const m=createMeta();expect(()=>m.equip([0,0])).toThrow();expect(()=>m.equip([0,3])).toThrow();for(const mutate of [(v:any)=>v.credits=-1,(v:any)=>v.support[1]=3,(v:any)=>v.equipped=[0,3],(v:any)=>v.claimed=['x'],(v:any)=>v.completed=1]){const v=m.snapshot();mutate(v);expect(()=>createMeta(v)).toThrow();}
        expect(()=>m.grant({...grant('operation-1-0'),credits:Infinity})).toThrow();expect(m.view().credits).toBe(100);});
});

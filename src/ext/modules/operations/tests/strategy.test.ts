import {describe,it,expect} from 'vitest';
import {createOperations} from '../module';
const reward={credits:100,samples:4,optional:true,killBonus:0};
describe('operation cursor and exactly once settlement',()=>{
    it('three independent seeded missions finish one operation with a single bonus',()=>{const op=createOperations();op.start(1,0);const seeds=new Set<number>(),variants=new Set<number>();
        for(let i=0;i<3;i++){const t=op.deploy();seeds.add(t.seed);variants.add(t.variant);expect(op.view().index).toBe(i);expect(()=>op.deploy()).toThrow();
            const restored=createOperations(op.snapshot());expect(restored.view()).toEqual(op.view());const result=op.settle(t,'success',reward);expect(result.credits).toBe(i===2?250:100);expect(result.samples).toBe(i===2?7:4);expect(result.completed).toBe(i===2);expect(()=>op.settle(t,'success',reward)).toThrow();}
        expect(seeds.size).toBe(3);expect(variants.size).toBe(3);expect(op.view().status).toBe('complete');op.start(2,1);expect(op.view().serial).toBe(2);
    });
    it('rejects stale tickets and active replacement, failure closes the remaining chain',()=>{const op=createOperations();op.start(0,2);const t=op.deploy();expect(()=>op.start(1,0)).toThrow();expect(()=>op.settle({...t,seed:t.seed+1},'success',reward)).toThrow();expect(op.view().ticket).toEqual(t);
        expect(op.settle(t,'failed',null).credits).toBe(0);expect(op.view().status).toBe('failed');expect(()=>op.deploy()).toThrow();});
    it('rejects invalid restored cursors and mismatched terminal rewards',()=>{const op=createOperations();op.start(0,0);const t=op.deploy();for(const mutate of [(v:any)=>v.index=3,(v:any)=>v.ticket.id='other',(v:any)=>v.serial=0,(v:any)=>v.difficulty=NaN]){const v=op.snapshot();mutate(v);expect(()=>createOperations(v)).toThrow();}
        expect(()=>op.settle(t,'success',null)).toThrow();expect(()=>op.settle(t,'failed',reward)).toThrow();expect(op.view().ticket).toEqual(t);});
    it('returns detached state and tickets',()=>{const op=createOperations();op.start(0,0);const t=op.deploy();t.variant=2;expect(op.view().ticket!.variant).toBe(0);});
});

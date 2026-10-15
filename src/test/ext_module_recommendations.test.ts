import {expect,it} from 'vitest';
import {resolveModuleRecommendations,selectModule} from '../ext/selection';
import {FOUNDATION_PROTOCOL,type ModuleDescriptor,registryFromDescriptors} from '../ext/descriptor';
import {isJson} from '../ext/json';
const descriptor=(id:string,recommends:string[]=[]):ModuleDescriptor=>({id,recommends,version:'1.0.0',foundation:FOUNDATION_PROTOCOL,labelKey:`ext.${id}.name`,create:()=>({id,version:'1.0.0',initialState:()=>({}),validateState:isJson})});
it('offers on enable, remembers explicit refusal, restores and never changes exact manifests',()=>{
 const ds=[descriptor('source',['target']),descriptor('target')];
 let draft=resolveModuleRecommendations(ds,['target']);draft=selectModule(ds,draft,'target',false);
 draft=selectModule(ds,draft,'source',true);expect(draft.selected).toEqual(['source','target']);expect(draft.reasons.target).toEqual(['source']);
 draft=selectModule(ds,draft,'target',false);expect(draft.selected).toEqual(['source']);
 draft=selectModule(ds,selectModule(ds,draft,'source',false),'source',true);expect(draft.selected).toEqual(['source']);
 draft=resolveModuleRecommendations(ds,draft.selected);expect(draft.selected).toEqual(['source','target']);
 expect(selectModule(ds,draft,'source',false).selected).toEqual(['target']);
 expect(registryFromDescriptors(ds).manifest(['source']).modules.map(m=>m.id)).toEqual(['source']);
});
it('handles duplicate/cyclic recommendations, missing packages and no-source defaults',()=>{
 const ds=[descriptor('first',['second','second','missing']),descriptor('second',['first'])];
 expect(resolveModuleRecommendations(ds,['first'])).toMatchObject({selected:['first','second'],missing:['missing']});
 expect(resolveModuleRecommendations(ds,[]).selected).toEqual([]);
 expect(resolveModuleRecommendations([descriptor('source',['missing'])],['source']).selected).toEqual(['source']);
});

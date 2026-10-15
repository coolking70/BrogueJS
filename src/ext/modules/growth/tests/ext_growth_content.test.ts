import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../../../../engine/Input',()=>({inputManager:{}}));
import {descriptor} from '../descriptor';
import {FOUNDATION_PROTOCOL,registryFromDescriptors,type ModuleDescriptor} from '../../../descriptor';
import {extensionDataFingerprint} from '../../../fingerprint';
import {isJson} from '../../../json';
import type {Json} from '../../../types';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {prepareModuleCreation} from '../../../ui/creation';
import {readGrowthCharacterView} from '../view';
import {growthTrees} from '../content';
import type {GrowthPack} from '../attributes';
import data from '../data/definitions.json';
import {createSSRApp} from 'vue';
import {renderToString} from 'vue/server-renderer';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import GrowthCreationPanel from '../ui/GrowthCreationPanel.vue';
import GrowthCharacterPanel from '../ui/GrowthCharacterPanel.vue';
import {createGrowthCreationDraft,readGrowthCreationView} from '../view';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>handles.splice(0).forEach(h=>h.dispose()));
function contribution(change?:(value:any)=>void):ModuleDescriptor {
 const profession={...structuredClone(data.definitions.find(d=>d.id==='growth.profession.scout')!),id:'b3fixture.profession.test',nameKey:'ext.b3fixture.profession.name',descriptionKey:'ext.b3fixture.profession.description',gifts:[{skillId:'growth.skill.measured-strike',waivePrerequisites:true}]};
 const content={professions:[profession],trees:[{id:'b3fixture.tree.test',nameKey:'ext.b3fixture.tree.name',descriptionKey:'ext.b3fixture.tree.description',professionIds:[profession.id],nodes:[{id:'b3fixture.node.root',skillId:'growth.skill.measured-strike',requires:[]},{id:'b3fixture.node.next',skillId:'growth.skill.steady-hand',requires:['b3fixture.node.root']}]}],attributeRules:[{id:'b3fixture.rule.test',attributeId:'growth.attribute.agility',effect:{kind:'modifier',port:'maxHpBonus',operation:'add',slot:null,magnitude:{source:{kind:'attribute',attributeId:'growth.attribute.agility'},coefficient:1,divisor:1,rounding:'floor',min:0,max:8},conditions:[]}}]};
 change?.(content);
 return {id:'b3fixture',version:'1.0.0',foundation:FOUNDATION_PROTOCOL,labelKey:'ext.b3fixture.name',locales:{zh_CN:{'ext.b3fixture.name':'测试贡献','ext.b3fixture.profession.name':'测试职业','ext.b3fixture.profession.description':'测试职业说明','ext.b3fixture.tree.name':'测试树','ext.b3fixture.tree.description':'测试树说明'}},
 content:[{schema:1,owner:'b3fixture',target:'growth',version:'1.0.0',data:content as unknown as Json,fingerprint:extensionDataFingerprint(content)}],create:()=>({id:'b3fixture',version:'1.0.0',initialState:()=>({}),validateState:isJson})};
}
it('assembles before creation/capabilities, drives generic creation/read/learn/source and survives save/load',async()=>{
 const c=contribution(),registry=registryFromDescriptors([c,descriptor]);
 const manifest=registry.manifest(['growth','b3fixture']),modules=registry.create(manifest),m=modules.find(m=>m.id==='growth')!;
 const pack=m.view!.definitions as unknown as GrowthPack;
 expect(growthTrees(pack)).toHaveLength(1);expect(pack.definitions.some(d=>d.id==='b3fixture.profession.test')).toBe(true);
 expect(prepareModuleCreation(['growth','b3fixture'],[],registry).modules.find(m=>m.id==='growth')!.rules).toEqual(m.rules);
 expect(registryFromDescriptors([descriptor,c]).manifest(['b3fixture','growth'])).toEqual(manifest);
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','b3fixture']},[c]);handles.push(h);const g=worldHarnessGame(h);
 g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['growth','b3fixture'],initialCommands:[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0,professionId:'b3fixture.profession.test',lineageId:'growth.lineage.stoneborn',faithId:'growth.faith.unaffiliated',choices:[]}})]});g.animationEnabled=false;
 const r=g.extensionRuntime!,p=g.player;
 expect(r.stats.value(p.id,'growth.attribute:growth.attribute.agility')).toBe(2);
 expect(r.stats.breakdown(p.id,'native.max-hp').rows.some(row=>row.owner==='growth'&&row.value===5)).toBe(true);
 expect(readGrowthCharacterView(g)!.trees?.[0]!.nodes[0]!.learned).toBe(true);
 // Controlled first-visit reward fixture through the existing lifecycle hook.
 r.emit('enteredLevel',{depth:10,firstVisit:true,actorIds:[p.id]});
 r.emit('simulationSettled',{knownKinds:[],reachableIds:[p.id,...g.monsters.map(m=>m.id)],sourceIds:[]});
 const before=readGrowthCharacterView(g)!;expect(before.skillPoints).toBeGreaterThan(0);
 g.executeCommand('ext:command',JSON.stringify({module:'growth',action:'learn-skill',payload:{revision:before.revision,skillId:'growth.skill.steady-hand'}}));
 expect(readGrowthCharacterView(g)!.skills.find(s=>s.id==='growth.skill.steady-hand')!.learned).toBe(true);
 const saved=g.toSaveSnapshot();expect(g.loadSnapshot(saved)).toBe(true);expect(readGrowthCharacterView(g)!.trees?.[0]!.nodes[1]!.learned).toBe(true);
 const translation=i18next.createInstance();await translation.init({lng:'zh_CN',fallbackLng:false,resources:{zh_CN:{translation:{...descriptor.locales!.zh_CN,...c.locales!.zh_CN}}},initImmediate:false});
 const creation=createSSRApp(GrowthCreationPanel,{model:readGrowthCreationView(pack,createGrowthCreationDraft(pack)),submitting:false,error:null});creation.use(I18NextVue,{i18next:translation});
 const creationHtml:{teleports?:Record<string,string>}={};await renderToString(creation,creationHtml);expect(creationHtml.teleports?.body).toContain('测试职业');
 const character=createSSRApp(GrowthCharacterPanel,{model:readGrowthCharacterView(g)!,submitting:false,error:null,notice:null,initialTab:'skills'});character.use(I18NextVue,{i18next:translation});
 const characterHtml:{teleports?:Record<string,string>}={};await renderToString(character,characterHtml);expect(characterHtml.teleports?.body).toContain('测试树');
});
it.each([
 ['duplicate',(d:any):void=>{d.professions.push(d.professions[0]);}],
 ['owner',(d:any):void=>{d.professions[0].id='growth.profession.forged';}],
 ['reference',(d:any):void=>{d.professions[0].gifts[0].skillId='missing.skill';}],
 ['cycle',(d:any):void=>{d.trees[0].nodes[0].requires=['b3fixture.node.next'];}],
 ['dangling',(d:any):void=>{d.trees[0].nodes[1].requires=['missing.node'];}],
 ['port',(d:any):void=>{d.attributeRules[0].effect.port='growth.attribute:growth.attribute.agility';}],
 ['budget',(d:any):void=>{d.professions[0].attributes[0].amount=99;}],
 ['effect-budget',(d:any):void=>{d.professions[0].effects=Array.from({length:17},()=>structuredClone(d.attributeRules[0].effect));}],
 ['unknown-field',(d:any):void=>{d.script='eval';}],
] as const)('rejects %s before creating a runtime',(_name,change)=>{
 const registry=registryFromDescriptors([descriptor,contribution(change)]);expect(()=>registry.create(registry.manifest(['growth','b3fixture']))).toThrow();
});
it('rejects missing receiver, changed same-version catalog and invalid fingerprint; empty production remains identical',()=>{
 const c=contribution(),registry=registryFromDescriptors([descriptor,c]);expect(()=>registry.manifest(['b3fixture'])).toThrow('Missing content target');
 expect(registry.manifest(['growth']).modules[0]!.rules).toEqual(descriptor.rules);
 const before=registry.manifest(['growth','b3fixture']);const changed=registryFromDescriptors([descriptor,contribution(d=>d.attributeRules[0].effect.magnitude.coefficient=2)]);
 expect(()=>changed.validateManifest(before)).toThrow();
 expect(()=>registryFromDescriptors([{...c,content:[{...c.content![0]!,fingerprint:'sha256:'+'0'.repeat(64)}]}])).toThrow();
});

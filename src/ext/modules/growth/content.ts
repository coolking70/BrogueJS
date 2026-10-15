import type { ContentContribution } from '../../content';
import type { GrowthPack } from './attributes';
import type { GrowthDefinitionPack, GrowthIdentity, GrowthModifier } from './types';
import { parseGrowthDefinitionPack } from './definitions';
import { validId } from '../../json';

export interface GrowthTree {
  readonly id:string; readonly nameKey:string; readonly descriptionKey:string;
  readonly professionIds:readonly string[];
  readonly nodes:readonly {readonly id:string;readonly skillId:string;readonly requires:readonly string[]}[];
}
export interface GrowthContent {
  readonly professions:readonly GrowthIdentity[];
  readonly trees:readonly GrowthTree[];
  readonly attributeRules:readonly {readonly id:string;readonly attributeId:string;readonly effect:GrowthModifier}[];
}
export function growthTrees(pack:GrowthPack):readonly GrowthTree[] {
  return (pack as GrowthPack & {registeredTrees?:readonly GrowthTree[]}).registeredTrees??[];
}
export function growthTreeAllows(pack:GrowthPack, skillId:string, learned:readonly string[], professionId:string|null):boolean {
  return growthTrees(pack).every(tree=>{
    const node=tree.nodes.find(n=>n.skillId===skillId);
    if(!node)return true;
    return (!tree.professionIds.length||!!professionId&&tree.professionIds.includes(professionId))
      &&node.requires.every(id=>learned.includes(tree.nodes.find(n=>n.id===id)!.skillId));
  });
}
/** Contributions cannot replace any definition. Rules use the existing finite vocabulary. */
export function assembleGrowthContent(base:GrowthPack, contributions:readonly ContentContribution[], textKeys:readonly string[]):GrowthPack {
  const pack=structuredClone(base) as GrowthDefinitionPack,trees:GrowthTree[]=[],ids=new Set(pack.definitions.map(d=>d.id));
  const owned=(id:string,owner:string)=>{if(!validId(id)||!id.startsWith(`${owner}.`)||ids.has(id))throw new Error('Invalid content ID');ids.add(id);};
  const text=(key:string,owner:string)=>{if(typeof key!=='string'||!key.startsWith(`ext.${owner}.`)||!textKeys.includes(key))throw new Error('Invalid content text');};
  for(const c of [...contributions].sort((a,b)=>a.owner<b.owner?-1:1)){
    const data=c.data as unknown as GrowthContent;
    if(!data||Object.keys(data).sort().join(',')!=='attributeRules,professions,trees'||![data.professions,data.trees,data.attributeRules].every(Array.isArray)||data.professions.length>16||data.trees.length>8||data.attributeRules.length>32)throw new Error('Invalid growth content');
    for(const p of data.professions){if(!Array.isArray(p.effects)||!Array.isArray(p.oaths)||p.effects.length+p.oaths.reduce((n,o)=>n+(Array.isArray(o.effects)?o.effects.length:17),0)>16)throw new Error('Profession effect budget');owned(p.id,c.owner);const nested=(v:unknown):void=>{if(v&&typeof v==='object')for(const [key,value] of Object.entries(v)){if(key==='id')owned(value as string,c.owner);else if(key.endsWith('Key'))text(value as string,c.owner);else nested(value);}};nested(p.effects);nested(p.oaths);if(p.kind!=='profession')throw new Error('Invalid content profession');text(p.nameKey,c.owner);text(p.descriptionKey,c.owner);pack.definitions.push(structuredClone(p));}
    for(const rule of data.attributeRules){
      if(Object.keys(rule).sort().join(',')!=='attributeId,effect,id')throw new Error('Invalid attribute rule');
      owned(rule.id,c.owner);
      const attribute=pack.config.attributes.find(a=>a.id===rule.attributeId);
      if(!attribute||rule.effect.kind!=='modifier')throw new Error('Invalid attribute rule reference');
      attribute.effects.push(structuredClone(rule.effect));
    }
    for(const tree of data.trees){
      if(Object.keys(tree).sort().join(',')!=='descriptionKey,id,nameKey,nodes,professionIds'||!Array.isArray(tree.nodes)||!Array.isArray(tree.professionIds)||tree.nodes.length>64||tree.professionIds.length>32||new Set(tree.professionIds).size!==tree.professionIds.length)throw new Error('Invalid content tree');
      owned(tree.id,c.owner);text(tree.nameKey,c.owner);text(tree.descriptionKey,c.owner);
      for(const n of tree.nodes){
        if(Object.keys(n).sort().join(',')!=='id,requires,skillId'||!Array.isArray(n.requires)||n.requires.length>16||new Set(n.requires).size!==n.requires.length)throw new Error('Invalid content node');
        owned(n.id,c.owner);
      }
      trees.push(structuredClone(tree));
    }
  }
  if(trees.length>16||trees.reduce((n,t)=>n+t.nodes.length,0)>128||pack.definitions.length>88||pack.config.attributes.reduce((n,a)=>n+a.effects.length,0)>64)throw new Error('Growth content total budget');
  const skills=new Set(pack.definitions.filter(d=>d.kind==='skill').map(d=>d.id)),used=new Set<string>();
  for(const tree of trees){
    if(tree.professionIds.some(id=>!pack.definitions.some(d=>d.kind==='profession'&&d.id===id)))throw new Error('Invalid tree profession');
    const visiting=new Set<string>(),done=new Set<string>();
    const visit=(id:string):void=>{
      if(visiting.has(id))throw new Error('Cyclic content tree');if(done.has(id))return;
      const node=tree.nodes.find(n=>n.id===id);if(!node||!skills.has(node.skillId))throw new Error('Missing content skill/node');
      visiting.add(id);node.requires.forEach(visit);visiting.delete(id);done.add(id);
    };
    for(const node of tree.nodes){if(used.has(node.skillId))throw new Error('Duplicate tree skill');used.add(node.skillId);visit(node.id);}
  }
  const edges=new Map(pack.definitions.filter(d=>d.kind==='skill').map(d=>[d.id,d.prerequisites.filter(p=>p.kind==='skill').map(p=>p.skillId)]));
  for(const tree of trees)for(const node of tree.nodes)edges.get(node.skillId)!.push(...node.requires.map(id=>tree.nodes.find(n=>n.id===id)!.skillId));
  const active=new Set<string>(),complete=new Set<string>();
  const visit=(id:string):void=>{if(active.has(id))throw new Error('Cyclic learning prerequisites');if(complete.has(id))return;active.add(id);for(const dep of edges.get(id)??[])visit(dep);active.delete(id);complete.add(id);};
  for(const id of edges.keys())visit(id);
  const owners=['growth',...contributions.map(c=>c.owner)];
  const parsed=parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,textOwners:owners,hasText:key=>textKeys.includes(key)});
  const freeze=<T>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  return freeze({...parsed,registeredTrees:trees});
}

import type { ReadonlyJson } from '../../ext/types';
import type { ItemLocation } from './ItemExtensionBindings';
/** Defense in depth after the owner's trusted projection. Floor facts contain
 * only the public rarity; unknown rows cannot smuggle their mechanical identity. */
export function redactItemProjection(value:ReadonlyJson,location:ItemLocation,known:boolean,unknownRing:boolean):ReadonlyJson {
  if(location==='floor'){
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const rarity=(value as Readonly<Record<string,ReadonlyJson>>).rarity;
    return typeof rarity==='string'||typeof rarity==='number'?{rarity}:{};
  }
  const visit=(v:ReadonlyJson,revealed:boolean):ReadonlyJson=>{
    if(!v||typeof v!=='object')return v;
    if(Array.isArray(v))return v.map(x=>visit(x,revealed));
    const record=v as Readonly<Record<string,ReadonlyJson>>,rowKnown=revealed||record.known===true;
    return Object.fromEntries(Object.entries(record).filter(([key])=>key!=='isCursed'&&(!unknownRing||key!=='baseId')
      &&(rowKnown||!['id','tier','values','sourceId','itemLevel','affixCount','uniqueName','randomName'].includes(key))).map(([key,child])=>[key,visit(child,rowKnown)]));
  };
  return visit(value,known);
}

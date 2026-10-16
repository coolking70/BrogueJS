import type { ReadonlyJson } from '../../ext/types';
import type { ItemLocation } from './ItemExtensionBindings';
/** Defense in depth after the owner's trusted projection. Floor facts contain
 * only public rarity and bounded socket count/sequence; base secrets stay hidden. */
export function redactItemProjection(value:ReadonlyJson,location:ItemLocation,known:boolean,unknownRing:boolean):ReadonlyJson {
  if(location==='floor'){
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const record=value as Readonly<Record<string,ReadonlyJson>>,rarity=record.rarity;
    const result:Record<string,ReadonlyJson>=typeof rarity==='string'||typeof rarity==='number'?{rarity}:{};
    const sockets=record.sockets;
    if(sockets&&typeof sockets==='object'&&!Array.isArray(sockets)){
      const {count,sequence}=sockets as Readonly<Record<string,ReadonlyJson>>;
      if(typeof count==='number'&&Number.isSafeInteger(count)&&count>=0&&count<=4
        &&Array.isArray(sequence)&&sequence.length<=count
        &&sequence.every(id=>typeof id==='string'&&id.length<=128&&/^[a-z][a-z0-9_.-]*$/.test(id)))
        result.sockets={count,sequence:[...sequence]};
    }
    return result;
  }
  const visit=(v:ReadonlyJson,revealed:boolean):ReadonlyJson=>{
    if(!v||typeof v!=='object')return v;
    if(Array.isArray(v))return v.map(x=>visit(x,revealed));
    const record=v as Readonly<Record<string,ReadonlyJson>>,rowKnown=revealed||record.known===true;
    return Object.fromEntries(Object.entries(record).filter(([key])=>key!=='isCursed'&&(!unknownRing||key!=='baseId'||record[key]===null)
      &&(rowKnown||!['id','tier','values','sourceId','itemLevel','uniqueName','randomName'].includes(key))).map(([key,child])=>[key,key==='ilvl'&&!rowKnown?null:visit(child,rowKnown)]));
  };
  return visit(value,known);
}

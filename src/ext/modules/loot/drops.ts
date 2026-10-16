import type { DropProvider } from '../../itemSdk';
import { rollLoot } from './generator';
import { familiarityThresholds } from './economy';
import type { EffectiveLootCatalog, LootRollRequest } from './types';
import { stateOf } from './session';
export function lootDrops(catalog: () => EffectiveLootCatalog): DropProvider {
  const uniques = catalog().pack.uniques.uniques.map(u => u.id), pieces=catalog().pieceIds;
  const masks=(ids:readonly string[])=>{
    let uniqueMask=0,setMask=0n;
    for(const id of ids){const u=uniques.indexOf(id),p=pieces.indexOf(id);if(u>=0)uniqueMask|=1<<u;else if(p>=0)setMask|=1n<<BigInt(p);else throw new Error('Unknown loot receipt');}
    return {uniqueMask,setMask:setMask.toString(16).padStart(32,'0')};
  };
  return { validateReceipts:(state,ids,watermark)=>{const s=stateOf(state);const expected=masks(ids);return s.uniqueMask===expected.uniqueMask&&s.setMask===expected.setMask&&s.watermark===watermark;}, sources: ['floor','vault','kill','encounter'], statKeys: ['loot.rarity-find'], uniqueCatalog: [...uniques,...pieces],
    roll(event, context) {
      // Even an explicitly empty qualifier list denotes native machine semantics.
      if (event.source === 'vault' && event.qualifiers !== undefined) return {v:1,converted:false,items:[],gold:0,uniqueIds:[]};
      const s = stateOf(context.state), common = {v:1 as const, depth:event.level.depth, presetId:s.presetId,
        rarityFindBp:context.stat(event.playerId,'loot.rarity-find'), claimedUniqueIds:[...uniques.filter((_,i) => (s.uniqueMask & (1 << i)) !== 0),...pieces.filter((_,i)=>(BigInt('0x'+s.setMask)&(1n<<BigInt(i)))!==0n)]};
      const request: LootRollRequest = event.source === 'kill' ? {...common,source:'kill',monster:event.monster}
        : event.source === 'encounter' ? {...common,source:'encounter',formId:event.formId}
        : event.source === 'floor' ? {...common,source:'floor',itemClass:event.itemClass}
        : {...common,source:'vault',itemClass:event.itemClass,baseId:event.baseId,highValue:event.highValue};
      const result = rollLoot(catalog(),request,{randomInt:(lo,hi)=>context.randomInt(lo,hi),beginItem:index=>{if(index>0)context.beginItem(index);}});
      const preset = catalog().pack.presets.presets.find(p=>p.id===s.presetId)!;
      return {v:1,converted:result.converted,gold:result.gold,uniqueIds:result.items.map(i=>i.data.uniqueId??i.data.pieceId),items:result.items.map(item=>{
        const f=familiarityThresholds(item.data,preset),n=item.native;
        return {native:{...(item.data.targetClass?{targetClass:item.data.targetClass}:{}),kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,
          familiarityRemaining:n.category==='weapon'?f.weaponKills:n.category==='armor'?f.armorTurns:f.ringTurns},moduleData:{loot:JSON.parse(JSON.stringify(item.data))}};
      })};
    },
    settle(state,event,accepted) {
      const s=stateOf(state),added=masks(accepted.newUniqueIds);
      return {...s,uniqueMask:s.uniqueMask|added.uniqueMask,setMask:(BigInt('0x'+s.setMask)|BigInt('0x'+added.setMask)).toString(16).padStart(32,'0'),watermark:event.source==='encounter'?event.encounterOrdinal:s.watermark};
    }
  };
}

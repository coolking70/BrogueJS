import i18next from 'i18next';
import type { ItemCommandProvider, ItemCommandProposal } from '../../itemSdk';
import type { Json } from '../../types';
import type { EffectiveLootCatalog, LootItemDataV1 } from './types';
import { lootItemClass } from './item';
import { matchRuneword } from './sockets';
import { salvageYield } from './economy';
import { stateOf } from './session';
import { normalizeLootPickupFilter } from './ui/viewModel';
export function revealLoot(data: LootItemDataV1):Json {return JSON.parse(JSON.stringify({...data,identityKnown:true,affixes:data.affixes.map(a=>({...a,known:true}))}));}
export function lootCommands(catalog:()=>EffectiveLootCatalog):Record<string,ItemCommandProvider>{
 const command=(kind:ItemCommandProvider['kind']):ItemCommandProvider=>({kind,...(kind==='identify'?{materialDefinitionId:'loot.shard'}:{}),prepare(payload,ctx){
  const p=payload as Record<string,Json>,s=stateOf(ctx.state),next=structuredClone(s);next.revision++;
  const proposal:{-readonly [K in keyof ItemCommandProposal]:ItemCommandProposal[K]}={v:1,revision:ctx.revision,consume:[],updateOwnData:[],materials:[],nextState:next,chargedTicks:0,confirmation:null};
  if(kind==='create'){if(s.created||p.presetId!==s.presetId)return null;next.created=true;}
  else if(!s.created)return null;
  if(kind==='filter'){
   try{next.filter=structuredClone(normalizeLootPickupFilter({v:1,minRarity:p.minRarity,classes:p.classes,autoPickupGold:p.autoPickupGold})) as typeof next.filter;}catch{return null;}
  }
  if(kind==='salvage'){
   const ids=p.itemIds as number[],items=ids.map(id=>ctx.inventory.find(i=>i.id===id));
   if(items.some(i=>!i?.moduleData?.loot||ctx.equippedIds.includes(i.id)))return null;
   const data=items.map(i=>i!.moduleData!.loot as unknown as LootItemDataV1),preset=catalog().pack.presets.presets.find(p=>p.id===s.presetId)!;
   proposal.consume=ids.map(itemId=>({itemId,quantity:1}));proposal.materials=[{definitionId:'loot.shard',quantity:data.reduce((n,d)=>n+salvageYield(d,preset),0)}];proposal.chargedTicks=100*ids.length;
   if(data.some(d=>d.socketed.length))proposal.confirmation={nameKey:'ext.loot.ui.socket.salvage-loss',params:{}};
   else if(data.some(d=>d.rarity==='set'))proposal.confirmation={nameKey:'ext.loot.ui.salvage.warn-set',params:{}};
   else if(data.some(d=>d.uniqueId!==null))proposal.confirmation={nameKey:'ext.loot.ui.salvage.warn-unique',params:{}};
  }
  if(kind==='identify'){
   const item=ctx.inventory.find(i=>i.id===p.itemId),data=item?.moduleData?.loot as unknown as LootItemDataV1|undefined;
   if(!data||!item!.canBeIdentified)return null;
   let left=10;proposal.consume=ctx.inventory.filter(i=>i.materialDefinitionId==='loot.shard').flatMap(i=>{const quantity=Math.min(left,i.quantity);left-=quantity;return quantity?[{itemId:i.id,quantity}]:[];});
   if(left)return null;proposal.updateOwnData=[{itemId:item!.id,data:revealLoot(data)}];proposal.chargedTicks=100;
  }
  if(kind==='socket'){
   const target=ctx.inventory.find(i=>i.id===p.itemId),material=ctx.inventory.find(i=>i.id===p.runeItemId),c=catalog();
   const data=target?.moduleData?.loot as unknown as LootItemDataV1|undefined,rune=material?.materialDefinitionId?c.runesById[material.materialDefinitionId]:undefined;
   if(!data||!rune||!material||material.quantity<1||ctx.equippedIds.includes(target!.id)||data.rarity!=='normal'||data.enhancement!==0||data.socketed.length>=data.sockets)return null;
   const cls=lootItemClass(data.baseId,c)!;
   if(!rune.itemClasses.includes(cls as 'weapon'|'armor'))return null;
   const updated=structuredClone(data);updated.socketed.push(rune.id);
   const word=matchRuneword(c,cls,updated.sockets,updated.socketed);
   updated.rarity=word?'runeword':'normal';
   proposal.consume=[{itemId:material.id,quantity:1}];proposal.updateOwnData=[{itemId:target!.id,data:updated as unknown as Json}];proposal.chargedTicks=100;
   proposal.confirmation={nameKey:'ext.loot.ui.socket.confirm',params:{rune:i18next.t(rune.nameKey),sequence:updated.socketed.map(id=>{const entry=c.runesById[id]!;return i18next.t(entry.nameKey);}).join(' → '),result:word?i18next.t(word.nameKey):i18next.t('ext.loot.ui.socket.no-word')}};
  }
  return proposal;
 }});
 return {create:command('create'),'set-filter':command('filter'),salvage:command('salvage'),'identify-shards':command('identify'),socket:command('socket')};
}

import type { ExtensionModule, Json } from '../../types';
import type { WorldDefinitionPack } from '../../worldSdk';
import { buildEffectiveLootCatalog } from './catalog';
import { loadLootPack } from './definitions';
import { validateLootItemData, lootItemClass, deriveNativeFacts } from './item';
import { DEFAULT_CONFIGURATION, LOOT_MODULE_VERSION, initialLootState, lootRules, resolveLootCatalog, stateOf, validConfiguration, validLootState } from './session';
import { triggerLootKnowledge } from './knowledge';
import { lootDrops } from './drops';
import { lootCommands, revealLoot } from './commands';
import { lootStatSources } from './statSources';
import { lootPresentation } from './presentation';
import type { LootItemDataV1 } from './types';
export const shardDefinitions:WorldDefinitionPack={schema:1,worldSdk:1,items:[{owner:'loot',id:'loot.shard',nameKey:'ext.loot.shard.name',descriptionKey:'ext.loot.ui.integration.shard-description',category:'material',glyph:'*',color:'#aaaaaa',maxStack:99,nativeTemplate:null,tags:[],tool:null}],resourceNodes:[],stations:[],recipes:[],startupItems:null};
export function createLootModule(configuration:Json=DEFAULT_CONFIGURATION):ExtensionModule {
 if(!validConfiguration(configuration))throw new Error('Invalid loot configuration');
 const presetId=(configuration as {presetId:string}).presetId;
 let catalog=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null});
 const getCatalog=()=>catalog;
 return {id:'loot',version:LOOT_MODULE_VERSION,rules:lootRules(configuration),worldDefinitions:shardDefinitions,
  prepareItemSession:query=>{catalog=resolveLootCatalog(query);},
  initialState:()=>initialLootState(presetId,catalog.fingerprint),validateState:(value):value is Json=>validLootState(value,presetId,catalog.fingerprint),
  initialCommand:{action:'create',payload:{v:1,presetId}},validateInitialCommand:(action,payload)=>action==='create'&&!!payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).sort().join(',')==='presetId,v'&&payload.v===1&&payload.presetId===presetId,
  initializationReady:ctx=>stateOf(ctx.state).created,
  itemDrops:lootDrops(getCatalog),itemCommands:lootCommands(getCatalog),statSources:lootStatSources(getCatalog),itemPresentation:lootPresentation(getCatalog),
  itemDataValidators:{loot:(data,{item,phase})=>{
   if(!validateLootItemData(data,catalog)||item.quantity!==1||item.kindKey!==data.baseId
    ||item.category!==({weapon:0,armor:1,ring:8}[lootItemClass(data.baseId,catalog)!])||item.identified!==data.affixes.every(a=>a.known))return false;
   const native=deriveNativeFacts(data,catalog);
   return phase!=='create'||item.enchantment===native.enchantment&&item.isCursed===native.isCursed;
  }},
  itemKnowledge:{trigger:(data,{fact})=>triggerLootKnowledge(data as unknown as LootItemDataV1,catalog,fact),known:data=>(data as unknown as LootItemDataV1).affixes.every(a=>a.known),unique:data=>(data as unknown as LootItemDataV1).uniqueId!==null,reveal:data=>revealLoot(data as unknown as LootItemDataV1)},
  itemPickup:(item,state)=>{const f=stateOf(state).filter;if(item.category===5)return f.autoPickupGold;
   const data=item.moduleData?.loot as unknown as LootItemDataV1|undefined;if(!data)return true;
   return f.classes.includes(lootItemClass(data.baseId,catalog)!)&&['normal','magic','rare','unique'].indexOf(data.rarity)>=['normal','magic','rare','unique'].indexOf(f.minRarity);}
 };
}

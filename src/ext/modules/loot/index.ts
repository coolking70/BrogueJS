import { lootEnhancement } from './enhancement';
import type { ExtensionModule, Json } from '../../types';
import type { WorldDefinitionPack } from '../../worldSdk';
import { buildEffectiveLootCatalog } from './catalog';
import { loadLootPack } from './definitions';
import { validateLootItemData, lootItemClass, deriveNativeFacts, projectItemModifiers } from './item';
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
  projectView:ctx=>{const read=ctx.worldWork?.readWorkContext({kind:'inventory'});return {containerItemIds:read?.ok?read.value.containers.filter(c=>c.inReach).flatMap(c=>c.items.map(i=>i.id)):[]};},
  prepareItemSession:query=>{catalog=resolveLootCatalog(query);},
  initialState:()=>initialLootState(presetId,catalog.fingerprint),validateState:(value):value is Json=>validLootState(value,presetId,catalog.fingerprint),
  initialCommand:{action:'create',payload:{v:1,presetId}},validateInitialCommand:(action,payload)=>action==='create'&&!!payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.keys(payload).sort().join(',')==='presetId,v'&&payload.v===1&&payload.presetId===presetId,
  initializationReady:ctx=>stateOf(ctx.state).created,
  itemRunicPower:(data,knownOnly)=>{
   const mods=projectItemModifiers(data as unknown as LootItemDataV1,catalog).filter(m=>m.runicType!==null&&m.unit==='runic-strength');
   return mods.length?(knownOnly&&!mods[0]!.known?0:mods[0]!.value*4):0;
  },
  itemEnhancement:lootEnhancement(getCatalog),itemDrops:lootDrops(getCatalog),itemCommands:lootCommands(getCatalog),statSources:lootStatSources(getCatalog),itemPresentation:lootPresentation(getCatalog),
  itemDataValidators:{loot:(data,{item,phase})=>{
   if(!validateLootItemData(data,catalog)||item.quantity!==1||item.kindKey!==data.baseId
    ||item.category!==({weapon:0,armor:1,ring:8}[lootItemClass(data.baseId,catalog)!])||item.identified!==data.identityKnown)return false;
   const native=deriveNativeFacts(data,catalog);
   if(item.runicType!==null&&item.runicType!==undefined&&item.runicType!==native.runicType)return false;
   if(data.targetClass!==undefined&&item.vorpalEnemy!==data.targetClass)return false;
   return phase!=='create'||item.enchantment===native.enchantment&&item.isCursed===native.isCursed&&item.runicType===native.runicType;
  }},
  itemKnowledge:{trigger:(data,{fact,item})=>triggerLootKnowledge(data as unknown as LootItemDataV1,catalog,fact,item.enchantment),known:data=>(data as unknown as LootItemDataV1).identityKnown,unique:data=>(data as unknown as LootItemDataV1).uniqueId!==null||(data as unknown as LootItemDataV1).pieceId!==null,reveal:data=>revealLoot(data as unknown as LootItemDataV1)},
  itemPickup:(item,state)=>{const f=stateOf(state).filter;if(item.category===5)return f.autoPickupGold;
   const data=item.moduleData?.loot as unknown as LootItemDataV1|undefined;if(!data)return true;
   return f.classes.includes(lootItemClass(data.baseId,catalog)!)&&['normal','magic','rare','unique','set'].indexOf(data.rarity)>=['normal','magic','rare','unique','set'].indexOf(f.minRarity);}
 };
}

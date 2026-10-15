import { ItemLoader } from '../Items/ItemLoader';
import { getNextEntityId } from '../../entities/Creature';
import { checkpointGenerationWorld } from './WorldCheckpoint';
import { rng } from '../Random';
/** C6 sealed command plans. All mutation happens at the recorded host boundary. */
import type { Game } from './Game';
import type { ItemCommandProposal } from '../../ext/itemSdk';
import type { ReadonlyJson, Json } from '../../ext/types';
import { Item, ItemCategory } from '../Items/Item';
import { assertItemJson, copyItemValue, freezeItemValue, itemFacts } from '../Items/ItemData';
import { serializeItem } from './EntitySnapshot';
import { additionalItemSlots, checkItemBudget, itemDefinition, previewItem, reservedInventorySlots } from './WorldWorkWorld';
import { assembleWorldItem } from '../Items/WorldItems';
import { markItemKnowledgeDirty } from '../Items/ItemStatInvalidation';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { timeSystem } from '../Systems/Time';
import { worldText } from '../../ext/worldText';
export interface ItemCommandPlan { readonly confirmation:string|null; readonly chargedTicks:number; readonly stamp:string }
interface Sealed {game:Game;runtime:NonNullable<Game['extensionRuntime']>;owner:string;kind:string;proposal:ItemCommandProposal;stamp:string;items:readonly Item[];equipment:readonly (Item|null)[];used:boolean}
const plans=new WeakMap<ItemCommandPlan,Sealed>();
const equipment=(g:Game)=>[g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight];
function stamp(g:Game,owner:string):string {return JSON.stringify([g.extensionRuntime!.itemCommandState(owner),g.player.inventory.items.map(serializeItem),equipment(g).map(i=>i?.id??null),g.player.id,g.player.loc,g.player.inventory.capacity,reservedInventorySlots(g)]);}
const keys=(v:object,want:string)=>Object.keys(v).sort().join(',')===want.split(',').sort().join(',');
const positive=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>0;
function requireValid(ok:unknown):asserts ok {if(!ok)throw new Error('C6_COMMAND');}
/** Invalid commands are refusals; no provider capability or live Item escapes. */
function prepareUnchecked(g:Game,data:unknown):ItemCommandPlan|null {
 try {
  const runtime=g.extensionRuntime!,declaration=runtime.itemCommandDeclaration(data);if(!declaration)return null;
  const {owner,action,kind,materialDefinitionId}=declaration,input=JSON.parse(data as string);
  assertItemJson(input);requireValid(input&&typeof input==='object'&&!Array.isArray(input)&&keys(input,'module,action,payload'));
  const payload=input.payload as Record<string,ReadonlyJson>;requireValid(payload&&typeof payload==='object'&&!Array.isArray(payload)&&payload.v===1);
  const state=runtime.itemCommandState(owner) as Record<string,ReadonlyJson>,revision=state.revision;
  requireValid(Number.isSafeInteger(revision)&&Number(revision)>=0&&Number(revision)<Number.MAX_SAFE_INTEGER);
  const inv=g.player.inventory.items,eq=equipment(g),ids=eq.filter((i):i is Item=>!!i).map(i=>i.id);
  if(kind==='create')requireValid(keys(payload,'v,presetId')&&revision===0&&typeof payload.presetId==='string'&&payload.presetId===(runtime.itemCommandConfiguration(owner) as Record<string,ReadonlyJson>)?.presetId);
  else {requireValid(payload.revision===revision);
   if(kind==='filter') {requireValid(keys(payload,'v,revision,minRarity,classes,autoPickupGold')&&typeof payload.minRarity==='string'&&typeof payload.autoPickupGold==='boolean'&&Array.isArray(payload.classes)&&payload.classes.every(c=>typeof c==='string'&&['weapon','armor','ring'].includes(c)));payload.classes=[...new Set(payload.classes)].sort();}
   if(kind==='salvage')requireValid(keys(payload,'v,revision,itemIds')&&Array.isArray(payload.itemIds)&&payload.itemIds.length>=1&&payload.itemIds.length<=26&&new Set(payload.itemIds).size===payload.itemIds.length&&payload.itemIds.every(positive));
   if(kind==='identify')requireValid(keys(payload,'v,revision,itemId')&&positive(payload.itemId));
  }
  const proposal=runtime.prepareItemCommand(owner,action,payload,inv.map(item=>({...itemFacts(item),canBeIdentified:ItemLoader.canIdentifyItem(item)})),ids);if(!proposal)return null;
  requireValid(keys(proposal,'v,revision,consume,updateOwnData,materials,nextState,chargedTicks,confirmation')&&proposal.v===1&&proposal.revision===revision&&Array.isArray(proposal.consume)&&Array.isArray(proposal.updateOwnData)&&Array.isArray(proposal.materials));
  requireValid(proposal.consume.length<=26&&proposal.updateOwnData.length<=26&&proposal.materials.length<=26);
  const consumed=new Map<number,number>(),updated=new Set<number>();
  for(const row of proposal.consume){requireValid(keys(row,'itemId,quantity')&&positive(row.quantity)&&!consumed.has(row.itemId));const item=inv.find(i=>i.id===row.itemId);requireValid(item&&!ids.includes(item.id)&&row.quantity<=item.quantity);consumed.set(item.id,row.quantity);}
  for(const row of proposal.updateOwnData){requireValid(keys(row,'itemId,data')&&!updated.has(row.itemId)&&!consumed.has(row.itemId));const item=inv.find(i=>i.id===row.itemId);requireValid(item?.moduleData?.[owner]);updated.add(row.itemId);const candidate={...item,moduleData:{...copyItemValue(item.moduleData),[owner]:copyItemValue(row.data) as Json}};candidate.identified=runtime.itemKnown(candidate);candidate.canBeIdentified=!candidate.identified;runtime.validateItemData(candidate,'update');}
  const outputs:Item[]=[];
  for(const row of proposal.materials){requireValid(keys(row,'definitionId,quantity')&&positive(row.quantity)&&row.quantity<=8192*99);const d=itemDefinition(g,row.definitionId);requireValid(d.owner===owner&&d.category==='material'&&d.tool===null&&d.maxStack===99);for(let left=row.quantity;left>0;left-=99)outputs.push(previewItem(d,Math.min(left,99)));}
  if(kind==='create'||kind==='filter')requireValid(!consumed.size&&!updated.size&&!outputs.length&&proposal.chargedTicks===0&&proposal.confirmation===null);
  if(kind==='salvage'){
   const requested=payload.itemIds as number[];requireValid(!updated.size&&proposal.chargedTicks===requested.length*100&&consumed.size===requested.length);
   for(const id of requested){const item=inv.find(i=>i.id===id);requireValid(item?.moduleData?.[owner]&&item.quantity===1&&consumed.get(id)===1&&!ids.includes(id));}
   if(requested.some(id=>runtime.itemUnique(owner,inv.find(i=>i.id===id)!)))requireValid(proposal.confirmation!==null);
  }
  if(kind==='identify'){
   const target=inv.find(i=>i.id===payload.itemId);requireValid(target?.moduleData?.[owner]&&ItemLoader.canIdentifyItem(target)&&updated.size===1&&updated.has(target.id)&&!outputs.length&&proposal.chargedTicks===100&&proposal.confirmation===null);
   requireValid(JSON.stringify(proposal.updateOwnData[0]!.data)===JSON.stringify(runtime.revealedItemData(owner,target,'command')));
   let count=0;for(const [id,n]of consumed){const item=inv.find(i=>i.id===id)!;requireValid(item.category===ItemCategory.MATERIAL&&item.worldItem?.definitionId===materialDefinitionId);count+=n;}requireValid(count===10);
  }
  let confirmation:string|null=null;if(proposal.confirmation){const ref=proposal.confirmation;requireValid(keys(ref,'nameKey,params')&&ref.nameKey.startsWith(`ext.${owner}.`)&&ref.params&&Object.values(ref.params).every(v=>typeof v==='string'||typeof v==='number'));confirmation=worldText(ref.nameKey,ref.params);}
  const remaining=inv.filter(i=>consumed.get(i.id)!==i.quantity).map(i=>Object.assign(Object.create(Item.prototype),copyItemValue(i),{quantity:i.quantity-(consumed.get(i.id)??0)})) as Item[];
  const extra=additionalItemSlots(g,remaining,outputs);requireValid(remaining.length+extra+reservedInventorySlots(g)<=g.player.inventory.capacity);checkItemBudget(g,extra-(inv.length-remaining.length));
  const plan=Object.freeze({confirmation,chargedTicks:proposal.chargedTicks,stamp:stamp(g,owner)});plans.set(plan,{game:g,runtime,owner,kind,proposal:freezeItemValue(copyItemValue(proposal)),stamp:plan.stamp,items:[...inv],equipment:eq,used:false});return plan;
 }catch{return null;}
}
export function prepareItemCommand(g:Game,data:unknown):ItemCommandPlan|null {
 const declaration=g.extensionRuntime?.itemCommandDeclaration(data);if(!declaration)return null;
 const before=stamp(g,declaration.owner),random=JSON.stringify(rng.getState()),allocator=getNextEntityId(),tick=timeSystem.currentTick;
 const restore=g.checkpointWorldWork(),restoreRandom=checkpointGenerationWorld(()=>({shallow:[],deep:[rng]}));
 try {
 const plan=prepareUnchecked(g,data);
 if(before!==stamp(g,declaration.owner)||random!==JSON.stringify(rng.getState())||allocator!==getNextEntityId()||tick!==timeSystem.currentTick){restore();restoreRandom();return null;}
 return plan;
 }catch{restore();restoreRandom();return null;}
}
export function commitItemCommand(g:Game,plan:ItemCommandPlan):boolean {
 const s=plans.get(plan);if(!s||s.used||s.game!==g||s.runtime!==g.extensionRuntime)return false;s.used=true;
 if(stamp(g,s.owner)!==s.stamp||s.items.some((i,n)=>g.player.inventory.items[n]!==i)||s.equipment.some((i,n)=>equipment(g)[n]!==i))return false;
 if(s.kind==='identify'&&!ItemLoader.canIdentifyItem(g.player.inventory.items.find(i=>i.id===s.proposal.updateOwnData[0]!.itemId)!))return false;
 const restore=g.checkpointWorldWork(),restoreAuxiliary=checkpointGenerationWorld(()=>({shallow:[],deep:[rng,ItemLoader.identifiedItems,ItemLoader.callTitles,ItemLoader.magicPolarityRevealed]}));
 try{return s.runtime.itemCommandTransaction(()=>{
  for(const row of s.proposal.consume){const item=g.player.inventory.items.find(i=>i.id===row.itemId)!;if(item.quantity===row.quantity)g.player.inventory.items.splice(g.player.inventory.items.indexOf(item),1);else item.quantity-=row.quantity;markRecordingRoot(item);}
  for(const row of s.proposal.updateOwnData){const item=g.player.inventory.items.find(i=>i.id===row.itemId)!;
   if(s.kind==='identify') {
    ItemLoader.identifyInstance(item,()=>s.runtime.revealItemKnowledge(item,'command'));
    requireValid(JSON.stringify(item.moduleData![s.owner])===JSON.stringify(row.data));
   } else {item.moduleData={...copyItemValue(item.moduleData!),[s.owner]:copyItemValue(row.data) as Json};item.identified=s.runtime.itemKnown(item);item.canBeIdentified=!item.identified;}s.runtime.validateItemData(item,'update');markItemKnowledgeDirty(item);markRecordingRoot(item);}
  for(const row of s.proposal.materials)for(let left=row.quantity;left>0;left-=99){const item=assembleWorldItem(itemDefinition(g,row.definitionId),Math.min(left,99));if(!g.player.inventory.addItem(item))throw new Error('C6_CAPACITY');}
  s.runtime.commitItemCommandState(s.owner,s.proposal.revision,s.proposal.nextState);
  s.runtime.stats.validateSources(g.player.id);
  if(plan.chargedTicks){g.player.ticksUntilTurn=plan.chargedTicks;timeSystem.currentTick+=plan.chargedTicks;}
  return true;
 });}catch{restore();restoreAuxiliary();return false;}
}

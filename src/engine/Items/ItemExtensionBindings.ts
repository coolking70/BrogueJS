/** Revocable, session-only callbacks. Neither Items nor their snapshots own providers. */
import type { Item } from './Item';
import type { KnownItemFacts } from '../../ext/itemSdk';
export type ItemLocation=KnownItemFacts['location'];
export const ITEM_COLOR_TOKENS=Object.freeze({
  'item-common':'#cccccc','item-uncommon':'#68c878','item-rare':'#66aaff',
  'item-epic':'#c080ff','item-unique':'#ffd060','item-corrupted':'#ff6878'
});
interface Binding {
  enhancementPreview():Partial<Pick<Item,'moduleData'|'enchantment'|'strengthRequired'>>|null;
  enhanced():boolean;
  runicPower(knownOnly:boolean,data?:Item['moduleData']):number|null;
  name(baseName:string,location:ItemLocation,hallucinating:boolean):string;
  appearance():{colorToken:string;marker:string}|null;
  atomic<T>(work:()=>T):T;
  identify():void;
  autoPickup():boolean;
}
const bindings=new WeakMap<Item,Binding>();
export function bindItemExtension(item:Item,binding:Binding):void {bindings.set(item,binding);}
export function unbindItemExtension(item:Item):void {bindings.delete(item);}
export function notifyItemIdentification(item:Item):void {bindings.get(item)?.identify();}
export function itemExtensionName(item:Item,baseName:string,location:ItemLocation='floor',hallucinating=false):string {
  return hallucinating?baseName:bindings.get(item)?.name(baseName,location,false)??baseName;
}
export function itemDisplayName(item:Item,location:ItemLocation,hallucinating=false):string {
  const name=itemExtensionName(item,item.nativeUninscribedName,location,hallucinating);return item.inscription?`${name} "${item.inscription}"`:name;
}
export function itemExtensionColor(item:Item):string|undefined {
  const a=bindings.get(item)?.appearance();return a?ITEM_COLOR_TOKENS[a.colorToken as keyof typeof ITEM_COLOR_TOKENS]:undefined;
}
export function itemAllowsAutoPickup(item:Item):boolean {return bindings.get(item)?.autoPickup()??true;}

const identifying = new WeakSet<Binding>();
export function itemIdentificationTransaction<T>(item:Item|null,work:()=>T):T {
  const binding=item?bindings.get(item):undefined;
  if(!binding||identifying.has(binding))return work();
  identifying.add(binding);
  try{return binding.atomic(work);}finally{identifying.delete(binding);}
}


/** Formula L0 read; never identifies or opens a transaction. */
export function itemRunicPower(item:Item,knownOnly:boolean,data?:Item['moduleData']):number|null {return bindings.get(item)?.runicPower(knownOnly,data)??null;}

export function itemEnhancementPreview(item:Item){return bindings.get(item)?.enhancementPreview()??null;}
export function itemUsesEnhancement(item:Item):boolean{return bindings.get(item)?.enhanced()??false;}

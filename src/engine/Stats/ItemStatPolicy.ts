/** C6 budgets constrain only the declaring owner's contribution pool. */
import { StatValidationError, type StatModifierRow } from '../../ext/stats';
export function itemStatPolicy(rows:readonly StatModifierRow[],owner:string,equippedIds?:readonly number[]):readonly StatModifierRow[] {
  const result:StatModifierRow[]=[],counts=new Map<string,number>();
  for(const row of rows){
    if(row.layer==='equipment'){
      const prefix=`${owner}.item.`,id=row.sourceId.startsWith(prefix)?row.sourceId.slice(prefix.length).split('.')[0]:undefined;
      if(!id||!/^[1-9]\d*$/.test(id)||equippedIds!==undefined&&!equippedIds.includes(Number(id)))throw new StatValidationError('source');
      const count=(counts.get(id)??0)+1;counts.set(id,count);if(count>24)throw new StatValidationError('budget');
    }
    if(row.layer==='base'||row.grantPolicy)throw new StatValidationError('source');
    let budget=row.budget;
    if(['native.weapon-enchant','native.armor-enchant'].includes(row.stat)&&row.category==='flat')budget={minimum:-800,maximum:40};
    if(row.stat==='native.awareness'&&row.category==='flat')budget={minimum:-1_000_000,maximum:160};
    if(row.stat==='native.physical-damage-taken'&&(row.category==='increased'||row.category==='more'))budget={minimum:-5000,maximum:50000};
    const speed=['native.move-speed','native.attack-speed'].includes(row.stat);
    if(speed&&row.category==='more'){
      if(row.slot!=='equipment')throw new StatValidationError('source');
      budget={minimum:-4000,maximum:40000};
    }
    result.push({...row,...(budget?{budget}:{})});
  }
  for(const stat of ['native.move-speed','native.attack-speed'])if(rows.some(r=>r.stat===stat))result.push({stat,category:'clamp',value:25,maximum:400,layer:'equipment',sourceKind:'item-policy',sourceId:`foundation.item-policy.${stat}`});
  if(rows.some(r=>['native.armor-base','native.armor-enchant','native.defense'].includes(r.stat)))result.push({stat:'native.defense',category:'clamp',value:0,maximum:220,layer:'equipment',sourceKind:'item-policy',sourceId:'foundation.item-policy.defense'});
  return result;
}

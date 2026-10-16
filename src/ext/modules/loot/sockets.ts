import type { EffectiveLootCatalog, ItemClass, LootItemDataV1 } from './types';
/** Full key only: no prefix or substring matching. Sequence is the sole authority. */
export function matchRuneword(catalog:EffectiveLootCatalog, itemClass:ItemClass, sockets:number, sequence:readonly string[]) {
  return sequence.length === sockets ? catalog.wordsByKey[JSON.stringify([itemClass,sockets,sequence])] : undefined;
}
export function socketRows(data:Pick<LootItemDataV1,'sockets'|'socketed'>, itemClass:ItemClass, catalog:EffectiveLootCatalog) {
  const word=matchRuneword(catalog,itemClass,data.sockets,data.socketed);
  return word ? word.rows.map(row=>({row,sourceId:row.rowId}))
    : data.socketed.flatMap((id,index)=>catalog.runesById[id]!.rows.map(row=>({row,sourceId:`socket.${index}.${row.rowId}`})));
}

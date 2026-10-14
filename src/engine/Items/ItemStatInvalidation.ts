/** Session-only ownership; never serialized into items or inventories. */
const knowledgeOwners=new WeakMap<object,()=>void>();
const owners = new WeakMap<object, () => void>();
export function bindItemStatInvalidation(object:object, dirty:()=>void,knowledge?:()=>void):void { owners.set(object,dirty);if(knowledge)knowledgeOwners.set(object,knowledge); }
export function unbindItemStatInvalidation(object:object):void { owners.delete(object);knowledgeOwners.delete(object); }
export function markItemStatsDirty(object:object):void { owners.get(object)?.(); }

export function markItemKnowledgeDirty(object:object):void { knowledgeOwners.get(object)?.(); }

/** 原生失败回滚保留原回调身份；不重新注册或调用失效通知。 */
export function checkpointItemStatInvalidation(objects: readonly object[]): () => void {
  const rows = [...new Set(objects)].map(object => ({ object, owner: owners.get(object),knowledge:knowledgeOwners.get(object) }));
  return () => { for (const { object, owner,knowledge } of rows) {
    if (owner) owners.set(object, owner); else owners.delete(object);
    if(knowledge)knowledgeOwners.set(object,knowledge);else knowledgeOwners.delete(object);
  } };
}

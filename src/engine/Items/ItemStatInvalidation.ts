/** Session-only ownership; never serialized into items or inventories. */
const owners = new WeakMap<object, () => void>();
export function bindItemStatInvalidation(object:object, dirty:()=>void):void { owners.set(object,dirty); }
export function unbindItemStatInvalidation(object:object):void { owners.delete(object); }
export function markItemStatsDirty(object:object):void { owners.get(object)?.(); }

/** 原生失败回滚保留原回调身份；不重新注册或调用失效通知。 */
export function checkpointItemStatInvalidation(objects: readonly object[]): () => void {
  const rows = [...new Set(objects)].map(object => ({ object, owner: owners.get(object) }));
  return () => { for (const { object, owner } of rows) {
    if (owner) owners.set(object, owner); else owners.delete(object);
  } };
}

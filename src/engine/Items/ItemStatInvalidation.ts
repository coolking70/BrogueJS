/** Session-only ownership; never serialized into items or inventories. */
const owners = new WeakMap<object, () => void>();
export function bindItemStatInvalidation(object:object, dirty:()=>void):void { owners.set(object,dirty); }
export function unbindItemStatInvalidation(object:object):void { owners.delete(object); }
export function markItemStatsDirty(object:object):void { owners.get(object)?.(); }

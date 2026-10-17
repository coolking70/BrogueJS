/** Host-issued CAS signature: complete persisted native and module-owned item state. */
import type { Item } from './Item';
import { serializeItem } from '../Core/EntitySnapshot';
import { sha256 } from '../../ext/fingerprint';
export const workItemStamp = (item: Item): string => sha256(JSON.stringify(serializeItem(item)));

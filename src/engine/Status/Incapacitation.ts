import type { Creature } from '../../entities/Creature';
import { bodyStatusOwner } from './BodyStatuses';
const wake = new WeakMap<Creature, () => void>();
export function isIncapacitated(actor: Creature): boolean {
  return actor.hasStatus('paralyzed') || actor.hasStatus('slumber');
}
export function bindSlumberWake(actor: Creature, callback: () => void): void {
  wake.set(actor, callback);
}
export function wakeSlumber(actor: Creature): void {
  const owner = bodyStatusOwner(actor, 'slumber');
  if (!owner.hasStatus('slumber')) return;
  owner.setStatusDuration('slumber', 0);
  wake.get(owner)?.();
}

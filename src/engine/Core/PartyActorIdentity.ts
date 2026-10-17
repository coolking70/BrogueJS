import type {Creature} from '../../entities/Creature';
/** Reconstructed capability binding, never an independent persistent identity.
 * The authoritative roster owns admission; native player facts remain unchanged. */
const members=new WeakSet<Creature>();
export function bindPartyMember(actor:Creature):void {members.add(actor);}
export function isPartyMember(actor:Creature):boolean {return members.has(actor);}

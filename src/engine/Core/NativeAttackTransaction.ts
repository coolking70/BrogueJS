/** Native physical actions own one stamina charge, independent of hit fanout.
 * Credentials are synchronous engine scopes, never extension input or save data. */
import type { Creature } from '../../entities/Creature';
import type { Grid } from '../Map/Grid';
import type { Game } from './Game';
import { assertActorActionScope, type ActorActionScope } from './ActorActionScope';
import { canPayNativeActorAttack, chargeNativeActorAttack, isActorDodgeProtected } from './PhasedAttackProduction';

type Credential = { game: Game; actor: Creature; costOwner: 'native' | 'phased'; charged: boolean; defenseOwner: 'native' | 'segment' };
const worlds = new WeakMap<Grid, Game>();
const credentials = new WeakMap<Creature, Credential>();

export function bindNativeAttackWorld(game: Game): void { worlds.set(game.grid, game); }
function owns(game: Game, actor: Creature): boolean {
    return actor === game.player || game.monsters.some(candidate => candidate === actor);
}
function current(game: Game, actor: Creature): Credential | undefined {
    const value = credentials.get(actor);
    return value?.game === game && value.actor === actor ? value : undefined;
}
function synchronous<T>(work: () => T): T {
    const result = work();
    if (result && typeof (result as { then?: unknown }).then === 'function')
        throw new Error('Native attack authority cannot cross await');
    return result;
}
function scoped<T>(value: Credential, work: () => T): T {
    const previous = credentials.get(value.actor);
    credentials.set(value.actor, value);
    try {
        return synchronous(work);
    } finally {
        if (previous) credentials.set(value.actor, previous); else credentials.delete(value.actor);
    }
}
export function withNativeAttackAction<T>(game: Game, actor: Creature, work: () => T): T {
    bindNativeAttackWorld(game);
    if (current(game, actor)) return synchronous(work);
    return scoped({ game, actor, costOwner: 'native', charged: false, defenseOwner: 'native' }, work);
}
export function withPrepaidNativeAttack<T>(scope: ActorActionScope, game: Game, actor: Creature, work: () => T): T {
    assertActorActionScope(scope, game, actor.id, actor === game.player ? 'player-command' : 'npc-scheduler');
    bindNativeAttackWorld(game);
    return scoped({ game, actor, costOwner: 'phased', charged: true, defenseOwner: 'segment' }, work);
}
export function canCommitNativeAttack(game: Game, actor: Creature): boolean {
    return current(game, actor)?.charged === true || canPayNativeActorAttack(game, actor.id);
}
export function commitNativeAttackCost(game: Game, actor: Creature): boolean {
    const credential = current(game, actor);
    if (credential?.charged) return true;
    if (!chargeNativeActorAttack(game, actor.id)) return false;
    if (credential) credential.charged = true;
    return true;
}
/** A real native melee may have no extension hooks (e.g. newly spawned NPCs).
 * Verify both world and entity identity, not an ID or a module-provided boolean. */
export function guardNativeMelee(grid: Grid | undefined, attacker: Creature, defender: Creature): 'allow' | 'unaffordable' | 'dodge' {
    const game = grid && worlds.get(grid);
    if (!game || game.grid !== grid || !owns(game, attacker) || !owns(game, defender)) return 'allow';
    if (!commitNativeAttackCost(game, attacker)) return 'unaffordable';
    if (current(game, attacker)?.defenseOwner !== 'segment' && isActorDodgeProtected(game, defender.id)) return 'dodge';
    return 'allow';
}

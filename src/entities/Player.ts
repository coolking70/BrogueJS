/** Unique primary-member compatibility identity. Native capabilities are shared
 * with controlled members without copying a Player entity or changing Game.player. */
import { ControlledActor, type HungerState } from './ControlledActor';
import type { StatusId } from './Creature';
import type { Direction } from '../types';
import type { Inventory } from '../engine/Items/Inventory';
import type { Item } from '../engine/Items/Item';
export { TURNS_FOR_FULL_REGEN, STOMACH_SIZE, HUNGER_THRESHOLD, WEAK_THRESHOLD,
  FAINT_THRESHOLD, PLAYER_STARTING_RESOURCES, type HungerState } from './ControlledActor';

export class Player extends ControlledActor {
    // Explicit instance contract retained for U01. Initialization belongs to the
    // shared native capability constructor, in exactly the original field order.
    declare public inventory: Inventory;
    declare public equippedWeapon: Item | null;
    declare public equippedArmor: Item | null;
    declare public ringLeft: Item | null;
    declare public ringRight: Item | null;
    declare public strength: number;
    declare public lastMoveDirection: Direction | null;
    declare public nutrition: number;
    declare public maxNutrition: number;
    declare public hungerState: HungerState;
    declare public hungerTransition: HungerState | null;
    declare public regenCarry: number;
    declare public temporaryImmunities: Partial<Record<StatusId, number>>;
}

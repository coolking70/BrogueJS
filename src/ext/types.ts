import type { Creature } from '../entities/Creature';
import type { AttackResult } from '../engine/Combat/Combat';
import type { Item } from '../engine/Items/Item';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface ExtensionVersion { id: string; version: string }
export interface ExtensionManifest { schema: 1; modules: ExtensionVersion[] }
export interface ExtensionSnapshot {
    manifest: ExtensionManifest;
    modules: Record<string, Json>;
    /** Run-local creature ID -> module-qualified component ID -> JSON. */
    components: Record<string, Record<string, Json>>;
}
export type RuleSet = 'classic' | 'extended';
export interface CreatureView {
    readonly id: number; readonly name: string; readonly hp: number; readonly maxHp: number;
    readonly x: number; readonly y: number; readonly player: boolean;
}
export interface ItemView { readonly id: number; readonly category: number; readonly quantity: number }
export interface HookEvents {
    beforeLevelGeneration: { depth: number };
    afterLevelGeneration: { depth: number };
    creatureSpawned: { creature: CreatureView };
    playerTurnEnded: { turn: number };
    beforeAttack: { attacker: CreatureView; defender: CreatureView };
    afterAttack: { attacker: CreatureView; defender: CreatureView; result: Readonly<AttackResult> };
    damage: { creature: CreatureView; amount: number; hpBefore: number; sourceId: number | null };
    kill: { creature: CreatureView; sourceId: number | null; administrative: boolean };
    itemPickedUp: { creature: CreatureView; item: ItemView };
    itemUsed: { creature: CreatureView; item: ItemView; operation: string };
    enteredLevel: { depth: number; firstVisit: boolean };
}
export type HookName = keyof HookEvents;
export interface ExtensionContext {
    readonly moduleId: string;
    readonly depth: number;
    readonly playerId: number;
    readonly state: Json;
    setState(state: Json): void;
    getComponent(creatureId: number, name: string): Json | undefined;
    setComponent(creatureId: number, name: string, value: Json): void;
    removeComponent(creatureId: number, name: string): void;
    randomInt(min: number, max: number): number;
    message(text: string): void;
}
export type HookHandlers = { [K in HookName]?: (event: Readonly<HookEvents[K]>, context: ExtensionContext) => void };
export interface ExtensionModule extends ExtensionVersion {
    dependencies?: readonly string[];
    initialState(): Json;
    validateState(state: unknown): state is Json;
    hooks?: HookHandlers;
    componentValidators?: Record<string, (value: unknown) => boolean>;
    onNewGame?(context: ExtensionContext): void;
    /** Rebuild session resources only; do not change serialized state. */
    onLoad?(context: ExtensionContext): void;
    onUnload?(): void;
    commands?: Record<string, (payload: Json, context: ExtensionContext) => void>;
}
/** Session-only wiring. Never serialized as part of a creature. */
export interface CreatureExtensionHooks {
    beforeAttack(attacker: Creature, defender: Creature): void;
    afterAttack(attacker: Creature, defender: Creature, result?: AttackResult): void;
    damage(creature: Creature, amount: number, hpBefore: number): void;
}
export function creatureView(creature: Creature, playerId: number): CreatureView {
    return Object.freeze({ id: creature.id, name: creature.name, hp: creature.hp, maxHp: creature.maxHp,
        x: creature.x, y: creature.y, player: creature.id === playerId });
}
export function itemView(item: Item): ItemView {
    return Object.freeze({ id: item.id, category: item.category, quantity: item.quantity });
}

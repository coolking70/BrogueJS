import type { DamageIntent, DamageReceipt, HealthActor } from '../Combat/DamageResolution';
import type { CollisionWorld } from '../Movement/KinematicCollision';
import type { CircleBody, WorldPoint } from '../Movement/WorldUnits';
import type { PopulationDescriptor } from './PopulationRuntime';
import type { MissionCommand, MissionDescriptor } from './MissionRuntime';

export interface RuntimeManifest { id: string; version: string; rules: { schema: number; version: string; fingerprint: string } }
export interface CombatBody extends CircleBody { team: number; hp: number }
export type WeaponCommand = { tick: number; kind: 'reload' } | { tick: number; kind: 'equip'; slot: number };
export type ShooterCommand = WeaponCommand | MissionCommand;
export interface FireControl { tick: number; actorId: number; aimAngle: number; fire: boolean; moving: boolean }
export interface CombatEffect { tick: number; kind: 'tracer' | 'impact' | 'explosion'; from: WorldPoint; to: WorldPoint; radius: number; hit: boolean }
export interface WeaponView { id: string; labelKey: string; slot: number; ammo: number; capacity: number; selected: boolean }
export interface RangedView { weapons: WeaponView[]; reloadRemaining: number; cooldownRemaining: number; recoil: number; shots: number; projectiles: { id: number; pose: WorldPoint; radius: number }[] }
/** All reads are detached. Modules request damage, never receive writable HP. */
export interface RangedHost {
    readonly seed: number;
    readonly ownerId: number;
    readonly world: CollisionWorld;
    tick(): number;
    bodies(): readonly CombatBody[];
    body?(id: number): CombatBody | undefined;
    health(id: number): Readonly<HealthActor> | undefined;
    damage(intent: DamageIntent): Readonly<DamageReceipt> | null;
    emit(effect: CombatEffect): void;
}
export interface RangedRuntime {
    advance(control: FireControl, commands: readonly WeaponCommand[]): void;
    snapshot(): unknown;
    view(): RangedView;
}
export interface RangedDescriptor extends RuntimeManifest {
    runtime: 'realtime';
    kind: 'ranged';
    labelKey: string;
    uiKeys: readonly string[];
    foundation: 4;
    locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
    create(host: RangedHost, restored?: unknown): RangedRuntime;
}
export type RealtimeModuleDescriptor = RangedDescriptor | PopulationDescriptor | MissionDescriptor;

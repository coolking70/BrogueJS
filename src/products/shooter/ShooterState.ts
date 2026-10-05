import type { BattleSetup } from '../../engine/Simulation/BattleSetup';
import type { DamageState } from '../../engine/Combat/DamageResolution';
import type { KinematicPose, WorldPoint } from '../../engine/Movement/WorldUnits';
import type { EnvironmentContact } from '../../engine/Movement/KinematicSpatial';
import type { CombatEffect, RangedView, RuntimeManifest, ShooterCommand } from '../../engine/Simulation/RangedRuntime';
import type { MissionView } from '../../engine/Simulation/MissionRuntime';
import type { PopulationView } from '../../engine/Simulation/PopulationRuntime';
import type { SupportView } from '../../engine/Simulation/SupportRuntime';
import type { InputFrame } from './input/InputFrame';

export const MAX_SHOOTER_TICKS = 108_000;
export const SHOOTER_BODY_RADIUS = 280;
export const SHOOTER_MOVE_SPEED = 160;
export const SPAWNS = [[5.5, 10.5], [10.5, 10.5], [6.5, 5.5], [5.5, 22.5], [16.5, 5.5], [17.5, 15.5], [32.5, 20.5]] as const;
export interface ShooterActor {
    id: number; kind: 'player' | 'target' | 'swarm' | 'elite' | 'boss' | 'objective'; pose: KinematicPose; loc: WorldPoint; radius: number; motionCredit: WorldPoint;
    contacts: EnvironmentContact[]; contactTicks: { water: number; fire: number; gas: number };
    respawnTick: number; attackReadyTick: number; lastHitTick: number;
}
export interface ShooterSnapshot {
    format: 'broguejs-shooter-s6'; version: 7; product: string; simulation: string; ticksPerSecond: number; arena: string;
    modules: RuntimeManifest[]; moduleStates: Record<string, unknown>; seed: number; tick: number;
    actors: ShooterActor[]; damage: DamageState; effects: CombatEffect[]; ranged: RangedView | null; population: PopulationView | null; mission: MissionView | null;
    setup: BattleSetup | null; support: SupportView | null; clearedHazards: WorldPoint[];
    stats: { kills: number; deaths: number; damageDealt: number; damageTaken: number };
}
export interface ShooterReplay {
    format: 'broguejs-shooter-s6-replay'; version: 7; initial: ShooterSnapshot; frames: InputFrame[];
    commands: ShooterCommand[]; final: ShooterSnapshot;
}
/** Property insertion order has no mechanical significance. */
export function canonicalState(value: unknown): string {
    const normalize = (item: unknown): unknown => {
        if (Array.isArray(item)) return item.map(normalize);
        if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item)
            .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalize(child)]));
        return item;
    };
    return JSON.stringify(normalize(value));
}

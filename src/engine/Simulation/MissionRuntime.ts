import type { BattleSetup } from './BattleSetup';
import type { WorldPoint } from '../Movement/WorldUnits';
import type { CombatBody, RuntimeManifest } from './RangedRuntime';

export type MissionCommand = { tick: number; kind: 'interact' | 'abort' };
export interface PopulationLimits { swarm: number; elite: number; boss: number }
export interface PopulationReinforcementPolicy { enabled: boolean; batch: number; limits?: PopulationLimits }
export interface MissionScenario {
    id: string; width: number; height: number; spawn: WorldPoint; initialPopulation: PopulationLimits;
    walls: readonly { x: number; y: number; width: number; height: number }[];
    terrain: readonly { x: number; y: number; width: number; height: number; kind: 'water' | 'fire' | 'gas' }[];
    targets: readonly { key: string; pose: WorldPoint; radius: number; maxHp: number }[];
}
export interface MissionHost {
    tick(): number;
    player(): CombatBody;
    target(key: string): CombatBody;
    stats(): { kills: number; deaths: number };
    readonly rangedAvailable: boolean;
    readonly playerMaxHp: number;
    /** These writes are validated and committed by the product authority. */
    heal(): boolean;
    demolish(key: string): boolean;
}
export interface MissionMarker {
    id: string; labelKey: string; kind: 'scan' | 'nest' | 'uplink' | 'extraction' | 'rescue' | 'supply' | 'sample';
    pose: WorldPoint; radius: number; status: 'locked' | 'ready' | 'active' | 'complete'; progress: number; total: number;
}
export interface MissionReward { credits: number; samples: number; optional: boolean; killBonus: number }
/** Read-only activity nearest the player; clocks remain owned by the mission. */
export interface MissionActivity {
    kind: 'region' | 'demolition' | 'arrival' | 'boarding'; labelKey: string;
    progress: number; total: number; paused: boolean;
}
export interface MissionView {
    titleKey: string; status: 'active' | 'success' | 'failed'; reason: 'extracted' | 'timeout' | 'lives' | 'aborted' | null;
    remaining: number; lives: number; markers: MissionMarker[]; nearby: string | null;
    extraction: 'locked' | 'ready' | 'inbound' | 'boarding' | 'complete'; extractionRemaining: number;
    activity: MissionActivity | null; samples: number; reward: MissionReward | null; reinforcements: PopulationReinforcementPolicy;
}
export interface MissionRuntime {
    advance(commands: readonly MissionCommand[]): void;
    isFinished(): boolean;
    snapshot(): unknown;
    view(): MissionView;
    targetActive(key: string): boolean;
}
export interface MissionDescriptor extends RuntimeManifest {
    runtime: 'realtime'; kind: 'mission'; foundation: 4; labelKey: string; uiKeys: readonly string[];
    locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
    configure?(setup: BattleSetup): MissionDescriptor;
    scenario: MissionScenario;
    createMission(host: MissionHost, restored?: unknown): MissionRuntime;
}

import type { WorldPoint } from '../Movement/WorldUnits';
import type { RangedHost, RuntimeManifest } from './RangedRuntime';

export interface PopulationActorDefinition {
    id: number;
    kind: 'swarm' | 'elite' | 'boss';
    radius: number;
    maxHp: number;
}
export interface PopulationHost extends RangedHost {
    /** Movement and revival remain engine-owned validated writes. */
    move(id: number, x: number, y: number, speed: number): void;
    revive(id: number, at: WorldPoint): boolean;
}
export interface PopulationView {
    swarm: number; elites: number; bosses: number; pending: number; spawned: number;
    telegraphs: { id: number; center: WorldPoint; radius: number; remaining: number }[];
}
export interface PopulationRuntime {
    advance(): void;
    afterCombat(): void;
    snapshot(): unknown;
    view(): PopulationView;
}
export interface PopulationDescriptor extends RuntimeManifest {
    runtime: 'realtime'; kind: 'population'; labelKey: string; uiKeys: readonly string[]; foundation: 4;
    locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
    actors: readonly PopulationActorDefinition[];
    createPopulation(host: PopulationHost, restored?: unknown): PopulationRuntime;
}

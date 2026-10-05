import type { WorldPoint } from '../Movement/WorldUnits';
import type { RangedHost, RuntimeManifest } from './RangedRuntime';

export type SupportCommand = { tick: number; kind: 'support'; slot: number; x: number; y: number };
export interface SupportHost extends RangedHost {
    /** The host validates and owns health, ammunition and environment writes. */
    replenish(): boolean;
    clearHazards(center: WorldPoint, radius: number): void;
}
export interface SupportView {
    abilities: { slot: number; labelKey: string; remaining: number; cooldown: number; delay: number; radius: number; range: number; dangerous: boolean }[];
    deployments: { id: number; slot: number; pose: WorldPoint; phase: 'inbound' | 'active'; remaining: number; total: number; radius: number; charges: number }[];
    revealed: number[];
    nearbySupply: number | null;
    notice: { code: 'accepted' | 'range' | 'blocked' | 'cooldown' | 'dead' | 'supplied'; tick: number } | null;
}
export interface SupportRuntime {
    advance(commands: readonly SupportCommand[], interact: boolean): boolean;
    snapshot(): unknown;
    view(): SupportView;
}
export interface SupportDescriptor extends RuntimeManifest {
    runtime: 'realtime'; kind: 'support'; foundation: 4; labelKey: string; uiKeys: readonly string[];
    locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
    createSupport(host: SupportHost, restored?: unknown): SupportRuntime;
}

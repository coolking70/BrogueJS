import type { RuntimeManifest } from './RangedRuntime';
import type { BattleSetup } from './BattleSetup';
import type { MissionReward } from './MissionRuntime';
export interface MissionTicket { id: string; seed: number; variant: number; difficulty: number }
export interface StrategicReward { id: string; credits: number; samples: number; completed: boolean; difficulty: number }
export interface OperationView { region: number; difficulty: number; index: number; status: 'idle'|'active'|'complete'|'failed'; ticket: MissionTicket|null; serial: number }
export interface OperationRuntime {
    start(region: number, difficulty: number): void;
    deploy(): MissionTicket;
    settle(ticket: MissionTicket, status: 'success'|'failed', reward: MissionReward|null): StrategicReward;
    snapshot(): unknown; view(): OperationView;
}
export interface MetaView { credits: number; samples: number; weapons: number[]; support: number[]; equipped: number[]; difficulty: number; completed: number }
export interface MetaRuntime {
    purchase(kind: 'weapon'|'support', slot: number): void;
    equip(slots: number[]): void;
    grant(reward: StrategicReward): void;
    setup(ticket: MissionTicket): BattleSetup;
    snapshot(): unknown; view(): MetaView;
}
interface StrategicBase extends RuntimeManifest { runtime: 'strategic'; foundation: 4; labelKey: string; uiKeys: readonly string[]; locales: Readonly<Record<string,Readonly<Record<string,string>>>> }
export interface OperationDescriptor extends StrategicBase { kind: 'operation'; regions: readonly { labelKey: string; x: number; y: number }[]; difficulties: readonly { labelKey: string }[]; createOperations(restored?: unknown): OperationRuntime }
export interface MetaDescriptor extends StrategicBase { kind: 'meta'; weaponCosts: readonly number[]; supportCosts: readonly number[]; upgradeCosts: readonly number[]; createMeta(restored?: unknown): MetaRuntime }
export type StrategicDescriptor = OperationDescriptor | MetaDescriptor;

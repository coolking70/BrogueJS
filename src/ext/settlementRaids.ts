/** Foundation-owned bounded raid identity and excluded economic time. No native copies. */
export interface RaidRules {
  readonly period: number;
  readonly grace: number;
  readonly cooldown: number;
  readonly warning: number;
  readonly threshold: number;
  readonly maxActors: number;
  readonly maxEvents: number;
  readonly rosters: readonly { minDepth: number; ids: readonly string[] }[];
}
export interface CampRaidEvent {
  id: string;
  ordinal: number;
  phase: 'warning' | 'deferred' | 'active' | 'aftermath' | 'closed';
  triggerTick: number;
  dueTick: number;
  lastAttemptTick: number;
  population: number;
  facilities: number;
  depthBonus: number;
  severity: number;
  mergedPressure: number;
  budget: number;
  actorIds: number[];
  defeatedIds: number[];
  /** Birth permission and native lifecycle facts share the event's sole root. */
  actors: { actorId: number; birthTypeId: string; currentTypeId: string;
    departed: { depth: number; tick: number } | null }[];
  reason: string | null;
  endedTick: number | null;
  lostUnits: number;
  damagedHp: number;
}
export interface CampRaidState {
  owner: string;
  campId: number;
  slot: number;
  createdTick: number;
  lastPressureTick: number;
  pressure: number;
  admissionReason: 'slots' | null;
  lastOrdinal: number;
  cooldownUntil: number;
  reportedTick: number;
  report: {
    phase: CampRaidEvent['phase'] | null;
    reason: string | null;
    lostUnits: number;
    damagedHp: number;
  } | null;
  noiseEpoch: number;
  noiseBatches: number;
  excludedTicks: number;
  pauseBaseExcludedTicks: number;
  lastPauseStart: number;
  pauseFrom: number | null;
  pauseThrough: number;
  event: CampRaidEvent | null;
}

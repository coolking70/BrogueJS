/** Data-only resident declarations. Native actors, Items and clocks remain foundation owned. */
export interface ResidentTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  hp: number;
  accuracy: number;
  defense: number;
  damage: string;
  moveSpeed: number;
  attackSpeed: number;
}
export interface ResidentPolicy {
  schema: 1;
  templates: ResidentTemplate[];
  spawnDepths: number[];
  rescuedTemplates: string[];
  dayEpochs: 32;
  lowLightChannels: 306;
  plotWorkTicks: 1000;
}
export interface ResidentSource {
  schema: 1;
  key: string;
  kind: 'spawn' | 'rescue';
  consumed: boolean;
  revision: number;
}
export type ResidentJob =
  | { kind: 'idle' }
  | { kind: 'guard'; at: { x: number; y: number } }
  | { kind: 'plant'; plotIds: number[]; sourceId: number; destinationId: number }
  | { kind: 'haul'; sourceId: number; destinationId: number; itemId: number; quantity: number };
export interface ResidentComponent {
  schema: 1;
  campId: number;
  campOrdinal: number;
  revision: number;
  mode: 'stay' | 'escort';
  bedId: number | null;
  schedule: [number, number, number];
  job: ResidentJob;
  stopReason: string | null;
}
export interface ResidentSpawnSlot {
  depth: number;
  attempts: number;
  status: 'deferred' | 'placed' | 'skipped' | 'terminal';
  actorId: number | null;
}
export interface ResidentWork {
  id: number;
  owner: string;
  actorId: number;
  campId: number;
  depth: number;
  kind: 'plant' | 'haul';
  actionId: number | null;
  sourceId: number;
  destinationId: number;
  cargoId: number;
  plotId: number | null;
  phase: 'planting' | 'pickup' | 'carrying' | 'delivery';
  anchor: { x: number; y: number };
  hp: number;
  reservedSlots: number;
  creditTicks: number;
  creditRemainder: number;
  status: 'working' | 'suspended';
  pendingCompletion: boolean;
  day: number;
}
export interface ResidentRead {
  tick: number;
  candidates: { id: number; name: string; revision: number; at:{x:number;y:number} }[];
  residents: {
    id: number;
    name: string;
    at:{x:number;y:number};
    campId: number;
    revision: number;
    mode: string;
    bedId: number | null;
    foodShortage: number;
    housingShortage: number;
    efficiency: number;
    job: ResidentJob;
    stopReason: string | null;
    schedule: [number, number, number];
    work:{ticketId:number;phase:string;creditTicks:number;status:string}|null;
  }[];
}
export const RESIDENT_ACTIONS = [
  'recruit',
  'set-residence',
  'return-home',
  'assign-job',
  'set-schedule',
  'set-granary',
  'dismiss-resident'
] as const;

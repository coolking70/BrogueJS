/** Foundation-owned production progress; no copied Item or module inventory. */
import { exact, uint, World5Error } from './worldBasics';
export interface ResidentOrderProgress {
  sourceId: number;
  destinationId: number;
  stationId: number | null;
  plotIds: number[];
  batchCount: number;
  paidTicks: number;
  creditRemainder: number;
  travelRemainingTicks: number;
  travelPerBatchTicks: number;
  qualified: boolean;
  reason: string | null;
}
export interface ResidentProductionQuota {
  actorId: number;
  day: number;
  meat: number;
  plots: number[];
}
export function assertResidentOrderProgress(p: ResidentOrderProgress): void {
  exact(
    p,
    'sourceId,destinationId,stationId,plotIds,batchCount,paidTicks,creditRemainder,travelRemainingTicks,travelPerBatchTicks,qualified,reason',
    'production'
  );
  uint(p.sourceId, 'sourceId', 1);
  uint(p.destinationId, 'destinationId', 1);
  if (p.stationId !== null) uint(p.stationId, 'stationId', 1);
  for (const k of [
    'batchCount',
    'paidTicks',
    'creditRemainder',
    'travelRemainingTicks',
    'travelPerBatchTicks'
  ] as const)
    uint(p[k], k);
  if (
    p.batchCount < 1 ||
    p.batchCount > 16 ||
    p.paidTicks > 1000 ||
    p.creditRemainder >= 100 ||
    !Array.isArray(p.plotIds) ||
    p.plotIds.length > 6 ||
    new Set(p.plotIds).size !== p.plotIds.length ||
    typeof p.qualified !== 'boolean' ||
    !(p.reason === null || typeof p.reason === 'string')
  )
    throw new World5Error('C5_BAD_PAYLOAD', 'production');
  for (const id of p.plotIds) uint(id, 'plotId', 1);
}

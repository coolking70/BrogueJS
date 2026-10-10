import { c5Canonical } from './worldJson';
import { exact, uint } from './worldBasics';
import { validId } from './json';
import type { ResidentComponent, ResidentSource, ResidentPolicy, ResidentJob } from './residentSdk';
const pos = (v: unknown) => {
  exact(v, 'x,y', 'position');
  const p = v as { x: number; y: number };
  uint(p.x, 'x', 1);
  uint(p.y, 'y', 1);
  if (p.x > 77 || p.y > 27) throw new Error('Invalid resident position');
};
export function assertResidentJob(v: unknown): asserts v is ResidentJob {
  c5Canonical(v);
  const j = v as ResidentJob;
  if (j.kind === 'idle') exact(j, 'kind', 'job');
  else if (j.kind === 'guard') {
    exact(j, 'kind,at', 'job');
    pos(j.at);
  } else if (j.kind === 'plant') {
    exact(j, 'kind,plotIds,sourceId,destinationId', 'job');
    if (
      !Array.isArray(j.plotIds) ||
      !j.plotIds.length ||
      j.plotIds.length > 6 ||
      new Set(j.plotIds).size !== j.plotIds.length
    )
      throw new Error('Invalid plots');
    for (const id of j.plotIds) uint(id, 'plot', 1);
    uint(j.sourceId, 'source', 1);
    uint(j.destinationId, 'destination', 1);
  } else if (j.kind === 'haul') {
    exact(j, 'kind,sourceId,destinationId,itemId,quantity', 'job');
    for (const k of ['sourceId', 'destinationId', 'itemId', 'quantity'] as const) uint(j[k], k, 1);
    if (j.quantity > 8 || j.sourceId === j.destinationId) throw new Error('Invalid haul');
  } else throw new Error('Invalid job');
}
export function validResidentSource(v: unknown): v is ResidentSource {
  try {
    c5Canonical(v);
    exact(v, 'schema,key,kind,consumed,revision', 'source');
    const s = v as unknown as ResidentSource;
    uint(s.revision, 'revision');
    return (
      s.schema === 1 &&
      validId(s.key) &&
      ['spawn', 'rescue'].includes(s.kind) &&
      typeof s.consumed === 'boolean'
    );
  } catch {
    return false;
  }
}
export function validResident(v: unknown): v is ResidentComponent {
  try {
    c5Canonical(v);
    exact(v, 'schema,campId,campOrdinal,revision,mode,bedId,schedule,job,stopReason', 'resident');
    const r = v as unknown as ResidentComponent;
    for (const k of ['campId', 'campOrdinal'] as const) uint(r[k], k, 1);
    uint(r.revision, 'revision');
    if (r.bedId !== null) uint(r.bedId, 'bed', 1);
    assertResidentJob(r.job);
    return (
      r.schema === 1 &&
      ['stay', 'escort'].includes(r.mode) &&
      Array.isArray(r.schedule) &&
      r.schedule.length === 3 &&
      r.schedule.every((n) => Number.isSafeInteger(n) && n > 0) &&
      r.schedule.reduce((a, b) => a + b, 0) === 32 &&
      (r.stopReason === null || typeof r.stopReason === 'string')
    );
  } catch {
    return false;
  }
}
export function assertResidentPolicy(v: unknown, owner: string): asserts v is ResidentPolicy {
  c5Canonical(v);
  exact(
    v,
    'schema,templates,spawnDepths,rescuedTemplates,dayEpochs,lowLightChannels,plotWorkTicks',
    'residentPolicy'
  );
  const p = v as unknown as ResidentPolicy;
  if (
    p.schema !== 1 ||
    p.dayEpochs !== 32 ||
    p.lowLightChannels !== 306 ||
    p.plotWorkTicks !== 1000 ||
    !Array.isArray(p.templates) ||
    p.templates.length !== 2 ||
    !Array.isArray(p.spawnDepths) ||
    p.spawnDepths.join(',') !== '1,5,10,15' ||
    !Array.isArray(p.rescuedTemplates) ||
    p.rescuedTemplates.length > 16 ||
    new Set(p.templates.map((t) => t.id)).size !== p.templates.length
  )
    throw new Error('Invalid resident policy');
  for (const t of p.templates) {
    exact(
      t,
      'id,nameKey,descriptionKey,hp,accuracy,defense,damage,moveSpeed,attackSpeed',
      'template'
    );
    if (
      !validId(t.id) ||
      !t.id.startsWith(owner + '.') ||
      !t.nameKey.startsWith('ext.' + owner + '.') ||
      !t.descriptionKey.startsWith('ext.' + owner + '.') ||
      !/^\d+-\d+$/.test(t.damage)
    )
      throw new Error('Invalid template');
    const [low,high]=t.damage.split('-').map(Number);
    if(!Number.isSafeInteger(low)||!Number.isSafeInteger(high)||low!<0||high!<low!||high!>1000)throw new Error('Invalid template damage');
    for (const k of ['hp', 'moveSpeed', 'attackSpeed'] as const) {
      uint(t[k], k, 1);
      if (t[k] > 1000) throw new Error('Invalid template stat');
    }
    uint(t.accuracy, 'accuracy');
    uint(t.defense, 'defense');
    if (t.accuracy > 100 || t.defense > 1000) throw new Error('Invalid template stat');
  }
  if (p.rescuedTemplates.some((id) => !['kobold','goblin','goblin_mystic','goblin_conjurer','ogre'].includes(id))) throw new Error('Invalid rescue template');
}

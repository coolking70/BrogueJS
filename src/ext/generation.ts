import { isJson, validId } from './json';

/** First executable contribution: an optional rectangular side chamber. No
 * callbacks, arbitrary terrain scripts or module-owned native objects. */
export interface GenerationContribution {
  readonly id: string;
  readonly priority: number;
  readonly minDepth: number;
  readonly maxDepth: number;
  readonly chance: number;
  readonly width: number;
  readonly height: number;
  readonly entranceWidth: number;
  readonly candidateLimit: number;
  readonly formId: string;
  /** Optional installed body; formId must be its unique core form. */
  readonly bodyId?: string;
  readonly guard: 'return-to-spawn';
}
export interface GenerationPlacementFact {
  readonly owner: string;
  readonly instanceKey: string;
  readonly templateId: string;
  readonly depth: number;
  readonly result: 'placed' | 'skipped';
  readonly reason: 'no-space' | 'budget' | null;
  readonly regionId: number | null;
  readonly actorId: number | null;
  readonly formId: string;
}
export function validGenerationContribution(
  value: unknown,
  owner: string
): value is GenerationContribution {
  if (
    !isJson(value) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).filter(k => k !== 'bodyId').sort().join(',') !==
      'candidateLimit,chance,entranceWidth,formId,guard,height,id,maxDepth,minDepth,priority,width'
  )
    return false;
  const v = value as unknown as GenerationContribution;
  const n = (x: number, a: number, b: number) => Number.isSafeInteger(x) && x >= a && x <= b;
  return (
    validId(v.id) &&
    v.id.startsWith(`${owner}.`) &&
    validId(v.formId) &&
    v.formId.startsWith(`${owner}.`) &&
    (v.bodyId === undefined ? !Object.prototype.hasOwnProperty.call(v, 'bodyId') : validId(v.bodyId) && v.bodyId.startsWith(`${owner}.`)) &&
    n(v.priority, -100, 100) &&
    n(v.minDepth, 1, 40) &&
    n(v.maxDepth, v.minDepth, 40) &&
    n(v.chance, 0, 100) &&
    n(v.width, 12, 32) &&
    n(v.height, 10, 24) &&
    n(v.entranceWidth, 3, Math.min(v.width, v.height) - 4) &&
    n(v.candidateLimit, 1, 16) &&
    v.guard === 'return-to-spawn'
  );
}

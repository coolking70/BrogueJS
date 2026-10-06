export type LootDataErrorCode = 'MISSING_FILE' | 'INVALID_SCHEMA' | 'UNKNOWN_FIELD' | 'INVALID_TYPE' | 'INVALID_VALUE' | 'INVALID_RANGE' | 'INVALID_REFERENCE' | 'DUPLICATE_ID' | 'INVALID_COMBINATION' | 'MISSING_CANDIDATE' | 'LOCALE_MISSING' | 'LOCALE_UNUSED' | 'BUDGET' | 'DRAW_BUDGET';
export type LootContractErrorCode = 'INVALID_REQUEST' | 'UNKNOWN_PRESET' | 'UNKNOWN_BASE' | 'RANDOM_OUT_OF_RANGE' | 'DRAW_BUDGET';
export class LootDataError extends Error {
  constructor(public readonly code: LootDataErrorCode, public readonly path: string, message = code as string) {
    super(`${code} at ${path}: ${message}`); this.name = 'LootDataError';
  }
}
export class LootContractError extends Error {
  constructor(public readonly code: LootContractErrorCode, public readonly path: string, message = code as string) {
    super(`${code} at ${path}: ${message}`); this.name = 'LootContractError';
  }
}

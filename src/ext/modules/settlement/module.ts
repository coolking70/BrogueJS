import type { ExtensionModule, Json } from '../../types';
import { initialState, validateState } from './state';
import { loadSettlementPack, getSettlementIdentity } from './definitions';
import { projectSettlement } from './projection';
import { worldWorkCommands } from './commands';
export function createSettlementModule(): ExtensionModule {
  const pack = loadSettlementPack();
  return {
    id: 'settlement',
    version: '1.0.0',
    rules: getSettlementIdentity(pack),
    worldDefinitions: pack.world,
    campPolicy: pack.camp,
    worldWorkCommands,
    initialState: () => initialState() as unknown as Json,
    validateState: (v): v is Json => validateState(v),
    projectView: (context) => projectSettlement(context) as Json,
    optionalQueries: {
      'settlement.resident-status.v1': {
        accepts(input) {
          return (
            !!input &&
            typeof input === 'object' &&
            !Array.isArray(input) &&
            Object.keys(input).join(',') === 'actorId' &&
            Number.isSafeInteger((input as { actorId: number }).actorId) &&
            Number((input as { actorId: number }).actorId) > 0
          );
        },
        validate(v): v is Json {
          return (
            !!v &&
            typeof v === 'object' &&
            !Array.isArray(v) &&
            Object.keys(v).join(',') === 'resident' &&
            (v as { resident: boolean }).resident === false
          );
        },
        query(input) {
          if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input) ||
            Object.keys(input).join(',') !== 'actorId' ||
            !Number.isSafeInteger((input as { actorId: number }).actorId) ||
            Number((input as { actorId: number }).actorId) < 1
          )
            throw new Error('Invalid resident query');
          return { resident: false };
        }
      }
    }
  };
}

import { validRaidConfiguration, raidIdentity, RAID_RULES } from './raids';
import { validResident,validResidentSource } from '../../residentSchema';
import type { ExtensionModule, Json } from '../../types';
import { initialState, validateState } from './state';
import { loadSettlementPack, getSettlementIdentity } from './definitions';
import { projectSettlement } from './projection';
import { worldWorkCommands } from './commands';
export function createSettlementModule(configuration: Json = { raids: false }): ExtensionModule {
  if (!validRaidConfiguration(configuration)) throw new Error("Invalid settlement run configuration");
  const pack = loadSettlementPack();
  return {
    id: 'settlement',
    version: '1.3.0',
    rules: raidIdentity(configuration, getSettlementIdentity(pack)),
    worldDefinitions: pack.world,
    campPolicy: pack.camp,
    raidRules: (configuration as {raids:boolean}).raids ? RAID_RULES : undefined,
    residentPolicy: pack.residents,
    componentValidators: { resident:validResident, source:validResidentSource },
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
            typeof (v as { resident: boolean }).resident === "boolean"
          );
        },
        query(input,context) {
          if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input) ||
            Object.keys(input).join(',') !== 'actorId' ||
            !Number.isSafeInteger((input as { actorId: number }).actorId) ||
            Number((input as { actorId: number }).actorId) < 1
          )
            throw new Error('Invalid resident query');
          return { resident: !!context.getComponent?.(Number((input as {actorId:number}).actorId),"resident") };
        }
      }
    }
  };
}

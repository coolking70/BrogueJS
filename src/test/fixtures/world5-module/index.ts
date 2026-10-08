import type { ExtensionModule, Json } from '../../../ext/types';
import { registerWorld5Fixture } from '../../../ext/world5Fixture';
import { c5Hash } from '../../../engine/Core/WorldCanonical';
import type { OfflineRules } from '../../../engine/Core/WorldSettlement';
export const fixtureRules: OfflineRules = {
  epochTicks: 1000,
  dayEpochs: 32,
  maxPlanEpochs: 32,
  maxCompletionsPerEpoch: 1024,
  foodUnitsPerResident: 1,
  rationDefinitions: [],
  nodeDefinitions: [],
  recipes: [],
  shortageEfficiencyNumerators: [100, 50, 0, 0],
  efficiencyDenominator: 100
};
export const fixtureFingerprint = c5Hash([
  'C5-1',
  '1.1.0',
  'sha256-c5-offline-v1',
  'c5-seed-v1',
  fixtureRules,
  { raidAfterEpochs: 3, remainingBudget: 3 }
]);
export const fixtureRulesIdentity = {
  schema: 1,
  version: '1.1.0',
  fingerprint: 'sha256:' + fixtureFingerprint
};
export function createWorld5Module(): ExtensionModule {
  return registerWorld5Fixture(
    {
      id: 'world5-fixture',
      version: '1.1.0',
      rules: fixtureRulesIdentity,
      initialState: () => ({ entries: 0, epochs: 0, encounters: [] }),
      validateState: (value: unknown): value is Json => {
        const v = value as { entries: number; epochs: number; encounters: string[] } | null;
        return (
          !!v &&
          Object.keys(v).sort().join(',') === 'encounters,entries,epochs' &&
          Number.isSafeInteger(v.entries) &&
          v.entries >= 0 &&
          Number.isSafeInteger(v.epochs) &&
          v.epochs >= 0 &&
          Array.isArray(v.encounters) &&
          v.encounters.every((x) => typeof x === 'string')
        );
      },
      hooks: {
        enteredLevel: (_e, c) => {
          const s = c.state as { entries: number; epochs: number; encounters: string[] };
          c.setState({ ...s, entries: s.entries + 1 });
        }
      }
    },
    {
      rules: fixtureRules,
      rulesFingerprint: fixtureFingerprint,
      events: (capturedTick) => [
        {
          id: 'world5-fixture.raid',
          absoluteEpoch: Math.floor(capturedTick / 1000) + 3,
          ordinal: 1,
          kind: 'raid',
          policy: { remainingBudget: 3 }
        }
      ],
      prepareState(state, plan) {
        const s = state as { entries: number; epochs: number; encounters: string[] };
        return {
          ...s,
          epochs: s.epochs + Math.floor(plan.toTick / 1000) - Math.floor(plan.fromTick / 1000),
          encounters: [
            ...s.encounters,
            ...plan.effects.filter((e) => e.kind === 'pending-encounter').map((e) => e.eventId)
          ]
        };
      }
    }
  );
}

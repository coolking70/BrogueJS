import { Game } from '../../engine/Core/Game';
import { getInstalledModuleDescriptors } from '../../ext/catalog';
import { registryFromDescriptors, FOUNDATION_PROTOCOL } from '../../ext/descriptor';
import {
  descriptor,
  definitions,
  createCraftingSkeleton
} from '../../ext/testing/fixtures/craftingSkeleton';
import { extensionDataFingerprint } from '../../ext/fingerprint';
import { installWorldFixtureRegistry, registerWorld5WorkFixture } from '../../ext/world5Fixture';
import type {
  WorldDefinitionPack,
  CommittedWorkFact,
  ModuleStateTransaction
} from '../../ext/worldSdk';
import { createHeadlessGame } from '../harness';
export function workGame(
  options: {
    modules?: string[];
    mode?: 'normal' | 'wizard';
    pack?: (pack: any) => void;
    participant?: (fact: CommittedWorkFact, context: ModuleStateTransaction) => unknown;
    fixed?: boolean;
    rulesFingerprint?: string;
  } = {}
) {
  createHeadlessGame(1);
  const pack = structuredClone(definitions);
  options.pack?.(pack);
  const rules = {
    schema: 1,
    version: '1.0.0',
    fingerprint: options.rulesFingerprint ?? extensionDataFingerprint(pack)
  };
  const d = {
    ...descriptor,
    foundation: FOUNDATION_PROTOCOL,
    rules,
    create: () => {
      const m = createCraftingSkeleton();
      m.rules = rules;
      m.worldDefinitions = pack as WorldDefinitionPack;
      if (options.participant) m.worldWorkParticipant = { onCommitted: options.participant as any };
      return options.fixed === false ? m : registerWorld5WorkFixture(m);
    }
  };
  const g = new Game();
  installWorldFixtureRegistry(g, registryFromDescriptors([...getInstalledModuleDescriptors(), d]));
  g.startNewGame({
    seed: 51020001,
    mode: options.mode ?? 'wizard',
    ruleSet: 'extended',
    extensions: ['craftskel', ...(options.modules ?? [])]
  });
  g.animationEnabled = false;
  return g;
}

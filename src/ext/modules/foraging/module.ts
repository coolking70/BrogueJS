import type { ExtensionModule, Json } from '../../types';
import type { ForagingPack } from './types';
import { FORAGING_VERSION, getForagingPackIdentity, toWorldDefinitionPack } from './definitions';
import { assertForagingPack } from './schema';
import { createForagingEdibleCommands, createForagingWorldWorkCommands } from './commands';
import { createForagingActorNeedParticipant, createForagingEdibleParticipant, foragingActorDeparted } from './participants';
import { initialForagingState, validateForagingState, validateHunger } from './state';
import { createForagingStatSources } from './statSources';
import { projectForagingView } from './view';

export function createForagingModuleFromPack(input: ForagingPack): ExtensionModule {
  assertForagingPack(input);
  const pack = structuredClone(input);
  return {
    id: 'foraging', version: FORAGING_VERSION, rules: getForagingPackIdentity(pack),
    worldDefinitions: toWorldDefinitionPack(pack),
    worldWorkCommands: createForagingWorldWorkCommands(), edibleCommands: createForagingEdibleCommands(),
    edibleParticipant: createForagingEdibleParticipant(pack), actorNeedParticipant: createForagingActorNeedParticipant(pack),
    hooks: { actorDeparted: foragingActorDeparted }, statSources: createForagingStatSources(pack),
    componentValidators: { hunger: validateHunger }, initialState: initialForagingState,
    validateState: (state): state is Json => validateForagingState(state, pack),
    projectView: context => projectForagingView(context, pack)
  };
}

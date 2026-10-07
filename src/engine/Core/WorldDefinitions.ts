import { validateEdibleDefinitions, validateEdibleModule, EDIBLE_PACKAGE_KEYS } from './EdibleDefinitions';
/** Static content validation, before any run or ID allocator is touched. */
import type { ExtensionModule } from '../../ext/types';
import type { WorldDefinitionPack } from '../../ext/structureTypes';
import { deepFreeze } from '../Movement/SpatialSchema';
import { World5Error } from '../../ext/world5';
import { assertConstructionPack, assertCampPolicy } from '../../ext/constructionSchema';
export function assertWorldDefinitionPack(value:unknown,owner:string,localeKeys?:ReadonlySet<string>):asserts value is WorldDefinitionPack {
  assertConstructionPack(value,owner,localeKeys,{keys:EDIBLE_PACKAGE_KEYS,validate:pack=>validateEdibleDefinitions(pack,owner,localeKeys)});
}
export function validateWorldModule(
  module: ExtensionModule,
  worldSdk?: number,
  locales?: ReadonlySet<string>
): void {
  validateEdibleModule(module, worldSdk);
  const declares = !!(
    module.worldDefinitions ||
    module.worldWorkCommands ||
    module.worldWorkParticipant
  );
  if (declares !== (worldSdk === 1) || (worldSdk !== undefined && worldSdk !== 1))
    throw new World5Error('C5_BAD_VERSION', 'worldSdk');
  if(module.campPolicy){if(!module.worldDefinitions||!module.worldDefinitions.structures?.length)throw new World5Error('C5_BAD_DEFINITION','camp.world');assertCampPolicy(module.campPolicy,module.id,module.worldDefinitions,locales);Object.defineProperty(module,'campPolicy',{value:deepFreeze(structuredClone(module.campPolicy)),writable:false});}
  if (!declares) return;
  if (module.worldDefinitions) {
    assertWorldDefinitionPack(module.worldDefinitions, module.id, locales);
    Object.defineProperty(module, 'worldDefinitions', {
      value: deepFreeze(structuredClone(module.worldDefinitions)),
      writable: false
    });
  }
  if (
    module.worldWorkCommands &&
    Object.entries(module.worldWorkCommands).some(
      ([action, command]) =>
        !['harvest', 'craft', 'place-station', 'cancel-work'].includes(action) ||
        !command ||
        Object.keys(command).join(',') !== 'prepare' ||
        typeof command.prepare !== 'function' ||
        module.commands?.[action]
    )
  )
    throw new World5Error('C5_BAD_DEFINITION', 'worldWorkCommands');
  if (
    module.worldWorkParticipant &&
    (Object.keys(module.worldWorkParticipant).join(',') !== 'onCommitted' ||
      typeof module.worldWorkParticipant.onCommitted !== 'function')
  )
    throw new World5Error('C5_BAD_DEFINITION', 'participant');
}

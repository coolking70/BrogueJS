import type { ExtensionModule, Json } from '../../types';
import type { CraftingPack } from './types';
import { CRAFTING_VERSION, getCraftingPackIdentity, toWorldDefinitionPack } from './definitions';
import { assertCraftingPack } from './schema';
import { createCraftingCommands } from './commands';
import { applyFact, initialCraftingState, validateCraftingState } from './state';
import { projectCraftingView } from './view';

export function createCraftingModuleFromPack(input: CraftingPack): ExtensionModule {
  assertCraftingPack(input);
  const pack = structuredClone(input);
  return {
    id: 'crafting',
    version: CRAFTING_VERSION,
    rules: getCraftingPackIdentity(pack),
    worldDefinitions: toWorldDefinitionPack(pack),
    worldWorkCommands: createCraftingCommands(pack),
    optionalQueries: {
      'crafting.recipe-catalog.v1': {
        accepts: input => !!input && typeof input==='object' && !Array.isArray(input) && Object.keys(input).length===0,
        validate: (value): value is Json => !!value && typeof value==='object' && !Array.isArray(value) && JSON.stringify(value)===JSON.stringify({schema:1,recipes:[...pack.recipes].sort((a,b)=>a.id.localeCompare(b.id))}),
        query: () => ({schema:1,recipes:[...pack.recipes].sort((a,b)=>a.id.localeCompare(b.id))}) as unknown as Json
      }
    },
    worldWorkParticipant: {
      onCommitted(fact, tx) {
        // A bad delivery must not turn a cancellation into another provider failure.
        try {
          const previous = tx.state;
          const next = applyFact(previous, fact, pack);
          if (next !== previous && validateCraftingState(next, pack)) tx.replaceState(next);
        } catch {
          // Leave the transaction unchanged on unexpected input or an unavailable writer.
        }
      }
    },
    initialState: initialCraftingState,
    validateState: (value): value is Json => validateCraftingState(value, pack),
    projectView: context => projectCraftingView(context, pack) as unknown as Json
  };
}

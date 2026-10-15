import type { ModuleUiContribution } from '../../../ui/types';
export default {
 moduleId:'loot',loadCreationStep:()=>import('./creation/LootCreationStep.vue').then(m=>m.default),
 configurationFromCreation(commands){
  if(commands.length!==1)throw new Error('Invalid loot creation');
  const input=JSON.parse(commands[0]!);
  if(input.module!=='loot'||input.action!=='create'||input.payload?.v!==1)throw new Error('Invalid loot creation');
  return {presetId:input.payload.presetId};
 }
} satisfies ModuleUiContribution;

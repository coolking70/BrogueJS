import {usePartyUi} from './usePartyUi';
import type {ModuleUiContribution} from '../../../ui/types';
export default {moduleId:'party',useSession:usePartyUi,loadCreationStep:()=>import('./PartyCreationStep.vue').then(m=>m.default),
configurationFromCreation(commands){if(commands.length!==1)throw new Error('Invalid party creation');const input=JSON.parse(commands[0]!);if(input.module!=='party'||input.action!=='create')throw new Error('Invalid party creation');return input.payload;}} satisfies ModuleUiContribution;

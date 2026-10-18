import {PARTY_WINDOW_RULES} from '../../partyWindow';
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../descriptor';
import { extensionDataFingerprint } from '../../fingerprint';
import type { ExtensionModule, Json } from '../../types';
import { c5Canonical } from '../../worldJson';
import zhCN from './locales/zh_CN.json';
const VERSION = '0.2.0';
export function validPartyConfiguration(value: unknown): value is { schema: 1; members: number } {
  try { c5Canonical(value); } catch { return false; }
  const row = value as { schema?: unknown; members?: unknown };
  return !!row && Object.keys(row).sort().join(',') === 'members,schema' && row.schema === 1 &&
    Number.isInteger(row.members) && Number(row.members) >= 1 && Number(row.members) <= 4;
}
const identity = (configuration: Json) => ({schema:1,version:VERSION,
  fingerprint:extensionDataFingerprint({configuration,window:PARTY_WINDOW_RULES,singleStep:1,environment:2,placement:2,creation:1,controller:'local:0',xp:'split-then-gain',support:'committed-growth-timed-effect-on-participant-v1',
    trade:'initiator-move',travel:'adjacent-corner-safe',drop:'credit-or-primary',frozen:'deadline-translation'})});
function create(configuration: Json = {schema:1,members:2}): ExtensionModule {
  if (!validPartyConfiguration(configuration)) throw new Error('Invalid party configuration');
  return {id:'party',version:VERSION,rules:identity(configuration),
    initialCommand:{action:'create',payload:configuration},validateInitialCommand:(action,payload)=>action==='create'&&validPartyConfiguration(payload)&&c5Canonical(payload)===c5Canonical(configuration),commands:{create(payload,context){if((context.state as {created:boolean}).created||c5Canonical(payload)!==c5Canonical(configuration))throw new Error('BAD_PAYLOAD');context.setState({schema:1,created:true});}},
    initializationReady:context=>(context.state as {created:boolean}).created,
    allowInput:(action,data,context)=>(context.state as {created:boolean}).created||context.isInitialCommand(action,data),
    initialState:()=>({schema:1,created:false}),validateState:(v):v is Json=>!!v && typeof v==='object' && !Array.isArray(v) && Object.keys(v).sort().join(',')==='created,schema' && (v as {schema:unknown}).schema===1&&typeof (v as {created:unknown}).created==='boolean'};
}
export const descriptor: ModuleDescriptor = {
  id:'party',version:VERSION,foundation:FOUNDATION_PROTOCOL,defaultEnabled:false,
  rules:identity({schema:1,members:2}),create,
  runConfiguration:{default:{schema:1,members:2},validate:validPartyConfiguration,identity},
  labelKey:'ext.party.module.name',descriptionKey:'ext.party.module.description',locales:{zh_CN:zhCN}
};

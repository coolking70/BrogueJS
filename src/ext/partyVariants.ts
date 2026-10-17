import type {ExtensionModule} from './types';
/** Pure assembly capability. Installed modules retain their classic factories and identity. */
const variants=new WeakMap<ExtensionModule,(members:number)=>ExtensionModule>();
export function registerPartyVariant(module:ExtensionModule,factory:(members:number)=>ExtensionModule):ExtensionModule {variants.set(module,factory);return module;}
export function partyVariant(module:ExtensionModule,members:number):ExtensionModule {return variants.get(module)?.(members)??module;}

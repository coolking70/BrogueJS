import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../descriptor';
import { createLootModule } from './index';
import { DEFAULT_CONFIGURATION, LOOT_MODULE_VERSION, lootRules, validConfiguration } from './session';
import zhCN from './locales/zh_CN.json';
import uiZhCN from './locales/ui.zh_CN.json';
export const descriptor: ModuleDescriptor = {
  id:'loot',version:LOOT_MODULE_VERSION,foundation:FOUNDATION_PROTOCOL,worldSdk:2,
  rules:lootRules(),create:createLootModule,defaultEnabled:false,recommends:['growth'],
  runConfiguration:{default:DEFAULT_CONFIGURATION,validate:validConfiguration,identity:lootRules},
  labelKey:'ext.loot.module.name',descriptionKey:'ext.loot.module.description',
  locales:{zh_CN:{...zhCN,...uiZhCN}}
};

import type { MetaDescriptor } from '../../../engine/Simulation/StrategicRuntime';
import { extensionDataFingerprint } from '../../fingerprint';
import { createMeta } from './module';
import data from './data/definitions.json';
import zhCN from './locales/zh_CN.json';
export const runtime: MetaDescriptor = {id:'meta-progression',runtime:'strategic',kind:'meta',foundation:4,version:'1.0.0',
    rules:{schema:1,version:'1.0.0',fingerprint:extensionDataFingerprint(data)},labelKey:'ext.meta-progression.module.name',uiKeys:Object.keys(zhCN),locales:{zh_CN:zhCN},
    weaponCosts:Object.freeze([...data.weaponCosts]),supportCosts:Object.freeze([...data.supportCosts]),upgradeCosts:Object.freeze([...data.upgradeCosts]),createMeta};

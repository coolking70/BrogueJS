import type { OperationDescriptor } from '../../../engine/Simulation/StrategicRuntime';
import { extensionDataFingerprint } from '../../fingerprint';
import { createOperations } from './module';
import data from './data/definitions.json';
import zhCN from './locales/zh_CN.json';
export const runtime: OperationDescriptor = { id:'operations',runtime:'strategic',kind:'operation',foundation:4,version:'1.0.0',
    rules:{schema:1,version:'1.0.0',fingerprint:extensionDataFingerprint(data)},labelKey:'ext.operations.module.name',uiKeys:Object.keys(zhCN),locales:{zh_CN:zhCN},
    regions:Object.freeze(data.regions.map(r=>Object.freeze({...r}))),difficulties:Object.freeze(data.difficulties.map(d=>Object.freeze({...d}))),createOperations };

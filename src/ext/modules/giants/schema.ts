import { validActiveBodyTransitions } from '../../bodyTransitions';
import { isJson } from '../../json';
import { validNativeForm, nativeFormFootprint, nativeFormSpatial } from '../../nativeForms';
import { SpatialCatalog } from '../../../engine/Movement/SpatialSchema';
import { validGenerationContribution } from '../../generation';
import type { GiantsPack } from './types';
export function isGiantsPack(value: unknown): value is GiantsPack {
  if (
    !isJson(value) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).filter(k => !['bodies','transitions'].includes(k)).sort().join(',') !== 'forms,moduleVersion,rulesVersion,schema,templates'
  )
    return false;
  const v = value as unknown as GiantsPack;
  const valid = (
    v.schema === 1 &&
    v.moduleVersion === '1.0.0' &&
    v.rulesVersion === '1.0.0' &&
    Array.isArray(v.forms) &&
    v.forms.length > 0 &&
    v.forms.length <= 16 &&
    v.forms.every((f) => validNativeForm(f, 'giants')) &&
    new Set(v.forms.map((f) => f.id)).size === v.forms.length &&
    Array.isArray(v.templates) &&
    v.templates.length > 0 &&
    v.templates.length <= 16 &&
    new Set(v.templates.map((t) => t.id)).size === v.templates.length &&
    v.templates.every(
      (t) =>
        validGenerationContribution(t, 'giants') &&
        v.forms.some(
          (f) => f.id === t.formId && (f.size === 2 || (t.width >= 16 && t.height >= 12))
        )
    )
  );
  if (!valid) return false;
  try {
    const catalog = new SpatialCatalog(false, ['giants']);
    for (const f of v.forms) {
      for (const rule of f.breakRules ?? []) catalog.registerBreakRule(rule);
      const footprint = nativeFormFootprint(f, 'giants');
      if (footprint) catalog.registerFootprint(footprint);
      catalog.registerForm({ id: f.id, owner: 'giants', footprintId: nativeFormSpatial(f).footprintId });
    }
    if (v.bodies !== undefined) {
      if (!v.bodies || Object.keys(v.bodies).filter(k => !['statusProfiles', 'attackProfiles'].includes(k)).sort().join(',') !== 'breakRules,definitions'
          || !Array.isArray(v.bodies.definitions) || !v.bodies.definitions.length || v.bodies.definitions.length > 16
          || !Array.isArray(v.bodies.breakRules) || v.bodies.breakRules.length > 16) return false;
      if (v.bodies.statusProfiles !== undefined && (!Array.isArray(v.bodies.statusProfiles) || v.bodies.statusProfiles.length > 16)) throw new Error('Invalid status profile declarations');
      if (v.bodies.attackProfiles !== undefined && (!Array.isArray(v.bodies.attackProfiles) || v.bodies.attackProfiles.length > 16)) throw new Error('Invalid attack profile declarations');
      for (const profile of v.bodies.statusProfiles ?? []) catalog.registerStatusProfile(profile);
      for (const profile of v.bodies.attackProfiles ?? []) catalog.registerAttackProfile(profile);
      for (const rule of v.bodies.breakRules) catalog.registerMemberBreakRule(rule);
      for (const body of v.bodies.definitions) catalog.registerBody(body);
    } else if (Object.prototype.hasOwnProperty.call(v, 'bodies')) return false;
    if (v.transitions !== undefined && !validActiveBodyTransitions(v.transitions, 'giants', v.forms, v.bodies?.definitions ?? [])) return false;
    if (Object.prototype.hasOwnProperty.call(v, 'transitions') && v.transitions === undefined) return false;
    return v.templates.every(t => t.bodyId === undefined || catalog.body(t.bodyId).parts.find(p => p.role === 'core')?.formId === t.formId);
  } catch { return false; }
}
export function assertGiantsPack(value: unknown): asserts value is GiantsPack {
  if (!isGiantsPack(value)) throw new Error('Invalid giants pack');
}

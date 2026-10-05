import { isJson } from '../../json';
import { validNativeForm } from '../../nativeForms';
import { validGenerationContribution } from '../../generation';
import type { GiantsPack } from './types';
export function isGiantsPack(value: unknown): value is GiantsPack {
  if (
    !isJson(value) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'forms,moduleVersion,rulesVersion,schema,templates'
  )
    return false;
  const v = value as unknown as GiantsPack;
  return (
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
}
export function assertGiantsPack(value: unknown): asserts value is GiantsPack {
  if (!isGiantsPack(value)) throw new Error('Invalid giants pack');
}

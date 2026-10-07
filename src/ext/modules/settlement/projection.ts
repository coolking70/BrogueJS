import type { ExtensionProjectionContext } from '../../types';
export function projectSettlement(context: ExtensionProjectionContext): unknown {
  return context.structures?.read() ?? null;
}

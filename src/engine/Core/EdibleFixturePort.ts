/** Test-only registration, outside production discovery and the public SDK. */
import type { ExtensionModule } from '../../ext/types';
import type { Game } from './Game';
const ports = new WeakMap<ExtensionModule, (game: Game, payload: unknown) => void>();
export function registerEdibleFixture(
  module: ExtensionModule,
  handler: (game: Game, payload: unknown) => void
): ExtensionModule {
  if (!import.meta.env.DEV) throw new Error('C5_SCOPE');
  ports.set(module, handler);
  return module;
}
export function isEdibleFixtureCommand(game: Game, data: unknown): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const e = typeof data === 'string' ? JSON.parse(data) : (data as any);
    const m = game.extensionRuntime?.edibleModule(e.module);
    return e.action === 'fixture' && !!m && ports.has(m);
  } catch {
    return false;
  }
}
export function executeEdibleFixtureCommand(game: Game, data: unknown): void {
  if (!import.meta.env.DEV) throw new Error('C5_SCOPE');
  const e = typeof data === 'string' ? JSON.parse(data) : (data as any),
    m = game.extensionRuntime!.edibleModule(e.module)!;
  ports.get(m)!(game, e.payload);
}

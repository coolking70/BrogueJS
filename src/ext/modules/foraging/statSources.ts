import type { ExtensionModule } from '../../types';
import type { ForagingPack } from './types';
import { validateHunger } from './state';
type ForagingStatSources = NonNullable<ExtensionModule['statSources']>;
type ForagingStatRow = ReturnType<ForagingStatSources['collect']>[number];

export function createForagingStatSources(pack: ForagingPack): ForagingStatSources {
  return {
    collect(actor, context) {
      const hunger = context.getComponent(actor.id, 'hunger');
      if (!validateHunger(hunger)) return [];
      const penalty = pack.companion.penalties.find(p => p.band === hunger.band);
      if (!penalty) return [];
      const common = { category: 'increased', layer: 'temporary', sourceKind: 'foraging.hunger', sourceId: `foraging.hunger.${hunger.band}` } as const;
      const rows: ForagingStatRow[] = [
        { ...common, stat: 'native.accuracy', value: penalty.accuracyIncreasedBp },
        { ...common, stat: 'native.physical-damage-dealt', value: penalty.damageIncreasedBp }
      ];
      return rows;
    }
  };
}

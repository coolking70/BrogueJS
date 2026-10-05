import type { ExtensionModule, Json, ExtensionContext } from '../../types';
import i18next from 'i18next';
import { extensionDataFingerprint } from '../../fingerprint';
import type { GiantsPack, GiantsState } from './types';
import { assertGiantsPack } from './schema';
import { initialGiantsState, isGiantsState, isGiantsBossMarker } from './state';
import { validateGiantsBindings, validateGiantsWorld } from './validation';
export function createGiantsModuleFromPack(input: GiantsPack): ExtensionModule {
  assertGiantsPack(input);
  const pack = structuredClone(input);
  const change = (context: ExtensionContext, mutate: (state: GiantsState) => boolean) => {
    const s = structuredClone(context.state) as unknown as GiantsState;
    if (mutate(s)) {
      s.revision++;
      context.setState(s as unknown as Json);
    }
  };
  return {
    id: 'giants',
    version: pack.moduleVersion,
    rules: {
      schema: pack.schema,
      version: pack.rulesVersion,
      fingerprint: extensionDataFingerprint(pack)
    },
    ownedRegions: true,
    nativeForms: pack.forms,
    ...(pack.bodies ? { nativeBodies: pack.bodies } : {}),
    generationContributions: pack.templates,
    publicActorTags: [{ component: 'boss', tag: 'boss' }],
    initialState: () => initialGiantsState() as unknown as Json,
    validateState: (v): v is Json => isGiantsState(v, pack),
    componentValidators: { boss: isGiantsBossMarker },
    validateComponents: (s, c, f) => validateGiantsBindings(pack, s, c, f.world),
    validateWorld: (s, c, a, w) => validateGiantsWorld(pack, s, c, a, w),
    hooks: {
      generationPlacement(event, context) {
        if (event.owner !== 'giants') return;
        change(context, (s) => {
          if (s.placements.some((p) => p.instanceKey === event.instanceKey))
            throw new Error('Duplicate giants placement');
          s.placements.push({
            instanceKey: event.instanceKey,
            templateId: event.templateId,
            depth: event.depth,
            result: event.result,
            regionId: event.regionId,
            reason: event.reason
          });
          if (event.result === 'placed') {
            const encounterKey = `${event.instanceKey}.encounter`;
            s.bosses.push({
              encounterKey,
              primaryId: event.actorId!,
              spawnDefinitionId: event.formId,
              instanceKey: event.instanceKey,
              regionId: event.regionId,
              subjects: [{ groupId: event.actorId!, status: 'alive' }],
              status: 'alive'
            });
            context.setComponent(event.actorId!, 'boss', {
              schema: 1,
              encounterKey,
              spawnDefinitionId: event.formId
            });
          }
          return true;
        });
      },
      deathCaptured(event, context) {
        change(context, (s) => {
          const b = s.bosses.find(
            (b) => b.primaryId === event.actor.id && b.subjects[0]!.status === 'alive'
          );
          if (!b) return false;
          b.subjects[0]!.status = event.administrative ? 'lost' : 'dead';
          b.status = event.administrative ? 'lost' : 'defeated';
          context.removeComponent(event.actor.id, 'boss');
          return true;
        });
      },
      movementRegionExited(event, context) {
        change(context, (s) => {
          const b = s.bosses.find(
            (b) =>
              b.primaryId === event.actor.id &&
              b.regionId === event.regionId &&
              b.status === 'alive'
          );
          if (!b) return false;
          b.status = 'escaped';
          return true;
        });
      },
      movementRegionFollowBlocked(event, context) {
        const s = context.state as unknown as GiantsState;
        if (s.placements.some((p) => p.regionId === event.regionId))
          context.message(i18next.t('ext.giants.follow_blocked', { name: event.actor.name }));
      },
      simulationSettled(event, context) {
        change(context, (s) => {
          let changed = false;
          for (const b of s.bosses)
            if (b.subjects[0]!.status === 'alive' && !event.reachableIds.includes(b.primaryId)) {
              b.subjects[0]!.status = 'lost';
              b.status = 'lost';
              context.removeComponent(b.primaryId, 'boss');
              changed = true;
            }
          return changed;
        });
      }
    }
  };
}

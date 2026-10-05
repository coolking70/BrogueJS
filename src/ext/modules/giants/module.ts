import type { ExtensionModule, Json, ExtensionContext } from '../../types';
import i18next from 'i18next';
import { extensionDataFingerprint } from '../../fingerprint';
import type { GiantsPack, GiantsState } from './types';
import { assertGiantsPack } from './schema';
import { initialGiantsState, isGiantsState, isGiantsBossMarker } from './state';
import { validateGiantsBindings, validateGiantsWorld } from './validation';
import { nativeFormData } from '../../nativeForms';
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
    ...(pack.transitions ? { bodyTransitions: pack.transitions } : {}),
    ...(pack.bodies ? { nativeBodies: pack.bodies } : {}),
    generationContributions: pack.templates,
    publicActorTags: [{ component: 'boss', tag: 'boss', groupKey: 'encounterKey' }],
    initialState: () => initialGiantsState() as unknown as Json,
    validateState: (v): v is Json => isGiantsState(v, pack),
    componentValidators: { boss: isGiantsBossMarker },
    validateComponents: (s, c, f) => validateGiantsBindings(pack, s, c, f.world),
    validateWorld: (s, c, a, w) => validateGiantsWorld(pack, s, c, a, w),
    hooks: {
      bodyTransition(event, context) {
        const move = pack.transitions?.find(move => move.id === event.moveId);
        const name = move ? nativeFormData(pack.forms.find(form => form.id === move.sourceFormId)!).name : '';
        if (event.outcome !== 'applied') {
          if (move)
            context.message(i18next.t('ext.giants.transition.no_effect', { name }));
          return;
        }
        if (event.reason === 'split') change(context, s => {
          const boss = s.bosses.find(b => b.subjects.some(subject => subject.groupId === event.sourceGroupId && subject.status === 'alive'));
          if (!boss) return false;
          for (const groupId of event.resultGroupIds) {
            if (!boss.subjects.some(subject => subject.groupId === groupId)) boss.subjects.push({ groupId, status: 'alive' });
            context.setComponent(groupId, 'boss', { schema: 1, encounterKey: boss.encounterKey, spawnDefinitionId: boss.spawnDefinitionId });
          }
          return true;
        });
        if (move) {
          const counts = new Map<string, number>();
          for (const result of move.transition.results) counts.set(result.formId, (counts.get(result.formId) ?? 0) + 1);
          const results = [...counts].map(([formId, count]) => i18next.t('ext.giants.transition.result', {
            count, name: nativeFormData(pack.forms.find(form => form.id === formId)!).name
          })).join(i18next.t('ext.giants.transition.separator'));
          const values = { name, results };
          switch (move.transition.reason) {
            case 'split': context.message(i18next.t('ext.giants.transition.split', values)); break;
            case 'phase': context.message(i18next.t('ext.giants.transition.phase', values)); break;
            case 'clone': context.message(i18next.t('ext.giants.transition.clone', values)); break;
            case 'summon': context.message(i18next.t('ext.giants.transition.summon', values)); break;
          }
        }
      },
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
            (b) => b.subjects.some(subject => subject.groupId === event.actor.id && subject.status === 'alive')
          );
          if (!b) return false;
          b.subjects.find(subject => subject.groupId === event.actor.id)!.status = event.administrative ? 'lost' : 'dead';
          if (b.subjects.every(subject => subject.status === 'dead')) b.status = 'defeated';
          else if (!b.subjects.some(subject => subject.status === 'alive')) b.status = 'lost';
          context.removeComponent(event.actor.id, 'boss');
          return true;
        });
      },
      movementRegionExited(event, context) {
        change(context, (s) => {
          const b = s.bosses.find(
            (b) =>
              b.subjects.some(subject => subject.groupId === event.actor.id && subject.status === 'alive') &&
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
          for (const b of s.bosses) for (const subject of b.subjects)
            if (subject.status === 'alive' && !event.reachableIds.includes(subject.groupId)) {
              subject.status = 'lost';
              if (!b.subjects.some(s => s.status === 'alive')) b.status = 'lost';
              context.removeComponent(subject.groupId, 'boss');
              changed = true;
            }
          return changed;
        });
      }
    }
  };
}

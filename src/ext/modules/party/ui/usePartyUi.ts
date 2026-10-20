import { actorActionSchedulerFor } from '../../../../engine/Core/ActorActionSession';
import type { PartyAiInput } from '../../../partyAi';
import { eligiblePartyCompanion } from '../../../../engine/Core/PartyAi';
import { canSeeMonster } from '../../../../engine/UI/MonsterVisibility';
import { PartyFailure } from '../../../party';
import { World5Error } from '../../../worldBasics';
import { partyFailureText } from './feedback';
import { SOFT_INTERRUPTS, type WindowLength } from '../../../partyWindow';
import { timeSystem } from '../../../../engine/Systems/Time';
import i18next from 'i18next';
import { computed, ref, getCurrentScope, onScopeDispose, watch } from 'vue';
import { observePartyWindows } from '../../../../engine/Core/PartyWindow';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import { projectPartyPlans, PARTY_PLAN_COLORS } from './planProjection';
import PartyHud from './PartyHud.vue';
export function usePartyUi(host: ModuleUiHost): ModuleUiSession {
  const feedback = ref<string | null>(null),
    busy = ref(false), drawerOpen = ref(false);
  const revision = ref(0),
    game = host.game(),
    refresh = () => {
      revision.value++;
    };
  let cancelMap: (() => void) | undefined;
  let cancelOverlay: (() => void) | undefined;
  let mapToken = 0;
  const setDrawer = (open: boolean) => {
    if (open) { if (!host.canOpenPanel()) return; host.beforeOpenPanel(); }
    drawerOpen.value = open;
    if (!open) { cancelMap?.(); cancelMap = undefined; mapToken++; host.afterClosePanel(); }
  };
  const removeKeys = host.registerKeyHandler?.(event => {
    if (!drawerOpen.value) return false;
    if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
    return true;
  }, 70);
  const unsubscribe = observePartyWindows(game, refresh);
  if (getCurrentScope())
    onScopeDispose(() => {
      unsubscribe();
      removeKeys?.();
      cancelMap?.();
      cancelOverlay?.();
    });
  const hud = computed(() => {
    host.tick.value;
    revision.value;
    const root = game.party;
    if (!root) return null;
    const planner = game.partyPlanner()!;
    const expectedRevision = root.state.revision,
      focusedId = game.focusedActor.id;
    const act = (work: () => void) => {
      if (host.game() !== game || game.party !== root || root.state.revision !== expectedRevision || game.focusedActor.id !== focusedId)
        return;
      try {
        work();
        feedback.value = null;
      } catch (error) {
        feedback.value =
          error instanceof PartyFailure || error instanceof World5Error
            ? partyFailureText(error.code)
            : i18next.t('ext.party.error.INTERNAL_FAILURE');
      }
      refresh();
    };
    const batch = (length: WindowLength, automatic: boolean) =>
      planner.batch(
        timeSystem.currentTick,
        length,
        length.kind === 'fine' ? focusedId : null,
        automatic
      );
    const advance = async (length: WindowLength, automatic: boolean) => {
      if (busy.value) return;
      busy.value = true;
      const request = batch(length, automatic),
        generation = planner.generation;
      try {
        await game.flushRecording();
        if (host.game() !== game || planner.generation !== generation) return;
        act(() => planner.submit(request, (b) => game.submitPartyWindow(b)));
      } finally {
        busy.value = false;
        refresh();
      }
    };
    const pickMap = (select: (at: { x: number; y: number }) => void) => {
      cancelMap?.();
      const token = ++mapToken;
      const cells = game.knownPartyWorld().cells.filter(c => c.passable);
      cancelMap = host.selectMapCells?.(root, at => {
        if (token !== mapToken || host.game() !== game || game.party !== root ||
            root.state.revision !== expectedRevision || game.focusedActor.id !== focusedId ||
            !cells.some(c => c.x === at.x && c.y === at.y)) return;
        cancelMap?.(); cancelMap = undefined; mapToken++;
        select(at);
      }, cells);
    };
    const paths = projectPartyPlans(game.knownPartyWorld(), planner.drafts);
    const windowProps = {
      state: structuredClone(root.state.window),
      focused: focusedId,
      draft: planner.drafts.get(focusedId),
      busy: busy.value,
      preview: planner.preview,
      advance,
      pickTravel: () => pickMap(at => act(() => planner.edit(focusedId, { kind: 'travel', level: { kind: 'dungeon', depth: game.depth }, target: at }))),
      cancelMap: () => { cancelMap?.(); cancelMap = undefined; mapToken++; },
      paths,
      append: (kind: 'wait' | 'search' | 'move', dx = 0, dy = 0) =>
        act(() => planner.append(focusedId, kind === 'move' ? { kind, dx, dy } : { kind })),
      clear: () => act(() => planner.edit(focusedId, null)),
      keep: () => act(() => planner.keep(focusedId)),
      undo: () =>
        act(() => {
          const plan = planner.drafts.get(focusedId);
          if (plan?.kind === 'queue')
            planner.edit(focusedId, {
              kind: 'queue',
              actions: plan.actions.slice(0, -1)
            });
        }),
      rehearse: async (length: WindowLength, automatic: boolean) => {
        try {
          await planner.rehearse(game.knownPartyWorld(), batch(length, automatic), (view) =>
            game.decideKnownPartyAi(view)
          );
        } catch {
          feedback.value = i18next.t('ext.party.unavailable');
        }
        refresh();
      },
      cancelPreview: () => {
        planner.preview = null;
        planner.generation++;
        refresh();
      },
      choose: async (choice: string) => {
        const decision = root.state.window.decision;
        if (busy.value || !decision) return;
        busy.value = true;
        try {
          await game.flushRecording();
          if (host.game() === game)
            act(() =>
              game.executeCommand('party:decision', {
                kind: 'party:decision',
                schema: 1,
                expectedRevision,
                issuerSlot: 'local:0',
                actorId: decision.actorId,
                decisionId: decision.id,
                choiceId: choice
              })
            );
        } finally {
          busy.value = false;
          refresh();
        }
      },
      policy: (emptyPlan: 'wait' | 'interrupt', reaction: 'stop' | 'continue' | 'ai-this-window') =>
        act(() =>
          game.executeCommand('party:policy', {
            kind: 'party:policy',
            schema: 2,
            expectedRevision: root.state.revision,
            issuerSlot: 'local:0',
            actorId: focusedId,
            change: {
              kind: 'reactions',
              emptyPlan,
              values: Object.fromEntries(SOFT_INTERRUPTS.map((k) => [k, reaction]))
            }
          })
        )
    };
    return {
      component: PartyHud,
      props: {
        rosterProps: {
          settlementAvailable: game.extensionRuntime?.manifest.modules.some(m => m.id === 'settlement') ?? false,
          candidates: game.partyRosterCandidates(),
          camps: game.partyStationCamps().map(camp=>({...camp,name:i18next.t('ext.party.roster.camp',{id:camp.id})})),
          focused: focusedId,
          stationReason: focusedId === root.state.primaryActorId ? 'BAD_ACTOR' : focusedId === root.state.leaderActorId ? 'NOT_CONTROLLER' : root.state.window.decision ? 'DECISION_REQUIRED' : busy.value ? 'ACTOR_BUSY' : null,
          join: (targetId: number) => act(() => game.executeCommand('party:roster', {
            kind: 'party:roster', schema: 1, expectedRevision, issuerSlot: 'local:0', actorId: focusedId,
            targetId, operation: 'join', campId: null, level: { kind: 'dungeon', depth: game.depth }
          })),
          station: (campId: number) => act(() => game.executeCommand('party:roster', {
            kind: 'party:roster', schema: 1, expectedRevision, issuerSlot: 'local:0', actorId: focusedId,
            targetId: focusedId, operation: 'station', campId, level: { kind: 'dungeon', depth: game.depth }
          }))
        },
        aiProps: {
          state: structuredClone(root.state),
          focused: focusedId,
          depth: game.depth,
          at: { ...game.focusedActor.loc },
          companions: game.monsters
            .filter((m) => eligiblePartyCompanion(game, m.id))
            .map((m) => ({ id: m.id, name: m.name })),
          enemies: game.monsters
            .filter(
              (m) =>
                m.hp > 0 &&
                !m.isAlly &&
                game.activeControlledActors.some((a) => canSeeMonster(a, game.grid, m))
            )
            .map((m) => ({ id: m.id, name: m.name })),
          pickMap,
          cancelMap: () => {
            cancelMap?.();
            cancelMap = undefined;
            mapToken++;
          },
          send: (change: PartyAiInput['change']) =>
            act(() =>
              game.executeCommand('party:ai', {
                kind: 'party:ai',
                schema: 1,
                expectedRevision,
                issuerSlot: 'local:0',
                change
              })
            ),
          leader: () =>
            act(() =>
              game.executeCommand('party:control', {
                kind: 'party:control',
                schema: 1,
                expectedRevision,
                issuerSlot: 'local:0',
                actorId: focusedId,
                change: { kind: 'leader', actorId: focusedId }
              })
            ),
          step: () => act(() => game.advancePartyToHuman()),
          temporary: () => act(() => planner.edit(focusedId, { kind: 'ai-this-window' }))
        },
        windowProps,
        drawerOpen: drawerOpen.value,
        setDrawer,
        feedback: feedback.value,
        items: game.focusedActor.inventory.items.map((i) => ({
          id: i.id,
          name: i.displayName,
          quantity: i.quantity
        })),
        travel: (direction: number, leave: number[]) =>
          act(() =>
            game.executeCommand('party:control', {
              kind: 'party:control',
              schema: 1,
              expectedRevision: root.state.revision,
              issuerSlot: 'local:0',
              actorId: focusedId,
              change:
                (direction === -1 && game.depth === 1) || (direction === 1 && game.depth === 40)
                  ? { kind: 'exit-party' }
                  : {
                      kind: 'travel-party',
                      destination: { kind: 'dungeon', depth: game.depth + direction },
                      leavingBehind: leave.filter((id) => id !== focusedId)
                    }
            })
          ),
        exchange: (to: number, item: number, quantity: number) =>
          act(() =>
            game.submitPartyIntent({ kind: 'exchange', toActorId: to, itemId: item, quantity })
          ),
        focused: focusedId,
        ready: game.readyPartyActorId,
        members: root.state.members.map((m) => {
          const actor = game.controlledActors.find((a) => a.id === m.actorId)!;
          return {
            id: m.actorId,
            color: PARTY_PLAN_COLORS[paths.findIndex(p => p.actorId === m.actorId) % PARTY_PLAN_COLORS.length] ?? 0x777777,
            hp: actor.hp,
            maxHp: actor.maxHp,
            life: m.life,
            controller: m.controller.kind,
            pendingController: m.pendingController?.kind ?? null,
            temporaryAi: m.temporaryAiSeq !== null,
            remaining: actor.ticksUntilTurn,
            actionBusy: actorActionSchedulerFor(game)?.isBusy(actor.id) ?? false,
            source: ({ creation: 'initial', rescue: 'captive', narrative: 'narrative', resident: 'resident' } as const)[root.state.sources.find(s => s.actorId === m.actorId)!.kind],
            plan: planner.drafts.has(m.actorId) ? planner.drafts.get(m.actorId) : root.state.window.members.find(w => w.actorId === m.actorId)?.plan,
            draft: planner.drafts.has(m.actorId),
            cursor: planner.drafts.has(m.actorId) ? 0 : root.state.window.members.find(w => w.actorId === m.actorId)?.cursor ?? 0,
            depth: m.level.kind === 'dungeon' ? m.level.depth : 0
          };
        }),
        focus: (id: number) => {
          if (host.game() !== game) return;
          cancelMap?.();
          cancelMap = undefined;
          mapToken++;
          game.focusPartyMember(id);
          refresh();
        },
        recover: (depth: number) =>
          act(() => {
            const member = root.state.members.find(
              (m) => m.life === 'frozen' && m.level.kind === 'dungeon' && m.level.depth === depth
            );
            if (member)
              game.executeCommand('party:control', {
                kind: 'party:control',
                schema: 1,
                expectedRevision: root.state.revision,
                issuerSlot: 'local:0',
                actorId: member.actorId,
                change: { kind: 'recover-level', destination: { kind: 'dungeon', depth } }
              });
          })
      }
    };
  });
  watch(hud, slot => {
    const paths = (slot?.props.windowProps as { paths: ReturnType<typeof projectPartyPlans> } | undefined)?.paths;
    cancelOverlay?.();
    if (!paths || host.game() !== game) return;
    const colors = PARTY_PLAN_COLORS;
    cancelOverlay = host.showMapOverlay?.(game, paths.flatMap((path, index) => {
      const color = colors[index % colors.length]!;
      return [...path.points.map((p, i) => ({ ...p, color, kind: i === 0 ? 'actor' as const : path.draft ? 'draft' as const : 'path' as const })),
        ...(path.target ? [{ ...path.target, color, kind: 'target' as const }] : [])];
    }));
  }, { immediate: true });
  return {
    hud,
    bar: ref(null),
    panel: ref(null),
    commands: ref([]),
    panelOpen: drawerOpen,
    refresh,
    close() {
      drawerOpen.value = false;
      cancelMap?.();
      cancelMap = undefined;
      mapToken++;
      cancelOverlay?.();
    }
  };
}

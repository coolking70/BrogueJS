import { PartyFailure } from '../../../party';
import { SOFT_INTERRUPTS, type WindowLength } from '../../../partyWindow';
import { timeSystem } from '../../../../engine/Systems/Time';
import i18next from 'i18next';
import { computed, ref, getCurrentScope, onScopeDispose } from 'vue';
import { observePartyWindows } from '../../../../engine/Core/PartyWindow';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import PartyHud from './PartyHud.vue';
export function usePartyUi(host: ModuleUiHost): ModuleUiSession {
  const feedback = ref<string | null>(null),
    busy = ref(false);
  const revision = ref(0),
    game = host.game(),
    refresh = () => {
      revision.value++;
    };
  const unsubscribe = observePartyWindows(game, refresh);
  if (getCurrentScope()) onScopeDispose(unsubscribe);
  const hud = computed(() => {
    host.tick.value;
    revision.value;
    const root = game.party;
    if (!root) return null;
    const planner = game.partyPlanner()!;
    const expectedRevision = root.state.revision;
    const act = (work: () => void) => {
      if (host.game() !== game || game.party !== root || root.state.revision !== expectedRevision)
        return;
      try {
        work();
        feedback.value = null;
      } catch (error) {
        feedback.value = error instanceof PartyFailure
          ? i18next.t('ext.party.error.' + error.code)
          : i18next.t('ext.party.error.INTERNAL_FAILURE');
      }
      refresh();
    };
    const batch = (length: WindowLength, automatic: boolean) =>
      planner.batch(
        timeSystem.currentTick,
        length,
        length.kind === 'fine' ? game.focusedActor.id : null,
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
    const windowProps = {
      state: structuredClone(root.state.window),
      focused: game.focusedActor.id,
      draft: planner.drafts.get(game.focusedActor.id),
      busy: busy.value,
      preview: planner.preview,
      advance,
      append: (kind: 'wait' | 'search' | 'move', dx = 0, dy = 0) =>
        act(() =>
          planner.append(game.focusedActor.id, kind === 'move' ? { kind, dx, dy } : { kind })
        ),
      clear: () => act(() => planner.edit(game.focusedActor.id, null)),
      keep: () => act(() => planner.keep(game.focusedActor.id)),
      undo: () =>
        act(() => {
          const plan = planner.drafts.get(game.focusedActor.id);
          if (plan?.kind === 'queue')
            planner.edit(game.focusedActor.id, {
              kind: 'queue',
              actions: plan.actions.slice(0, -1)
            });
        }),
      rehearse: async (length: WindowLength, automatic: boolean) => {
        try {
          await planner.rehearse(game.knownPartyWorld(), batch(length, automatic));
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
      policy: (emptyPlan: 'wait' | 'interrupt', reaction: 'stop' | 'continue') =>
        act(() =>
          game.executeCommand('party:policy', {
            kind: 'party:policy',
            schema: 1,
            expectedRevision: root.state.revision,
            issuerSlot: 'local:0',
            actorId: game.focusedActor.id,
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
        windowProps,
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
              actorId: game.focusedActor.id,
              change:
                (direction === -1 && game.depth === 1) || (direction === 1 && game.depth === 40)
                  ? { kind: 'exit-party' }
                  : {
                      kind: 'travel-party',
                      destination: { kind: 'dungeon', depth: game.depth + direction },
                      leavingBehind: leave.filter((id) => id !== game.focusedActor.id)
                    }
            })
          ),
        exchange: (to: number, item: number, quantity: number) =>
          act(() =>
            game.submitPartyIntent({ kind: 'exchange', toActorId: to, itemId: item, quantity })
          ),
        focused: game.focusedActor.id,
        ready: game.readyPartyActorId,
        members: root.state.members.map((m) => {
          const actor = game.controlledActors.find((a) => a.id === m.actorId)!;
          return {
            id: m.actorId,
            hp: actor.hp,
            maxHp: actor.maxHp,
            life: m.life,
            depth: m.level.kind === 'dungeon' ? m.level.depth : 0
          };
        }),
        focus: (id: number) => {
          if (host.game() !== game) return;
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
  return {
    hud,
    bar: ref(null),
    panel: ref(null),
    commands: ref([]),
    panelOpen: ref(false),
    refresh,
    close() {}
  };
}

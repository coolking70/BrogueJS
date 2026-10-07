import { computed, defineAsyncComponent, nextTick, onScopeDispose, ref, shallowRef, type Component } from 'vue';
import i18next from 'i18next';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import { buildCancelCommand, buildCraftCommand, buildHarvestCommand, buildPlaceCommand } from './commands';
import { craftingDirections, emptyCraftingDraft, readCraftingUiView, craftingErrorKey, type CraftingDirection, type CraftingDraft, type CraftingTab, type CraftingUiView } from './view';
const CraftingEntry = defineAsyncComponent(() => import('./CraftingEntry.vue'));
const CraftingWorkHud = defineAsyncComponent(() => import('./CraftingWorkHud.vue'));
interface Presentation { data: CraftingUiView; session: object; readOnly: boolean; replay: boolean; cursor: number; x: number; y: number }
const repeated = (event?: Pick<MouseEvent, 'detail'>) => (event?.detail ?? 0) > 1;

/** All state here is disposable presentation state. Only executeCommand changes the game. */
export function useCraftingUi(host: ModuleUiHost,
  loadPanel: () => Promise<Component> = () => import('./CraftingPanel.vue').then(module => module.default)): ModuleUiSession {
  const game = host.game(), runtime = game.extensionRuntime;
  let retired = false, refreshing = false, openRequest = 0, submission = 0;
  let pending: { ownerCommandId: number; expected: Presentation } | null = null;
  let loadedPanel: Component | null = null, loading: Promise<Component> | null = null;
  const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
  const view = shallowRef<Presentation | null>(null), historyView = shallowRef<CraftingUiView | null>(null);
  const opened = ref(false), submitting = ref(false), panelReady = ref(false), panelLoading = ref(false);
  const draft = shallowRef<CraftingDraft>(emptyCraftingDraft()), error = ref<string | null>(null);
  const AsyncPanel = defineAsyncComponent(() => loadedPanel ? Promise.resolve(loadedPanel) : loadPanel());
  const busy = () => !!host.isPresentationBusy?.();
  const readConfirmation = () => game.pendingCommandConfirmation;
  function read(): Presentation | null {
    if (!live() || busy()) return null;
    try {
      const source = runtime?.readModuleView('crafting', { sourceContainerId: draft.value.sourceContainerId }), data = readCraftingUiView(source?.state);
      if (!source || !data || !source.session || typeof source.session !== 'object') return null;
      return { data, session: source.session, readOnly: !!game.replayRecording || game.isGameOver || !source.canManageCharacter,
        replay: !!game.replayRecording, cursor: game.replayCursor, x: game.player.x, y: game.player.y };
    } catch { return null; }
  }
  function clearDraft() { draft.value = emptyCraftingDraft(); error.value = null; }
  function close() {
    openRequest++; panelLoading.value = false;
    const wasOpen = opened.value; opened.value = false; clearDraft();
    if (wasOpen) { host.cancelHeldKeys?.(); host.afterClosePanel(); }
  }
  function cancelPresentation() { close(); submission++; pending = null; submitting.value = false; }
  function same(expected: Presentation, current: Presentation | null) {
    return !!current && expected.session === current.session && expected.replay === current.replay
      && expected.cursor === current.cursor && expected.x === current.x && expected.y === current.y
      && JSON.stringify(expected.data) === JSON.stringify(current.data);
  }
  function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!live()) { cancelPresentation(); view.value = null; historyView.value = null; return; }
      if (busy()) {
        // ACK frames can contain earlier work. Missing historical DTO stays absent.
        historyView.value = readCraftingUiView(host.readDisplayFrame?.().moduleViews?.crafting);
        cancelPresentation(); view.value = null; return;
      }
      historyView.value = null;
      if (host.canPresentInteraction?.() === false) { cancelPresentation(); view.value = null; return; }
      const next = read(), previous = view.value;
      if (!next) { cancelPresentation(); view.value = null; return; }
      if (previous && (previous.session !== next.session || previous.replay !== next.replay || previous.cursor !== next.cursor
        || previous.x !== next.x || previous.y !== next.y)) clearDraft();
      view.value = next;
      // Resource changes clamp display drafts; they never spend resources.
      const batches: Record<string, number> = {};
      for (const recipe of next.data.recipes) if (draft.value.batches[recipe.recipeId] !== undefined)
        batches[recipe.recipeId] = Math.min(Math.max(1, draft.value.batches[recipe.recipeId]!), Math.max(1, recipe.maxBatch));
      draft.value = { ...draft.value, batches, destinationContainerId: next.data.containers.some(c => c.id === draft.value.destinationContainerId && c.inReach)
        ? draft.value.destinationContainerId : null };
      if (pending && game.pendingCommandConfirmation?.ownerCommandId !== pending.ownerCommandId) {
        const was = pending; pending = null; submitting.value = false;
        // A declined confirmation is an intentional no-op, not a rejected CAS.
        if (next.data.lastError) error.value = craftingErrorKey(next.data.lastError, key => i18next.exists(key));
        else if (same(was.expected, next) && !game.recordedInputEvents[game.recordedInputEvents.length - 1]?.decisions?.includes(false)) error.value = 'ext.crafting.ui.rejected';
      }
    } finally { refreshing = false; }
  }
  const blockedOpen = () => !live() || busy() || host.canPresentInteraction?.() === false || !host.canOpenPanel();
  async function open() {
    if (opened.value || panelLoading.value || blockedOpen()) return;
    refresh(); if (!view.value) return;
    const request = ++openRequest;
    panelLoading.value = true;
    try {
      loading ??= loadPanel();
      loadedPanel = await loading;
      if (!loadedPanel) throw new Error('Missing panel');
      if (!live() || request !== openRequest || blockedOpen()) return;
      refresh(); if (!view.value) return;
      host.beforeOpenPanel();
      if (!live() || blockedOpen()) return;
      clearDraft(); panelReady.value = true; opened.value = true;
    } catch { loading = null; if (live() && request === openRequest) error.value = 'ext.crafting.ui.rejected'; }
    finally { if (live() && request === openRequest) panelLoading.value = false; }
  }
  function changeTab(tab: CraftingTab) {
    if (!live() || !opened.value || !['harvest', 'craft', 'station', 'work'].includes(tab)) return;
    draft.value = { ...draft.value, tab }; error.value = null;
  }
  function adjust(recipeId: string, amount: number, event?: MouseEvent) {
    if (repeated(event) || !live() || !opened.value || submitting.value || view.value?.readOnly || (amount !== -1 && amount !== 1)) return;
    const recipe = view.value?.data.recipes.find(row => row.recipeId === recipeId);
    if (!recipe || recipe.maxBatch < 1) return;
    const count = Math.min(recipe.maxBatch, Math.max(1, (draft.value.batches[recipeId] ?? 1) + amount));
    draft.value = { ...draft.value, batches: { ...draft.value.batches, [recipeId]: count } }; error.value = null;
  }
  function direction(definitionId: string, value: CraftingDirection, event?: MouseEvent) {
    if (repeated(event) || !live() || !opened.value || submitting.value || view.value?.readOnly
      || !view.value?.data.placements.some(row => row.definitionId === definitionId && row.source)
      || !craftingDirections.some(row => row.id === value)) return;
    draft.value = { ...draft.value, directions: { ...draft.value.directions, [definitionId]: value } }; error.value = null;
  }
  function chooseContainer(role: 'source' | 'destination', id: number | null) {
    if (!live() || !opened.value || busy() || submitting.value || view.value?.readOnly
      || (id !== null && !view.value?.data.containers.some(c => c.id === id && c.inReach))) return;
    draft.value = { ...draft.value, [role === 'source' ? 'sourceContainerId' : 'destinationContainerId']: id, batches: {} };
    error.value = null; refresh();
  }
  const canStop = () => view.value?.data.activeTicket?.status === 'working'
    && !game.actorActions?.bundles.some(bundle => bundle.decisionOwnerId === game.player.id);
  async function submit(expected: Presentation, command: string | null, event?: MouseEvent) {
    if (repeated(event) || !opened.value || !live() || submitting.value || expected.readOnly || busy()
      || host.canPresentInteraction?.() === false || !!game.pendingCommandConfirmation) return;
    const current = read();
    if (!command || !same(expected, current) || current?.readOnly) { error.value = 'ext.crafting.error.stale'; refresh(); return; }
    const token = ++submission;
    submitting.value = true; error.value = null;
    try {
      game.executeCommand('ext:command', command);
      if (!live()) return;
      const confirmation = readConfirmation();
      if (confirmation) pending = { ownerCommandId: confirmation.ownerCommandId, expected };
      refresh();
      if (!busy() && !pending) {
        if (view.value?.data.lastError) error.value = craftingErrorKey(view.value.data.lastError, key => i18next.exists(key));
        else if (same(expected, view.value)) error.value = 'ext.crafting.ui.rejected';
      }
    } catch { if (live()) { error.value = 'ext.crafting.ui.rejected'; refresh(); } }
    finally { await nextTick(); if (live() && token === submission) submitting.value = pending !== null; }
  }
  const removeKeys = host.registerKeyHandler?.(event => {
    if (!opened.value || !live() || busy()) return false;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else {
      const target = event.target as HTMLElement | null;
      if (!target?.closest?.('[data-map-drawer]')) return false;
      if (target.tagName !== 'SELECT' && !['Tab', 'Enter', ' '].includes(event.key)) event.preventDefault();
    }
    return true;
  }, 580);
  const removeSource = host.dialogs?.registerSource(refresh, -25);
  const removeReset = host.dialogs?.onReset(cancelPresentation);
  const browser = typeof window === 'undefined' ? null : window;
  const blur = (event: Event) => { if (event.target === browser) cancelPresentation(); };
  browser?.addEventListener('blur', blur);
  onScopeDispose(() => { retired = true; cancelPresentation(); removeKeys?.(); removeSource?.(); removeReset?.(); browser?.removeEventListener('blur', blur); });
  refresh();
  return {
    panelOpen: opened, refresh, close,
    commands: computed(() => {
      host.tick.value;
      return [{ id: 'crafting.open', label: i18next.t('ext.crafting.ui.open'), glyph: '匠',
        disabled: !view.value || blockedOpen() || panelLoading.value, invoke: () => { void open(); } }];
    }),
    bar: computed(() => {
      host.tick.value;
      // The shell hides its command strip in immersive mode and mobile replay.
      // Use the existing reserved module bar so viewing crafting stays reachable.
      return view.value && !opened.value && (host.immersive.value || game.replayRecording) ? { component: CraftingEntry,
        props: { blocked: blockedOpen() || panelLoading.value, onOpen: () => { void open(); } } } : null;
    }),
    hud: computed(() => {
      const data = busy() ? historyView.value : view.value?.data;
      return data?.activeTicket ? { component: CraftingWorkHud, props: { ticket: data.activeTicket } } : null;
    }),
    panel: computed(() => {
      const expected = view.value;
      if (!opened.value || !panelReady.value || !expected) return null;
      return { component: AsyncPanel, props: {
        model: expected.data, readOnly: expected.readOnly, replay: expected.replay, draft: draft.value,
        submitting: submitting.value, error: error.value, canStop: canStop(), immersive: host.immersive.value,
        onClose: close, onTab: changeTab, onAdjust: adjust, onDirection: direction, onContainer: chooseContainer,
        onHarvest: (id: number, event?: MouseEvent) => submit(expected, buildHarvestCommand(expected.data, id, draft.value.destinationContainerId === null ? null
          : (() => { const c = expected.data.containers.find(c => c.id === draft.value.destinationContainerId);
            return c ? { id: c.id, revision: c.revision } : null; })()), event),
        onCraft: (id: string, event?: MouseEvent) => submit(expected, buildCraftCommand(expected.data, id, draft.value.batches[id] ?? 1), event),
        onPlace: (id: string, event?: MouseEvent) => {
          const selected = craftingDirections.find(row => row.id === draft.value.directions[id]);
          if (selected) return submit(expected, buildPlaceCommand(expected.data, id, { x: expected.x + selected.dx, y: expected.y + selected.dy }), event);
        },
        onCancelWork: (event?: MouseEvent) => { if (canStop()) return submit(expected, buildCancelCommand(expected.data), event); },
      } };
    }),
  };
}

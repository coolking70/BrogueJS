import { computed, defineAsyncComponent, nextTick, onScopeDispose, ref, shallowRef, type Component } from 'vue';
import i18next from 'i18next';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import { buildFeedCommand, buildHarvestCommand, buildRoastCommand } from './commands';
import { emptyForagingDraft, foragingCompanionCards, foragingNodeCards, readForagingUiView, type ForagingDraft, type ForagingTab, type ForagingUiView } from './view';
const CompanionHud = defineAsyncComponent(() => import('./ForagingCompanionHud.vue'));
const Entry = defineAsyncComponent(() => import('./ForagingEntry.vue'));
interface Presentation { data: ForagingUiView; session: object; frame: DisplayFrame | null; readOnly: boolean; replay: boolean; cursor: number; epoch: number }
const repeated = (event?: Pick<MouseEvent, 'detail'>) => (event?.detail ?? 0) > 1;

/** Disposable display state. Only the three public commands can change the game. */
export function useForagingUi(host: ModuleUiHost,
  loadPanel: () => Promise<Component> = () => import('./ForagingPanel.vue').then(module => module.default)): ModuleUiSession {
  const game = host.game(), runtime = game.extensionRuntime;
  let retired = false, refreshing = false, openRequest = 0, submission = 0, presentationEpoch = 0;
  let loading: Promise<Component> | null = null, loadedPanel: Component | null = null;
  let pending: { ownerCommandId: number; expected: Presentation; beforeEvents: number } | null = null;
  const view = shallowRef<Presentation | null>(null), historical = shallowRef<Presentation | null>(null);
  const opened = ref(false), panelLoading = ref(false), submitting = ref(false);
  const draft = shallowRef<ForagingDraft>(emptyForagingDraft()), error = ref<string | null>(null);
  const Panel = defineAsyncComponent(() => loadedPanel ? Promise.resolve(loadedPanel) : loadPanel());
  const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
  const busy = () => !!host.isPresentationBusy?.();
  const readConfirmation = () => game.pendingCommandConfirmation;
  const blockedOpen = () => !live() || busy() || host.canPresentInteraction?.() === false || !host.canOpenPanel();
  const companions = (current: Presentation) => foragingCompanionCards(current.data, current.frame, i18next.t('ext.foraging.ui.companion.unknown_name'));
  function read(): Presentation | null {
    if (!live() || busy()) return null;
    try {
      const source = runtime?.readModuleView('foraging'), data = readForagingUiView(source?.state);
      if (!data || !source?.session || typeof source.session !== 'object') return null;
      return { data, session: source.session, frame: host.readDisplayFrame?.() ?? null,
        readOnly: !!game.replayRecording || game.isGameOver || !source.canManageCharacter,
        replay: !!game.replayRecording, cursor: game.replayCursor, epoch: presentationEpoch };
    } catch { return null; }
  }
  function clearDraft() { draft.value = emptyForagingDraft(); error.value = null; }
  function close() {
    openRequest++; presentationEpoch++; panelLoading.value = false;
    const wasOpen = opened.value; opened.value = false; clearDraft();
    if (wasOpen) { host.cancelHeldKeys?.(); host.afterClosePanel(); }
  }
  function cancelPresentation() { close(); submission++; pending = null; submitting.value = false; }
  const location = (current: Presentation) => [current.frame?.depth, current.frame?.player.x, current.frame?.player.y];
  function same(expected: Presentation, current: Presentation | null) {
    return !!current && expected.epoch === current.epoch && expected.session === current.session && expected.replay === current.replay && expected.cursor === current.cursor
      && JSON.stringify(location(expected)) === JSON.stringify(location(current))
      && JSON.stringify(expected.data) === JSON.stringify(current.data)
      && JSON.stringify(companions(expected)) === JSON.stringify(companions(current));
  }
  function defaultChoices(current: Presentation) {
    const adjacent = companions(current).filter(row => row.adjacent && !row.departing);
    draft.value = { ...draft.value, nodeId: foragingNodeCards(current.data, current.frame)[0]?.interactableId ?? null,
      heatSourceId: [...current.data.heatSources].sort((a, b) => a.interactableId - b.interactableId)[0]?.interactableId ?? null,
      targetId: adjacent.length === 1 ? adjacent[0]!.actorId : null };
  }
  function declined(before: number) {
    return game.recordedInputEvents.slice(before).some(event => event.decisions?.includes(false));
  }
  function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      if (!live()) { cancelPresentation(); view.value = null; historical.value = null; return; }
      if (busy()) {
        const frame = host.readDisplayFrame?.() ?? null, data = readForagingUiView(frame?.moduleViews?.foraging);
        historical.value = data && frame ? { data, frame, session: {}, readOnly: true, replay: false, cursor: 0, epoch: presentationEpoch } : null;
        cancelPresentation(); view.value = null; return;
      }
      historical.value = null;
      if (host.canPresentInteraction?.() === false) { cancelPresentation(); view.value = null; return; }
      const next = read(), previous = view.value;
      if (!next) { cancelPresentation(); view.value = null; return; }
      const reset = previous && (previous.session !== next.session || previous.replay !== next.replay || previous.cursor !== next.cursor
        || JSON.stringify(location(previous)) !== JSON.stringify(location(next)));
      if (reset) clearDraft();
      view.value = next;
      if (!reset) {
        const choices = companions(next), nodes = foragingNodeCards(next.data, next.frame);
        draft.value = { ...draft.value,
          nodeId: nodes.some(row => row.interactableId === draft.value.nodeId) ? draft.value.nodeId : null,
          heatSourceId: next.data.heatSources.some(row => row.interactableId === draft.value.heatSourceId) ? draft.value.heatSourceId : null,
          itemId: next.data.foods.some(row => row.itemId === draft.value.itemId && (draft.value.tab !== 'roast' || row.roastable)) ? draft.value.itemId : null,
          targetId: choices.some(row => row.actorId === draft.value.targetId && row.adjacent && !row.departing) ? draft.value.targetId : null };
      }
      if (pending && game.pendingCommandConfirmation?.ownerCommandId !== pending.ownerCommandId) {
        const was = pending; pending = null; submitting.value = false;
        if (same(was.expected, next) && !declined(was.beforeEvents)) error.value = 'ext.foraging.ui.rejected';
      }
    } finally { refreshing = false; }
  }
  async function open() {
    if (opened.value || panelLoading.value || blockedOpen()) return;
    refresh(); if (!view.value) return;
    const request = ++openRequest; panelLoading.value = true;
    try {
      loading ??= loadPanel(); loadedPanel = await loading;
      if (!loadedPanel) throw new Error('panel');
      if (!live() || request !== openRequest || blockedOpen()) return;
      refresh(); if (!view.value) return;
      host.beforeOpenPanel();
      if (!live() || blockedOpen()) return;
      clearDraft(); defaultChoices(view.value); opened.value = true;
    } catch { loading = null; if (live() && request === openRequest) error.value = 'ext.foraging.ui.rejected'; }
    finally { if (live() && request === openRequest) panelLoading.value = false; }
  }
  function tab(value: ForagingTab) {
    if (!live() || !opened.value || submitting.value || !['harvest', 'roast', 'feed'].includes(value)) return;
    draft.value = { ...draft.value, tab: value, itemId: null }; error.value = null;
    if (view.value) defaultChoices(view.value);
  }
  function choose(kind: 'nodeId' | 'heatSourceId' | 'itemId' | 'targetId', id: number, event?: MouseEvent) {
    const current = view.value;
    if (repeated(event) || !live() || !opened.value || busy() || submitting.value || !current || current.readOnly) return;
    const valid = kind === 'nodeId' ? foragingNodeCards(current.data, current.frame).some(row => row.interactableId === id)
      : kind === 'heatSourceId' ? current.data.heatSources.some(row => row.interactableId === id)
        : kind === 'itemId' ? current.data.foods.some(row => row.itemId === id && (draft.value.tab !== 'roast' || row.roastable))
          : companions(current).some(row => row.actorId === id && row.adjacent && !row.departing);
    if (valid) { draft.value = { ...draft.value, [kind]: id }; error.value = null; }
  }
  async function submit(expected: Presentation, command: string | null, event?: MouseEvent) {
    if (repeated(event) || !live() || !opened.value || submitting.value || busy() || expected.readOnly
      || host.canPresentInteraction?.() === false || game.pendingCommandConfirmation) return;
    const current = read();
    if (!command || !same(expected, current) || current?.readOnly) { error.value = 'ext.foraging.error.stale'; refresh(); return; }
    const token = ++submission, beforeEvents = game.recordedInputEvents.length;
    submitting.value = true; error.value = null;
    try {
      game.executeCommand('ext:command', command);
      if (!live()) return;
      const confirmation = readConfirmation();
      if (confirmation) pending = { ownerCommandId: confirmation.ownerCommandId, expected, beforeEvents };
      refresh();
      // The fixed public DTO has no command-error field. Do not read private
      // engine state or mistake a declined foundation confirmation for failure.
      if (!busy() && !pending && same(expected, view.value) && !declined(beforeEvents)) error.value = 'ext.foraging.ui.rejected';
    } catch { if (live()) { refresh(); error.value = 'ext.foraging.ui.rejected'; } }
    finally { await nextTick(); if (live() && token === submission) submitting.value = pending !== null; }
  }
  const removeKeys = host.registerKeyHandler?.(event => {
    if (!opened.value || !live() || busy()) return false;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (!['Tab', 'Enter', ' '].includes(event.key)) event.preventDefault();
    return true;
  }, 580);
  const removeSource = host.dialogs?.registerSource(refresh, -25), removeReset = host.dialogs?.onReset(cancelPresentation);
  const browser = typeof window === 'undefined' ? null : window;
  const blur = (event: Event) => { if (event.target === browser) cancelPresentation(); };
  browser?.addEventListener('blur', blur);
  onScopeDispose(() => { retired = true; cancelPresentation(); removeKeys?.(); removeSource?.(); removeReset?.(); browser?.removeEventListener('blur', blur); });
  refresh();
  return {
    panelOpen: opened, refresh, close,
    commands: computed(() => { host.tick.value; return [{ id: 'foraging.open', label: i18next.t('ext.foraging.ui.open'), glyph: '菌',
      disabled: !view.value || blockedOpen() || panelLoading.value, invoke: () => { void open(); } }]; }),
    bar: computed(() => { host.tick.value; return view.value && !opened.value && (host.immersive.value || game.replayRecording)
      ? { component: Entry, props: { blocked: blockedOpen() || panelLoading.value, onOpen: () => { void open(); } } } : null; }),
    hud: computed(() => {
      const current = busy() ? historical.value : view.value;
      if (!current || !current.data.companions.some(row => row.band !== 'fed' || row.departing)) return null;
      return { component: CompanionHud, props: { companions: companions(current) } };
    }),
    panel: computed(() => {
      const expected = view.value;
      if (!opened.value || !expected) return null;
      return { component: Panel, props: { model: expected.data, nodes: foragingNodeCards(expected.data, expected.frame), companions: companions(expected),
        draft: draft.value, readOnly: expected.readOnly, replay: expected.replay, submitting: submitting.value, error: error.value, immersive: host.immersive.value,
        onClose: close, onTab: tab, onChoose: choose,
        onHarvest: (id: number, event?: MouseEvent) => foragingNodeCards(expected.data, expected.frame).some(row => row.interactableId === id)
          ? submit(expected, buildHarvestCommand(expected.data, id), event) : undefined,
        onRoast: (heat: number, item: number, event?: MouseEvent) => submit(expected, buildRoastCommand(expected.data, heat, item), event),
        onFeed: (target: number, item: number, event?: MouseEvent) => companions(expected).some(row => row.actorId === target && row.adjacent && !row.departing)
          ? submit(expected, buildFeedCommand(expected.data, target, item), event) : undefined } };
    }),
  };
}

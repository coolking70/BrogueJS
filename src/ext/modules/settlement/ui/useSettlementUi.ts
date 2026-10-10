import { computed, defineAsyncComponent, onScopeDispose, ref, shallowRef, nextTick } from 'vue';
import i18next from 'i18next';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import { base, payment, readView, campBounds, clampMapTarget, type SettlementView } from './view';
import { RESIDENT_ACTIONS } from '../../../residentSdk';
import type { ItemAmount } from '../../../worldSdk';
const Panel = defineAsyncComponent(() => import('./SettlementPanel.vue'));
const Entry = defineAsyncComponent(() => import('./SettlementEntry.vue'));
export function useSettlementUi(host: ModuleUiHost): ModuleUiSession {
  const game = host.game(),
    runtime = game.extensionRuntime,
    owner = {},
    opened = ref(false),
    submitting = ref(false),
    model = shallowRef<SettlementView | null>(null);
  const kitId = ref<string | null>(null),
    tab = ref('camp'),
    collapsed = ref(false),
    campTarget = shallowRef({ x: 1, y: 1 }),
    selected = ref('settlement.wood-floor'),
    cursor = shallowRef({ x: 0, y: 0 }),
    draft = shallowRef<{ x: number; y: number; definitionId: string }[]>([]),
    sourceId = ref<number | null>(null),
    materials = shallowRef<Record<string, string>>({}),
    food = shallowRef<Record<number, number>>({}),
    error = ref<string | null>(null);
  let removeMap: (() => void) | undefined,
    retired = false,
    queue = false,
    wasAdvancing = false,
    restRequested = false,
    queued = 0;
  const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
  // Match shared module presentation: live lag pauses UI, replay/seek stays readable.
  const presentationBusy = () => !game.replayRecording && !!host.isPresentationBusy?.();
  const blocked = () =>
    !live() || presentationBusy() || host.canPresentInteraction?.() === false;
  function reset() {
    queue = false;
    restRequested = false;
    queued++;
    draft.value = [];
    removeMap?.();
    removeMap = undefined;
  }
  function close() {
    const wasOpen = opened.value;
    opened.value = false;
    reset();
    if (wasOpen) {
      host.cancelHeldKeys?.();
      host.afterClosePanel();
    }
  }
  const campSelecting = () => tab.value === 'camp' && !model.value?.camps.some((c) => !c.remote);
  function selectMap() {
    removeMap?.();
    removeMap = undefined;
    if (!opened.value || collapsed.value || blocked()) return;
    if (tab.value !== 'build' && tab.value !== 'residents' && !campSelecting()) return;
    const b = campBounds(campTarget.value);
    const cells = campSelecting()
      ? Array.from({length: b.width * b.height}, (_, k) => ({x: b.x + k % b.width, y: b.y + Math.floor(k / b.width)}))
      : [...draft.value, cursor.value];
    const selectionEpoch = queued;
    removeMap = host.selectMapCells?.(owner, (p) => {
      if (!opened.value || collapsed.value || blocked() || queued !== selectionEpoch) return;
      if (campSelecting()) campTarget.value = clampMapTarget(p);
      else cursor.value = clampMapTarget(p);
      selectMap();
    }, cells);
  }
  function read() {
    if (blocked()) return null;
    return readView(runtime?.readModuleView('settlement')?.state);
  }
  function refresh() {
    if (!live() || host.canPresentInteraction?.() === false) {
      close();
      model.value = null;
      return;
    }
    if (presentationBusy()) {
      // The host hides the presentation root. Keep the previous DTO and pause
      // the display-only queue until ACK/animation catches up; never read ahead.
      removeMap?.();
      removeMap = undefined;
      return;
    }
    const next = read();
    if (!next) {
      close();
      model.value = null;
      return;
    }
    if (model.value && game.replayRecording && model.value.inventoryStamp !== next.inventoryStamp)
      reset();
    model.value = next;
    if (
      queue &&
      !game.isAdvancing &&
      !game.hasPendingConfirmation &&
      !presentationBusy()
    ) {
      if (
        next.lastError ||
        game.isGameOver ||
        !next.available ||
        game.recordedInputEvents[game.recordedInputEvents.length - 1]?.decisions?.includes(false)
      ) {
        reset();
        submitting.value = false;
      } else if (wasAdvancing) {
        wasAdvancing = false;
        void runNext();
      }
    }
    if (!game.hasPendingConfirmation && !game.isAdvancing) {
      submitting.value = false;
      if (restRequested) {
        restRequested = false;
        if (game.hasFoundationRestPoint()) close();
      }
    }
    selectMap();
  }
  async function open() {
    if (blocked() || !host.canOpenPanel()) return;
    refresh();
    if (!model.value) return;
    host.beforeOpenPanel();
    cursor.value = clampMapTarget({ x: model.value.at.x + 1, y: model.value.at.y });
    campTarget.value = { ...cursor.value };
    collapsed.value = false;
    opened.value = true;
    food.value = {};
    error.value = null;
    selectMap();
  }
  function payload(action: string, v: SettlementView, extra: Record<string, unknown> = {}) {
    const common = action === 'rest' || (RESIDENT_ACTIONS as readonly string[]).includes(action) ? { v: 1, stateRevision: v.revision } : base(v);
    return JSON.stringify({ module: 'settlement', action, payload: { ...common, ...extra } });
  }
  function send(action: string, p: Record<string, unknown>) {
    if (
      blocked() ||
      !opened.value ||
      submitting.value ||
      game.replayRecording ||
      game.isGameOver ||
      game.hasPendingConfirmation ||
      game.isAdvancing
    )
      return false;
    const current = read();
    if (!current) return false;
    submitting.value = true;
    error.value = null;
    try {
      game.executeCommand('ext:command', payload(action, current, p));
    } catch {
      error.value = 'ext.settlement.ui.rejected';
    } finally {
      if (!game.hasPendingConfirmation && !game.isAdvancing) submitting.value = false;
      refresh();
    }
    return true;
  }
  function resident(action:string,id:number,extra:Record<string,unknown>={}){
    const v=read();if(!v)return;
    const row=v.residents?.residents.find(r=>r.id===id),candidate=v.residents?.candidates.find(r=>r.id===id);
    const camp=v.camps.find(c=>row?c.regionId===row.campId:!c.remote);if(!camp)return;
    const p:Record<string,unknown>={campId:camp.regionId,campRevision:camp.revision,...extra};
    if(action==='set-granary'){const box=v.boxes.find(b=>b.id===id);if(!box)return;p.containerId=id;p.containerRevision=box.revision;}
    else {p.targetId=id;p.targetRevision=row?.revision??candidate?.revision;if(p.targetRevision===undefined)return;}
    if(action==='order-work'||action==='resupply-work'||action==='cancel-order'){
      const order=v.production?.orders.find(o=>o.actorId===id);
      if(action!=='order-work'){if(!order)return;p.orderId=order.id;p.orderRevision=order.revision;}
      if(action!=='cancel-order'){
        const input=action==='order-work'?extra:order!;
        const boxes=v.jobTargets?.find(t=>t.campId===row?.campId)?.boxes;
        const source=boxes?.find(b=>b.id===input.sourceId),destination=boxes?.find(b=>b.id===input.destinationId);
        if(!source||!destination)return;
        p.sourceRevision=source.revision;p.destinationRevision=destination.revision;
        p.stationRevision=v.production?.stations.find(s=>s.id===input.stationId)?.revision??null;
        p.plotRevisions=(input.plotIds as number[]).map(id=>v.jobTargets?.find(t=>t.campId===row?.campId)?.plots.find(p=>p.id===id)?.revision);
        if((p.plotRevisions as unknown[]).some(r=>r===undefined))return;
        p.inventoryStamp=v.inventoryStamp;
      }
    }
    if(action==='assign-job'){
      const job=extra.job as {kind:string;sourceId?:number;destinationId?:number;plotIds?:number[]};
      const targets = v.jobTargets?.find(t => t.campId === row?.campId);
      if (job.kind === 'plant' || job.kind === 'haul') {
        const source = targets?.boxes.find(b => b.id === job.sourceId);
        const destination = targets?.boxes.find(b => b.id === job.destinationId);
        const plots = job.plotIds?.map(id => targets?.plots.find(c => c.id === id)) ?? [];
        if (!source || !destination || plots.some(p => !p)) return;
        // Hidden box metadata grants no access to hidden haul stock.
        if (job.kind === 'haul' && !v.boxes.some(b => b.id === job.sourceId)) return;
        p.sourceRevision = source.revision;
        p.destinationRevision = destination.revision;
        p.componentRevisions = plots.map(p => p!.revision);
      } else {
        p.sourceRevision = p.destinationRevision = null;
        p.componentRevisions = [];
      }
      p.inventoryStamp=v.inventoryStamp;
    }
    send(action,p);
  }
  function paid(v: SettlementView, cost: readonly ItemAmount[]) {
    const p = payment(v, cost, sourceId.value, materials.value);
    if (tab.value === 'build' && kitId.value)
      p.materials = [{ itemDefinitionId: kitId.value, count: 1 }];
    const { v: _, stateRevision: __, inventoryStamp: ___, ...rest } = p;
    return rest;
  }
  function establish() {
    const v = read();
    if (!v) return;
    send('establish', {
      ...paid(v, v.policy.createCost),
      ...campTarget.value,
      bounds: campBounds(campTarget.value),
      food: Object.entries(food.value)
        .filter(([, q]) => q > 0)
        .map(([id, quantity]) => ({ itemId: Number(id), quantity }))
    });
  }
  function expand(direction: string) {
    const v = read(),
      c = v?.camps.find((c) => !c.remote);
    if (!v || !c) return;
    const b = { ...c.bounds };
    if (direction === 'e') b.width++;
    if (direction === 's') b.height++;
    if (direction === 'w') {
      b.x--;
      b.width++;
    }
    if (direction === 'n') {
      b.y--;
      b.height++;
    }
    send('expand', {
      ...paid(v, v.policy.expandCost),
      regionId: c.regionId,
      regionRevision: c.regionRevision,
      bounds: b
    });
  }
  function retire() {
    const v = read(),
      c = v?.camps.find((c) => !c.remote);
    if (v && c) send('retire', { regionId: c.regionId, regionRevision: c.regionRevision });
  }
  function append() {
    if (draft.value.length >= 16 || !model.value?.available) return;
    const p = { ...cursor.value, definitionId: selected.value };
    if (!draft.value.some((d) => d.x === p.x && d.y === p.y && d.definitionId === p.definitionId))
      draft.value = [...draft.value, p];
    selectMap();
  }
  async function runNext() {
    const displayEpoch = queued;
    if (!queue || !draft.value.length) {
      reset();
      return;
    }
    const v = read(),
      c = v?.camps.find((c) => !c.remote),
      p = draft.value[0]!;
    if (!v || !c || game.isGameOver) {
      reset();
      return;
    }
    const d = v.definitions.find((d) => d.id === p.definitionId)!;
    // Revalidate one public command after every native time boundary. No future
    // input or ID is reserved for the rest of this display-only draft.
    submitting.value = false;
    const accepted = send('build', {
      ...paid(v, d.constructionCost),
      regionId: c.regionId,
      regionRevision: c.regionRevision,
      ...p
    });
    if (!accepted) {
      reset();
      return;
    }
    draft.value = draft.value.slice(1);
    wasAdvancing = true;
    await nextTick();
    if (queue && queued === displayEpoch && !game.isAdvancing && !game.hasPendingConfirmation) {
      submitting.value = false;
      refresh();
    }
  }
  function construct() {
    if (queue || !draft.value.length) return;
    draft.value = [...draft.value].sort(
      (a, b) =>
        a.y - b.y ||
        a.x - b.x ||
        ['floor', 'barrier', 'roof', 'fixture'].indexOf(
          model.value!.definitions.find((d) => d.id === a.definitionId)!.slot
        ) -
          ['floor', 'barrier', 'roof', 'fixture'].indexOf(
            model.value!.definitions.find((d) => d.id === b.definitionId)!.slot
          ) ||
        (a.definitionId < b.definitionId ? -1 : a.definitionId > b.definitionId ? 1 : 0)
    );
    queue = true;
    void runNext();
  }
  function transfer(
    containerId: number,
    itemId: number,
    quantity: number,
    direction: 'deposit' | 'withdraw'
  ) {
    const v = read(),
      box = v?.boxes.find((b) => b.id === containerId);
    if (v && box)
      send('transfer', {
        containerId,
        containerRevision: box.revision,
        items: [{ itemId, quantity }],
        direction
      });
  }
  function rest(restPointId: number) {
    const v = read(),
      r = v?.restPoints.find((r) => r.interactableId === restPointId);
    if (!v || !r) return;
    restRequested = true;
    if (!send('rest', { restPointId, restPointRevision: r.revision })) restRequested = false;
  }
  function part(action: string, componentId: number) {
    const v = read(),
      c = v?.components.find((c) => c.id === componentId);
    if (v && c)
      send(action, {
        componentId,
        componentRevision: c.revision,
        ...(action === 'door' ? { open: !c.doorOpen } : {}),
        ...(action === 'repair' ? (()=>{const d=v.definitions.find(d=>d.id===c.definitionId)!;const amount=d.maxHp-c.hp;return {...payment(v,d.constructionCost.map(a=>({...a,count:Math.ceil(a.count*amount/d.maxHp)})),sourceId.value,{}),amount};})() : {})
      });
  }
  function harvest(nodeId: number) {
    const v = read(),
      n = v?.nodes.find((n) => n.interactableId === nodeId);
    if (!v || !n || submitting.value) return;
    game.executeCommand(
      'ext:command',
      JSON.stringify({
        module: 'settlement',
        action: 'harvest',
        payload: {
          v: 1,
          nodeId,
          nodeRevision: n.revision,
          inventoryStamp: v.inventoryStamp,
          destinationId: null,
          destinationRevision: null
        }
      })
    );
    refresh();
  }
  const removeKeys = host.registerKeyHandler?.((e) => {
    if (!opened.value || blocked()) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return true;
    }
    const d: Record<string, number[]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0]
    };
    if ((e.target as HTMLElement | null)?.closest?.('[data-map-drawer]')) return true;
    if (!collapsed.value && (tab.value === 'build' || tab.value === 'residents' || campSelecting()) && d[e.key]) {
      e.preventDefault();
      const [dx, dy] = d[e.key]!;
      const target = campSelecting() ? campTarget : cursor;
      target.value = clampMapTarget({ x: target.value.x + dx!, y: target.value.y + dy! });
      selectMap();
      return true;
    }
    return false;
  }, 580);
  const removeReset = host.dialogs?.onReset(close),
    removeSource = host.dialogs?.registerSource(() => {
      if (!game.hasPendingConfirmation && !game.isAdvancing) submitting.value = false;
      refresh();
    }, -25);
  const blur = (e: Event) => {
    if (e.target === window) close();
  };
  if (typeof window !== 'undefined') window.addEventListener('blur', blur);
  onScopeDispose(() => {
    retired = true;
    reset();
    removeKeys?.();
    removeReset?.();
    removeSource?.();
    if (typeof window !== 'undefined') window.removeEventListener('blur', blur);
  });
  refresh();
  return {
    panelOpen: opened,
    refresh,
    close,
    hud: computed(() => null),
    bar: computed(() => {
      // Replay hides App's gameplay CommandBar in every display mode. Native
      // Game flags and panel eligibility follow the shell's ordinary poll.
      host.tick.value;
      return (host.immersive.value || !!game.replayRecording) && !opened.value
        ? { component: Entry, props: { onOpen: open, disabled: blocked() || !model.value || !host.canOpenPanel() } }
        : null;
    }),
    commands: computed(() => {
      // Native Game eligibility is not reactive; keep the shell refresh edge
      // even when blocked() short-circuits the model dependency.
      host.tick.value;
      return [
      {
        id: 'settlement.open',
        label: i18next.t('ext.settlement.ui.open'),
        glyph: '营',
        disabled: blocked() || !model.value,
        invoke: () => {
          void open();
        }
      }
      ];
    }),
    panel: computed(() =>
      opened.value && model.value
        ? {
            component: Panel,
            props: {
              model: model.value,
              replayReadonly: !!game.replayRecording,
              tab: tab.value,
              selected: selected.value,
              cursor: cursor.value,
              campTarget: campTarget.value,
              campBounds: campBounds(campTarget.value),
              collapsed: collapsed.value,
              onCollapse: () => { collapsed.value = !collapsed.value; reset(); selectMap(); },
              onCampTarget: (x: number, y: number) => { campTarget.value = clampMapTarget({x,y}); selectMap(); },
              draft: draft.value,
              sourceId: sourceId.value,
              materials: materials.value,
              kitId: kitId.value,
              food: food.value,
              blocked: submitting.value || !model.value.available,
              error: error.value,
              onClose: close,
              onTab: (value: string) => {
                tab.value = value;
                reset();
                selectMap();
              },
              onSelect: (value: string) => {
                selected.value = value;
                kitId.value = null;
              },
              onCursor: (dx: number, dy: number) => {
                const target = campSelecting() ? campTarget : cursor;
                target.value = clampMapTarget({ x: target.value.x + dx, y: target.value.y + dy });
                selectMap();
              },
              onAppend: append,
              onClear: reset,
              onConstruct: construct,
              onKit: (value: string | null) => {
                kitId.value = value;
              },
              onFood: (id: number, q: number) => {
                food.value = { ...food.value, [id]: q };
              },
              onSource: (id: number | null) => {
                sourceId.value = id;
                materials.value = {};
                kitId.value = null;
              },
              onMaterial: (id: string, definitionId: string) => {
                materials.value = { ...materials.value, [id]: definitionId };
              },
              onEstablish: establish,
              onExpand: expand,
              onRetire: retire,
              onTransfer: transfer,
              onRest: rest,
              onPart: part,
              onHarvest: harvest,
              onResident:resident
            }
          }
        : null
    )
  };
}

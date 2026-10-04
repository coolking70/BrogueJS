import { computed, ref, shallowRef, nextTick, defineAsyncComponent, onScopeDispose, type Component } from 'vue';
import i18next from 'i18next';
import { useGrowthCharacter } from './useGrowthCharacter';
import { createGrowthAllocationDraft, buildGrowthAllocateCommand, buildGrowthRespecCommand, buildGrowthSkillCommand, readGrowthSkillTargets, type GrowthSkillTarget, type GrowthCharacterViewModel, type GrowthAllocationDraft } from '../view';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
const GrowthHud = defineAsyncComponent(() => import('./GrowthHud.vue'));
const GrowthSkillBar = defineAsyncComponent(() => import('./GrowthSkillBar.vue'));

export function useGrowthUi(host: ModuleUiHost, loadPanel: () => Promise<Component> = () => import('./GrowthCharacterPanel.vue').then(module => module.default)): ModuleUiSession {
const game = host.game(), runtime = game.extensionRuntime;
let retired = false, panelRequest = 0;
const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
onScopeDispose(() => { retired = true; panelRequest++; });
const panelComponent = shallowRef<{ component: Component } | null>(null);
const panelLoading = ref(false), panelLoadFailed = ref(false);
const panelLoadStatus = computed(() => panelLoading.value ? 'loading' as const : panelLoadFailed.value ? 'failed' as const : null);
const characterOpen = ref(false);
const growthDraft = shallowRef<GrowthAllocationDraft | null>(null);
const { view: growthView, poll: pollGrowth } = useGrowthCharacter(growthDraft, () => game, live);
const growthSubmitting = ref(false);
const growthError = ref<string | null>(null);
const growthNotice = ref<string | null>(null);
type SkillUiAction = 'learn' | 'equip' | 'unequip' | 'use';
// Display-only tracking, never a module context or commit continuation.
let pendingSkill: { ownerCommandId: number; command: string; eventOffset: number; action: SkillUiAction } | null = null;
const skillNotice = (action: SkillUiAction) => action === 'learn' ? 'ext.growth.ui.skill_learned' : action === 'use' ? 'ext.growth.ui.skill_used' : 'ext.growth.ui.skill_equipped';
function refresh() {
  if (!live()) return;
  pollGrowth();
  const pending = pendingSkill;
  if (!pending || game.pendingCommandConfirmation?.ownerCommandId === pending.ownerCommandId) return;
  pendingSkill = null; growthSubmitting.value = false;
  const event = game.recordedInputEvents.slice(pending.eventOffset).find(entry => entry.action === 'ext:command' && entry.data === pending.command);
  // A stale/lifecycle-cancelled plan has no event; the shared Host owns its
  // changed-state notice. Never infer success from an unrelated revision.
  if (!event) return;
  const cancelled = event.decisions?.includes(false);
  growthNotice.value = cancelled ? 'ext.growth.ui.skill_cancelled' : skillNotice(pending.action);
  if (!cancelled && growthView.value) growthDraft.value = createGrowthAllocationDraft(growthView.value);
}
const growthInitialTab = ref<'attributes' | 'skills'>('attributes');
const growthTargetDraft = shallowRef<{ view: GrowthCharacterViewModel; skillId: string } | null>(null);
const growthTargets = computed(() => live() && growthTargetDraft.value && growthView.value
  ? readGrowthSkillTargets(game, growthView.value, growthTargetDraft.value.skillId) : []);
function cancelGrowthTarget() { if (live()) growthTargetDraft.value = null; }
// The game is not reactive; the existing display tick keeps availability current.
function canOpenGrowthCharacter() {
  return live() && !!growthView.value && growthView.value.disabledReason !== 'unavailable'
    && growthView.value.disabledReason !== 'creation-required'
    && host.canOpenPanel();
}
const growthBlocked = computed(() => { host.tick.value; return !canOpenGrowthCharacter(); });
async function openCharacter(initialTab: 'attributes' | 'skills' = 'attributes'): Promise<boolean> {
  if (!live()) return false;
  if (panelLoading.value) { panelRequest++; panelLoading.value = false; return false; }
  pollGrowth();
  if (!growthView.value || !canOpenGrowthCharacter()) return false;
  panelLoadFailed.value = false;
  if (!panelComponent.value) {
    const request = ++panelRequest;
    panelLoading.value = true;
    try {
      const component = await loadPanel();
      if (!live() || request !== panelRequest) return false;
      if (!component) throw new Error('Missing character panel');
      panelComponent.value = { component };
    } catch {
      if (live() && request === panelRequest) panelLoadFailed.value = true;
      return false;
    } finally {
      if (live() && request === panelRequest) panelLoading.value = false;
    }
  }
  pollGrowth();
  if (!live() || !growthView.value || !canOpenGrowthCharacter()) return false;
  host.beforeOpenPanel();
  growthError.value = null; growthNotice.value = null;
  growthDraft.value = createGrowthAllocationDraft(growthView.value);
  growthInitialTab.value = initialTab; growthTargetDraft.value = null; characterOpen.value = true;
  return true;
}
function closeCharacter() {
  if (!live() || growthSubmitting.value) return;
  panelRequest++; panelLoading.value = false; panelLoadFailed.value = false;
  characterOpen.value = false; growthTargetDraft.value = null; growthDraft.value = null; growthError.value = null; growthNotice.value = null;
  host.afterClosePanel();
}
function resetGrowthDraft() {
  if (!live() || !growthView.value || growthSubmitting.value) return;
  growthDraft.value = createGrowthAllocationDraft(growthView.value); growthError.value = null; growthNotice.value = null;
}
function adjustGrowthDraft(id: string, amount: number) {
  if (!live() || !growthDraft.value || !growthView.value || growthSubmitting.value || growthView.value.readOnly) return;
  const row = growthView.value.attributes.find(attribute => attribute.id === id);
  if (!row || (amount > 0 ? !row.canIncrease : !row.canDecrease)) return;
  const attributes = { ...growthDraft.value.attributes, [id]: (growthDraft.value.attributes[id] ?? 0) + amount };
  if (!attributes[id]) delete attributes[id];
  growthDraft.value = { ...growthDraft.value, attributes }; growthError.value = null; growthNotice.value = null;
}
async function submitGrowth(kind: 'allocate' | 'respec') {
  if (!live() || !characterOpen.value || growthSubmitting.value || !growthView.value || growthView.value.readOnly) return;
  growthSubmitting.value = true; growthError.value = null; growthNotice.value = null;
  try {
    const command = kind === 'allocate' ? buildGrowthAllocateCommand(growthView.value, game)
      : buildGrowthRespecCommand(growthView.value, game);
    if (!command) { growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth(); return; }
    const revision = growthView.value.revision;
    game.executeCommand('ext:command', command);
    pollGrowth();
    if (growthView.value?.revision === revision) { growthError.value = 'ext.growth.ui.command_rejected'; return; }
    // Keep the panel over the map after success: a physical second click cannot
    // become an unintended movement. The fresh empty draft also disables submit.
    growthDraft.value = createGrowthAllocationDraft(growthView.value!);
    growthNotice.value = kind === 'allocate' ? 'ext.growth.ui.allocated' : 'ext.growth.ui.respecced';
  } catch {
    growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth();
  } finally {
    await nextTick(); growthSubmitting.value = false;
  }
}
async function submitGrowthSkill(action: SkillUiAction, skillId: string, target?: GrowthSkillTarget) {
  if (!live() || growthSubmitting.value) return;
  if (!characterOpen.value && !await openCharacter('skills')) return;
  if (!live() || growthSubmitting.value || !characterOpen.value || !growthView.value || growthView.value.readOnly) return;
  if (action === 'use' && !target) {
    pollGrowth();
    const skill = growthView.value?.skills.find(entry => entry.id === skillId);
    if (!skill?.canUse || !skill.action) return;
    if (skill.action.target !== 'self') {
      growthTargetDraft.value = { view: growthView.value!, skillId };
      growthError.value = null; growthNotice.value = null;
      await nextTick();
      const body = document.querySelector<HTMLElement>('.growth-body'); if (body) body.scrollTop = 0;
      return;
    }
    target = { kind: 'self' };
  }
  growthSubmitting.value = true; growthError.value = null; growthNotice.value = null;
  try {
    const view = growthTargetDraft.value?.view ?? growthView.value;
    const command = buildGrowthSkillCommand(view, game, action, skillId, target);
    if (!command) { growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth(); return; }
    const revision = view.revision, eventOffset = game.recordedInputEvents.length;
    game.executeCommand('ext:command', command);
    pollGrowth();
    if (game.pendingCommandConfirmation) {
      pendingSkill = { ownerCommandId: game.pendingCommandConfirmation.ownerCommandId, command, eventOffset, action };
      return;
    }
    if (growthView.value?.revision === revision) { growthError.value = 'ext.growth.ui.command_rejected'; return; }
    growthDraft.value = createGrowthAllocationDraft(growthView.value!);
    growthNotice.value = skillNotice(action);
  } catch {
    growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth();
  } finally {
    growthTargetDraft.value = null;
    await nextTick(); growthSubmitting.value = pendingSkill !== null;
  }
}
function confirmGrowthTarget(target: GrowthSkillTarget) {
  if (live() && growthTargetDraft.value) void submitGrowthSkill('use', growthTargetDraft.value.skillId, target);
}
return {
  panelOpen: characterOpen,
  refresh,
  close: closeCharacter,
  commands: computed(() => growthView.value ? [{ id: 'growth:character', label: panelLoading.value ? i18next.t('ext.growth.ui.loading_panel') : panelLoadFailed.value ? i18next.t('ext.growth.ui.load_panel_failed') : i18next.t('ext.growth.ui.character'), glyph: growthView.value.hasUnspentPoints ? '●' : '', disabled: growthBlocked.value, invoke: () => openCharacter() }] : []),
  hud: computed(() => growthView.value ? { component: GrowthHud, props: { model: growthView.value, blocked: growthBlocked.value, immersive: host.immersive.value, loadStatus: panelLoadStatus.value, onOpen: () => openCharacter() } } : null),
  bar: computed(() => growthView.value ? { component: GrowthSkillBar, props: { model: growthView.value, blocked: growthBlocked.value, submitting: growthSubmitting.value, immersive: host.immersive.value, loadStatus: panelLoadStatus.value, onOpen: () => openCharacter('skills'), onUse: (id: string) => submitGrowthSkill('use', id) } } : null),
  panel: computed(() => characterOpen.value && growthView.value && panelComponent.value ? { component: panelComponent.value.component, props: {
    model: growthView.value, submitting: growthSubmitting.value, error: growthError.value, notice: growthNotice.value,
    initialTab: growthInitialTab.value, targetSkillId: growthTargetDraft.value?.skillId, targets: growthTargets.value,
    onClose: closeCharacter, onReset: resetGrowthDraft, onAdjust: adjustGrowthDraft,
    onSubmit: () => submitGrowth('allocate'), onRespec: () => submitGrowth('respec'), onSkill: submitGrowthSkill,
    onTarget: confirmGrowthTarget, onCancelTarget: cancelGrowthTarget,
  } } : null),
};
}

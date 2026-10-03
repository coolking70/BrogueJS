<script lang="ts">
// UI-1 第 6 条：Game.onConfirmRequest（C-5 落下的钩子，Game.ts:408）的生产侧接线。
// 引擎的 requestConfirm 是**同步**契约（CE confirm() 在文本框里自旋等键，IO.c:2946-2975），
// 所以这里用浏览器原生 confirm()——它是 web 平台唯一能同步阻塞等答案的模态，
// 且按键语义与 CE 完全同构：Enter = OK = Yes（CE RETURN_KEY 挂在 Yes 钮，
// IO.c:2956）、Esc = Cancel = No（CE ESCAPE_KEY 挂在 No 钮，IO.c:2966；
// ACKNOWLEDGE_KEY = ' ' 同样映射 No，Rogue.h:1179）。
// 纯逻辑（回放旁路）拆成可单测的导出函数；测试见 ui_1_rendering.test.ts。
import type { Game } from './engine/Core/Game';
import { cancelHeldInputs } from './ui/heldInput';

export function wireConfirmRequest(game: Game): void {
    game.onConfirmRequest = (message: string): boolean => {
        cancelHeldInputs();
        // CE IO.c:2944：autoPlayingLevel 是自动演示，不是旅行/探索。
        // 引擎在提问前停止自动行进；回放决策由 requestConfirm 消费。
        if (game.replayStatus === 'playing') return true;
        return window.confirm(message);
    };
}
</script>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { displaySettings } from './engine/Settings';
import { inputManager } from './engine/Input';
import { logger } from './engine/Systems/Logger';
import { saveSnapshot, readSnapshot, readSaveSummary, deleteSnapshot, type SaveSummary } from './engine/Core/SaveStorage';
import i18next from 'i18next';
import GameCanvas from './components/GameCanvas.vue';
import ContextPanel from './components/ContextPanel.vue';
import MessageJournal from './components/MessageJournal.vue';
import MessageAcknowledgment from './components/MessageAcknowledgment.vue';
import InventoryOverlay from './components/InventoryOverlay.vue';
import GameEndOverlay from './components/GameEndOverlay.vue';
import MainMenu from './components/MainMenu.vue';
import ReplayControls from './components/ReplayControls.vue';
import AgentControls from './components/AgentControls.vue';
import DetailPanel from './components/DetailPanel.vue';
import ReferenceOverlay from './components/ReferenceOverlay.vue';
import MapZoomControls from './components/MapZoomControls.vue';
import SideDrawer from './components/SideDrawer.vue';
import CommandBar from './components/CommandBar.vue';
import DPad from './components/DPad.vue';
import TargetBar from './components/TargetBar.vue';
import ThemeHud from './components/theme/ThemeHud.vue';
import ThemeLog from './components/theme/ThemeLog.vue';
import ThemeNearby from './components/theme/ThemeNearby.vue';
import RadialCommands from './components/theme/RadialCommands.vue';
import { registerImmersiveShortcut } from './ui/immersiveMode';
import { activeGame, type GameMode } from './engine/Core/Game';
import { viewport, startViewportTracking, shouldShowTouchControls } from './ui/layout';
import { recordingJsonAtBoundary, RecordingExportError } from './ui/recordingExport';
import type { DetailInfo } from './engine/UI/DetailGenerator';
import GrowthCharacterPanel from './components/growth/GrowthCharacterPanel.vue';
import { useGrowthCharacter } from './ui/useGrowthCharacter';
import { createGrowthAllocationDraft, buildGrowthAllocateCommand, buildGrowthRespecCommand, buildGrowthSkillCommand, readGrowthSkillTargets, type GrowthSkillTarget, type GrowthCharacterViewModel, type GrowthAllocationDraft } from './ext/modules/growth/view';

const REPLAY_KEY = 'brogue-web-replay-v1';

// FE-1：布局模式（desktop / portrait / landscape）按视口尺寸判定，纯显示。
startViewportTracking();
const compact = computed(() => viewport.mode !== 'desktop');
/** 桌面尺寸的粗指针设备（大平板横屏等）也显示触控命令栏。 */
const touchUi = computed(() => !compact.value && viewport.coarsePointer);
const panelOpen = ref(false);
const contextWidth = computed(() => displaySettings.sidebarWidthMode === 'proportional' ? 'clamp(190px, 20vw, 280px)' : '216px');
const journalOpen = ref(false);
const characterOpen = ref(false);
const creationTransition = ref(false);
let creationTransitionTimer: ReturnType<typeof setTimeout> | undefined;
let removeCreationKeyboard: (() => void) | undefined;
function clearCreationTransition() {
  if (creationTransitionTimer !== undefined) globalThis.clearTimeout(creationTransitionTimer);
  creationTransitionTimer = undefined; removeCreationKeyboard?.(); removeCreationKeyboard = undefined;
  creationTransition.value = false;
}
function beginCreationTransition() {
  clearCreationTransition(); cancelHeldInputs(); creationTransition.value = true;
  const epoch = runEpoch;
  removeCreationKeyboard = inputManager.registerModalKeyHandler(event => { event.preventDefault(); return true; }, 2500);
  // Presentation-only protection against the second pointerup of a physical
  // double click landing on the map after the creation dialog unmounts.
  creationTransitionTimer = globalThis.setTimeout(() => {
    clearCreationTransition(); cancelHeldInputs();
    if (runEpoch === epoch && !menuOpen.value) void nextTick(() => document.querySelector<HTMLElement>('.game-view')?.focus({ preventScroll: true }));
  }, 600);
}
const growthDraft = shallowRef<GrowthAllocationDraft | null>(null);
const { view: growthView, poll: pollGrowth } = useGrowthCharacter(growthDraft);
const growthSubmitting = ref(false);
const growthError = ref<string | null>(null);
const growthNotice = ref<string | null>(null);
const growthName = (key: string) => i18next.t(`ext.growth.${key.slice('ext.growth.'.length)}`);
const growthInitialTab = ref<'attributes' | 'skills'>('attributes');
const growthTargetDraft = shallowRef<{ view: GrowthCharacterViewModel; skillId: string } | null>(null);
const growthSkillBarExpanded = ref(false);
const growthTargets = computed(() => growthTargetDraft.value && growthView.value
  ? readGrowthSkillTargets(activeGame, growthView.value, growthTargetDraft.value.skillId) : []);
const equippedGrowthSkills = computed(() => growthView.value?.skills.filter(skill => skill.mode === 'active' && skill.equipped) ?? []);
function cancelGrowthTarget() { growthTargetDraft.value = null; }
// The game is not reactive; the existing display tick keeps availability current.
function canOpenGrowthCharacter() {
  return !!growthView.value && growthView.value.disabledReason !== 'unavailable'
    && growthView.value.disabledReason !== 'creation-required'
    && !(creationTransition.value || menuOpen.value || activeGame.isInventoryOpen || activeGame.isThrowing || activeGame.pendingArcana
      || activeGame.pendingEnchantment || activeGame.pendingIdentify || activeGame.pendingUseConfirm
      || logger.pendingAcknowledgment || activeGame.referenceScreen || activeGame.isGameOver
      || activeGame.isAdvancing || activeGame.isInputLocked());
}
const growthBlocked = computed(() => { replayTick.value; return !canOpenGrowthCharacter(); });
function openCharacter(initialTab: 'attributes' | 'skills' = 'attributes') {
  pollGrowth();
  if (!growthView.value || !canOpenGrowthCharacter()) return;
  cancelHeldInputs();
  panelOpen.value = false; journalOpen.value = false; themePanelOpen.value = false;
  nearbyInspection.value = null; activeGame.inspectTarget = null;
  growthError.value = null; growthNotice.value = null;
  growthDraft.value = createGrowthAllocationDraft(growthView.value);
  growthInitialTab.value = initialTab; growthTargetDraft.value = null; characterOpen.value = true;
}
function closeCharacter() {
  if (growthSubmitting.value) return;
  characterOpen.value = false; growthTargetDraft.value = null; growthDraft.value = null; growthError.value = null; growthNotice.value = null;
  void nextTick(() => document.querySelector<HTMLElement>('.game-view')?.focus({ preventScroll: true }));
}
function resetGrowthDraft() {
  if (!growthView.value || growthSubmitting.value) return;
  growthDraft.value = createGrowthAllocationDraft(growthView.value); growthError.value = null; growthNotice.value = null;
}
function adjustGrowthDraft(id: string, amount: number) {
  if (!growthDraft.value || !growthView.value || growthSubmitting.value || growthView.value.readOnly) return;
  const row = growthView.value.attributes.find(attribute => attribute.id === id);
  if (!row || (amount > 0 ? !row.canIncrease : !row.canDecrease)) return;
  const attributes = { ...growthDraft.value.attributes, [id]: (growthDraft.value.attributes[id] ?? 0) + amount };
  if (!attributes[id]) delete attributes[id];
  growthDraft.value = { ...growthDraft.value, attributes }; growthError.value = null; growthNotice.value = null;
}
async function submitGrowth(kind: 'allocate' | 'respec') {
  if (!characterOpen.value || growthSubmitting.value || !growthView.value || growthView.value.readOnly) return;
  growthSubmitting.value = true; growthError.value = null; growthNotice.value = null;
  try {
    const command = kind === 'allocate' ? buildGrowthAllocateCommand(growthView.value, activeGame)
      : buildGrowthRespecCommand(growthView.value, activeGame);
    if (!command) { growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth(); return; }
    const revision = growthView.value.revision;
    activeGame.executeCommand('ext:command', command);
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
async function submitGrowthSkill(action: 'learn' | 'equip' | 'unequip' | 'use', skillId: string, target?: GrowthSkillTarget) {
  if (growthSubmitting.value) return;
  if (!characterOpen.value) openCharacter('skills');
  if (!characterOpen.value || !growthView.value || growthView.value.readOnly) return;
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
    const command = buildGrowthSkillCommand(view, activeGame, action, skillId, target);
    if (!command) { growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth(); return; }
    const revision = view.revision;
    activeGame.executeCommand('ext:command', command);
    pollGrowth();
    if (growthView.value?.revision === revision) { growthError.value = 'ext.growth.ui.command_rejected'; return; }
    growthDraft.value = createGrowthAllocationDraft(growthView.value!);
    growthNotice.value = action === 'learn' ? 'ext.growth.ui.skill_learned' : action === 'use' ? 'ext.growth.ui.skill_used' : 'ext.growth.ui.skill_equipped';
  } catch {
    growthError.value = 'ext.growth.ui.command_rejected'; pollGrowth();
  } finally {
    growthTargetDraft.value = null;
    await nextTick(); growthSubmitting.value = false;
  }
}
function confirmGrowthTarget(target: GrowthSkillTarget) {
  if (growthTargetDraft.value) void submitGrowthSkill('use', growthTargetDraft.value.skillId, target);
}
const nearbyInspection = ref<DetailInfo | null>(null);
// Display-only panel expansion; preserve one GameCanvas instance across layout changes.
const themePanelOpen = ref(false);
function toggleThemePanel() {
  if (displaySettings.immersiveMode) themePanelOpen.value = !themePanelOpen.value;
  else if (compact.value) panelOpen.value = !panelOpen.value;
}
const themeLogLines = computed(() => displaySettings.immersiveMode
  ? (themePanelOpen.value ? 12 : 1)
  : viewport.mode === 'landscape' ? 1 : viewport.mode === 'desktop' ? 3 : 2);
watch(() => displaySettings.immersiveMode, () => { themePanelOpen.value = false; panelOpen.value = false; });
const replayTick = ref(0);
const replayActive = computed(() => { replayTick.value; return !!activeGame.replayRecording; });
let replayTimer = 0;
let removeImmersiveShortcut: (() => void) | undefined;
// 结算页只显示结算后的保存/导出反馈；开局时的菜单反馈不应带进结算页。
let endFeedbackCleared = false;
onMounted(() => {
  removeImmersiveShortcut = registerImmersiveShortcut(inputManager, () => ({
    inGame: gameStarted.value, menuOpen: menuOpen.value, game: activeGame,
  }));
  replayTimer = window.setInterval(() => {
  replayTick.value++;
  if (activeGame.isGameOver && !endFeedbackCleared) { endFeedbackCleared = true; replayFeedback.value = ''; }
  else if (!activeGame.isGameOver) endFeedbackCleared = false;
}, 100); });
onUnmounted(() => { removeImmersiveShortcut?.(); window.clearInterval(replayTimer); clearCreationTransition(); runEpoch++; });
/** 触控命令栏 + 方向键：紧凑模式或粗指针设备显示；回放期间让位给录像控制条。 */
const showTouch = computed(() => (shouldShowTouchControls(viewport.coarsePointer, viewport.mode)
  || (displaySettings.immersiveMode && compact.value)) && !replayActive.value);
const showCommands = computed(() => (compact.value || showTouch.value) && !replayActive.value);

// UI-1 第 6 条：把引擎确认钩子接到本组件（headless/测试环境不挂载 App，
// 钩子保持 null → requestConfirm 按"确认"处理，与 C-5 申报一致）。
wireConfirmRequest(activeGame);

const gameStarted = ref(false);
const menuOpen = ref(true);
// These modals are Vue state; cancel synchronously on entry. Engine-owned
// overlays are monitored by GameCanvas through the same held-input registry.
watch([menuOpen, panelOpen, journalOpen, nearbyInspection, themePanelOpen], (next, previous) => {
  if (next.some((value, index) => !!value && value !== previous[index])) cancelHeldInputs();
}, { flush: 'sync' });
watch(characterOpen, open => { if (open) cancelHeldInputs(); }, { flush: 'sync' });
watch(menuOpen, (open) => {
  if (!open || !gameStarted.value) return;
  if (characterOpen.value) closeCharacter();
  if (activeGame.replayStatus === 'playing') activeGame.replayPause();
  else if (activeGame.isAutoTraveling()) inputManager.triggerAction('interrupt_auto');
});
const storageTick = ref(0);
const runAvailable = ref(false);
const replayBusy = ref(false);
const replayFeedback = ref('');
let runEpoch = 0;
const canSaveReplay = computed(() => {
  replayTick.value;
  return runAvailable.value && (activeGame.hasCompleteRecording || !!activeGame.replayRecording);
});

const saveInfo = ref<SaveSummary | null>(null);
const hasSave = computed(() => saveInfo.value !== null);
onMounted(async () => {
  try { saveInfo.value = await readSaveSummary(); } catch { saveInfo.value = null; }
});

const replayInfo = computed(() => {
  replayTick.value;
  if (!activeGame.replayRecording) return null;
  return {
    status: activeGame.replayStatus,
    cursor: activeGame.replayCursor,
    total: activeGame.replayEvents.length
  };
});

const hasReplay = computed(() => {
  storageTick.value;
  try {
    return !!window.localStorage.getItem(REPLAY_KEY);
  } catch {
    return false;
  }
});

const startNewGame = (payload: { seed?: string; mode: GameMode; ruleSet?: "classic" | "extended"; initialCommands?: readonly string[]; onRejected?: () => void }) => {
  try {
    activeGame.startNewGame({ seed: payload.seed, mode: payload.mode, ruleSet: payload.ruleSet, initialCommands: payload.initialCommands });
    // Preserve the explicit programmatic neutral start contract. The real menu
    // always supplies validated selected commands at the atomic new-run boundary.
    if (!payload.initialCommands) for (const command of activeGame.extensionRuntime?.initialCommands() ?? []) activeGame.executeCommand('ext:command', command);
  } catch {
    replayFeedback.value = i18next.t('ext.growth.creation.start_failed'); payload.onRejected?.(); return;
  }
  clearCreationTransition(); runEpoch++;
  if (payload.initialCommands) beginCreationTransition();
  cancelHeldInputs();
  characterOpen.value = false; growthTargetDraft.value = null; growthDraft.value = null;
  replayFeedback.value = '';
  runAvailable.value = true;
  replayMessage(
    i18next.t('menu.log.started_game', {
      mode: i18next.t(`menu.mode.${payload.mode}`, { defaultValue: payload.mode }),
      seed: activeGame.currentSeed,
      defaultValue: 'Started {{mode}} game (seed {{seed}}).'
    })
  );
  pollGrowth();
    gameStarted.value = true;
  menuOpen.value = false;
};

const saveGame = async () => {
  if (!gameStarted.value) return;
  try {
    saveInfo.value = await saveSnapshot(activeGame.toSaveSnapshot());
    storageTick.value++;
    replayMessage(i18next.t('menu.log.game_saved', { defaultValue: 'Game saved.' }));
  } catch {
    replayMessage(i18next.t('menu.log.save_failed', { defaultValue: 'Save failed.' }));
  }
};

const continueGame = async () => {
  try {
    const snapshot = await readSnapshot();
    if (!snapshot) return;
    if (!activeGame.loadSnapshot(snapshot)) {
      replayMessage(i18next.t('menu.log.save_format_not_supported', { defaultValue: 'Save format not supported.' }));
      return;
    }
    replayMessage(i18next.t('menu.log.save_loaded', { defaultValue: 'Save loaded.' }));
    clearCreationTransition(); runEpoch++;
    runAvailable.value = true;
    replayFeedback.value = '';
    storageTick.value++;
    pollGrowth();
    gameStarted.value = true;
    menuOpen.value = false;
  } catch {
    replayMessage(i18next.t('menu.log.failed_load_save', { defaultValue: 'Failed to load save.' }));
  }
};

const deleteSave = async () => {
  try {
    await deleteSnapshot();
    saveInfo.value = null;
    storageTick.value++;
    replayMessage(i18next.t('menu.log.save_deleted', { defaultValue: 'Save deleted.' }));
  } catch {
    replayMessage(i18next.t('menu.log.failed_delete_save', { defaultValue: 'Failed to delete save.' }));
  }
};

// Menu feedback is presentation-only: Logger.log disturbs automatic actions.
const replayMessage = (message: string) => { replayFeedback.value = message; };

const currentReplayJson = async (): Promise<string> => {
  if (activeGame.replayRecording) return JSON.stringify(activeGame.replayRecording);
  const epoch = runEpoch;
  if (!activeGame.canExportRecording) {
    replayFeedback.value = i18next.t('menu.replay.waiting', { defaultValue: 'Waiting for the current turn to finish…' });
  }
  return recordingJsonAtBoundary(activeGame, () => runEpoch === epoch);
};

const saveReplay = async () => {
  if (!canSaveReplay.value || replayBusy.value) return;
  replayBusy.value = true;
  try {
    const raw = await currentReplayJson();
    window.localStorage.setItem(REPLAY_KEY, raw);
    storageTick.value++;
    replayMessage(i18next.t('menu.log.replay_saved', { defaultValue: 'Replay saved.' }));
  } catch (error) {
    if (error instanceof RecordingExportError) {
      replayMessage(i18next.t('menu.replay.not_ready', { defaultValue: 'The recording is not ready. Please try again after the turn finishes.' }));
    } else {
      const failure = i18next.t('menu.log.replay_save_failed', { defaultValue: 'Replay save failed.' });
      const recovery = i18next.t('menu.replay.storage_failed', { defaultValue: 'Browser storage is unavailable or full. You can still export this run as JSON.' });
      replayMessage(failure + ' ' + recovery);
    }
  } finally {
    replayBusy.value = false;
  }
};

const loadReplay = () => {
  cancelHeldInputs();
  try {
    const raw = window.localStorage.getItem(REPLAY_KEY);
    if (!raw) return;
    const recording = JSON.parse(raw);
    if (!activeGame.loadReplay(recording)) {
      replayMessage(i18next.t('menu.log.replay_load_failed', { defaultValue: 'Replay load failed.' }));
      return;
    }
    pollGrowth();
    gameStarted.value = true;
    menuOpen.value = false;
    replayMessage(i18next.t('menu.log.replay_loaded', { defaultValue: 'Replay loaded.' }));
    clearCreationTransition(); runEpoch++;
    runAvailable.value = true;
    replayFeedback.value = '';
  } catch {
    replayMessage(i18next.t('menu.log.replay_load_failed', { defaultValue: 'Replay load failed.' }));
  }
};

const deleteReplay = () => {
  try {
    window.localStorage.removeItem(REPLAY_KEY);
    storageTick.value++;
    replayMessage(i18next.t('menu.log.replay_deleted', { defaultValue: 'Replay deleted.' }));
  } catch {
    replayMessage(i18next.t('menu.log.replay_delete_failed', { defaultValue: 'Replay delete failed.' }));
  }
};

const replayPlay = () => {
  cancelHeldInputs();
  activeGame.replayPlay();
};

const replayPause = () => {
  activeGame.replayPause();
};

const replayStep = () => {
  activeGame.replayStep();
};

const replayRestart = () => {
  activeGame.replayRestart(); pollGrowth();
};

const replaySeek = (index: number) => {
  activeGame.replaySeek(index); pollGrowth();
};

const downloadReplayJson = (raw: string) => {
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brogue-web-replay-${Date.now()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    replayMessage(i18next.t('menu.log.replay_exported', { defaultValue: 'Replay JSON exported.' }));
};

const exportReplayJson = () => {
  try {
    const raw = window.localStorage.getItem(REPLAY_KEY);
    if (raw) downloadReplayJson(raw);
  } catch {
    replayMessage(i18next.t('menu.log.replay_export_failed', { defaultValue: 'Replay JSON export failed.' }));
  }
};

const exportCurrentReplayJson = async () => {
  if (!canSaveReplay.value || replayBusy.value) return;
  replayBusy.value = true;
  try { downloadReplayJson(await currentReplayJson()); }
  catch { replayMessage(i18next.t('menu.log.replay_export_failed', { defaultValue: 'Replay JSON export failed.' })); }
  finally { replayBusy.value = false; }
};

const importReplayJson = async (file: File) => {
  cancelHeldInputs();
  try {
    const text = await file.text();
    const recording = JSON.parse(text);
    if (!activeGame.loadReplay(recording)) {
      replayMessage(i18next.t('menu.log.replay_import_failed', { defaultValue: 'Replay JSON import failed.' }));
      return;
    }
    clearCreationTransition(); runEpoch++;
    runAvailable.value = true;
    replayFeedback.value = i18next.t('menu.replay.imported_unsaved', { defaultValue: 'Recording imported. Save it to keep it in this browser.' });
    pollGrowth();
    gameStarted.value = true;
    menuOpen.value = false;
    const imported = i18next.t('menu.log.replay_imported', { defaultValue: 'Replay JSON imported.' });
    replayFeedback.value = imported + ' ' + replayFeedback.value;
  } catch {
    replayMessage(i18next.t('menu.log.replay_import_failed', { defaultValue: 'Replay JSON import failed.' }));
  }
};

const handleReturnToTitle = async () => {
    clearCreationTransition();
    // Return to menu logic
    gameStarted.value = false;
    menuOpen.value = true;
    
    // Clear save if player was killed/won to prevent infinite loops of death
    try {
        await deleteSnapshot();
        saveInfo.value = null;
    } catch {}
    storageTick.value++;
};
</script>

<template>
  <div class="app-layout theme-shell" :style="{ '--context-width': contextWidth }" :class="[`layout-${viewport.mode}`, { 'is-replaying': replayActive, 'has-touch-controls': showTouch, 'immersive-mode': displaySettings.immersiveMode, 'theme-panel-open': themePanelOpen, 'has-growth-skills': !!growthView }]">
    <template v-if="gameStarted">
      <!-- FE-1：GameCanvas 始终是同一位置的同一实例（旋转屏幕不重建 Pixi），
           其余部件按布局模式挂载，用 CSS grid 区域摆放。 -->
      <ThemeHud class="area-vitals" :show-panel-button="compact || displaySettings.immersiveMode" :panel-open="compact && !displaySettings.immersiveMode ? panelOpen : themePanelOpen" :growth="growthView" :growth-blocked="growthBlocked" :immersive="displaySettings.immersiveMode" @character="openCharacter" @menu="menuOpen = true" @panel="toggleThemePanel" />
      <ThemeLog class="area-log" :lines="themeLogLines" :single-line="displaySettings.immersiveMode && !themePanelOpen" @open-journal="journalOpen = true" />
      <ThemeNearby class="area-near" @inspect="nearbyInspection = $event" />
      <div class="map-area">
        <GameCanvas class="game-view" :display-modal-open="characterOpen || creationTransition" />
        <MapZoomControls />
        <RadialCommands v-if="displaySettings.immersiveMode && !replayActive" class="area-radial" @modal-open="cancelHeldInputs" />
      </div>
      <TargetBar class="area-target" />
      <section v-if="growthView" class="area-skills growth-skill-bar" @keydown.stop @keyup.stop @pointerdown.stop @touchstart.stop>
        <button data-action="show-skills" :disabled="growthBlocked" @click="openCharacter('skills')">{{ $t('ext.growth.ui.skills_list') }}</button>
        <button v-if="displaySettings.immersiveMode && equippedGrowthSkills.length" data-action="toggle-skills" :aria-expanded="growthSkillBarExpanded" @click="growthSkillBarExpanded = !growthSkillBarExpanded">{{ growthSkillBarExpanded ? '−' : '+' }}</button>
        <div v-if="!displaySettings.immersiveMode || growthSkillBarExpanded" class="growth-equipped-skills">
          <button v-for="skill in equippedGrowthSkills" :key="skill.id" :data-use-skill="skill.id" :disabled="!skill.canUse || growthBlocked || growthSubmitting" @click="submitGrowthSkill('use', skill.id)">{{ skill.cooldownRemaining ? $t('ext.growth.ui.skill_bar_cooldown', { name: growthName(skill.nameKey), count: skill.cooldownRemaining }) : $t('ext.growth.ui.skill_bar_ready', { name: growthName(skill.nameKey), focus: skill.focusCost }) }}</button>
        </div>
        <span class="growth-bar-focus">{{ $t('ext.growth.ui.focus_compact', { current: growthView.focus.current, capacity: growthView.focus.capacity }) }}</span>
      </section>
      <CommandBar v-if="showCommands || (!compact && !replayActive)" class="area-cmd" :mode="viewport.mode" :show-character="!!growthView" :character-blocked="growthBlocked" :has-growth-points="growthView?.hasUnspentPoints" @character="openCharacter" @modal-open="cancelHeldInputs" />
      <DPad v-if="showTouch" class="area-pad" :mode="viewport.mode" />
      <ContextPanel v-if="!compact && themePanelOpen && !displaySettings.immersiveMode" class="area-context" @close="themePanelOpen = false" @inspect="nearbyInspection = $event" />
      <SideDrawer :open="panelOpen" @close="panelOpen = false">
        <ContextPanel @close="panelOpen = false" @inspect="nearbyInspection = $event" />
      </SideDrawer>
      <SideDrawer :open="journalOpen" variant="journal" @close="journalOpen = false">
        <MessageJournal />
      </SideDrawer>
      <GrowthCharacterPanel v-if="characterOpen && growthView" :model="growthView" :submitting="growthSubmitting" :error="growthError" :notice="growthNotice" :initial-tab="growthInitialTab" :target-skill-id="growthTargetDraft?.skillId" :targets="growthTargets"
        @close="closeCharacter" @reset="resetGrowthDraft" @adjust="adjustGrowthDraft" @submit="submitGrowth('allocate')" @respec="submitGrowth('respec')" @skill="submitGrowthSkill" @target="confirmGrowthTarget" @cancel-target="cancelGrowthTarget" />
      <InventoryOverlay />
      <GameEndOverlay :can-save-replay="canSaveReplay" :replay-busy="replayBusy" :replay-feedback="replayFeedback"
        @save-replay="saveReplay" @export-replay-json="exportCurrentReplayJson" @return-to-title="handleReturnToTitle" />
      <ReplayControls />
      <AgentControls class="agent-root" :hide-controls="compact || touchUi" />
      <DetailPanel :display-detail="nearbyInspection" @close="nearbyInspection = null" />
      <ReferenceOverlay />
    </template>
    <div v-else class="blank-stage" aria-hidden="true"></div>

    <div v-if="creationTransition" class="growth-creation-transition" data-testid="creation-transition" aria-hidden="true"
      @pointerdown.prevent.stop @pointerup.prevent.stop @touchstart.prevent.stop @touchend.prevent.stop @click.prevent.stop @dblclick.prevent.stop @keydown.prevent.stop @keyup.prevent.stop></div>
    <MessageAcknowledgment />
    <MainMenu
      v-if="menuOpen"
      :has-save="hasSave"
      :has-replay="hasReplay"
      :in-game="gameStarted"
      :save-info="saveInfo"
      :replay-info="replayInfo"
      :can-save-replay="canSaveReplay"
      :replay-busy="replayBusy"
      :replay-feedback="replayFeedback"
      @new-game="startNewGame"
      @continue-game="continueGame"
      @save-game="saveGame"
      @delete-save="deleteSave"
      @save-replay="saveReplay"
      @load-replay="loadReplay"
      @delete-replay="deleteReplay"
      @replay-play="replayPlay"
      @replay-pause="replayPause"
      @replay-step="replayStep"
      @replay-restart="replayRestart"
      @replay-seek="replaySeek"
      @export-replay-json="exportReplayJson"
      @export-current-replay-json="exportCurrentReplayJson"
      @import-replay-json="importReplayJson"
      @close="menuOpen = false"
    />
  </div>
</template>

<style scoped>
.growth-skill-bar{grid-area:skills;display:flex;align-items:center;gap:6px;padding:4px 8px;min-width:0;border-top:1px solid var(--th-line,#555);background:var(--th-panel,#171918);font:12px var(--th-font,monospace);color:var(--th-fg,#eee);z-index:31;box-sizing:border-box}.growth-skill-bar button{min-height:40px;flex:0 0 auto;white-space:nowrap;padding:6px 9px;border:1px solid var(--th-line,#555);background:var(--th-raised,#222);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}.growth-skill-bar button:disabled{opacity:.45;cursor:default}.growth-equipped-skills{display:flex;gap:6px;min-width:0;overflow-x:auto;scrollbar-width:thin;flex:1}.growth-bar-focus{margin-left:auto;white-space:nowrap;flex:0 0 auto;color:var(--th-dim,#aaa)}
@media(max-width:700px){.growth-skill-bar{gap:4px;padding:3px 6px;font-size:11px}.growth-skill-bar button{min-height:44px;padding:5px 7px}.growth-equipped-skills{gap:4px}}
/* Whole-selector :global preserves grid scope after Vue's SFC compilation. */
:global(html[data-ui-concept=glyph] .app-layout.theme-shell.layout-desktop.has-growth-skills:not(.immersive-mode)){grid-template-rows:auto auto minmax(0,1fr) auto auto!important;grid-template-areas:'vitals log' 'vitals map' 'near map' 'near skills' 'near cmd'!important}
:global(html[data-ui-concept=glyph] .app-layout.theme-shell.layout-portrait.has-growth-skills:not(.immersive-mode)){grid-template-rows:auto auto minmax(0,1fr) auto auto!important;grid-template-areas:'vitals vitals' 'log log' 'map map' 'skills skills' 'cmd pad'!important}
:global(html[data-ui-concept=glyph] .app-layout.theme-shell.layout-landscape.has-growth-skills:not(.immersive-mode)){grid-template-rows:auto minmax(0,1fr) auto auto!important;grid-template-areas:'vitals log pad' 'vitals map pad' 'vitals skills pad' 'vitals cmd pad'!important}
:global(html[data-ui-concept=glyph] .app-layout.theme-shell.immersive-mode.has-growth-skills){grid-template-rows:auto minmax(0,1fr) auto auto!important;grid-template-areas:'vitals' 'map' 'skills' 'log'!important}

:global(html[data-ui-concept=glyph] .app-layout.theme-shell.layout-desktop.has-growth-skills.has-touch-controls:not(.immersive-mode)){grid-template-areas:'vitals log log' 'vitals map map' 'near map map' 'near skills skills' 'near cmd pad'!important}
:global(html[data-ui-concept=glyph] .app-layout.theme-shell.layout-portrait.has-growth-skills.is-replaying:not(.immersive-mode)){grid-template-areas:'vitals' 'log' 'map' 'skills' 'cmd'!important}
:global(html[data-ui-concept=glyph] .app-layout.theme-shell.layout-landscape.has-growth-skills.is-replaying:not(.immersive-mode)){grid-template-areas:'vitals log' 'vitals map' 'vitals skills' 'vitals cmd'!important}

.app-layout {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  margin: 0;
  padding: 0;
  background-color: #000;
  color: #fff;
  display: grid;
  overflow: hidden;
}

.map-area {
  grid-area: map;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.game-view {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* 触控命令栏 / 方向键 / 目标选择条的网格落位 */
.area-cmd { grid-area: cmd; min-width: 0; }
.area-pad { grid-area: pad; }
.area-target {
  grid-area: map;
  align-self: end;
  justify-self: center;
}
.layout-landscape .area-target { align-self: start; }
.layout-landscape .area-pad {
  grid-area: pad;
  align-self: center;
  justify-self: stretch;
}
.layout-desktop .area-cmd {
  grid-area: cmd;
  align-self: stretch;
  justify-self: stretch;
}
.layout-desktop .area-pad {
  grid-area: map;
  align-self: end;
  justify-self: end;
}

/* AgentControls 根节点不占网格单元（子元素本就绝对定位） */
.agent-root { display: contents; }

.blank-stage {
  grid-column: 1 / -1;
}

</style>

<style scoped>
.growth-creation-transition{position:fixed;inset:0;z-index:2300;background:transparent;touch-action:none}
</style>

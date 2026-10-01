<script lang="ts">
// UI-1 第 6 条：Game.onConfirmRequest（C-5 落下的钩子，Game.ts:408）的生产侧接线。
// 引擎的 requestConfirm 是**同步**契约（CE confirm() 在文本框里自旋等键，IO.c:2946-2975），
// 所以这里用浏览器原生 confirm()——它是 web 平台唯一能同步阻塞等答案的模态，
// 且按键语义与 CE 完全同构：Enter = OK = Yes（CE RETURN_KEY 挂在 Yes 钮，
// IO.c:2956）、Esc = Cancel = No（CE ESCAPE_KEY 挂在 No 钮，IO.c:2966；
// ACKNOWLEDGE_KEY = ' ' 同样映射 No，Rogue.h:1179）。
// 纯逻辑（回放旁路）拆成可单测的导出函数；测试见 ui_1_rendering.test.ts。
import type { Game } from './engine/Core/Game';

export function wireConfirmRequest(game: Game): void {
    game.onConfirmRequest = (message: string): boolean => {
        // CE IO.c:2944：autoPlayingLevel 是自动演示，不是旅行/探索。
        // 引擎在提问前停止自动行进；回放决策由 requestConfirm 消费。
        if (game.replayStatus === 'playing') return true;
        return window.confirm(message);
    };
}
</script>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import UiLabToolbar from './components/UiLabToolbar.vue';
import { displaySettings } from './engine/Settings';
import { inputManager } from './engine/Input';
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
import MobileHud from './components/MobileHud.vue';
import MessageStrip from './components/MessageStrip.vue';
import MapZoomControls from './components/MapZoomControls.vue';
import SideDrawer from './components/SideDrawer.vue';
import CommandBar from './components/CommandBar.vue';
import DPad from './components/DPad.vue';
import TargetBar from './components/TargetBar.vue';
import ThemeHud from './components/theme/ThemeHud.vue';
import ThemeLog from './components/theme/ThemeLog.vue';
import ThemeNearby from './components/theme/ThemeNearby.vue';
import ThemeCodex from './components/theme/ThemeCodex.vue';
import ThemeKit from './components/theme/ThemeKit.vue';
import RadialCommands from './components/theme/RadialCommands.vue';
import { concept, isShellConcept } from './ui/concept';
import { cameraState } from './ui/mapCamera';
import { activeGame, type GameMode } from './engine/Core/Game';
import { viewport, startViewportTracking, shouldShowTouchControls } from './ui/layout';
import { recordingJsonAtBoundary, RecordingExportError } from './ui/recordingExport';

const REPLAY_KEY = 'brogue-web-replay-v1';

// FE-1：布局模式（desktop / portrait / landscape）按视口尺寸判定，纯显示。
startViewportTracking();
const compact = computed(() => viewport.mode !== 'desktop');
/** 桌面尺寸的粗指针设备（大平板横屏等）也显示触控命令栏。 */
const touchUi = computed(() => !compact.value && viewport.coarsePointer);
const panelOpen = ref(false);
const contextOpen = ref(true);
const contextWidth = computed(() => displaySettings.sidebarWidthMode === 'proportional' ? 'clamp(190px, 20vw, 280px)' : '216px');
const journalOpen = ref(false);
function toggleContext() { if (compact.value) panelOpen.value = !panelOpen.value; else contextOpen.value = !contextOpen.value; }
// DESIGN-2：新主题共用的外壳。纯显示状态，不进存档/录像。
const shell = computed(() => isShellConcept(concept.value));
const themePanelOpen = ref(false);
/** 余烬/一线：面板按钮切换本主题的展开层；其余新主题在紧凑视口打开抽屉。 */
function toggleThemePanel() {
  if (compact.value && concept.value !== 'zen' && concept.value !== 'codex') panelOpen.value = !panelOpen.value;
  else themePanelOpen.value = !themePanelOpen.value;
}
const themeLogLines = computed(() => {
  const c = concept.value, mode = viewport.mode;
  if (c === 'zen') return themePanelOpen.value ? 12 : 1;
  if (c === 'manual') return mode === 'desktop' ? 8 : 6;
  if (c === 'ember') return mode === 'desktop' ? 5 : mode === 'landscape' ? 4 : 3;
  if (c === 'codex') return mode === 'desktop' ? 3 : 2;
  return mode === 'landscape' ? 1 : mode === 'desktop' ? 3 : 2;
});
// 夜读：进入时把地图放大到跟随视角，离开时恢复之前的缩放（镜头是显示偏好）。
let zoomBeforeCodex: number | null = null;
watch(concept, (next, prev) => {
  if (next === 'codex' && prev !== 'codex') { zoomBeforeCodex = cameraState.zoom; cameraState.fit = false; cameraState.zoom = Math.max(cameraState.zoom, 2); }
  else if (prev === 'codex' && next !== 'codex' && zoomBeforeCodex !== null) { cameraState.zoom = zoomBeforeCodex; zoomBeforeCodex = null; }
}, { immediate: true });
const replayTick = ref(0);
const replayActive = computed(() => { replayTick.value; return !!activeGame.replayRecording; });
let replayTimer = 0;
// 结算页只显示结算后的保存/导出反馈；开局时的菜单反馈不应带进结算页。
let endFeedbackCleared = false;
onMounted(() => { replayTimer = window.setInterval(() => {
  replayTick.value++;
  if (activeGame.isGameOver && !endFeedbackCleared) { endFeedbackCleared = true; replayFeedback.value = ''; }
  else if (!activeGame.isGameOver) endFeedbackCleared = false;
}, 100); });
onUnmounted(() => { window.clearInterval(replayTimer); runEpoch++; });
/** 触控命令栏 + 方向键：紧凑模式或粗指针设备显示；回放期间让位给录像控制条。 */
const showTouch = computed(() => shouldShowTouchControls(viewport.coarsePointer, viewport.mode) && !replayActive.value);
const showCommands = computed(() => (compact.value || showTouch.value) && !replayActive.value);

// UI-1 第 6 条：把引擎确认钩子接到本组件（headless/测试环境不挂载 App，
// 钩子保持 null → requestConfirm 按"确认"处理，与 C-5 申报一致）。
wireConfirmRequest(activeGame);

const gameStarted = ref(false);
const menuOpen = ref(true);
watch(menuOpen, (open) => {
  if (!open || !gameStarted.value) return;
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

const startNewGame = (payload: { seed?: string; mode: GameMode }) => {
  runEpoch++;
  replayFeedback.value = '';
  activeGame.startNewGame({ seed: payload.seed, mode: payload.mode });
  runAvailable.value = true;
  replayMessage(
    i18next.t('menu.log.started_game', {
      mode: i18next.t(`menu.mode.${payload.mode}`, { defaultValue: payload.mode }),
      seed: activeGame.currentSeed,
      defaultValue: 'Started {{mode}} game (seed {{seed}}).'
    })
  );
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
    runEpoch++;
    runAvailable.value = true;
    replayFeedback.value = '';
    storageTick.value++;
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
  try {
    const raw = window.localStorage.getItem(REPLAY_KEY);
    if (!raw) return;
    const recording = JSON.parse(raw);
    if (!activeGame.loadReplay(recording)) {
      replayMessage(i18next.t('menu.log.replay_load_failed', { defaultValue: 'Replay load failed.' }));
      return;
    }
    gameStarted.value = true;
    menuOpen.value = false;
    replayMessage(i18next.t('menu.log.replay_loaded', { defaultValue: 'Replay loaded.' }));
    runEpoch++;
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
  activeGame.replayPlay();
};

const replayPause = () => {
  activeGame.replayPause();
};

const replayStep = () => {
  activeGame.replayStep();
};

const replayRestart = () => {
  activeGame.replayRestart();
};

const replaySeek = (index: number) => {
  activeGame.replaySeek(index);
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
  try {
    const text = await file.text();
    const recording = JSON.parse(text);
    if (!activeGame.loadReplay(recording)) {
      replayMessage(i18next.t('menu.log.replay_import_failed', { defaultValue: 'Replay JSON import failed.' }));
      return;
    }
    runEpoch++;
    runAvailable.value = true;
    replayFeedback.value = i18next.t('menu.replay.imported_unsaved', { defaultValue: 'Recording imported. Save it to keep it in this browser.' });
    gameStarted.value = true;
    menuOpen.value = false;
    const imported = i18next.t('menu.log.replay_imported', { defaultValue: 'Replay JSON imported.' });
    replayFeedback.value = imported + ' ' + replayFeedback.value;
  } catch {
    replayMessage(i18next.t('menu.log.replay_import_failed', { defaultValue: 'Replay JSON import failed.' }));
  }
};

const handleReturnToTitle = async () => {
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
  <UiLabToolbar :in-game="gameStarted" />
  <div class="app-layout" :style="{ '--context-width': contextWidth }" :class="[`layout-${viewport.mode}`, { 'is-replaying': replayActive, 'has-touch-controls': showTouch, 'context-visible': !compact && contextOpen, 'theme-shell': shell, 'theme-panel-open': shell && themePanelOpen }]">
    <template v-if="gameStarted">
      <!-- FE-1：GameCanvas 始终是同一位置的同一实例（旋转屏幕不重建 Pixi），
           其余部件按布局模式挂载，用 CSS grid 区域摆放。 -->
      <MobileHud class="area-hud" :mode="viewport.mode" :panel-open="compact ? panelOpen : contextOpen" @menu="menuOpen = true" @open-panel="toggleContext" />
      <template v-if="shell">
        <ThemeHud class="area-vitals" :panel-open="compact && concept !== 'zen' && concept !== 'codex' ? panelOpen : themePanelOpen" @menu="menuOpen = true" @panel="toggleThemePanel" />
        <ThemeLog class="area-log" :lines="themeLogLines" @open-journal="journalOpen = true" />
        <ThemeNearby v-if="concept !== 'codex'" class="area-near" />
        <ThemeCodex v-if="concept === 'codex'" class="area-codex" @menu="menuOpen = true" @open-journal="journalOpen = true" @tab="same => themePanelOpen = same ? !themePanelOpen : true" />
        <ThemeKit v-if="concept === 'manual'" class="area-kit" />
        <RadialCommands v-if="concept === 'zen' && showTouch" class="area-radial" />
      </template>
      <div class="map-area">
        <GameCanvas class="game-view" />
        <MapZoomControls />
      </div>
      <TargetBar class="area-target" />
      <CommandBar v-if="showCommands || (!compact && !replayActive)" class="area-cmd" :mode="viewport.mode" />
      <DPad v-if="showTouch" class="area-pad" :mode="viewport.mode" />
      <MessageStrip class="area-strip" :lines="viewport.mode === 'landscape' ? 1 : 2" @open-panel="journalOpen = true" />
      <ContextPanel v-if="!compact && contextOpen" class="area-context" @close="contextOpen = false" />
      <SideDrawer :open="panelOpen" @close="panelOpen = false">
        <ContextPanel @close="panelOpen = false" />
      </SideDrawer>
      <SideDrawer :open="journalOpen" variant="journal" @close="journalOpen = false">
        <MessageJournal />
      </SideDrawer>
      <InventoryOverlay />
      <GameEndOverlay :can-save-replay="canSaveReplay" :replay-busy="replayBusy" :replay-feedback="replayFeedback"
        @save-replay="saveReplay" @export-replay-json="exportCurrentReplayJson" @return-to-title="handleReturnToTitle" />
      <ReplayControls />
      <AgentControls class="agent-root" :hide-controls="compact || touchUi" />
      <DetailPanel />
      <ReferenceOverlay />
    </template>
    <div v-else class="blank-stage" aria-hidden="true"></div>

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

/* 桌面：地图 + 右侧侧栏（与 v0.1.0 一致） */
.layout-desktop {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: minmax(0, 1fr);
  grid-template-areas: "map side";
}

/* 竖屏：状态条 / 地图 / 消息 / 命令栏 + 方向键 */
.layout-portrait {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  grid-template-areas:
    "hud hud"
    "map map"
    "strip strip"
    "cmd pad";
}

/* 横屏：左侧命令栏；右侧状态条 + 地图，消息与方向键浮在地图上 */
.layout-landscape {
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    "cmd hud"
    "cmd map";
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

.area-hud { grid-area: hud; }
.area-strip { grid-area: strip; min-width: 0; }
.layout-landscape .area-strip {
  grid-area: strip;
  align-self: stretch;
  justify-self: stretch;
  max-width: none;
  z-index: 12;
  border-top-right-radius: 10px;
  pointer-events: auto;
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

.menu-btn {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 1200;
  height: 30px;
  border: 1px solid var(--btn-border);
  background: var(--btn-bg);
  color: #e5e7eb;
  border-radius: 6px;
  padding: 0 10px;
  cursor: pointer;
}
</style>

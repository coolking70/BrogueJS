/**
 * src/ui/useGameHud.ts — FE-1 紧凑状态条 / 消息条的只读轮询。
 *
 * 沿用 Sidebar.vue 的 100ms 轮询模式（引擎是纯 TS 单例，无响应式），
 * 只读取玩家可见的显示信息，不调用任何改状态的方法。
 */
import { targetingState } from './targeting';
import { publicZoneAt, zoneStatusText } from '../engine/UI/MonsterZones';
import type { Pos } from '../types';
import { displayedFrame } from './presentationTimeline';
export { displayedFrame } from './presentationTimeline';
import { sidebarPlayerStats } from '../engine/UI/MonsterSidebar';
import { onMounted, onUnmounted, ref, toValue, type MaybeRefOrGetter } from 'vue';
import i18next from 'i18next';
import { activeGame } from '../engine/Core/Game';
import { foldCombatMessages, logger, type LogMessage } from '../engine/Systems/Logger';
import { creatureStatusRows } from '../engine/Status/statusConfig';
import { STOMACH_SIZE, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD } from '../entities/Player';

/** 与 Sidebar.getNutritionStatus 同一档位（CE Rogue.h:1125-1127）。 */
export function nutritionStatus(nutrition: number): { text: string; color: string } {
    if (nutrition <= 0) return { text: i18next.t('sidebar.hunger.starved'), color: '#b91c1c' };
    if (nutrition <= FAINT_THRESHOLD) return { text: i18next.t('sidebar.hunger.faint'), color: '#ef4444' };
    if (nutrition <= WEAK_THRESHOLD) return { text: i18next.t('sidebar.hunger.weak'), color: '#f87171' };
    if (nutrition <= HUNGER_THRESHOLD) return { text: i18next.t('sidebar.hunger.hungry'), color: '#facc15' };
    return { text: i18next.t('sidebar.hunger.full'), color: '#4ade80' };
}

export { playerHudStatusRows } from './playerHudStatus';
import { playerHudStatusRows } from './playerHudStatus';

export function useGameHud(logCount: MaybeRefOrGetter<number> = 3) {
    const stats = ref<ReturnType<typeof sidebarPlayerStats> | null>(null);
    const hp = ref(0);
    const maxHp = ref(0);
    const depth = ref(1);
    const turns = ref(0);
    const nutrition = ref(STOMACH_SIZE);
    const statuses = ref<ReturnType<typeof creatureStatusRows>>([]);
    const logs = ref<LogMessage[]>([]);
    const hoverText = ref('');
    const replayActive = ref(false);
    const targeting = ref<'none' | 'throw' | 'arcana'>('none');
    const targetName = ref('');
    const targetZone = ref('');
    const targetAim = ref<Pos | null>(null);

    const poll = () => {
        const game = activeGame;
        if (!game?.player) return;
        const frame = displayedFrame(game);
        if (frame) {
            stats.value = frame.stats; hp.value = frame.player.hp; maxHp.value = frame.player.maxHp;
            depth.value = frame.depth; turns.value = frame.messageTurn; nutrition.value = frame.player.nutrition;
            statuses.value = frame.statuses;
            const all = foldCombatMessages(frame.logs);
            logs.value = all.slice(Math.max(0, all.length - toValue(logCount))).reverse();
            hoverText.value = frame.hoverText; replayActive.value = !!game.replayRecording;
            targeting.value = frame.targeting; targetName.value = frame.targetName; targetAim.value = frame.throwAim;
            targetZone.value = frame.targetZone ?? '';
            return;
        }
        stats.value = sidebarPlayerStats(game.player, game.stats.gold, game['calculateStealthRange']());
        hp.value = game.player.hp;
        maxHp.value = game.player.maxHp;
        depth.value = game.depth;
        // CE Time.c:2500 playerTurnNumber；stats.turns 还包含强制麻痹结算。
        turns.value = logger.turn;
        nutrition.value = game.player.nutrition;
        statuses.value = playerHudStatusRows(game);
        const all = foldCombatMessages(logger.messages);
        logs.value = all.slice(Math.max(0, all.length - toValue(logCount))).reverse();
        hoverText.value = game.hoveredText || game.flavorText;
        replayActive.value = !!game.replayRecording;
        targeting.value = game.pendingArcana ? 'arcana' : game.isThrowing ? 'throw' : 'none';
        targetAim.value = targetingState.aim ? { ...targetingState.aim } : null;
        targetName.value = game.pendingArcana?.item.displayName ?? game.throwItemTarget?.displayName ?? '';
        const aim = game.pendingArcana?.cursor ?? targetingState.aim, monster = aim ? game.getMonsterAt(aim.x, aim.y) : undefined;
        const zone = aim && monster ? publicZoneAt(game.player, game.grid, monster, aim) : undefined;
        targetZone.value = zone && !zone.broken ? zoneStatusText(zone) : '';
        if (zone?.broken) targetAim.value = null;
    };

    let timer = 0;
    onMounted(() => {
        poll();
        timer = window.setInterval(poll, 100);
    });
    onUnmounted(() => window.clearInterval(timer));

    return { stats, hp, maxHp, depth, turns, nutrition, statuses, logs, hoverText, replayActive, targeting, targetName, targetZone, targetAim, poll };
}

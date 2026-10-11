import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { rows, start, state, mechanical, observe, acknowledge, attackCommand, play, clone } from './combat2Harness';
import { c5Canonical } from '../../../../../engine/Core/WorldCanonical';
import { TerrainType as T } from '../../../../../engine/Map/Grid';
import { T_PATHING_BLOCKER, T_LAVA_INSTA_DEATH, T_IS_DEEP_WATER, T_AUTO_DESCENT } from '../../../../../engine/Map/TerrainCatalog';
import { cellTerrainFlags } from '../../../../../engine/Map/DungeonFeature';
import { canDirectlySeeMonster } from '../../../../../engine/UI/MonsterVisibility';
import { footprintOf } from '../../../../../engine/Movement/CreatureSpatial';
import { preparePhasedAttackCommand, prepareActorParryCommand } from '../../../../../engine/Core/PhasedAttackProduction';
import { readPublicCombatTelegraphs } from '../../../../../ui/combatDrawing';
import { readCreatureBirth } from '../../../../birth';
import { ItemCategory } from '../../../../../engine/Items/Item';
import type { Game } from '../../../../../engine/Core/Game';
import { rng } from '../../../../../engine/Random';

export const dirs = [{ facing: 'n', x: 0, y: -1 }, { facing: 'e', x: 1, y: 0 }, { facing: 's', x: 0, y: 1 }, { facing: 'w', x: -1, y: 0 },
    { facing: 'ne', x: 1, y: -1 }, { facing: 'se', x: 1, y: 1 }, { facing: 'sw', x: -1, y: 1 }, { facing: 'nw', x: -1, y: -1 }] as const;
export const digest = (value: unknown) => createHash('sha256').update(c5Canonical(value, true)).digest('hex');
export const growthCommand = (game: Game, action: string, payload: Record<string, unknown>) => {
    const view = game.extensionRuntime!.readModuleView('growth')!;
    return JSON.stringify({ module: 'growth', action, payload: { revision: view.state.revision, ...payload } });
};
const visible = (game: Game) => game.monsters.filter(monster => monster.hp > 0 && !monster.isAlly && !monster.isCaged
    && canDirectlySeeMonster(game.player, game.grid, monster)).sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
const safe = (game: Game, x: number, y: number) => {
    const cell = game.grid.getCell(x, y);
    return !!cell && cell.isPassable && !(cellTerrainFlags(game.grid, x, y) & (T_PATHING_BLOCKER | T_LAVA_INSTA_DEATH | T_IS_DEEP_WATER | T_AUTO_DESCENT));
};
/** Diagnostic-free route controller. Engine route finder knows terrain; aiming
 * and opponent selection only use currently visible live creatures. */
export function route(game: Game, target: { x: number; y: number }) {
    const origin = game.player.loc, key = (x: number, y: number) => `${x},${y}`;
    const seen = new Set([key(origin.x, origin.y)]), queue = [{ ...origin, path: [] as (typeof dirs)[number][] }];
    const enemies = new Set(visible(game).flatMap(monster => footprintOf(monster)).map(cell => key(cell.x, cell.y)));
    for (let index = 0; index < queue.length; index++) {
        const point = queue[index]!;
        if (point.x === target.x && point.y === target.y) return point.path;
        for (const direction of dirs) {
            const x = point.x + direction.x, y = point.y + direction.y;
            if (seen.has(key(x, y)) || !safe(game, x, y) || enemies.has(key(x, y))) continue;
            if (direction.x && direction.y && (!safe(game, point.x + direction.x, point.y) || !safe(game, point.x, point.y + direction.y))) continue;
            seen.add(key(x, y)); queue.push({ x, y, path: [...point.path, direction] });
        }
    }
    return null;
}
export interface Trace {
    seed: number; mode: 'wizard' | 'normal'; modules: string[]; initialCommands: string[]; prefix: number;
    identity?: unknown;
    inputs: { action: string; data?: unknown; index: number }[];
    checkpoints: Record<number, string>; keyIndices: number[]; births: { id: number; depth: number; type: string; birth: unknown }[];
    hits: ReturnType<typeof observe>['hits']; releases: ReturnType<typeof observe>['releases']; parries: ReturnType<typeof observe>['parries'];
    evasion: { actionId: number; index: number; cells: { x: number; y: number }[]; from: { x: number; y: number }; to: { x: number; y: number } }[];
    growth: { index: number; focusBefore: unknown; focusAfter: unknown; staminaBefore: number; staminaAfter: number }[];
    reason: string; commands: number; depth: number; tick: number; finalRng: unknown; recordingBytes: number;
}
export function captureNatural(seed: number, mode: Trace['mode'], modules: string[], goals: { player: Set<string>; npc: Set<string>; parry: boolean; evasion: boolean; giant: boolean; growth: boolean }, maxCommands = 2500, purpose: 'all' | 'combination' | 'normal' = 'all') {
    const { game, initialCommands, zero } = start(modules, seed, mode), observation = modules.includes('combat') ? observe(game) : null;
    const trace: Trace = { seed, mode, modules, initialCommands, prefix: game.recordedInputEvents.length, inputs: [], checkpoints: { 0: digest(zero), [game.recordedInputEvents.length]: digest(mechanical(game)) },
        keyIndices: [0, game.recordedInputEvents.length], births: [], hits: [], releases: [], parries: [], evasion: [], growth: [], reason: '', commands: 0, depth: game.depth, tick: 0, finalRng: null, recordingBytes: 0 };
    const keys = new Map<number, { snapshot: ReturnType<typeof mechanical>; save: ReturnType<Game['toSaveSnapshot']> }>();
    const remember = () => { const index = game.recordedInputEvents.length; if (keys.size >= 48) return; if (!trace.keyIndices.includes(index)) trace.keyIndices.push(index);
        keys.set(index, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) }); };
    remember();
    const births = new Set<number>(), attemptedNpc = new Map<number, number>(), savedTags = new Set<string>();
    let seenHits = 0, seenReleases = 0, seenParries = 0, stagnant = 0, combatCommands = 0, previous = '', skillDone = false, counterDone = false, revisited = false;
    const execute = (action: string, data?: unknown) => {
        acknowledge(); const beforeIndex = game.recordedInputEvents.length;
        if (process.env.COMBAT2_JOURNAL === '1') {
            writeFileSync('/tmp/combat2-evidence/natural/pending.json', JSON.stringify({ seed, mode, modules, initialCommands, inputs: trace.inputs, action, data, commands: trace.commands, depth: game.depth, tick: mechanical(game).run.currentTick }));
            writeFileSync('/tmp/combat2-evidence/natural/pending.save.json', JSON.stringify(game.toSaveSnapshot()));
            writeFileSync('/tmp/combat2-evidence/natural/pending.recording.json', JSON.stringify(game.exportRecording()));
        }
        try { play(game, action, data); }
        catch (error) {
            const directory = '/tmp/combat2-evidence/natural';
            writeFileSync(`${directory}/failure-${seed}.json`, JSON.stringify({ seed, mode, modules, initialCommands,
                inputs: trace.inputs, attempted: { action, data }, commands: trace.commands, depth: game.depth,
                error: String(error), stack: error instanceof Error ? error.stack : null,
                actorActions: game.actorActions, combat: state(game), rng: rng.getState() }, null, 2));
            const savedKeys = [...keys], last = savedKeys[savedKeys.length - 1];
            if (last) writeFileSync(`${directory}/failure-${seed}-last-safe.save.json`, JSON.stringify({ index: last[0], save: last[1].save }));
            throw error;
        }
        trace.commands++;
        if (game.recordedInputEvents.length > beforeIndex) { trace.inputs.push({ action, data, index: game.recordedInputEvents.length }); trace.checkpoints[game.recordedInputEvents.length] = digest(mechanical(game)); }
        const current = `${game.depth}:${game.player.x},${game.player.y}:${visible(game).map(monster => `${monster.id}:${monster.hp}`).join(',')}`;
        stagnant = current === previous ? stagnant + 1 : 0; previous = current;
        if (process.env.COMBAT2_CAPTURE === '1' && trace.commands % 64 === 0) console.info(JSON.stringify({ seed, commands: trace.commands, depth: game.depth, stagnant }));
        for (const monster of game.monsters) if (!births.has(monster.id)) { births.add(monster.id); const birth = readCreatureBirth(monster);
            if (birth) trace.births.push({ id: monster.id, depth: game.depth, type: monster.typeId, birth: clone(birth) }); }
        if (observation) {
            const newHits = observation.hits.slice(seenHits), newReleases = observation.releases.slice(seenReleases), newParries = observation.parries.slice(seenParries);
            for (const hit of newHits) if (hit.damage > 0 && hit.sourceId === game.player.id && hit.attackId) goals.player.add(hit.attackId);
            for (const release of newReleases) if (release.sourceId !== game.player.id && rows.some(row => `combat.${row.id}` === release.attackId)) goals.npc.add(release.attackId);
            if (newParries.some(parry => parry.targetId === game.player.id)) { goals.parry = true; remember(); }
            if (newHits.some(hit => hit.sourceId === game.player.id && hit.damage > 0
                && rows.some(row => hit.attackId === `combat.${row.id}`)
                && trace.births.some(birth => birth.id === hit.targetId && birth.type.startsWith('giants.')))) goals.giant = true;
            const tags = [...newHits.filter(hit => hit.damage > 0).map(hit => `hit:${hit.sourceId === game.player.id ? 'player' : 'npc'}:${hit.attackId}`),
                ...newReleases.map(release => `release:${release.sourceId === game.player.id ? 'player' : 'npc'}:${release.attackId}:${release.segmentIndex}`)];
            if (tags.some(tag => !savedTags.has(tag))) { tags.forEach(tag => savedTags.add(tag)); remember(); }
            // Keep bounded evidence, not whole Game references.
            seenHits = observation.hits.length; seenReleases = observation.releases.length; seenParries = observation.parries.length;
        }
        if (modules.includes('combat')) for (const action of state(game).actions) for (const sub of action.subactions) {
            const bundle = game.actorActions!.bundles.find(bundle => bundle.actionId === action.actionId);
            const child = bundle?.subactions.find(child => child.sourceSubactionId === sub.sourceSubactionId);
            const tag = `safe:${sub.attackId}:${child?.phases[child.phaseIndex]?.kind}`;
            if (bundle && bundle.decisionOwnerId !== game.player.id && !savedTags.has(tag)) { savedTags.add(tag); remember(); }
        }
    };
    if (modules.includes('growth')) execute('ext:command', growthCommand(game, 'equip-skills', { active: ['growth.skill.measured-strike'], passive: [] }));
    while (trace.commands < maxCommands && game.depth <= 8 && !game.isGameOver) {
        if (stagnant >= 64) { trace.reason = 'no-progress-64'; break; }
        const enemies = visible(game); combatCommands = enemies.length ? combatCommands + 1 : 0;
        if (combatCommands > 300) { trace.reason = 'combat-limit-300'; break; }
        const food = game.player.inventory.items.find(item => item.category === ItemCategory.FOOD);
        if (food && game.player.nutrition < 400) { execute('item:command', `eat|${food.inventoryLetter}|`); continue; }
        if (!food && game.player.nutrition <= 0) { trace.reason = 'starving'; break; }
        if (!modules.includes('combat')) { execute('wait'); if (trace.commands === 2) remember();
            if (trace.commands >= 4) { trace.reason = 'empty-module-short-run'; break; } continue; }
        if (purpose !== 'all' && observation!.hits.some(hit => hit.sourceId === game.player.id && hit.damage > 0
            && rows.some(row => hit.attackId === `combat.${row.id}`))
            && (!modules.includes('growth') || skillDone)) { trace.reason = 'combination-hit'; break; }
        const warning = readPublicCombatTelegraphs(game).find(entry => entry.sourceEntityId !== game.player.id && entry.cells.some(cell => cell.x === game.player.x && cell.y === game.player.y));
        if (warning) {
            const source = enemies.find(monster => monster.id === warning.sourceEntityId);
            const direction = source && dirs.find(dir => dir.x === Math.sign(source.x - game.player.x) && dir.y === Math.sign(source.y - game.player.y));
            if (!goals.parry && warning.parryable === true && (warning.remainingTicks ?? 1000) < 60 && source && game.meleeContact(source, game.player) && direction) {
                const data = JSON.stringify({ module: 'combat', action: 'parry', payload: { facing: direction.facing } });
                if (prepareActorParryCommand(game, data)) { execute('ext:command', data); continue; }
            }
            if (!goals.evasion && source && rows.some(row => row.monster === source.typeId)) {
                const move = dirs.find(dir => safe(game, game.player.x + dir.x, game.player.y + dir.y)
                    && !warning.cells.some(cell => cell.x === game.player.x + dir.x && cell.y === game.player.y + dir.y)
                    && !enemies.some(monster => footprintOf(monster).some(cell => cell.x === game.player.x + dir.x && cell.y === game.player.y + dir.y)));
                if (move) { const from = { ...game.player.loc }; execute('move', { x: move.x, y: move.y });
                    if (game.player.x !== from.x || game.player.y !== from.y) { trace.evasion.push({ actionId: warning.actionId, index: game.recordedInputEvents.length, cells: clone([...warning.cells]), from, to: { ...game.player.loc } }); goals.evasion = true; remember(); }
                    continue; }
            }
        }
        const adjacent = enemies.find(monster => game.meleeContact(game.player, monster));
        if (modules.includes('growth') && !skillDone && adjacent) {
            const view = game.extensionRuntime!.readModuleView('growth')!, focusBefore = clone(view.components.focus);
            const staminaBefore = state(game).actors.find(actor => actor.actorId === game.player.id)?.stamina ?? 24;
            const beforeHits = observation!.hits.length;
            execute('ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: adjacent.id } }));
            const focusAfter = clone(game.extensionRuntime!.readModuleView('growth')!.components.focus);
            if (observation!.hits.length > beforeHits || digest(focusAfter) !== digest(focusBefore)) { skillDone = true; goals.growth = true;
                trace.growth.push({ index: game.recordedInputEvents.length, focusBefore, focusAfter, staminaBefore, staminaAfter: state(game).actors.find(actor => actor.actorId === game.player.id)?.stamina ?? 24 }); remember(); continue; }
        }
        const localParry = observation!.parries.some(parry => parry.targetId === game.player.id);
        if (adjacent && localParry && !counterDone) {
            const dir = dirs.find(dir => dir.x === Math.sign(adjacent.x - game.player.x) && dir.y === Math.sign(adjacent.y - game.player.y))!;
            if (preparePhasedAttackCommand(game, attackCommand('combat.answering-edge', dir.facing))) { execute('ext:command', attackCommand('combat.answering-edge', dir.facing)); counterDone = true; remember(); continue; }
        }
        const waiting = enemies.find(monster => { const row = rows.find(row => row.monster === monster.typeId); return row && !goals.npc.has(`combat.${row.id}`) && Math.max(Math.abs(monster.x - game.player.x), Math.abs(monster.y - game.player.y)) <= 3 && (attemptedNpc.get(monster.id) ?? 0) < 4; });
        if (waiting) { attemptedNpc.set(waiting.id, (attemptedNpc.get(waiting.id) ?? 0) + 1); execute('wait'); continue; }
        let chosen: { id: string; facing: string } | undefined;
        if (enemies.length) for (const row of [...rows.filter(row => !goals.player.has(`combat.${row.id}`)), ...rows.filter(row => goals.player.has(`combat.${row.id}`))]) {
            for (const direction of dirs) {
                const plan = preparePhasedAttackCommand(game, attackCommand(`combat.${row.id}`, direction.facing));
                if (plan && enemies.some(monster => footprintOf(monster).some(cell => plan.cells.some(point => point.x === cell.x && point.y === cell.y)))) { chosen = { id: `combat.${row.id}`, facing: direction.facing }; break; }
            }
            if (chosen) break;
        }
        if (chosen) { execute('ext:command', attackCommand(chosen.id, chosen.facing)); continue; }
        if (adjacent) { execute('wait'); continue; }
        if (goals.player.size === 5 && goals.npc.size === 5 && goals.parry && goals.evasion && (!localParry || counterDone) && (!modules.includes('giants') || goals.giant) && (!modules.includes('growth') || skillDone)) { trace.reason = 'goals-complete'; break; }
        if (game.depth === 8 && enemies.length === 0) { trace.reason = 'depth-limit-8'; break; }
        // No unseen creature is inspected for aiming. Only a staircase terrain
        // target is read from the full engine map, as explicitly disclosed.
        let stairs: { x: number; y: number } | undefined;
        for (let y = 0; y < game.grid.height; y++) for (let x = 0; x < game.grid.width; x++) if (game.grid.getCell(x, y)!.layers.includes(T.STAIRS_DOWN)) stairs = { x, y };
        const path = stairs && route(game, stairs);
        if (!path) { trace.reason = 'no-safe-stair-route'; break; }
        const oldDepth = game.depth;
        if (path.length === 0) execute('stairs_down'); else execute('move', { x: path[0]!.x, y: path[0]!.y });
        if (process.env.COMBAT2_REVISIT === '1' && !revisited && game.depth === oldDepth + 1) {
            remember(); execute('stairs_up');
            if (game.depth === oldDepth) { execute('stairs_down'); revisited = game.depth === oldDepth + 1; remember(); }
        }
    }
    if (purpose === 'combination' && modules.includes('combat') && !game.isGameOver) for (const row of rows) {
        const id = `combat.${row.id}`;
        if (trace.inputs.some(input => input.action === 'ext:command' && typeof input.data === 'string' && input.data.includes(`"attackId":"${id}"`))) continue;
        for (let wait = 0; wait < 10 && !preparePhasedAttackCommand(game, attackCommand(id)); wait++) execute('wait');
        if (preparePhasedAttackCommand(game, attackCommand(id))) { remember(); execute('ext:command', attackCommand(id)); remember(); }
    }
    trace.reason ||= game.isGameOver ? 'death' : 'command-limit'; remember();
    trace.depth = game.depth; trace.tick = mechanical(game).run.currentTick; trace.finalRng = mechanical(game).rngState;
    if (observation) { trace.hits = clone(observation.hits); trace.releases = clone(observation.releases); trace.parries = clone(observation.parries); observation.restore(); }
    const recording = clone(game.exportRecording()); trace.identity = clone(recording.extensions);
    trace.recordingBytes = Buffer.byteLength(JSON.stringify(recording));
    return { game, trace, recording, keys, zero };
}

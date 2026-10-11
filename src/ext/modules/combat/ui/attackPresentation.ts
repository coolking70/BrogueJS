import { loadCombatDefinitionPack } from '../definitions';
import { attackTiming } from '../components';

const pack = loadCombatDefinitionPack();
const hints: Readonly<Record<string, string>> = Object.freeze({
    'combat.anchor-break': 'ext.combat.attack.anchor-break.hint',
    'combat.returning-sweep': 'ext.combat.attack.returning-sweep.hint',
    'combat.advancing-point': 'ext.combat.attack.advancing-point.hint',
    'combat.cast-echo': 'ext.combat.attack.cast-echo.hint',
    'combat.answering-edge': 'ext.combat.attack.answering-edge.hint',
});

/** Static installed content only. Never use this table to identify a public
 * warning whose captured DisplayFrame does not expose an attack identity. */
export function combatAttackPresentation(id: string) {
    const attack = pack.attacks.find(entry => entry.id === id);
    if (!attack) return null;
    return Object.freeze({
        hintKey: hints[id] ?? 'ext.combat.ui.locked_world_hint',
        windup: attack.windupTicks,
        delays: Object.freeze(attack.segments.map(segment => segment.delayTicks)),
        recovery: attack.recoveryTicks,
        total: attackTiming(attack).duration,
    });
}

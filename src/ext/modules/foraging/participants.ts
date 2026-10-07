import i18next from 'i18next';
import type { ActorNeedParticipant, EdibleParticipant } from '../../edibleSdk';
import type { HookHandlers } from '../../types';
import type { ForagingPack, ForagingState } from './types';
import { dataRecord, inspectConsumedFact, safeUint } from './knowledge';
import { applyFact, validFireFact, validNeedFact, validateForagingState } from './state';

export function createForagingEdibleParticipant(pack: ForagingPack): EdibleParticipant {
  return {
    onConsumed(fact, tx) {
      let next: ForagingState, learnedNext: ForagingState;
      let targets: string[], level: 'known' | 'tasted', message: string | null;
      let params: { name: string } | undefined;
      try {
        const state = tx.state, read = inspectConsumedFact(fact, pack);
        if (!validateForagingState(state, pack) || !read || fact.factId <= state.lastFactId) return;
        next = applyFact(state, fact, pack);
        learnedNext = applyFact(state, fact, pack, true);
        if (next === state || learnedNext === state) return;
        targets = []; level = 'tasted'; message = null;
        if (read.kind === null) {
          if (fact.operation === 'feed') message = 'ext.foraging.message.fed_food';
        } else if (read.revealed) {
          level = 'known'; targets = [fact.definitionId!];
          if (read.form === 'roasted') targets.push(read.raw!);
          params = { name: i18next.t(`ext.foraging.kind.${read.knownNameKey!.slice('ext.foraging.kind.'.length)}`) };
          message = fact.operation === 'feed' ? 'ext.foraging.message.fed_revealed' :
            read.form === 'roasted' ? 'ext.foraging.message.revealed_roasted' : 'ext.foraging.message.revealed';
        } else {
          targets = [fact.definitionId!];
          message = fact.operation === 'feed' ? 'ext.foraging.message.fed_tasted' : 'ext.foraging.message.tasted';
        }
      } catch { return; } // Invalid inputs and planning failures must cause zero writes.
      // Trusted writer errors must escape to the foundation's strict/degraded transaction.
      let learned = false;
      for (const target of targets) {
        const changed = tx.markKnowledge(target, level);
        if (level === 'known') learned = changed || learned;
      }
      if (message !== null) {
        if (params) tx.message(message, params);
        else tx.message(message);
      }
      tx.replaceState(learned ? learnedNext : next);
    },
    onFireContact(fact, tx) {
      let next: ForagingState, learnedNext: ForagingState, reveal: boolean;
      try {
        const state = tx.state;
        if (!validateForagingState(state, pack) || !validFireFact(fact, pack) || fact.factId <= state.lastFactId) return;
        reveal = fact.definitionId === 'foraging.blast' && fact.result === 'exploded' &&
          (fact.visibleToPlayer || fact.location === 'inventory');
        next = applyFact(state, fact, pack); learnedNext = applyFact(state, fact, pack, true);
        if (next === state || learnedNext === state) return;
      } catch { return; }
      {
        const learned = reveal ? tx.markKnowledge('foraging.blast', 'known') : false;
        tx.replaceState(learned ? learnedNext : next);
        // Foundation emits the fire message after this knowledge transaction.
      }
    }
  };
}
export function createForagingActorNeedParticipant(pack: ForagingPack): ActorNeedParticipant {
  return {
    qualifies(needId, facts, context) {
      try {
        if (needId !== pack.companion.needId || !dataRecord(facts, ['actorId', 'monsterId', 'allied', 'inanimate', 'timedSummon', 'groupRole']) ||
          !safeUint(facts.actorId, 1) || !(facts.monsterId === null || typeof facts.monsterId === 'string') ||
          facts.allied !== true || facts.inanimate !== false || facts.timedSummon !== false ||
          !['single', 'core'].includes(facts.groupRole) || (facts.monsterId !== null && pack.companion.nonEaters.includes(facts.monsterId))) return false;
        try {
          const result = context.queryOptional(pack.companion.residentQuery, { actorId: facts.actorId });
          if (dataRecord(result) && result.status === 'available' && dataRecord(result.value, ['resident']) && result.value.resident === true) return false;
        } catch { /* An absent or broken optional provider does not exclude an ordinary ally. */ }
        return true;
      } catch { return false; }
    },
    onNeedEvent(fact, tx) {
      let next: ForagingState;
      let actorId: number, component: { band: string } | null, message: string | null;
      let depart: boolean, remove: boolean;
      try {
        const state = tx.state;
        if (!validateForagingState(state, pack) || !validNeedFact(fact, pack) || fact.factId <= state.lastFactId) return;
        next = applyFact(state, fact, pack);
        if (next === state) return;
        const visible = fact.visibleToPlayer && !fact.deferred;
        actorId = fact.actorId;
        component = fact.kind === 'attached' || fact.kind === 'band' ? { band: fact.band } : null;
        message = visible && fact.kind === 'band' ? `ext.foraging.message.band.${fact.band}` :
          visible && fact.kind === 'deadline' ? 'ext.foraging.message.departing' : null;
        depart = fact.kind === 'deadline'; remove = fact.kind === 'detached';
      } catch { return; }
      if (component) tx.setOwnComponent(actorId, 'hunger', component);
      if (message) tx.message(message);
      if (depart) tx.depart(actorId);
      // Removal is idempotent when death/retirement has already cleaned the actor.
      if (remove) tx.removeOwnComponent(actorId, 'hunger');
      tx.replaceState(next);
    }
  };
}
export const foragingActorDeparted: NonNullable<HookHandlers['actorDeparted']> = (event, context) => {
  try {
    if (event.owner !== 'foraging') return;
    context.message(i18next.t(event.deferred ? 'ext.foraging.message.departed_away' : 'ext.foraging.message.departed', { name: event.actor.name }));
  } catch { /* A display hook never changes mechanical state. */ }
};

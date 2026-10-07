import i18next from 'i18next';
import type { ActorNeedParticipant, EdibleParticipant } from '../../edibleSdk';
import type { HookHandlers } from '../../types';
import type { ForagingPack, ForagingState } from './types';
import { dataRecord, inspectConsumedFact, safeUint } from './knowledge';
import { applyFact, validFireFact, validNeedFact, validateForagingState } from './state';

export function createForagingEdibleParticipant(pack: ForagingPack): EdibleParticipant {
  return {
    onConsumed(fact, tx) {
      let previous: ForagingState, next: ForagingState, learnedNext: ForagingState;
      let read: NonNullable<ReturnType<typeof inspectConsumedFact>>;
      let name = '';
      try {
        const state = tx.state, inspected = inspectConsumedFact(fact, pack);
        if (!validateForagingState(state, pack) || !inspected || fact.factId <= state.lastFactId) return;
        previous = state; read = inspected;
        if (read.revealed) name = i18next.t(`ext.foraging.kind.${read.knownNameKey!.slice('ext.foraging.kind.'.length)}`);
        next = applyFact(previous, fact, pack);
        learnedNext = applyFact(previous, fact, pack, true);
        if (next === previous || learnedNext === previous) return;
      } catch { return; } // Validate and prepare all owned data before the first write.
      try {
        let learned = false;
        if (read.kind === null) {
          if (fact.operation === 'feed') tx.message('ext.foraging.message.fed_food');
        } else if (read.revealed) {
          learned = tx.markKnowledge(fact.definitionId!, 'known');
          if (read.form === 'roasted') learned = tx.markKnowledge(read.raw!, 'known') || learned;
          tx.message(fact.operation === 'feed' ? 'ext.foraging.message.fed_revealed' :
            read.form === 'roasted' ? 'ext.foraging.message.revealed_roasted' : 'ext.foraging.message.revealed', { name });
        } else {
          tx.markKnowledge(fact.definitionId!, 'tasted');
          tx.message(fact.operation === 'feed' ? 'ext.foraging.message.fed_tasted' : 'ext.foraging.message.tasted');
        }
        tx.replaceState(learned ? learnedNext : next);
      } catch { /* The module's participant contract requires a nonthrowing callback. */ }
    },
    onFireContact(fact, tx) {
      let next: ForagingState, learnedNext: ForagingState;
      try {
        const state = tx.state;
        if (!validateForagingState(state, pack) || !validFireFact(fact, pack) || fact.factId <= state.lastFactId) return;
        next = applyFact(state, fact, pack); learnedNext = applyFact(state, fact, pack, true);
        if (next === state || learnedNext === state) return;
      } catch { return; }
      try {
        const learned = fact.definitionId === 'foraging.blast' && fact.result === 'exploded' &&
          (fact.visibleToPlayer || fact.location === 'inventory') ? tx.markKnowledge('foraging.blast', 'known') : false;
        tx.replaceState(learned ? learnedNext : next);
        // Foundation emits the fire message after this knowledge transaction.
      } catch { /* Ignore an unavailable transaction writer. */ }
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
      try {
        const state = tx.state;
        if (!validateForagingState(state, pack) || !validNeedFact(fact, pack) || fact.factId <= state.lastFactId) return;
        next = applyFact(state, fact, pack);
        if (next === state) return;
      } catch { return; }
      try {
        const visible = fact.visibleToPlayer && !fact.deferred;
        switch (fact.kind) {
          case 'attached': tx.setOwnComponent(fact.actorId, 'hunger', { band: fact.band }); break;
          case 'band':
            tx.setOwnComponent(fact.actorId, 'hunger', { band: fact.band });
            if (visible) tx.message(`ext.foraging.message.band.${fact.band}`);
            break;
          case 'deadline':
            if (visible) tx.message('ext.foraging.message.departing');
            tx.depart(fact.actorId);
            break;
          case 'detached':
            // Removal is idempotent when death/retirement has already cleaned the actor.
            tx.removeOwnComponent(fact.actorId, 'hunger');
            break;
        }
        tx.replaceState(next);
      } catch { /* Do not turn unexpected need deliveries into world failures. */ }
    }
  };
}
export const foragingActorDeparted: NonNullable<HookHandlers['actorDeparted']> = (event, context) => {
  try {
    if (event.owner !== 'foraging') return;
    context.message(i18next.t(event.deferred ? 'ext.foraging.message.departed_away' : 'ext.foraging.message.departed', { name: event.actor.name }));
  } catch { /* A display hook never changes mechanical state. */ }
};

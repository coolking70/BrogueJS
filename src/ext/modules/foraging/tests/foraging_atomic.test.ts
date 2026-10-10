import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import type { ModuleDescriptor } from '../../../descriptor';
import type { EdibleTransaction, NeedTransaction, NeedEventFact } from '../../../edibleSdk';
import type { Game } from '../../../../engine/Core/Game';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import { TerrainType } from '../../../../engine/Map/Grid';
import { descriptor } from '../descriptor';
import { addAlly, addFood, eat, feed, game, hearth, knowledgeState, logger, makeHarness, mechanics, roast, roastChoice, rng, scene, state } from './mechanicsHelpers';

let roastedSeed: number | undefined;
function keepRoastedSeed() {
  if (roastedSeed === undefined) {
    const fp = game(makeHarness()).extensionRuntime!.worldDefinitionFingerprints().foraging!;
    roastedSeed = 1; while (roastChoice(roastedSeed, fp, 1) !== 0) roastedSeed++;
  }
  return roastedSeed;
}

type Writer = 'markKnowledge' | 'message' | 'replaceState' | 'setOwnComponent' | 'removeOwnComponent' | 'depart';
type Method = 'onConsumed' | 'onFireContact' | 'onNeedEvent';
type Fault = { writer: Writer; occurrence?: number; after?: boolean };
function injection(method: Method, fault: Fault | null, needKind?: NeedEventFact['kind']) {
  let current: Game;
  const calls: Writer[] = [], completed: Writer[] = [], entries: ReturnType<typeof boundary>[] = [];
  let enabled = false, faultsEnabled = true;
  const error = Error('foraging writer fault');
  function wrap(tx: EdibleTransaction | NeedTransaction) {
    const result = { ...tx };
    for (const writer of ['markKnowledge', 'message', 'replaceState', 'setOwnComponent', 'removeOwnComponent', 'depart'] as const) {
      const original = (tx as unknown as Record<Writer, (...args: unknown[]) => unknown>)[writer];
      if (!original) continue;
      Object.assign(result, { [writer]: (...args: unknown[]) => {
        calls.push(writer);
        const fails = faultsEnabled && fault?.writer === writer && calls.filter(k => k === writer).length === (fault.occurrence ?? 1);
        if (fails && !fault!.after) throw error;
        const value = original(...args); completed.push(writer);
        if (fails && fault!.after) throw error;
        return value;
      } });
    }
    return result;
  }
  const override: ModuleDescriptor = { ...descriptor, create: () => {
    const m = descriptor.create(), e = m.edibleParticipant!, n = m.actorNeedParticipant!;
    return { ...m, edibleParticipant: {
      onConsumed(f, tx) { if (enabled && method === 'onConsumed') { entries.push(boundary(current)); e.onConsumed!(f, wrap(tx) as EdibleTransaction); } else e.onConsumed!(f, tx); },
      onFireContact(f, tx) { if (enabled && method === 'onFireContact') { entries.push(boundary(current)); e.onFireContact!(f, wrap(tx) as EdibleTransaction); } else e.onFireContact!(f, tx); }
    }, actorNeedParticipant: { qualifies: n.qualifies,
      onNeedEvent(f, tx) { if (enabled && method === 'onNeedEvent' && (!needKind || f.kind === needKind)) { entries.push(boundary(current)); n.onNeedEvent!(f, wrap(tx) as NeedTransaction); } else n.onNeedEvent!(f, tx); }
    } };
  } };
  return { override, calls, completed, entries, disableFault() { faultsEnabled = false; }, arm(g: Game) { current = g; enabled = true; } };
}
function boundary(g: Game) {
  const s = g.extensionRuntime!.snapshot();
  return structuredClone({ state: s.modules.foraging, components: s.components, foundation: s.foundation,
    messages: logger.messages, rng: rng.getState(), world: g.world5 });
}
const consumedFaults: Fault[] = [
  { writer: 'markKnowledge' }, { writer: 'markKnowledge', after: true },
  { writer: 'markKnowledge', occurrence: 2 }, { writer: 'markKnowledge', occurrence: 2, after: true },
  { writer: 'message' }, { writer: 'message', after: true },
  { writer: 'replaceState' }, { writer: 'replaceState', after: true }
];
const fireFaults: Fault[] = [{ writer: 'markKnowledge' }, { writer: 'markKnowledge', after: true }, { writer: 'replaceState' }, { writer: 'replaceState', after: true }];

describe('foraging original participants: strict real Game writer rollback', () => {
  for (const action of ['eat', 'feed', 'roast'] as const) for (const fault of action === 'roast' ? fireFaults : consumedFaults)
    it(`${action}: ${fault.writer} #${fault.occurrence ?? 1} ${fault.after ? 'after' : 'before'} writing is a recorded zero-cost rejection`, () => {
      const injected = injection(action === 'roast' ? 'onFireContact' : 'onConsumed', fault);
      const h = makeHarness(keepRoastedSeed(), action === 'roast' ? ['foraging', 'fgheat'] : ['foraging'], [injected.override]), g = scene(h);
      const source = action === 'roast' ? hearth(h) : null;
      const ally = action === 'feed' ? addAlly(h) : null;
      const item = addFood(h, action === 'roast' ? 'blast' : 'venom-roasted', 2);
      injected.arm(g);
      const before = mechanics(h), messages = structuredClone(logger.messages), random = rng.getState(), count = g.recordedInputEvents.length;
      const inventory = [...g.player.inventory.items], monsters = [...g.monsters];
      const nativeBefore = g.toSnapshot();
      if (action === 'eat') eat(h, item);
      else if (action === 'feed') expect(feed(h, ally!, item).error).toBe('C5_PROVIDER');
      else expect(roast(h, item, source!.interactableId).error).toBe('C5_PROVIDER');
      expect(worldWorkLastError(g)).toBe('C5_PROVIDER');
      expect(g.recordedInputEvents).toHaveLength(count + 1);
      expect(g.recordedInputEvents[count]).toMatchObject({ action: action === 'eat' ? 'item:execute' : 'ext:command' });
      if (action === 'eat') expect(g.recordedInputEvents[count]!.data).toBe(`eat|${item.inventoryLetter}`);
      else expect(JSON.parse(g.recordedInputEvents[count]!.data as string)).toMatchObject({ module: 'foraging', action, payload: { itemId: item.id } });
      expect(mechanics(h)).toEqual(before);
      expect(rng.getState()).toEqual(random); expect(logger.messages).toEqual(messages);
      expect(g.player.inventory.items.length).toBe(inventory.length);
      inventory.forEach((value, i) => expect(g.player.inventory.items[i]).toBe(value));
      monsters.forEach((value, i) => expect(g.monsters[i]).toBe(value));
      const nativeAfter = g.toSnapshot();
      expect(nativeAfter.monsters).toEqual(nativeBefore.monsters);
      expect(nativeAfter.items).toEqual(nativeBefore.items);
      expect(nativeAfter.grid).toEqual(nativeBefore.grid);
      expect(item.quantity).toBe(2); expect(knowledgeState(g, item.worldItem!.definitionId)).toBe('unknown');
      expect(injected.entries).toHaveLength(1);
      expect(injected.calls[injected.calls.length - 1]).toBe(fault.writer);
      expect(injected.completed.length).toBe(injected.calls.length - (fault.after ? 0 : 1));
    });
  it.each(['eat', 'feed', 'roast'] as const)('%s same original participant succeeds without an injected writer fault', action => {
    const injected = injection(action === 'roast' ? 'onFireContact' : 'onConsumed', null);
    const h = makeHarness(keepRoastedSeed(), action === 'roast' ? ['foraging', 'fgheat'] : ['foraging'], [injected.override]), g = scene(h);
    const source = action === 'roast' ? hearth(h) : null, ally = action === 'feed' ? addAlly(h) : null;
    const item = addFood(h, action === 'roast' ? 'blast' : 'venom-roasted', 2), tick = g.world5!.simulationTicks;
    injected.arm(g);
    if (action === 'eat') eat(h, item); else if (action === 'feed') expect(feed(h, ally!, item).error).toBeNull();
    else expect(roast(h, item, source!.interactableId).error).toBeNull();
    expect(worldWorkLastError(g)).toBeNull(); expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
    expect(state(h).totals[action === 'eat' ? 'eaten' : action === 'feed' ? 'fed' : 'exploded']).toBe(1);
    expect(injected.calls).toContain('replaceState');
  });
});

// A valid controlled near-boundary scene, never a forged delivery. Public commands allocate facts.
function nearNeed(g: Game, actorId: number, kind: 'band' | 'deadline' | 'feed') {
  const s = g.toSnapshot(), row = s.extensions!.foundation.actorNeeds!.rows.find(r => r.actorId === actorId)!;
  const now = s.run.world5!.simulationTicks;
  Object.assign(row, { value: kind === 'band' ? 301 : 0, band: kind === 'band' ? 'fed' : 'starving',
    remainderTicks: kind === 'band' ? 100 : 0, lastSettledTick: now,
    zeroSinceTick: kind === 'deadline' ? now : kind === 'feed' ? now : null, deadlineFired: false });
  s.extensions!.components[String(actorId)]!['foraging:hunger'] = { band: row.band };
  if (kind === 'deadline') { s.run.world5!.simulationTicks = now + 29900; row.lastSettledTick = now + 29900; }
  expect(g.loadSnapshot(s)).toBe(true); g.animationEnabled = false;
  return g.monsters.find(m => m.id === actorId)!;
}

describe('foraging original participants: degraded real Game writer rollback', () => {
  for (const fault of fireFaults) it(`environment fire: ${fault.writer} ${fault.after ? 'after' : 'before'} preserves mechanical explosion`, () => {
    const injected = injection('onFireContact', fault), h = makeHarness(51020001, ['foraging'], [injected.override]), g = scene(h);
    const item = addFood(h, 'blast'); g.player.inventory.removeItem(item); item.loc = { x: 13, y: 10 }; g.items.push(item);
    g.grid.setTerrain(item.x, item.y, TerrainType.PLAIN_FIRE); injected.arm(g);
    const tick = g.world5!.simulationTicks, diagnostics = g.extensionRuntime!.readEdibleDiagnostics().length, saved = h.save();
    h.command('wait');
    expect(injected.entries).toHaveLength(1); const entry = injected.entries[0]!;
    expect(g.items).not.toContain(item); expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
    expect(state(h)).toEqual(entry.state); expect(g.extensionRuntime!.snapshot().components).toEqual(entry.components);
    expect(knowledgeState(g, 'foraging.blast')).toBe('unknown');
    expect(g.extensionRuntime!.readEdibleDiagnostics().slice(diagnostics)).toEqual([{ owner: 'foraging', method: 'onFireContact' }]);
    expect(logger.messages.map(m => m.text).join('\n')).toContain('炸开了');
    expect(g.extensionRuntime!.snapshot().foundation.nextFactId).toBe(entry.foundation.nextFactId);
    const mechanicalRandom = rng.getState(), mechanicalWorld = structuredClone(g.world5);
    // Identical public continuation without injection confirms all mechanical RNG/fire work remains.
    h.load(saved); injected.disableFault(); h.command('wait');
    expect(rng.getState()).toEqual(mechanicalRandom); expect(g.world5).toEqual(mechanicalWorld);
  });
  const needs = [
    ['band', ['setOwnComponent', 'message', 'replaceState']],
    ['deadline', ['message', 'depart', 'replaceState']],
    ['feed', ['setOwnComponent', 'message', 'replaceState']],
    ['detached', ['removeOwnComponent', 'replaceState']]
  ] as const;
  for (const [kind, writers] of needs) for (const writer of writers) for (const after of [false, true])
    it(`${kind}: ${writer} ${after ? 'after' : 'before'} preserves the event mechanics and cancels only the participant`, () => {
      const injected = injection('onNeedEvent', { writer, after }, kind === 'feed' ? 'band' : kind);
      const h = makeHarness(51020001, ['foraging'], [injected.override]), g = scene(h);
      let ally = addAlly(h);
      if (kind !== 'detached') ally = nearNeed(g, ally.id, kind);
      const food = kind === 'feed' ? addFood(h, 'mend', 2) : null;
      injected.arm(g); const tick = g.world5!.simulationTicks, diagnostics = g.extensionRuntime!.readEdibleDiagnostics().length, saved = h.save();
      if (kind === 'detached') ally.hp = 0;
      if (kind === 'feed') expect(feed(h, ally, food!).error).toBeNull(); else h.command('wait');
      expect(injected.entries).toHaveLength(1); const entry = injected.entries[0]!;
      const actual = boundary(g);
      // Feed subsequently runs onConsumed, which is a separate successful participant.
      if (kind === 'feed') { expect(state(h).totals.fed).toBe((entry.state as ReturnType<typeof state>).totals.fed + 1); expect(food!.quantity).toBe(1); }
      else expect(actual.state).toEqual(entry.state);
      expect(actual.components).toEqual(entry.components);
      if (kind === 'detached') {
        // Native ally death retains the entity in purgatory; it is not departure retirement.
        // The failed participant's component removal must be rolled back in full.
        expect(g.purgatory).toContain(ally);
        expect(g.monsters).not.toContain(ally);
        expect(actual.components[String(ally.id)]).toEqual(entry.components[String(ally.id)]);
      }
      expect(actual.foundation.nextFactId).toBe(entry.foundation.nextFactId + (kind === 'feed' ? 1 : 0));
      if (kind === 'feed') expect(state(h).history.filter(f => f.kind === 'need')).toEqual(
        (entry.state as ReturnType<typeof state>).history.filter(f => f.kind === 'need'));
      expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
      expect(g.extensionRuntime!.readEdibleDiagnostics().slice(diagnostics)).toEqual([{ owner: 'foraging', method: 'onNeedEvent' }]);
      const row = actual.foundation.actorNeeds?.rows.find(r => r.actorId === ally.id);
      if (kind === 'band') expect(row).toMatchObject({ band: 'hungry', value: 300 });
      if (kind === 'feed') expect(row!.value).toBeGreaterThan(0);
      if (kind === 'detached') expect(row).toBeUndefined();
      if (kind === 'deadline') {
        expect(row!.deadlineFired).toBe(true); expect(actual.foundation.departures?.active ?? []).toEqual([]);
        expect(g.monsters).toContain(ally);
      }
      const participantMessage = kind === 'deadline' ? i18next.t('ext.foraging.message.departing') :
        kind === 'band' || kind === 'feed' ? i18next.t('ext.foraging.message.band.hungry') : null;
      if (participantMessage) expect(logger.messages.filter(m => m.text === participantMessage)).toHaveLength(
        entry.messages.filter(m => m.text === participantMessage).length);
      if (kind === 'feed') expect(logger.messages.length).toBeGreaterThan(entry.messages.length);
      expect(injected.calls[injected.calls.length - 1]).toBe(writer);
      const mechanicalRandom = rng.getState(), mechanicalWorld = structuredClone(g.world5);
      h.load(saved); injected.disableFault();
      const restoredAlly = g.monsters.find(m => m.id === ally.id)!;
      if (kind === 'detached') restoredAlly.hp = 0;
      if (kind === 'feed') expect(feed(h, restoredAlly, g.player.inventory.items.find(i => i.id === food!.id)!).error).toBeNull();
      else h.command('wait');
      expect(rng.getState()).toEqual(mechanicalRandom); expect(g.world5).toEqual(mechanicalWorld);
      const referenceNeeds = g.extensionRuntime!.snapshot().foundation.actorNeeds;
      // Successful beginDeparture legitimately advances the target CAS revision once more.
      if (kind === 'deadline') expect(referenceNeeds).toEqual({ ...actual.foundation.actorNeeds,
        rows: actual.foundation.actorNeeds!.rows.map(r => ({ ...r, revision: r.revision + 1 })) });
      else expect(referenceNeeds).toEqual(actual.foundation.actorNeeds);
    });
});


describe('foraging degraded-path controls without writer faults', () => {
  it('environment fire commits knowledge and accounting when the same participant succeeds', () => {
    const injected = injection('onFireContact', null), h = makeHarness(51020001, ['foraging'], [injected.override]), g = scene(h);
    const item = addFood(h, 'blast'); g.player.inventory.removeItem(item); item.loc = { x: 13, y: 10 }; g.items.push(item);
    g.grid.setTerrain(item.x, item.y, TerrainType.PLAIN_FIRE); injected.arm(g); h.command('wait');
    expect(g.items).not.toContain(item); expect(knowledgeState(g, 'foraging.blast')).toBe('known');
    expect(state(h).totals.exploded).toBe(1); expect(g.extensionRuntime!.readEdibleDiagnostics()).toEqual([]);
  });
  it.each(['band', 'deadline', 'feed', 'detached'] as const)('%s commits the same original need participant without a fault', kind => {
    const injected = injection('onNeedEvent', null, kind === 'feed' ? 'band' : kind);
    const h = makeHarness(51020001, ['foraging'], [injected.override]), g = scene(h);
    let ally = addAlly(h); if (kind !== 'detached') ally = nearNeed(g, ally.id, kind);
    const food = kind === 'feed' ? addFood(h, 'mend', 2) : null;
    if (kind === 'detached') ally.hp = 0;
    injected.arm(g);
    if (kind === 'feed') expect(feed(h, ally, food!).error).toBeNull(); else h.command('wait');
    expect(injected.entries).toHaveLength(1); expect(injected.calls).toContain('replaceState');
    expect(g.extensionRuntime!.readEdibleDiagnostics()).toEqual([]);
    expect(state(h).history).toContainEqual(expect.objectContaining({ kind: 'need', result: kind === 'feed' ? 'band' : kind }));
    const snapshot = g.extensionRuntime!.snapshot();
    if (kind === 'band') expect(snapshot.components[String(ally.id)]!['foraging:hunger']).toEqual({ band: 'hungry' });
    if (kind === 'deadline') expect(snapshot.foundation.departures!.active).toContainEqual(expect.objectContaining({ actorId: ally.id }));
    if (kind === 'feed') { expect(food!.quantity).toBe(1); expect(snapshot.components[String(ally.id)]!['foraging:hunger']).toEqual({ band: 'hungry' }); }
    if (kind === 'detached') expect(snapshot.components[String(ally.id)]?.['foraging:hunger']).toBeUndefined();
  });
});

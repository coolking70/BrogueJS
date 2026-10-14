import { reactive } from 'vue';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { describe, it, expect } from 'vitest';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Inventory } from '../engine/Items/Inventory';
import { assertItemDataShape, validateItemData, itemFacts } from '../engine/Items/ItemData';
import { serializeItem, deserializeItem } from '../engine/Core/EntitySnapshot';
import { createItemHarness } from '../ext/testing/itemHarness';
import { descriptor } from '../ext/testing/fixtures/itemFixture';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { checkpointGenerationWorld } from '../engine/Core/WorldCheckpoint';
const valid = () => { const i = new Item('dagger', ')', 1, ItemCategory.WEAPON); i.identityId = 'dagger'; i.identified = false; i.moduleData = { c6fixture: { v: 1, known: false, power: 3 } }; return i; };
describe('C6 raw instance data', () => {
  it('absence stays absent; populated codecs and frozen facts detach all nested values', () => {
    const plain = new Item('x', ')', 1, ItemCategory.WEAPON);
    expect(deserializeItem(serializeItem(plain))).not.toHaveProperty('moduleData');
    const i = valid(), saved = serializeItem(i), copy = deserializeItem(saved);
    expect(copy.moduleData).toEqual(i.moduleData);
    (copy.moduleData!.c6fixture as any).power = 9;
    expect((i.moduleData!.c6fixture as any).power).toBe(3);
    expect((saved.moduleData!.c6fixture as any).power).toBe(3);
    const facts = itemFacts(reactive(i));
    expect(Object.isFrozen(facts.moduleData!.c6fixture)).toBe(true);
    expect(facts.moduleData).not.toBe(i.moduleData);
  });
  it.each([undefined, null, {}, [], { c6fixture: null }, { c6fixture: { n: Infinity } }, { c6fixture: { n: undefined } }, { c6fixture: new Date() }])('rejects nonfinite/absent data %j before codec sanitization', data => {
    const i = valid(); (i as any).moduleData = data;
    expect(() => serializeItem(i)).toThrow(); expect(() => deserializeItem(i)).toThrow();
  });
  it('rejects sparse arrays, symbols, accessors, hidden/dangerous keys and cycles without invoking getters', () => {
    let reads = 0;
    const bad: object[] = [Array(1), Object.assign({}, { [Symbol('bad')]: 1 }), Object.defineProperty({}, 'x', { get: () => { reads++; return 1; }, enumerable: true }), Object.defineProperty({}, 'hidden', { value: 1 }), JSON.parse('{"__proto__":1}')];
    const cycle: any = {}; cycle.self = cycle; bad.push(cycle);
    for (const value of bad) { const i = valid(); (i.moduleData!.c6fixture as any).nested = value; expect(() => serializeItem(i)).toThrow(); }
    const i = valid(); Object.defineProperty(i, 'moduleData', { get: () => { reads++; return {}; } });
    expect(() => serializeItem(i)).toThrow(); expect(reads).toBe(0);
  });
  it('enforces owner, total UTF8, depth and quantity boundaries exactly', () => {
    const i = valid(), value = { x: '界'.repeat(1362) + 'ab' }; // 8 + 4088 = 4096 bytes
    i.moduleData = { a: value }; expect(new TextEncoder().encode(JSON.stringify(value)).length).toBe(4096);
    expect(() => assertItemDataShape(i)).not.toThrow(); value.x += 'a'; expect(() => assertItemDataShape(i)).toThrow();
    i.moduleData = { a: { x: 'a'.repeat(4080) }, b: { x: 'a'.repeat(4085) } };
    expect(new TextEncoder().encode(JSON.stringify(i.moduleData)).length).toBe(8192);
    expect(() => assertItemDataShape(i)).not.toThrow(); (i.moduleData.b as any).x += 'a'; expect(() => assertItemDataShape(i)).toThrow();
    i.moduleData = { a: {}, b: {}, c: {}, d: {} }; expect(() => assertItemDataShape(i)).not.toThrow(); i.moduleData.e = {}; expect(() => assertItemDataShape(i)).toThrow();
    let nested: any = 1; for (let n = 0; n < 15; n++) nested = { x: nested }; i.moduleData = { a: nested };
    expect(() => assertItemDataShape(i)).not.toThrow(); i.moduleData = { a: { x: nested } }; expect(() => assertItemDataShape(i)).toThrow();
    i.moduleData = { a: {} }; i.quantity = 2; expect(() => assertItemDataShape(i)).toThrow();
  });
  it('rejects missing owners and nonboolean/throwing/asynchronous validators; arguments are frozen', () => {
    const i = valid();
    expect(() => validateItemData(i, [], new Map(), 'load')).toThrow();
    for (const validator of [() => false, () => undefined, () => Promise.resolve(true), () => { throw Error(); }, (_: any, ctx: any) => { ctx.item.quantity = 2; return true; }])
      expect(() => validateItemData(i, ['c6fixture'], new Map([['c6fixture', validator as any]]), 'load')).toThrow();
    expect(() => validateItemData(i, ['c6fixture'], new Map([['c6fixture', () => true]]), 'load')).not.toThrow();
  });
  it('never merges or splits data, including material/gem/quiver fast paths and previews', () => {
    for (const category of [ItemCategory.WEAPON, ItemCategory.GEM, ItemCategory.MATERIAL, ItemCategory.FOOD]) {
      const a = valid(), b = valid(); a.category = b.category = category; a.quiverNumber = b.quiverNumber = 5;
      const inv = new Inventory(); inv.capacity = 1; inv.items = [a];
      expect(inv.stacksWith(a,b)).toBe(false); expect(inv.hasSpace(b)).toBe(false); expect(inv.addItem(b)).toBe(false);
      a.quantity = 2; expect(inv.consumeOne(a)).toBe(false); expect(a.quantity).toBe(2);
    }
  });
  it('in-place checkpoint restores data and original nested identity', () => {
    const i = valid(), data = i.moduleData!, own = data.c6fixture;
    const rollback = checkpointGenerationWorld(() => ({ shallow: [], deep: [i] }));
    (own as any).power = 8; i.moduleData = { other: {} }; rollback();
    expect(i.moduleData).toBe(data); expect(i.moduleData!.c6fixture).toBe(own); expect((own as any).power).toBe(3);
  });
});
describe('C6 real Game persistence', () => {
  it('saves data, validates historical rows, retains equipment references and rejects bad owner/version atomically', () => {
    const h = createItemHarness(), g = h.game(), i = valid();
    g.player.inventory.items.push(i); g.player.equippedWeapon = i;
    const saved = g.toSnapshot(); expect(g.loadSnapshot(saved)).toBe(true);
    const held = g.player.inventory.items.find(x => x.id === i.id)!;
    expect(g.player.equippedWeapon).toBe(held); expect(held.moduleData).toEqual(i.moduleData);
    for (const data of [{ unknown: {} }, { c6fixture: { v: 2, known: false, power: 3 } }, { c6fixture: { v: 1, known: true, power: 3 } }]) {
      const broken = structuredClone(saved); broken.player.inventory.find(x => x.id === i.id)!.moduleData = data as unknown as Record<string, import('../ext/types').Json>;
      const player = g.player, inventory = g.player.inventory.items, random = rng.getState(), next = getNextEntityId(), events = g.recordedInputEvents;
      expect(g.loadSnapshot(broken)).toBe(false);
      expect(g.player).toBe(player); expect(g.player.inventory.items).toBe(inventory); expect(g.player.equippedWeapon).toBe(held);
      expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(next); expect(g.recordedInputEvents).toBe(events);
    }
    const historical = valid(); g.everSeenItems.add(historical);
    const history = g.toSnapshot(); history.entityGraph.items.find(x => x.id === historical.id)!.moduleData = { absent: {} };
    expect(g.loadSnapshot(history)).toBe(false);
    const duplicate = structuredClone(saved); duplicate.items.push(duplicate.player.inventory.find(x => x.id === i.id)!);
    expect(g.loadSnapshot(duplicate)).toBe(false);
    h.dispose();
  });
  it('rejects wrong-owner validator declarations during construction', () => {
    expect(() => createItemHarness({}, [{ ...descriptor, create: () => ({ ...descriptor.create(), itemDataValidators: { other: () => true } }) }])).toThrow();
  });
});

it('raw poison at every encoded root is refused before world retirement', () => {
  const h = createItemHarness(), g = h.game();
  const i = valid(); g.player.inventory.items.push(i);
  const base = g.toSnapshot();
  const routes = ['active','cached','pack','carrier','passenger','fallen-item','fallen-actor','purgatory','history','container','escrow'];
  for (const route of routes) {
    const s = structuredClone(base), poison = serializeItem(valid());
    poison.id = s.run.nextEntityId++; poison.moduleData = { c6fixture: { v: 99, known: false, power: 0 } };
    // Holder references are deliberately independent of the row validation:
    // malformed history/escrow is rejected even before owner graph decoding.
    if (route === 'active') s.items.push(poison);
    else if (route === 'pack') s.player.inventory.push(poison);
    else if (route === 'cached') s.levels.push({ ...structuredClone(s), depth: 2, items: [poison] });
    else if (route === 'fallen-item') s.pendingFallenItemsByDepth.push({ depth: 2, items: [poison] });
    else s.entityGraph.items.push(poison);
    const audit = auditFullObjectGraph([g, rng]);
    expect(g.loadSnapshot(s), route).toBe(false);
    expect(audit.differences(), route).toEqual([]);
  }
  h.dispose();
});

it('rejects mixed data/native duplicate IDs in either ownership enumeration order on save',()=>{
 for(const dataFirst of [false,true]){const h=createItemHarness(),g=h.game(),data=valid(),plain=new Item('native',')',1,ItemCategory.WEAPON);plain.id=data.id;
 const [first,second]=dataFirst?[data,plain]:[plain,data];g.player.inventory.items.push(first!);g.items.push(second!);expect(()=>g.toSnapshot()).toThrow();h.dispose();}
});
it('preserves legal post-birth native enchantment and curse removal rather than enforcing birth equality on load',()=>{
 const h=createItemHarness(),g=h.game(),i=valid();i.enchantment=3;i.isCursed=false;g.player.inventory.addItem(i);
 const saved=g.toSnapshot();expect(g.loadSnapshot(saved)).toBe(true);const restored=g.player.inventory.items.find(v=>v.id===i.id)!;
 expect(restored.enchantment).toBe(3);expect(restored.isCursed).toBe(false);expect(restored.moduleData).toEqual(i.moduleData);h.dispose();
});

it('review: array index accessors are rejected without executing them',()=>{
 let reads=0;const nested=[1];Object.defineProperty(nested,'0',{get(){reads++;return 1;},enumerable:true});
 const i=valid();(i.moduleData!.c6fixture as any).nested=nested;
 expect(()=>assertItemDataShape(i)).toThrow();expect(reads).toBe(0);
});

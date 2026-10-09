/** Pure bounded loss plan. No Game, Item, writer, native RNG, hidden combat or clock. */
import { sha256 } from '../../ext/fingerprint';
export interface RaidLossInput {
  eventId: string;
  seedKey: string;
  attack: number;
  defense: number;
  stocks: { key: string; boxId: number; boxRevision: number; itemId: number; quantity: number }[];
  components: { id: number; revision: number; hp: number; maxHp: number; resistance: number }[];
}
export function planRaidLoss(input: Readonly<RaidLossInput>) {
  const q = Math.max(0, input.attack - input.defense) / Math.max(1, input.attack);
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const rank = (kind: string, id: number) => sha256(input.seedKey + input.eventId + kind + id);
  const debits: {
    boxId: number;
    boxRevision: number;
    itemId: number;
    quantity: number;
    expectedQuantity: number;
  }[] = [];
  const damage: { id: number; revision: number; hp: number; amount: number; actual: number }[] = [];
  const groups = new Map<string, RaidLossInput['stocks']>();
  for (const row of input.stocks) {
    const list = groups.get(row.key) ?? [];
    list.push({ ...row });
    groups.set(row.key, list);
  }
  for (const [key, rows] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let left = Math.floor((rows.reduce((n, row) => n + row.quantity, 0) * q) / 4);
    rows.sort((a, b) => compare(rank(key, a.itemId), rank(key, b.itemId)) || a.itemId - b.itemId);
    for (const row of rows) {
      const quantity = Math.min(left, row.quantity);
      left -= quantity;
      if (quantity)
        debits.push({
          boxId: row.boxId,
          boxRevision: row.boxRevision,
          itemId: row.itemId,
          quantity,
          expectedQuantity: row.quantity
        });
    }
  }
  let left = Math.floor((input.components.reduce((n, c) => n + c.maxHp, 0) * q) / 4);
  for (const c of [...input.components].sort(
    (a, b) => compare(rank('component', a.id), rank('component', b.id)) || a.id - b.id
  )) {
    const amount = Math.min(left, Math.max(0, c.hp - Math.ceil(c.maxHp / 4))),
      actual = Math.floor((amount * (100 - c.resistance)) / 100);
    if (actual) {
      damage.push({ id: c.id, revision: c.revision, hp: c.hp, amount, actual });
      left -= actual;
    }
  }
  return {
    eventId: input.eventId,
    debits,
    damage,
    lostUnits: debits.reduce((n, d) => n + d.quantity, 0),
    damagedHp: damage.reduce((n, d) => n + d.actual, 0)
  };
}

/** Native Brogue world-effects adapter over the shared complete creature model. */
import { CreatureBase } from './CreatureBase';
import { physicalContactOf } from '../engine/Combat/BodyCombat';
import { spawnCreatureBlood } from '../engine/Combat/CreatureFeatures';
import type { Grid } from '../engine/Map/Grid';
export * from './CreatureBase';
export class Creature extends CreatureBase {
    constructor(x: number, y: number, name: string, char: string, color: number) {
        super(x, y, name, char, color);
    }
    // Prototype dispatch also works for snapshot allocation and cloning, both
    // of which deliberately bypass constructors and do not consume global IDs.
    public override emitBlood(grid: Grid, damage: number): void {
        const contact = physicalContactOf(this);
        if (contact === this.loc) spawnCreatureBlood(grid, this.loc, this.bloodType, damage, this.hp, this.bloodInvulnerable());
        else spawnCreatureBlood(grid, contact, this.bloodType, damage, this.hp, this.bloodInvulnerable());
    }
}

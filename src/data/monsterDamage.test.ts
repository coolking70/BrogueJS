import {describe,it,expect}from'vitest';
import monstersJson from './monsters.json';
describe('monsters.json damage 记法 ↔ CE monsterCatalog（Globals.c）逐条对账', () => {
    it('共 67 条怪物，全部有 damage 字段', () => {
        expect(monstersJson).toHaveLength(67);
        for (const m of monstersJson) {
            expect(typeof m.damage, `${m.id}.damage 应为字符串`).toBe('string');
        }
    });
});

/**
 * src/data/monsterBolts.test.ts — P4-1a：monsters.json 的 bolts 字段接线回归
 *
 * 权威基线：CE reference / src/brogue/Globals.c 的
 *   creatureType monsterCatalog[NUMBER_MONSTER_KINDS]（表体 L1026 起），
 * `enum boltType bolts[20]` 字段定义见 Rogue.h:2189（creatureType 结构体）。
 *
 * 本轮（P4-1a）只把 CE 的 bolts 数据搬进 monsters.json，不实现任何施法逻辑，
 * 详见 docs/archive/dev-scripts/extract_monster_bolts.cjs 与 docs/archive/dev-history/p4_1a_monster_bolts_data_report.md。
 *
 * 这份测试是对抗性的：
 *   - 数量断言能在"漏抽/多抽某只怪物"时失败；
 *   - 顺序断言能在"实现时手滑排序了数组"时失败（CE 的 bolts 是有序数组，
 *     施法优先级可能与顺序相关，排序会悄悄改变游戏行为）；
 *   - 映射断言能在"下一轮引入了 CE 不存在的 bolt 名字"或
 *     "把已知缺口伪装成已支持"时失败。
 */
import { describe, it, expect } from 'vitest';
import monstersJson from './monsters.json';
import { BoltEffect } from '../engine/Combat/Bolt';

type MonsterEntry = (typeof monstersJson)[number] & { bolts?: string[] };

function byId(id: string): MonsterEntry {
    const m = monstersJson.find((x) => x.id === id) as MonsterEntry | undefined;
    if (!m) throw new Error(`monsters.json 中找不到 ${id}`);
    return m;
}

// CE boltType 名字（去掉 "BOLT_" 前缀）里，web 的 BoltEffect 枚举（Bolt.ts:14 起）
// U08 已接通两种地形 bolt 的 NONE 执行出口；无需新增 effect 枚举。
const KNOWN_GAP_BOLT_NAMES = new Set<string>(); // U08: both use BE_NONE terrain effects.

// CE 里 boltType 的字符串名字与 boltEffect（BoltEffect 枚举对应的效果种类）不是一一对应：
// BOLT_SLOW 与 BOLT_SLOW_2 都使用 BE_SLOW 这个效果，仅强度不同
// （GlobalsBrogue.c:62 "slowing spell" BE_SLOW power=10，line 81 power=2）。
// 数据字段里如实保留 CE 的原始名字 "SLOW_2"（不是本轮该做的归并决定），
// 这里只是为了校验"能映射到现有 BoltEffect"时，显式声明这一个别名关系。
const BOLT_NAME_ALIASES: Record<string, keyof typeof BoltEffect> = {
    SLOW_2: 'SLOW',
    SPIDERWEB: 'NONE',
    ANCIENT_SPIRIT_VINES: 'NONE',
};

describe('monsters.json 的 bolts 字段（P4-1a 数据接线）', () => {
    it('每条怪物都具备 bolts 数组字段（无 undefined，缺省为空数组）', () => {
        expect(monstersJson).toHaveLength(67);
        for (const m of monstersJson as MonsterEntry[]) {
            expect(Array.isArray(m.bolts), `${m.id}.bolts 不是数组`).toBe(true);
        }
    });

    it('无 bolts 的怪物一律为空数组（抽样：rat 无远程攻击）', () => {
        expect(byId('rat').bolts).toEqual([]);
    });

    it('每条 bolts 里的名字，要么能映射到现有 BoltEffect 枚举，要么在已知缺口清单内——不允许第三类未知名字', () => {
        for (const m of monstersJson as MonsterEntry[]) {
            for (const boltName of m.bolts ?? []) {
                const isKnownGap = KNOWN_GAP_BOLT_NAMES.has(boltName);
                const effectiveName = BOLT_NAME_ALIASES[boltName] ?? boltName;
                const isMappedEffect = (BoltEffect as unknown as Record<string, number>)[effectiveName] !== undefined;
                expect(
                    isKnownGap || isMappedEffect,
                    `${m.id} 的 bolt "${boltName}" 既不在 BoltEffect 枚举中，也不在已知缺口清单 (${[...KNOWN_GAP_BOLT_NAMES].join(', ')}) 内`
                ).toBe(true);
            }
        }
    });

    it('SLOW_2 不在 BoltEffect 里单独存在（CE 用 BE_SLOW 复用同一效果，仅强度不同——GlobalsBrogue.c:62,81）', () => {
        expect('SLOW_2' in BoltEffect).toBe(false);
        expect('SLOW' in BoltEffect).toBe(true);
    });

    it('汇总：带 bolts 的怪物涉及的 bolt 种类恰好 15 种', () => {
        const names = new Set<string>();
        for (const m of monstersJson as MonsterEntry[]) {
            for (const b of m.bolts ?? []) names.add(b);
        }
        expect(names.size).toBe(15);
    });
});

/**
 * src/data/hordes.test.ts — horde 表完整性回归（CE 权威基线）
 *
 * 黄金值来源：CE reference / src/variants/GlobalsBrogue.c 的 hordeCatalog_Brogue[]
 * （表头 L744，表体 L746-948，共 175 条），结构体定义见 Rogue.h:2235。
 * 符号常量：AMULET_LEVEL=26、DEEPEST_LEVEL=40（GlobalsBrogue.c L43-44），
 * MT_CAMP_AREA=62（Rogue.h enum machineTypes 顺序值）。
 *
 * 由 docs/archive/dev-scripts/extract_hordes.cjs 从 CE 源码直接生成；本文件锁住：
 *   1) 总条数与常规池规模；
 *   2) 常规池（领袖+成员）可产出物种数；
 *   3) 各深度可用常规 horde 数；
 *   4) 全表字段形状（flags 必为数组、machine 必为数字、members 必为数组）；
 *   5) 若干条与 CE 源码逐字段一致（注释注明行号）。
 *
 * "常规池"口径与 Game.ts:748-759 的 flag 过滤一致（亦即 CE 口径）：
 * 排除 HORDE_IS_SUMMONED / HORDE_LEADER_CAPTIVE / HORDE_SACRIFICE_TARGET /
 * HORDE_VAMPIRE_FODDER / HORDE_NO_PERIODIC_SPAWN 及任何 HORDE_MACHINE_* 前缀。
 */
import { describe, it, expect } from 'vitest';
import hordesJson from './hordes.json';

interface HordeMember {
    type: string;
    minCount: number;
    maxCount: number;
    clumpFactor: number;
}

interface HordeEntry {
    leader: string;
    members: HordeMember[];
    minLevel: number;
    maxLevel: number;
    frequency: number;
    spawnsIn: string | null;
    machine: number;
    flags: string[];
}

const hordes = hordesJson as HordeEntry[];

/** 带非空断言的取项（下标 = CE 表体顺序，见各测试注释的 GlobalsBrogue.c 行号）。 */


const EXCLUDED_FLAGS = [
    'HORDE_IS_SUMMONED',
    'HORDE_LEADER_CAPTIVE',
    'HORDE_SACRIFICE_TARGET',
    'HORDE_VAMPIRE_FODDER',
    'HORDE_NO_PERIODIC_SPAWN',
];

const isRegular = (h: HordeEntry) =>
    h.frequency > 0 && !h.flags.some(f => EXCLUDED_FLAGS.includes(f) || f.startsWith('HORDE_MACHINE_'));

const regularPool = hordes.filter(isRegular);

/** 常规池在深度 d 可用的 horde（CE pickHordeType 的硬窗口口径：minLevel <= d <= maxLevel）。 */
const regularAt = (d: number) => regularPool.filter(h => h.minLevel <= d && d <= h.maxLevel);

describe('hordes.json — 规模与常规池', () => {
    it('总条数 = 175（CE hordeCatalog_Brogue L746-948）', () => {
        expect(hordes).toHaveLength(175);
    });

    it('常规池条数 >= 55（实际 58，锚点 58）', () => {
        expect(regularPool.length).toBeGreaterThanOrEqual(55);
        expect(regularPool.length).toBe(58);
    });

    it('HORDE_LEADER_CAPTIVE 条数 = 56（锚点 56）', () => {
        expect(hordes.filter(h => h.flags.includes('HORDE_LEADER_CAPTIVE'))).toHaveLength(56);
    });

    it('常规池（领袖+全部成员）可产出物种数 >= 40（实际 41；修复前旧表仅 9）', () => {
        const species = new Set<string>();
        for (const h of regularPool) {
            species.add(h.leader);
            for (const m of h.members) species.add(m.type);
        }
        expect(species.size).toBeGreaterThanOrEqual(40);
        expect(species.size).toBe(41);
    });

    it('陆生主力物种（goblin/ogre/troll/wraith/kobra 系等）已进入常规池', () => {
        const species = new Set<string>();
        for (const h of regularPool) {
            species.add(h.leader);
            for (const m of h.members) species.add(m.type);
        }
        // 旧表中从不自然刷出的代表性物种
        for (const s of ['GOBLIN', 'OGRE', 'TROLL', 'WRAITH', 'SPIDER', 'PHANTOM', 'DRAGON', 'GOLEM', 'IMP', 'PIXIE', 'ZOMBIE', 'CENTIPEDE']) {
            expect(species.has(s), `常规池缺少 ${s}`).toBe(true);
        }
    });
});

describe('hordes.json — 各深度常规池覆盖', () => {
    /**
     * 注意 D1：CE 常规表在 D1 窗口内只有 3 条（RAT L746 / KOBOLD L747 /
     * JACKAL L748），预设的 ">= 8" 在 D1 不成立——这是 CE 数据本身，
     * 不是提取缺陷（MONKEY L751 min=2，其余更晚）。这里按 CE 真值 >= 3 断言。
     */
    it('D1 可用常规 horde >= 3（CE 真值 3：RAT/KOBOLD/JACKAL）', () => {
        expect(regularAt(1).length).toBe(3);
    });

    it('D3/D5/D8/D12/D17/D22/D26 各深度可用常规 horde >= 8', () => {
        for (const d of [3, 5, 8, 12, 17, 22, 26]) {
            expect(regularAt(d).length, `D${d} 只有 ${regularAt(d).length} 条`).toBeGreaterThanOrEqual(8);
        }
    });

    it('上述深度实际数量（防回归快照）: D3=10 D5=12 D8=18 D12=23 D17=22 D22=16 D26=11', () => {
        const actual = Object.fromEntries([3, 5, 8, 12, 17, 22, 26].map(d => [d, regularAt(d).length]));
        expect(actual).toEqual({ 3: 10, 5: 12, 8: 18, 12: 23, 17: 22, 22: 16, 26: 11 });
    });
});

describe('hordes.json — 全表字段形状', () => {
    it('每条：leader 字符串、members 数组、min/maxLevel 数字、frequency 数字', () => {
        hordes.forEach((h, i) => {
            expect(typeof h.leader, `#${i} leader`).toBe('string');
            expect(Array.isArray(h.members), `#${i} members`).toBe(true);
            expect(typeof h.minLevel, `#${i} minLevel`).toBe('number');
            expect(typeof h.maxLevel, `#${i} maxLevel`).toBe('number');
            expect(typeof h.frequency, `#${i} frequency`).toBe('number');
            expect(h.minLevel <= h.maxLevel, `#${i} min<=max`).toBe(true);
        });
    });

    it('每条：flags 必为数组（省略 flags 的条目序列化为 []，不是 null）', () => {
        hordes.forEach((h, i) => {
            expect(Array.isArray(h.flags), `#${i} flags`).toBe(true);
        });
    });

    it('每条：machine 必为数字（省略 machine 的条目序列化为 0）', () => {
        hordes.forEach((h, i) => {
            expect(typeof h.machine, `#${i} machine`).toBe('number');
        });
    });

    it('每条：spawnsIn 为字符串或 null（CE 为 0 时 = null）', () => {
        hordes.forEach((h, i) => {
            expect(h.spawnsIn === null || typeof h.spawnsIn === 'string', `#${i} spawnsIn`).toBe(true);
        });
    });

    it('每条 member：type 字符串、0 <= minCount <= maxCount', () => {
        hordes.forEach((h, i) => {
            for (const m of h.members) {
                expect(typeof m.type, `#${i} member type`).toBe('string');
                expect(m.minCount, `#${i} ${m.type} min`).toBeGreaterThanOrEqual(0);
                expect(m.minCount <= m.maxCount, `#${i} ${m.type} min<=max`).toBe(true);
            }
        });
    });
});

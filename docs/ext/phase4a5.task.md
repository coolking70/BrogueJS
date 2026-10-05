# 4a-5 任务书：3×3 正式内容（第二个原创大型敌人与场地）

> 分支 `ext/phase4`（= ext/foundation `ef2a0f2`，4a-4 已验收：giants 模块、2×2 岩脊兽、侧室、Boss 血条）。设计：`docs/ext/phase4-giants.md` r3 §10.1（3×3 净空 16×12、通道/门洞 ≥4）、§12 D06=A（先 2×2，再独立 3×3）。前序报告 `phase4a4.report.md`。

## 内容（临时值，数据驱动，维护者之后会改）

- 第二个原创敌人，3×3，暂定名“**沉渊巨像**”（`giants.abyssal-colossus`）：原创描述（远古遗迹中苏醒的石质守卫，体躯如崩塌的殿柱），字形/配色自拟，不复用现有名称、不模仿商业作品。临时数值：HP 260、防御 60、命中 95%、伤害 8–16、移动速度较慢（200）、攻击速度普通。无特殊能力。
- 场地模板：16×12 净空、入口宽度 4、出生离边 ≥2、深度 7–14、尝试率 40%、每层所有贡献合计仍 ≤1 个场地（与岩脊兽模板按既有稳定排序/预算规则竞争，不得同层两个）。
- 只改 giants 模块数据/locale/测试；底座若需为 3×3 补齐（如场地尺寸/入口宽度预算、3×3 锚点图验算），保持通用、不写死怪物 ID。

## 测试与门禁（开发期功能测试政策）

- boundary、`npx vue-tsc -b`、`npm run build`。
- giants 专项扩展到 3×3：自然新局固定种子生成 3×3 场地与巨像、净空/入口/锚点可达/玩家绕行验算、同层不会出现两个场地、守场/边界/击败重访不复生/Boss 血条、真实 save/load/replay/seek/续录；4a-1/4a-2 已有的 3×3 fixture 行为继续通过。
- `npm run test:drift`：未启用组合零漂移；giants 自然 trace 若因模板变化而变化，按原捕获入口重录并在报告说明原因与差异（不得改动未启用组合基线）。
- `check-module-composition-smoke.mjs --engine-only` 全部子集通过。
- 不跑完整 npm test / 全部 test:ext / removal。Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。

## 交付

- 代码、测试、`docs/ext/phase4a5.report.md`（内容数据位置、实际测试与结果、能自然遇到巨像的验收种子与深度（尽量浅）、已知限制）。**不要 commit**。

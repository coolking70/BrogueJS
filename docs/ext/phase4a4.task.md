# 4a-4 任务书：giants 模块、原创 2×2 敌人与侧室场地（首个可玩闭环）

> 分支 `ext/phase4`（= ext/foundation `c3bfc97`，含 4a0–4a-3、combat 3a1、3a0）。设计：`docs/ext/phase4-giants.md` r3 §3.4（模块内容）、§10（场地生成：D02=A 可绕开侧室、硬守场）、§11.1（模块 state/版本）、§9 Boss 血条、§12（D03=A 只自然敌对、D06=A 先一个 2×2）。前序报告 `phase4a0–4a3.report.md`；4a-3 已提供 `ModuleUiHost.readDisplayFrame()` 与 HUD 插槽。
> 本步完成后 2×2 正式内容可玩；3×3 正式内容另作后续小步（不在本步）。

## 内容（临时值，全部数据驱动、可配置；维护者之后会改名改数值）

- 模块 ID `giants`，目录 `src/ext/modules/giants/`，默认**不勾选**，只硬依赖底座。
- 一个原创 2×2 敌人，暂定名“**岩脊兽**”（`giants.ridgeback`）：原创描述（地下的厚甲兽，背脊如岩），字形与配色自拟（不得复用现有怪物名称/描述，不模仿任何商业作品）。数值临时：HP 120、防御 40、命中 90%、伤害 4–9、移动/攻击速度普通、守场 AI（守场/追击/回归）。不带特殊能力。
- 出现：深度 3–8 每层最多 1 个侧室场地，出现率临时 50%（数据可调）；击败后重访不复生。
- 奖励：不硬编码 growth XP；若 growth 已启用，通过现有可选软协议（如有合适入口）或暂不发额外奖励，报告说明。

## 范围

1. 模块骨架：descriptor/module/schema/types/definitions（敌人与场地模板 JSON）/state（GiantsState：placements 与 bosses 收据，§11.1 草图）/validation/locales/ui/tests/test-suites；规则指纹；物理删除后底座 fixture 仍通过。
2. **底座通用能力**（不放进模块）：`GenerationContribution` 声明与受控生成接入（§10.2：基础地形后、陷阱/机器前选可附接侧室并预留；楼梯/机器/autogen/populate 尊重预留；生成事务写集与回滚）；owned region（`foundation.world.regions`）与 movementBounds 守场边界（行走/闪现/传送/击退/拉拽均受限，§10.1）；原生形态目录贡献（让模块形态可被 polymorph 等通用路径识别，未启用时不追加候选、不取骰，§3.4）；模块敌人创建适配器（经过 4a-1 的 `createSquareMonster` 路径）。
3. 场地合同（§10.1）：2×2 最小净空 12×10、通道/门洞 ≥3、Boss 出生离边 ≥2、玩家可绕行、用 2×2 锚点图实际验算可达；失败在有界候选内换下一候选，耗尽则 skip 并写收据；不无限重生成楼层。
4. 守场 AI：守场/追击/回归的有限声明，场外玩家不会把 Boss 卡在窄道；坠落离开时清边界并记 escaped/lost。
5. **Boss 血条**：模块 HUD 贡献，名称 + 当前/最大 HP 条，只读公开帧 DTO（`readDisplayFrame`），当前目标优先、其次最近可见 Boss，最多一条；未见/失去知识隐藏；320/390 宽可读；文字走模块 locale。
6. 关系与转换：D03=A 不自然生成盟友，但支配/复制/变形等通用路径对它可用（D07=A，无额外免疫）。
7. 持久化/录像：giants 状态、region、收据与 Boss 绑定随存档；save/load/replay/seek/续录一致；要求 giants 的存档在模块缺失时拒绝。

## 测试与门禁（开发期功能测试政策）

- boundary、`npx vue-tsc -b`、`npm run build`。
- 专项：模块 schema/坏数据拒绝；固定种子**自然新局**生成侧室与岩脊兽（不是调试注入）、场地净空/入口/可达/绕行验算、候选失败 skip 收据、生成异常回滚；守场边界对各位移生效；击败后重访不复生；Boss 血条显示/隐藏/历史帧；giants-only、giants+growth、giants+narrative、giants+combat(inert) 的真实 Game 新局/游玩/save-load/replay/seek/续录 smoke（`check-module-composition-smoke.mjs --engine-only` 应自动包含含 giants 的子集）；未启用 giants 的子集地图/实体/双 RNG 与改动前一致（零生成影响）。
- 生成有变化：运行 `npm run test:drift`，未启用组合必须零漂移；giants 开启的生成另建固定种子 trace。
- 4a0 零影响差分与 4a-1/4a-2/4a-3 专项保持通过；直接受影响的既有生成/放置/扩展测试按实际改动挑选。
- 不跑完整 npm test / 全部 test:ext / removal（收尾统一）。Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。
- 浏览器验收由维护者执行；请在报告写明一个能在前几层自然遇到岩脊兽场地的种子与深度，方便验收。

## 交付

- 代码、测试、`docs/ext/phase4a4.report.md`（范围、底座/模块切分、共享文件函数级改动、内容数据位置与可调字段、实际测试与结果、验收种子、已知限制）。可在干净子里程碑停下并列剩余项。**不要 commit**。

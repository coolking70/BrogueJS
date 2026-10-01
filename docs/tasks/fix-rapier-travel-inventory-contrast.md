# 修复：装备细剑后自动行进频繁中断 + 物品栏选中项看不清

> 分支：`fix/rapier-travel-inventory-contrast`（工作区 `BrogueJS-newtheme`，基于 main `ad3e902`）。
> 来源：用户试玩反馈，附录像 `.tmp-evidence/brogue-web-replay-1790882731795.json`（种子 438182354，普通模式；该目录不入库）。

## 问题 1：装备细剑（rapier）后，自动旅行/探索走几步就停（规则层，须对齐 CE）

### 现象（用户描述）
装备细剑后，自动寻路无法正常执行：总是走几步就停一下，而且不是每次都因为发现敌人等正常原因停下，也没有任何提示消息。

### 录像证据（Claude 已统计）
录像共 850 条命令。以"一次自动行动命令 + 其后连续 `auto_step` 数"统计：
- 装备细剑**之前**（D1 第 0–484 回合）：`auto_explore` 每次通常连续 3–95 步。
- 第 485 回合 `item:command "equip|f|"`（f 即细剑；第 484 回合先喝了一瓶药 `quaff|e|`）。
- 装备**之后**：
  - `travel_stairs "down"` 两次各只走 1 步；
  - `mouse_travel {x:1,y:8}` / `{x:2,y:7}` / `{x:3,y:7}` 连续约 30 次，每次只走 1–7 步（多数 1–3 步），中间穿插手动 `move`；
  - D2 第 667–671 回合连续 5 次 `auto_explore` 各只走 1 步。
- 之后到 D3 仍有类似现象。

### 要求
1. 用该录像回放（项目已有 `loadReplay` / `replayStep` 等回放 API，以及测试里的录像回放工具），定位每次自动行进被中断的直接原因（哪条代码路径置位了 disturbed / 终止了 auto_step，当时是否有怪物、物品、地形、消息等合法打断原因）。
2. 对照 CE 源码（`.ce-reference/BrogueCE-master/src/brogue/`，重点 `Movement.c` 的 `travel` / `travelRoute` / `travelMap` / `explore` / `nextStep` / `playerMoves`，以及细剑相关的突刺（lunge）逻辑，例如 `Combat.c` / `Items.c` 中处理 rapier、`abortAttack`、`handleSpearAttacks`、`handleWhipAttacks` 等的路径），确认 CE 在同样情形下是否会中断。CE 是规格：
   - 若 CE 不会中断而本项目会 → 修本项目，使行为与 CE 一致；
   - 若 CE 也会中断（合法行为） → 不改规则，但检查是否缺少 CE 会显示的提示消息，缺则补齐；并在报告里写明中断原因，供 Claude 向用户解释。
3. 检查同类问题是否也影响其他特殊武器（长矛 spear、长柄 pike、鞭 whip、连枷 flail、斧 axe 等有特殊攻击形态的武器），一并修复或说明。
4. 回归测试：用最小化的录像片段或构造场景复现"装备细剑后旅行/探索不应无故中断"，以及合法中断仍然中断。若新增录像夹具，放 `src/test/fixtures/`，单个文件 < 1 MB，必要时截取最小片段。

### 门禁（中档：引擎不改规则的部分 / 若改了规则则全量）
- `npx vue-tsc -b`、`npm run build`
- 相关单测 + UR2/UR3/UR4 黄金 trace + 录像测试（u_27、x2a、x3b）+ U03 契约 + `npm run test:drift`
- 如修改了 CE 对齐的规则代码：另跑 `npm run test:full`（CE 参照源码已在 `.ce-reference/`，不需要 ce:fetch）。
- 黄金 trace / 生成基线如有变化，按 `docs/testing.md` §3 单变量归因并逐字段登记；不得为通过而改断言。
- 完整 `npm test` 由 Claude 在合并前跑。

## 问题 2：物品栏中选中道具的反色背景与白色文字太接近，看不清（表现层）

### 现象
当前刻符界面下，物品栏（背包）里被选中的道具行使用反色背景，而文字是白色/接近白色，导致选中行文字几乎看不见。

### 要求
- 找到物品栏选中态样式（`InventoryOverlay.vue` 及刻符主题相关 CSS，可能在 `theme-shells.css` / `main.css` / `gameplay-layout.css`），保证选中行的**所有文字**（物品名、字母键、数量、附加说明、已装备标记、彩色名称等）与选中背景的对比度 ≥ 4.5:1。
- 刻符风格是"反色选中"（浅底深字），保持这个风格：选中时文字改为深色，或者改为不与文字冲突的选中样式——二选一，在报告中说明。物品自身的颜色（如稀有度/类型着色）在选中态下也要可读。
- 一并检查其它使用同类反色选中的地方（主菜单项、设置、更多命令面板、详情、目标选择列表等），有同样问题一并修复。
- 补回归测试（例如 CSS 规则断言或计算对比度的测试）。

## 硬约束
- AGENTS.md 全部规则适用。问题 1 若涉及规则层，CE 是规格；问题 2 只做表现层。
- 所有改状态的输入仍经 `game.executeCommand` / `executeItemCommand`；不得让显示代码消耗实质随机流；给 Game 加字段须登记 u03 契约。
- 所有玩家可见文本走 i18n。
- 撞上已有测试改代码不改测试；确需改测试按 AGENTS.md 逐条登记理由（含单变量反事实）。
- 不产生 CRLF；截图与 `.tmp-evidence/` 不提交；**不要 commit/push**。

## 输出
- 报告 `docs/reports/fix-rapier-travel-inventory-contrast.report.md`：问题 1 的逐次中断原因统计与根因、CE 对照依据（文件:行号）、修改、测试；问题 2 的对比度数值与修改；门禁原文结果。
- 用中文给出简明报告，特别写清"装备细剑后中断的原因是什么、CE 是否也会这样"。

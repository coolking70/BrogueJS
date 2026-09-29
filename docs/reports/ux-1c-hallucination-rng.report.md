# UX-1C 幻觉显示随机流回归

日期：2026-09-29。开发版浏览器：`http://127.0.0.1:5393`，Chromium 1440×900，种子 27027。

## 原因和改前复现

`GameCanvas.vue` 原 `cosmeticPercent` / `cosmeticPick` 每次绘制都切换并推进全局 `rng` 的 COSMETIC 流。它没有推进 SUBSTANTIVE 流，所以旧 `p2_0_seeded_rng` 通过；但 `Game.toSaveSnapshot` 的连续录制守卫逐字段比较**完整** RNG 状态，包括 COSMETIC 流。显示帧数因此影响存档录制来源。

真实浏览器先启动新游戏，确认 `toSaveSnapshot().run.recordingOrigin` 存在；临时把玩家 `hallucinating` 设为 80，只调用一次 `onRenderRequested`，随后恢复原状态，避免任何未录制的玩法变更。改前：SUBSTANTIVE 计数 14589→14589，COSMETIC 计数 161→250；COSMETIC 流状态改变，`recordingOrigin` 从存在变为缺失。这是由实际画布绘制触发的观察，不是直接调用随机辅助函数。临时改状态只用于布景，并非自然获得幻觉状态的长局复现。

## 修复

`GameCanvas.vue` 的幻觉外观仍通过 `Appearance` 的 `CosmeticRng` 上下文决定何时取数，但随机源改为已有 `Lighting/CosmeticLight.displayRandom(game.grid)`。该随机流按地图用 `WeakMap` 持有，首次从全局状态复制，之后显示帧只推进这份独立状态。模块导出的 `cosmeticPercent` / `cosmeticPick` 也复用该入口，保留旧调用形态。游戏规则、全局 RNG、快照连续性守卫及旧测试断言均未修改。

## 验证

- 新增 `ux_1c_hallucination_display_rng.test.ts`，改前 2/2 红：显示取数改变全局完整 RNG；改后验证外观确有变化、双流状态不变且存档 `recordingOrigin` 保留。
- 定向执行新测试、旧 `p2_0_seeded_rng.test.ts` 和 `r_1_appearance.test.ts`：53/53 通过。`vue-tsc -b` 通过。
- 修后同一浏览器布景：SUBSTANTIVE 14589→14589，COSMETIC 161→161，全局 `rng.getState()` 完全相同；独立显示流推进 79 次，`recordingOrigin` 存在→存在。
- 交叉检查发现旧 `r_1_appearance` 的颜色字面量守卫曾被本轮较早的 UX-1C hover 新色触发（44/45 通过）。将纯 UI hover 色常量放入已有 `ui/mapPointer.ts` 后重跑 45/45 通过；未修改旧守卫或其断言。

没有在本单元运行全量、CE 或 drift 门禁；由主线程统一执行。原版 5394 不提供 `toSaveSnapshot` 浏览器接口，所以该问题的浏览器反事实是同一开发版修改前后对照。

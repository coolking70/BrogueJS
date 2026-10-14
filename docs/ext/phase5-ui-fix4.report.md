# P5 UI fix4：浮动战斗文字与 DEV 等待入口

任务书为外部 `p5-ui-fix4.task.md`；开工分支 `ext/phase5`、HEAD `d367f16`，工作区干净。唯一写入者，未 commit/push。

已完成两项实现及限定门禁；最终相关回归、受影响源码守卫、boundary、types、build 均 exit0。真实浏览器因环境限制未验证，完整 npm/test:ext 未运行。

## 原因与修复

1. `GameCanvas` 的旧淡出只对实时 `game.floatingTexts` 每帧调用 `update()`；时间线 `DisplayFrame` 内的浮字是冻结副本，渲染时一直使用捕获的 life/y。ACK、终局等场景下副本不会淡出；旧逻辑还会被面板及背包的提前 return 跳过，并且实际持续时间受帧率影响。
2. 增加 UI 专属 `FloatingTextPresentation`，使用未被 Pixi 动画钳制的毫秒显示时间。原 life 单位保留为 60 Hz 名义帧，默认 30 即 500 ms，支持自定义 life/dy。实时对象与冻结副本共享 WeakMap 分配的只读身份，不使用可能碰撞的随机 id。首次呈现才开始计时；后来相同浮字的快照及切回实时地图不会重启动画。浮层/ACK 期间照常淡出；后台隐藏暂停显示时钟。到期移出实时列表并清空精灵池，旧快照保持不可变。新局/读档/回放/seek 沿用原重置路径；旧身份不保活历史对象。
3. `wait` 是正确命令名。`GameCanvas` 挂载时启用 `animationEnabled`，`executeCommand('wait')` 同步返回前只建立推进迭代器；下一显示帧的 `tickAdvancement` 才执行客观时间块。重复同步调用会被 `isAdvancing`/输入锁拒绝；ACK、确认、回放、录制忙和显示时间线也有独立门控。按钮经过 `inputManager → installCanvasGameInput → handlePlayerAction → executeCommand`，随后浏览器继续出帧，因此点击后观察到正常推进。此处没有发现需要修改公开命令规则的缺陷。
4. 增加仅 DEV 安装的 `window.debug_game`，随画布卸载清理。`wait()` 等待已有推进/显示后缀/录制忙结束，再沿用按钮同一输入入口提交一次 wait，等待动作收尾。不会重试已提交的命令或代答确认；阻塞、超时、推进错误、切局和卸载明确拒绝。成功判断使用 `stats.turns`，因为 `absoluteTurnNumber` 按客观 100 tick 计数，加速动作不保证每次都加一。

只改显示和 DEV 辅助层；无 Game 字段、规则、实质 RNG、存档/录像格式或定义指纹改动，无基线/黄金 trace 重录。旧断言和守卫语义未改；两处旧测试宿主依赖补齐及单变量对照见下文。

## DEV 使用

在开发构建已进入游戏且画布挂载后，浏览器控制台执行：

```js
window.debug_game.status();
const result = await window.debug_game.wait();
console.log(result.before, result.after);
for (let i = 0; i < 5; i++) await window.debug_game.wait({ timeoutMs: 5000 });
```

`status()` 给出玩家动作数、客观回合数、录制输入数、推进/录制/输入锁、时间线、ACK、确认和浮层状态。遇到 `acknowledgment`/`confirmation`/`overlay`/`display modal` 等错误，先通过正常 UI 处理，再调用。若错误发生在命令提交之后，已经完成的动作不会回滚，须先查状态再决定下一步。不要并发调用，也不要把一次 `wait()` 解释为固定增加一个客观时间块。

`executeCommand` 返回 void，`await activeGame.executeCommand('wait')` 本身不会等待显示帧或回合完成。无画布的 headless 测试保持原同步模式；不要为调试关闭输入锁、强改 `absoluteTurnNumber` 或手工制造确认答案。生产构建不安装 `debug_game`。

## 验证与限制

使用 Node 24.19.0（PATH 首项 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`）、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。长命令跟进实际退出码。

- 新增独立显示时钟回归：30/60/144 FPS、500 ms、自定义时长、同随机 id 不合并、排队首次显示、冻结 ACK/后续快照不复活、双 RNG/世界不变，以及新局/读档/回放 step/seek 清理。
- 在原七模块 seed7306 wizard 的真实 GameCanvas SFC 宿主中补充精灵池 alpha/y/visible 检查，覆盖 ACK、背包、营地抽屉暂停、重复快照和新局；DEV 入口验证真实动画异步、连续锁拒绝、每调用恰好一条 wait/一个玩家动作，以及 ACK/浮层/输入锁/并发/卸载拒绝。此为受控场景和 CPU Pixi 宿主，不冒称天然战斗路线或真实浏览器像素验证。
- 首轮 2 文件、24 项：23 通过、1 项新夹具失败（未启用 Logger 的 ACK 呈现开关），exit1；后续结果见门禁记录。
- Vite `127.0.0.1:5199` 监听被环境以 EPERM 拒绝；已实际调用 develop-web-game 标准 Playwright client，Chromium 初始化失败，未进入页面、无截图。真实浏览器七模块相邻怪物/盟友/巨兽战斗以及真机仍待人工。

原始日志位于 `/private/tmp/p5-ui-fix4-*.log`，不提交截图或大体积证据。本轮未跑完整 npm/test:ext、生成/删除组合矩阵，不称全量验收通过。

## 门禁记录

以下批次有重叠，不累计测试总数。

| 批次 | 实际结果 |
|---|---|
| 首轮新回归及原 Canvas 文件 | 2 文件，23 passed / 1 failed，exit1；新夹具遗漏 ACK 开关 |
| 时间线/对话/触屏/动画相关批次 | 7 文件，142 passed / 1 failed / 2 既有 skipped，exit1；唯一失败为新增完整快照比较的 `savedAt` 随墙钟变化，固定 `Date.now` 后保持完整断言 |
| 补充显示节奏/保留渲染及新回归、i18n、硬编码、套件归属、仓库卫生 | 9 文件，77 passed，exit0，无 skip/todo/unhandled；包含新增 8 项（6 项独立时钟/生命周期 + 2 项完整 Canvas/DEV 路径） |
| `npm run check:modules` | exit0，模块边界与静态测试依赖均通过 |
| 初次显式 types / build | 各 exit2；新测试 `Array.at` 不在项目 TS lib 内，改等价下标读取，未改变断言 |
| 最终 `vue-tsc -b` / `npm run build` | 各 exit0；实际 Vite 构建完成，只有既有大 chunk 提示 |

两项既有 skip 均来自 `p2_2_real_speed` 的退役旧生成/速度基线。旧断言、守卫语义、基线和 trace 未改；旧测试文件仅有下述宿主依赖补齐。生产构建产物检索没有 `debug_game`，DEV 助手已被构建条件移除。

源码守卫批次使用 `/private/tmp/p5-ui-fix4-precise-guards.cjs`（沿用上一轮的读取关系枚举，附加两项 Canvas/DEV 新回归）；清单在同名前缀 `.json`。枚举包含部分共享读取入口的行为回归，不能把文件数视为全文件测试通过数。本批实际退出 0：57 文件选中 102 项通过，921 项因名称筛选未运行，耗时 524.79 秒；无 unhandled。

## 旧测试宿主修订（两处）

`src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts` 把 `GameCanvas` 的 `displayFrame` 片段放进 `new Function`，手工提供闭包依赖。新增显示时钟后，原宿主未提供 `floatingPresentation`，五项均报 ReferenceError（`growth-current.log`，exit1）。随后**只将 GameCanvas.vue 回退为开工 HEAD**，同一原测试五项全部通过（`growth-head-canvas.log`，exit0）；自动恢复候选后，七个原候选代码/测试/清单文件 SHA256 全部逐字节一致。

据此仅给旧宿主导入真实显示时钟，并注入新增的两个显示对象/函数和上帧浮字标志；原动作、场景、回放/自动暂停、命令数、回合、摘要及 RNG 断言全部保持，无 skip 或容差调整。模块源码守卫补充批次同时复验该五项，结果见收尾记录。对照脚本和 JSON 结果均在 `/private/tmp/p5-ui-fix4-growth-counterfactual.*`。

第二处为同目录 `ext_growth_creation_ui.test.ts` 的开局 600 ms 防连击测试，同样截取画布循环。模块源码批次首次 18 文件为 43 passed / 1 failed / 405 名称筛选未运行，exit1；唯一失败同为缺少显示时钟依赖。只回退 GameCanvas 后原用例 1/1 通过（11 项未选，`creation-head-canvas.log`，exit0），恢复候选哈希一致。仅补真实依赖注入后，两份旧宿主整文件及结构读取守卫共 **3 文件 18 项全通过**；模块源码批次最终 **18 文件选中 44 项通过、405 项筛选未运行，exit0**，无 unhandled。源码/资源导入守卫的清单为 `/private/tmp/p5-ui-fix4-module-source-only.json`，不包括仅读取自然路线/历史 trace 等夹具的行为用例。

## 低帧率补充

补充真实 ticker 输入 `elapsedMS=1000 / deltaMS=100`，证明即使时间线浮字已经修好，若使用 Pixi 钳制后的 `deltaMS`，一个 500 ms 标签在实际过去 1 秒后仍可见（`slow-frame-red.log`，1 failed / 17 未选，exit1）。最终只将浮字时钟入参改为实际 `elapsedMs`；推进、光照等原动画时钟不变。新增断言保持，复测完整浮字/Canvas/时间线/成长宿主/自动和回放节奏，并重跑所有读取受影响画布/投影源码的已枚举守卫。此前无依赖该入参的其它源码守卫结果沿用，不把旧批次冒称本次重跑。

## 最终收尾

- 最终毫秒入参候选：相关 **7 文件 81 项通过**（`timing-final.log`，exit0，无 skip/todo/unhandled）；包含冻结/真实精灵池、低帧率、回放/seek/读档生命周期、DEV 等待/拒绝、两处旧宿主完整文件及显示节奏。
- 受影响源码读取守卫及附带新回归：**16 文件选中 24 项通过，239 项因名称筛选未运行**（`affected-source.log`，exit0，无 unhandled）。未受这一个时间入参变化影响的前述 57 文件/102 项及模块 18 文件/44 项结果沿用，不重复计数。
- 最后一次 `npm run check:modules`、显式 `vue-tsc -b`、实际 `npm run build` 均 **exit0**（`boundary-complete.log`、`types-complete.log`、`build-complete.log`）；仅既有大 chunk 提示。
- 最终九个代码/测试/清单文件 SHA256 集合摘要：`1c981ab131f00fbe5c6be6eed00b885d0d8f68680d16bda6bc5e68cfb7cac654`；清单 `/private/tmp/p5-ui-fix4-source-final.json`。最后门禁后逐文件核对不变。
- `git diff --check` 通过；改动文件无 CRLF、无大于 1 MB 文件。没有 staging/commit/push，没有基线/trace 重录。仅浏览器/真机及完整套件的未验范围保留，不宣称全场景或全量通过。

# UX-1D：读档续录与保存边界（引擎）

日期：2026-09-29。基准：`4277e73`。工作树：`playtest-fixes/BrogueJS`。本报告只覆盖引擎；菜单、存储失败反馈、结算与浏览器验收由主线程汇总。

## 规格与历史裁决

用户本轮要求新局自动内存录制、有效存档读回后连续录制、中途及终局可保存。旧 `docs/archive/dev-history/tasks/u-27.prompt.md` 当时允许“续录或明确拒绝”，`docs/archive/dev-history/reports/u-27.report.md` 选择了拒绝；这是当时的产品范围，并非 CE 强制。本轮没有改变 CE 模拟规则、随机数顺序或录像 JSON v2 格式。

## 接口与实现

- `Game.hasCompleteRecording`：存在从新局开始的完整内存来源，且当前不是回放。动画推进时仍可为 true，用于保留保存入口和展示等待。
- `Game.canExportRecording`：上述来源有效，且没有在途推进或待提交命令。调用者等此状态再调用 `exportRecording()`，不丢弃模拟以促成保存。
- `Game.toSaveSnapshot()`：用户持久保存专用。复用原世界投影，再在 `run.recordingOrigin` 中保存可选录制来源、开局检查点和影响命令解释的输入状态。App 的存档入口应使用它。
- `Game.toSnapshot()`：继续作为纯世界检查点，供诊断和黄金 trace 使用；没有来源的世界快照或旧存档仍可游玩，不能升级成可导出的完整录像。没有进行旧存档迁移，也没有升级存档/录像 schema。
- `loadSnapshot()` 检查来源版本/种子/模式，日志格式、事件索引连续且数量一致，以及末检查点的 tick、turn、depth、position、双流 RNG、终局结果。空日志须匹配保存的开局检查点及零 tick/turn、D1 条件。无效或缺失来源仍允许加载世界，但不续录或导出。
- 有效持久存档保存并恢复背包开闭/操作、帮助/发现页、投掷物品、法器目标和恶意物品待确认状态；物品按背包实体 ID 校验及恢复。旧读档清空这些状态会使同一后续命令产生不同效果，不能只持久一个 true 标志。
- 新局初始化来源；清空录像/进入回放清除来源；中断推进、命令抛异常或动画超时/异常令来源失效。新局可重新建立有效来源。没有改变正常强制回合或动画的调度。
- 终局保留日志，checkpoint 仍在原命令最终收尾处提交。补齐超级胜利标志读档：仅 true 时保存 `run.gameOverSuperVictory`，普通世界快照仍省略该键。
- 导出与载入录像对位置参数和 RNG 深拷贝，防止调用方编辑导出的 JSON 对象污染内存日志；无 RNG 消耗。

来源元数据是生产信任边界，不是对任意编辑过的完整世界做真实性证明。校验不重跑全局历史；从种子独立重放到保存点及续玩终点的完整世界比较由下列测试承担。篡改早期命令但保留末检查点时，回放仍按既有逐命令 OOS 规则报第一条分歧。

`scripts/u03-state-contract.json` 已登记来源生命周期和相关输入状态的持久保存例外；没有新增 Game 自有字段。元数据放在已有按实例隔离的 WeakMap 会话状态中。

## 复现与定向验证

新增 `src/test/ux_1d_recording_continuation.test.ts`，先在未实现新接口的生产代码上运行：4/4 失败，缺失续录/可保存能力。随后另加帮助、背包、投掷三个保存点：在仅恢复来源而未恢复输入状态的实现上 3/3 失败，实际值均在读档被清空；修复输入状态后全部通过。

最终定向命令：

```sh
npx vitest run src/test/ux_1d_recording_continuation.test.ts src/test/u_27_recording.test.ts src/test/x2a_recording_checkpoint.test.ts --maxWorkers=1 --no-file-parallelism
```

结果：3 文件、21/21 测试通过（UX-1D 12、U27 5、X2a 4）。覆盖：

- 新局 `wait` → 食物确认取消 → JSON 保存 → 读档 → 食物确认接受 → `search`；从种子独立重放到保存点及续玩终点，完整世界快照一致，正反 seek 零 OOS，确认不再弹窗。
- 帮助/背包/投掷中保存、读档、继续命令；从种子独立重放到终点世界一致。
- 新局空前缀；无来源旧快照；来源种子/输入引用/索引/事件数量/末 tick、turn、depth、position、RNG、end 篡改；无效来源不会被下一次保存升级。
- 动画提交前不可保存，最终 checkpoint 完成后恢复可保存；丢弃在途命令后拒绝导出，新局重新建立来源。
- 受控死亡、胜利、超级胜利终局的保存/读档与 end 检查点保留。这些是终局生命周期夹具，不声称自然玩通 D40。
- 导出对象隔离与保存/导出不消耗双流 RNG。

旧 `u_27_recording.test.ts` 的“残缺录像仍拒绝”断言和前提均原样保留：其 `toSnapshot()` 没有来源，仍正确拒绝。没有修改旧测试、容差、超时或 skip，没有需要批准的旧守卫前提修订。

## 集成验收与边界

主线程负责 App 使用 `toSaveSnapshot()`、保存请求等待最终边界、返回标题保留本局、localStorage 失败反馈与 JSON 兜底导出。不得在仅返回标题时重置 `isGameOver` 或清空录像；载入另一局/新局明确替换时使用已有生命周期入口。

最终合同/黄金回归：

```sh
npx vitest run src/test/u_00_new_run.test.ts src/test/u_03_whole_run_snapshot.test.ts src/test/u_r2_trace.test.ts src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts --maxWorkers=1 --no-file-parallelism
```

结果：5 文件、34/34 测试通过，306.50 秒。三份黄金 trace 原样匹配，U00 新局生命周期与 U03 字段/世界快照合同通过。连同定向组，共 55 项相关测试通过。`git diff --check` 通过。

全量测试、drift、构建和真实浏览器结果由主线程集中验收；本单元未提交或推送，未修改生成基线或黄金 trace。当前工作树没有 CE 参照目录，这些定向用例均不依赖 CE；没有把启动时的“CE-dependent tests will be explicitly skipped”提示当成 CE 一致性已验证。

回归原始日志：`/tmp/ux-1d-engine-regression.log`（不提交）。

## 交叉复核：自动行动保存点

主线程交叉审查发现 App 的保存/载入反馈使用 `logger.log()`，会经 `Logger.disturb()` 改动 `Game.disturbed`；该 UI 副作用由主线程修复并做浏览器验证。这里没有修改生产代码。

核对确认：`autoPath`、`isMouseTraveling`、`isAutoExploring`、`disturbed`、`autoFight`、`autoAction`（含剩余次数、方向、四邻通行状态、恢复条件）、旅行目标物品、已见集合和待发现消息均已保存并恢复。`inAutoTravelStep` 只表示同步调用栈内部，边界存点为 false，不需要持久化。

新增四个自然种子用例，分别在鼠标旅行、自动探索、长搜索、长休息仍有排队自动步时保存；JSON 读回后 `disturbed` 保持 false，继续 `auto_step`，再从种子独立重放全部日志，完整世界快照相等。`npx vitest run src/test/ux_1d_recording_continuation.test.ts -t 'resumes queued' --maxWorkers=1 --no-file-parallelism`：4/4 通过，5.65 秒（另外 12 项只是本次 `-t` 未选择，未新增 skip）。日志 `/tmp/ux-1d-auto-continuation.log`。未发现新的引擎自动状态遗漏；这组引擎用例不代替 App 消息副作用的浏览器验收。

## 全量发现后的输入恢复修正

主线程最终完整套件发现 `p2_2_real_speed.test.ts` D1/D2 在原第 397/428 行失败：异常/超时后锁已经解除，下一条玩家命令也已推进世界，但事件数没有增加。原因是本轮让 `recordingFromNewGame=false` 同时关闭了日志收集与完整录像导出，把两个状态混在一起。

最小修复只将 `executeCommand()` 的收集条件改为已有 `runtime.origin`。异常/超时/丢弃推进仍使 `recordingFromNewGame` 失效，`hasCompleteRecording`、`canExportRecording`、导出与保存来源的守卫不变；同一内存局继续收集已接受的输入供诊断。清空录像、回放、无有效来源的旧档加载仍清除 `origin`，因此不会开始收集旧档后半段，也不会把失效日志升级为完整录像。

新增异常/超时两个用例，修复前 2/2 在“已推进回合但事件数未加一”处失败（`/tmp/ux-1d-invalid-source-before.log`）；用例另检查后续输入追加、checkpoint 更新、导出继续拒绝、持久快照不带来源，以及重载该不完整快照后仍不续录。原 P2-2 与 U27 守卫没有修改，不涉及前提修订或断言放宽。

最终定向复核：`npx vitest run src/test/p2_2_real_speed.test.ts src/test/ux_1d_recording_continuation.test.ts src/test/u_27_recording.test.ts --maxWorkers=1 --no-file-parallelism`：3 文件、39 项通过，2 项为 P2-2 原有退役基线 skip，27.33 秒。日志 `/tmp/ux-1d-input-recovery-after.log`。本单元至此冻结，后续完整套件由主线程集中执行。

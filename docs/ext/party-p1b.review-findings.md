# Party P1b 独立审查 R1

结论：**需修**。已确认 **1 个阻断、4 个重要问题**。浏览器、数值平衡、云端长基准均未作为缺陷。

审查对象是 `a47a15b635284c84b4651ec28083adc052509c05` 上当前未提交的 P1b 实现；B1–B7 按推荐裁定。已读 AGENTS、HANDOFF、development、architecture、P1b 任务书、party 合同、实施报告，并参照 P1a R1/R2 的环境、终局及占位发现。未修改生产代码、测试、守卫或基线，未 commit/push；仓库唯一审查输出为本报告副本。所有探针和日志在 `/private/tmp/p1brev1/`，没有启动子代理。

## R1-F1 — 阻断：副成员法器待决保存丢失录像来源，读档继续执行不同动作

位置：`src/engine/Core/RecordingFormat.ts:145–161`，关联 `Game.ts:13367`、`:13665–13675`。

P1b 新允许窗口目标待决保存，但 `validateInputState` 对 arcana/throw/pendingUseConfirm 的物品 ID 仍只查 `world.player.inventory`。副成员自己的法器必然不通过；`toSaveSnapshot` 随即静默删除 `run.recordingOrigin`。读档仅在有效 origin 存在时恢复 `pendingArcana` 等状态，所以名册中的 modal 与窗口 decision 留下了，真正目标状态却丢失。

复现：`modal-save.mjs`。seed42、party-only 两人，在初始化/录制头生成前给 B 一根真实传送魔杖；初始化布景在 seed replay 时同样重建，不替换命令、存档或回放实现。初始存档有有效 origin。公开提交 B 的 `item/use(target:null)` 窗口，再保存、直接继续和读档继续相同 `cell:37:12` 选择。

实测：

```json
{"pendingActor":18,"wand":23,"hasCompleteRecording":true,"savedOrigin":false,"validateInputState":false}
{"loadedComplete":false,"loadedPendingArcana":null,"loadedNativeModal":true}
{"directCharges":3,"directPhase":"planning","loadedCharges":4,"loadedPhase":"interrupted","sameDigest":false}
```

直接继续真实施放并扣充能；读档路径没有施放，机械摘要不同且不能续录。相同初始化下原录像从 seed 重放零 OOS，说明不是布景不可重建导致。现有 `party_window_decisions` 只检查这条 modal 的取消，取消即使丢失法器也可成功，未断言 origin，所以未暴露问题。

应按待决 actor 的真实库存根验证并重建所有 modal 输入状态，验证非主成员目标选择的保存/加载/选择/续录，不只测取消。证据：`modal-save2.log`。首次脚本误用 `arcanaId` 查找物品而失败，已改为真实 `identityId`，原 `modal-save.log` 保留，不计产品失败。

## R1-F2 — 重要：提交被拒后，正常编辑、清空和 keep 都无法解除提交锁

位置：`src/engine/Core/PartyPlanning.ts:33–65`、`:115–122`；产品调用为 `usePartyUi.ts:48–58`。

`submit()` 在发送前设置 `submitted=true`。接受前拒绝不改变机械 revision；`edit/append/keep` 虽递增 generation，却没有清掉 submitted。后续修正的合法批次仍报 `BAD_SEQUENCE`。需要另行调用 session.cancel、重建会话或改变机械 revision 才能恢复；面板的清空/撤销/保留按钮均不调用 cancel。

复现：`probe-final.mjs` 的 `REJECT_EDIT_RETRY`。正常两人开局，启用真实 planner；通过 `handlePlayerAction('mouse_travel',{x:0,y:0})` 规划未知格，提交得到 `INVALID_TARGET`；把草稿改为一条 wait，再提交。

```json
{"first":"INVALID_TARGET","second":"BAD_SEQUENCE","submitted":true,"seq":0,"draft":{"kind":"queue","actions":[{"kind":"wait"}]}}
```

这是产品点击未知格→修正计划的正常可达路径，不依赖越权槽或伪造 revision。应按新编辑 generation 允许一次新的明确尝试，同时继续拒绝旧 deadline/旧异步回调和重复提交。证据：`probe-final-asserted.log`（原 `probe-final.log` 同结果）。

## R1-F3 — 重要：同层传送未打断窗口，继续执行传送前的队列

位置：`src/engine/Core/PartyWindow.ts:207–238`，传送调用来自 `Game.ts:4695` 的原生卷轴路径。

观察器只把 depth/active 变化视为转移，没有消费同层传送事实；`WindowActorView.at` 也未用于区分传送。合同 §4 明确同层传送仅移动该成员并打断，任务 B-A06 同样要求覆盖。

复现：`probe-final.mjs` 的 `TELEPORT_SUFFIX`。seed42、party-only 两人，清敌以排除新敌人打断，B 获得真实传送卷轴；公开提交 300tick 窗口，B 队列为 use 卷轴→search→wait。

实际 B 从 `(37,25)` 传送到 `(64,7)`，仍在 tick200 执行后续 search；最终 `reason=budget/endTick=300/interrupts=[]/cursor=2`。应在原生传送的安全原子边界停下，保留后缀供玩家在新位置确认。不能依赖落点恰好有敌人/陷阱才间接停止，也不应把普通移动一律当传送。证据：`probe-final-asserted.log`（原 `probe-final.log` 同结果）。

## R1-F4 — 重要：同一边界先受伤再回血会漏掉默认伤害打断

位置：`src/engine/Core/PartyWindow.ts:220`；关联 `TimeCoordinator.ts:562`、`Game.ts:12676` 的成员回合尾声。

伤害事实仅由两次 observation 的净 HP 差推断。燃烧伤害和回合恢复在同一原子边界完成，回血可抵消实际扣血；此时默认 damage=stop 不生效，收据也完全没有伤害事实。合同要求在完整边界后发布实际受伤事实，并非以净 HP 变化替代事实。

复现：`damage.mjs` 的 skip=1。两人、清敌、脚下干地，B 为 HP20、合法 regenCarry=0.99、已有 burning=1；布景阶段额外取一次 RNG 固定燃烧掷骰。真实提交 300tick 空计划窗口。探针仅包裹原 `resolveBurningDamage` 记录前后 HP，未替换伤害或恢复逻辑。

```json
{"skip":1,"damage":[{"tick":100,"before":20,"after":19}],"hp":20,"reason":"budget","ticks":300,"facts":[]}
```

实际受伤发生于 tick100，随后原生恢复到20，窗口却继续到300。skip=3/4 同样复现；skip=0/2 扣血大于回血时正常打断，构成同一探针的对照。应锁存本原子边界的真实伤害/状态事实，再在边界完成后统一决定是否停。证据：`damage-asserted.log`（原 `damage.log` 同结果）。

## R1-F5 — 重要：原生物品动作失败被当作 accepted 并消费游标，下一窗跳过失败步

位置：`src/engine/Core/Game.ts:4689`、`:630–633`；`src/engine/Core/PartyWindow.ts:337–357`。

`partyItemStages` 丢弃 `unequipItem` 的 false 返回；attempt 对非 move 的零耗时失败不区分成功。调度先记 accepted 并 cursor++，再以 zero-time-loop 停止。因此违背“运行期失效保留失败步供修订”，再次 keep 时自动绕过失败。

复现：`probe-final.mjs` 的 `CURSED_QUEUE`。正常两人、清敌，将 B 已装备的真实武器设为诅咒，公开提交 B 队列 unequip→search。

第一次原生脱卸失败，武器仍装备，收据却为 `outcome=accepted/chargedTicks=0`、`cursor=1`，原因 zero-time-loop。随后以空 plans（keep）提交新窗，第一步直接执行 B 的 search，失败的 unequip 已丢失。

应保留原生动作的成功/拒绝结果，运行期拒绝不消费游标、按 plan-invalid 硬停；合法零耗时操作仍可沿专门规则处理，不能通过一律保留所有零耗时动作掩盖差别。证据：`probe-final-asserted.log`（原 `probe-final.log` 同结果）。

## 其他重点的审查结果与边界

- 提交/ready/deadline：确定性批次、revision/seq/startTick 校验、取消 token、UI flush 后 generation/root 复核存在；trigger 不参与机械调度。新的失败重试缺口见 F2，不把 B1 未开放倒计时 UI 列为缺陷。
- 控制/焦点：维持 local:0；无 AI/远程占位。确认 DTO 绑定 actor/decisionId/ordinal/revision，控制变更增加 revision；scope 与 focus 分开。目标待决的持久化缺口见 F1。
- B3：32/128/1024/fine1000、25%/3窗及默认策略进入规则指纹；窗口推进依模拟 tick 与决策计数，没有发现按墙钟截断模拟。超限保留安全前缀的测试已在本轮限定测试中通过；实际安全打断另有 F3/F4，失败尾队列另有 F5。
- 单步/精细：fineActorId 显式录制、已有动作只等待结束；待决/失败及未消费尾队列拒绝单步，policy 显式清尾。未发现另外的确定旁路。
- 身份/录像：party F22/S9/R6/O4/state2 与无 party F20/S7/R4/O2 分支一致；语义段 full 保留，不再被临时末行撤销。输入只执行一次、收据另核验；上述正常路径不能替代 F1 的待决续录闭环。
- 环境/占位/终局：追查保留的 ControlledActor 分类、各成员状态/回合尾声、坠落和死亡清理、完整空间口；P1a 环境与占位回归纳入本轮。未另证实 P1a 原 TypeError、全灭不结算或传送叠格复发；窗口新增同层传送和受伤事实问题分别见 F3/F4。
- 无 party：有效身份、惰性根及原 fixture 未改；原五配置字节测试本轮通过，不删除版本字段作“归一化”。不声称所有可能场景穷举。
- 模块边界/全删：本轮 boundary 与依赖检查通过（692文件、errors=[]）。核对作者最终全删副本的903个剩余 src 文件，与当前工作区逐字节相同、差异=[]，九模块目录为空。用本轮新生成的自然 window/pending/loot 存档与录像独立复跑 classic/extended 两种活局的12次缺包拒绝，完整快照、玩家对象、RNG、allocator、有效录像前缀保持；另两种无模块局均完成 save/load/replay/seek/续录。只核查 retain=none，没有重跑 types/build 或其他删除布局。

## 实际运行与证据

统一从仓库根运行探针：

```sh
node /private/tmp/p1brev1/modal-save.mjs
node /private/tmp/p1brev1/probe-final.mjs
node /private/tmp/p1brev1/damage.mjs
```

Node v25.2.1；Vite SSR 的 websocket EPERM 为沙箱提示，实际模块加载、公开命令和断言正常完成，不作为产品缺陷。探针 exit0 只表示采证完成，不表示产品通过。

- 首批：`NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run src/ext/modules/party/tests src/test/ext_party_inert.test.ts src/test/u_03_state_contract.test.ts --maxWorkers=1 --no-file-parallelism`。**exit0，实际11文件/179项通过，620.26秒**；`related.log`。其中最后一个 U03 文件名筛选不存在，没有计入通过文件数，已在下批使用真实文件补测。
- 补批：`zsh /private/tmp/p1brev1/run-more-related.sh`，7份整文件为 `u_03_whole_run_snapshot`、`ext_recording_v4_digest`、`ext_recording_v4_snapshots`、`ext_recording_v4_storage`、`ext_recording_async`、`ux_1d_recording_continuation`、`ext_generation_checkpoint_differential`。**exit0，7文件/117项通过，181.64秒**；`more-related.log`。单worker、无文件并行、heap3072MiB，两批串行执行。
- 合计是**两批18个不同文件、296项通过**，不是一次完整套件运行。首批包含生产 Worker 的1/4成员2049输入边界测试、全部party专项、原五配置无party字节守卫。现有回归全绿不关闭上述独立复现。
- `node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs` 均 exit0；`boundary.log`、`dependencies.log`（692文件、errors=[]）。守卫源码未修改。
- 独立缺包拒档与无模块生命周期复核 exit0；`removal-recheck.log`、`removal-rejections.json`；删除副本身份比对见 `deleted-source-audit.json`。日志中的“14”包含12次拒档与2个生命周期，不误记为14次拒档。
- 结束时复算本轮记录的1605个生产/测试/工具/配置路径，散列无差异：`source-before.json`、`source-audit.json`。未更改原测试前提、未重录fixture、未修改守卫。
- 未跑完整 npm test/test:ext/drift/full/gen、types/build、浏览器、性能基准、云端长跑或其他删除布局；这些未跑项不列为新缺陷。

上述5项当前均未修复；本轮仅审查，建议作者按复现窄修后复验。

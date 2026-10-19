# Party P1c 第1轮独立审查

结论：**需修**。确认 3 项新的重要问题，均有仓外动态复现；不把浏览器、数值平衡或云端长基准未跑列为缺陷。未修改生产代码、共享测试或守卫，未 commit。

## 审查身份

- 审查日期：2026-10-20；工作树 `ext/party-p1a`，基线 HEAD `075b7eb10c87394fa5497fca3ff98e4ff63ac3c6`。审查对象为相对此 HEAD 的全部未提交 P1c 差量（含新增文件）。
- 已读 AGENTS.md、HANDOFF/development/architecture、P1c 任务书、party 合同与实施报告；C1–C7 按已批准推荐审查。
- 实测源码 SHA-256：`8b64f05a3f807d4caa42f8728e312b30695d4cc604c39e65890c03b869bf3ee8`，与作者最终身份一致。范围为 src/**、scripts/**、.github/**、package.json、package-lock.json、vite.config.ts；相对路径排序，以 path+NUL+sha+LF 汇总。清单：`/private/tmp/p1crev1/source-manifest.json`。
- 本报告是本次独立审查的结论，不将工作区已有历史 R1/R2 的关闭记录直接视为本次通过。被指定覆盖的旧 findings 已备份至 `/private/tmp/p1crev1/previous-review-findings.md`。

## 新发现

### P1c-R1-N1：原生目标待选期间立即切为 AI，导致本地取消/回答失去权限（重要）

位置：`src/engine/Core/PartyAi.ts:40–59`；调用链为 `commitPartyAiInput` → `applyIdleControllers`。后续权限拒绝点为 `src/ext/party.ts:153`，原生目标输入转换在 `Game.ts:4219` 附近。

控制生效只检查 `state.window.decision`、计时/长动作及麻痹等状态，没有检查 `party.native[actorId].modal`。P1a 单步物品操作仍能进入原生待选态，此时没有窗口 decision，actor 也没有付时，因此托管请求立即改变 controller。接着 escape/confirm_target 被包装为该 actor 的公开 actor-step，又被 human 权限检查拒绝。

复现（探针 `probe native target modal must retain human until answered`）：

1. seed42、仅 party、1 人新局；给主成员加入真实 `wand_of_teleportation`（仅用于布景）。
2. 通过 `submitPartyIntent({kind:'item', operation:'use', itemId:wand.id, target:null}, actorId)` 进入选点。确认 `native.modal=true`、`window.decision=null`。
3. 用当前 revision/epoch，通过公开 `executeCommand('party:ai', ...)` 请求 AI。
4. 实际：controller 已为 AI、pendingController=null，但 native.modal 仍为 true。`executeCommand('escape')` 抛 `NOT_CONTROLLER`，原待选无法正常取消。

预期：C2 要求待决先由 local:0 回答，再在空闲边界切换；原生待选也必须遵守。此问题不是不可恢复的永久锁死（可以再请求人工接管），但当前实现要求用户用额外接管绕回才能答框，违反待决与管理权限合同。建议将原生 modal 纳入非空闲条件，并保证零耗时取消/完成后的生效收尾也覆盖该路径。

### P1c-R1-N2：同伴指令绕过原生 IMMOBILE 限制，凤凰蛋可以自行移动（重要）

位置：`src/engine/Core/Game.ts:14618–14625`，以及 `Game.ts:12797–12817` 的 NPC 指令接入；`src/entities/Monster.ts:1770–1774`。

`takePartyCompanionOrder` 在 `takeNativeDecision` 之前截获行动；普通同伴的 move 直接调用 `moveResidentStep`/`tryMoveTo`。后者是底层移动执行口，不含原来位于 `takeNativeDecisionWithinAction` 的 `MONST_IMMOBILE` / `MONST_TURRET` 禁移动、禁近战闸。接收资格及意图提交也没有补该约束。多格的部分原生限制同样应按实际执行口查全，不能只修测试里的单种怪物。

复现（探针 `probe ordered phoenix egg must remain immobile`）：

1. seed42、仅 party、1 人新局；布置可见平地，加入目录中的真实 `phoenix_egg`，设为原生盟友，不加入 roster。
2. 通过公开 party:ai 对该盟友下发 guard，目标在它南面两格。
3. 提交一个真实 100tick 窗口。
4. 实际：凤凰蛋从 `(40,26)` 移到 `(40,27)`，同伴指令 ordinal=1、diagnostic=move。预期原地不动；这是原生行动资格，不是 AI 好坏或数值平衡问题。

CE 执行依据已读取本机另一工作树的参照源码：`/Users/coolking70/Documents/同步空间/BrogueJS/.ce-reference/BrogueCE-master/src/brogue/Monsters.c:3385–3393`，IMMOBILE 分支只允许特殊能力并直接返回；`Globals.c:1161–1162` 明确给凤凰蛋 IMMOBILE。当前 TS 原生路径也在 `Monster.ts:1869–1877` 保留相同限制。建议在同伴适配的资格/原生执行边界保留这些能力限制及合法回退；不要把命令目标授权当成移动或近战能力授权。

### P1c-R1-N3：临时 AI 待决期间重复人工接管不是 no-op（重要）

位置：`src/engine/Core/PartyAi.ts:131–134`、`162–170`。

no-op 判定比较 `pendingController ?? controller` 后，又用 `human && temporaryAiSeq !== null` 无条件判为变更。窗口仍待决时临时标记不能清除，因此第一次人工接管已经登记 pending human 后，每次重复请求仍会被当成新请求接受。

复现（探针 `probe repeated pending human request is no-op during temporary AI decision`）：

1. seed42、仅 party、2 人新局。
2. 一个 300tick 窗口给主成员 `ai-this-window`，第二成员的队列使用其开局口粮。饱食确认使窗口进入 awaiting-decision，主成员 temporaryAiSeq=1。
3. 对主成员发送人工接管；得到 pending human。
4. 使用最新 revision/epoch，再发送完全同值的人工接管。
5. 实际第二次使 revision `4→5`、controlEpoch `1→2`、录像事件数 `3→4`。C2 明确要求重复有效请求不增加 revision、时间或录像事件。

建议区分“首次取消临时覆盖”与“已经存在同值 pending human”，保留第一次请求清旧草稿/尾队列、等待原子边界的语义，重复请求直接 no-op。不能靠提前清 temporaryAiSeq 绕过待决时序。

## 动态复现与门禁

环境 Node v25.2.1；Vitest 4.1.11；heap3072MB、每批单 worker、no-file-parallelism。没有改门限、断言或共享测试前提。

1. 新问题探针：`/private/tmp/p1crev1/findings-probe.test.ts`，配置 `findings.config.ts`。3 项均按正确行为断言失败，分别精确复现 N1/N2/N3；exit1 是缺陷证据，不是通过。首轮日志 `probe.log`；固定复现文件后的日志 `findings-repro.log`；两次是同 3 项，不累计为 6 项。

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run \
  --config /private/tmp/p1crev1/findings.config.ts --maxWorkers=1 --no-file-parallelism
```

2. 相关现有整文件：**17 文件 / 184 项通过，exit0，361.40s**。涵盖全部 10 个 party_ai* 文件，以及 window、window_decisions、r1_environment、r2_occupancy、lifecycle、travel、ext_party_inert。日志 `/private/tmp/p1crev1/related.log`。

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run \
  src/ext/modules/party/tests/party_ai \
  src/ext/modules/party/tests/party_window.test.ts \
  src/ext/modules/party/tests/party_window_decisions.test.ts \
  src/ext/modules/party/tests/party_r1_environment.test.ts \
  src/ext/modules/party/tests/party_r2_occupancy.test.ts \
  src/ext/modules/party/tests/party_lifecycle.test.ts \
  src/ext/modules/party/tests/party_travel.test.ts \
  src/test/ext_party_inert.test.ts --maxWorkers=1 --no-file-parallelism
```

3. 当前树 `check-module-boundaries.mjs` 与 `check-test-dependencies.mjs` 均 exit0；依赖扫描 705 文件、errors=[]。日志 `boundary.log`、`dependencies.log`。
4. 全删：使用原 `check-module-removal.mjs --prepare-only --retain=none` 在仓外建立物理删除副本，九模块目录全部消失、remainingModules=[]。在副本独立运行 boundary、依赖扫描均 exit0（415 文件、errors=[]）。原准备器状态保留 `prepared-not-verified`，不冒充运行了它列出的全套门禁。
5. 另用公开命令捕获真实双 AI 新局的一窗 save/recording（1 项通过，capture.log）。对全删副本的 classic 和 extended-empty 分别加载这两份样本：**2 项通过，exit0**；两种输入均拒绝，完整规范化 save/recording 字节、双流、allocator、player/grid/monsters 对象身份保持；只固定 Date.now，未删字段。日志 `removal-probe.log`；探针 `removal.test.ts`；删除准备身份见 `removal/module-removal-results.json`。这不替代完整全删构建/生命周期门禁。

## 其余核查结论与范围

- C1：全人工默认、全 AI 只接受有限窗口、混合单步停最近人工点；代码有 1000tick 与 1024 决策上限，单步不绕已有尾队列/待决。现有整文件中的相关用例通过；未据此宣称穷举全部速度/冻结组合。
- C2：busy/frozen、最后胜出、常规同值 no-op、旧 tail/draft 失效的既有用例通过；本轮 N1/N3 是未覆盖的组合缺陷。
- C3：临时 AI 保留原队列/cursor、同 seq 待决存读续段、窗末清理的既有用例通过；永久切换的原队列清理路径已静态核查。
- C4/C5：默认值、五档、白名单、已知信息、主动拾取重验、累计4096预算、接收人整体预检、取消/覆盖及队长失效回退已审；相关现有探针通过。N2 为同伴原生能力限制遗漏，不能归入“平衡待验”。
- C6/确定性：核查 party F23/S10/R7/O5、module0.3.0/state3 及 effective codec 消费者、manifest/旧格式拒绝路径；无 party 保持 F20/S7/R4/O2。现有真实 AI save/load/replay/seek/续录及自然双人 D2 路线测试通过。未独立重跑完整2048 Worker长链，也未穷举所有拒旧损坏方式。
- 非主成员：环境、状态/伤害、占位、坠层、死亡/冻结恢复和终局相关整文件通过；没有以“已跑测试”冒称所有组合全覆盖。
- 无 party：原五配置的规范化字节夹具实际通过且未重录；静态检查新 Game/Monster 分支保持 party 条件化。未独立对完整原生对象图和所有随机路径作基线逐项差分。
- 模块边界：具体策略仍位于可删 party 模块，foundation 持有 DTO/控制/调度接缝；全删独立检查及真实缺包拒档见上。未跑其它删除布局、完整 npm/test:ext/drift、types/build、浏览器或云端长基准；这些不是本轮缺陷。

需作者修复 N1–N3 后针对相应执行路径复验。既有整文件全绿不能关闭这 3 项新复现。

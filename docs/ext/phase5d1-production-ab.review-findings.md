# 5D1 A/B 生产适配固定快照审查

日期：2026-10-08。**确认两项 S1 阻塞：死亡清理失败后无法重试且无法存档；日界需求失败后仍接受新原生命令并继续付时。** 两项均已在固定输入的真实 Game 上独立故障注入复现。本报告仅审当前已实现的 A 招募/来源、B 需求适配/回滚/终结持久化，不是完整 5D1 候选验收。

## 固定输入与方法

- `manifest.json` 的 baseline：`769f6fc18aad4881bfcc8d2170de84cfd319e4e8`；固定文件集合摘要：`d2683dd8efead9184d627ae68f156ce0bdd60e554e1ca7ead651b35ff7b7f634`。
- 正式任务 `input/docs/ext/phase5d1.task.md` SHA-256：`8de2d03106f19cd018ba70fbbb8b42227224bea03c5121176d1ba2558da16b62`。采用 §0/§0.1 F2 最新事务裁定及扩展 README 的新产品政策。
- 开始与结束逐份核验 manifest 的 2599 文件，全部匹配；固定输入没有 `.git`，不将 manifest 摘要称为 Git HEAD。证据为 `repro/sha-before.json`、`repro/sha-after.json`。
- 已读 AGENTS、HANDOFF、development、architecture、ext README、任务及已关闭 K1 报告；独立 `../oracle-work/cases.md` 只作为合同预期参考，没有把其 34 案例称为产品执行通过。
- 从 Game 的公开 `executeCommand`/招募入口、`killMonster` 可信死亡入口追踪 ResidentProduction、ResidentNeeds/World、ActorDeparture、TimeCoordinator、生成外层检查点及 load 的 detached candidate 校验链。K1 数学核不重审。

复现脚本 `repro/probe.ts` 使用生产 `createWorldHarness`/Game；种子 51020001，仅 settlement。布景在初始录像根捕获前配置已知平地、隔离原生敌人及材料预算；营地、墙/门/屋顶/床均通过真实付费命令建成，随后公开确认招募原自生 actor46。这是受控场景，不是自然路线验收。日界另通过合法 `toSnapshot`/`loadSnapshot` 将时钟和 ledger 高水位设为 31999；不绕过生产校验。

## AB-1 — S1：死亡清理的内部回滚留下 dying 标志，后续清理永久跳过

**固定位置：** `input/src/engine/Core/Game.ts:10587–10588,10609–10613`；`input/src/engine/Core/ResidentProduction.ts:421–447`；`input/src/engine/Core/ResidentWorld.ts:163–176`；`input/src/engine/Core/Game.ts:13490–13493`。存档拒绝点：`input/src/engine/Core/ResidentValidation.ts:15`。

**触发：** 已招募活居民进入 `Game.killMonster`；在 `replaceResidentComponent(owner,id,'resident',null)` 执行真实删除之后注入同步异常。该位置在居民死亡清理/退款事务内部，符合任务要求审查的失败域。没有替换死亡实现或回滚实现。

`killMonster` 先捕获 death、加入模块级 `dyingMonsters`、将 HP 置0，再调用 `removeResident`。后者才捕获居民事务检查点。异常时虽然恢复 roster/ledger/component，检查点没有恢复该 WeakSet；外层 `killMonster` 也没有 catch/rollback。因此 actor 同时处于 HP0、deathProcessed=false、仍占居民人口/来源的状态。移除故障后，再调用相同可信 `killMonster`，首行 dying 守卫直接返回；常规 `removeDeadMonsters` 同样调用此入口，不能修复该状态。

**实测：**

```text
after death fault {"hp":0,"deathProcessed":false,"residents":1,"source":true}
after cleanup retry {"hp":0,"deathProcessed":false,"residents":1,"source":true,
 "snapshotError":"C5_BAD_REFERENCE: resident.source.actor"}
```

actor 仍为原对象；没有重造 actor。`g.toSnapshot()` 已无法通过生产引用校验，所以问题不是仅有诊断字段残留：死亡清理无法恢复、人口/床/来源未终结、该局不能正常存档。这也不能由内部 roster 回滚成功宣称符合最外层 F2。

**最小修复建议：** 给可信死亡清理最外层建立同步事务边界，覆盖 death 捕获、dying membership、居民清理及后续死亡写集；异常恢复该入口对象图并暴露失败。若致死 HP 已在入口之前合法提交，应保留 HP0，但必须恢复入口的 dying membership，使清理能重试；不要无条件复活，也不要只清 WeakSet 而保留后半段可能已发布的掉落/死亡事实。已有生成路径显式保存/恢复 dying membership，可复用同样原则。回归至少验证本注入点失败后重试清理一次并可存档，并检查更晚掉落/死亡发布故障的最外层范围。

## AB-2 — S1：日界需求失败没有 pending barrier，新命令先移动并推进时间后才重试需求

**固定位置：** `input/src/engine/Core/TimeCoordinator.ts:142–158,201`；`input/src/engine/Core/Game.ts:10973–10974`；`input/src/engine/Core/ResidentNeeds.ts:19–28,60,75–76`。公共命令执行链：`input/src/engine/Core/Game.ts:3886,4444`。动画故障路径的相关静态证据：`input/src/engine/Core/Game.ts:11286–11290,11302–11319`。

**触发：** 有一居民、两份真实初锁 FOOD；worldClock 和 ledger 均为31999。公开 `wait` 将时钟推进到32000。在需求事务 `worldCampReplace` 已执行、累计初锁消费变1时抛错。该需求事务回滚正确保留已付到32000的时钟及原库存；但 ledger 仍31999，日界32000待结。

随后移除故障，**不手工调用 `settleResidentNeeds`**，直接再次通过 `executeCommand` 提交正常 move `(0,+1)`。公开命令无待结需求门禁，先改变玩家位置；下一轮 advancement 也先推进 timer/worldClock，再调用需求边界。`residentBoundaryTicks` 只按当前时钟到“下一个”1000边界计算，不识别32000尚未成功发布。

**实测外层需求检查点：**

| 时点 | worldClock | ledger.lastSettledTick | 玩家位置 |
| --- | ---: | ---: | --- |
| 第一次日界失败后 | 32000 | 31999 | (19,13) |
| 新 move 的第一次需求重试入口 | **32099** | 31999 | **(19,14)** |
| 新 move 返回 | 32100 | 32099 | (19,14) |

首次失败保留 `player.ticksUntilTurn=100`；新命令到重试前又推进99tick。输出来自对真实 `checkpointResidentWorld` 的观察包装，包装仍调用原检查点。脚本断言核实具体时钟及位置。没有只用 planner 或模拟时钟替代公开命令链。

任务 §0.1 明确要求：“结清b之前不继续新信用、产出或自由决策”；对应独立 F02 也要求不再付已付时间。当前在需求未结时就允许真实移动和新原生时间/环境效果，且重试事务入口已漂移到32099，违反该合同。连续失败时可反复移动/付时；本次未额外测岗位信用或战斗结果，不据此夸大为已实测产物复制。

**最小修复建议：** 显式保留待结边界或从 ledger 高水位识别它，在公共机械命令副作用与 advancement 新 elapsed **之前**以零新增时间重试/阻断。失败继续暴露，成功才恢复新决策；不得回退已合法支付的32000时钟/原生效果，也不得通过重跑原命令偿还。同步和动画路径共用同一阻断语义，避免 `finishAdvancement` 的一般异常解锁策略直接放行未结需求。回归应使用“失败后下一条公开 move/attack”验证，而不是仅在测试里手动调用需求提交。

## 实际命令、结果和保留证据

运行环境 Node **v24.19.0**；使用 P5 已有 `node_modules/esbuild` **0.27.3** 和依赖 JS，未安装、联网或读取 P5 移动生产 TS。`repro/compile.cjs` 只将固定 `input/src/ext/catalog.ts` 的 Vite 静态 glob 转为固定副本的 descriptor imports，并定义 DEV=true；没有替换生产函数。`repro/metafile.json` 可核对全部生产 TS/JSON 来源为本审查 `input/`。

最终以下两条均 exit0；第二条包含上述独立复现断言：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro/compile.cjs > repro/compile.output.txt 2>&1
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro/probe.cjs > repro/probe.output.txt 2>&1
```

初版复现布景先后因 classic 构造阶段无 extensionRuntime、遗漏隔离墙而退出1；已仅修复外部复现脚本，对应产品结论均来自最终 exit0 运行。编译 bundle 是临时约6.2MB产物，执行后移除；保留小型源脚本、metafile、输出，可用以上命令重建。哈希核对使用 Python hashlib 对 manifest 每份文件计算 SHA-256，前后均 2599/2599 相符、无新增/缺失输入文件。

## 覆盖限度与缺项

静态调用链确认：招募使用现有 actor、不再次调用救援落物；救援来源以 wasCaged 区分；自生来源的 placed/deferred/terminal 由持久 slot 控制；需求读取 home camp 的显式粮仓与真实 FOOD，锁前缀和耗尽根在需求事务内修改；load 在退休 live run 之前校验 decoded candidate。这里只记录所读实现，**不宣称上述全部行为独立实测通过**。

未执行 Vitest、vue-tsc、产品 build、npm 门禁、browser、删除矩阵、性能/GC或自然长局；未复跑 K1；未把既有 I8 单居民分段通过当作此次独立通过。多营/多居民实际 commit 的完整分段、revision/receipt tail/dirty oracle、坏档零 live/RNG 副作用、cached/pending/当前层携物终结、四来源全生命周期及 rescue save/load 仍需后续针对性验证，本次没有证据充分的新发现可在这些项上单列。

已明列未完成的 C 岗位边界、D 护送、E 自然路线、F 门禁未当成新缺陷。本次按尽快交付已证实阻塞的要求止于上述两项。仅写本审查目录的报告及复现证据；未改 input、P5、生产代码、冻结文件或其他审查目录，未 commit/push、未派代理。


---

以下是维护者追加的固定快照复审原文；前一轮发现保留，不覆盖历史。

# 5D1 A/B 修后固定快照独立复审

日期：2026-10-08。**AB-1 原死亡清理/重试/存档阻塞关闭；AB-2 普通移动与真实近战链已修复，但带原生 `perform` 回调的物品入口仍可绕过屏障，S1 保持开放。另确认 I15 的 help 面板方向键会提前结算，列为 S2。** 死亡故障后的日志值恢复一致，但日志数组身份不保留，不能宣称严格对象身份要求全部通过。

| 条目 | 本轮裁定 | 独立证据 |
| --- | --- | --- |
| 原 AB-1：dying 遗留、清理重试短路、存档拒绝 | 原 S1 关闭 | 三种故障阶段 × 活体/入口 HP0，均恢复并成功清理一次；另测真实 haul escrow；存读档通过 |
| 原 AB-2：新命令先副作用/付时，才重试旧边界 | S1 仍开，普通 move/近战部分关闭 | 同步、动画及 pending 存读档路径均先在32000重试；但回调投掷在持续故障下仍扣物品、分配 ID、消耗 RNG 与原生时间 |
| I15：纯显示、招募 No、陈旧 CAS 不物化需求 | 指定 F01/C01 场景通过；发现额外 S2 | 库存/模块 view/No/stale 保持世界、库存、RNG、ID；help 面板方向键未移动却消耗口粮 |
| AB-1 严格日志身份 | 保留验证差异 | 日志数组引用变更；内容一致，未证明引用持有者的产品故障，不升格为原死亡 S1 |

本轮只复审 AB-1/AB-2 修复及 I15 分类，不是完整5D1验收。脚本 exit0 表示所有独立断言执行完成，其中也断言了已发现的错误行为；不表示候选通过验收。

## 固定输入与证据来源

- 新完整快照 `manifest-v2.json`：2619份，SHA-256 `2530f08414260f39f62e68ba769249a273e70ae62362aa0058829066df738d80`。开始/结束逐文件散列均匹配，集合摘要独立重算相同，无新增/缺失输入文件。
- 新 manifest 声明的生产集合 SHA：`361b94d5e343362bc817d8887d7ff9650778b18c42100b6a928496a57e40484a`。这是执行者生产子集摘要；本轮独立核验的是包含该生产内容的完整固定快照，不冒称另行重算过1182份生产子集。
- 原 `input/` 的2599份文件仍匹配原 manifest，摘要仍为 `d2683dd8efead9184d627ae68f156ce0bdd60e554e1ca7ead651b35ff7b7f634`。原 `input/`、`repro/`、`review-findings.md` 共2607份文件，与复审开始保存的散列逐份相同，文件集合亦相同。
- 已读新 manifest、首轮独立报告、`fix-ab.status.md`、`../phase5d1-fix-ab.task.md`、本轮复审任务、收件箱 I15，以及固定树 AGENTS/HANDOFF/development/architecture。执行者的相关测试和类型门禁数字仅为背景，不作为本轮通过证据。
- 生产 TS/JSON 只从 `input-v2/` 导入。`repro-v2/metafile.json` 共377项：333项固定输入、2项外部探针、42项已有 node_modules 依赖；无移动 P5 生产源码输入。仅写 `repro-v2/` 与本报告，未修改输入/P5、提交、联网、派代理或运行重门禁/浏览器。

复用首轮独立 Game 布景，在新固定树重新编译。种子51020001，仅 settlement；初始录像根之前设置受控平地、隔离敌人与材料预算，营地、墙/门/屋顶/床均通过真实付费入口建成，公开确认招募原自生 actor46。日界布景使用合法 `toSnapshot`/`loadSnapshot` 设置时钟/ledger；I15 第二候选为受控放置的真实原生 goblin，经 `attachCreature` 和真实 `freeCaptive` 注册救援来源后招募。布景明确受控，不称自然路线通过。

## AB-1：原死亡阻塞关闭，日志身份另有差异

修复位置：[Game.ts:10614](input-v2/src/engine/Core/Game.ts#L10614)、[Game.ts:472](input-v2/src/engine/Core/Game.ts#L472)、[ResidentWorld.ts:163](input-v2/src/engine/Core/ResidentWorld.ts#L163)。`killMonster` 现在在 death 捕获、dying membership、HP0、居民清理之前建立 native checkpoint，外包居民事务；失败先由居民事务恢复 runtime/RNG/ID/time 等根，外层再恢复 native 图与 dying membership，并重新抛错。

独立注入均先执行生产实现，随后抛同步异常：

1. `replaceResidentComponent(...,'resident',null)` 真实删除之后。
2. `makeMonsterDropItem` 原生掉落执行之后。
3. runtime `emit('kill',...)` 真实事实发布之后。

每阶段分别从活体 HP20、可信死亡入口之前已经 HP0 的同一居民对象开始。挂真实 mango 原携物；保存最外层入口对象图、原携物引用、HP、双 RNG 完整状态与计数、实体/机器 next ID、logger 值、录制 dirty roots。独立 `auditFullObjectGraph` 从 `{g,rt,a,loot}` 遍历21395对象，并比较属性描述符、键序、引用、集合与字节内容；对每个失败，图差异0，原携物仍是同一对象，HP恰恢复20或0，`deathProcessed=false`、roster/source仍存在，双流/ID/logger值/dirty roots一致。

graph oracle 不复用生产 checkpoint 的显式写集。spy 的计数放外部闭包，checkpoint wrapper 在审计之前安装，审计在拆除 wrapper/成功重试之前执行。日志单例独立捕获，未靠把 logger 值相同混入 Game 图差异0而掩盖其身份差异。WeakSet 内容无法直接由该 oracle 枚举，因此通过同一 actor 重试与常规 HP0 清理结果验证 dying 未留下短路。

撤故障后：活体案例再调用可信 `killMonster`；入口 HP0 案例用下一条公开 `wait` 触发常规死亡清理。全部 `deathProcessed=true`，roster/source终结，原 mango 恰一份、仍为原对象落地；成功重试的 kill hook 恰一次，二次 kill 的 digest/ID/RNG 不变。`h.load(h.save())` 全部通过且 digest 相同。较晚发布故障中外部 spy 可看到失败调用一次；该闭包不是生产可回滚状态，未将它计为残留世界事实，实际 runtime 图仍比较为0差异。

另通过公开付费建 chest、deposit6种子、assign haul、公开 wait6次，取得真实原生 job、actionId、cargo escrow 与 bundle。在原生掉落/真实退款之后抛错，包含 `{g,rt,j,cargo}` 的23806对象图仍0差异，cargo仍同一对象、动作/dirty/RNG/ID还原。撤故障 kill 后 job/bundle清理、原粮仓种子总量恢复6，二次清理不重复退款，存读档保持。此项没有用虚构 scheduler 行替代活跃工作。

**严格日志身份保留项：** [Logger.ts:160](input-v2/src/engine/Systems/Logger.ts#L160)、[Logger.ts:162](input-v2/src/engine/Systems/Logger.ts#L162) 用新数组和消息副本恢复。六种死亡故障均实测：

```text
loggerValuesEqual = true
loggerArrayRetained = false
loggerIdentityDifferences = [
  "world.logger.messages value", "world.logger.mechanicalMessages value"
]
```

这是最外层引用身份要求中的实证差异，不是“完整图全过”。目前检查的 HUD/MessageJournal 消费端重新读取或 slice 日志，未找到必须持有旧数组的产品故障链；不能据此猜测漏日志、重复日志或再次存档失败。原 AB-1 的 S1 行为关闭；若验收将日志自有数组纳入严格身份合同，则还应原位恢复数组/原消息对象，并追加保留引用的断言后才能宣称该加强项通过。

## AB-2：普通入口修复通过，S1 回调投掷入口仍开

普通链修复位置：[Game.ts:3595](input-v2/src/engine/Core/Game.ts#L3595)、[Game.ts:3805](input-v2/src/engine/Core/Game.ts#L3805)、[Game.ts:3826](input-v2/src/engine/Core/Game.ts#L3826)、[Game.ts:11360](input-v2/src/engine/Core/Game.ts#L11360)、[ResidentNeeds.ts:24](input-v2/src/engine/Core/ResidentNeeds.ts#L24)、[TimeCoordinator.ts:437](input-v2/src/engine/Core/TimeCoordinator.ts#L437)。高水位识别 pending，不依赖易失故障标记；公开/内部命令前重试，时间协调器在新推进前阻断，动画异常遇 pending 不执行一般 epilogue。

分别同步和动画：clock/ledger31999，公开 `wait` 在32000日界真实更新 camp 后抛错。失败保留已付 clock32000、ledger31999、玩家(19,13)、`ticksUntilTurn=100`、粮2。持续故障下下一公开 move `(0,+1)`，以及两次对邻接真实敌人的方向 move `(-1,0)` 均抛错，未移动/付新时间/消费粮；双 RNG、ID与阻断入口对象图一致，真正近战 resolver 调用0。正常公开 `executeItemCommand('drop',food)` 在入口 C5_BUSY，库存未变。

撤故障后的下一 move，无手工调用需求提交：其第一次真实 resident checkpoint 恰为32000、原位置(19,13)；之后才到(19,14)/32100，粮2→1、累计消费1、日粮收据1。随后把真实敌人放在新位置邻接格并执行相同方向攻击，真实近战 resolver调用1，证明之前的受阻攻击是实际原生攻击路径。同步/动画输出一致，成功后存读档 digest相同。另将32000/31999 pending合法存读档后，下一 move仍先在32000/原位置补结。

**仍开 S1：`executeItemCommand` 的 `perform` 回调没有进入机械分类。** 精确入口：[Game.ts:4109](input-v2/src/engine/Core/Game.ts#L4109)，分类：[Game.ts:3810](input-v2/src/engine/Core/Game.ts#L3810)，实际回调执行：[Game.ts:3857](input-v2/src/engine/Core/Game.ts#L3857)。公开与内部两层 `settleResidentNativeInput(action,data)` 都不接收 `perform`；item拒绝名单未包括 `throw`，把默认进入选目标模式的 throw 当显示入口。但是带 callback 时直接执行原生动作，不走默认 item 分派。

独立最小复现：真实 wait日界失败保持故障，然后两次调用：

```ts
g.executeItemCommand('throw', dart, undefined,
  () => g.throwItemAt(dart, 22, 13));
```

dart为当前背包原生 WEAPON堆叠，数量15。没有发明 action 名，没有只在 callback 里改计数，没有绕过公共命令边界。callback调用真实 [Game.ts:8150](input-v2/src/engine/Core/Game.ts#L8150) 投掷，其 `notifyCommittedAction`、`prepareThrownItem`、落地、原生付时均实际执行。直到投掷末端 [Game.ts:8380](input-v2/src/engine/Core/Game.ts#L8380) 已增加 `timeSystem.currentTick`，再由 `playerTurnEnded` 的需求 gate 抛旧 daily fault；该 gate只能恢复需求事务，不能撤销先发生的投掷。

| 两次持续故障调用前后 | 前 | 后 |
| --- | ---: | ---: |
| 背包 dart数量 | 15 | **13** |
| next entity ID | 51 | **55** |
| 实质 RNG累计调用 | 120286 | **120287** |
| 装饰 RNG累计调用 | 161 | 161 |
| 原生 `timeSystem.currentTick` | 3900 | **4100** |
| worldClock | 32000 | 32000 |
| ledger高水位 | 31999 | 31999 |

两次均抛 `daily fault`。旧边界持续未结，却已接受真实物品副作用/原生付时，符合原 AB-2 的失败语义，不能用普通 move/drop 回归通过关闭全条。影响范围准确限定为受信任的公开 `perform` API；当前 `InventoryOverlay.vue:360` 的默认 throw不传 callback，通常后续 mouse_travel有 gate，本轮不声称默认鼠标投掷路径也复现同一问题。

最小修复方向：公开和内部 gate一起携带已接受机械执行的意图，确保 callback真正执行 native mutation之前重试或 C5_BUSY；或限制该受信任 API在pending状态的机械 callback。需要区分默认进入投掷目标选择与实际确认投掷，不能为修复而把所有 display callback、No/CAS拒绝都提前结账。回归必须保留真实 throw实现、双流/ID/物品/原生时间检查；撤故障后先在32000补结再接受一次新投掷。

## I15：F01/C01 实测通过，help 方向键 S2

指定场景：合法 detached save中 clock32000，原居民 ledger为未结旧账；第二床付费建立，第二救援候选已注册真实 source。粮设为合法预算3（原居民一日消耗1后仍满足两居民招募容量），通过生产 load校验。依次公开开/关库存、读模块 view、公开招募确认 No、targetRevision陈旧1的招募 CAS拒绝，均未物化需求。每步世界 JSON、FOOD对象身份/数量、双 RNG、实体ID保持一致，stale返回 C5_STALE。第一次接受真实招募后，外层 checkpoint为32000/原roster1；粮3→2、消费1，roster2，新居民 foodShortage0，不替新居民补付未参与的旧日。

接受后补算的位置：[ResidentProduction.ts:232](input-v2/src/engine/Core/ResidentProduction.ts#L232)，先 prepare/CAS，再在 accepted outer transaction内 `settleResidentNeeds(g,true)`；招募于需求消耗后重新验证资源。初版外部探针只有粮2，消耗后招募拒绝 C5_INPUT；本轮只修正受控预算到3，保留生产拒绝语义，未改输入或弱化断言。该失败输出保留在 `repro-v2/probe.attempt1.output.txt`。

**新 S2：help 面板拦截的方向键仍物化旧需求。** 精确分类：[Game.ts:3817](input-v2/src/engine/Core/Game.ts#L3817)、[Game.ts:3821](input-v2/src/engine/Core/Game.ts#L3821)；实际纯显示/忽略分支：[Game.ts:4473](input-v2/src/engine/Core/Game.ts#L4473)、[Game.ts:4477](input-v2/src/engine/Core/Game.ts#L4477)。gate考虑库存/identify/arcana，但遗漏 `referenceScreen`。因此 action名 move触发补账，而后真正分派因 help面板直接 return，没有接受移动。

使用合法 clock32000/ledger31999存档，无注入故障：公开 help打开面板不耗粮，再公开方向 move `(0,+1)`。实测玩家仍(19,13)、面板仍 help、clock仍32000，但 ledger31999→32000、FOOD2→1。探针对所有这些结果都有断言；不只是静态猜测。

这违反 I15“纯显示/未接受机械命令不物化需求”的范围，玩家仅在帮助界面按方向键就改变口粮账。最小修复应先按实际模态分派判断方向键是否接受机械动作，或在该 gate正确排除 referenceScreen拦截的动作。应使用同一合法pending存档验证 help/图鉴方向、关闭面板、下一真正 move的顺序；此处图鉴同一分支仅静态核对，本轮不冒称图鉴独立实测通过。

其他目标确认入口亦已沿 `pendingArcana`/`confirm_target` 静态跟到真正效果提交，但本轮没有构造完整可达故障组合的独立实测，因此不单列推测缺陷。

## 扩大死亡写集的范围与限度

`killMonster` 的新条件是 runtime存在 resident owner，不是当前 m必须是居民。因此启用 settlement时，每次普通原生生物死亡也走广泛 native checkpoint与居民外层事务。`checkpointCombatFactWorld` 收集当前/休眠/purgatory/cached/pending及携带生物，覆盖网格/地形/光照、原生 actor、物品、bodyGroups、runtime关联、动作/防御源/dirty/logger/dying等；另居民 checkpoint负责模块/RNG/ID/time。范围在静态实现中明确，比只包 resident component广。

`ResidentWorld.ts:162` 的 WeakSet让嵌套居民事务共用外层checkpoint；嵌套 `killMonster` 仍各自取 native checkpoint。giant member/core退休逻辑也在新 outer范围内，错误由catch恢复后重新抛出。上述是读到的控制流，不是性能或完整 giant/嵌套死亡实验。本轮 graph覆盖场景内其他原生对象，但没有逐类杀死普通怪/巨人/连锁死亡验证成本与嵌套组合；未发现可证实的新性能、异常吞噬或巨人缺陷，不能仅凭广写集猜退化。既未交付的C/D/E/F及自然路线等也不重新编号为新发现。

## 运行与完整性复核

Node v24.19.0、已有 esbuild0.27.3。构建适配只将固定 catalog的 Vite静态glob转换为固定 descriptor imports，DEV=true；不替换生产执行函数。最终命令均 exit0：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/compile.cjs > repro-v2/compile.output.txt 2>&1
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node repro-v2/probe.cjs > repro-v2/probe.output.txt 2>&1
python3 repro-v2/verify.py
```

保留 `scene.ts`、`probe.ts`、`compile.cjs`、metafile、最终 stdout以及 SHA/首轮保全证据。临时约6MB bundle执行后删除，可按上式重建。早期编译仅外部脚本的重复 export/导入路径错误已修正；第一次 I15预算失败如上保留，最终结论均来自修正外部布景后的完整执行。后续输出中的 logger差异在失败后立即采样，避免成功 HP0 wait改变 logger.turn导致错误归因。

`sha-before.json`/`sha-after.json`：新快照2619/2619匹配；`preservation.before.json`/`preservation.after.json`：原2607份逐字保全；`integrity.output.json`汇总新旧集合核验。没有将执行者门禁、独立合同案例文本或脚本 exit0冒充完整候选通过。


---

# 5D1 A/B 第三轮固定快照独立复审

日期：2026-10-08。**关闭第二轮剩余 AB-2 perform 投掷 S1、help 方向键 S2，以及 I16 Logger 数组/行身份项。原 AB-1 死亡阻塞保持关闭。本轮没有新的实证 S1/S2。** 结论仅签本批 A/B 与 I16 修复，不代表完整5D1验收。

| 项目 | 本轮裁定 | 独立执行结果 |
| --- | --- | --- |
| AB-2 真实 perform 投掷屏障 | 关闭 | 持续故障两次均不变物品/ID/双 RNG/日志/原生时间；恢复后先补32000旧账，再投掷一次 |
| 默认投掷准备、取消、No、实际确认 | 通过本轮覆盖 | 准备/取消/No不补账；真实确认失败无机械副作用，恢复只投一件；贵重已装备物确认 Yes 也未提前卸装 |
| help/图鉴方向键 | 原 S2 关闭 | 两个真实面板的方向键及关闭均不结账；关闭后的下一真正 move先在原位置/32000补结 |
| 实际 staff/arcana | 通过本轮覆盖 | 公开准备/游标/取消、真实 blink风险 No、ACK均不补账；真实 lightning确认故障无效果，恢复后原生命中一次 |
| I16 Logger 身份及描述符 | 关闭 | 保留原数组、原行、ACK occurrence；嵌套/重复恢复、行折叠、额外属性与真实死亡异常均通过 |
| 原 AB-1 外层死亡事务 | 保持关闭 | 三故障阶段×活体/入口HP0、真实haul escrow回归通过；重试一次并可存读档 |
| 原库存/view/招募 No/CAS/接受 | 保持通过 | 原独立 F01/C01 布景在新固定树复跑通过 |

## 输入、范围与方法

本轮只使用固定 `input-v3/`。完整快照2619份，独立开始/结束 SHA-256 均为 **`652000875bcd04157f4e1c3e54de18d144626e8dbc35bac312e389cf8b13cfdb`**，逐文件与 `manifest-v3.json` 相符，无新增/缺失文件。另按 `executor-production-manifest-v3.json` 的 path/sha256/bytes格式独立重算1182份生产子集，得到 **`a387f9729e3899696e63de3c818abb5e4e9dc016b80bfd6965cf00fda238b330`**，与声明及最终执行者门禁输入一致。

原 `input/`、`input-v2/`、`repro/`、`repro-v2/`、两轮报告及旧manifest，共5244份文件，开始/结束散列及文件集合完全相同。证据在 `repro-v3/preservation.before.json`/`preservation.after.json`；紧凑汇总为 `repro-v3/integrity.json`。没有修改任一固定输入、旧证据或P5，没有提交、推送、派代理或联网。

已读本轮任务、新manifest、`executor-tested-status.md`、完整 `incremental-v3.diff`、I16裁定，以及后补的 `executor-final-report.md`。执行者原始日志/JSON只作为待审核证据；独立结论来自自己的 Node Game探针，没有把执行者11项或最终292项称为本轮独立执行通过。

复用自己的受控真实 Game场景：种子51020001、settlement；营地、围墙/门/屋顶/床由实际付费入口建立，招募原自生 actor46。日界从合法31999 snapshot/load开始，公开 wait真正到32000后，在 camp更新已执行时同步抛错，留下clock32000/ledger31999。不是手动调用需求 planner代替公开失败，也不是自然路线声明。所有新入口都在这个真实pending日界或合法未结旧账场景上执行。

Node v24.19.0，绝对路径、`--max-old-space-size=3072`，已有 esbuild0.27.3，单个独立 Node探针。只处理固定 catalog的 Vite静态glob转换与DEV定义，没有替换生产动作实现。metafile为333份固定TS/JSON、2份外部探针、42份已有依赖，无移动P5生产树输入。未运行Vitest大套件、build、浏览器、drift或性能实验。

## AB-2 投掷与显示分类关闭证据

固定位置：`input-v3/src/engine/Core/Game.ts:3602,3805,3814,3823,3824,3836,8195,8199`。公开及内部输入把 `perform`传入分类；默认staff准备、reference方向和投掷目标选择保持未接受状态。真正投掷在No/诅咒拒绝之后、卸装/notifyCommittedAction/prepareThrownItem之前结需求，因而受信任callback也不能绕过。

独立执行同步/动画 × callback/default四组；每组真实旧日界失败后，再保持同一故障执行两次：

```ts
g.executeItemCommand('throw', dart, undefined,
  () => g.throwItemAt(dart, 22, 13));
// 默认入口另走 executeItemCommand('throw', dart) + 公开 mouse_travel。
```

两次均抛真实 `daily fault`。每次比较整world5、原生actor位置/HP/timer、玩家位置/HP/nutrition/timer、背包数量/charge/使用字段、地面物、双 RNG完整状态/计数、实体及机器ID、原生 `timeSystem.currentTick`、logger内容。所有值保持入口；logger独立完整对象图差异0，数组/行身份不变。default准备产生原有“选择投掷目标”提示，此显示日志明确允许；不将其当成补账或要求它无提示。真实确认的故障比较从提示完成后的入口捕获，仍严格要求日志值与身份不变，没有排除失败域的logger。

撤故障后的四组均首次进入需求checkpoint于32000/原玩家(19,13)，随后dart15→14，原生时间只新增100，worldClock32100；FOOD2→1、累计消费1、日粮收据1，存读档digest一致。动画组确实进入 `isAdvancing=true`，调用 `stepAdvancement` 完成一步，而不是仅设置动画布尔值。第二轮反例中的dart15→13/ID51→55/原生时间+200行为不再发生。

默认进入目标、escape取消不物化需求；实际贵重已装备单件的callback/default投掷均触发真实原生确认一次，No后装备/机械状态保持。另持续故障下真实确认Yes仍在卸装之前抛daily fault，装备和全部机械入口值不变。

help和discoveries分别在合法32000/31999快照执行：打开、两个实际方向键、escape关闭后，world/粮/双 RNG/ID/原生时间/日志与入口相同，面板方向未移动。关闭后真正move的第一次checkpoint仍32000/原位置，随后32100，日粮一次。第二轮help提前耗粮反例不再复现；图鉴本轮也实际执行，未只靠共享分支推断。

原同步/动画 move、对真实邻接敌人的方向攻击、pending存读档恢复、正常drop C5_BUSY，以及F01/C01库存/模块view/招募No/陈旧CAS/成功接受也在新树复跑。招募布景仍经真实救援来源注册、合法粮预算3，旧居民耗1，新居民不追补旧日。

## 实际法器效果与 No/ACK

固定位置：`Game.ts:3814`允许未接受的staff/wand目标准备；`Game.ts:5925`在有效目标和风险确认接受后、取消pending/发布cast/执行bolt/charge/付时之前补结需求。拒绝原点/invalid/空的已识别法器及真实No都在该点之前退出。

同步和实际动画各一组：把真实原生敌人放在玩家(19,13)经已打开门通向(19,10)的无遮挡射线；保留resident与付费营地，刷新原生视野。真实 `spawnStaff('staff_of_lightning')`加入原背包，再公开 `executeItemCommand('use',staff)`，公开方向改游标、取消、重新准备并设到该敌人的有效格。准备/游标/取消时全部机械值及logger不变，未提前补账。

在有效目标上两次公开 `confirm_target` 均因旧daily fault抛错：`zapBoltFromPlayer`实际resolver调用0，目标HP7不变，staff charge3不变，pending仍为原staff，world/runtime/staff/target图与logger图均0差异，双流/ID/时间不变。撤故障后同一公开确认：首次checkpoint为32000/原位置，原resolver真正调用1，**目标HP7→0**，charge3→2，pending清除，原生时间+100、clock32100、日粮恰一次，存读档一致。动画组实际进入并完成advancement。由撤故障后的原生命中证明该布景可达、被接受，绝非用invalid-target的免费拒绝假称屏障成功。

No另用真实blinking staff及已发现熔岩射线：玩家(10,10)、熔岩(13,10)、aim(20,10)、未知范围E2的安全远岸。生产 `getArcanaPreview().risk`确为possible；公开确认产生实际command confirmation token。同步/动画都先观察暂停时机械不变，再用该token回答false；pending取消，重复回答拒绝，粮/世界/charges/位置/双流/ID/原生时间/logger均不变。不是给错误目标传一个未被读取的No。

ACK另保留真实pending acknowledgment occurrence。ACK存在时真实投掷callback和有效staff的公开confirm都被初始门禁阻断，未执行或补账；acknowledgeNext也未结历史账。optional presentation阻断端口同样拦住真实callback。此为headless原生会话检查，不声称浏览器UI验收。

## I16 Logger 原身份、描述符及真实异常

实现位置：`input-v3/src/engine/Systems/Logger.ts:42`的 `checkpointRows`、`:162`的checkpoint与`:180`之后恢复路径。helper是真实运行代码：以Reflect.ownKeys保存数组自有键/描述符，保存既有行的自有描述符，删除新增键，原位defineProperty/defineProperties恢复；再绑定回原messages/mechanicalMessages及combat/pending/unread根。不是类型声明替代运行时逻辑，未通过重造数组深值相等关闭I16。

独立保留外部引用并验证：

- 原messages与mechanicalMessages两数组、各原行、folded archive行、pending ACK occurrence；比较引用相等和完整descriptor，而非只peekState。
- 行foldable/acknowledge/count/turn/ID等字段，数组索引/length，以及主动加入的可恢复非枚举额外属性和Symbol键。修改枚举性/count、shift、增加键之后，恢复删除新增属性并准确恢复原描述符与键序。完整对象图oracle未排除logger。
- 外层checkpoint后折叠alpha到count2并加beta，再内层checkpoint；reset换数组并写 speculative消息后，内层重复restore两次。随后改变数组/行/ACK状态，外层重复restore两次；各层入口图差异0，原引用、值和ACK发生顺序恢复。恢复后重新fold一次count2/单archive行/两ACK occurrence，无回滚残留复制。
- 未flush的真实combat buffer、heard latch、ACK pending及terminal/unread转换，重复restore三次；flush只得到existing/unflushed，ID0/1，不重新听到suppressed内容，ACK仍原occurrence。

真实异常再验证，不只手调checkpoint：入口居民HP0，先写真实foldable+ACK行，并保留外部数组、原行、机械数组及pending occurrence。对真实runtime emit包装，在真正kill事实发布之后再次fold同一行并抛错。 `{g,rt,a,logger}`独立完整对象图回滚差异0，入口HP仍0、death未处理，原数组/行/ACK引用和descriptors全恢复，count仍1。撤故障后同一wrapper成功kill，count恰变2、仍一archive行、两ACK发生；再kill不新增消息；存读档通过。原AB-1三故障阶段×HP20/HP0与真实haul escrow亦全部复跑，六个logger身份差异从第二轮的两项变为0，外层native图21395对象与haul23806对象均0差异。

类型补修也有实际效果证据：执行者最初数组泛型 `getOwnPropertyDescriptors(rows)`直接传defineProperties触发TS2345，最终逐PropertyKey Map捕获/defineProperty恢复。当前检查索引、length、额外string/Symbol描述符的独立运行均通过。未构造生产之外不可恢复的非配置属性破坏，也未凭未测组合猜新缺陷。

## D4 版本断言例外与执行者门禁审核

**接受最小版本前提同步。** `incremental-v3.diff`中 `input-v3/src/test/dialog_d4_blink.test.ts:95`只把save.version严格值5改6并加解释，recording.version4与后续零OOS/playing/restart/seek/load/save续录断言未改，没有加skip或宽松容差。正式任务§0/§5明示保留whole-run6。WholeRunSnapshot当前SHA为 `82bea7e28f8304838359c57325fd170b13fe0cf7da52bb610d1f536af4ca9938`，不在v2→v3变更清单中；v3实际serialize/decode仍v6。本批没有改存档版本生产逻辑。

亲自核对原始JSON/日志及反事实脚本，保留准确顺序与来源：

1. `related.json`首批270项：268通过/2失败，success=false；两失败均D4 answer false/true在版本pin遇actual6/expected5，不能写成首轮全绿。
2. `counterfactual-version.state.json`第一次恢复HEAD，前/反事实SHA完全相同，0通过/2失败/27名称未选，exit1；该次没有变量变化，不能用作有效归因。
3. `counterfactual-version-history.py/state.json/json`仅临时替换WholeRunSnapshot为历史 `6e068cd^`真实v5生产文件，旧测试保持不改；两完整行为用例通过、27名称未选、exit0，finally恢复当前生产字节相同。反事实SHA `ec9e3b9e047d8ba3d1746e909b07e865519803fe8edde676a44787cc4445679f`与当前不同。这是执行者反事实证据的审核，没有在移动树重跑或冒称我独立执行了反事实。
4. types首次exit2/TS2345原始日志亦保留；类型恢复写法补修后，最终相同SHA批次types-fixed exit0，再完整重跑affected-final。
5. 最终 `affected-final.json`8文件290通过/0失败/0pending；`checkpoint-final.json`2通过/0失败、36项-t名称未选；最终types及boundary exit0，state完整并记录每阶段输入未变。**执行者选择合计292通过，checkpoint36项不是CE skip，不代表完整两文件通过。** 核对最终摘要与原始JSON一致；详见 `repro-v3/executor-evidence-audit.json`及其原始证据散列。

上述最终门禁是执行者结果，我的独立覆盖是 `repro-v3/probe.ts`输出28组结构化Game/Logger结果及相应断言。初版自己的probe因把默认投掷的合法“选择目标”提示也要求无变化而exit1；只修外部观察时点/提示分类，保留 `probe.attempt1.output.txt`，实际确认失败仍全量比较logger。之后完整probe exit0，新增真实死亡fold/ACK与贵重Yes回归后最终完整运行再次exit0。生产输入未改，旧证据未改。

## 复现与停点

最终实际命令均exit0：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --max-old-space-size=3072 repro-v3/compile.cjs > repro-v3/compile.output.txt 2>&1
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --max-old-space-size=3072 repro-v3/probe.cjs > repro-v3/probe.output.txt 2>&1
python3 repro-v3/verify.py
```

保留源脚本、metafile、最终输出、`results.json`、新输入前后散列及旧文件保全证据；约6MB临时bundle执行后删除，可按上式重建。`integrity.json`包含新快照/生产子集摘要、5244份旧文件未变、输入来源计数及probe完成标志。

本批AB/I15/I16可以关闭；未复跑的更广组合不夸成通过，也没有把已留给parent的C/D/E/F、自然路线、性能、浏览器或完整候选门禁重新列为发现。按本轮任务完成后停下。

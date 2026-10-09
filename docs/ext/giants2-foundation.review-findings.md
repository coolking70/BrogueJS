# giants2 前置底座独立审查 R1

2026-10-09；`ext/phase5`，开工及审查 HEAD `02ef819f1daeff4e2eb600b365c5df68e1754324`。父已确认作者停写。本轮结论：**发现一项已确证的本步失败原子性缺陷，交原作者修复；范围内未发现其他新的正确性问题。** 本轮未 commit/push、未派代理，未合入或提前审查 giants2，未实现 5Y。

## R1-F1：真实第二位乘客失败后，第一携带者的属性会话没有回滚

**级别：S2，本步验收前应修复。**

位置：`src/engine/Core/Game.ts:13787–13790` 新增失败回滚与 `:13812–13814` 的挂接/退休顺序。直接依赖是 `src/ext/runtime.ts:1735` 的 `retireEdibleActor`：它删除 `statSessions` 的 actor 映射并调用 `unbindStats`。Runtime 的 `:1013–1018` 事务恢复了 creatures 和 extensionHooks，却未恢复这两个派生关联；新增 Runtime 完整对象图检查点也看不到 WeakMap 内的会话。

触发：两位真实携带者各携带一个合法乘客，同批行政退休。允许第一乘客的列表插入及显式挂接都成功，第一携带者已执行 `retireEdibleActor` 后，在第二乘客实际挂接时抛异常。外部探针按第二乘客对象身份注入故障，而非按调用次数。

复现观察：挂接 ID 顺序为 `[36,36,37]`，第一携带者 ID34，第一乘客 ID36，第二乘客 ID37。拒绝后完整对象图差异为空，乘客旧位置、索引和来源 revision 恢复；但 `statQuery(first) === beforeQuery` 为 false，旧查询执行 `value(34,'native.max-hp')` 报 `StatValidationError: ext.stats.errors.source`。同一存活携带者 `nativeStat(first,'native.evasion')` 从 **500 变为 0**，其 extensionHooks 仍在。世界表面复原，却丢失扩展属性规则和共享查询资格；后续依赖该 actor 的共享属性计算会失效。不是仅有对象身份差异，也不是四项既知 spatial 基线失败。

作者新增 `src/test/giants2_foundation.test.ts:341–344` 的“第二位乘客”回归在第二次 `attachCreature` 调用抛错。`Game.ts:13812` 的 `target.push` 经 `MonsterLifecycle.ts:64` 自动挂接，紧接着又显式挂接，前两次调用都属于第一乘客。该测试实际在第一携带者解绑之前失败，因此 `:352` 的查询身份断言不能证明所称的第二乘客失败回滚。

修复要求：失败恢复必须包含已退休携带者的原生属性绑定、Runtime 属性会话 actor 映射及相关派生状态，保持旧查询可用和真实规则值。把故障定位到第二乘客对象，断言第一携带者确实走过退休，再检查完整图、离图会话、规则值及所有权。只恢复序列化摘要或再调用一个因 creatures 已恢复而提前返回的 `attachCreature`，不足以关闭此项。

外部探针：`/private/tmp/brogue-commander-20261009-g2-foundation/review-r1.probe.test.ts`；配置同目录 `review-r1.config.mts`。按下文命令用 `-t '真正第二'` 可只复现本项。

## 审查范围及其余结论

已读 AGENTS.md、HANDOFF、development、architecture、底座任务书及最终14项报告、外部 READY 和原独立 acceptance 合同。只读核对三个生产差异、新测试、套件登记及本步遗留登记；父同期排期文档保持原状。

- **SDK01：** 来源保留按本次 GC 后目标根过滤，奖励结算仍在摘要删除之前；未改 growth 校验或增加回放 collect。新增完整扩展状态一次/多次收集、burning/displacement 活目标保留已死盟友及6点玩家分成、存读和一次收据均通过。既有真实 POISON 施法、来源死亡、生产毒伤和80:20/关系失效回归整文件独立通过。最后补入的原点布景通过公开 wait、真实 poison 终结、原指纹录制与回放，未改写 manifest/链摘要。新增 burning/displacement 的终结是显式来源诊断，不能单独冒称自然火伤/坠落路线；既有因果测试实际有火焰 bolt 和位移地形死亡入口，作者已运行，本轮只读核对，不重复整批。
- **SDK02：** 非 bundle-busy 玩家在 NPC 前扣旧 elapsed；bundle-busy 仍由 scheduler 倒计时，classic 无 scheduler 保留原扣时位置。新增50tick同边界破韧/动画拒绝输入/存读续录回放14项批通过；scheduler整文件独立通过，含 playerWasBusy、同边界顺序、无 scheduler 的原生顺序。另以真实公开 combat attack 建立玩家 bundle，在20tick NPC决策施加生产破韧，动画开/关均实测未来50tick恢复、总客观推进70tick、无锁/异常并可存读。parry/dodge 动画对等两项独立通过。未发现新的时间镜像缺陷。
- **SPATIAL：** 已检查整足迹安全地形、占位/休眠预留、movement region、原层选择和来源通知。正式成功及尾格失败回归14项批通过；外部同批两个落点重叠探针在第一写入前拒绝，完整图保持。真实第二乘客晚期失败仍有 R1-F1，因此空间源码守卫通过及完整图审计通过不能作为真实写口安全的最终结论。
- **冻结与范围：** 九文件 `worldSdk`、`edibleSdk`、`worldEdible`、`kindKnowledge`、`actorNeeds`、`stats`、`testing/worldHarness`、`testing/forageHarness`、`testing/fixtures/forageFixture/index` 均与 HEAD 无差异；giants 生产、既有 fixture/黄金和 U03 登记无差异。实际生产仅 Game/TimeCoordinator/Runtime；新测试已登记常规套件，无新增 Game 持久字段、版本调整或旧断言修改。
- **trace 裁决：** 本步没有重录或忽略摘要叶。UR2/UR3 和 drift 的作者实际通过仅按最终报告引用；UR4 一项仅52个 chainDigest 叶不同及其开工反事实、spatial differential 四项、i18n 一项是父已确认的基线遗留，本轮不重复封存/采证，也不据其原失败认定本步新问题。无 manifest 篡改或兼容旧 foundation 长录像的主张。

## 本轮必要窄验证

仓库根执行。统一环境：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
```

实际 Node `v24.19.0`。全部 Vitest 单 worker、串行；CE 缺源提示保留，本轮选中项无 CE 真跳过。下列通过数互不累计为新总数。

| 实际命令（省略下表共有的 `--maxWorkers=1 --no-file-parallelism`） | exit / 结果 |
| --- | --- |
| `npx vitest run src/test/giants2_foundation.test.ts` | 0；14通过 |
| `npx vitest run src/test/phase3a0_scheduler.test.ts src/ext/modules/growth/tests/ext_growth_sources.test.ts` | 0；44通过 |
| `npx vitest run src/ext/modules/combat/tests/combat_animated_defense.test.ts -t 'identical animated'` | 0；2通过，11仅过滤 |
| `npx vitest run --config /private/tmp/brogue-commander-20261009-g2-foundation/review-r1.config.mts`（当时仅两个空间探针） | 首次与诊断补充后均1；各1通过/1失败；确证R1-F1，同批重叠预检通过 |
| 同外部配置 `-t SDK02`，首次 | 1；2失败/2仅过滤；探针误用命令计数 currentTick 作为 phased elapsed，所有锁/镜像断言通过；未登记为生产缺陷 |
| 同外部配置 `-t SDK02`，改用客观环境门倒计时口径后 | 0；2通过/2仅过滤；动画开关均总推进70tick并可存读 |

外部配置的准确共享命令是 `npx vitest run --config /private/tmp/brogue-commander-20261009-g2-foundation/review-r1.config.mts --maxWorkers=1 --no-file-parallelism`；过滤参数如表。当前探针含四项，复现R1-F1加 `-t '真正第二'`，只跑忙碌时序加 `-t SDK02`。首批原失败与后来补充诊断分别保留，不把前者改记为全绿。未重复作者32文件/完整 gate、boundary/types/build/drift。

九冻结及既有 fixture/U03/giants 的两条 `git diff --exit-code HEAD -- ...` 均exit0；`git diff --check` exit0。准确检查命令与结果摘要在外部 `results/review-r1-summary.md`，不存大原始材料或版本副本。

覆盖边界：完整组合/删除、自然长录像、所有身体与离层边界、浏览器/真机及最大负载仍未独立验证，不新增为已确证问题；延续既有后续范围。本轮只需原作者处理 R1-F1 及其失准回归，不扩到基线遗留或巨兽数据。

**R1完成：已停写并退出。父在同轮接续原作者修复；本审查者不自行修复或继续下一轮。**


# giants2 前置底座独立审查 R2（最后一轮）

2026-10-09；仓库 `BrogueJS-p5`，分支 `ext/phase5`，HEAD `02ef819f1daeff4e2eb600b365c5df68e1754324`。在 fix-r1 作者 READY、停写退出后启动。已读 AGENTS 与三份必读、底座任务/报告/R1发现、`fix-r1.READY.md`。本轮仅复核 R1-F1 关闭及其修复新引入问题，未全量重审 SDK01/SDK02、基线六失败、giants2 或 5Y。

**结论：R1-F1 已独立复核关闭；本轮限定范围内没有新增已确证正确性缺陷。** 下面的窄验证不代表全量验收通过；没有新增需交作者修复的 R2 条目。

## R1-F1 关闭证据

- 正式 `giants2_foundation.test.ts` 的方形/原生单格两例按第二乘客对象身份抛指定异常。故障点明确检查第一携带者的 `retireEdibleActor` 已执行完成、其组件及 extensionHooks 已移除、旧查询 `native.max-hp` 报 `ext.stats.errors.source`，闪避从500降为0。故障确实发生在第一携带者退休后，旧挂接调用计数误判已消除。
- 回滚后原 carrier/player query 身份保持，旧 max-hp 查询可用且值等于失败前真实值，`native.evasion` 恢复500；共享缓存对象/大小、原生修订、Runtime摘要、完整世界对象图、乘客位置/来源修订/索引、两个携带关系、根所有权及双RNG保持。原生单格失败后立即存读通过；两种布景移除故障后均可真正退休并存读两乘客合法落点。方形携带的既有未开放存储合同没有改变。
- 原 R1 `review-r1.probe.test.ts` 未修改，按 `-t '真正第二'` 独立运行通过。它继续以第二乘客对象身份选故障，不依赖正式新测试的挂接计数。
- 追加外部 R2 窄探针：先为第一携带者建立独立原生查询，再挂接共享会话；故障时确认其独立原生查询确实被再次使用。回滚后、任何新查询之前，用独立审计器逐对象检查共享 pipeline 和既有独立 pipeline 的完整缓存图（含诊断计数、Map/Set、host及引用身份）及整个 Game 图，差异均为空。Runtime、pipeline及旧 query 都保持原对象。失败后的装备预览仍等于失败前投影；对原库存/装备调用真实失效通知，原生 revision各递增一次，装备新值与先前真实预览一致。

## 修复实现核对与范围

`Game.ts:13789–13791` 在退休前捕获属性会话，异常时先恢复 Runtime/原生图，最后恢复离图属性会话。`runtime.ts:1738–1744` 恢复同一个 StatSession、actor Map、ledger、dirty/物化/来源/查询缓存和控制状态；`NativeStatSources.ts:27–43` 恢复 WeakMap 中的原绑定、修订、环境、装备预览关联及原生查询缓存；`ItemStatInvalidation.ts:8–12` 恢复原回调关联。检查点恢复为原地恢复，没有新建世界、Runtime或pipeline，没有用 save/load、重新attach或延后第一携带者退休来伪造旧身份。新能力仅由可信 Game 退休入口调用，未加入模块上下文。

九冻结文件全部与 HEAD 无差异。真实协议/格式文件、giants生产、既有fixture及U03登记同样无差异；Game/Runtime差异中也没有格式版本调整。foundation13、whole-run6、recording4/origin2、worldSdk1/edibleSdk1保持，无新Game持久字段、黄金重录、manifest改写或新增公开协议。本轮不修改作者报告、父状态文档、生产或正式测试。

## 本轮真实窄命令与结果

仓库根执行，PATH前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实际 `node --version` 输出 `v24.19.0`；`NODE_OPTIONS=--max-old-space-size=3072`。全部 Vitest单worker、文件串行。下表每条命令均含 `--maxWorkers=1 --no-file-parallelism`，各批通过数不累计。

| 实际命令（表内省略上述共有参数） | exit / 结果 |
| --- | --- |
| `npx vitest run src/test/giants2_foundation.test.ts -t '真正第二位'` | 0；2通过、0失败、13仅过滤；3.46秒 |
| `npx vitest run --config /private/tmp/brogue-commander-20261009-g2-foundation/review-r1.config.mts -t '真正第二'` | 0；1通过、0失败、3仅过滤；2.27秒 |
| `npx vitest run --config /private/tmp/brogue-commander-20261009-g2-foundation/review-r2.config.mts` 首次 | 1；0通过、1失败、0过滤；2.31秒；探针漏传装备预览所需 strengthRequired，尚未进入故障事务 |
| 同外部R2命令，修正前提后 | 1；0通过、1失败、0过滤；2.57秒；所有图/缓存/失效通知断言已通过，末尾误以附魔2直接得到8，忽略真实力量修正而实际为14 |
| 同外部R2命令，最终 | 0；1通过、0失败、0过滤；2.32秒；末尾改与失败前已计算的真实装备预览值比较 |

两次外部探针开发错误均保留原日志，未登记为生产缺陷，未修改生产或正式断言来通过。探针图审计移到故障spy注册后，避免诊断自身方法注册进入被审计的写集。Vitest显示的“skipped”均为 `-t` 排除项；本轮选中项无真实skip或CE缺源跳过，CE缺源提示保留。

另外实际执行：九冻结的 `git diff --exit-code HEAD -- <九文件>` exit0；真实格式与范围文件的对应diff exit0；`git diff --check` exit0。完整精确argv、exit及通过/失败/过滤摘要在外部 `review-r2-commands.jsonl`，日志在同目录 `review-r2-identity.log`、`review-r2-original.log`、`review-r2-derived-premise.log`、`review-r2-derived-expectation.log`、`review-r2-derived.log`。前期定位曾对不存在的协议文件名做rg而exit2，随后发现并核对真实文件；该定位命令不算冻结或格式验证。

## 覆盖限制与退出

本轮故障注入是最小诊断布景，证明指定晚期失败事务及派生会话恢复；没有穷举全部身体/离层边界、任意第三方故障或复杂嵌套会话。完整组合/删除、自然长录像、CE全量、浏览器/真机及最大负载继续按既有范围留后续/5Z，覆盖限制不冒称已确证缺陷。未重跑作者32文件、六文件整批、完整新增15项、boundary/types/build/drift或基线六失败，作者既有结果仍只按作者报告引用。

**R2完成：报告及外部 `review-r2.READY.md` 已交付，立即停止写入退出。无自行修复、代理、commit/push、R3或下一步骤。**

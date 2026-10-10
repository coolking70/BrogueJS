# 阶段 5 整体交叉只读审查

审查日期：2026-10-11。输入：`ext/phase5-xreview`，HEAD `59b9ba691daf66819eeea0299a0539f3641ad208`，已包含 5Z 实现 `0ec7c56`。初始工作树干净。

**发现 3 项：2 项 S1（合法生命周期转换后不能保存，其中一项还使袭击无法结束），1 项 S3（居民离线 crafting 永久少记完成批次）。** 全部有当前生产代码上的定向复现。没有修改生产代码、现有测试、守卫、黄金或协议；本报告不是阶段 5 整体验收通过裁决。

严重度口径：S1 为破坏正常保存/主要进程推进；S2 为显著玩法或经济错误；S3 为不破坏实物及保存的持久记账错误。以下按严重度排列，编号供修复追踪。

## 范围与证据口径

按项目入口核对 AGENTS.md、HANDOFF、development、architecture、ext README、阶段 5 总任务及 5A 合同，并交叉阅读 5A1–5A4、5B、5C1、5D1、5D2、5E1、5Y、5Z 的报告/审查记录。5B、5D2 无同名独立 `review-findings` 文件；5D2 的修复及复核记录在报告内，5Z 对应 `phase5z.review.md`。历史已关闭发现、明确接受的规则和后续阶段范围没有重报。

本轮只在当前 xreview 工作树读源码、在 `/private/tmp` 运行小型受控探针；没有访问或操作 `BrogueJS-p5`。使用 Node **24.19.0**，`NODE_OPTIONS=--max-old-space-size=3072`；每次 Vitest 都是 `--maxWorkers=1`，各批串行。未跑 npm 全套、全 ext、生成/漂移、性能大场景或物理删除矩阵；没有获取 CE。两个现有测试批次启动时提示 CE 缓存缺失，所选用例不依赖 CE。

探针使用真实模块、实际 Game、真实保存校验和既有场景辅助函数；营地/床/箱/订单通过公开命令付费建立。辅助函数会准备地形、物资和坐标，不是自然游玩录像。XR-01 额外直接设置一次已赚劳动量；XR-02 使用真实原生结盟入口并快进世界时钟；XR-03 使用真实下楼及离线补结，不注入劳动、票据完成数或模块统计。具体限制逐项列明。

## XR-01 / S1：完成订单失去活票据后，拆除目标箱遗漏订单引用

**跨步骤：5A3 结构销毁 × 5C1 箱子所有权 × 5D2 完成订单/终结票据 × 5A1 保存校验。** 最小启用集只有 `settlement`；删除 crafting 或 foraging 不会消除问题。

位置（行号对应上述 HEAD）：

- `src/engine/Map/StructureWorld.ts:1443`–`1469`：先结算居民；处理 pending output 回退、田地订单、旧岗位及**活票据**；没有按箱/工位引用直接遍历已完成的生产订单。
- `src/engine/Core/ResidentOrders.ts:531`、`:579`：最后产物交付后退休票据，`o.ticketId = null`，保留 `production.sourceId/destinationId/stationId` 及 completed 订单。
- `src/engine/Core/ResidentOrderValidation.ts:40`、`:56`、`:86`：先要求箱/工位仍存在，再允许 completed 订单无票据。这一严格校验正确暴露了 writer 留下的坏引用。

复现（脚本用例 `XR-01`）：

1. 建立一个有真实居民的营地，再付费建一个非供给箱，命令成功。
2. 公开下达一批 `settlement.hunt`，目的地选该箱；受控设置 `paidTicks=1000`，推进并结算两个经济边界，使生产及下一周期交付完成。
3. 确认订单 `stopReason='completed'`、已无活票据，**此时保存成功**。
4. 公开执行 `dismantle`，命令成功、箱已不存在，但 completed 订单仍引用该箱。
5. 再次保存，抛出 **`C5_BAD_REFERENCE: box`**。

影响：正常“交付完成→拆旧箱”的操作把合法活局变成不可保存状态。这里没有丢失输出的证据，实际缺陷是保留了非法订单引用。`destroyComponent` 也是烧毁、地基失败和挖毁的共同清理路径（`:531`、`:539`、`:1693`、`:1746`），因此同一引用遗漏也影响这些销毁入口；本轮直接实测的是公开拆箱，未另做火焰自然路线。已完成的工位订单同样缺少直接清理，从代码可见风险，未将未实测变体另计发现。

为什么单步测试容易漏：现有 `resident_production_codec.test.ts` 覆盖**尚待交付**或提前取消时拆箱；那些情况下活票据或 pending output 还能引导清理。恰在最后交付、票据退休之后，结构清理失去索引。

修复方向：共同销毁路径应按被删的箱 ID、工位 ID、田地 ID 清理所有相关 resident production orders，覆盖无活票据的 completed 状态；保留已交付物品的唯一所有权和未到期产物的原交付期限。不要放宽 `campBox`/存档引用校验。回归至少覆盖 source/destination 相同与不同、完成前/交付后、拆除/烧毁；完成后清理不得再次退款或产物化。

## XR-02 / S1：袭击者结盟后饥饿离队，袭击账本仍要求已退休实体存在

**跨步骤：5E1 袭击名册 × 原生支配/结盟 × 5A4/5B 同伴饥饿和非致死退休 × 离场被围冻结 × 保存。** 最小启用集 `settlement + foraging`。

位置：

- `src/engine/Core/SettlementRaids.ts:131`–`151`：收尾时，活盟友视为已解决；实体消失后却只承认 `defeatedIds`。
- `src/engine/Core/ActorDeparture.ts:71`–`105` → `src/engine/Core/Game.ts:14009`–`14039`：非致死退休删除实体及相关根，没有通知袭击生命周期。
- `src/engine/Core/SettlementRaids.ts:563`–`573`：名册成员不存在且未记为 defeated，即报 `raidActor`。已有 `recordRaidFall:627`、`recordRaidDeath:638` 不能代表非致死退休。

复现（`XR-02`）：

1. 在真实营地推进至警告/袭击，公开 wait 物化两名真实敌人。本次名册是 kobold 52、rat 53。
2. 对其中一名调用原生 `g.becomeAllyWith`，真实 foraging 同伴需求建立；另一名仍敌对，所以袭击还 active。**此时保存成功**。
3. 不喂养，快进 392100 tick 并调用实际需求结算，再推进 2100 tick 结算可见离队宽限；实体 52 真正从 `departureActors()` 消失。
4. 用实际 `killMonster` 杀死另一名敌人，调用实际袭击收尾。
5. 结果仍是 `phase='active'`，`actorIds=[52,53]`、`defeatedIds=[53]`；52 的 `departed=null`，无实体。保存抛出 **`C5_BAD_REFERENCE: raidActor`**。

证据界限：这是实际生命周期的受控组合复现；没有走完整支配魔杖 UI/命中路线，也没有用数千次 wait 模拟饥饿。没有改写袭击名册、伪造死亡/离队条目。初版探针只推进到饥饿结算时误以为可见宽限已经结束，实体仍在；补足实际宽限后才得到上述产品失败，初版布景断言失败不计发现。

影响：没有敌人可供继续击杀，却不能结束该袭击，且不能保存。冻结入口仍以 active 事件为依据，因此离场后还会继续占用被围状态/袭击名额，影响经济恢复（该后续影响是代码路径推导，未另跑离层复现）。这是 5E1 已修复的“幸存坠层”之外的另一种实体生命周期终点。

修复方向：在权威非致死退休事务中结清袭击成员，保留可验证的原因/时点；事件完成条件和存档校验使用同一语义。不能把饥饿离队伪装成击杀、发死亡奖励，或简单接受任意缺失名册实体。已有 `departed` 专指可验证的下一层幸存坠落，不能无条件复用它绕过 R2 的伪造坠层防护。维护者需决定采用明确的非致死解决记录，还是在结盟时就不可逆地退出有效名册；后者必须同时明确后续失去盟友状态的处理。

回归应保留“另一名敌人尚未解决”这一前提，并覆盖可见宽限退休、离队在视野外立即退休、最后一个敌人结束后无奖励误发、保存/读回及公开离层恢复；另保留伪造缺失实体和伪造 `departed` 的拒绝测试。

## XR-03 / S3：居民一个离线 epoch 完成多批时，crafting 累计只加一

**跨步骤：5D2 聚合居民劳动 × 5A2 工作事实协议 × crafting 状态参与者 × 持久模块摘要。** 最小启用集 `settlement + crafting`。

位置：

- `src/engine/Core/ResidentOrderEconomy.ts:79` 起：一个 epoch 的 while 可合法完成多批，逐批递增 `completedBatches/lastCompletionOrdinal`。
- `src/engine/Core/ResidentOrders.ts:769`、`:815`：袭击生产压力使用批次数差量，但 crafting 只收到一次最终累计数的 `craft-batch` 事实。
- `src/ext/modules/crafting/state.ts:128`–`132`：沿原“每批一条完成事实”的消费方式，每条事实仅将 `totals.craftBatches` 加一。

复现（`XR-03`）：

1. 真实居民营地、公开放置 crafting table；将 24 木材公开存入本营供给箱，指定四批 `crafting.make-chest-kit`（每批 500 有效 tick）。
2. 两次公开 wait 后，经真实 `stairs_down` 离层；快进 4000 tick，公开 wait 触发离线补结及到期交付。未修改生产劳动量或任何结果计数。
3. 供给箱实际得到 **4** 套；保存成功。完成事实的累计数依次为 **1、3、4**，相应 tick 为 **5000、6000、7000**，说明第二个 epoch 完成了两批。
4. crafting 的 `totals.craftBatches` 却是 **3**。正确计数断言 `3 === 4` 失败。

影响：物资消耗、输出及票据完成数在该案例中正确，持久 crafting 累计少一；加载/摘要只能忠实保存错误值，不会自动修正。未发现该 totals 当前驱动奖励或战斗，也未证实用户面板展示它，故定 S3，不宣称复制物品或经济损失。随着多次离线订单，少记会累计。

对照与排除：两批仅用连续公开 wait 的在线场景得到两份、累计两批，保存正常；两批离线也可能恰好跨两个各完成一批的 epoch，不能击中缺陷。曾在四批离线只推进 3000 tick 时检查过早，最后一批仍在下一周期交付队列，实物只有三份；本报告采用补足原期限后的四份结果，不把交付延迟报为丢物。

修复方向：优先保持既有每批事实合同，按本 epoch 实际完成批次发布唯一连续 ordinal/累计数的完成事实；或者明确引入并验证聚合差量合同，统一所有消费者。不可直接每次加 `fact.completedBatches`，因为它是该票据累计值，后续事实会重复计算。新增存读/seek 测试应比较实物、终结票据、模块 totals 和事实 ordinal，不能仅比较两次相同的错误摘要。

## 已核实无问题的范围

这里的“无问题”仅指表内明确路径，不覆盖上述三个反例，也不表示所有组合穷尽。

| 交叉面 | 当前核对结果与证据强度 |
| --- | --- |
| 袭击 × 离线生产 × 被围暂停 | 静态核对 `campEconomicTick/excludeRaidTime` 与 `ResidentNeeds` 的同一经济时钟；暂停营地不进入需求/订单结算，恢复不追补排除时间。定向选择现有 S1/S2、S3、另一营地继续生产等用例的批次通过。正常死亡/幸存坠落闭环与 XR-02 非致死退休缺口分开。 |
| 采食 × 同伴饥饿 × 居民需求 | 招募的 Yes 移交需求所有权、No 无写入；同伴根与居民需求互斥。真实楼梯缓存及 pending fall 仍由 home 供粮的现有用例在此次定向批次通过；不能由此推论袭击身份也完成移交。 |
| 结构 × 火焰 × 遇火处理 | 静态核对 outer DF 后排队、FIFO/实体去重和销毁共同入口；现有 same-cell/cross-cell FIFO，以及真实投掷到地火/灶台的身份、数量、录像闭环用例通过。strict roast 的既定政策未作为缺陷；订单生命周期销毁缺口列 XR-01。 |
| 巨兽 × 营地 × 坠层 | 当前名册识别使用实体/身体身份；`Game.restoreManagedPending` 和实际坠层调用 `recordRaidFall`，未见同层虚拟第二份怪物。现有“巨兽组邻接普通袭击”和“原生幸存坠层退出有效成员”的选择批次通过；未重跑全部新巨兽自然路线。 |
| crafting × 居民订单 × 箱归属 | 公开接收的 escrow/输出/退款预留均由 world5 唯一根承载。在线两批对照通过，XR-03 离线四批实物及保存也通过；模块累计错误另列。completed 后撤箱不能由进行中订单的正确回退推导，另列 XR-01。 |
| 录像 v4 / 异步摘要 × 存读/seek | 定向重跑现有 settlement、settlement+combat、全安装模块的 async save/续录/replay/非单调 seek，以及跨 128→129 已完成消息重复回包用例，通过。静态核对冻结字节、代次隔离、独立 full 比较及有序发布。这里用 Inline/测试 transport，不冒充新做真实浏览器 Worker；语义坏状态仍可能被正确散列，不能用摘要一致否定 XR-01–03。 |
| 长局及 8 营/64 人 | 静态核对 camp slot 0…7、全局居民 64、单营 16、有限订单 32 周期、每 owner 128 事实和保护待交付产物的 64 终结票据裁剪。未新跑最大场景或性能。5Z 已有 8 营/64 人/112 箱/7168 Item 根与 3 命令存读回放证据，以及独立 4 营/64 人十亿 tick 需求案例；这是历史证据，不能称为本轮验证“最大营地长期袭击+生产+所有模块”的组合。当前未从静态核对得出额外确证缺陷。 |
| 模块删除组合降级 | 核对真实注册/软配方目录/原生后备与没有跨包生产私有导入的路径；无 crafting 时 settlement 基础食物不依赖 crafting，无 foraging 时居民仍由原生 FOOD 供粮。缺所需 manifest 的旧档/录像应严格拒绝，不能称为自动迁移。引用 5Z 15 真实物理布局、29 删除 smoke＋正常 128 的既有结论；本轮未物理删除，不扩大到其余 112 布局。XR-01 仅 settlement 即有，XR-02/03 分别由相应两包组合触发。 |

## 实际命令与结果

以下 Node PATH 前缀用于所有测试；每批结束后才启动下一批。仓外原始日志不提交，保留可重跑脚本及关键结果。

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072

node docs/ext/phase5-xreview.repro.mjs

node node_modules/vitest/vitest.mjs run \
  src/ext/modules/settlement/tests/settlement_raids.test.ts \
  src/ext/modules/settlement/tests/resident_foraging_integration.test.ts \
  --maxWorkers=1 \
  -t 'S1/S2:|S3:|S1 other camp:|existing giants group|R1-F1 native surviving fall|No is pure|escort cached|pending fall'

node node_modules/vitest/vitest.mjs run \
  src/test/ext_fire_contact_runtime.test.ts \
  src/test/ext_recording_async.test.ts \
  --maxWorkers=1 \
  -t 'same-cell id ordering|real thrown stack landing|round trips real Game module composition|R1-F1 ignores completed messages'
```

| 运行 | 结果 | 耗时 | 口径 |
| --- | --- | --- | --- |
| 交付的外部探针四项 | exit 1；XR-01/02/03 三败，在线对照一过 | 11.77s | 三个断言要求正确行为；失败用于复现缺陷，未改成迎合现状的通过断言。独立临时 config 只发现外部这一个文件。 |
| 现有经济/归属两文件定向 | exit 0；8 passed、27 名称过滤未运行 | 36.38s | 不是这两个文件全量通过；不是新增 skip。 |
| 现有火/录像两文件定向 | exit 0；7 passed、40 名称过滤未运行 | 40.81s | 不是两文件全量或浏览器验收。 |

先前诊断还运行了各单项及一次人工累计 1000 劳动的双批实验；与最终四项重叠，不累加成新覆盖数。源码未回退，因此没有伪称“单变量生产反事实已完成”；本轮没有修改旧测试前提，也没有重录黄金。5Z 历史“首次完整 npm exit 1、相关修复复测而无第二次完整 npm exit 0”保持原结论；指挥进程此刻的完整测试结果不在本报告裁决内。

复现文件：[runner](phase5-xreview.repro.mjs)、[探针源](phase5-xreview.repro.ts)。runner 从自身路径定位仓库，将探针复制至新 `/private/tmp/phase5-xreview-*`，固定单 worker/3072 MiB，可加 `-t XR-01` 只跑一项。不注册进正式 test-discovery、不替换现有 config、不改生产文件。只读审查所新增的仓内文件仅这两份脚本和本报告。

## 建议交给指挥进程的修复批次

1. **批次 A：结构销毁与 completed 订单（XR-01）。** 集中修改共同引用清理，先补交付后拆箱/销毁工位反例，再跑居民订单 codec、结构火焰清理和 live/pending output 防重复回归。可独立先修，避免日常整理营地触发不可保存。
2. **批次 B：袭击非致死终结（XR-02）。** 先确定有效成员退出语义，再接入权威退休事务并同步严格校验；连同原 R1 坠层、R2 伪造 departed 防护及被围经济恢复一起验。不要仅给 `raidActor` 放行缺失实体。若新增持久字段/状态，按项目格式规则安排升版与相应录像捕获，不做旧档迁移。
3. **批次 C：生产完成事实（XR-03）。** 统一多批聚合与逐批消费者，补在线/离线、跨日/暂停恢复、单批/多批对照；校验物资、累计数和唯一 ordinal。修复可能改变事实序号、模块摘要及黄金链，须单变量归因并按原捕获入口重录登记，不能只更新期望数字。

三批可分别形成小修复提交；共同的最终定向验收再覆盖 save/load、异步完整切点及 seek。完整门禁由指挥进程统一安排，本审查不另起竞争性的全量测试。

需维护者裁定：**XR-02 的非致死成员退出合同及其格式影响**；是否将 **XR-03 的 S3 记账修复纳入此次收口**。XR-01/02 建议在阶段 5 发布裁决前关闭。浏览器/真机与最大世界长时间混合玩法继续使用既有人工清单，未因本报告而获得通过结论。

## 交付状态

报告和两份脚本已生成。按授权尝试只暂存这三个文件时，`git add` exit 128：无法创建共享 Git 目录 `/Users/coolking70/Documents/同步空间/BrogueJS/.git/worktrees/BrogueJS-xrev/index.lock`，报 `Operation not permitted`。当前沙箱不允许提权，因此未提交、未执行 push，也未使用其它方式写远端；没有推送不含本报告的旧 HEAD。

待有相应文件权限的维护者仅提交本报告及两份 `phase5-xreview.repro.*`，提交信息末尾保留用户指定的 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`，再单独执行 `git push -u origin HEAD`。

# combat2 维护者验收审查

结论：**需底座修复后合入**。当前 `ad05458` 不可直接合入。五招数据与 UI 差量未发现偏离任务书的生产实现；dot 的五项失败全部复现，分别落在三个既有底座根因。另发现一个 combat 旧测试及两个共享旧测试的 jackal 前提失效，均已完成单变量反事实。底座修复后仍须修正这些前提、补齐自然与浏览器证据，并在最终集成候选验收；本结论不是自动合入许可。

审查日期：2026-10-11；行号均指原候选，补丁副本不混入候选通过数。

## 候选与方法

交付 `ad05458`，派发起点 `5782e73`，代码基线 `59b9ba6`。先读 AGENTS.md、HANDOFF、development、architecture，以及任务包、dot 报告和配置手册。独立核对 37 条变更路径均属批准白名单，未改共享代码。原表夹具与 git 中真实基线数据/locale 深等；独立提取任务包编译器，以真实旧包重装配，交付 definitions 完整深等。

本轮只读审查生产/测试，仓库只新增本报告。诊断副本、日志、补丁与回归草案位于 `/private/tmp/combat2-acceptance/`；dot 测试自己写出的原始证据位于 `/tmp/combat2-evidence/`。未操作 BrogueJS-p5，未 git 提交、推送、合并或 fetch。读取本地 `origin/ext/phase5` 为 `4856505e2c48f37586ca016af2d59f443b79ec9d`；六项任务书已用 `git show` 读取；该 ref 相对 59b9ba6 的相关底座生产文件无差异。因此下述三项也存在于这个已发布 phase5 基线。正在其他工作树实施的未提交修复不在本审查范围内。

Node `24.19.0` 的 runtime bin 放 PATH 首位，`NODE_OPTIONS=--max-old-space-size=3072`。所有 Vitest `--maxWorkers=1 --no-file-parallelism`，各批次串行。按用户本轮明确要求执行 combat 全部 47 文件，包含旧 64 组合；没有执行全部 npm/test:ext、128 组合或物理删除。当前树无 CE 缓存，最终实际 skip 数按日志列出，不把无 CE 提示当作已执行 CE 门禁。旧版本兼容负例使用测试内真实旧 loader/factory 重建路径；未设置依赖 dot 外部旧档的 `COMBAT2_PREIMPLEMENTATION=1`，也未设置任何重新捕获 trace 的开关。

## 五招、UI 与影响范围

| 招式 / NPC | 体力 | 从提交起的释放刻 | 恢复 | 几何 | definitions.json 行 |
| --- | ---: | --- | ---: | --- | ---: |
| 沉锚击 / zombie | 8 | 140 | 90 | 前扇三格加正前第二格 | 641 |
| 回潮扫 / goblin | 7 | 100、180 | 70 | 正面扇形后反面扇形 | 812 |
| 逐隙刺 / jackal | 6 | 80、140、200 | 60 | 正前第一、二、三格分段 | 1080 |
| 掷影击 / monkey | 5 | 120 | 80 | 正前第二、三格同时；第一格为空 | 1285 |
| 应隙斩 / toad | 3 | 30 | 50 | 正前一格 | 1392 |

表路径为 `src/ext/modules/combat/data/definitions.json`。UI 核对位置：`src/ext/modules/combat/ui/attackPresentation.ts:5`、`CombatAttackDialog.vue:26`、`:47` 与 `CombatAttackBar.vue:52`。八向坐标与完整字段以独立编译深等为准，不只抽查表中摘要。

- 五招全量装配与权威表一致：费用 8/7/6/5/3；释放刻分别 140、100/180、80/140/200、120、30；恢复 90/70/60/80/50。精确八向整数偏移、五种单招 NPC 绑定、玩家八招顺序均保持；旧三招、四 profile、三绑定及资源/防御/篝火对象保留。
- 五招只是当前 SDK 的数据实例；伤害仍 native-melee，逐段 locked-world，part 去重、whole-group 排除、line-of-effect 裁切。没有 HP 倍率、位移、弹体或新反击姿态；NPC 首段命中范围决定起手，既有生存/施法等优先级不变。
- 本次生产差量只有 definitions、locale、CombatAttackBar、CombatAttackDialog 和 attackPresentation。显示 helper 只读已校验本模块静态数据；没有 Game 写入、RNG 或新事件监听。确认仍经原 DialogService → executeCommand，选择/返回/取消不推进机械状态。
- 文案明确逐隙刺原地延伸、掷影击无弹体无弹药且不在首个生物停止、应隙斩独立付费且弹反后手动选择、不保证命中。HUD 不借静态表猜未知敌招名。44px 最小控制与横向滚动有源码/组件证据，实际浏览器布局与触摸未由本次只读审查关闭。
- module/rules 1.6.0、state4 及共享协议保持；新 fingerprint 正确区分旧 combat 输入。combat 关闭时没有新增公共调用路径；字节隔离、无模块组合和 drift 是本轮零影响证据，不冒称完整 128/物理删除已验。
- 旧测试前提修订限目录精确数量/ID 与玩家默认 profile；未削弱行为断言。dot 原反事实日志不在本地，不冒称本轮重跑了 dot 的实验。

## 原候选实测

| 门禁 | 结果 | 用例/文件 | 用时 |
| --- | --- | --- | ---: |
| boundary | exit 0 | 边界检查通过 | 2.47s |
| vue-tsc -b | exit 0 | 类型检查通过 | 8.83s |
| npm run build | exit 0 | 生产构建通过 | 12.13s |
| combat 全目录 | exit 1 | 942 过 / 6 失败；47 文件中 42 过 / 5 失败 | 1740.08s |
| 报告受影响共享回归 | exit 0 | 266 过，15 文件 | 97.62s |
| drift | exit 0 | 14 过，7 文件 | 151.33s |

这些批次实际 **0 skip / 0 todo**。无 CE 提示不代表运行了 CE 专属档。combat 全批包含 13 个 combat2 文件、旧 combat 回归和完整旧 64 组合；旧回归未按 dot 的选择范围省略，因此多发现篝火前提失败。dot 自有 155 项中的 150 过 / 5 失败在本轮重现。原报告的 22 个旧 combat 文件已被全目录覆盖。

共享 15 文件均位于 `src/test/`：`phase3a0_actor_action`、`phase3a0_scheduler`、`ext_actor_actions_root_world`、`ext_stats_native`、`ext_stats_pipeline`、`ext_stats_runtime`、`ext_stats_review`、`phase4a3_body_display`、`ext_world_display`、`ext_recording_v4_snapshots`、`u_03_whole_run_snapshot`、`p1_30_i18n_gate`、`u24_hardcoded_text`、`repo_hygiene`、`test_suite_membership`（均 `.test.ts`）。

可重跑命令：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
node scripts/check-module-boundaries.mjs
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
node node_modules/vitest/vitest.mjs run src/ext/modules/combat/tests --maxWorkers=1 --no-file-parallelism
# 共享回归完整 argv 见 commands.json，按上列 15 文件串行运行。
npm run test:drift -- --maxWorkers=1 --no-file-parallelism
```

命令、退出码和原始日志在 `/private/tmp/combat2-acceptance/{commands.json,results.jsonl,boundary.log,types.log,build.log,combat.log,regressions.log,drift.log}`。Vitest 表内时间取其摘要，非测试命令取包装器墙钟。

### dot 五项失败逐项归因

| 失败入口（`src/ext/modules/combat/tests/`） | 实际失败 | 归属与处理 |
| --- | --- | --- |
| `combat2_sdk_repro.test.ts:17`，seed23 第91条输入 | metadata / scheduler bundle mismatch | SDK-1：生成子事务回滚破坏活 ledger 身份，另立底座步骤 |
| `combat2_sdk_repro.test.ts:34`，seed118 第152条输入 | Invalid module state: growth | SDK-2：死亡 DTO 混入合法可选空间字段，另立底座步骤 |
| `combat2_evasion.test.ts:99`，seed3 / 62 | 完整 seek hash 不等 | SDK-3 / 现有 VISIBILITY |
| `combat2_natural.test.ts:69`，seed3 / 64 | 完整 seek hash 不等 | 同一 VISIBILITY；后续 seed11/12 未验完 |
| `combat2_links.test.ts:44`，seed47 / 425 | 完整 seek hash 不等 | 同一 VISIBILITY；自然 giant 正伤害接触断言未执行到 |

五个失败不是五种引擎缺陷。三个 seek 差异不能以 0 OOS、线性 replay 通过或只比较动作 ledger 代替完整一致性。

### 额外发现：旧 native 攻击前提失效

1. 全 combat 多出的第六个失败位于 `src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts:264`。它假定 jackal 在 tick500 立即调用普通 `CombatSystem.attack`，以证明终点受伤打断篝火治疗。新绑定 `definitions.json:1573` 让 jackal 进入逐隙刺蓄力，tick500 没有这个即时攻击调用；原断言在 `:269` 失败。这是有意内容变化触发的测试前提过时，不是篝火守卫应被删除，也不是已确认的治疗缺陷。
2. 为核查 35045d9 补跑底座窄回归时，`src/test/giants2_foundation.test.ts:74` 的相同 jackal 前提使 SDK02 动画开/关两项在 `:119` 失败：phased 分支先处理动作，测试植入的 native 回调没有执行。两个失败在撤去 SDK 草案、恢复原生产文件后仍复现，排除补丁引入回归。

两类均已按仓库规则证明：**只回退本次 definitions 到真实 59b9ba6，旧测试原封不动通过；恢复新 definitions，仅把诊断物种 jackal 改成未绑定的 wraith，原行为断言全部通过**。未改生产绑定、期望伤害/时间/中断语义，未增加 skip。bonfire 选中 1 过 / 48 名称过滤；SDK02 选中 2 过 / 13 名称过滤。日志分别为 `bonfire-data-rollback.log`、`bonfire-premise-draft.log`、`clock-original.log`、`clock-data-rollback.log`、`clock-premise-draft.log`。草案为 `bonfire-premise.patch`、`giants2-clock-premise.patch`。

bonfire 属 dot combat 白名单，可返工修前提；共享 giants2 测试不属该白名单，应由维护者在后续集成步骤处理。追加两项不混记为原 47 文件的失败数，也不算成 G2-SDK02 时钟实现重新损坏。

## 已复现的 seek 差异（原输入，不重录）

| 原失败用例 | 切点 | 完整差异 | 说明 |
| --- | ---: | --- | --- |
| combat2_evasion | seed3 / 62 | 缓存 `levels[0].grid[72,73,74,101,102,130,248,249].isVisible`，8 叶 true→false | 原警告脱离/释放与线性 replay 通过，seek 失败 |
| combat2_natural | seed3 / 64 | 同 8 叶 | 用例在此提前失败，不能把 seed11/12 后续验证计为通过 |
| combat2_links | seed47 / 425 | 缓存 isVisible 共 23 叶 | seek 先失败；巨兽正伤害接触断言在其后，未到达不等于满足 |

本轮从 dot helper 输出的 **expected/actual 完整对象** 递归逐叶比对，三份 directHash 都等于 wantedHash，没有额外归一化。结果保存在外部 `seek-*-diff.json`。上述三个失败共享一类根因；0 replayError/OOS 不等于完整快照相等。

静态执行路径：`src/engine/Core/Game.ts:6503` 的 `finishTransientDisplay` 在无闪光时提前返回，而有排队闪光时会调用 `updateTransientVisibility(null,false)`；`src/engine/Core/GenerationCoordinator.ts:212` 直接缓存离层 grid；`Game.ts:4607` 的 seek 候选只推进命令，不执行测试每事件的 `toSnapshot()` 显示收尾。两条调用路径的普通 FOV 边界因此不同。此问题属于已批准六项的 **VISIBILITY**，应把三个原输入及完整差分并入其换层/非单调 seek 回归，不另开一个同名修复。已读取的任务书要求无闪光也规范化、无新知识/随机数，并要求 trace 变化逐叶归因；不允许从比较中裁掉缓存可见性。

## SDK-1：生成子事务回滚丢失动作 ledger 身份（S1，既有底座缺陷）

**根因不是跨层时数值装配错误。** seed23 第91条公开命令在 D2→D3 坠层生成过程中，正常的 `blueprint` 失败回滚触发 `src/ext/runtime.ts:1525`：用 `frame.states` 的 JSON 副本替换整个模块状态，却没有像普通事务 `runtime.ts:1000–1017` 那样保留 actor-action 活对象。`PhasedAttackProduction.ts:410–424` 的 session/finishAction 闭包仍引用旧 ledger；scheduler 删除 bundle，闭包只删除旧 metadata，当前 runtime 仍有 action3。到 `Game.ts:3595` 安全边界重绑时，被 `actorActionValidation.ts:243` 正确拒绝。

独立插桩观测到 `rollbackGeneration('blueprint')` 的堆栈来自 `GenerationCoordinator.ts:145` → `BlueprintEngine.applyBlueprint` → 新层生成；随后 finish action3 的 `sameState=false`，session/live 两侧原先都有 action3。这将 dot 的“疑似 session 重绑”落实为具体根因。最终 root.bundles 为空、live actions 留 action3、suppressTerminalSweep=true，与原公开复现一致。

最小复现：使用真实旧包的 `fixture.stomp` 启动付费动作，开启一个 floor 子事务和 blueprint 子事务，子事务无写入回滚、父事务提交。仅这次 no-op rollback 就使 `actorActionBinding().state !==` 原 ledger；公开动作后续会使用失联状态。测试保留对象身份、完整值、action/resource 子对象身份和后续动作结束/save-load 断言。基线旧数据下补丁前失败、补丁后通过；该根因文件与 59b9ba6 字节相同，不能归咎于新五招。

修复方向：GenerationFrame 在 begin 时保存既有 `checkpointActorStateIdentity()` 恢复器，rollback 恢复值后恢复原 ledger 及其子对象；不放宽镜像/存档守卫，不在安全点盲删 metadata。外部草案 `sdk1-generation-identity.patch`；还应正式覆盖嵌套提交后父失败、真正修改后回滚、多来源/休息/冻结袭击动作、其他模块异常与生成性能。该项不属于六项的 SPATIAL（读档缓存区域查询重绑），也不等同 ORIGIN（完整事务回滚后的录制来源保留），应另立底座步骤。

## SDK-2：regional ActorFacts 与 growth 死亡 DTO 不相容（S1，新变体）

seed118 第152条公开输入杀死 D3 岩脊兽 id62。失败前 HP=1，合法 spatial 为 square-2、`movementRegionId=61`。原生死亡捕获时 `runtime.ts:614–617` 发布的 ActorFacts（`src/ext/types.ts:81`）合法包含该区域字段；`src/ext/modules/growth/module.ts:652` 的 `actor:{...actor}` 将它直接存进 pending kill。`src/ext/modules/growth/state.ts:85–90` 精确要求十个旧字段，因此拒绝多出的 movementRegionId，报 `Invalid module state: growth`。独立插桩确认 pending 的唯一额外 actor 字段就是区域 ID，死亡 hp=0、origin/归属与其他字段合法。

与 `35045d9` 的 G2-SDK01 **不是同一缺陷重现**：旧问题发生于 simulationSettled/GC 的来源根选择，表现为多保留死亡 actor、重复收集不幂等/OOS；此次在 deathCaptured 的 setState 就被拒，尚未进入奖励结算/GC。35045d9 已在当前祖先链，其来源过滤修复保持；本次是 ActorFacts 可选空间字段与既有持久 DTO 的适配遗漏。

最小复现：真实 growth 工厂模块接收一个带 movementRegionId 的合法 deathCaptured actor，context 使用原 validateState 保存；严格校验失败。此单元不安装 combat/giants，另以原 seed118 真实 Game 路线证明实际可达。草案在 producer 明确投影已有十字段；不删 death 事件、origin、奖励或放宽 schema，未知持久字段负例继续拒绝。保持 growth 现有持久格式，不需迁移。外部草案 `sdk2-growth-death-projection.patch`。应覆盖区域内独立/固定区/复合核心、普通/行政死亡、合法来源/分成与重复收据；不能把它塞入现有六项而冒称已获修复授权。


## 草案验证与交接

所有草案只写在 `/private/tmp/combat2-acceptance/`；临时 `tree/` 是 HEAD 的独立归档副本，不是 p5 工作树。原仓库生产/测试文件均未改。

| 副本验证 | 结果 | 边界 |
| --- | --- | --- |
| 两个最小复现，真实 59b9ba6 combat 数据、原底座 | 2 失败 | `mre-base-before.log`；另两项名称过滤 |
| 相同最小复现，加 SDK-1/2 草案 | 2 通过 | `mre-base-after.log`；数据仍是旧表 |
| 当前 combat2 数据，加 SDK-1/2 草案 | 最小复现及原 seed23/118 共 4 通过 | `patch-public.log`；包含真实 save/load 与完整世界比较 |
| seed3 完整 direct/线性 replay/seek 因果探针 | 修改前 1 失败；附加 VISIBILITY 诊断后共 5 通过 | `visibility-before.log` / `visibility-after.log`；不重写原 trace |
| SDK-1/2 草案，生成与 growth 相关 5 文件 | 首跑 48 过 / 2 失败 | `patch-regressions.log`；两败为上述共享 jackal 前提 |
| SDK-1/2 草案，仅修共享测试前提，重跑整个 giants2_foundation | 15 / 15 通过 | `foundation-patched-premise.log`；含原 G2-SDK01 收集幂等用例 |
| SDK-1/2 草案 vue-tsc -b | exit 0 | `patch-types.log`（无诊断输出） |

五文件批次为 `src/test/ext_generation_transactions.test.ts`、`ext_generation_checkpoint_differential.test.ts`、`giants2_foundation.test.ts`，以及 `src/ext/modules/growth/tests/ext_growth_composite_rewards.test.ts`、`ext_growth_body_transitions_rewards.test.ts`。未受测试前提改动影响的其余四文件共 35 项在首跑通过；没有把两次结果写成一次 50/50 全批。诊断用 VISIBILITY 改动在 SDK 专属回归前已撤回。

VISIBILITY 因果探针只删除 `finishTransientDisplay` 的无闪光早退：原输入每命令捕获完整快照，另一路线性 replay 再 seek。仅这一生产差量即可关闭 seed3 完整世界差异，支持与六项任务书同因。`visibility-causality-only.patch` **仅作定位证据**；尚未证明其性能、全部无新知识边界以及 seed47 原 trace 更新，应交现有 VISIBILITY 作者统一实现。黄金变化必须按原法重录、逐字段登记，不能用这个探针绕过该要求。

交接文件：

- `sdk1-generation-identity.patch`：生成回滚恢复活 ledger 身份。
- `sdk2-growth-death-projection.patch`：保持持久十字段 DTO 的显式投影。
- `sdk-regression.draft.ts`：两个最小复现、两个原公开输入和一个独立 VISIBILITY 完整世界探针；配置及运行方法见外部 `README.md`。正式落地应登记到对应底座/growth 测试归属，避免共享测试导入可删除的 combat 测试 helper。
- `bonfire-premise.patch`、`giants2-clock-premise.patch`：两类已证反事实的测试前提修订。
- `seek-*-diff.json`、`diagnostic.log`：完整快照差分与失败路径观测；原始大对象不提交。

草案通过局部复现不等于正式底座修复验收。未在副本运行全局门禁或冒称覆盖所有嵌套事务、奖励、缓存、性能情况。

## 后续归属与合入条件

| 工作 | 放在哪里 | 关闭标准 |
| --- | --- | --- |
| 三个 seed3/47 seek 失败、显示调用频率探针 | **并入当前六项中的 VISIBILITY** | 合并其换层/坠层、完整缓存快照、无新知识、双 RNG、无/有渲染和非单调 seek 回归；修后逐叶归因必要 trace 变化 |
| 生成 rollback 的 actor-action 身份 | **另立底座步骤** | SDK-1 原 seed23 与旧招最小复现通过，正式补嵌套及动作生命周期回归；不弱化镜像守卫 |
| growth regional death DTO | **另立底座步骤**，可与上项同一新步骤实施 | SDK-2 原 seed118 与区域死亡/奖励/幂等负例关闭，35045d9 原 GC 回归保持；不改 schema 来吞非法持久字段 |
| bonfire native 前提 | dot 白名单内返工 | 采用有反事实证据的最小前提修正，保留全部断言 |
| giants2 SDK02 native 前提 | 维护者集成步骤 | 共享测试最小修订并重跑整个文件；不得让 dot 越白名单修改 |
| 自然路线与人工 UI 缺口 | dot 内容收尾 / 维护者人工验收 | 下述证据补齐后才关闭 combat2 |

ORIGIN 处理确证完整回滚后的录制来源保留；SDK-1 是生成子事务内部活对象身份损失，两者虽涉及 rollback，却不是相同修复。SPATIAL 是读档后缓存 grid 区域查询重绑；SDK-2 是合法 ActorFacts 序列化进封闭死亡 DTO，两者也不同。XR-01/02/03 与这两个新根因无直接同因关系。当前六项合同明确“只修六项及必要同因回归”，因此不能未经扩项将 SDK-1/2 偷算为已获批准的六项工作。

尚缺证据，不以静态审查或局部诊断补票：

- zombie 自然出生后的新招实际释放；自然巨兽被新招有效接触、自然群体 handled 闭环。seed118 虽确实触发天然岩脊兽死亡，原运行在捕获中失败，不构成已完成的持久化闭环。
- 非空缓存 NPC 的资源冻结；自然 seed11/12 等被首个 seek 失败阻断的后续持久化；growth 技能专门 No 场景。
- 1440×900 / 390×844 / 320×844 × 普通/沉浸 × 四渲染器的浏览器矩阵及实际触摸/设备证据。本轮只读源码与组件，不把 44px CSS 或 SSR 测试当浏览器通过。本报告完成维护者代码审查，但不替代人工布局审查。

底座修好后应从 **原 seed23、seed118 安全 prefix** 接续原有上限内的搜索，不重新抽掉失败 seed；先关闭原失败，再补自然证据。最终组合候选须重跑本轮门禁以及按 `docs/development.md` 合入档要求的全量验证；本轮已补旧 64 组合，但没有执行 128 启用子集、物理删除、完整 npm/test:ext 或 CE 全量档，也不继承 p5 指挥进程的结果作为 combat2 候选通过证据。

判定维持 **需底座修复后合入**：主阻断是已定位的既有底座缺陷，同时保留明确的 dot 收尾和集成待验项。未提交、推送、合并或修改其他工作树。

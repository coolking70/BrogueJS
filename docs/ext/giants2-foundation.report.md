# giants2 前置底座修复报告（两轮审查收口）

2026-10-09；工作区 BrogueJS-p5，分支 `ext/phase5`，开工代码 `02ef819f1daeff4e2eb600b365c5df68e1754324`。仅实现底座三修，不合入 giants2、不修改 giants 内容或旧 D12 路线、不实现 5Y、不 commit/push、不自开代理或独立审查。父已有及同期维护的状态卡、HANDOFF、README、5Y 等文档保持，本作者不编辑。

## 修复与约束

- **G2-SDK01：** Runtime 在奖励结算前仍观察全部来源，提供给模块 GC 的 `sourceIds` 则只从本次原生 GC 后仍可达目标的 status/fatal/displacement/death origins 收集。growth 的 pending 奖励先消费、关系与分成判断保持，随后删去不可达摘要。没有提前删除奖励、修改 growth 校验器或让回放额外 collect。
- **G2-SDK02：** 有 actor scheduler 且玩家非 bundle-busy 时，同边界 NPC 决策前扣除已过去的 elapsed；新建立的防御恢复镜像在未来时间片偿还。busy 玩家仍由 scheduler 唯一倒计时，无 scheduler 的 classic 路径保原 CE 扣时位置。未清硬直、接受锁内输入或强行归零。
- **G2-SPATIAL：** 所有幸存乘客在任何退休写入前检查真实层、所有权、整足迹地形/占位/休眠预留、移动区域及同批乘客互斥。合法落点沿原携带者锚点，通过 `commitCreatureAnchor` 发布并调用来源失效通知；非法落点安全拒绝，未开启的复合体独立落地拒绝。晚期异常用原生检查点及 Runtime 对象身份检查点回滚，不用 save/load 模拟事务。未扩空间守卫白名单。

生产仅 `src/ext/runtime.ts`、`src/engine/Core/TimeCoordinator.ts`、`src/engine/Core/Game.ts`；正式新增 `src/test/giants2_foundation.test.ts`，登记 `scripts/test-suites.json`。无 Game 持久字段，因此不需要新增 U03 字段登记。九冻结逐项等于 HEAD：worldSdk、edibleSdk、worldEdible、kindKnowledge、actorNeeds、stats、testing/worldHarness、testing/forageHarness、testing/fixtures/forageFixture/index。foundation13、whole-run6、recording4/origin2、worldSdk1/edibleSdk1 与既有模块格式保持；不声称旧 foundation11 巨兽录像兼容。

## 当前树复现与开发期结果

统一环境：PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实际 `node --version` 为 `v24.19.0`；`NODE_OPTIONS=--max-old-space-size=3072`；全部 Vitest `--maxWorkers=1 --no-file-parallelism`。工作目录为仓库根。

| 批次 | 实际退出码与结果 |
| --- | --- |
| 未登记新测试首次启动 | exit1；ownership 拒绝，未运行测试，随后正式登记 |
| 修复前草案两 SDK + 原空间守卫 | exit1；25通过/3失败，当前 `02ef819` 实际复现三项 |
| 首修两文件 | exit1；27通过/7失败：新诊断误假定恢复100tick及空索引null，另查出 Runtime 身份回滚缺口 |
| 修正后新窄回归 | exit0；8通过 |
| 追加来源首批 | exit1；9通过/1失败，燃烧布景未用生产来源入口，已改 `exposeCreatureToFire` |
| 首次 boundary | exit0 |
| 首次 types / build | 各exit2；7处新测试 MonsterData 类型未收窄，均在新增测试，无共享生产类型错误 |

以上保留原失败，不累计重叠通过数。没有修改既有测试前提、语义、种子或阈值，没有新增 skip/todo。正式门禁与补充反事实结果见下文。

## 覆盖与证据边界

正式新回归检查一次收集/重复收集完整扩展状态幂等；仍存活燃烧/位移目标对已死盟友来源的保留、存读及终结后玩家分成/一次收据；NPC在50tick边界真实破韧、过去时间先扣、完整新债务、动画锁内输入拒绝、存读、续录公开回放；真实乘客退休整足迹、索引失效、来源修订、所有权与存读；尾格墙/占位/休眠预留及晚期挂接失败完整对象图保持。

既有真实 poison 延迟 credit、反射/关系失效/80:20 分成、复合体/变形奖励、parry/dodge、动画防御、bundle 生命周期/时钟、存录、UR2/3/4、U03 和 5E1 raid/resident/fall 回归列入实际清单。只引用本树实际结果；不把旧巨兽验收的136/131、116、205等历史数字称为本树通过。

完整 npm/test:ext、128组合/物理删除、CE full/gen、giants2 自然原始长录像及旧 D12 路线、浏览器/真机/失焦矩阵和最大负载留后续/5Z。本轮 CE 源缺失提示保留，CE 依赖项的实际 skip 另列，有限通过不替代全量。

执行目录 `/private/tmp/brogue-commander-20261009-g2-foundation/`：`affected.txt` 精确清单、`commands.jsonl` 真实命令与退出码、各日志及 progress/READY；只存结果摘要，不建多版本源树或逐字节封存。最终交接后停止共享树写入，由父另起最多两轮独立审查，原作者仅按父 resume 修复。

## 实际限定门禁与反事实结论

| 命令 / 批次（均串行、单 worker） | 实际结果 |
| --- | --- |
| `node scripts/check-module-boundaries.mjs` 最终 | exit0 |
| `npx vue-tsc -b` 最终 | exit0；首次新测试类型失败另列上表 |
| `npm run build` 最终 | exit0，实际 Vite 产物生成；保留既有 >500kB 分块警告 |
| `npx vitest run` 下列32文件 `--maxWorkers=1 --no-file-parallelism` | **exit1；30文件通过/2失败，478通过/5失败/2原有skip**；624.59秒 |
| `npm run test:drift -- --maxWorkers=1 --no-file-parallelism` | **exit0；6文件12通过**；142.69秒；未重录 |
| 最终新增底座+空间守卫+i18n/硬编码/卫生/归属六文件批 | **exit1；5文件通过/1失败，75通过/1失败，0真实skip**；23.74秒；当时新增底座13项通过 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts -t '留痕' --maxWorkers=1 --no-file-parallelism` | exit0；3通过/27仅过滤，未跑该文件重型15种子生成 |
| 仅三份本步生产回退HEAD，运行原失败完整图+UR4两文件 | **exit1；原5项全部失败**；24.00秒；修复树和开工生产的完整图88个实际散列条目逐项相同 |
| 仅Game回退HEAD，新测试 `-t 'SPATIAL'` | exit1；7失败/5仅过滤；5.87秒；恢复修复后全部通过。第一次尝试因类型替换误伤属性访问，0测试/exit1；已修正，未隐去 |
| 仅Runtime回退HEAD，新测试 `-t '封入原点'` | exit1；1失败/13仅过滤；command2、tick100、位置32,26，extensions OOS；恢复修复后该公开wait/真实毒伤/回放/存读用例通过 |
| 三生产回退HEAD，i18n `-t '所有 t'` | exit1；1失败/25仅过滤；与修复树同4个未解析调用 |
| 最终 `npx vitest run src/test/giants2_foundation.test.ts --maxWorkers=1 --no-file-parallelism` | **exit0；14通过**；15.37秒；最后追加测试后再次types/build均exit0，diff检查exit0 |
| 第二乘客挂接故障 `-t '第二位'` | exit0；1通过/12仅过滤；原生属性查询绑定、完整图及整批所有权保持；未发现需要扩大生产修复的额外问题 |

32文件真实命令如下（没有 `-t` 过滤）：

```sh
npx vitest run \
  src/test/giants2_foundation.test.ts \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/phase4a1_game_square.test.ts \
  src/test/ext_causality.test.ts \
  src/test/ext_bolt_causality.test.ts \
  src/ext/modules/growth/tests/ext_growth_sources.test.ts \
  src/ext/modules/growth/tests/ext_growth_lifecycle.test.ts \
  src/ext/modules/growth/tests/ext_growth_body_transitions_rewards.test.ts \
  src/ext/modules/growth/tests/ext_growth_composite_rewards.test.ts \
  src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts \
  src/ext/modules/combat/tests/combat_defense_state.test.ts \
  src/ext/modules/combat/tests/combat_native_defense.test.ts \
  src/ext/modules/combat/tests/combat_animated_defense.test.ts \
  src/test/phase3a0_defense.test.ts \
  src/test/phase3a0_scheduler.test.ts \
  src/test/phase3b_action_lifecycle.test.ts \
  src/test/p2_3_objective_time.test.ts \
  src/test/ext_recording_v4_digest.test.ts \
  src/test/ext_recording_v4_snapshots.test.ts \
  src/test/ext_recording_v4_storage.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/x2a_recording_checkpoint.test.ts \
  src/test/x3b_display_recording.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/u_r3_trace.test.ts \
  src/test/u_r4_trace.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/ext/modules/settlement/tests/resident_lifecycle.test.ts \
  src/ext/modules/settlement/tests/resident_fall.test.ts \
  src/ext/modules/settlement/tests/settlement_raids.test.ts \
  src/ext/modules/settlement/tests/settlement_raid_replay.test.ts \
  --maxWorkers=1 --no-file-parallelism
```

六文件守卫批的真实输入为 `giants2_foundation`、`phase4a0_spatial`、`p1_30_i18n_gate`、`u24_hardcoded_text`、`repo_hygiene`、`test_suite_membership`，均位于 `src/test/`，加相同单worker/串行参数。`commands.jsonl` 保留完整 argv 和退出码，不合并相互重叠通过数。Vitest把 `-t` 未选项显示为 skipped，此处严格标为“仅过滤”。32文件批的2个真实skip仅为 `p2_3_objective_time.test.ts:358/413` 已退役旧阶段基线，无新增skip，也没有该批 CE 缺源跳过。

## 原有未修全局失败（不冒称全绿）

1. `phase4a0_spatial_differential` 的 empty/growth/narrative/growth+narrative 四项，在 `:141` 的既有完整图基线比较失败。仅回退本步三生产仍全失败，88个报告中的实际图/快照散列与修复树精确相同；不是本步新失败，不改其黄金或断言。
2. `u_r4_trace.test.ts:91` 的完整黄金比较，在开工代码仍失败。用原 `UR4_CAPTURE=1` 捕获入口仅在临时目录诊断，当前与黄金 JSON **仅52个 `recording/*/chainDigest` 叶不同**；其余世界、事件负载、时间、RNG/消息叶相同，连续/动画后续规则断言也通过。诊断捕获不是原门禁通过，不在仓库重录，临时原始文件已删除；旧链身份的维护留后续，不伪装兼容旧录像。UR2/UR3 原始文件在32文件批通过。
3. `p1_30_i18n_gate.test.ts:312` 一项失败，4处动态键未被静态扫描解析：`MainMenu.vue:382` 的 `control.labelKey` / `control.descriptionKey`；`StructureProduction.ts:1040` 的 `d.nameKey` / 材料定义名键。两生产文件本步未改、均等于HEAD；回退本步三生产后同样失败。保持守卫，后续改调用入口/提供既有可扫描前提，不扩白名单。

这6项是不同批次的原有失败，不等于6个新玩法缺陷；也不以本步通过覆盖原批exit1。当前没有作者已知未修复的本步三项正确性问题，仍待父独立审查。没有改既有测试前提或黄金，因此本步不存在旧断言语义修订或重录登记。

## 最终差量与剩余

新增底座最终14项包括追加的同批第二乘客故障与 SDK01 公开毒伤回放。受管方形乘客属于明确诊断布景：本步没有开启可存储的 carried spatial 生命周期；成功退休后普通/休眠/真实stairs离层缓存的合法整足迹存档通过原校验，复合成员独立落点仍拒绝。

未测的完整 npm/test:ext、128子集/删除、CE全量与重型生成、全部设备/最大负载继续归5Z；新巨兽原始自然路线和旧shale-weaver D12五项须在下一合入步骤处理，不能视为已关闭。本步不改变父已批准5Y文档，不修改父任务/状态卡/HANDOFF/README，不自行进入合入或审查。

最终交接：最后完整新增14项exit0，最后types/build/diff-check均exit0；生产行为与通过的实际drift版本相同，其后仅补中文注释、正式测试和报告。作者停止共享树写入，无commit/push，等待父另起独立审查。

## R1-F1 第一轮作者修复（2026-10-09，待父第二轮核对）

父确认第一轮独立审查后续作，仅处理已确认 R1-F1。独立审查历史和首次实现原结果均保留；首次实现“第二次挂接调用即第二乘客”的测试前提有误，第一乘客的列表插入会自动挂接，随后还显式挂接，因此原通过没有覆盖第一携带者真正退休后的异常。首次“无已知本步未修正确性”判断被 R1-F1 覆盖，不据旧通过宣称该问题已关闭。

**修复：** 在 Game 原有退休事务之外增加 `checkpointNativeStatSession`，失败时先恢复 Runtime/原生对象图，再恢复同一个属性会话的 actor 映射、ledger、dirty/物化/来源/查询缓存及相关控制状态。原 pipeline、旧 query、Map/Set 与缓存对象保持身份；NativeStatSources 的 WeakMap 绑定、修订、环境、原生查询会话/缓存和装备预览关联恢复原值；库存/装备失效通知恢复原回调。恢复不发失效通知，不新建 Runtime/pipeline，不用重新 attach，不绕过或延后第一携带者的真实退休。新检查点仅暴露给可信引擎入口，不进入模块上下文，不修改冻结九 SDK 或任何格式/黄金/玩法数据。

R1 生产差量仅 Game 的失败恢复接入、Runtime 的可信属性会话检查点、`NativeStatSources.ts` 和 `ItemStatInvalidation.ts` 的离图关联检查点。TimeCoordinator、SDK01 收集逻辑及巨兽内容没有本轮变化，无新增持久字段或协议 bump。

**正式回归：** 原“第二位”改为方形/原生单格两种乘客，按第二位乘客对象身份抛出异常。故障入口先断言第一携带者已经执行完 `retireEdibleActor`、组件和 extensionHooks 已移除、其当前 query 已脱离原绑定、原 query 报 `ext.stats.errors.source` 且闪避暂时降0，再抛指定异常。回滚后检查完整图及 Runtime 摘要、原 query/玩家查询身份、旧 max-hp 查询可用、闪避500恢复、缓存对象/大小和原生修订、原空间修订/索引/位置、两携带关系/根所有权与RNG。原生单格失败后立即存读核对属性与携带关系；方形携带仍保持既有关闭合同，两种场景均移除故障、重试合法退休并存读确认两乘客合法落点。不再用挂接调用计数定位故障。

统一环境仍为 Node `v24.19.0` PATH 前置、`NODE_OPTIONS=--max-old-space-size=3072`，Vitest 单 worker/串行。实际命令及退出码：

| 实际命令 | 结果 |
| --- | --- |
| 正式 `npx vitest run src/test/giants2_foundation.test.ts -t '真正第二位' --maxWorkers=1 --no-file-parallelism`，修复前 | **exit1；2失败/13仅过滤**；确认方形与单格均发生真实第一携带者退休后故障，旧绑定未恢复 |
| 同命令，修复后 | **exit0；2通过/13仅过滤**；3.71秒 |
| `npx vitest run --config /private/tmp/brogue-commander-20261009-g2-foundation/review-r1.config.mts -t '真正第二' --maxWorkers=1 --no-file-parallelism` | **exit0；原审查探针1通过/3仅过滤**；2.36秒；原探针/配置未改 |
| `npx vitest run src/test/giants2_foundation.test.ts -t SPATIAL --maxWorkers=1 --no-file-parallelism` | **exit0；9通过/6仅过滤**；8.73秒；未重复未受影响SDK01/SDK02组 |
| 下列六文件窄批，`--maxWorkers=1 --no-file-parallelism` | **exit0；6文件135通过，无失败/skip**；40.46秒 |
| `node scripts/check-module-boundaries.mjs` | exit0 |
| `npx vue-tsc -b` | exit0 |
| `npm run build` | **exit0；本轮仅跑一次实际build**；Vite 3.08秒，既有大分块警告保持 |
| `git diff --check` | exit0 |

六文件命令：

```sh
npx vitest run \
  src/test/phase4a0_spatial.test.ts \
  src/test/ext_stats_native.test.ts \
  src/test/ext_stats_runtime.test.ts \
  src/test/ext_stats_review.test.ts \
  src/test/ext_world_work_transactions.test.ts \
  src/test/ext_region_runtime_transactions.test.ts \
  --maxWorkers=1 --no-file-parallelism
```

开发期首个编辑脚本未命中旧格式，未写入测试；随后的过滤命令 **exit0但14项全未选、0项执行**，不计为通过或复现。修正编辑后上述修复前2失败、修复后2通过分别保留。所有 `-t` 排除项仅为过滤，未新增真实 skip；所选项无 CE 缺源跳过。通过数相互重叠，不累加为新总数；正式文件现有15项，本轮仅按受影响空间组运行，首次完整14项历史不改称本轮完整15项通过。

本轮不重跑原32文件、drift、完整门禁，不补证/重录原6项已登记全局失败，不改独立审查历史或父状态/HANDOFF/README/task/5Y文档。执行摘要/准确argv与exit在 `/private/tmp/brogue-commander-20261009-g2-foundation/fix-r1-commands.jsonl` 及对应日志。作者已修复并窄测，仍待父第二轮仅核对 F1 关闭及新引入问题；不自行安排审查、代理或第三轮，不 commit/push，不实现后续。


## 维护者收口（2026-10-09）

两轮独立审查完成；R1-F1已由原作者修复并经R2独立关闭，范围内无剩余已确证玩法/存档录像缺陷。维护者已核对实际差异、报告与命令结果：首次boundary/types/build/drift通过，R1修后受影响空间9项、六文件135项及types/boundary/build通过；R2结果见独立审查末节，各批不累加。未重跑首次未受影响整批，原6项基线失败及覆盖限制保持登记5Z；不追加第三轮或封存。当前生产变更限Game/TimeCoordinator/Runtime及R1所需NativeStatSources/ItemStatInvalidation，九冻结、协议与黄金未改。下一步按授权合入固定357a473并处理giants旧五项路线，再启动已批准5Y。


## 集成发现的加载依赖修复

2026-10-09；在HEAD `8d5f8a668e3fefc429c69e8ccd49034cfff5007b`、MERGE_HEAD `357a473e67281e2164ebdcac6f738336598e8027` 的集成现场进行一次窄修复。底座两轮审查历史保持；本次纳入集成自己的审查流程，不开启底座第三轮。

**因果确证。** 按授权仅撤销 `giants_committed_transition.test.ts` 新增的harness预加载及两行说明，恢复原导入次序；实际收集即在 `Player extends Creature` 失败，栈经过 `MonsterVisibility` / `WorldWorkWorld`，0项测试执行，exit1。`git show 35045d9` 确认两个属性检查点值导入均为该底座提交新增。保持生成协调器原实现、全部巨兽数据/规则/测试断言及其余底座修复不变，只把NativeStatSources和Runtime这两个新增值导入改到原样复制的纯检查点文件，同一用例1项通过、exit0。故问题由底座新依赖边引入，不能归为旧protocol前提，也不能靠测试预加载解决。

**最小修复。** 将原 `GenerationCheckpointRoots`、`checkpointGenerationWorld`、`checkpointGenerationWorldGroups` 原样移入无任何导入的内部 `src/engine/Core/WorldCheckpoint.ts`；`GenerationCoordinator.ts` 兼容转导出相同函数和type，两个新增调用改用轻入口。接口与两套捕获/恢复算法和HEAD原代码完全一致；不增加包装、不改变浅根/深根/引用停止、描述符、Map/Set、字节数组、追加队列、恢复顺序或会话回调。R1绑定/缓存恢复及对象身份语义保持。

**正式回归。** 新增并登记 `src/test/ext_checkpoint_imports.test.ts`，每项先清空模块缓存，再分别从Creature、NativeStatSources、Runtime、WorldCheckpoint、GenerationCoordinator、Game六个入口加载；无Game/harness预加载，随后检查Player/Monster继承同一Creature原型及属性检查点入口。另查新旧导出为同一函数引用。仅将两个导入临时改回GenerationCoordinator路径，新回归的Creature首入口再次报同一错误（1失败、6仅过滤，exit1），之后立即恢复轻入口。此反事实即使旧入口已转导出仍失败，进一步排除捕获算法和巨兽数据差异。

所有以下npm/npx命令均在仓库根执行，前缀环境为 `PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072`；实际Node为v24.19.0；Vitest串行、maxWorkers=1。结果按各批列出，不当作全量全绿。

| 阶段与真实命令 | 退出码与实际结果 |
| --- | --- |
| 修前原顺序：`npx vitest run src/ext/modules/giants/tests/giants_committed_transition.test.ts --maxWorkers=1 --no-file-parallelism` | exit1；收集失败，0项执行 |
| 仅切换两个底座导入的反事实：同上命令 | exit0；1通过，无过滤 |
| 最终修复：`npx vitest run src/test/ext_checkpoint_imports.test.ts src/ext/modules/giants/tests/giants_committed_transition.test.ts --maxWorkers=1 --no-file-parallelism` | exit0；2文件、8通过，无过滤 |
| 临时改回两条旧依赖后：`npx vitest run src/test/ext_checkpoint_imports.test.ts -t 'loads Creature first' --maxWorkers=1 --no-file-parallelism` | exit1；1失败、6仅过滤；finally恢复两条轻入口导入 |
| `npx vitest run src/test/giants2_foundation.test.ts -t SPATIAL --maxWorkers=1 --no-file-parallelism` | exit0；9通过、6仅过滤；包括真正第二乘客的两种足迹，旧query/绑定/缓存/属性/图/索引/存读断言保持 |
| `npx vitest run src/test/ext_stats_native.test.ts src/test/ext_stats_runtime.test.ts src/test/ext_stats_review.test.ts src/test/ext_world_work_transactions.test.ts src/test/ext_region_runtime_transactions.test.ts --maxWorkers=1 --no-file-parallelism` | exit0；5文件、109通过，无过滤 |
| 检查点窄测：下方真实命令 | exit0；3文件、4通过、39仅过滤；覆盖循环/别名/描述符/字节/队列、分组写集停止边界、待发事实事务 |
| `npm run check:modules` | exit0；实际boundary及测试归属通过 |
| `npx vue-tsc -b` | exit0 |
| `npm run build` | exit0；仅执行一次，Vite实际构建3.06秒；保留既有>500kB分块警告 |
| `git diff --check` | exit0 |

检查点窄测命令：

```sh
npx vitest run src/test/ext_generation_checkpoint.test.ts src/test/ext_generation_checkpoint_differential.test.ts src/test/ext_generation_transactions.test.ts -t 'generation checkpoint root contract|preserves independent shallow/reference stops|does not promote a reference-only descendant|checkpoints pending combat and acknowledgments' --maxWorkers=1 --no-file-parallelism
```

本轮选中测试无因缺CE而跳过的项；表中“仅过滤”均为 `-t` 未选中。执行日志及摘要位于 `/private/tmp/brogue-commander-20261009-g2-integration/` 的 `cycle-*.log`、`integration-cycle.progress.md` 与 `integration-cycle.READY.md`，不封存多版本工作树。

**边界与剩余。** 九冻结SDK、协议、游戏规则、黄金和巨兽内容均未改；巨兽文件仅撤销授权的导入绕过，现该文件对HEAD无差异。父状态/HANDOFF/README/task及独立审查历史未编辑，已批准5Y文档与原集成作者其余差异全部保留。未重跑giants整套、原32文件、完整门禁或已登记六项旧基线失败，不补证/重录这些失败；既有失败与覆盖限制仍按原报告及5Z登记。本次加载环已关闭；剩余集成门禁及集成审查由父恢复原集成作者接续，本轮不能证明整批giants全绿。MERGE_HEAD和HEAD均保持，索引无U；未commit/push/abort、未操作分支或Git索引、未开代理/审查。完成记录后立即停止共享树写入。

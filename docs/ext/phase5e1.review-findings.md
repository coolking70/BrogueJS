# 5E1 第1轮独立审查结果

审查日期：2026-10-09。分支 `ext/phase5`，基线/实际 HEAD `5c34f50f56bcf85f4cee890ae80dec87fa927831`。独立于原作者会话 `01a11d57-df5b-7162-b37b-eec86179c189`；已阅读 AGENTS.md、三份必读文档、完整批准合同、作者报告、commander-status 和 5Z 登记。审查包含已跟踪差量及全部10个新未跟踪文件。作者报告仅作声明，以下实测来自本轮。

**第1轮结论：确认3项发现（1项P1、2项P2），当前候选不能签认为玩法/存录正确性全部通过。** 交父核对并 resume 原作者修复；本审查未修代码，未派代理、commit/push、切分支或操作 dot，未开启额外审查轮次。唯一仓库写入为本报告；探针和结果位于 `/private/tmp/brogue-commander-20261009-5e1/`。

## ① 确认的玩法/存录正确性发现

### R1-F1 · P1 · 袭击者的出生约束被当成永久形态/层约束，合法原生变化使整局无法保存

位置：`src/engine/Core/SettlementRaids.ts:543` 的形态/单格检查及 `:547` 的营地层检查；保存入口 `src/engine/Core/Game.ts:11604`。

条件与复现：启用 settlement/raids，seed=51020001，在受控几何中通过公开付费施工、招募和实际袭击边界产生 active 事件。两个现象属于同一个根因：

- 第1层，对真实袭击者51经 `executeItemCommand('use', wand)` 与公开 `mouse_travel` 发射原生变形魔杖；实际 `kobold → pink_jelly`，actorId和事件身份不变、仍存活。随后 `h.save()` 抛 `C5_BAD_REFERENCE: raidActor`。
- 第9层，真实事件 `raid.75.1` 的袭击者80使用原始HP（没有加高袭击者HP），在布置的原生 HOLE 上通过公开 wait 触发正常坠落，幸存并进入第10层 `pendingFallenByDepth`；其余81/82走真实死亡。随后同一保存入口报 `raidActor`。洞与位置是受控场景准备，伤害、幸存和转层走原生执行路径，不声称自然地牢路线。

预期：原生变形/坠落后继续追踪真实敌人身份及可信变化，合法局可保存/读取；新生阵容的有限白名单仍约束出生。实际：校验要求活体永远处于出生阵容并永远留在营地层，否定引擎自己产生的事实。错误发生在保存阶段，尚未生成可读档案；不能描述成仅某个手改坏档被拒。

最小验证：使用③的公共命令前缀运行外部探针 `-t 'polymorph|fall'`。本轮最终完整探针中这两项均失败，明确错误为 `C5_BAD_REFERENCE: raidActor`（整体exit1）。

建议修复：区分不可变出生登记与当前原生形态/位置，接可信变形和坠落生命周期，处理真实敌人跨层后的事件归属/暂停/终结条件；保留真实实体、死亡和奖励语义。不要直接删除引用校验，或把任意当前怪物纳入缓存combat例外；该例外仍须限于可信 active+paused、单格、自有source。

### R1-F2 · P2 · 仅返回营地所在层就泄露未汇报的离场摘要

位置：`src/engine/Core/StructureProduction.ts:844`；实际面板消费 `src/ext/modules/settlement/ui/SettlementPanel.vue:146`。可信报告的region门槛在 `src/engine/Core/SettlementRaids.ts:574`。

复现：真实已付营地，使用可信结构damage事务准备受损屏障；公开楼梯离层，实际摘要结束为 aftermath。玩家仅经楼梯返回第1层，落在 `(30,24)`，没有进入营地region（bounds为x17…25/y8…16）。此时 `report=null`、`reportedTick=0`，事件仍 aftermath，未重新武装。

预期：按E3-A和已知信息合同保留最后报告，实际进入region汇总后才显示新损失。实际：只因 `c.depth===game.depth`，readModuleView从真实事件读出 `phase=aftermath, reason=summary, damagedHp=700`；面板据此显示“损失700耐久”，同时仍称“最后报告0 tick”。在别层时同一DTO的phase及损失均为null。

最小验证：外部探针 `-t 'R1 UI'`；最终完整探针该项失败（期望null，实际aftermath），上述数值由生产DTO直接输出。未使用截图作为证据。此次只确认信息投影泄露；实际region重武装门槛在已有Game测试中仍成立。

建议修复：尚未机械发布的摘要统一使用 `r.report`；现场信息也需符合可信已知信息/region汇报条件，不能仅用“在同一层”替代。保留只读零写入及实际region入口一次汇总。

### R1-F3 · P2 · 缺少事件与建营宽限的时序约束，矛盾坏档仍能授权缓存combat

位置：`src/ext/settlementRaidSchema.ts:136` 的时间检查及 `src/engine/Core/SettlementRaids.ts:530` 的引用校验；白名单消费在 `src/engine/Core/Game.ts:11807`、`:11817`。

复现：先产生真实combat windup，经公开楼梯离层并暂停96037 tick，取得无recordingOrigin的普通诊断快照；保留actorIds、bundle/actionId、windup、资源与暂停根，仅将事件 `triggerTick=createdTick+1`、`dueTick=triggerTick+2000`。本例 `createdTick=0, triggerTick=1`，显然违反批准的32000 tick建营宽限。

预期：候选校验拒绝不可能发生的事件，原活局不被替换，不由该根给缓存攻击授权。实际：`h.load(JSON.stringify(snapshot))` 正常接受，不抛错，带原缓存windup载入。现有校验只限制trigger不晚于世界时间、due相差2000、attempt不早于trigger，未约束trigger与created/grace。

最小验证：外部探针 `-t 'R1 schema'`；最终完整探针该项失败（预期throw，实际接受）。本发现只确证这组矛盾事件时间被接受，**不声称已证明任意伪造actorIds或任意普通缓存攻击都能绕过**。

建议修复：在生成缓存白名单之前，结合本局可信规则验证事件出生、宽限、阶段和暂停的时序关系；至少拒绝上述不可能的首事件。失败仍须保持原活局及session。不得以放宽普通缓存攻击守卫修复R1-F1。

## ② 证据、浏览器、脚本形式及覆盖项（留5Z，不作为新增阻断）

- 按用户指令未新开浏览器/截图轮次；作者已登记的preview EPERM与Chromium MachPort权限缺口仍归5Z，本轮不独立声称浏览器视觉通过。F2以真实只读DTO和实际组件消费路径确认。
- S3订单/escrow/预留/待交付/取消确实走Game和公开命令，但已有用例通过手设 `paidTicks=1000` 准备赚取信用，并调整压力/建营时点准备临近袭击边界；不能把它称作全程自然居民劳动录像。建议5Z补真实工作获得部分信用→被围→恢复→交付一次的连续路线及全部日配额边界。
- 未穷举每个writer×阶段×组合、所有暂停起止余数、所有设施抗性/小栈组合、所有原生盟友转换/死亡奖励、giants完整自然录像。已有giants用例复用真实group成员、占位、伤害和死亡，没有新大型波次；本轮未另跑完整XP转换矩阵，关闭路径静态未见额外奖励发放。
- 外部经济探针最初直接比较不同due-only结算频率的非周期尾水位，得到差异；诊断确认水位均未越过世界tick，统一force结算到相同实际时刻后完整经济/事件/库存/账本相等，存读通过。不是确认的追补或丢失时间缺陷。外部初始100份粮超箱容量、末段不足100 tick、第9层不存在自生居民也均为探针前提错误，已改成合法受控布景；未更改生产/旧测试断言或超时。
- 不重复作者261/141或全drift；未运行npm全量/full/gen、128组合、删除矩阵、最大世界负载、类型/build或性能计时。作者性能数字仅保留作者声明，本轮未独立复测。

## ③ 已验证范围、实际命令/exit/计数

执行环境：绝对PATH `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实际 `node v24.19.0`；`NODE_OPTIONS=--max-old-space-size=3072`。Vitest均 `--maxWorkers=1`，昂贵检查串行。启动器提示本机缺CE；以下所选测试没有CE skip。表中的“未选”是 `-t` 过滤，不新增skip。各批独立列出，不合并重叠通过数。

公共命令前缀（仓库根执行）：

```sh
export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
node node_modules/vitest/vitest.mjs run
```

| 本轮实际命令参数/检查 | exit | 通过/失败/未选 | 结果 |
| --- | --- | --- | --- |
| `src/ext/modules/settlement/tests/settlement_raids.test.ts src/ext/modules/settlement/tests/settlement_raid_replay.test.ts src/ext/modules/settlement/tests/resident_production_codec.test.ts --maxWorkers=1` | 0 | 47/0/0，3文件 | 核心袭击、存录及真实production R1/R2坏档 |
| `--config /private/tmp/brogue-commander-20261009-5e1/review-r1-probes.config.ts --maxWorkers=1`，初始5项（probes.log） | 1 | 0/5/0 | UI实际失败；4项先撞探针超容量前提，不能归为产品失败 |
| 同参数，修正容量后5项（probes-corrected.log） | 1 | 0/5/0 | UI/schema/原生变化4项实际失败；经济项末段elapsed前提错误 |
| 同config，`-t 'offset\|loss' --maxWorkers=1`（economy.log） | 1 | 1/1/4 | 小栈/耐久纯计划过；非周期尾水位直接比较失败 |
| 同config，`-t 'offset' --maxWorkers=1`（offset-watermark.log） | 1 | 0/1/5 | 诊断确认合法存读/水位未越界，仍停在尾水位比较 |
| 同config，`-t 'offset\|fall' --maxWorkers=1`（offset-fall.log） | 1 | 1/1/4 | 同时刻规范结算完整一致通过；第9层自生居民前提错误 |
| 同config，最终6项（probes-final.log） | 1 | 2/4/0 | 经济及小栈/耐久过；4失败对应F1两现象、F2、F3 |
| `src/test/phase3b_action_lifecycle.test.ts -t 'cached\|failed floor\|polymorph' --maxWorkers=1` | 0 | 5/0/18，1文件 | 普通缓存攻击拒绝、冻结恢复、失败楼层事务、原生变形取消守卫 |
| `npm run check:modules` | 0 | 不适用 | 模块边界、测试归属通过 |
| `git diff --check` | 0 | 不适用 | 空白检查通过 |
| Python只读逐文件与HEAD比较、JSON递归diff | 0 | 九冻结9/9；trace6/6 | 以下静态事实 |

外部最小复现脚本为 `review-r1-probes.test.ts`，config仅继承仓库配置并将include/cache定位外部；没有复制生产算法或拉长超时。最终脚本可直接复现F1/F2/F3，失败断言保持预期正确行为；只有以上记录的诊断/布景修订，无生产修复。没有维护多版本源树或重采golden。

本轮验证裁决：

- E1-A及S1/S2：四实际组合普通物化；原实体/HP/动作、eventId、windup/actionId/锁定格/资源缓存冻结；超过32周期暂停、返回未解围再次离层、真正死亡结束后恢复；第二营真实需求/有限订单独立推进。原生变形/坠层例外见F1，不能据基础路径通过称全部生命周期通过。
- E2-A/E3-A：一次真实非零摘要、25%总量/耐久保底、已有原生敌人保留、无残敌、仅实际region重武装；信息发布仍有F2。空营、五营四槽及原第五营延期后准入、无完整落点重试、整批物化writer回滚均在所跑文件通过。
- S3/S4/S5：合法订单和真实custody、待产物、退款；原S4 17段缓存等价与坏档拒绝/只读零写；settlement及+combat公开击杀解围→恢复录像、save/load/seek/续录；解围/排除水位/非零摘要/实际修缮HP之后writer失败回滚与重试、玩家死亡冻结。Earned信用布景边界见②。排除96037 tick后，解围再下有限订单、离场80137 tick的长/分段结果在同一结算点相等，订单剩余周期归零，没有刷新32周期寿命。
- paid repair：材料向上取整、最小100 tick、No/陈旧CAS拒绝、真实扣料/耐久、失败原子性通过；源码复核距离、owner、层、source revision及inventoryStamp。静态损失按种类总量分摊，4个1件小栈仍损失1件；已有25%或更低耐久不再伤，25%抗性窄例过；预留箱排除见生产写集，未声称全目录穷举。
- 配置：默认关、未知/缺席owner/身份错配拒绝与原活局保持通过；manifest→factory→Game及load/replay/seek从存录重建配置，未见菜单偏好参与载入。严格schema/引用有F3；5D2 `ResidentOrderValidation` 收窄未使真实缺production的R1或取消待产物放大的R2通过（整文件23项过）。
- 九冻结文件 worldSdk、edibleSdk、worldEdible、kindKnowledge、actorNeeds、stats、worldHarness、forageHarness、forageFixture/index 均等HEAD。6份trace递归静态差量严格只有：crafting natural及foraging natural/hearth各 `final.digest`，giants natural/colossus/spine各 `extensionsHash`；合计6个身份相关摘要字段，无其它叶变化。本轮没有重录或建立历史多版本归因源。

本轮结束：仅交发现及结果摘要，等待父交原作者修复；不自行继续下一轮。

## 第2轮独立复核（最后一轮，2026-10-09）

实际分支 `ext/phase5`，HEAD `5c34f50f56bcf85f4cee890ae80dec87fa927831`。先读 AGENTS.md、三份必读文档、批准任务书§1/§6/§7/§8、作者报告末尾R1修复摘要及外部 `fix-r1.READY.md`，随后检查三项修复对应的当前源码、HEAD差量和相关回归。范围限R1-F1/F2/F3的关闭与直接回归；未重新全面审查5E1，未派代理、修改生产/既有测试/合同/状态卡/golden、采截图或提交推送。R1原文及原6探针/config保留。

### 逐项裁决

| 项目 | 状态 | 本轮证据与边界 |
| --- | --- | --- |
| R1-F1 | **confirmed-open**（直接新问题；原两项失败已关闭） | 原公开变形与幸存坠层保存失败均不再复现。四组合同身份变形、长暂停存读/返回，真实fall的实体/HP/pending/目标层、后来真死亡、非末成员持续袭击与末成员关闭、排除水位保留均通过受影响回归；同输入玩家随最后幸存成员坠层亦通过。新生命周期字段可伪造解围，见R2-F1。 |
| R1-F2 | **closed** | `StructureProduction.ts:847`统一取已发布`report`；`SettlementRaids.ts:630`保留实际region机械发布。原同层未入region探针通过；真实非零摘要、存读、重复只读零写、实际region一次发布及重复wait不重报通过。 |
| R1-F3 | **closed** | `SettlementRaids.ts:548`按安装规则核验宽限/due/压力水位/阶段暂停/冷却；`Game.ts:11797`先验证候选引用，随后才派生缓存许可。原宽限矛盾档及另外三组矛盾时间均拒绝，活局完整对象图及原bundle/资源保持；合法冻结存读/返回继续动作通过。R2-F1改的是新坠离事实，未改事件时间，不归作原F3复现。 |

缓存许可静态复核：`SettlementRaids.ts:581`仅派生active+paused、未坠离、真实同营层、存活、当前形态匹配、单格无bodyMember的身份；`ActorActionProduction.ts:97/:134`仍要求combat bundle全部source属于自身。普通缓存攻击拒绝与原生变形取消守卫实测通过。关闭路径`SettlementRaids.ts:151`保留已排除时间，不调用奖励或追补生产；原经济长/分段探针通过。本轮未穷举全部形态/奖励/日配额。

### R2-F1 · P2 · 新坠离登记可由候选档凭空宣称，真实敌人尚在营地层也能关闭事件

位置：`src/engine/Core/SettlementRaids.ts:563`仅在`departed===null`时检查存活实体的营地层归属；`:567`对非null坠离只检查声明目标层与下界时间。`src/ext/settlementRaidSchema.ts:167`起的生命周期codec没有独立转移核对。随后`SettlementRaids.ts:146`无条件把非null登记视为有效成员已退出，`:151`提交关闭。

触发与独立复现：seed `51020001`、settlement+combat、启用袭击，通过既有受控营地前缀和公开wait产生第1层active事件。没有发生原生fall，原成员仍在第1层、存活、未处理死亡且非盟友。取得`g.toSnapshot()`，**只把每条`event.actors[].departed`改为`{depth:2,tick:event.lastAttemptTick}`**，不改actorIds、实体位置/形态/HP或事件时序。`h.load(JSON.stringify(candidate))`接受；随后公开wait把同一事件关闭，原2名存活敌人仍在第1层。独立输出摘要：`accepted=true, depth=1, phase=closed, livingHostileOriginals=2, declaredTargetDepth=2`。

复现脚本：外部 `review-r2-probes.test.ts:50`，命令见下表；最后“必须拒绝”断言失败（实际false），其前的实体仍真实在营地层及错误关闭断言均通过。此项仅确证手改新生命周期登记的坏档能伪造解围；没有声称正常原生fall会错误关闭、任意普通怪物获缓存攻击许可，或已发生伪死亡/掉落/XP。原R1的正常保存失败已修复。

建议父核对新坠离事实的可信校验及终结授权，保持真实幸存旅客实体和合法后续原生转移。作为最后一轮确认的玩法/存档正确性遗留，按两轮政策处理末次窄修/受影响测试或登记5Z，注明上述影响；不新开第三轮，本审查不实现修复。

### 本轮实际命令与结果摘要

仓库根执行；实际Node `v24.19.0`，Vitest `v4.1.11`。所有批次串行、`--maxWorkers=1`；“过滤”来自`-t`，没有新增skip或调整超时。缺CE启动提示不影响所选测试，本轮没有CE依赖skip。公共前缀：

```sh
export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
node node_modules/vitest/vitest.mjs run
```

| 实际参数/检查 | exit | 通过/失败/过滤 | 结果 |
| --- | --- | --- | --- |
| `--config /private/tmp/brogue-commander-20261009-5e1/review-r1-probes.config.ts --maxWorkers=1` | 0 | 6/0/0，1文件 | 原6探针原文未改：变形/fall合法存读、未入region保旧报告、宽限矛盾档拒绝、有限订单长/分段等价、损失分摊/耐久保底 |
| `src/ext/modules/settlement/tests/settlement_raids.test.ts src/test/phase3b_action_lifecycle.test.ts src/test/c_5_fall_subsystem.test.ts -t 'R1-F\|combat S1/S4\|S1/S2\|S4\|S5\|cached\|failed floor\|polymorph\|高血怪\|飞行怪' --maxWorkers=1` | 0 | 20/0/43，3文件 | F1四组合、F2发布、F3坏档活局原子性、暂停/结束无追补、普通缓存攻击及原生守卫 |
| `--config /private/tmp/brogue-commander-20261009-5e1/review-r2-probes.config.ts --maxWorkers=1`，当时只有同输入坠层1项，初次 | 1 | 0/1/0 | 已关闭且真实幸存；XP等值失败65→135。第10层初访合法奖励`20+5×10=70`（growth/module.ts:455），是探针前置遗漏，非袭击奖励失败 |
| 同上一命令，当时仍只有1项，补目标层先访问后 | 0 | 1/0/0 | 只改外部场景前置，保留精确XP/gold/death事实断言：同输入末成员与玩家坠层先关闭、pause=null、排除累计保持、目标层幸存实体、存读一致 |
| `--config /private/tmp/brogue-commander-20261009-5e1/review-r2-probes.config.ts -t 'forged departure' --maxWorkers=1` | 1 | 0/1/1 | R2-F1确认；新文件共2项，仅选坠离坏档探针，拒绝断言失败 |
| `src/ext/modules/settlement/tests/settlement_raid_replay.test.ts -t 'R1-F1\|S4 public' --maxWorkers=1` | 0 | 4/0/1，1文件 | settlement及+combat的公开变形→暂停→返回、原击杀→关闭→恢复：save/load、完整replay与关键seek一致；实际耗时776.78s，没有延长超时或重启 |
| `git diff --check` | 0 | 不适用 | 本轮追加文本空白检查通过 |

各批不累计重叠通过数。外部新增仅上述2项；首项前置修订原因如实保留，原6探针、既有测试及正确行为断言未弱化。未再跑全量/npm test/完整组合、整套drift、类型/build、性能或浏览器。

### 未覆盖与父下一步

已有5Z中的全原生形态/盟友奖励/giants自然路线、writer×阶段矩阵、真实劳动赚信用连续链/全部日配额、组合/删除/最大负载、完整门禁及浏览器/真机继续作为**未覆盖**，不计作失败或已关闭，也不阻止本步按用户政策收口。范围外没有追加新审查。R2-F1单列为**已确证正确性遗留**，不能并入覆盖缺口或冒称已关闭。

父下一步：核对R2-F1，按最后一轮政策安排原作者末次窄修及受影响测试，或把确证遗留及影响登记5Z；同步维护者状态并裁决收口，不开第三轮独立审查。仅交本轮结果摘要和外部探针，不再采集截图、重建版本源或封存原始证据。

本轮完成后停止共享树及外部证据写入；停写交接为 `/private/tmp/brogue-commander-20261009-5e1/review-r2.READY.md`。未commit/push。

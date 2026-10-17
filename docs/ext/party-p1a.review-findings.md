# Party P1a 独立审查 R1

结论：**需修**。确认 7 个新问题：2 个阻断、5 个重要。浏览器、数值平衡、云端长基准均未作为缺陷；本轮未修改仓库文件、未 commit，也未启动子代理。

审查基线：`e3ec8f49f8a7c6f827ecb04dac7304a441c960e6`，对象为当前全部未提交实现。已读 AGENTS.md、HANDOFF、development、architecture、P1a 任务书、party 合同及实施报告；按 M1–M11 已批准推荐解释规格。作者 `source-final.json` 所列 782 个生产/工具文件逐文件重新 SHA256 比对，差异为空，与报告生产身份 `557da273c38260f704f44965fe1cefef171366cad3b2963342a90319d0b82eb4` 一致。

## 新问题与复现

以下脚本均在仓外，加载当前仓库生产代码。脚本内只对新建 Game 做受控布景，真正触发动作通过公开 executeCommand / submitPartyIntent；不修改生产实现或测试守卫。执行目录为仓库根，统一复核命令：

```sh
'/Users/coolking70/Documents/同步空间/rea/.tools/node-v24.18.0-darwin-arm64/bin/node' /private/tmp/p1arev1/probe4.mjs
```

将脚本名替换为各条标明的文件即可复现。Vite SSR 在沙箱内打印 WebSocket EPERM 提示，但模块加载及探针正常完成、exit 0；日志保留，未把这个环境提示作为缺陷。

### R1-F1 — 阻断：非主成员遇火会调用不存在的 Monster 方法

位置：`src/engine/Core/Game.ts:10481`、`:13544`、`:13580`。

新增状态循环把所有 ControlledActor 送入 `resolveBurningDamage`，而该函数及 `exposeCreatureToFire` 仍以 `entity !== this.player` 判为 Monster，调用 `isInvulnerable()`。PartyMember 不是 Monster，没有此方法。

复现：`probe4.mjs` 的 `FIRE_MOVE_THROW` 场景。seed42、party-only 两人，清敌，将两成员置于干地，B 相邻格设 PLAIN_FIRE，确认回调返回 true；A wait 后，B 通过公开 move 进入火格。实际抛出 `TypeError: entity.isInvulnerable is not a function`。`probe3.mjs` 另验证 B 已有 burning=4 时，两人 wait 推进到客观块同样抛错；回滚后仍 burning=4、revision=1、B ready，重复推进会再次失败。

预期：按受控成员火免疫/燃烧规则结算，不进入 Monster 专属方法。需要审清同类 `entity !== player` 分支；仅给 PartyMember 填一个空方法会隐藏身份分类遗漏。

证据：`/private/tmp/p1arev1/probe3-node24.log`、`probe4-node24.log`。

### R1-F2 — 阻断：状态伤害全灭后不结算终局

位置：`src/engine/Core/Game.ts:12443`，关联 `:10465–10474`、`:16599–16601`。

`settleDue` 遇 HP≤0 直接把成员标为 dead 并 continue，跳过包含死亡处理的 epilogue，也没有调用队伍死亡清理/全灭入口。因此 `triggerGameOver` 中的工作取消、动作退役、死亡收据及全灭判断可被绕过。毒伤循环还把“不是当前命令 actor”的成员死亡计入怪物击杀，并调用怪物掉落。

复现：`probe4.mjs` 的 `ALL_POISON`。正常模式两人、清敌，两成员 HP=1、poisonAmount=2、poisoned=3；依次公开 wait。实际输出：

```json
{"hp":[0,0],"life":["dead","dead"],"kills":1,"gameOver":false,"ready":null,"events":3}
```

无活动成员、无冻结幸存者，既无法继续也没有恢复入口，却没有结束游戏。预期两名成员均走一次死亡清理，全灭只结算一次，成员死亡不增加怪物击杀数。

证据：`/private/tmp/p1arev1/probe4-node24.log`；单成员毒死的辅助输出见 `probe2-node24.log`。

### R1-F3 — 重要：目标选择未完成时可换层并冻结原执行者

位置：`src/engine/Core/Game.ts:4347`、`:4355`、`:4401–4423`。

`partyModalActor` 限制只在 actor-step 分支检查，party:control 的 travel 没有同一确认/目标选择锁。留守检查也未把 modal 成员视为不能冻结的执行者。

复现：`probe5.mjs`。A 持传送魔杖，公开 use(target:null) 进入目标选择，B 位于下楼梯；用 B 发 travel-party 到 D2、leavingBehind=[A]。命令被接受，A 成为 D1 frozen，但目标选择仍绑定 A。此时 B wait 报 `DECISION_REQUIRED`，escape 报 `ACTOR_FROZEN`，save 报 `DECISION_REQUIRED`。这是公开产品命令组合，不依赖伪造 slot/revision。

预期：目标选择期间拒绝此控制命令并保持全部状态，先完成/取消原 actor 的选择。不能用跨层动作绕过目标和 actor 锁。

证据：`/private/tmp/p1arev1/probe5-node24.log`。

### R1-F4 — 重要：恢复其他留守层会移动仍冻结的发起者

位置：`src/engine/Core/Game.ts:4413–4415`、`:4430–4451`。

recover-level 只要求目标层存在 frozen 成员，允许另一个冻结层的成员作为 issuer。提交时在 issuer 的 actor scope 内调用 generateDepth，原生入层放置会移动 issuer；后续仅恢复 moving 集合的位置，没有恢复不属于该集合的 issuer。

复现：`probe.mjs` 的 `RECOVERY`。三人，B 留 D1，C 留 D2，A 到 D3 后死亡；用 B(actorId18) 发起恢复 D2。实际 D2 仅 C 激活，但 B 坐标从 `(7,17)` 变为 `(45,6)`，B 的名册仍为 frozen/D1。未选中层的冻结实体已经被改写，之后恢复 D1 会使用错误位置。

预期：要么在接受前拒绝与目标层不一致的恢复 issuer，要么使用目标层实体完成入层并保留其他冻结实体完整状态。当前 HUD 恰好选目标层成员不能替代引擎公共边界的守卫。

证据：`/private/tmp/p1arev1/probe-node24.log`。

### R1-F5 — 重要：客观块只检查当前命令成员的坠落位

位置：`src/engine/Core/TimeCoordinator.ts:186`、`src/engine/Core/Game.ts:12480`，关联 `:504`、`:13854`。

环境结算已给每个成员写自己的 falling 位，但 advancementLoop 仍只读当前命令 actor 的位。其他成员刚被地形置为 falling 时，调度可以返回其人工决策点，而没有执行强制坠层。

复现：`probe3.mjs` 的 `STANDING_FALL_AFTER_A/B`。A 在 CHASM、B 在干地，清敌；A wait 为同 tick 第一输入，B wait 推进客观块。块末 A 的 `native.falling=true`，却仍 depth1、active，ready 返回 A(actorId1)。预期本块就应由 A 坠至下一活动层，B 冻结，不能先给 A 再做一次人工动作的机会。

此条只依据“已明确置 falling 位”的复现；`probe2` 中悬浮恰好到期后逃离的额外观察未作为新问题依据，避免把既有原生时序缺口算入 P1a。

证据：`/private/tmp/p1arev1/probe3-node24.log`。

### R1-F6 — 重要：成员原生潜行属性缺少各自环境来源，主成员查询还依赖其他 actor scope

位置：`src/engine/Core/Game.ts:744`、`:1200`、`:3451–3455`；`src/engine/Stats/NativeStatSources.ts:148`（native.stealth-range 分支）。

configureNativeStats 只配置主成员；次成员 darkness/shadow/rested 来源全部缺失。主成员的 darkness 回调调用已改成读取 commandActor 坐标的 playerInDarkness，形成“查询 A，却使用 B 的环境”的路径。Game.player 引用虽未替换，属性查询仍受当前执行作用域污染。

复现：`probe2.mjs` 的 `NATIVE_ENV` 将两成员置于相同黑暗/阴影环境，原生潜行范围 A=3、B=14。`probe4.mjs` 的 `NATIVE_SCOPE` 将 A 位置设亮、B 位置设暗，保持阴影相同、显式失效缓存后读 A：A scope 值7，B scope 值3；同一 A 的原生属性因执行别人的作用域而改变。探针替换 lightMap 的纯环境读函数，只用于固定环境输入，没有改属性公式。

预期：每个成员初始化和 load 后都绑定自己的环境读取，A 的属性不随其他成员执行上下文变化。敌人目标切换时也需复核 stealthRange 是否来自实际目标。

证据：`/private/tmp/p1arev1/probe2-node24.log`、`probe4-node24.log`。

### R1-F7 — 重要：party 存档准入没有落实完整成员身份/所在层约束

位置：`src/engine/Core/WholeRunSnapshot.ts:523–539`；`src/engine/Core/PartyState.ts:24–38`；`src/engine/Core/PartyRuntime.ts:50–54`。

当前只检查 actors/native 与名册彼此数量一致、活动成员在当前层。没有与不可变开局配置的成员数对照，没有要求冻结层真实存在，临时召唤身份也未拒绝。声明的 assertMemberEligibility/assertPartyRuntime 并未被生产路径调用，partyWorldRead 的 resident/raider 还是固定 false。

三个独立负例均被 loadSnapshot 返回 true：

1. `probe.mjs` 的 COUNT_SAVE：合法两人 party-only 的诊断快照中，同时删除第二实体、对应 roster 和 native 行；manifest.configuration.members 仍为2。读后只剩1人。P1a没有招募/解散/墓碑归档入口，这不是合法运行状态。
2. `probe6.mjs` 的 unvisited-frozen-level：开局 D1 的 B 改为 frozen/D2，D2从未生成且没有缓存层，仍被接受。
3. 同脚本 temporary-member：给 B 的 statusDurations/maxStatus 加 lifespan_remaining=100，仍被接受，违反 M3 临时实体不得成为成员的约束。

预期：在替换活局前通过真实 roster/entity/manifest/层根/身份联合准入，拒绝以上档，保持活对象、双流、allocator。不能仅依靠有 recordingOrigin 的摘要校验，因为本项目明确允许读取无来源诊断快照，机械图本身仍必须合法。上述临时身份负例不是要求实现 P1d 招募。

证据：`/private/tmp/p1arev1/probe-node24.log`、`probe6-node24.log`。

## 用户要求逐条判定

| 核查项 | R1 判定 | 依据与范围 |
|---|---|---|
| 无 party 局字节/行为不变 | 所选基线通过；静态未发现新增偏差 | 惰性 declare party / 双 codec；ext_party_inert 对 classic、extended空集、growth、loot、八模块比较完整 own keys、save/replay SHA、双流、消息；固定时间而不删除新字段。仅四次等待，不称全部行为穷举。本轮还将作者基线副本750个生产/工具路径与 git archive e3ec8f4 比对：生产文件相同，唯一工具差量是 test-suites 增加 party_capture 测试登记；fixture 与原始 baseline.json 相等（baseline-audit.json）。 |
| 单步 actor 事件、录像/存档身份、拒旧 | 主要格式分支符合；准入需修 F7，交互锁需修 F3 | parsePartyInput/authorizePartyInput 严格键、slot/revision、readiness；F21/S8/R5/O3 与 F20/S7/R4/O2 由 manifest 路由，party 域纳入 event/full 和 Worker；旧/错 codec 负例在相关测试。 |
| 交换、楼梯、坠层、仅留守者恢复（M2） | 需修 F3/F4/F5 | 交换验证整叠/部分数量、容量、装备、busy、八邻接墙角；费用只发起者。正常楼梯/单次坠落/返回恢复已有测试，但其他成员环境坠落、跨冻结层 issuer 和 modal→travel 漏守卫。 |
| 成员身份排他、居民互转守卫（M3） | 实体分离及现有居民入口符合；读档需修 F7 | PartyMember extends ControlledActor，不是 Player/Monster；常规居民命令只找 monsters，ResidentValidation 拒不存在的居民实体；不存在正式招募。不能把未接入的 eligibility helper 当作已落实的存档守卫。 |
| growth XP 分池与加成顺序（M4/M6） | 所查执行路径符合，死亡入口受 F2 影响 | growth/module.ts:94–99 先稳定ID整数分池保留dead share，再 award:192 单次 growth.xp-gain；member 分支不再 player/ally 二分；普通盟友只把原player份放入队伍池；真实双人伤害/死亡参与者回归。辅助白名单限定已提交定时效果，指纹中有标识。未声称穷举所有辅助或死亡时序。 |
| 共享掉落归属、rarity-find、拾取过滤（M7） | 所查路径符合；状态死亡误计怪物见 F2 | kill/part 用因果 creditActorId，经 partyDropCredit 固定主成员 fallback；floor/vault/encounter 保持主成员；runtime:2231 读取 input.playerId 属性；局级过滤和金币不复制，实际 commandActor 拾取；共享账本未拆分。 |
| 非主成员独立属性、不篡改 Game.player（M8） | 需修 F6；火/死亡能力分类另见 F1/F2 | 没有执行前后换 player；creation identity、装备、growth 和 loot scaling 排除能力基本接通，但原生环境读取未按 actor 完整适配。 |
| MainMenu 多成员创建与单次 initialCommand（M9） | 所查实现符合，真实 SFC 创建链回归通过 | party roster 稳定 ordinal，growth 一个 create-party 批量命令；引擎分配 actor IDs；保留配置草稿 structuredClone(toRaw)、会话/重试保护。无新增同owner多命令绕过。 |
| 冻结成员计时平移（M10） | 所查执行路径符合 | growth objectiveTime 对未参与的成员平移 startedAt/expiresAt/readyAt，focus不恢复；原生活动枚举排除 frozen，世界/居民唯一时钟保留；真实技能效果→留守→推进→save/load→返回回归。M2恢复位置缺陷不等于计时平移失败。 |
| 性能工具 party 场景本地冒烟（M11） | 通过 Node24 短冒烟 | 1/2/4 × party-only/party-all × A/B，rounds1/steps2，三分片及 merge；独立 party-v1，旧phase6默认路线/预算保持。只证明工具闭环，不判性能通过。 |
| 同版本 save/load/replay/seek/续录确定性 | 所测正常路径通过；F1/F2/F3/F5使若干合法场景不闭环 | 生产 Worker 1/4成员长边界及自然双人跨层；非周期 save、2048 seek、续录测试。短性能冒烟各自独立 full oracle、回放、RNG一致。不能用“同样重放出错误状态”掩盖玩法缺陷。 |
| 模块边界与全删 | 通过所查范围 | 本轮 boundary exit0，测试依赖686文件/errors=[]；核实作者全删副本模块目录为空；用本轮生成的4人party-only/all存档录像独立复跑缺包拒绝，保活对象/完整快照/两流/allocator/前缀，classic续录成功。仅 retain=none，不称其它布局通过。 |
| 共享补口未越权 | 未发现范围越权；功能缺陷按上列处理 | 改动集中于授权 actor能力、时间、实体图、growth/loot/营地消费者、创建和独立party性能工具；未修改现有 worldSdk/itemSdk/residentSdk 等公共SDK文件、未改旧预算、未扩P1b/P1c/P1d/P2/5C2内容。没有放宽boundary或现有断言语义。 |

## 实际运行记录与证据边界

- 首批默认 Node25.2.1 启动相关 Vitest 后发现与指定版本不符，在尚无用例结果时中止，exit130；日志 `related.log` 原样保留，不计通过。
- Node24.18.0 重跑以下相关整文件集合，单worker、无文件并行、heap3072MiB：

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run \
  src/ext/modules/party/tests \
  src/test/ext_party_inert.test.ts \
  src/test/ext_creation_combinations_ui.test.ts \
  src/test/party_perf_tools.test.mjs --maxWorkers=1 --no-file-parallelism
```

- 相关测试结果：**exit0，8文件 / 78项通过，423.66秒**（tests 418.21秒），`/private/tmp/p1arev1/related-node24.log`。包含生产 Worker 1/4成员2049命令、自然跨层、MainMenu精选配置、growth/营地/冻结、无party字节及性能工具测试；没有失败/skip。通过现有回归不关闭本轮独立探针发现的7条缺陷。
- `node scripts/check-module-boundaries.mjs`：exit0，`boundary.log`。
- `node scripts/check-test-dependencies.mjs`：exit0，686文件、errors=[]，`deps.log`（大日志仅仓外）。
- Node24探针 `probe`、`probe2`、`probe3`、`probe4`、`probe5`、`probe6` 全部完成。它们输出实际错误行为，exit0只表示采证脚本完成，不代表产品通过。
- Node24全删拒档独立复查：exit0，`delete-rejection.json`、`delete-recheck-node24.log`。原副本完整门禁结果沿用作者 `delete-gates2.json`，本轮没有另跑types/build或整套删除门禁。
- 性能：Node24.18.0 三分片与 merge 全部exit0，六组comparable=true、status=smoke-only、budget=null。结果见 `perf24-exits.json`、`perf24-merged/result.json`；每侧真实生产Worker、存读/回放/full oracle/OOS=0。此为当前树 A/A 工具冒烟，steps2，不承担长尾或优化收益结论。原 Node25短冒烟也全部exit0，六组comparable=true、status=smoke-only、budget=null；不累计为更多独立测试。
- 未运行完整npm test/test:ext/drift、CE/gen、浏览器、云端长基准或其他删除布局。没有为审查写入仓库或更改旧测试。

完成时再次逐文件核对作者生产/工具782文件，仍无差异。

当前新问题均未修复，本轮不冒称独立关闭。建议修复后第2轮集中复验上述7条、对应受影响测试与必要边界，遵守最多2轮限制。

# 阶段 3 + 4 统一收尾门禁报告

同一最终冻结候选的正常树七门全部通过；15/15 行实际物理删除的五门全部通过。完整默认 npm test：414 文件；7617 通过 / 8 skip / 5 todo。三项旧测试前提已归因并处理，独立审查第 1–4 项已修复并补回归。**浏览器全面验收：待维护者执行。**

## 1. 冻结候选与环境

依据 [统一收尾任务书](closeout-3-4.task.md)及[维护者转交的独立审查](closeout-3-4.review-findings.md)执行。分支 `ext/phase4`，HEAD 保持 `7f6de966658276c2325eb5059c4b3cf4ada4940e`。没有 commit、push 或暂存本轮改动。

最终候选：2,348 个输入文件，SHA-256 **`41c3a3aee8b24e93067713440026de3e713b1042324a15b4e65282f63c0a6790`**。使用官方 `scripts/check-module-removal.mjs` 的 `hashCandidate`，按既有规则排除 `.git`、依赖、构建产物、缓存、`tsbuildinfo`、`.ce-reference` 等；未增加源码排除。每项正常门禁前后、每行删除前复制及原树均核对该 hash。本报告在门禁结束后新增，末尾另列逐文件核对结果，避免把报告本身当成已执行测试的输入。

- Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`。
- `NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`；darwin arm64、10 CPU、32 GiB。
- CE 缓存 `.ce-reference/BrogueCE-master` 实际存在，删除副本保留；没有通过删缓存制造缺源码 skip。本任务未运行 `ce:fetch`、CE 的 `test:full` 或 `test:gen`。
- 原始证据全部在仓库外：`/private/tmp/brogue-closeout-3-4-20261006-uxgwgfik`；最终七门及15行矩阵位于其 `closeout-complete/`；前两轮七门和中止矩阵在 `closeout-final/`、`closeout-refrozen/`。日志、逐文件 hash、反事实副本、实际删除副本及 smoke JSON 均保留。

## 2. 冻结前核对

底座 `foundation=5`，descriptor、模块声明、manifest、rules/state 与各阶段版本一致；各模块没有必装内容模块依赖。版本未因测试归属调整而改变。

| 模块 | module/rules.version | rules.schema | state | fingerprint |
| --- | --- | --- | --- | --- |
| combat | 1.5.0 | 1 | 3 | `sha256:d904271664e4c5cb5bdadc0e3388db3c1546fbf4ccef8cb7f3415fd2a8310fb7` |
| giants | 1.0.0 | 1 | 1 | `sha256:3e3d244e6ce036beb8717509c0712e8f6b621fbd7f05a82b1bf43dbc817032e8` |
| growth | 1.7.0 | 1 | 组件严格 codec，无顶层 schema | `sha256:ac7108ce2bcbb775a317baa4bdc0db07f4f7513c10b5d84491c9086d85d952c2` |
| narrative | 1.4.0 | 1 | 4 | `sha256:9ea296bd831838437026abda8ffec6bacf9f4b2edd104e6667eeec3b7b7067e8` |

实际独占 provider：`combat.part-break.v1` → combat；`growth.combat-stats.v1`、`growth.public-character.v1`、`growth.story-reward.v1` → growth。重复模块注册/启用拒绝；四个独占 provider 各以正反注册次序验证重复拒绝，合计 12 项核对全部通过。`combat.event.v1` 是已经批准的多订阅者事实协议，允许不同 consumer，拒绝同一 consumer 的重复 `eventKinds`，不把它误当成独占 provider。narrative 的实际 `foundation.story.v1`/`combat.event.v1` 订阅保留。

发现器得到常规 414、gen 27、drift 4、ext 158 文件，共 445 文件。ext 包含 61 个底座文件，其中 30 个真正底座 phase4 文件；原独立 `body-fixture` 声明、身体/转换/状态/环境/录像底座测试在所有物理删除行保留。历史 4f 报告的 32 文件统计不追改；本轮把两个纯 combat 文件归还模块，详见第 5 节。

`preflight.json` 保存完整版本、指纹、provider/consumer 和测试清单。Vite SSR 核对启动时出现沙箱 HMR `listen EPERM :24678`，核对实际完成、退出 0；此日志不作为浏览器执行证据。

## 3. 三个旧测试的归因与处理

三个原测试均先保持未经编辑，执行仅改变一个生产文件的反事实；处理只修测试前提，不回退已接受的生产行为。

| 旧测试 | 旧前提及原因 | 单变量证据 | 最小处理 |
| --- | --- | --- | --- |
| `c_4b_dungeon_feature` | 血迹直接使用 `this.hp`；`413303d` 的 zone 提前提交 HP 后，血迹须使用记录的 `hpBefore` | 仅回退 `Creature.ts` 普通血迹调用的 HP 参数，原整文件 **31 项通过，exit 0，4.347s** | 检查受伤前 HP 记录及两处血迹调用使用 `hpBefore`；原 `Monster.super.takeDamage`、扫描器、白名单等断言保留 |
| `gameplay_layout` | `ContextPanel.vue` 直接调用六参数 `sidebarEntityRows`；`087bafc` 已改成 displayedFrame/publicSidebarEntityRows → MonsterGroups → 原模型，并处理群体可见性和隐藏核心匿名化 | 仅将完整 `ContextPanel.vue` 恢复为 `087bafc^`，原整文件 **4 项通过，exit 0，0.415s**；同副本类型检查 **exit 0，7.132s** | 断言现有适配器链及内部原六参数模型；命令零调用、RNG、stealth 等断言保留 |
| `x4a_movement_rendering` | 普通近战只传 `enemy`；`413303d` 加入 `lunge=false`/`bodyHitContact`，普通 rat 的 contact 为 `undefined` | 仅回退 `Game.ts` 普通命中 helper 的一处参数，原整文件 **21 项通过，exit 0，5.657s** | 检查只调用一次且参数为 `enemy,false,undefined`；坐标和回合断言不变 |

原命令统一为 `npm exec -- vitest run <对应测试路径> --maxWorkers=2`；sidebar 的类型检查为 `npx vue-tsc -b`。恢复当前生产文件后，副本官方 hash 精确回到最初候选 `2fc45313ae8048a36bce1e271714138bc5da783b2b8b187c6516c93c04866e67`；同时运行三个未改原测试，再次得到 **53 通过/3 失败，exit 1，5.859s**。有效历史 Context 文件实验取代了早期不完整调用替换探针，完整日志均保留。

证据：`attribution/results.json`、`confirmed-results.json`、`confirmed-attribution.json`。处理后的直接相关 7 文件 **151 项通过，exit 0，Vitest 11.50s**。没有新增 skip、exclude、超时或基线修改。

## 4. 独立审查第 1–4 项

### 4.1 同体 split 绕过再生守卫

原逻辑仅阻止 `phase`，而 split 重建 active 槽位与空破坏收据，确实能复制复活断腿。`Game.ts` 现在拒绝任何非 copy 转换：结果与源使用同一 body definition，且源有 `appliedBreaks` 或 removed 槽位。安装期 `bodyTransitions.ts` 也拒绝主动 split 结果 form 等于 source form。合法主动 split 夹具改用 ridgeback 结果。

`phase4e_body_transition` 补运行时负例，验证完整对象图、RNG、ID 不变，并补安装负例；既有 clone 继承破坏收据/墓碑正例继续执行。同形健康底座诊断转换与 copy 的原合同保留。

### 4.2 成员传伤死亡的统计及玩家后置处理

原 `finishBodyMemberDamage` 对所有来源无条件增加 kill，而玩家近战后置又排除 peripheral。现在传伤出口仅处理一次核心死亡/事实；近战、投掷、毒在各自原生入口按直接命中核心的既有规则结算，伤害前捕获核心身份。命中腿致核心死亡与直接命中核心，统计、掉落、武器熟悉度口径一致。玩家 bolt、怪物/盟友、非玩家 projectile、地形/爆炸、未归属来源不会因成员传伤额外得到 kill；毒沿既有原生计数规则。投掷不额外引入近战专属随机掉落或熟悉度。

`phase4d_terminal_identity` 新增六类来源负例、核心/腿真实近战与投掷对照、只断腿不杀核心负例，并增强原八类死亡入口计数断言。原 native 携带物死亡处理保持一次。

### 4.3 转换成本作用于所有结果核心

严格按维护者决定执行：`tryActiveBodyTransition` 对源核心及 `resultGroupIds` 去重，给全部存活结果核心应用 `move.ticks` 等待；copy 保留的源核心同样付成本。忙碌核心沿已有转换锁，空闲核心使用原生计时，不增加第二套行动时钟。

phase/split/clone/summon 四类回归检查全部核心及存读；新后代不再比保留核心早约 100 tick 获得下一次行动。原支付一次与失败回滚断言保留。

### 4.4 忙碌 owner 的偷袭延迟

实际复现普通 1×1、复合核心、腿命中后，直接 `ticksUntilTurn +=` 被 scheduler mirror 覆盖。两条 Combat backstab 分支现在经可信原生 world/核心身份调用 `delayOwnerRecovery`：延长活跃子动作末尾 recovery；已经处于 recovery 时同步增加剩余时间，保留 windup/segment release 时刻，并行子动作不重复累加核心总耗时。

`nativeRecoveryDelayTicks` 是已计入终末 duration 的累计收据，不是独立倒计时。严格 codec 校验整数/预算、fresh action 禁止预注入、原 attack recovery 加收据的精确时长；坏档只改收据或 duration 均拒绝。中断保留延迟，嵌套 native resolver 使用外层事务，缓存层不被推进。没有给 Game 增加字段，也没有放开普通生物的 spatial/actionLock 能力；开发期曾尝试空间锁方案并被原守卫击中，最终撤去该方案。

`combat_adapters` 新增三类真实忙碌偷袭、时间推进与 save/load/坏档回归；`phase3a0_scheduler` 新增累计延迟、正在恢复、嵌套 release、收据和预算原子性用例。

### 4.5 复现、反事实与直接验证

修复前生产候选加回归：3 文件 93 项，**15 失败/78 通过，exit 1，17.37s**。最终直接相关 7 文件 **220 项通过，exit 0，28.21s**；giants 两文件三份自然 trace **通过，exit 0，18.60s**。本轮新增 27 项测试（审查修复回归24项，其中ext增加20项、常规集合另含4项底座scheduler回归；另增加3项combat单独启用的原生尺寸闪避覆盖）；生成基线与黄金 trace 没有重录。

六组反事实均仅改一个生产文件，原新回归恢复失败；每次结束精确还原审查修复候选 `304255947e2fdc1b27fb23758b0d18663c2b758e06f375f0375c4b9532ec8d63`：

| 反事实 | 唯一生产文件/恢复内容 | 结果 | 墙钟耗时 |
| --- | --- | --- | --- |
| 1-runtime | Game，同体运行时旧守卫 | 1 失败，exit 1 | 1.954s |
| 1-install | bodyTransitions，移除安装守卫 | 1 失败，exit 1 | 1.711s |
| 2-count | Game，旧成员死亡计数出口 | 6 失败，exit 1 | 3.604s |
| 2-melee-post | Game，旧近战后置分支（内联原 peripheral 判定） | 1 失败，exit 1 | 1.868s |
| 3-all-waits | Game，旧转换等待出口 | 3 失败/1 通过，exit 1 | 3.072s |
| 4-backstab | Combat，两处旧镜像写法 | 3 失败，exit 1 | 2.695s |

实际 `npm exec -- vitest run ... -t ... --maxWorkers=2` 命令及逐文件 hash 见 `review-attribution/results.json`。这些 `-t` 探针的未选项是过滤结果，不混入正式 skip。开发阶段 opts.grid 引用、未用 helper、Array.at 的 TS 目标问题及新测试事件序列预期均已修正；失败日志保留，不算最终通过。

## 5. 冻结前补修测试归属与可选组合前提

审查修复候选在 ext 全通过后，物理删除诊断发现旧 `phase4e_recording` 把 combat 当作必装。未改原测试在仅删除 combat 目录的旧副本中 **6 通过/2 失败，exit 1，29.275s**；仅恢复原 combat 目录，原 8 项全通过（exit 0，16.291s），再删回目录后副本 hash 精确回到 `6b7ee66705b57c469fafab8336a095307103f7857ba513dd2a3861eff5b0053e`。因此主动停止当时的完整 npm test，修正归属后重新执行全部门禁。

- `phase4d_body_actions`、`phase4d_rest_relations` 完全依赖 combat，整文件移入 combat 自有 tests/清单。
- travel_ai、playable_recording、4e_recording、declarations、body_lifecycle 中的 combat-only 用例移入模块；`combat=false/true` 前提分为底座 false 与模块 true。38 个搬移注册节点的回调经 AST 提取/去空白 hash 比较，全部保持等价，证据 `ownership-callback-verification.json`。
- 3g/4e 的 phase/split 事务仍归底座；genuine stagger 归 combat，正式 Colossus split 归 giants。共享观察夹具在 narrative 存在时继续实际 consumer；不存在时仅独立 `body-fixture` 订阅底座事实协议，没有提供同名空壳内容模块。无 growth 时检查 unavailable，并独立验证旧源/伪造 actor 的 scope 无效；存在时保留原 available/Untrusted 断言。
- combo 输入按 catalog 的实际已装模块生成全部合法子集，涉及底座 effects_rewards/lifecycle/4a0 黄金图、combat runtime、giants composite/zones、growth composite。正常树原组合全部保留。双资源等跨模块内容域按实际发现的对方模块声明输入；物理缺少该内容时没有该组合输入，明确区别于新增 skip 或排除测试文件。
- combat part-break 回归改用已经存在的独立 `body-fixture.spine-crawler`；历史几何、区 HP/倍率、回退 50 ticks 等数值相同，全部原断言继续执行。giants 的正式 zones/natural trace 保留。无 growth 时资源按首次使用惰性分配，stagger 回滚夹具通过实际 `applyActorPoiseDamage(...,1)` 初始化资源行后捕获基线，失败回滚身份和成功硬直断言不变。

没有增加 `it.skip`/`skipIf`、清单 exclude 或放大超时。没有改生产行为迎合必装测试，也没有重录黄金图。拆分后正常定向验证 18 文件 131 项及 6 文件 70 项通过。新增缺 combat 命令负例固定时钟，完整断言预期拒绝消息/logger ID，其他 snapshot 字段逐项保持。

| §0 定向物理删除诊断 | 文件/测试 | 墙钟耗时 | 退出码 |
| --- | --- | --- | --- |
| keep-giants-growth-narrative | 125 文件；2094 通过 / 0 skip / 0 todo | 754.566s | 0 |
| keep-combat | 94 文件；1815 通过 / 14 skip / 0 todo | 232.667s | 0 |
| keep-growth | 98 文件；1773 通过 / 0 skip / 0 todo | 230.117s | 0 |
| keep-none | 61 文件；1138 通过 / 0 skip / 0 todo | 163.660s | 0 |

这些是§0四个实际删除副本的全部剩余ext诊断，均用官方`npm run test:ext -- --maxWorkers=2`及完整清单；不能替代下面完整15行矩阵。最终诊断与冻结候选hash一致。

第五轮冻结前另修正两处历史空 suite 注册前提：`combat_square_replay` 的两组 giants 用例与 `combat_foundation_dodge_gate` 的整个 mask suite 原先固定注册外层 describe，内部按 catalog 生成输入。删 giants 后输入为空，Vitest 报 `No test found in suite`，并非8项combat本体用例失败。两个未经编辑的原文件在该删除副本复现 **2文件失败、8项通过、exit 1，5.810s**；仅恢复冻结树的整个 giants 目录后 **2文件/37项全通过，exit 0，14.024s**。再删除该目录精确还原副本 hash `6bca146f06a10dbab908563f28743d2f7b225aafd51177a2730dc120d3675f79`，原树仍为 `ffdec577…`。证据为 `empty-suite-attribution/results.json`。

跨模块 suite 改为外层 `describe.each` 实际 descriptor 注册，giants存在时原全部回调与有效断言继续执行。原生1/2/3格r0闪避用例的所有断言保留，输入扩大为combat单独启用、以及giants存在时的原组合，新增3项不依赖giants的真实原生覆盖；不会产生空文件、空 suite，也没有skip。修后正常两文件 **40项通过，exit 0，Vitest 13.59s**。最终物理缺模块定向诊断特意包含这两个文件。


第六轮冻结前，实际删除combat再次暴露底座`phase4d_production_body`的历史输入域`[false,true]`：`combat=true`无条件请求缺失模块。原整文件缺combat时**20通过/1失败，exit 1，11.460s**；仅恢复冻结树的整个combat目录后**21项全通过，exit 0，12.262s**；再删除目录精确还原副本hash `0f7c9f076587669bdd914e900cf0c311440c271fd6bf7e01059d1633b5b603aa`，原树仍为`39b65816…`。证据`production-body-attribution/results.json`。仅将布尔输入改为实际已安装combat子集，正常树仍生成false/true两组；缺combat时保留独立底座false组，回调和所有核心位置、成员时钟、冷却、命令断言不变。没有移除测试文件、skip、修改守卫或扩大超时。

因此额外对保留giants/growth/narrative、仅combat、仅growth、全删四副本跑**全部剩余ext**，而非此前8至14文件的定向集合。各副本实际模块/发现器/文件数与原始命令均在 `ownership-diagnostic/full-optional-preflight/diagnostics.json`；结果见本节表。这是最后一次重新冻结前验证，正式结果仍只使用第6至7节。

## 6. 正常树完整七门

| 门禁实际命令 | 实际结果 | 墙钟耗时 | 退出码 |
| --- | --- | --- | --- |
| `node scripts/check-module-boundaries.mjs` | 通过 | 1.625s | 0 |
| `npx vue-tsc -b` | 通过 | 7.098s | 0 |
| `npm run build` | 通过 | 9.621s | 0 |
| `npm run test:ext -- --maxWorkers=2` | 158 文件；2858 通过 / 0 skip / 0 todo | 850.041s | 0 |
| `npm test -- --maxWorkers=2` | 414 文件；7617 通过 / 8 skip / 5 todo | 1804.974s | 0 |
| `node scripts/check-module-composition-smoke.mjs --engine-only --output /private/tmp/brogue-closeout-3-4-20261006-uxgwgfik/closeout-complete/normal-smoke.json` | 16 引擎组合通过；浏览器未执行 | 71.268s | 0 |
| `npm run test:drift -- --maxWorkers=2` | 4 文件；5 通过 / 0 skip / 0 todo | 53.078s | 0 |

同一冻结候选的一次完整默认 `npm test`，不以定向集合拼接；全部 `test:ext` 使用共享发现器与清单。所有门禁实际命令、起止时间、退出码和输入前后 hash 见 `closeout-complete/normal-gates.json`，每门独立原始日志在同目录。

16/16 已安装模块子集的真实 Game 新局、游玩、save/load、逐条 replay、seek 0/1/末尾与续录均通过；校验 tick/turn/depth/player loc、两流完整 RNG 和 extension checkpoint。giants 组合按脚本实际自然层路径执行。drift 为 4 文件；5 通过 / 0 skip / 0 todo，包括两份普通生成基线和 giants 三份自然 trace；原基线/黄金数据未改。

## 7. 实际物理删除矩阵

实际命令：

```sh
node scripts/check-module-removal.mjs --profile=removal --engine-only --maxWorkers=2 --output=/private/tmp/brogue-closeout-3-4-20261006-uxgwgfik/closeout-complete/removal
```

发现并实际执行 **15 行、75 个门禁命令**，全部退出 0；runner exit **0**，墙钟 **7449.364s**。脚本如实返回 `partial-browser-not-verified`，因为指定 `--engine-only`；所有实际删除行的 status 都为 `passed`。

每行在当前冻结树的独立副本删除整个模块目录及其中的数据/资源/自有测试，清缓存；核对删除前副本 hash 与原树一致、目录实际消失、只减少其所属测试、剩余模块集合正确、底座 fixture 仍在。每行执行 boundary、类型、build、全部剩余 ext、全部剩余子集 smoke；removal 档不重复完整 npm test。依赖包共享、缓存独立；CE 缓存保留。

下表五门耗时顺序为 **boundary/type/build/ext/smoke**，单位秒；退出码顺序相同。ext 数量是实际测试摘要，组合数是实际 Game smoke 数量，不能把 plan/prepare-only 计入结果。

| 保留模块 | 实际删除模块 | ext 文件；通过/skip/todo | 剩余 Game 组合 | 五门耗时（秒） | 退出码/行结果 |
| --- | --- | --- | --- | --- | --- |
| combat+giants+growth | narrative | 148；2596/14/0 | 8 | 1.606/6.870/9.461/796.675/39.417 | 0/0/0/0/0；通过 |
| combat+giants+narrative | growth | 121；2167/1/0 | 8 | 1.547/6.488/9.054/766.247/32.755 | 0/0/0/0/0；通过 |
| combat+giants | growth+narrative | 111；1940/14/0 | 4 | 1.496/6.383/8.787/708.084/16.284 | 0/0/0/0/0；通过 |
| combat+growth+narrative | giants | 141；2707/7/0 | 8 | 1.606/6.771/9.420/368.007/4.425 | 0/0/0/0/0；通过 |
| combat+growth | giants+narrative | 131；2461/14/0 | 4 | 1.615/6.638/9.355/301.493/3.209 | 0/0/0/0/0；通过 |
| combat+narrative | giants+growth | 104；2031/7/0 | 4 | 1.523/6.377/8.881/264.000/2.464 | 0/0/0/0/0；通过 |
| combat | giants+growth+narrative | 94；1815/14/0 | 2 | 1.489/6.251/8.655/230.205/2.141 | 0/0/0/0/0；通过 |
| giants+growth+narrative | combat | 125；2094/0/0 | 8 | 1.593/6.620/9.204/739.479/34.155 | 0/0/0/0/0；通过 |
| giants+growth | combat+narrative | 115；1861/0/0 | 4 | 1.537/6.319/8.923/691.363/17.505 | 0/0/0/0/0；通过 |
| giants+narrative | combat+growth | 88；1427/0/0 | 4 | 1.486/6.053/8.604/654.184/15.685 | 0/0/0/0/0；通过 |
| giants | combat+growth+narrative | 78；1221/0/0 | 2 | 1.448/5.915/8.347/637.234/8.660 | 0/0/0/0/0；通过 |
| growth+narrative | combat+giants | 108；2003/0/0 | 4 | 1.548/6.406/9.057/270.408/2.922 | 0/0/0/0/0；通过 |
| growth | combat+giants+narrative | 98；1773/0/0 | 2 | 1.522/6.362/8.858/225.565/2.324 | 0/0/0/0/0；通过 |
| narrative | combat+giants+growth | 71；1342/0/0 | 2 | 1.468/6.080/8.459/187.585/1.993 | 0/0/0/0/0；通过 |
| 无 | combat+giants+growth+narrative | 61；1138/0/0 | 1 | 1.428/5.883/8.369/162.493/1.730 | 0/0/0/0/0；通过 |

15 行共执行 **65** 个剩余模块 Game 子集。对每个子集，合法 save/replay manifest 加入每个被删模块的要求，验证拒绝且原 player/runtime 与 checkpoint/RNG 不变，共 **216** 次存档/录像拒绝检查。这是官方脚本的缺模块 manifest 输入检查，不宣称批量验证历史归档文件。所有行原树/复制 hash 都为冻结候选；删除后与五门后的输入 hash 逐行一致，61 个底座 ext 文件和30个 phase4文件始终保留，独立 body fixture 与 CE 缓存实际存在。逐行 hash、删除文件/测试清单、剩余集合、命令/起止时间/退出码/日志及 smoke 见 `removal/module-removal-results.json`、各行 `*-smoke.json`；复制副本路径记录在 `temporaryCopy`。removal JSON 中 `normalTreeFullGate.status=not-run` 表示矩阵不含完整树行；本报告第 6 节的独立正常树七门已完成，没有篡改脚本标志。

## 8. 真实 skip/todo 与未执行范围

最终正常 ext：158 文件；2858 通过 / 0 skip / 0 todo；完整 npm test：414 文件；7617 通过 / 8 skip / 5 todo；drift：4 文件；5 通过 / 0 skip / 0 todo。删除行真实 skip/todo：`keep-combat+giants+growth`：14 skip / 0 todo；`keep-combat+giants+narrative`：1 skip / 0 todo；`keep-combat+giants`：14 skip / 0 todo；`keep-combat+growth+narrative`：7 skip / 0 todo；`keep-combat+growth`：14 skip / 0 todo；`keep-combat+narrative`：7 skip / 0 todo；`keep-combat`：14 skip / 0 todo。

历史常规 8 skip：`p2_1_tick_architecture` 120/140（两份旧基线）、163/172（旧初始化/恒速口径）；`p2_2_real_speed` 455/492（两份旧基线）；`p2_3_objective_time` 358/413（两份旧相位基线）。历史 5 todo：`smoke` 130 的 hordes 红灯占位；`CombatFormulas` 233–236 的 slow/confusion/image/force 四项公式占位。它们未经本轮改动。

模块删除行中的 skip 来源于原 `combat_adapters` 的既有条件：缺 narrative 的四事实 producer describe、缺 giants/narrative 的复合体 describe、缺 growth 的 part-break 联动 it；原位置 232/291/332。本轮未增加条件 skip。跨模块测试域的可用输入减少与原 skip 数量分别记录；所有剩余文件仍由发现器纳入。

**浏览器全面验收：待维护者执行。** engine-only smoke 的 browser=not-run、整体 partial-browser-not-verified 不被改写为产品全面验收通过。六布局×四地图、CSS/GPU、320/390 真机触屏、历史帧/ACK/输入屏障及自然 combat/rest/giants 的本次构建全面验收由维护者执行，见 [3f 报告](phase3f.report.md)与 [4f 报告 §7](phase4f.report.md)。

## 9. 历史失败和中断记录

1. 最初候选 `2fc45313…`：boundary/type/build 通过；ext 151 文件/2835 项通过，894.351s。完整 npm test **404 文件通过/3 失败；7587 通过/3 失败/8 skip/5 todo，exit 1，1873.882s**。原因及反事实见第 3 节。
2. 旧前提修复候选 `209d933c…`：前三门及 ext 151/2835 通过（853.076s）；后续完整 npm test 被维护者中断，没有完整结果。smoke/drift/15 行矩阵没有执行，不计通过。
3. 审查修复候选 `30425594…`：前三门及 ext 151/2855 通过（961.734s）；发现删除诊断的测试前提问题后，本人中止完整 npm test，runner 退出 130，没有完整摘要。smoke/drift/15 行矩阵没有开始，不计通过。
4. `ffdec577…`：正常树七门全部通过（ext158文件/2855项、完整npm test414文件/7614通过/8skip/5todo、16个smoke组合、drift4文件/5项）；删除矩阵前三行五门通过。第四行扩展日志出现空suite异常后主动停止，runner退出130，第四行没有完整扩展摘要，后11行未执行；整个矩阵不计通过。七门原始结果在 `closeout-final/normal-gates.json`，中断记录在 `closeout-final/interruption.json`；修复与单变量证据见第5节。
5. `39b65816…`：正常树七门全部通过（ext158文件/2858项、完整npm test414文件/7617通过/8skip/5todo、16个smoke组合、drift4文件/5项）。实际删除矩阵前7行五门通过，第8行暴露旧combat=true前提后主动停止，runner退出130；第8行未完成全部ext，后7行未执行，整个矩阵不计通过。证据 `closeout-refrozen/normal-gates.json`、`closeout-refrozen/interruption.json`；修复与单变量证据见第5节。
6. 最终重新冻结 `41c3a3aee8b24e93067713440026de3e713b1042324a15b4e65282f63c0a6790` 后，从任务第1节第一门重新运行全部七门，再执行第2节。最终结果仅来自第6–7节，未拼接前五轮结果。

定向开发失败与诊断的新夹具前提问题（时间戳、预期拒绝日志、惰性资源行）均保存原始失败日志。它们不是最终门禁通过证据。

## 10. 已知限制与交付核对

- 玩家空间/入组、镜像、同体 regrow/再生、残骸、任意 species summon、阶段 5 军队仍关闭；size:4/正式 4×4 内容拒绝，合法 16 格 4×4 底座几何只是预算 fixture。见 [4f 报告 §2](phase4f.report.md)。
- 闪避仍是阶段 3c 的 independent native/r0 方形白名单，未因 mask、旋转或复合体能力自动扩大。见 [3c](phase3c.report.md)、[3d](phase3d.report.md)。
- 空间搜索仍受 32 candidates/128 nodes 等有限预算约束，不保证全构型全局最优；冷图/重规划和 P95≤5ms 目标不是所有完整命令/真机/GPU 的保证。4b warm 完整命令历史 P95 有 6.9/6.738/7.669ms，4d 17 实体整命令约 55ms，不宣称一律达 5ms。见 [4b](phase4b.report.md)、[4d](phase4d.report.md)最新性能段。
- 数值/内容为原型，有限 normal 布景可玩证据不等于 D1 至深层完整平衡路线。growth/narrative 为可选软联动，没有默认 Boss XP 或现成 giants 剧情。见 [4d](phase4d.report.md)与 [3g](phase3g.report.md)。
- 保留 4f 已列的历史火焰陷阱重入边界，本轮未宣称修复；旧版本与缺模块存档/录像继续拒绝，不做旧档迁移。
- 3f/4f 中“3g 未合入”等是各报告当时的历史状态；本任务 HEAD 已包含统一 foundation=5，不追改旧结论。

正常七门与15行矩阵结束后，冻结的全部2,348个输入文件逐一保持原 hash，唯一新增文件为本报告。HEAD 不变，暂存区没有本轮改动，`git diff --check` 通过；本轮文本为 LF，原始日志/大型证据仍在仓库外。最终交付核对记录在仓库外 `closeout-complete/delivery-verification.json`。没有 commit、push 或旧存档迁移。

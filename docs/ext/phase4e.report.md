# 4e 执行报告：主动换形、分裂、复制与召唤

基于 `ext/phase4` / `80640d1`，按 `docs/ext/phase4e.task.md` 执行。未暂存、commit、push。底座 foundation/manifest/快照协议保持 **4**；giants 的 module/rules 版本保持 1.0.0，正式定义变化通过 rules fingerprint 严格识别，不迁移旧 giants 存档或录像。浏览器验收按任务书交维护者，本轮不启动浏览器。

## 逐子项状态与证据

下面“已完成”指实现与专项已交付；最终冻结门禁的实际结果另列，不能用开发期通过数替代最终门禁。

| 子项 | 具体内容 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1.1 | 有限、数据驱动的 HP 阈值主动招式，正 tick、HP 费用与一次性收据 | 已完成 | `bodyTransitions.ts`；body_transition 声明拒绝矩阵、主动四类失败付费/耗时、后裔不得重复召唤 |
| 1.2 | 底座安装校验、引用闭包、深冻结；拒绝脚本、越权形态、坏数量/费用/HP 政策/成员映射 | 已完成 | runtime/schema；boundary 与声明专项 |
| 1.3 | 再生与镜像拒绝；同形态的阶段转换不得复活已破坏成员 | 已完成 | reason 白名单、same-body phase 拒绝与 clone 墓碑专项 |
| 2.1 | 主动换形/换体型与单体↔复合体共用 BodyTransitionRequest | 已完成 | shape/member 数量变化、单体→九实体→单体，核心 ID 保留 |
| 2.2 | 分裂二体/多体，正整数 HP 守恒含余数；不足 HP/容量拒绝 | 已完成 | 79→40+39、83→28+28+27 及容量拒绝 |
| 2.3 | 全结果虚拟 ID、地形/动态占位/区域/约束与区域预留，任一结果无位全部无效 | 已完成 | 原 3×3 腔无法放下两个 2×2；完整对象图、HP、ID、群表、RNG 无变化 |
| 2.4 | 真实 ID 仅成功提交推进，按结果/核心/约束树稳定顺序分配 | 已完成 | 二/三结果、显式映射和 no-fit allocator 断言 |
| 2.5 | 暂存无睡眠/性别构造骰或真实 ID 分配；需要的放置/性别抽样显式一次 | 已完成 | prepared 构造/clone；旧 body_lifecycle 抽样守卫及新 RNG 专项 |
| 2.6 | terrain、实体/群、HP、位置及 allocator revision 复核 | 已完成 | 抽样中实际改地形，stale 拒绝并完整回滚 |
| 2.7 | 实体/群表/预算/取消/事实一次提交；完整结构后应用真正进入格环境 | 已完成 | 全组先发布；统一 contact scope、保留实体的 previousBodies，环境故障回滚 |
| 2.8 | 出生/事实/消息/地图环境异常完整恢复费用、两流、ID、引用、群表、光照和派生计划绑定 | 已完成 | 四类故障完整对象图 oracle；旧 body_lifecycle 异常守卫原断言复验 |
| 3.1 | 核心保留 ID；成员按显式一对一 from/to 映射保留 ID；其余新建或退休 | 已完成 | 九实体→三实体，保留两个指定腿 ID、退休六腿，allocator 无额外分配 |
| 3.2 | 退休不发 death/kill/XP/掉落/死亡 DF；leader、carried、检视、抓持两端清理 | 已完成 | captureDeath 未调用、退休状态、外部 leader/carried 清理；原 terminal_identity/关系专项 |
| 3.3 | 3b/3d 已付款/蓄力来源取消、清旧预警，不重放/重付 | 已完成 | paid core windup、原 paid member windup/clone/poly 专项；正恢复与存读后缀 |
| 3.4 | 主动失败保留声明 HP 费用和正耗时，登记无效果，下一 tick 不无限重试 | 已完成 | 四个 reason 的失败矩阵；自然 no-fit 与 save/replay 失败收据 |
| 4.1 | clone/summon 所有实体全新 ID，深拷贝局部 zone/status/容器/群墓碑/冷却，内部 leader 重映射 | 已完成 | clone/summon 逐实体深引用断言、异构牵引距离下的断槽 partId 规划、四reason加速/减速clear矩阵、原 damaged whole clone 守卫 |
| 4.2 | clone 的每个部位出生来源指向原对应部位；新模板成员不冒充复制原核心 HP 加值 | 已完成 | readCreatureBirth 的逐部位 sourceId/nativeStatsCopied 专项 |
| 4.3 | 单次数量≤4，活动层生物≤128、扩展占格≤512；后裔继承 spent 集防再次施放 | 已完成 | 数量拒绝、实体/占格预算、连续复制至预算、后裔一次性收据 |
| 4.4 | 复制/召唤/分裂新增主体零奖励权利；原权利不翻倍，配置开启普通 clone XP 也不得绕过 | 已完成 | growth 正报价：原核心27、碎体13；split/clone/summon 副本0XP，原核心27一次 |
| 5.1 | 所有结果继承当前区域并整体受 movementBounds 约束 | 已完成 | seed7309 D7 两碎体全部真实占格在原场地，原区域/迁层专项 |
| 5.2 | split 后所有后裔绑定原 encounter，最后一位实际终结才 defeated 一次 | 已完成 | 原主先死亡仍 alive、存读后最后后裔死亡才 defeated |
| 5.3 | clone/summon 独立副本不加入原场地胜负 subjects，不继承 Boss marker | 已完成 | 复制碎体无 public boss tag，原 subjects 数量不变；副本存活不阻止原遭遇击败 |
| 5.4 | defeated/lost/escaped 与部分后裔终结、组件/区域/allocator/可达性严格校验 | 已完成 | subjects 多体 state/world 校验；中途死亡 save/load、原坏档矩阵 |
| 6.1 | 沉渊巨像正式原创“崩解”：半血→两个 2×2 岩脊形态、HP 守恒、只一次 | 已完成 | 正式 definitions.transitions；自然 D7 NPC clock 专项 |
| 6.2 | 自然生成遭遇可触发，给定验收种子与真实命令入口 | 已完成 | 7309 / wizard 自然路线 D1→D7，非注入生成；阈值伤量布景另明确标注 |
| 6.3 | normal 有限装备/治疗可击败未修改数值的全血巨像与两后裔 | 已完成 | seed7341 normal 遭遇功能布景：30HP、力量17、+6斧/+6锁子甲、最多两瓶治疗，实际 move/quaff |
| 7.1 | 换形/分裂前后及等待/失败期间 save/load、逐条 replay、seek、续录 | 已完成 | 四 reason 固定初始化，每条命令与多个 seek 点完整机械快照相等；失败收据后缀 |
| 7.2 | 无 combat 即时行为与有 combat 的已付恢复/资源/预警组合 | 已完成 | 新 recording/body 专项、原 3b/3d/4d、全部相关 combat 集合 |
| 7.3 | 篝火休息被隐身主体转换后出现的新敌情打断，只有一张 interrupted receipt | 已完成 | 实际 ext:command rest；转换清隐身→两实体出现，完整 replay/seek |
| 8.1 | 侧栏每个独立后裔一行；HUD 按同 encounter 聚合当前直接可见后裔 HP/最大值 | 已完成 | 两个可见后裔129/240，只见一个时只显示其公开 HP，不公布隐藏总数 |
| 8.2 | 旧帧保留原形态/129/260；显示不访问 live 状态、不消耗 RNG | 已完成 | before/current 两帧 HUD 独立、对象图/RNG 未变化 |
| 8.3 | 320/390 SFC 实际模板更新、后裔计数、单体切换与 ACK 隐藏 | 已完成 | transitions_sfc 两 host 宽度；真实 CSS/触控由维护者验收 |
| 8.4 | 报告、共享文件函数级清单、数据/种子/trace 归因和门禁证据 | 已完成 | 本文及 /private/tmp/p4e-* 证据；无 commit |

本轮逐项清单 **33 项已完成，0 项未完成**。实施剩余子项：**无**。维护者后续的浏览器人工验收：320/390 CSS 实际不遮地图、触控检视/瞄准与 ACK 历史帧切换；本轮 SFC host 没有 CSS layout engine，不宣称像素/GPU/触控验收通过。

## 实现边界与共享文件函数级改动

- `ext/bodyTransitions.ts` 新增请求、结果、主动声明、可信事实及有限安装验证；`Movement/BodyTransition.ts` 新增纯请求检查与整数 HP 政策。无脚本、任意随机数量、再生或镜像。主动 phase/split/clone/summon 的 clear 状态政策通过 `Monster.clearBodyPlanStatuses` 同步清状态及速度缓存，复制源仍保留原状态；被动polymorph继续原生速度镜像政策。
- `Game.transitionBody` / `prepareAndCommitBodyTransition` 是底座原子入口，纯准备→必需抽样→全批虚拟 ID 与落点预留→revision 复核→同步发布。主动 `activeBodyTransitionFor` / `tryActiveBodyTransition` 在核心/独立 NPC 的原生 prelude 后选择；不嵌套 executeCommand、不调用 playerTurnEnded。公开玩家输入仍沿原边界。
- `Game.polymorphWholeBody` 和 `cloneWholeBody`，以及独立原生扩展形态的 `cloneMonster`，改为同一入口；普通无能力 CE 单格路径保持。主动换形不套用“被动变形魔法不可对无生命/炮塔/无敌使用”的资格，目标原生模板决定新旗标；CE 被动物品资格不变，无 Boss 身份免疫。
- `Game.commitBodyTransition` 的窄写集增加实际 lightMap 与缓存层光照，以及 Game 自有 descriptor/键次序恢复。结构发布后的 tile 环境、机关、两流、光照、ID、列表、群表、原 action binding/source revision 共边界回滚。主动clear在完整结构后清保留实体的毒/火因果；阵营实际由盟友变敌人时发一次原生relationshipChanged通知，仍在同一窄事务内。没有新增 Game 字段，没有修改 U03 清单。
- `Monster` 新增两个可选字段：`bodyTransitionHistory?: string[]`、`bodyTransitionRewardless?: true`，仅使用能力的实体拥有；`copyNativeValue` 深复制 spent 数组；新增独立 `clearBodyPlanStatuses`，仅对未发布的主动转换值清除状态和被动速度镜像。`EntitySnapshot` 明列注册、按属性缺席编码、严格校验坏记录。没有旧存档迁移。
- `CreatureSpatial.squareMovementSize` / `rigidMovementFootprint` 允许有已安装主动收据的生产实体保存转换恢复锁；fixture 与无收据实体仍保留旧关闭边界。锁沿原真实 elapsed countdown 与 prelude 消费，既有 paid 计划计时镜像不被覆盖。
- `ExtensionRuntime` 安装冻结 bodyTransitions、核验历史声明闭包，暴露可信 bodyTransition facts；`captureDeath` 为零权利后裔附 `rewardEligible:false`。growth `deathCaptured` 只跳过该明确零权利事实；普通 clone XP 配置不会重新授予这份原权利。其余 growth 规则未改。
- `ext/types` 增加可选声明/事实和 tag 的公开分组键；`runtime.publicActorGroup` 与 `displayProjection.observeDisplayFrame` 仅给当前直接可见侧栏实体捕获组键。giants HUD selector 只消费冻结帧，按 encounter 合计当前可见后裔，独立后裔侧栏仍各一行。
- giants `state` / `validation` / `module` 支持有限多 subjects，split 增加后裔 marker，death/settled/region-exit 按每个主体更新，全部实际死亡才 defeated。无共享第二套 HP、实体列表或模拟时钟。

HP 费用目前是明确的 native HP 费用；不隐式额外收费 combat stamina。正耗时与 HP 费用在主动无位/预算失败时保留，异常则完整恢复。分裂的原奖励权利全部留第一结果，额外结果为零；原核心被杀可沿既有规则获得这份 XP，encounter 的 defeated 必须等待全部后裔终结。复制/召唤不复制原掉落、携带物或 paid action/资源账本；可选 growth 新生/clone 配置仍由该模块处理。

## 正式数据、数值与验收种子

数据在 `src/ext/modules/giants/data/definitions.json` 的 `transitions[0]`：`giants.colossus-fracture`，来源 `giants.abyssal-colossus`，HP≤1/2，200ticks、0HP费用、split、两个 `giants.ridgeback`，conserve/preserve/preserve/nearest。沿用现有原创岩脊兽的2×2原生模板（120最大HP、4–9伤害、100移动/攻击ticks），不另外复制一个同数值 species。129HP 示例得到65+64，总最大HP为240。数值临时且数据驱动。

自然验收种子 **7309**，wizard 沿既有 naturalFixture 的真实指令从D1到D7，沉渊巨像原3×3/260HP、16×12场地。新自然专项只把伤量/就绪条件布到129HP，然后真实 `wait` 经 NPC 选择触发；生成、出生、区域、ID不注入。验收方实玩可正常攻击至半血，观察崩解、两行后裔与一份可见 HP 池，先杀原 ID 后裔时仍未击败，再杀第二位才完成。

四 reason save/replay/seek 用 seed7339 的固定开局功能布景，初始化同时用于新局和 replay restart，不冒充自然深潜录像。normal seed7341 的有限装备遭遇同属功能布景，未改 Boss/碎体数值；不宣称普通深潜自然获得 +6 装备。

## 生成/trace 单变量归因

原新数据首次 `npm run test:drift -- --maxWorkers=2`：4文件中2失败/2通过，5项中3失败/2通过；三个失败逐字段都只有 `extensionsHash`。命令、原生对象、地图、ID、HP、群状态、两条 RNG 保持原值。

仅回退 **`src/ext/modules/giants/data/definitions.json`** 到 HEAD，其他本轮生产文件保持新实现、旧trace保持原字节，完整 drift **4文件/5项全部通过，exit0，54.30s**。随后恢复新定义；以原 `BROGUE_CAPTURE_GIANTS_TRACE=1 npx vitest run src/ext/modules/giants/tests/giants_trace.test.ts src/ext/modules/giants/tests/giants_spine_trace.test.ts --maxWorkers=2` 捕获，2文件/3项通过。没改捕获方法或断言。

| trace | 唯一字段 | 原值 → 新值 | 原因 |
| --- | --- | --- | --- |
| natural-trace / D3 | extensionsHash | deb56ea35e97751828efbca1312be782f191a106efe8b089ffcc77ade1deac7e → 07efe2dd34417e3e05f10be9bb76b44068f84098f527d32840a4c472305db9f2 | giants正式主动声明进入rules fingerprint |
| colossus-natural-trace / D7 | extensionsHash | b6a806199e09ccca4cd2dbb67c8c6c6882c9690c29bc665a35b0d0bbcdf8fa79 → 250908fddb929fa40c632bb17379807b13ba3a42e511ef8aa2106a14881a1091 | 同上，捕获点巨像仍全血、未转换 |
| spine-natural-trace / D11 | extensionsHash | 17b2e605c2b224c0e2399df4cfeb2cad3c56dff3ecb5603521109879dca8220b → 450076d56e03b07559dcef909700a4c6f69b0b2cbbc24b827139d6895071fea4 | 同上，原生命令和两流未变 |

普通生成两份基线及 UR2/3/4 黄金trace未重录。反事实 `/private/tmp/p4e-drift-counterfactual.{log,exit}`，首次失败 `p4e-drift-new-before.log`，重录 `p4e-trace-recapture.log`。没有修改旧守卫或旧测试前提，不需要旧前提修订裁决。

## 最终门禁

第六冻结候选全部门禁 **exit0**。统一 Node24.19.0，PATH前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。按任务书不运行完整 npm test、全部 test:ext、removal 或 CE full/gen，不启动浏览器。

| 门禁／实际命令 | 实际结果 | 退出码 | 门禁墙钟秒 |
| --- | --- | --- | --- |
| `node scripts/check-module-boundaries.mjs` | 通过 | 0 | 2.895 |
| `npx vue-tsc -b` | 通过 | 0 | 9.336 |
| `npm run build` | 通过 | 0 | 12.698 |
| `npx vitest run <141文件清单> --maxWorkers=2` | 141文件／3018项全部通过 | 0 | 868.196 |
| `npx vitest run src/ext/modules/giants/tests/giants_composite_natural.test.ts --maxWorkers=2` | 1文件／5项全部通过 | 0 | 480.401 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts -t 白名单 --maxWorkers=2` | 白名单1项通过；另29项因过滤不选，未改skip | 0 | 1.803 |
| `node scripts/check-module-composition-smoke.mjs --engine-only --output /private/tmp/p4e-v6-final-composition.json` | 16/16 engine组合；requestedScopePassed=true | 0 | 75.956 |
| `npm run test:drift -- --maxWorkers=2` | 4文件／5项全部通过 | 0 | 75.532 |

相关集合沿用4d最终137份清单，加本轮5份新测试，共142份：combat24、giants15、growth10、共享93。将独立长自然文件取出串行，相关批为141份；两批合计 **142文件／3023项全部通过**。共享集合覆盖4a0零影响、4a–4d、U03、UR2/3/4、原录像与读源码/i18n/仓库卫生守卫；新增5文件共51项（body34、recording8、giants4+SFC2、growth3）。没有新增skip/todo或改旧断言。

执行完整路径清单 `/private/tmp/p4e-related-files.json`，最终门禁及每条实际argv/退出码/输入散列 `/private/tmp/p4e-v6-final-gates.json`，各日志与`.exit`为 `/private/tmp/p4e-v6-final-*`。开始/结束UTC **2026-10-05T20:52:29Z / 2026-10-05T21:17:56Z**。933份生产/测试/脚本/配置输入在每门前后及最后报告补写时一致；路径排序的紧凑JSON路径→SHA256再取SHA256：**847e5ec184eb609cdf439af07bbdb4a3b7272a472bda6ace5ce907dda4d0aff6**。

composition JSON的engine.status=passed；由于显式engine-only，browser.status=not-run、整体passed=false、requestedScopePassed=true。本轮只宣称任务书要求的引擎组合验收通过，不将浏览器状态改写为通过。原始日志/散列/性能采样均留本机临时目录，不入库。最终`git diff --check`通过，无CRLF、无大于1MB新增证据，未暂存/commit/push。

开发期记录：首轮 groupKey 使用了仅允许小写规则ID的验证器，改为有限字段名校验；随后旧异常守卫暴露光照写集，新完整图用例暴露 Game 键次序，均修生产代码、未改守卫。新测试 flatMap 第二参数误传catalog、单格stress足迹和首次自定义初始化未先产生合法录像检查点已修布景/API。paid shape 测试暴露方形恢复锁尚未开放，按已安装收据能力开放生产出口，保留无收据和fixture关闭守卫。旧 lifecycle 与零影响回归原断言通过。

前两个冻结候选都在自然专项执行期间发生输入变化（分别是出生来源修正、断槽复制的真实 partId 修正），废弃；各自 boundary/type/build/natural 的通过不能拼作最终结果。两批自然专项各5项通过/exit0，但 hash 明确标出输入已变。第三候选的相关集合实际141文件/3009项中3008通过、1失败，exit1（878.24s）；旧 `phase4a4_movement_regions` 的诊断方形 rat 被过宽的 clone 路由送入要求已安装扩展形态的新入口。只修生产 `cloneMonster` 的已安装形态条件，旧守卫不变；随后旧movementRegions全文件与新body_transition共2文件/41项全部通过、exit0（11.84s）。证据 `/private/tmp/p4e-native-routing-green.{log,exit}`。第四候选运行期间又补充 clone/summon 清除状态后刷新速度缓存的边界与两项回归；定向2项通过，25项因 `-t` 过滤未选（不是新增skip），exit0（4.76s），证据 `/private/tmp/p4e-clear-status-green.{log,exit}`。第四候选相关集合实际141文件/3011项中3009通过、2项新状态缓存用例失败，exit1（825.13s），Game与新body测试两项输入在运行期间改变，排除出最终验收。第五候选从头执行；另在最终同一代码上完整补充旧movementRegions、新body27项与recording8项共3文件/51项，全部通过、exit0（40.08s），源码散列不变，证据 `/private/tmp/p4e-final-transition-regression.{log,exit}`；所有实际退出码、输入变动与日志保留于本机临时证据。

第五候选运行期间完成上述主动clear完整出口及可信状态/关系通知修正，Game、Monster、新body测试输入改变，故该批不用于最终验收；其相关集合实际141文件/3011项全部通过、exit0（909.13s），但输入散列明确标出上述三个文件改变。最新完整补充专项为4文件/79项（新body34、recording8、旧movementRegions16、旧body_lifecycle21）全部通过、exit0，68.75s；原被动polymorph速度/状态断言未变。证据 `/private/tmp/p4e-active-clear-regression.{log,exit}`。最终以第六冻结候选全部门禁为准。

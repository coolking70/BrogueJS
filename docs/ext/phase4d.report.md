# 4d-1 执行报告：生产群表、核心轮转与成员退休

基于维护者已提交的 `ext/phase4` HEAD `2adaf6a`，继续执行报告原“完整4d剩余项”1–8。本轮收束到可单独审阅的 **4d-1 子里程碑，尚未完成完整4d**。未暂存、commit 或 push。下文逐项列出剩余范围；文末保留 4d-0 报告原文，历史能力门描述以当时状态为准。

## 本轮范围

- 已安装模块可声明不可变 `nativeBodies`（body definitions + member break rules），所有 form 引用必须属于同一模块且来自其 nativeForms；快照只描述已安装闭包，不安装或授权数据。限制为 generation=0、无局部 zone 的成员/核心、≤17 实体/64 格、固定当前 pose、移除并退休子树、1:4 成员传伤；再生、镜像、残骸、重新挂接和非 immobile 的无支撑策略继续关闭。固定 zone 的 keep-zone 门未放宽，remove 走独立 `registerMemberBreakRule`。
- `createCompositeMonster` 按整组 preferred formation 纯预验几何、牵引、区域、外部占位和预算；失败不分配 ID 或 RNG。通过后以新 owned list 一次发布完整批次，并使用现有 generation token 缓冲出生事件。失败恢复 Game/群表/列表引用、runtime 状态、ID 与 RNG。新增独立全对象图 audit，覆盖已有破坏墓碑时第二组出生发布失败。当前 API 为引擎创建接缝；正式场地模板尚未接入。
- 唯一机械群表为可选 `Game.bodyGroups`，普通局无此字段；登记 `scripts/u03-state-contract.json`。前台 planner 的 `CreatureSpatial.groups` 引用本层群记录，服务本身临时、派生且及时 dispose。存档写在已有 `run.spatialWorld.groups`，未改存档版本；根闭包、typeId/form、HP/槽位、唯一收据、子树墓碑、约束、当前/缓存/休眠整组所有权均先验证再发布。pending、携带与整组实际迁移尚未开放。
- TimeCoordinator 三处候选/减时/决策过滤只保留独立生物及群核心，成员原生 ticks 不写。成员 readyInTicks 按真实 soonestTurn 减时，缓存层不减；核心在一次原生 prelude 后选择移动或最多4个即时近战源，来源使用独立 native attack scope，组耗时取 max，blocked/冷却中仍付正耗时。移动最多尝试8个核心邻步，每个邻步保留32候选/128分支上限。
- `BodyMemberHealth` 在中央 post-shield 出口扣成员 HP，按 floor(min(防护后伤量, 命中前正HP)/4) 直接扣核心 HP，不调用核心 takeDamage，不重复解算/护甲/符文/反伤/伤害 hook。核心仅补因果归属以保留原命中 credit；原生成员伤害 hook 完成后再退休。成员不走 die/kill/DF/掉落/XP 路径；父槽破坏退休整棵子树，只有直接破坏槽产生收据、传伤和减速。核心致死收敛为一次原生整体终结。
- part-break 请求扩展到真实 partId/body/generation=0，runtime 再经 Game 的已拥有活动槽核验。provider handled 与 fallback 互斥；异常恢复成员/核心 HP、破坏集、锁、护盾、runtime 状态和临时 effect ID。移动耗时从原生当前基础速度及唯一破坏集派生，读档不重叠乘；全支撑毁后不能移动但核心仍可近战。

## 共享文件的函数级改动

| 文件/函数 | 改动 |
| --- | --- |
| SpatialSchema: registerForm/registerBody/registerMemberBreakRule/permitsMember | 已安装声明授权、有限 remove 协议、成员几何门与闭包 |
| BodyGroups: validateBodyGroup/retiredBodyParts/bodyMoveTicks | 实体/form/槽墓碑与树退休核验、唯一收据派生减速 |
| CreatureSpatial: assertNativeSpatial/restoreWorld/collectBodyTargets/commitCompositeAnchors | 注册成员几何、生产群表预验、D08 group key、禁止原生单锚点撕裂群体 |
| CompositeMovement: cohort/planStep/commit | 生产活动成员及墓碑、存活支撑资格、派生正成本、完整群锚点发布 |
| MonsterLifecycle: ownedMonsterList | 每个生产成员必须匹配接收 Game 的已拥有槽，拒绝孤儿/跨会话发布 |
| Game: createCompositeMonster/takeBodyDecision/advanceBodyElapsed/killMonster/retireBodyEntities/toSnapshot/loadSnapshot | 完整出生批次、核心选择/成员冷却、无死亡退休、群根序列化及加载顺序 |
| WholeRunSnapshot: snapshotSquareWorld/validateProductionGroupOwnership/decodeWholeRunWorld | 已安装完整定义闭包、全层群根与不分裂物理归属 |
| TimeCoordinator: advancementLoop | 三处核心唯一过滤、真实 elapsed 成员冷却 |
| ActorActionProduction: validation/live host decisionOwnerId | 从已验证的 bodyMember 映射 core owner；尚未构造生产多来源 phased 束 |
| Creature: takeDamage；runtime: attachCreature/commitPartBreak | 中央成员 HP 接缝、完成伤害后退休、成员无 die、真实软接口身份 |
| BodyCombat: withZoneProtection | 成员 provider 失败恢复 pre-takeDamage 护盾 |

普通单实体旋转、place/teleport、polymorph 与 clone 不允许把群体拆成一个实体。整组坠落当前显式拒绝；诊断群体带 WILL_NOT_USE_STAIRS，移动拒绝 trap/auto-descent。**这些是未完成迁移/转换能力的门，不是完整4d的最终玩法策略。** 一般群体平移目前只结算最终各实体环境，尚未交付成员两子步的逐段环境接触/位移失败回滚。

## 数据、公开输入与验收边界

诊断定义在 `src/test/support/productionComposite.ts`，读取底座安装 descriptor 的数据声明，不导入 giants 实现或资源；`src/test/phase4d_production_body.test.ts` 经正常 registry/ExtensionRuntime、非 fixture catalog、真实 owned list 与 executeCommand 验证。8腿与16外围组均已运行；已有 fixture 多头/链轨迹保持回归。测试 arena/HP 安排是明确的诊断前提，**不是自然种子验收**；没有新增正式 species、场地、UI 文本、自然黄金 trace 或旧基线。

## 开发期功能门禁

运行环境为 Node24.19.0（PATH 前置指定 runtime）、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。按开发期功能政策，不跑完整 npm test / 全部 test:ext / removal / CE full/gen。旧测试、守卫和黄金 trace 未改。

开发中生产测试跨模块导入被边界拒绝，已改为读取底座安装声明；没有改守卫。原32项规划 + 新20项生产用例共52项局部通过后，冻结复核发现外围槽可使用固定 zone 保留的 `self` 名称，且活成员 HP 校验不足；新增1项声明/活成员校验回归并修生产入口。原 v1 门禁在相关集合运行期间发生这3个输入变化，结果为76文件通过/1失败、1608项通过/1失败（失败为新增校验用例），runner 未进入 smoke/drift。该候选废弃，不能拼接其结果；修复后生产专项21项单独通过，再冻结 v2 重跑全部门禁。

**最终 v2 同一冻结候选全部 exit0：**

| 门禁 | 实际结果 | runner 耗时 |
| --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 模块边界及唯一测试归属通过 | 1.547s |
| `npx vue-tsc -b` | 通过 | 6.763s |
| `npm run build` | 通过，保留既有大 chunk 提示 | 9.216s |
| 77文件相关 Vitest 集合 | **77/77文件、1609/1609项通过**；含32项原规划与21项新生产专项 | 422.406s |
| terrain catalog 白名单定向守卫 | 1项通过；`-t 白名单` 选择外的29项未运行，未新增 skip | 1.668s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16引擎组合通过**，`requestedScopePassed=true` | 66.640s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过** | 54.291s |

组合报告的 browser 为 `not-run`，整体 `passed=false`；只认本次明确请求的 engine-only 门禁通过，不宣称浏览器或生产复合体自然录像通过。相关集合覆盖4a0全对象差分、4a–4c、giants、combat/3a0/3b/3c、growth近战消费、出生回滚、固定 zone/part-break、实例/随机/whole-run/移层/录像、UR2/3/4、弹道/环境/护盾及仓库守卫。

冻结清单覆盖 `src/`、`scripts/`、package/tsconfig/vite 输入，共 **887文件**；每个门禁后 `changedInputs=[]`，运行前后相同。按路径排序的紧凑 JSON 文件→SHA256 清单再取 SHA256，值为 `3d90368d42653ea849d95b6cc0fdc3c6a6f23c265285d1a6c9fb4414dbb2fc21`。结束时间 UTC `2026-10-05T10:46:13Z`。原始清单/命令/耗时见 `/private/tmp/p4d1-final-v2-gates.json`，各门日志为 `/private/tmp/p4d1-final-v2-*.log`；组合详情见 `/private/tmp/p4d1-final-v2-composition.json`，废弃 v1 证据独立保留，不覆盖。

## 真实命令性能

核心+16外围共17实体在诊断 arena 追击，20次真实 `executeCommand(wait)` 均发生核心/整组位移。计时只包命令，不含建场、保存和断言：冷次 **17.213ms**，其余19次暖样本 **P50 14.472ms / P95 16.709ms**，最大 **17.213ms**。这是 Node 功能测试中的真实 Game 命令，不能替代自然种子、浏览器或手机性能验收；没有用 fixture planner 耗时冒充命令耗时。数据见 `/private/tmp/p4d1-final-v2-command-performance.json`。

## 完整4d剩余项（对应原报告1–8）

1. **部分完成。** 生产声明/群根/批量创建/当前缓存休眠 codec 已接。仍缺核心及成员 fixed-zone/攻击 profile/状态分类完整引用闭包、正式 generation/场地整组实算、arena 自然入口、逐子步环境接触与窄回滚；目前固定当前 pose、无 zone。
2. **部分完成。** 三处核心过滤、真实 elapsed 成员冷却、≤4 即时攻击/max 耗时、正 blocked 成本及真实17实体命令已接。仍缺有界远路/逃跑/关系语义等完整 AI 和多来源 phased 子动作选择，不能以即时近战当作3b完成。
3. **部分完成。** 中央1:4截断传伤、两个直接/area-damage part 各一次、core直接扣一次和因果归属通过。仍缺真实横扫/火球多腿路径与 growth/combat 消费的完整组合专项；mental 这里只完成 collect 的 group 去重，未完成状态归属。
4. **部分完成。** remove墓碑、链子树无死亡退休、唯一软收据/provider回滚、派生减速、全支撑毁后仍攻击、核心整体一次终结通过。仍缺完整攻击 profile 失攻派生、所有目标/关系/计划引用清理及实际 XP 收据组合验证；目前 sourceChanged 接缝已调用，真实多源 phased 取消尚未验。
5. **未完成。** 精神/关系群状态一 tick，成员毒/火/网局部状态，以及支配/纷争/群坠落/潜水的生产路由。
6. **未完成。** 单体↔群体保 coreID 的原子 polymorph、整组 clone 全新ID/深拷贝/无奖励、实际移层/pending、真正从开局命令生成群体的 replay/seek/续录；现仅有诊断 save/load 命令续跑确定性。
7. **部分底座接缝。** production scheduler owner 映射成员→核心，并在退休时通知 sourceChanged。仍缺 partId/generation 与3b定义的真实多源 phased 束、破坏/锁导致的取消恢复、存读/录像/真实冷却组合。
8. **未完成。** 公开核心/成员绘制和检视身份、Boss coreHP+成员概况、部分可见/历史帧/320与390验收、正式原创复合体与实算场地、仅giants（无growth/combat）自然击败种子。当前普通实体绘制不计为完整群体UI验收。

## 保留的4d-0历史报告

以下为维护者已提交的4d-0报告原文；关于能力关闭的陈述描述4d-0当时的状态。

# 4d-0 执行报告：复合体有界落脚规划底座

本轮执行 `docs/ext/phase4d.task.md`，基于 `ext/phase4` / `315fd8cb2e570d26f6cc23692f650e19b71005e7`。按任务书“可在干净子里程碑停下并列剩余项”，交付 **4d-0**。**不是完整4d，生产group能力仍关闭。** 未暂存、commit、push；用户原有未跟踪任务书保持原样。

## 范围与能力门

交付原生fixture的核心＋成员平移规划、树约束与连续轨迹验证、预算退化、一次性原子位置发布，以及已有entity/group/whole-run fixture codec的距离约束补强。八腿、多头、链形与17成员场景都不需要ExtensionRuntime或任何正式模块。

`CompositeMovement` 构造只接受 `SpatialCatalog.fixture`。Game的owned实体列表、原生动作/生产codec继续拒绝bodyMember；不能通过保存几何、实例化planner或提交伪造计划获得生产群体能力。没有给Game加字段、增加存档版本、规则随机调用、HP/冷却副本或新的群表。唯一机械群身份仍在 `CreatureSpatial.groups`；planner的WeakMap仅保存一次性计划凭据。

不开放成员退休/再生、身体旋转、局部伤害、实际NPC群调度或正式敌人。活动槽必须generation=0、life=active，尚不接受破坏墓碑。现有fixed-zone、nativeForm、经典/扩展战斗解算器、combat provider和giants内容均未改；另修复下述基线已有的经典射线适配器参数问题。

## 落脚与运动合同

1. 核心先确定一个邻步。按有根约束树、partId字典顺序求成员路径；父成员先于子成员，稳定性不依赖定义数组、群表数组或monsters数组顺序。
2. 成员在当前pose下枚举简单平移路径，最多两步；不穿墙到终点，也不借pose参数免费转身。保留旧落脚优先，然后按新核心＋preferredOffset的切比雪夫距离、路径长、终点y/x、完整路径y/x排序。每次递归最多32候选，整次核心移动尝试最多128个候选分支；可用更低诊断预算，不允许超过上限。
3. 所有路径共用最多两个单位子步；短路径之后驻留。每个子步的实际单位格方块使用相对线性运动的开放区间相交，拒绝腿互换、对角交叉及中途重叠，允许链段以相同速度跟进父段腾出的旧格。格边接触不等于占位重叠。
4. 每条父子约束以实际footprint的最近切比雪夫距离衡量。maxDistance要求每对格子许可时间区间的并集覆盖完整子步；minDistance要求没有格对进入禁止区间。这能捕获端点都合法、最近格对切换却造成中途过度拉伸的U形掩码反例。没有用动画采样代替生产验证。
5. 平移扫掠保守检查目的及两正交中间锚点，包含地图、全部身体格、区域和active-or-reserved外部占位。clearLink静态规则取稳定最近格对的supercover；运动期间要求可能连接的扫掠包围矩形全部无墙。此规则会过度拒绝一些弯道，但不会让连接隔墙穿过。
6. 无支撑资格、核心局部行动锁或移动失能返回immobile；地形/成员/约束无解或预算耗尽返回blocked。所有blocked结果都携正core movementSpeed成本，**调用者尚须在未来生产接线中提交该成本**；本轮不会自动写核心/成员ticksUntilTurn或推进状态/环境。
7. 提交只接受当前planner持有的一次性凭据。先复核群表、实体引用、HP/计时/局部资格、源位移revision、loc引用及可写性、地形/占位revision，重查全部轨迹；再同步发布最终锚点。没有任意环境或模块回调夹在半组位置之间。失败不写任何最终位置，重复提交、伪造克隆计划、离开再回原格、dispose旧会话都被拒绝。

## 共享文件函数级改动

| 文件/函数 | 本轮实改 |
|---|---|
| `Movement/BodyConstraints.ts`（新增） | `bodyConstraintOrder`稳定树序；`clearBodyLink`整数supercover；`bodyConstraintsSatisfied`按实际格对校验距离、父槽存在和clearLink。 |
| `Movement/BodyTrajectory.ts`（新增） | `trajectoriesCollide`连续单位格方块碰撞；`trajectoryConstraintSatisfied`连续牵引许可区间覆盖、最短距离禁止区间与保守连接扫掠。 |
| `Movement/CompositeMovement.ts`（新增） | fixture能力门、cohort/资格校验、最多32候选/128节点的确定回溯、正成本blocked、单次`planStep/commit`；没有Game/TimeCoordinator接线。 |
| `Movement/CreatureSpatial.ts::entityById` | 可信引擎/fixture的实体解析；不暴露给模块context。 |
| `Movement/CreatureSpatial.ts::restoreWorld` | 原有所有权/闭包验证后、发布群表前，增加实际footprint距离与clearLink验证；活孩子不能引用不存在的父槽。坏fixture图不替换旧机械群表。 |
| `Movement/CreatureSpatial.ts::dispose` | 解绑/释放派生服务后递增revision，旧位置计划不得继续发布。 |
| `Core/Game.ts::applyMonsterBoltHit` | 原BE_ATTACK的delivery标记只在有ExtensionRuntime时传递，经典路径恢复原选项对象，扩展射线仍绕过近战体力收费。命中/伤害/符文/状态公式及Combat.ts未改。 |
| `scripts/test-suites.json` | 新增复合体专项和独立射线参数回归的唯一归属；旧守卫/断言未改。 |
| `docs/ext/architecture.md`、`progress.md` | 登记本步边界和继续接线的责任。 |

## 与3a0/3b调度的边界

**没有接通生产actor-action。** `ActorActionScheduler`的核心owner、sourceEntityId/sourcePartId、≤4子动作、min边界/max耗时合同和TimeCoordinator原三处遍历保持原样。planner只给路径与正costTicks；运动的两个几何子步不引入另一份规则倒计时。

后续4d须把群核心映射为唯一decision/time owner，成员作为真实来源；成员generation还要进入来源验证/取消合同。即时攻击束或phased招式必须在可信actor-action会话内冻结来源、逐成员独立scope/冷却，收束后核心只提交一次max耗时。成员破坏、位移、变形或移层必须取消相应待段；不得从planner内调用成员takeTurn/endTurnWithAttack/playerTurnEnded或嵌套executeCommand。本轮只运行现有3a0/3b/3c相关回归，不把它们通过称为复合体组合已实现。

## 数据、验收入口与性能

fixture数据位于 `src/test/support/compositeScene.ts`：2×2核心＋8条1×1腿、3个头、1×1核心＋5段链、核心＋16外围成员。声明复用既有BodyDefinition/BodyGroupState/SpatialCatalog，不改原生怪物目录或giants规则指纹。首个八腿完整轨迹有显式坐标期望；链的连续四次动作逐实体断言向东一格；其余轨迹同时用独立密集时间采样验证连续碰撞/距离。单格几何另枚举2025组相对位置和单位速度，与独立33时点采样逐组对照。

没有新增正式敌人、场地、自然种子或自然复合体录像。旧seed7306/7309等仍是4a–4c内容的验收回归，不能充当本步自然复合体证明。

性能测的是17成员**fixture plan＋成功时commit**，不含建场/序列化/断言，不是executeCommand、NPC追击帧率或手机性能。20次定向尝试中15次成功、5次触及128预算后blocked，成员最多两步；这些blocked保留为有界算法的真实限制，没有改预算或把成功样本拼成全身可达结论。

最终同一冻结候选冷次 **1.803ms**，其余19次成功/blocked混合暖样本 **P50 1.569ms / P95 3.428ms**，最大分支128。Node24.19.0、两个worker的功能测试环境；只是这一小型诊断场景，不能替代真实Game17成员追击每命令测试。完整20次数据在 `/private/tmp/p4d-final-v4-performance.json`。

## 实际测试与结果

运行环境Node24.19.0（PATH前置任务指定runtime）、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。按本步开发期功能政策，不跑完整npm test / 全部test:ext / removal / CE full/gen。

开发首个候选 **3文件/83项全部通过**；新专项当时31项，覆盖上述几何、128节点退化、无机械随机/ID/时钟消耗、活动/休眠外部占位、腿隔墙、旧loc引用、单次计划、源离开再回、群共享、会话退休、引擎谓词变化、实体/群表fixture存读、whole-run坏牵引拒绝和生产能力门。首轮失败是新测试误用不存在的rng.getCallCounts、只读数组reverse类型、外部障碍布景落在旧腿格、以及误要求17成员有限回溯永不blocked；已修测试布景和记录真实算法限制，**没有修改任何旧测试、预算、断言容差或新增skip**。RNG的现有getState本就包含两流和两计数。

冻结复核时发现原地保留成员可能在非法地形/区域上仍得到planned、到commit才被拒绝；新增1项先红回归精确复现。补全起始整组fit检查后，新专项 **32/32项通过**，无位立即给正成本blocked。第一轮门禁在related期间主动中断，runner exit130，已完成的boundary/type/build各exit0；未运行后续smoke/drift，未把它算作相关集合通过。原证据 `/private/tmp/p4d-final-*` 与 `p4d-standing-terrain-{red,green}.log` 保留；最终候选改用独立 `p4d-final-v2-*` 全链重跑。

v2相关集合实际为 **71文件通过/1失败、1482项通过/2失败，450.12s，exit1**；后续smoke/drift未进入。两失败来自未改的 `w_4_bolt_reflection`：期待经典BE_ATTACK只有isWeaponAttack/grid，但合入的3c向所有调用追加了delivery=bolt。**只回退本轮原有唯一共享生产文件CreatureSpatial.ts**，新Movement模块随之不再被生产引用；原W4仍精确2失败/27通过，证明不是4d引入。证据 `p4d-w4-counterfactual.{json,log}`；回退在finally内恢复，无旧测试/断言修订。

按“撞上守卫改代码”修复Game适配器，仅ExtensionRuntime存在时交付扩展delivery标记。新增 `native_bolt_delivery.test.ts` 用真实Game经典/仅combat开局验证两类BE_ATTACK射线：旧生产2红；新生产保留经典原调用形状，扩展NPC体力已耗尽时仍有实际射线伤害、余额仍0，不误判成近战收费。没有去掉扩展分类，也没有删除/放宽旧W4断言。修复后 **4文件/81项全部通过**，含新两项、原W4的29项、3c原生体力18项和复合体32项；日志 `p4d-native-bolt-{red,green}.log`。最终候选使用独立 `p4d-final-v3-*` 重跑全部门禁。

v3在type阶段exit2：新射线夹具误用了不存在的Monster.damage字段，已改为原生damageString；生产字节未改。没有执行build/相关集合/smoke/drift，未算作通过。最终冻结候选为独立 `p4d-final-v4-*`。

**最终v4同一冻结候选全部exit0：**

| 门禁 | 实际结果 | runner耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 边界及唯一测试归属通过 | 1.537s |
| `npx vue-tsc -b` | 通过 | 6.706s |
| `npm run build` | 通过，保留既有大chunk提示 | 9.232s |
| 73文件相关Vitest集合 | **73/73文件、1486/1486项通过，0 skipped/todo**；含新增34项、4a0零影响完整图差分、4a–4c、giants、combat 3a0/3b/3c、UR2/3/4、U03、存档录像与源码守卫 | 410.549s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过，29项因名称筛选未执行；没有跑重型普查 | 1.637s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16组合通过**；真实新局、自然贡献、save/load/replay/seek/续录 | 65.585s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过**，普通两份生成基线与giants三份自然trace | 57.844s |

最终结束UTC **2026-10-05T09:34:00Z**。**883份**生产/测试/脚本/配置输入每项门禁后及最终均无变化；路径排序紧凑JSON散列集合SHA-256 **`1a548898b6219a572438a2077cfd415e2427155db9b2a9821d6c992b483da7bf`**。之后只补报告与progress。旧测试、生成基线和黄金trace均未改、未重录，不存在旧守卫前提修订。LF、git diff --check通过，截图/大体积原始证据未入库。

精确73文件清单 `/private/tmp/p4d-related-files.json`；最终runner `p4d-final-v4-gates.py`，命令/退出码/逐文件前后散列 `p4d-final-v4-gates.json`，原始日志 `p4d-final-v4-*.log`，组合结果 `p4d-final-v4-composition.json`。组合报告engine.status=passed、requestedScopePassed=true；browser=not-run、整体passed=false表示只完成任务指定engine-only范围，不能冒充浏览器产品验收。SSR HMR监听EPERM输出保留；engine-only实际exit0。

## 完整4d剩余项

1. 生产group声明/能力门及原生创建：成员原生数值、statusProfile/breakRule/attack闭包、群表全层codec/写集、批次出生与正式场地的整组路线验算。当前planner仍是fixture入口，移动候选不含旋转或等待后再迈步的路径；实际中间/终态驻留格的环境接触批处理及其异常窄写集也未接入。
2. TimeCoordinator三处核心过滤、真实soonestTurn递减成员冷却；核心移动与≤4即时/phased子段束的互斥选择、max耗时与无合法动作正耗时提交。补真实Game17成员追击每命令性能。
3. 原生受击按part路由、外围1:4截断传核心，不重复命中/RNG/符文/反伤/growth消费；两腿横扫/火球及整体精神scope的实际解算。
4. 唯一破坏收据、remove＋墓碑、抓持/leader/目标/计划入边清理、链子树退休、派生速度/失攻、全部支撑毁后immobile仍可攻击；将4c目前仅self/actorId=groupId的combat.part-break.v1校验扩展到可信成员身份，并一并验证provider或互斥fallback；核心死整体终结/XP一次。
5. 精神/关系群归属及局部毒火缠绕，环境/状态客观块各所有者一次；支配/纷争作用整组，坠落/潜水资格整组校验。
6. 被动polymorph单体↔复合体保核心ID、全组预检/回滚；clone全新ID/深拷贝/无奖励；整组换层/坠落/pending及实际save/load/replay/seek/续录。
7. 成员来源generation的3b招式组合、成员破坏取消待段及恢复时钟验证。
8. 公开核心/成员绘制、独立瞄准/检视、Boss核心HP与成员概况、部分可见裁切、历史帧隔离、320/390像素/触控；原创复合敌人和自然击败验收。

本轮没有新增显示功能，因此没有复合体像素证据，不宣称现有HUD能表达群体。4e主动换形/分裂/召唤、再生、残骸地形和镜像继续不在4d范围内。

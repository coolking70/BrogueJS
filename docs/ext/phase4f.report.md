# 4f 第一部分报告：配置手册、收尾补漏与独立性准备

基线：`ext/phase4`，`97988d5`（4a0–4e完成）。按 [任务书](phase4f.task.md) 执行；foundation保持4，未合3g、不commit、不push、不暂存。本报告的“已实现”是当前源码与专项证据，不表示已完成后文的统一收尾门禁。

## 1 交付清单

| 任务项 | 交付／当前状态 |
| --- | --- |
| 作者手册 | [giants-config.md](giants-config.md)：pack、原生形态、mask/pose/zone、body/part/constraint/break/status/attack profile、主动转换、生成模板、运行状态、预算、默认/省略、版本与软接口；三份完整JSON例子由测试直接读本文并经真实schema、模块工厂和Game安装验证 |
| 分裂名称 | 消息从move的source/result form和数量解析i18n名称；正式巨像消息为“沉渊巨像崩解，裂成2具岩脊兽！”；phase/clone/summon与失败也不再共用硬编码巨像文案；自然分裂测试比对实际后裔实体名 |
| 完整性补漏 | 16×16格对查询原可执行256次LOS，已按r3预算预选稳定128候选；测试覆盖失败不扩候选、重复顺序、成功短路、RNG与探索不变。其余已授权玩法对照见§2 |
| 独立性准备 | 原生产复合体/转换fixture借用giants数据，改为底座自有`body-fixture`声明与命名空间；真实installed registry安装、真实Game/NPC/codec/事务仍使用生产代码，无空壳giants。phase4底座测试补入test:ext发现集合；组合脚本新增纯`--plan` |
| 阶段状态 | README更新4a0–4e完成、4f第一部分及手册/本报告入口；统一收尾等待3g合入后维护者通知 |

生产改动仅：`BodyPerception.bodySightContact` 的LOS预算；giants模块`bodyTransition`消息及locale；测试发现与composition plan脚本。正式机械definitions、Game字段、schema、RNG算法与生成逻辑均未修改。

## 2 r3 §1–§14 完整性审计

对照全部章节及4a0、4a1、4a2、4a3、4a4、4a5、4b、4c、4d、4e报告，使用报告**最新完成部分**；各文末4b-0/4c-0/4d-0等历史未完成项不覆盖后来的完成记录。表中测试路径均相对仓库；自然/SFC/性能历史证据不冒充本轮浏览器或全面矩阵实测。

| 设计目标 | 实现与证据 | 已知限制／裁决 |
| --- | --- | --- |
| §1 正交刚体与复合体、模块可选 | SpatialSchema/CreatureSpatial/BodyGroups，giants自有pack/state/HUD；4a0–4e报告与本轮底座fixture | 玩家仍独立1×1；没有阶段5军队内容 |
| §2 消费/位置出口迁移 | [4a0审计](phase4a0.audit.md)登记281候选（44 footprint/142端口/95保留坐标）；后续真实Game多格/群体测试 | 格点物品、光源等仍可用锚点，不一概替换所有x/y |
| §3.1 mask/pose/zone/group身份 | SpatialSchema精确字段、连通/原点/标签/树/预算；phase4a0_spatial、phase4b_rigid_rotation、phase4c_fixed_zone_health | 不从字形/HP推尺寸；理论镜像枚举不授予生产许可 |
| §3.2 三种命中键与占位/死亡窗 | CreatureSpatial、SpatialContactScope、BodyCombat/BodyEffects；phase4a2_body_combat/body_effects、phase4d_terminal_identity | active/reserved/death-contact分别处理；连接线不是可受击实体 |
| §3.3 无能力缺席与零影响 | phase4a0_spatial_differential固定52观测点、普通pathing counters；普通对象不加spatial/group字段 | 历史基线只证明无能力组合，不承诺CE逐骰或新规则全局不变 |
| §3.4 模块内容与受控声明 | nativeForms/generation/bodyTransitions、runtime安装闭包；正式岩脊/巨像/棘脊/织兽及成员；giants_contract/config_examples | 无脚本、自定义死亡DF；模块仅硬依赖底座 |
| §4.1 平移/旋转/sweep/墙角 | RigidFootprint/SquareMotion/FootprintPathing/RigidPosePathing；4a1与4b三份几何/路径/Game专项 | 方形r0；固定或完整4向；180°两段验，不免费转身 |
| §4.2 所有强制位移/换层 | CreaturePlacement、LevelTravel、Game整体落点；phase4d_travel_ai/movement_environment/body_lifecycle，4a1/4b Game | 全组无位正重试/留源层；pending不占当前层、不逐腿落伤；场地不在下层复造 |
| §4.3 核心调度/成员子动作/有界落脚 | TimeCoordinator、CompositeMovement、BodyConstraints、Game.advanceCompositeBodyTurn；phase4d_production_body/composite_movement/body_actions | 32候选/128节点/≤4攻击源，成员不独立全局调度；只做有界局部方案，复杂全构型路线按r3由场地保证 |
| §4.4 主动/被动统一转换 | Game.transitionBody/prepareAndCommitBodyTransition/commitBodyTransition、BodyTransition；phase4e_body_transition/recording、phase4d_body_lifecycle | phase/split/clone/summon已开放；被动资格保留；主动只支持自身副本召唤，不开放任意species召唤、regrow |
| §4.4 ID/HP/事务/奖励 | 虚拟ID全批预留、memberMap、整数HP、无死亡退休、完整对象图oracle；上述转换及growth两份正报价专项 | 原权利只留第一split结果，额外主体零权利；异常恢复地图/光照/计划/两流，主动可预见失败保留正费用/耗时 |
| §5.1–§5.2 暴露/机关/重入 | FootprintExposure、FootprintContact、Game环境；phase4a1_game_square、phase4a2_body_effects、phase4d_movement_environment | union/支撑all/潜水all分别处理；新进入格和驻留分开，死亡/瞬移/破坏停旧轨迹；同scope不重踩 |
| §5.3 状态归属/一次时钟/支撑 | BodyStatuses与27行status表，核心/实体路由；phase4d_body_status/declarations/movement_environment | 群精神/关系唯一，局部毒火独立；完整自定义有限profile可用，无脚本reducer |
| §5.4 zone/成员传伤、破坏修正 | FixedZoneHealth、BodyMemberHealth、BodyGroups；phase4c_fixed_zone_health、phase4d_effects_rewards/declarations | local1:1、外围1:4，正HP封顶、不重解命中/符文；keep-zone或remove+墓碑。再生/残体/地形不开放 |
| §6.1 D08默认part/group/entity | collectBodyTargets/BodyCombat/BodyEffects及真实axe/bolt/爆炸/discord测试；giants_zones/composite | 范围多部位伤有意逐部位一次，精神/身份group一次；传导不重新消费核心战斗 |
| §6.2 射线/范围/准确目标/重检 | BoltTargeting/BoltTrajectory、ActorCombatResolution、ui/targeting；phase4a2_body_effects、giants_zones与4d paid计划 | 1×1反射重访保留；尾格真实接触；隐藏知识不由机械DTO泄漏，旧目标/来源破坏取消 |
| §7 可见性/LOS/警觉/关系/光 | BodyPerception、MonsterVisibility/MonsterBody、Scent.awareOfGroupTarget/MonsterAI；phase4a2_body_effects、phase4d_travel_ai/rest_relations | 单群警觉一骰、真实mask遮挡与稳定光源；本轮补128候选LOS预算。没有自然大型盟友/俘虏内容，但普通支配/关系转换已可用 |
| §8.1 图与缓存 | 形状×pose、terrain/occupancy/目标版本、8组LRU及动态重规划；phase4a1_*pathing/perf、phase4b_pose_pathing/Game | LRU只影响速度；load/层切/rollback重建；核心图不能替代全组约束 |
| §8.2 硬限额与退化 | Spatial/Composite limits，runtime与codec各门；phase4a0_spatial、phase4d_production_body、phase4e_body_transition、phase4f_audit | 16格/17成员/64群格/512空间格/128实体等；本轮LOS预算补漏。通用4×4几何允许，见下文明确裁决 |
| §8.3 性能验收 | 4a1/4b/4d报告已有冷图、动态重规划、17实体命令与节点/RNG证据，相关perf测试本轮列入 | P95≤5ms是调优目标，不是已验证全部设备保证；六布局/GPU/真机手机仍等待统一浏览器验收 |
| §9 mask轮廓/主字形/历史帧 | MonsterBody、bodyDrawing、displayProjection、presentationTimeline；phase4a3_body_display/SFC、giants_zones/composite/transitions SFC | 四地图共几何、可见裁切；SFC host不含CSS/GPU，不冒充截图；窄屏真实触控待统一门禁 |
| §9 群侧栏/部位目标/后裔HUD | MonsterSidebar/nearbyInspection/TargetBar、giants ui/view；phase4d_group_sidebar、giants_transitions | 已见隐藏核心只给已知群标记；未见核心不泄漏HP/总部位，HUD只合当前可见后裔；旧ACK帧不回读live |
| §10 场地/预留/发布/回滚 | SideChamber/GenerationReservation、Architect/GenerationCoordinator与checkpoint写集；phase4a4_generation_contributions、giants_*自然/生成 | 每层≤1成功、≤16候选，失败收据；玩家绕行、实际pose/成员移动验证；四种正式场地，自然D3/D7/D11/D15 |
| §11.1 原生根/模块绑定/版本 | EntitySnapshot/WholeRunSnapshot、U03、giants state/validation；4a0、4b–4e codec报告及专项 | spatialWorld不归giants；只存引用闭包，不存索引缓存；foundation4不抢3g的5 |
| §11.2 严格读档/回放/续录 | detached校验后发布；phase4d_playable_recording、phase4e_recording、giants自然记录、U03/UR/原录像回归 | 非默认注入场景均用相同固定初始化重启，不冒充自然录像；旧版本/缺模块/篡改拒绝，不迁移 |
| §11.3 combat/growth/narrative软接口 | combat.part-break.v1、phased profile、成长出生/贡献/终结；runtime/provider与4d/4e组合专项，手册§8 | combat缺席即时攻击/短锁；XP报价归growth、无默认BossXP；无现成giants剧情。3g新adapter待合入 |
| §11.4 阶段5复用 | 通用几何、group/约束/动作/命中接口已在底座，fixture独立于giants | 仅复用方向；未授权阶段5或更大军队预算，不声称实现军队 |
| §12 D01–D16裁决 | 按步授权、可绕侧室硬守场、自然敌对、任格危险/有效支撑、真实轮廓、先2后3、Boss无额外免疫、D08 part、D09两级传伤、remove、四向、预算、无再生、max束、immobile、普通变形whole | 均对应现有实现；下面列拒绝边界，不以预留类型冒充功能 |
| §13 共享文件/所有权 | 各步函数表、checkpointGenerationWorld显式写集、U03、boundary；本轮共享实改见§4 | 未新增Game字段；模块间无硬导入；测试通过发现器只删除实际owner目录 |
| §14 分步完整样例/门禁/负例 | 4a0–4e报告已完成段、相关专项和本轮配置/拒绝测试；统一门禁预留§7 | 本部分明确不执行完整npm/test:ext/16Game组合/删除矩阵/浏览器，计划不计通过 |

**4×4裁决**：任务书要求“未开放4×4正式内容”明确拒绝；r3 §8.2/§10.1又明确通用16格mask允许表达4×4。遵循r3能力定义：`size:4`数据拒绝，未安装`giants.square-4`创建/读档拒绝，无正式4×4内容/场地；不把合法底座mask删掉。新拒绝专项分别验证上述数据、创建与读档门；底座4×4只作为预算fixture。

**拒绝边界确认**：mirror在NativeForm/Rigid编译及生产组件/读档处拒绝；regenerate/regrow及非零generation在声明、请求、zoneState/群表处拒绝；debris/inert-body/replacementFootprint/reparent/locomotion、collapse/die与debris-members在正式注册处拒绝，读档只能匹配已安装闭包；玩家spatial/入组始终拒绝。现有giants_rigid/zones/composite、phase4d_production_body、phase4e_body_transition及新config_examples覆盖这些门，不靠UI藏入口。

审计发现的本范围缺口共三类，均已修改：名称与实际产物不一致、LOS预算缺限、底座fixture借用giants且未纳入ext发现集合。未发现需要新增授权内容才能修复的已开放玩法缺口。历史火焰陷阱重入问题、性能冷图成本、全局构型求路及真实手机/GPU验收仍按对应历史限制处理，不将它们改写为已验证。

## 3 独立性准备与测试归属

新增 `src/test/fixtures/bodyModule.ts` 是完整、有限、底座自有的测试内容声明，模块ID为`body-fixture`，不进入生产glob/module目录。保留旧功能布景的HP/速度/传伤数值，使用自己的forms/body/break/transitions/state/fingerprint；不复制giants私有state/HUD/encounter hooks或导入其JSON。`support/productionComposite.ts`通过正式registry安装它。相关底座4d/4e和growth正报价测试只改布景引用ID与来源，原HP、scope、对象图、付款、终结、异常和回放断言保留；真实giants内容由其自有自然/专项测试继续验证。

`test-discovery`原ext集合只按ext_前缀收底座，遗漏phase4文件；现在phase4全部纳入（普通test/gen/drift唯一归属不变）。membership守卫仍断言发现集合**精确相等**，补独立phase4 fixture删除后保留的前提；没有放宽断言、skip或额外exclude。

底座phase4登记文件如下；全部留在`scripts/test-suites.json`，删除giants目录不得删除这些文件或其fixture/support：

```text
src/test/phase4a0_spatial.test.ts
src/test/phase4a0_spatial_differential.test.ts
src/test/phase4a1_game_perf.test.ts
src/test/phase4a1_game_square.test.ts
src/test/phase4a1_pathing_perf.test.ts
src/test/phase4a1_square_pathing.test.ts
src/test/phase4a2_body_combat.test.ts
src/test/phase4a2_body_effects.test.ts
src/test/phase4a3_body_display.test.ts
src/test/phase4a3_body_sfc.test.ts
src/test/phase4a4_generation_contributions.test.ts
src/test/phase4a4_movement_regions.test.ts
src/test/phase4b_game_rigid.test.ts
src/test/phase4b_pose_pathing.test.ts
src/test/phase4b_rigid_rotation.test.ts
src/test/phase4c_fixed_zone_health.test.ts
src/test/phase4d_body_actions.test.ts
src/test/phase4d_body_lifecycle.test.ts
src/test/phase4d_body_status.test.ts
src/test/phase4d_composite_movement.test.ts
src/test/phase4d_declarations.test.ts
src/test/phase4d_effects_rewards.test.ts
src/test/phase4d_group_sidebar.test.ts
src/test/phase4d_movement_environment.test.ts
src/test/phase4d_playable_recording.test.ts
src/test/phase4d_production_body.test.ts
src/test/phase4d_rest_relations.test.ts
src/test/phase4d_terminal_identity.test.ts
src/test/phase4d_travel_ai.test.ts
src/test/phase4e_body_transition.test.ts
src/test/phase4e_recording.test.ts
src/test/phase4f_audit.test.ts
```

归属底座的配套声明：`fixtures/fixedZones.ts`、`fixtures/bodyModule.ts`、`support/compositeScene.ts`、`support/rigidScene.ts`、`support/productionComposite.ts`、`support/squareDisplayScene.ts`及完整对象图/SFC harness。底座差分中的growth/narrative场景以及body专项中的combat/growth组合仍是显式集成前提；本轮仅确认删giants的准备，不以它声称其他模块删除行已通过；完整所有权/组合矩阵在3g合入后统一运行并裁决。

组合脚本按`catalog` glob发现combat/giants/growth/narrative；removal脚本按物理目录发现同四模块，计划自然扩大16行（正常1，删除15）。本轮仅`--plan`及**只删giants的一行**`--prepare-only`：隔离副本物理删目录、清cache、校验实际移除测试恰为giants owner，剩余底座phase4测试仍被ext发现器完整列入。没有在副本执行类型/构建/测试/Game/browser门禁；`prepared-not-verified`不是测试通过。

## 4 共享实改与版本

- `BodyPerception.ts`：固定稳定候选后最多128次LOS；普通无spatial的原路径不加预算切片，不消耗RNG。
- giants `module.ts/locales`：由已安装转换声明取形态/数量并解析相同原生命名适配器；成功按四reason分别翻译，失败也取来源名；不改转换/战斗数值。
- `scripts/test-discovery.mjs`：补底座phase4测试进入ext；`check-module-composition-smoke.mjs`增加只规划分支，默认Game/browser验证语义保持。
- 测试/夹具：底座生产复合体及转换布景去giants依赖，growth两份正报价布景随引用同步；新增文档例子、拒绝矩阵、名称及LOS预算验证；模块和底座清单分别登记。
- 文档：新增手册/本报告，更新README；用户提供的task文件未改。

foundation/module/rules/state/save/recording版本及正式pack指纹未变；未新增Game字段，无U03增项；不引入旧档迁移。没有改变原机械definitions或生成/trace文件。

## 5 实际门禁（第一部分）

统一Node24.19.0，PATH前置`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`；Vitest `--maxWorkers=2`。以下均在第二冻结候选执行；生产/测试/脚本/配置输入在每项前后保持相同。相关集合保留真实exit1，不能用其他通过结果覆盖。

| 实际命令／范围 | 实际结果 | exit | 墙钟秒 |
| --- | --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 边界/归属通过 | 0 | 1.562 |
| `npx vue-tsc -b` | 通过 | 0 | 6.999 |
| `npm run build` | 通过；保留已有chunk尺寸提示 | 0 | 9.545 |
| `npx vitest run <64文件清单> --maxWorkers=2` | **63文件通过、1文件失败；815项通过、1项原有失败**，0 skip/todo；见§8 | **1** | 415.607 |
| `npx vitest run src/ext/modules/giants/tests/giants_composite_natural.test.ts --maxWorkers=2` | 自然D15、断足续录、逐条replay与3个seek，1文件/5项通过 | 0 | 435.391 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts -t 白名单 --maxWorkers=2` | 1源码守卫通过；29项由-t过滤未选，不宣称整文件通过 | 0 | 1.629 |
| `node scripts/check-module-composition-smoke.mjs --plan --output /private/tmp/p4f-v2-final-composition-plan.json` | 发现4模块/16计划，planned-not-verified；engine/browser均not-run | 0 | 0.989 |
| `node scripts/check-module-removal.mjs --plan --maxWorkers=2` | 16计划（full 1、removal 15），没有执行矩阵 | 0 | 0.078 |
| `node scripts/check-module-removal.mjs --profile=removal --retain=combat,growth,narrative --prepare-only --maxWorkers=2 --output=/private/tmp/p4f-v2-final-removal` | 仅删giants的一行prepared-not-verified，gates=[] | 0 | 0.764 |
| `npm run test:drift -- --maxWorkers=2` | 4文件/5项通过，无重录 | 0 | 69.990 |

直接集合包括32份底座phase4、13份giants功能（长自然文件另跑）、2份growth正报价以及17份直接持久/录像/UR/源码/所有权守卫；精确清单`/private/tmp/p4f-related-files.json`。相关与独立自然两批合计65文件/821项，其中820通过、1原有失败；不把开发期重复验证累加。全部14份giants功能文件完成，drift另含其自有trace。

精确argv/退出码/耗时/每门前后hash：`/private/tmp/p4f-v2-final-gates.json`，各log同`p4f-v2-final-*`；936份生产/测试/脚本/配置路径→SHA256的排序紧凑JSON汇总hash为 **5d51b46e2e90a12ad339e877daea94baaa98b35f5f64b35bf4ad37b11a3f43df**，每门前后均一致。输入清单`/private/tmp/p4f-v2-final-inputs.json`。门后仅收尾文档：补例子locale和运行状态初值说明，三段已校验机械JSON逐字不变；最终手册SHA256为`c50de75006d92629aeab3ff27579ea2b24b0648b4c12e28360c6b5852d9d2e29`。

准备副本实际删除34个giants自有文件、16个自有测试，剩余combat/growth/narrative；417个测试仍登记，剩余ext集合130份，**32份phase4底座测试全部仍存在且被ext发现器收录，缺失0**。副本路径`/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-Km5L5l/candidate`，证据`/private/tmp/p4f-v2-final-removal/module-removal-results.json`，状态prepared-not-verified、实际执行门禁0；不是物理删除功能验收通过。

最终`git diff --check`通过；新增交付无CRLF、截图或>1MiB原始证据，原始日志/副本留仓库外。未运行完整npm test、全部test:ext、16组合Game执行、完整删除矩阵、浏览器、CE fetch/full/gen。

## 6 trace与开发期记录

本轮仅改转换消息locale、LOS预算与测试工具/夹具，没有机械pack数据变化。最终drift 4文件/5项通过，**没有漂移或重录**；正式definitions、普通生成基线、giants三份自然trace和UR2/3/4均保持原字节。

首个冻结候选的类型检查exit2：新消息测试直接赋值readonly声明、fixture的unknown状态未做revision属性窄化；只修新测试/fixture类型，第二冻结候选重新从boundary开始。首轮日志与退出码保留`/private/tmp/p4f-final-gates.json`。

开发期底座fixture首轮漏写initialState/validateState，第二轮state过严不能接收旧provider用例的revision更新；修复自有fixture，未改原异常断言。随后4d/4e及growth直接集合17文件/231项通过。文档测试首轮错误直接构造ExtensionRuntime，改为真正Game/registry安装；第二轮漏传generationContributions的depth，修正测试API前提。i18n守卫指出映射表动态t不被引用扫描识别，改生产代码为四个静态t调用，未改守卫。新例子测试随后3项通过。这些是开发记录，不冒充最终门禁。

## 7 统一收尾门禁（等待3g合入与维护者通知）

**未执行／不得计通过**：正常树完整npm test、全部test:ext、16子集真实Game新局/游玩/存读/逐条replay/seek/续录、15行真实删除矩阵及剩余组合/旧缺模块输入拒绝、当次构建六布局×四地图/触控/native与combat浏览器全面验收。

届时先合3g及其foundation5声明，并裁决下述基线旧超时录像用例冲突，冻结最终共同候选，重审版本/adapter/非法重复provider/基础测试所有权，再按r3 §14.1正常full、删除removal执行一次；每行记录真实命令、输入hash、数量、退出码和浏览器状态。本轮计划/准备副本不能替代该结果。

## 8 原有录像守卫失败的归因（保留原断言）

最终相关集合完整跑完64文件/816项：63文件通过、1文件失败；815项通过、1项失败，exit1，415.607s，0新增skip/todo。失败是`src/test/ux_1d_recording_continuation.test.ts:40`的“推进timeout后不恢复完整录像”分支：期望hasCompleteRecording=false，实际true。本轮未改该文件或Game.ts。

在仓库外用`git archive HEAD`建立原始`97988d5`副本，未应用本轮任何生产/测试/脚本改动；Node24.19.0/3GiB/2workers运行原完整UX文件，**17 passed / 1 failed，exit1，16.34s**，在同一行复现同一true/false差异。副本`/private/tmp/p4f-head-838b3xcd/candidate`，日志`/private/tmp/p4f-head-ux.log`。不是以过滤或当前夹具自比证明基线；完整原18项均执行。

基线`Game.stepAdvancement`超时分支已排空原推进生成器并调用finishAdvancement，保存该已接受动作的完整checkpoint；原用例仍假设超时等同放弃模拟、录像来源失效。这属于已存在的测试/基线行为冲突，本轮修改不能单变量解释它。按用户“撞守卫不改守卫”的要求，未改旧断言、未回退既有调度修复、未加skip；如实保留exit1，统一收尾需先由维护者裁决该旧用例。其余相关与giants功能验证通过不覆盖这次失败。

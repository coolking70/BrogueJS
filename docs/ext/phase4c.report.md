# 4c 执行报告：固定命中区与部位破坏

本轮基于维护者已经审阅并提交的 **4c-0 / `ext/phase4` HEAD `dba3c58`**，先检查并保留上次中断留下的未完成改动，再继续 `phase4c.task.md` 的完整剩余项。未暂存、commit、push；未改 combat 模块生产文件、旧测试断言或守卫。本文后半部完整保留 4c-0 原报告；其中“生产关闭”和剩余项列表描述当时的历史停点，当前状态以本节为准。

## 本轮范围与完成情况

| 原剩余项 | 本轮结果 |
|---|---|
| 生产能力门 | 安装模块自有 namespace 的 nativeForm 可声明固定 zone、逐格标签与 keep-zone 破坏表；可信会话目录负责授权，存档中的定义不能自行安装能力。矩形方形与任意 mask 均走独立刚体路径。普通点实体和既有未声明 zone 的身体保持原路径。 |
| 原生战斗接线 | 在单次原生命中/护盾之后，经 `Creature.takeDamage` 的引擎内部 zone 出口提交局部 HP 和原生 HP；近战、鞭/矛/横扫/突进/连枷、投掷、原生弹道与爆炸范围保留真实接触格，D08 以实体＋zone 去重。3b 锁定范围仍逐 part 调用一次原生攻击。 |
| 破坏与取消 | 唯一收据仍来自 zoneState 的 broken/generation。速度、失攻、暴露从破坏集派生。fallback 接 TimeCoordinator 的实际 elapsed ticks 和原生 NPC readiness。准备的原生计划检查来源破坏集与目标 zone；蓄力计划按来源/锁定目标格进入既有 break-recovery，清空尚未释放的预警，不重新付费。 |
| 公开 UI | 当前可见且身份已知的 zone 提供脱离 live actor 的 DTO；瞄准条、hover、检视进度条、Boss HUD 显示名称、HP、已破坏/弱点。旧 ACK/历史帧读取自己的 DTO；隐藏兄弟区、telepathy-only 和幻觉不公开 zone。破坏后清理 hover、弧法光标和公开投掷选中显示；Canvas 清理投掷 UI aim。 |
| 正式内容与持久化 | 给既有棘脊爬兽添加数据驱动棘甲/头部方案。真实命令覆盖 save/load、逐事件 replay、前后 seek 和读档续录；坏 HP/标签/再生/定义闭包失败保持旧世界。自然种子 7309 仅启用 giants 可破甲并击败。 |
| 320/390 | 两种 host 尺寸的真实 Vue client render 函数通过，新增行流式限宽、单行省略，沿用独立 HUD/target grid 区域。**真实浏览器 CSS 布局、截图与触控仍未验**，详见最后的验收缺口；不将无 CSS 的 renderer 测试当作像素证据。 |

没有新增 Game 字段、第二份破坏 ledger、模块导入依赖或 RNG/时钟真相源。没有启用再生、成员、镜像、形状替换、残骸或主动换形能力；4d/4e 仍在范围外。

## 单次伤害与事务顺序

原生攻击仍决定命中、防护、伤害骰、符文/反伤/吸血及事件。真实接触作用域携带 zone 标签；已解析的 post-shield 数值只进入一次 `resolveFixedZoneContact`。物理伤害扣 zone armor，再乘当前倍率并向下取整；local 损失为 `min(伤量, 命中前 local 正 HP)`，这份数值以 1:1 截到所属实体剩余原生 HP。溢出不传，已毁区再接触不传伤；直接 body/native 区不自传。

`takeDamage` 不再次扣这一份原生 HP；blood 与 beforeHpLoss/原生吸血继续使用 CE 次序，反射自击在原 HP 上结算吸血后只失去一次实际伤量。传伤回调收到实际 HP 损失，普通未声明 zone 的旧路径不改。原生的逐击事件和 physicalResolved 各一次；局部破坏没有 kill、XP、死亡 DF 或掉落。quietus/slaying 身份效果用整体作用域，仍杀死所属实体一次。

破坏事务先执行可选 provider prepare → native apply → provider commit。ready 与 fallback 互斥；异常恢复 HP、同一 zone 对象、锁、provider namespace 状态/组件/缓冲消息/事务内 RNG。外层真实接触作用域也恢复已经在 takeDamage 之前消耗的护盾及 corpse absorption。**速度刷新、hover/瞄准清理、3b 取消在 provider 成功返回后才执行**，因此失败时计划不曾被取消。原生攻击在此前已经投出的骰和创建的因果 origin 不属于破坏事务，不声称整次攻击的任意副作用都可重试；3b 原有失败失效合同保留。

同一爆炸 wave 的实体 explosion immunity 不再误挡第二个不同 zone；已有其他 wave 的 immunity 仍阻挡。两区各一次，重复覆盖同区不再次解算。精神/身份/治疗等整体效果保持 group 粒度。

## 共享文件函数级改动

| 文件 | 本轮实改 |
|---|---|
| `ext/nativeForms.ts` | `NativeFormDefinition` 增加 footprint zones/zoneCells 与有限 breakRules；`validNativeForm` 验证自有规则和 zone locale namespace；`nativeFormSpatial` 初始化 local HP，非 zoned 形态不增加字段。全部为 native 的标签也能按 part 解算范围并公开显示，不要求 local ledger。 |
| `engine/Movement/SpatialSchema.ts` | `registerBreakRule/registerFootprint` 开放安装模块自有固定 keep-zone 声明并限制 1:1。基础 fixture 和关闭能力的守卫保留。 |
| `engine/Movement/RigidFootprint.ts`、`CreatureSpatial.ts` | 刚体编译默认仍拒绝 local zone，可信生产目录/已核验声明显式开启固定 zone；`rigidMovementFootprint` 只有已授权 zoned 定义才接纳 zoneState/actionLock，fixture local zone 不能冒充原生能力；4b 的纯 native 标签 fixture 路径保留。 |
| `engine/Combat/FixedZoneHealth.ts` | 抽出共享无骰 `resolveFixedZoneContact`；旧 fixture 入口仍验证当前占格；增加原生派生速度/攻击可用查询。 |
| `engine/Combat/BodyCombat.ts` | 精确接触标签、按数组索引保留 zoned 几何目标格、整体身份效果作用域、实际选中格的合法近战检查，以及接触层护盾失败回滚。作用域用 WeakMap/WeakSet，不保存。 |
| `entities/Creature.ts`、`Combat/Combat.ts` | 中央 zoneDamage 接线、避免二次原生扣血、吸血回调采用实际传伤并保留自击次序；命中/伤害取骰与原生符文出口沿用。 |
| `entities/Monster.ts` | 矛/横扫保留 zoned 实际接触；`prepareNativeDecision` 尊重短 actionLock。 |
| `ext/types.ts`、`ext/runtime.ts` | 引擎内部可选 zoneDamage hook/zoneBroken port；安装自有破坏定义；新取消回调用 WeakMap 派生绑定，不改变旧 Runtime ports 的对象形状；attachCreature 将显式局部接触路由到共享出口，provider 成功后通知取消。模块 context 不获得这些引擎写端口。 |
| `engine/Core/Game.ts` | 玩家普通/特殊武器几何的接触列表、投掷/法器/怪物 bolt 实际传伤、按 zone 的爆炸 wave、整体 slaying；成功破坏时刷新速度/取消计划/清理公开选中；zone hover/检视。 |
| `engine/Combat/ActorCombatResolution.ts` | prepared 原生计划记录来源破坏集和真实目标 zone；提交拒绝已毁来源/目标，未毁兄弟 zone 仍可命中。 |
| `engine/Core/ActorActionProduction.ts`、`PhasedAttackProduction.ts` | lock readiness、禁用声明 attack ID、确认前 zone facts、防止多 part 重复同实体风险批准；`cancelPhasedAttacksAtZone` 联动既有 source-changed/break-recovery 合同。 |
| `engine/Core/TimeCoordinator.ts` | 从实际 soonestTurn 递减并删除短锁，不新增独立时钟或随机消耗。 |
| `engine/Core/WholeRunSnapshot.ts` | 收集实际使用 zone 的 breakRule 定义闭包；解码继续与已安装可信目录精确比对。 |
| `engine/UI/MonsterZones.ts`（新增）、`MonsterSidebar.ts` | 公开且脱离 live 的 zone 名称/HP/格集/破坏/弱点 DTO，精确 data-owned locale 资源读取。 |
| `ui/displayProjection.ts`、`useGameHud.ts`、`components/TargetBar.vue`、`GameCanvas.vue` | 捕获历史 targetZone、公开破坏后的目标过滤、client target 文本/确认门、Canvas aim 清理；旧帧不读新机械状态。 |
| giants `ui/view.ts`、`BossHud.vue`、两份 locale | Boss HUD 只消费 DisplayFrame 的公开 zone；单行限宽状态；新增 i18n 文本。 |
| giants `data/definitions.json`、`test-suites.json` | 正式 zone 方案和新增三份专项的唯一归属登记。没有改 combat 模块文件。 |

## `combat.part-break.v1` 最终对接

**与维护者已提交的 4c-0 签名一致，没有协议改版。** 权威类型为 `src/ext/partBreak.ts`，下面保留完整签名说明。请求仍是 schema 1、resolutionId、actorId/sourceId、groupId=actorId、partId=`self`、zoneId、generation=0、balanceLoss、fallbackStunTicks。provider 同步 `prepare(request, readonly actor/state/component context)` 返回 ready(plan) 或 unsupported(disabled/unsupported-target)；`commit(request, frozen plan, own state/component/message context)` 必须返回 void。

生产 caller 是 runtime.attachCreature 的 post-shield zoneDamage。commit 准备中的 actor facts 是命中前冻结视图；provider 未安装/unsupported 由底座取声明的短锁，ready 时不加 fallback。来源/目标取消发生在协议成功后；取消的 break-recovery 是 3b 既有恢复合同，和 provider 的韧性处理不共用第二份底座账本。实际 combat provider 仍由 dot 后续接入，本轮仅以生产 fixture provider 验证，不修改 combat 模块代码。

## 正式数据、可调数值与自然验收

`src/ext/modules/giants/data/definitions.json` 的 `giants.spine-crawler` 仍为原来的四格长刚体与四向旋转。r0：原点 `(0,0)` 为 native 头部，`(1,0)/(2,0)` 为同一 local 棘甲，末格 `(3,0)` 为 body。keep-zone 破坏后格子与碰撞不变。

| 参数 | 当前临时值 |
|---|---:|
| 所属实体 native HP | 150 |
| shell local maxHp / armor / 初始倍率 | 30 / 2 / 1:1 |
| ownerTransfer | 固定 1:1，其他比例拒绝 |
| `giants.spine-shell-break` 移动 tick 倍率 | 3:2，原生 100 → 150 |
| 破坏后 head 倍率 | 2:1，取派生暴露最大值，不累乘 |
| balanceLoss / fallbackStunTicks | 6 / 50 |

可调位置是 zones 的 maxHp/armor/damageMultiplier、zoneCells、breakRuleId 与破坏表有限 modifiers。native HP 与原生攻击数值仍在 nativeForm；不应通过模块自建伤害或重复调用 takeDamage 调平衡。

自然验收：**seed 7309 / wizard / extensions=[giants] / D11**。沿既有只读 BFS 选择路线，通过公开 move/search/stairs、原生物品拾取装备恢复；抵达 1174 个真实输入事件，birth 标记 natural。之后只用公开原生命令破甲与击败，不注入怪、改 HP/位置/地形或随机流，不启用 growth/combat。自然捡到的鞭子会先远程攻击已毁棘甲、阻挡继续走近头部，所以验收在破甲后通过 `executeItemCommand('unequip')` 卸鞭，再绕到头部贴身攻击。

验收断言保证破甲时 native HP仍为正、模块 Boss仍为alive，之后在抵达事件数＋600以内完成击败，状态为defeated。wizard 是可复现功能验收模式；不声称此种子的 normal 平衡/玩家存活或手机战斗性能已验。新增专项同时用显式诊断场景覆盖giants 单模块/有 growth/有 combat 的一次事件、真正投掷/bolt/双区横扫/爆炸、来源与目标取消、失攻、provider 异常、矩形 square、坏档和历史 DTO；诊断布景与自然生成证据严格分开。

## trace 归因与重录

先保持所有新战斗/持久化代码，只将 **giants `data/definitions.json` 与 `locales/zh_CN.json`** 两份生产内容恢复到 HEAD；不改旧测试/夹具。原两份捕获测试（D3/D7/D11 三项）全部通过，exit0 / 18.29s。初次只回退 definitions 时 D11 的 nativeWorldHash 仍变化；独立世界逐叶比较准确发现 `.monsters[30].description` 和 `.monsters[30].form.description` 的新中文描述，locale 一并回退后精确通过。普通未 zoned 内容的命令、实体机械状态与双随机流没有差异。

恢复新内容后按原入口运行 `BROGUE_CAPTURE_GIANTS_TRACE=1 npx vitest run ...giants_trace.test.ts ...giants_spine_trace.test.ts --maxWorkers=2`，三项通过。旧 UR2/3/4 与普通生成基线未重录；任何旧测试和守卫未修订。

| trace | 变化字段 | 原因 |
|---|---|---|
| `natural-trace.json`（D3） | `extensionsHash` 1项 | 安装的 giants 内容指纹变化，未出现棘脊内容。 |
| `colossus-natural-trace.json`（D7） | `extensionsHash` 1项 | 同上。 |
| `spine-natural-trace.json`（D11） | `boss.spatial.zoneState` 新记录、`extensionsHash`、`nativeWorldHash` 3项 | 自然生成 shell HP30；内容指纹；monster zoneState 和上述两份中文 description 进入 native world。命令数/commandsHash、boss HP/位置、模块状态与双流/计数均未变。 |

D11 新增 zoneState 记录的叶字段为 `zoneId=shell / hp=30 / broken=false / generation=0` 四项，另改两份哈希，共6个新增/变化叶字段；D3/D7各1项，全组三份合计8项。

| trace 文件 | HEAD SHA-256 | 本轮 SHA-256 |
|---|---|---|
| `natural-trace.json` | `b3e79e43b0cb4bc38ee25e2c0ce1cdd326a5ac0e2188f0e4dd29f1c77a1b05b8` | `72689bf8c91bead46b023cb0c0bdbfaf098670e585baa9f8bd8ff643bc147fdf` |
| `spine-natural-trace.json` | `46e777177526404be4c0e653b82fe7bf91be4dbf052161affdc866b10afe3d7b` | `092ad82b1803feefba28c6028b3a75c1d0d3966a14130931f099161e72e20b4f` |
| `colossus-natural-trace.json` | `0cb73aa6e39ca14191276943ed82fe2556905e85a5fac9ab2694f6566b0c0a9f` | `2445dcb570e502abc944fea8081998e7aef4f545229c42fabe758e58b6ee8a98` |

具体哈希值和新增记录保存在逐字段 JSON 中。原始归因/capture 与逐字段 JSON：`/private/tmp/p4c-trace-counterfactual.{json,log}`、`p4c-trace-capture.log`、`p4c-trace-diff.json`；>1MB 世界证据仅在 `/private/tmp/p4c-world-*.json`，没有进入仓库。

## 实际测试与结果

使用任务书的开发期功能政策：Node 24.19.0，PATH 前置指定 runtime，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。未跑完整 npm test / 全部 test:ext / removal / CE full/gen，未新增 skip/todo。

**最终v3同一冻结候选全部 exit0：**

| 门禁 | 实际结果 | 耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 边界及唯一测试归属通过 | 1.53s |
| `npx vue-tsc -b` | 通过 | 6.52s |
| `npm run build` | 通过；既有 >500KB chunk 提示保留 | 9.05s |
| 63文件相关 Vitest 集合 | **63/63文件、1236/1236项通过，0 skipped/todo**；含新增30项、原4c-0的78项、4a0零影响、4a/4b、giants/combat/3b/growth逐击、原生几何/弹道/护盾/爆炸、UR2/3/4、存档录像与源码守卫 | 392.36s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过，29项因选择表达式未选；未跑重型普查 | 1.69s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16子集通过**，真实新局/自然贡献/save-load/replay/seek/续录 | 66.81s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过**，含两份普通生成基线与D3/D7/D11自然trace | 55.48s |

冻结输入 **870份**，每项后及最终变化列表均为空；路径排序紧凑JSON散列集合 SHA-256 **`a06c91d966d9b0807e733f8b935948d6ca8de13295086a0ca4026cac3a2db5bd`**。最终结束UTC **`2026-10-05T08:09:33Z`**。随后仅更新报告与progress文档。

精确清单 `/private/tmp/p4c-related-files.json`，runner `/private/tmp/p4c-final-v3-gates.py`，每项命令/退出码/时间/逐文件散列 `/private/tmp/p4c-final-v3-gates.json`，原始日志 `p4c-final-v3-*.log`。组合报告 `p4c-final-v3-composition.json` 的 engine.status=passed、requestedScopePassed=true；browser=not-run、整体passed=false明确表示没有浏览器验收，不能冒充完整browser smoke。SSR HMR监听EPERM日志保留，engine-only实际exit0。

首轮 boundary 精确拒绝了新诊断测试跨模块导入 combat 内部文件，已按守卫改测试为读取底座的安装声明，保留原攻击/配置与断言，未修改守卫或 combat 模块。第二候选63文件1235项中1229通过/6失败：4a0四项对象图差分定位到新增 ports.zoneBroken 属性，改为 WeakMap 派生绑定；4b两项分别暴露默认编译过早开放 local HP 与误拒既有 native 标签 fixture，改为可信目录显式授权、保留旧标签路径。零影响四项与修正后98项定向回归通过，旧测试与守卫未改。其他开发失败为新测试的布景/API 与重复风险批准、快照缺闭包等生产问题；修正后进入冻结复核。原4c-0 的78项继续原样验证。

## 已知限制与唯一剩余验收项

功能接线、正式内容、原生计划取消和持久化剩余项已实现。giants内容指纹已变化，旧giants存档/录像严格拒绝，不做迁移。尚需维护者在可启动浏览器的环境中验证 **320/390 实际 CSS 布局不遮地图、真实触控瞄准/长按检视和历史 ACK 帧切换截图**。本环境 Vite `127.0.0.1:4177` 监听 EPERM；标准 develop-web-game Playwright 客户端 Chromium 被 MachPort Permission denied 拒绝；会话 Browser inventory 为空。没有取得截图，不能以构建或 host renderer 代替此项。

日志：`/private/tmp/p4c-browser-{vite,client}.log`。现有字号/限宽/省略与 HUD/target 独立区域已实现，SFC 在320/390 host尺寸各覆盖真实模板更新；该 renderer 没有 CSS layout engine，不证明像素布局/GPU/手机 FPS。验收步骤：种子7309生成棘脊后，在两宽度分别点棘甲瞄准、检视，观察30/30；破甲后观察0/30已破坏与头部弱点，旧ACK帧仍显示原30/30；退出目标模式确认地图未被新增HUD遮盖。

---

# 历史保留：4c-0 原报告

以下原文完整保留维护者已提交的底座子里程碑报告。

# 4c-0 执行报告：固定 zone 健康与破坏软接口底座

本轮执行 `docs/ext/phase4c.task.md`，基于 `ext/phase4` / `2eb3181e67c9e7650b538b08af76ba2759c75710`。按任务书“可在干净子里程碑停下并列剩余项”，交付 **4c-0**，不是完整 4c。未 commit、暂存、push；未修改 combat 模块代码。

## 已交付能力和关闭边界

底座 fixture 上的独立刚体可以声明固定 local/native zone、逐格标签、local HP 与 keep-zone 破坏表。新增健康出口接收调用方已经完成的单次实体级命中/防护伤量，额外仅计算一次 zone 防护（物理 armor 按伤害点扣除，再乘倍率向下取整）；local HP 损失为 `min(防护后伤量, 命中前 local HP)`，原生 HP 只接收这一份 1:1 传伤并截到剩余 HP。直接 body/native zone 只扣原生 HP，没有自传。破坏后的 local zone 再接触不再传伤；keep-zone 不移动/删除身体格。

使用既有 `CreatureSpatial.collectBodyTargets` 的同步 scope：同 zone 多格一次，两个 local zone 的 geometry/area-damage 各一次；mental/identity/healing/death 保持 group 一次。健康出口不执行随机取骰、`takeDamage`、原生攻击、physicalResolved、普通死亡/掉落/XP。这是 fixture 的已解析伤量出口，不声称已经接到近战、投掷、射线或火球的完整生产解算器。

`zoneState.broken/generation` 就是唯一破坏收据集合，不另存第二份 applied ledger。单体键为 `(actor.id, self, zoneId, 0)`。破坏一次发布收据；重入、实体/世界 fixture 读档与克隆读派生修正时不会重发。失攻是禁用 ID 集合查询；速度由原生基数乘当前有效破坏规则并向上取整，不改写持久 movementSpeed；弱点暴露取目标原倍率与所有暴露声明的最大有理数，不重复相乘。局部状态坏 HP/标签、缺失/重复记录、矛盾 broken、再生字段、非零 generation 被拒绝。再生 schema 的预留类型仍存在，但未开放。

**生产能力仍关闭**：`NativeFormDefinition` 仍不能声明 zone；`assertNativeSpatial` / rigid 编译 / 生产 codec 仍拒绝 local HP 与 actionLock。`FixedZoneHealth` 的入口要求 `catalog.fixture`，不能把保存的定义当安装许可。普通 1×1、现有方形、任意 mask 与 giants 内容没有新增持久字段、额外 RNG、规则时钟或正式 zone。未增加 Game 字段，不需要更改 U03 合同或格式版本。

## 共享文件函数级改动

| 文件 | 实改 |
|---|---|
| `engine/Movement/SpatialSchema.ts` | `PartBreakRule.expose-zone` 补充明确 `damageMultiplier`；新增 fixture-only `SpatialCatalog.registerBreakRule`，仅允许 keep-zone 与 move-ticks-multiplier/disable-attack/expose-zone/balance-loss，检查预算、比例、重复修正和未开放字段；`registerFootprint` 核验 exposure 的 self/zone 引用；`validateSpatialComponent` 明确固定 zone generation 必须为 0。 |
| `engine/Combat/FixedZoneHealth.ts`（新增） | `initialLocalZoneState`、`resolveFixedZoneHit`、`fixedZoneBreaks`、三类修正查询与 `advanceFixedZoneLock`。限制 1:1、自有刚体、真实当前 part 接触；HP/zone/lock 原子写入和幂等回滚。时钟函数只供 fixture，未接 TimeCoordinator。 |
| `ext/partBreak.ts`（新增） | 底座拥有的版本化 receipt/request/provider/原生事务类型及严格输入验证；没有导入任何模块。 |
| `ext/types.ts` | `ExtensionModule.optionalPartBreaks` 可选声明，仅支持 `combat.part-break.v1`。 |
| `ext/runtime.ts` | 构造时拒绝错误版本/形状与多个 provider；新增引擎内部 `commitPartBreak`。provider 绑定为派生 WeakMap，不新增既有 runtime 自有字段。prepare/commit 与原生 apply 共用现有扩展事务，异常恢复扩展状态/组件/消息/资源/RNG，并调用原生 rollback。 |
| `scripts/test-suites.json` | 登记两份底座测试，保持唯一归属。 |

其他新增文件是两份测试和 `src/test/fixtures/fixedZones.ts`；进度写在 `progress.md`。未修改 `Combat.ts`、`Bolt.ts`、Game/TimeCoordinator、准备/计划系统、显示组件、giants 定义/locale、任何旧测试/守卫、基线或黄金 trace。

## `combat.part-break.v1` 本轮最终签名（供 dot 接 provider）

类型以 `src/ext/partBreak.ts` 为准，注册位置：

```ts
const PART_BREAK_CAPABILITY = 'combat.part-break.v1';
ExtensionModule.optionalPartBreaks?: {
  readonly 'combat.part-break.v1'?: PartBreakProvider;
};

interface PartBreakRequest {
  readonly schema: 1;
  readonly resolutionId: number;
  readonly actorId: number;
  readonly sourceId: number | null;
  readonly groupId: number; // 本步必须等于 actorId
  readonly partId: 'self';
  readonly zoneId: string;
  readonly generation: 0;
  readonly balanceLoss: number;
  readonly fallbackStunTicks: number;
}

type PartBreakPreparation =
  | { status: 'ready'; plan: Json }
  | { status: 'unsupported'; reason: 'disabled' | 'unsupported-target' };

interface PartBreakProvider {
  prepare(request: Readonly<PartBreakRequest>,
          context: PartBreakPrepareContext): PartBreakPreparation;
  commit(request: Readonly<PartBreakRequest>, plan: ReadonlyJson,
         context: PartBreakCommitContext): void;
}

interface PartBreakNativeCommit<T> {
  apply(choice: PartBreakChoice): T;
  rollback(): void;
}
ExtensionRuntime.commitPartBreak<T>(request: PartBreakRequest,
                                   native: PartBreakNativeCommit<T>): T;
```

prepare context 是只读 `ExtensionRuleContext` 加命中前冻结 `actor: ActorFacts`，只查询 provider 自有 namespace 的 state/component；没有引擎实体或随机/写端口。request、计划和 actor 均脱离 live 对象并冻结；prepare 的 getComponent 在该阶段结束后失效。

commit context 仅有 `state/setState`、`getComponent/setComponent/removeComponent` 与缓冲 `message`，供 provider 在自有组件里处理韧性/硬直。没有 HP/resource、行动、奖励、世界写入或随机端口；写函数离开同步生命周期即失效。计划留在本次调用内，不导出 token、不保存、不允许 Promise 或非 void commit 返回值。

调用顺序：同一扩展事务内 prepare → 原生 apply → ready provider commit。ready 选择 `{status:'handled'}`；absent/disabled/unsupported-target 选择 `{status:'fallback', reason}`。底座 fallback 将声明的短 actionLock 与原锁取 max；handled 不新增 fallback、保留已有其他锁。两者互斥。provider 抛异常/输出坏协议时整个本次破坏失败，**不会悄悄切换 fallback**。

底座健康事务的 rollback 恢复 HP、原 zoneState 数组和记录、原锁值/属性缺席，保留对象身份，重复调用幂等。未来接原生计划取消时，caller 还必须把取消写集加入 `native.rollback`；目前没有计划取消接线，不能只接 provider 后声称已满足 3b 取消合同。4d 的 member/generation 将需要另行扩充当前仅 self/0 的协议边界。

## 数据位置、可调项和验收入口

正式 giants 数据本轮未改，没有新增带 zone 的自然敌人，因而**没有本步自然 zone 验收种子**。既有 giants 的自然生成仍由原专项和组合 smoke 回归，不把旧种子 7306/7309 当作本步 zone 内容证据。

诊断声明仅位于 `src/test/fixtures/fixedZones.ts`：3×2 刚体，shell 两格/local HP12/armor2，leg 两格/local HP10，core 一格/native，余格 body。shell 破坏示范 3/2 移动 tick 倍率、禁 smash、暴露 core 为 2 倍、balanceLoss6/fallback25 ticks；leg 破坏示范 2 倍移动 ticks、core3倍。可调字段为 zones 的 maxHp/armor/damageMultiplier、zoneCells、breakRuleId 及上述有限 modifiers。ownerTransfer 本步固定 1:1；无镜像/成员/再生/换形/残骸。

两份新增测试分别覆盖空间 scope/健康/schema/fixture codec 与真实 ExtensionRuntime 中的 fixture provider/互斥/完整失败回滚。明确不把 fixture 原生 HP 写入看成已实现生产攻击，也不把 codec round-trip 看成已实现 zone 的真实 Game replay/seek/续录。

## 实际门禁

统一 Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。同一冻结候选最终七项全部 exit0：

| 门禁 | 实际结果 | 耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 边界和唯一测试归属通过 | 1.60s |
| `npx vue-tsc -b` | 通过 | 6.97s |
| `npm run build` | 通过；原有 >500KB chunk 提示保留 | 9.86s |
| 50文件相关 Vitest 集合 | **50/50 文件，983/983 项通过，0 skipped/todo**；含新增78项、4a0零影响、4a/4b、全部giants/combat、3b、两份战斗对等、UR2/3/4、存档录像、生成回滚和源码守卫 | 299.70s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过，29项由选择表达式未选；没有跑重型普查 | 1.63s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16 子集通过**；真实 Game 新局、游玩、save/load、逐事件 replay、seek、续录 | 69.93s |
| `npm run test:drift -- --maxWorkers=2` | **4/4 文件、5/5 项通过**；两份普通生成基线与三份 giants 自然 trace，原字节保持 | 56.94s |

相关集合精确清单：`/private/tmp/p4c0-related-files.json`。Node/命令/耗时/退出码/逐文件输入散列登记：`/private/tmp/p4c0-final-gates.json`；runner 为 `p4c0-final-gates.py`；各项原始日志为 `/private/tmp/p4c0-final-*.log`。

866份 src/scripts/构建配置输入在每项门禁后及最终均与冻结前一致，变化列表为空；路径排序紧凑 JSON 的散列集合 SHA-256 **`f78fc11e522b496c97492b6a355eff65b30c16daa3bcd7cd5de1f06efe4f334c`**。门禁结束 UTC `2026-10-05T06:36:04Z`，随后只更新文档。

composition 安装集合为 combat/giants/growth/narrative，`engine.status=passed`、`requestedScopePassed=true`。脚本的 browser=not-run、整体 passed=false 表示浏览器未验，不能冒充完整 browser smoke；SSR HMR WebSocket 的既有监听 EPERM 日志保留，engine-only 实际 exit0。

开发第一轮新增两文件为75通过/1失败（stale-contact 新测试选中了旋转后仍合法的原点格，已将新布景改为真实离开身体的非原点接触，保持拒绝断言）；下一轮5文件121项通过，随后增加两个新边界后进入上述最终完整相关集合。最初类型检查只发现新测试误用了不存在的 XP 字段，已删掉该错误字段观察，真实 reward/death/physical hooks 与因果账本验证保留。没有修订任何旧守卫/旧测试前提，没有反事实或重录的需要。

依任务书未跑完整 npm test、全部 test:ext、removal 或 CE full/gen；没有新增 skip/todo。

浏览器尝试：原技能客户端 `web_game_playwright_client.js` 使用参考 action payload 执行，实际 exit1；Vite `127.0.0.1:5411` 监听 exit1/EPERM，Chromium 被 MachPort `Permission denied` 拒绝，未取得截图。日志在 `/private/tmp/p4c0-browser-{vite,client}.log`。本轮没有 UI 改动，仍明确不声称320/390、触控、GPU或公开历史帧像素通过；这些属于完整4c后续项。

## 完整 4c 剩余项

1. 生产能力门与数据驱动 owned zone/breakRule 贡献：方形或 mask 的创建、移动/旋转、复制/变形、跨层/离图/pending/携带状态和全部生产 codec；fallback 接客观时钟与实际行动禁用。
2. 原生命中/伤害路由：classic/extended 近战、投掷、射线、几何和范围效果接统一健康出口，正确维护符文/反伤/吸血/growth/阶段3逐击出口与传导归属；用真实生产路径验证 D08，不以 fixture 去重代替。
3. 以被破坏 zone 为来源或目标的 prepared/蓄力计划取消，包括 3b 原生计划；取消写集和 provider 故障在同一事务恢复。combat 模块 provider 的实际韧性/硬直接入按任务书仍交 dot，本轮未改该模块。
4. 公开瞄准/检视/HUD、当前或最近公开 zone HP/已破坏、选中清理、公开弱点与历史帧隔离；320/390 实际布局与触摸模拟验收。
5. 一个正式原创 zone 敌人（可选沉渊巨像或岩脊兽）、自然生成与无 growth/combat 的击败种子；真实 Game save/load/replay/seek/续录及 zone 坏档。内容指纹/trace 若改变，先单变量归因，再用原入口重录登记。

本轮停点是关闭生产能力的完整 fixture/软接口底座；完整4c仍需以上接线和内容，不发布只有占位而不能战斗/保存的半成品敌人。

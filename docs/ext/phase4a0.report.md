# 4a0 通用空间底座迁移报告

基线：`ext/phase4`，`ac92f66f4ef9205cdd5c34c1ade79e6d1d796c41`。依据 `phase4a0.task.md` 与 `phase4-giants.md` r3 实施。未 commit、未 push；用户原有任务书未修改。

## 实现范围与能力边界

完成普通生产生物的空间入口迁移、通用几何/身份底座、严格可选实体 codec、whole-run 原生 fixture 根、版本升级和迁移前后的真实 Game 差分。阶段 3 可以使用 `Game` 的单格 facade，普通生物仍没有 `spatial` 属性、群体记录或空间索引。

`SpatialSchema.ts` 区分 shape、pose、zone、entity/part/group 和群内 partId。支持整数且四邻接连通的 mask，允许凹形和孔洞，旋转/镜像围绕原点，格按 y/x 排序；内建 single、square-2、square-3 预编译。定义/组件有精确字段、所有权、姿态、分数、局部 HP、树拓扑与预算校验。群体恰有一个 core，groupId=coreId；formId 通过独立原生形态身份解析 footprintId，未与形状 ID 混用。破坏/状态引用只开放内建 `foundation:keep-zone` / `foundation:native`，未知引用拒绝，非空攻击 profile 和再生记录拒绝。当前 form 目录仅提供 fixture 几何身份，不是未来生产怪物形态工厂。

`CreatureSpatial.ts` 提供占位、接触距离、三种去重键、active / active-or-reserved / death-contact 策略、完整 mask fit、单步墙角判定和多实体落点计划。计划允许参与者交换旧格，复核位置容器、形态、楼层/占位 revision、地形 revision、实时预留和最终重叠后提交；不能忽略未参与搬移的实体。复合体移动与旋转动作明确拒绝。索引是懒建的派生缓存；列表/组件发布与统一位置提交使它失效，最后一个能力使用者离开时释放。WeakMap 只保存失效通知/地形 token，不保存机械群表。

真实 Game 保留轻量单格路径，不实例化 fixture 空间世界，也不逐步扫描“有没有空间能力”。创建发布、读档预检、玩家命令、NPC 行动、正式克隆和变形都拒绝空间组件；即使是带 lock/region/zone 的 1×1 组件也不能绕过。`executeItemCommand` 继续进入 `executeCommand`。生产环境接触走 `nativeContactOf` 或显式能力预检。

未创建 giants 模块，未实现大型生产敌人、空间环境 exposure reducer、体型寻路、旋转/复合体调度、部位战斗/破坏/再生、转换、场地生成或身体组 UI。这些属于 4a 及以后，不是本报告宣称已可玩的功能。

## 调用点迁移清单

完整逐项登记见 [phase4a0.audit.md](phase4a0.audit.md)。按改代码前的检索候选登记，共 **281** 项：

| 分类 | 数量 | 含义 |
|---|---:|---|
| 改 footprint | 44 | 身体碰撞、接触、距离、相邻、可见性改用几何 facade |
| 仅改端口 | 142 | 统一查询/位置提交出口，保留 CE 资格、搜索次序和效果时序 |
| 保留单格坐标 | 95 | 物品/地图格点、显式点源与锚点、单格玩家、未开放的寻路/UI，以及非空间身份筛选 |

数量包含声明、注释和一条写入的 x/y 两行，不代表 281 个独立算法。清单还补记原检索未覆盖的 `Object.assign(loc, next)`、DF 足迹相交、生成放置和环境接触。

生产生物的位置写入统一走 `commitCreatureAnchor(creature, at, mode)`。分别保留旧代码的替换 loc 与原地更新 loc 语义，避免“值相等但引用图不同”。构造器和候选解码仍是未发布初始化；物品仍用点坐标。DF 真实 Game 端口提供 `occupies`/`commitPosition`，旧的纯点测试端口保留点写入。潜水者闪现的临时 `caster.loc=(-1,-1)` 改为明确忽略 caster 的占位参数，保留原搜索和 RNG 顺序。

未改 UI 文件。检视排序的 Manhattan 距离、射线起点、嗅觉/岸距/waypoint 格点与光源、血迹、掉落点仍按原规则保留；不能把这些保留入口视为已经支持大型动作。mutuality 相邻名单改用足迹距离且保留 ≤1；休眠唤醒按 DF 原点/实际建成格集与足迹相交。

## 阶段 3 最终 facade 签名

以下方法在 `Game` 上提供，当前只接受原生单格生物；数值 ID 解析当前玩家、活跃或休眠名单，未知 ID 拒绝。对象参数用于可信引擎调用。

```ts
spatialOf(actor: number | Creature): CreatureSpatialView;
footprintOf(actor: number | Creature): readonly FootprintCell[];
nearestContact(a: number | Creature, b: number | Creature): Readonly<{
  from: FootprintCell; to: FootprintCell; distance: number;
}>;
canStepFootprint(actor: number | Creature, at: Pos, options?: FitOptions): boolean;
collectBodyTargets(cells: readonly Pos[], policy?: {
  occupancy?: OccupancyPolicy;
  dedup?: 'entity' | 'part' | 'group';
  effect?: EffectTargetCategory;
}, scope?: Set<string>): readonly BodyTarget[];
creatureAtCell(at: Pos, policy?: OccupancyPolicy): Creature | undefined;
getMonsterAt(x: number, y: number, ignore?: Creature): Monster | undefined;
```

几何距离是最短切比雪夫格距，接触对按稳定足迹顺序打破平局；不替换 Manhattan、距离图或平方距离的既有单位。普通单体的 groupId=entityId、partId=null、zoneId=body，不分配新群 ID。`BodyTarget` 含 entity、entityId、groupId、partId、zoneId、contact、dedupKey；DTO 与接触坐标冻结，活实体本身不冻结。

D08 默认：direct / geometry / area-damage 按 part；mental / identity / healing / death 按 group；environment 按 entity。去重 scope 由调用者传入，每次独立攻击使用新 scope；有方向时遵循输入接触格顺序。既有反射射线的重复击中规则未改成整条全局去重。

通用引擎导出另有 `footprintOf`、`footprintContains`、`distanceBetweenFootprints`、`distanceToFootprint`、`nearestContact`、`canFitAt` 和单格轻量查询；`CreatureSpatial` 的显式 fixture 实例提供 `membersOf`、`occupantsAtCell`、`planPlacement`/`commitPlacement`、`snapshotWorld`/`restoreWorld` 等。`FitOptions` 是地形许可、占位策略、参与者忽略与区域解析的受控端口，不是新移动规则。

## 持久化与版本

| 项目 | 变化 |
|---|---|
| Entity / whole-run version | 2 → 3 |
| whole-run schema | brogue-web-whole-run-v2 → brogue-web-whole-run-v3 |
| recording version | 2 → 3（包括续录包络） |
| foundation / descriptor 兼容要求 | 3 → 4 |
| manifest.schema | 仍为 1 |
| growth / narrative 模块与 rules 版本 | 未变，仅更新 foundation 兼容声明 |
| 新空间组件、原生空间根 | schema=1，未使用省略 |
| RNG 版本/算法 | 未变 |

`Creature.spatial` 用 `declare`，构造普通生物不产生默认属性。codec 按缺席语义投影；显式 `spatial: undefined` 拒绝，不能写出伪默认组件。raw `copyForClone` 深拷贝空间容器；实际 Game 克隆前拒绝未开放能力，不发布共享群引用。

原生 fixture 可通过确定性初始化的 `SpatialCatalog(true)` 传入 `EntityCodecDeps.spatialCatalog` 和纯 whole-run 候选解码，无需 ExtensionRuntime。`WholeRunProjection.nativeSpatial?` / `snapshotNativeSpatialWorld` 保存 `run.spatialWorld`；根只包含实际使用的 footprint/body/form/break/status 定义闭包和群表。`decodeWholeRunWorld` 返回显式 `spatialLevels?` 候选机械服务，按当前/缓存楼层分别重建派生索引；不同层可以占相同坐标，同层活体不重叠，跨层共享/拆群拒绝。未知 owner/定义、重复/多余闭包、悬空成员、错 core、孤儿/共享成员、非法姿态/HP/预算/越界均拒绝，snapshot 内 JSON 不可安装未知目录。

默认 `Game.loadSnapshot` 不接受空间组件或空间根；生产候选预检在退休旧局前拒绝。原生 fixture 的 whole-run 往返与实际生产开启多格读档是两种不同能力，后者本步未开放。

区域继续以 `extensions.foundation.world.regions` 为唯一几何真相，没有复制矩形。组件保留 movementRegionId 的正整数 schema；原生 fixture 没有区域解析上下文，直接拒绝区域引用。pending/purgatory/携带状态中的空间生命周期、破坏/再生记录、非 native 状态与攻击 profile、生产群动作仍拒绝，后续开放时需补完整机械执行路径及专项验收。本步没有新增 Game 实例字段，因此没有新增 U03 合同条目；既有 U03 覆盖检查通过。

## 零影响差分

在修改既有生产代码前，从上述基线捕获 `phase4a0-single-cell-baseline.json`，再在原实现重新运行确认 4 组用例通过。场景使用真实 Game、固定 seed=7301、固定墙钟；原生操作用显式测试场景设置，不把人工注入后的录像声称为默认菜单开局可重播。

每组 13 个观测点，空集合 / growth / narrative / growth+narrative 共 **52** 点：新局、走路/等待、存读、读档后继续、录像逐事件 replay、seek、真实战斗、击退、闪现、克隆、召唤、毒气机关接触、正常模式换层。

比较包括 Game 可达的完整 own 数据对象图、引用别名/循环、属性 descriptor、Map/Set/typed bytes、保存投影、logger/消息、timeSystem、物品识别等全局状态、实体与机关分配器，以及双 RNG 的状态和实质/外观调用数。函数只记录名称，原型/闭包不序列化；WeakMap/WeakSet 为不可枚举的派生缓存。大对象图转成 SHA-256 + 对象数，夹具体量约 60 KB，消息与两流状态/调用数保留明文便于诊断。

仅规范化本次格式版本、whole-run schema 和 savedAt；没有排除 HP、位置、tick、状态、队列、实体数量、模块 rules 或 RNG 版本。迁移后的 **52 点全部与迁移前一致**。新增空间字段/缓存未污染普通实体对象图，也没有新增规则随机消耗。JSON 包络确实变化，不宣称保存字节完全相同。

## 旧测试与黄金 trace

旧测试只调整本任务要求的正向格式前提：`u_27_recording`、`u_15a_shattering`、`dialog_d4_blink` 的 version=3；`ext_foundation_contracts`、`ext_compatibility_diagnostics` 和 composition fixture 的 foundation=4。原功能、边界和拒绝断言保留，未删除测试、加 skip 或放宽源守卫。

UR2 原 trace 通过且不改。UR3/UR4 保持原测试断言与原捕获方法，按 `docs/testing.md` §3 处理版本引起的黄金变化：

1. 在临时目录展开原 HEAD 的完整生产源码和原 trace，运行原 UR3/UR4：2 文件/2 项通过。这是只回退本次生产改动的反事实证据，不修改当前源码或候选断言。
2. 在当前 UR3 模拟上仅把被哈希的 version/schema 恢复旧包络，复现全部旧哈希。该 SSR 探针的 UR3 完成；后续 UR4 的大型 deepEqual 探针被中止，未计为通过，UR4 改用原 Vitest 反事实和严格逐叶差异核对。
3. 用原 `UR3_CAPTURE=1` / `UR4_CAPTURE=1` 重录。UR3 变化为 120 个完整快照哈希，其他元数据不变；UR4 只变 60 个叶字段：30 份 state.version=2→3、30 份 state.schema=v2→v3。其他字段零差异。
4. 重录后原 UR3/UR4 测试通过。生成基线/deep baseline 未修改。

原源码临时副本没有 CE 缓存，因此 runner 打印通用“CE-dependent tests will be explicitly skipped”提示；实际这两项不依赖 CE，结果为 2 passed、0 skipped，没有把提示当成跳过许可。

## 实际门禁

全部 Node 测试/构建使用 Node **24.19.0**，`NODE_OPTIONS=--max-old-space-size=3072`；Vitest `--maxWorkers=2`。复现时将 Node 24.19.0 放在 PATH 首位。

| 命令/范围 | 实际结果 |
|---|---|
| `node scripts/check-module-boundaries.mjs` | 通过，exit=0 |
| `npx vue-tsc -b` | 通过，exit=0 |
| `npm run build` | 通过，exit=0 |
| 下列直接相关 68 文件集合 | 68 文件 / 1471 项通过；0 skipped，420.05 s |
| 收尾修改后的 10 文件定向复验 | 10 文件 / 196 项通过；0 skipped，41.43 s |
| 最终 UR3/UR4 | 2 文件 / 2 项通过；0 skipped，45.85 s |
| `check-module-composition-smoke.mjs --engine-only` | 4 种组合的 checkpoint/save/load/replay/seek/continuation 与缺模块拒绝均通过；exit=0 |
| `c_4a_terrain_catalog.test.ts -t '白名单'` | 1 项源守卫通过；其余 29 项被该 -t 主动过滤，未声称整文件通过 |
| `git diff --check` | 通过 |

68 文件集合是迁移期间的相关验证；之后增加了原生 whole-run fixture 和定义闭包，并补严缺席/区域/越界校验，针对变化重跑了下列 10 文件以及最终 trace/smoke/类型/构建。上表分别记录实际运行，不将多次执行数相加冒充独立测试总量。收尾集合包含新增空间 26 项与 4 组差分（共 52 观测点）。

```sh
npx vitest run \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/u_01_instance_snapshot.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/ext_module_composition.test.ts \
  src/test/b_1_weapon_specials.test.ts \
  src/test/v_2b_2a_placement_flags.test.ts \
  src/test/w_11_teleport_placement.test.ts \
  src/test/c_4b_dungeon_feature.test.ts \
  --maxWorkers=2

npx vitest run src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts --maxWorkers=2
node scripts/check-module-composition-smoke.mjs --engine-only --output /private/tmp/p4a0-engine-smoke-delivery.json
```

68 文件集合完整展开如下：

```sh
npx vitest run \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/u_01_instance_snapshot.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/u_03b_level_travel.test.ts \
  src/test/u_02a_rng_snapshot.test.ts \
  src/test/u_02b_level_rng.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/x2a_recording_checkpoint.test.ts \
  src/test/x3b_display_recording.test.ts \
  src/test/ux_1d_recording_continuation.test.ts \
  src/test/w_11_teleport_placement.test.ts \
  src/test/w_12_blink_beckoning.test.ts \
  src/test/w_13_tunneling.test.ts \
  src/test/w_14_obstruction.test.ts \
  src/test/w_16_conjuration.test.ts \
  src/test/w_17_domination.test.ts \
  src/test/w_18_entrancement.test.ts \
  src/test/w_19_polymorph.test.ts \
  src/test/w_20_cloning.test.ts \
  src/test/p4_1b_monster_casting.test.ts \
  src/test/p4_2_monster_summoning.test.ts \
  src/test/p4_4_split_kamikaze.test.ts \
  src/test/p4_5_melee_specials.test.ts \
  src/test/p4_6_attack_geometry.test.ts \
  src/test/p4_7_player_weapon_geometry.test.ts \
  src/test/p4_8_scent_map.test.ts \
  src/test/p4_9_safety_map.test.ts \
  src/test/p4_10_waypoint.test.ts \
  src/test/b_1_weapon_specials.test.ts \
  src/test/b_2_throwing.test.ts \
  src/test/c_4b_dungeon_feature.test.ts \
  src/test/c_4c_promotion.test.ts \
  src/test/c_5_fall_subsystem.test.ts \
  src/test/v_2b_2a_placement_flags.test.ts \
  src/test/p1_31_35_placement_snapshot.test.ts \
  src/test/ext_combat_neutral_differential.test.ts \
  src/test/ext_slaying_alignment.test.ts \
  src/test/ext_foundation.test.ts \
  src/test/ext_foundation_contracts.test.ts \
  src/test/ext_compatibility_diagnostics.test.ts \
  src/test/ext_module_composition.test.ts \
  src/test/ext_generation_checkpoint.test.ts \
  src/test/ext_generation_checkpoint_differential.test.ts \
  src/test/ext_generation_transactions.test.ts \
  src/test/ext_births.test.ts \
  src/test/ext_engine_policies.test.ts \
  src/test/ext_prepared_controlled_commands.test.ts \
  src/test/ext_controlled_action_bridge.test.ts \
  src/test/ext_bolt_causality.test.ts \
  src/test/ext_causality.test.ts \
  src/test/dialog_d4_blink.test.ts \
  src/test/u_15a_shattering.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/test_suite_membership.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/ext/modules/growth/tests/ext_growth_lifecycle.test.ts \
  src/ext/modules/growth/tests/ext_growth_runtime.test.ts \
  src/ext/modules/growth/tests/ext_growth_clone_overhealth.test.ts \
  src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts \
  src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts \
  src/ext/modules/growth/tests/ext_growth_skills_movement.test.ts \
  src/ext/modules/growth/tests/ext_growth_classic_isolation.test.ts \
  src/ext/modules/narrative/tests/narrative_persistence.test.ts \
  src/ext/modules/narrative/tests/narrative_runtime.test.ts \
  src/ext/modules/narrative/tests/narrative_sessions.test.ts \
  --maxWorkers=2
```

基线/重录专用命令（不用于自动更新常规测试）：

```sh
P4A0_CAPTURE=1 npx vitest run src/test/phase4a0_spatial_differential.test.ts --maxWorkers=2
UR3_CAPTURE=1 npx vitest run src/test/u_r3_trace.test.ts --maxWorkers=2
UR4_CAPTURE=1 npx vitest run src/test/u_r4_trace.test.ts --maxWorkers=2
```

smoke 的 `requestedScopePassed=true` 才是此次 engine-only 结果；报告顶层 `passed=false` 原因是 browser.status=not-run，不把浏览器验证记为通过。按任务书未跑完整 npm test、全部 test:ext、removal 矩阵、test:full/test:gen；未改生成规则或 RNG 消耗，因此未跑 drift。浏览器验证留给维护者。

构建有现有大 chunk 警告，构建命令成功。engine-only SSR 工具在受限环境尝试开未使用的 Vite HMR websocket 时打印 EPERM；引擎组合检查仍完整完成、exit=0，未冒称网络/浏览器已验证。

原始日志与逐字段证据放 `/private/tmp/p4a0-*`，没有加入截图/大型原始转储。UR4 是原本已跟踪的正式黄金 fixture，约 1.3 MB gzip，此次按原方法重录；新增零影响 fixture 约 60 KB。

## 接续边界

后续开启真实空间能力时，需要在本次统一入口上接空间生命周期与环境结算、各层/pending/携带所有权、区域解析、群调度与完整形态/状态/破坏目录；此时若 Game 持有新机械根，必须登记 U03 合同，并安排真实 Game 空间动作的保存/录像/回滚专项。当前原生 fixture 支持几何/身份/索引/落点计划和纯 codec 往返，不支持从默认生产开局播放注入后的多格录像。生产未开放入口保持明确拒绝，不能只移除拒绝就宣称能力实现。

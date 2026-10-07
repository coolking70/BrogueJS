# 5A3 交付报告：结构性质、运行期 region、房间与 RestPoint

2026-10-07，工作树交付，未 commit / push。5A3a–f 已实现；相关门禁、真实组合、工作几何对照及性能实测见下文。CE 参考源码未能取得：GitHub DNS 解析失败；涉及 CE 源码的 5 项明确为未验证，不计作通过。

审查追加修复已完成；当前行为、推进时间性能和最终门禁见[§7审查发现处理](#7-审查发现处理)。§0–6为首次5A3交付的历史记录；§7明确修正其中失效的结论。

## 0 基线与开工核对

- 当前分支 `ext/phase5`；开工 HEAD `56ad210542433d942ba8f93c8e059e38b4ba3dbc`（`docs(ext): set 5A3 baseline`），工作区干净。任务书指定生产基线为其前一个 commit `0d5a231`；二者生产源码相同。5A2、5A2-S 和 foundation 调度器修复已在该基线。
- 开工 foundation 8 / whole-run 5 / recording 4 / origin 2 / worldSdk 1 / world5.schema 1。最终仅 foundation 升至 **9**；现有四模块 module/rules 版本未改。
- `src/ext/worldSdk.ts` 开工及交付 SHA-256 均为 `e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f`；逐字节相同。未触碰 `src/ext/modules/crafting/**`，没有新增依赖、公开建造命令或产品 UI。
- 已读 AGENTS、HANDOFF、development、architecture、ext README、任务书及其合同/设计引用；按已批准 R1–R15 执行，未提出额外裁定。
- 所有验收/捕获/性能命令使用 Node **24.19.0**（`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 放 PATH 首位），`NODE_OPTIONS=--max-old-space-size=3072`，所有 Vitest `--maxWorkers=2`。未跑完整 npm test、全部 test:ext、test:full、test:gen 或 removal 矩阵。
- 原始证据、脚本、成对性能样本和完整对象图放 `/private/tmp/phase5a3-evidence/`；只读基线封存在 `/private/tmp/phase5a3-baseline/`。多 MB 原图未放入仓库；已有 UR4 gzip 是受归因约束的黄金夹具。

开工事实按交付代码的实际行号重定位：

| 事实 | 实际位置 | 核对/处理 |
| --- | --- | --- |
| 四层性质刷新及原生 setter | Grid.ts:865 / 1021 / 1029 | 原生四层与写法保留；刷新时观察地基并合成缓存 |
| DF 旗标、液体传播、直接层写入 | DungeonFeature.ts:242 / 361 / 468 | 统一 flags；液体另合成结构 liquid；原生目标层照常写 |
| Promotion/火写口 | Promotion.ts:540 / 628 / 776 | 原生层晋升条件仍问具体基础层；结构参与点火，地基结果由观察器处理 |
| 气体类型与 volume 写口 | Gas.ts:174 / 189 / 366 | 原生 tile/volume 不变；阻挡 helper 经统一 flags，刷新触发观察器 |
| region 严格 schema | ext/regions.ts:31 | 非空、递增 ID、≤128、不重叠；新增 revision / 运行期 slot |
| 生成 region 发布 | runtime.ts:1528 / 1548 | 共用 EntityId 分配器；revision 初值 0；不伪造 token |
| region/interactable 身份互斥 | ext/world.ts:68 | 原断言保留 |
| 运行期 region 发布与最后键删除 | runtime.ts:1668 / ext/world.ts:84 | 调用 setOwnedRegions，最后撤销删除键 |
| 放置/交互线 | ext/worldSpatial.ts:8 / 29 | 消费已合成的 Cell 缓存；三种子逐格黄金对照 |
| adjacent-passable 工作位 | WorldWorkWorld.ts:145 | 原几何、排序、对角与交互线保持；阻挡经合成 flags |
| combat 篝火中断 | WorldRestProduction.ts:148 | 未改；保持 combat 账本、收据与 full-on-complete |

## 1 实现与合同完成情况

| 子步 | 状态 | 实现及证据 |
| --- | --- | --- |
| 5A3a | done | CellProperties 为机械合成内核；四层 signed 位 union 保留，无结构仅 WeakMap 快路。机械 flags、缓存、液体、物理/魔法弹道、已知地形分别统一；72 文件 954 条逐条清单见附录 A。新源码守卫与 module-boundary 接通，目录别名/namespace、解构与字符串索引均纳入检查；原生、giants 全自有、combat、UR/U03/录像等相关门禁见 §4 |
| 5A3b | done | 稀疏四槽、WorldId/HP/door CAS、建造/开关/拆卸/损伤事务；台/箱/RestPoint 可共同关联一个 fixture 且各自身份唯一。工位可原子绑定独立台；损毁取消票据退款一次，箱物品合法近邻落地或 remains；R8 火及 R9 地基失败。384/3072/12288、16 箱/营地、128 台、64 RestPoint 预算均验证 |
| 5A3c | done | 9×9 create、包含旧 bounds 且≤24×20 expand、有关联 C5_RESERVED retire；全局 8/同层 1/共享 128，最小空闲 slot 与独立高水位；最后删除 regions 键，save/load 后仍无键；生成 region revision=0；不自动绑定普通居民 |
| 5A3d | done | 79×29 四邻 flood、稳定 2…128 格、封闭且不接开放通道；天然墙/墙/门框/窗作边界，开关不改拓扑。完整有效顶、bedroom/warehouse/workshop、多标签及炉通风；1/2/128/129/130、缺顶、对角角洞、确定性和 0 RNG/0 tick 测试。会话 WeakMap，load/seek 重建 |
| 5A3e | done | 独立及 fixture 关联 RestPoint；严格策略校验、同层/距离/交互线/THREAT/BUSY/CAS；逐条 auto_step 原生 wait、最大步数、满血/扰动/伤害/移动/毁目标结束一次 owner 收据，lastUseOrdinal 单调；无 ticket/bundle、不清毒/饥饿；save/load/replay/seek/续作和 combat 共存 |
| 5A3f | done | 开工代码先捕获工作位/每格交互线及原包指纹；迁移后严格相等。11 组原真实组合加 2 组含结构场景，覆盖任务书要求的所有组及额外骨架组合；每组真实新局、游玩、save/load、逐条 replay、seek、续录 |

可信接口在 `src/engine/Map/StructureWorld.ts`，扩展声明在 `src/ext/structureTypes.ts`。`structures?` / `restPoints?` 不归一成空数组；只有声明任一键的包才把 foundation 的火/退款规则纳入指纹。原骨架与 c5fixture 基础包的指纹在预迁移 JSON 中逐值冻结并通过。

统一失效：显式结构事务使 spatial terrain revision 失效，重新绑定合成性质、全层房间、空间/位姿、怪物路径与安全缓存、loop/waypoints、光照/FOV、可见记忆。原生 setter/cache 性质变化也沿原 SpatialRevision 机制增加 revision；这里保证单调和旧计划过期，不承诺一次事务数值只 +1。组件、region、RestPoint 的 CAS revision 按各意图 +1。非结构原生 gas/volume 动画不重复重算房间；观察器发布时建立格索引，地基查询不扫描全局 3072 行。

失败恢复采用结构层 checkpoint + 既有 WorldWork 事务：独立完整对象图 oracle 覆盖原引用、logger、所有关联物品、分配器、RNG、原生层、空间 revision 和派生缓存。region、interactable/RestPoint、derived 发布点及原生地基失败均有“发布后抛错”注入；没有只比 JSON 替代写集差分。额外原生邻格回归发现观察器早于 Cell 缓存刷新导致即时 FOV 过期：现由同一事务先发布当前格缓存再重建。失败时恢复当前 WeakMap 观察器和原层/阻挡缓存，下一次 no-op refresh 不重放已回滚变动、不增加空间 revision 或消耗 RNG；Grid 仍是唯一 boolean 赋值入口。

U03 只扩展现有 `autoAction` 联合，登记 `rest_point`；没有添加 Game 自有字段。摘要仍为 `native/extensions/world5/actorActions/knowledge/random` 六域，`recording-digest-contract.json` 无需增加根；结构/RestPoint 在现有 world5 域，region 在现有 extensions 域。whole-run 外壳/实体字段、digestAlgorithm 与录像格式未变；codecIdentity foundation 标签同步为 9。

## 2 自定实现细节

1. 基础 flags 按四层 32 位 OR；结构定义在可信发布时编译为阻挡掩码，热读不遍历四部件。原生秘密门、钥匙晋升、具体 tile/surface 目标仍是基础类型语义；保留其原生分支，同时先应用结构阻挡。
2. 已知移动预览共用 knownCellFlags：可见格读当前合成性质，隐藏格只读保存的基础记忆与 movement/diagonal bits；未知格仍乐观，不查询隐藏 live 结构。growth 预览相应接通。
3. 普通投掷、distance attack、poison dart 与 blink 使用物理路径；其他法术使用定义的 magicProjectile，blink 还独立遵守移动阻挡。窗透气/透视且阻物理/液体，魔法由定义裁定。
4. 同一 fixture 允许箱、台、RestPoint 共存；分配不同 interactable 身份、坐标都镜像结构格，读档逐个校验。没有引入合同之外的“设施三选一”。箱在首次建造时预建该层 remains（≤1024 槽）；既有 remains 复用。
5. 损毁近邻按 y/x 顺序，排除危险基础层、结构阻挡、机器/impregnable、生成保护、楼梯/锁门、物品、设施及活动/缓存层的全足迹；无合法格即同层 remains。拆卸按合同固定 1/2 公式，包含库存/预留槽与 C5 Item roots 预算，失败整个事务恢复。
6. 通风只认边界上的完好窗/开放门及其外侧非同室稳定空气格；炉必须有通风才能成为 workshop。标签数组排序稳定；屋顶资格依赖完整受支持房间，破顶立即使 usableRoof/roofBlocksSunlight 失效，不砸人。
7. RestPoint 每个 auto_step 走原生 wait 的时钟、回血（既有 native.regeneration）、毒与饥饿；步数上限为 maxRestTicks/100，不另设 scheduler/bundle。hp:none 不提供额外恢复，不关闭原生 wait 的固有回血；两种允许策略都不做完成时补满。非命令 stop 仅标扰动，下一条录制命令写一次收据。
8. region 同层重叠/已有营地返回 C5_OVERLAP，全局容量返回 C5_BUDGET；不可见施工统一 C5_BLOCKED，保护拒绝统一 C5_PROTECTED。普通居民 movementRegionId 不自动分配。
9. 源码守卫用 TypeScript AST 扫描 TS/TSX 与 Vue script，按函数/表达式/语句内容钉住逐条基础类型与写入口；机械 helper/cache 必须经合成。额外检查目录别名、namespace、结果解构及字符串索引，避免只查 `.flags` 漏读。
10. 可信写口返回 chargedTicks 义务；测试 fixture 负责展示事务，不为产品决定建造调度。waypoint 重建使用原生机械重建路径，其随机消耗属于提交；纯性质/房间/规划读不消耗实质随机流。5C1 应用 chargedTicks 经原生唯一计时点承担耗时。

## 3 工作几何与黄金归因

工作几何在任何生产迁移前，开工基线用 `C5_CAPTURE_GEOMETRY=1 npx vitest run src/test/ext_structure_geometry.test.ts --maxWorkers=2` 捕获（exit0，1 项，2.95s），JSON 记录 commit `56ad210`。种子 51020001/42/7306、骨架+c5fixture 每个节点/台/箱，以及 5A2 尚无实体的 rest-anchor：记录全部 adjacent-passable 集合、全 79×29 的 hasInteractionLine 布尔矩阵及定义指纹。迁移后同测试逐格/逐指纹精确相等。

版本格式是唯一获准的零结构差异；生成、机械世界、RNG/事件未重录为新行为：

- 巨兽三条自然 trace：只读基线原测试严格通过。原生/native、输入、RNG 逐值相同；extensions 哈希差异经去掉新增的生成 region revision=0、将 manifest.foundation/foundation.version 9→8 投影后，精确返回旧哈希。恢复新代码用原 `BROGUE_CAPTURE_GIANTS_TRACE` 捕获；字段与前后值见附录 C。
- UR4：基线捕获与仓库旧 gzip 完全相等。最终候选只回退 Game 录像头和 RecordingDigest.codecIdentity 的同一个 foundation 版本变量 9→8，**旧黄金严格通过**（1 项，6.39s，exit0）。用原 `UR4_CAPTURE=1 UR4_CAPTURE_DIR=... npx vitest run src/test/u_r4_trace.test.ts --maxWorkers=2` 重录；JSON 只变 52 个 chainDigest，所有原生快照、事件、tick、双 RNG 相同。
- 摘要独立 SHA 向量：六域完全不变；仅 codecIdentity、header foundation 9 导致 root/start/chain 三个向量改变。保留独立 canonical+SHA 计算断言，旧/新值列附录 C。
- 4a0 全对象图旧 JSON 在开工基线就已过期（最后更新 b2547d6/5A1）。旧文件→开工真实结果已有 **96 个 SHA + 52 个 objects** 差异；没有把这 52 个历史对象数差异归给本步。开工→本步为 **86 个 SHA**，对象数、机械字段、消息、RNG 相等。原捕获方法 `P4A0_CAPTURE=1 P4A0_CAPTURE_DIR=...` 在前后各生成 104 份原始完整图；逐叶差分 **1062** 项仅 foundation 8→9 或 prefixDigest/root/initialRoot/extensions/chainDigest 派生哈希，无形状/机械差异。原方法重录紧凑 JSON 后原断言严格通过；历史差异和本步全部叶登记见附录 C。

UR2/UR3 与生成基线未修改。旧守卫前提修正只有：c_4a 登记新唯一合成内核这个基础 mech reader（基线旧测试30项严格通过，104.76s）；c_4b 已在开工源码存在 6 参数 takeDamage，而旧文字前提期待4参数，基线也复现同失败，修正两分支文字前提并保留 callback 在 HP loss 前的断言；phase4a4 的手工 region 补 revision=0，原几何/碰撞/归属断言不变，基线旧测试16项通过。x2b writer 守卫没有改；观察器元数据 layers 改名 observedTypes，避免误登记为原生层写口。

## 4 实际门禁与失败记录

下列 Vitest 命令均附 `--maxWorkers=2`，运行环境见 §0。完整文件清单见附录 B；同一文件重复测试不合计成独立用例总数。最初主批158文件：152通过、6失败，2735通过/9失败/1既有skip；六个失败文件已经在最终相关复跑中全部严格通过。首轮结果不写成成功。

| 命令/批次 | exit | 结果 | 耗时 |
| --- | --- | --- | --- |
| `node scripts/check-module-boundaries.mjs` | 0 | 通过（build 包含 vue-tsc；保留原有大 chunk 提示） | 3.71s |
| `npx vue-tsc -b` | 0 | 通过（build 包含 vue-tsc；保留原有大 chunk 提示） | 16.57s |
| `npm run build` | 0 | 通过（build 包含 vue-tsc；保留原有大 chunk 提示） | 21.84s |
| `npx vitest run` + 附录 B 的158文件 | 1 | 首轮152通过/6失败，2735通过/9失败/1 skip | 1735.63s |
| format-final：UR2/3/4、4a0、digest、x2b、c4a/c4b、region、source guard | 0 | 10文件/125通过；解决主批全部失败 | 173.04s |
| related-final：附录 B.2 的14文件 | 1 | 13文件通过、178通过/1新 fixture 预期错误 | 118.48s |
| protection-final3：真实 D3 巨兽场地与各保护/预算 | 0 | 17通过，修正 D1 无 arena 的测试前提 | 12.99s |
| budgets-final：protection / transactions / combinations / region | 0 | 4文件/39通过，含最终19项保护/预算 | 23.94s |
| rest-budget-final：ext_rest_point_runtime | 0 | 最终26通过（包括共享64预算） | 18.26s |
| zero-final：ext_structure_properties | 0 | 13通过（后续定义校验扩为14项；含隐藏记忆、256混合四层/双RNG） | 8.89s |
| definitions-final：properties / rest_point | 0 | 2文件/40通过，含结构定义19种拒绝前提 | 18.18s |
| observer 首轮：integration / transactions / rooms / properties | 1 | 45通过/1失败：地基格阻挡缓存回滚差异 | 20.40s |
| seal 首轮：x2b / sourceguard / geometry / combinations | 1 | 23通过/1失败：boolean 赋值点数超守卫；U03误写过滤项未匹配文件，未计入 | 42.44s |
| publication-final：properties / integration / transactions / rooms / x2b / sourceguard | 0 | 6文件/67通过，含邻格即时 FOV、两类回滚后二次刷新 | 43.99s |
| final-core-other：region / rest / protection / geometry / combinations / U03 | 0 | 6文件/67通过（含U03 14项；核心其余53项） | 61.61s |
| roof-final：ext_rooms_topology | 0 | 最终11通过（含屋顶性质） | 11.99s |
| perf-optimization-tests：properties / integration / transactions / rooms | 0 | 4文件/40通过，索引优化后 R9、物品与派生恢复 | 21.38s |
| boundary-final3：transactions / rest_point | 0 | 2文件/38通过，含台票据取消退款、设施同格 | 24.94s |
| `npm run test:drift -- --maxWorkers=2` | 0 | 最后复跑4文件/5通过（生成与巨兽 trace） | 87.22s |
| `npm run ce:fetch` | 1 | GitHub DNS 失败，未取得参考源码 | <1s |
| `npx vitest run x4_r1_world_catalog x2g_native_effects` | 0 | 2文件/22通过/**5 CE依赖skip** | 8.38s |
| 基线 UR4+phase4a4 原断言 | 0 | 2文件/17通过 | 11.35s |
| UR4 foundation 单变量反事实 | 0 | 旧黄金1通过 | 6.39s |
| 基线 c4a 原断言 | 0 | 30通过 | 104.76s |
| `git diff --check` / SDK SHA / crafting diff | 0 | 无空白问题、SDK相等、crafting无改动 | 常规检查 |

新增核心10文件最终100项通过；性能 observation 另通过1项，未把默认 skip 的计时开关当作普通功能测试。既有11组真实 lifecycle smoke和新增2组含结构smoke均在相关复跑通过。所有新增文件已登记底座套件。

首轮失败分辨：c4b 是开工已存在的旧前提；4a0 包含明确历史过期基线；region/digest/UR4 是 R1/R6 格式前提；x2b 为观察器字段命名，改生产不改守卫。最终缓存回滚方案首版增加 boolean 赋值点，原 x2b 守卫明确失败（4点而非2点）；改为保存待发布值、同一赋值入口恢复，守卫未改。原生观察器回归首轮还暴露地基失败后两项缓存未恢复，修生产并保留独立全图断言。开发新增测试中曾有 it.each 数组参数拆分、选择了另一只基础箱、导入 readWorkContext 入口错误、把同层营地错误码写为 BUDGET、在 D1寻找D3巨兽场地，以及 TS lib 不支持 Array.at；只修具体测试前提/声明，最终原行为断言全部保留。事务 oracle 早期发现 runtime/logger 浅恢复不足，已改为深恢复并通过四类发布后失败测试。没有用删除测试/放宽机械断言换绿。

## 5 性能实测

Apple M5 /10核/32GiB/arm64；Node24.19.0/3GiB堆。最终独立 `node /private/tmp/phase5a3-evidence/perf-final.mjs`，无测试/build并发；测前/测后 src/scripts/public 封存 SHA 相同（crafting 排除，因为不属于本步）。两个隔离 Vite 源树、真实 Game、同种子51020001、交替 baseline/current 顺序；每档2049真实录制 escape 命令，丢前32，**2009普通成对差值**，8个完整 checkpoint另列，沿5A2-S实际 recorder成本方法。满档在真实生成/缓存的8层装配3072格/12288部件，每层384，开门+floor+roof+无设施fixture；严格结构根/引用校验及完整save导出。该计时装配不作为从菜单可重放的产品剧本。

FOV/Dijkstra/gas 预热12次、采样80次；全8层房间30次。单位 ms，median / P95：

| 档位 | FOV | 寻路 | 气体 | 房间 |
| --- | --- | --- | --- | --- |
| 5A2-S零结构 | 0.0334 / 0.0339 | 0.3888 / 0.4092 | 1.5216 / 1.6773 | 无房间接口 |
| 5A3零结构 | 0.0333 / 0.0352 | 0.4057 / 0.4292 | 1.6289 / 1.8517 | 1.8634 / 2.0902 |
| 5A3满结构（全局3072/当前384） | 0.0334 / 0.0349 | 0.4378 / 0.4828 | 1.7883 / 1.9544 | 3.5026 / 3.6203 |

满结构全8层房间重算：28.3550 / 29.6105 ms。索引优化前/后满结构 gas P95 为16.8227→2.0053 ms（封板最终测量见上表）；没有改变原生气体算式或随机消耗。零结构热读保留四层行为，成本为一次合成绑定查询；表中绝对耗时和噪声均保留，不用单独分布 P95 相减称为新增成本。

| 录像档位 | baseline median/P95 | current median/P95 | 成对新增 median/P95 |
| --- | --- | --- | --- |
| 经典零结构普通命令 | 0.0305 / 0.0373 | 0.0305 / 0.0370 | -0.0000 / 0.0033 |
| 八层满结构普通命令 | 0.0718 / 0.1574 | 0.0716 / 0.1661 | -0.0012 / 0.0291 |
| 经典零结构完整 checkpoint（8个） | 70.9102 / 144.2662 | 72.3022 / 145.7827 | 0.8961 / 2.0534 |
| 八层满结构完整 checkpoint（8个） | 560.4956 / 1129.1375 | 606.5319 / 1321.2553 | 46.3729 / 192.1178 |

最终独立性能脚本 exit0，wall 24.08s；先前有一次与 types/build 重叠的采样已作废，不引用其数据。

经典局普通命令新增在微秒级，低于5A2-S的1ms验收尺度；完整 checkpoint沿原周期另列。**满结构完整 checkpoint有约1.32秒峰值，额外结构序列化/哈希P95约192.12ms**，没有藏在普通命令分位数中。满档不是全部墙关闭/最大设施的最坏拓扑，未验证产品建造 UI 的逐格交互延迟；5C1 可据此测真实营地布局，不改变本步预算与摘要周期。

## 6 交接给5C1与未验证项

- 定义入口：`ext/structureTypes` 的扩展 WorldDefinitionPack；原冻结 worldSdk仍1，不把结构字段塞回它。产品内容注册/公开投影按settlement合同接入，生产catalog本步没有c5fixture。
- 命令适配：在录制命令的可信 actor scope内调用 `planRegionChange` / `planStructureChange` / `planRestPointPlacement` / `planRest`，一次性 `commitStructureWorld`；CAS不跨命令/epoch，build包含region/inventory/既有station CAS。公开 build/dismantle/door/rest/region仍由5C1适配，并通过唯一原生计时入口消费chargedTicks；UI草稿≤16顺序提交，不存档。
- 营地：最小空闲slot0…7、global8/same-level1、create9×9、expand含旧bounds且≤24×20；slot高水位不因拆营归零。retire须先解决关联，不自动删设施/票据/居民；最后删除regions键，已访问层/生成身份保留。
- 火：每100tick原生环境边界，对每个flammable部件 `max(1,floor(maxHp*(100-fireResistance)/1000))`；火抗100仍最少1。基础DF/Promotion照常写，地基不稳定时同边界损毁全槽及关联。
- 保护：native楼梯/出口/D40/机器/impregnable/生成场地、活/休眠全足迹、地面Item、任何interactable与唯一合法工作位；施工后玩家和已登记居民仍有按原生对角规则到出口的路径。怪物不自动开结构门或攻击结构。
- 房间：`identifyRooms` 为可信全层只读、会话ID；公开已知投影裁剪由settlement做。2…128、全顶、bed/chest/台工位标签、炉窗/开门通风；地下天然顶不算屋顶，缺顶立即失效资格。
- RestPoint：逐条auto_step、天然回血/毒/饥饿；没有补满/刷新/保命。combat篝火仍独立；非命令停止不得写收据。
- **未验证**：CE源码对照5项（fetch DNS失败）；产品公开命令/建造UI/已知Room投影/日照产品呈现、居民/订单/袭击、site、怪物开门/攻击结构、满设施最坏房间拓扑与UI延迟、全量/removal矩阵。它们是网络限制或本步非目标，不冒充已验收。


## 7 审查发现处理

本节是 `phase5a3.review-findings.md` 独立审查及维护者追加裁定的交付记录，取代 §1、§2、§5 中关于逐格观察器事务、即时 R9、房间全层绑定重算、world5 单叶及 escape 性能验收的原结论。§0–6 保留首次交付的实际历史证据；当前行为与性能以本节为准。全部 P1/P2/P3 已处理；Worker 异步摘要按裁定只交接口草案，未实现。本轮仍未 commit/push。

### 7.1 复核与逐项修复

在封存首次 5A3 的 `/private/tmp/p5a3r` 中，使用 Node24.19.0 / 3GiB / `--maxWorkers=2` 重跑 `src/test/zz_review_p5a3.test.ts`：8 个观察性探针通过（exit0，12.67s）。这些用例主要打印旧行为，**其通过不表示缺陷已修复**：关门返回 C5_PROTECTED、生成节点阻塞撤营、30 次 setter 触发30次派生刷新、wait 重哈希及完整摘要/SHA成本均复现。旧 R8 探针没有构成有效封闭，不计作怪物运行证据。P3 其余项逐生产路径复核，再用修复后的断言回归；没有把静态阅读称为旧版运行复现。

新增 `src/test/ext_structure_review.test.ts` 共23项，已登记底座测试清单；独立摘要参考放在 `src/test/support/recordingDigestPreReview.ts`。逐项如下：

| 发现 | 复核及当前处理 | 回归证据 |
| --- | --- | --- |
| P1-1 | 原 observer 确实在 setter 中 checkpoint/全层重绑/重建派生。现在只记数值格索引、首次 before 和拓扑脏位；原生环境步末一次 `settleStructureFoundations`，catch-up 沿同一环境循环。非环境内直接 DF/法术写入在录制命令结束边界补结算。纯拓扑按该层一次派生刷新；房间按脏层读时重算。R9 失败被包含，命令已耗时间保留，写 interrupted/C5_TRANSACTION 收据 | review：30 setter 零派生调用→一次结算仅1次；R9 发布后失败仍推进 wait、保留同一物品/箱引用、恢复稳定地基并可存档；原 transactions 的完整图/RNG/CAS/发布故障覆盖保留 |
| P1-2 | foundation9 未冻结，六域不增减，world5 叶表拆分为小 root 与按层 structures/restPoints/stations/nodes/containers/orders/tickets；事件摘要缓存每叶规范化串与 SHA，结构层 token 不含世界时钟。层内再缓存未改结构行的规范化串。full oracle仍重新投影、规范化、哈希 | review：推进时钟不替换结构分组；改 HP/revision 后 dirty/event/full 三侧相等；缓存规范化串逐字节等于独立 c5Canonical；wait/move/HP-write 的实测见7.3 |
| P1-3 | escapes 对玩家及登记居民把完好结构门视为可开通路，原生对角限制保留；新建门也按可开出口验证。怪物仍消费关闭门的移动阻挡 | review：围室内关门、门关着施工、新建唯一出口门且屋内有居民均成功；独立40回合封门怪物测试 |
| P2-1 | retire 的实体检查收窄至同 owner、同层且区域内，排除生成资源节点与 remains；结构 regionId、campSlot居民/离线账继续阻止。订单/票据按目标台/节点的位置；无目标时按 camp居民或当前 actor 位置归属区域，同层区域外工作不阻止 | review：生成期节点不妨碍撤空营；orders/tickets 各验证区域外允许、区域内 C5_RESERVED；原 region/设施关联拒绝仍测 |
| P2-2 | remains 从损毁来源做可达 BFS，候选须已知、基础稳定、可放设施且在所有营地外；优先接近该层任一上行楼梯。既有 remains 复用并必要时迁出新增/扩展营地。容量计入预留槽，满时原生 Item 落在 remains 格；无容器候选时回源格落地，容量不会抛错 | review：界外可达且最近合格上楼梯距离；满容、邻格全封时同一 Item 对象/数量只落地一次，无 C5_CAPACITY；原箱/退款事务一致性测试 |
| P2-3 | `spawnMapDF` 的传播判据在抽随机数前拒绝结构移动阻挡格；源格仍允许表面落火。液体 helper 接到同一传播入口 | review：100%表面波在墙格及墙后为0，墙源格仍为1；DF/火/气体原生测试及 drift |
| P2-4 | 按层增量绑定，watcher复用；数值下标与 Uint8Array flood/seen/roof表，roof资格 O(1)。稳定地基读不触发房间计算。定义Map缓存；层请求校验一次，结构根仍在发布/读档严格验证，热读不逐行重复schema校验 | review：干净层返回同一冻结房间数组，拓扑写后只重算首次读；rooms_topology 原2…128/开放/通风/屋顶/0 RNG覆盖；7.3区分纯flood与绑定成本 |
| P2-5 | SHA热循环用模块常量、标量状态及64/128尾块，去每块解构/闭包与整份padding复制；录像机械投影去 JSON往返；2048 snapshot/full共享一次世界投影。未改摘要周期或native/knowledge独立全量oracle | review：Node crypto独立校验Unicode、0…139边界和1MiB；冻结旧投影+独立SHA校验未改五域；2048仅投影一次、snapshot/checkpoint相同且快照独立于后续live写；真实2049命令、v4 seek/存储/续录回归 |
| P3-1 | 记忆快照保存结构字形；隐藏格显示保存的 rememberedAppearance，不读隐藏live结构 | review：墙离开视野仍显示#；原appearance及memory测试 |
| P3-2 | 魔法地图写入DUNGEON/LIQUID的合成阻挡并保存结构字形 | review：未探索墙的 rememberedTerrainFlags阻行且glyph=#；原mapping/旅行相关测试 |
| P3-3 | 隧道与碎裂批量移除作用范围内结构障碍，不返拆卸材料；调用方原impregnable保护保留。隧道实际射线还处理魔法透明但挡移动的窗，避免射线穿过却不挖 | review：墙 tunnel/shatter各1项、真实tunneling bolt窗1项；原w13/u15a |
| P3-4 | create/expand在检查隐藏机器、足迹、重叠、预算前先要求所有候选格可见；未知格统一 C5_BLOCKED | review：未知普通格与未知machine格同码；原保护/预算的已知布局断言保留 |
| P3-5 | 零绑定/零观察者用模块级计数快路跳过查询；四层固定OR展开以保留热循环内联，零结构不查询结构WeakMap。最后撤销/换grid清理旧绑定与watcher | 混合四层/RNG性质回归、x2b唯一boolean写口、原气体/寻路相关及drift；对5A2-S的成对零结构重测见7.3 |
| P3-6 | 绑定时缓存结构外观与定义Map；每帧structureAppearance仅取缓存 | review字形/记忆及原渲染测试；生产绑定路径复核，没有每帧flatMap/find |
| P3-7 | cellLiquidBlocked已接入spawnMapDF液体传播；该入口只合成结构liquid，保留原生DF的传播类型例外。默认helper仍含基础阻行语义 | 原integration水/气闭墙用例保持；DF测试；附录A登记调用点 |
| P3-8 | 撤营订单检查随P2-1一起收窄 | orders/tickets的区域内/外两项；region关联原测试 |

追加运行证据：rat位于由7面墙与关闭结构门构成的真实封闭后，初始为 hunting 状态，真实 `executeCommand('wait')` 40次，世界推进至少4000tick；怪物存活、没有越过门、没有卡死或异常。该用例不假定怪物会自动开门或攻击结构。

### 7.2 实现细节与摘要值边界

环境降级恢复结构经济事务及关联对象；对实际导致地基不稳定的基础层恢复 observer记录的稳定 before，其他已发生的原生效果和已耗时间保留。失败只按受影响层owner记一次 interrupted/C5_TRANSACTION，显式建造/损伤事务仍维持完整原子回滚。非致命火伤先预计算全部HP/CAS修订，再一次写入并标该层摘要脏；不重建路线/房间、不耗RNG。致命损毁及R9共用批量事务。

`recording-digest-contract.json` 登记world5新叶表：空数组保留无深度的数组键，非空按层分组且保持原行序；null world5仍是旧root:null。foundation9允许的world5布局变化会改变非空world5域及其root/chain；**P2-5本身的SHA、克隆和共享投影加速不改任何摘要字节**。冻结旧投影实现加独立Node SHA逐值校验 native/extensions/actorActions/knowledge/random 五域，world5则按批准的新叶表独立计算。full oracle不复用事件叶缓存，native/knowledge每256条完整重算仍保留。2048快照只复用同一边界投影，另复制以避免live引用；WholeRun投影不含正在形成的recording事件，复用前后语义相同。没有增加Game自有字段；SDK格式/公开接口、whole-run5、recording4、origin2、world5.schema1均未改。

本轮没有重录任何黄金/生成夹具：UR2/3/4、巨兽自然trace和4a0等已通过本轮相关测试，首次5A3登记的黄金文件与审查副本字节相等。原报告附录C仍是首次版本归因记录。

### 7.3 推进时间命令与性能重测

最终独立运行 `node /private/tmp/phase5a3-review-fix/perf-review.mjs`，exit0；Apple M5/10核/32GiB/arm64，Node24.19.0、3GiB堆，没有Vitest/build并发。主对照是审查副本的首次5A3（同fixture、零结构）；另用封存5A2-S做零结构对照。源树分别在隔离Vite加载，交替先后顺序；真实生成/缓存8层，满档3072格/12288部件、每层384，严格根/引用校验和save导出。

classic和满档分别2049条真实录制wait，每条断言世界时间增加，丢前32，2009个普通成对差值；8个256/2048完整checkpoint另列。move用原生{x,y}左右交替433次；HP档在executeCommand内让一格floor的HP在99/100之间切换、revision递增及单层绑定，再调用原生wait，计时含全部写入/发布/摘要；各丢前32、剔除完整checkpoint。HP档是受控持续写入夹具，不冒充全营地同时燃烧的最坏场景。

旧§5的escape不推进时间，不能证明普通耗时命令阈值；此处明确撤回该验收结论，以以下成对差值替代。单位ms，median / P95：

| 档位 | 首次5A3零结构对照 | 修复后 | 成对新增 |
| --- | --- | --- | --- |
| classic wait普通（n=2009） | 4.2150 / 4.6197 | 3.7307 / 4.2114 | -0.4707 / -0.0549 |
| 满结构wait普通（n=2009） | 7.8426 / 8.6499 | 7.3735 / 8.1936 | -0.4448 / 0.2351 |
| 满结构move普通（n=400） | 7.8077 / 8.4451 | 7.3212 / 8.0508 | -0.4717 / 0.3219 |
| 满结构HP写入+wait普通（n=399） | 7.7554 / 8.7112 | 8.3889 / 9.5850 | 0.6793 / 1.8178 |
| classic完整checkpoint（n=8） | 81.9010 / 159.8052 | 56.7886 / 103.3108 | -25.6374 / -25.0903 |
| 满结构完整checkpoint（n=8） | 579.0215 / 1170.3597 | 415.0785 / 810.9228 | -160.6554 / -135.4170 |

三档满结构普通命令的新增P95均≤5ms；完整checkpoint仍同步阻塞，不能计入普通命令或声称已完全消除。move/HP追加档各自的完整点及原始逐对数据保存在仓库外JSON。

8MiB纯JS SHA（预热后9样本）：旧 109.2944 / 111.8405 ms，新 26.3114 / 28.6292 ms，中位加速 **4.15倍**；Unicode/分块正确性由独立Node crypto回归保障。

零结构对5A2-S使用80轮预热、500轮交替成对采样，而非独立P95相减：

| 零结构热路径 | 5A2-S median/P95 | 修复后 median/P95 | 成对新增 median/P95 |
| --- | --- | --- | --- |
| FOV | 0.0335 / 0.0347 | 0.0310 / 0.0327 | -0.0025 / -0.0015 |
| Dijkstra | 0.4037 / 0.4269 | 0.3172 / 0.3332 | -0.0883 / -0.0793 |
| gas | 1.6192 / 1.7070 | 1.1285 / 1.1622 | -0.4950 / -0.4441 |

满结构当前384格：FOV 0.0310 / 0.0322 ms，寻路 0.3765 / 0.4046 ms，gas 1.4116 / 1.4853 ms。干净层房间缓存读 0.0004 / 0.0005 ms；**单层纯flood** 0.1517 / 0.1685 ms（绑定在计时外），单层绑定+flood 0.3572 / 0.4682 ms；人为逐一弄脏全部8层再绑定+计算 2.4418 / 3.1178 ms（30样本），它不是每次提交的成本。前四项预热12、80样本。

30次原生拓扑setter 0.1109 ms、setter内派生调用0；单次环境边界 16.2136 ms且派生调用1，之后首次房间读 0.2866 ms。该单次批量观察与旧30次约1.2s的探针分列，不把一次样本写成P95。

性能脚本wall 91.69s；测前/后src/scripts/public SHA均 `b73b51056421b4f9b700db4e0afca7a21d7e8d713b286a1ae0429fd7f5d61802`（crafting排除，不属于本步）。只有显式写入层重新规范化结构叶；世界时钟前进不会重哈希全部结构。未测满设施最坏拓扑/真实产品建造UI延迟。


### 7.4 本轮实际门禁与失败记录

所有命令仍用PATH首位Node24.19.0、NODE_OPTIONS=--max-old-space-size=3072；Vitest固定--maxWorkers=2。按开发期相关档运行，未跑full npm test、全部test:ext、removal或CE fetch。相关集之外的CE源码对照5项仍是首交未验证记录，不计入本轮通过数量；以下选中集合没有skip/todo。

| 批次/命令 | exit | 实际结果 | 耗时 |
| --- | --- | --- | --- |
| 审查副本复现zz_review_p5a3 | 0 | 8观察探针；旧缺陷被复现 | 12.67s |
| related-final，附录B.4的92文件 | 0 | 1527通过，0 skip/todo | Vitest1243.38s / wall1243.89s |
| seal-related（实际匹配20文件） | 0 | 309通过；过滤词ext_recording_v4_dirty未匹配文件，未计入 | 259.34s |
| review-seal | 0 | 新审查回归23通过 | 18.23s |
| 最后native/structure/recording封板，附录B.4的34文件 | 0 | 485通过；包括全部核心123项 | Vitest281.03s / wall281.41s |
| `node scripts/check-module-boundaries.mjs` | 0 | 通过 | 2.02s |
| `npx vue-tsc -b` | 0 | 通过 | 8.18s |
| `npm run build` | 0 | 通过 | 11.27s |
| `npm run test:drift -- --maxWorkers=2` | 0 | 最后4文件/5通过 | wall54.76s |
| `git diff --check` / SDK字节 / crafting diff / 黄金字节 | 0 | SDK与HEAD相同、crafting无diff、黄金与审查副本相同 | 常规检查 |

92文件批次期间还有少量后续优化，因此不宣称它独自覆盖最终封存源树；随后20文件及最后原生/结构/录像封板覆盖最终受影响路径，drift最后再跑。本轮原始复现、失败日志、逐对性能、命令清单和冻结核对均位于 `/private/tmp/phase5a3-review-fix/`。

最新review-final的23项（含阻止渲染查定义的运行断言）再次通过，17.61s。


旧测试有意变更前提：properties/integration不再期待setter内立即R9/派生更新，先检查结构仍在，再显式执行边界并保留原损毁/视野断言；transactions将原setter抛错改为边界包含失败、保留完整图/RNG/物品/CAS断言，仅单独登记新增失败收据。未知区域一律拒绝后，protection中三项预算/重叠/巨兽场地布局补可见格，再测原错误码，未放宽预算或保护断言。封存旧生产和旧测试的5项 timing反事实仍严格通过（3文件/5通过，30项按-t未选，4.27s）；未宣称visibility三项也做了同一反事实。x2b boolean唯一写口与原黄金断言均未调整。

开发失败记录：首轮相关7文件88通过/5失败，含4项已废弃即时结算前提及天然房间零结构缓存失效；后续80通过/7失败暴露测试外部clear binding后增量发布遗漏，修生产的has-binding检查。预算三项补可见前提；remains预期修正为任一实际上楼梯，生产也修正既有容器重新选址。新增tunneling测试曾遗漏BoltExecution.onCell，vue-tsc与build明确失败，补回调后通过。第一轮性能封板的move参数用dx/dy而原生命令收x/y，时间推进断言失败，该轮不计作最终性能证据；零结构残余开销继续优化后重测。没有删守卫、把失败改skip或降低阈值。

### 7.5 Worker异步摘要管线接口草案（后续步骤，未实现）

建议独立RecorderBackend接口：`enqueue(job): Promise<CheckpointResult>` 与 `flush(): Promise<VerifiedFrontier>`。job包含recording/session generation、codecIdentity/manifestFingerprint、boundaryCommand/previousVerifiedBoundary、同步冻结的world UTF-8投影与inputState、是否同时生成2048快照；结果返回generation/command、fullCheckpoint及可选world/snapshotDigest。Worker和Node同步backend共用同一canonical/SHA模块，值必须相同；结果只在generation和待校验边界匹配时接纳，seek/load/重开取消旧generation。

主线程边界只付冻结投影成本。维护chainFrontier，未取得完整checkpoint的边界及之后先保留payload；结果回来按序补链。保存、来源镜像、导出、IndexedDB、seek及trustedSnapshot消费者先await flush；至多1–2个待决chunk。native/knowledge保持独立全量重算，不在本codec缓存非活动层。事件摘要与full不一致时记录区间 `(previousVerifiedBoundary, command]`，停止下一边界并拒绝保存/续录；快照仅在对应checkpoint已验证后进入trusted集合。后续需单独审查取消、内存上界、错误传播、同步headless对照与消费者异步改造；本步未接入Worker，也未声称消除了完整checkpoint峰值。


## 附录 A：逐条性质读写清单（975 条，72 文件）

| 文件:行 / 函数 | 读取/写入内容 | 分类 | 处理 | 覆盖 |
| --- | --- | --- | --- | --- |
| src/components/MapTileLegend.vue:22 / &lt;module&gt; | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/components/MapTileLegend.vue:24 / &lt;module&gt; | content.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/components/MapTileLegend.vue:24 / &lt;module&gt; | content.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Combat/ActorCombatResolution.ts:271 / projectedContact | this.game.grid.getCell(from.x, from.y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/ActorCombatResolution.ts:271 / projectedContact | this.game.grid.getCell(to.x, to.y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BlinkTargeting.ts:25 / blinkTargetPreview | grid.getCell(p.x,p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/BlinkTargeting.ts:29 / blinkTargetPreview | cellTerrainFlags(grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BlinkTargeting.ts:35 / blinkTargetPreview | cellTerrainMechFlags(grid,landing.x,landing.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BlinkTargeting.ts:37 / lava | cellTerrainFlags(grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BodyPerception.ts:20 / bodySightContact | grid.getCell(p.from.x, p.from.y)?.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BodyPerception.ts:20 / bodySightContact | grid.getCell(p.to.x, p.to.y)?.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BoltTargeting.ts:28 / automaticBoltContact | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BoltTrajectory.ts:17 / trajectoryFlags | cellProjectileFlags(cell,!physical) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BoltTrajectory.ts:18 / trajectoryFlags | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BoltTrajectory.ts:78 / boltLine | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/BoltTrajectory.ts:134 / reflectedPath | cellTerrainFlags(grid, line[0].x, line[0].y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BoltTrajectory.ts:213 / traceBolt | structureBlocking(grid.getCell(pos.x,pos.y)!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/BoltTrajectory.ts:226 / traceBolt | cellTerrainMechFlags(grid, ahead.x, ahead.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Cloning.ts:31 / canPlaceSquareCloneAt | cellTerrainFlags(world.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Cloning.ts:32 / canPlaceSquareCloneAt | cellTerrainMechFlags(world.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Cloning.ts:33 / canPlaceSquareCloneAt | world.grid.getCell(p.x, p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/Cloning.ts:43 / cloneLocation | grid.getCell(p.x, p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/Cloning.ts:48 / flags | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Cloning.ts:52 / qualifies | grid.getCell(p.x, p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/Conjuration.ts:22 / stairs | grid.getCell(p.x, p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/Conjuration.ts:25 / bladeDiagonalBlocked | cellTerrainFlags(grid, to.x, from.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Conjuration.ts:26 / bladeDiagonalBlocked | cellTerrainFlags(grid, from.x, to.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Conjuration.ts:37 / qualifies | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Conjuration.ts:48 / bladeSpawnLocation | cellTerrainFlags(grid, q.x, q.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/Conjuration.ts:73 / bladeAvoids | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterAbsorption.ts:44 / corpseDistanceMap | cellTerrainFlags(g.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterAbsorption.ts:47 / corpseDistanceMap | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterAbsorption.ts:74 / anyoneWantABite | cellTerrainFlags(g.grid, decedent.x, decedent.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterAbsorption.ts:173 / corpseAllyBeforeMagic | cellTerrainFlags(g.grid, m.x, m.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:37 / flags | cellTerrainFlags(g.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:71 / arcs | cellTerrainMechFlags(g.grid, p.x + dx, p.y + dy) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:84 / monsterBlinkAvoids | cellTerrainMechFlags(g.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:86 / monsterBlinkAvoids | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:86 / monsterBlinkAvoids | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:86 / monsterBlinkAvoids | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:89 / monsterBlinkAvoids | terrainBlocksMovement(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:90 / monsterBlinkAvoids | discoveredTerrainFlagsOfCell(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:106 / monsterBlinkAvoids | burnedTerrainFlagsOfCell(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:144 / monsterBlinkImpact | g.grid.getCell(p.x, p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:211 / buildBlinkSafeTerrainMap | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:213 / buildBlinkSafeTerrainMap | cellTerrainMechFlags(g.grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:214 / buildBlinkSafeTerrainMap | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:221 / buildBlinkAllySafetyMap | genericPathCost(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:298 / openCreaturePath | g.grid.getCell(p.x, p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Combat/MonsterBlink.ts:361 / buildBlinkTargetMap | terrainBlocksMovement(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:361 / buildBlinkTargetMap | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Combat/MonsterBlink.ts:362 / buildBlinkTargetMap | terrainBlocksMovement(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:598 / stableInteractionVisibility | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:1642 / placeAmuletForLevel | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:1912 / levelStair | this.grid.getCell(x, y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:1951 / restoreLevelResident | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:1951 / restoreLevelResident | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:1951 / restoreLevelResident | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2121 / entryQualifiesForPlacement | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2122 / entryQualifiesForPlacement | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2123 / entryQualifiesForPlacement | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2123 / entryQualifiesForPlacement | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2150 / findQualifyingPathLocNear | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2313 / hordeFitsTerrain | cellTerrainFlags(this.grid, pos.x, pos.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2317 / hordeFitsTerrain | this.grid.getCell(pos.x, pos.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2336 / findTerrainSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2338 / findTerrainSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2338 / findTerrainSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2338 / findTerrainSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2459 / findMinionSpawnSpot | this.grid.getCell(pos.x, pos.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2478 / findNearbySpawnSpot | cellTerrainFlags(this.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2479 / findNearbySpawnSpot | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2504 / findSummonAtDistanceLocations | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2623 / findPeriodicSpawnLocation | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2626 / findPeriodicSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2626 / findPeriodicSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2627 / findPeriodicSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2627 / findPeriodicSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2627 / findPeriodicSpawnLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2834 / generateTestDepth | this.grid.setTerrain(x, y, TerrainType.GRANITE, ' ', 0x333333) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2847 / generateTestDepth | this.grid.setTerrain(x, y, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2854 / generateTestDepth | this.grid.setTerrain(entryX - 1, entryY, TerrainType.STAIRS_UP, '&lt;', 0xffaa00) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2856 / generateTestDepth | this.grid.setTerrain(entryX + 1, entryY, TerrainType.STAIRS_DOWN, '&gt;', 0x00aaff) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2860 / generateTestDepth | this.grid.setTerrain(depthSignX, depthSignY, TerrainType.SIGN, '§', 0xffee88) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:2948 / generateTestDepth | feat.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:2964 / generateTestDepth | feat.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3028 / generateTestDepth | this.grid.setTerrain(x, trunkY1, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3029 / generateTestDepth | this.grid.setTerrain(x, trunkY2, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3032 / generateTestDepth | this.grid.setTerrain(mainX, y, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3036 / generateTestDepth | this.grid.setTerrain(x, entryY, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3063 / generateTestDepth | this.grid.setTerrain(x, y, isBorder ? TerrainType.WALL : TerrainType.FLOOR, isBorder ? '#' : '.', isBorder ? 0x555566 : 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3068 / generateTestDepth | this.grid.setTerrain(doorX, row.doorY, TerrainType.DOOR, '+', 0xaa8844) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3071 / generateTestDepth | this.grid.setTerrain(doorX, row.branchY, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3077 / generateTestDepth | this.grid.setTerrain(signX, row.branchY, TerrainType.SIGN, '§', 0xffee88) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3080 / generateTestDepth | this.grid.setTerrain(plateX, row.branchY, TerrainType.RESET_PLATE, '⊙', 0x66ccff) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3091 / generateTestDepth | spawned.terrainSet.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3091 / generateTestDepth | this.grid.setTerrain(cx, cy, spawned.terrainSet.terrain, spawned.terrainSet.char, spawned.terrainSet.color) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3111 / generateTestDepth | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3114 / generateTestDepth | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3115 / generateTestDepth | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3167 / refreshMinersLight | cellTerrainFlags(this.grid, this.player.loc.x, this.player.loc.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3225 / updateVision | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3227 / updateVision | TERRAIN_FLAGS[t] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3292 / updateFieldOfViewDisplay | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3304 / updateFieldOfViewDisplay | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3317 / updateFieldOfViewDisplay | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3318 / updateFieldOfViewDisplay | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3318 / updateFieldOfViewDisplay | cell.rememberedLayers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3320 / updateFieldOfViewDisplay | cell.rememberedTerrainFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3320 / updateFieldOfViewDisplay | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3321 / updateFieldOfViewDisplay | cell.rememberedTMFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3321 / updateFieldOfViewDisplay | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3322 / updateFieldOfViewDisplay | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3322 / updateFieldOfViewDisplay | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3323 / updateFieldOfViewDisplay | cell.rememberedTerrainFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3338 / queueTravelDiscoveries | terrain | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3737 / facts | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:3869 / canActorDodgeStep | cellTerrainFlags(this.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:3870 / canActorDodgeStep | cellTerrainMechFlags(this.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:4310 / validateControlledAction | this.grid.getCell(defender.x, defender.y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:4319 / validateControlledAction | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4321 / validateControlledAction | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4484 / performPlayerActionStages | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4507 / performPlayerActionStages | this.grid.getCell(this.player.x, this.player.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4515 / performPlayerActionStages | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4590 / performPlayerActionStages | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4591 / performPlayerActionStages | cellTerrainFlags(this.grid, this.player.loc.x+x, this.player.loc.y+y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:4617 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4637 / performPlayerActionStages | cellTerrainMechFlags(this.grid, newX, newY) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:4639 / performPlayerActionStages | cellTerrainFlags(this.grid, newX, newY) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:4715 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4716 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4717 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4725 / performPlayerActionStages | keyCell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4726 / performPlayerActionStages | keyCell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4741 / performPlayerActionStages | this.grid.setTerrain(newX, newY, TerrainType.MONSTER_CAGE_OPEN, '&#124;', 0x999999) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:4787 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4825 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4826 / performPlayerActionStages | this.grid.getCell(newX, newY)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4850 / performPlayerActionStages | destination.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4852 / performPlayerActionStages | destination.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4941 / performPlayerActionStages | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:4945 / performPlayerActionStages | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5083 / dropItem | cellTerrainFlags(this.grid, this.player.x, this.player.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:5533 / readItem | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5534 / readItem | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5535 / readItem | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5536 / readItem | composedCellFlags(cell, TERRAIN_FLAGS[dungeon].flags &#124; TERRAIN_FLAGS[liquid].flags) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:5536 / readItem | TERRAIN_FLAGS[dungeon].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:5536 / readItem | TERRAIN_FLAGS[liquid].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:5537 / readItem | cell.rememberedTerrainFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5538 / readItem | cell.rememberedTMFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5538 / readItem | terrainMechFlags(dungeon) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5538 / readItem | terrainMechFlags(liquid) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5540 / readItem | cell.rememberedLayers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:5552 / readItem | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:5981 / tunnelAt | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:6021 / colorFlash | cellTerrainFlags(this.grid, cell.x, cell.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:6253 / boltTerrainSignature | this.grid.getCell(p.x, p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:6636 / fits | cellTerrainFlags(world.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:6637 / fits | cellTerrainMechFlags(world.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:6640 / fits | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:7063 / castMonsterBlink | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:7813 / crystalizeFromPlayer | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:7815 / crystalizeFromPlayer | TERRAIN_FLAGS[dungeonTile].flags | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:7817 / crystalizeFromPlayer | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:7818 / crystalizeFromPlayer | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:7832 / crystalizeFromPlayer | cellTerrainFlags(this.grid, i, j) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:7838 / crystalizeFromPlayer | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:7839 / crystalizeFromPlayer | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:7901 / summonMonstersAroundPlayer | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:7968 / qualifies | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:8147 / throwItemAtStages | cellProjectileBlocked(this.grid.getCell(x,y)!,false) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:8171 / throwItemAtStages | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:8645 / applyWeaponRunicEffect | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:8645 / applyWeaponRunicEffect | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9054 / canStrike | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9113 / buildPlayerMeleeHitList | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9156 / captureControlledAttackTargets | this.grid.getCell(p.x, p.y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9158 / captureControlledAttackTargets | this.grid.getCell(x, y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9179 / preparePlayerWhipAttack | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9179 / preparePlayerWhipAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9224 / preparePlayerSpearAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9231 / preparePlayerSpearAttack | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9231 / preparePlayerSpearAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9555 / processStaggerHit | cellTerrainFlags(this.grid, defender.x, defender.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9895 / playerMoveRiskInputs | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9896 / playerMoveRiskInputs | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9921 / preparePlayerMoveRisk | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:9963 / diveConfirmationNeeded | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:9964 / diveConfirmationNeeded | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:9964 / diveConfirmationNeeded | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:9965 / diveConfirmationNeeded | cellTerrainMechFlags(this.grid, newX, newY) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:9997 / creatureShouldFall | cellTerrainFlags(this.grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10031 / playerFalls | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10033 / playerFalls | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10035 / playerFalls | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10035 / playerFalls | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10065 / playerFalls | landCell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10069 / playerFalls | cellTerrainMechFlags(this.grid, landX, landY) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10311 / landingOk | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10312 / landingOk | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10314 / landingOk | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10320 / landingOk | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10321 / landingOk | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10321 / landingOk | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10329 / strictDry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10329 / strictDry | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10330 / strictDry | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10356 / placePlayerOnFallLanding | this.grid.getCell(loc.x, loc.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10376 / blocked | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10377 / blocked | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10379 / blocked | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10472 / useContactKeyAt | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10606 / sweepDeepWaterItem | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10653 / fallFloorItems | cellTerrainFlags(this.grid, item.x, item.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10682 / restoreFallenItems | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10685 / restoreFallenItems | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:10712 / commuteFloorItems | cellTerrainMechFlags(this.grid, item.x, item.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10718 / commuteFloorItems | cellTerrainMechFlags(this.grid, item.x, item.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10744 / driftFloorItems | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:10754 / driftFloorItems | cellTerrainFlags(this.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:11045 / checkShoreWarning | cellTerrainFlags(this.grid, this.player.x, this.player.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:11709 / loadSnapshot | cell.rememberedLayers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:11709 / loadSnapshot | saved.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:11713 / loadSnapshot | cell.rememberedTerrainFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:11713 / loadSnapshot | saved.rememberedTerrainFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:11714 / loadSnapshot | cell.rememberedTMFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:11714 / loadSnapshot | saved.rememberedTMFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:11783 / cellExtinguishesFire | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:11941 / resolveExplosionDamageAt | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:11995 / applyEntanglementFromTerrain | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12002 / clearDisplacedEntanglement | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12006 / playerStruggle | cellTerrainFlags(this.grid, this.player.x, this.player.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12025 / applyNauseaFromTerrain | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12044 / applyLichenPoison | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12101 / checkEntity | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12105 / checkEntity | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12106 / checkEntity | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12129 / checkEntity | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12130 / checkEntity | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12130 / checkEntity | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12134 / checkEntity | c.cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12134 / checkEntity | c.cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12150 / checkEntity | cellTerrainMechFlags(this.grid, contact.at.x, contact.at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12204 / checkEntity | c.cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12204 / checkEntity | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12204 / checkEntity | TERRAIN_FLAGS[tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12252 / checkEntity | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12254 / checkEntity | TERRAIN_FLAGS[gasTile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:12357 / burnFloorItems | cellTerrainFlags(this.grid, item.x, item.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12634 / tryMoveBodyCore | cellTerrainFlags(this.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12647 / tryMoveBodyCore | cellTerrainFlags(this.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12754 / planSquareStep | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12755 / planSquareStep | cellTerrainFlags(this.grid, actor.x, actor.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12883 / publishSquareMonster | cellTerrainMechFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12920 / canCreateSquareMonster | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12921 / canCreateSquareMonster | cellTerrainMechFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12933 / canCreateNativeCandidate | cellTerrainFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12934 / canCreateNativeCandidate | cellTerrainMechFlags(this.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12978 / bindDungeonFeatureEffects | cellTerrainFlags(this.grid, p.x + at.x - c.x, p.y + at.y - c.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:12999 / bindDungeonFeatureEffects | cellTerrainFlags(this.grid, this.player.x, this.player.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13039 / refreshDungeonFeatureCell | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13042 / refreshDungeonFeatureCell | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13043 / refreshDungeonFeatureCell | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13043 / refreshDungeonFeatureCell | cell.rememberedLayers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13045 / refreshDungeonFeatureCell | cell.rememberedTerrainFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13045 / refreshDungeonFeatureCell | cellTerrainFlags(this.grid, pos.x, pos.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13046 / refreshDungeonFeatureCell | cell.rememberedTMFlags | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13046 / refreshDungeonFeatureCell | cellTerrainMechFlags(this.grid, pos.x, pos.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13047 / refreshDungeonFeatureCell | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13047 / refreshDungeonFeatureCell | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13048 / refreshDungeonFeatureCell | cell.rememberedTerrainFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13349 / updateFlavorText | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13351 / updateFlavorText | TERRAIN_FLAGS[terrain].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13356 / updateFlavorText | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13431 / exploreAllowed | this.grid.getCell(this.player.x, this.player.y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13570 / canMoveTo | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13596 / hasLineOfSight | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13616 / resetTestRoom | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13616 / resetTestRoom | terrain.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13617 / resetTestRoom | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13648 / handleSpecialTileEntry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13653 / handleSpecialTileEntry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13658 / handleSpecialTileEntry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13660 / handleSpecialTileEntry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13715 / searchForSecretsNative | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13715 / searchForSecretsNative | this.grid.getCell(x, y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13736 / searchForSecretsNative | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13736 / searchForSecretsNative | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:13753 / searchForSecretsNative | c.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13760 / searchForSecretsNative | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13972 / canDisplaceCreature | cellTerrainFlags(this.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:13973 / canDisplaceCreature | this.grid.getCell(p.x,p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14038 / teleportWholeBody | cellTerrainFlags(this.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:14127 / makeMonsterDropItem | this.grid.getCell(x, y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14183 / applyDisplacementTileEntry | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:14184 / applyDisplacementTileEntry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14185 / applyDisplacementTileEntry | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14186 / applyDisplacementTileEntry | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:14198 / applyDisplacementTileEntry | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/Game.ts:14313 / describeLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14313 / describeLocation | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14315 / describeLocation | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14443 / travelToStairs | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14443 / travelToStairs | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/Game.ts:14462 / embeddedInTerrain | cellTerrainFlags(this.grid, this.player.x, this.player.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/GenerationCoordinator.ts:124 / observe | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:125 / observe | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:522 / populateLevel | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:562 / populateLevel | c.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/GenerationCoordinator.ts:660 / populateLevel | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:661 / populateLevel | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:676 / populateLevel | cellTerrainFlags(ports.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/GenerationCoordinator.ts:814 / populateLevel | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:815 / populateLevel | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:816 / populateLevel | cellTerrainFlags(ports.grid, pos.x, pos.y) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:911 / populateLevel | c.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:911 / populateLevel | c.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/GenerationCoordinator.ts:911 / populateLevel | c.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/LevelSnapshot.ts:26 / snapshotGrid | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/LevelSnapshot.ts:35 / restoreGrid | saved.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/LevelSnapshot.ts:35 / restoreGrid | saved.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/LevelSnapshot.ts:39 / restoreGrid | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/PhasedAttackProduction.ts:610 / prepareActorDodge | game.grid.getCell(p.x,p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/PhasedAttackProduction.ts:615 / prepareActorDodge | game.grid.getCell(p.x,p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WholeRunSnapshot.ts:532 / isWholeRunSnapshot | c.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WholeRunSnapshot.ts:533 / isWholeRunSnapshot | c.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WholeRunSnapshot.ts:534 / isWholeRunSnapshot | c.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WholeRunSnapshot.ts:534 / isWholeRunSnapshot | c.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WholeRunSnapshot.ts:536 / isWholeRunSnapshot | c.rememberedTerrainFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WholeRunSnapshot.ts:536 / isWholeRunSnapshot | c.rememberedTMFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Core/WorldWorkWorld.ts:132 / stableGround | composedCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Core/WorldWorkWorld.ts:135 / stableGround | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Environment/Gas.ts:182 / addGas | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:183 / addGas | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:193 / clearGasAt | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:194 / clearGasAt | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:202 / hasVolumetricGas | this.grid.getCell(x, y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:223 / syncMirrorAt | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:319 / updateFires | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:337 / updateFires | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:337 / updateFires | pos.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:338 / updateFires | pos.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:377 / obstructsGas | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:388 / updateGases | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:399 / updateGases | n.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:404 / updateGases | cellTerrainFlags(grid, i, j) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:416 / updateGases | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:417 / updateGases | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:420 / updateGases | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:421 / updateGases | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:422 / updateGases | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:425 / updateGases | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:426 / updateGases | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:431 / updateGases | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:431 / updateGases | TERRAIN_FLAGS[cell.layers[DungeonLayer.GAS]!].mechFlags | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:459 / updateGases | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:459 / updateGases | destination.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:460 / updateGases | destination.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Environment/Gas.ts:465 / updateGases | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Environment/Gas.ts:466 / updateGases | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:33 / placeCaptiveManacles | grid.setTerrainLayer(x, y, DungeonLayer.SURFACE, tile) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:210 / installStair | grid.setTerrainLayer(p.x,p.y,DungeonLayer.DUNGEON,type) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:211 / installStair | grid.setTerrainLayer(p.x,p.y,DungeonLayer.LIQUID,TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:212 / installStair | grid.setTerrainLayer(p.x,p.y,DungeonLayer.SURFACE,TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:219 / prepareStairLoc | cellTerrainFlags(grid, p.x+dx, p.y+dy) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:220 / prepareStairLoc | grid.setTerrainLayer(p.x-dy, p.y-dx, DungeonLayer.DUNGEON, TerrainType.TORCH_WALL) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:221 / prepareStairLoc | grid.setTerrainLayer(p.x+dy, p.y+dx, DungeonLayer.DUNGEON, TerrainType.TORCH_WALL) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:228 / prepareStairLoc | grid.getCell(x,y)!.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:229 / prepareStairLoc | grid.setTerrainLayer(x,y,DungeonLayer.DUNGEON,TerrainType.WALL) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:231 / prepareStairLoc | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:304 / redesignInterior | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:307 / redesignInterior | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:352 / redesignInterior | this.grid.setTerrainLayer(x, y, DungeonLayer.SURFACE, TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:353 / redesignInterior | this.grid.setTerrainLayer(x, y, DungeonLayer.GAS, TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:356 / redesignInterior | this.grid.setTerrainLayer(x, y, DungeonLayer.DUNGEON, TerrainType.GRANITE) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:359 / redesignInterior | this.grid.setTerrainLayer(x, y, DungeonLayer.DUNGEON, TerrainType.FLOOR) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:382 / generateTerrain | this.grid.setTerrain(x, y, TerrainType.GRANITE, ' ', 0x333333) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:484 / translateWorkGridToTerrain | this.grid.setTerrain(x, y, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:490 / translateWorkGridToTerrain | this.grid.setTerrain(x, y, TerrainType.DOOR, '+', 0xaa8844) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:492 / translateWorkGridToTerrain | this.grid.setTerrain(x, y, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:510 / planSideChambers | this.grid.getCell(p.x,p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:511 / planSideChambers | this.grid.setTerrain(p.x,p.y,TerrainType.FLOOR,'.',0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:513 / planSideChambers | row.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:513 / planSideChambers | this.grid.setTerrainLayer(row.p.x,row.p.y,layer,tile) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:576 / placeTraps | c.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:598 / placeTraps | this.grid.setTerrain(tile.x, tile.y, TerrainType.TRAP, '^', 0x884400) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:613 / placeTraps | cell?.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:616 / placeTraps | this.grid.getCell(rx - 1, ry)?.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:617 / placeTraps | this.grid.getCell(rx + 1, ry)?.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:618 / placeTraps | this.grid.getCell(rx, ry - 1)?.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:619 / placeTraps | this.grid.getCell(rx, ry + 1)?.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:622 / placeTraps | this.grid.setTerrain(rx, ry, TerrainType.SECRET_DOOR, '#', 0x555555) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:632 / placeTraps | this.grid.setTerrain(tile.x, tile.y, TerrainType.PRESSURE_PLATE, '_', 0x446644) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:930 / designEnvironmentOvelays | terrainAllowsMove(overlay.type) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:951 / designEnvironmentOvelays | this.grid.getCell(cx + Math.floor(blob.width / 2), cy + Math.floor(blob.height / 2))?.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:961 / designEnvironmentOvelays | this.grid.getCell(gx, gy)?.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:962 / designEnvironmentOvelays | this.grid.setTerrain(gx, gy, overlay.type, overlay.char, overlay.color) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Architect.ts:1027 / placeGatedLakeBlob | this.grid.getCell(gx, gy)?.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Architect.ts:1045 / placeGatedLakeBlob | this.grid.setTerrain(p.x, p.y, overlay.type, overlay.char, overlay.color) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:879 / canReceiveAdoptedItem | f.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:879 / canReceiveAdoptedItem | f.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:959 / walkable | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:959 / walkable | terrainAllowsMove(cell.terrain) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1105 / findSuitableRoom | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1169 / floodFillRoom | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1189 / hasAdjacentWall | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1189 / hasAdjacentWall | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1280 / applyBlueprintContents | this.grid.setTerrain(p.x, p.y, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1290 / applyBlueprintContents | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1291 / applyBlueprintContents | this.grid.setTerrainLayer(p.x, p.y, l as DungeonLayer, l === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1302 / applyBlueprintContents | this.grid.setTerrainLayer(p.x, p.y, DungeonLayer.LIQUID, TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1317 / applyBlueprintContents | cellTerrainFlags(this.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1320 / applyBlueprintContents | cellTerrainFlags(this.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1321 / applyBlueprintContents | this.grid.setTerrain(nx, ny, TerrainType.WALL, '#', 0x555566) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1365 / applyBlueprintContents | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1365 / applyBlueprintContents | TERRAIN_FLAGS[cell.layers[layer]!].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1367 / applyBlueprintContents | this.grid.setTerrainLayer( cell.x, cell.y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING ) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1390 / applyBlueprintContents | this.grid.setTerrain(doorPos.x, doorPos.y, terrainType, visual.char, visual.color) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1506 / applyBlueprintContents | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1603 / applyBlueprintContents | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1604 / applyBlueprintContents | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1605 / applyBlueprintContents | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1632 / applyBlueprintContents | this.grid.setTerrainLayer(pos.x, pos.y, homeLayer, terrainType) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1634 / applyBlueprintContents | wcell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1639 / applyBlueprintContents | this.grid.setTerrain(pos.x, pos.y, terrainType, ch, col) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1643 / applyBlueprintContents | feature.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1651 / applyBlueprintContents | feature.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1687 / applyBlueprintContents | feature.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1928 / applyBlueprintContents | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:1958 / applyBlueprintContents | this.grid.getCell(finalCenter.x, finalCenter.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:1961 / applyBlueprintContents | this.grid.getCell(p.x, p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2015 / fillVestibuleInterior | genericPathCost(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2062 / fillAreaInterior | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2064 / fillAreaInterior | cellTerrainMechFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2067 / fillAreaInterior | discoveredTerrainFlagsOfCell(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2141 / cellIsBlocker | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2168 / expandMachineInterior | cellTerrainFlags(this.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2181 / expandMachineInterior | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2182 / expandMachineInterior | this.grid.setTerrainLayer(x, y, l as DungeonLayer, l === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2189 / expandMachineInterior | this.grid.getCell(nx, ny)!.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2190 / expandMachineInterior | this.grid.setTerrainLayer(nx, ny, DungeonLayer.DUNGEON, TerrainType.WALL) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2200 / expandMachineInterior | this.grid.getCell(x, y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2202 / expandMachineInterior | this.grid.setTerrainLayer(x, y, DungeonLayer.DUNGEON, TerrainType.FLOOR) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2222 / backupLevel | c.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2225 / backupLevel | c.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2226 / backupLevel | c.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2244 / restoreLevel | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2244 / restoreLevel | s.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/BlueprintEngine.ts:2245 / restoreLevel | c.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2439 / cellIsFeatureCandidate | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2449 / cellIsFeatureCandidate | cellTerrainFlags(this.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2458 / cellIsFeatureCandidate | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/BlueprintEngine.ts:2467 / cellIsFeatureCandidate | cellTerrainFlags(this.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:27 / stairs | g.getCell(x,y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/GenerationPlacement.ts:45 / minionPlacement | TERRAIN_FLAGS[spawnsIn].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/GenerationPlacement.ts:49 / valid | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:51 / minionPlacement | cellTerrainFlags(grid,origin.x,origin.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:54 / minionPlacement | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:67 / minionPlacement | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:74 / generationDistances | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:78 / generationDistances | terrainMechFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/GenerationPlacement.ts:79 / generationDistances | discoveredTerrainFlagsOfCell(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/MachineView.ts:31 / blocked | terrainFlagsOfCell(grid.getCell(p.x, p.y)!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/SideChamber.ts:22 / rock | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:22 / rock | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:23 / rock | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:32 / floor | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:33 / floor | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:99 / clean | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:100 / clean | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:161 / clean | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:161 / clean | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:207 / clean | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/SideChamber.ts:207 / clean | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Stairs.ts:15 / stairFallbackQualifies | cellTerrainFlags(grid,x,y) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Stairs.ts:16 / stairFallbackQualifies | c.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Generator/Stairs.ts:20 / validStairLoc | c?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Generator/Stairs.ts:25 / validStairLoc | cellTerrainFlags(grid,x+dx,y+dy) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Stairs.ts:28 / validStairLoc | cellTerrainFlags(grid,x-dx+dy,y-dy+dx) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Generator/Stairs.ts:29 / validStairLoc | cellTerrainFlags(grid,x-dx-dy,y-dy-dx) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Items/ItemSpawnHeatMap.ts:74 / cellTerrainFlagUnion | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:76 / cellTerrainFlagUnion | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:78 / cellTerrainFlagUnion | composedCellFlags(cell,flags) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Items/ItemSpawnHeatMap.ts:84 / cellMechFlagUnion | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:86 / cellMechFlagUnion | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:96 / isPassableOrSecretDoor | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Items/ItemSpawnHeatMap.ts:147 / fillItemSpawnHeatMap | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:149 / fillItemSpawnHeatMap | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:224 / passable | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:224 / passable | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:224 / passable | structureBlocking(cell) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:224 / passable | terrainAllowsMove(cell.terrain) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:325 / build | grid.setTerrain(x, y, TerrainType.WALL, '#', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Items/ItemSpawnHeatMap.ts:410 / randomMatchingLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Items/ItemSpawnHeatMap.ts:411 / randomMatchingLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Lighting/FOV.ts:152 / castLight | this.grid.getCell(mapX, mapY)?.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Lighting/FOV.ts:158 / castLight | this.grid.getCell(mapX, mapY)?.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Lighting/LightMap.ts:302 / blockedAt | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Lighting/LightMap.ts:481 / castLightRay | this.grid.getCell(mapX, mapY)?.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Lighting/LightMap.ts:487 / castLightRay | this.grid.getCell(mapX, mapY)?.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/AutoGenerator.ts:570 / randomMatchingLocation | TERRAIN_FLAGS[requiredDungeonFoundationType].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:580 / randomMatchingLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:581 / randomMatchingLocation | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:585 / randomMatchingLocation | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/AutoGenerator.ts:710 / runAutogenerators | gen.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:712 / runAutogenerators | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:713 / runAutogenerators | gen.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:714 / runAutogenerators | gen.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:714 / runAutogenerators | TERRAIN_FLAGS[gen.terrain].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:717 / runAutogenerators | gen.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/AutoGenerator.ts:717 / runAutogenerators | grid.setTerrainLayer(loc.x, loc.y, gen.layer, gen.terrain) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CaptiveManacles.ts:22 / captiveManaclePlacements | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CaptiveManacles.ts:23 / captiveManaclePlacements | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:44 / baseCellFlags | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:44 / baseCellFlags | TERRAIN_FLAGS[cell.layers[l]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:44 / baseCellFlags | TERRAIN_FLAGS[cell.layers[l]!]!.flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:49 / baseCellMechFlags | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:49 / baseCellMechFlags | TERRAIN_FLAGS[cell.layers[l]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:49 / baseCellMechFlags | TERRAIN_FLAGS[cell.layers[l]!]!.mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:55 / composedCellFlags | baseCellFlags(cell) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:63 / knownCellFlags | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:63 / knownCellFlags | cell.rememberedLayers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:64 / knownCellFlags | TERRAIN_FLAGS[tile].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:66 / knownCellFlags | composedCellFlags(cell, base) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:68 / knownCellFlags | cell.rememberedTerrainFlags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:73 / isStableBaseFloor | baseCellFlags(cell) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:78 / readCellProperties | baseCellFlags(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:79 / readCellProperties | baseCellMechFlags(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:80 / readCellProperties | composedCellFlags(cell, base) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:82 / readCellProperties | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:106 / cellProjectileBlocked | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:108 / cellProjectileBlocked | baseCellFlags(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:113 / cellProjectileFlags | baseCellFlags(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:114 / cellProjectileFlags | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:118 / cellProjectileFlags | composedCellFlags(cell, base) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:122 / cellLiquidBlocked | baseCellFlags(cell) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:123 / cellLiquidBlocked | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:129 / structureCellChanged | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:131 / structureCellChanged | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/CellProperties.ts:149 / watchStructureTerrain | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:169 / clearStructureBindings | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:180 / unbindStructureCell | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/CellProperties.ts:242 / bindStructureCell | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Connectivity.ts:49 / isDry | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Connectivity.ts:81 / lakeDisruptsPassability | cellTerrainFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Connectivity.ts:82 / lakeDisruptsPassability | cellTerrainMechFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:155 / evacuateCreatures | cellTerrainFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:183 / refreshFeatureCell | TERRAIN_FLAGS[tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:192 / refreshDungeonCellTerrain | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:238 / cellTerrainFlags | terrainFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:245 / terrainFlagsOfCell | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:245 / terrainFlagsOfCell | TERRAIN_FLAGS[cell.layers[0]!].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:246 / terrainFlagsOfCell | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:246 / terrainFlagsOfCell | TERRAIN_FLAGS[cell.layers[1]!].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:247 / terrainFlagsOfCell | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:247 / terrainFlagsOfCell | TERRAIN_FLAGS[cell.layers[2]!].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:248 / terrainFlagsOfCell | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:248 / terrainFlagsOfCell | TERRAIN_FLAGS[cell.layers[3]!].flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:250 / terrainFlagsOfCell | composedCellFlags(cell, f) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:265 / cellTerrainMechFlags | terrainMechFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:271 / terrainMechFlagsOfCell | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:271 / terrainMechFlagsOfCell | TERRAIN_FLAGS[cell.layers[l]!].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:281 / burnedTerrainFlagsOfCell | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:282 / burnedTerrainFlagsOfCell | TERRAIN_FLAGS[terrain] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:288 / burnedTerrainFlagsOfCell | TERRAIN_FLAGS[successor.tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:310 / discoveredTerrainFlagsOfCell | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:311 / discoveredTerrainFlagsOfCell | TERRAIN_FLAGS[terrain] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:317 / discoveredTerrainFlagsOfCell | TERRAIN_FLAGS[successor.tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:329 / cellHasTerrainType | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:336 / cellHasTerrainFlag | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:343 / cellIsPassableOrDoor | cellHasTerrainFlag(grid, x, y, T_PATHING_BLOCKER) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:349 / cellIsPassableOrDoor | cellHasTerrainFlag(grid, x, y, T_OBSTRUCTS_PASSABILITY) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:354 / cellHasTerrainMechFlagMask | cellTerrainMechFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:393 / spawnMapDF | cellHasTerrainType(grid, x2, y2, propagationTerrain) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:394 / spawnMapDF | cellLiquidBlocked(grid.getCell(x2,y2)!,false) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:395 / spawnMapDF | structureBlocking(grid.getCell(x2,y2)!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:396 / spawnMapDF | cellHasTerrainFlag(grid, x2, y2, T_OBSTRUCTS_SURFACE_EFFECTS) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:398 / spawnMapDF | cellHasTerrainType(grid, x2, y2, propagationTerrain) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:423 / spawnMapDF | cellHasTerrainType(grid, x, y, propagationTerrain) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:463 / fillSpawnMap | TERRAIN_FLAGS[surfaceTileType].flags | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:472 / fillSpawnMap | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:473 / fillSpawnMap | TERRAIN_FLAGS[oldTile].flags | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:483 / fillSpawnMap | cellHasTerrainFlag(grid, i, j, T_OBSTRUCTS_SURFACE_EFFECTS) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:486 / fillSpawnMap | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:495 / fillSpawnMap | grid.setTerrainLayer(i, j, layer, surfaceTileType) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:672 / movementPassable | c.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:672 / movementPassable | c.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:672 / movementPassable | structureBlocking(c) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:672 / movementPassable | terrainAllowsMove(c.terrain) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:775 / terrainMechFlags | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:783 / discoverSecretsAt | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:783 / discoverSecretsAt | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:787 / discoverSecretsAt | grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:974 / executeDungeonFeature | TERRAIN_FLAGS[feat.tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:989 / executeDungeonFeature | grid.setTerrainLayer(x, y, DungeonLayer.GAS, feat.tile) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:1075 / executeDungeonFeature | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:1079 / executeDungeonFeature | grid.setTerrainLayer( i, j, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING ) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/DungeonFeature.ts:1098 / executeDungeonFeature | TERRAIN_FLAGS[feat.tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/DungeonFeature.ts:1104 / executeDungeonFeature | TERRAIN_FLAGS[feat.tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/FootprintPathing.ts:170 / allows | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/FootprintPathing.ts:170 / allows | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/FootprintPathing.ts:170 / allows | composedCellFlags(cell,cell.layers.reduce((f, tile) =&gt; f &#124; (tile === TerrainType.SECRET_DOOR ? 0 : TERRAIN_FLAGS[tile].flags), 0)) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/FootprintPathing.ts:170 / allows | TERRAIN_FLAGS[tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/FootprintPathing.ts:172 / allows | cellTerrainMechFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/FootprintPathing.ts:184 / buildTerrain | cellTerrainFlags(grid, at.x + p.x, at.y + p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/FootprintPathing.ts:215 / goals | cellTerrainFlags(grid, from.x + tx, from.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/FootprintPathing.ts:215 / goals | cellTerrainFlags(grid, from.x, from.y + ty) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:777 / writeTerrainHome | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Grid.ts:779 / writeTerrainHome | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:829 / terrain | this.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Grid.ts:829 / terrain | this.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Grid.ts:866 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[0]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:866 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[0]!]!.flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:866 / refreshTerrainProperties | this.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:867 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[1]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:867 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[1]!]!.flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:867 / refreshTerrainProperties | this.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:868 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[2]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:868 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[2]!]!.flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:868 / refreshTerrainProperties | this.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:869 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[3]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:869 / refreshTerrainProperties | TERRAIN_FLAGS[this.layers[3]!]!.flags | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:869 / refreshTerrainProperties | this.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:871 / refreshTerrainProperties | composedCellFlags(this, flags) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:872 / refreshTerrainProperties | this.isPassable | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:873 / refreshTerrainProperties | this.isOpaque | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:898 / isBurning | this.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Grid.ts:1005 / highestPriorityLayer | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Grid.ts:1012 / setTerrainLayer | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Grid.ts:1013 / setTerrainLayer | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Grid.ts:1024 / setTerrain | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/LakeSystem.ts:188 / stampTerrain | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:189 / stampTerrain | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/LakeSystem.ts:245 / createWreath | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:246 / createWreath | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:247 / createWreath | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:300 / cleanUpLakeBoundaries | subject.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:304 / cleanUpLakeBoundaries | subject.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:313 / cleanUpLakeBoundaries | left.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:314 / cleanUpLakeBoundaries | right.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:316 / cleanUpLakeBoundaries | left.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:316 / cleanUpLakeBoundaries | right.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:324 / cleanUpLakeBoundaries | up.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:325 / cleanUpLakeBoundaries | down.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:327 / cleanUpLakeBoundaries | down.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:327 / cleanUpLakeBoundaries | up.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:339 / cleanUpLakeBoundaries | subject.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:339 / cleanUpLakeBoundaries | targetCell.terrain | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:339 / cleanUpLakeBoundaries | terrainAllowsMove(subject.terrain) | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:339 / cleanUpLakeBoundaries | terrainAllowsMove(targetCell.terrain) | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:343 / cleanUpLakeBoundaries | subject.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:343 / cleanUpLakeBoundaries | targetCell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:344 / cleanUpLakeBoundaries | subject.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/LakeSystem.ts:374 / blocked | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:375 / blocked | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:431 / isBridgableOrWall | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:435 / isLand | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:440 / isSecretAt | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:444 / isWallAt | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LakeSystem.ts:448 / isChasmAt | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | test:drift；地形目录枚举 |
| src/engine/Map/LoopMap.ts:83 / extractWorkGrid | grid.getCell(x, y)?.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Map/LoopMap.ts:192 / applyLoopDoorSites | grid.setTerrain(s.x, s.y, TerrainType.DOOR, '+', 0xaa8844) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/LoopMap.ts:194 / applyLoopDoorSites | grid.setTerrain(s.x, s.y, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/LoopMap.ts:211 / blocksPathing | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/LoopMap.ts:212 / blocksPathing | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Map/LoopMap.ts:501 / analyzeChokeMap | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Map/LoopMap.ts:501 / analyzeChokeMap | structureBlocking(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/LoopMap.ts:501 / analyzeChokeMap | terrainAllowsMove(cell.terrain) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Map/MapToShore.ts:15 / buildMapToShore | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/MapToShore.ts:18 / buildMapToShore | cellTerrainMechFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Pathfinding.ts:85 / calculateMap | genericPathCost(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:216 / discoverTerrain | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:216 / discoverTerrain | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:220 / discoverTerrain | grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:252 / circuitBreakersPreventActivation | cellTerrainMechFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:314 / activateMachine | cellTerrainMechFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:319 / activateMachine | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:319 / activateMachine | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:319 / activateMachine | TERRAIN_FLAGS[cell.layers[layer]!]!.mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:400 / promoteTile | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:401 / promoteTile | TERRAIN_FLAGS[sourceTerrain] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:444 / promoteTile | grid.setTerrainLayer( x, y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING ) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:529 / promoteLayersWithMechFlag | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:529 / promoteLayersWithMechFlag | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:529 / promoteLayersWithMechFlag | TERRAIN_FLAGS[cell.layers[layer]!]!.mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:539 / promoteOnPlayerBump | cell?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:539 / promoteOnPlayerBump | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:540 / promoteOnPlayerBump | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:540 / promoteOnPlayerBump | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:540 / promoteOnPlayerBump | TERRAIN_FLAGS[cell.layers[layer]!]!.flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:628 / runPromotionUpdate | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:628 / runPromotionUpdate | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:638 / runPromotionUpdate | cellTerrainFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:639 / runPromotionUpdate | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:639 / runPromotionUpdate | grid.getCell(nx, ny)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:693 / runPromotionUpdate | cellTerrainMechFlags(grid, i, j) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:697 / runPromotionUpdate | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:697 / runPromotionUpdate | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:697 / runPromotionUpdate | TERRAIN_FLAGS[cell.layers[layer]!]!.mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:786 / exposeTileToFire | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:795 / exposeTileToFire | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:795 / exposeTileToFire | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:797 / exposeTileToFire | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:798 / exposeTileToFire | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:805 / exposeTileToFire | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:806 / exposeTileToFire | TERRAIN_FLAGS[terrain] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:815 / exposeTileToFire | TERRAIN_FLAGS[TerrainType.WOODEN_BARRICADE].chanceToIgnite | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:825 / exposeTileToFire | cellTerrainMechFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:830 / exposeTileToFire | cellTerrainFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:831 / exposeTileToFire | cellTerrainMechFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:848 / exposeTileToFire | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:848 / exposeTileToFire | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:848 / exposeTileToFire | TERRAIN_FLAGS[cell.layers[layer]!]!.flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:860 / exposeTileToFire | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:919 / runFireUpdate | cellTerrainFlags(grid, i, j) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:953 / triggerCreatureTrapLayers | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:953 / triggerCreatureTrapLayers | TERRAIN_FLAGS[cell.layers[layer]!] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:967 / consumeTrapTile | grid.setTerrainLayer(x, y, DungeonLayer.DUNGEON, residue) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1010 / tunnelize | grid.setTerrainLayer(x, y, DungeonLayer.DUNGEON, TerrainType.CRYSTAL_WALL) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1014 / tunnelize | cell.layers | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:1014 / tunnelize | TERRAIN_FLAGS[cell.layers[layer]!].flags | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:1015 / tunnelize | grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1025 / tunnelize | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1026 / tunnelize | cell.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1033 / tunnelize | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1034 / tunnelize | cellTerrainFlags(grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1035 / tunnelize | cellTerrainFlags(grid, nx, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1035 / tunnelize | cellTerrainFlags(grid, x, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/Promotion.ts:1051 / breakEntanglingTerrain | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:1051 / breakEntanglingTerrain | TERRAIN_FLAGS[cell.layers[DungeonLayer.SURFACE]!].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_properties/integration/transactions；c_4b/c_4c/f_*/g_*/x2b |
| src/engine/Map/Promotion.ts:1052 / breakEntanglingTerrain | grid.setTerrainLayer(x, y, DungeonLayer.SURFACE, TerrainType.NOTHING) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/RigidPosePathing.ts:131 / allows | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/RigidPosePathing.ts:131 / allows | cellTerrainFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/RigidPosePathing.ts:131 / allows | composedCellFlags(cell,cell.layers.reduce((f, t) =&gt; f &#124; (t === TerrainType.SECRET_DOOR ? 0 : TERRAIN_FLAGS[t].flags), 0)) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/RigidPosePathing.ts:131 / allows | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/RigidPosePathing.ts:132 / allows | cellTerrainMechFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/RigidPosePathing.ts:149 / buildTerrain | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/RigidPosePathing.ts:242 / goals | cellTerrainFlags(graph.grid, x, y+ty) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/RigidPosePathing.ts:242 / goals | cellTerrainFlags(graph.grid, x+tx, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/SafetyMap.ts:138 / buildSafetyMap | grid.getCell(i, j)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/SafetyMap.ts:275 / safetyNextStep | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureValidation.ts:50 / validateStructureReferences | isStableBaseFloor(grid.getCell(row.at.x, row.at.y)!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:174 / cellProperties | readCellProperties(cell!, spatialTerrainRevision(grid)) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:211 / computeRooms | baseCellFlags(c) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:393 / bindWorldStructures | hasStructureCellBinding(grid.getCell(row.at.x, row.at.y)!, row) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:429 / bindWorldStructures | baseCellFlags(cell) | 写入口 | 原生基础层保留写入语义，刷新边界经 structureCellChanged 提交地基失效；结构不写基础层。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/StructureWorld.ts:430 / bindWorldStructures | baseCellFlags({ layers: before } as any) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:465 / settleStructureFoundations | baseCellFlags(grid.getCell(r.at.x, r.at.y)!) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:467 / settleStructureFoundations | baseCellFlags(grid.getCell(r.at.x, r.at.y)!) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:538 / settleStructureFoundations | baseCellFlags({ layers: [c.layers[layer]!, 0, 0, 0] } as any) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:538 / settleStructureFoundations | c.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:539 / settleStructureFoundations | c.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:540 / settleStructureFoundations | c.refreshTerrainProperties() | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:595 / escapes | c.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/StructureWorld.ts:608 / escapes | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:608 / escapes | isOpenableStructureDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:609 / escapes | isOpenableStructureDoor(cell!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:637 / protectedCell | isStableBaseFloor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:643 / protectedCell | cell.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:840 / validate | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/StructureWorld.ts:1191 / remainsPosition | grid.getCell(x, y)!.layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:1219 / remainsPosition | c.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:1219 / remainsPosition | isOpenableStructureDoor(c) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:1220 / remainsPosition | baseCellFlags(c) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:1446 / destroyComponent | isStableBaseFloor(grid.getCell(x, y)!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:1448 / destroyComponent | composedCellFlags(grid.getCell(x, y)!) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/StructureWorld.ts:1456 / destroyComponent | grid .getCell(x, y)! .layers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainCatalog.ts:1298 / blocksPassability | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1303 / isPathingBlocker | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1308 / blocksVision | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1313 / obstructsItems | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1318 / obstructsDiagonalMovement | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1323 / isDeepWater | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1334 / isAutoDescent | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1339 / isFlammable | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainCatalog.ts:1349 / isFireTerrain | TERRAIN_FLAGS[t].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainHealing.ts:17 / terrainHealingAmount | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainHealing.ts:17 / terrainHealingAmount | TERRAIN_FLAGS[tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/TerrainRules.ts:15 / terrainBlocksMovement | terrainFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:20 / terrainBlocksVision | terrainFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:24 / terrainBlocksScent | terrainFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:29 / terrainPassableOrSecretDoor | terrainBlocksMovement(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:30 / terrainPassableOrSecretDoor | terrainMechFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:31 / terrainPassableOrSecretDoor | discoveredTerrainFlagsOfCell(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Map/TerrainRules.ts:37 / genericPathCost | terrainFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:38 / genericPathCost | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:46 / isUnseenPassableSecretDoor | terrainBlocksMovement(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:46 / isUnseenPassableSecretDoor | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:60 / safetyTerrainCosts | terrainFlagsOfCell(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/TerrainRules.ts:61 / safetyTerrainCosts | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WallDoorFinish.ts:136 / removeDiagonalOpenings | passA.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:137 / removeDiagonalOpenings | blockB.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:137 / removeDiagonalOpenings | blockB.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:138 / removeDiagonalOpenings | blockC.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:138 / removeDiagonalOpenings | blockC.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:139 / removeDiagonalOpenings | passD.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:154 / removeDiagonalOpenings | grid.setTerrain(tx, ty, source.terrain, source.char, source.color) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WallDoorFinish.ts:154 / removeDiagonalOpenings | source.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:198 / finishDoors | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:200 / finishDoors | grid.getCell(i - 1, j)!.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:201 / finishDoors | grid.getCell(i + 1, j)!.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:202 / finishDoors | grid.getCell(i, j - 1)!.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:203 / finishDoors | grid.getCell(i, j + 1)!.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:205 / finishDoors | grid.setTerrain(i, j, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WallDoorFinish.ts:211 / finishDoors | grid.getCell(i + dx!, j + dy!)!.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:214 / finishDoors | grid.setTerrain(i, j, TerrainType.FLOOR, '.', 0x888888) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WallDoorFinish.ts:219 / finishDoors | grid.setTerrain(i, j, TerrainType.SECRET_DOOR, '#', 0x555555) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WallDoorFinish.ts:251 / exposes | c.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:251 / exposes | c.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:256 / finishWalls | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:262 / finishWalls | grid.setTerrainLayer(i, j, DungeonLayer.DUNGEON, TerrainType.WALL) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WallDoorFinish.ts:268 / finishWalls | cell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WallDoorFinish.ts:274 / finishWalls | grid.setTerrainLayer(i, j, DungeonLayer.DUNGEON, TerrainType.GRANITE) | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WaypointMap.ts:221 / refreshWaypoint | genericPathCost(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WaypointMap.ts:316 / nextStep | terrainPassableOrSecretDoor(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Map/WaypointMap.ts:337 / isBlockedFor | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Map/WaypointMap.ts:337 / isBlockedFor | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/engine/Movement/AutoTravelVisibility.ts:22 / firstSeenFeatures | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/AutoTravelVisibility.ts:23 / firstSeenFeatures | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/BodyConstraints.ts:29 / blocked | composedCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/BodyTrajectory.ts:72 / trajectoryConstraintSatisfied | composedCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:36 / canPlaceCreature | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:36 / canPlaceCreature | composedCellFlags(cell,cell.layers.reduce((f, tile) =&gt; f &#124; (tile === TerrainType.SECRET_DOOR ? 0 : TERRAIN_FLAGS[tile].flags), 0)) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:36 / canPlaceCreature | TERRAIN_FLAGS[tile].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:38 / canPlaceCreature | cellTerrainFlags(world.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:39 / canPlaceCreature | world.grid.getCell(p.x, p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:74 / teleportCandidates | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:75 / teleportCandidates | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:78 / teleportCandidates | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:78 / teleportCandidates | tile.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:98 / teleportCandidates | composedCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:105 / teleportCandidates | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:105 / teleportCandidates | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:105 / teleportCandidates | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:106 / teleportCandidates | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:108 / teleportCandidates | cellTerrainMechFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:112 / teleportCandidates | tile.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:113 / teleportCandidates | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:114 / teleportCandidates | cellTerrainMechFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:128 / flags | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreaturePlacement.ts:133 / qualifies | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:133 / qualifies | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:133 / qualifies | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:148 / allySwapCandidates | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/CreaturePlacement.ts:158 / flags | cellTerrainFlags(grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/CreatureSpatial.ts:210 / flagsAt | composedCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Entrancement.ts:19 / entrancementDiagonalBlocked | cellTerrainFlags(grid, from.x, to.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Entrancement.ts:19 / entrancementDiagonalBlocked | cellTerrainFlags(grid, to.x, from.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Entrancement.ts:24 / entrancementPassable | cellTerrainFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Entrancement.ts:25 / entrancementPassable | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/FootprintExposure.ts:25 / footprintExposure | cellTerrainFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/FootprintExposure.ts:25 / footprintExposure | cellTerrainMechFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/FootprintExposure.ts:29 / footprintExposure | c.cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/FootprintExposure.ts:29 / footprintExposure | TERRAIN_FLAGS[c.cell.layers[DungeonLayer.GAS]!].flags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:32 / travelDistanceMap | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:37 / travelDistanceMap | grid.getCell(x,y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:60 / scheduleLevelFollowers | cellTerrainFlags(grid,exit.x,exit.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:62 / scheduleLevelFollowers | cellTerrainFlags(grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:74 / scheduleLevelFollowers | cellTerrainFlags(grid,m.x,m.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:87 / scheduleLevelFollowers | cellTerrainFlags(grid,origin.x,origin.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:124 / travelPlacement | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:130 / qualifies | cellTerrainFlags(grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:131 / qualifies | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:131 / qualifies | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:131 / qualifies | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:163 / restoreTravelPosition | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:163 / restoreTravelPosition | grid.getCell(x,y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/LevelTravel.ts:164 / restoreTravelPosition | cellTerrainFlags(grid,m.x,m.y+dy) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:164 / restoreTravelPosition | cellTerrainFlags(grid,m.x+dx,m.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:186 / restoreSquareTravelPosition | cellTerrainFlags(world.grid,p.x,p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/LevelTravel.ts:186 / restoreSquareTravelPosition | world.grid.getCell(p.x,p.y)!.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/PlayerTravel.ts:22 / playerTravelDiagonalBlocked | knownCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/PlayerTravel.ts:23 / playerTravelDiagonalBlocked | composedCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/PlayerTravel.ts:30 / playerTravelTerrainAllowed | knownCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/PlayerTravel.ts:30 / playerTravelTerrainAllowed | knownCellFlags(here) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/PlayerTravel.ts:34 / playerTravelTerrainAllowed | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/PlayerTravel.ts:34 / playerTravelTerrainAllowed | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/PlayerTravel.ts:35 / playerTravelTerrainAllowed | terrainMechFlags(tile) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/SpatialRevision.ts:19 / spatialTerrainRevision | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/SpatialRevision.ts:42 / notifySpatialCellRefresh | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/SpatialRevision.ts:43 / notifySpatialCellRefresh | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/engine/Movement/SquarePlacement.ts:20 / cellsFit | cellTerrainFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/SquarePlacement.ts:22 / cellsFit | cellTerrainMechFlags(grid, at.x, at.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Submersion.ts:21 / partCanSubmergeNow | cellTerrainMechFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Submersion.ts:22 / partCanSubmergeNow | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Submersion.ts:25 / partCanSubmergeNow | cellTerrainFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Submersion.ts:31 / hiddenBySubmersion | cellTerrainFlags(grid, observer.x, observer.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/Movement/Submersion.ts:38 / surfaceOnDryLand | cellTerrainMechFlags(grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/UI/Appearance.ts:243 / layeredTerrainAppearance | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/Appearance.ts:269 / memoryTerrainAppearance | cell.rememberedLayers | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/UI/Appearance.ts:270 / memoryTerrainAppearance | structureAppearance(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/UI/Appearance.ts:309 / cellAppearance | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/Appearance.ts:312 / cellAppearance | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/Appearance.ts:312 / cellAppearance | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/Appearance.ts:314 / cellAppearance | structureAppearance(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/engine/UI/Appearance.ts:320 / cellAppearance | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/Appearance.ts:329 / cellAppearance | cell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/Appearance.ts:407 / cellAppearance | cell.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/DancingColors.ts:49 / tickTerrainColors | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/MonsterSidebar.ts:33 / monsterBehaviorLabel | grid.getCell(monster.x, monster.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/MonsterSidebar.ts:33 / monsterBehaviorLabel | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/MonsterSidebar.ts:114 / sidebarEntityRows | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/MonsterSidebar.ts:114 / sidebarEntityRows | TERRAIN_FLAGS[t].mechFlags | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/MonsterVisibility.ts:25 / hasGasAt | grid.getCell(at.x, at.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/MonsterVisibility.ts:41 / monsterInGas | grid.getCell(p.x, p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/TerrainTextCatalog.ts:17 / &lt;module&gt; | zhContent.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/TerrainTextCatalog.ts:275 / getTerrainTextById | locale.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/TerrainTextCatalog.ts:276 / getTerrainTextById | locale.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/TerrainTextCatalog.ts:317 / selectKnownTerrain | snapshot.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/TerrainTextCatalog.ts:318 / selectKnownTerrain | snapshot.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/engine/UI/TerrainTextCatalog.ts:318 / selectKnownTerrain | snapshot.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration；c_7/x2m/u21c/u_23/r_1 |
| src/entities/Monster.ts:103 / aquaticThreat | cellTerrainFlags(game.grid, victim.x, victim.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:121 / eligibleForCombatBuff | casterCell.layers | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/entities/Monster.ts:124 / eligibleForCombatBuff | game.grid.getCell(enemy.x, enemy.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/entities/Monster.ts:169 / generallyValidBoltTarget | targetCell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/entities/Monster.ts:180 / monsterBoltContact | game.grid.getCell(p.x, p.y)?.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/entities/Monster.ts:213 / specificallyValidBoltTarget | burnedTerrainFlagsOfCell(cell) | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/entities/Monster.ts:243 / specificallyValidBoltTarget | cellTerrainFlags(game.grid, target.x, target.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1314 / moveEntrancedWithinAction | cellTerrainMechFlags(game.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1321 / moveEntrancedWithinAction | cellTerrainMechFlags(game.grid, to.x, to.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1378 / performWhipAttack | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1378 / performWhipAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1419 / performSpearAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1427 / performSpearAttack | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1427 / performSpearAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:1476 / performSweepAttack | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2062 / takeNativeDecisionWithinAction | cellTerrainMechFlags(game.grid, game.player.x, game.player.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2450 / applyPlannedBodyStep | cellTerrainFlags(game.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2512 / canEnterWaterTerrain | cellTerrainMechFlags(game.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2513 / canEnterWaterTerrain | cellTerrainFlags(game.grid, x, y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2515 / canEnterWaterTerrain | cellTerrainFlags(game.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2516 / canEnterWaterTerrain | cellTerrainFlags(game.grid, this.x, this.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2542 / tryMoveTo | cellTerrainFlags(game.grid, p.x, p.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2555 / tryMoveTo | cellTerrainFlags(game.grid, this.x, this.y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2585 / tryMoveTo | terrainPassableOrSecretDoor(destination) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2586 / tryMoveTo | destination.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2589 / tryMoveTo | cellTerrainFlags(game.grid, nx, ny) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/entities/Monster.ts:2598 / tryMoveTo | nextCell.terrain | 写入口 | 保留原生基础层写法；setter/refresh只记录脏格，环境步末按层结算；显式结构写口按受控事务发布。 | ext_structure_integration/protection；giants；phase4*；UR2/3/4 |
| src/ext/modules/combat/ui/diagnostics.ts:44 / placeCombatTelegraphFixture | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/modules/growth/view.ts:325 / knownGrowthMoveCandidate | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/modules/growth/view.ts:325 / knownGrowthMoveCandidate | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/modules/growth/view.ts:328 / knownGrowthMoveCandidate | knownCellFlags(cell) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/modules/growth/view.ts:329 / knownGrowthMoveCandidate | terrainMechFlags(layer) | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:12 / interactablePlacementCells | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/worldSpatial.ts:12 / interactablePlacementCells | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/worldSpatial.ts:17 / interactablePlacementCells | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:17 / interactablePlacementCells | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:20 / interactablePlacementCells | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/worldSpatial.ts:21 / interactablePlacementCells | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ext/worldSpatial.ts:22 / interactablePlacementCells | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:30 / blocked | cell.isOpaque | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:30 / blocked | cell.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:31 / corner | cellTerrainFlags(grid,x,y) | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ext/worldSpatial.ts:32 / hasInteractionLine | grid.getCell(end.x,end.y)?.isPassable | 机械阻挡读者 | 合成 flags/helper 或由 Cell.refreshTerrainProperties 合成的缓存。 | ext_structure_properties/integration；相关原生门禁、drift |
| src/ui/mapTileSemantics.ts:22 / glyphSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:22 / glyphSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:22 / glyphSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:23 / glyphSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:23 / glyphSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:25 / glyphSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:37 / terrainSemantic | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:37 / terrainSemantic | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:43 / terrainSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:49 / terrainSemantic | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:50 / terrainSemantic | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:51 / terrainSemantic | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:51 / terrainSemantic | cell.rememberedLayers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:67 / terrainSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/mapTileSemantics.ts:69 / terrainSemantic | mapText.terrain | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/nearbyInspection.ts:39 / nearbyDetail | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/squareBodyDiagnostics.ts:30 / placeSquareBodyFixtures | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/worldInteractableMap.ts:31 / readInteractableMapMarkers | cell.layers | 基础类型读者 | 基础类型/目录/记忆/基础层作用目标；不把类型等同于通行权限。 | ext_structure_geometry；world_work/world5/harness；U03 |
| src/ui/worldInteractableMap.ts:32 / readInteractableMapMarkers | TERRAIN_FLAGS[terrain] | 基础类型读者 | 保留基础类型/目录/玩家记忆/作用层目标；阻挡另经合成入口。 | ext_structure_properties/integration；相关原生门禁、drift |

## 附录 B：门禁文件清单

### B.1 首轮相关158文件

- `src/ext/modules/combat/tests/combat_adapters.test.ts`
- `src/ext/modules/combat/tests/combat_animated_defense.test.ts`
- `src/ext/modules/combat/tests/combat_body_transition_facts.test.ts`
- `src/ext/modules/combat/tests/combat_bonfire_definitions.test.ts`
- `src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts`
- `src/ext/modules/combat/tests/combat_bonfire_ui.test.ts`
- `src/ext/modules/combat/tests/combat_combinations.test.ts`
- `src/ext/modules/combat/tests/combat_defense_state.test.ts`
- `src/ext/modules/combat/tests/combat_display.test.ts`
- `src/ext/modules/combat/tests/combat_dodge.test.ts`
- `src/ext/modules/combat/tests/combat_dodge_ui.test.ts`
- `src/ext/modules/combat/tests/combat_foundation_dodge_gate.test.ts`
- `src/ext/modules/combat/tests/combat_native_defense.test.ts`
- `src/ext/modules/combat/tests/combat_native_stamina.test.ts`
- `src/ext/modules/combat/tests/combat_parry.test.ts`
- `src/ext/modules/combat/tests/combat_parry_advisory.test.ts`
- `src/ext/modules/combat/tests/combat_parry_decision.test.ts`
- `src/ext/modules/combat/tests/combat_parry_ui.test.ts`
- `src/ext/modules/combat/tests/combat_part_break.test.ts`
- `src/ext/modules/combat/tests/combat_part_break_runtime.test.ts`
- `src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts`
- `src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts`
- `src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts`
- `src/ext/modules/combat/tests/combat_phase4d_playable_recording.test.ts`
- `src/ext/modules/combat/tests/combat_phase4d_rest_relations.test.ts`
- `src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts`
- `src/ext/modules/combat/tests/combat_phase4e_recording.test.ts`
- `src/ext/modules/combat/tests/combat_planner.test.ts`
- `src/ext/modules/combat/tests/combat_runtime.test.ts`
- `src/ext/modules/combat/tests/combat_scheduler_due.test.ts`
- `src/ext/modules/combat/tests/combat_schema.test.ts`
- `src/ext/modules/combat/tests/combat_square_replay.test.ts`
- `src/ext/modules/combat/tests/combat_ui.test.ts`
- `src/ext/modules/combat/tests/combat_warning_map.test.ts`
- `src/ext/modules/giants/tests/giants_c5_placement.test.ts`
- `src/ext/modules/giants/tests/giants_colossus.test.ts`
- `src/ext/modules/giants/tests/giants_committed_transition.test.ts`
- `src/ext/modules/giants/tests/giants_composite.test.ts`
- `src/ext/modules/giants/tests/giants_composite_natural.test.ts`
- `src/ext/modules/giants/tests/giants_composite_sfc.test.ts`
- `src/ext/modules/giants/tests/giants_config_examples.test.ts`
- `src/ext/modules/giants/tests/giants_contract.test.ts`
- `src/ext/modules/giants/tests/giants_rigid.test.ts`
- `src/ext/modules/giants/tests/giants_runtime.test.ts`
- `src/ext/modules/giants/tests/giants_spine_trace.test.ts`
- `src/ext/modules/giants/tests/giants_trace.test.ts`
- `src/ext/modules/giants/tests/giants_transitions.test.ts`
- `src/ext/modules/giants/tests/giants_transitions_sfc.test.ts`
- `src/ext/modules/giants/tests/giants_ui.test.ts`
- `src/ext/modules/giants/tests/giants_zones.test.ts`
- `src/ext/modules/giants/tests/giants_zones_natural.test.ts`
- `src/ext/modules/giants/tests/giants_zones_sfc.test.ts`
- `src/test/ai_1_scent_tracking.test.ts`
- `src/test/c_4b_dungeon_feature.test.ts`
- `src/test/c_4c_promotion.test.ts`
- `src/test/c_5_fall_subsystem.test.ts`
- `src/test/c_7_lighting.test.ts`
- `src/test/ext_compatibility_diagnostics.test.ts`
- `src/test/ext_foundation.test.ts`
- `src/test/ext_foundation_contracts.test.ts`
- `src/test/ext_module_composition.test.ts`
- `src/test/ext_recording_v4_digest.test.ts`
- `src/test/ext_recording_v4_snapshots.test.ts`
- `src/test/ext_recording_v4_storage.test.ts`
- `src/test/ext_region_runtime_transactions.test.ts`
- `src/test/ext_rest_point_runtime.test.ts`
- `src/test/ext_rooms_topology.test.ts`
- `src/test/ext_stats_native.test.ts`
- `src/test/ext_stats_pipeline.test.ts`
- `src/test/ext_stats_review.test.ts`
- `src/test/ext_stats_runtime.test.ts`
- `src/test/ext_structure_geometry.test.ts`
- `src/test/ext_structure_properties.test.ts`
- `src/test/ext_structure_transactions.test.ts`
- `src/test/ext_world5_clock_levels.test.ts`
- `src/test/ext_world5_offline.test.ts`
- `src/test/ext_world_harness_closed_loop.test.ts`
- `src/test/ext_world_harness_combinations.test.ts`
- `src/test/ext_world_work_boundaries.test.ts`
- `src/test/ext_world_work_failures.test.ts`
- `src/test/ext_world_work_review.test.ts`
- `src/test/ext_world_work_sdk_contract.test.ts`
- `src/test/ext_world_work_transactions.test.ts`
- `src/test/f_1_fire_as_terrain.test.ts`
- `src/test/f_2a_fire_mechanics.test.ts`
- `src/test/f_2b_creature_burning.test.ts`
- `src/test/f_2c_explosion.test.ts`
- `src/test/g_1_gas_volumetric.test.ts`
- `src/test/g_2_gas_df_wiring.test.ts`
- `src/test/g_3_gas_effects.test.ts`
- `src/test/horde_terrain_spawn.test.ts`
- `src/test/monster_path_cache.test.ts`
- `src/test/native_bolt_delivery.test.ts`
- `src/test/p4_10_waypoint.test.ts`
- `src/test/p4_1b_monster_casting.test.ts`
- `src/test/p4_6_attack_geometry.test.ts`
- `src/test/p4_8_scent_map.test.ts`
- `src/test/p4_9_safety_map.test.ts`
- `src/test/phase4a0_spatial.test.ts`
- `src/test/phase4a0_spatial_differential.test.ts`
- `src/test/phase4a1_game_perf.test.ts`
- `src/test/phase4a1_game_square.test.ts`
- `src/test/phase4a1_pathing_perf.test.ts`
- `src/test/phase4a1_square_pathing.test.ts`
- `src/test/phase4a2_body_combat.test.ts`
- `src/test/phase4a2_body_effects.test.ts`
- `src/test/phase4a3_body_display.test.ts`
- `src/test/phase4a3_body_sfc.test.ts`
- `src/test/phase4a4_generation_contributions.test.ts`
- `src/test/phase4a4_movement_regions.test.ts`
- `src/test/phase4b_game_rigid.test.ts`
- `src/test/phase4b_pose_pathing.test.ts`
- `src/test/phase4b_rigid_rotation.test.ts`
- `src/test/phase4c_fixed_zone_health.test.ts`
- `src/test/phase4d_body_lifecycle.test.ts`
- `src/test/phase4d_body_status.test.ts`
- `src/test/phase4d_composite_movement.test.ts`
- `src/test/phase4d_declarations.test.ts`
- `src/test/phase4d_effects_rewards.test.ts`
- `src/test/phase4d_group_sidebar.test.ts`
- `src/test/phase4d_movement_environment.test.ts`
- `src/test/phase4d_playable_recording.test.ts`
- `src/test/phase4d_production_body.test.ts`
- `src/test/phase4d_terminal_identity.test.ts`
- `src/test/phase4d_travel_ai.test.ts`
- `src/test/phase4e_body_transition.test.ts`
- `src/test/phase4e_recording.test.ts`
- `src/test/phase4f_audit.test.ts`
- `src/test/r_1_appearance.test.ts`
- `src/test/u21c_terrain_appearance.test.ts`
- `src/test/u_03_whole_run_snapshot.test.ts`
- `src/test/u_03b_level_travel.test.ts`
- `src/test/u_07_monster_blink.test.ts`
- `src/test/u_08_terrain_bolts.test.ts`
- `src/test/u_17a_df_transaction.test.ts`
- `src/test/u_17c_triggers.test.ts`
- `src/test/u_19f_fire.test.ts`
- `src/test/u_23_memory_mapping.test.ts`
- `src/test/u_27_recording.test.ts`
- `src/test/u_r2_trace.test.ts`
- `src/test/u_r3_trace.test.ts`
- `src/test/u_r4_trace.test.ts`
- `src/test/ux_1e_pathfinding.test.ts`
- `src/test/w_11_teleport_placement.test.ts`
- `src/test/w_12_blink_beckoning.test.ts`
- `src/test/w_13_tunneling.test.ts`
- `src/test/w_14_obstruction.test.ts`
- `src/test/w_3_bolt_trajectory.test.ts`
- `src/test/w_4_bolt_reflection.test.ts`
- `src/test/x2a_recording_checkpoint.test.ts`
- `src/test/x2b_terrain_derivation.test.ts`
- `src/test/x2j_monster_ai.test.ts`
- `src/test/x2m_lighting.test.ts`
- `src/test/x3_u1_movement_safety.test.ts`
- `src/test/x3_u4_auto_travel.test.ts`
- `src/test/x3b_display_recording.test.ts`
- `src/test/x3b_item_details.test.ts`
- `src/test/x4a_movement_rendering.test.ts`

### B.2 最终直接受影响复跑

- `src/test/ext_structure_protection.test.ts`
- `src/test/ext_structure_combinations.test.ts`
- `src/test/ext_structure_geometry.test.ts`
- `src/test/ext_structure_properties.test.ts`
- `src/test/ext_structure_integration.test.ts`
- `src/test/ext_region_runtime_transactions.test.ts`
- `src/test/ext_rooms_topology.test.ts`
- `src/test/ext_world_harness_combinations.test.ts`
- `src/test/ext_world_harness_closed_loop.test.ts`
- `src/ext/modules/growth/tests/ext_growth_view.test.ts`
- `src/ext/modules/growth/tests/ext_growth_ui.test.ts`
- `src/test/x3_u4_auto_travel.test.ts`
- `src/test/ux_1e_pathfinding.test.ts`
- `src/test/phase4d_travel_ai.test.ts`

format-final精确文件：

- `src/test/phase4a0_spatial_differential.test.ts`
- `src/test/u_r2_trace.test.ts`
- `src/test/u_r3_trace.test.ts`
- `src/test/u_r4_trace.test.ts`
- `src/test/ext_recording_v4_digest.test.ts`
- `src/test/x2b_terrain_derivation.test.ts`
- `src/test/c_4a_terrain_catalog.test.ts`
- `src/test/c_4b_dungeon_feature.test.ts`
- `src/test/phase4a4_movement_regions.test.ts`
- `src/test/ext_structure_source_guard.test.ts`

其余最终批次的文件名/命令完整列于§4（名称均定位`src/test/`）。

### B.3 最终候选直接复验的精确命令

下列命令均在仓库 cwd、§0 环境执行；publication-final 与 final-core-other 合起来覆盖全部100项新增核心测试。

```sh
npx vitest run src/test/ext_structure_integration.test.ts src/test/ext_structure_transactions.test.ts src/test/ext_rooms_topology.test.ts src/test/ext_structure_properties.test.ts src/test/x2b_terrain_derivation.test.ts src/test/ext_structure_source_guard.test.ts --maxWorkers=2
```

```sh
npx vitest run src/test/ext_region_runtime_transactions.test.ts src/test/ext_rest_point_runtime.test.ts src/test/ext_structure_protection.test.ts src/test/ext_structure_geometry.test.ts src/test/ext_structure_combinations.test.ts src/test/u_03_whole_run_snapshot.test.ts --maxWorkers=2
```

```sh
node scripts/check-module-boundaries.mjs
npx vue-tsc -b
npm run build
npm run test:drift -- --maxWorkers=2
node /private/tmp/phase5a3-evidence/perf-final.mjs
```

### B.4 审查修复的相关集合与最终封板

92文件主批的精确文件参数（其余参数为`npx vitest run … --maxWorkers=2`）：

```text
src/ext/modules/combat/tests/combat_adapters.test.ts
src/ext/modules/combat/tests/combat_animated_defense.test.ts
src/ext/modules/combat/tests/combat_body_transition_facts.test.ts
src/ext/modules/combat/tests/combat_bonfire_definitions.test.ts
src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts
src/ext/modules/combat/tests/combat_bonfire_ui.test.ts
src/ext/modules/combat/tests/combat_combinations.test.ts
src/ext/modules/combat/tests/combat_defense_state.test.ts
src/ext/modules/combat/tests/combat_display.test.ts
src/ext/modules/combat/tests/combat_dodge.test.ts
src/ext/modules/combat/tests/combat_dodge_ui.test.ts
src/ext/modules/combat/tests/combat_foundation_dodge_gate.test.ts
src/ext/modules/combat/tests/combat_native_defense.test.ts
src/ext/modules/combat/tests/combat_native_stamina.test.ts
src/ext/modules/combat/tests/combat_parry.test.ts
src/ext/modules/combat/tests/combat_parry_advisory.test.ts
src/ext/modules/combat/tests/combat_parry_decision.test.ts
src/ext/modules/combat/tests/combat_parry_ui.test.ts
src/ext/modules/combat/tests/combat_part_break.test.ts
src/ext/modules/combat/tests/combat_part_break_runtime.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts
src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts
src/ext/modules/combat/tests/combat_phase4d_playable_recording.test.ts
src/ext/modules/combat/tests/combat_phase4d_rest_relations.test.ts
src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts
src/ext/modules/combat/tests/combat_phase4e_recording.test.ts
src/ext/modules/combat/tests/combat_planner.test.ts
src/ext/modules/combat/tests/combat_runtime.test.ts
src/ext/modules/combat/tests/combat_scheduler_due.test.ts
src/ext/modules/combat/tests/combat_schema.test.ts
src/ext/modules/combat/tests/combat_square_replay.test.ts
src/ext/modules/combat/tests/combat_ui.test.ts
src/ext/modules/combat/tests/combat_warning_map.test.ts
src/ext/modules/giants/tests/giants_c5_placement.test.ts
src/ext/modules/giants/tests/giants_colossus.test.ts
src/ext/modules/giants/tests/giants_committed_transition.test.ts
src/ext/modules/giants/tests/giants_composite.test.ts
src/ext/modules/giants/tests/giants_composite_natural.test.ts
src/ext/modules/giants/tests/giants_composite_sfc.test.ts
src/ext/modules/giants/tests/giants_config_examples.test.ts
src/ext/modules/giants/tests/giants_contract.test.ts
src/ext/modules/giants/tests/giants_rigid.test.ts
src/ext/modules/giants/tests/giants_runtime.test.ts
src/ext/modules/giants/tests/giants_spine_trace.test.ts
src/ext/modules/giants/tests/giants_trace.test.ts
src/ext/modules/giants/tests/giants_transitions.test.ts
src/ext/modules/giants/tests/giants_transitions_sfc.test.ts
src/ext/modules/giants/tests/giants_ui.test.ts
src/ext/modules/giants/tests/giants_zones.test.ts
src/ext/modules/giants/tests/giants_zones_natural.test.ts
src/ext/modules/giants/tests/giants_zones_sfc.test.ts
src/test/ai_1_scent_tracking.test.ts
src/test/c_4b_dungeon_feature.test.ts
src/test/c_4c_promotion.test.ts
src/test/dialog_d4_blink.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_recording_v4_storage.test.ts
src/test/ext_world5_clock_levels.test.ts
src/test/ext_world5_offline.test.ts
src/test/ext_world_harness_closed_loop.test.ts
src/test/ext_world_harness_combinations.test.ts
src/test/ext_world_work_boundaries.test.ts
src/test/ext_world_work_failures.test.ts
src/test/ext_world_work_review.test.ts
src/test/ext_world_work_sdk_contract.test.ts
src/test/ext_world_work_transactions.test.ts
src/test/f_1_fire_as_terrain.test.ts
src/test/f_2a_fire_mechanics.test.ts
src/test/g_1_gas_volumetric.test.ts
src/test/g_2_gas_df_wiring.test.ts
src/test/g_3_gas_effects.test.ts
src/test/p4_8_scent_map.test.ts
src/test/phase4a0_spatial_differential.test.ts
src/test/r_1_appearance.test.ts
src/test/u21c_terrain_appearance.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/u_07_monster_blink.test.ts
src/test/u_15a_shattering.test.ts
src/test/u_19f_fire.test.ts
src/test/u_23_memory_mapping.test.ts
src/test/u_27_recording.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/w_12_blink_beckoning.test.ts
src/test/w_13_tunneling.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/x2b_terrain_derivation.test.ts
src/test/x3b_display_recording.test.ts
src/test/x3b_item_details.test.ts
```

最后原生/结构/录像封板的精确文件参数：

```text
src/test/ext_structure_review.test.ts
src/test/ext_region_runtime_transactions.test.ts
src/test/ext_rest_point_runtime.test.ts
src/test/ext_rooms_topology.test.ts
src/test/ext_structure_combinations.test.ts
src/test/ext_structure_geometry.test.ts
src/test/ext_structure_integration.test.ts
src/test/ext_structure_properties.test.ts
src/test/ext_structure_protection.test.ts
src/test/ext_structure_source_guard.test.ts
src/test/ext_structure_transactions.test.ts
src/test/c_4a_terrain_catalog.test.ts
src/test/c_4b_dungeon_feature.test.ts
src/test/c_4c_promotion.test.ts
src/test/g_1_gas_volumetric.test.ts
src/test/g_2_gas_df_wiring.test.ts
src/test/g_3_gas_effects.test.ts
src/test/f_1_fire_as_terrain.test.ts
src/test/f_2a_fire_mechanics.test.ts
src/test/u_15a_shattering.test.ts
src/test/w_13_tunneling.test.ts
src/test/r_1_appearance.test.ts
src/test/u21c_terrain_appearance.test.ts
src/test/u_23_memory_mapping.test.ts
src/test/x2b_terrain_derivation.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_world_harness_combinations.test.ts
src/test/ext_world_harness_closed_loop.test.ts
```

## 附录 C：黄金逐字段登记

### C.1 文件SHA与摘要向量

| 文件 | 开工SHA-256 | 最终SHA-256 |
| --- | --- | --- |
| src/test/fixtures/phase4a0-single-cell-baseline.json | 507d23460b22b98aab1deb8061931917596f92b9312e36dd728b0d9a8da665fe | 4bbc60360b9dbead3aee3180a6c99901e4046b8bfbeb0a0602fb3c4dcc5e8efe |
| src/test/fixtures/traces/u-r4-trace.json.gz | 438581e21cd4c39b77c83b085c75969b9738836c8b83ae5e8c87bf8607e88c07 | 583ebcf81f047043dde7f4360c56af1a02e09a076cd8c8d3bcf8205615308246 |
| src/ext/modules/giants/data/natural-trace.json | 685b4388fb3716cd793d57f7aba8812a2be312c08a13360026d09ef7497c258f | e3950f69adcfa507684fe4efca78bace49f88ee91d01180a05bfb594185cf76a |
| src/ext/modules/giants/data/colossus-natural-trace.json | c5dabe67ce895d6d4ca9fc0169b16f9ac76645e99d29060daadc5a800a81e38a | 73d8848ca51b44adb65757d0c8dedeea9e7c7be3d3018ab3aa431cd43bbe0526 |
| src/ext/modules/giants/data/spine-natural-trace.json | 93785fb56f953485f6a04925af5866f0f66af6d8283abb9e772b197ed10d7282 | 7f5b2c6ba72f9cf004d61e309dea19957d00302b795455b4d92127e1fbf70fb5 |

| 向量 | foundation8 | foundation9 |
| --- | --- | --- |
| root | 8cd4143674ecc3e7cd23fc439be10b6960988788ee563ea87ce226d8804bb6f1 | fc57fcd32ee81a2355097f38af73994ede7fff302e8751a9793d148e05788e2e |
| start | 76970205a70642ae188cc5c2b3e61a99d1e4eef32e41eb98c0d468e960a37b5e | 865018a2402e0f8609787c2c30066723e5db70c088c846a4040c4b54350ed0fa |
| chain | 978f9315ab7164b5b10a7261e32c2ff7c14dc108e5cb7eacb13b96b3a4443d23 | 0d99d87444ebcef52f4c7754b72ee2a40f9d21d588a54ae06caf577b2383a78c |

六个域不变：

- `native: 323a572cbdc04b1211bc4c0198ba8209325c6fb699120b1d18cbaa99ae2a16ca`
- `extensions: 45d52001ca271816b0e09831cbec73e18c38871c0dfe26b42f93ec734a3b64cd`
- `world5: 12d261a5676b74aaf5d71e57bff0dbfe3473d4c4120551927d1d70245ca63449`
- `actorActions: 9f1c9dc4d52ec4c60fe72bcc1de71b66536be51dcd27556f1fa4142b0ddf0306`
- `knowledge: a4a5b045927c5f0c3d22ce749a91a99a89f96f32df4a66f12a4a046cb6962880`
- `random: 1b5cd72d6624ed3521924c3549e9dac21fc7fd8e7885d22d556496da3fb9e8d7`

### C.2 巨兽extensions哈希与基础字段

| trace/层 | 字段变化 | 旧哈希 | 新哈希 | 版本投影回旧哈希 |
| --- | --- | --- | --- | --- |
| natural-trace.json / D3 | manifest.foundation; foundation.version; foundation.world.regions[id=54].revision（foundation8→9，revision缺省→0） | 70d0a2a4d84a1d1c234a9d806ffd9c2e3fc429162641c05acee49825ffd5c70b | f1d96df1a1efbffc237081ed8e9ea152ecdc1b11f03c95f4266654a6e48c8096 | 70d0a2a4d84a1d1c234a9d806ffd9c2e3fc429162641c05acee49825ffd5c70b |
| colossus-natural-trace.json / D7 | manifest.foundation; foundation.version; foundation.world.regions[id=76].revision; foundation.world.regions[id=95].revision; foundation.world.regions[id=144].revision（foundation8→9，revision缺省→0） | 81b36977e975059b6e689388cd7bd9d41eb9ae1817f5c997784e8965d05d61f0 | fafd76e8260b6b4fa7d9384fac305eda2335ce6e4b026849f89258b974afb0da | 81b36977e975059b6e689388cd7bd9d41eb9ae1817f5c997784e8965d05d61f0 |
| spine-natural-trace.json / D11 | manifest.foundation; foundation.version; foundation.world.regions[id=76].revision; foundation.world.regions[id=95].revision; foundation.world.regions[id=144].revision; foundation.world.regions[id=165].revision; foundation.world.regions[id=232].revision; foundation.world.regions[id=276].revision（foundation8→9，revision缺省→0） | 42fd044a099b1f6b9ba69aac81fb0ab777412a0a38518fd96d7b8b30c67d3b50 | 6d24f33b75be6a96e31caeb01264f36895cf33c560bd828ad52fbe58f50176b9 | 42fd044a099b1f6b9ba69aac81fb0ab777412a0a38518fd96d7b8b30c67d3b50 |

### C.3 UR4的52个变化叶子

| JSON路径 | 旧chainDigest | 新chainDigest |
| --- | --- | --- |
| .fall.animated.rows[0].recording[0].chainDigest | 50b940396fa7226ca19e56fcad99c98e14aea7f0ac82e92fd27b298333fd7d5a | 7df8d7b1a4b9093ce576a942c66fe069b266e5dba322c306c40b6cc7bda56450 |
| .fall.continuous.rows[0].recording[0].chainDigest | 50b940396fa7226ca19e56fcad99c98e14aea7f0ac82e92fd27b298333fd7d5a | 7df8d7b1a4b9093ce576a942c66fe069b266e5dba322c306c40b6cc7bda56450 |
| .death.animated.rows[1].recording[0].chainDigest | d5847b6eec1cc098d717e282c1f18823d194f3bd4183b18a59f0e4d6f167c0a0 | 7d2710156fd01900572ac6d72414c852aaac77daec6d58c13cb5d8b2d069038b |
| .death.continuous.rows[1].recording[0].chainDigest | d5847b6eec1cc098d717e282c1f18823d194f3bd4183b18a59f0e4d6f167c0a0 | 7d2710156fd01900572ac6d72414c852aaac77daec6d58c13cb5d8b2d069038b |
| .hasted.animated.rows[0].recording[0].chainDigest | d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389 | e15b67e0c3b7a6ba1b0b511e7de0b66cd314b0af987577949b64f6d561c434e3 |
| .hasted.animated.rows[1].recording[0].chainDigest | d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389 | e15b67e0c3b7a6ba1b0b511e7de0b66cd314b0af987577949b64f6d561c434e3 |
| .hasted.animated.rows[1].recording[1].chainDigest | 0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6 | f86ceb6695816b27efa92c9ec164d93c16b4ede060160319524719e24371d705 |
| .hasted.animated.rows[1].recording[2].chainDigest | 1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd | e475d8377a14f9b4cd782f726cc3a55727f4e6f54b67bc208b120f5a7073fdb7 |
| .hasted.animated.rows[2].recording[0].chainDigest | d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389 | e15b67e0c3b7a6ba1b0b511e7de0b66cd314b0af987577949b64f6d561c434e3 |
| .hasted.animated.rows[2].recording[1].chainDigest | 0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6 | f86ceb6695816b27efa92c9ec164d93c16b4ede060160319524719e24371d705 |
| .hasted.animated.rows[2].recording[2].chainDigest | 1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd | e475d8377a14f9b4cd782f726cc3a55727f4e6f54b67bc208b120f5a7073fdb7 |
| .hasted.animated.rows[2].recording[3].chainDigest | 646a47b1351bd4b630336c8b475a067fd49f290e748ac4247c0e1403626bbb4d | efaad1f3f69b6de2c5e095c21cf0015eadb785957e22bad660e602e9acd553f2 |
| .hasted.continuous.rows[0].recording[0].chainDigest | d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389 | e15b67e0c3b7a6ba1b0b511e7de0b66cd314b0af987577949b64f6d561c434e3 |
| .hasted.continuous.rows[1].recording[0].chainDigest | d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389 | e15b67e0c3b7a6ba1b0b511e7de0b66cd314b0af987577949b64f6d561c434e3 |
| .hasted.continuous.rows[1].recording[1].chainDigest | 0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6 | f86ceb6695816b27efa92c9ec164d93c16b4ede060160319524719e24371d705 |
| .hasted.continuous.rows[1].recording[2].chainDigest | 1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd | e475d8377a14f9b4cd782f726cc3a55727f4e6f54b67bc208b120f5a7073fdb7 |
| .hasted.continuous.rows[2].recording[0].chainDigest | d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389 | e15b67e0c3b7a6ba1b0b511e7de0b66cd314b0af987577949b64f6d561c434e3 |
| .hasted.continuous.rows[2].recording[1].chainDigest | 0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6 | f86ceb6695816b27efa92c9ec164d93c16b4ede060160319524719e24371d705 |
| .hasted.continuous.rows[2].recording[2].chainDigest | 1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd | e475d8377a14f9b4cd782f726cc3a55727f4e6f54b67bc208b120f5a7073fdb7 |
| .hasted.continuous.rows[2].recording[3].chainDigest | 646a47b1351bd4b630336c8b475a067fd49f290e748ac4247c0e1403626bbb4d | efaad1f3f69b6de2c5e095c21cf0015eadb785957e22bad660e602e9acd553f2 |
| .slowed-environment.animated.rows[2].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[3].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[4].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[4].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.animated.rows[5].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[5].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.animated.rows[6].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[6].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.animated.rows[6].recording[2].chainDigest | 0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0 | 98aec88cd9d89a43f7b15e511b94abb89d5e56b2f3bead3365f3f6f5a6d1ef7c |
| .slowed-environment.animated.rows[7].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[7].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.animated.rows[7].recording[2].chainDigest | 0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0 | 98aec88cd9d89a43f7b15e511b94abb89d5e56b2f3bead3365f3f6f5a6d1ef7c |
| .slowed-environment.animated.rows[8].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.animated.rows[8].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.animated.rows[8].recording[2].chainDigest | 0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0 | 98aec88cd9d89a43f7b15e511b94abb89d5e56b2f3bead3365f3f6f5a6d1ef7c |
| .slowed-environment.animated.rows[8].recording[3].chainDigest | 973ebd4ffa6e51e64082d1fec05b77a47b022c8e6c4d71003031ce346f1b61ca | aba3a2a4ab12ef8416f6333904d996b1c6d688302793ccaa59dc01cdbc1f24d8 |
| .slowed-environment.continuous.rows[2].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[3].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[4].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[4].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.continuous.rows[5].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[5].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.continuous.rows[6].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[6].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.continuous.rows[6].recording[2].chainDigest | 0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0 | 98aec88cd9d89a43f7b15e511b94abb89d5e56b2f3bead3365f3f6f5a6d1ef7c |
| .slowed-environment.continuous.rows[7].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[7].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.continuous.rows[7].recording[2].chainDigest | 0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0 | 98aec88cd9d89a43f7b15e511b94abb89d5e56b2f3bead3365f3f6f5a6d1ef7c |
| .slowed-environment.continuous.rows[8].recording[0].chainDigest | 470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618 | ab9b011d0dea3762366ded4c1225c5c0f220c51164fb2e1e38fc82eb4cf6bb53 |
| .slowed-environment.continuous.rows[8].recording[1].chainDigest | a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2 | 4ca452963aa32c792690a5ecfc85f6eb436aa9399372236ebb60116333beb9cb |
| .slowed-environment.continuous.rows[8].recording[2].chainDigest | 0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0 | 98aec88cd9d89a43f7b15e511b94abb89d5e56b2f3bead3365f3f6f5a6d1ef7c |
| .slowed-environment.continuous.rows[8].recording[3].chainDigest | 973ebd4ffa6e51e64082d1fec05b77a47b022c8e6c4d71003031ce346f1b61ca | aba3a2a4ab12ef8416f6333904d996b1c6d688302793ccaa59dc01cdbc1f24d8 |

### C.4 4a0紧凑夹具：历史与本步分别登记

历史基线（仓库旧文件→开工）148叶，本步（开工→当前）86叶；下面保留旧/开工/最终三段值。RNG与消息未变。

| 路径 | 仓库旧值 | 开工值 | 最终值 | 归属 |
| --- | --- | --- | --- | --- |
| .empty.blink.graph.sha256 | 70c2d2ed248d0167fa75f47184436c5d4e9af1cc4067172940561decb94c764e | 032621bc74321caaa1366f7b7b41ff95802b3b13603c5490c3cca7fbd7d8d611 | 3b2f0624af7c0b5caf182be6141dcab97dcbd5ac173a4326324aefe4af5d6294 | 历史SHA + 本步版本派生SHA |
| .empty.blink.snapshot.sha256 | 4e22d714e1334747d53365cf8e1d5773364616df08e9adc1630650035ace7b0e | 2c62a9b7dbcae1db45f10179cc4cf26c1778c3ef5c96d461e8e4f1741fc55dd7 | 4613445f5621b97a8a1f8f5908d5259dfd768e17a013391cda3ac70b4dbea31c | 历史SHA + 本步版本派生SHA |
| .empty.clone.graph.sha256 | 2cfa1208187a74ba81b19f9aac83553308e18e80b2e8d58167b25324212dc38b | f886ef2a525c3ef26abb32a32fd9ea723b5c3bd5260631623a39af7021154cd6 | 9606988113f03a065cf681cde334ed90f0e0654a230729dfb17619c7cca3f2ed | 历史SHA + 本步版本派生SHA |
| .empty.combat.graph.sha256 | 0130c87eaffcb14a562f897b93768b7277cf3451241f2e8b367bda9a100236d9 | ea59c358c062e7a0987b564d028601b5234f1ae0a110f7e77b8d02d9c528a89f | 21e3fb315779994f36ca9602918578a723f7a11200ecb9172b5d270b51080c89 | 历史SHA + 本步版本派生SHA |
| .empty.combat.snapshot.sha256 | d7a7f94ba98eaa2c22479db41dc1d9f72d577448c91d6d055e6d579395751476 | 360c768aa64457b6351fffbf628dfa7a883197d0644a15be1a9ed4991dde376b | 4f5a05b36cbdf32462ea7b173dd323c8552f9a89dc882d3c042fa1e287b53d5d | 历史SHA + 本步版本派生SHA |
| .empty.commands.graph.sha256 | 0f05333c2d601c4ec016ccc13a0dcceea35fe923cd639a57f7344df40d29e372 | a88eedc4b3fa197a6a1120f3dbf3576c074169d4d0b4ff088ba1db4ed4db0c9d | baff9d42249a70db3a82b91f454c0cfbc69ee599254133f75b72c455031f17f5 | 历史SHA + 本步版本派生SHA |
| .empty.commands.snapshot.sha256 | b7c533025e77dd7bbe94727018e5330efe8caab340624d0bcf7e771221fe03ae | a030c3766d0d85dd0a318e4a66493f2fd8c5eaf8324867cdeb4e4094726a2c77 | 172f1a4f7d853fe921e42f7abfb79f97f7474e57178a51a0249eace726d0262c | 历史SHA + 本步版本派生SHA |
| .empty.continued.graph.sha256 | 0dfe21f1d43818ac3bca7b6aa57eee0d05e97f6823747446a01da7ba485e491a | 1961f0c062fd66db1585e8ffbd0dacf9f38bf030eaf3ff9f51d1ad04f795e42b | e72cd683a39c47ed195ebd41f0d2f8c4177f555e5010c922e48d54e5909ca2de | 历史SHA + 本步版本派生SHA |
| .empty.continued.snapshot.sha256 | 5aeebaac90a42c16f028848f7476c4cc53888f3f78d52849c7b8ef9e275fd9b0 | d0d0bc804e0f39f61e2fdba43e85cad60e9afe33bc333386f81398c31cc6cfa7 | 0bab085ebed160b7221594bdfc27028189222cef3db17efe41d335760f0a901e | 历史SHA + 本步版本派生SHA |
| .empty.knockback.graph.sha256 | d4c688850cced1284ccc36f559d714c66190d79c923d88eb7de4ffec63f19cff | d9df5b4b5e809e3fc4d15211888541b3df06780885999ea836c73dada9338273 | 9b3aabd8f2effc32544453aed8bd00009b1676d84542472ccb03c3d2795ea22a | 历史SHA + 本步版本派生SHA |
| .empty.level.graph.sha256 | 9cf9389574ab605f16b200aa4c913469be8c50f766475be9474ba8f3ccd87269 | a04e921f9864c53e5200c189e4e37e856b1fa534e044458d38cbd977c686fee0 | b28fa14cf4f68bd673e4dcf07b2637c3c76c91c77c2a3ab6e34dc00e6e8956e2 | 历史SHA + 本步版本派生SHA |
| .empty.level.snapshot.sha256 | 80d64b737c91cb36b74db674580e2d6cd9e7c98796858d28292a5e91bce7eeb7 | 6ca84fd2838c2b1db5ff80dbb58a3678906ed0944dffa2b28f6195cf68720584 | e561a5ec67d407138b577d1d3f77815d8d8d7cfbd3eb54d686c28274a45753ca | 历史SHA + 本步版本派生SHA |
| .empty.loaded.graph.sha256 | f16a60b2d80847de3d9ac355c01a6b1d2871ce936e18dca1597894fb9bac564f | ea0079e7aedc6ef3aacf5deb23daeffd170a9e7319d363fb3a22539c3345c355 | 168a10aeff532a091dfde132f8c375e8190b8b50eda5f7a36ace468f818f9a51 | 历史SHA + 本步版本派生SHA |
| .empty.loaded.snapshot.sha256 | b7c533025e77dd7bbe94727018e5330efe8caab340624d0bcf7e771221fe03ae | a030c3766d0d85dd0a318e4a66493f2fd8c5eaf8324867cdeb4e4094726a2c77 | 172f1a4f7d853fe921e42f7abfb79f97f7474e57178a51a0249eace726d0262c | 历史SHA + 本步版本派生SHA |
| .empty.newGame.graph.sha256 | b991f5ac6947801ac2c72b87bbbaf49bce02e4b4da487eea53c80104d8babf64 | 98240369732eb5e85a5967b997bd7bc9c560c523548039863b48d665cdb3be03 | 98240369732eb5e85a5967b997bd7bc9c560c523548039863b48d665cdb3be03 | 历史SHA（本步保持） |
| .empty.newGame.snapshot.sha256 | fd4b781d048ce2df3f137273e38eebdebd7a6fd9c99eaa0e99063e297fb1e118 | 7d86c57b1a69d0134fd6c6459b55d77021316bdaea737869c045f76dca124a32 | bf4dc0cfff8863dbbc2ca3e07fd74e948cd2970983eae1000a9d4ffd7263d901 | 历史SHA + 本步版本派生SHA |
| .empty.replayed.graph.sha256 | 5fcc3c7b35b2693962e6cb7dc8944a8601934a6c8cbc14ff701d597e8ffa23f2 | 5bc95878a5b477d3af9113eea5fd09e8c217f907491b18471ead6572ab7a014a | 77317b35ded8afd44be7725c9e0cb72c30c1006b764732a5aea989ac671379c5 | 历史SHA + 本步版本派生SHA |
| .empty.replayed.snapshot.sha256 | b7c533025e77dd7bbe94727018e5330efe8caab340624d0bcf7e771221fe03ae | a030c3766d0d85dd0a318e4a66493f2fd8c5eaf8324867cdeb4e4094726a2c77 | 172f1a4f7d853fe921e42f7abfb79f97f7474e57178a51a0249eace726d0262c | 历史SHA + 本步版本派生SHA |
| .empty.seek.graph.sha256 | 8e487735f9700c3fc752555dfbf5831a885fa1a9d7cf1d98f3ee930382bfb879 | ed84405aadfffec42883762ea9b2e5d73bc19580b458a9ef65d9ce01c8b579ca | 8c363378fbc2b32004a16c0e6118d6bcad8f197d590692362d8a839bc943b6a9 | 历史SHA + 本步版本派生SHA |
| .empty.seek.snapshot.sha256 | da16f8c42d6088dec13c7b13a85b6cf846f6740919d8e6e7f4b2f0e0dbc4e86c | fde9218ba97bbc7eb8a5dbf278ef7a9148e58ef9eb959a3838469d07dfd2f1fe | fddb203d41295497f177bb2225747ebd5151fdc7188e5e60f790162bd49110f6 | 历史SHA + 本步版本派生SHA |
| .empty.summon.graph.sha256 | 41755c9423605ca5f7eb2cba1376b5fbfd13693ccf062abf4fb629828632bf9c | 6471ad90454ec063c961d3a8f25b805ecdb90f20118261ff38da2d3086416d4e | ed407b9ffc6d7321f6dcde321b3164698d0173c8a6ad2f6673048b72e4941b8b | 历史SHA + 本步版本派生SHA |
| .empty.trap.graph.sha256 | e6e20a3c0fceeb9278de822eca6cf572e15383346a851cbf00a7796afee4180a | 42a767cff171c54f809b01ca014f8e62b6baee555d9c50a375d5ad65738cd81e | 6fbeeddd860ecc543e240e54fb976c14574bbc72351ac7ebfbd147439b54e6f6 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.blink.graph.objects | 24213 | 24230 | 24230 | 历史对象数量 |
| .growth+narrative.blink.graph.sha256 | ddac71209229a60dfc0f27508ff3aacea921b56a6b5ee11f4c216931852bdb0f | 450284ee63bf05f1073a2f0ad137393ef52879196fd895a14bb87989bf12bdf0 | 4f3ec1ae4a4f1ac1d5446886e4c75ea0719dba10714acec8ac9282589e7050c8 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.blink.snapshot.objects | 5860 | 5858 | 5858 | 历史对象数量 |
| .growth+narrative.blink.snapshot.sha256 | d6c59b1844436cb7406903aff63ba559bc842c6094235aa94ef96b158a9f032a | ef90165cca5647acad854e7688a33c523fb497fcd1fcebbdc430832695e3b98d | 02966f0dd66256a7a46f82c11842cfe1519e2dff6436d475c20a486e516e4195 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.clone.graph.objects | 24246 | 24262 | 24262 | 历史对象数量 |
| .growth+narrative.clone.graph.sha256 | f969b5accea6fbf838f9977ce2c97bbe68a0bfa77993592edda34380362eca16 | 7cc1a725a7e687edc1640e3a2193fecec21d2663412293ce496798ea8a95f663 | 6a05584f51c2342406b481ec5f0da072e0e39708bb0baf47da3f98549922db54 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.clone.snapshot.objects | 5844 | 5841 | 5841 | 历史对象数量 |
| .growth+narrative.clone.snapshot.sha256 | 9bc353df1e86e58dae3cc3fbdb7f9ceca83438505f6dec003a7f27d534a4703a | cca06deb4000dd68e2e4fe546b9d2e9c270937865a069056b375f6f52dc7163b | cca06deb4000dd68e2e4fe546b9d2e9c270937865a069056b375f6f52dc7163b | 历史SHA（本步保持） |
| .growth+narrative.combat.graph.objects | 24153 | 24170 | 24170 | 历史对象数量 |
| .growth+narrative.combat.graph.sha256 | 52d3e4a159c380a4a5960ad195bd498a1aa3c559bdf2b68d4a0d63c4aa3753b6 | f58aadee47adee3fcc0fa10bb0f21d76710e624d69154deb11b4b4db0a15e416 | cca1d37664ecc064a309e533d67a3cae13baab4b32c84795a569ee626b4a4640 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.combat.snapshot.objects | 5802 | 5800 | 5800 | 历史对象数量 |
| .growth+narrative.combat.snapshot.sha256 | 9e15e81389b3341c67a6489e3e448ffab8ad6f972a33630649ea922285e9d6ec | 6638a9e9f60cdaa2fc5827fcbb7a0d58550fcb59017b5fbca50a8fdd337503e4 | 500758a4911969154abf894456a8ae2337c656b4b4a8d235d05171231b8f55ae | 历史SHA + 本步版本派生SHA |
| .growth+narrative.commands.graph.objects | 24482 | 24500 | 24500 | 历史对象数量 |
| .growth+narrative.commands.graph.sha256 | eba1e2b0fc9f271774361955e494cf35c2bfa0e563712157f6496d97566fbac3 | 2dc4e6417fd43fd62239717bfa723d71df2ffcd14d1185bab8d8662cc6db0ee8 | 70d09ff18819495aaf2907ae6d52874e69c9b4a0432710ccf684000a7cfc4ec0 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.commands.snapshot.objects | 11353 | 11352 | 11352 | 历史对象数量 |
| .growth+narrative.commands.snapshot.sha256 | cd2878dbf25fe392f87b00024e76857488769f403764e3a35598c274ced147fb | e09f34633dbcb2dcd1ce0a94ed8e54768add1030b3a18c5b0d9a00ad5a3197cf | 0ded96e879bf22c1cd8e619ddcc0f066c6e515f451abf8688a0cc810568587e9 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.continued.graph.objects | 24492 | 24510 | 24510 | 历史对象数量 |
| .growth+narrative.continued.graph.sha256 | 6f89c050916a396dd268abd4866a1f76ed6ec69efaa7a6d37a353f8d00c8a3fb | 34b6608e6d443788d71c3bef035230b2ac5a92697a1c1f71ea8eac97610288ed | 04a407235b0e077b6c3715d9fd0cbd395ef5dfbc934b7f8ad1d096156120c3c8 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.continued.snapshot.objects | 11363 | 11362 | 11362 | 历史对象数量 |
| .growth+narrative.continued.snapshot.sha256 | 9647c6a3a76d47957491107d24842d5ee831ccc5af007168e6c732788e8431f7 | 13c393845a1e7d59c56be8bc571185dfaae47e1756daa86126f568778c8fdc4a | 6537172932765d17de6e18d00e270f4e78a7ca10bba891c598a4315bc123108e | 历史SHA + 本步版本派生SHA |
| .growth+narrative.knockback.graph.objects | 24153 | 24170 | 24170 | 历史对象数量 |
| .growth+narrative.knockback.graph.sha256 | a67393443f28dfe6c8e3aab5269cd1e6c4f03792e81d79eeaa9ea024e4fc19a9 | de9cc5b1f9037ff70f369a2b8d0f129de4df60312aad0ef6918c71d923d50e26 | de31155cbbe293a630c4a26a2dcc8d46825e5c622f2cac2b68aafbed7b2e9acb | 历史SHA + 本步版本派生SHA |
| .growth+narrative.knockback.snapshot.objects | 5765 | 5763 | 5763 | 历史对象数量 |
| .growth+narrative.knockback.snapshot.sha256 | 1b475dc6925dfc9ca7c582e3b97f9f360566d22ca6d56ed4a677ad98cfebcb87 | cc715952986ac1e54bc8cb7c8ce6f38dee6e9a053524d6693e0b0b958ec375af | cc715952986ac1e54bc8cb7c8ce6f38dee6e9a053524d6693e0b0b958ec375af | 历史SHA（本步保持） |
| .growth+narrative.level.graph.objects | 46515 | 46520 | 46520 | 历史对象数量 |
| .growth+narrative.level.graph.sha256 | b289ecb62e112bd4a48d9d955544011e888a798421f118e51ef5e85dbd6b77f5 | b4df21264c78c58bac5b16377cec9339325f11d269fd91a5922f9c3288a94939 | 62014124e365da12ea4eb77530c7703736dd60d0e93a7bb731d22905e3ba1e01 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.level.snapshot.objects | 21493 | 21482 | 21482 | 历史对象数量 |
| .growth+narrative.level.snapshot.sha256 | b088a4d6e4d596d8ad3224626ca6917a8cfdf34c7cb0ff3d93cf848dadfd0c04 | 1c3df79015c90f4c2df58c7ae277ec652ec9f5d1fd3e318c9571448034a78670 | 52f39d7f3188e84e3a11f029000898d6f3794f5aceb00886e7f21a4cb7c0db0c | 历史SHA + 本步版本派生SHA |
| .growth+narrative.loaded.graph.objects | 22105 | 22123 | 22123 | 历史对象数量 |
| .growth+narrative.loaded.graph.sha256 | c1a1c29bbe21ab0e470490f67fad5fc0cde9be239b02bfff93c9357f1c627fe3 | b926f8b2abdca7aa0f3018a9a16cb9e73e0f36d55b63be10dfbe1bf323b05d24 | 06b8450b4d39cd513a71b155eb08144ad7455fc3f12654939117f79d40782179 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.loaded.snapshot.objects | 11353 | 11352 | 11352 | 历史对象数量 |
| .growth+narrative.loaded.snapshot.sha256 | cd2878dbf25fe392f87b00024e76857488769f403764e3a35598c274ced147fb | e09f34633dbcb2dcd1ce0a94ed8e54768add1030b3a18c5b0d9a00ad5a3197cf | 0ded96e879bf22c1cd8e619ddcc0f066c6e515f451abf8688a0cc810568587e9 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.newGame.graph.objects | 24447 | 24465 | 24465 | 历史对象数量 |
| .growth+narrative.newGame.graph.sha256 | e6378af6d55d78169f08588ddf16061a8df61dd25c695a37c026f006d54c33d7 | 5db4bb5774288e5edba9b9fc592b19a135a5751089ccb2109c865739bf5955d9 | ff1194bc245b7d9fcfbfa3d57fe34d9464a1c0f8d3345deddb56db81240e0cc5 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.newGame.snapshot.objects | 11322 | 11321 | 11321 | 历史对象数量 |
| .growth+narrative.newGame.snapshot.sha256 | f09bed3f81966b4c26022d78d5466162acabf8dd90a6ee2d46bc8066e41a169f | 4dedd09e7c236ca4d216d5ce892c8894b3c545bc624fe65fcc98966f5b5df007 | 61551b9aa211e70b7d622382ad9a6962d8b6daf7c53e9327fe10d9f94893d5db | 历史SHA + 本步版本派生SHA |
| .growth+narrative.replayed.graph.objects | 24494 | 24512 | 24512 | 历史对象数量 |
| .growth+narrative.replayed.graph.sha256 | ad2a9ec6472acc44ea7a8e5c84a492096e7afc863d455bf6f882afdb98a522e6 | 24a411b5d1bd56912a3715e75240b8217cb7b9d59390519fc7f8af9cb7338f40 | 2973f03a6a0384636d66c1c9ceedfb8ec64a0ae7f705d295162d831123d39abd | 历史SHA + 本步版本派生SHA |
| .growth+narrative.replayed.snapshot.objects | 11353 | 11352 | 11352 | 历史对象数量 |
| .growth+narrative.replayed.snapshot.sha256 | cd2878dbf25fe392f87b00024e76857488769f403764e3a35598c274ced147fb | e09f34633dbcb2dcd1ce0a94ed8e54768add1030b3a18c5b0d9a00ad5a3197cf | 0ded96e879bf22c1cd8e619ddcc0f066c6e515f451abf8688a0cc810568587e9 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.seek.graph.objects | 22117 | 22135 | 22135 | 历史对象数量 |
| .growth+narrative.seek.graph.sha256 | c6f7bc6b1fed9db0963f573299a33dd6902ad17e69689b597359f462862c9ef7 | 43546570827994051d8321b869a365e6de53c1535d32f5404c1b035806f5832d | de1d9e753bcdc128e6d51da31cbdbe146007cb86973df93a01c24a151cb8b2fb | 历史SHA + 本步版本派生SHA |
| .growth+narrative.seek.snapshot.objects | 11322 | 11321 | 11321 | 历史对象数量 |
| .growth+narrative.seek.snapshot.sha256 | f09bed3f81966b4c26022d78d5466162acabf8dd90a6ee2d46bc8066e41a169f | 4dedd09e7c236ca4d216d5ce892c8894b3c545bc624fe65fcc98966f5b5df007 | 61551b9aa211e70b7d622382ad9a6962d8b6daf7c53e9327fe10d9f94893d5db | 历史SHA + 本步版本派生SHA |
| .growth+narrative.summon.graph.objects | 24378 | 24390 | 24390 | 历史对象数量 |
| .growth+narrative.summon.graph.sha256 | 522cf90bb8873360326e0be82dfb837ec7509c7b25d91a8b11fd4f96b9b1d12b | 2ca753c8d3d209b7ab8322aadbacaf4e57552319d16f18cff1dc00169edfc87e | fb353291bc9637fdf50f73248d769a90b80fe70bc61a1a7599cf177966aac685 | 历史SHA + 本步版本派生SHA |
| .growth+narrative.summon.snapshot.objects | 6004 | 5997 | 5997 | 历史对象数量 |
| .growth+narrative.summon.snapshot.sha256 | b00163db40794fb6664959e3f458ff8b917bcd256139009938d9eda118e37c53 | 687eb8046141afdb4bc8448b8c43b2c0b5cc4c49e8746b42cb4ad0d1aaaceb8b | 687eb8046141afdb4bc8448b8c43b2c0b5cc4c49e8746b42cb4ad0d1aaaceb8b | 历史SHA（本步保持） |
| .growth+narrative.trap.graph.objects | 24379 | 24391 | 24391 | 历史对象数量 |
| .growth+narrative.trap.graph.sha256 | 1c8efda705258ed4aafb9298d215feecf4eae715237ff6698f13707219ad411f | ba726d88ab57b70e470aca98228518b70b37175c9f01a3a6e10fd5245de1dabe | d5ae48283d5c30b80a3da6c3400498336cd99461a9c8d9d40c254b69bb9a81bb | 历史SHA + 本步版本派生SHA |
| .growth+narrative.trap.snapshot.objects | 6004 | 5997 | 5997 | 历史对象数量 |
| .growth+narrative.trap.snapshot.sha256 | 4d10ba13f565dec4bbeb97a7fc83d06d32a32eebd1a8da3cc059f9fbd123e943 | 3b538b9708682d4168bd78259dc6931d7bf216b2ad7ec9905c2e673e2919eccd | 3b538b9708682d4168bd78259dc6931d7bf216b2ad7ec9905c2e673e2919eccd | 历史SHA（本步保持） |
| .growth.blink.graph.objects | 24184 | 24201 | 24201 | 历史对象数量 |
| .growth.blink.graph.sha256 | 57b48f4992a4ecbfea3b130d9e480513ecdf04110523beb81199fe8d15d9481a | 9af700058bd0d1fda24acde5101a03524c55e9b02b8ef9ad477c586dbdd9dc9e | fc80a69084a1aac4707c3d343dfffd3699c2d271367909c4fb9561b357178b66 | 历史SHA + 本步版本派生SHA |
| .growth.blink.snapshot.objects | 5838 | 5836 | 5836 | 历史对象数量 |
| .growth.blink.snapshot.sha256 | 509de20fcd4a1ff7c275dde727ac754cf516a3b9d4e6e8d94c6308f1a0fb1bce | 10165febdcf47ca222232711e78761b719d988dda1d5ff9443898b7bebf95579 | d3cde112b2d12c44098ca30a4e7b8bd002ac293a26eefa706117d46204cce1b8 | 历史SHA + 本步版本派生SHA |
| .growth.clone.graph.objects | 24217 | 24233 | 24233 | 历史对象数量 |
| .growth.clone.graph.sha256 | 293644b1e607a23a46e0fcf8f7e07b7f442223e7c16d854a635c069834ebc7b4 | 1e4657507f6d89de31385ba38495fd56012a6ce0851147a1d4a210c4ef661879 | f6e1cec003dc723748cc49ea56a3776ce09e36ad6a2c853f8358232de84e950c | 历史SHA + 本步版本派生SHA |
| .growth.clone.snapshot.objects | 5824 | 5821 | 5821 | 历史对象数量 |
| .growth.clone.snapshot.sha256 | 1e8cc810a6ccefe9dde50d855e34890cc421b534485a1c39a1263cd359ec85c1 | 81bc59f3f5f2753a9520675b24db6753e31b4011abffc0ce5ff5863109518fa9 | 81bc59f3f5f2753a9520675b24db6753e31b4011abffc0ce5ff5863109518fa9 | 历史SHA（本步保持） |
| .growth.combat.graph.objects | 24124 | 24141 | 24141 | 历史对象数量 |
| .growth.combat.graph.sha256 | 9af6408e6ddd719abc3fbe397686d120b99f4c63e6aa277c84aedb4412111d88 | 185277930a1223c2440f63b69e4c8aab2deb1a9f8afd19a7773a6736a9fefc73 | 9f579dfe73fe5fc523891a3f8b96acc3263f4e262a37d39310fccc61ccc2debc | 历史SHA + 本步版本派生SHA |
| .growth.combat.snapshot.objects | 5780 | 5778 | 5778 | 历史对象数量 |
| .growth.combat.snapshot.sha256 | 36901c35d57450daf30ea2d0d0eaccf934ca83154082c46361c8e61865eb09a0 | 5c6851cc510efe9779d67108b443dd8294647941421a91172fd29fe3896d6ffe | 5546997d9b013fb148ac0a1aed8f8c0b6dea1e2e80cbdc103a137473677b282f | 历史SHA + 本步版本派生SHA |
| .growth.commands.graph.objects | 24453 | 24471 | 24471 | 历史对象数量 |
| .growth.commands.graph.sha256 | c5ef91259f5a5ac437900c55964ef15c2bf5f38c5b131cbae91584af91ed74ae | e9ec52287c4f2fa4efb16629c3a8aa8ee4e0c29682030c03edaec669070cb635 | 8c502f121b804b116d82369dc085562bb67467f8f9287840564534bd709b4b4e | 历史SHA + 本步版本派生SHA |
| .growth.commands.snapshot.objects | 11331 | 11330 | 11330 | 历史对象数量 |
| .growth.commands.snapshot.sha256 | f2d17a6f11ede70eb6aee86cfecdc234a4ebca256ad744ae9f3232ac7bd81651 | eace0c4b9361ed541e0e08494da04f605ac3c1d0c2b94fa541db9d4b6d70f04e | 70d1f7c04749e96b0306ad84cf963e44f9f47d8be92e7774f4a84713c5f6676d | 历史SHA + 本步版本派生SHA |
| .growth.continued.graph.objects | 24463 | 24481 | 24481 | 历史对象数量 |
| .growth.continued.graph.sha256 | bd40d34a44b62839624c34da090baafb3e1af297e35b63e74bcc2b35accdeb84 | dffd613a766c6bc2262e9362c87e31c7b066eb62bdcfc0a942a078f12cb5556f | c46f9a55181896c9d3bc1c1772f652f67d697b8d3ca5f2d4cf695439e09b5bb9 | 历史SHA + 本步版本派生SHA |
| .growth.continued.snapshot.objects | 11341 | 11340 | 11340 | 历史对象数量 |
| .growth.continued.snapshot.sha256 | f6c9a471618a178ea9f8622003b8ac710a8c0d23c46cea3f3802b244b3496a1c | 7599ed1157aeb7d48ef056e445ecef8b89cb7ee918dd88254f0ebfe206194f55 | 83c7f9fd46f4d956b01cf599a074c10e959da7806f753837edd67880bb84ca4e | 历史SHA + 本步版本派生SHA |
| .growth.knockback.graph.objects | 24124 | 24141 | 24141 | 历史对象数量 |
| .growth.knockback.graph.sha256 | 25598d3f2dc20c51bf486df3c6a104735f9c6deab04edb100cbda6bf6f49ea54 | 3e361fb6aee625ea213d8a97e89a2ff46d1afd5834351e84a7ff780c442a6d00 | e63be55a06034533e6de0abb8fba227e4d246f31736dd4fc5e848c48f0d5fa2c | 历史SHA + 本步版本派生SHA |
| .growth.knockback.snapshot.objects | 5745 | 5743 | 5743 | 历史对象数量 |
| .growth.knockback.snapshot.sha256 | 557c33abe743eb17062009a948aab20669d68fa224b2cb1a20ccb3ca0f860e2a | a84f24d41792d8f39856bbe34022fc1c38ae00673534122a7cf6a73b94b7d967 | a84f24d41792d8f39856bbe34022fc1c38ae00673534122a7cf6a73b94b7d967 | 历史SHA（本步保持） |
| .growth.level.graph.objects | 46486 | 46491 | 46491 | 历史对象数量 |
| .growth.level.graph.sha256 | 493e2d81433636b2e56ab389581c23434b0905b19bed8159a4a03bdc34cd7714 | 6cef1ffdedcd4e8352c32c62a05701da7ba5e564b03b911c2db7ea524ee0cd73 | 09be456f36e1433e5ee0ab8b480a2a8c10a473a991b99a1cb3c936fb06a7c36e | 历史SHA + 本步版本派生SHA |
| .growth.level.snapshot.objects | 21471 | 21460 | 21460 | 历史对象数量 |
| .growth.level.snapshot.sha256 | 1a40dbde26d0590d2bf7bf9ee669e4d7c423a0356022e58a8de71ef76b7dea58 | 07e0e29d63acf99939ddb04a6ba33d581f737e6882379eebfff027b809513f1f | 9d24e0819ae42efc61644895f213404e6629fad207d8800a458dd5c191af943c | 历史SHA + 本步版本派生SHA |
| .growth.loaded.graph.objects | 22076 | 22094 | 22094 | 历史对象数量 |
| .growth.loaded.graph.sha256 | 10153de449758c3cf94a6926e2ba09889efe424d753f5c345f30a17ed4ce4a3f | 3de6dcf4bed8189f0e8c3f0d8f8de6ac51dd398878328eac2d6139714810c152 | 833aa0edf4289843084bae52a67bbab807d04887a484632e630aa616f7402dcd | 历史SHA + 本步版本派生SHA |
| .growth.loaded.snapshot.objects | 11331 | 11330 | 11330 | 历史对象数量 |
| .growth.loaded.snapshot.sha256 | f2d17a6f11ede70eb6aee86cfecdc234a4ebca256ad744ae9f3232ac7bd81651 | eace0c4b9361ed541e0e08494da04f605ac3c1d0c2b94fa541db9d4b6d70f04e | 70d1f7c04749e96b0306ad84cf963e44f9f47d8be92e7774f4a84713c5f6676d | 历史SHA + 本步版本派生SHA |
| .growth.newGame.graph.objects | 24418 | 24436 | 24436 | 历史对象数量 |
| .growth.newGame.graph.sha256 | a613b90e7ba05af8f8247d75233f7a106899538995fa39d323b3d2523c0e5acc | f12c62874e8f7533bcb4a9ab7d0ec53eb9987055ef1beb753022ef73aa794f0f | 94197b8565bfc58fb6f63fdafc3e4add4b4405ba178c747c62bc28b9c14631b1 | 历史SHA + 本步版本派生SHA |
| .growth.newGame.snapshot.objects | 11300 | 11299 | 11299 | 历史对象数量 |
| .growth.newGame.snapshot.sha256 | 4c2164105bc63a8fbbe4e28f3fd8e631c31ad46d3afd94bba4b5771d205ad91a | eb8bff798e878f45dccc8e641b6ccdda19910078e4894708d2d4c04adb085431 | 7f88ccfedc6fe44010919cbf86e1866b99e298f2bb6496082b58282da3d98d73 | 历史SHA + 本步版本派生SHA |
| .growth.replayed.graph.objects | 24463 | 24481 | 24481 | 历史对象数量 |
| .growth.replayed.graph.sha256 | 0bf17142fbbdddd1793088986b1bf36ef738d89d713242e9a524049b5a2a7097 | e133623b92ffca8d7b60528e7e812fb3f389575b5df467b3c67b6eee59495207 | bffa1aace4460898b4946dcd2230bdecaa83b0c1c5087a5fef28bceb2596e32b | 历史SHA + 本步版本派生SHA |
| .growth.replayed.snapshot.objects | 11331 | 11330 | 11330 | 历史对象数量 |
| .growth.replayed.snapshot.sha256 | f2d17a6f11ede70eb6aee86cfecdc234a4ebca256ad744ae9f3232ac7bd81651 | eace0c4b9361ed541e0e08494da04f605ac3c1d0c2b94fa541db9d4b6d70f04e | 70d1f7c04749e96b0306ad84cf963e44f9f47d8be92e7774f4a84713c5f6676d | 历史SHA + 本步版本派生SHA |
| .growth.seek.graph.objects | 22086 | 22104 | 22104 | 历史对象数量 |
| .growth.seek.graph.sha256 | 81906770931a4ed01fedb9f0413188c92a5afd44fb0c87f6084373957c32994e | 7f7c72bedbd881add578c7aa40b64286a8577cdae3f8aef5e465c270457287de | 9d8ed28132ea9408f2749543aa8edcf1833e15bdbd14a4f74ffae225edede851 | 历史SHA + 本步版本派生SHA |
| .growth.seek.snapshot.objects | 11300 | 11299 | 11299 | 历史对象数量 |
| .growth.seek.snapshot.sha256 | 4c2164105bc63a8fbbe4e28f3fd8e631c31ad46d3afd94bba4b5771d205ad91a | eb8bff798e878f45dccc8e641b6ccdda19910078e4894708d2d4c04adb085431 | 7f88ccfedc6fe44010919cbf86e1866b99e298f2bb6496082b58282da3d98d73 | 历史SHA + 本步版本派生SHA |
| .growth.summon.graph.objects | 24349 | 24361 | 24361 | 历史对象数量 |
| .growth.summon.graph.sha256 | 3b29cc0e8909ec272ade49166933f73151eac54b7d61a74805810dd2d81c7589 | 71b22fa4abe1cd50d40b2cefe7886d1f1e32e83d29e340e6243c64d63268c43f | 0194ee8e0af67ffe6bc670d3fe065dae1a9eb76fa510a94a63422a09a0808ef0 | 历史SHA + 本步版本派生SHA |
| .growth.summon.snapshot.objects | 5984 | 5977 | 5977 | 历史对象数量 |
| .growth.summon.snapshot.sha256 | 7cad1ec4ffa8f6533ba9ac534279860a2eaf51065e2f8acebda42cbf8fb2c2db | 46d464ba70850624ce4910bf098694ae72817ac3485a73e74986df9353f43c12 | 46d464ba70850624ce4910bf098694ae72817ac3485a73e74986df9353f43c12 | 历史SHA（本步保持） |
| .growth.trap.graph.objects | 24350 | 24362 | 24362 | 历史对象数量 |
| .growth.trap.graph.sha256 | abb232f566d3d75fa04013811059dc63a4d2df9202fb853466df1b5c2c1ca2bd | d9e6f4141af7fe17c4e979101071fb6065bda31d524f710fefbe1323903228ff | 923cbe0843fda5e305c8fbde0a4cdb54b1c70c75d61da2f348cce3952f78c06a | 历史SHA + 本步版本派生SHA |
| .growth.trap.snapshot.objects | 5984 | 5977 | 5977 | 历史对象数量 |
| .growth.trap.snapshot.sha256 | 3818ee50a72f4a63761859847297f20ef7e72a40e924a6eef8bee371e4ec1ad3 | 8e3ce07653304c93ce1dd9a49cccfb386d48971785af6518b5e167356d41f44a | 8e3ce07653304c93ce1dd9a49cccfb386d48971785af6518b5e167356d41f44a | 历史SHA（本步保持） |
| .narrative.blink.graph.sha256 | 6a7b57f6c641d40c57b4bfa1d72d0ad22192772d32f76c51db8c46932603ad34 | 762371a5d75cc9e5dbff7a4668317e4fd6f4fd7bb098eb7183d1e1a0258aab15 | e1a4904936d6328efdc1b7bb45e651533237de3c78c60c365b9256275dc35b2d | 历史SHA + 本步版本派生SHA |
| .narrative.blink.snapshot.sha256 | 28b98d075096ccc9c08b073a066550c4d7198b8d47dc6bc8a527cd454f0cb464 | e44400165b8c316971b1b0e7d2312726b1dec957b304bc4dfa1d4a0cacf55908 | 6f779275da42e8ff47aeb38a3a8c3e1e294db95df5cddd293415f5fbb64b9ae5 | 历史SHA + 本步版本派生SHA |
| .narrative.clone.graph.sha256 | 37a759d1bcdf83921981f64fcdb76ddf21b5d909f5a91b33706b9db4a71f6f48 | d8c7b733e2357dd40d8b22a98c59be311ce099080d1a869b16acbec2732733c9 | 04e2dc733923f204242b63237b6231fb02d86116118438b3da89afd1e7253383 | 历史SHA + 本步版本派生SHA |
| .narrative.combat.graph.sha256 | 410d8b4ec9c6e230b57f8493ee378301708db74d9692e158095e5b10d1e07de8 | 53d4436c35f0f50babec463a0557ee5ffc1ed8f381936ad96715d84ad66cfbfc | df89e5268460868585224beff794ee4d299af676f0e351749bc75862e66acd17 | 历史SHA + 本步版本派生SHA |
| .narrative.combat.snapshot.sha256 | 874b069fef08998224e2c8749c89f161a1657ac3238c958c0e1563c1760da8f9 | 2e658e3705d58e3762836a749ad7db0fd96a4639bae443ba1072650f16a2a517 | 12b08c69c34a89d43ed9c9b779d9b6f3fbf71a57c2a471e9098c07778d29965e | 历史SHA + 本步版本派生SHA |
| .narrative.commands.graph.sha256 | b836cac4ff5baec27df99bb63b1d8aa98e94f80eabcc066e91f3691f7e6dc1fd | 39baa7abd46bbe2900d0ccecf7c5912e480d484d5e6f68acc33f2d4e0d134dfc | 78f2259808d0d301759567e24a66dc6f4aa762ea3ebd8b1a72fbd70c7fc63a47 | 历史SHA + 本步版本派生SHA |
| .narrative.commands.snapshot.sha256 | f22e33bbe3fcea5c93e298d9ac277912e5279bcb0bfe9bbe53ee1ac729997ffc | 6f159e377e85b6ce53c179c65e48934a00e09052443db188befff7d0cb5ae9bb | f281f677f21745a276780256c20632d35b1aae6c05d870aef0538ff64d606ea3 | 历史SHA + 本步版本派生SHA |
| .narrative.continued.graph.sha256 | 7fe8068b2b7a22949c070feeca58aba5791e2073f5591efcc3f94e472457d51a | 52d1e498719b647499c26e8eae9af4f3ff657769a173d08525551b5b59cd2d7a | a09eaae2dd1cc69e628d35661353204cc18070d4673c2e2714d5e8820b92b929 | 历史SHA + 本步版本派生SHA |
| .narrative.continued.snapshot.sha256 | 1bfa726fb5cc34de420fe45e1f9f1b307d386807497ee5f5358f553453694bb1 | a9dc5703aeb7e8f7f1f3a48d1acef457f3304849976ee9e6a1a31fce2bfc27dd | 7904b87a6674e56228d3efa3d17792ba60ae2326892e9c771b0da2046511be4c | 历史SHA + 本步版本派生SHA |
| .narrative.knockback.graph.sha256 | 155e13b5853e69a81e4b589ce2afb03dea18b8a27033d9f8dd8365e4c14af93e | 150ac927e424036196a62246e58ad2a1ff5dbd77c81670759800da854efe529c | 1e41f2715c7582bf0cf4c993802c3cf29f9fe007a06b0cdc80d53aaa9e7cc41f | 历史SHA + 本步版本派生SHA |
| .narrative.level.graph.sha256 | dc90fbfd46da08cb95f368ef2ca27847604c71f7b4c6ae7db3ce858ae5b2628b | 0791b013510d42e53c5a477e980fab37eb45e48a12aa9ac9b5459bda7e870fb3 | fcc65693a10ef99ccd349f92b04971e986535bfbfebece0dac2a221bf1fdd429 | 历史SHA + 本步版本派生SHA |
| .narrative.level.snapshot.sha256 | 0be88e9f67497e5fc0ad70e9bc04f38ff5c3702c7723dd8e7539bfde83e10b44 | 3541212a1fd01e275dc197dc40e5aa10b580c758f66e84c87c8bcbcb5439e9e6 | da7959686fd9ad715f278643e642d398e9a349590091b5a49da1f956a3c6cc56 | 历史SHA + 本步版本派生SHA |
| .narrative.loaded.graph.sha256 | 08aeb5302270747b29e81cf6e181dbe46d825bb14733a44d4a04feff2cef3e77 | 22afd902b9905a50e10ad7b681a3e136d6a08e59c12e53cc09e93759eaf09ae5 | 79c14be547de04f87e9c67677a160406f6e49ee3e14328b91104315f6979dd5b | 历史SHA + 本步版本派生SHA |
| .narrative.loaded.snapshot.sha256 | f22e33bbe3fcea5c93e298d9ac277912e5279bcb0bfe9bbe53ee1ac729997ffc | 6f159e377e85b6ce53c179c65e48934a00e09052443db188befff7d0cb5ae9bb | f281f677f21745a276780256c20632d35b1aae6c05d870aef0538ff64d606ea3 | 历史SHA + 本步版本派生SHA |
| .narrative.newGame.graph.sha256 | 732e3fcf5118630595c343ee44d4091dd91fbbf96ec06d4d59c0aa64ba13a006 | 2f37aaf518d804f9f82c955058aa2ceaf6a27e8e9f260112e7d26c0685b87baf | 2f37aaf518d804f9f82c955058aa2ceaf6a27e8e9f260112e7d26c0685b87baf | 历史SHA（本步保持） |
| .narrative.newGame.snapshot.sha256 | fb55cedb7906c89c7821b96b6a7d704f935fe434d7babea0765d1ecf83f123b3 | fffdc0b7b9aee7c413d19742cc22d2edcadb27b6c88ed1bedd753f9df49993df | 4e7788a89811696392ab1b8d812570b57788cddbdeee21313333e532110d8614 | 历史SHA + 本步版本派生SHA |
| .narrative.replayed.graph.sha256 | 3cc40f97fa792f858ea8ca299e7e5c2c26312a79b0b9795fcb640981708763fd | aa95a40ac3d1b92dfc5cfa94036390e8c6511c945c3c7c10ebb19ba30ae51dcd | 1bbe9ab20e8c5f849bca3b41f32c45ba8bd24081046d89768d2bd94d4dd4dac3 | 历史SHA + 本步版本派生SHA |
| .narrative.replayed.snapshot.sha256 | f22e33bbe3fcea5c93e298d9ac277912e5279bcb0bfe9bbe53ee1ac729997ffc | 6f159e377e85b6ce53c179c65e48934a00e09052443db188befff7d0cb5ae9bb | f281f677f21745a276780256c20632d35b1aae6c05d870aef0538ff64d606ea3 | 历史SHA + 本步版本派生SHA |
| .narrative.seek.graph.sha256 | 39eae3e2b83ac47d0df54bd09af8bdac2a6effa2c6f28eedc5f0c9e1566b07d5 | 1824d9c270dcc22a8efec17255ed52f8c906258dbe276d177a51f21652d0fce4 | 6dcd30177a88fde0fa41be96e0a6e6c54034a1bcb25a89805390c4776e99a353 | 历史SHA + 本步版本派生SHA |
| .narrative.seek.snapshot.sha256 | 48051511d48aa0f394d9454dcb10c5660366081c24ea0e7db8cc739cc490d662 | 3a8ee479bee308bcb7e29db4a54be4083fe19b324860e5979945e5b9c4db1c3b | fd025eaa8d484cee7def173ff8c1bfc8cf767d439378fc8d2a9c08baede1033f | 历史SHA + 本步版本派生SHA |
| .narrative.summon.graph.sha256 | 330cbabdb7a66bf4f56f113a0ccccb2eed5212be5a5f036a3187400a2d3dcfaf | b9d199e20a03b92dbc06db766a327180192b3120ba307ca018c864905180756c | 2b40ed1df01de6377c435f618087c29cdab07e3383b901e5a96f621923d8e79a | 历史SHA + 本步版本派生SHA |
| .narrative.trap.graph.sha256 | ed49cd9e91f9badf46f30d810b998c5a89b291439c967ea33826fe3eb5f4053b | 338a09b99df6071928a141c21dd1c93567d6ddb131fc5d38e190e5c69944d911 | aa0b5ce0afddb284c70680b0742a837c2f345178e8d67927f5a1c5e5faef9d26 | 历史SHA + 本步版本派生SHA |

### C.5 完整对象图：1062叶的版本归因

104图的节点形状/描述符/引用/Map/Set/typed bytes一致。这里只列变化属性的原始投影路径，未列的叶逐值相等；`foundation`为8→9，其余均是版本派生64字符十六进制SHA-256。没有将原始多MB图放入仓库。

| 投影/路径 | 属性 | 开工值 | 当前值 |
| --- | --- | --- | --- |
| p4-1.json: nodes.7632.1.3.4 | prefixDigest | e5c237a7f3ffc0de84b5becd4d9c4f39d3f86ac14dd3e4c0b90cb40a804ed010 | d6bb93d9722b2cc36457135734fc1a5a913c2b3bd45c41926cc7993ff34c3141 |
| p4-1.json: nodes.7635.1.0.4 | foundation | 8 | 9 |
| p4-1.json: nodes.7638.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-1.json: nodes.7639.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-10.json: nodes.17041.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-10.json: nodes.17042.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-10.json: nodes.17043.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-10.json: nodes.17051.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-10.json: nodes.17052.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-10.json: nodes.17053.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-10.json: nodes.17062.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-10.json: nodes.17063.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-10.json: nodes.17064.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-10.json: nodes.17066.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-10.json: nodes.17067.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-10.json: nodes.17075.1.0.4 | foundation | 8 | 9 |
| p4-10.json: nodes.17078.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-10.json: nodes.17079.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-100.json: nodes.20284.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-100.json: nodes.20285.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-100.json: nodes.20286.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-100.json: nodes.20294.1.1.4 | chainDigest | 49592e6576a81f50f3768279081e7f51f9e72ac244024eb5d12b91a2a59fe52b | 28d9015f6b357f4f230fc6d6dd5c47c9818742e1089d40098cbbecf3604510b6 |
| p4-100.json: nodes.20295.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-100.json: nodes.20296.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-100.json: nodes.20305.1.1.4 | chainDigest | 7e26e17424a9976f3ed4a593ce6c49ca69a84239606764b2b6eea4500a92ef14 | 6b88dd8916d39e3eed3f2394ce0d95c562db5f088036cb307f56ef7943755aae |
| p4-100.json: nodes.20306.1.1.4 | root | ce087a39e64596844a84ef11049cec885d25bd7931559616ba588807e31ebcc8 | 544d5c53c88af0e9b5d0dfbc74a55552adc35d17bad7ff4522c29ba033ef589e |
| p4-100.json: nodes.20307.1.1.4 | extensions | 9d76e273848d6302705e3deef783281f00a2bc676eee1e727c7755b280d64ea9 | 538f2cead0346192f1d08b1acfcf1622608ddd90b90a2c34dac143e9796bcd5e |
| p4-100.json: nodes.20315.1.1.4 | chainDigest | 024b942499f945f79480b24b121c09e66456d918d5833d66602f8f0a688816fb | 6c08778f9aaa39b14b41dc7b8329ff4a0fe5e23db7e4d4e798a76d1e26c0c1ce |
| p4-100.json: nodes.20316.1.1.4 | root | 992686d1bbf1d88c2b7639364ea2ee3c85e04c14891b9b1c1861e028c029c2a4 | 7562a361490c00c92b9cb454ec421d8c24cc46a06d561c3ab8fcecec3c0c2429 |
| p4-100.json: nodes.20317.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-100.json: nodes.20319.1.1.4 | root | 3781af0db399318bdd505668808e376b480cc99020540a740995b1ba71f8ef61 | ecfe6baf985bd1c1b35810501ea2d6c55e2007dfee01925103ec603b47829521 |
| p4-100.json: nodes.20320.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-102.json: nodes.40698.1.1.4 | chainDigest | 7c77968096fb88124392b626463ef855a6928e3d442802ceec148ca1815d1135 | fd87fd65ce974c18982ac1951182b68de7d8c72c040e71c8c10bf67deaa71e7a |
| p4-102.json: nodes.40699.1.1.4 | root | 48d357afb3a75668ffbdce50b7f2341069840722bb989d65ca66c04686035e1d | bc2ae0b1e989b467569cda2acc64ae828098e5ec6543792429e97505b564f520 |
| p4-102.json: nodes.40700.1.1.4 | extensions | 917cb017d5f6a7d22cd806981c567bdfd086b66d2312868b71d81ff456d1f95a | 188cd8601338a2bfae7ca32676c8051d8279c8753b8e0f8138f2bdbd81ae413b |
| p4-102.json: nodes.40708.1.1.4 | chainDigest | da859f74b7ff13a7f6f68e2b71f0dd6436e020fd9d1e2a470d40a66d8a8c1778 | e2de4d5eeafcdf5563c81b7ade6f1be518c9224e9ae8f56316c218f8beb58c75 |
| p4-102.json: nodes.40709.1.1.4 | root | 6d026ecf2c1e214792e81f83c5429f42d4c71d4371ce143e23f2873cb1ab5c14 | cdf4b2a98c494417b5f04704a719e3301b8930c17984c7e3a40c7ef4dc7e2923 |
| p4-102.json: nodes.40710.1.1.4 | extensions | 9451ba6ec209d4c97e993b4b13960bdfafc38dd830abf9e9c6236aaa4a6d8358 | d09f2e7c9098ec68c8c77cb75aac853f13c6d1f5c58802aefe8cc49bcefd4ff8 |
| p4-102.json: nodes.40712.1.1.4 | root | 8d570f3cf496592c0db7ab5d03ea83ddf14937fbb81f996729d432235cff1ea1 | 6fe49e9a6b9f542efed4e7b3d75a05b8420463ea0e03ab5c246e6f3815eb256b |
| p4-102.json: nodes.40713.1.1.4 | extensions | 9451ba6ec209d4c97e993b4b13960bdfafc38dd830abf9e9c6236aaa4a6d8358 | d09f2e7c9098ec68c8c77cb75aac853f13c6d1f5c58802aefe8cc49bcefd4ff8 |
| p4-103.json: nodes.18032.1.3.4 | prefixDigest | da859f74b7ff13a7f6f68e2b71f0dd6436e020fd9d1e2a470d40a66d8a8c1778 | e2de4d5eeafcdf5563c81b7ade6f1be518c9224e9ae8f56316c218f8beb58c75 |
| p4-103.json: nodes.18034.1.1.4 | chainDigest | 7c77968096fb88124392b626463ef855a6928e3d442802ceec148ca1815d1135 | fd87fd65ce974c18982ac1951182b68de7d8c72c040e71c8c10bf67deaa71e7a |
| p4-103.json: nodes.18035.1.1.4 | root | 48d357afb3a75668ffbdce50b7f2341069840722bb989d65ca66c04686035e1d | bc2ae0b1e989b467569cda2acc64ae828098e5ec6543792429e97505b564f520 |
| p4-103.json: nodes.18036.1.1.4 | extensions | 917cb017d5f6a7d22cd806981c567bdfd086b66d2312868b71d81ff456d1f95a | 188cd8601338a2bfae7ca32676c8051d8279c8753b8e0f8138f2bdbd81ae413b |
| p4-103.json: nodes.18044.1.1.4 | chainDigest | da859f74b7ff13a7f6f68e2b71f0dd6436e020fd9d1e2a470d40a66d8a8c1778 | e2de4d5eeafcdf5563c81b7ade6f1be518c9224e9ae8f56316c218f8beb58c75 |
| p4-103.json: nodes.18045.1.1.4 | root | 6d026ecf2c1e214792e81f83c5429f42d4c71d4371ce143e23f2873cb1ab5c14 | cdf4b2a98c494417b5f04704a719e3301b8930c17984c7e3a40c7ef4dc7e2923 |
| p4-103.json: nodes.18046.1.1.4 | extensions | 9451ba6ec209d4c97e993b4b13960bdfafc38dd830abf9e9c6236aaa4a6d8358 | d09f2e7c9098ec68c8c77cb75aac853f13c6d1f5c58802aefe8cc49bcefd4ff8 |
| p4-103.json: nodes.18048.1.1.4 | root | 8d570f3cf496592c0db7ab5d03ea83ddf14937fbb81f996729d432235cff1ea1 | 6fe49e9a6b9f542efed4e7b3d75a05b8420463ea0e03ab5c246e6f3815eb256b |
| p4-103.json: nodes.18049.1.1.4 | extensions | 9451ba6ec209d4c97e993b4b13960bdfafc38dd830abf9e9c6236aaa4a6d8358 | d09f2e7c9098ec68c8c77cb75aac853f13c6d1f5c58802aefe8cc49bcefd4ff8 |
| p4-103.json: nodes.18057.1.0.4 | foundation | 8 | 9 |
| p4-103.json: nodes.18064.1.1.4 | root | 5b2f2e3e33d35153052b1e7d1f94df88eebb9dc4d2d6e32c222cd0f67886d9fc | c506c9eaeb1923955a561f6939ca7f5f568d2e490a6767b4cacc703c739506ed |
| p4-103.json: nodes.18065.1.1.4 | extensions | 706cc7b2d42ca9c68154de1c3d0195369637bb6b4b0650f76ffe8453021f934b | 71dc883b1cef76ff0c226ff27882f598cca04e4bb78c784cb1a4d6f7992b0947 |
| p4-11.json: nodes.7632.1.3.4 | prefixDigest | 7158bbadb96b2b7ed36b80a920e04e43dd03b572f8073eefc1a8023b65f96973 | 3c2f2340d3d2226dd7aabf9b3c9f05e6b5003dd2cde4d0d7eb1b97e06dee5368 |
| p4-11.json: nodes.7634.1.1.4 | chainDigest | 7158bbadb96b2b7ed36b80a920e04e43dd03b572f8073eefc1a8023b65f96973 | 3c2f2340d3d2226dd7aabf9b3c9f05e6b5003dd2cde4d0d7eb1b97e06dee5368 |
| p4-11.json: nodes.7635.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-11.json: nodes.7636.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-11.json: nodes.7638.1.1.4 | root | fd15f646a21d8d6892902729de55877f0074842d2c70533f3f01bceae0e43b28 | 60d67166520fd82e3fa5ec325c614e5b770153babc60d72c3495eee9be3403fb |
| p4-11.json: nodes.7639.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-11.json: nodes.7647.1.0.4 | foundation | 8 | 9 |
| p4-11.json: nodes.7650.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-11.json: nodes.7651.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-12.json: nodes.18601.1.1.4 | chainDigest | 2d9b7a57c1cc4577e6ffd005073139edf3b0784bdceeeead21ae97988fc8d502 | 2e0dbccb21b278bf7ff78f7c02fa413ffad2dab2fde034f476801d1ec52202a6 |
| p4-12.json: nodes.18602.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-12.json: nodes.18603.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-12.json: nodes.18606.1.1.4 | root | ff9e889d030941d7068801b1232d9a9bb0da7d7c9542b2ffa625e065276f96cc | d3bae3c974b0564ccaad8452a2fdc459a4756b7d7de2ac7183b3160d50b85fb6 |
| p4-12.json: nodes.18607.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-13.json: nodes.2079.1.3.4 | prefixDigest | 2d9b7a57c1cc4577e6ffd005073139edf3b0784bdceeeead21ae97988fc8d502 | 2e0dbccb21b278bf7ff78f7c02fa413ffad2dab2fde034f476801d1ec52202a6 |
| p4-13.json: nodes.2081.1.1.4 | chainDigest | 2d9b7a57c1cc4577e6ffd005073139edf3b0784bdceeeead21ae97988fc8d502 | 2e0dbccb21b278bf7ff78f7c02fa413ffad2dab2fde034f476801d1ec52202a6 |
| p4-13.json: nodes.2082.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-13.json: nodes.2083.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-13.json: nodes.2086.1.1.4 | root | ff9e889d030941d7068801b1232d9a9bb0da7d7c9542b2ffa625e065276f96cc | d3bae3c974b0564ccaad8452a2fdc459a4756b7d7de2ac7183b3160d50b85fb6 |
| p4-13.json: nodes.2087.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-13.json: nodes.2095.1.0.4 | foundation | 8 | 9 |
| p4-13.json: nodes.2098.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-13.json: nodes.2099.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-14.json: nodes.18601.1.1.4 | chainDigest | 2d9b7a57c1cc4577e6ffd005073139edf3b0784bdceeeead21ae97988fc8d502 | 2e0dbccb21b278bf7ff78f7c02fa413ffad2dab2fde034f476801d1ec52202a6 |
| p4-14.json: nodes.18602.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-14.json: nodes.18603.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-14.json: nodes.18606.1.1.4 | root | ff9e889d030941d7068801b1232d9a9bb0da7d7c9542b2ffa625e065276f96cc | d3bae3c974b0564ccaad8452a2fdc459a4756b7d7de2ac7183b3160d50b85fb6 |
| p4-14.json: nodes.18607.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-16.json: nodes.18637.1.1.4 | chainDigest | daca9fd0c08d142705c712818d7e5ae6d7b0a25a5b86f3788a7858ea4287039e | 2587f0f958266de4ddab3348f4908ce3169da2c847f0232c27642edf7a1ee846 |
| p4-16.json: nodes.18638.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-16.json: nodes.18639.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-16.json: nodes.18648.1.1.4 | chainDigest | dde7eb7eab73eb877b0f7974d11a4f16f42a0dc695457154eb2f7bb0da0eb3b5 | 7a8f83c365e9862ff23629fcebfebf7be9aa8295b9a333162c99bbc0b6022d8a |
| p4-16.json: nodes.18649.1.1.4 | root | 9b68db53719d91ac7d8ff78dc787d6340d3fdf687779796093c145fcfd111866 | 9e64c740e02ad4afb0918974a9ae1e85922a5e93c1b490bab84c21e5fdcfd3b4 |
| p4-16.json: nodes.18650.1.1.4 | extensions | 01174b23eb77cdc7c8a60f38d33e35b532f262536f32b3e239a98851b3864c2a | 002538bb865f3ea571618299138b2394de1d79c94bd0155a72489e24dc6c16c9 |
| p4-16.json: nodes.18658.1.1.4 | chainDigest | df497bb641c0a6d273891c8b132eac42428f500b395e03b652da134d488f60dc | 6eaacc2328612a7ced4da4adadb8192e32ac0613782ba181b02778781810aa92 |
| p4-16.json: nodes.18659.1.1.4 | root | 385b281df2306991f0f23b8ee6b1621c0d78345cfa689149a4eb35ea991f8545 | 90f6a8257fde4d4a75ff5b496f598777282fae3c4313c01bacc62e983df0f69d |
| p4-16.json: nodes.18660.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-16.json: nodes.18662.1.1.4 | root | 3e4649ab7147a9a5bcf3d2e6cafeb108a364098a1af0d0f0a633e887f0a9a71a | 6b66c5fa8c5afc98e01ce033f45209fcd247022cfc4e5cef5c38f0361600f2d7 |
| p4-16.json: nodes.18663.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-17.json: nodes.2117.1.3.4 | prefixDigest | df497bb641c0a6d273891c8b132eac42428f500b395e03b652da134d488f60dc | 6eaacc2328612a7ced4da4adadb8192e32ac0613782ba181b02778781810aa92 |
| p4-17.json: nodes.2119.1.1.4 | chainDigest | daca9fd0c08d142705c712818d7e5ae6d7b0a25a5b86f3788a7858ea4287039e | 2587f0f958266de4ddab3348f4908ce3169da2c847f0232c27642edf7a1ee846 |
| p4-17.json: nodes.2120.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-17.json: nodes.2121.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-17.json: nodes.2130.1.1.4 | chainDigest | dde7eb7eab73eb877b0f7974d11a4f16f42a0dc695457154eb2f7bb0da0eb3b5 | 7a8f83c365e9862ff23629fcebfebf7be9aa8295b9a333162c99bbc0b6022d8a |
| p4-17.json: nodes.2131.1.1.4 | root | 9b68db53719d91ac7d8ff78dc787d6340d3fdf687779796093c145fcfd111866 | 9e64c740e02ad4afb0918974a9ae1e85922a5e93c1b490bab84c21e5fdcfd3b4 |
| p4-17.json: nodes.2132.1.1.4 | extensions | 01174b23eb77cdc7c8a60f38d33e35b532f262536f32b3e239a98851b3864c2a | 002538bb865f3ea571618299138b2394de1d79c94bd0155a72489e24dc6c16c9 |
| p4-17.json: nodes.2140.1.1.4 | chainDigest | df497bb641c0a6d273891c8b132eac42428f500b395e03b652da134d488f60dc | 6eaacc2328612a7ced4da4adadb8192e32ac0613782ba181b02778781810aa92 |
| p4-17.json: nodes.2141.1.1.4 | root | 385b281df2306991f0f23b8ee6b1621c0d78345cfa689149a4eb35ea991f8545 | 90f6a8257fde4d4a75ff5b496f598777282fae3c4313c01bacc62e983df0f69d |
| p4-17.json: nodes.2142.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-17.json: nodes.2144.1.1.4 | root | 3e4649ab7147a9a5bcf3d2e6cafeb108a364098a1af0d0f0a633e887f0a9a71a | 6b66c5fa8c5afc98e01ce033f45209fcd247022cfc4e5cef5c38f0361600f2d7 |
| p4-17.json: nodes.2145.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-17.json: nodes.2153.1.0.4 | foundation | 8 | 9 |
| p4-17.json: nodes.2156.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-17.json: nodes.2157.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-18.json: nodes.18648.1.1.4 | chainDigest | daca9fd0c08d142705c712818d7e5ae6d7b0a25a5b86f3788a7858ea4287039e | 2587f0f958266de4ddab3348f4908ce3169da2c847f0232c27642edf7a1ee846 |
| p4-18.json: nodes.18649.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-18.json: nodes.18650.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-18.json: nodes.18659.1.1.4 | chainDigest | dde7eb7eab73eb877b0f7974d11a4f16f42a0dc695457154eb2f7bb0da0eb3b5 | 7a8f83c365e9862ff23629fcebfebf7be9aa8295b9a333162c99bbc0b6022d8a |
| p4-18.json: nodes.18660.1.1.4 | root | 9b68db53719d91ac7d8ff78dc787d6340d3fdf687779796093c145fcfd111866 | 9e64c740e02ad4afb0918974a9ae1e85922a5e93c1b490bab84c21e5fdcfd3b4 |
| p4-18.json: nodes.18661.1.1.4 | extensions | 01174b23eb77cdc7c8a60f38d33e35b532f262536f32b3e239a98851b3864c2a | 002538bb865f3ea571618299138b2394de1d79c94bd0155a72489e24dc6c16c9 |
| p4-18.json: nodes.18669.1.1.4 | chainDigest | df497bb641c0a6d273891c8b132eac42428f500b395e03b652da134d488f60dc | 6eaacc2328612a7ced4da4adadb8192e32ac0613782ba181b02778781810aa92 |
| p4-18.json: nodes.18670.1.1.4 | root | 385b281df2306991f0f23b8ee6b1621c0d78345cfa689149a4eb35ea991f8545 | 90f6a8257fde4d4a75ff5b496f598777282fae3c4313c01bacc62e983df0f69d |
| p4-18.json: nodes.18671.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-18.json: nodes.18673.1.1.4 | root | 3e4649ab7147a9a5bcf3d2e6cafeb108a364098a1af0d0f0a633e887f0a9a71a | 6b66c5fa8c5afc98e01ce033f45209fcd247022cfc4e5cef5c38f0361600f2d7 |
| p4-18.json: nodes.18674.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-2.json: nodes.17044.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-2.json: nodes.17045.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-2.json: nodes.17046.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-2.json: nodes.17054.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-2.json: nodes.17055.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-2.json: nodes.17056.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-2.json: nodes.17065.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-2.json: nodes.17066.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-2.json: nodes.17067.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-2.json: nodes.17069.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-2.json: nodes.17070.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-20.json: nodes.18692.1.1.4 | chainDigest | daca9fd0c08d142705c712818d7e5ae6d7b0a25a5b86f3788a7858ea4287039e | 2587f0f958266de4ddab3348f4908ce3169da2c847f0232c27642edf7a1ee846 |
| p4-20.json: nodes.18693.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-20.json: nodes.18694.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-20.json: nodes.18703.1.1.4 | chainDigest | dde7eb7eab73eb877b0f7974d11a4f16f42a0dc695457154eb2f7bb0da0eb3b5 | 7a8f83c365e9862ff23629fcebfebf7be9aa8295b9a333162c99bbc0b6022d8a |
| p4-20.json: nodes.18704.1.1.4 | root | 9b68db53719d91ac7d8ff78dc787d6340d3fdf687779796093c145fcfd111866 | 9e64c740e02ad4afb0918974a9ae1e85922a5e93c1b490bab84c21e5fdcfd3b4 |
| p4-20.json: nodes.18705.1.1.4 | extensions | 01174b23eb77cdc7c8a60f38d33e35b532f262536f32b3e239a98851b3864c2a | 002538bb865f3ea571618299138b2394de1d79c94bd0155a72489e24dc6c16c9 |
| p4-20.json: nodes.18713.1.1.4 | chainDigest | df497bb641c0a6d273891c8b132eac42428f500b395e03b652da134d488f60dc | 6eaacc2328612a7ced4da4adadb8192e32ac0613782ba181b02778781810aa92 |
| p4-20.json: nodes.18714.1.1.4 | root | 385b281df2306991f0f23b8ee6b1621c0d78345cfa689149a4eb35ea991f8545 | 90f6a8257fde4d4a75ff5b496f598777282fae3c4313c01bacc62e983df0f69d |
| p4-20.json: nodes.18715.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-20.json: nodes.18717.1.1.4 | root | 3e4649ab7147a9a5bcf3d2e6cafeb108a364098a1af0d0f0a633e887f0a9a71a | 6b66c5fa8c5afc98e01ce033f45209fcd247022cfc4e5cef5c38f0361600f2d7 |
| p4-20.json: nodes.18718.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-22.json: nodes.18693.1.1.4 | chainDigest | daca9fd0c08d142705c712818d7e5ae6d7b0a25a5b86f3788a7858ea4287039e | 2587f0f958266de4ddab3348f4908ce3169da2c847f0232c27642edf7a1ee846 |
| p4-22.json: nodes.18694.1.1.4 | root | 19e1ba03017d8c6ca25d64f19f1643ed77c0161a6a32f0bd5d2ad57d019b24a9 | 741cfbb3af93ca1fcc87c29fa110c9960cb484c3d5475ef05863e8bd01fb87bd |
| p4-22.json: nodes.18695.1.1.4 | extensions | 8d80ddce42c3811fc550bdc98fc47d2ee227fea94990985ef56ca8704e5c294c | 58424a659abe9ad10f90f0c370694b6c9ae6a25d1912f2e4736f4d82a1f779bd |
| p4-22.json: nodes.18704.1.1.4 | chainDigest | dde7eb7eab73eb877b0f7974d11a4f16f42a0dc695457154eb2f7bb0da0eb3b5 | 7a8f83c365e9862ff23629fcebfebf7be9aa8295b9a333162c99bbc0b6022d8a |
| p4-22.json: nodes.18705.1.1.4 | root | 9b68db53719d91ac7d8ff78dc787d6340d3fdf687779796093c145fcfd111866 | 9e64c740e02ad4afb0918974a9ae1e85922a5e93c1b490bab84c21e5fdcfd3b4 |
| p4-22.json: nodes.18706.1.1.4 | extensions | 01174b23eb77cdc7c8a60f38d33e35b532f262536f32b3e239a98851b3864c2a | 002538bb865f3ea571618299138b2394de1d79c94bd0155a72489e24dc6c16c9 |
| p4-22.json: nodes.18714.1.1.4 | chainDigest | df497bb641c0a6d273891c8b132eac42428f500b395e03b652da134d488f60dc | 6eaacc2328612a7ced4da4adadb8192e32ac0613782ba181b02778781810aa92 |
| p4-22.json: nodes.18715.1.1.4 | root | 385b281df2306991f0f23b8ee6b1621c0d78345cfa689149a4eb35ea991f8545 | 90f6a8257fde4d4a75ff5b496f598777282fae3c4313c01bacc62e983df0f69d |
| p4-22.json: nodes.18716.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-22.json: nodes.18718.1.1.4 | root | 3e4649ab7147a9a5bcf3d2e6cafeb108a364098a1af0d0f0a633e887f0a9a71a | 6b66c5fa8c5afc98e01ce033f45209fcd247022cfc4e5cef5c38f0361600f2d7 |
| p4-22.json: nodes.18719.1.1.4 | extensions | 797a08bcd6f4db6e21c3d69eec5d8a93db08bc2c9dec2ec4a1e703602b2f9498 | 1efb754a18efca26995bf53f7b1f4369c4b91b7efe6353bdf1c5eec5555578f1 |
| p4-24.json: nodes.38960.1.1.4 | chainDigest | 78fb8121c3c9b9b55b630a7497223ebdef19b51a30fbef5d7f51650df39cc1b0 | 93d01217c807be245d5bc34916252eefa729a546d0f0ba5e9a4736f8e1705629 |
| p4-24.json: nodes.38961.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-24.json: nodes.38962.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-24.json: nodes.38964.1.1.4 | root | 47f08f8f54cc474fb73792f751260447383998017cdc4d46a0f0ca891cb7e6b5 | c191b14320e5c63bea9400d2ac38d9ab4e7c790992bd4089daf92d405e7bfcce |
| p4-24.json: nodes.38965.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-25.json: nodes.17703.1.3.4 | prefixDigest | 78fb8121c3c9b9b55b630a7497223ebdef19b51a30fbef5d7f51650df39cc1b0 | 93d01217c807be245d5bc34916252eefa729a546d0f0ba5e9a4736f8e1705629 |
| p4-25.json: nodes.17705.1.1.4 | chainDigest | 78fb8121c3c9b9b55b630a7497223ebdef19b51a30fbef5d7f51650df39cc1b0 | 93d01217c807be245d5bc34916252eefa729a546d0f0ba5e9a4736f8e1705629 |
| p4-25.json: nodes.17706.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-25.json: nodes.17707.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-25.json: nodes.17709.1.1.4 | root | 47f08f8f54cc474fb73792f751260447383998017cdc4d46a0f0ca891cb7e6b5 | c191b14320e5c63bea9400d2ac38d9ab4e7c790992bd4089daf92d405e7bfcce |
| p4-25.json: nodes.17710.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-25.json: nodes.17718.1.0.4 | foundation | 8 | 9 |
| p4-25.json: nodes.17721.1.1.4 | root | 5eb2e23140667b044cfcad7bb6d94bc5de060ba99e4be75668429d060efdf455 | ff36da5b03b5c3207aab08c00c71f59786d405f7826af4855fe5682309865e81 |
| p4-25.json: nodes.17722.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-26.json: nodes.18476.1.1.4 | chainDigest | 790e06ef8072b7a2c69fe841fdd9f23db2c86beaaec9df1bf077423c5bc6ed5f | 1ebcdd0f3045ad96be40b6eaf8bd55bc8da73f421933048449705fc4b24e1162 |
| p4-26.json: nodes.18477.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-26.json: nodes.18478.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-26.json: nodes.18480.1.1.4 | root | 0628e6049b3a291d4166d12c633ab6396f1f42b19a467aa9f588c0fe1c9fcddf | d9fe165a208bdabac841b9bb8e457d12a6fdbb4ef13a9215ab0861c13efc0628 |
| p4-26.json: nodes.18481.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-27.json: nodes.7663.1.3.4 | prefixDigest | 790e06ef8072b7a2c69fe841fdd9f23db2c86beaaec9df1bf077423c5bc6ed5f | 1ebcdd0f3045ad96be40b6eaf8bd55bc8da73f421933048449705fc4b24e1162 |
| p4-27.json: nodes.7665.1.1.4 | chainDigest | 790e06ef8072b7a2c69fe841fdd9f23db2c86beaaec9df1bf077423c5bc6ed5f | 1ebcdd0f3045ad96be40b6eaf8bd55bc8da73f421933048449705fc4b24e1162 |
| p4-27.json: nodes.7666.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-27.json: nodes.7667.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-27.json: nodes.7669.1.1.4 | root | 0628e6049b3a291d4166d12c633ab6396f1f42b19a467aa9f588c0fe1c9fcddf | d9fe165a208bdabac841b9bb8e457d12a6fdbb4ef13a9215ab0861c13efc0628 |
| p4-27.json: nodes.7670.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-27.json: nodes.7678.1.0.4 | foundation | 8 | 9 |
| p4-27.json: nodes.7683.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-27.json: nodes.7684.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-28.json: nodes.18480.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-28.json: nodes.18481.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-28.json: nodes.18482.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-28.json: nodes.18490.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-28.json: nodes.18491.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-28.json: nodes.18492.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-28.json: nodes.18500.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-28.json: nodes.18501.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-28.json: nodes.18502.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-28.json: nodes.18511.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-28.json: nodes.18512.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-28.json: nodes.18513.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-28.json: nodes.18515.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-28.json: nodes.18516.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-29.json: nodes.7663.1.3.4 | prefixDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-29.json: nodes.7665.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-29.json: nodes.7666.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-29.json: nodes.7667.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-29.json: nodes.7675.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-29.json: nodes.7676.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-29.json: nodes.7677.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-29.json: nodes.7685.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-29.json: nodes.7686.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-29.json: nodes.7687.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-29.json: nodes.7696.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-29.json: nodes.7697.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-29.json: nodes.7698.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-29.json: nodes.7700.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-29.json: nodes.7701.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-29.json: nodes.7709.1.0.4 | foundation | 8 | 9 |
| p4-29.json: nodes.7714.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-29.json: nodes.7715.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-3.json: nodes.7632.1.3.4 | prefixDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-3.json: nodes.7634.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-3.json: nodes.7635.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-3.json: nodes.7636.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-3.json: nodes.7644.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-3.json: nodes.7645.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-3.json: nodes.7646.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-3.json: nodes.7655.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-3.json: nodes.7656.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-3.json: nodes.7657.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-3.json: nodes.7659.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-3.json: nodes.7660.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-3.json: nodes.7668.1.0.4 | foundation | 8 | 9 |
| p4-3.json: nodes.7671.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-3.json: nodes.7672.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-30.json: nodes.18476.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-30.json: nodes.18477.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-30.json: nodes.18478.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-30.json: nodes.18486.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-30.json: nodes.18487.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-30.json: nodes.18488.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-30.json: nodes.18496.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-30.json: nodes.18497.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-30.json: nodes.18498.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-30.json: nodes.18507.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-30.json: nodes.18508.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-30.json: nodes.18509.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-30.json: nodes.18511.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-30.json: nodes.18512.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-31.json: nodes.7663.1.3.4 | prefixDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-31.json: nodes.7665.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-31.json: nodes.7666.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-31.json: nodes.7667.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-31.json: nodes.7675.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-31.json: nodes.7676.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-31.json: nodes.7677.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-31.json: nodes.7685.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-31.json: nodes.7686.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-31.json: nodes.7687.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-31.json: nodes.7696.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-31.json: nodes.7697.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-31.json: nodes.7698.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-31.json: nodes.7700.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-31.json: nodes.7701.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-31.json: nodes.7709.1.0.4 | foundation | 8 | 9 |
| p4-31.json: nodes.7714.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-31.json: nodes.7715.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-32.json: nodes.18480.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-32.json: nodes.18481.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-32.json: nodes.18482.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-32.json: nodes.18490.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-32.json: nodes.18491.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-32.json: nodes.18492.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-32.json: nodes.18500.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-32.json: nodes.18501.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-32.json: nodes.18502.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-32.json: nodes.18511.1.1.4 | chainDigest | 8521ed631f34d36f82028812c477118290caad0d29afa6aaf4e21bf6a8ef6d05 | b225539bf0af98183f5b7ceb51078e6ea65def86e1591a7b44a818c62a55ff75 |
| p4-32.json: nodes.18512.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-32.json: nodes.18513.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-32.json: nodes.18521.1.1.4 | chainDigest | f79174b233fd01a26eb7154305ebd1e5a5ef0e9fafca30dbb93e1de5af962b6d | f7894f3d9396eb098d9dc97110d1788e64c0bf454e0c9cc93441ebb44738e859 |
| p4-32.json: nodes.18522.1.1.4 | root | dc877670aaccd680466ff9c0053b2c1c1c43cd3216f724aa4f470ae03becc72c | ff7c995f753a8aede082893f8b90e116b1170739b5d4924f9119bd0349ac716e |
| p4-32.json: nodes.18523.1.1.4 | extensions | 899268f51689ec0e28b0c84b9befeec335977da1aa0da03bbe55ee23c5fb396b | a2198119f58318ce0ef11d89475ce71891a21ca086dee98e437885b30e0f2f70 |
| p4-32.json: nodes.18525.1.1.4 | root | 321bbddffe06c845fa69fec97c73647bb6a3450060d078d84e7c8c5dc66aecac | 6eee053be1add8d1a9fed5edbceda2fb7757169bfca9a1d3f622b1483b5637ec |
| p4-32.json: nodes.18526.1.1.4 | extensions | 899268f51689ec0e28b0c84b9befeec335977da1aa0da03bbe55ee23c5fb396b | a2198119f58318ce0ef11d89475ce71891a21ca086dee98e437885b30e0f2f70 |
| p4-33.json: nodes.7663.1.3.4 | prefixDigest | f79174b233fd01a26eb7154305ebd1e5a5ef0e9fafca30dbb93e1de5af962b6d | f7894f3d9396eb098d9dc97110d1788e64c0bf454e0c9cc93441ebb44738e859 |
| p4-33.json: nodes.7665.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-33.json: nodes.7666.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-33.json: nodes.7667.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-33.json: nodes.7675.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-33.json: nodes.7676.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-33.json: nodes.7677.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-33.json: nodes.7685.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-33.json: nodes.7686.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-33.json: nodes.7687.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-33.json: nodes.7696.1.1.4 | chainDigest | 8521ed631f34d36f82028812c477118290caad0d29afa6aaf4e21bf6a8ef6d05 | b225539bf0af98183f5b7ceb51078e6ea65def86e1591a7b44a818c62a55ff75 |
| p4-33.json: nodes.7697.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-33.json: nodes.7698.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-33.json: nodes.7706.1.1.4 | chainDigest | f79174b233fd01a26eb7154305ebd1e5a5ef0e9fafca30dbb93e1de5af962b6d | f7894f3d9396eb098d9dc97110d1788e64c0bf454e0c9cc93441ebb44738e859 |
| p4-33.json: nodes.7707.1.1.4 | root | dc877670aaccd680466ff9c0053b2c1c1c43cd3216f724aa4f470ae03becc72c | ff7c995f753a8aede082893f8b90e116b1170739b5d4924f9119bd0349ac716e |
| p4-33.json: nodes.7708.1.1.4 | extensions | 899268f51689ec0e28b0c84b9befeec335977da1aa0da03bbe55ee23c5fb396b | a2198119f58318ce0ef11d89475ce71891a21ca086dee98e437885b30e0f2f70 |
| p4-33.json: nodes.7710.1.1.4 | root | 321bbddffe06c845fa69fec97c73647bb6a3450060d078d84e7c8c5dc66aecac | 6eee053be1add8d1a9fed5edbceda2fb7757169bfca9a1d3f622b1483b5637ec |
| p4-33.json: nodes.7711.1.1.4 | extensions | 899268f51689ec0e28b0c84b9befeec335977da1aa0da03bbe55ee23c5fb396b | a2198119f58318ce0ef11d89475ce71891a21ca086dee98e437885b30e0f2f70 |
| p4-33.json: nodes.7719.1.0.4 | foundation | 8 | 9 |
| p4-33.json: nodes.7724.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-33.json: nodes.7725.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-34.json: nodes.18481.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-34.json: nodes.18482.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-34.json: nodes.18483.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-34.json: nodes.18491.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-34.json: nodes.18492.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-34.json: nodes.18493.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-34.json: nodes.18501.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-34.json: nodes.18502.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-34.json: nodes.18503.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-34.json: nodes.18512.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-34.json: nodes.18513.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-34.json: nodes.18514.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-34.json: nodes.18516.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-34.json: nodes.18517.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-34.json: nodes.18525.1.0.4 | foundation | 8 | 9 |
| p4-34.json: nodes.18530.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-34.json: nodes.18531.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-35.json: nodes.7663.1.3.4 | prefixDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-35.json: nodes.7665.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-35.json: nodes.7666.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-35.json: nodes.7667.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-35.json: nodes.7675.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-35.json: nodes.7676.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-35.json: nodes.7677.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-35.json: nodes.7685.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-35.json: nodes.7686.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-35.json: nodes.7687.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-35.json: nodes.7696.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-35.json: nodes.7697.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-35.json: nodes.7698.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-35.json: nodes.7700.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-35.json: nodes.7701.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-35.json: nodes.7709.1.0.4 | foundation | 8 | 9 |
| p4-35.json: nodes.7714.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-35.json: nodes.7715.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-36.json: nodes.18477.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-36.json: nodes.18478.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-36.json: nodes.18479.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-36.json: nodes.18487.1.1.4 | chainDigest | 81d050b0af765e3e71046c98b0171dfc4728c5b80a8391d55adf5edc3eaf63c7 | 661c577ad182312708aa0733276fadf671a50501ce9e3be951fd0f5e520ceb05 |
| p4-36.json: nodes.18488.1.1.4 | root | 6904f0eccccdc88df935dcc8df5f48bc91ed2a06e3a00eb5d88c7c3af90965bd | d7b688e063110bdb41c2b92073ae5cbfc64d04f2a1acee122b2280fffd59aaf3 |
| p4-36.json: nodes.18489.1.1.4 | extensions | 05b65aa521f5b6c0388298414bec82bd43efad208889e1998993c053d589693a | 7b86a2e586dcbe2123c534f37ce0979dc2345e62623364eced53ccf0dcb783b9 |
| p4-36.json: nodes.18497.1.1.4 | chainDigest | 4a4f4c7439597501502b191381a0306ea3626c0bce36650414bed864a4d73381 | 08d3d5cbe25e36a78ad7679739b8749d42f680d89e4a451ab4be947bed848416 |
| p4-36.json: nodes.18498.1.1.4 | root | 763865743112d9287a7a4eba8b9e5e36ca3bd9ceae69f8a4748b642ef667305a | 5a79fef91413818b7ccda792eb035ea79dead5e783fcfbb895bbb25ac9c67693 |
| p4-36.json: nodes.18499.1.1.4 | extensions | 944ae6cd86c386dcf1e404ccffc9444d26906011d9f5f769d5cb591ab5666285 | d23ca53ee14482b66ed42e8d8fa80d17e213959c4eaea03be8bf1bee9d09710b |
| p4-36.json: nodes.18508.1.1.4 | chainDigest | 56d694813cbb280473c2c77bd5b40e6129c4e719fb1aeb214513e7af81bff9e0 | def5959e165bf19045767649ffe6c1bf3e29809fb18c7470b9bed8779d976a74 |
| p4-36.json: nodes.18509.1.1.4 | root | 16e3fc5435673062bdc7d8428dc055486ffe719f2dd8f3c9e1bcd0df6ade2ee5 | 82a45dbbb3bddbf14ead4029451c2b316dc3458fd3f373f845681af79cda5dea |
| p4-36.json: nodes.18510.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-36.json: nodes.18512.1.1.4 | root | a437260ff3160026ba68202dad2d2ce72b2f47e5a01e58ef93acd5502c16f460 | 93b39ee4475411767cf7bd7e665ce9f03c0ebca2332b0eaf7bb8b3e843e4b075 |
| p4-36.json: nodes.18513.1.1.4 | extensions | 13867cc55663e906eb00a0af9cd76088e7957ce3e9ad701bb9ad5a8b6d6d9923 | eab596789d3784023547ab3afa63479496dda67c753617600cad3d9abd1e4c3f |
| p4-36.json: nodes.18521.1.0.4 | foundation | 8 | 9 |
| p4-36.json: nodes.18526.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-36.json: nodes.18527.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-37.json: nodes.7663.1.3.4 | prefixDigest | 790e06ef8072b7a2c69fe841fdd9f23db2c86beaaec9df1bf077423c5bc6ed5f | 1ebcdd0f3045ad96be40b6eaf8bd55bc8da73f421933048449705fc4b24e1162 |
| p4-37.json: nodes.7665.1.1.4 | chainDigest | 790e06ef8072b7a2c69fe841fdd9f23db2c86beaaec9df1bf077423c5bc6ed5f | 1ebcdd0f3045ad96be40b6eaf8bd55bc8da73f421933048449705fc4b24e1162 |
| p4-37.json: nodes.7666.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-37.json: nodes.7667.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-37.json: nodes.7669.1.1.4 | root | 0628e6049b3a291d4166d12c633ab6396f1f42b19a467aa9f588c0fe1c9fcddf | d9fe165a208bdabac841b9bb8e457d12a6fdbb4ef13a9215ab0861c13efc0628 |
| p4-37.json: nodes.7670.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-37.json: nodes.7678.1.0.4 | foundation | 8 | 9 |
| p4-37.json: nodes.7683.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-37.json: nodes.7684.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-38.json: nodes.20058.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-38.json: nodes.20059.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-38.json: nodes.20060.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-38.json: nodes.20068.1.1.4 | chainDigest | 191d6535b9043e868757381f3e1cd64da74628c82138fc75b771f30de68fe985 | c250a05d6e3e210d432fc34c9acb256abb1777e1d89571f08220ae04731fb4de |
| p4-38.json: nodes.20069.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-38.json: nodes.20070.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-38.json: nodes.20073.1.1.4 | root | 8a04d8100d7aefb8dddc2b8f4d546042a52e5bf14b45df21c2695853f2410bc7 | 9ebd5aa10ea38395c8892b774051eaa8b7f805cf3a94e743dcaa045980a87be8 |
| p4-38.json: nodes.20074.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-39.json: nodes.2131.1.3.4 | prefixDigest | 191d6535b9043e868757381f3e1cd64da74628c82138fc75b771f30de68fe985 | c250a05d6e3e210d432fc34c9acb256abb1777e1d89571f08220ae04731fb4de |
| p4-39.json: nodes.2133.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-39.json: nodes.2134.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-39.json: nodes.2135.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-39.json: nodes.2143.1.1.4 | chainDigest | 191d6535b9043e868757381f3e1cd64da74628c82138fc75b771f30de68fe985 | c250a05d6e3e210d432fc34c9acb256abb1777e1d89571f08220ae04731fb4de |
| p4-39.json: nodes.2144.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-39.json: nodes.2145.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-39.json: nodes.2148.1.1.4 | root | 8a04d8100d7aefb8dddc2b8f4d546042a52e5bf14b45df21c2695853f2410bc7 | 9ebd5aa10ea38395c8892b774051eaa8b7f805cf3a94e743dcaa045980a87be8 |
| p4-39.json: nodes.2149.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-39.json: nodes.2157.1.0.4 | foundation | 8 | 9 |
| p4-39.json: nodes.2162.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-39.json: nodes.2163.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-4.json: nodes.17040.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-4.json: nodes.17041.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-4.json: nodes.17042.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-4.json: nodes.17050.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-4.json: nodes.17051.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-4.json: nodes.17052.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-4.json: nodes.17061.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-4.json: nodes.17062.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-4.json: nodes.17063.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-4.json: nodes.17065.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-4.json: nodes.17066.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-40.json: nodes.20058.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-40.json: nodes.20059.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-40.json: nodes.20060.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-40.json: nodes.20068.1.1.4 | chainDigest | 191d6535b9043e868757381f3e1cd64da74628c82138fc75b771f30de68fe985 | c250a05d6e3e210d432fc34c9acb256abb1777e1d89571f08220ae04731fb4de |
| p4-40.json: nodes.20069.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-40.json: nodes.20070.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-40.json: nodes.20073.1.1.4 | root | 8a04d8100d7aefb8dddc2b8f4d546042a52e5bf14b45df21c2695853f2410bc7 | 9ebd5aa10ea38395c8892b774051eaa8b7f805cf3a94e743dcaa045980a87be8 |
| p4-40.json: nodes.20074.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-42.json: nodes.20094.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-42.json: nodes.20095.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-42.json: nodes.20096.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-42.json: nodes.20104.1.1.4 | chainDigest | c73840ffd5b38307007e8ae9e12c6e833e771dfb86c5ec8a05dd90823c72c4ef | 5d5f1a92d276e2bfaf5bd822f8c824eea13477063a7d76d26f180245008c5111 |
| p4-42.json: nodes.20105.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-42.json: nodes.20106.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-42.json: nodes.20115.1.1.4 | chainDigest | 5ac632df8fcf5716a41eca15b1db255b8d84dcb627892439c95fe879ab308d9f | ae8d58d987f0bd2d0d1defe6a222398168f53d61172c3f36261421ce1a315a6b |
| p4-42.json: nodes.20116.1.1.4 | root | 51a15f8f014a0fe1c10947802e3f414885051ba00f0967e1741eb72d7dbf3584 | ed02ac7e7931f2da9564c26821479e3d5f10d8316396b7519968500a83516df7 |
| p4-42.json: nodes.20117.1.1.4 | extensions | da066f4d93dd8af1afd1dde05f5c01f3e56552adff98bcc7672e5a43835b2db1 | 9d90bb0dd917aedcdd49028d65cbdb7364b0ecf5b9a0d82bd90199d316c34fe7 |
| p4-42.json: nodes.20125.1.1.4 | chainDigest | 68f123fb15d3b695d2b274ee90fd419aebd8da9415d7f109e47de717f0974764 | e2468686b071b7f657f59f2bb4aa1854e7e399755f0b6050ee28abc18f6ff1a3 |
| p4-42.json: nodes.20126.1.1.4 | root | 5218a37536df466b6e30304fb758e56a5a484f7a0e68a11020f34937475e0013 | 6bb77f6ee1d52d5187af3b7efdf4a516584974da2fd25ae31a78300860d0918b |
| p4-42.json: nodes.20127.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-42.json: nodes.20129.1.1.4 | root | 8ac2b7faa7c379e590a819f8c82c9e09da4f6c96c2af7df5972eaea831ce4b25 | 0b45cfd505ba3edc8161f7d76d7b50ce792126a979f71842e453d07c6daebc48 |
| p4-42.json: nodes.20130.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-43.json: nodes.2169.1.3.4 | prefixDigest | 68f123fb15d3b695d2b274ee90fd419aebd8da9415d7f109e47de717f0974764 | e2468686b071b7f657f59f2bb4aa1854e7e399755f0b6050ee28abc18f6ff1a3 |
| p4-43.json: nodes.2171.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-43.json: nodes.2172.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-43.json: nodes.2173.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-43.json: nodes.2181.1.1.4 | chainDigest | c73840ffd5b38307007e8ae9e12c6e833e771dfb86c5ec8a05dd90823c72c4ef | 5d5f1a92d276e2bfaf5bd822f8c824eea13477063a7d76d26f180245008c5111 |
| p4-43.json: nodes.2182.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-43.json: nodes.2183.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-43.json: nodes.2192.1.1.4 | chainDigest | 5ac632df8fcf5716a41eca15b1db255b8d84dcb627892439c95fe879ab308d9f | ae8d58d987f0bd2d0d1defe6a222398168f53d61172c3f36261421ce1a315a6b |
| p4-43.json: nodes.2193.1.1.4 | root | 51a15f8f014a0fe1c10947802e3f414885051ba00f0967e1741eb72d7dbf3584 | ed02ac7e7931f2da9564c26821479e3d5f10d8316396b7519968500a83516df7 |
| p4-43.json: nodes.2194.1.1.4 | extensions | da066f4d93dd8af1afd1dde05f5c01f3e56552adff98bcc7672e5a43835b2db1 | 9d90bb0dd917aedcdd49028d65cbdb7364b0ecf5b9a0d82bd90199d316c34fe7 |
| p4-43.json: nodes.2202.1.1.4 | chainDigest | 68f123fb15d3b695d2b274ee90fd419aebd8da9415d7f109e47de717f0974764 | e2468686b071b7f657f59f2bb4aa1854e7e399755f0b6050ee28abc18f6ff1a3 |
| p4-43.json: nodes.2203.1.1.4 | root | 5218a37536df466b6e30304fb758e56a5a484f7a0e68a11020f34937475e0013 | 6bb77f6ee1d52d5187af3b7efdf4a516584974da2fd25ae31a78300860d0918b |
| p4-43.json: nodes.2204.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-43.json: nodes.2206.1.1.4 | root | 8ac2b7faa7c379e590a819f8c82c9e09da4f6c96c2af7df5972eaea831ce4b25 | 0b45cfd505ba3edc8161f7d76d7b50ce792126a979f71842e453d07c6daebc48 |
| p4-43.json: nodes.2207.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-43.json: nodes.2215.1.0.4 | foundation | 8 | 9 |
| p4-43.json: nodes.2220.1.1.4 | root | 89370fe8dd5cfc950d105c3a5c2a6c506591228d87fe429a5dee09090b176bc9 | e6466842040950ada734297422b15c127f634189762bd87592112fd467638005 |
| p4-43.json: nodes.2221.1.1.4 | extensions | 6c943c6809edfa14425556a0a60d76df864b4e89c89bc1f0146b1ec80997883b | d9eb898b985f500d53bc3613d3c5ac34f982d2837203bcfebe859130751c8ab6 |
| p4-44.json: nodes.20126.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-44.json: nodes.20127.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-44.json: nodes.20128.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-44.json: nodes.20136.1.1.4 | chainDigest | c73840ffd5b38307007e8ae9e12c6e833e771dfb86c5ec8a05dd90823c72c4ef | 5d5f1a92d276e2bfaf5bd822f8c824eea13477063a7d76d26f180245008c5111 |
| p4-44.json: nodes.20137.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-44.json: nodes.20138.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-44.json: nodes.20147.1.1.4 | chainDigest | 5ac632df8fcf5716a41eca15b1db255b8d84dcb627892439c95fe879ab308d9f | ae8d58d987f0bd2d0d1defe6a222398168f53d61172c3f36261421ce1a315a6b |
| p4-44.json: nodes.20148.1.1.4 | root | 51a15f8f014a0fe1c10947802e3f414885051ba00f0967e1741eb72d7dbf3584 | ed02ac7e7931f2da9564c26821479e3d5f10d8316396b7519968500a83516df7 |
| p4-44.json: nodes.20149.1.1.4 | extensions | da066f4d93dd8af1afd1dde05f5c01f3e56552adff98bcc7672e5a43835b2db1 | 9d90bb0dd917aedcdd49028d65cbdb7364b0ecf5b9a0d82bd90199d316c34fe7 |
| p4-44.json: nodes.20157.1.1.4 | chainDigest | 68f123fb15d3b695d2b274ee90fd419aebd8da9415d7f109e47de717f0974764 | e2468686b071b7f657f59f2bb4aa1854e7e399755f0b6050ee28abc18f6ff1a3 |
| p4-44.json: nodes.20158.1.1.4 | root | 5218a37536df466b6e30304fb758e56a5a484f7a0e68a11020f34937475e0013 | 6bb77f6ee1d52d5187af3b7efdf4a516584974da2fd25ae31a78300860d0918b |
| p4-44.json: nodes.20159.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-44.json: nodes.20161.1.1.4 | root | 8ac2b7faa7c379e590a819f8c82c9e09da4f6c96c2af7df5972eaea831ce4b25 | 0b45cfd505ba3edc8161f7d76d7b50ce792126a979f71842e453d07c6daebc48 |
| p4-44.json: nodes.20162.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-46.json: nodes.20254.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-46.json: nodes.20255.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-46.json: nodes.20256.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-46.json: nodes.20264.1.1.4 | chainDigest | c73840ffd5b38307007e8ae9e12c6e833e771dfb86c5ec8a05dd90823c72c4ef | 5d5f1a92d276e2bfaf5bd822f8c824eea13477063a7d76d26f180245008c5111 |
| p4-46.json: nodes.20265.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-46.json: nodes.20266.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-46.json: nodes.20275.1.1.4 | chainDigest | 5ac632df8fcf5716a41eca15b1db255b8d84dcb627892439c95fe879ab308d9f | ae8d58d987f0bd2d0d1defe6a222398168f53d61172c3f36261421ce1a315a6b |
| p4-46.json: nodes.20276.1.1.4 | root | 51a15f8f014a0fe1c10947802e3f414885051ba00f0967e1741eb72d7dbf3584 | ed02ac7e7931f2da9564c26821479e3d5f10d8316396b7519968500a83516df7 |
| p4-46.json: nodes.20277.1.1.4 | extensions | da066f4d93dd8af1afd1dde05f5c01f3e56552adff98bcc7672e5a43835b2db1 | 9d90bb0dd917aedcdd49028d65cbdb7364b0ecf5b9a0d82bd90199d316c34fe7 |
| p4-46.json: nodes.20285.1.1.4 | chainDigest | 68f123fb15d3b695d2b274ee90fd419aebd8da9415d7f109e47de717f0974764 | e2468686b071b7f657f59f2bb4aa1854e7e399755f0b6050ee28abc18f6ff1a3 |
| p4-46.json: nodes.20286.1.1.4 | root | 5218a37536df466b6e30304fb758e56a5a484f7a0e68a11020f34937475e0013 | 6bb77f6ee1d52d5187af3b7efdf4a516584974da2fd25ae31a78300860d0918b |
| p4-46.json: nodes.20287.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-46.json: nodes.20289.1.1.4 | root | 8ac2b7faa7c379e590a819f8c82c9e09da4f6c96c2af7df5972eaea831ce4b25 | 0b45cfd505ba3edc8161f7d76d7b50ce792126a979f71842e453d07c6daebc48 |
| p4-46.json: nodes.20290.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-48.json: nodes.20255.1.1.4 | chainDigest | d61f870bb262c10a85aa6cddf1c0e335bacc8242b1910274365069163c0340dd | d6716bce7baa8a59ee8660072e57e963c73d445bc6c2072c8b4d4e40c8d4d5d2 |
| p4-48.json: nodes.20256.1.1.4 | root | fe1f62dd2aa4fbd11d7f2803b5d038b5f504a39b60da2060ddf38b1721315fbf | 9285b5daa43545c8a3f6288f802a79f4195cb4078c415ff03968c412c6e7e6cd |
| p4-48.json: nodes.20257.1.1.4 | extensions | 0df8c9667d007b2ede3c8b049cb8fd46e7d22f141d4dc178d35b7f50ae8c5345 | 1fd2a6762fb469ed2c01bcf68321d5c8ba627d53710c92681a15e536949b198e |
| p4-48.json: nodes.20265.1.1.4 | chainDigest | c73840ffd5b38307007e8ae9e12c6e833e771dfb86c5ec8a05dd90823c72c4ef | 5d5f1a92d276e2bfaf5bd822f8c824eea13477063a7d76d26f180245008c5111 |
| p4-48.json: nodes.20266.1.1.4 | root | 99ddd453742fbe93fefeb94134aec04fc736d4f55e929a82a7d19d42e90fe7be | 31e09723330771a412c1bceb06bfe7315905848f878015e17bed13fb3b8dd6c6 |
| p4-48.json: nodes.20267.1.1.4 | extensions | 865ba4addd47c5cc95e3db3243b44be44c6345c7256a2252d94de596b22acab7 | eeb4d142382071ff827ddcfa05fcb85b8bab0fe2a200136142ebb17c8378ea70 |
| p4-48.json: nodes.20276.1.1.4 | chainDigest | 5ac632df8fcf5716a41eca15b1db255b8d84dcb627892439c95fe879ab308d9f | ae8d58d987f0bd2d0d1defe6a222398168f53d61172c3f36261421ce1a315a6b |
| p4-48.json: nodes.20277.1.1.4 | root | 51a15f8f014a0fe1c10947802e3f414885051ba00f0967e1741eb72d7dbf3584 | ed02ac7e7931f2da9564c26821479e3d5f10d8316396b7519968500a83516df7 |
| p4-48.json: nodes.20278.1.1.4 | extensions | da066f4d93dd8af1afd1dde05f5c01f3e56552adff98bcc7672e5a43835b2db1 | 9d90bb0dd917aedcdd49028d65cbdb7364b0ecf5b9a0d82bd90199d316c34fe7 |
| p4-48.json: nodes.20286.1.1.4 | chainDigest | 68f123fb15d3b695d2b274ee90fd419aebd8da9415d7f109e47de717f0974764 | e2468686b071b7f657f59f2bb4aa1854e7e399755f0b6050ee28abc18f6ff1a3 |
| p4-48.json: nodes.20287.1.1.4 | root | 5218a37536df466b6e30304fb758e56a5a484f7a0e68a11020f34937475e0013 | 6bb77f6ee1d52d5187af3b7efdf4a516584974da2fd25ae31a78300860d0918b |
| p4-48.json: nodes.20288.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-48.json: nodes.20290.1.1.4 | root | 8ac2b7faa7c379e590a819f8c82c9e09da4f6c96c2af7df5972eaea831ce4b25 | 0b45cfd505ba3edc8161f7d76d7b50ce792126a979f71842e453d07c6daebc48 |
| p4-48.json: nodes.20291.1.1.4 | extensions | b2398ccb4f430b9e3dc91c0234eab988b67867211af7b529c443f7e9829c4e92 | 9a8878a637f2c8eee666222ad42152e5d2f1f673469e955cfdc9fce7f1fe984e |
| p4-5.json: nodes.7632.1.3.4 | prefixDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-5.json: nodes.7634.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-5.json: nodes.7635.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-5.json: nodes.7636.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-5.json: nodes.7644.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-5.json: nodes.7645.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-5.json: nodes.7646.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-5.json: nodes.7655.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-5.json: nodes.7656.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-5.json: nodes.7657.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-5.json: nodes.7659.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-5.json: nodes.7660.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-5.json: nodes.7668.1.0.4 | foundation | 8 | 9 |
| p4-5.json: nodes.7671.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-5.json: nodes.7672.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-50.json: nodes.40669.1.1.4 | chainDigest | 20aaadb6208e0636c521ba08289a40f3ad3731aa15c58fcf20f6524da0d91c14 | 73f430c499e96ec9ea5310f79930f8322387194e45a7eb4136a1bc03dda71884 |
| p4-50.json: nodes.40670.1.1.4 | root | 6753af947619cdcd53baff1ce88ae2592b0c67937db3daaabe942cdd9c12dfcb | ab3d2d54f2ab94fb9279ef4152fc1fbd1615d83f918a5e4f9f82e6c71a2a91c7 |
| p4-50.json: nodes.40671.1.1.4 | extensions | c30c23b666e2048706d16b97e2ee1ac0110b785ad8e00dc8b73c463653c598ec | 75d471c2ac82df89a3c8bfb330fa10bd6cd2262828457b6ed687f69d3857a7b2 |
| p4-50.json: nodes.40679.1.1.4 | chainDigest | 4ae025c9076aeac5ca8a7d28addaaad27ab2b70c3c95ea22eacd8fdb0bf94f8c | 1713b9488fb6e140a0c342adbc789c9fd1e0af21ff758db26999ff743f641bd0 |
| p4-50.json: nodes.40680.1.1.4 | root | ecd61eac13a04b9ad601c6fc209e4246cfeab65577d4a0ed7da9498220fd0ec0 | 13e83e7a023b7d291ca034c8eceb41d236a1babadc9bbe7e6de5d55fc071d6c1 |
| p4-50.json: nodes.40681.1.1.4 | extensions | 67ea37e824a2e5b614a3e0ba312eaa2ad442c62228c097317f229b3c80eb068f | d54b9d80f36d169250ace31466f694fa0a4e0b90b96508597deb33f5a2cb37ad |
| p4-50.json: nodes.40683.1.1.4 | root | a01857de8f1215b78098df45faac79ff9834fd9ad8c17cbe1c1adb048d6b0552 | f0e40778a46664b3afd2c7729ae4a77b77fa6461f579ede320cb10da136b7206 |
| p4-50.json: nodes.40684.1.1.4 | extensions | 67ea37e824a2e5b614a3e0ba312eaa2ad442c62228c097317f229b3c80eb068f | d54b9d80f36d169250ace31466f694fa0a4e0b90b96508597deb33f5a2cb37ad |
| p4-51.json: nodes.18012.1.3.4 | prefixDigest | 4ae025c9076aeac5ca8a7d28addaaad27ab2b70c3c95ea22eacd8fdb0bf94f8c | 1713b9488fb6e140a0c342adbc789c9fd1e0af21ff758db26999ff743f641bd0 |
| p4-51.json: nodes.18014.1.1.4 | chainDigest | 20aaadb6208e0636c521ba08289a40f3ad3731aa15c58fcf20f6524da0d91c14 | 73f430c499e96ec9ea5310f79930f8322387194e45a7eb4136a1bc03dda71884 |
| p4-51.json: nodes.18015.1.1.4 | root | 6753af947619cdcd53baff1ce88ae2592b0c67937db3daaabe942cdd9c12dfcb | ab3d2d54f2ab94fb9279ef4152fc1fbd1615d83f918a5e4f9f82e6c71a2a91c7 |
| p4-51.json: nodes.18016.1.1.4 | extensions | c30c23b666e2048706d16b97e2ee1ac0110b785ad8e00dc8b73c463653c598ec | 75d471c2ac82df89a3c8bfb330fa10bd6cd2262828457b6ed687f69d3857a7b2 |
| p4-51.json: nodes.18024.1.1.4 | chainDigest | 4ae025c9076aeac5ca8a7d28addaaad27ab2b70c3c95ea22eacd8fdb0bf94f8c | 1713b9488fb6e140a0c342adbc789c9fd1e0af21ff758db26999ff743f641bd0 |
| p4-51.json: nodes.18025.1.1.4 | root | ecd61eac13a04b9ad601c6fc209e4246cfeab65577d4a0ed7da9498220fd0ec0 | 13e83e7a023b7d291ca034c8eceb41d236a1babadc9bbe7e6de5d55fc071d6c1 |
| p4-51.json: nodes.18026.1.1.4 | extensions | 67ea37e824a2e5b614a3e0ba312eaa2ad442c62228c097317f229b3c80eb068f | d54b9d80f36d169250ace31466f694fa0a4e0b90b96508597deb33f5a2cb37ad |
| p4-51.json: nodes.18028.1.1.4 | root | a01857de8f1215b78098df45faac79ff9834fd9ad8c17cbe1c1adb048d6b0552 | f0e40778a46664b3afd2c7729ae4a77b77fa6461f579ede320cb10da136b7206 |
| p4-51.json: nodes.18029.1.1.4 | extensions | 67ea37e824a2e5b614a3e0ba312eaa2ad442c62228c097317f229b3c80eb068f | d54b9d80f36d169250ace31466f694fa0a4e0b90b96508597deb33f5a2cb37ad |
| p4-51.json: nodes.18037.1.0.4 | foundation | 8 | 9 |
| p4-51.json: nodes.18042.1.1.4 | root | c3d49da8b5aa21cfd59b20a1e4fc49462eb495840314a5cabb9f4ab172be40e6 | 9062cf03bdf46181ef02f3829e655a2c2fc233757b509c09dc31a4637eeeea77 |
| p4-51.json: nodes.18043.1.1.4 | extensions | d35b4d6270289f467ae26fbf628ca20e53c171eed1e5c6da0130d02fa61f96bf | 35e63882c28266b333d09a7e4edaec2143c73220c601580bbb35746ce403a151 |
| p4-53.json: nodes.7652.1.3.4 | prefixDigest | e5954f22ce24ebd1a7464fc9a269fb9cc232077e55e01fa356491739af977809 | ecb53c4ef1c1cfa05e69ad2735ed3697aac754d5aabba69fc9976eb9875baa47 |
| p4-53.json: nodes.7655.1.0.4 | foundation | 8 | 9 |
| p4-53.json: nodes.7660.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-53.json: nodes.7661.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-54.json: nodes.17073.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-54.json: nodes.17074.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-54.json: nodes.17075.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-54.json: nodes.17083.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-54.json: nodes.17084.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-54.json: nodes.17085.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-54.json: nodes.17094.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-54.json: nodes.17095.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-54.json: nodes.17096.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-54.json: nodes.17098.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-54.json: nodes.17099.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-55.json: nodes.7652.1.3.4 | prefixDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-55.json: nodes.7654.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-55.json: nodes.7655.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-55.json: nodes.7656.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-55.json: nodes.7664.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-55.json: nodes.7665.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-55.json: nodes.7666.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-55.json: nodes.7675.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-55.json: nodes.7676.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-55.json: nodes.7677.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-55.json: nodes.7679.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-55.json: nodes.7680.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-55.json: nodes.7688.1.0.4 | foundation | 8 | 9 |
| p4-55.json: nodes.7693.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-55.json: nodes.7694.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-56.json: nodes.17069.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-56.json: nodes.17070.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-56.json: nodes.17071.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-56.json: nodes.17079.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-56.json: nodes.17080.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-56.json: nodes.17081.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-56.json: nodes.17090.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-56.json: nodes.17091.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-56.json: nodes.17092.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-56.json: nodes.17094.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-56.json: nodes.17095.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-57.json: nodes.7652.1.3.4 | prefixDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-57.json: nodes.7654.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-57.json: nodes.7655.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-57.json: nodes.7656.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-57.json: nodes.7664.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-57.json: nodes.7665.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-57.json: nodes.7666.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-57.json: nodes.7675.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-57.json: nodes.7676.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-57.json: nodes.7677.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-57.json: nodes.7679.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-57.json: nodes.7680.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-57.json: nodes.7688.1.0.4 | foundation | 8 | 9 |
| p4-57.json: nodes.7693.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-57.json: nodes.7694.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-58.json: nodes.17073.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-58.json: nodes.17074.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-58.json: nodes.17075.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-58.json: nodes.17083.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-58.json: nodes.17084.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-58.json: nodes.17085.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-58.json: nodes.17094.1.1.4 | chainDigest | 910d268110ff31126b0ed1c218e0b220f3a21c2cf42961b308219cfa8b85490b | 7393a144e57f2dd61d4becf5a934994ccfc60dd19a80c3da96d4498ecba160db |
| p4-58.json: nodes.17095.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-58.json: nodes.17096.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-58.json: nodes.17104.1.1.4 | chainDigest | d22b2dac8e3add629e95daef65e62c8a49015c2b2203173c5eff189956304cb2 | 44b3acbf6dd6b6f4e6a5b762dcfdb58bd5216d1aeb26641bc462ede4c431ec45 |
| p4-58.json: nodes.17105.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-58.json: nodes.17106.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-58.json: nodes.17108.1.1.4 | root | cc3b71fc0c2ad1c3ff3e1390298c74dd6da9435626a1ba72a7db7b4fe87e0d89 | e43499ac2df93570b5c6400806e054f825eb5b5f6daeb68b28db435fc91e8c8c |
| p4-58.json: nodes.17109.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-59.json: nodes.7652.1.3.4 | prefixDigest | d22b2dac8e3add629e95daef65e62c8a49015c2b2203173c5eff189956304cb2 | 44b3acbf6dd6b6f4e6a5b762dcfdb58bd5216d1aeb26641bc462ede4c431ec45 |
| p4-59.json: nodes.7654.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-59.json: nodes.7655.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-59.json: nodes.7656.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-59.json: nodes.7664.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-59.json: nodes.7665.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-59.json: nodes.7666.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-59.json: nodes.7675.1.1.4 | chainDigest | 910d268110ff31126b0ed1c218e0b220f3a21c2cf42961b308219cfa8b85490b | 7393a144e57f2dd61d4becf5a934994ccfc60dd19a80c3da96d4498ecba160db |
| p4-59.json: nodes.7676.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-59.json: nodes.7677.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-59.json: nodes.7685.1.1.4 | chainDigest | d22b2dac8e3add629e95daef65e62c8a49015c2b2203173c5eff189956304cb2 | 44b3acbf6dd6b6f4e6a5b762dcfdb58bd5216d1aeb26641bc462ede4c431ec45 |
| p4-59.json: nodes.7686.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-59.json: nodes.7687.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-59.json: nodes.7689.1.1.4 | root | cc3b71fc0c2ad1c3ff3e1390298c74dd6da9435626a1ba72a7db7b4fe87e0d89 | e43499ac2df93570b5c6400806e054f825eb5b5f6daeb68b28db435fc91e8c8c |
| p4-59.json: nodes.7690.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-59.json: nodes.7698.1.0.4 | foundation | 8 | 9 |
| p4-59.json: nodes.7703.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-59.json: nodes.7704.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-6.json: nodes.17044.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-6.json: nodes.17045.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-6.json: nodes.17046.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-6.json: nodes.17054.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-6.json: nodes.17055.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-6.json: nodes.17056.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-6.json: nodes.17065.1.1.4 | chainDigest | 7ba211f0e3117d5dac5ed35d52b388092329a30b754156489d3a009dbc966e5d | ed42ab5b4c7da13a7551adb47989f908195191cb3e16fb16c9219600e15ceb52 |
| p4-6.json: nodes.17066.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-6.json: nodes.17067.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-6.json: nodes.17075.1.1.4 | chainDigest | 6076f1cc718563e440dd3f6808a352f7bac021ae67486afbed84e42be0d236a4 | 0f92934ce7df3faf7a42efcb5b5c34294e1142cc3ad8eaca228106f46aa6137a |
| p4-6.json: nodes.17076.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-6.json: nodes.17077.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-6.json: nodes.17079.1.1.4 | root | 69ff0718e02f1dc3cba60ddf0e344d503860eb9fec038a45b6c5ba7ab30a74dd | 0e492814eb8e0ce960536a65370f414a5987c4363b880a7bf7fe54d287347ca8 |
| p4-6.json: nodes.17080.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-60.json: nodes.17074.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-60.json: nodes.17075.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-60.json: nodes.17076.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-60.json: nodes.17084.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-60.json: nodes.17085.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-60.json: nodes.17086.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-60.json: nodes.17095.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-60.json: nodes.17096.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-60.json: nodes.17097.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-60.json: nodes.17099.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-60.json: nodes.17100.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-60.json: nodes.17108.1.0.4 | foundation | 8 | 9 |
| p4-60.json: nodes.17113.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-60.json: nodes.17114.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-61.json: nodes.7652.1.3.4 | prefixDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-61.json: nodes.7654.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-61.json: nodes.7655.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-61.json: nodes.7656.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-61.json: nodes.7664.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-61.json: nodes.7665.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-61.json: nodes.7666.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-61.json: nodes.7675.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-61.json: nodes.7676.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-61.json: nodes.7677.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-61.json: nodes.7679.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-61.json: nodes.7680.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-61.json: nodes.7688.1.0.4 | foundation | 8 | 9 |
| p4-61.json: nodes.7693.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-61.json: nodes.7694.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-62.json: nodes.17070.1.1.4 | chainDigest | 8eacdf487e0c379f7cda7d663c8d8652e3315890783783422940f716a276ccd0 | 38cd35a14e6d83fc2abb20f576e98660830054c0582e7220aef6ed1f990921b1 |
| p4-62.json: nodes.17071.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-62.json: nodes.17072.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-62.json: nodes.17080.1.1.4 | chainDigest | 32185c50010f3dff2cb28a8a4a17d07d790ad78c053a4b90e814f128f2c27a94 | 49c26fcc3e6bb90fa47f47b4852e93500726ac1db0ad04f3cb294d6f1c52eaa2 |
| p4-62.json: nodes.17081.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-62.json: nodes.17082.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-62.json: nodes.17091.1.1.4 | chainDigest | 03f37722410f7929c01e10e2797b2aaa815a3b44fc43037c744d2f7b8c545ee6 | aab232643bb0e147d5376632622fb7b63b6a0af9fb54ce1aeaca6f98a15c5fa3 |
| p4-62.json: nodes.17092.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-62.json: nodes.17093.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-62.json: nodes.17095.1.1.4 | root | 16bd7bce9d479b92a4c2f9f5bde7ffbd5884deeefbfa575a8977c368c6986f91 | e8059ec5b30fd52bc7f7909037f2568486f60a83bddff33761cd96bc5140a626 |
| p4-62.json: nodes.17096.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-62.json: nodes.17104.1.0.4 | foundation | 8 | 9 |
| p4-62.json: nodes.17109.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-62.json: nodes.17110.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-63.json: nodes.7652.1.3.4 | prefixDigest | da2a1ca4d18d119e324ba7325f6ba48d30e70a4db199f7ba498f382d0e2ac27e | 631121fe64fc466b4bacd20e92eb781113128f4cb1d35afaf95505ec9c79d8c2 |
| p4-63.json: nodes.7654.1.1.4 | chainDigest | da2a1ca4d18d119e324ba7325f6ba48d30e70a4db199f7ba498f382d0e2ac27e | 631121fe64fc466b4bacd20e92eb781113128f4cb1d35afaf95505ec9c79d8c2 |
| p4-63.json: nodes.7655.1.1.4 | root | 9ccec0a45a049d4bec6d8d46ba9b6c3e8880d534508e9be6d06004dd015952ee | 3c472dddb1f09a2f59f4c71010cbf0461c98ab1b82e5734e41757532bb2fdd8f |
| p4-63.json: nodes.7656.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-63.json: nodes.7658.1.1.4 | root | 39ccf524bdfaa5befbc1c83e1f347369e22d1622d62b74ad90b8b5afbdb102fe | 14dd6f7e19af5a01ecc870a56a93cd11cdaffd96484cb5e18733995bf97f1fe4 |
| p4-63.json: nodes.7659.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-63.json: nodes.7667.1.0.4 | foundation | 8 | 9 |
| p4-63.json: nodes.7672.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-63.json: nodes.7673.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-64.json: nodes.18630.1.1.4 | chainDigest | 6014e8b43cf0bb36fdcae9ff312596f67147ade86c2a618f9e837859258e9c0d | 5e375f0ac79713f244201c73690c877df7c19fba0696203f0bf9ed2182d6ee95 |
| p4-64.json: nodes.18631.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-64.json: nodes.18632.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-64.json: nodes.18635.1.1.4 | root | f681a1512001e150744ac1d11109ef07c430d1f95aef5d1d5d084457df088804 | 029eadc7754102030fc8edf019013baa9d602199ea133bb87d40319a777a9a7d |
| p4-64.json: nodes.18636.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-65.json: nodes.2099.1.3.4 | prefixDigest | 6014e8b43cf0bb36fdcae9ff312596f67147ade86c2a618f9e837859258e9c0d | 5e375f0ac79713f244201c73690c877df7c19fba0696203f0bf9ed2182d6ee95 |
| p4-65.json: nodes.2101.1.1.4 | chainDigest | 6014e8b43cf0bb36fdcae9ff312596f67147ade86c2a618f9e837859258e9c0d | 5e375f0ac79713f244201c73690c877df7c19fba0696203f0bf9ed2182d6ee95 |
| p4-65.json: nodes.2102.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-65.json: nodes.2103.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-65.json: nodes.2106.1.1.4 | root | f681a1512001e150744ac1d11109ef07c430d1f95aef5d1d5d084457df088804 | 029eadc7754102030fc8edf019013baa9d602199ea133bb87d40319a777a9a7d |
| p4-65.json: nodes.2107.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-65.json: nodes.2115.1.0.4 | foundation | 8 | 9 |
| p4-65.json: nodes.2120.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-65.json: nodes.2121.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-66.json: nodes.18630.1.1.4 | chainDigest | 6014e8b43cf0bb36fdcae9ff312596f67147ade86c2a618f9e837859258e9c0d | 5e375f0ac79713f244201c73690c877df7c19fba0696203f0bf9ed2182d6ee95 |
| p4-66.json: nodes.18631.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-66.json: nodes.18632.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-66.json: nodes.18635.1.1.4 | root | f681a1512001e150744ac1d11109ef07c430d1f95aef5d1d5d084457df088804 | 029eadc7754102030fc8edf019013baa9d602199ea133bb87d40319a777a9a7d |
| p4-66.json: nodes.18636.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-68.json: nodes.18666.1.1.4 | chainDigest | 4cfc7d3e43a2f0f0e61f1026ca3feea1e83d064cbb2cbddbf8ce2dd7a1821ed2 | 72ae958e8a3c936a387cb5cf6182302a3716b419d84da414b87287b87013d12b |
| p4-68.json: nodes.18667.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-68.json: nodes.18668.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-68.json: nodes.18677.1.1.4 | chainDigest | 17f6a0286df628ebfb6f5ef5d548f6349c9f02ad2ea71323ca663d64cf23d2b9 | a27bd7326bd4c45abc5b460b59bd0be8941d370bbeb0d16ba3d53474142b6b44 |
| p4-68.json: nodes.18678.1.1.4 | root | 5856b72daa078528b0152106d3c4c967f84ccaa794adea8713aa3aa99ceec0d6 | 7a195d3b40d485da7791bdf7a17ff0046c36addbf7d743f2d630bc49c7f33d86 |
| p4-68.json: nodes.18679.1.1.4 | extensions | d4ef3451254828d00fdaad11129565a212641bd7ad7d4a309c8585e16fd095ec | 719eeba0e1ceb0f373ff76d234abdce9f7830a2211f1c4c93a08cfeac2fec8d4 |
| p4-68.json: nodes.18687.1.1.4 | chainDigest | 9bccf3a7468af5252422867349e9f23d022a0320ca7b4defa2ab7a6b75326f16 | becdb3d7a98c1cf9d3fcb99950b66bdf03b438efcfacda89a5ab227ebfa24779 |
| p4-68.json: nodes.18688.1.1.4 | root | ea637b9808b6c444e23ca72660c42c1718b543fca1ed9fd64617d70b65e89cd7 | 998de22fafb1c11b5898243e8076f338716e0edd9aae15b29875e72b96b18ca1 |
| p4-68.json: nodes.18689.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-68.json: nodes.18691.1.1.4 | root | 3a81dcc5def0478f3d32aee70786bc4a8bd00d7d60408e0c3f9212039bebf25b | 29901cee6451d1f9b786741c987792a70f5b44983cbf2fbd7359b9c3408b6a6b |
| p4-68.json: nodes.18692.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-69.json: nodes.2137.1.3.4 | prefixDigest | 9bccf3a7468af5252422867349e9f23d022a0320ca7b4defa2ab7a6b75326f16 | becdb3d7a98c1cf9d3fcb99950b66bdf03b438efcfacda89a5ab227ebfa24779 |
| p4-69.json: nodes.2139.1.1.4 | chainDigest | 4cfc7d3e43a2f0f0e61f1026ca3feea1e83d064cbb2cbddbf8ce2dd7a1821ed2 | 72ae958e8a3c936a387cb5cf6182302a3716b419d84da414b87287b87013d12b |
| p4-69.json: nodes.2140.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-69.json: nodes.2141.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-69.json: nodes.2150.1.1.4 | chainDigest | 17f6a0286df628ebfb6f5ef5d548f6349c9f02ad2ea71323ca663d64cf23d2b9 | a27bd7326bd4c45abc5b460b59bd0be8941d370bbeb0d16ba3d53474142b6b44 |
| p4-69.json: nodes.2151.1.1.4 | root | 5856b72daa078528b0152106d3c4c967f84ccaa794adea8713aa3aa99ceec0d6 | 7a195d3b40d485da7791bdf7a17ff0046c36addbf7d743f2d630bc49c7f33d86 |
| p4-69.json: nodes.2152.1.1.4 | extensions | d4ef3451254828d00fdaad11129565a212641bd7ad7d4a309c8585e16fd095ec | 719eeba0e1ceb0f373ff76d234abdce9f7830a2211f1c4c93a08cfeac2fec8d4 |
| p4-69.json: nodes.2160.1.1.4 | chainDigest | 9bccf3a7468af5252422867349e9f23d022a0320ca7b4defa2ab7a6b75326f16 | becdb3d7a98c1cf9d3fcb99950b66bdf03b438efcfacda89a5ab227ebfa24779 |
| p4-69.json: nodes.2161.1.1.4 | root | ea637b9808b6c444e23ca72660c42c1718b543fca1ed9fd64617d70b65e89cd7 | 998de22fafb1c11b5898243e8076f338716e0edd9aae15b29875e72b96b18ca1 |
| p4-69.json: nodes.2162.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-69.json: nodes.2164.1.1.4 | root | 3a81dcc5def0478f3d32aee70786bc4a8bd00d7d60408e0c3f9212039bebf25b | 29901cee6451d1f9b786741c987792a70f5b44983cbf2fbd7359b9c3408b6a6b |
| p4-69.json: nodes.2165.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-69.json: nodes.2173.1.0.4 | foundation | 8 | 9 |
| p4-69.json: nodes.2178.1.1.4 | root | 3b1efa177e74b4ade4f89f80df4b1ed520e01b5d3a814129b6ec851b98992155 | 3fec7ba91ed9334468ac48ee50ecd6a002122c81f829824a26efe9be33639e1c |
| p4-69.json: nodes.2179.1.1.4 | extensions | d8c3af64c780813f0f325f7f1fbb9152e30d1e7cf8b46663f5bcc4cd25aef11f | 072bd2644512d1c01713838c5134979af9cbf3c91b1c3de19d777e5f785695c4 |
| p4-7.json: nodes.7632.1.3.4 | prefixDigest | 6076f1cc718563e440dd3f6808a352f7bac021ae67486afbed84e42be0d236a4 | 0f92934ce7df3faf7a42efcb5b5c34294e1142cc3ad8eaca228106f46aa6137a |
| p4-7.json: nodes.7634.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-7.json: nodes.7635.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-7.json: nodes.7636.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-7.json: nodes.7644.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-7.json: nodes.7645.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-7.json: nodes.7646.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-7.json: nodes.7655.1.1.4 | chainDigest | 7ba211f0e3117d5dac5ed35d52b388092329a30b754156489d3a009dbc966e5d | ed42ab5b4c7da13a7551adb47989f908195191cb3e16fb16c9219600e15ceb52 |
| p4-7.json: nodes.7656.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-7.json: nodes.7657.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-7.json: nodes.7665.1.1.4 | chainDigest | 6076f1cc718563e440dd3f6808a352f7bac021ae67486afbed84e42be0d236a4 | 0f92934ce7df3faf7a42efcb5b5c34294e1142cc3ad8eaca228106f46aa6137a |
| p4-7.json: nodes.7666.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-7.json: nodes.7667.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-7.json: nodes.7669.1.1.4 | root | 69ff0718e02f1dc3cba60ddf0e344d503860eb9fec038a45b6c5ba7ab30a74dd | 0e492814eb8e0ce960536a65370f414a5987c4363b880a7bf7fe54d287347ca8 |
| p4-7.json: nodes.7670.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-7.json: nodes.7678.1.0.4 | foundation | 8 | 9 |
| p4-7.json: nodes.7681.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-7.json: nodes.7682.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-70.json: nodes.18677.1.1.4 | chainDigest | 4cfc7d3e43a2f0f0e61f1026ca3feea1e83d064cbb2cbddbf8ce2dd7a1821ed2 | 72ae958e8a3c936a387cb5cf6182302a3716b419d84da414b87287b87013d12b |
| p4-70.json: nodes.18678.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-70.json: nodes.18679.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-70.json: nodes.18688.1.1.4 | chainDigest | 17f6a0286df628ebfb6f5ef5d548f6349c9f02ad2ea71323ca663d64cf23d2b9 | a27bd7326bd4c45abc5b460b59bd0be8941d370bbeb0d16ba3d53474142b6b44 |
| p4-70.json: nodes.18689.1.1.4 | root | 5856b72daa078528b0152106d3c4c967f84ccaa794adea8713aa3aa99ceec0d6 | 7a195d3b40d485da7791bdf7a17ff0046c36addbf7d743f2d630bc49c7f33d86 |
| p4-70.json: nodes.18690.1.1.4 | extensions | d4ef3451254828d00fdaad11129565a212641bd7ad7d4a309c8585e16fd095ec | 719eeba0e1ceb0f373ff76d234abdce9f7830a2211f1c4c93a08cfeac2fec8d4 |
| p4-70.json: nodes.18698.1.1.4 | chainDigest | 9bccf3a7468af5252422867349e9f23d022a0320ca7b4defa2ab7a6b75326f16 | becdb3d7a98c1cf9d3fcb99950b66bdf03b438efcfacda89a5ab227ebfa24779 |
| p4-70.json: nodes.18699.1.1.4 | root | ea637b9808b6c444e23ca72660c42c1718b543fca1ed9fd64617d70b65e89cd7 | 998de22fafb1c11b5898243e8076f338716e0edd9aae15b29875e72b96b18ca1 |
| p4-70.json: nodes.18700.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-70.json: nodes.18702.1.1.4 | root | 3a81dcc5def0478f3d32aee70786bc4a8bd00d7d60408e0c3f9212039bebf25b | 29901cee6451d1f9b786741c987792a70f5b44983cbf2fbd7359b9c3408b6a6b |
| p4-70.json: nodes.18703.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-72.json: nodes.18721.1.1.4 | chainDigest | 4cfc7d3e43a2f0f0e61f1026ca3feea1e83d064cbb2cbddbf8ce2dd7a1821ed2 | 72ae958e8a3c936a387cb5cf6182302a3716b419d84da414b87287b87013d12b |
| p4-72.json: nodes.18722.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-72.json: nodes.18723.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-72.json: nodes.18732.1.1.4 | chainDigest | 17f6a0286df628ebfb6f5ef5d548f6349c9f02ad2ea71323ca663d64cf23d2b9 | a27bd7326bd4c45abc5b460b59bd0be8941d370bbeb0d16ba3d53474142b6b44 |
| p4-72.json: nodes.18733.1.1.4 | root | 5856b72daa078528b0152106d3c4c967f84ccaa794adea8713aa3aa99ceec0d6 | 7a195d3b40d485da7791bdf7a17ff0046c36addbf7d743f2d630bc49c7f33d86 |
| p4-72.json: nodes.18734.1.1.4 | extensions | d4ef3451254828d00fdaad11129565a212641bd7ad7d4a309c8585e16fd095ec | 719eeba0e1ceb0f373ff76d234abdce9f7830a2211f1c4c93a08cfeac2fec8d4 |
| p4-72.json: nodes.18742.1.1.4 | chainDigest | 9bccf3a7468af5252422867349e9f23d022a0320ca7b4defa2ab7a6b75326f16 | becdb3d7a98c1cf9d3fcb99950b66bdf03b438efcfacda89a5ab227ebfa24779 |
| p4-72.json: nodes.18743.1.1.4 | root | ea637b9808b6c444e23ca72660c42c1718b543fca1ed9fd64617d70b65e89cd7 | 998de22fafb1c11b5898243e8076f338716e0edd9aae15b29875e72b96b18ca1 |
| p4-72.json: nodes.18744.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-72.json: nodes.18746.1.1.4 | root | 3a81dcc5def0478f3d32aee70786bc4a8bd00d7d60408e0c3f9212039bebf25b | 29901cee6451d1f9b786741c987792a70f5b44983cbf2fbd7359b9c3408b6a6b |
| p4-72.json: nodes.18747.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-74.json: nodes.18722.1.1.4 | chainDigest | 4cfc7d3e43a2f0f0e61f1026ca3feea1e83d064cbb2cbddbf8ce2dd7a1821ed2 | 72ae958e8a3c936a387cb5cf6182302a3716b419d84da414b87287b87013d12b |
| p4-74.json: nodes.18723.1.1.4 | root | 313c7dcaadcbdb73d94fc413779df39f83290281f91114d759711fddc74feff7 | 4dec3d875fdaf46694c52fa37dcbd2214706b679bbecfc1f0092771ae2592efd |
| p4-74.json: nodes.18724.1.1.4 | extensions | 03ab6d1ad9f9532e3a4cab23ae7f7026eeb4ea7cf728af45bb663690570f554e | bd6247fbf85741502836198fd956e0f8a7b9f27870c4389088dd617f67438f29 |
| p4-74.json: nodes.18733.1.1.4 | chainDigest | 17f6a0286df628ebfb6f5ef5d548f6349c9f02ad2ea71323ca663d64cf23d2b9 | a27bd7326bd4c45abc5b460b59bd0be8941d370bbeb0d16ba3d53474142b6b44 |
| p4-74.json: nodes.18734.1.1.4 | root | 5856b72daa078528b0152106d3c4c967f84ccaa794adea8713aa3aa99ceec0d6 | 7a195d3b40d485da7791bdf7a17ff0046c36addbf7d743f2d630bc49c7f33d86 |
| p4-74.json: nodes.18735.1.1.4 | extensions | d4ef3451254828d00fdaad11129565a212641bd7ad7d4a309c8585e16fd095ec | 719eeba0e1ceb0f373ff76d234abdce9f7830a2211f1c4c93a08cfeac2fec8d4 |
| p4-74.json: nodes.18743.1.1.4 | chainDigest | 9bccf3a7468af5252422867349e9f23d022a0320ca7b4defa2ab7a6b75326f16 | becdb3d7a98c1cf9d3fcb99950b66bdf03b438efcfacda89a5ab227ebfa24779 |
| p4-74.json: nodes.18744.1.1.4 | root | ea637b9808b6c444e23ca72660c42c1718b543fca1ed9fd64617d70b65e89cd7 | 998de22fafb1c11b5898243e8076f338716e0edd9aae15b29875e72b96b18ca1 |
| p4-74.json: nodes.18745.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-74.json: nodes.18747.1.1.4 | root | 3a81dcc5def0478f3d32aee70786bc4a8bd00d7d60408e0c3f9212039bebf25b | 29901cee6451d1f9b786741c987792a70f5b44983cbf2fbd7359b9c3408b6a6b |
| p4-74.json: nodes.18748.1.1.4 | extensions | 8c01edae92c2e73fc84eba91674c4a3da08186be6dcf6643539821ae3aa8c3d3 | 32c76b86c26156b5a2722ce8bfe0262f374ec6b1b94875713f9f6e5e7f7b9ac7 |
| p4-76.json: nodes.38989.1.1.4 | chainDigest | 6217ec9b512b2e58a2a0564e803f5b56f9491f16edc11c5cde549cab0f0118a4 | 981202da8cf4492a638bc4a59a87bfcc9d2a6c6e48433b1a8fce8b0e8db5e03e |
| p4-76.json: nodes.38990.1.1.4 | root | 25c85f9983a0cb0f30b976817f35e1d03701a61f5068c8c20ec93ac2095fd4d1 | 16be7b5ffb7fca86481afb3dce0bd04a17cc9f271aaacb46f120ec1c8f4bdc2b |
| p4-76.json: nodes.38991.1.1.4 | extensions | cb3368a35a8f64ad1bf5f8320f9b20a0dafb6f1640b397cc1dbe2b2d043e1a8a | 8395383743fd4025b7b4e83dba52e8cc0b07bfc8c8779b582145b614e7f2a996 |
| p4-76.json: nodes.38993.1.1.4 | root | e2ad185d4953e9ec8e8fe7fe85d837409e9c24c0ace4204de5e87a13861f595c | f14db79d4ed434fff0331cb8c9b0caa6e00fe0774b587cb95d9d1e95de4b5ec2 |
| p4-76.json: nodes.38994.1.1.4 | extensions | cb3368a35a8f64ad1bf5f8320f9b20a0dafb6f1640b397cc1dbe2b2d043e1a8a | 8395383743fd4025b7b4e83dba52e8cc0b07bfc8c8779b582145b614e7f2a996 |
| p4-77.json: nodes.17723.1.3.4 | prefixDigest | 6217ec9b512b2e58a2a0564e803f5b56f9491f16edc11c5cde549cab0f0118a4 | 981202da8cf4492a638bc4a59a87bfcc9d2a6c6e48433b1a8fce8b0e8db5e03e |
| p4-77.json: nodes.17725.1.1.4 | chainDigest | 6217ec9b512b2e58a2a0564e803f5b56f9491f16edc11c5cde549cab0f0118a4 | 981202da8cf4492a638bc4a59a87bfcc9d2a6c6e48433b1a8fce8b0e8db5e03e |
| p4-77.json: nodes.17726.1.1.4 | root | 25c85f9983a0cb0f30b976817f35e1d03701a61f5068c8c20ec93ac2095fd4d1 | 16be7b5ffb7fca86481afb3dce0bd04a17cc9f271aaacb46f120ec1c8f4bdc2b |
| p4-77.json: nodes.17727.1.1.4 | extensions | cb3368a35a8f64ad1bf5f8320f9b20a0dafb6f1640b397cc1dbe2b2d043e1a8a | 8395383743fd4025b7b4e83dba52e8cc0b07bfc8c8779b582145b614e7f2a996 |
| p4-77.json: nodes.17729.1.1.4 | root | e2ad185d4953e9ec8e8fe7fe85d837409e9c24c0ace4204de5e87a13861f595c | f14db79d4ed434fff0331cb8c9b0caa6e00fe0774b587cb95d9d1e95de4b5ec2 |
| p4-77.json: nodes.17730.1.1.4 | extensions | cb3368a35a8f64ad1bf5f8320f9b20a0dafb6f1640b397cc1dbe2b2d043e1a8a | 8395383743fd4025b7b4e83dba52e8cc0b07bfc8c8779b582145b614e7f2a996 |
| p4-77.json: nodes.17738.1.0.4 | foundation | 8 | 9 |
| p4-77.json: nodes.17743.1.1.4 | root | 91d5cca1ab7288e2f38d5298e42551f266c696a8acdcc66420b00854b73c74bf | 0dd067853014099fa4531d332076f0b42a211410550d0fd9462341dcc3175830 |
| p4-77.json: nodes.17744.1.1.4 | extensions | f5256504f4b0214f7d80b4a981893f3e186b564a772c676c3c674b0c06bdf6ab | 8eb6ca38530774f809897f54c734bc03847d7526fc1339885f6024c3c67242ab |
| p4-78.json: nodes.18505.1.1.4 | chainDigest | c225fb804b11c11a9409711b8c38e86969841109eaa6413efeb00ef698bfa748 | 089fa42cd30585d4f4d70a544ad7c1ebcdf9248ff347601a26f139bdaa2f1700 |
| p4-78.json: nodes.18506.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-78.json: nodes.18507.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-78.json: nodes.18509.1.1.4 | root | 41c4b18e366c5ba2cc75a3050df9acb6baf55d7ff4e5b492052bf1bedf10657b | c4ad0f817b7731986fb12edad5af78adc97fb5775e3b3b489ae61809c0746552 |
| p4-78.json: nodes.18510.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-79.json: nodes.7683.1.3.4 | prefixDigest | c225fb804b11c11a9409711b8c38e86969841109eaa6413efeb00ef698bfa748 | 089fa42cd30585d4f4d70a544ad7c1ebcdf9248ff347601a26f139bdaa2f1700 |
| p4-79.json: nodes.7685.1.1.4 | chainDigest | c225fb804b11c11a9409711b8c38e86969841109eaa6413efeb00ef698bfa748 | 089fa42cd30585d4f4d70a544ad7c1ebcdf9248ff347601a26f139bdaa2f1700 |
| p4-79.json: nodes.7686.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-79.json: nodes.7687.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-79.json: nodes.7689.1.1.4 | root | 41c4b18e366c5ba2cc75a3050df9acb6baf55d7ff4e5b492052bf1bedf10657b | c4ad0f817b7731986fb12edad5af78adc97fb5775e3b3b489ae61809c0746552 |
| p4-79.json: nodes.7690.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-79.json: nodes.7698.1.0.4 | foundation | 8 | 9 |
| p4-79.json: nodes.7705.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-79.json: nodes.7706.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-8.json: nodes.17045.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-8.json: nodes.17046.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-8.json: nodes.17047.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-8.json: nodes.17055.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-8.json: nodes.17056.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-8.json: nodes.17057.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-8.json: nodes.17066.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-8.json: nodes.17067.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-8.json: nodes.17068.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-8.json: nodes.17070.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-8.json: nodes.17071.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-8.json: nodes.17079.1.0.4 | foundation | 8 | 9 |
| p4-8.json: nodes.17082.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-8.json: nodes.17083.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-80.json: nodes.18509.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-80.json: nodes.18510.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-80.json: nodes.18511.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-80.json: nodes.18519.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-80.json: nodes.18520.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-80.json: nodes.18521.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-80.json: nodes.18529.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-80.json: nodes.18530.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-80.json: nodes.18531.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-80.json: nodes.18540.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-80.json: nodes.18541.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-80.json: nodes.18542.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-80.json: nodes.18544.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-80.json: nodes.18545.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-81.json: nodes.7683.1.3.4 | prefixDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-81.json: nodes.7685.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-81.json: nodes.7686.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-81.json: nodes.7687.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-81.json: nodes.7695.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-81.json: nodes.7696.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-81.json: nodes.7697.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-81.json: nodes.7705.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-81.json: nodes.7706.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-81.json: nodes.7707.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-81.json: nodes.7716.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-81.json: nodes.7717.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-81.json: nodes.7718.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-81.json: nodes.7720.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-81.json: nodes.7721.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-81.json: nodes.7729.1.0.4 | foundation | 8 | 9 |
| p4-81.json: nodes.7736.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-81.json: nodes.7737.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-82.json: nodes.18505.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-82.json: nodes.18506.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-82.json: nodes.18507.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-82.json: nodes.18515.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-82.json: nodes.18516.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-82.json: nodes.18517.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-82.json: nodes.18525.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-82.json: nodes.18526.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-82.json: nodes.18527.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-82.json: nodes.18536.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-82.json: nodes.18537.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-82.json: nodes.18538.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-82.json: nodes.18540.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-82.json: nodes.18541.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-83.json: nodes.7683.1.3.4 | prefixDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-83.json: nodes.7685.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-83.json: nodes.7686.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-83.json: nodes.7687.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-83.json: nodes.7695.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-83.json: nodes.7696.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-83.json: nodes.7697.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-83.json: nodes.7705.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-83.json: nodes.7706.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-83.json: nodes.7707.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-83.json: nodes.7716.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-83.json: nodes.7717.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-83.json: nodes.7718.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-83.json: nodes.7720.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-83.json: nodes.7721.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-83.json: nodes.7729.1.0.4 | foundation | 8 | 9 |
| p4-83.json: nodes.7736.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-83.json: nodes.7737.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-84.json: nodes.18509.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-84.json: nodes.18510.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-84.json: nodes.18511.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-84.json: nodes.18519.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-84.json: nodes.18520.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-84.json: nodes.18521.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-84.json: nodes.18529.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-84.json: nodes.18530.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-84.json: nodes.18531.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-84.json: nodes.18540.1.1.4 | chainDigest | afaeccd3bbba5d17f19fb327be81abfb2c28176d63adbbb9e912316a1cb962e2 | 2398d60b3776e3b3ae133404a223f4a2c31520ada16722f5207dd38682333d73 |
| p4-84.json: nodes.18541.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-84.json: nodes.18542.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-84.json: nodes.18550.1.1.4 | chainDigest | 48edbbe59da62e716e2d6865d92d463afad4dcb5fb8ae553f1a777a317dee3fa | 28b778bbde64f65c9a53d292a5f87eaff11d6c8857930a306f9f0113b06e0100 |
| p4-84.json: nodes.18551.1.1.4 | root | 107bc2728b86d9d787b227ca0402dd7bf8e9f7d2cd7c61ab43d3fe5568d256db | d5b3bac7ac49297eb9ae685c4a3358e2c9843ee022b79620a4db1558d0b0b31f |
| p4-84.json: nodes.18552.1.1.4 | extensions | 66f05a4d44830f8ad81cb4b09ecc4ed9da345c848c4f7195065a23d8577a15e2 | 730f1c5f8c4b1afd2d6f07ccb16a01b4343574857b632398c5efac63a3eb1a4e |
| p4-84.json: nodes.18554.1.1.4 | root | eeb2cb9761930028089009d878f0f5aeb129801a036d287d1fb289cacf57fc93 | 9a49281e5308f311d279ce7c939787fd487c64a4364757bf22265705e9a4aea6 |
| p4-84.json: nodes.18555.1.1.4 | extensions | 66f05a4d44830f8ad81cb4b09ecc4ed9da345c848c4f7195065a23d8577a15e2 | 730f1c5f8c4b1afd2d6f07ccb16a01b4343574857b632398c5efac63a3eb1a4e |
| p4-85.json: nodes.7683.1.3.4 | prefixDigest | 48edbbe59da62e716e2d6865d92d463afad4dcb5fb8ae553f1a777a317dee3fa | 28b778bbde64f65c9a53d292a5f87eaff11d6c8857930a306f9f0113b06e0100 |
| p4-85.json: nodes.7685.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-85.json: nodes.7686.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-85.json: nodes.7687.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-85.json: nodes.7695.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-85.json: nodes.7696.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-85.json: nodes.7697.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-85.json: nodes.7705.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-85.json: nodes.7706.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-85.json: nodes.7707.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-85.json: nodes.7716.1.1.4 | chainDigest | afaeccd3bbba5d17f19fb327be81abfb2c28176d63adbbb9e912316a1cb962e2 | 2398d60b3776e3b3ae133404a223f4a2c31520ada16722f5207dd38682333d73 |
| p4-85.json: nodes.7717.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-85.json: nodes.7718.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-85.json: nodes.7726.1.1.4 | chainDigest | 48edbbe59da62e716e2d6865d92d463afad4dcb5fb8ae553f1a777a317dee3fa | 28b778bbde64f65c9a53d292a5f87eaff11d6c8857930a306f9f0113b06e0100 |
| p4-85.json: nodes.7727.1.1.4 | root | 107bc2728b86d9d787b227ca0402dd7bf8e9f7d2cd7c61ab43d3fe5568d256db | d5b3bac7ac49297eb9ae685c4a3358e2c9843ee022b79620a4db1558d0b0b31f |
| p4-85.json: nodes.7728.1.1.4 | extensions | 66f05a4d44830f8ad81cb4b09ecc4ed9da345c848c4f7195065a23d8577a15e2 | 730f1c5f8c4b1afd2d6f07ccb16a01b4343574857b632398c5efac63a3eb1a4e |
| p4-85.json: nodes.7730.1.1.4 | root | eeb2cb9761930028089009d878f0f5aeb129801a036d287d1fb289cacf57fc93 | 9a49281e5308f311d279ce7c939787fd487c64a4364757bf22265705e9a4aea6 |
| p4-85.json: nodes.7731.1.1.4 | extensions | 66f05a4d44830f8ad81cb4b09ecc4ed9da345c848c4f7195065a23d8577a15e2 | 730f1c5f8c4b1afd2d6f07ccb16a01b4343574857b632398c5efac63a3eb1a4e |
| p4-85.json: nodes.7739.1.0.4 | foundation | 8 | 9 |
| p4-85.json: nodes.7746.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-85.json: nodes.7747.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-86.json: nodes.18510.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-86.json: nodes.18511.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-86.json: nodes.18512.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-86.json: nodes.18520.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-86.json: nodes.18521.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-86.json: nodes.18522.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-86.json: nodes.18530.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-86.json: nodes.18531.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-86.json: nodes.18532.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-86.json: nodes.18541.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-86.json: nodes.18542.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-86.json: nodes.18543.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-86.json: nodes.18545.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-86.json: nodes.18546.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-86.json: nodes.18554.1.0.4 | foundation | 8 | 9 |
| p4-86.json: nodes.18561.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-86.json: nodes.18562.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-87.json: nodes.7683.1.3.4 | prefixDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-87.json: nodes.7685.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-87.json: nodes.7686.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-87.json: nodes.7687.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-87.json: nodes.7695.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-87.json: nodes.7696.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-87.json: nodes.7697.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-87.json: nodes.7705.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-87.json: nodes.7706.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-87.json: nodes.7707.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-87.json: nodes.7716.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-87.json: nodes.7717.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-87.json: nodes.7718.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-87.json: nodes.7720.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-87.json: nodes.7721.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-87.json: nodes.7729.1.0.4 | foundation | 8 | 9 |
| p4-87.json: nodes.7736.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-87.json: nodes.7737.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-88.json: nodes.18506.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-88.json: nodes.18507.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-88.json: nodes.18508.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-88.json: nodes.18516.1.1.4 | chainDigest | f33e7a31af05d449dad0c87590edaf08427d88ef1a280b6cb2ecff1c04d06a9c | 41ef4bd783c2ca8e0afaaca20a50128e2a2c15b8b54174a7fe4b1e18177153b4 |
| p4-88.json: nodes.18517.1.1.4 | root | 8da3873883b89775aededf2c68325627f7db00dcc30672d53e22c2518b8405d9 | ef94f7ef1b97c266167e96e99bab61e94e2cbd99e3020ec3e698bd0b2873d2fa |
| p4-88.json: nodes.18518.1.1.4 | extensions | c618dbb738172d05e122429fb5b94c1c989a4047ae549df3d926d8bc456bf833 | 2a87a34d22fe68a90098017cc55c704fc3040531a491d5ab67cffbb969119b09 |
| p4-88.json: nodes.18526.1.1.4 | chainDigest | 46ce3d2b70ab2b937b8c5dc50679ca6ac6933fb9a2e5d8e1f46bcf971510bad1 | 25a0e2dcaea8453bd25a1bc2ac6234cf4fd5205165117bbe35fbb05c99a5537b |
| p4-88.json: nodes.18527.1.1.4 | root | c1131383ccb3c7241a5c545e7b4e173162e9d8aa2e4b68cba2c5fe9a53f5518a | 6398502a7287eb05d4887b5ed37556a2b3d52675b12bf13e61e4fc72aed1199e |
| p4-88.json: nodes.18528.1.1.4 | extensions | 35d76759a91964dfe7112cc5e73d4ebb4b19746739c7422e51fab804d50e150d | 8753034214bd34e0f980511fa65667c02415e4ea52fab14efdf96004dd82dd15 |
| p4-88.json: nodes.18537.1.1.4 | chainDigest | b711beea13ef715d5ef2b0a5f5377bcfb0f85727d351ccfa55ab776c843af3bc | 72fb557157a9be7e2fa73343cedbb14566c3714a6758345b1c3c510dd533f49a |
| p4-88.json: nodes.18538.1.1.4 | root | 8ceea0c0252da675a297a9c1aa9f93117a0c5fc6a3cf370785c657026ad3c35b | b0477cf333d985332ead010dc4580e3ad27decdec4d54379a1b2695f9cff8306 |
| p4-88.json: nodes.18539.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-88.json: nodes.18541.1.1.4 | root | 491032c0494a56cda563b1ea7b0d72a5b856acf95f21a53ea4dd0d25b4d35375 | f02e0c960d74d5994e9f4e28cdc52e251b79a2ddf5ff9bc87ed66baa710a1c02 |
| p4-88.json: nodes.18542.1.1.4 | extensions | 187be8bc79f3bab93556cb45a2d79f28663f3edc94b652debac07f3a1efc115d | fdb3cf4b31d9824a3e81f9f0e5769e469727a52d7e2da48752b98fca9684866e |
| p4-88.json: nodes.18550.1.0.4 | foundation | 8 | 9 |
| p4-88.json: nodes.18557.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-88.json: nodes.18558.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-89.json: nodes.7683.1.3.4 | prefixDigest | c225fb804b11c11a9409711b8c38e86969841109eaa6413efeb00ef698bfa748 | 089fa42cd30585d4f4d70a544ad7c1ebcdf9248ff347601a26f139bdaa2f1700 |
| p4-89.json: nodes.7685.1.1.4 | chainDigest | c225fb804b11c11a9409711b8c38e86969841109eaa6413efeb00ef698bfa748 | 089fa42cd30585d4f4d70a544ad7c1ebcdf9248ff347601a26f139bdaa2f1700 |
| p4-89.json: nodes.7686.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-89.json: nodes.7687.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-89.json: nodes.7689.1.1.4 | root | 41c4b18e366c5ba2cc75a3050df9acb6baf55d7ff4e5b492052bf1bedf10657b | c4ad0f817b7731986fb12edad5af78adc97fb5775e3b3b489ae61809c0746552 |
| p4-89.json: nodes.7690.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-89.json: nodes.7698.1.0.4 | foundation | 8 | 9 |
| p4-89.json: nodes.7705.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-89.json: nodes.7706.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-9.json: nodes.7632.1.3.4 | prefixDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-9.json: nodes.7634.1.1.4 | chainDigest | 9cc9740d78de3e824fef8083e814ee686a9e21d7001775568f9b31e9a5dfe0e9 | 647d803714a90dd3fb4608cbad04ae665d207bd16f80779646ca74f06688eaef |
| p4-9.json: nodes.7635.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-9.json: nodes.7636.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-9.json: nodes.7644.1.1.4 | chainDigest | 270d74a7f24bbbc7919a89a27c17f11374926d70727fd02e88b14272eb0f7aa8 | d8cccb939acff5bb9b6f214fb366c4d6ee301723c2b2ebd9a6ad1cfec3826945 |
| p4-9.json: nodes.7645.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-9.json: nodes.7646.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-9.json: nodes.7655.1.1.4 | chainDigest | eb42bf15eb7aa8181ce2d7e78208542be46a459c322970f12266818b5cb7428d | 45d4dd9d27e889cae2e650fe73aa890b7f641849bfd461d9ff2ed34086adb274 |
| p4-9.json: nodes.7656.1.1.4 | root | cf5402e6faaf7bf93f08cdef7bfa0dec5074e688e8205c4211c348aa97cfef36 | 970110fdec63b08b06046c9f8d65357bda1911950e757270e78d244788f70d65 |
| p4-9.json: nodes.7657.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-9.json: nodes.7659.1.1.4 | root | 5d2a799685e257f4c135a146bbd713f0b2e5359ed8ee6bc174f46c34f7ca9f4c | 158979f9a498e28d1075c9306ab5591948e9518947a1d1916470b024ddcc4df5 |
| p4-9.json: nodes.7660.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-9.json: nodes.7668.1.0.4 | foundation | 8 | 9 |
| p4-9.json: nodes.7671.1.1.4 | root | 30aede1e431d61ec6a8d7202cd9dd5b2f54e121137e9fc1b00cf88bf19419778 | 22ce854b53eaad019e2df233e700c2f9459c3c255eeeea18faee1158484bb73b |
| p4-9.json: nodes.7672.1.1.4 | extensions | 00cab03605e667ad22ff21c2dfc664840c2fbc4213255d686e530e0a0bb13f51 | 87e6907b43755437da324df5852390f0dbbee971c8b51cae0129a74afacae656 |
| p4-90.json: nodes.20087.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-90.json: nodes.20088.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-90.json: nodes.20089.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-90.json: nodes.20097.1.1.4 | chainDigest | a1b80f67bd6176478088692aa033b2eefc4208de7e3bf25a73313fe30c1f19d4 | c1c8f4d95a0dfbf33ac09efb19caca8c6ecaf90775fcf54ac35ba7be944aa5d3 |
| p4-90.json: nodes.20098.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-90.json: nodes.20099.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-90.json: nodes.20102.1.1.4 | root | 71dc938252119ec1d1f512602c37b75b47fd211058d9dab11c41d57c4ec7c59c | b3d7589015d753a95771d291ff5b14d1e8d111cb504e79cae24a6aa6be0731e4 |
| p4-90.json: nodes.20103.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-91.json: nodes.2151.1.3.4 | prefixDigest | a1b80f67bd6176478088692aa033b2eefc4208de7e3bf25a73313fe30c1f19d4 | c1c8f4d95a0dfbf33ac09efb19caca8c6ecaf90775fcf54ac35ba7be944aa5d3 |
| p4-91.json: nodes.2153.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-91.json: nodes.2154.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-91.json: nodes.2155.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-91.json: nodes.2163.1.1.4 | chainDigest | a1b80f67bd6176478088692aa033b2eefc4208de7e3bf25a73313fe30c1f19d4 | c1c8f4d95a0dfbf33ac09efb19caca8c6ecaf90775fcf54ac35ba7be944aa5d3 |
| p4-91.json: nodes.2164.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-91.json: nodes.2165.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-91.json: nodes.2168.1.1.4 | root | 71dc938252119ec1d1f512602c37b75b47fd211058d9dab11c41d57c4ec7c59c | b3d7589015d753a95771d291ff5b14d1e8d111cb504e79cae24a6aa6be0731e4 |
| p4-91.json: nodes.2169.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-91.json: nodes.2177.1.0.4 | foundation | 8 | 9 |
| p4-91.json: nodes.2184.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-91.json: nodes.2185.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-92.json: nodes.20087.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-92.json: nodes.20088.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-92.json: nodes.20089.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-92.json: nodes.20097.1.1.4 | chainDigest | a1b80f67bd6176478088692aa033b2eefc4208de7e3bf25a73313fe30c1f19d4 | c1c8f4d95a0dfbf33ac09efb19caca8c6ecaf90775fcf54ac35ba7be944aa5d3 |
| p4-92.json: nodes.20098.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-92.json: nodes.20099.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-92.json: nodes.20102.1.1.4 | root | 71dc938252119ec1d1f512602c37b75b47fd211058d9dab11c41d57c4ec7c59c | b3d7589015d753a95771d291ff5b14d1e8d111cb504e79cae24a6aa6be0731e4 |
| p4-92.json: nodes.20103.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-94.json: nodes.20123.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-94.json: nodes.20124.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-94.json: nodes.20125.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-94.json: nodes.20133.1.1.4 | chainDigest | 49592e6576a81f50f3768279081e7f51f9e72ac244024eb5d12b91a2a59fe52b | 28d9015f6b357f4f230fc6d6dd5c47c9818742e1089d40098cbbecf3604510b6 |
| p4-94.json: nodes.20134.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-94.json: nodes.20135.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-94.json: nodes.20144.1.1.4 | chainDigest | 7e26e17424a9976f3ed4a593ce6c49ca69a84239606764b2b6eea4500a92ef14 | 6b88dd8916d39e3eed3f2394ce0d95c562db5f088036cb307f56ef7943755aae |
| p4-94.json: nodes.20145.1.1.4 | root | ce087a39e64596844a84ef11049cec885d25bd7931559616ba588807e31ebcc8 | 544d5c53c88af0e9b5d0dfbc74a55552adc35d17bad7ff4522c29ba033ef589e |
| p4-94.json: nodes.20146.1.1.4 | extensions | 9d76e273848d6302705e3deef783281f00a2bc676eee1e727c7755b280d64ea9 | 538f2cead0346192f1d08b1acfcf1622608ddd90b90a2c34dac143e9796bcd5e |
| p4-94.json: nodes.20154.1.1.4 | chainDigest | 024b942499f945f79480b24b121c09e66456d918d5833d66602f8f0a688816fb | 6c08778f9aaa39b14b41dc7b8329ff4a0fe5e23db7e4d4e798a76d1e26c0c1ce |
| p4-94.json: nodes.20155.1.1.4 | root | 992686d1bbf1d88c2b7639364ea2ee3c85e04c14891b9b1c1861e028c029c2a4 | 7562a361490c00c92b9cb454ec421d8c24cc46a06d561c3ab8fcecec3c0c2429 |
| p4-94.json: nodes.20156.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-94.json: nodes.20158.1.1.4 | root | 3781af0db399318bdd505668808e376b480cc99020540a740995b1ba71f8ef61 | ecfe6baf985bd1c1b35810501ea2d6c55e2007dfee01925103ec603b47829521 |
| p4-94.json: nodes.20159.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-95.json: nodes.2189.1.3.4 | prefixDigest | 024b942499f945f79480b24b121c09e66456d918d5833d66602f8f0a688816fb | 6c08778f9aaa39b14b41dc7b8329ff4a0fe5e23db7e4d4e798a76d1e26c0c1ce |
| p4-95.json: nodes.2191.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-95.json: nodes.2192.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-95.json: nodes.2193.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-95.json: nodes.2201.1.1.4 | chainDigest | 49592e6576a81f50f3768279081e7f51f9e72ac244024eb5d12b91a2a59fe52b | 28d9015f6b357f4f230fc6d6dd5c47c9818742e1089d40098cbbecf3604510b6 |
| p4-95.json: nodes.2202.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-95.json: nodes.2203.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-95.json: nodes.2212.1.1.4 | chainDigest | 7e26e17424a9976f3ed4a593ce6c49ca69a84239606764b2b6eea4500a92ef14 | 6b88dd8916d39e3eed3f2394ce0d95c562db5f088036cb307f56ef7943755aae |
| p4-95.json: nodes.2213.1.1.4 | root | ce087a39e64596844a84ef11049cec885d25bd7931559616ba588807e31ebcc8 | 544d5c53c88af0e9b5d0dfbc74a55552adc35d17bad7ff4522c29ba033ef589e |
| p4-95.json: nodes.2214.1.1.4 | extensions | 9d76e273848d6302705e3deef783281f00a2bc676eee1e727c7755b280d64ea9 | 538f2cead0346192f1d08b1acfcf1622608ddd90b90a2c34dac143e9796bcd5e |
| p4-95.json: nodes.2222.1.1.4 | chainDigest | 024b942499f945f79480b24b121c09e66456d918d5833d66602f8f0a688816fb | 6c08778f9aaa39b14b41dc7b8329ff4a0fe5e23db7e4d4e798a76d1e26c0c1ce |
| p4-95.json: nodes.2223.1.1.4 | root | 992686d1bbf1d88c2b7639364ea2ee3c85e04c14891b9b1c1861e028c029c2a4 | 7562a361490c00c92b9cb454ec421d8c24cc46a06d561c3ab8fcecec3c0c2429 |
| p4-95.json: nodes.2224.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-95.json: nodes.2226.1.1.4 | root | 3781af0db399318bdd505668808e376b480cc99020540a740995b1ba71f8ef61 | ecfe6baf985bd1c1b35810501ea2d6c55e2007dfee01925103ec603b47829521 |
| p4-95.json: nodes.2227.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-95.json: nodes.2235.1.0.4 | foundation | 8 | 9 |
| p4-95.json: nodes.2242.1.1.4 | root | 41be0a0bf3505731abf045e4c18808c17aca45aaeef384b1893746000d97849c | 0467d7d8a0f15dfcd47ccf4850e85e696b494dbef51c3df5caf8a9e5c40a1664 |
| p4-95.json: nodes.2243.1.1.4 | extensions | fbf82686753079f6db91f49a9454f9262a2fdd706df898f22beb0244903a3670 | e287c98dce6037b401649a201909cb384e27296405142c11939489b912c3ada6 |
| p4-96.json: nodes.20155.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-96.json: nodes.20156.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-96.json: nodes.20157.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-96.json: nodes.20165.1.1.4 | chainDigest | 49592e6576a81f50f3768279081e7f51f9e72ac244024eb5d12b91a2a59fe52b | 28d9015f6b357f4f230fc6d6dd5c47c9818742e1089d40098cbbecf3604510b6 |
| p4-96.json: nodes.20166.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-96.json: nodes.20167.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-96.json: nodes.20176.1.1.4 | chainDigest | 7e26e17424a9976f3ed4a593ce6c49ca69a84239606764b2b6eea4500a92ef14 | 6b88dd8916d39e3eed3f2394ce0d95c562db5f088036cb307f56ef7943755aae |
| p4-96.json: nodes.20177.1.1.4 | root | ce087a39e64596844a84ef11049cec885d25bd7931559616ba588807e31ebcc8 | 544d5c53c88af0e9b5d0dfbc74a55552adc35d17bad7ff4522c29ba033ef589e |
| p4-96.json: nodes.20178.1.1.4 | extensions | 9d76e273848d6302705e3deef783281f00a2bc676eee1e727c7755b280d64ea9 | 538f2cead0346192f1d08b1acfcf1622608ddd90b90a2c34dac143e9796bcd5e |
| p4-96.json: nodes.20186.1.1.4 | chainDigest | 024b942499f945f79480b24b121c09e66456d918d5833d66602f8f0a688816fb | 6c08778f9aaa39b14b41dc7b8329ff4a0fe5e23db7e4d4e798a76d1e26c0c1ce |
| p4-96.json: nodes.20187.1.1.4 | root | 992686d1bbf1d88c2b7639364ea2ee3c85e04c14891b9b1c1861e028c029c2a4 | 7562a361490c00c92b9cb454ec421d8c24cc46a06d561c3ab8fcecec3c0c2429 |
| p4-96.json: nodes.20188.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-96.json: nodes.20190.1.1.4 | root | 3781af0db399318bdd505668808e376b480cc99020540a740995b1ba71f8ef61 | ecfe6baf985bd1c1b35810501ea2d6c55e2007dfee01925103ec603b47829521 |
| p4-96.json: nodes.20191.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-98.json: nodes.20283.1.1.4 | chainDigest | 4c1b8cdad2e2446234fa840568f98f6bdcb924e16e545b677d89d489754709c8 | 7943fed443a644f10f89a825097d065cd1f61487b5427915f76308e6f7abcab7 |
| p4-98.json: nodes.20284.1.1.4 | root | da9fff51a39d5634a3cf7007f3d6c0fdf4ce818a260f8f7fdd76c91d13a231ee | 6d44dd1ed17c9e065dbd5e8abf709b4aa5028215cd02bbd024836b6bdb9631da |
| p4-98.json: nodes.20285.1.1.4 | extensions | 78d8e0262b8c8e26e989da1c0578c5b3dad30541f04caa70407b231d7e907b42 | f7807e12b4f1d6ab1afe2764d0f40476b421571b1ca0f3387af72ea387a6c499 |
| p4-98.json: nodes.20293.1.1.4 | chainDigest | 49592e6576a81f50f3768279081e7f51f9e72ac244024eb5d12b91a2a59fe52b | 28d9015f6b357f4f230fc6d6dd5c47c9818742e1089d40098cbbecf3604510b6 |
| p4-98.json: nodes.20294.1.1.4 | root | 956ead8e4155e6f851f360e61e157bf0893b95ad65e633f1be4be82510f7d6b9 | 126d2000da093d9dd750f7cd0c1d76f260c8385e7f505c781c40a4d345b42743 |
| p4-98.json: nodes.20295.1.1.4 | extensions | 08c7f812e33a5641f0ff0a8ee59f01b2d50bc2e8b19c2eea9a723037d308f289 | c9780dce189710e4dcd949fa0cbf7bfec8008bcebc503fd5b0146dc39a148526 |
| p4-98.json: nodes.20304.1.1.4 | chainDigest | 7e26e17424a9976f3ed4a593ce6c49ca69a84239606764b2b6eea4500a92ef14 | 6b88dd8916d39e3eed3f2394ce0d95c562db5f088036cb307f56ef7943755aae |
| p4-98.json: nodes.20305.1.1.4 | root | ce087a39e64596844a84ef11049cec885d25bd7931559616ba588807e31ebcc8 | 544d5c53c88af0e9b5d0dfbc74a55552adc35d17bad7ff4522c29ba033ef589e |
| p4-98.json: nodes.20306.1.1.4 | extensions | 9d76e273848d6302705e3deef783281f00a2bc676eee1e727c7755b280d64ea9 | 538f2cead0346192f1d08b1acfcf1622608ddd90b90a2c34dac143e9796bcd5e |
| p4-98.json: nodes.20314.1.1.4 | chainDigest | 024b942499f945f79480b24b121c09e66456d918d5833d66602f8f0a688816fb | 6c08778f9aaa39b14b41dc7b8329ff4a0fe5e23db7e4d4e798a76d1e26c0c1ce |
| p4-98.json: nodes.20315.1.1.4 | root | 992686d1bbf1d88c2b7639364ea2ee3c85e04c14891b9b1c1861e028c029c2a4 | 7562a361490c00c92b9cb454ec421d8c24cc46a06d561c3ab8fcecec3c0c2429 |
| p4-98.json: nodes.20316.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |
| p4-98.json: nodes.20318.1.1.4 | root | 3781af0db399318bdd505668808e376b480cc99020540a740995b1ba71f8ef61 | ecfe6baf985bd1c1b35810501ea2d6c55e2007dfee01925103ec603b47829521 |
| p4-98.json: nodes.20319.1.1.4 | extensions | c0c5f189f8fdd7da03787294ae17c529fca3fbe6fbca32b3614ca6ae5fbf8872 | 0b588075e063fdd92c0f4467ed3b990f27295eb31e7d7c75570191e94efdfb94 |

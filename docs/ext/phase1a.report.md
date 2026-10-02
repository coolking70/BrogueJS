# EXT-1a：配置驱动的经验与等级

分支：`ext/foundation`。已验收基线：`51897db932b5ffa3480c8f6f8ace5da86364cd2d`，开工时精确核对远端相同。没有再次合并 main。

状态：**1a 完成，最终完整/CE 门禁全部通过**。停在 1a，等待维护者确认下一步；没有启动 1b。

## 验收入口与运行范围

- [完整配置字段及当前接线状态](growth-config.md#11-1a-的实际运行状态后续归属不变)
- [24 项表达审计与 P01–P07 归属](growth-expression-audit.md)：归属不变；本步只接必要 P04/P07 基础和中性 P06 创建边界
- [扩展底座当前架构](architecture.md#10-1a成长实际接线与安全提交)

1. 默认扩展局启用真实 growth；菜单新局建立后立即通过原 `executeCommand` 录一条 `{module:"growth",action:"create-character",payload:{revision:0}}`。半创建局不能行动/持久保存；重复、过期、未知或带任意 actorId 的输入，在改模拟/UI/录像来源前拒绝。录像预检要求首条创建且不重复。example 仍可显式选择，经典不创建扩展运行时
2. 击杀、首访、真正种类鉴定、受信配置剧情奖励的来源开关/金额/范围/总额上限全部读配置。击杀引用提交出生固定报价、真实致死效果和当时/当前关系凭证；没有 last-hit 栈兜底。XP 排队到最终命令/动画/强制回合安全点；没有录像来源的动画局同样结算
3. 真正生成入口标自然/召唤/分裂/克隆/周期/脚本/测试，原种类/初始敌对固定；出生、变形、复活和重访不会重置奖励身份。自然环境、行政移除、不合资格出生为零。盟友份额按配置基点/舍入分配，余数只给实际责任者，不复制总额
4. 等级表/曲线、封顶、逐级发点、L1 计划、跳级、自动最大生命及 HP/专注/冷却重置都读配置。曲线/计划/分配中间运算使用 BigInt 精确验证安全整数；不靠浮点舍入放过溢出。原生 maxHp 只按 appliedMaxHp 差额更新，加载不重加；死亡者不会被回复复活
5. 必要生命周期桥覆盖真正复制体和新召唤物的区别、变形、召唤者形态恢复/复活。NPC 不使用玩家创建满血策略；复制体移除复制的旧自动加值再应用中性组件；新的召唤物不减召唤者加值。恢复原生形态后补回已有自动加值，若原流程短暂留下超上限当前 HP 则钳制
6. 组件/关系摘要/收据/来源因果/原生资源及机械实体引用在退休旧局前校验。来源主体离场/死亡后仍可由持久摘要辨认；不再被效果引用的摘要可回收。原存档观察历史可保留尸体，但不会迫使成长组件或 hooks 继续存在

`growth` 精确版本由 `1.0.0` 升为 `1.1.0`；数据 schema 仍为 1。当前包指纹：`sha256:f599eb4e174505facb543be48cc9e16fd63d1d7297d122980842b270db2bdb71`。旧版本及同版本换包拒绝，不做旧档迁移。foundation 既有版本仍为 1。

### 明确未启用

- 通用属性/条件/端口求值、分配/洗点、物品换算归 1b；没有顺手执行 P01
- 角色 HUD/面板归 1c；本步只有原菜单新局的通用创建命令接线与升级消息，没有新增面板，也未做真实浏览器/手机验收
- 技能动作、客观恢复/冷却时钟、临时效果/消费/中断归 1d；只保存专注/readyAt 并实现升级资源政策基础，等待不会在本步恢复专注
- 身份/誓约触发、怪物模板、可配置克隆构筑继承和盟友自动分配归 1e；1a 的生物组件为中性，首访资源 helper 没有启用信仰效果
- 未做职业/技能平衡、自然奖励分布或固定种子目标升级曲线校准；下方固定种子只测性能

## 实际修改的引擎文件与门禁档位

实际 4 个引擎/实体规则文件：

- `src/engine/Core/Game.ts`：真实出生入口/队伍凭证、创建输入/存档/录像守卫、安全结算与机械根加载
- `src/engine/Core/GenerationCoordinator.ts`：两处蓝图出生事实接线，不改变经典生成/RNG 算法
- `src/engine/Items/ItemLoader.ts`：实际知识提交/推断的只读事实，经典模式无扩展观察者
- `src/entities/Monster.ts`：关系变动和原生最大生命重置的窄通知

因此按用户 1a 升档规则执行完整/CE 档：`npx vue-tsc -b`、`npm run build`、尽力 `npm run ce:fetch`、完整 `npm run test:full`、`npm run test:drift`。**test:full 替代 npm test，不重复两个全量套件。** 没有新增 Game 实例字段，U03 字段表未改。

其它生产改动位于 `src/ext/`、默认配置、中文资源，以及 `src/App.vue` 的一行新局创建派发。经典 CE 测试、黄金 trace、生成基线和读源码守卫均未改。截图、缓存、完整原始日志和全量散列不提交。

## 新测试与独立复核

新增 5 文件、84 用例：

| 文件 | 主要覆盖 |
|---|---|
| `ext_growth_progression`（28） | 每个默认阈值±1、表/曲线、多级跳升、L1/逐级发点、封顶、MAX 安全整数、HP差额及回复/冷却策略、死者保留、严格组件 |
| `ext_growth_births`（17） | 真实楼层/蓝图/周期机器/召唤/幻影/复制/分裂/测试房出生，初始敌对/原种类及真正复制事实，经典零标注、读档不重生 |
| `ext_growth_runtime`（12） | 默认 growth、中性创建和非法输入、实际安全点奖励、配置开关/报价/分配、保存/回放/seek/续录、历史版本/组件拒绝、显式 example 全链路、经典零扩展 |
| `ext_growth_lifecycle`（16） | 新召唤/复制/变形/实际复活的生命一致性，无录像来源动画结算，真实知识/推断及开关/上限，真实 D2 首访/重访/加载，非法原生资源拒绝 |
| `ext_growth_sources`（11） | 实际 SPARK 盟友反射 6/2 分配、解盟再入队旧凭证拒绝、实际 POISON→来源离图→保存/加载→毒杀，坏来源引用拒绝、历史尸体、受信剧情开关/收据/公共伪造拒绝 |

预检：全部 `ext_` 13 文件 / 225 用例通过；全部生产读源码守卫 146 快速实例 + 3 重型原普查实例通过。重型普查仍执行原生成集合/原断言，没有提取替换为 mock。预检不是完整门禁替代品。

只读复核发现并已修复：盟友反射误用主角关系凭证、来源摘要/关系/原生资源跨存档校验、无录制来源的动画结算遗漏、未知扩展输入破坏录像来源、新召唤物与复制体 maxHp 区分、变形/复活重置派生差额、观察历史实体误作机械保活根，以及首访累计溢出。持续复核另发现坏档预检构造临时 Player 会消耗实体 ID；已补分配器原位恢复，新增断言先复现 21→22，再证明拒绝保持 21，原世界/RNG/录制来源均保留。对应回归进入上表，定向复核没有剩余已确认阻塞。

## 经批准的历史测试初始化调整与单变量反事实

维护者明确批准：只改阶段 0/1a0 的 ext_* 测试初始化，显式选择原 example 或空状态合同探针；不改断言、容差、超时、skip，也不改经典/黄金/生成基线/源码守卫。

反事实在仓库外的隔离副本完成：以当前 1a 树为主体，仅将 `src/ext/catalog.ts` 的默认选择和工厂恢复 example/contract，并将 `growth/definitions.ts` 与 `definitions.json` 中该旧合同的精确 module/rules 版本恢复 1.0.0。其余 1912 文件逐字相同，原测试四文件的 SHA-256 一致；没有回退当前其余引擎/运行时修复。原初始化在当前激活树为 9 失败 / 75 通过，在仅回退激活/合同版本的树为 84/84 通过，均完整退出。

| 测试文件 / 用例名 | 原前提与唯一初始化调整 | 当前原初始化 / 单变量反事实 / 调整后 |
|---|---|---|
| `ext_foundation` / orders first generation/entry hooks and reports committed pickup/use without rejected uses | 公用 extended() 以前隐含 example；显式 extensions:['example'] | 失败 / 通过 / 通过 |
| `ext_foundation` / emits spawn once on ownership, attack/damage/kill/turn in simulation order and unloads old creatures | 同一公用 example 初始化 | 失败 / 通过 / 通过 |
| `ext_foundation` / demonstrates example kill message/count, administrative exclusion and exact save/load without replayed spawn hooks | 同一公用 example 初始化 | 失败 / 通过 / 通过 |
| `ext_foundation` / rejects unavailable sets, wrong module versions/state and stripped extended headers before retiring the current game | 同一公用 example 初始化 | 失败 / 通过 / 通过 |
| `ext_foundation` / replays a natural example kill, seek and save continuation with exact extension/RNG checkpoints | 同一公用 example 初始化 | 失败 / 通过 / 通过 |
| `ext_growth_foundation_contracts` / validates source/death records atomically, without retiring a currently running game | 旧默认 example 无创建前置；本用例显式 example | 失败 / 通过 / 通过 |
| `ext_growth_foundation_contracts` / finalizes animated checkpoints after collection and reproduces the same save/replay envelope | 旧默认 example 无创建前置；本用例显式 example | 失败 / 通过 / 通过 |
| `ext_growth_foundation_contracts` / records and restores the actual sample data identity without enabling growth gameplay | 显式注册空状态合同工厂和原 1.0.0 测试包络；实际数据指纹仍计算并检查，不把生产 growth 改回空模块 | 失败 / 通过 / 通过 |
| `ext_hardening` / rejects malformed save event containers before replacing classic or extended live state | 循环的 extended 分支显式 example；classic 初始化不变 | 失败 / 通过 / 通过 |

三文件原有 154 行含 expect 的断言逐行保持一致；没有删断言或改变 skip/超时/容差。原 example 注册/事件/存读档/录像全链路和空状态探针仍实跑；新增真实 growth 默认、example 显式、经典隔离覆盖不借旧探针冒充。

```text
当前原初始化：Test Files 3 failed | 1 passed (4); Tests 9 failed | 75 passed (84); exit 1
单变量反事实：Test Files 4 passed (4); Tests 84 passed (84); exit 0
调整后相关合集：Test Files 9 passed (9); Tests 168 passed (168); exit 0
最终全部扩展预检：Test Files 13 passed (13); Tests 225 passed (225); exit 0
```

## 最终门禁结果

执行环境：云端 Linux / Node v24.19.0 / npm 11.9.0，TZ=UTC、NODE_OPTIONS=--max-old-space-size=3072。完整套件 2 worker，drift 1 worker；原测试超时、断言、套件集合不变。`--bail=1` 只在失败时提前终止，不把部分成功当完整通过。

首轮完整运行在发现上述预检 ID 问题后主动中止，退出 130，不计完整通过；修复后 4 文件 / 53 例、146 快速源码守卫及最终生产下单变量反事实 84/84 再次通过。随后从类型检查起完整重跑，本轮全部退出 0；下列为该唯一最终完整运行的结果，不拼接前一中断轮次。原始文件位于执行 checkout 内忽略目录 `tmp-phase1a-raw/`。

### `npx vue-tsc -b`、`npm run build`、`npm run ce:fetch` — 均 exit 0

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=14 2026-10-02T09:43:28Z
✓ built in 5.81s
END build EXIT_CODE=0 DURATION_SECONDS=21 2026-10-02T09:43:49Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T09:43:49Z
```

构建仍提示大于 500 kB 的产物警告，构建退出 0；未修改该警告门限。

### `npm run test:full -- --maxWorkers=2 --reporter=verbose --bail=1` — exit 0

```text
 Test Files  280 passed (280)
      Tests  4974 passed | 8 skipped | 5 todo (4987)
   Start at  09:43:50
   Duration  5754.68s (transform 9.04s, setup 0ms, import 192.59s, tests 11273.62s, environment 109ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=5756 2026-10-02T11:19:45Z
```

### `npm run test:drift -- --maxWorkers=1` — exit 0

```text
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  11:19:45
   Duration  49.96s (transform 1.24s, setup 0ms, import 1.96s, tests 47.84s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=50 2026-10-02T11:20:35Z
FINAL all_gates=0 2026-10-02T11:20:35Z
```

CE 参照可用，BROGUE_REQUIRE_CE=1 下全部活动 CE 对照已执行，**没有因缺参照/联网失败而跳过的 CE 用例**。原有 8 skip 是 P2-1/P2-2/P2-3 退役测试；5 todo 是 smoke 历史占位，以及 CombatFormulas 的 weaponSlowDuration、weaponConfusionDuration、weaponImageCount、weaponForceDistance 四个历史占位。这些未执行，不把它们声称为已验证；本步没有新增 skip/todo。

最终类型/构建/完整 CE/drift 前后 594 个生产/测试/脚本/资源输入聚合 SHA-256 相同：`8aec4a68979ee9c78e6c6d50371aff563a686b3bbf2ed5fea67b0945876e3aa8`。最终门禁后只整理文档，未再改源码或测试。JSON.parse/重复键、LF、git diff --check 及授权文件范围均核对；生成基线/黄金 trace/U03 字段清单未改。

合入 main 前，维护方仍须按用户要求在本机另行完整运行 test:full；本步没有执行或授权该合并。

## checkpointGenerationWorld 性能基线（仅观测，未优化）

- 精确基线：接受的 1a0 提交 `51897db932b5ffa3480c8f6f8ace5da86364cd2d`，Git tree `b7dea8137e52db77f8edcde8409ee2d9e4f5a29b`。用 `git archive` 冻结到忽略目录后编译探针；并发的 1a 工作区修改不进入结果。已加载的生产输入逐文件 SHA-256 与汇总 `a5dec894979111bac474f14fd68da8d4392d6003ec241a4fe81cab798abe151a` 见原始 JSON
- 2026-10-02 UTC；Linux x64 / Node v24.19.0，AMD EPYC 9V74（OS 报告 9 CPU）、9.73 GiB RAM，单探针进程，`NODE_OPTIONS=--max-old-space-size=3072`。固定 seed 424242，normal 模式、显式 growth 扩展；1 次 D1–D5 预热后 5 次完整重复，共 25 个正式样本；模块单例/构造器/经典准备也会先运行生成，因此不是冷启动测试
- 每次用新 Game 与固定同 seed 的经典 D1 做测量前准备，再真实 startNewGame 进入扩展 D1；D2–D5 只在测试侧把玩家置于生成的下行梯，调用 executeCommand('stairs_down')。不进行走路/战斗；D1 捕获包含准备阶段遗留、尚未被替换的经典网格，D2–D5 逐层保留真实缓存

### 每层耗时（ms，中位数；括号为 5 次 min–max）

| 进入层 | 完整 Game.generateDepth | 检查点捕获 | 原 coordinator 生成/进入 | 捕获占完整入口 |
|---|---:|---:|---:|---:|
| D1 | 119.4 (116.6–136.9) | 30.2 (29.7–34.0) | 88.1 (86.0–102.4) | 25.8% |
| D2 | 156.3 (147.2–166.7) | 53.6 (48.3–56.0) | 101.8 (98.6–111.3) | 33.3% |
| D3 | 228.8 (227.9–251.5) | 117.6 (115.9–118.6) | 111.4 (109.1–133.3) | 50.9% |
| D4 | 266.5 (248.9–274.2) | 178.5 (168.3–183.4) | 85.4 (80.2–92.5) | 67.4% |
| D5 | 427.3 (422.1–487.1) | 231.8 (221.8–255.3) | 201.0 (189.9–231.2) | 53.5% |

完整入口计时包含检查点、生成及扩展发布；coordinator 包含地图/种群生成、环境补算、入层落位与视野，不能把整段都称为纯挖图。两者之外的入口开销中位数为 D1 0.4 ms、D2 0.4 ms、D3 0.5 ms、D4 0.6 ms、D5 0.6 ms。D1 的整次 startNewGame 与 D2–D5 的整次命令耗时另在原始 JSON，未混入以上函数口径。捕获是原实现的对象属性描述符/Map/Set/typed-array 快照，不是 structuredClone；未触发回滚。

### 内存粗测（MiB，中位数）

| 进入层 | 捕获即时 ΔheapUsed / ΔRSS | 完整入口即时 ΔheapUsed / ΔRSS | 动作后 GC 相对动作前 GC 的 ΔheapUsed |
|---|---:|---:|---:|
| D1 | 35.24 / 1.25 | 12.82 / 0.89 | -13.26 |
| D2 | 59.82 / 1.50 | 54.27 / 0.89 | 2.69 |
| D3 | 45.21 / 2.52 | 65.28 / 2.64 | 2.68 |
| D4 | 69.14 / 5.48 | 100.31 / 5.57 | 2.64 |
| D5 | 93.64 / 6.39 | 95.48 / 7.39 | 2.92 |

只在每次动作前/后显式 GC，计时区间内不强制 GC，V8 仍可自动回收。即时差额受先前垃圾、V8 扩堆/回收与 OS 页面保留影响，不是累计分配量、保留大小或峰值；例如 coordinator 的 heap 差额可为负。GC 后增长也包含新楼层的真实保留状态，D1 的负值还包含新局重置释放准备世界的效果。观测采样点最高 RSS 330.2 MiB，不是连续峰值。未隔离宿主机调度；小样本不提供置信区间/浏览器交互延迟结论。所有 6 次同层的 RNG/实体数量/物品数量/缓存深度记录一致，但这不是完整正确性门禁。

### 100 ms 阈值与缩窄范围建议（未实施）

D3–D5 捕获每一次正式样本都超过 100 ms，D5 中位数 231.8 ms。独立、不参与计时的图遍历普查显示：D1 捕获 16,988 个对象/124,213 个自有属性描述符；D5 为 89,087/921,931。D5 的三个缓存层 D1–D3 占 687,338 个描述符（约 74.6%），当前层 waypoint 图另占 109,462；根为整个 Game 会递归复制历史楼层、派生图与录像容器。此处“对象数”对应恢复闭包数，跳过 frozen、weak 容器与 runtime；按首次访问路径归组，共享对象不重复计数。

后续应独立提案：将 Game 顶层指针/标量的浅快照与可写对象的深快照分开，明确 generation 写集；保留玩家、离层怪物、已有目标层（重访时）的环境/实体/网格、全局鉴定集合及原有弱会话状态恢复，只按需复制真正可能被修改的楼层数据。未触达缓存楼层的网格/光照/环境/waypoint 大图可优先审计为引用保留；录像/显示数据可审计是否只需保存引用/长度。不能粗暴排除整个 levels 或缓存怪物：`demoteMonsterFromLeadership` 会遍历跨层实体并改 leader/waypoint 标志，`monstersFall` 可向已缓存下一层写 monsters，pending fallen 队列也会变化。须用跨层关系、重访、坠落、生成/发布异常后的原对象身份、RNG/消息与世界回滚守卫证明缩窄安全，再同口径复测；本轮没有改复制策略。

定位按 51897db：`GenerationCoordinator.ts:44–77` 捕获算法、`Game.ts:1300–1363` 完整扩展入口、`GenerationCoordinator.ts:223–410` 换层/生成/补算、`LevelTravel.ts:50` 离层追随调度、`Game.ts:8210` 缓存坠落接收、`Game.ts:10974` 跨层领导关系修改。

### 原始证据与复现

均在本 checkout 已忽略的 `tmp-phase1a-raw/`，没有新增 tracked 脚本、修改生产文件或重录基线：`performance-results.json`（逐次耗时/CPU/内存/最终状态）、`performance-probe.log`、`performance-summary.json`、`performance-census.json`、`performance-input-hashes.json`、冻结源 `perf-baseline-51897db/`；探针源/编译器为 `performance-probe.ts` / `build-performance-probe.mjs`。

复现：仓库根执行 `node tmp-phase1a-raw/build-performance-probe.mjs`，再 `NODE_OPTIONS=--max-old-space-size=3072 TZ=UTC node --expose-gc tmp-phase1a-raw/performance-probe.mjs`。实测退出 0。这是 1a0 基线，不是 1a 最终性能验收；最终实现如需对比必须重新冻结对应源码测量。

## 1a 当前生产冻结样本（追加，保留上方 1a0 基线）

- 本样本替代 09:13 的 1a 当前样本：后者在 loadSnapshot 临时 Player 解码的拒绝路径 ID 分配器原子性修复前捕获；新旧逐文件清单仅 Game.ts 有变化。此前全部输出与报告原样保存在 `tmp-phase1a-raw/performance-1a-superseded-20261002T091347Z/`，原 1a0 基线继续保留
- 冻结时间：2026-10-02T09:42:59.408852+00:00；基于 HEAD 51897db 的未提交 1a 生产实现，不把 HEAD 当成已测生产身份。全部生产/构建配置 SHA-256：`d904726c2e7026030c477184b79b28cb7b4d67a6acb015523d7d3ca7dff90f8b`；实际导入生产闭包 SHA-256：`5250afd534510cd4053c1eea73585956a2aaaafded7812f700fee0792e0778c7`。逐文件清单分别为 `performance-1a-final-source-snapshot.json` / `performance-1a-final-input-hashes.json`
- 冻结源在仓库之外：`/workspace/scratch/db2caf941a8f/cloud-extension-evidence/perf-1a-final-20261002T094259Z`，已排除所有测试文件，没有再往仓库内复制测试。原 1a0 冻结源已移至 `../cloud-extension-evidence/perf-baseline-51897db/`，原探针引用同步更新；上方基线结果未重算或替换
- 同样 seed 424242、normal 模式、growth 扩展、1 次 D1–D5 预热 + 5 次正式重复、Node v24.19.0 / 3 GiB 堆上限 / 显式 GC 口径。D1 startNewGame 完成计时和 GC 采样后，实际 executeCommand('ext:command', JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}}))；确认 created=true、恰好 1 条创建命令、RNG 不变，才测 D2–D5。创建命令本身不计入 D1；5 次创建耗时 2.0 (1.9–2.6) ms，D2 起的缓存/录像状态包含该真实命令
- 重新测量开始前，重型 classic/source-guard 进程已完成，全量门禁暂停处理该修复回归；没有为本探针主动并行启动重套件。系统 1 分钟 load 仍为 2.17→2.23（原基线 0.07→0.21），因此不声称空闲/隔离宿主机。未控制 CPU/GC/宿主机调度，**下面仅并列两个状态的样本，不构成严格的优化收益或性能退化归因**；与已归档的争用样本之间的时差也不能算优化收益。1a 功能与初始命令已不同于 1a0

### 当前耗时与旧基线并列（ms；当前中位数及 min–max）

| 进入层 | 1a0 完整 / 捕获中位数 | 当前完整 Game.generateDepth | 当前检查点捕获 | 当前 coordinator 生成/进入 |
|---|---:|---:|---:|---:|
| D1 | 119.4 / 30.2 | 122.1 (118.1–137.3) | 30.4 (29.4–36.7) | 90.4 (84.5–99.5) |
| D2 | 156.3 / 53.6 | 153.0 (151.1–163.1) | 50.7 (49.5–65.4) | 100.2 (95.4–101.5) |
| D3 | 228.8 / 117.6 | 233.6 (232.3–250.0) | 122.9 (113.4–134.0) | 112.0 (107.0–114.2) |
| D4 | 266.5 / 178.5 | 275.8 (265.4–286.6) | 185.4 (173.0–197.6) | 86.6 (83.4–93.9) |
| D5 | 427.3 / 231.8 | 476.8 (439.9–522.2) | 251.7 (241.3–271.3) | 215.8 (191.1–243.2) |

当前 D3–D5 捕获每个正式样本仍 >100 ms；D5 完整/捕获中位数 476.8/251.7 ms。此次未改变捕获实现或尝试优化；上方写集缩窄建议仍是待独立审计的后续方案。计时区间与上方一致，coordinator 仍包含环境补算/落位/视野，不能当成纯地图生成。

### 当前内存粗测（MiB，中位数）

| 进入层 | 捕获即时 ΔheapUsed / ΔRSS | 完整入口即时 ΔheapUsed / ΔRSS | 动作后 GC 相对动作前 GC 的 ΔheapUsed |
|---|---:|---:|---:|
| D1 | 35.16 / 1.25 | 13.67 / 0.80 | -13.43 |
| D2 | 60.03 / 1.50 | 55.89 / 0.89 | 2.74 |
| D3 | 45.42 / 2.52 | 66.81 / 2.52 | 2.72 |
| D4 | 69.69 / 5.52 | 104.50 / 5.52 | 2.72 |
| D5 | 94.55 / 6.39 | 103.72 / 7.27 | 2.97 |

采样点最高 RSS 330.9 MiB；仍非连续峰值，heap 差额仍非累计分配/对象保留大小。D1 GC 后负值包含新局重置释放准备世界；正式 D1 内存采样在 create-character 前，D2 起包括创建后的真实状态。所有 6 次同层 RNG/实体数量/物品数量/缓存深度记录一致。

测量后 2026-10-02T09:43:48.017195+00:00 检查：全部已冻结生产/配置路径与当前工作区仍一致。这不替代最终门禁：提交前应用 `performance-1a-final-verify-source.py` 再核对与最终源码一致；若有后续生产编辑，按清单判断是否需要重测。

原始文件均在 `tmp-phase1a-raw/performance-1a-final-*`：`results.json` / `probe.log` / `summary.json` / `source-snapshot.json` / `source-check.json` / `input-hashes.json`，以及 `probe.ts` / `build.mjs` / `verify-source.py`。复现：`node tmp-phase1a-raw/performance-1a-final-build.mjs` 后执行 `NODE_OPTIONS=--max-old-space-size=3072 TZ=UTC node --expose-gc tmp-phase1a-raw/performance-1a-final-probe.mjs`；此次退出 0，无生产修改、无复制策略优化。

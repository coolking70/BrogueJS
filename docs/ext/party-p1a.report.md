# Party P1a 实施报告

本文保留首轮实现证据；生产实现以“R2 最后一轮审查处理与作者同类自查（2026-10-18）”为准，已提交为 `18070b2`。最新性能工具补丁、两条云端派发命令及本地冒烟见文末“云端性能派发修复（2026-10-18）”；该补丁未提交。首轮性能和物理全删结果仍对应修复前身份。

## 范围与裁定

维护者于 **2026-10-18** 批准 M1–M11 全部按推荐实施，M5 为精简门禁；M6–M11 的决定和日期已回填 [任务单](party-p1a.task.md) §10，并同步 [合同](party-contract.md)。本轮基于 `ext/party-p1a` / `e3ec8f49f8a7c6f827ecb04dac7304a441c960e6`，开工工作区干净。设计正文未在该工作树内，读取了 `origin/ext/party-design:docs/ext/party-multiplayer-design.md`（`8bd271b4bc26dea697ca8af1257240d848f3665d`）。没有 commit、推送或触发云端工作流。

实现本地单控制槽的 1–4 成员队伍，包括原生动作、独立成长/物品根、阶段5生产、跨层冻结、持久化/录制、创建流程和最小 HUD。不包含联网、多活动层、旧档迁移、P1b 性能预算。浏览器和真机验收按用户指令留给维护者；[清单](party-p1a.manual-checklist.md) 中全部标为待验，SFC 和 Node Worker 证据不替代浏览器。

## 实现与身份

### 权威、时间和原生能力

- `Game.player` 始终是唯一主成员 `Player`。原生能力提取为 `ControlledActor`，其他成员为 `PartyMember`，拥有独立实体、库存、装备别名、状态、计时及搜索/坠落/待结算状态。成员不伪装成原生 Monster，不额外执行 `Monster.takeTurn`。
- `party:actor-step` / `party:control` 的 schema、成员、`local:0` 控制槽、revision、目标和负载严格校验。所有改状态入口仍经过 `executeCommand` / `executeItemCommand`；非法或陈旧输入在写入和录制前拒绝。模块纯准备阶段在受信任的已录制命令作用域内执行，不放宽 C5 守卫。
- 单世界时钟按最早就绪边界推进；同 tick 输入不强制世界前进。长动作保留余时，强制状态由调度器消化，等待生产批次的成员可在下一边界继续等待或取消。主成员忙碌、缓慢或死亡不会锁住其他就绪成员。
- 原生移动、近战、投掷、装备/双戒指、食物、拾取、搜索及扩展动作读取实际命令成员。每个成员计算合法感知后形成共享显示并集，实际攻击判定仍读自己的感官。敌人按可见距离与稳定 ID 选择成员；逃跑、闪现和寻路缓存按当前目标刷新。
- focus 只保存在会话 WeakMap，切换 HUD、背包、模块面板不改变规则状态或 RNG。确认生成器的每次恢复继续绑定原执行者，并检查旧目标/库存/规则状态。

### 成长、掉落与阶段5

- M6：基础 XP 池先按参与者等权整数分配，余数按 actorId；之后每个存活领取者调用一次自己的 `growth.xp-gain`。死亡参与者保留终结收据席位，其份额不转赠；冻结存活成员可以领取。原盟友规则保留，party 不再重复走 player/ally 分账。
- 辅助白名单冻结为 `committed-growth-timed-effect-on-participant-v1`：只有已提交的 growth 定时效果作用于已有战斗参与者才记入。当前没有可供接入的权威治疗/护盾结果，因此不按日志、施放或 UI 声明增列；未为此新增技能。此规则进入有效指纹。
- M7：kill/part 的掉落属性读取权威 `EffectOrigin.creditActorId`，无资格时固定主成员；floor/vault/encounter 固定主成员。死亡成员仍可读终态属性。`DropEvent.playerId` 保留既有字段名，内部含义为本次掉落查询主体，不修改全局 `ActorFacts.player`。共享地面、局级金币和过滤偏好、唯一/套装/断肢收据仍各一份。
- M8：新增受控成员能力读取，分别使用各自身份、装备、原生基值和成长派生值；loot 怪物缩放排除成员。原生 NPC 模板白名单和容量授予政策保持。
- 制作、采食、食物、营地、建造、箱子转根、战斗分段动作、篝火均绑定实际成员。票据完成/退款沿原持有人，冻结库存也纳入所有权根；成员不进入居民需求第二账。篝火恢复活动成员集合，主成员死亡后仍可由其他成员使用。
- M10：冻结期间平移 growth 效果的 `startedAt` 和 `expiresAt`、技能 `readyAt`，保持持续时间和余时；focus、原生饥饿及成员状态不追扣。世界与居民经济继续按唯一时钟运行。

### 层迁移、终局、存档与 UI

- 同层活动成员要求近梯且空闲；明确留守后转为 frozen，返回可恢复。坑洞只移动实际坠落者；仅冻结者存活时可恢复。主成员死亡不自动终局，全灭结算一次。胜利需要真实入口/最深层出口条件和队伍确认，护符可以在其他成员根中。
- party 启用时有效协议为 **F21 / whole-run S8 / recording R5 / origin O3**；关闭时仍为 **F20 / S7 / R4 / O2**。新增模块 `party` 版本 **0.1.0**，创建/控制 schema1。所有启用模块的有效规则身份包含 party 分支，不原地改写无 party 模块版本。
- party 根惰性创建。主成员仍在既有 player 根，新增成员由显式受控实体 codec 承载，装备别名和所有库存根参加保存、回滚、full digest、Worker 和独立解码验证；新增 Game 字段已登记 U03 合同。非法 party 档不能回落为经典局。
- 保留 256 chunk / 2048 full 边界、generation 栅栏和非周期末行导出规则。真实 Worker 测试运行生产 `RecordingCheckpoint.worker.ts`，Node adapter 仅桥接传输；每个结果与独立 inline oracle 比较。
- M9：MainMenu 中选择 1–4 人（默认2），growth 一步收集稳定 ordinal 槽并输出一个批量初始命令；引擎创建实体映射后初始化各自身份。保留异步创建会话、拒绝重试和旧回调保护。HUD 提供焦点、就绪、生命状态、跨层/留守、恢复和交换；文案进入 i18n。

## 自动验收与证据口径

原始日志/JSON/完整录像位于 `/private/tmp/party-p1a/`，不进入仓库。Node **v24.18.0**，Apple M5 / darwin arm64；Vitest 单 worker、禁止文件并行、堆上限 3072 MiB。表格按运行批次列出，不把重叠复验累计成独立测试总数。

| 批次/日志 | 结果 | 用途与后续复验 |
|---|---|---|
| `related2.log` | 14文件 / 270通过，265.35s | 阶段5、时间/动作等受影响旧回归；不是全量套件 |
| `party-final.log` | 7文件 / 62通过，87.80s | party 生命周期、动作、阶段5、自然跨层、UI、无影响与工具的前一批；与后续重叠 |
| `ui-final.log` | 1文件 / 15通过，44.00s | 12精选配置的真实 MainMenu 创建→命令→save/load→replay/seek→续录，另含嵌套配置/拒绝重试 |
| `related-final.log` | 20文件 / 483通过，595.27s | 录制异步、Worker、U01/U03、中性战斗、属性、成长/loot、显示和 party 相关回归 |
| `late-final.log` | 5文件通过；合计133通过 / 1失败，49.71s | 目标缓存/闪现/吸收及动作/跨层通过；新M10夹具位置前提失败，不抹掉此失败 |
| `m10-fix.log` | 定向1通过 / 11未选，3.46s | 使用空间锚点接口关闭新夹具失败；不作为整文件通过数 |
| `closeout-tests.log` | 4文件 / 38通过，40.39s | 完整 party_extensions 12项、既有创建 UI、无 party 字节差分、digest 字段合同 |
| `authority-worker-final.log` | 2文件 / 31通过，339.48s | 新增控制槽/成员生命周期/坏档拒绝，最终生产代码1/4人Worker长边界 |
| `boundary-closeout.log` / `deps-closeout.log` / `deps-authority.log` | 全部exit0 | boundary与测试依赖检查；没有改守卫语义 |
| `types-closeout.log` / `types-authority.log` | exit0 / exit0 | `vue-tsc -b`，后一次覆盖新增权限测试 |
| `build-closeout.log` | exit0 | Vite构建；保留现有大chunk提示，不将构建等同浏览器验证 |
| `delete2-tests.log` | 4文件 / 58通过，40.52s | 全删副本 U01/U03、digest合同、无具体模块依赖的真实菜单测试 |
| `delete-gates2.json` | boundary/deps/types/build/tests/smoke 全部 exit0 | 一行物理全删，副本与正常树分列 |
| `delete-party-rejection2.json` | passed | 实际4人party-only/party-all档与录像缺包拒绝；活对象、完整快照、allocator、双流、前缀保持；classic续录继续成功 |

`related-final` 的20文件为 party actions/extensions/worker、ext_recording_async、ext_combat_neutral_differential、ext_slaying_alignment、u_01_instance_snapshot、u_03_whole_run_snapshot、ext_generation_checkpoint_differential、ext_stats_native/runtime、growth sources/classic_isolation、loot b4_runtime/trigger_commits/stats_integration、x3b_display_recording、phase4d_group_sidebar、ux_1c_display、ext_party_inert ，均为整文件运行。计数以 Vitest 日志为准，不将上述名称描述另加为测试数。

首轮实现（R1 修复前）的生产及工具身份（`src` 排除 test/tests，含 scripts 与 ext-perf workflow，共782文件）SHA256：`557da273c38260f704f44965fe1cefef171366cad3b2963342a90319d0b82eb4`。`source-final.json` 逐文件核对性能冻结副本，生产/工具差异为空；首轮冻结后仅补测试和报告，R1 的生产差量另见末节。全删源输入hash为 `989cefe2a30a67b3063fca4dfc61dd6577de64062e9226526069bcfd3f4c0cab`；删除准备文件的 `prepared-not-verified` 不等同门禁结果，实际受限执行结果见单独的 `delete-gates2.json`。


### A01–A13 对照

| 项目 | 已取得的自动证据 | 边界与未运行项 |
|---|---|---|
| A01 生命周期/权限 | 1/2/4人、第五人配置拒绝、错误slot/actor、frozen/dead/busy、陈旧revision、未拥有物品/额外字段；拒绝保留完整快照/allocator/双流；无party own keys配对 | 不声称穷举所有畸形 JSON 组合 |
| A02 时间 | actions：25/50/100/200/400 对100速度、同 tick 与余时、麻痹；工作批次/取消；主成员死亡后其他成员活动 | 全部环境/居民交错的笛卡尔组合未穷举 |
| A03 原生能力 | 两成员装备、双戒指、投掷、拾取、食物、攻击、成长；经典中性战斗、原生属性相关回归 | 无完整逐武器/逐符文的多人组合穷举 |
| A04 交换/生产根 | 整叠交换的所有权和发起者费用；非主成员制作/采食、两批继续/取消、营地/箱子来回转根及存读 | 各生产模块的每一种退款故障组合未逐项扩增 |
| A05 感知/输入 | 分隔 LOS 共享并集/个体遮挡；同显式命令不同 focus 的摘要与两流相等；只读模块视图零写入；真实敌人决策绑定最近可见次成员 | 浏览器确认期间切换焦点、人机交互待验 |
| A06 死亡/终局 | 主成员先死、冻结幸存者恢复、真实入口/最深层出口确认 Yes/No；死亡参与 XP 收据 | 终局动画与视觉待验 |
| A07 层迁移 | 双人自然一层到二层并完整 seed replay；显式留守/返回余时、非主成员坠落与恢复；M10 效果/冷却存读 | 全部随机落点/传送道具组合未穷举 |
| A08 阶段5 | 非主成员真实采集/制作/取消、营地/建造/箱子转根、篝火；相关居民/离线/生产旧回归 | 没有新增“多人袭击长离场”全部链路交叉用例；不把原单人回归称为该覆盖 |
| A09 持久化 | 自然双人路线；1/4人各2049命令；255/256/257/2047/2048/2049；非周期 save、完整 replay、seek、续录 | 性能 rounds=1 短跑不承担长边界证明；长边界由正确性测试承担 |
| A10 拒档/OOS | 重复物品根、缺成员实体、非法层、错误codec拒绝保活局/allocator/双流；full域与inline oracle；删包后真实四人 party-only/all 存档/录像拒绝且活局不变 | 不声称每种篡改字段都新增了独立负例 |
| A11 Worker | 生产 Worker 1/4人逐域校验；已有异步录制延迟/错误/栅栏相关回归 | 真实浏览器 Worker、手机后台恢复待验 |
| A12 零影响/删除 | e3ec8f4 五个无 party 配置字节基线、U01/U03/中性战斗回归；精选组合；物理移除全部九模块并拒 party 档 | 仅全删一行，其他删除布局未验；扩展已选11、未穷举501 |
| A13 UI/测量 | MainMenu 真实 SFC 创建链15项；12配置完整生命周期；1/2/4人单步/摘要/体积、真实 Node Worker 测量 | 浏览器桌面/320/390、真机 FPS、云端 A/B 均 not-run |

### 零影响、失败处理与基线

开工 SHA 独立归档上固定 `Date.now=1792252800000`、seed42，捕获 classic、extended 空集、growth、loot、八模块五配置的四个等待输入：完整 own keys、规范化 save/replay SHA256、两流和消息。新小型夹具 `src/test/fixtures/party-phase6-inert.json` 记录这份来源；不删除新增字段做比较，不把固定时间之外的数据归一化。已有黄金 trace、生成基线、守卫断言未改写。`related1.log` 首次为153通过/1失败：新增 party run 根尚未登记 digest 合同；补齐 `recording-digest-contract.json` 的归属映射后复验，未改测试或放宽未知字段检查。

实现中出现过的失败均保留原始日志：缺少实际创建初始命令的录像夹具已补齐；C5 纯准备阶段的作用域拒绝通过修复受信任生产入口解决，未改守卫；受控实体 JSON 中的 undefined 归一化在 codec 写端修复；冻结效果仅平移到期时间造成持续时间校验不一致，修复为起止时间一起平移。营地测试先创建另一个 Game 再捕获存档，导致全局 ID 分配器被夹具重置，修正为先捕获；制作夹具按不存在的 owner 过滤物品，修正为实际 definitionId；速度夹具改为覆盖只读 getter。M10 新夹具直接改 loc 后被空间锚点结算移开，改用 `commitCreatureAnchor` 设置夹具位置；跨层守卫和断言保持。全删拒档比较首次仅因 `recordedAt` 墙钟不同失败，改用固定 Date.now，仍比较完整录制前缀。没有为关闭失败放宽旧测试断言，也没有需要重录的已有黄金字段。

物理删除采用 `check-module-removal --prepare-only --retain=none --engine-only` 创建隔离副本，确认 combat/crafting/foraging/giants/growth/loot/narrative/party/settlement 九目录实际不存在，再在副本执行本轮批准的限定门禁。没有调用该脚本默认的完整 test:ext。引擎组合结果中 `requestedScopePassed=true`；总字段 `passed=false` 是浏览器未跑，报告不将其改写成整体验收通过。

## M11 工具、性能与交付参数

新增 `party-v1` 身份和 `profile-party-perf` / `run-party-perf-ab` / `merge-party-perf-ab`，由现有 runner 的 `--party` 路由和 workflow 的 `suite=party` 接入。原 phase6 路线、预算、默认工作流不改为 party。party 输入固定 seed42、`ready-actor-wait-v1`，1/2/4人 × party-only/party-all；正式采样2049命令，短跑只允许 rounds=1。

保留三分片运输名称：`classic` 对应 party 1人，`all-full` 对应2人，`all-prefix` 对应4人；它们在 party 身份内只是人数分片，**不是原 phase6 三条路线**。每片两种配置、A/B 双侧；汇总校验分片/轮次/人数/工具哈希/候选哈希/工件哈希/摘要与 RNG。短跑标为 `smoke-only`；完整数据最多为 `measured-no-budget`，P1a 没有性能 pass 或新绝对阈值。

本地用同一冻结候选作为 A 和 B，rounds=1、steps=8，目的是验证全部采集、配对、三片汇总链路。它是 **A/A 工具冒烟**，不能解释为优化收益。phase6 基线没有 party，runner 会拒绝将其冒充 party A 侧。云端需由维护者在后续提交后指定两个 party-capable SHA；本轮不创建提交，也不 dispatch。

```sh
# 在本地控制工具根执行；三个 out 均须不存在
node scripts/run-ext-perf-ab.mjs --party --base /path/party-A --head /path/party-B --out /tmp/party-1 --shard classic --rounds 1 --steps 8
node scripts/run-ext-perf-ab.mjs --party --base /path/party-A --head /path/party-B --out /tmp/party-2 --shard all-full --rounds 1 --steps 8
node scripts/run-ext-perf-ab.mjs --party --base /path/party-A --head /path/party-B --out /tmp/party-4 --shard all-prefix --rounds 1 --steps 8
node scripts/merge-ext-perf-ab.mjs /tmp/party-merged /tmp/party-1 /tmp/party-2 /tmp/party-4
```

云端工作流参数：`suite=party`、`base_ref=<已审 party A SHA>`、`head_ref=<party B SHA>`、`rounds=3`，默认 steps2049；phase6 的 base_identity/head_identity 在该分支不参与。云端长样本和 P1b 阈值定案均未运行。

冻结候选全文件 SHA256：`d9609afd7f0c49ef01f53f2e0d593d491af55888a308e55ba5c3a442d5fe9c85`（`perf-inputs2.json`，3230文件）。`perf2-{classic,all-full,all-prefix}` 共12侧次观测，`perf2-merged/result.json` 六组配对全部 comparable，status=`smoke-only`、budget=null、每侧 OOS=0。冻结副本没有 `.git`，SHA 字段为 null，使用内容 hash 绑定；日志中的 git rev-parse 提示不冒充已提交 SHA。

下表为 A 侧，单位 ms；每格单步 n=8，暖步 n=7。小样本使 P95/P99/max 相等，不表示长尾稳定。B 侧完整数值保留在 JSON，不从 A/A 波动推导提升。

| 人数/配置 | 首步 | 单步 P50 | 单步 P95=P99=max | 暖步 P50 | 暖步 P95=P99=max |
|---|---:|---:|---:|---:|---:|
| 1 / party-only | 38.925 | 30.138 | 38.925 | 30.070 | 30.956 |
| 1 / party-all | 48.684 | 37.045 | 77.750 | 37.020 | 77.750 |
| 2 / party-only | 32.987 | 31.388 | 36.455 | 31.197 | 36.455 |
| 2 / party-all | 36.644 | 37.270 | 43.875 | 37.270 | 43.875 |
| 4 / party-only | 36.013 | 29.620 | 42.617 | 29.107 | 42.617 |
| 4 / party-all | 37.752 | 32.320 | 48.192 | 32.215 | 48.192 |

独立投影/摘要采样每格 n=2（首条与末条），统计采用工具既有上分位定义，因此下列 P50/P95/P99/max 均等于所列数值。这里的 full 是主线程独立 oracle；实际生产 Worker 的成本在下一表。

| 人数/配置 | 投影 | event | full oracle | UTF-8 编码 |
|---|---:|---:|---:|---:|
| 1 / party-only | 4.610 | 0.057 | 38.605 | 5.961 |
| 1 / party-all | 4.561 | 0.046 | 41.308 | 6.033 |
| 2 / party-only | 4.018 | 0.040 | 38.894 | 6.017 |
| 2 / party-all | 4.791 | 0.043 | 41.238 | 6.037 |
| 4 / party-only | 4.211 | 0.037 | 41.432 | 5.921 |
| 4 / party-all | 4.588 | 0.047 | 41.585 | 6.077 |

生产 Worker 使用 Node worker_threads 传输适配。短跑未到256周期边界，末次保存产生一项作业；每项投影/编码/dispatch/publish/compute n=1，均有 peakJobs=1、saturated=0；下列 flush 为末次非空等待，另外两次空 flush 不混入该数值。`boundaryMainMs=[]` 明确表示这份短性能样本没有周期边界样本；长边界正确性另由 Worker 测试覆盖。

| 人数/配置 | 投影 | 编码 | dispatch | publish | Worker compute | 非空 flush | peak bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 / party-only | 3.441 | 5.879 | 0.191 | 0.147 | 59.913 | 115.465 | 3871112 |
| 1 / party-all | 4.687 | 5.881 | 0.198 | 0.153 | 63.765 | 162.563 | 3933262 |
| 2 / party-only | 3.373 | 5.833 | 0.179 | 0.149 | 59.716 | 115.547 | 3877204 |
| 2 / party-all | 4.781 | 6.004 | 0.200 | 0.136 | 61.191 | 156.243 | 3946978 |
| 4 / party-only | 3.503 | 5.868 | 0.185 | 0.164 | 61.236 | 120.869 | 3887768 |
| 4 / party-all | 4.643 | 5.887 | 0.206 | 0.158 | 62.801 | 162.546 | 3962090 |

完整 JSON UTF-8 字节与一次进程内存采样如下。extra actors 含新增成员的实体和库存（1人时空数组为2字节），不包含已有主成员；控制根单列。RSS/heapUsed 包含 SSR 工具、保存/回放验证和存活 Game，不是每成员净增内存，也不是浏览器内存峰值。

| 人数/配置 | save bytes | replay bytes | party control | extra actors | RSS MiB | heapUsed MiB |
|---|---:|---:|---:|---:|---:|---:|
| 1 / party-only | 1948059 | 12251 | 188 | 2 | 630.9 | 271.8 |
| 1 / party-all | 1982762 | 15879 | 188 | 2 | 674.0 | 356.6 |
| 2 / party-only | 1951103 | 12249 | 303 | 2382 | 658.1 | 305.7 |
| 2 / party-all | 1989657 | 15916 | 303 | 2393 | 690.8 | 221.4 |
| 4 / party-only | 1956391 | 12255 | 533 | 7178 | 597.7 | 243.5 |
| 4 / party-all | 1997295 | 15998 | 533 | 7168 | 623.7 | 324.9 |

补充单步诊断（`action-measure.json`）：两人、seed42，移除敌人并设置速度/麻痹/楼梯位置；每行 n=1，所列数值同时是该单点的 P50/P95/P99/max，不作自然 seed replay 或预算结论。FOV 和陈旧命令拒绝另验两流/完整快照不变。首次测量因快照 `savedAt` 墙钟不同触发比较失败，固定 Date.now 后保留全字段比较通过；原始两次失败日志未覆盖。

| 操作 | ms | 世界推进 ticks |
|---|---:|---:|
| same-tick first wait | 33.872 | 0 |
| second wait advances world | 32.470 | 100 |
| 400-tick primary accepts | 30.504 | 0 |
| 100-tick secondary action 1 | 30.349 | 100 |
| 100-tick secondary action 2 | 29.317 | 100 |
| 100-tick secondary action 3 | 28.993 | 100 |
| forced-state boundary | 32.447 | 100 |
| FOV recompute | 0.681 | 0 |
| stale command rejects | 0.115 | 0 |
| travel with secondary frozen | 160.448 | 0 |

属性/回滚补充诊断（`attribute-rollback.json`）：party+all、seed42，1/2/4人每格 n=1（数值同时为该单点P50/P95/P99/max），不作统计稳定性结论。每成员读取 max-hp/accuracy/defense/move-speed/attack-speed 五项；“失效后”显式标记属性缓存失效，“暖”立即重复。回滚使用生产 native 与 extension 捕获/恢复函数，中间仅将每名成员 HP 减1；恢复后完整快照、成员/库存对象身份和两流相等。这是受控写入恢复诊断，不冒称覆盖全部 writer 故障注入。

| 人数 | 五属性/成员：失效后 ms | 暖 ms | 捕获 ms | 恢复 ms |
|---|---:|---:|---:|---:|
| 1 | 0.155 | 0.011 | 28.236 | 34.759 |
| 2 | 0.229 | 0.017 | 27.458 | 31.512 |
| 4 | 0.374 | 0.028 | 27.300 | 32.034 |



## 留给维护者

- 按 [浏览器清单](party-p1a.manual-checklist.md) 执行桌面、320/390、真实 Worker 和真机检查。
- 审查通过并另行提交后，选两个具备 party 的提交进行云端 A/B，P1b 再定阈值。当前没有需要推翻 M1–M11 推荐才能继续的产品裁定事项。
- 本轮只运行批准的相关测试和精简门禁，没有完整 npm test、test:ext、drift、CE/gen、长性能基准或其他删除矩阵；上述未运行项不可从本报告推导为通过。


## R1 独立审查处理（2026-10-18）

针对 [独立审查 R1](party-p1a.review-findings.md) 的 2 个阻断、5 个重要问题逐项复现并修复。审查原文保持不变。本轮是在已有未提交 P1a 实现上继续修复，未 commit、推送；没有启动子代理，也没有新增需要维护者裁定而无法继续的事项。

### 复现与逐项处置

修复前完整输入副本为 `/private/tmp/party-p1a/r1/before/`，候选输入 SHA256 为 `d306512cf415faaca474aa4a4f080b05d2a949dea490fa3ebe836b961ca6270d`。重跑独立审查的六份探针，输出保留为 `probe-before.log`、`probe2-before.log` 至 `probe6-before.log`；探针 exit0 仅表示运行完成，其内容确实重现缺陷。新增正式回归在修复前 **10/10 失败**，见 `regression-before.log`，没有用最终状态相同来掩盖错误玩法。

| 发现 | 生产修复 | 回归与拒绝不变性 |
|---|---|---|
| F1 非主成员遇火抛错 | 火焰暴露、燃烧、爆炸明确区分 ControlledActor 与 Monster；不向成员补空的 Monster 方法。火免疫、灭火、护甲符文和食物燃烧使用真实成员 | 公开移动进入火格、已有 burning 的客观 tick；并扩展到爆炸、免火、浅水灭火、respiration/dampening。实际结果与 save/load、逐步 replay、seek 前后 full digest/双流一致 |
| F2 毒伤全灭不终局 | 删除 settleDue 直接写 dead 的旁路，统一在状态/环境、调度边界及已接受指令收尾调用死亡清理；成员毒死不计怪物 kill/loot。取消工作/动作、退役阶段账、清 pending/falling/modal；已有主成员死亡事实复用，不在全灭时重复捕获 | 全队毒、火、气体、岩浆、饥饿和原生近战死亡；毒死 captureDeath 每成员恰一次，重复终局不重复结算；阶段动作忙碌中毒死会取消 bundle/成员账。冻结幸存者阻止终局并可恢复 |
| F3 modal 可以被控制命令跨层绕过 | party 输入预检先锁定 modal 成员，所有 party:control 及不相容 actor-step 在写入前拒绝；仅原成员允许完成/取消该交互 | 真实 wand use(target:null) 后，另一成员 travel/leader 及原成员 wait 都拒绝；快照、对象身份、allocator、两流、事件前缀保持；escape 后可存读/回放/seek |
| F4 恢复其他冻结层移动了 issuer | recover-level 的 issuer 必须属于所选 frozen 层；拒绝发生在 generateDepth 前 | 三成员分别留 D1/D2、A 到 D3 后实际毒死；B 恢复 D2 被拒，C 恢复 D2 成功，B 的完整实体保持；完整控制命令序列可存读/回放/seek |
| F5 只检查当前成员 falling | 调度器检查所有活动受控成员的 falling 位；客观块、同 tick AI/阶段边界、指令提交前处理强制坠落，执行时绑定实际坠落者；收尾仍位于指令回滚写集内 | A 站 CHASM、B 提交推进输入，同一指令即完成 A 坠层与 B 留守；存读/回放/seek 无额外人工输入。保留并通过原有非主成员主动坠落测试 |
| F6 原生潜行来源串 scope/缺失 | 每个成员在创建和读档后绑定自己的 darkness/shadow/rested 回调；光照更新失效所有活动成员缓存；敌人选定目标后重新求该成员潜行值；rested、岸边警告及伤害来源归成员 | 固定亮/暗输入，A 的属性在 B scope 中不变，B 使用自身来源；读档后重复验证；实际目标选择不使用调用方传入的旧 stealthRange；rested 的持久化与独立性回归 |
| F7 成员快照联合准入不完整 | roster/actor/native 与不可变 manifest.members 对齐；验证非临时、单格、HP/life、当前/缓存层真实存在且 visited、位置边界和全灭终态；resident/raid 从真实 world5 根派生，创建与 detached load 均调用所有权守卫 | 无 recordingOrigin 的 count、缺 frozen 层、临时状态、越界坐标、全灭未终局快照均拒绝并保活对象/allocator/两流/前缀；另验证 resident/raid 身份适配器，拒绝身份重叠 |

`party.native` 新增成员自己的 `justRested`、`lastDamageSource`、`receivedLevitationWarning`，沿已有 party 显式写集/codec 保存，没有新增 Game own field。死因本地化文字沿用原生 `run.lastDamageSource` 的摘要归一化规则，因果归属仍在 extension facts；回归同时验证本地化标签不改变摘要、机械 rested 位仍改变摘要。party 有效规则指纹新增 `environment:2`；修复前 party 身份明确拒绝，不做迁移。无 party 的 F20/S7/R4/O2、模块版本和字节 fixture 均未更新。

### 同类路径排查

静态检查了 Game 的 player 身份比较、Monster 强转、伤害来源和全部 triggerGameOver 入口，并追查 Environment/Status/Movement/Combat、Monster、TimeCoordinator、FireContact、WorldWork、PhasedAttackProduction。检索清单保留在 `player-paths.txt`、`monster-casts.txt`、`external-player-paths.txt`、`death-entrances.txt`；这些是检索证据，以下给出逐类处置，而非把命中数量当作覆盖率。

| 路径 | 排查与修复结果 |
|---|---|
| 火、爆炸、DF | 修正受控成员分类；DF creatures/instantEffects/playerFireOrDescent 纳入所有活动成员，致死 DF 使用统一死亡收口。真实投掷燃烧药水验证次成员即时接触。延迟食物火接触记录 carrierId，出队不依赖当前 scope，不能烧掉主成员的包 |
| 毒、气体、藤蔓、毒苔 | 所有活动成员的状态伤害和递减各一次；直接气伤仍区别于 poisoned。覆盖毒气/蒸汽/藤蔓/混乱/麻痹/恶心/毒苔与自身 respiration，冻结成员不参与；creeping-death 旧无载体分支只静态检查，未伪造可达玩法测试 |
| 陷阱、位移、深水 | 真实踩气体陷阱覆盖次成员；压力板占用判定纳入全队。位移后的拾取、PLAYER_ENTRY、深水背包掉落和阶段动作末水流扫尾绑定实际成员；深水回归证明主成员库存不被误删 |
| 坠落、楼梯 | 已置 falling 位不能返回人工就绪点；只移动实际坠落者。DF 修正后发现楼梯的 REPEL_CREATURES 会驱离次成员，修正 party 显式换层模型下的楼梯晋升边界，保持无 party 的原生路径。旧有“环境检查先于状态递减”的次序保留，未把悬浮刚到期的原生时序差异改成另一套规则 |
| 饥饿、休息、光照 | 营养按活动成员客观 tick，自动进食只读自身包，饥饿伤害按自己的 epilogue；全灭与只剩留守者分开。潜行、矿灯、darkness、阴影、rested、岸边警告按成员；显示/focus 不消耗随机流 |
| 定向状态与远程伤害 | 追加修复迷惑法术对次成员的 confused 语义、消魔的玩家一回合保护、消魔范围内其他成员、非当前成员 on-hit 免疫、反射护甲知识和远程致死收口；分别以真实施法/卷轴、原生 bolt 和状态入口验证 |
| 原生/阶段战斗与终局 | 原生近战、远程接触、客观状态、瞬时地形、坠落、饥饿、阶段边界、已接受指令结束均收口；死亡不进入普通回血补救。工作取消已有按票据成员 scope 的实现，保留。exit-party 补忙碌/失能约束；正常胜利和全灭仍走唯一终局入口，冻结幸存者可恢复 |

保持 classic 原生输入 kernel 与既有规则守卫，不修改黄金 trace、无 party fixture、旧测试断言或 boundary/依赖检查器。范围是按入口/类别系统核查及代表性回归，不声称穷举所有怪物、符文和模块组合。

### 回归方法、失败留痕与结果

新增环境回归在 `initializeParty` 后、真实录制 header 前布置可重建测试场景，seed replay/seek 会应用相同布景。实际动作、环境计算、保存、校验和回放代码未 mock；完整 mechanical digest 和双流均比对。光照纯读及目标选择传参测试明确使用 spy 固定输入。直接原生 bolt、身份适配器和阶段死亡的专项诊断分别验证真实效果/存读，不冒称这些直接诊断调用本身已录制。

旧自然跨层测试在首批修复后失败；隔离副本仅回退本轮生产改动，原测试通过（`travel-counterfactual.log`，1通过/2未选，16.86s）。确认是 DF 纳入次成员后暴露楼梯驱离遗漏，最终修正生产代码，**原测试文件与修复前逐字一致**，`travel-final.log` 3通过（18.17s）。没有通过修改旧测试前提或断言消除失败。

其他失败原样保留：`party-batch.log`、`environment-matrix.log`、`final-related.log`、`audit-focused.log`、`phased-death.log`。新测试布景分别纠正了尚有口粮会自动进食、药水使用 consumableId、零体积恶心气体在晋升后消失、食物依目录需多次转换才烧尽，以及不能删除居民来源实体等前提。BoltContract 的最小无 party 宿主暴露 isPartyStair 在 party 判断之前读层种子的错误，改生产代码提前旁路，未改该旧测试。针对这些失败的复验见 `new-focused.log`、`last-fixes.log` 和最终批次。

本轮 Node v24.18.0，Vitest 单 worker/无文件并行、heap 3072MiB；所有原始证据均位于 `/private/tmp/party-p1a/r1/`。下表不同批次有重叠，不累加为独立测试总数。

| 证据 | 结果 | 口径 |
|---|---|---|
| `native-related.log` | 14文件，252通过/2既有跳过，154.15s | 火/爆炸/毒/气体/坠落/饥饿/光照/时间/终局、食物火、原生属性、U01/U03、无 party 字节 |
| `verified-final.log` | 10文件，204通过/2既有跳过，168.03s | party 新环境/动作/阶段5/生命周期/跨层，以及无 party、时间、反射/bolt/定向状态整文件 |
| `persistence-final.log` | 3文件，59通过，129.90s | 最终死因摘要归一化后重跑环境全文件、party 扩展全文件和无 party 字节 |
| `worker.log` | 1文件，2通过，346.00s | 1/4人真实生产 Worker，255/256/257/2047/2048/2049、inline oracle、save、seek、续录 |
| `worker-final.log` | 1通过/1未选，170.26s | 最终摘要归一化后四人同一完整 Worker 路线复验；不是性能基准 |
| `boundary-complete.log` | exit0 | 模块边界及测试归属 |
| `testdeps-complete.json` | 687文件，errors=[] | 测试依赖分析，无新增外包硬依赖 |
| `vue-tsc-status.log` / `build-final.log` | 均 exit0；Vite 1428 modules，4.29s | vue-tsc -b；npm run build（含 vue-tsc），保留 Vite 既有大 chunk 提示 |

新增 `party_r1_environment.test.ts` 为44条回归；`party_extensions.test.ts` 另新增延迟食物火接触和忙碌阶段死亡两条。`native-related` 的整文件选择为 `ext_party_inert`、`f_2b_creature_burning`、`f_2c_explosion`、`w_10_poison`、`g_3_gas_effects`、`c_5_fall_subsystem`、`hunger_regen`、`c_7_lighting`、`p2_3_objective_time`、`u_26b_endgame`、`ext_fire_contact_runtime`、`ext_stats_native`、`u_01_instance_snapshot`、`u_03_whole_run_snapshot`（均为 `src/test/*.test.ts`）。最终十文件批次是 party 的环境/动作/扩展/生命周期/跨层五文件，加 `ext_party_inert`、`p2_3_objective_time`、`x2l_reflected_death`、`w_9_directed_status` 与 `src/engine/Combat/BoltContract.test.ts`。

最新生产/工具身份（同首轮口径782文件）为 **`7fc89d26a6134e2dd881220a43a0322df9104473a15f41bbd57ca212abfabcca`**，逐文件清单及相对首轮差异见 `r1/source-final.json`。首轮性能数据只属于 `557da273…82eb4`，不能拿来宣称修复后代码性能通过。

按本轮指令，仅运行相关测试、boundary、测试依赖检查、vue-tsc 和 build；没有跑完整 npm test/drift/full/gen、组合穷举、物理全删、性能长短基准或云端 A/B。首轮云端 party 工具/参数交付及浏览器待验清单保持，浏览器由维护者验收。

## R2 最后一轮审查处理与作者同类自查（2026-10-18）

本节承接 [R2 独立复审](party-p1a.review2-findings.md)。复审已确认 R1 原七项关闭；新增 **R2-F1：传送漏检非主成员占位**，本轮由作者复现、修复及自查。规定的两轮独立审查已经用完，**没有启动第三轮，不把下述作者自查称为独立关闭**。未 commit。

### R2-F1 的复现、修复与持久化

直接执行原审查脚本 `/private/tmp/p1arev2/teleport-overlap.mjs`，修复前仍得到 `CONFIRMED_OVERLAP`：seed42 三人，A `(9,10)`、B `(10,10)`、C `(60,10)`；A 公开 wait 后 B 公开读传送卷轴，B 与 C 同在 `(60,10)`，保存、读档、seed replay、seek 均保留错误位置。日志为 `r2/reviewer-before.log`。布景在真实录制 header 之前安装，并在 seed replay 时同法重建；没有替换传送、物品、调度或 codec，不冒称自然随机游玩。

修复同时覆盖候选与提交：单格传送、`canDisplaceCreature`、`canStepFootprint` 及相邻放置调用者统一取得 `spatialWorldPort()`；空间口列举当前层活动成员，并明确排除冻结/死亡主成员。原 `Game.player` 身份不变，`getMonsterAt` 仍只返回 Monster。基础空间模块新增纯 `controlledOccupies` 查询，供原 HAS_PLAYER 放置政策扩展到全部成员；不增加 Game 实例状态，不消耗 RNG。

`WholeRunSnapshot` 在发布前拒绝同层存活成员叠格，包括冻结层；不同楼层相同坐标合法，死亡成员不保留占位。脱离活局的实体重建还检查成员与本层/缓存层活怪完整足迹、空间休眠保留体的冲突。普通 1×1 休眠怪继续沿 CE 非活动占位政策，醒来时重新选址，无空间则仍保留休眠所有者。坏档拒绝回归比较完整快照、玩家/成员对象身份、allocator、双随机流和已有录制事件，确认拒绝不污染活局。

有效 party 指纹新增 `placement:2`，用于区分修复前的放置规则；party 仍是 F21/S8/R5/O3，非 party F20/S7/R4/O2，未重录或放宽无 party fixture，不提供旧档迁移。

### 全部放置/移动入口的作者自查清单

以下按实际提交位置的入口追查，包含 `commitCreatureAnchor` 的生产调用、候选查询、虚拟空间及落位后发布；不能用“普通 move 已挡住”替代其他入口的检查。

| 入口 | 自查结论与处理 |
|---|---|
| 随机传送：卷轴/法杖/怪物/最深层坠落转传送 | 单体 `teleportCreature` 候选和最终落位均接完整空间口；整身传送原已用该口。无合法格继续原 false/不位移语义，不放宽候选。三人公开卷轴分别验证“只有 C 的格”和“另有空格”，含存读/replay/seek。 |
| 闪现、beckoning 拉拽、潜水怪让位 | `finishBlink` 最终校验及潜水怪搬离的搜索均避开其他活动成员；bolt 的成员阻挡口已存在。怪物闪现的同步占位缓存、空间候选补全成员。公开 B 闪现和隔着 C 拉拽 B 回归；原 W11/W12/U07 路线复验。 |
| 普通成员步行、混乱改向、越过盟友 | 原 party 预检拒绝成员目标格；最终 `movePlayerPastAlly` 再检实际落点，覆盖预检后改向。盟友兜底候选以实际命令成员为搜索原点，排除全体活动成员。新楼梯布景通过公开 move 强制走兜底，含存读/replay/seek。 |
| 怪物步行/游荡/逃离/尸体路径/居民步行 | 候选中的单 commandActor 排除扩为成员集合，单格真实提交前再挡住成员；多格走完整 `canStepFootprint`。居民候选、占位重寻路及离场候选补齐；离场最终提交也设防。非目标 B 占格回归与原怪物/居民/离场测试复验。 |
| 闪避与阶段位移 | `canActorDodgeStep → canStepFootprint` 和 `commitActorDodgePosition` 共用完整空间口，预检、提交均不能绕过 C。新增拒绝回归保持 allocator/快照/RNG/事件不变。 |
| 踉跄、力量符文击退 | 踉跄沿 `placeCreature` 完整校验；力量逐格推进原只查怪物，现补活动成员并在接触前停下。回归覆盖 B 被推向 C、怪物被推向 B；原武器符文测试复验。 |
| 剑刃/守护者/武器多重幻影召唤 | 共用 `bladeSpawnLocation` 的目的格与路径 HAS_PLAYER 查询均扩为完整成员集合；无落点返回 null。公开召唤录像及拥挤地图检查，原 W16 复验。 |
| 怪群召唤、远距召唤、周期/指定地形刷怪 | `findMinionSpawnSpot/minionPlacement`、远距与周期候选、邻近落点和 horde 领袖提交检查全部成员。特别补 minion 距离扫描将原点重新置可达后的最终成员过滤，不能只依靠路径阻挡。楼层首次生成时成员尚未驻留新层，不用旧层坐标污染生成。 |
| 克隆、分裂、复活 | 克隆搜索、显式分裂落点、分裂边缘扫描和复活候选补齐成员；整身克隆/转换原走虚拟完整空间口。拥挤场景复现旧克隆撞 B，并验证修复后只选空格；原 W20 复验。 |
| 单体/多格怪物发布、raid、居民候选与 DEV 方形体 | `canCreateNativeCandidate/createSquareMonster/publishSquareMonster` 使用完整空间口；raid 复用原生预检，居民候选和显示诊断预检补齐。没有把成员当作怪物或修改原生实体容量。原多格生命周期测试复验。 |
| 楼梯入层、留守恢复、追随怪入层 | party 批次落位保留怪物足迹排除与本批已选格集合；`entryQualifiesForPlacement` 补其他活动成员。`travelPlacement/restoreLevelResident` 同时看到全部成员，party 追随入层不走原生无空间叠格退化分支。原 party travel/原生 level travel 加拥挤追随落位回归。 |
| 坠落、同批多人成员、干地兜底 | 初选落点与孤立深水的干地兜底均检查其他成员；同批落位依次占用，无空间不发布重叠。坠入已有冻结成员的楼层时先恢复该层成员，再为坠落者选格，并将恢复者纳入 enteredLevel 的实际成员集合。四人同落含存读/replay/seek；返回冻结层另验诊断存读。 |
| 休眠唤醒/待落多格体重试 | party 休眠唤醒先完整选址，零空间不从休眠链摘除。待落重试的占位失效键补全部活动成员；完整体、旋转、整身转换沿原虚拟放置事务。普通 dormant 的 CE 规则不改。多格追随的接触目标复用出口真实实体；只有空出口才发布临时点目标，并保留其他成员占位，避免重复占位或未拥有目标令路径静默为空。 |
| 怪物乘客释放/行政退休 | 原活怪宿主位置不与成员重叠，死亡后的原位释放可复用其格；空间乘客走完整 travelPlacement。行政退休批次的虚拟世界补当前/冻结所属层成员，防止把其他层主成员带入本层或漏掉缓存层次成员。 |
| DF 排斥/地形变化 | R1 已使 DF 活动生物列表包含全部成员，排斥扫描逐次读取实时占位；多格 `canPlace` 改用完整空间口。地形伤害/气体/火允许作用于有人格，不能把所有地形生成改成“必须空格”。实际楼梯继续走 R1 的 party 楼梯保护。 |
| 物品掉落、资源/交互物、结构物拆除 | 原生允许物品与生物共格的明确路径（脚下放下/死亡掉落/指定机器奖励）保持。原要求 HAS_PLAYER 排除的俘虏掉落/兜底、交互物候选、`clearWorldCell`、居民农田候选、结构拆除落物和跨层退休掉物均补成员；结构拆除不再错误排除其他层主成员投影。测试覆盖俘虏物品绕过 B 和资源拒绝 B 格。 |
| 蓝图与生成期占位 | 机器实体 `hasMonster` 口在 party 活动世界也计入受控占位；原物品/地形写入方式、机器奖励和生成重试规则保持。建新层期间没有该层活动成员，楼梯/成员后落位；并非把旧层成员当作生成占位。 |
| 存读、回放、seek、失败回滚 | 合法位置保留完整摘要和双流；同层成员/怪物叠格在 detached decode 拒绝。公开传送、闪现、盟友兜底及四人坠落执行真实命令和真实 seed replay/seek。诊断直接调用测试只声明诊断存读，不冒充录制输入。 |

没有剩余需要维护者额外裁决才能推进的已确证占位缺陷。上述是本次所列入口的代码审查和定向实验，不是所有种子、怪物与模块组合的穷举证明。

### 门禁登记、失败记录和最终证据

新增 `party_r2_occupancy.test.ts` 登记在 party 本包 test-suites；旧测试及无 party fixture 未改。新测试第一版注册遗漏导致 Vitest 启动拒绝，登记后才实际执行。修复前首批7条中5条真实失败（另2条本来通过），见 `regression-before-registered.log`；拥挤克隆、minion、休眠唤醒、追随落位的修复前副本也复现撞 B。首版盟友测试使用深水，CE 当前地形例外使其未进入预期兜底；改成楼梯格后重新跑同一断言。没有修改旧测试前提、删除断言或增加 skip。

中间失败还包括：新增帮助函数放在 CreaturePlacement 引起原生测试导入循环，移入基础 CreatureSpatial 消除，未改旧测试；新诊断测试读过无来源快照后再导出完整录像前缀，调整为先检拒绝再诊断读档；类型检查指出 dormantMonsters 可选，代码补空数组。最终多格自查补了“必须实际前移”的正断言，发现只将虚拟目标从空间世界移除会使 contact pathing 因目标未拥有而返回空路；改为复用真实出口实体、空出口才使用临时目标，27项全文件及原生跨层/无 party 再验通过，初版失败保留在 `body-exit.log`。保留 `native-related.log`、`regression-expanded.log`、`party-related.log`、`types-second.log` 等原始失败日志，不把它们改称全绿。

地形读者门禁检查代码没有修改。9个既有登记键因**包含它们的语句中占位分支改变**而失效；逐对核对文件、函数、raw 表达式、读/写类别和15次读取的计数完全相同，仅在 `scripts/structure-readers.json` 更换这9对语句指纹，分类/处理政策/覆盖要求不变。涉及 Game 的居民重落位、minion、干地兜底、俘虏掉物，StructureWorld 拆除掉物，CreaturePlacement 的俘虏与盟友候选，以及 LevelTravel 候选；没有新增原始地形权限判断、移除登记或放宽数量。逐项旧/新语句及键见 `reader-delta.json`、`reader-key-mapping.json`。

本节所有原始证据在 `/private/tmp/party-p1a/r2/`，测试使用 Node v24.18.0、heap3072MiB、Vitest 单 worker/无文件并行。修复前完整候选副本为 `before/`，全候选 hash 为 `c86af00359348efcef8ee5afd416f9324a5c0cb7a221562641d646a99f5c7c87`；`revision.diff` 是相对 R1 的本轮生产/工具改动。下表批次重叠，不累加为独立测试数。

| 证据 | 结果 | 范围 |
|---|---|---|
| `placement-related.log` | exit0；10文件/318通过；97.92s | 传送、闪现/拉拽、召唤、克隆、怪物召唤/闪现、原生跨层、落位快照、无 party 字节及当时18项新占位回归 |
| `occupancy-final.log` | exit0；9文件/196通过；182.22s | 当时24项新回归、多格 Game 生命周期、休眠、力量符文、离场、world-work、交互物、U01/U03；其后两条闪现/拉拽新测试与最终 Monster 候选差量由下一行复验；末次多格追随窄修另见 delivery 两行 |
| `final-related.log` | exit0；7文件/185通过；98.69s | 当时完整26条 R2 占位回归，加无 party 字节、怪物闪现/召唤、克隆、居民需求与资源组落位整文件 |
| `party-complete.log` | exit0；5文件/97通过；143.15s | R1 环境44项、party 动作/生命周期/跨层/扩展五整文件；末次多格追随窄修不影响这些无空间体布景，相关差量另行复验 |
| `occupancy-delivery.log` | exit0；**完整27条 R2 回归**；29.24s | 最后多格追随窄修后，全部新用例重跑；新增多格占位拒绝、真实追随前移及诊断存读 |
| `native-travel-delivery.log` | exit0；2文件/36通过；16.78s | 同一窄修后的原生楼层旅行和五配置无 party 字节 |
| `worker.log` | exit0；四人1通过/一人1未选；149.34s | 真实生产 Worker，255/256/257/2047/2048/2049，save/seek/续录；不是性能基准 |
| `boundary-delivery.log` | exit0 | 模块边界、地形读者登记及测试归属 |
| `test-dependencies-final.json` | exit0；688文件；errors=[] | 测试依赖完整检查 |
| `types-delivery.log` / `build-delivery.log` | exit0 / exit0；Vite 1428 modules、3.41s | vue-tsc -b / npm run build；仅既有 >500kB chunk 提示 |
| `no-party-final-comparison.json` | 27场景/42检查点精确相等；differences=[] | 与 R2 留存 HEAD 基线配对：classic、extended空集、八模块无 party，各含燃烧、进火、毒死、岩浆、爆炸、气体、消魔、休息/搜索、传送；逐点完整 snapshot/save/replay JSON SHA、Game own keys、双流状态和消息 |

最新生产/工具身份仍按782文件口径，为 **`4c32d8f0442bcf9c3849761c40bc763ca7d4a7fab86202fb24abc09d44ad6d3e`**。相对 R1 改动21个生产/工具路径，清单见 `source-final.json`；其 hash 排除报告正文，避免自引用。无 party fixture 及两轮独立审查文件逐字保持，`git diff --check` 通过。对修复前副本执行测试时只暂添本轮测试和登记，结束后已恢复，`before-restored.json` 确认其全候选 hash 与最初捕获完全相同；楼梯版盟友兜底在该原生产副本确实把怪物落到 B 的 `(20,10)`，见 `ally-before.log`。


只运行相关测试、boundary、测试依赖检查、vue-tsc、build。没有完整 npm test/drift/full/gen、物理删除、组合穷举、性能基准、云端 A/B 或浏览器操作；首轮交付的云端工具/参数及浏览器待验清单保持。未 commit/push。


## 云端性能派发修复（2026-10-18）

本轮开工为 `ext/party-p1a` / `18070b2562a3272154d3b28b97e1b79171035e59`，工作区干净。仅修改 workflow、性能脚本、相关脚本测试与本报告；未改引擎、冻结路线、历史预算、黄金 trace 或测试依赖守卫。未 commit、push 或派发云端任务。

### 两条精确的云端命令

**先由维护者将本次工具补丁提交并推送至 `ext/party-p1a`，再执行以下命令。** `--ref` 选择更新后的 workflow/测量工具；`head_ref` 固定测量已提交的 P1a `18070b2`，两者用途不同。当前远端旧 workflow 仍不支持新增输入，不能在补丁发布前执行。

(a) 非 party 回归：同一 6c4 身份、冻结命令路线，A 为已发布 phase6，B 为 P1a；三轮，D6 原口径。

```bash
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=phase6 -f mode=ab \
  -f base_ref=e3ec8f49f8a7c6f827ecb04dac7304a441c960e6 \
  -f head_ref=18070b2562a3272154d3b28b97e1b79171035e59 \
  -f base_identity=6c4 -f head_identity=6c4 -f rounds=3
```

(b) P1a 首次校准：只测 B 的 party-only / party+all，各 1/2/4 人；每场 2049 条固定 ready-actor-wait 命令，三轮。**省略 `base_ref`**，不占用、检出或安装 A；phase6 两个 identity 参数不参与 party 分支。

```bash
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=party -f mode=calibration-only \
  -f head_ref=18070b2562a3272154d3b28b97e1b79171035e59 \
  -f rounds=3
```

party 沿用三分片名 `classic / all-full / all-prefix`，分别对应 1/2/4 人，每片包含两种配置。三轮共18次 B 观测，无 A 观测、无 A/B 判定。汇总仅在六场景、三轮、2049命令全部齐全且逐轮输入/规则摘要/RNG/机器/源码一致、回放零 OOS 时输出 `party-perf-budget.suggested.json`。状态仍为 `measured-no-budget`，建议文件为 `suggested-only`；不自动采用为冻结预算，不标性能 pass，无第四轮验证。建议值保留三轮原值与中位数，时间上限候选取三轮最大值加 `max(1ms, 10%)`（P50/P95）或 `max(1ms, 25%)`（P99/max），体积/内存取观测最大值；均仅供 P1b 审定。完整 Worker、体积和内存数据仍保留在原始观测中。

### 实际修改与兼容边界

- workflow 增加 `base_identity=6c4`、`mode=ab|calibration-only`；A/B 仍必须提供 `base_ref`，校准只允许 party 且拒绝附带 A。校准的 npm cache 路径不依赖不存在的 A。
- phase6 参数解析仅为 `6c4/6c4` 开放同身份回归。两侧都执行 control 中同一冻结命令路线，不再为 B 生成不同路线；classic 和八旧模块 all 均不启用 party。
- 冻结 6c4 原始录像来自 `07d7c97` / loot 0.9.0，而本轮 A/B 都是 loot 0.9.1。新分支通过真实命令入口重新捕获当前 header，保留所有命令、配置和字段，登记路线 hash、候选 SHA、录像 hash 与实际 D20 wait/settled 数；不改旧录像头来伪造兼容。完整跑仍要求原路线事件数、D20 至少500 settled、零 OOS，A/B 捕获录像逐字 hash 相等，并在运行与汇总时复检事件域/full域/最终状态和 semantic/RNG 相等。旧 0.9.0 的历史 A 预算不套到新 A；其它历史身份间 A/B 保持原重建 hash 与预算检查。D6 阈值、1ms 噪声带、三轮至少两轮越线裁决和 phase6 第四轮验证均不变。
- 首次冒烟在 C1 补充场景失败：脚本只认识 loot 0.9.0。核对当前 `LootItemDataV1.v=6` 后补 `0.9.1 → 6` 映射，仍拒绝未知版本，没有改守卫或生产 schema。失败证据保留在 `phase6-classic/005-C1-bounded-supplement.log`；后续两组补充场景均通过。
- party CLI 新增 `--calibration-only`，只产生 B 的来源与观测；旧 party A/B 报告模式继续支持。汇总校验完整有序槽位、混合模式、工具 hash、原始文件 hash/内容、候选身份和跨轮稳定性；缺片/失败/漂移时保留失败 JSON/Markdown，不输出建议预算。

### 本地验证

所有原始证据：`/private/tmp/party-p1a/perf-workflow-fix/`，不入仓库。Node **v24.19.0**；A/B 是该目录下独立本地克隆，分别 detach 于上述两个 SHA；引擎源码均干净。工具来自本工作树未提交补丁。`run-smokes.py` 保留完整本地命令，`smoke-exits.json` 记录六片及两次汇总的退出码，全部为0。两套测量分片按序执行；本机短样本仅验证执行链，不作云端时间或预算结论。

| 检查 | 实际结果 |
|---|---|
| phase6：三个分片 `--rounds 1 --limit 8 --base-identity 6c4 --head-identity 6c4`，随后 merge | `final-phase6-{classic,all-full,all-prefix}` + `final-phase6-merged` 全部 exit0；6侧次，OOS全部0，A/B逐字段比较无差异；汇总 `hard=pass / status=incomplete`，三组均0/1越线，无建议 manifest，不能宣称D6通过 |
| party：三个分片 `--party --calibration-only --rounds 1 --steps 8`，随后 merge | `final-party-{classic,all-full,all-prefix}` + `final-party-merged` 全部 exit0；六场景各1次B观测，OOS全部0，来源仅B；汇总 `mode=calibration-only / status=smoke-only / budget=null / comparisons=[]` |
| `node scripts/test-ext-perf-ab.mjs` | exit0；含6c4同身份参数与原D6阈值/缺轮/冻结条件回归 |
| `node scripts/test-ext-perf-split.mjs` | exit0；含同身份汇总与A/B最终状态漂移拒绝，以及原三轮冻结/独立验证/缺片/回归用例 |
| `node scripts/test-ext-perf-selection.mjs` | exit0；旧C1–C4来源/预算身份及历史限制保持 |
| `node node_modules/vitest/vitest.mjs run src/test/party_perf_tools.test.mjs --maxWorkers=1 --no-file-parallelism` | 1文件/11项通过；合成三轮证据验证六场景建议预算，1/2轮不出预算，旧party A/B保持，并拒绝缺槽/混合模式/身份漂移/重排/重复/跨轮摘要及机器漂移/OOS |
| `npm run check:test-dependencies` | exit0；688测试文件，9模块，errors=[] |
| workflow YAML解析、`git diff --check` | 通过 |

正式云端三轮、完整D20路线及2049命令party校准均未运行；完整场景中的性能结论与建议数值待维护者执行上述命令取得。未运行完整 npm test、drift/full/gen、types/build、组合矩阵或额外游戏测试。此前首轮/R1/R2证据及遗留仍按原节解释。

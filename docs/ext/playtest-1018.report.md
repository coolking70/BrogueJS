# 1018 线上试玩诊断与修复

开工 `ext/phase6` / `0e684d1`（已发布 ext/foundation），工作区原先干净。本次不 commit/push；按维护者指定的 ext 精简门禁，仅相关测试、boundary、测试依赖检查、vue-tsc、build。

## 录像与复现

- 原件 `/private/tmp/replay-1018/replay.json`，SHA-256 `27dc2672cda290e35f278a334a3c49887e6d2d1e7c8e8ce07990a7e77d8c64d5`，seed `439559475`，normal，growth `1.10.0` + loot `0.9.0` / standard。
- **先在 Node 加载原件成功**：Vite SSR 加载 `src/test/harness.ts`，`createHeadlessGame` → `loadReplay` → 逐条 `replayStep(true)`。440/440 条全部检查点通过，零 OOS，最终 D1、客观回合454、HP36、未终局。录像只覆盖这段 D1游玩，并非已通关/死亡的长局。
- 下文命令号为人读的 **1-based**（JSON `index + 1`）；坐标为引擎0-based。
- 原始逐命令物品/过滤/位置记录、消息及审计日志在 `/private/tmp/replay-1018/`；大体积 trace 不入仓库。SSR 的 HMR 端口因沙箱 EPERM 报错，但模块加载与引擎回放正常完成；不是游戏错误或录像损坏。

## 1. 装备未拾取：预设过滤 + 探索目标错误

| 命令 | 回合/位置 | 观察 |
|---|---|---|
| 86、89、92 | 75、77、79；D1 (73,17) | 普通武器 id16（穿刺旗标）仍在地面，包内5件 |
| 87、90 | 75、77 | 重新探索，随后离开又折返同一件装备 |
| 93 | 80；(73,17) | 手动pickup成功，包内6件 |
| 360、363 | 335、337；D1 (19,13) | 普通护甲 id15仍在地面，包内7件 |
| 361 | 335 | 重启探索后再次折返 |
| 364 | 338；(19,13) | 手动pickup成功，包内8件 |

两件均 `rarity=normal`、`identified=true`；过滤一直是 `minRarity=magic`、三装备类别全开、金币开启。故这两处**不是满包、未知物品、装备类别缺失或绑定失效**。`ExtensionRuntime.itemAutoPickup`直接查询模块策略，正常返回false；丢失显示绑定也不是引擎过滤的绕过入口。

原生走路/探索共享 `pickUpItemAfterDisplacement`，拾取属于移动回合，不额外耗时。显式pickup绕过loot过滤。CE `Movement.c:1465–1466`调用拾取，`Items.c:838,865–888,930–934`规定打断、金币不占包和满包后避免反复尝试；`Movement.c:getExploreMap`不把 `ITEM_PLAYER_AVOIDS`作为拾取目标。参照本机 `~/Documents/同步空间/brogue/BrogueCE-master/src/brogue/` 的执行路径（本次未联网更新CE）。

实际缺陷：BFS只排除原生avoids，完全忽略loot过滤；移动到过滤物品后还无条件停止自动行动。因此出现“走过去不捡、反复探索绕回”的假卡住。

修复：

- 探索目标同时满足原生avoids和扩展拾取策略；经过被过滤物品不再因该物品停止自动行动。
- 不给过滤物品永久写avoids，改变过滤后能立即重新拾取。
- 同格有多个物品时，选择第一个符合条件的物品，防止被过滤物品挡住后面的可拾取物品；仍保持每次位移拾取一个的既有行为。
- 标准/丰饶的magic默认是既有设计，保留；过滤面板和手册明确：想自动拾取全部装备，选“普通”并启用全部三类。未知装备按稀有度/类别过滤，不必先鉴定。
- 满包仍提示并置avoids，金币遵守开关但绕过容量，手动pickup仍可越过过滤。

## 2. 麻痹：26个MORE，而非26次玩家回合/危险确认

第439条 `item:command quaff|e|` 在 D1 (14,6)喝麻痹药水，客观回合409→454。调度器原本已经由**一条命令**排完45个客观块；麻痹反复续到20，气体消退后恢复。该命令无确认决策。

错误来自 `Game.applyEnvironmentalEffects`：`applyStatus('paralyzed',20)`刷新时仍返回成功，于是每次都log需确认消息。Logger归档折叠成一条×26，但显示队列保留26个独立occurrence，PresentationTimeline依次等待MORE。停止自动行动不是这个末尾场景的原因。

CE `Time.c:475–490`只在此前未麻痹时输出需确认提示；`2494–2872`的do/while持续推进，麻痹时短动画，直到恢复/终局。修复只在本次进入麻痹时排MORE，持续刷新不再排第二次；其他警告、首次陷阱提示、死亡/重要事件原样保留。恢复消息仍自动呈现。

为保持既有同版本回放的日志摘要，新增Logger的**纯呈现选项** `suppressAcknowledgment`，只控制是否排显示occurrence，原归档和机械消息证据不变，故消息历史中可能仍见×26。无新Game字段、不改时钟/状态持续时间/RNG/命令数，不吞掉其他来源的重复警告。

现场验证：从原录像回放到第438条，取真实快照恢复为活局，安装真实 `DialogService` + `PresentationTimeline` 后执行第439条：原版26次MORE，修复1次MORE，均自动结束于回合454、无麻痹，显示捕获失败0。另有动画开/关的真实气体回归和原陷阱→受击→死亡回归。

## 3. 其他异常与限制

| 项目 | 结果/处理 |
|---|---|
| 探索在普通装备附近往返 | 已修，是本次最明显的额外行为异常 |
| 同格过滤物品挡住可拾取物品 | 代码检查确认并低成本修复；录像未包含该布景，已补独立回归 |
| 规则异常、OOS、未结束的确认 | 原440条回放无异常；未发现其他可确证规则错误 |
| 麻痹时单命令主线程长任务 | 初次headless采样第439条约192ms，Node挂载原版UI时间线的探针约335ms；45个客观块集中结算，有潜在短暂停顿。本轮未重构调度，非正式性能验收，不能据此推断设备FPS |
| 包体 | Vite仍提示>500kB chunk（主包约3.5MB，gzip约1MB）；不在此修复中做拆包 |
| 画面、真机、帧率/交互 | Playwright Chromium启动被macOS沙箱MachPort拒绝，本地监听亦EPERM，未能取得可核验截图。不声称浏览器整局视觉验收通过；Node时间线覆盖不等于浏览器绘制验证 |
| 测试环境提示 | Node的 `--localstorage-file`提示与Vite HMR EPERM记录在原日志；不是游戏运行报错 |

## 4. 录像语义与版本

- **麻痹修复单独应用**（Vite只读载入HEAD的拾取/版本代码，叠加新Logger及麻痹呈现选项）后，原录像仍440/440、零OOS，最终回合454/HP36。此为单变量兼容性证据，不是绕过正式加载检查。
- 探索过滤会改变寻路和停止点，不能让同样的 `auto_explore/auto_step`在同一版本下解释成另一条路线。因此 **loot module/rules 0.9.0→0.9.1**，同步既有fingerprint派生。foundation20、world/recording/schema、生成目录/RNG算法均未改。
- 正式新代码对原0.9.0录像/存档明确拒绝；不改原录像、不重写旧检查点、不迁移。仍可用发布版本0e684d1查看原件。
- 新0.9.1中把原440条用户输入当作**新局输入**重新执行并原生录制，得到新的440条录像（路径改变，最终回合284/HP36）；新录像完整回放与seek 85→440均零OOS。它是新录制，不能冒称原录像在修复版上仍走相同路线。
- 新版同版本存读、回放、seek、续录继续由相关集成测试验证；旧版本七组合/性能冻结证据不冒用为0.9.1的新验收。

## 5. 回归与门禁

新增10项loot回归（`loot_auto_pickup.test.ts`，登记模块本地test-suites）和2项动画开/关的麻痹呈现回归。原有守卫/断言未放宽，未更新生成基线或黄金trace；5个UI结构快照按下述单变量归因重录。

首轮新测试布景缺少视野刷新/稳定气体且使用了错误Item构造参数，10失败/27通过（失败均为新增测试）；修正新夹具后37/37通过。类型首轮指出新测试读取私有字段，改为公开 `isAutoTraveling()`。这些不是旧测试前提变更。

最终证据日志统一在 `/private/tmp/replay-1018/`：

| 验证 | 结果 |
|---|---|
| 初次相关12文件（`related.log`） | **exit1**，245通过/6失败；保留原退出码 |
| 原生旅行 `x3_u4_auto_travel.test.ts`（`native-travel.log`） | exit0，38/38 |
| 受影响3文件最终复核（`final-affected.log`） | exit0，91/91；未受影响9文件160项沿用初批通过证据 |
| `npm run check:modules`（`boundary-dependencies.log`） | exit0，含module boundary、测试归属、测试依赖检查 |
| `npx vue-tsc -b`（`types-final2.log`） | exit0 |
| `npx vite build`（`build.log`） | exit0；与npm build的构建部分相同，类型另行执行；含包体警告 |
| `git diff --check` | 通过 |

相关范围合计13文件/289项完成覆盖；**不是一次完整批次全绿**，不累计先前重复运行次数。生产源码在最终类型/构建之后未变；反事实期间临时回退的文件按原字节恢复。未跑全量、drift、生成普查、七组合或性能门禁。

初次12文件为：loot的 `loot_auto_pickup`、`loot_integration`、`loot_commands_integration`、`loot_ui_components`、`loot_ui_i18n`、`loot_inert`，以及 `presentation_timeline`、`x3_u8a_forced_turns`、`x3_u8b_items`、`x3_u6_messages`、`ux_1a_end_ui`、`ext_foundation_boundary_audit`；均以 `npx vitest run <完整文件路径列表> --maxWorkers=1` 执行。最终复核为loot的auto_pickup/inert/ui_components三文件。

### 原测试前提/快照更新登记

1. `loot_inert.test.ts`固定版本0.9.0失败；**只回退session.ts**到HEAD，其余修复保留，原测试2/2通过（`counterfactual-version.log`）。恢复后只改版本预期为0.9.1，仍精确检查版本、默认关闭/状态校验/RNG中性，不改断言语义。
2. UI的 `filter.standard`、`filter.dirty`、`filter.no-classes`、`filter.read-only`、`filter.bountiful` 五快照各新增相同的帮助段落。**只回退LootPickupFilterForm.vue**到HEAD，其余修复保留，原79/79通过（`counterfactual-ui.log`）。恢复后使用原renderer/serialize入口 `npx vitest run src/ext/modules/loot/tests/loot_ui_components.test.ts -t 'filter\.' -u --maxWorkers=1` 重录（`ui-recapture.log`）。逐项唯一变化均是 `p.loot-filter-notice`及其i18n文本，共15行；控件、默认值、事件与其余快照未变。重录时74项按名称筛选未执行，最终整文件79项已实际通过。

### 探针复用

临时脚本已移到 `/private/tmp/replay-1018/scripts/`。从仓库根执行 `node /private/tmp/replay-1018/scripts/audit.mjs baseline|paralysis-only|current`（三种参数分别运行），通过Vite的只读load插件选取 `git show HEAD:<生产文件>`，不修改工作区；必须仍以0e684d1为HEAD复用该基准。`audit-baseline.log`、`audit-paralysis.log`、`audit-current.log`分别保留原版、仅麻痹修复、正式新版的事实。`current-recording.json`为新录制，原 `replay.json`未修改。

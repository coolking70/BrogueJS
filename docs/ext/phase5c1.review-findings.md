# 5C1 独立审查

**结论：阻断交付，交原执行会话修复后复审。** 本轮确认 2 项 P1、3 项 P2（其中一项是必要验收缺口）、1 项 P3；未修改生产、测试、配置或既有报告，未 commit/push、未派子代理、未开启新门禁。

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F1 | P1 | 合成抽屉打开时原生移动被输入屏障直接丢弃，指定的移动跟随合同仍未实现 |
| F2 | P1 | 创建/扩张要求整个管理矩形同时可见，排除天然岩石范围并使多个自然生成层无任何 9×9 候选 |
| F3 | P2 | 营地 UI 的床边休息 payload 多出 inventoryStamp，始终 C5_BAD_PAYLOAD |
| F4 | P2 | 建营地页展示目标与实际提交光标不一致，可在展示格之外付费建营 |
| F5 | P3 | 桌面营地面板显示“收起”按钮，但折叠样式仅适用于 ≤700px，桌面只改标签 |
| F6 | P2 | 必需的自然营地闭环、完整真实浏览器矩阵与施工后 UI 性能证据尚缺，当前专项不能替代 |

审查基线/HEAD：`9b651572b3c5561f91b3773dead11908ffa63b34`，分支 `ext/phase5`。审查开始、探针完成及报告写入前的 `src/scripts/public` 输入 SHA-256 均为 **`1eb3d53a127b0b8fba5f0497f5616cedc0e97242b919b379b006934be56c36bf`**，1146 文件；逐文件差异 `[]`。指挥消息称“输入SHA”的这个 64 位值实际是上述路径/逐文件 SHA-256 清单的聚合 SHA-256。九个 5G 冻结文件与基线逐字节一致；forageFixture 完整已跟踪目录也直接对基线 blob 核对一致。证据见 `/private/tmp/brogue-commander-20261007/phase5c1-review-evidence/input-before.json`、`input-after.json`、`frozen-check.json`。

## 1. 范围与证据方法

按根 AGENTS、HANDOFF/development/architecture、当前 ext README 政策、指挥交接、5C1 任务书/配置/报告、完整营地设计（特别 §4.2、§6、§8.3a、§11–14）、foraging §10、5A3 §6–7、5A4 §8、5B 集成报告审查。新产品合同及本次冻结/门禁限制优先于历史 CE 文档；没有运行 CE 或全量门禁。

检查基线以来全部 tracked diff 与新增文件：共享引擎/运行时/只读 SDK、结构校验与退款、显示/相机/输入、两个 locale、读点登记、唯一既有测试修订；新增 settlement 包的 schema/state/机械数据/命令/投影/全部 UI、11 个自有测试及 helpers/清单；新增 StructureProduction/constructionSchema/structureSdk/mapViewport/moduleMapSelection；文档差异。完整范围清单和 diff 保存在外部 `tracked-final.diff`、`new-files-final.txt`。`zh_CN.json` 最终只有两个新增键及必要逗号，没有中途大面积格式改动。

独立临时探针直接加载冻结候选的生产 catalog/Game/UI session；全部代码、配置和日志在外部证据目录。受控初始场景复用现有 harness/helpers，但新增观察、调用和断言由本审查编写，没有改候选测试。自然几何扫描单列：真实生成地图不改地形，使用纯 FOV 掩码扫描；它不是自然行走，也不是浏览器验收。

结论落笔前已读取 `phase5c1-finalize.done=exit0`、执行者最终 last/report、两个批次 state、fixture-only-diff 与 delivery-manifest。原 `phase5c1.done` 未生成符合本次交接，不列产品问题。执行者文档整理期间 README/progress/status 有变化；生产/测试/脚本/public 没变，不需暂停源码结论。

## 2. 确认发现

### F1 / P1 — 打开抽屉时移动入口直接 return

**位置：** `src/App.vue:434`，`src/components/GameCanvas.vue:427`、`:434`、`:1004`；营地键盘处理另见 `src/ext/modules/settlement/ui/useSettlementUi.ts:311`、`:333`。

App 将所有 `modulePanelOpen` 当作 `GameCanvas.displayModalOpen`。InputManager 回调在调用 `handlePlayerAction/executeCommand` 前直接 return；非选格的地图点击也被挡。增加剩余视口测量及 ticker 中的相机更新，不能让原生输入抵达引擎。营地 handler 在打开期间也无条件消费未处理键，收起状态仍是 panelOpen。

**复现与独立核对：** 已直接检查指挥固定构建 `browser-smoke-02/390x844-original-normal/follow-observations.json` 与 `closed-dpad-control.json`：合成打开、八方向触摸每次输入增量/回合增量/移动均 0；关闭后同一右方向同一起点 `(38,26)→(39,26)`，输入和回合均 +1，`touchValidated=true`。独立查看该目录 `0037-crafting-tab-craft-layout.png`，DPad/玩家确实可见，不能归因按钮被遮挡。该构建输入 `4a18f719…` 与当前输入仅三个自有测试文件不同，生产完全一致；上述当前源码执行路径确认失败仍适用。**本审查没有重新执行真实浏览器**：可用运行时返回 `No browser is available`；真实触摸结果归属指挥，源码归因归属本审查。

**影响：** 任务书 §5 明确要求“合成抽屉打开时”移动跟随，当前打开抽屉无法移动；收起营地面板也无法原生移动。不能用关闭抽屉的成功对照或 camera 纯函数通过关闭此项。

**最小方向：** 区分非模态抽屉、建造选格和 DialogInput/原生确认/ACK 输入所有权。允许合同要求的抽屉外原生移动抵达唯一命令入口；选格键只在选格态消费；真实模态仍保持优先。修后保持抽屉打开，实测输入记录、回合、位移、相机及逆坐标，不能通过自动关抽屉规避。

### F2 / P1 — 管理范围被误当成必须同时看见的施工足迹

**位置：** `src/engine/Core/StructureProduction.ts:308`–`:312`，`src/engine/Map/StructureWorld.ts:784`–`:786`（create/expand 共用）；规格 `docs/ext/phase5-settlement-world.md:94`（§4.2）。

规格要求标记在已探索、当前可见、可达、安全位置，且明确“矩形可以包围天然岩石，但有效建设/工作格必须可达且合法”。候选却两处要求 bounds 的每个格当前可见。岩石后排通常不可见，普通探索无法令完整岩体同时可见；房屋建成后自己的墙也会让扩张要求检查的旧范围不可见。

**独立实测一：** 在受控 9×9 里仅设置 x=17/18 的两列不透明墙，生产 updateVision 后整块已探索/有记忆，标记 `(21,12)` 可见且邻接玩家。x=17 的九格在墙后不可见，公开 establish 返回 `C5_BLOCKED`，机械 digest 不变。保持所有地形/物品/材料/目标/区域不动，仅将这块可见标记改为 true，同一 payload 建营成功。这是资格单变量探针，不冒充自然路线。

**独立实测二：** 不改变真实生成地图，对每个可通行位置用半径 100、`cell.isOpaque` 的生产纯几何 FOV 掩码，枚举能包含其邻接标记的全部 9×9 矩形。不给照明、敌情、保护格等再加限制，因此是普通非透视视觉的宽松上界：

| seed | 层 | 扫描可通行位置 | 至少有一个整矩形几何可见的起点 |
| --- | --- | ---: | ---: |
| 5 | D1 | 928 | 0 |
| 5 | D5 | 707 | 0 |
| 51020001 | D1 | 910 | 173 |
| 51020001 | D5 | 939 | 0 |
| 12345 | D1 | 868 | 90 |
| 12345 | D5 | 796 | 0 |

零值说明这些图连宽松几何上界都没有候选，取得两份 FOOD 或清怪不能解决。非零值只是必要条件可通过，不代表完整合法营地。D5 用直接首访生成准备，未走 D2–D4，不称自然跨层闭环。特殊透视能力不在这次普通视觉扫描内。详见 `probes.json` 的 `rock-visibility`、`natural-geometric-scan`。

**影响：** 自有 40 层用例在抹平地图、人工赋可见性的布景中通过，不能支撑自然 D1/D5 的可玩停点。该检查也将天然岩石边界和已建房屋后的范围扩张排除，与批准管理范围合同冲突。

**最小方向：** 分离管理 bounds、实际放置标记及施工足迹的已知资格；天然岩石按管理范围合同处理，实际可用格继续严格保护和检查可达/当前可见。不要只删 isVisible 后直接返回隐藏机器/实体的具体拒绝码；须同时保持未知信息不泄漏。增加未改地形的自然 D1/D5 公开建营证据、岩石范围及建墙后的扩张回归。

### F3 / P2 — UI 床边休息永远提交错误字段

**位置：** `src/ext/modules/settlement/ui/useSettlementUi.ts:120`、`:273`–`:278`，`src/ext/modules/settlement/ui/view.ts:37`，`src/engine/Core/StructureProduction.ts:109`。

公共 payload helper 对每种 action 都 spread `base(v)`，包含 `inventoryStamp`；rest 的严格键集只有 `v,stateRevision,restPointId,restPointRevision`。UI 的 `onRest` 没有移除 stamp。

**独立实测：** 用公开命令建立营地和床，启动真实 `useSettlementUi`，调用面板实际 `onRest` handler。录制的数据含 `inventoryStamp`，`lastError=C5_BAD_PAYLOAD`，没有 RestPoint 自动行动，时间增量 0，面板却关闭。只对照去掉该字段的同一公开 rest 请求，立即成功并启动原生 rest。证据 `probes.json/ui-rest`。这是 UI session→真实 executeCommand 的入口复现；未称浏览器点击实测。

**影响：** 引擎原生床休息用例通过，但玩家的正式面板不能启动床边休息，闭环缺一环。

**最小方向：** 按 action 构造正确基础 payload；保持 rest 严格校验，不放宽允许未知字段。补正式 UI handler 到原生休息的回归，并在真实界面检查启动、确认、饥饿/耗时及打断。

### F4 / P2 — 建营地展示格与付费落位格不同

**位置：** `src/ext/modules/settlement/ui/SettlementPanel.vue:191`，`src/ext/modules/settlement/ui/useSettlementUi.ts:159`；cursor 的 build 页更新及切页处理见 `:324`、`:391` 附近。

建营地页固定显示 `model.at.x+1,model.at.y`，establish 却提交共享 `cursor.value`。切到建造页改光标后再回营地页，光标保留但选格轮廓取消，目标行没有随之更新。

**独立实测：** 玩家 `(20,12)`，打开面板→建造→方向调到 `(20,13)`→营地→选择 2 粮→建立。目标行按模板显示 `(21,12)`；实际录制 payload 与建立标记均为 `(20,13)`，营地数变为 1，付费成功。证据 `probes.json/ui-target`。

**影响：** 玩家根据错误预览确认付费，标记与 9×9 范围落在另一位置；若遗留光标远离玩家，则目标行看似邻接却被距离拒绝。营地页本身也没有可见的选址控件，首次默认右格不合法时只能借建造页绕行。

**最小方向：** 建营地使用一个明确、可选、可预览的目标源；展示、范围、地图轮廓、确认及提交必须取同一目标。切页不能默默改变或隐藏将要付费的目标。

### F5 / P3 — 桌面“收起”只有标签变化

**位置：** `src/ext/modules/settlement/ui/SettlementPanel.vue:122`–`:124`、`:506`、`:523`–`:529`。

收起按钮无视口条件，桌面始终显示；改变 collapsed 只添加 class，所有针对 is-collapsed 的高度/内容隐藏/shell 恢复规则都在 `@media(max-width:700px)` 内。1440px 时按钮变“展开”，nav/main/footer、370px 右栏及占用地图空间保持原样。

**证据类型：** 明确静态依据，未独立执行桌面浏览器。本项不同于 crafting 的桌面隐藏折叠按钮；没有强点隐藏控件。

**最小方向：** 若只支持窄屏收起，桌面隐藏此按钮；若桌面也提供，落实折叠几何及地图空间更新。真实桌面开合实测后关闭。

### F6 / P2 — 必要自然和浏览器覆盖未完成

**位置：** `docs/ext/phase5c1.task.md:50`–`:58`（§5–6），`src/ext/modules/settlement/tests/helpers.ts:15`、`:60`，`src/ext/modules/settlement/tests/settlement_persistence.test.ts:9`，`docs/ext/phase5c1.report.md` §3/§5/§6。

任务要求自然 D1/D5 可用闭环与真实浏览器 1440/390/320×普通/沉浸×四地图模式，以及建造/存取/休息/撤营、长内容/满包和合理施工后的 UI 情况。目前真实浏览器仅390原版普通部分布局与有效失败对照；自然寻粮未获第二份 FOOD，未完成营地动作整链；矩阵、实机、施工 FPS/流畅度未验证。候选 helpers 将大部分地图改 FLOOR、预置粮食/材料并搬远怪物，D5 从深度准备开始；这可以验证命令/持久事务，不能验证自然产品入口。F2/F3 正是这类覆盖缺失漏掉的实际问题。

**报告诚实度：** 最终报告明确承认上述未完成、保留浏览器两个 exit1、区分两个输入 hash 和 engine-only 性能；没有以未填占位或中途中断判产品坏。首段“已实现休息”只能按引擎能力理解，不能据此证明面板休息可用（F3）。`No available adapters` 另有指挥最新 `browser-gpu-control.json`：无应用 JS 的 favicon 页面复现，归环境探测，不列独立产品缺陷。

**最小方向：** 原会话先修 F1–F4，再由有浏览器权限的指挥按固定新构建补自然双粮→建营/施工/真实存取/床休息/撤营及徒步跨层证据，继续完整 UI 矩阵和合理施工后流畅度测量。记录 seed、公开输入、输入 hash、实际看图及控制台结果；模拟触摸/实机分别列。不是要求重跑 npm test/test:ext/全组合/删除矩阵；那些仍留 5Z。

## 3. 已独立关闭的中途假设与其他核查

| 风险/合同 | 本次结论及依据 |
| --- | --- |
| 删 locked=[] 免费解锁 | **关闭**。state.ts:60 要求总和恰 2；独立坏档 loadSnapshot=false，旧局 digest 不变。少锁 1 的候选负例也保留 |
| 伪造退款 99 或删除实付账单 | **关闭所述攻击**。StructureProduction.ts:885 核验组件/账单数量，:902 起核验批准 bill/tag/kit；独立删账单、count99、错标签各拒载且旧局不变。不是密码学防篡改保证 |
| 当前层未见补给实时库存泄漏 | **关闭所述攻击**。:719 附近只读 boxes 过滤 isVisible，:789 附近只在补给可见时取当前报告；独立令已知补给不可见并将真实数量改 7，boxes 不含该箱，reportItems 仍为旧报告 |
| 原子事务及实际 Item 所有权 | 独立建营/转移/拆卸/撤营各在 worldCampReplace 实际发布后抛异常，完整对象图 oracle 差异均 []，ID/RNG 恢复；整堆 FOOD 建营/撤营保持同一对象/ID，通用取 1/2 份均 C5_RESERVED。没有发现本次样本内漏回滚 |
| 部分 FOOD/额外粮/材料标签/kit | 阅读通用 plan/commit/putContainer 单一根与后缀锁逻辑、实际付款/退款路径；候选额外粮合堆、ration+mango 原 ID、crafting kit0退款与明确箱来源测试成立。未独立执行全部交叉组合，不宣称所有入口穷尽证明 |
| 标记损毁/残骸/满包/死亡 | 补给标记当前是非战斗 interactable，不是可拆结构；仅撤营解锁的明确可逆策略有文档。普通箱走已有真实掉落/remains；满包拒绝撤营不吞粮。没有把尚未实现的可战斗补给残骸记通过 |
| D40、上限、slot 高水位 | 整层 D40 禁令已删除；实际楼梯/portal/机器/impregnable/reservation 仍检查。40层及8营地/重建测试是布景边界证据；不能覆盖 F2。384格/16箱（含补给）/64槽/全局更严预算沿底座，不见本次扩容绕过 |
| 房间/施工/危险/休息 | 复用性质/逃生/房间内核，未另造规则；危险建造有六地形负例，16格逐条耗时、No/失效/ACK 暂停有自有回归。原生休息机制可用，正式 UI 入口另为 F3；房屋围合/最大拓扑浏览器不作通过声明 |
| save/replay/seek/续录/跨层 | 检查生产录制入口、严格根引用及生成写集；候选 persistence 的 D1/D5操作及D1↔D2是真公开命令与真实楼梯，但地形/资源起点经过布景。读取最终日志确认执行者结果，不冒称本审查另跑其完整链或自然旅程 |
| 模块缺席/生产权限 | descriptor defaultEnabled=false；模块只声明自有数据并接收 detached/frozen 只读 DTO；没有导入其他内容模块数据或注册 DEV 结构 fixture。可信 token WeakMap/epoch/used、严格外壳、CAS复验仍在引擎。未新增 Game 字段/格式号；九冻结文件未动。可移除全矩阵未运行 |
| 图形/相机/ACK/布局 | 读取最终显示字符映射及火/楼梯优先；实体覆盖沿既有路径。已查看指挥两张390图，当前画布/玩家/DPad在抽屉之上，75px遮挡旧假设不再成立；presentationHidden已被声明/消费，现有指挥日志不复现原Vue警告。关闭这两项局部旧假设不等于24矩阵通过 |
| 性能/源码守卫/既有测试 | 普通 wait P95与256摘要分列且明确独立场景差，不假称配对因果/FPS/最大长局。StructureWorld 唯一既有 D40 测试只改保护前提，拒绝断言不变；外部单生产文件反事实已有 exit0，读点hash对应去D40条件，未扩大分类/次数。未新增 skip/放宽门限/重录黄金 |

## 4. 实际执行、退出码与限制

本审查验证命令在仓库根执行，前置 Node24.19.0 runtime PATH，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。没有运行 boundary/types/build/drift 或其他新门禁；只运行用户要求的独立临时探针。

```sh
PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
NODE_OPTIONS=--max-old-space-size=3072 \
node node_modules/vitest/vitest.mjs run \
  --config /private/tmp/brogue-commander-20261007/phase5c1-review-evidence/review.config.mts \
  --maxWorkers=2
```

| 实际操作 | exit/结果 | 覆盖 |
| --- | --- | --- |
| 首次上述临时探针，输出 probes.log | 0；1文件5项，7.06s | 坏档/未见、UI休息、UI目标、岩石单变量、六图自然几何扫描 |
| 增加事务/锁身份后同一命令，输出 probes-final.log | 0；1文件10项，10.25s | 完整包含前5项及四操作晚发布故障、通用锁/整堆身份；不累计为15项 |
| Python 路径/逐文件 SHA-256、冻结blob对照 | 0；输入相等、差异[]、九文件及完整fixture相等 | 源码冻结与无审查写入；外部manifest |
| git diff --check | 0 | 当前候选 LF/空白检查，非功能门禁 |
| MiMo 首选浏览器运行时查询 | 工具错误：agent is not defined | 未执行网页操作 |
| CUA 选择固定构建浏览器 | No browser is available | 未启动/绕过浏览器；限制见 browser-availability.json |
| view_image 两张已有真实PNG | 成功、已实际查看 | 指挥390原版普通局部画面；不算本进程浏览器运行 |

探针的“10 passed”表示观察/拒绝/回滚与预期一致，**包含对当前缺陷的断言，不表示产品全绿**。详见 `review.test.ts`、`review.config.mts`、`probes.json`、`probes-final.log`。

执行者已有门禁作为交叉核对事实，非本审查新运行：final输入`4a18f719…`，118专项+963相关/1既有CE skip+drift8及boundary/types/build exit0；final-fixture输入`1eb3d53a…`，118专项及boundary/types/build exit0。原始清单证明两批仅helpers/boundaries/persistence三个自有测试文件不同，生产相同；没有把定向集合冒充完整npm test/test:ext。当前源码持续匹配后批。

未完成本审查独立真实浏览器运行、自然完整公开路线、实机、最大预算/长局性能、全部组合/实际删除、全量测试。没有针对缺失5G内容作集成推断。唯一仓库新增文件是本报告；临时运行只改变内存测试局和外部证据。报告完成即停止，等待指挥将 F1–F6 交原执行会话处理。

## 5. 修复定向复审（2026-10-08）

**复审结论：仍阻断交付。F1–F5 的原代码问题关闭；新增 R1 / P2 确认共享测试破坏模块物理可移除性，须交原执行会话修复。F6 的自然可用性和24场景浏览器动作证据已补齐主要部分，剩余验收范围须由指挥明确收口，不能沿用旧“自然闭环未完成”的结论。** 本节只追加，不改写上文历史发现和旧失败。

| 项目 | 本轮裁决 | 独立依据与范围 |
| --- | --- | --- |
| F1 / 原P1 | 原代码问题关闭 | 真实 InputManager→Canvas→Game 入口的抽屉外移动、收起后的方向键、表单隔离及 Confirm/ACK 优先通过；最终 crafting guard 单独验证。最终浏览器24场景 exit0，仍与实机覆盖分开。 |
| F2 / 原P1 | 关闭 | 岩体遮挡与自建墙后的扩张成功；实际标记机器/楼梯仍拒绝，隐藏标记泛化拒绝且不付费；正常天然 D1/D5 专项通过。 |
| F3 / 原P2 | 关闭 | 正式 session 的 pending No 留面板、Yes 启动休息并关闭、距离拒绝留面板；payload 严格四字段，正耗时/饥饿及 Escape 中断通过。正耗时探针是受控伤血场景。 |
| F4 / 原P2 | 关闭 | 切建造页不污染 campTarget；地图回调、81格轮廓、面板 props、录制 payload 和真实营地标记一致。已抽看最终自然选址截图。 |
| F5 / 原P3 | 关闭 | 桌面 toggle 的基础 CSS 为隐藏，≤700px才显示；收起解除选格、展开重注册。最终桌面/320截图抽检符合该设计。 |
| F6 / 原P2 | 大部分补齐，剩余验收未整体关闭 | 自然双粮/付费闭环、24场景动作及小规模施工后短时浏览器采样已有证据；长内容/满包、持续合理规模施工及部分复杂浏览器流程仍不可从这批结果推断。见§5.4。 |
| R1 / 新P2 | 确认，阻断 | foundation 自有测试无条件要求 settlement/crafting。两个真实删除外部副本分别失败，测试仍在 test/ext 发现集合内。 |

### 5.1 输入、冻结与报告复读

按外部 `phase5c1-rereview.task.md` 与仓库修复任务定向复审。已读完成后的 `phase5c1.report.md` §8.1–8.5、最终日志/manifest、配置说明及当前 ext 测试归属和删除政策；结束前再次读报告末尾，并核对 `phase5c1-fix.done=exit0`。执行报告明确区分开发失败、最终门禁、自然路线规划、受控场景和浏览器接力，未把接力脚本语法通过写成实际浏览器通过。其§8.5早于指挥后续浏览器交付，不能把当时“待验”文字或工具的 pending 占位当作产品缺陷。

- HEAD/基线：`9b651572b3c5561f91b3773dead11908ffa63b34`，`ext/phase5`。
- 审查前后 `src/scripts/public` 1151文件聚合 SHA-256 都是 **`1b7565be78c172c9203061eded7698dcc928ed7b5046d3babfc828e6712b7681`**，逐文件差异 `[]`。与上轮审查1eb输入的21个变化路径已记录、定向复核。
- 另计 package/tsconfig/vite配置、index.html、AGENTS.md 的扩展聚合为 `b1dba4fe59d18c996b7472d0300f6037c33a56f01deb1fbdb5e7f9787953b5eb`，前后相同。算法为排序的“相对路径\0文件SHA256\n”再取SHA256。
- 九个5G冻结文件已由本进程直接对基线 Git blob逐一算SHA，全部相同；包括 worldHarness/forageHarness/forageFixture入口，不依赖执行者的相同声明。
- 临时证据根：`/private/tmp/brogue-commander-20261007/phase5c1-rereview-evidence/`。`input-before.json/input-after.json`、`frozen-check.json`、`finished-report-read.json`保留核对结果。

本进程没有修改生产、测试、配置、执行报告或其他仓库文档，没有 commit/push、没有派代理。唯一仓库写入是本文件的追加。

### 5.2 修复入口及反事实复核

独立新 `rereview.test.ts` 按修复后语义断言，7项通过；没有拿上轮“断言bug仍存在”的绿探针证明修复。受控准备复用现有场景 helper，实际输入/付费/确认/自动休息均走生产入口。这些场景明确不算自然路线或真实浏览器。

F1：`src/App.vue:436`分离创建模态与抽屉自动行动暂停；`src/ui/canvasGameInput.ts`保留真实输入命令入口。营地建造选格展开时方向键只移动光标，收起后同键真实走一步；接着 DPad 再走一步，录制新增2条，面板保持打开。真实 DialogService 的 confirm/acknowledgment 经 DialogInput 阻断同一移动入口；文本 INPUT 仍不漏给玩家。`src/ext/modules/crafting/ui/useCraftingUi.ts:141`的最终 guard 独立验证：抽屉内 BUTTON 的 ArrowDown 被拥有且 preventDefault，SELECT 同键被拥有但保留默认选择行为，Enter/空格/Tab保留控件默认行为，抽屉外方向放行。这一 guard 是 fixed2 之后的生产变化，不能只用 fixed2 通过覆盖。

F2：`src/engine/Core/StructureProduction.ts:283`仍检查实际标记探索/记忆；`src/engine/Map/StructureWorld.ts:835`仍保留范围内巨兽预留，`:836`保留工作/演员全足迹边界及隐藏冲突泛化。删除整矩形可见/天然地形 blanket 不等于放宽实际工作格保护。新探针在不变库存/时间断言下，机器标记拒绝C5_PROTECTED、同隐藏标记拒绝C5_BLOCKED、实际楼梯拒绝；随后岩体范围建营和自建墙后的扩张成功。新负例和既有修改仍保留 C5_PROTECTED/C5_BLOCKED 拒绝语义，而非改期望为成功。

反事实另由本进程建立两个外部副本：旧测试取自原审查1eb候选，逐文件SHA与原审查manifest一致；两副本的 src/scripts/public 唯一差异为 `StructureWorld.ts`。当前修复生产＋旧前提得到2fail/exit1；只回退该生产文件为上轮原字节得到2pass/exit0。因此执行者“仅生产文件反事实”可独立复现。最初诊断误取更早HEAD测试前提，旧D40 blanket在上轮已改过，得到当前2fail、回退1pass/1fail；这两份 `*-head-premise.log`原样保留，不计最终反事实。改用原审查字节后结果如上，未改任何拒绝断言。

F3：`useSettlementUi.ts:135`按action构造基础字段，`:285`只在原生休息启动后关闭。独立正式 UI payload 的键恰为 `v,stateRevision,restPointId,restPointRevision`。pending No 不启动、不花时间、不关面板；Yes按刷新完成边界关面板；受控伤血后的auto_step产生正tick和饥饿，Escape取消；远离床的拒绝保留C5_DISTANCE及面板。引擎未知字段校验没有放宽。

F4/F5：`useSettlementUi.ts:58`轮廓与`:176`提交共用campTarget；`SettlementPanel.vue:195`展示及坐标输入使用相同props。切页后地图回调选(20,13)，81格轮廓为(16,9)…(24,17)，录制和实际marker均落(20,13)。`SettlementPanel.vue:515`/`:517`为桌面隐藏、窄屏显示；收起解除地图回调，展开恢复。组件CSS测试是静态证据，实际画面依据另列于§5.4。

### 5.3 R1 / P2 — 新共享核心测试留下不可删除的生产模块依赖

**位置：** `src/test/ext_settlement_input.test.ts:11`、`:14`、`:32`、`:50`–`:56`、`:106`；`scripts/test-suites.json:66`；`scripts/test-discovery.mjs:72`的ext集合规则。删除合同见 `docs/ext/README.md:58`及`:79`。

**触发与影响：** 物理删除 `src/ext/modules/settlement/` 或 `src/ext/modules/crafting/` 整目录，保留其他底座/模块与其已登记测试。该新文件归foundation，不随模块删除；setup默认要求settlement，crafting分支同时要求两模块，后续又对UI catalog的find结果使用非空断言。公开catalog代替私有import虽然解决boundary静态导入违规，却没有消除硬依赖。合法删模块后的剩余test/ext门禁会必失败，违反模块自有测试随目录消失的合同；不能因完整删除矩阵留5Z而接受已确认的缺陷。

**实测：** 本进程复制当前候选到证据目录 `without-settlement/`、`without-crafting/`，仅在外部副本实际删各自模块目录，共享测试字节保持完全相同。发现器仍把该文件归 `{kind:foundation,moduleId:null,manifest:scripts/test-suites.json,suite:test}`，同时列入test和ext集合。

- 正常候选对照同一 `-t 'canvas native keyboard/DPad'`：2pass，exit0。
- 删除settlement：两分支都报 `Unavailable extension: settlement`，2fail，exit1。
- 删除crafting：settlement分支通过，crafting分支报 `Unavailable extension: crafting`，1pass/1fail，exit1。

失败发生在真实registry manifest/createWorldHarness，甚至早于find解引用；不存在仅将 `!` 换成可选链就解决的问题。每次另外3项只是名称过滤未执行，非新增skip。`minimal-removal-manifest.json`、`removal-discovery.json`、`without-settlement.log/without-crafting.log`与正常 `control-input.log`保留证据。本次只做该文件的最小删除探针，没有运行完整删除矩阵、types/build或全量test:ext。

**最小修复方向：** 把settlement真实UI入口用例放入settlement自有tests及模块清单；crafting真实入口用例放入crafting自有tests，使用自身场景而不强制安装settlement。共享InputManager/Canvas/真实模态路由测试使用不依赖可删除生产模块的底座夹具。保留原输入/录制/回合/相机断言，不能靠skip、可选模块缺席时直接return、宽泛exclude或空壳模块掩盖依赖。修后只需在两个外部删除副本复验必要最小集合；完整删除矩阵仍留5Z。

### 5.4 自然、浏览器、性能与剩余F6

独立重跑候选 `settlement_natural.test.ts` 两项，exit0。已完整读其源码和route：正常seed28、only settlement、正常出生(38,26)、初始1FOOD；76次公开move包含真实拾粮变2与普通战斗。没有人为改天然地图、落点、背包或RNG；离线规划用完整地图/物品/危险/演员知识，诚实标为预规划路线。D1真实付费建营、床、扩张、存取、正式UI休息、拆床/撤营，归还同一个原生FOOD对象/ID，save/load摘要及完整原生录像重放一致。**D5是在同一真实拾粮后直接depth=5＋native generateDepth的独立首访准备，保持背包/启动收据/原生落点，再公开走一格；不证明徒步D1→D5或D5未录准备的完整录像。** 该区别与执行报告一致。

浏览器证据按候选分开：

- fixed2源输入是 `406718f4754e18a0e3f669732446aaf724b9631bb8ba6307a57d88710d547bc6`；24场景及四地图自然闭环的旧成功仍属于该候选。
- 最终fixed3源输入是本轮 `1b7565…2b7681`。`browser-build-final-2.to-final-3.json`列出三个差异文件，其中生产文件为crafting的preventDefault guard。本进程直接核对 `browser-build-final-3/` 79个构建文件与其manifest逐字节匹配。
- 指挥最终 `browser-matrix-fixed3/state.json`/`done`已交24个独立场景全部exit0，URL5401；范围1440/390/320×普通/沉浸×四模式。几何/表单/抽屉操作结果可接受，不自动扩为每行完整营地玩法或实机通过。
- 指挥最终 `browser-v4-d1-final-01/run.json`明确URL5401、seed28、normal、only settlement、390原版；summary无fail，建营/锁粮显示禁取/床/拆床/箱/实际存取/拆箱/撤营及真实dialog隔离成功。公开下载录像中的rest是满血30/30、0tick/0饥饿原生完成，**不是浏览器正回血/耗时/活动中断证据**。对象身份/跨层等另靠引擎证据，不能由UI汇总数量证明。

本进程实际查看最终3张PNG：桌面 `0014-settlement-open-layout.png`、320 tiles沉浸 `0052-settlement-expanded-layout.png`、自然闭环 `0094-camp-coordinate-form-route-camp-target-after.png`。抽检中地图/玩家/DPad与抽屉分区、桌面无收起控件、窄屏收起按钮及自然选址(68,5)和9×9轮廓符合修复设计。**本人没有亲自操纵浏览器，也没有逐张目检24场景全部截图；指挥像素裁决独立保留。** GPU warning已有静态无游戏JS对照，仍归环境能力探测，未删除旧日志或退出码。

执行者最终性能门禁确为engine-only：营地普通P95 5.067500ms，对照4.741958ms，门槛是差值0.325542ms≤5ms；不能误写为“营地绝对P95≤5ms”。最终自然浏览器单床/单箱各1500ms rAF短采样P95约18.6/18.3ms，并记录六次面板响应；不证明持续施工、较多组件、长内容或硬件FPS。两种性能证据不可互换。

**剩余F6可行动清单：** 长名称/26格满包/64槽箱的真实组件显示夹具目前仅准备，需由指挥实际运行、看图并标明不是真实拾满背包；在合理多组件施工场景补持续交互/帧间隔；受伤床边No/Yes/活动中断、墙门窗屋顶/16格队列/ACK以及浏览器楼梯/save/replay/seek/续录，若仍属本步必要验收，应补对应公开UI证据或明确裁定延期。不得把自然满血零时间闭环、24行几何通过或准备脚本扩写成这些项通过。真实手机按已批准边界留用户试玩/5Z，不作为要求本进程反复申请权限的理由。上轮F6的“未拾到第二粮、无自然完整闭环、无24矩阵”部分现已关闭，残余是覆盖边界，不是新复现的产品失败。

### 5.5 实际命令、退出码与停止

以下为本进程实际运行。统一显式PATH选择Node24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。所有临时测试与副本在外部证据根；两个 `cf-*` 副本的旧前提测试不改仓库测试。

| 命令（Vitest前缀均为 `node node_modules/vitest/vitest.mjs run`） | exit / 数量 | 覆盖与日志 |
| --- | --- | --- |
| `--config /private/tmp/brogue-commander-20261007/phase5c1-rereview-evidence/rereview.config.mts --maxWorkers=2` | 0；7pass，10.35s | 新独立修复语义探针；probes.log |
| `src/ext/modules/settlement/tests/settlement_natural.test.ts --maxWorkers=2`，另设SETTLEMENT_NATURAL_OUT为外部natural目录 | 0；2pass，11.71s | 现有候选自然专项独立重跑，非独立新浏览器；natural.log、natural/D1.json,D5.json |
| `src/test/ext_settlement_input.test.ts --maxWorkers=2 -t 'canvas native keyboard/DPad'`（正常树） | 0；2pass/3名称过滤，4.19s | 删除探针正常对照；control-input.log。初次日志名removal-settlement.log实际在正常树运行，同份结果保留，不冒充删除结果。 |
| 同命令（without-settlement） | 1；2fail/3名称过滤，2.23s | R1真实删除复现；without-settlement.log |
| 同命令（without-crafting） | 1；1pass/1fail/3名称过滤，3.05s | R1真实删除复现；without-crafting.log |
| `src/test/ext_structure_protection.test.ts src/test/ext_structure_review.test.ts --maxWorkers=2 -t 'runtime region rejects protected terrain on D40\|P3 unseen region cells'`（cf-current） | 1；2fail/40名称过滤，2.53s | 当前生产＋原审查旧前提，预期红；cf-current.log |
| 同命令（cf-reverted） | 0；2pass/40名称过滤，2.48s | 唯一生产变量回退，旧前提通过；cf-reverted.log |
| 更早HEAD前提的首轮诊断（两个cf副本，名称匹配 `runtime region rejects D40\|P3 unseen region cells`） | 当前exit1/2fail；回退exit1/1pass/1fail | 非最终反事实，解释见§5.2；cf-current-head-premise.log、cf-reverted-head-premise.log保留 |
| `node --input-type=module`调用resolveTestSuites检查两个删除副本 | 0 | 归属和test/ext集合；removal-discovery.json |
| Python逐文件SHA/基线Git blob/报告完成标记与构建manifest核对 | 0 | 前后无源码/配置变化，冻结9文件相同，报告完成后复读，构建79文件一致 |

原执行者最终settlement133、related569、drift8及boundary/types/build均exit0，仅核对日志及稳定输入，不冒称本进程再次跑过，也未重复这些门禁。没有全npm test、全test:ext、全组合或完整删除矩阵。名称筛选显示的skipped均为未执行，不累计通过、不等于新增skip；缺CE启动提示没有在所选通过项里制造跳过。

复审报告完成后停止。请指挥将 **R1 / P2** 交原执行会话按授权修复，并处理F6剩余验收裁决；本进程不自行改产品或测试。

## 6. R1 测试归属修复独立复审（2026-10-08）

**结论：R1 / P2 已关闭，解除该项阻断；本轮未发现新增P1/P2/P3。** 旧§5的红删除结果保留为历史。当前生产与已验收GUI fixed3字节一致，正常输入及三个本进程自行建立的物理删除副本均通过必要最小集合。F6边界显示夹具与六设施持续交互仍待指挥完成，不将尚未交付的工具或结果猜为产品故障，也不在此宣布完整5C1验收通过。

### 6.1 完成交付与稳定输入

先核对 `phase5c1-r1-fix.done=exit0`，读取完成的 `phase5c1-r1-fix.last.md`、执行报告§9.1–9.4、原独立报告§5及新变化；结论前再次读完成报告并记录其SHA。没有使用半份报告裁决。

- HEAD仍为 `9b651572b3c5561f91b3773dead11908ffa63b34`，工作树 `ext/phase5`。
- 审查前后 `src/scripts/public` **1154文件 SHA-256 `9c291c76ce787448198df8d717554ca5fbb017f805b62c2512bb53b3dfc8b9df`**，逐文件完全相同。另计入口/config/AGENTS的扩展输入SHA为 `30daf0ab6ecc18fef64dd444738ec4b7fe7f184105d25d8ee254aa5310c21be4`，配置未变。
- 相比已独立审查的fixed3输入1b7565，仅8路径变化：共享清单、两个模块清单、新共享输入测试、两个模块自有输入测试、新场景helper及旧共享文件删除；没有生产路径变化。
- 九个5G冻结文件再次直接对基线Git blob核对，相同；包括未计入生产分区的testing harness/fixture，不以生产分类排除代替冻结验证。

本轮证据根为 `/private/tmp/brogue-commander-20261007/phase5c1-r1-review-evidence/`。`input-before.json/input-after.json`、`production-build-check.json`、`finished-report-read.json`记录上述独立核对。

### 6.2 源码归属与断言迁移

已完整阅读 `src/test/ext_canvas_input.test.ts`、`src/test/support/canvasInputScene.ts`、`settlement/tests/settlement_input.test.ts`、`crafting/tests/crafting_input.test.ts`及三个清单，并与旧共享测试原字节比较。执行者保存的 `ext_settlement_input.before.ts` SHA与本进程上轮fixed3清单相同。

共享新文件直接启动 `ruleSet:classic` 的真实Game并断言 `extensionRuntime=null`，没有安装可删除模块、没有UI catalog的find非空断言、没有跨模块私有导入。共享场景helper只准备原生地图/演员/物品，不读取生产模块。settlement自有测试只安装settlement；crafting自有测试只安装crafting且运行真实useCraftingUi，不再先建settlement营地。

旧输入语义完整迁移：实际InputManager键盘/DPad→Canvas→Game、两次位移和录制增加、回合增加、抽屉保持打开、390可用地图视口及玩家相机反算、真模态与文本焦点隔离、自动调度暂停和手动输入分离、公开interrupt_auto及不增加simulationTicks。模块用例还补第二次回合+2断言。共享测试增加真实DialogService Confirm/ACK答前阻断、答后移动/录制/回合正对照，不能由永久blocked夹具替代。旧5项拆为模块2+1、共享3，共6项；数量增加源于共享移动正对照，未削弱旧断言。

没有新增skip/todo、名称过滤、宽泛exclude、缺模块直接return、空壳模块或修改发现器/守卫。场景准备中 `extensionRuntime?.worldWorkEntities()??[]` 是兼容构造时经典origin，没有跳过模块测试；实际模块用例仍必须创建自身并走正式入口。`vite.config.ts`与发现器生产字节不变。

本进程实际调用resolveTestSuites验证正常树与三个自己的删除副本：新共享文件归foundation/moduleId=null并在test/ext中；两个自有输入文件分别归settlement/crafting模块并在其test/ext中。旧 `ext_settlement_input.test.ts`不再发现，删除模块时自有输入测试随目录消失，无stale登记。证据为 `discovery.json`、`migration-audit.json`。

### 6.3 独立正常与最小删除实测

本进程从当前候选自行复制src/scripts/public和入口配置到三个新外部目录，实际删除完整模块目录；没有采用执行者副本冒称自行复制。逐文件验证副本与正常树的差异恰为被删除目录文件，保留测试未改；运行后再次核对副本输入未变。依赖链接到已安装node_modules，各副本缓存留自身目录。

所有Vitest命令前缀为 `PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run`，后缀为 `--maxWorkers=2`；实测Node v24.19.0。没有测试名称过滤。

| 本进程实际目录和文件参数 | exit / 结果 / 时长 | 输入SHA与日志 |
| --- | --- | --- |
| 正常树：`src/test/ext_canvas_input.test.ts src/ext/modules/settlement/tests/settlement_input.test.ts src/ext/modules/crafting/tests/crafting_input.test.ts src/test/test_suite_membership.test.ts` | 0；4文件12pass；4.11s | 正常9c291c输入；normal.log |
| without-settlement：共享Canvas＋crafting自有输入＋membership | 0；3文件10pass；3.45s | `258568fbf8857cca55f068aa159c1b61ee5e29089b824985aa03298ff7504f5a`；without-settlement.log |
| without-crafting：共享Canvas＋settlement自有输入＋membership | 0；3文件11pass；3.17s | `93ff967718ea64f7bc49207df1a75bc8190efbb8f24d68ee5d774b8bd6457834`；without-crafting.log |
| without-all：删除combat/crafting/giants/growth/narrative/settlement全部六生产目录；共享Canvas＋membership | 0；2文件9pass；3.06s | `9b27d8e62bc2a1c6f88bccac85753156f429dd0c10499def8566aa9e6e905676`；without-all.log |

全部无fail/skip/todo。CE源缺失只是既有启动提示，没有跳过所选项。与上轮仅删settlement的2fail、仅删crafting的1pass/1fail形成直接修复对照；全部模块缺席时共享三项及归属六项仍实际运行。本轮没有全npm test、全test:ext、全组合、完整删除矩阵或重复types/build/drift长门禁。执行者57项及boundary/types/build结果仅读取，不计为本进程运行。

目录准备及逐字节核对Python命令exit0，resolveTestSuites Node命令exit0；环境记录命令exit0。`own-removal-copies.json`列完整删除列表及保留文件hash，`copies-after.json`确认运行后未变，`results.json`保存本进程数量/时长。

### 6.4 GUI候选字节与F6边界

本进程独立重算生产/入口513文件 SHA-256为 `02d95d2954f7b280a88208f184dda79837299153ffac2999cd03007b107d5dae`，与fixed3审查前输入的相同分区逐文件一致。另读取执行者只读Rollup buildEnd观察插件及实际模块图，1153个真实文件依赖当前字节与改前记录及构建图hash全部相同，无缺失记录；聚合为 `04e74b94edb703f718c2016e8b801f3b56cc1eac8506f938a439401a6282fece`。14个虚拟模块ID不冒充文件字节。这是独立核对现有构建证据，未自行重跑生产build。

新构建53文件 SHA为 `5fc2f8a26a9db4bef6821b69fac79a972bcca946d829a08606a54cc36b649b2e`。直接读取全部产物：所有同名文件与fixed3字节相同、无新增/变化，index.html也相同；fixed3原79文件仍与其manifest相同。固定目录多出的26个旧hash chunk均未被新53文件中的HTML/JS/CSS引用，因此整个目录聚合不同有可核对原因，不能误写两个目录hash相同。已通过GUI的有效生产字节可复用，无须因纯测试迁移再跑浏览器。

已读 `browser-matrix-fixed3/commander-visual-review.json`：sourceInput明确为1b7565，24个唯一场景各有1张实际目检代表图，文件均存在；另记录自然最终床/箱/结束3图。此为指挥实际目检，不能改写为本进程新浏览器运行，也不扩为查看每张before/after。既有最终24场景exit0、正常D1公开UI闭环与本次有效产物字节一致，可以沿用。

按当前复审任务的指挥裁定，高级浏览器跨层/save/replay/seek/16危险队列、密集长局与真实手机留5Z；这些仍不能写成浏览器通过，也不因R1关闭而补造证据。F6剩余边界夹具和六设施持续交互正在独立接力，本节仅标待指挥完成，不基于未交付结果新增产品发现。R1修复没有扩大生产范围，本轮未发现该裁定与测试归属修复合同冲突的具体点。

**停止边界：R1独立复审完成，原R1/P2关闭；源码及配置在审查过程中未变，旧报告字节保留，仅追加本节。未修改生产/测试/配置/其他报告，未commit/push、未派代理。本进程交付后停止，F6及整体交付由指挥继续裁决。**

## 7. 原生背包关闭后的营地入口定向审查（2026-10-08）

**结论：新增 R2 / P2，确认产品缺陷，重新阻断当前5C1交付。** 原生背包关闭后，营地命令栏按钮可以永久缓存disabled，普通轮询不会恢复；此非run-390-01材料误读，也非背包仍打开、真实模态未答或工具强点失败。原F1–F5/R1关闭事实保留；此为此前未覆盖的新触发。交原执行会话修复，本进程不改产品或测试。

### 7.1 R2 / P2 — 营地命令computed在模态阻断时丢失恢复依赖

**位置：** `src/ext/modules/settlement/ui/useSettlementUi.ts:373`及`:378`为缺陷点，`:33`–`:34`为blocked谓词，`:72`–`:93`为模型刷新；`src/App.vue:119`–`:120`为实际host模态条件；`src/ext/ui/useModuleUi.ts:39`、`:54`–`:64`为轮询及命令聚合；`src/components/InventoryOverlay.vue:102`–`:109`为真实关闭入口，`:486`为右上关闭事件绑定。对照为 `src/ext/modules/crafting/ui/useCraftingUi.ts:159`–`:162`。

**具体触发：** normal seed28正常公开路线取得第二粮并付费建营；关闭营地抽屉，点击原生命令栏“背包”，等UI正常刷新，然后点击InventoryOverlay右上“×”。Game的库存状态已经关闭、公开显示为explore，ACK/确认/参考屏幕均清空，但普通命令栏“营地”仍disabled，无法重新打开管理营地。无需改地图/背包/落点，也无需危险或pending动作。背包开启期间至少一次按钮计算才是丢依赖的必要时机。

**影响：** 正常读取库存即可失去营地入口，阻断后续施工、存取及管理；等待并不能修复。引擎仍可运行，改变其他响应式shell依赖可能恢复，因此定P2，不将此写成存档损坏或全部输入永久锁死。不能通过forceclick禁用按钮、直接调用其invoke或隐藏DOM绕过验收。

**归因链：**

1. App的 `canPresentInteraction`读取真实Game的普通字段 `isInventoryOpen`。这不是Vue ref；关闭Game库存本身不使相关computed失效。
2. 背包开启时，模块轮询调用refresh并将model置null。按钮随后重算 `blocked() || !model.value`，因blocked为true短路，**本次没有读取model.value**，Vue动态依赖追踪因此移除之前对model的依赖。
3. 关闭背包后，host谓词恢复true，轮询也正常运行并重新读取有效模块DTO；但commands没有显式读取host.tick，model更新不能再触发这个已失去模型依赖的computed。外层useModuleUi只读取该computed的缓存值，不会强制重算它。
4. 合成commands在求值入口显式读取 `host.tick.value`，同一原生背包开关不滞留disabled。对照表明应补失效依赖，而不是移除正常模态屏障。

### 7.2 真实入口证据和独立对照

指挥原浏览器目录为 `/private/tmp/brogue-commander-20261007/browser-construction-perf-prep/run-390-02/`。已独立读0102–0106 before/after JSON及失败summary，并实际查看 `construction-performance-failure.png`：背包overlay已经不见，普通命令栏“营地”呈disabled。0104后state为explore、pendingCommand/confirmation/acknowledgment/referenceScreen均null，展示队列busy已清；0105的真实tap等待8000ms仍失败于“element is not enabled”。这些证据保留，未改写原工具结果。

独立新临时 `inventory.test.ts`通过共享SFC harness编译**当前真实CommandBar和InventoryOverlay客户端模板**，用Vue自定义renderer保存真实事件闭包；真实Game绑定给组件的activeGame入口，没有伪造引擎状态。主探针only settlement、normal seed28，执行原76次公开move，真实FOOD1→2、标记(68,5)付费成功，未注入地图/材料/位置。使用生产useModuleUi/catalog/session和与App相同的canOpen/canPresent谓词与shell refs，真实CommandBar点击经InputManager/Canvas→Game打开背包，随后触发真实InventoryOverlay右上onClick→handlePlayerAction('escape')。组件100ms轮询闭包和App tick按边界手动推进；这是headless等价刷新，**不是本进程在真实浏览器等待8秒**，实等证据来自指挥。

| 阶段 | Game库存 | host canOpen/canPresent | 营地computed及实际VNode按钮 | only crafting对照 |
| --- | --- | --- | --- | --- |
| 正常打开并关闭模块抽屉 | 关闭 | true/true | enabled | enabled |
| 原生命令栏打开背包 | 开启 | false/false | disabled | disabled |
| 真实InventoryOverlay右上关闭 | 关闭 | true/true | **仍disabled** | enabled |
| 再推进80个100ms等价刷新边界 | 关闭 | true/true | **仍disabled** | enabled |
| 仅切换响应式menuOpen依赖后恢复 | 关闭 | true/true | enabled，正常点击可打开 | enabled |

关闭前后输入记录由77→78→79，背包关闭确实经过生产命令边界；无ACK/确认/参考屏幕或presentation busy。菜单对照只使真正Vue依赖失效，未改Game、库存、DOM disabled、computed或生产文件；恢复后才正常点击营地按钮，没有调用disabled命令绕过。crafting对照用only crafting的真实普通开局、同样组件事件链；不冒称它与营地自然路线采用相同世界内容。

上述2项exit0是**断言缺陷存在及对照成立的证据探针**，不能写为产品门禁通过。`probe-settlement-observations.json`、`probe-crafting-observations.json`保存原始结果；`comparison-summary.json`规范受测按钮字段名，不覆盖原始观察。

**新增还是既有：** 已直接对基线9b6515 Git blob核对，InventoryOverlay、useModuleUi、catalog、UI registry逐字节与当前相同；App的canOpenPanel和canPresentInteraction表达式也与基线相同。基线没有settlement UI文件，已有crafting当前及基线都显式跟踪host.tick。由新增settlement命令computed的缺失依赖引入；没有证据将此归为既有InventoryOverlay/Game关闭错误。相关比较在 `baseline-attribution.json`，不是只因浏览器观察猜归因。

### 7.3 最小修复方向与验收建议

在营地commands computed的入口无条件跟踪host.tick或等价的响应式资格版本，避免被blocked短路移除恢复依赖；与既有crafting模式保持一致即可。继续保留库存/确认/ACK/参考屏幕/推进期间的禁用和输入屏障，不改Game录制语义、不把按钮永久enabled、不改核心catalog缓存或InventoryOverlay以掩盖问题。

正式回归应覆盖真正host谓词＋命令聚合＋渲染求值：背包开启时必须禁用，右上关闭后应在正常刷新边界恢复，正常点击能重新打开；再覆盖Esc关闭与相关模态恢复，并保留真实Confirm/ACK优先。现有模块自有输入测试的host固定canOpenPanel=true，没有经历库存造成的canPresentInteraction=false和computed短路，因此此前通过无法保护这个触发。回归仍应归settlement自有目录，保持R1可移除性修复。

修后由指挥在同固定新候选补真实“营地关闭→原生背包读取→右上关闭→重新打开营地”，再继续六设施持续交互。run-390-01已由指挥裁为材料读取工具问题，不在本节重分类；run-390-02的此次disabled失败已独立确认应先修产品。本进程不修产品也不修工具。

### 7.4 实际执行、稳定输入与限制

证据根：`/private/tmp/brogue-commander-20261007/phase5c1-inventory-review-evidence/`。实际命令为显式Node24 PATH、`NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run --config /private/tmp/brogue-commander-20261007/phase5c1-inventory-review-evidence/inventory.config.mts --maxWorkers=2`。

- 最终探针：1文件2项，exit0，3.28s，`probe.log`；assert的是问题与对照，不是修复通过。
- 前一only settlement入口探针：1项exit0，2.82s，`probe-settlement-first.log`及first-observations保留；最终2项包含同场景，不累加数量。
- 初次同时安装settlement/crafting的自然建营尝试在新内容布局下被C5_BLOCKED，exit1，2.41s，`probe-two-modules-camp-denial.log`保留。该准备不等同于指挥only settlement路线，因此随后按真实触发条件改为only settlement，未放宽拒绝或改地图/付费规则。此失败不列新增产品发现。
- 浏览器JSON/截图读取、Git基线字节对照及前后SHA核对命令exit0。完成报告§9.4已读，不因R1已关闭推断此次新入口也通过。

审查前后src/scripts/public输入均为 **`9c291c76ce787448198df8d717554ca5fbb017f805b62c2512bb53b3dfc8b9df`**，配置逐文件相同，`input-before.json/input-after.json`记录结果。HEAD未变。没有全量或长门禁，没有真实浏览器新运行，没有读取/合并用户新交foraging候选。自定义renderer不证明布局/FPS；本轮仅复核库存后的交互资格与缓存。

**本节完成即停止；仅追加本文件，历史字节保留，未改生产/测试/配置/其他报告，未commit/push、未派代理。请指挥将新增R2/P2交原执行会话修复并复验，再继续F6收口。**

## 8. R2 库存关闭入口恢复独立复审（2026-10-08）

**结论：R2 / P2 的代码问题已关闭，解除该项代码阻断；本轮未发现新增P1/P2/P3。** 新独立探针按修复后行为断言，X/Escape关闭后的普通刷新恢复、真实Confirm/ACK屏障及合成对照均通过。最终fixed4的24场景已经全部exit0；原生背包重开后的六设施持续交互尚未交完整summary，R2真实浏览器触发及F6最终像素/性能仍由指挥裁决，不在此宣布完整5C1验收通过。

### 8.1 完成交付、源码与冻结

先确认 `phase5c1-r2-fix.done=exit0`，完整读执行报告§10.1–10.4、修复last、production.diff、相关日志/观察、新自有测试和清单。结论前再次核对完成标记并读报告末尾，没有把旧红探针的exit0当作修复通过。

- HEAD仍为 `9b651572b3c5561f91b3773dead11908ffa63b34`，`ext/phase5`。
- 本进程审查前后src/scripts/public **1155文件聚合SHA-256为 `72d1afadec5582146dbf5203f3bf3bc15710d3bc54c54e2c18c8afd1cb76ca64`**，逐文件相同；入口配置/AGENTS等与上轮9c291及本轮审查前相同。
- 对上轮独立红输入9c291只有3项变化：`useSettlementUi.ts`、营地自有 `settlement_inventory_ui.test.ts`及其test-suites清单。唯一生产变化是在commands computed入口无条件读host.tick；原 `disabled: blocked() || !model.value`、blocked/live、open/send资格及模态屏障没有改变。
- 执行者保存的 `useSettlementUi.before.ts` SHA与本进程上轮红清单匹配；本进程直接重算生产diff。九个冻结文件再次对基线Git blob逐一核对，相同，未读取或合并并行5G候选树。

证据根为 `/private/tmp/brogue-commander-20261007/phase5c1-r2-review-evidence/`，含 `input-before.json/input-after.json`、`production.diff`、`frozen-production-check.json`与 `finished-report-read.json`。旧§7与原inventory-review-evidence完全保留。

### 8.2 独立新修复语义探针

复用此前renderer/真实SFC编译脚手架和自然路线，在**新目录另写 `r2.test.ts`**。删除旧“营地仍disabled”的断言及菜单开关失效对照，改为普通tick后必须enabled、保持80轮刷新、正常点击重开；没有切menu、强点或直接invoke禁用按钮。真实CommandBar与InventoryOverlay事件闭包、production useModuleUi/catalog/session、App等价host谓词均保持。

| 独立参数场景 | 修复后实际结果 |
| --- | --- |
| only settlement，X | normal seed28真实76步/双粮/付费建营；库存打开且按钮已求值时disabled；真实右上X关闭，首个普通tick恢复enabled；80轮后仍enabled，正常点击重开成功。 |
| only settlement，Escape | 同样自然开局和付费前提；真实EventTarget窗口keydown/keyup经InputManager及库存注册handler关闭，普通tick恢复并正常点击重开。 |
| only crafting，X | 合成自身普通开局及真实组件事件，库存开时禁用、X关后恢复，80轮后及正常点击均通过。 |
| only crafting，Escape | 合成自身与真实注册键盘入口，普通刷新恢复，没有被本次营地修复影响。 |

X营地场景另验证真实模态：受控生成并检魔的负面药水经executeItemCommand quaff、InventoryOverlay syncPendingUse产生Confirm；确认期间按钮disabled，同一原生move入口没有新增录制/回合。No取消后药水仍在、库存仍开时继续disabled，真实X关库存后普通tick恢复。随后生产bindDialogCommands/bindDialogAcknowledgments、logger需ACK消息及DialogInput产生真实ACK；ACK期间按钮disabled且move不记录/不推进，MORE解除后普通tick恢复并能正常打开。此为明确受控确认/消息前提，不冒称天然拾到药水或特定自然ACK。

两种营地关闭的原生输入记录均77→78→79，关闭后Game库存false、canOpen/canPresent true、overlay已卸载，按钮在**普通刷新**即false而不是等其他Vue依赖改变。`probe-settlement-X/Escape-observations.json`及crafting对应文件记录阶段；关闭分支以参数文件名和真实事件代码为准，复用脚手架的部分阶段文字不改变实际Escape路径。`observations-summary.json`汇总四组结果。

最终 **1文件4项全部通过，exit0，6.29s**。这批4项断言修复后正确行为；不累计Confirm/ACK子场景为额外测试项，也不复用旧§7“断言bug存在”的两项通过。自定义renderer与手动推进100ms等价poll边界不证明真实触屏、布局、实等8秒或FPS。

### 8.3 自有测试与归因检查

已完整读新增 `src/ext/modules/settlement/tests/settlement_inventory_ui.test.ts`：真实客户端X/Esc、原生负面物品Confirm、真实ACK/参考屏幕，使用真实host资格条件而非固定canOpen=true；没有mock session、私有状态修改来解除屏障、skip/todo、宽exclude或缺模块return。自然路线部分没有修改地图/落点/粮食/RNG，额外药水及ACK明确受控。

本进程实际调用生产resolveTestSuites，确认新文件归 `{kind:module,moduleId:settlement,manifest:src/ext/modules/settlement/test-suites.json,suite:test}`，进入test/ext集合。没有把模块依赖搬回foundation，R1修复保持。此次没有重跑删除矩阵，测试仅随自身目录归属。

执行者修前4fail/exit1、修后相同回归4pass/exit0日志已读，与缺失tick依赖的归因相符；它们是执行者证据，未改写为本进程运行。唯一生产修复符合§7建议，保持真正模态阻断。执行者最终90项、boundary/types/build全部exit0及稳定输入已核对，不重复运行这些集合。

### 8.4 最终浏览器候选与待交接部分

指挥 `browser-build-final-4.manifest.json`明确source72d1、1155源文件、新空目录53产物。本进程直接读取fixed4构建文件，全部逐字节匹配manifest；这是新的生产候选，不能复用旧fixed3/run-390-02成功或失败为本次浏览器修复结论。

结论前读 `browser-matrix-fixed4/state.json`及done：24个独立场景全部exit0、done=exit0。该矩阵的动作/几何结果已经完成；本进程没有运行浏览器或逐图检查，像素裁决仍由指挥。旧fixed3、run-390-01材料工具问题和run-390-02真实disabled失败原样保留。

本轮最后读取时 `browser-construction-perf-prep/run-390-03/summary.json`尚不存在，因此不把原生pack重开→六设施持续交互/FPS标通过，也不猜为工具或产品失败。指挥按同fixed4继续完成该真实路径和F6收口即可；高级流程、密集长局及真实手机沿既定5Z边界，不以headless通过替代浏览器。

### 8.5 实际命令、退出码及停止

- 独立探针：显式PATH为Node24.19.0，`NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run --config /private/tmp/brogue-commander-20261007/phase5c1-r2-review-evidence/r2.config.mts --maxWorkers=2`；exit0，4pass，6.29s，`probes.log`。
- `node --input-type=module`调用resolveTestSuites：exit0，`ownership.json`；同环境版本记录exit0，`environment.json`。
- Python逐文件SHA、Git基线冻结、production.diff、报告完成标记与fixed4 manifest核对：exit0；浏览器完成/未完成状态只读取，记录于 `browser-progress.json/browser-latest.json`。

没有全npm test/test:ext、90/133/569重跑、drift、完整删除/组合或浏览器新执行。所选4项无skip/todo；CE缺失只是既有启动提示。没有修改生产/测试/配置/其他报告，未commit/push、未派代理；唯一仓库写入为本节追加，旧报告前缀逐字节保留。

**R2独立代码复审完成并关闭；本进程交付即停止，真实浏览器库存重开及F6最终验收由指挥继续裁决。**

# 5C1 本地执行报告

> 2026-10-08: 2026-10-08维护者最终收口：5C1按本步范围验收通过，最终输入72d1afadec5582146dbf5203f3bf3bc15710d3bc54c54e2c18c8afd1cb76ca64；独立F1–F5/R1/R2关闭，final4新24矩阵及原生背包重开→六设施/12秒持续交互通过。长内容/满槽显示夹具通过；高级浏览器、真实手机和全量收尾留5Z。详见[维护者验收](phase5c1.acceptance.md)。5G原0fb2720仍隔离，未最终验收。

**最新 R2 交付（2026-10-08）：独立审查§7新增原生背包关闭后营地按钮长期disabled的R2/P2。原执行者已最小补营地commands computed的host.tick依赖，正式客户端入口回归先4红后4绿，限定8文件90项及boundary/types/build通过；新固定生产构建已交指挥。此为新的生产候选，旧fixed3/24行不能充当R2修复的浏览器验收，仍待指挥新浏览器及另进程复审。** 见[§10](#10-r2p2-原生背包关闭后入口恢复修复2026-10-08)。以下开头及§1–9为历史交付；原审查文字不改，F1–F5/R1独立关闭事实保留。

**最新 R1 交付（2026-10-08）：F1–F5 已由独立定向复审关闭，最终1b7565候选的24浏览器矩阵及自然闭环已有指挥成功证据；复审新增 R1/P2 已按本轮任务仅修测试归属，限定相关与实际删除专项通过，等待指挥定向复核/提交。生产源码、实际构建依赖和新构建文件字节不变，已有GUI证据可复用。** 见[§9](#9-r1p2-测试归属修复交付2026-10-08)。以下开头及§1–8保留历史交付状态，原独立报告未改；F6剩余范围仍按复审§5.4由指挥裁决，不能宣称所有额外场景通过。

**当前交付（2026-10-08）：独立审查已完成并确认 F1–F6 阻断；原结论保留。原执行会话按修复任务 resume，F1–F5 已修并补正式入口回归，F6 已补正常开局真实拾粮与天然 D1/D5 引擎证据和固定浏览器接力；指挥真实浏览器及必要定向复审仍待完成，不能宣称整体验收通过。** 最新修复范围与门禁见 [§8](#8-f1f6-审查修复交付2026-10-08)。下面 §1–7 保留首次交付历史（包括当时“未独立审查”的状态），其旧失败/未完成不能冒充最新结果，旧通过也不能替代新候选验证。

2026-10-07，工作分支 `ext/phase5`，开工 HEAD `9b651572b3c5561f91b3773dead11908ffa63b34`。依本轮授权与 dot 的 5G 并行执行，没有等待或读取真实 foraging 内容，没有另起子代理，没有 commit/push 或切换/修改 dot/main/foundation 分支。开工已有的三份指挥文档修改保留，指挥中途追加的预检记录也保留。本报告属于**实现与自测交付**，尚未另起独立审查。

生产 settlement 可由 catalog 单独发现，默认关闭。已实现自有基础建材采集、明确材料/FOOD来源、营地/扩张/九种设施、真实储粮锁、存取/床边原生休息、徒步跨层存读/录像/seek/续录及拆卸撤营。自动化门禁结果见下表；**指挥固定生产构建的部分真实布局/截图已验证，但抽屉打开时输入/移动跟随失败，自然双粮闭环、完整浏览器矩阵和实机验收未完成**，不能据此报告整项产品验收通过。

证据根目录 `/private/tmp/brogue-commander-20261007/phase5c1-evidence/`；状态文件 `/private/tmp/brogue-commander-20261007/phase5c1.status.md` 按里程碑更新。`progress.md` 保留原 prompt 后追加本轮工作。配置、命令和后续扩展说明见 [settlement-config.md](settlement-config.md)。

## 1. 功能、数值与策略

机械数据仅来自模块 `data/definitions.json`，一个规范包指纹同时覆盖 world 定义和 campPolicy。wood/stone/fiber 分别声明 basic 标签，maxStack99；各节点容量20、徒手100 tick取1，木2000/fiber1000 tick回1、石不再生；D1…40每类每层尝试1个/全局每类40个。使用原放置合同和失败收据，不改天然地形保证落位。新局一次12/8/6建材，启动溢出沿原 floor-then-skip，无额外 FOOD、无食物制造配方。

建营地 wood4+stone2/300 tick并锁2份玩家选择的真实原生FOOD，扩张wood2+stone2/300。九种设施账单及tick与任务书一致；HP/阻挡/抗性/休息定义完整列于配置手册。每层1营地、全局8、slot最小空闲/高水位不回退；初始9×9、最大24×20；384结构格/营地、16箱/营地、64槽/箱，并服从底座全局预算。补给堆计入箱预算，另建箱最多15个。

只有明确选择的背包或一个可见、可达箱是材料来源。可选消费已安装内容的实际 `basic.*` 材料或 `kit.bed/kit.chest`，无 crafting JSON 导入、身份合并、隐式扫箱或转换增值。组件退款收据记录真实付款的定义/数量；拆卸用剩余HP的50%向下取整，一件kit拆卸返0件。读档验证每个组件恰有一份合法账单，拒绝删除收据、越过批准账单数量或非法材料引用；这不是对任意手工改写整份存档的密码学签名保证。

锁粮保存实际容器Item ID和必要数量，不复制可消费库存。完整转移保留真实Item对象/ID，部分堆产生真实拆分实体；不同FOOD可分别锁定，额外FOOD可以合并到实际锁定堆并只取未锁定后缀。通用材料转移入口也检查锁。5C1无居民，不消费日粮，不启动生产。

本版补给标记是**不接受攻击/结构拆卸的非战斗交互实体**；明确撤营是唯一解锁路径。这是避免免费毁标记解锁的可逆策略，并未声称已做可战斗补给残骸。普通箱损毁沿已有掉落/残骸保持真实内容。撤营先要求清空结构/居民/订单，剩余真实补给全部能够合法放入背包才提交；满包整笔拒绝，本版没有新增地面退粮降级路径。撤营保留访问层、资源节点/账本、有界历史及slot高水位。

可逆数值/策略已按设计推荐执行，**待用户后续确认**：上述节点/启动材料、木质HP100–150/石质200–300、木0/0抗性/易燃/石25物理与100火抗/不燃、床上限30000 tick/距离1、补给不接受攻击/拆卸、撤营仅合法背包接收、补给计入16箱、kit退款0。无需为本轮可逆细节中断施工；未来变更须维护规则指纹与测试。

## 2. 接线、写集和版本

| 路径/所有权 | 变动和用途 |
| --- | --- |
| `src/ext/modules/settlement/**` | 生产自有 descriptor/schema/data/definitions/state/module/commands/projection/UI/locales/tests/test-suites；无其他模块硬依赖 |
| `ext/structureSdk.ts` | 独立窄只读端口、有限营地政策/引用状态/标准结构action；冻结WorldWork SDK不扩写 |
| `Core/StructureProduction.ts` | 可信生产适配器：严格外壳/payload、原生确认、重验CAS、一次性作用域计划、真实FOOD/材料、空经济账本、报告与保存引用校验 |
| `Map/StructureWorld.ts` | 复用 region/施工/房间/逃生/rest事务；最小增加明确实付账单/箱来源与原定义退款；取消整层D40 blanket禁建，楼梯/终局/机关/保护格等仍保护 |
| `Core/WorldDefinitions.ts`、`ext/constructionSchema.ts` | 抽出中性严格验证叶子供模块调用，可信入口保留既有edible验证并验证有限campPolicy；不让内容导入Game |
| `ext/runtime.ts/types.ts/world.ts` | 标准结构命令声明、只读投影端口、可信状态替换/锁数量查询；不改变冻结SDK文件 |
| `Core/Game.ts` | 公开executeCommand阶段接入；原生Dialog确认/recordDecision/CAS；离层/入层空账本边界；生成失败恢复生产camp模块/runtime/logger对象身份 |
| `Core/WorldWorkValidation.ts` | save/load根校验增加生产camp真实region/container/marker/slot/锁/账单引用 |
| `Core/WorldMaterialTransfer.ts` | 所有通用withdraw检查锁，允许底座remains回收；转移仍100tick与真实Item所有权 |
| `Map/CellProperties.ts`、`UI/Appearance.ts`、`ui/mapTileSemantics.ts/vectorAtlas.ts`、`locales/zh_CN.map.json` | 四模式汉字/图标从已显示字符映射，火/楼梯先于结构；屋顶独立glyph `^`、地板+顶 `:`，墙/门窗/床箱沿已有语义；显示合成保留原生人物/火/楼梯优先级 |
| `App.vue`、`GameCanvas.vue`、`ext/ui/types.ts`、`ui/moduleMapSelection.ts` | 通用显示选格/草稿轮廓；模态屏障优先，所有玩法仍公开命令 |
| `ui/mapViewport.ts/mapCamera.ts` | 测量真实容器/visualViewport/抽屉，渲染和逆输入共用剩余视口；边缘钳制不积累成用户pan；接受移动后更新跟随的实现；真实浏览器发现抽屉打开时输入被拦截，跟随未验收 |
| `crafting/ui/CraftingPanel.vue` | 只增加通用drawer标记与CSS特异性修复；不改crafting规则/数据/命令 |
| `locales/zh_CN.json` | 两个有限foundation确认/完成文案；其余玩家文案均模块自有i18n |
| `scripts/structure-readers.json` | 一个原类型读点表达式因移除D40条件而更新hash，count/classification/handling/coverage不变 |
| `src/test/ext_structure_protection.test.ts` | 单变量反事实通过后，只把旧整层D40禁建前提换成D40实际楼梯保护格；拒绝断言不变 |

复用 `transactStructureWorld→transactWorldWork` 的既有world/player/Item/ID/时钟/消息/地形写集，模块状态与账单跟同一事务提交。新增离层报告和空账本写入属于生成事务：已有Game/world5/容器根捕获继续使用；额外捕获生产camp runtime/logger对象图并在runtime缓冲回滚后恢复身份。marker、模块state、时钟发布故障以及真实入层发布故障均以完整对象图oracle核对，ID和规则RNG也恢复。没有新增Game字段，U03字段登记无需变更；没有另造地图、调度或房间系统。

保持 foundation10、whole-run6、recording4/origin2、IDB2、World5.schema1、worldSdk1、edibleSdk1；settlement module/rules1.0.0/state1/payload1。无本地格式bump、旧档迁移或黄金/trace重录。

5G冻结九文件逐字节等于开工HEAD及指挥已有基线SHA，`frozen.json`记录比较：

| 文件 | SHA-256 |
| --- | --- |
| worldSdk.ts | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| edibleSdk.ts | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| worldEdible.ts | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` |
| kindKnowledge.ts | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` |
| actorNeeds.ts | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` |
| stats.ts | `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84` |
| testing/worldHarness.ts | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` |
| testing/forageHarness.ts | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` |
| testing/fixtures/forageFixture/index.ts | `adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea` |

整个fgfixture目录也逐文件与HEAD相等；仓库相对路径树hash仍 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。

## 3. 逐项任务对照

下列自动化证据均来自生产catalog/真实Game和公开executeCommand；受控场景只用于设置测试初始地图、材料/粮食与首访层，**不冒充自然探索或浏览器游玩**。D1/D5闭环起点、D1…40边界、跨层测试的源场景公开于 `tests/helpers.ts`，楼梯位置也同步原生levelSeeds，跨层过程由真实move/楼梯命令执行。最终首访夹具仅改变地图/非玩家测试对象，保留原生落点和背包并即时断言两者未改；初始测试粮食仅录制起点预置（通常4份，八营地预算例18份）。场景内歩行规划也逐步发送真实move，跨层补测断言未多发FOOD/启动材料，不作为自然地图导航证据。自然新局startup/node用例单列。

| 任务条目 | 实现/验收结论 | 自动化与其他证据 |
| --- | --- | --- |
| §1 完整必读/基线/保留指挥排期/不等5G | 已执行 | baseline.json、progress与状态；无子代理/提交 |
| §1 生产catalog单独启用、默认false、无居民储存 | 已实现并专项通过 | boundaries、persistence，仅settlement新局 |
| §2 自有完整模块、严格包/state/payload/机械指纹 | 已实现并专项通过 | validation，未知递归键、getter、unsafe整数、缺引用/删锁/删账单/伪造退款拒绝 |
| §2 可信适配器复用底座，非DEV fixture、不写Game | 已实现并门禁通过 | boundary；runtime新局isWorldStructureFixture=false |
| §2 原子物品/ID/模块/账本/消息/耗时与生成写集 | 已实现并专项通过 | validation三发布故障、safety入层完整对象图/ID/RNG |
| §2 冻结API、版本/Game字段登记 | 无冻结文件/格式/Game字段变化 | frozen.json、版本源文件、U03回归 |
| §2 resident-status.v1 只读扩展点/无硬依赖 | 已实现；无居民 | validation真实queryOptional合法与非法actorId/未知键、只读不改时间/ID/RNG；boundary；未来5D扩展见§7 |
| §3 所有容量/slot/高水位/初始和扩张范围 | 已实现并专项/底座验证 | boundaries、persistence；384/16/64与更严底座预算沿原验证 |
| §3 三建材/三节点/再生/失败收据/启动且无FOOD制造 | 已实现并专项通过 | harvest三类真实行走/100tick/再生/save/replay；boundaries自然startup一次/只有1FOOD |
| §3 九设施账单/tick/HP/阻挡/抗性/床策略 | 已实现；账单运行与底座验证 | data、runtime/materials/boundaries、structure properties/transactions |
| §3 明确单来源、可选basic标签/kit、不复制身份 | 已实现并专项通过 | materials：crafting实付kit0退款、明确箱wood实际定义退款；无JSON跨包导入 |
| §4 已见/探索/可达/无敌情/全合法区域/D1…40 | 已实现并专项通过 | boundaries40层与stairs/machine/reservation/unseen/edge；validation威胁 |
| §4 缺2粮/实料/容量/预算/过期/No零机械成本 | 已实现并专项/底座验证 | runtime/validation/safety；No、stale、full pack、8camp、ID/RNG保持 |
| §4 真实FOOD整堆/部分/不同FOOD/额外粮锁与通用入口 | 已实现并专项通过 | runtime共享plan拒绝；validation额外粮合堆/后缀；safety口粮+mango原ID返还 |
| §4 毁标记/换箱/读档不免费解除锁 | 不可攻击/拆卸标记策略已实现并专项通过 | safety未知组件/死亡拒绝；validation删锁/引用拒绝；非战斗残骸实现未声称完成 |
| §4 真装备身份/鉴定/诅咒/附魔、100tick存取、满箱/地面/损毁 | 已实现；专项与底座保护验证 | boundaries装备原对象及普通箱drop/remains；structure transactions/protection；查看0tick |
| §4 拆卸剩余耐久50%向下、撤营原子退粮/清关联 | 已实现并专项/底座验证 | runtime/persistence/materials、structure transactions；满包拒绝保留真实补给 |
| §4 保留访问/资源账本/高水位/有界收据 | 已实现并专项通过 | persistence rebuild/往返；节点不妨碍撤营，history128 |
| §4 真实楼梯跨层存读/录像/seek/续录/远方最后报告 | 已实现并专项通过 | persistence D1/D5两闭环、D1↔D2存读往返/replay、纯读无结算；validation当前未见箱无实时库存 |
| §5 结构合成/房间/逃生/全足迹/危险/工作位保护 | 已复用并专项/底座验证 | 六危险地形safety；structure geometry/properties/protection/review/transactions |
| §5 原P1关门自锁保持/门耗时/屋顶仅资格 | 已复用并底座验证 | structure review、data与CellProperties；真实四模式像素仍待验收 |
| §5 可用营地面板、目录/选格/预览/原生确认 | 已实现；交互模型测试通过，真实像素未验收 | ui四项、Dialog相关回归；browser-handoff.md |
| §5 16格稳定逐条付款/危险缺料失效No停止/已建保留 | 已实现并专项通过 | ui16格0成本、首距离失败后只有1建成/100tick/两事件，No清余项；不持久化queue |
| §5 close/blur/load/seek清草稿/唯一模态屏障/不看未来ACK | 已实现；close/No/session替换和宿主合同验证 | ui新增真实悬挂确认/模拟ACK忙边界：保持旧DTO，暂停队列，再独立确认下一格；module_ui/dialog回归；blur/ACK实际画面待浏览器复验 |
| §5 床原生休息/饥饿/环境/打断/无补满重置、死亡拒绝 | 已实现并专项/底座验证 | persistence正clock/饥饿/escape；safety死亡，structure rest/contracts |
| §5 四地图模式墙门窗顶床箱、保留人物火楼梯/纯读RNG | 显示合成已实现；纯读/底座测试通过，四模式像素未验收 | display十三项四模式语义/矢量、roof记忆及后发火/楼梯优先；validation/persistence；handoff像素矩阵 |
| §5 1440/390/320普通/沉浸、长名/满包/收起/合成抽屉相机 | 相机/CSS实现与纯函数通过；390原版普通布局/选格/开合部分通过，**抽屉打开移动/跟随失败，完整矩阵未验收** | camera、canvas_resize/FE1/crafting回归；指挥预检问题与修复见§6 |
| §6 Node24/3GB/2workers，限定门禁/生成地形drift | 结果详见§4 | 不跑完整npm test/all test:ext/全组合/删除/CE full/gen |
| §6 指定四相关组合与关闭生产零启用 | 已专项验证四种，未冒充全组合 | persistence：settlement / +crafting / +combat / +giants及无settlement |
| §6 实际浏览器/模拟触摸/实机、截图和控制台 | **部分指挥实测，输入/跟随失败；完整矩阵及实机未验收** | browser-smoke-01/02与自然寻粮记录；执行者沙箱拒绝及接力脚本保留 |
| §6 普通P95≤5ms与摘要峰值、施工后界面 | engine-only性能已测；施工界面FPS未验收 | final/performance.json，详见§5；256摘要债务未解决 |
| §7 报告/配置/README准确追加/外部证据/停止等审查 | 本报告与配置已交付；最终停止、独立审查待另进程 | README/progress/status；不commit/push |

## 4. 最终门禁、失败批次与反事实

最终命令显式前置 Node runtime bin `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`；Vitest均 `--maxWorkers=2`。前期开发shell默认实际为Node25.2.1/未显式堆，因此早期分组日志只算过程证据；发现后所有最终验证使用Node24.19.0。`run-gates.py`记录实际命令、退出码/壁钟时间、src/scripts/public测前测后逐文件SHA；先前失败候选保留在 `final-before-fixes/`。

两批输入分别冻结，均为1146个 `src/scripts/public` 文件；各自测前/测后 `sameInput=true`，不把两批冒充同一个hash。

- 全限定批次 `final/state.json`：`4a18f719c555d37ecb5fecf1ddf115d54d73249154418d32cb07a11264aff74a`。
- 仅测试夹具修订后批次 `final-fixture/state.json`：`1eb3d53a127b0b8fba5f0497f5616cedc0e97242b919b379b006934be56c36bf`。

| 批次 | 门禁/数量 | exit | 壁钟秒 |
| --- | --- | --- | --- |
| final | Node/堆环境记录 | 0 | 0.0205 |
| final | module boundary | 0 | 2.3929 |
| final | vue-tsc -b | 0 | 9.5883 |
| final | npm run build | 0 | 12.4910 |
| final | 营地专项：11文件118passed | 0 | 78.1609 |
| final | 限定底座：42文件963passed / 1既有CE skip | 0 | 471.9872 |
| final | test:drift：5文件8passed | 0 | 111.3721 |
| final-fixture | Node/堆环境记录 | 0 | 0.0219 |
| final-fixture | module boundary | 0 | 2.1209 |
| final-fixture | vue-tsc -b | 0 | 8.2948 |
| final-fixture | npm run build | 0 | 11.1500 |
| final-fixture | 营地专项：11文件118passed | 0 | 75.6413 |

原始命令与逐项日志分别在两目录的 `state.json`、`environment.log/boundary.log/types.log/build.log/settlement.log`；42文件精确命令及 `related.log`、`drift.log` 只属于 `final/`。后批没有再次运行related/drift，118项是专项重复运行，不累计为新增通过项。

`fixture-only-diff.json` 比较两批原始逐文件表，唯一差异为：

- `src/ext/modules/settlement/tests/helpers.ts`
- `src/ext/modules/settlement/tests/settlement_boundaries.test.ts`
- `src/ext/modules/settlement/tests/settlement_persistence.test.ts`

后批生产代码、脚本、public和既有底座/drift测试字节与前批相同：`true`。交付时仅做已有证据/哈希核对，当前源输入仍为 `1eb3d53a127b0b8fba5f0497f5616cedc0e97242b919b379b006934be56c36bf`；相对后批差异为 `[]`，详见 `delivery-manifest.json`。文档不在此源输入hash范围。指挥安全中断旧进程exit130/PID98931已不存在，不覆盖上述完成门禁的exit0记录。

限定底座集合明确列于run-gates.py/state.json，不以定向拼接宣称完整npm test或test:ext；包含结构几何/合成/保护/事务/性能/源码guard、WorldWork边界/CAS/工作/物品根/显示、edible/需求/知识、生成对象图、clock、canvas/触摸/模块UI/Dialog、i18n/仓库卫生/套件归属、U03跨层/存档及录像/checkpoint/显示录像、crafting相关三文件。本环境无CE源码，既有CE条件项如实跳过；未添加skip/todo或放宽断言/超时。

首个最终批次：boundary/types/build、settlement10文件104项通过；相关38文件883passed/2failed/1既有skip，355.80s，exit1，drift因此未运行。失败一是页签`t(a.key)`不满足静态i18n守卫，已改成computed中的有限字面量翻译；没有改扫描守卫。失败二是原保护用例把整层D40作为保护前提，与本任务任意合法D1…40合同冲突。

先在仓库外同候选副本**只回退 `src/engine/Map/StructureWorld.ts` 为开工HEAD**，原测试保持原字节，旧D40用例1passed，2.02s，exit0；18项仅由testNamePattern过滤。`counterfactual-manifest.json`证明只有一个生产文件不同，`counterfactual-D40.log`保留结果。随后仅给D40场景增加范围内原生STAIRS_DOWN保护格，重命名用例说明新前提；`toMatchObject({ok:false,code:'C5_PROTECTED'})`不改。新增营地40层用例仍断言合法区域可成功。测试差异完整可由git diff审阅。

开发批次中的类型/闭环/旅程/休息/回滚失败日志均保留，随后修生产或新测试起始前提：WeakMap token不能经JSON复制；用原生levelSeeds一致的楼梯场景复验真实旅行；rest启动后不能用完成消息立即disturb自己；生产生成回滚补runtime/logger身份。没有隐藏这些中间失败，也不以早期通过覆盖最终失败。

收尾补测：ACK用例先在旧UI失败1项（ui-ack-before.log），修为隐藏旧模型/暂停队列后UI4项通过（ui-ack-after.log）；不会因ACK清空草稿，也不会读取未来帧。补resident查询非法输入时测试数组的TypeScript联合推断带undefined，引起两次types exit2（final-ack-type-failure/与-2/），随后显式Json数组修正。四模式补测首批90pass/10fail：九项新测试误把tiles图标模式当文字标签，按项目既有“纯图形、不请求标签”合同修正为已知矢量/空文字；另一项旧R1守卫拒绝新GameCanvas颜色字面量，只把显示选择色移入其纯UI所有权文件，旧守卫/清单/断言均不改。全部过程日志保留，生产最终从头重跑同一候选。之后仅校正三个营地测试文件：首访层保留原生落点/背包、八营地所需18粮只在录制起点预置，真实步行通过已知几何路线发公开move。首次拆除遮挡墙后八营地用例依法被C5_THREAT拒绝（117pass/1fail），随后在测试地图保留敌情遮挡并留可步行通道，拒绝断言/威胁规则均未改。定向两层/八营地2项通过后，补跑营地全部专项和boundary/types/build；生产、既有底座测试及drift输入字节与前一全限定批次一致，manifest逐文件列出唯一三个测试差异。

原生成基线与黄金trace逐叶新增差异为0；未修改任何golden/trace/生成基线，也无重录。唯一读点登记hash `ca1dafff…07838`→`0df7e355…1c5f3` 对应protectedCell表达式移除D40分支，原count/分类/处理/覆盖登记全部不变，并由相关源码guard验证；这不是放宽守卫。最终diff检查/冻结比对见外部交付manifest。

## 5. 性能与实际覆盖限度

`settlement_performance.test.ts`同种子分别采样无营地与单层营地（同格floor/roof/door/bed）后的320条真实wait，前32条预热；普通P95排除256边界的full摘要，完整原始样本写入final/performance.json。它测量engine命令成本，没有测浏览器帧率；是两个候选场景的P95差值，不宣称配对因果基准或最大长局覆盖。

| 批次 | 无营地普通P95 ms | 单层营地普通P95 ms | 两场景P95差 ms | 无营地256摘要峰 ms | 营地256摘要峰 ms |
| --- | --- | --- | --- | --- | --- |
| final | 4.897750 | 4.412292 | -0.485458 | 70.243625 | 61.419959 |
| final-fixture | 3.745792 | 3.679750 | -0.066042 | 63.624041 | 54.577000 |

两批均各287条普通样本、各1条256边界full摘要样本；营地普通P95在该样本内≤5ms。负差是独立场景采样差，不解释为加速收益。后批原始数据在 `final-fixture/performance.json`；两批 `browserFPS=null`，均不能证明真实浏览器流畅度或最大长局性能。

256命令full摘要峰值单列；5A3/5A4既有长局摘要管线债务没有在5C1解决，未加Worker，也未用单层样本推断8营地/长历史峰值。一层合理施工后的UI流畅度/FPS需浏览器接力填写，当前未验证。

## 6. 浏览器证据、实际失败与待审查缺口

已读取并使用指定 `develop-web-game/SKILL.md`。尝试原命令 `npm run dev -- --host 127.0.0.1 --port 5397` 被沙箱 `listen EPERM` 拒绝；实际运行指定技能client（`--url http://127.0.0.1:5397 --actions-json '{"steps":[{"buttons":[],"frames":2}]}' --iterations 1 --pause-ms 250 --screenshot-dir …/browser`），Chromium因MachPort `Permission denied (1100)`退出1。没有生成可查看PNG。之后只选择指挥现有预览的CUA浏览器，返回 `No browser is available`，没有启动新监听/Chromium或修改系统安全。日志为vite.log/playwright-client.log/cua-browser.log。

指挥正常权限的预检和固定构建复验均保留在 `/private/tmp/brogue-commander-20261007/phase5c1-browser-preflight.md`。早期shell高度/画布居中造成约75px遮挡与presentationHidden Vue警告，后来390/320预检已不复现；这是局部布局证据，不推断全部视口。执行者实际查看的旧技能shot-0.png仅菜单背景canvas，没有角色/HUD/抽屉，记录在preflight-image-view.json，不算游戏布局验收。后续固定构建的新截图由指挥实际查看，本轮执行者未重复启动浏览器或自称已逐张目检。

**固定生产构建** `browser-build-final-1`（源输入SHA `4a18f719c555d37ecb5fecf1ddf115d54d73249154418d32cb07a11264aff74a`，独立manifest保留，localhost5399）由指挥运行原技能client及补充公开UI脚本。`browser-smoke-01/02/390x844-original-normal` 只通过设置、公开新局、表单、DPad/canvas操作，没有注入Game/库存/地图。以下结果必须分别记录：

- 390×844、original、普通模式的布局、选格反算、营地面板打开/收起/展开、施工目录/采集/库存与合成各页geometry部分通过。指挥实际查看0014-settlement-open-layout.png和0037-crafting-tab-craft-layout.png：地图/玩家/触控区位于抽屉上方，没有横向溢出；其余截图未全部逐张目检。桌面crafting折叠按钮按既有CSS隐藏，不以强点隐藏按钮判产品失败。
- **未通过：抽屉打开时的真实输入和移动跟随。** smoke-01合成抽屉打开时八方向各三次、24次真实触摸DPad全部moved=0，玩家保持(38,26)，offsetChanged=false，脚本exit1。smoke-02打开抽屉时八方向各一次全部inputEventsDelta=0、turnDelta=0、moved=0；关闭后同一真实DPad右方向立即(38,26)→(39,26)、输入记录0→1、回合0→1。closed-dpad-control.json为touchValidated=true，证明该失败不能归为触摸脚本无效。follow-observations.json、每步前后PNG/状态/回合、两个exit1均保留。
- 待独立审查的源码线索来自指挥：App将modulePanelOpen传入GameCanvas.displayModalOpen，输入回调此时直接return，疑似把非模态抽屉当模态屏障。**本轮只登记线索，不继续修生产/测试；不能用相机纯函数通过验收真实跟随。**
- 控制台 `No available adapters` 警告保留，待环境分类；可能与首次WebGPU探测fallback相关，但尚未确认，不删日志也不归为已通过。未见原presentationHidden Vue警告。
- **自然双粮/营地闭环未完成。** `browser-natural-food-01/` 的seed5公开自然寻粮脚本路线停滞，未取得2份FOOD；exploration.jsonl、food-proof、final-game-state、recording.json及截图保留。未成功建营地/施工/存取/床边休息/撤营的浏览器整链，不能以受控engine专项替代自然流程验收，也不由该路线停滞直接推断规则缺陷。

浏览器原始目录均在 `/private/tmp/brogue-commander-20261007/`；执行者接力文件为 `phase5c1-evidence/browser-handoff.sh` 和 `browser-handoff.md`。完整1440×900/390×844/320×844×普通/沉浸×original/refined/hanzi/tiles的24行矩阵须待独立审查、原会话修复后继续；还包括营地/合成抽屉、长名字/满包、确认/ACK、施工/存取/休息/撤营和真实楼梯。模拟触摸已有上述单行失败与有效关闭对照，完整覆盖未完成；真实手机设备、施工FPS均未验证。保持技能小步动作/暂停/截图实看/控制台流程，不改键位/回合时间语义、不使用库存注入或瞬移代替闭环证据。

## 7. 5D交接与待验收

`settlement.resident-status.v1`严格接收正安全整数actorId，合法查询返回`{resident:false}`；只读。state schema1要求每个活跃营地锁粮总和恰2，本步空居民/空生产账本只在真实离层/入层推进边界，UI/load不会结算。5D需在批准的可信经济事务里消费实际容器Item、更新必要锁和消耗/居民/订单引用，并升级本模块schema/校验，处理居民关联撤营、攻击补给策略和facilities冻结信息；不能靠删locked绕过储备，不可直接复用空账本假装已做离线生产。

当前未通过/待验收：抽屉打开的真实输入与移动跟随、自然双粮营地闭环、完整24行像素/流程矩阵、适配器控制台警告分类、真实手机、施工界面FPS/长内容溢出；5Z的完整npm test、全部test:ext、全组合/删除矩阵、最大长局与CE全量档。本轮没有独立审查，按用户安排交付后停止实现，等另进程审查发现后再resume修复。不把这些待办记为通过。

2026-10-07指挥续跑裁定：当前开发里程碑停止实现，仅整理现有证据和文档；没有新增门禁、生产/测试变更或自行审查。工作树为未提交候选，下一步另起独立审查，发现后再resume本会话修复。


## 8. F1–F6 审查修复交付（2026-10-08）

按 [修复任务](phase5c1-fix.task.md) 完整处理 [独立发现](phase5c1.review-findings.md)，并读取原 `review.test.ts/probes.json` 与指挥预检末尾。原审查文件及 exit0、旧4a18浏览器失败、seed5未取到双粮事实均保留。本节是原执行者实现/相关验证，**不是独立复审**。本轮不派子代理，不commit/push，HEAD/分支不变，保留指挥文档；没有重试已明确被沙箱拒绝的监听/Chromium，也未改安全设置。证据根为 `/private/tmp/brogue-commander-20261007/phase5c1-fix-evidence/`，状态为 `phase5c1-fix.status.md`。

### 8.1 逐项修复和推荐决定

| 发现 | 实施与实测 | 当前裁决 |
| --- | --- | --- |
| F1 非模态抽屉丢原生输入 | App将`creationTransition`真模态与`modulePanelOpen`自动调度暂停分开；Canvas共享`installCanvasGameInput`给键盘/DPad，同步长按上下文并经handlePlayerAction→executeCommand，抽屉打开不拦截手动输入。打开抽屉取消长按并公开interrupt_auto；已提交推进/展示后缀仍完成，自动调度暂停、相机更新。合成仅拥有抽屉内键和Escape，SELECT默认键保留；营地仅展开选格拥有方向键，收起/非选格外键放行；文本输入、DialogInput/确认/ACK优先保持。新共享5项含两模块实际InputManager keyboard/DPad→Game录制/回合/移动、面板保持、相机及逆坐标、模态/输入框、中断自动行动；营地review另覆盖收起选格放行。 | 代码与入口回归通过；指挥真实展开/收起触摸及镜头待验，原browser-smoke失败未改。 |
| F2 管理矩形误作全可见足迹 | 删除whole-bounds当前可见与逐格天然地形/机器/楼梯禁令，bounds可以包围天然岩体与墙后未知格；实际标记须可见、已探索/记忆、邻近可达/安全；实际工作仍保留楼梯/终局/机器/impregnable/危险/全足迹/逃生。范围/尺寸/region冲突/巨兽预留不重叠/全局预算保留；不得切开工作/演员足迹，隐藏冲突只C5_BLOCKED，可见才C5_PROTECTED。岩体遮挡/已建墙后扩张、未见标记/施工泛化拒绝、实际保护工作格、region冲突与隐藏足迹边界回归通过；天然D1/D5付费整链见下。 | 引擎资格/未知信息回归通过；天然浏览器流程待验。 |
| F3 正式床休息坏payload/无条件关面板 | action-specific基础字段，rest没有inventoryStamp，引擎严格未知键校验未放宽。只有原生确认完成并启动RestPoint才关面板；同步No、异步pendingNo、距离拒绝保持面板，异步Yes按刷新边界关闭。真实handler→executeCommand→原生rest成功、正tick/饥饿、Escape中断及确认/拒绝回归通过。 | 正式UI入口回归通过；浏览器按钮/确认/受伤恢复待验。 |
| F4 预览与提交落点不一致 | 独立campTarget，营地页直接有界x/y输入、方向按钮/地图选址，9×9预览；文字/轮廓/bounds/确认/付费同源，切建造页不改变营地target。默认邻右、x1…77/y1…27、bounds截入地图；远格/未见拒绝不付费。真实session录制payload与标记一致、SSR实际DOM/坐标控件、切页/边界回归通过。 | 实现/入口回归通过；真实可操作/轮廓截图待验。 |
| F5 桌面假收起 | 按推荐仅≤700px折叠，桌面隐藏toggle，与合成一致；session保存collapsed、收起清选格/草稿、展开重注册、窄屏52px恢复地图。无需新增桌面方案，此为可逆UI决定。 | 静态与session回归通过；桌面hidden/窄屏几何待指挥验。 |
| F6 自然/浏览器/性能缺口 | 新自然2项不改天然地图/库存/玩家位置/RNG，正常开局真实FOOD1→2，D1整链及D5明确首访准备后整链；旧受控跨层/save/replay/seek/续录专项保留。交固定生产build、源码/测试与构建哈希、公开路线/真实DOM脚本及矩阵副本；浏览器仍由指挥运行。 | **部分证据补齐，验收缺口仍未关闭**：24矩阵/真实UI闭环/施工流畅度/长内容满包/实机不能记通过。 |

营地bounds不因包含机器/楼梯而一律拒绝，但实际放置与实际施工落点保护不变。管理范围只返回批准的通用冲突，不提供隐藏格机器/实体名称、ID、精确原因；未知是否含岩体不影响合法标记。没有为自然路线降低威胁/工作边界/逃生守卫，没有新增Game字段、格式号、黄金/生成基线、skip或放宽checker。`scripts/structure-readers.json`只移除已删除管理整矩形原始地形表达式的一项 `d88b2312e31c1fd648e87dd4b08e0baa9dcc56e245d688e54acbfdd68faabe79`（count1）；实际protectedCell读点保留，无新增原生terrain白名单，删除记录 `removed-reader.json`。根测试清单登记新共享入口文件，模块清单登记review/natural文件。

### 8.2 红探针、反事实与既有前提

`review-before.log` 新6项在旧候选全部失败（exit1/5.10s），复现抽屉键所有权、正式休息与自然bounds问题；修复后首批入口相关56pass，再补边界/目标/确认到66pass。早期新probe使用已占用的同一标记导致C5_PROTECTED，而非期望region冲突，保留 `entry-last.log`；只把新负例实际标记改成另一个可见空格，C5_OVERLAP断言不变。

两个受影响底座旧测试先做外部同候选单生产文件反事实，仅回退 `StructureWorld.ts` 到修复前：旧测试未改，2pass/40按名称筛选未执行，exit0/2.09s；manifest证明仅该文件变化。随后 `ext_structure_protection` 的管理整矩形machine/D40 blanket前提换为实际施工格machine/D40楼梯，仍拒绝C5_PROTECTED；`ext_structure_review`的全bounds未知前提换为实际施工格未知，before/after隐藏machine仍C5_BLOCKED。只换前提、不改拒绝语义。

旧 `crafting_ui`“任意方向键被抽屉拥有”前提同理：外部只回退 `useCraftingUi.ts` 到HEAD，旧测试不改，1pass/264按名称筛选未执行，exit0/0.598s，manifest只有该生产文件。最终只给旧方向键事件补实际抽屉内BUTTON焦点，保持原true/preventDefault、Escape关闭/不提交断言；抽屉外移动另走真实共享入口。这里的筛选未执行不是新增skip，也不计全套通过。

中间最终尝试均保留，不能算同批：`final-boundary-failure`/`final-boundary-failure-2`暴露新共享测试越模块私有导入，改用生产公开UI catalog/useSession和本文件受控初始场景；checker/白名单未改。`final-types-failure`为新夹具readonly DTO赋值类型错误；准备阶段用Object.assign而非生产写入口。`final-related-failure` SHA `406718f4754e18a0e3f669732446aaf724b9631bb8ba6307a57d88710d547bc6` sameInput=true，boundary/types/build/自有133pass，但相关563pass/6fail、drift未跑：五项新夹具在classic构造阶段读取未安装runtime，补模块作用域前提；一项旧合成焦点前提按上述反事实修正。后续 `input-crafting-correction.log`269pass/1fail与run尝试/diagnostic保留；剩下新中断用例在首回合天然发现远方实体自行中断，受控起始房间加隔墙后 `input-quiet-correction.log`5pass。上述没有改原生自动中断规则或自然路线。

### 8.3 自然公开路线与受控证据分列

新增 `settlement_natural.test.ts`：seed28、normal、仅settlement，真实原生开局(38,26)，背包只有1 FOOD；离线生成地图/原始物品/危险/初始演员侦察规划路线，**实际执行只原生公开move，未注入地形/库存/位置/RNG**。第62次move走至真实FOOD(74,10)，原始口粮ID2从1变2；再撤退，含两次正常战斗尝试共76次move至(67,5)，存活满血。此为确定路线，不冒称盲探索。完整公开输入JSON随测试保存，最终D1.json含原生录像。

D1标记(68,5)，bounds(64,1,9,9)，床(66,5)，向东扩张width10，真实木材存1取1，正式UI床休息、拆床、撤营；锁储备恰2，通用禁取仍守卫，撤营回到同一原始FOOD对象/ID2、quantity2。真实save/load digest一致，完整D1录制从自然origin重放零OOS。结束8900 simulation tick。普通满血床休息启动后auto_step依原生规则零tick/零饥饿停止，**不是正回血/耗时证据**；正式UI正耗时/饥饿/中断证据另为受控负血测试，不能混用。

D5是**独立首访准备**：同样真实D1拾粮路线之后直接depth=5、native generateDepth，保持同背包inventoryStamp/启动收据，无人工落点/抹地形；native landing(68,21)，公开右走一格(69,21)，标记(70,21)、bounds(66,17,9,9)、床(69,22)、向西扩张x65/width10，同样实际存取/UI休息/拆卸撤营/save-load，结束9000 simulation tick。**未徒步D1→D5，也不称D5未记录准备的录像通过**；既有受控真实D1↔D2步行、seek/续录专项仍单列。natural/D5.json保存准备与公开步行事实。

失败侦察和路线保留：seed10陷阱/混乱、稳定格排门导致不连通、seed28粮旁C5_THREAT与不可用格、D5左侧天然墙/范围切资源边界拒绝、早期比较所有天然terrain导致环境自然晋升不等。没有为这些失败放宽保护或冻结天然环境；天然正常晋升不算人工改图。最终成功数据在新批次 `final/natural/D1.json,D5.json`，不拿开发成功日志冒充最终同SHA。


### 8.4 冻结最终门禁、哈希与性能

最终 `src/scripts/public` 1151文件聚合SHA-256 **`1b7565be78c172c9203061eded7698dcc928ed7b5046d3babfc828e6712b7681`**；`final/hashes-before.json`与`hashes-after.json`逐文件一致，`sameInput=true`。21个变化路径（对原审查1eb批次）与逐文件before/after见`review-to-fix-diff.json`；新接口/测试已在同一输入内验证。docs本身不在此源码聚合内，交付清单另留文档hash；不能把旧4a18、后夹具1eb或中途4067批次当作本批。实际命令和环境以`run-final.py`及`final/state.json`为准，均显式Node24.19.0 PATH、3GB堆、Vitest最多2workers。

| 最终必要门禁 | exit/结果 | wall秒 | 最终日志 |
| --- | --- | ---: | --- |
| environment | 0；v24.19.0/3072MB | 0.0288 | final/environment.log |
| boundary | 0 | 2.7167 | final/boundary.log |
| vue-tsc -b | 0 | 11.6003 | final/types.log |
| npm run build（外部固定目录） | 0 | 16.2994 | final/build.log |
| settlement自有专项 | 0；13文件133pass | 105.5926 | final/settlement.log |
| 限定相关回归 | 0；21文件569pass | 109.9387 | final/related.log |
| test:drift | 0；5文件8pass | 85.1889 | final/drift.log |

本批没有skip/todo；启动CE源缺失提示不等于这21文件中发生跳过。原首次42文件的一项既有CEskip仍属于其旧批次，不转移给本次。相关21文件列表完整保存在state.command：结构geometry/integration/properties/protection/review/source_guard/transactions、真实抽屉输入/模块UI/DialogService/continuations/touch、canvas/appearance/animation、i18n/hardcoded/hygiene/membership以及合成UI/geometry。本轮没有全npm test、全部test:ext、全组合/删除或CE full/gen，留5Z；不因测试通过扩大或重复门禁。

engine-only性能采样为同一受控单层场景对照与四组件施工营地，各320 wait、32预热，287普通样本/1个256完整摘要单列；普通命令P95：对照 **4.741958ms**、营地 **5.067500ms**、差 **0.325542ms**（≤5ms门槛，断言未改）。median 4.184459/4.112459ms，普通max 8.943209/8.230875ms；摘要peak 78.283167/75.303334ms不混入ordinaryP95。原数组见`final/performance.json`；这是场景采样，不是配对因果保证、最大长局或浏览器FPS。`browserFPS=null`，施工界面流畅度待指挥实际取证。

固定构建79文件聚合SHA-256 **`0a769e86a0fde11846814c06de9a7a6e48a447bd25ffc9ca98851c56b4553995`**，路径`/private/tmp/brogue-commander-20261007/browser-fix-handoff/build/`；逐文件hash及源码/测试分组hash见`browser-fix-handoff/manifest.json`。聚合算法均对排序的“相对路径\0逐文件SHA256\n”取SHA256（源码聚合保留src/scripts/public前缀，构建相对build）。manifest的actualBrowserRun=false，工具语法检查exit0不能冒充浏览器执行。

九个5G冻结文件再次直接对HEAD blob及已有baseline SHA核对，全相同，完整记录`frozen-check.json`。包括worldSdk、edibleSdk、worldEdible、kindKnowledge、actorNeeds、stats、**worldHarness**、forageHarness、forageFixture/index；forageFixture已跟踪完整目录亦直接对blob一致。本轮没有触碰5G接口或其fixture。

### 8.5 浏览器接力、仍未验收与停止边界

[接力README](/private/tmp/brogue-commander-20261007/browser-fix-handoff/README.md)提供固定构建启动方式及显式Node命令。首先由指挥运行技能原Playwright client小步标题页smoke、实际查看截图/状态/控制台，然后运行新`natural-route.mjs`（normal seed28只settlement真实双粮整链）、`drawer-input.mjs`（390巫师seed5两抽屉展开/收起八向DPad）、`panel-matrix-fixed.mjs`（24独立菜单/布局场景）。这三个接力脚本只做Node --check exit0，**未启动监听/Chromium、未产生本轮真实截图或浏览器通过**；语法命令逐项见handoff语法日志。原QA目录common/driver未覆盖，矩阵副本只适配新坐标与桌面toggle；真实流程不得私有调用、送粮、抹地图或瞬移。

天然浏览器脚本保存实际按键/坐标/确认/截图/控制台与录像；一床后180个requestAnimationFrame间隔的准备只测浏览器帧间隔，不代表最大施工Pixi FPS。源码/脚本读取公开render_game_to_text，仅允许展示帧钩子；未增规则绕过测试入口。原skill路线payload不能在新标题context直接执行并假称天然路线，README已标明bootstrap与正常菜单流程。

待指挥实际验证：1440×900/390×844/320×844 ×普通/沉浸 ×original/refined/hanzi/tiles的24矩阵；营地/合成展开与收起外部移动、input events/turn/position/镜头与逆坐标、真正DialogInput/确认/ACK及长按/blur安全；自然双粮付费施工/真实锁粮/存取/正式床No/Yes/受伤恢复与打断/拆卸撤营；实际墙门窗屋顶四模式、16格队列/No/失效/ACK、长名字/满包/合理规模施工流畅度、真实楼梯跨层/save/replay/seek/续录浏览器证据。引擎受控专项或自然D5首访准备均不能代替这些。

指挥已通过无游戏JS静态favicon控制页复现`No available adapters`（browser-gpu-control.json），现归环境探测；旧warning/log/exit1原样保留。接力工具沿旧控制台严格策略可能仍因warning exit1，须分列环境分类与产品动作，不删除或改写退出码。模拟hasTouch与真实手机分列；真实手机/安全区/软键盘无设备证据，待用户试玩/5Z，不能验收通过，也不重复申请浏览器权限。

**本候选交付状态：未提交，相关自动化全部通过；F1–F5等待指挥真实浏览器复核，F6必要验收仍未关闭。原独立报告的BLOCKED结论未修改，后续由指挥复核并安排必要独立定向复审。报告交付后原执行者停止实现/测试，不commit/push；仅在后续明确发现与resume授权时修复。**


## 9. R1/P2 测试归属修复交付（2026-10-08）

依据外部`phase5c1-r1-fix.task.md`完整阅读[复审第5节](phase5c1.review-findings.md#5-修复定向复审2026-10-08)，尤其§5.3。此次只修R1，共享测试不能强制安装可删除内容模块；F1–F5生产已独立关闭，不再改其实现。原审查的BLOCKED和新增R1结论不改写，本节是原执行者修复/自测，不是另一次独立复审。证据目录`/private/tmp/brogue-commander-20261007/phase5c1-r1-fix-evidence/`；状态`phase5c1-r1-fix.status.md`。基线/HEAD9b651572b3c5561f91b3773dead11908ffa63b34，ext/phase5，未commit/push、不另派代理。

### 9.1 实施和断言保留

| 测试归属 | 修改与证据 |
| --- | --- |
| settlement自有 | `tests/settlement_input.test.ts`注册到settlement清单，真实UI session＋实际建营、InputManager/DPad/Canvas→Game两次移动：输入记录+1/+2、回合+1/+2、坐标+1/+2、面板保持、390剩余视口和玩家逆坐标；打开非模态抽屉公开interrupt_auto、自动行动停止且simulationTicks不增加。保留原语义，无其他内容模块依赖。 |
| crafting自有 | `tests/crafting_input.test.ts`注册到crafting清单，真实session仅安装crafting，不再需要先装settlement/建营。保留相同真实两次输入/录制/回合/坐标、面板保持、相机/逆坐标断言；没有用mock session代替。 |
| foundation共享 | 原`src/test/ext_settlement_input.test.ts`删除，清单换为`ext_canvas_input.test.ts`。经典规则真实Game，断言extensionRuntime=null；保留创建真模态屏障、DialogInput忙、文本焦点与App/Canvas自动暂停和输入分离合同；补真实DialogService Confirm/ACK未答期间阻断，答后真实move恢复及记录/回合正对照。共享文件不选择、不查UI catalog、不导入任何可删除生产模块。 |
| 重复场景准备 | `src/test/support/canvasInputScene.ts`只准备受控recording origin的原生地图/演员/物品，不读内容模块。实际模块工作节点/食物前提留各自自有测试；模块用例必须安装自身并运行，不是缺模块直接return。构造时classic origin没有work实体属于准备生命周期，不是跳过用例。 |

原5个用例拆成模块2+1、共享3，共6项（共享新增正对照）；没有减弱断言、skip/todo、宽exclude、空壳模块或修改发现器/守卫。settlement自有清单现增加到14个test文件，crafting增加一个自有test文件；**本轮只跑必要最小集合，不冒称重跑完整自有门禁**。改前输入及原共享文件保存在`before.json`与`ext_settlement_input.before.ts`。旧审查红删除副本与日志原样保留；新副本只实际删除整个模块目录，不写候选本树。

### 9.2 限定门禁与最小实际删除

全部Node命令显式PATH选择24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest`--maxWorkers=2`；精确命令/退出码/wall耗时见`run-gates.py/state.json`和`run-removals.py/removal-results.json`。本批正常输入1154文件聚合SHA256 **`9c291c76ce787448198df8d717554ca5fbb017f805b62c2512bb53b3dfc8b9df`**，`final-input-before/after.json`一致、sameInput=true；与改前1b7565的差异仅8个测试/清单路径，见byte-comparison.json，不混为同一个hash。

| 正常候选门禁 | exit/结果 | wall秒 | 日志 |
| --- | --- | ---: | --- |
| Node环境 | 0；v24.19.0/3GiB | 0.0202 | environment.log |
| boundary | 0 | 2.0428 | boundary.log |
| vue-tsc -b | 0 | 7.7294 | types.log |
| 限定相关6文件 | 0；57pass | 4.2539 | related.log |
| npm run build（新外部目录） | 0 | 10.8894 | build.log |

相关6文件为共享Canvas输入、settlement输入、crafting输入、test_suite_membership、ext_module_ui、dialog_service_input。开发首批4文件12pass/boundary exit0保留在entry-first.log/boundary-first.log；最后补共享真实Confirm/ACK后以本批6文件57pass为准，不累加前后数量。

| 外部副本/实际删除 | 保留且实际运行的最小集合 | exit/数量 | wall秒 / 输入SHA256 |
| --- | --- | --- | --- |
| without-settlement：完整settlement目录 | foundation Canvas + crafting自有输入 + membership | 0；3文件10pass | 3.4985s；`258568fbf8857cca55f068aa159c1b61ee5e29089b824985aa03298ff7504f5a` |
| without-crafting：完整crafting目录 | foundation Canvas + settlement自有输入 + membership | 0；3文件11pass | 3.6752s；`93ff967718ea64f7bc49207df1a75bc8190efbb8f24d68ee5d774b8bd6457834` |
| without-all：全部六生产目录combat/crafting/giants/growth/narrative/settlement | 仅foundation Canvas输入 | 0；1文件3pass | 3.0387s；`9b27d8e62bc2a1c6f88bccac85753156f429dd0c10499def8566aa9e6e905676` |

三个副本前后sameInput=true，和正常候选相比仅被删模块目录文件不同；完整删除文件列表保存在removal-plan/results。`check-discovery.mjs`实际调用生产resolveTestSuites，对正常树/三副本共四树断言exit0：新共享文件为foundation/moduleId=null并在test/ext集合；自有输入为各自module owner、进入各自test/ext；被删模块及其自有测试自然不发现，没有剩余stale登记。全部删除副本模块列表为空，共享三项仍实际执行通过。

形成原复审红对照：同旧共享测试字节在仅删settlement时2fail、仅删crafting时1pass/1fail；本轮归属修正后分别10pass/11pass，额外全部删除3pass。旧名称筛选的未执行项仍属于其旧日志，不记为本轮skip；本轮选中的正常/删除集合无skip/todo，CE源缺失启动提示不改变所选结果。没有重跑完整npm test/test:ext/全组合/删除矩阵，也未跑drift：本轮地形/生成/生产字节无变动，仅测试受控场景调整。

### 9.3 生产/入口/实际Vite依赖与GUI复用

改前先记录src/scripts/public全部逐文件清单，并记录所有潜在构建依赖/外部依赖实际字节。排除test/tests/testing目录、*.test/spec文件、test-suites.json和文档后的生产source/scripts/public，加index.html、package/lock、vite/tsconfig入口配置，**513文件**前后聚合都为 **`02d95d2954f7b280a88208f184dda79837299153ffac2999cd03007b107d5dae`**，逐文件差异`[]`。未改production代码、模块数据、checker/discovery实现或5G冻结文件；8个变化路径全为测试/测试清单。before/after.json同时保存完整含测试输入和生产分区，分类规则见snapshot.py。

生产build写全新`phase5c1-r1-fix-evidence/build/`，没有覆盖browser-build-final-3或旧日志。外部build.config.mts只给原vite配置附加Rollup buildEnd只读观察插件，记录实际模块图，不transform代码、不emit资产；原vite配置仍加载。1153个实际文件依赖均能在改前记录找到，前后逐字节一致；实际依赖聚合SHA256 **`04e74b94edb703f718c2016e8b801f3b56cc1eac8506f938a439401a6282fece`**，另外14个虚拟模块ID原样记录，虚拟ID不冒充文件字节。实际图及完整比较见vite-actual-dependencies.json/byte-comparison.json。

新build **53文件**，逐文件全部与指挥fixed3同名文件SHA一致，index.html也相同，新增/字节变化`[]`；新产物聚合SHA256 **`5fc2f8a26a9db4bef6821b69fac79a972bcca946d829a08606a54cc36b649b2e`**。fixed3目录的79文件仍与其原manifest完全一致；多出的26个是旧构建残留hash chunk，在新53文件中没有任何文件名引用，完整名单与引用检查保留。**不是两个整个目录hash相同**：新目录去掉旧残留，所有当前有效生产产物字节相同。因此最终1b7565生产的browser-matrix-fixed3（24行exit0）和browser-v4-d1-final-01自然闭环证据可复用；本轮不重新运行浏览器，也不把复用写成新执行。

### 9.4 当前裁决与停止

F1–F5已由独立复审关闭；指挥最终fixed3的24场景与normal seed28自然双粮营地/床/箱/存取/撤营闭环通过，参见原复审§5.4。早先§8“待浏览器”是当时历史，不再据此否定已经生成的最终浏览器证据。仍不把满血0tick床休息写为正回血、短时rAF写为持续大量施工性能或模拟触摸写为实机。

R1本轮仅测试归属修复，必要正常门禁/最小实际删除证据通过，交指挥定向复核；**不自行改独立审查的BLOCKED结论**。F6残余长名称/26格满包/64槽箱、持续合理规模施工、受伤床/16格ACK/复杂浏览器跨层save/replay/seek/续录等是否补验或延期，由指挥按复审§5.4收口，不扩大本次生产范围。真实手机留用户/5Z。本轮README/progress及外部状态均更新，全部验证完成后交付停止，等指挥复核/提交；没有commit/push、子代理或新浏览器请求。


## 10. R2/P2 原生背包关闭后入口恢复修复（2026-10-08）

完整读取外部`phase5c1-r2-fix.task.md`、[独立审查§7](phase5c1.review-findings.md#7-原生背包关闭后的营地入口定向审查2026-10-08)与独立inventory.test/config/观察/对照。独立`phase5c1-inventory-review.done=exit0`探针的2项是断言bug存在，不当作产品通过；原指挥run-390-02失败与此前run-390-01工具材料问题分类均保留。本节是原执行者修复/相关自测，不是另一次独立审查，不改原审查文字。

### 10.1 最小生产修复与模态合同

`useSettlementUi.ts`的commands computed在求值入口无条件读`host.tick.value`，随后返回原命令数组；与crafting已有模式一致。Game库存/资格是普通字段，blocked为true时依旧跟踪tick，普通App轮询能使cached disabled重算，不再依赖被短路移除的model依赖。

**唯一生产变化为此computed依赖**；`disabled: blocked() || !model.value`、blocked/live、canOpenPanel/open/send资格和模态屏障保持原字节。没有修改核心Game、InventoryOverlay、CommandBar、useModuleUi/catalog、recording语义或冻结9文件，没有永久enabled或强点禁用控件。待推进时的canOpen与send拒绝仍沿原有条件，本轮不扩大底座实现。

自有新增`settlement_inventory_ui.test.ts`并注册settlement清单，保留R1物理可移除性。没有在foundation测试中加入settlement依赖、其他内容模块导入、skip/exclude、空模块或缺模块直接return。自有test清单现在15文件；本轮只跑必要相关集合，不声称重跑全部营地门禁。

### 10.2 真实客户端事件回归：先红后绿

客户端CommandBar/InventoryOverlay由既有SFC harness编译真实模板，自定义renderer持有实际事件闭包；给activeGame绑定真正Game，生产useModuleUi默认catalog聚合和真实useSettlementUi，无mock session。host包含与App相同的gameStarted/menu/creation响应式refs及canOpen/canPresent/展示忙谓词，不固定canOpen=true。InputManager＋Canvas公开入口和InventoryOverlay键盘handler真实运行。

| 新回归 | 实测范围 |
| --- | --- |
| 右上X关闭 | normal seed28 only settlement，原76公开move取得真实FOOD1→2并付费建营，正常打开/关闭营地。真实CommandBar开背包→正常tick/poll并计算disabled→真实InventoryOverlay X关闭→普通刷新恢复enabled→80次普通poll仍enabled→正常按钮onClick重开营地。 |
| Escape关闭 | 同一独立自然初始场景，通过真实EventTarget窗口keydown/keyup、InputManager及InventoryOverlay注册handler关闭，普通刷新恢复并正常点击重开。两种关闭均记录77→78→79，规则回合保持79，库存打开时disabled且host两个资格false，关闭时两个资格true；不切换menu/模式强迫失效，不invoke disabled命令。 |
| 原生Confirm | 受控确认前提：真实ItemLoader生成负面药水、检魔后在背包中executeItemCommand quaff，InventoryOverlay真正syncPendingUse产生Confirm。确认/库存期间按钮保持disabled，No取消保留原物品，仍开库存时仍disabled；Esc关背包后正常恢复重开。不是自然拾取药水或修改食物的证明。 |
| ACK/参考屏幕 | 真bindDialogCommands/Acknowledgments＋PresentationTimeline、logger需ACK消息及DialogInput，ACK期间disabled且同一移动入口无新增记录/回合；MORE解除后恢复。随后公开help开启原生reference，仍disabled；Esc退出普通刷新恢复重开。ACK是受控消息，非天然游戏发生的特定消息证明。 |

新回归在修前生产**4fail/exit1，4.79s**，分别失败于X/Esc/Confirm后的库存关闭恢复及ACK解除恢复（`regression-before.log/red-observations`）；随后只改生产computed，同一回归断言不改，**4pass/exit0，4.85s**（`regression-after.log/green-observations`）。最终限定批次又完整包含这4项，final-observations保留最终同SHA原始阶段记录，不累加红/绿数量。

这些是headless客户端事件＋每100ms等价tick/组件poll边界，不是执行者在真实浏览器等8秒，不证明DOM像素、实际触屏、布局或FPS。UI真实点击前检查按钮enabled，没有绕过禁用控件；为确认准备的额外物品明确受控，正常双粮建营部分未改地图/食物/落点/RNG。

### 10.3 最终限定门禁、稳定输入与固定新构建

改前输入**`9c291c76ce787448198df8d717554ca5fbb017f805b62c2512bb53b3dfc8b9df`**保存在before.json与useSettlementUi.before.ts。最终src/scripts/public 1155文件聚合SHA256 **`72d1afadec5582146dbf5203f3bf3bc15710d3bc54c54e2c18c8afd1cb76ca64`**，final-input-before/after逐文件一致、sameInput=true；相对9c291只有3项：useSettlementUi.ts、自有新inventory_ui测试、自有test-suites.json。9c291-to-r2.json保存逐文件SHA，production.diff保存唯一生产diff；全部共享冻结9文件在完整输入清单内不变，不读/安装用户另树新交dot/5G候选。

所有实际Node命令显式PATH选择24.19.0、3GiB，Vitest最多2workers。精确环境/命令/exit/wall秒在run-final.py/state.json。

| 最终必需门禁 | exit/结果 | wall秒 | 本证据根日志 |
| --- | --- | ---: | --- |
| environment | 0；v24.19.0/3072MB | 0.0210 | environment.log |
| boundary | 0 | 2.0913 | boundary.log |
| vue-tsc -b | 0 | 8.1763 | types.log |
| 必要相关8文件 | 0；90pass | 10.9640 | related.log |
| npm run build（新空外部目录） | 0 | 11.1815 | build.log |

8文件为settlement_inventory_ui/settlement_input/settlement_ui、foundation ext_canvas_input、ext_module_ui、dialog_service_input、dialog_host及test_suite_membership；无skip/todo。CE源缺失启动提示不等于所选集合跳过。本轮没有完整npm test/ext、全删除/组合、全部133/569、drift或新浏览器运行；没有生成/引擎变化，未扩大门禁。

新固定build为`/private/tmp/brogue-commander-20261007/phase5c1-r2-fix-evidence/build/`，**53文件**，聚合SHA256 **`fb5565541436efbe3a477d9ed4f1c1f205f2b1ad15204ad7548fea72091a61a9`**；build.manifest.json含逐文件与源输入hash，actualBrowserRun=false。从空目录构建，绝不覆盖fixed3或旧成功/失败日志；不声称生产/构建与9c291相同，此次必须作为新生产候选。

### 10.4 浏览器交接和停止

[新构建接力](/private/tmp/brogue-commander-20261007/phase5c1-r2-fix-evidence/browser-handoff.md)列真实CommandBar开背包、等待求值、X/Esc关、普通刷新重开、多poll保持、真正Confirm/ACK/参考屏幕阻断及六设施持续交互。指挥将在这个新固定候选运行**新24矩阵、原生背包→重开→六设施持续交互**并实际查看截图/公开状态/控制台；按develop-web-game小步动作/暂停/截图实看流程，不强点、不私有调用、不送粮/瞬移绕过流程。

旧fixed3的24行/自然闭环成功及run-390-02失败原样保留，**旧24矩阵未覆盖此触发，不能复用为R2浏览器修复验收**。本执行者未运行浏览器，不重试既有沙箱拒绝，不冒称新GUI/布局/FPS或独立审查通过。F6余下收口仍由指挥；真实手机按原边界留用户/5Z。

原审查§7的新增R2/P2 BLOCKED结论不改；本候选实现与相关自动化已完成，尚待指挥新浏览器及另进程复审。README/progress/status准确追加，HEAD/分支不变，不commit/push、不再派代理、未碰dot分支/新候选或冻结接口。交付后原执行者停止，不再自行补功能或扩大测试。


提交前格式核对补记：`git diff --cached --check` 首次发现新增 crafting_input.test.ts 第36行空白行含一个空格（普通未暂存 diff 未覆盖该新增文件）。已由原执行会话仅删除这一个 ASCII 空格；其他1154输入、生产代码及53个构建文件逐字节不变。提交输入为 `54893077d923f8d1c4cebbc1b4486abcb0331f826a6d8cbc4c6eb1b9bcdfe6b8`；上列72d1仍准确标识实际门禁/浏览器候选。未因格式更改重复功能测试，前后清单和字节对照见外部 `phase5c1-whitespace-evidence`。

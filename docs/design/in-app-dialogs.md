# 界面内弹窗层：盘点与设计

状态：**维护者已确认（2026-10-03）**：采用显式命令续体与显示事件序列；死亡默认按顺序播放并提供“查看结算”直达；D5/D6（扩展分支适配与合并）不在主线计划内——扩展分支为独立原型，不合并进 main。各步另写任务书实施。

原状态：设计稿，待维护者确认后另开实施任务。本步只新增本文；未改生产代码、测试或夹具，未 commit/push。

盘点日期：2026-10-03。main 工作区：detached `1ff39a8`；扩展参照：本地 `origin/ext/foundation`，`0f0dfc1`（只用 `git show/git grep` 阅读，未切换或合并）。CE 行号均相对 `.ce-reference/BrogueCE-master/src/brogue/`，对应 `SOURCE.json` 的 legacy 提交 `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`。本步使用用户提供的本地 CE，不拉取、修改它，也未声称已经复核最新 upstream。

任务来源：[`../tasks/design-in-app-dialogs.md`](../tasks/design-in-app-dialogs.md)。已读 `AGENTS.md`、`docs/HANDOFF.md`、`docs/development.md`、`docs/architecture.md`，并补读 i18n 规则。

引用路径约定：`Game.ts`/`TimeCoordinator.ts` 在 `src/engine/Core/`；`Item.ts` 在 `src/engine/Items/`，`Logger.ts` 在 `src/engine/Systems/`，`CosmeticLight.ts` 在 `src/engine/Lighting/`，`Input.ts` 在 `src/engine/`。`App.vue` 在 `src/`，其它 Vue 文件在 `src/components/`（Growth 两页在其 `growth/` 子目录），UI 辅助 `.ts` 在 `src/ui/`，测试在 `src/test/`；扩展 `runtime.ts` 为 `src/ext/runtime.ts`，`module.ts` 为 `src/ext/modules/growth/module.ts`。`advancementLoop` 是 TimeCoordinator 中的函数；省略文件名的连续行号沿用所在条目的文件。

## 1. 结论与需要保留的合同

推荐统一 DialogHost + DialogService，支持确认、消息确认和扩展对话。**确认采用显式命令续体；消息确认采用显示事件序列**。二者共享样式、输入仲裁、生命周期，不混用引擎决策。

- main 有 **10 个 `requestConfirm` 调用点**，全部在 `Game.ts`；另有 **1 个直接调用 `onConfirmRequest` 的闪现确认**。不能只搜索 `requestConfirm` 就宣称原生确认已清零。扩展的受控移动/攻击复用这些位置，没有新增 `requestConfirm` 点。
- 没有发现这 10 个问题之前已经扣物品、耗回合或掷实质骰；但它们前面确实有状态写入，未采样闪光的归一化还可能消耗存档 cosmetic RNG。移动会清陈旧抓取标记，投掷会结束瞄准，所有命令还有归一化副作用。不能通过“执行一次、抛异常退出、再整条重执行”实现异步确认。
- 当前 ACK 队列只阻止**下一条命令**，不阻止本条命令的推进。麻痹强制回合同步结算，确认层和结算层的呈现顺序又被 ACK 队列控制，因此可能先看见旧警报，清队列后才看见已经发生的死亡。
- CE 的确认：`y/Y/Enter` 是，`n/N/空格/Esc` 否（`IO.c:2951-2973`）；CE 的 MORE：**空格/Esc/鼠标释放**，其它键只提示继续方式（`IO.c:2914-2927`）。当前 web MORE 的“任意非修饰键继续”是偏差。
- 录像 `version: 2` 的 `decisions: boolean[]`、双流检查点与存档世界结构保持；已有普通确认拒绝事件仍记录 `[false]`。CE 会取消相应按键记录，web 会保留取消命令用于诊断，这是既有合同，不借界面替换更改它（`Game.ts:2740-2757`；`u_27_recording.test.ts:63-78`）。
- 新弹窗、待处理指针、显示序列不进入存档、录像、黄金 trace。黄金 trace 与生成基线必须不变；出现差异先归因，不重录来迁就实现。

本文区分“代码/探针事实”与“拟实施行为”。下面的接口名和新文件名都是设计建议，尚未实现。

## 2. 确认盘点

### 2.1 共同入口及此前副作用

`App.vue:12-19,99` 接线同步 `window.confirm`。进入原生框前 `cancelHeldInputs()` 释放 DPad/触屏持有状态；回放在 `Game.requestConfirm` 消费录像决策，正常不会到原生 UI（`Game.ts:7658-7665`）。`App.vue` 中的 `replayStatus === 'playing'` 放行不是 decisions 的替代品。

每行中“此前”包含完整命令前缀，而不仅是当前小函数：

| 前缀 | 实际状态写入与证据 | RNG/收费 |
|---|---|---|
| P0：命令归一化 | `Game.ts:2762-2768` 设置 Logger disturbed 回调、手动命令停止自动行动、清 hover、结束瞬态显示。`stopAutoTravel:10088-10097` 清路径/自动战斗/自动动作并置 disturbed；`finishTransientDisplay:4656-4665` 可能提交闪光所揭示的知识并清显示状态，`prepareFlareKnowledge:4625-4633` 会遍历闪光帧提交发现 | 不推进回合或消耗物品，不掷实质骰；**未采样闪光可消耗存档 cosmetic 流**，详见下段。不能把这些写入称为纯预检；不得再次运行或在克隆世界中偷偷重演 |
| P1：移动/攻击前缀 | `Game.ts:3064,3225-3228` 清 `justRested` 和本轮曾见集合；`3286-3293` 清陈旧 `seized`。bump 晋升 `3295-3306` 一旦发生就耗时并 return，**不会继续到下面的确认** | bump 是另一条出口，不应误报成确认前已经掷骰/耗时；混乱方向骰单列下表 |
| P2：提问入口 | `Game.ts:7654-7657` 在自动步骤中停止自动行动、清 `inAutoTravelStep`；随后消费/记录一个布尔答案 | 提问本身无 RNG；取消也不会恢复旧路线 |
| P3：投掷前缀 | `Game.ts:6104-6105` 先清 `isThrowing/throwItemTarget`，UI `TargetBar.vue:33-41` 也先清纯显示瞄准格 | 不扣物品，不掷投掷命中骰；取消后不恢复瞄准，这是既有 web 行为 |

P0 的随机数例外适用于下表每个入口：`Game.ts:2768→4658→4625-4633` 调用 `CosmeticLight.ts:68-79`，仅在闪光缺少 samples 时采样；`sampleLight:25-41` 采半径和颜色，`cosmeticDraw:6-9` 临时选择 **rng 的存档 cosmetic 流**再恢复 currentRNG。已采样时 `68-70` 直接返回，通常上一回合的 `finishTurnEpilogue` 已在 `Game.ts:8602` 采好；但不能据此对任意夹具/原始状态宣称提问前双流零消耗。`displayRandom:15-22` 才是独立显示流，不能与上述存档流混称。保留原前缀恰好一次，进入待答案阶段后两条存档流均不再变化；特殊夹具应比较原同步路径的相同前缀，而不是删除已有采样来满足零消耗断言。

名称读取是只读：`Item.ts:190-211` 的显示名查注册表/题名，`Game.ts:2690-2695` 的 `monsterDisplayName` 按可见性选名。预览不得调用 `update()`、`getState()`、`toSnapshot()` 或任何带副作用的格式化/显示函数来替代只读检查。

### 2.2 全部 `requestConfirm` 点

下表按行为分组，调用数为 10；Q7–Q10 可在同一格按顺序连续提问。CE 的 `else if (... && !confirm(...))` 在答是后仍可走后面的风险条件，不是“四选一”（`Movement.c:1311-1365`）。

| ID / web 调用位置 | 场景及 CE 执行位置 | 提问前具体证据；取消与续体 |
|---|---|---|
| Q1 `Game.ts:3275` | 混乱移动且合法邻格有已知熔岩；`Movement.c:1097-1138`，确认 `1117` | P0/P1 已运行；`3263-3274` 只筛合法方向，**方向 RNG 在 `3276`，在确认之后**。CE 否：`1118-1119` cancelKeystroke/return，不随机选方向。续体保留候选方向，答是才按原位置掷一次；混乱救俘不会再询问 Q2 |
| Q2 `Game.ts:3333` | 撞向俘虏救援；`Movement.c:1194-1215`，确认 `1202` | P0/P1；`3315-3332` 先判几何攻击与通行。几何攻击若已出手就走另一出口，不到 Q2。钥匙晋升/消耗在 `3336-3339`，救出在 `3341`，计时在 `3344-3345`。CE 否：`1213-1214` 取消，不用钥匙/不救援/不耗攻击时间。续体保留俘虏与钥匙匹配结果并在回答后复查 |
| Q3 `Game.ts:4082` | 食物营养会溢出；`Items.c:7482-7488`，确认 `7486` | P0；`eatItem:4065-4071` 先检查行动能力，`consumeFood:4076-4080` 只读物品/营养。消耗在 `4087`，营养写入 `4088`，时间在 `4070`。CE 否直接 false。自动进食 `TimeCoordinator.ts:256` 传 `false`，不能额外加一道问题。续体答否不吃、答是原路径一次 |
| Q4 `Game.ts:6117` | 投掷已装备/附魔过的单件贵重物；`Items.c:7102-7113`，确认 `7106` | P0/P3；`6107-6116` 只校验目标、背包、装备并在派生对象上隐藏知识生成名字。卸装/诅咒检查 `6120-6128`、移出/拆堆 `6138`、命中骰 `6162` 全在其后。CE 否 return，连诅咒消息也不产生；是后才拒绝诅咒物。CE 问题在选位置之前（`7117` 起），web 在已选目标之后：保留此既有交互分段，另记差异，不能重排录像命令。续体冻结物品 ID/目标格，否只保留 P3 |
| Q5 `Game.ts:7678` | 攻击首个可见纷争盟友；`Movement.c:812-828`，确认 `821` | P0/P1；`abortPlayerAttack:7671-7677` 先排除混乱/非心灵感应幻觉，再经过 Q6，之后找盟友。普通近战 `3352` 先确认，恶心骰 `3353`、攻击 `3357` 在后。鞭/矛也先问后打（`playerWhipAttack/playerSpearAttack`）。CE 否返回 abort；不攻击、不恶心掷骰。续体保留完整 hitList 与已接受 Q6，不能重复问/重复消耗第一个答案 |
| Q6 `Game.ts:7718` | 非保护武器攻击首个可见酸性目标；`Movement.c:779-806`，确认 `798`，酸性优先 `837-852` | P0/P1；`7709-7717` 仅读武器保护、知识、怪物类别/可见性。具体出手和 RNG 在上述调用者的确认之后。混乱/幻觉免问；已知屠戮命中对应类别免问。CE 否 abort，武器不退化、不耗时。续体先酸性再盟友；鞭/矛/斧的目标次序和几何选择不变 |
| Q7 `Game.ts:7743` | 自愿跳入已知渊/洞；`Movement.c:1311-1323`，确认 `1319` | P0/P1；`confirmPlayerMove:7727-7742` 仅读旗标/状态。已知致死熔岩在 `7736-7740` 先提示并 return，根本不问。`diveConfirmationNeeded:7765-7776` 只读；位移/坠落在后。CE 否 cancelKeystroke/return，不换层、不掷坠落伤害。续体否中止风险链，是继续剩余问题 |
| Q8 `Game.ts:7746` | 可见火焰、未混乱/燃烧且防火即将或已失效；`Movement.c:1325-1335`，确认 `1330` | P0/P1；此前可已答是 Q7，但未位移/着火/扣时间。`7731-7745` 只读取持续时间/旗标。CE 否取消整次移动。续体保留先前答案，之后才走地形进入路径 |
| Q9 `Game.ts:7749` | 可见混乱/麻痹气体，未混乱/燃烧且无已知呼吸符文保护；`Movement.c:1336-1347`，确认 `1343` | P0/P1；此前可接受 Q7/Q8；`7734-7735,7747-7748` 只读，不施加气体状态。CE 否取消移动。续体不得将“毒气/伤害气体”一并扩大成新确认条件 |
| Q10 `Game.ts:7755` | 可见/测绘的未踩下已知压力板，且无相应呼吸符文豁免；`Movement.c:1349-1365`，确认 `1361` | P0/P1；`7750-7754` 只读 depression 集合与层类型；尚未触发 `triggerPressurePlate:10515-10518`。CE 否不踩板、不触发机器、不耗时。续体答是才执行原移动路径 |

**方案适用判定（逐点）：**Q1–Q10 在自己的业务效果之前都有安全边界，均可拆为“已运行的前缀 → 待答案 → 原位置后缀”。Q1 需特别保持方向骰在后；Q2/Q4 的对象/目标需复查；Q5/Q6 要维持两道问题和几何命中列表；Q7–Q10 要维持整条风险链。**原样的无写入整命令重放方案对这 10 点都不成立**，因为 P0/P2 已改变状态，移动另有 P1，投掷另有 P3；不能把这些问题略写成“全部无副作用”。

旁支不在本轮修规则：`diveConfirmationNeeded:7768-7770` 的 web 发现/悬浮/幻觉条件与 CE `1311-1317` 不完全同式；本设计不借弹窗层更改这些条件或消耗顺序。需另开 CE 局部规则任务；若实施时共享谓词抽取碰到它，原行为与差异须明确保留，不顺手修改。

### 2.3 不能漏掉的确认及分段交互

| 位置 | 已发生的状态 / CE / 取消 | 本设计处理 |
|---|---|---|
| `Game.ts:4369-4373` 直接 `onConfirmRequest` | 未知射程跨熔岩闪现。此前 P0、读取 `pendingArcana` 和预览，尚未清选择/扣充能/施法（`4375-4386`）。CE `Items.c:7261-7319`，取消 `7316-7317`；`7370-7376` 将目标确认改为 false，记录/施法在 `7378` 后。web 否清 `pendingArcana`。**此调用不写 decisions；只按 playing 排除，loaded 单步/seek 也可能到 UI。** | 可用续体，但必须单列录像兼容处理，见 §4.4；不能直接换成普通 requestConfirm 然后让旧录像缺答案 |
| `Game.ts:3826-3834,3897,4105` 已知恶意药水/卷轴 | 已设置 `pendingUseConfirm`、写普通提示日志并 disturbed，未消费物品；是走 `confirmPendingUse:3805-3814`，否 `cancelPendingUse:3818-3819`。CE `Items.c:8050-8064/7757-7767` 否在药水 magnitude RNG 和卷轴效果之前返回 | 共用 Host 外观，**保留现有 `item:command` 的 quaff/read→confirm/cancel 分段**，不迁成 decisions，避免改旧前缀/黄金 trace/存档 origin。确认回调仍经 executeItemCommand |
| `InventoryOverlay.vue:353-365,380-384,520` 题名范围选择/文本输入 | CE `Items.c:1404` 询问“此实例还是同类”；web 先选范围后输入标题，`Game` 只在 call/inscribe 命令写题名。取消本地输入无物品/时间/RNG成本 | 复用扩展 choice/text 类型时保持既有实际命令；不把选范围 UI 点击追加进 decisions |
| 强制鉴定/附魔选择 `Game.ts:4163-4190,5610` | 卷轴已经消费、种类已揭示；CE `Items.c:7776-7802,7817-7835` 必须选合法目标。否/Esc 不允许撤销已消费卷轴 | 属于必选目标流程，不当成“危险确认可取消”。ACK 先呈现揭示消息，再开放目标列表；保留 pendingIdentify/pendingEnchantment 和现有命令 |

`Game.ts:367` 的旧注释把 CE confirm 第二参数写成 defaultAnswer；实参实际是 **alsoDuringPlayback**（`IO.c:2937,2944`）。设计不据此推导“CE 默认否”或把 null 钩子的行为改掉。

## 3. ACK 产生点、推进及输入盘点

### 3.1 全部消息确认源

按生产代码 `acknowledge:` 扫描，main 有 **21 个 Logger 调用位置**（20 个在 Game，1 个在 TimeCoordinator）；并非所有日志的 `acknowledge` 显示 class 都是生产点。一个位置可以每次发生都入队；归档折叠与确认次数分开（`Logger.ts:139-143`）。

| web 文件:行 | 消息/条件 | CE 对照位置 |
|---|---|---|
| `Game.ts:2640` | 未知屠戮武器/免疫护甲面对对应类别的符文提示 | `Time.c:2805-2824` |
| `Game.ts:4047` | 药水未知效果兜底 | `Items.c:8200` |
| `Game.ts:4175` | 鉴定卷轴揭示 | `Items.c:7776-7777` |
| `Game.ts:4184` | 附魔卷轴揭示 | `Items.c:7817-7818` |
| `Game.ts:5105` | 入迷射线命中玩家的失向提示；怪物不 ACK | `Items.c:5342-5362` |
| `Game.ts:5610` | 不合法附魔目标 | `Items.c:7824-7835`，消息 `7830` |
| `Game.ts:6442` | `applyTimedStatus` 给玩家施加麻痹 | 通用麻痹表现参照 `Time.c:475-490`；该 JS 公用入口没有一个完全同名 CE 函数，不能声称每个来源都对应这段气体路径 |
| `Game.ts:6921` | 自焚护甲触发且符文此前未知 | `Combat.c:1084-1088`（已在此之前判触发 RNG） |
| `Game.ts:7014` | 饥饿且无食物 | `Time.c:937-940` |
| `Game.ts:7017` | 饿得虚弱 | `Time.c:941-944` |
| `Game.ts:7020` | 饿得昏厥 | `Time.c:945-948` |
| `Game.ts:7023` | 即将饿死 | `Time.c:965-969` |
| `TimeCoordinator.ts:255` | 饥饿强制吃背包首件食物 | `Time.c:949-959`；ACK 在吃/嵌套回合之前 |
| `Game.ts:7828` | 坠入深渊风味 | `Time.c:1129-1132` 按地形 flavor |
| `Game.ts:7830` | 坠入暗门风味 | 同上 |
| `Game.ts:7832` | 坠入洞风味 | 同上 |
| `Game.ts:7834` | 无具体地形的坠落兜底 | `Time.c:1133-1134` |
| `Game.ts:8627` | 悬浮/防火将尽时返岸或超过返岸界限 | `Time.c:2878-2911`，消息 `2901/2905` |
| `Game.ts:9461` | 玩家被熔岩焚毁 | `Time.c:190-201`；CE 先 ACK 后 gameOver |
| `Game.ts:9639` | 麻痹气体施加玩家状态成功 | `Time.c:475-490`；CE 仅由零状态首次接触时提示，web 用 applyStatus 返回值，在本录像中刷新又提示，见 §8 |
| `Game.ts:10507` | 压力板在玩家/可见怪物脚下发响 | `Time.c:240-256`；不可见生物但格可见时 `Game.ts:10508-10509` 是普通消息 |

正文均保留当前消息文案、发生条件、归档、RNG和日志顺序。CE 调试临时消息、cautiousMode/溢行 MORE，以及物品落板 `Items.c:450-451` 不等于 web 已实现的 ACK 源：不在本轮补功能或扩大触发条件。扩展 Logger 添加了事务显示状态捕获/恢复接口（该分支 `Logger.ts:94-112`），主要 ACK 入队逻辑仍同式（`136-164`）；后续扩展新增对话必须走服务适配，不由模块直接读 Vue/DOM。

### 3.2 当前消息流与锁

1. `Logger.log:115-143` 先 flush combat、disturb、归档/折叠，再给启用显示的队列追加消息副本。队列在 WeakMap，`getState:93-95` 不保存队列；setState/reset 清它（`97-112`）。同一文本/相同归档 id 的重复事件也要逐个确认，不能以 id 去重。
2. `MessageAcknowledgment.vue:12-23` 常驻 App（`App.vue:387`），以 `!activeGame.replayRecording` 启用队列，50ms 轮询；回放/seek 的 ACK 默认不等待人。backdrop z-index 10000，click 直接 `logger.acknowledgeNext`，**不经过 executeCommand、不检查 isAdvancing**。
3. `messageAcknowledgment.ts:6-17` 是 window **capture** 监听，拦截按下/重复/释放。目前 fresh keydown 除修饰键外均弹出一条；阻止这个键变成移动，但不同新按键可继续清队列。
4. `executeCommand:2741` 阻止 pending ACK 下的新命令和记录；`GameCanvas.vue:946-948` 阻止新的自动步。既有 `tickAdvancement` 和 `finishAdvancement` **不检查 ACK**。
5. `TimeCoordinator.playerTurnEnded:467-480`：animationEnabled 且非自动/非麻痹才建立迭代器；其它情况同步耗尽 advancementLoop，并在麻痹 do/while 里重复整个主观/客观推进。`advancementLoop:125-141,155-172` 的 yield 只在慢动作客观块中，怪物行动不 yield；ACK 并不构成 yield。
6. `Game.finishAdvancement:8762-8786`：清 isAdvancing，做 epilogue，再 **同步** drain 新得到的麻痹；`8787-8799` 最后才更新记录或完成回放检查点。动画开关不会把麻痹变成逐回合交互。
7. `GameCanvas.vue:966-973` 先 tickReplay、tickAdvancement，后检查 isTimePaused；背包等时间暂停也不是推进暂停；finally `997-999` 仍 flush render。`isInputLocked:8675-8676` 的 5 秒 deadline 保护的是动画故障，不能拿它作为“等用户答案”的超时。
8. `GameEndOverlay.vue:35-44,75-77` 200ms 轮询结果，但 **有任何 pending ACK 就不渲染结算**；其 z-index 9999 也低于 ACK。这是明确的阻断条件，不只是可能遮挡。

由代码能确定：确认按钮在 JS 调用栈返回后可操作，isAdvancing 并不禁用它；但同步强制回合期间主线程无法处理 DOM 点击，且排队文本可落后于引擎死亡。**不能据此断言现场存在永久死锁、某次点击确实被吞、或主线程卡住了多少毫秒**，本步没有浏览器操作/性能采样。实际录像与本步引擎探针见 §8。

### 3.3 其它覆盖层和键盘优先级

`Input.ts:41-47` 先跳过 defaultPrevented/文本输入，再询问 ModalKeyboard。`modalKeyboard.ts:8-16` 按数值降序，不按视觉层级；同优先级遵循注册先后。capture 监听另在这个序列之前。因此“z-index 最大就最先吃键”不成立。

| 界面/流程 | 所有者与键盘行为（main 行号） | heldInput/推进关系 |
|---|---|---|
| 原生确认 | App 的同步浏览器模态，无 ModalKeyboard 优先级 | `App.vue:14` 立即 cancel；阻塞 DOM 与帧循环 |
| MORE | window capture，见上；与 Reference capture 的先后还受挂载顺序影响 | GameCanvas context 监视 pending；按键/按钮直接清队列；不锁当前推进 |
| 帮助/发现参考页 | `ReferenceOverlay.vue:42-54` window capture；任何 keydown（当前包括 repeat）都调用 close，经 executeCommand('escape')，无 ModalKeyboard 数值优先级；视觉 z-index1900（`83`） | context 监视 referenceScreen；旧 capture 不得在 Host 活跃时先吃确认键或关闭参考页，统一仲裁需覆盖它 |
| 菜单/设置/录像库/图鉴 | `MainMenu.vue:83-86` 优先级 1000，所有键归菜单；Esc 先关图鉴/子页再回游戏；输入框不走游戏 keymap。`MapTileLegend.vue:36-40` 是菜单内部的显示弹层 | `App.vue:105-112` 新开取消持有并暂停回放或 interrupt_auto；菜单并非 pending 命令/推进事务的取消器 |
| 侧栏/日志抽屉 | `SideDrawer.vue:11-16` 350，Esc 关，其它键除 Tab prevent；`MessageJournal.vue` 仅读日志，没有独立键盘注册 | App watch 取消持有；不改世界状态 |
| 侧栏/附近详情 | `DetailPanel.vue:63-67` 400，全部游戏键归详情，Esc 关 | App watch 取消持有，独立显示 props 不录制 |
| 地图检视详情 | `DetailPanel.vue:43-60` 50，只接 Esc/x；x 在背包里继续传字母，在普通地图关详情后触发探索 | context 监视 inspectTarget；这是弱覆盖，不得在统一后无意把所有检视变成硬模态 |
| 命令溢出菜单/沉浸命令环 | `CommandBar.vue:75-79` 350；`RadialCommands.vue:42-46` 360，展开时吃键，Esc 关 | 发 modal-open 给 App 取消持有；关闭绝不重启旧 hold |
| 背包/戒指替换/恶意品确认/题名输入 | `InventoryOverlay.vue:61,389-415` 0；字母优先于游戏移动；重复键忽略；Esc 按输入→恶意确认→替换→选择→关闭顺序。Tab/快捷键/聚焦按钮保留原生行为 | context 监视 inventory/pending；`73-94` 推进中的关闭延迟补发 escape，必须在新设计中保留或正确等待 command 完成，不能在弹窗回答期间误关 |
| 必选鉴定/附魔目标 | 背包子状态；`Game.ts:3075-3077,3103-3114`、Inventory `80-91` 拒绝撤销已消费卷轴 | pending 被 context 监视；不是可取消的 yes/no |
| 法器/投掷目标 | `Game.ts:3079-3089` 优先解释 move/Tab/Enter/Esc；`Input.ts:88-98` 映射；`TargetBar.vue:33-48` 触屏同命令。投掷 aim 在 ui/targeting | context 监视 pendingArcana/isThrowing，开始取消旧 hold，但允许重新按住 DPad 移动已经打开的瞄准光标 |
| 结算 | `GameEndOverlay.vue:33` 100，游戏键归结算，按钮原生行为保留；ACK 存在时结算 DOM 隐藏 | context 监视 gameOver；结算并非消耗回合命令 |
| DPad / 地图触屏取消 | `DPad.vue:20-57,93` 按下立即 move，350ms 后每140ms重复；中心 wait 不重复。`mapTouchInput.ts:16-35,44-66` 清手势/长按定时器/捕获/晚到 tap | `heldInput.ts:6-45` 注册 stops/上下文；blur/隐藏取消；DPad 的“取消”是释放持有，不是 answer=false。TargetBar/AgentControls 的取消才发 escape；原命令栏本身不是另一个确认源 |
| 缩放/hover/AgentControls | 缩放与 hover 为弱显示层；AgentControls `15-17` 仍走 InputManager，默认隐藏按钮（`12-13`） | 新 Host 同时挡真实指针、代理命令、地图检视；不可只挡键盘 |
| 沉浸快捷键 | `immersiveMode.ts:25-34` -1000，只在没有相关模态时切显示偏好 | 新 dialogBusy 要加入资格判断；不能通过反引号逃出确认 |

引擎 context：`GameCanvas.vue:357-362` 监视背包、参考页、检视、法器/投掷、强制选择、恶意品、ACK、死亡、回放/playing。App 的菜单/抽屉/日志/附近详情/沉浸面板另以 `flush:'sync'` watch 取消（`105-107`）。`cancelHeldInputs` 仅覆盖注册的**指针**持有状态，不阻止物理键盘接下来的 OS autorepeat；新 Host 需要键生命周期隔离。

扩展额外层（行号来自 `origin/ext/foundation`，不可套用 main 行号）：角色页 `GrowthCharacterPanel.vue:55-58` 优先级600，含属性/技能/身份 tab、技能目标列表和洗点确认；创建身份 `GrowthCreationPanel.vue:52-55` 1100；创建后防双击过渡 `App.vue:79-87` 2500。视觉层级分别为角色900、创建2200、过渡2300。角色页 `App.vue:103-120` 排除 ACK/推进/其它模态并取消持有；`GameCanvas.vue:951-953` 另用 displayModalOpen 阻止自动步。本 Host 的最高业务优先级必须同时覆盖这些层，不用“随便加 2000”与2500争抢。

## 4. 确认异步化

### 4.1 三种方案评估

| 方案 | 判定 | 原因与适用边界 |
|---|---|---|
| 原样“遇 requestConfirm 抛出→无副作用中止→带 decisions 整命令重跑” | 不采用 | P0/P1/P2/P3 已写；通用 executeCommand catch 会把完整录像资格作废（`2752-2755`）。自动步局部路径/目标已选，重跑易丢步骤。扩展 Runtime 的 rollback 只覆盖模块/部分资源，不是全世界/RNG回滚（该分支 `runtime.ts:417-431`） |
| 全命令预检，再只执行一次 | 可用于严格纯的子计划，不能作为通用包装 | 要正确复刻 bump/武器几何/俘虏/抓取/熔岩拒绝/自动步/闪光知识路径；不能复制另一套条件表长期漂移。扩展受控动作在 beforeCommit 前的只读计划适用，见 §4.5 |
| 直接利用现有 advancement generator 挂确认 | 不足以完成 | Q1–Q10 都在玩家动作效果/时间推进之前；现有 generator 只拥有之后的怪物/客观块。它不能恢复已经返回的食物、投掷或移动调用栈，也不能中断普通深层 Logger.log 调用 |
| **显式命令续体，按确认阶段保存继续步骤** | **推荐** | 在真实路径的确认边界保存局部事实；前缀只跑一次，回答后继续后缀，不丢状态、不重掷、不在 Promise 中假装返回 boolean。既有推进 generator 保持其职责；ACK 另走显示序列 |

这里的“续体”可以实现为少量类型化阶段的状态机，或新建**命令前半段** generator；推荐先用显式阶段，缩小调用签名/扩展作用域改动。不是“把 onConfirmRequest 改成 async，但原 caller 继续 if(!result)”——Promise 为真会直接执行危险动作。

### 4.2 一条命令的阶段及边界

建议 session WeakMap 保存 CommandExecution，包含 commandId/runEpoch、原始 action/data、阶段、已经决定的布尔序列、待问题、选中的局部事实。UI 只拿 ConfirmSpec 和 token，不拿可写 Game、Item/Monster 或闭包。继续执行的函数/阶段是引擎所有，DialogService 只发送答案。若实现改用 Game 字段，必须先登记 `scripts/u03-state-contract.json` 的初始化、清理、持久化分类。

```text
executeCommand / executeItemCommand
  → admission（拒绝另一条 pending 命令；回放单独入口）
  → 原 applyCommand 归一化，恰好一次
  → 玩家路径走到实际确认阶段
  → 停自动行动，保存本条命令的继续阶段，发布 ConfirmSpec
  → 返回浏览器，Host 可点击/触摸/键盘；世界不继续执行后缀
  → resolveCommandDecision(token, boolean)
  → 校验 runEpoch/阶段/对象，向本命令 decisions 追加一次
  → 原位置后缀（必要时再发下一问题）
  → 开始原时间推进或直接完成
  → 按原记录时点生成一个事件；推进结束更新最终检查点
```

实施契约：

1. **P0/P1/P2/P3 保持原先发生顺序和取消后的结果**。既已做的前缀不会重新运行，也不试图用 toSnapshot/loadSnapshot 撤销。待答案期间不扣费、不推进时间、不掷骰；纯显示效果可继续使用独立显示随机源。用户取消后没有业务效果，但不能把旧的目标清理/停止路线也当成零写入。
2. Answer=false 仍执行当前阶段的既有取消分支，并完成同一条命令，记录 `[false]` 或如 `[true,false]`；**不是**不记录答案、另录 `dialog_yes/no`。等待中不建 provisional event/不增加 recordedInputIndex。Q3 的拒绝录像合同尤其不能改。
3. Q5/Q6 保存 hitList、几何攻击阶段及问题游标；Q7–Q10 保存风险链位置。回答第二问题不能重复酸性问题/重新选方向。自动步的 `next/origin/depth` 已选事实保存在继续阶段，停止路线后不得再从被清空的 autoPath 重选。`performAutoPathStep:11103-11116` 的 logger.blockCombatText/inAutoTravelStep 作用域要转为显式任务状态，保证返回 UI 时恢复全局 Logger 配置，恢复时仅重建必要局部作用域，取消不留下 blockCombatText。
4. 物品用稳定 ID/背包字母及身份校验，怪物用 ID/位置/关系/知识复查，不能让过期答案攻击另一个对象。正常 UI 等待期间其它改状态输入被 admission 拒绝；新局/载入/重启用 epoch 失效旧 token，不强行把旧答案当 false 录进新局。意外对象变化时放弃尚未收费后缀，提示重新输入；不自动批准新目标。
5. `executeCommand` 是唯一提交/录像边界，阶段继续是这个边界内的恢复操作，不能由组件直接调用 freeCaptive/consumeFood/Combat。`handlePlayerAction(...,'system')` 也不可用来逃过 pending 锁。
6. 现有 executeItemCommand 的 `perform` 回调在生产 Inventory 使用（如 `InventoryOverlay.vue:318`），不能把任意同步回调闭包保存给 UI。将确认敏感的生产调用归一为已有 operation 描述，再由引擎选继续阶段；确有独立 callback 的只读/测试用途仍须同样走边界，不能执行两次。
7. headless 未接 UI 时按既有同步 resolver/null 默认是，驱动同一阶段状态机到完成；回放立即消费本事件的 decisions，不发 Host，不等待 DOM。live/loaded replay/playing/seek 都以 `replayRecording` 区分，不能只判断 playing。
8. pending 确认时，保存世界/导出本局录像不能截出“有前缀、无事件”的状态。`canExportRecording`、保存边界、recordingExport 等待逻辑要认识 pending 命令；允许读 UI/诊断，保存/导出等待决策后完成或显示待完成反馈，不强行 yes，不拿5秒动画超时结算。新局/卸载的失效清理与 discardInFlightAdvancement 统一生命周期，但未执行的后缀不调用 finishAdvancement。

上述结构不要求把整个怪物/生成引擎 Promise 化，不改变 playerTurnEnded 对规则的调度方式。

### 4.3 连续确认与 UI 默认项

ConfirmSpec 建议含 `id, ownerCommandId, message, defaultChoice, danger, keyboardProfile`。经典 CE profile 固定 `Enter=yes/Space=no/Esc=no/y/Y=yes/n/N=no`；可以默认**聚焦否**以防指针误操作，但 Enter 的 CE 映射不能随 DOM 焦点漂移。未来剧情 profile 才让 Enter 激活可配置默认项，选择按钮需可见并有明确 i18n 提示。

支持最多一条当前命令、一张活跃确认；多问题按实际请求次序呈现。重复回答、双击、repeat keydown、来自触发命令的晚到 pointerup 都只能影响一个问题。下一题需新的按键/指针生命周期，不靠同一 Enter repeat 连续批准。

### 4.4 闪现直连钩子的单独处理

不能保证把 `Game.ts:4369` 改成 requestConfirm 后仍直接读取旧 decisions：旧 `confirm_target` 没有写这一答案。也不能声称“取消录像今天完全正确”：代码表明旧取消和批准均可能是 `confirm_target, decisions=[]`，按 playing 绕过风险时会丢掉取消；本步未另造此场景验证。

建议先保留旧事件的解释路径，并为**新发生的熔岩闪现问题**新增一个有语义区分的 command action（建议 `arcana:risk-confirm`，data 仍为现有 null/string 类型），其一个布尔答案走标准 decisions。初次 `confirm_target` 仍通过 executeCommand 进入引擎，P0 恰好一次；走到实际风险点时，引擎为当前 CommandExecution 设置新的最终记录 action 并保存继续阶段，不能由 Vue 复制风险判断。此时不先记录 confirm_target；Host 回答只恢复同一命令，最后以有标识的 action 记录一次，不重新 executeCommand 再跑 P0。无风险的 confirm_target 不变。新 action 的回放 handler 经相同前缀与闪现继续阶段消费答案，拒绝分支仅清选择，批准才施法/扣充能/耗时。

- `Game.ts:2859-2883` 允许 string action、现有 data 与 boolean decisions；不改录像/存档 schema，不新增快照字段。不需要旧存档迁移。
- 新 action 的回放/单步/seek 均消费一个 recorded decision，无 Host；缺失/多余决策维持严格 OOS 检查。
- 旧 action 继续原本的确定性旧解释，且不再调用真实 UI。能正确回放的旧批准事件/普通黄金 trace 保持；**旧取消事件缺失信息不能可靠恢复**，不按下一检查点倒推答案、不补造 decisions。原先 OOS 的旧取消记录仍按不支持正确重现的旧缺口报告，不自动迁移。
- 旧 action 的 loaded/seek 风险检查与 playing 差异，需要专门的历史事件兼容夹具；只移除真人询问，不能笼统对所有 confirm_target 追加默认 true 决策，也不能改变普通/已知致死检查的解释。若维护者不接受新增 action 的协议语义变化，应把此点单列阻塞实施单元并设计新版录像协议，不能继续留 window.confirm 后称替换完成。

这是命令协议语义的显式扩展，老构建不承诺识别新 action；虽然 version 和结构不变，**按全量门禁验收**。只要求新构建的黄金 trace不变，不声称新风险确认事件字节与旧缺失答案事件相同。

### 4.5 ext/foundation 的受控动作

扩展 `Game.ts:3337-3404` 的 validateControlledAction/executeControlledAction 已有纯资格检查与 beforeCommit/afterResolve；普通近战 `3706-3716`、鞭 `7767-7772` 在问题后复查目标才 commit。技能扣 focus、写冷却、创建 actionId/应用效果在 `growth/module.ts:385-394` 的 beforeCommit 里；否答案目前不进入它们。**不要把扣费搬到弹窗打开时**。

这里不能直接让 runtime.ports.executeAction 返回 Promise：`ext/runtime.ts:143-171` 要求同步 commandModule/commandScope，finally 清 controlledAction/actionResolutions；Game `3403` 要求已 commit 的动作同步 close。模块 context 不可跨 UI 等待存活。

单独处理：把 growth 现有 `planSkillCommand`（`module.ts:314-328`）的只读部分经引擎拥有的 preparation 端口输出**纯数据计划**：原 ext:command payload、受控 primitive、actor/target ID、revision、确认风险事实。在进入 Runtime.command 的可写 scope **之前**完成 DialogService 等待；此时 outer command 的归一化仅一次，模块尚未调用 handler/commit/context.executeAction。收集的答案保存在 `suppliedAnswers`，与最终录像 `decisions` 分开。恢复后重新验证 revision/世界目标，进入原同步 Runtime.command 恰好一次，原 requestConfirm 逐题验证问题顺序、消费 suppliedAnswers 并向本条外层命令 decisions 记录一次；不能预检记录一次、正式执行又追加一次。beforeCommit/afterResolve 仍在原作用域完整闭合。否也执行原同步拒绝路径，不扣费、不应用效果，不另造技能取消协议。

这个适配复用经典攻击/移动的**同一个风险谓词/命中列表只读准备**，不能由 Vue 根据技能名称猜要不要确认；对 attack/移动的每一个 Q5–Q10 逐项覆测。控制 primitive 禁止混乱替换/救俘的现有限制不变（扩展 `Game.ts:3351-3368`）。准备接口不得调用 module command 后依靠 rollback“当作预检”；`planSkillCommand` 当前是模块内部函数，提取纯接口本身是独立实施工作，不是今天已有可调用 API。其它未来模块若在确认前已经产生不可回滚写入，不允许自动套用此适配，必须提供同样的纯准备合同或专门续体。

## 5. MORE 与多回合呈现

### 5.1 推荐显示事件序列

选任务书允许的“**后续推进演示排在确认之后**”方式。模拟继续按现在的规则同步/分步完成，显示层保存只读 DisplayFrame 和有序事件，在 ACK 边界停住显示游标。确认后演示剩余帧。只在 `tickAdvancement` 外层检查 pending ACK 不能覆盖同步麻痹、自动步、嵌套自动进食、普通动作内的多消息，因此不作为最终方案。

拟用 `PresentationTimeline`（UI/session WeakMap）收集：`frame / message / acknowledgment / animation-delay / terminal / command-complete`。每条消息有**发生序号**，不能用归档 id；frame DTO 为复制过的已观察地图/位置/HP/状态、日志显示窗口、必要 HUD/效果数据，不含可写实体、未知地图/怪物资料或 Game 快照。优先差量 frame、共享不可变底图，不逐帧复制全局/全部楼层。

插入观察点：Logger 的现有 log 发生处（归档完成后但后续业务效果之前）、原动画 yield 点、强制麻痹每轮原 epilogue、命令结束与终局。例如护甲自焚 ACK 在 spawn DF 前，压力板 ACK 在 triggerCreatureTrapLayers 前，强制进食 ACK 在 consumeFood 前；在这些点只记录当前**可显示事实**，不移动原效果。复杂源一个同步调用栈内会产生多个事件，等返回浏览器后依次播放。Logger combat flush/折叠次序维持，不改产生源以减少队列。

必须做到：

- 不能把最终世界直接当作 ACK 时的画面，否则还是旧警报罩着死亡地图；也不能只冻结 Pixi 而 HUD/日志/目标条从 activeGame 提前显示未来。这些组件使用同一个 display projection/显示游标；诊断状态同时区分 simulationTurn/displayTurn。
- capture **不调用** toSnapshot/getState（会 flush combat）、updateVision/prepareFlareKnowledge（会提交发现）或规则 RNG；不可将序列帧 loadSnapshot 回引擎。只读投影读取当前观察事实，必要纯外观计算使用显示专属随机 owner（现有 `GameCanvas.vue:435-440`），不碰 `rng` 的两条存档流。
- 观察回调应无业务异常/游戏写入，不能令 UI 故障进入 Game.executeCommand catch 或改变 recordingFromNewGame。无 Host 的 headless 关闭捕获，正常同步规则路径维持；浏览器不开动画也捕获 ACK 边界。
- 扩展事务期间的观察结果先保存在同一事务的暂存序列，成功提交才发布，回滚丢弃；timeline 的游标/事件长度要加入原显示 checkpoint 恢复合同。扩展 `Game.ts:1196-1202,1422` 会以 `Logger.checkpoint:94-112` 回滚生成钩子的消息，不能让新 observer 将这些消息提前暴露到不可撤回的 Host。不得为观察调用 Logger.getState；补测 `ext_generation_checkpoint_differential.test.ts` 的日志/显示回滚与新序列一致。
- 命令最终检查点仍基于模拟最终状态，不基于显示游标；确认 MORE 不追加 decisions、命令或 RNG。显示 backlog 期间 admission 拒绝下一条实时命令，自动步计时器不积攒恢复后爆发的 elapsedMs。
- 只要显示在等待 ACK，整张对话层始终可交互。输入锁不用于 MORE；5秒动画 deadline 不计用户阅读时间。推荐完全不暂停引擎迭代器，只暂停显示游标；若初步实现真的停了迭代器，则必须先把人工等待从 deadline 分离，不能超时 return 丢怪物剩余行动（`Game.ts:8768-8777`）。
- 长序列可将非 ACK 动画帧合并；不能丢 ACK 或重排日志。内存压力下暂停显示捕获详细动画、保留消息顺序/终局入口，记录诊断；不得改变模拟或自动清未读警报假装用户确认。

### 5.2 各种运行方式

| 方式 | 拟呈现行为 | 不变合同 |
|---|---|---|
| live，animationEnabled=true | 保留原25ms慢回合演示点；多回合强制推进的 frame 在 ACK 后按显示序列展示，不再一帧跳到死亡；没有 ACK 的常规动作仍不逐怪物插帧 | 速度、客观块、恶心/战斗/状态 RNG、命令最终检查点相同 |
| live，animationEnabled=false | 非必要动画零延迟，但 ACK 显示点仍停游标，确认后到下一 ACK/终局 | 开关只控制演示，不取消 MORE，不改变模拟 |
| 自动探索/旅行/长休息/奔跑/连搜 | 当前命令完成后显示其 ACK/后续事件；新 auto_step 在 backlog 清完之前停。确认点停止路线遵守 Q 的 P2；ACK 的 disturbed 原值不由 UI重写 | 不制造额外 auto_step，不通过 logger.log 显示 UI反馈再打断一次自动行动 |
| 回放播放/单步 | 默认符合 CE `IO.c:2917`：不等人、不打开确认或 MORE 模态。可以短暂展示非阻塞消息和原动画；单步在本条最终检查点完成后更新 cursor | decisions 自动消费，旧事件个数/检查点/OOS语义不变 |
| 回放 seek/restart/导入 | silent seek 关闭捕获/跳过显示事件，清上一局队列与 token，在目标边界同步完成，不积压3744条警报。restart/load 重置 epoch | `Game.ts:3019-3040` 同步 seek 与 animationEnabled 恢复保持 |
| 可选诊断回放呈现 | 独立、默认关闭的 presentation-only 开关可使回放在 MORE 显示点手动停；模拟/seek不受它影响，正常导入不继承该开关 | 用于 §7 的稳定重现，不把 replayRecording=false 伪造为 live，不能修改事件来驱动演示 |

保存/导出：模拟完成且命令已提交的显示 backlog 可以直接保存/导出 final checkpoint，清楚说明处于“显示未看完”状态；待**规则确认**的命令未完成则等待，二者不能共用一个盲目的 isAdvancing 标志。读档不恢复 UI等待，必选鉴定/附魔等既有规则 pending 状态仍按原存档合同恢复。

### 5.3 死亡/结算不被确认队列困住

默认按时间序列显示警报→后续攻击→terminal，保留 UX-1 逐条消息顺序。只要模拟已终局，Host 必须提供可点击/触摸的 **“查看结算”** 入口，不要求先清完 ACK；它与当前 MORE 内容同时可见，不被 backdrop、isAdvancing、按钮焦点禁用。

选择查看结算：停止剩余演示，移交最高输入所有权给结算；未读消息按原序放在结算内可浏览的非模态消息区（标记未读），原 Logger归档不删/不改 count。保存/导出/返回标题立即可用；返回标题的 lifecycle 清该局显示队列，不能带到新局。没有点击跳过时按默认顺序继续，最终 terminal 到达后解除模态；terminal 之后的源日志如延迟 flush 的战斗行归入结算日志，不能再挡住返回按钮。

这使“保留消息顺序”与“可立即访问结算”同时成立。不是单纯把结果 z-index 提到10001，也不是死亡时静默丢队列。原 `ux_1a_end_ui.test.ts:75-87` 的**默认顺序**断言可保留；新增“未清队列仍能显式查看结算”的用例。若维护者希望死亡后一律立即显示结算，则这是额外产品语义裁决，要明列旧 UX-1 用例冲突，不包装成夹具前提修订。

## 6. 统一 Host 与输入服务

建议文件：`src/ui/dialogService.ts`、`src/ui/dialogInput.ts`、`src/ui/presentationTimeline.ts`、`src/components/DialogHost.vue`，按需增加只读 projection 模块。Host 常驻 App，Teleport 到 body，沿用刻符颜色/字体/边框，适配桌面/手机竖横屏、safe-area、dvh、长文本滚动，按钮至少44px；不加主题切换或无障碍专项。

Dialog 的最小类型：

| 类型 | 数据与解决方式 | 对引擎的影响 |
|---|---|---|
| confirm | ConfirmSpec + yes/no；可配焦点默认项、危险样式、键盘 profile | 对当前命令追加一个 boolean，或通过已有 item 分段适配 |
| acknowledgment | 发生序号、文本、队列位置；more | 只推进显示游标，永不录命令 |
| choice / text / dialogue（预留） | 文案、选项稳定 ID、可否取消、owner/session；未知类型不自动通过 | 真正影响规则的选择必须有引擎命令/decision合同后才接入，不让故事回调直接改世界 |

队列按发生顺序；当 command 已有在先 ACK 显示事件、又要问 confirm 时，先呈现 ACK 再给 confirm，owner 命令保持待决。取消上一局/卸载只处理该 epoch 的未解请求。DialogService 是会话对象，不能导出任意全局 resolve(id) 给业务代码绕过 token 校验。

输入设计：

1. 统一最高 capture 仲裁在 InputManager 文本输入判断之前生效；只对**当前 Host**激活，之后才让 ModalKeyboard 按原优先级工作。旧 `messageAcknowledgment.ts` 与 Reference capture 逐步注册到同一个仲裁，避免监听注册顺序决定谁吃键。其它层默认优先级/弱检视行为保持，Dialog 不活跃时不抢键。
2. 模态打开同步 cancelHeldInputs、取消当前地图鼠标拖动/晚到点击，记录当时已按下 key code/指针 ID。触发问题的旧方向键 repeat 不成为 yes/no/MORE；关闭后直到释放仍吞掉其 repeat/keyup，新的按下才交还游戏。不能把 heldInput 的指针取消当成已覆盖物理键盘。
3. 经典确认采用 §4.3 CE profile，其它键吞掉；MORE 只接受新空格/Esc 或**在 Host 内重新按下并释放**的指针（可点 MORE 按钮/消息区），其它键提示按空格/点击，不移动、不通过。背景点击不批准危险确认；Esc/空格明确定义为否，不靠默认 button click。
4. 单次解决按 token/idempotent 实现；键盘空格的 DOM click、touch 合成 click、double click 不重复解决下一题；nextTick 焦点切换不使同一输入连续确认。Host 外 pointerup/lostpointercapture 与未起于 Host 的 pointerup 被丢弃。
5. mouse、touch、键盘走同一 resolve，再由引擎恢复。过渡、角色页、背包 closeDeferred、目标条、沉浸快捷键、菜单快捷键、代理 action 都读取统一 busy/admission。绘制/动画锁不能禁用 DialogInput。
6. 普通 menu/展示文本仍允许原生文本输入/按钮/Tab；当前经典 confirm 的 Enter由 profile 接管，不能由聚焦否按钮覆盖其 CE语义。Host解决后恢复仍存在的来源节点焦点，不重启 hold；来源已销毁则回游戏。

自动化可读 contract：Host `data-dialog-kind/id/owner`，按钮 `data-dialog-action=yes/no/more/view-result`；显示状态只读提供 `dialogKind, pendingCommand, queueLength, displayTurn, simulationTurn, presentationCursor, terminalAvailable`。可复用 `render_game_to_text`（`GameCanvas.vue:673-676` 已输出 acknowledgment）并增加 display/simulation 区分，隐藏世界信息仍用观察投影。不得依赖浏览器原生 dialog API/弹框辅助窗口。

所有新可见标题/按钮/等待/无效答案/查看结算/未读提示走 i18n；已有风险问题复用原键。UI反馈不用 Logger.log，避免新增 disturbed/日志/黄金trace变化。

## 7. 测试、浏览器验收与分步实施

### 7.1 自动化清单（未来实施，非本步执行）

| 范围 | 必须证明 |
|---|---|
| Dialog 组件/服务 | 各类型、危险样式、焦点默认项与经典Enter例外、中文长文/滚动；FIFO，重复文本也保留发生次数；双击/双resolve/卸载/epoch失效；dom选择器稳定 |
| 输入 | y/Y/n/N/Enter/Space/Esc，repeat/keyup/旧pointerup/触摸合成click；开层前仍按住方向键、拒绝后不再弹、不自动移动；MORE期间任意推进状态可点击；与背包/Reference/菜单/详情/角色页/创建2500过渡交叉 |
| Q1–Q10 | 每点 true/false，用真实 executeCommand/executeItemCommand；库存/钥匙/充能/HP/营养/位置/时钟严格比较，列出 P0–P3 差异。普通无待采样闪光夹具从输入前到拒绝后双RNG不变；另设未采样闪光夹具，与旧同步路径核对 P0 的 cosmetic 消耗完全相同，待答案至拒绝后双RNG不变。false无业务effect，true只执行一次；点后掷骰次数锁定 |
| 多问题/路线 | 酸→盟友 `[true,false]`；渊/火/气/板连续回答；鞭/矛/斧完整命中列表；auto_step选next后路线已停但只恢复原步骤；混乱确认方向骰一次、否零次；确定死/墙角/bump/抓取路径不额外提问 |
| 异步生命周期 | pending时菜单/保存/导出/新局/载入、来源组件关闭、意外目标失效；不把部分命令当完整录像，不用timeout批准；headless仍同步，无Host不等人 |
| ACK/投影 | 所有21源、相同id重复归档、102次确认与count封顶100；序列消息/地图/HUD/HP不提前到未来；不同等候时间/帧率/动画开关的最终完整世界和双RNG相同；observe不flush combat/不提交发现/不写Game |
| 麻痹/死亡 | synthetic短场景+§8录像；不能只断言pending文字存在。需证明等待后displayTurn不前进、点击后显示游标继续，查看结算无需清队列、日志不丢、保存/返回可用 |
| 录像/存档 | U27、x2a/x3b、UR2/UR3/UR4、U03、存档续录；每种普通false/true决策重放无Host零OOS。seek/loaded单步/playing结果一致，不积ACK。新闪现action与旧成功历史事件分开；缺/多答案仍OOS |
| 扩展 | ext_controlled_action_bridge、ext_growth_skill_integration、ext_growth_modal_advancement、ext_growth_target_knowledge、ext_growth_classic_isolation、classic neutral differential、creation UI、identity adversarial；取消 focus/冷却/actionId/effects/时间均不变，双RNG遵守同样 P0 例外；beforeCommit/afterResolve恰好一次，答案仅记录一次，revision变更拒绝旧计划 |

旧用例处理先列出，不在本步改：

- `ui_1_rendering.test.ts:407-440`、`dpad_hold_input.test.ts`、`map_touch_input.test.ts` 的原生 confirm stub/接线用例要转为可控回答服务前提，保留“问题原样、两分支、自动取消持有、生产真的接线、回放不问”的断言语义，不删除/skip。同步window返回值这一接口若被替换，属于显式实施接口变更，不声称只是时间点修正。
- `x3_u6_messages.test.ts:85-95` 的 key fixture 当前是 ArrowRight。新 CE profile 下它不会清消息；可在**单变量反事实**证明旧实现通过、仅本轮新实现使其失败后，将该前提改为 Space，保留单次消费/repeat/keyup/不泄漏下一命令所有断言；另加 ArrowRight 不通过的 CE用例。不得放宽repeat断言或把所有键都继续通过。
- `ux_1a_end_ui.test.ts:75-87` 默认警报顺序继续保留；额外覆盖显式查看结果/terminal后不再模态。源码守卫红了改实现，不扩白名单规避。

### 7.2 浏览器自动化步骤

实施时使用实际开发构建，四视口（桌面、平板、手机竖屏、手机横屏），沉浸开/关；真实触摸若工具不具备则如实记录覆盖限制。截图/大日志不入库。

1. **取消不收费**：固定种子新局，在没有待采样闪光的稳定边界记录只读 command checkpoint（库存/充能、focus/cooldown、position/tick/turn、双RNG、事件数）；通过背包吃饱食物打开确认。等待 DOM `data-dialog-kind=confirm`，点击 no；再逐项比较。pending时事件数不增；回答后一个拒绝事件、decisions=[false]，营养/食物/时间/双RNG不变；P0显示归一化不作零写入断言。分别用Esc/n/Space及触摸重复，批准分支费用一次。贵重投掷、救俘、酸性/纷争攻击、危险步分别重复其特殊效果比较。未采样闪光例外另用 §7.1 的引擎夹具核对原前缀，不能用它否定普通场景的零RNG验收。
2. **heldInput**：DPad/物理方向键按住触发危险确认；继续等待超过350ms+数个140ms，只有一张问题；no后未释放前不移动/不再弹；释放再按可新触发。对旧指针释放、double click、同一Enter repeat加同样检查。
3. **扩展收费**：配置可用技能，攻击酸性/纷争目标及走危险格；确认打开时看角色focus/cooldown/actionId尚未改变；no后字段完全相同；是时一次beforeCommit、一次费用和原效果。期间尝试打开角色/切身份/保存和连续点击技能均不能越过pending。
4. **录像正常模式**：用菜单文件导入 §8 文件，数字seek到3743（已执行前3743条，下一条索引3743），播放或单步；不弹Host，完成3744/3744、turn3378、HP0、score1820、无OOS。seek到3741/3742/3743区分压力板和死亡命令，不能把它们当同一command。
5. **录像显示诊断模式**：开 §5.2 的只读诊断呈现，seek3741后单步见压力板ACK，确认后显示气体；推进至3743前缀，再单步最终move，见麻痹ACK。断言显示位置/HP仍为该帧（初次35），等待>5秒也不丢序列；点击more后依次见后续HP/麻痹警报，最终结算。随时点view-result，结算导出/返回立即可用，未读消息在结果区，事件数据/RNG与步骤4一致。
6. **真实live短场景**：用引擎测试夹具提供压力板→气体→麻痹→攻击，通过正式输入进入（不由测试直接设置isAdvancing假装覆盖）；分别动画开/关、自动步模式验证同样的DOM交互与最终世界。诊断回放是呈现重现，不能冒充新局3744条真人操作或物理手机验收。
7. 监听自动化框架的原生dialog事件：应为0；检查控制台错误、dialog重入、隐藏标签页恢复、导入/返回后队列串局，以及读写存档的最终边界。资料入本地证据目录，报告写路径/计数/哈希。

### 7.3 main / 扩展影响和合并顺序

共同冲突热点：`App.vue` 挂载/接线与runEpoch、`Game.ts` execute/apply/record/confirm/auto作用域、`GameCanvas.vue` frame循环/输入/context、Logger、Inventory closeDeferred、Input/modalKeyboard、i18n与测试登记。扩展已大幅改 Game/TimeCoordinator/Logger/App，不能整文件覆盖。

建议先在main对应独立分支完成共享Host/经典续体/显示序列；同一方案在ext分支接只读受控计划与角色/创建输入适配，再审查三方合并。最终功能不能只在main上测试后声称ext也通过。ext/foundation当前`0f0dfc1`是本地参照，实施/合并前重读实际两端SHA和冲突，不假定远端未变；本步不fetch/merge。

| 步骤 | 范围与交付 | `development.md` §4 门禁 |
|---|---|---|
| D0 本步 | 本文盘点、推荐方案、证据矛盾及测试清单；维护者审设计 | 文档检查；不跑生产测试、不提交 |
| D1 统一显示/输入壳 | DialogService/Host、CE键位、token/epoch、heldInput、防穿透、可自动化DOM；接既有ACK/恶意品显示，不先假装异步confirm完成 | 轻档：类型/build/相关组件与输入测试/所有读源码守卫；若更动Logger语义或engine输入则升中档 |
| D2 经典确认续体 | Q1–Q10、全部正式输入出口/自动步骤、记录提交与保存待决边界，移除这些window.confirm依赖；保留旧普通decisions | 中档：轻档+相关规则调用回归、UR2/3/4、u_27/x2a/x3b、U03、drift；不改规则条件/RNG/格式。若检查揭示规则变化，拆局部规则任务 |
| D3 共享呈现序列 | 只读observer/projection、21 ACK源、强制回合/动画/日志序列、结算直达；seek静默，最终模拟完全不变 | 中档；同样trace/录像/U03/drift，另实证§8与live；任何推进结果差异退回修代码，不重录 |
| D4 闪现例外 | 新风险确认action/decisions、旧事件解释、取消分支和回放loaded差异，清最后直连原生钩子 | **全量档**：先ce:fetch（实施阶段）、类型/build/test:full/强制CE test:gen/drift，协议语义变化单列报告；本文不执行fetch |
| D5 扩展适配 | 1d纯受控准备、原同步runtime作用域/费用、角色/身份创建/过渡优先级、扩展事务队列生命周期 | 中档+扩展相关测试及classic differential；若改变扩展存档/事件格式则全量。不能让共享更新静默丢extensions检查点 |
| D6 两端整合验收 | 小提交三方合并、冲突审查、main经典与ext扩展浏览器矩阵，最终SHA与源码散列一致 | 扩展合并进main按**全量档**；发布/commit/push另待用户授权，不由本文授权 |

D2 与 D3 都完成后才能声称“本次交互问题已修好”；D4 清最后原生点后才能声称“原生confirm全部替换”。D1阶段仍可能出现原生框/同步麻痹观感，阶段报告须明确。每步新测试登记 `scripts/test-suites.json`；守卫、黄金trace、生成基线原文件不作为方便实施的可改范围。

## 8. 本步录像核对与设计裁决记录

### 8.1 文件事实和只读探针

本地原始证据：`.tmp-evidence/brogue-web-replay-1791020631948.json`，1,514,753 bytes；SHA-256 `867c2e41d862051a82eacab56e7a8af7fcaf6d7902eb47f45514544cc3ab3f82`。不复制入文档/仓库，不重录。

JSON读出：version2，seed字符串`438319328`，mode normal，3744个events，最后索引3743，action move/data0、decisions=[]、depth7，tick335300，turn**3378**，位置(68,22)，end失利、score1820。倒数第二事件索引3742：turn3371、tick335200、位置(68,23)。

本步用 `node --input-type=module` 内联只读探针，Vite `ssrLoadModule` 加载现有 `src/test/harness.ts`/Logger，调用 `createHeadlessGame→loadReplay→replayStep(true)`；只在内存临时包装Logger.log收集位置/HP/turn/ACK并恢复，未新增/修改测试或生产脚本。第一遍animationEnabled=false全量重放；第二遍同样重放前3743条，再开animationEnabled=true，执行最后条并以25ms tick耗尽。未绕过检查点或手改事件。Vite在尝试监听24678时报告本机EPERM，但两次SSR探针都继续正常完成、退出0；没有浏览器UI或服务器验收。

| 观察 | 结果 |
|---|---|
| 最终命令之前 | cursor3743，turn3371，HP35，位置(68,23)，replayError=null |
| 无动画最终命令之后 | cursor3744，turn3378，HP0，位置(68,22)，gameOver=true，score1820，replayError=null |
| 开动画提交最后条 | cursor仍3743、turn3371、HP35、isAdvancing=true |
| 开动画推进 | **1次**tickAdvancement(25)后就完成3744/3744，turn3378，HP0，score1820，无OOS |
| 压力板与气体所在命令 | 索引3741（第3742条），turn3370：“a pressure plate clicks underneath Goblin conjurer!” ACK，随后普通“paralytic gas sprays upward from hidden vents in the floor!” |
| 最后命令的ACK | 索引3743（第3744条）：turn3372/3373/3374/3375/3376/3377，各一次“You are paralyzed!”（共6次） |
| 最后命令的HP与结局 | 对应日志时HP35→29→23→17→11→5；日志turn3377时归零/死亡，最终检查点turn3378。消息包装观察到麻痹值20；没有把任务书19当本探针数据 |

### 8.2 与任务书出入及裁决建议

任务书背景称“同一move从3371到3383；压力板、气体、麻痹依次都在该命令内”。本地文件与**两种动画模式的当前main探针**均是3371→3378；压力板/气体在更早的索引3741，最终命令从已扩散的气体中获得/刷新麻痹。不能把任务书描述重复当成本步证据，也不能为了3383去修改录像或规则。设计验收以文件哈希、事件索引和最终3378检查点为准；原先3383的运行条件本步没有材料证明。

重复6次ACK是当前源行为：`Game.ts:9635-9639` 以applyStatus成功为门槛；CE `Time.c:475-490` 在无原麻痹时提示。它会放大清队列负担。本设计保留日志/RNG/模拟原结果，只解决队列呈现；若要修正重复警报的规则触发，应另行任务、反事实/门禁，不能偷偷去重Logger归档或改golden。

MORE键位、闪现直连决策缺口、跳渊条件、投掷确认分段分别在§1/§2/§4明列；其中键位属于本次呈现修正，闪现为独立协议单元，其余不顺手修规则。本步未跑npm test/build/drift：没有代码/测试改动，SSR重放是调查证据，不称为未来实现门禁通过。

维护者确认的对象是本文完整方案，尤其是：显式续体而非全命令回滚重跑；显示序列而非改变麻痹模拟；保留默认顺序并提供结算直达；闪现新增有标识风险命令的兼容界限。确认后另写各步骤任务书与可改文件清单，再实施。

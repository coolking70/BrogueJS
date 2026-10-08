# 5G UI 增量独立审查

本轮不能整体签收。UI-G2 的共享可食资格、按钮/e/a、确认/录制/延期关闭与回放只读代码核验通过；实际 foraging 焦炭按已批准定义出现 Eat 正确。发现三项 P2：新增 CSS 未排除回放、库存丢失物品的观察名称（继承缺陷）、轻档读源码守卫证据未完成。未发现可证实的 P1。UI-G1/UI-G2 的实际浏览器发现仍由指挥用当次构建复验关闭，本报告不代替浏览器结论。

## 输入及冻结核验

基线标识为 `8af6ef55342ac30bb68b3b4035ce0743b0939d02`。仅审本目录固定 input、manifest、incremental.diff、原浏览器发现及 browser-fix-evidence；期间收到并完整读了 executor-report.md，其开头指挥裁决撤回“实际焦炭无 Eat”的错误前提。没有读取移动 maintenance-tree 生产代码或 dist，没有修改产品，没有 git 写操作、提交、推送、代理或浏览器操作。

2656 个文件逐 SHA 全部匹配，input 无额外文件。manifest 的 `sha256` 是排序紧凑 JSON 文件哈希表的 SHA，并非执行报告采用的 NUL/LF 聚合；两种算法均独立验证：

- manifest 聚合：`73d0924d382578c566902b5fc57915a9bdebffeeac93f910de7cdd9d3e84c5ef`。
- 路径+NUL+SHA+LF 聚合：`7b2ac36c2322dad90e45db9923d0cdfb5e8e66a2f5780a5c00baf0ac4c1551ce`，与执行者 input-final 一致。
- manifest 文件 SHA：`9f6a33339b7311275b9e246bc9fa49d6a91c0530da6077cdf0dd4b9000ed9bb8`。
- 实际收到的 executor-report.md SHA：`2433a6fcdc10c99acc095072f03d99e601a24d3e118908bbf5f671b88284c47a`，包含指挥裁决前言，因此与原执行报告单独 SHA 不同。

相对执行者开工逐 SHA 表，仅 InventoryOverlay.vue、ForagingPanel.vue、dialog_host.test.ts 改动，另增 docs/ext/phase5g-load-clock.review-findings.md；无删除。incremental.diff 与原 InventoryOverlay 留存字节核对，只存在新增 import 和 isFood 一行变化。九冻结 SDK/stats/harness 文件与 frozen.json 相符；SDK 时钟四文件 Game.ts、runtime.ts、ext_edible_runtime.test.ts、ext_stats_runtime.test.ts 与 input-before 完全一致，具体 SHA 见 audit-before.json/audit-after.json。数据、locale、类别、协议、Game 字段、黄金 trace、既有 SFC harness 均未改。

前后 audit 相同。最初 audit 误用上轮 NUL/LF 算法去比 manifest 的 JSON 聚合而退出 1；逐文件无差异，确认算法后纠正本地审查脚本。未修改 manifest 或 input。为写审查辅助脚本曾额外读取上一轮 load-clock-review/audit.py；它不是生产代码，本报告的基线判断使用本轮固定 manifest 和获准的执行证据。另读浏览器 skill 但未应用或启动浏览器。

## R-UI01 / P2：新增地图布局规则仍作用于回放

位置：`input/src/ext/modules/foraging/ui/ForagingPanel.vue:111`。

新增规则实际编译为：

```css
@media(max-width:360px) {
  body:has(.foraging-panel:not(.presentation-hidden))
  .app-layout.layout-portrait:not(.immersive-mode) .map-zoom {
    display:grid; grid-template-columns:repeat(2,44px); gap:4px
  }
}
```

没有排除 `.is-replaying`。App.vue:426 在回放为布局添加该类，采食 UI 又明确允许回放打开只读面板：useForagingUi.ts:34–35 设置 readOnly/replay、157–158 提供回放入口，167–168 传递可见面板；useModuleUi.ts:12 的历史隐藏条件也不把回放面板变成 presentation-hidden。现有 foraging_ui.test.ts:163–168 验证回放面板可打开。

复现条件：320 普通竖屏回放，通过采食入口打开只读抽屉。`.app-layout.layout-portrait.is-replaying` 满足本条选择器，地图控件也从原竖排改成两列。这违背本任务的“replay 布局不受影响”范围；不声称它已经造成裁切或无法点击。真实几何仍须指挥核验。

独立 styles-probe 用原 Vue compiler-sfc 编译固定 SFC，保留原 global selector，输出 styles-probe.json；这只是实际 CSS 编译证据，不是浏览器命中/截图证据。建议原执行者为新增规则排除 `.is-replaying`，复验普通回放与普通游玩；若指挥有意允许回放也重排，应明确修订范围再签收。

其余限定可代码签认：≤360px、普通竖屏、存在非 presentation-hidden 的 foraging 面板才匹配；390/1440、沉浸、隐藏面板及面板缺席不触发新增规则。未改按钮 DOM、监听器、disabled、相机动作或共享主题。原 touch44px 仍由 theme-shells.css:22 决定，两列预期高度 92px；完整可见、中心命中、四控件实际点击与邻格无干涉尚未独立浏览器验证。

## R-UI02 / P2：库存响应式 Item 丢失观察名称（继承缺陷）

位置：`input/src/components/InventoryOverlay.vue:519`；身份形成于该文件:61，读取路径为 Item.ts:195–201、WorldItemPresentation.ts:8、17、20–21。

inventoryItems 是深响应式 ref，渲染中的 entry.item 是 Vue 代理。模板直接取 `entry.item.displayName`，getter 的 this 因而也是代理。WorldItemPresentation 使用原始 Item 的 WeakMap 键，无法找到代理身份，回退到世界定义的通用 nameKey。isFood 新增 toRaw 正确解决资格输入，performEat:366 的 toRaw 正确解决命令输入，但名称读取仍绕过原物品呈现。

独立真实 SFC 复现：使用安装的 foraging 定义，seed51020001，真实 assembleEdibleItem 组装 `foraging.mend`，按真实初始化方式加入生产 locale，打开库存并选中该 Item。kindKnowledge 为 unknown，原始 Item.displayName 是 **镜面菌**，库存行却是 **奇异的菌**；Vue.reactive(food).displayName 也等于奇异的菌。原定义真名 **愈合菌**没有出现在行中，未证实真名泄露。玩家因此不能从库存读到同一种菌在采食视图中的观察名称。

`independent-final.log` 的证据：

```json
{"definitionId":"foraging.mend","knowledge":"unknown","observed":"镜面菌","known":"愈合菌","rendered":"奇异的菌","proxyDisplayName":"奇异的菌","eatVisible":true}
```

此项是候选仍有的相关缺陷，**不是本次两行资格修改引入**。单变量反事实仅将 client SFC 的读取字节换成 browser-fix-evidence/original 下留存的旧 InventoryOverlay，保持文件定位、所有依赖、Game、定义、locale、renderer 和断言相同；结果同样失败，唯一输出差异为 eatVisible:false。旧字节已独立验证恰为候选去除本轮 import/isFood 修改。没有回退引擎或改 input。

建议原执行者在库存名称读取处使用原始 Item 的公开显示 getter，并补实际库存行名称断言；不要以“无真名泄露”放过观察名称丢失。修复后还应覆盖 known/tasted/称呼与 load 身份；这些延伸状态本轮未实测，不另报未证实缺陷。原新增 dialog_host:549–559 和604–614 只查按钮/纯读，没有查库存名称，因此未捕获此项。

审查过程中的首次中性 fixture 名称不符使我暂疑真名泄露；实际生产 pack 的 nameKey 是通用名，后续生产测试明确排除了愈合菌泄露，故撤回 P1 判断，按 P2 观察名称丢失记录。

## R-V01 / P2：轻档必需读源码守卫缺少本轮结果

位置：`input/docs/development.md:69、76`；交付清单为 `executor-report.md:81–90`、`../browser-fix-evidence/related.command.json`。

完整检查全部本轮 command.json/结果：最终相关命令只跑 dialog_host、x3_u5_ui、foraging_ui、sfc_harness 四文件，另有 boundary/type/build/diff-check。必要相关行为覆盖有效，但并没有运行文档明确要求的 c_4a_terrain_catalog 生产字段读者守卫、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、test_suite_membership 等。boundary 的“模块边界与归属通过”不能替代本地化键、模板文本、源码冲突/JSON 和其它生产读者守卫。

复核方式：对照上述文档具体用例与所有交付 argv/testResults，缺少对应 testResults。本发现是验收证据缺口，不声称守卫实际失败，也不要求重新跑849、大门禁或长普查。原执行者应补轻档读源码守卫；归入重型文件的仅选源码守卫用例，不运行其种子×层普查。审查任务明确限定独立小复测，本会话没有扩跑这些门禁来覆盖执行者缺口。

## 可签认的库存命令与测试

InventoryOverlay:225 使用 native FOOD 或 `edibleDefinition(activeGame,toRaw(item))`，该查询仅看当前 runtime 的公开 worldDefinitionPacks/edibleItems/id，不查询名称、效果、类别推断，不修改 kindKnowledge、RNG、logger、ID 或存档。runtime.ts:1680 返回安装定义；缺席模块的同 ID 材料不获资格。没有 foraging 特判或类别更改。

模板:533、键盘 e/a:463–475 共用 isFood，performEat:365–367 沿 executeItemCommand('eat',toRaw(item)) 与原关闭路径。原命令确认、ACK、MORE、presentation、延期 escape、录制边界均未改。对应实际 SFC 原26项和新12项本次独立全部通过。六组 pointer/e/a × No/Yes保留等待不录制、决策、真实数量及 tick、No RNG和关闭断言；本轮没有物理浏览器 pointer/touch。

独立追加四项通过：

1. 响应式行点击 eat 后实际 Game.executeItemCommand 获得 `===food` 的原始 Item，非 proxy；原确认正常。
2. 同一个挂载库存切换到无模块 activeGame，旧选择清除、外来同 ID 材料无 Eat/e/a 命令，保存/RNG/事件不变；切回旧 Game 重新选择后资格恢复。
3. load 替换 player/Item 后旧选择清除，字母重新选择恢复条目，a 命令收到 `===restored`，不是旧 food。
4. 安装生产 foraging 的实际 `foraging.char` 保持 MATERIAL 且有 Eat；普通未声明可食的同名 charcoal 无 Eat。

原回放测试对真正 replayRecording 下按钮与 e/a 尝试验证完整保存投影（仅归一 savedAt）、双 RNG、ID、事件数不变；原生 FOOD 与无扩展普通 MATERIAL/模块缺席拒绝也通过。资格读取没引入未知名称泄露，R-UI02 的呈现身份问题单独保留。

新 dialog_host 测试使用原 createSfcHarness 编译真实 client InventoryOverlay/DialogHost；只有 activeGame live binding 用可切换对象替代，不替代模板、edibleDefinition、真实 Game 或命令。Vue host renderer执行实际生命周期/handler，食用确认经 dialogInput 与实际 Host。中性 fgfixture 核心用例在条件语句外，optional installed production 仅控制一个额外例子；foraging 移除不导致中性11项消失。本轮未执行删除矩阵，不冒称实际删除验收。

执行者首次 red：原 SFC 的 raw/roasted MATERIAL 两项确实没有 Eat，exit1，两失败；35项为名字过滤未选，不能计作实际跑过。原 SFC 留存字节与本轮纯两行 diff 匹配，证明归因足够。第一次 green 的6失败仅新 oracle误写 item:execute/eat|e，实际原 Game 录制是 item:command/eat|e|；最终按未改生产命令格式修正恰当，未放宽六组结果。第二次 green 的1失败是将实际焦炭错误取自普通 items 表，undefined/maxStack在夹具组装处抛出，未进入 SFC；权威 edibleItems 与真实 char 独立复测佐证归因。最终移除这个错误前提的例子没有删中性负例、12项仍运行，焦炭定义由指挥前言正式澄清，不记产品缺陷。

## 独立命令及实际退出

全部 Node 实际绝对路径：
`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，验证 v24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`。run.py 显式 PATH；Vitest4.1.11 全部最多1 worker，顺序执行。Vite native config loader 与本目录 cacheDir 避免写共享 node_modules/.tmp/.vite-temp；没有缓存权限失败或伪装成功。

核心完整复测命令：

```sh
python3 run.py independent-final node_modules/vitest/vitest.mjs run \
  src/test/dialog_host.test.ts src/test/x3_u5_ui.test.ts src/test/sfc_harness.test.ts \
  --config ../review-vitest.config.mjs --configLoader native --maxWorkers=1 \
  --reporter=default --reporter=json \
  --outputFile.json=/private/tmp/brogue-commander-20261008-5g-revision/browser-review/independent-final.json
```

cwd由 launcher设为固定 input。独立配置只在内存给原 dialog_host 模块追加 independent-additions.ts；原38项和其它17项源码/断言不变。全部60项最终 **59pass/1fail/0skip/0todo，exit1**，唯一失败为真实观察名称断言，不报告整体全绿。

| 本会话标签 | exit | 结果 | wall秒 |
| --- | ---: | --- | ---: |
| independent-sfc | 1 | 59项：58通过，首次中性名称不符1失败 | 20.565 |
| independent-confirm | 1 | 60项：59通过，新增生产场景缺 locale 的前置断言1失败 | 21.400 |
| independent-final | 1 | 60项：59通过，真实镜面菌→奇异的菌1失败 | 21.566 |
| baseline-name | 1 | 旧 SFC 同一名称失败；42项过滤未选 | 2.862 |
| styles-probe | 0 | 原 scoped CSS 编译选择器，无回放排除 | 0.072 |

第二次独立失败确属审查场景缺生产 locale：worldText返回 ext.foraging.kind.mend.name，尚未进入名称UI断言。仅补真实生产locale，与src/i18n.ts相同资源，不改生产文件、不改变最终名称断言。历史 additions 版本分别保存，所有失败日志/JSON/命令保留。反事实命令为同一 Node/Vitest launcher、`-t 'preserves the actual installed unknown mushroom appearance'`、review-baseline.config.mjs，完整argv见baseline-name.command.json。

执行者四文件158pass/type/build/boundary属其历史证据，本会话只读取核对，未独立执行其158项或build。原测试默认CE缺源提示有保留，本次完整60项没有CE skip；未fetch。未跑849、完整npm/test:ext/drift/full/gen、browser、24格矩阵、长普查、删除矩阵、5D1或5Z。

## 交回范围

UI-G2“可食MATERIAL没有食用入口”的代码原因已修复且独立SFC覆盖通过；UI-G1普通320布局意图合理，但新增回放作用域应纠正或明确裁决。R-UI02继承名称缺陷与R-V01缺证据需交原执行者处理。指挥仍需当次24格、自然采集菌后的真实库存交互/NoYes/ACK/触摸/读档/回放，以及四个地图控件完整可见/命中/点击与邻格输入，不能拿本报告静态核验替代。未关闭浏览器发现或扩大为整个5G验收；审查结束停止，等待指挥。


---

## UI2 independent review 2026-10-08

# UI2 名称修复独立复审

固定 UI2 的 R-UI02 关闭；未发现新的 P1/P2。独立真实 SFC 小批 **73 项全部通过，0失败/skip/todo，exit0**，其中原失败的 seed51020001/mend unknown 库存行精确恢复“镜面菌”。R-V01 已补证关闭；R-UI01 按指挥明确修订范围撤回产品缺陷判断，保留真实浏览器验收要求。仅签认本步代码与已交定向证据，不关闭当次浏览器发现或整个5G验收。

## 固定输入与范围

本轮只读 input-v2/manifest-v2/incremental-v2、旧固定输入及原审查材料、executor-name-report、browser-review-decision 和报告引用的命令/结果证据。未读移动 maintenance-tree 生产文件或构建产物，没有产品编辑、git 写入、提交/推送、代理或浏览器操作。新增审查文件均在本 browser-review 下；原 input、manifest、probe、失败日志、反事实和报告未修改。

收到的 executor-name-report.md 是指挥 intake 摘要，完整执行文字实际读取的是 `../browser-name-fix-evidence/execution-report.md`。截至核验时尚无 executor-name-final-report.md；不把未收到的文件冒称已读。固定 input-v2 中旧 UI 报告元数据早于 UI2 报告追加，身份由 manifest-v2 和实际测试源清单决定。

2658 文件逐 SHA 匹配，前后相同：

- manifest-v2 排序紧凑 JSON 聚合：`c35a5c954612a5548dbb91b59cf8758d7ae79c7a85adf6a4a289f708278952b9`。
- 相对路径+NUL+SHA+LF 聚合：`222476f6ea1ddd01deef2d4302b87880204bd97934934c3114c71cfb3deb8653`。
- manifest-v2 文件 SHA：`4fee9fec6ca04ba78517662c6c369f6f6693170d1e0819299140719af13a2bc2`。

固定全部文件逐 SHA 与执行者 after-gates-source.json **完全相同**，所以188相关测试、41守卫的实际测试输入就是本轮审查快照。相对 UI1，两个已有文件变更：InventoryOverlay.vue、dialog_host.test.ts；另外两份文档进入快照，未删除任何文件。ForagingPanel.vue（先前三文件增量中的CSS）与 UI1 逐字相同；九冻结 SDK/stats/harness 和四个时钟文件与 UI1/原证据 SHA相同。无定义、locale、category、引擎规则、Game字段、版本、trace/黄金基线变化。原26项前缀、原G2十二项整个正文精确相同，只扩展 imports 和末尾追加11个名称用例。

audit-v2-before/after.json 记录全部核验，含旧 input 全部文件及旧根目录原 probe/log/report 的逐 SHA；after.sameBefore=true。v2-scope.json 另记录原38项范围、测试输入和报告/指挥裁决哈希。最终固定树没有测试生成的额外文件。

## R-UI02：关闭，原始 Item 名称/详情与刷新均正确

修复位置：InventoryOverlay.vue:204 的 getLocalizedName 接受 Item 后读取 `toRaw(item).displayName`；模板:516 传 Item，避免先在代理上取 getter。performInspect:309–311 同样把 Item 解包，再传公开详情生成器和上下文。

该改动恢复原 WeakMap 身份，仍使用现有公开知识/称呼/本地化 getter；没有 hardcode foraging/nameKey、直接挑真名、类别修改、伪造知识行或改呈现注册表。详情入口处理同一身份问题，属于必要关联修复；实际完整详情对象与原 Item 的 generateItemDetail/createItemDetailContext 相符。

原失败场景直接复用上一轮 **未修改** independent-additions.ts，通过新的 v2 配置在固定新树内存加载。实际输出：

```json
{"definitionId":"foraging.mend","knowledge":"unknown","observed":"镜面菌","known":"愈合菌","rendered":"镜面菌","proxyDisplayName":"奇异的菌","eatVisible":true}
```

实际原 Item 与库存行均为镜面菌，真名愈合菌仍隐藏。proxyDisplayName 仍为旧回退名，说明组件确实通过原身份读取，而不是改定义、改 Item getter 或掩盖反事实。没有重跑/改写旧 baseline-name；旧失败历史原样保留。

toRaw 本身不追踪原始知识状态，但组件保留原100ms轮询与dialogs订阅：updateInventoryState:60–61 对可见库存重新赋予新数组，触发 render，getter每次读取当前runtime/knowledge。这次没有只做挂载前布景后就宣称动态刷新通过：独立追加用例在 **同一已挂载真实 InventoryOverlay** 上执行公开 call/eat 命令，逐阶段等待原 settle/poll，精确核验：

| 实际状态变化 | 实际库存名称 |
| --- | --- |
| unknown | 镜面菌 ×3 |
| public call | 镜面菌（叫作：独立称呼） ×3 |
| 满血 public eat，无明显效果，tasted | 镜面菌（吃过，无明显效果）（叫作：独立称呼） ×2 |
| 受伤 public eat，known | 愈合菌 |
| 烤菌自身仍unknown，生菌已known | 烤愈合菌（烤后效果未知） |

原始app对象始终相同，没有remount来掩盖更新丢失。尝过/已知状态由真实消费建立；仅HP/nutrition为合法受控场景输入，不手写知识行。每阶段库存行精确等于当前原Item getter（含数量），实际详情按钮结果完整相符。读阶段前后完整存档投影（仅归一 savedAt）、双RNG、实体ID、logger和录制事件不变。命令/HP场景变化先完成，再重新捕获读基线，不将其冒充纯读。

同挂载保存/load 后原 Item 被新身份替换，名字仍愈合菌；独立第二例同挂载切换 activeGame 到普通 native FOOD，公开名称/详情更新正确，再切回 foraging 恢复镜面菌。上一轮四项独立身份/资格测试全部复用通过，包括新load身份作为a命令实参、activeGame无模块时外来同ID材料拒绝、raw Item命令身份、实际char有Eat及普通charcoal无Eat。

执行者新增11项本次也独立全部运行：unknown/called/tasted/tasted-called/known五状态各含save/load，烤制两状态、生产焦炭、neutral raw/roasted、普通native FOOD；实际详情与公开名称精确一致。故代表性动态刷新和全部交付状态覆盖均有证据。

## 保留的食用与只读覆盖

原 dialog_host38项、SFC harness10项、x3_u5_ui7项全部独立通过。包含pointer/e/a × No/Yes六组、原确认等待不录制、决策、数量和tick、No RNG、延期关闭、ACK/MORE/展示时序、纯读、原生FOOD、普通MATERIAL、缺模块和真实load/回放只读。v2没有改isFood/performEat/命令/confirm/ACK代码，原G2十二项正文逐字保持。

生产名称例子依安装能力注册，中性核心例子位于条件外，未引入已注册用例内return/skip。旧独立probe按任务原样复用（含当时的生产locale读取），只作为本目录审查适配；新动态用例按公开descriptor.locales读取资源。固定产品测试的模块边界最终通过，未改变守卫来豁免直接模块import。

## R-UI01：按修订范围撤回缺陷判断，浏览器尚待

已读 browser-review-decision.md：允许普通窄屏竖屏在实时和回放、可见采食抽屉下均使用两列44px地图按钮。原“单纯匹配replay”不再违反范围；本轮CSS与UI1逐SHA相同，不建议机械排除回放。本条原报告的事实（匹配回放）和未做几何验证的限制仍保留，无需抹去旧历史。

只读回放、hidden、沉浸及模块缺席边界未因UI2名称修复改变。parent仍须用当次UI2构建在320普通真实回放打开抽屉，核验四控件完整可见、命中/实际点击与地图邻格输入；代码签认不替代它。

## R-V01：关闭，UI1补证及UI2新模板守卫已核对

实际读取 browser-source-guards-evidence 的前轮 command/log/json：8文件41pass，101项是 -t 名称过滤未选。UI2模板修改后又执行同一批，browser-name-fix-evidence/source-guards.command/log/json：exit0、8文件41pass、0fail/todo、101未选。

逐文件实跑为 P1-30全部26、U24全部3、repo hygiene全部2、membership全部6；c_4a生产promote/fire/mechFlags读者白名单、b_1a免费识别方法守卫、w_7强制附魔选择/toRaw、ui_2保护括号各1。覆盖上一轮指出的具体缺口及库存相关源码读者；boundary-final另外保持模块/归属检查。不把101未选报告成全142项跑过，也不要求运行这些文件的重型普查。

UI2这批运行时的完整source manifest与固定input-v2相同；不能只引用UI1旧结果。执行者41项与188项是其门禁证据，我独立复测的73项单独计数，没有相加为唯一覆盖或冒称独立重跑188/41。

## 失败历史与执行者结果归因

完整执行报告及命令/结果已核对：

- names-initial exit1、8pass/3fail：新测试知识组错写foraging.fungi，公开定义为foraging.mushrooms；title查找undefined的前置断言失败。最终只纠正组ID，实际名称/状态断言保留，11项本次独立通过支持归因。
- boundary初次exit1：三个新测试直接import模块locale违反原所有权守卫。最终使用公开catalog descriptor.locales，没有改守卫，boundary-final exit0；此为修正新增测试资源入口，不是生产名称问题被掩盖。
- build初次exit1：错误npm-cli.js路径MODULE_NOT_FOUND，未启动构建；build-final由绝对Node执行/opt/homebrew/bin/npm run build，exit0。不能把初次失败消失成一次全绿。
- related-final exit0，6文件188pass/0skip/todo（dialog_host49、harness10、x3_u5_ui7、foraging_ui103、knowledge12、names7）；types-final/boundary-final/source-guards/build-final/diff-check均实际exit0。以上均只读取核对，未独立build或大门禁。

## 本会话准确独立命令与结果

绝对 Node：`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，实际 **v24.19.0**。run-v2.py 显式PATH和 `NODE_OPTIONS=--max-old-space-size=3072`，cwd为固定input-v2。

```sh
python3 run-v2.py v2-independent node_modules/vitest/vitest.mjs run \
  src/test/dialog_host.test.ts src/test/x3_u5_ui.test.ts src/test/sfc_harness.test.ts \
  --config ../review-v2.config.mjs --configLoader native --maxWorkers=1 \
  --reporter=default --reporter=json \
  --outputFile.json=/private/tmp/brogue-commander-20261008-5g-revision/browser-review/v2-independent.json
```

**exit0，wall33.393s，3文件73pass、0fail/pending/todo**。dialog_host56=固定49+旧独立5+新动态2，另harness10+x3_u5_ui7。唯一一批独立测试完整通过，没有过滤、重试或放宽断言。配置只内存追加本目录probe；Vite native loader及v2-vite-cache均在审查目录，无固定input或共享node_modules临时缓存写入，无权限失败。

audit-v2.py before/after 均exit0，旧输入/manifest/probe/报告及UI2输入逐SHA保持。没有跑浏览器、24格、849、build、drift、full/gen、CE fetch、模块删除矩阵、5D1、5Z或长普查。缺CE提示保留，所选73项没有CE skip。

辅助v2-scope元数据首次写入使用相对Path('.').parent误定位兄弟证据，读取时exit1、未写文件；改用绝对cwd后exit0。此失败不涉及产品或测试，原样记录，不计作测试重试。

本轮无新增需要修复的P1/P2；R-UI02与R-V01关闭，R-UI01按指挥修订处理。交parent继续当次新构建浏览器，审查工作完成停止。

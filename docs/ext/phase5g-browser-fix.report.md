# 5G UI-G1 / UI-G2 浏览器发现修复

## 交付与当前范围

UI-G2已接共享实际可食定义，可食MATERIAL现在有背包食用入口；按钮、e/a键都沿原executeItemCommand/确认/录像路径。UI-G1已加入采食面板可见、超窄普通竖屏下的两列地图控件CSS，保留全部按钮及44px尺寸。组件及构建门禁通过；本进程未启动浏览器，不据SFC渲染或CSS意图关闭真实浏览器发现，交parent实际复验。

任务书“焦炭不出现Eat”是指挥前提错误，现已撤回。指挥核对原已批准可食规格后裁决：候选沿共享可食资格显示焦炭Eat正确，任务前提冲突已关闭，无需用户重新确认。见下节及[指挥裁决](../../../charcoal-decision.md)。

开工HEAD bca0c5b5c06a2c01395ddb132f8b8bd0a14df8c0，分支codex/phase5g-maintainer，带上一轮4文件候选时钟修复及报告。期间指挥将SDK交付提交为 **8af6ef55342ac30bb68b3b4035ce0743b0939d02**；本进程没有提交/改git索引/切分支，记录见external-commander-commit.txt。四个SDK生产/测试文件、原load-clock报告及maintainer审查文档逐SHA保持开工字节。指挥新放入phase5g-load-clock.review-findings.md，只读纳入合并清单。

与SDK交付相比，仅三个已有文件修改，另新增本报告：

- src/components/InventoryOverlay.vue：导入共享edibleDefinition；原isFood判断改为native FOOD或实际安装可食定义，读取toRaw(item)。无foraging ID、名称/字形判断或类别改写。按钮/e/a仍共用该判断；performEat、确认、ACK、关闭/延期关闭及录像处理未改。
- src/ext/modules/foraging/ui/ForagingPanel.vue：仅新增max-width:360px规则，选中body中实际可见的foraging-panel，以及layout-portrait、非immersive的app-layout下map-zoom。display:grid、两列44px、gap4px。未修改MapZoomControls.vue、theme-shells或其它共享布局。
- src/test/dialog_host.test.ts：新增12项真实Game+client SFC回归；原26项断言及共享SFC harness保持。

没有改上一轮4文件、冻结SDK/stats/harness、数据/locale/golden/trace、物品category、引擎规则、版本或P5。没有新增Game字段、测试文件、发现清单、skip、timeout、依赖，也没有改浏览器QA工具。没有commit/push/代理。

## 原始实际浏览器证据与布局意图

已读../browser-review-findings.md、原5G包§7/9.2和当前共享UI，实看两个PNG与对应JSON，核对MapZoomControls和theme-shells样式冲突。

- UI-G1：browser-matrix-first/matrix-320x844-normal-original/0016-native-controls-reachable-harvest-after.{png,json}。map top209.5/bottom387.15625，高177.65625、overflow:hidden；map-zoom top217.5/bottom405.5，高188，裁18.34375px，图上定位按钮下半缺失。两列预期自身高92px，加top8px占100px；这是CSS意图，不冒称新浏览器实测。
- UI-G2：browser-critical-first/critical-1440x900-normal-original/0087-select-food-e-after.{png,json}。库存e菌×3为category13(MATERIAL)，所选行只有详情/命名/投掷/丢弃/重标，无食用；原isFood仅接受FOOD。引擎已有实际可食定义查询，因此接同一查询到UI。

新增布局规则只有foraging面板可见、≤360px、portrait且非immersive时触发；关闭/历史presentation-hidden、模块面板缺席、390/1440、沉浸均不触发这条新增规则。保留四个控件、原位置/命中逻辑、touch44px、主题和disabled状态。不藏按钮、缩小目标或扩改其它模块。低风险CSS未造源码镜像单测；parent需确认每个地图控件的可见交集、中心命中/点击、邻格输入和四种地图/普通沉浸矩阵。

## 焦炭任务前提勘误（已裁决关闭）

原src/ext/modules/foraging/data/definitions.json的foraging.char属于 **edibleItems**，satiety20、effect:none、tags[]；schema.ts:143–146严格校验该规格，原feed测试“char supplies 20 nutrition without creating mushroom knowledge”和companion测试验证真实消费，详见charcoal-spec.json。它不能当作普通非可食材料；effect:none也不能用作不可食判断，中立raw等合法食物同样可为none。

原引擎与edibleDefinition认可实际foraging焦炭。首次报告曾提出异步澄清；现已由../charcoal-decision.md的指挥裁决解决：phase5-foraging.md §3、§6、§9明确24个可食定义包含焦炭，饱腹20、无效果；§10“焦炭不算食材”仅针对营地合成材料，不等于不能食用。指挥撤回本地任务的“焦炭不出现Eat”，沿原已批准规则显示Eat正确，普通未声明edible的MATERIAL仍无Eat。这是任务前提勘误，不记产品缺陷，不需要用户重新确认，也不改data/locale/category或硬编码ID隐藏。测试中名为charcoal的普通MATERIAL负例不是实际foraging.char；独立审查将真实复核foraging.char资格，本报告不冒称新增实测。

## 红灯、回归与边界

仓库外证据根：/private/tmp/brogue-commander-20261008-5g-revision/browser-fix-evidence。

先用原生产代码运行最小回归：真实装载fgfixture模块、编译InventoryOverlay client SFC、Vue host renderer选择实际Item。生/烤均为MATERIAL，两项要求Eat的断言都失败，red-edible-sfc exit1、2failed。未mock可食查询/模板/资格判断，未用源码字符串镜像。

修后完整相关4文件 **158passed，0failed/skip/todo**：DialogHost38（26原+12新增）、SFC harness10、X3-U5真实命令组件7、foraging UI103。新增覆盖：

- 原fgfixture真实生/烤定义渲染Eat；10轮开关选中/轮询保持完整save投影（仅归一savedAt）、双RNG、实体ID和logger不变。
- pointer、e、a × No/Yes六组，真正弹原command确认。等待时未录制；回答后精确item:command、eat|letter|、decisions:[bool]。数量2→2或1，world clock仅Yes付100tick，No双RNG不动；确认结束后原延期关闭正常。
- 无扩展原生FOOD有Eat；普通无可食定义的MATERIAL无按钮，e/a不发命令、保存投影/RNG不动；未安装模块时外来definitionId材料也不获资格。
- 安装生产foraging时真实组装mend/mend-roasted，两种实际菌仍为MATERIAL而有Eat，UI读不改完整投影/双RNG/ID。这个生产联动只在安装能力存在时注册，通用fixture回归始终执行，不在已注册用例里return/skip。
- save/load后获取新Item身份，资格正确；真实录像回放中按钮/键盘尝试不改保存投影、双RNG、ID和事件数。原Host全部确认、ACK及presentation用例同批通过。

host renderer不宣称CSS几何、浏览器触摸或物理点击覆盖。新增测试的两次非生产错误保留：green-edible-sfc六个记录断言误把executeItemCommand的item:command写成item:execute（5pass/6fail），按原Game入口修正新oracle；green-edible-sfc-fixed新增实际焦炭布景误从items表取值，而规格在edibleItems，触发undefined/maxStack（11pass/1fail）。实际生/烤联动及其它原断言保留，焦炭前提当时公开澄清，现已由指挥裁决关闭。没有迎合错误去改类别、引擎或原测试守卫。

所有验证实际Node **24.19.0**，run.py子进程显式runtime PATH，NODE_OPTIONS=--max-old-space-size=3072；Vitest4.1.11最多2workers。只跑必要小批，不重跑849/完整npm/drift/5Z；parent的既有drift/SDK独立审查不算本轮通过数。

## 合并输入与新构建

input-before.json保存开工完整2655文件逐SHA，包含上一轮SDK交付。input-gates.json同2655文件的门禁聚合SHA：
d67cd0b23ddac777f65b02186330dd6fc7edfa5a3ba451596179e881142579a9

指挥新增SDK复审元数据后，input-final.json为 **2656文件**完整合并清单，SHA：
**7b2ac36c2322dad90e45db9923d0cdfb5e8e66a2f5780a5c00baf0ac4c1551ce**

原2655中仅三个UI/测试文件变更。算法为码点排序“相对路径+NUL+文件SHA256+LF”，排除本报告自引用。新增docs复审元数据没有改变构建/测试源文件。

新构建：/private/tmp/brogue-commander-20261008-5g-revision/maintenance-tree/dist。
**59文件**逐SHA见dist-final.json，使用dist相对路径按同算法聚合，最终dist SHA：
**9431d3a1a3239ea6b6558555297bba8e34a4e8dcd77d18426c60dc70f372c9fe**

index.html SHA：
edca953f6d325fdfa32e636c76119797441856aeddd9d4c0887fcf772ce0b08d

该构建包含已提交SDK时钟修复及本轮UI增量；parent应复制/服务这个dist并对照清单。原build-bca未触碰。npm run build完整exit0，保留原Vite大chunk提示。九冻结文件逐SHA保持，见frozen.json；SDK四文件和原交付/审查报告逐字保持。>1MB原始证据/构建产物未提交，无CRLF。

## 实际验证命令与后续浏览器复验

每个标签都有.command.json（完整argv/cwd/PATH/堆参数/exit/wall秒）和.log，Vitest另有JSON。选择过滤导致的未选用例不算新增skip。

| 标签 | exit | 结果 | wall秒 |
| --- | ---: | --- | ---: |
| red-edible-sfc | 1 | 原SFC2failed，未选35 | 3.534 |
| green-edible-sfc | 1 | 新增oracle5pass/6fail，未选26 | 10.514 |
| green-edible-sfc-fixed | 1 | 新增布景11pass/1fail，未选26 | 11.266 |
| related | 0 | 4文件158pass，0skip/todo | 16.770 |
| boundary | 0 | 边界通过 | 2.464 |
| types | 0 | vue-tsc -b通过 | 10.006 |
| build | 0 | npm run build通过 | 14.230 |
| diff-check | 0 | git diff --check通过 | 0.011 |

以上8个实际验证命令wall累加68.795s；重复通过不累加成唯一覆盖。读取/编辑/散列辅助命令不计作测试。一次报告写入工具调用因JS字符串语法在执行前被拒绝，未运行shell/未写任何文件；随后修正工具调用完成报告。

本轮未自己启动浏览器，也未改parent的QA工具/矩阵脚本。未运行849全套、完整npm/test:ext/drift、CE/full/gen、删除矩阵、128子集或5Z。待parent以本dist复核320/390/1440 × 普通/沉浸 × 四地图样式，地图四控件完整可见/中心命中/点击及邻格输入；真实采集菌后的背包按钮、e/a、No/Yes、ACK、触摸、读档和回放只读。焦炭任务前提冲突已按指挥裁决关闭；实际焦炭资格由独立审查复核。本次仅文档更正，保留上述历史失败和门禁记录，未修改已审源码/测试或重跑门禁/build。完成后停止，由新独立审查及真实浏览器核对，未宣布本轮浏览器发现关闭。


## 补充读源码守卫（2026-10-08）

独立审查指出此前158项相关行为测试没有覆盖docs/development.md §4要求的读源码守卫。本次按browser-source-guards.task.md补跑，boundary不能替代这些测试；焦炭裁决保持关闭。起止HEAD均为8af6ef55342ac30bb68b3b4035ce0743b0939d02，只追加本节，不改正接受独立审查的候选生产/测试文件。

新证据根：/private/tmp/brogue-commander-20261008-5g-revision/browser-source-guards-evidence。实际Node v24.19.0，绝对runtime入口、NODE_OPTIONS=--max-old-space-size=3072，Vitest4.1.11、maxWorkers2。单批命令source-guards **exit0，8文件41passed，0failed/todo，定向未选101，wall 7.381s**。未选是-t筛选结果，没有修改或新增skip。

| 文件 | 执行范围 | passed | 定向未选 |
| --- | --- | ---: | ---: |
| b_1a_identification.test.ts | 仅InventoryOverlay免费方法/旧按钮禁用源码守卫 | 1 | 33 |
| c_4a_terrain_catalog.test.ts | 仅promote/fire/mechFlags生产读者白名单 | 1 | 29 |
| p1_30_i18n_gate.test.ts | 完整文件，含源码词汇/死键和3 seed×400回合冒烟 | 26 | 0 |
| repo_hygiene.test.ts | 完整文件，冲突标记/JSON | 2 | 0 |
| test_suite_membership.test.ts | 完整文件，严格发现/所有权/分区 | 6 | 0 |
| u24_hardcoded_text.test.ts | 完整文件，含Vue文案和logger/floating labels | 3 | 0 |
| ui_2_protection.test.ts | 仅InventoryOverlay受保护物品闭括号源码守卫 | 1 | 10 |
| w_7_arcana_enchantment.test.ts | 仅InventoryOverlay强制附魔选择与toRaw边界源码守卫 | 1 | 29 |

c_4a实际源码扫描位于854–872行，捕获点号和解构读取fireType/discoverType/promoteType/promoteChance/chanceToIgnite/mechFlags。本次没有跑其15 seed×D1–D26生成普查或其它目录/规则用例。额外三项直接读取本次修改的InventoryOverlay，按实际影响补齐；其它样式源码检查读取的是未改的App/GameCanvas/theme-shells等，c_4b读取的DF调用/promoteTile也未触及，因此未扩跑无关行为/目录集合。共享SFC读取器的10项原测试已在158批内，本次没有重复。

精确argv、cwd、PATH、堆参数、退出和耗时见source-guards.command.json，完整日志见source-guards.log，逐用例与过滤结果见source-guards.json。单批-t正则如下；前四个完整文件的所有describe名称均被匹配，JSON逐项核验它们无未选/skip：
P1-30|U24 free-text guard|repo hygiene|test suite membership|promote/fire 类字段的生产读者只出现在白名单文件|InventoryOverlay 不再引用两个免费方法|Vue keeps mandatory selection visible|闭括号按 isProtected

输入全仓清单2657文件（包括当前报告）见input-before.json与input-after-gates.json，测试前后逐SHA零差异；报告追加前全仓聚合SHA为1c7c566b4b5fc054e889cc1f64c91ca3d286fc335f0b44a96bfdafb119619133。源码/脚本/根配置共1214文件，按排序“相对路径+NUL+SHA256+LF”聚合的前后SHA均为 **efd25d5b010cf3ad6fab262a9931f63baf558e8dacab32cdb2f3779a6e4cce8f**。最终只有本报告字节变化，input-after-final.json及audit-final.json记录这一点。

冻结dist59文件逐SHA前后不变，聚合仍为 **9431d3a1a3239ea6b6558555297bba8e34a4e8dcd77d18426c60dc70f372c9fe**，见dist-before.json。没有生产变化，没有重跑158/types/build，也没有重写dist、CE fetch/full/gen、生成普查或浏览器，没有commit/push。本批无失败，无需归因或请求改动已审候选。完成后停止。


# 5G UI2 库存名称修复交付（2026-10-08）

R-UI02 已作最小展示修复，最终相关测试和轻档门禁通过，等待同一独立审查会话复审及 parent 实际新构建浏览器。没有宣布浏览器发现或整个 5G 验收关闭。

完整读取 browser-review/review-findings.md 和 browser-review-decision.md。基线 HEAD 始终为 8af6ef55342ac30bb68b3b4035ce0743b0939d02，分支 codex/phase5g-maintainer。相对 UI1，仅改 InventoryOverlay.vue、dialog_host.test.ts；本报告随后追加到原 phase5g-browser-fix.report.md，原内容和所有失败证据保留。没有 commit/push、代理、分支或 git 索引操作。

## R-UI02 修复与相关范围

实际库存深响应式 ref 把 Item 包为 Vue 代理，displayName getter 的 this 因而与 WorldItemPresentation WeakMap 原键不同，未知菌呈现回退为通用名。共享 getLocalizedName 现在接受 Item，并读取 toRaw(item).displayName；模板传入 Item，不在代理上预先取 getter。使用原始 Item 的公开显示接口，不从真种类、nameKey 或 category 推断名称，没有 foraging 特判、名字硬编码或纯读写入。

检查实际详情入口发现同一可证实问题：performInspect 原先把代理直接传给 generateItemDetail，MATERIAL 分支同时用 item.displayName 和 worldItemPresentation(item)?.description()，名称和观察描述都可能回退。现在只在调用处解包原 Item，再传给详情生成器及公开上下文适配器。称呼表单没有另一条 displayName 读取；原 call 命令已用 toRaw，保留不改。没有扩改引擎、KindKnowledge、worldEdible、九冻结 SDK/stats/harness、四个 SDK 时钟文件、数据/locale/category/nameKey、规则、Game 字段或黄金 trace。

继承缺陷的独立红灯及旧 SFC 单变量反事实已在 browser-review/independent-final 与 baseline-name 留存：59pass/1真实名称fail，unknown foraging.mend seed51020001 原 Item 为镜面菌，候选和旧 SFC 为奇异的菌。该问题不是 UI1 两行可食资格新增引入；沿用已独立完成的归因，不盲重造旧红灯，不把历史失败改报为成功。

## 实际 SFC 回归

dialog_host 原 38 项主体逐字保持，仅扩展所需 imports 并在末尾追加 11 项；scope-check.json 验证原用例正文，未改断言、skip、timeout 或 SFC harness。仍真实编译 InventoryOverlay/DialogHost client SFC，只有 activeGame binding 使用原可切换对象，其他为实际 Game/Item/知识/消费/称呼/渲染路径。

- 5 项生产生菌状态：unknown、called、tasted、tasted-called、known。安装公开 catalog 中的 foraging 定义和 locale，真实 assembleEdibleItem，固定 seed51020001，未知名精确为镜面菌；称呼由 executeItemCommand('call') 建立。明确受控合法 HP/nutrition 布景下，真实 eat 命令先满血消费变 tasted，再受伤消费变 known；数量分别 3→2→1，未伪造知识行或 WeakMap。库存行精确验证观察名、吃过注记、月下回声称呼及愈合菌真名；known 后标题仍存于公开 knowledgeView、显示不再附称呼。
- 上述 5 项分别真实 save/load，Item 身份替换且为原始对象，旧选中清除；公开知识状态/标题保留，重新选择新行后名字和详情完整一致。
- 2 项实际烤菌：未知时烤镜面菌；真实生菌消费揭示后，烤菌知识仍 unknown，显示烤愈合菌（烤后效果未知）。
- 1 项实际生产 foraging.char：名称焦炭、MATERIAL、公开知识 known，实际库存 Eat 存在。
- 2 项中性可食模块生/烤和 1 项普通 native FOOD：原公开名称与实际详情保持；中性用例不依赖生产 foraging 的存在。生产例子只在已安装能力存在时注册，不在已注册用例里 return/skip。

每项真实挂载后反复渲染/选择/轮询，并点击实际详情按钮；精确比较库存行（含数量）与原 Item 的公开 getter、完整详情对象。每次读阶段前后完整存档投影（仅归一 savedAt）、双 RNG、实体 ID、logger 和录制事件逐值不变。load 是单独真实操作，在 load 后重新捕获纯读基线，不拿 load 本身冒充只读。UI inspectTarget 是原展示目标，不是新增世界状态。

最终 6 文件 188pass/0fail/0skip/0todo：dialog_host49（原38+新增11）、sfc_harness10、x3_u5_ui7、foraging_ui103、foraging_knowledge12、foraging_names7。原 pointer/e/a × No/Yes 六组及原 load/回放只读案例全部运行，未削弱。Host renderer 不宣称浏览器 CSS/触摸/物理指针覆盖。

## R-UI01 / R-V01 与焦炭裁决

按指挥原文要点：同为普通窄屏竖屏的实时和回放，在可见采食抽屉展开时都允许两列 44px 地图按钮；回放保持只读，地图控件在回放也应完整可见可用，其他模块、隐藏、沉浸不受新增 CSS 影响。原审查“replay 布局不受影响”是任务范围过窄，不是已实测裁切或不能点击的产品缺陷。本轮 ForagingPanel.vue 与 UI1 逐 SHA 相同，不机械增加 .is-replaying 排除。parent 必须补 320 普通真实回放打开抽屉后四控件几何、命中及实际点击证据。

R-V01 原补跑证据完整保留于 browser-source-guards-evidence：8 文件 41pass，发生在 UI1 同源上。本轮新模板触及 i18n/硬编码/识别源码读口，所以重新跑完整同一轻批，而非仅引用旧结果：P1-30 全26、U24全3、repo hygiene全2、membership全6；c_4a 生产 promote/fire/mechFlags 读者白名单、b_1a 免费识别方法、w_7 强制附魔选择/toRaw、ui_2 受保护括号各1。新批8文件41pass/0fail/todo，101为 -t 未选，不是新增 skip；不运行重型种子×层普查。精确 argv 与逐项结果见 source-guards.command.json/source-guards.json。

焦炭错误任务前提已由 charcoal-decision.md 关闭：批准24可食定义包括 char，satiety20/effect:none，营地“不算食材”不等于不能吃。独立审查真实 char 资格通过，本轮追加实际 SFC 名称/Eat 证据；普通未声明可食的 charcoal 负例仍保留。没有再次提问或改规格。

## 所有运行与失败归因

全部实际 Node 绝对路径 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node（v24.19.0），run.py 显式 PATH，NODE_OPTIONS=--max-old-space-size=3072；Vitest4.1.11、maxWorkers2。每个标签保存 .command.json（完整 argv/cwd/PATH/堆参数/退出/wall）、.log，Vitest另存JSON。结果不重复累加成唯一覆盖。

| 标签 | exit | 实际结果 | wall秒 |
| --- | ---: | --- | ---: |
| names-initial | 1 | 新11项8pass/3fail，原38未选；新测试知识组 ID 错写 foraging.fungi，公开 pack 实为 foraging.mushrooms，前置 title 查询 undefined | 10.096 |
| related | 0 | 修正合法知识组前提后6文件188pass | 27.654 |
| boundary | 1 | 新测试3处直接 import 模块 locale 违反已有所有权守卫 | 2.363 |
| types | 0 | 初版类型通过 | 8.431 |
| related-final | 0 | locale 改从公开 catalog descriptor.locales.zh_CN 读取，最终6文件188pass | 28.525 |
| boundary-final | 0 | 模块边界/归属通过 | 2.859 |
| types-final | 0 | 最终 vue-tsc -b 通过 | 10.024 |
| source-guards | 0 | 新模板下8文件41pass，未选101 | 7.808 |
| build | 1 | 误用不存在的 runtime npm-cli.js 路径，MODULE_NOT_FOUND，尚未启动构建 | 0.023 |
| build-final | 0 | 绝对 Node 执行 /opt/homebrew/bin/npm run build，通过，保留原大 chunk 提示 | 11.395 |
| diff-check | 0 | git diff --check | 0.013 |
| runtime | 0 | 实际 v24.19.0 | 0.012 |

两处新测试布景/资源入口问题只修前提、不改名称或状态断言语义，守卫本身未改；names-initial.test.ts、related-initial.test.ts 和各自输入 SHA 保留可重放。错误 npm launcher 日志也保留。旧独立审查原60项59pass/1fail、旧 SFC 反事实及 UI1 所有失败日志/报告原样保留，不宣称本进程已重跑独立审查注入的60项。

## 固定交付与后续

测试/守卫/类型/build 前后源清单逐 SHA 相同，见 input-final-tests-source.json 与 after-gates-source.json；前后门禁源码聚合为 222476f6ea1ddd01deef2d4302b87880204bd97934934c3114c71cfb3deb8653。仅本报告随后追加，最终 source manifest 连同本报告固定到 evidence/input，最终 SHA 与文件总数写 browser-name-fix.ready.md；manifest.json/final-source.json 含完整逐文件清单，聚合算法为排序路径+NUL+SHA256+LF。

新 UI2 dist 为 maintenance-tree/dist，并另固定到本证据目录 dist：59 文件，聚合 SHA 0fcb8a73a7eba5c2a03834dba463b1b9e912040a4a80b091ed2f6d366d92545c；index.html SHA 509453fdbf9ccf5921980d9d5f1964c3b1b5919ad36d72ff2f5c724f6359fcb0，完整清单 final-dist.json。原 ../build-ui1 未写入且59文件逐 SHA 仍等于原 UI1 dist，scope-check.json 已核验。

evidence/ui2-incremental.diff 仅名称组件与追加名称测试，原38主体与 CSS 字节核对见 scope-check.json。九冻结文件和四个 SDK 时钟文件均与开工相同，final-audit.json 记录。所有 >1MB 原始证据/构建只在仓库外，没有 CRLF 或提交。没有跑849、完整 npm/test:ext/drift/full/gen、5Z、删除矩阵、CE fetch 或浏览器，也没有改浏览器工具。完成停止，交同一独立审查会话复审及 parent 用当次 UI2 构建实际浏览器核验，包括自然采集菌名称/食用/确认/ACK/触摸/load/回放和320普通回放地图控件。

交付辅助检查另有一次非门禁失败：固定源/dist已复制并逐SHA验证后，脚本尝试读取独立审查input中不存在的执行报告，FileNotFoundError/exit1；记录在delivery-initial-error.txt。改为以本轮before-source.json的实际报告SHA核验原报告前缀，未改生产源或测试断言，最终交付检查另存delivery-check.json。

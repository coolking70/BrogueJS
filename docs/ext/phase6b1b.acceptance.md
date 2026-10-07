# 6B1-β 维护者独立验收

日期：2026-10-07。结论：**范围、惰性与规定门禁通过；修复 2 项，保留 1 项 S2 比较展示缺陷，浏览器像素验收待维护者。** 未发现核心改动或未鉴定信息直接泄露；比较面板接线前应处理 F-03。没有 commit。

## 门禁结果

Node `v24.19.0` 位于 PATH 最前：`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；所有命令设置 `NODE_OPTIONS=--max-old-space-size=3072`，Vitest 均 `--maxWorkers=2`，在仓库根执行。

以下全部在包含本轮两项修复的同一最终源码树上执行。表内测试数量顺序为文件 / passed / skipped / todo / failed；非测试填 —。最终命令、退出码、墙钟耗时原始记录：`/private/tmp/phase6b1b-acceptance-20261007/final/gates.json`，各日志同目录。

| 检查 / 命令 | 退出码 | 数量 | 墙钟秒 |
| --- | ---: | --- | ---: |
| `node -v` | 0 | — | 0.023 |
| `node scripts/test-discovery.mjs` | 0 | — | 0.065 |
| `node scripts/check-module-boundaries.mjs` | 0 | — | 2.635 |
| `npx vue-tsc -b` | 0 | — | 11.111 |
| `npm run build` | 0 | — | 14.892 |
| `构建后按 §12 精确 grep（完整命令见下）` | 1 | — | 0.080 |
| `npx vitest run src/ext/modules/loot/tests --maxWorkers=2` | 0 | 18 / 627 / 0 / 0 / 0 | 20.225 |
| `npx vitest run src/ext/modules/narrative/tests --maxWorkers=2` | 0 | 11 / 218 / 0 / 0 / 0 | 111.120 |
| `npx vitest run src/test/p1_30_i18n_gate.test.ts src/test/ext_module_creation_ui.test.ts src/test/ext_module_boundaries.test.ts src/test/sfc_harness.test.ts --maxWorkers=2` | 0 | 4 / 62 / 0 / 0 / 0 | 16.390 |
| `npx vitest run src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=2` | 0 | 3 / 11 / 0 / 0 / 0 | 3.030 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts -t '生产读者只出现在白名单文件' --maxWorkers=2` | 0 | 1 / 1 / 29（筛选） / 0 / 0 | 3.617 |
| `node src/ext/modules/loot/tools/loot-ui-preview.mjs --out /private/tmp/phase6b1b-acceptance-20261007/preview` | 0 | — | 1.051 |

```sh
grep -rl "loot-item-card\|loot-compare\|LootUiGallery" dist/
```

该 grep 退出 1、输出为空，代表零匹配；不是门禁失败。首轮还用五个组件/画廊标记扩展检索，亦零匹配。构建保留既有大于 500 kB chunk 提示，未改构建配置。affected 行包括 p1_30 i18n、模块开局 UI、边界与共享 SFC harness 四个门禁；无 failed/skip/todo。日志中的全局“CE reference source not found”提示没有造成 loot/narrative/affected 的跳过；未拉取 CE。

首轮规定 §12 门禁也全通过（loot 626 项）；额外源码守卫命令退出 1（10 passed / 1 failed），失败为 F-02。原失败保存在 `source-guards.log`，修复后最终同一命令退出 0。没有用最终通过掩盖首轮失败。最终源码输入前后 SHA256 均为 `a4e8f526c16904628f8edd0ff7c427960eabf69ac094a4a900a64ad6fda4f7ed`（1031 文件：src、scripts、package/lock、Vite/TS 配置；路径 NUL 内容 NUL）。

## 范围与惰性

以 dot 开工基线 `1223d09d784d4272956c72ebd25b6792468e53ad` 对比交付 HEAD `ded398fddffee81a0ba2b9899c4002383e63d088`（分支 `ext/phase6-loot-core`）。验收前工作树干净。

- dot 交付 35 文件，全部命中任务书 §13.1 白名单。证据：`/private/tmp/phase6b1b-acceptance-20261007/scope.json`。
- 对 41 个既有核心、数据、核心 locale、工具及测试文件逐字节比较，变化数为 0。descriptor 仅追加 UI locale import 和合并资源；测试清单保留原有顺序，只追加 8 项，gen/drift 未变。
- `LOOT_VERSION='0.1.1'`；规则指纹仍为 `sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2`。UI locale 不进入规则指纹。
- 没有 `loot/ui/descriptor.ts`，注册表无 loot UI contribution；扫描 loot 外生产/测试文件，没有对新增 UI 或 preview/tools 的引用，包括相对路径。已有模块 descriptor 的发现与 locale 合并是批准范围。
- 组件没有 Game、引擎/扩展运行时、共享 UI 或其他模块导入，没有命令或世界状态写入。loot 仍惰性，组件未挂载。
- 本审查仅改 4 个 loot 内文件，并按用户明确要求新增本报告；没有 commit/push。未改核心、共享守卫、快照、数值、基线或黄金 trace。

## 发现与处理

| 编号 | 严重度 / 状态 | 位置 | 复现与影响 | 修复方向 |
| --- | --- | --- | --- | --- |
| F-01 | S2，已修 | `src/ext/modules/loot/ui/LootPresetPicker.vue:28`（原面板根 keydown）；回归 `tests/loot_ui_components.test.ts:108` | 选中 standard，将焦点置于确认按钮，按 → 会改变预设并把焦点移回选项；Space 被根处理器 preventDefault，仅 choose，不触发确认。事件冒泡探针在旧代码上失败。 | 单选组 keydown 限在 radiogroup；确认按钮恢复原生 Enter/Space。保留原单选组选择/确认断言，调整派发节点至组，新增冒泡回归。 |
| F-02 | S2，已修（门禁） | `src/ext/modules/loot/tools/preview/LootUiGallery.vue`、`locales/ui.zh_CN.json` | 原候选 `u24_hardcoded_text` 报 12 处模板硬编码：标题、说明、主题/宽度/组件及选项文字。任务书 §7.2 允许开发说明字面量，但当前守卫并未豁免这些模板节点。 | 改用 `useTranslation` 与 11 个完整字面量 `ext.loot.ui.gallery.*` 键；最终 UI 键总数 130。未改扫描器或守卫。 |
| F-03 | S2，待修 | `src/ext/modules/loot/ui/viewModel.ts:248`、`ui/types.ts:86`、`ui/LootComparePanel.vue:32` | 真实夹具 R08（seed 146/0），全部揭示、pack、standard、与空武器槽比较：`body.large` 修正只显示“物理伤害 +89.73%”，缺“对大型目标”。R12（seed 707/0）同样操作，force 符文显示“符文强度 8”，缺符文名称。聚合 key 保留条件/符文，展示 DTO 却只保留属性标签，组件不呈现这些限定。会把条件收益理解为全局收益，或无法区分不同符文的同名行。 | 给公开比较行 DTO 追加可选 condition/runic 文本引用，构建时保留并在表格中呈现，补固定种子回归/快照。涉及稳定合同、行布局及快照更新，本轮列为发现，不以临时拼接字符串或解析 key 修补。应在接线前处理。 |

F-01 旧组件 + 新回归命令：`npx vitest run src/ext/modules/loot/tests/loot_ui_components.test.ts -t 'keeps preset confirm' --maxWorkers=2`，退出 1（1 failed / 76 筛选跳过）；修复后组件 + U24 定向命令退出 0（2 文件 / 80 passed）。这是新增回归的红绿验证，没有修改旧守卫前提、断言语义、容差或 skip。

F-03 只读复现脚本：`/private/tmp/phase6b1b-acceptance-20261007/probe.mjs`，结果 `probe.json`。输入 facts 为 `{v:1, location:'pack', ringKindKnown:true, magicPolarity:'unknown', curseRevealed:false, hallucinating:false, familiarity:null}`；使用 `transformLootUiFixture(id,{reveal:'all'})` → `projectLootKnowledge` → `buildLootCompareView(item,[null],catalog,{presetId:'standard',playerStrength:null})`。这些都是已知效果，没有未鉴定信息泄露。

## 专项只读审查

| 项目 | 结果与证据 |
| --- | --- |
| 专名 / 未知词缀 | 对 21 个真实夹具穷举所有揭示子集，共 309 组；未全揭示时 uniqueId、rareName、唯一描述均不输出；未知行严格只含 known/position，不含 id/tier/value/polarity。地面剥离所有行、物等、词缀数和专名。现有 16 个未知状态另核验 props/渲染文本无隐藏行信息。 |
| 腐化 | 仅全鉴定、诅咒已暴露或负面行已知时公开腐化；detect magic 单独只显示极性。未鉴定分解只输出可成立的产量区间，不根据真实腐化状态缩窄区间。 |
| 戒指种类 | 未知种类的 baseId 为 null；已知修正的隐含来源改为 unknown-ring，不泄露原基底 id。309 组中的全部戒指状态另检查详情 DTO 与草稿，均无隐藏 baseId。唯一戒指存在未知行时，不反推 override 或本体强度。 |
| 饱食等宿主信息 | loot v1.1 DTO / 已知事实 / UI 中没有饱食、营养、原生背包或 Player 读取入口，不能从这些组件泄露宿主状态；事实输入严格拒绝额外字段。此结论不覆盖尚未实现的宿主适配器。 |
| 视图模型纯度 | 构建器仅读输入/有效目录及批准的原生 JSON；新输出深冻结，输入不修改；未发现 RNG、Date、环境存储、运行时访问。独立探针对 126 组构建在 Math.random 抛错环境下正常完成；现有冻输入/深冻结与 inert 守卫通过。 |
| 真实夹具 | 全部 21 配方用真实 v1.1 rollLoot + mulberry32 固定 seed 生成；测试重新搜索首个命中，最大 seed=707，零放宽。后续只揭示 known 或调整 enhancement，并重新 validate；没有手写物品。 |
| i18n 写法 | 完整字面量或以 nameKey/descriptionKey 结尾的属性路径；TS 表用语义字段字面量。模块 unresolved/missing/前缀引用/未引用 UI 键均为 0；两 locale 不相交。p1_30、模块 i18n、修复后的 U24 均通过。 |
| 窄容器 / 触控 | 七组件选择器均 loot 前缀、非 scoped；根 inline-size containment，<360 / 360–639 / ≥640 容器查询；比较戒指列 <640 单列、最窄表格两行显示。交互类均声明双向 min 44px、2px focus-visible；min-width:0 与 overflow-wrap 防止长文本撑宽。此为代码/静态守卫核验，未证明浏览器实际像素尺寸。 |
| 键盘 | 筹码、折叠、分解、过滤、预设有本地事件和语义角色；过滤/预设组有 roving tabindex、方向键/Home/End，动作按钮使用原生 button。F-01 已修。Escape 按定义的 close/cancel 合同处理；PresetPicker 没有 cancel/close，按现合同交宿主处理。全局接管/焦点陷阱留集成。 |
| 比较与数值 | 独立直接从原生基底 + 已知目录行 + enhancement 配置计算 126 组基础数值，与详情及空槽比较逐项一致；全部三预设共 378 组分解与核心 salvageYield 精确值/区间一致。未知效果未计入，partial 问号、provisional 与力量不足提示存在。F-03 是展示语义遗漏，算术没有因其改变。 |

临时公式口径：UI 严格符合任务书 §5.6。本地 flat、local bp、强化项和护甲上限与 6B1-α 统计代理对应项一致；UI 按规定逐端点 floor / 护甲向下取一位小数。**不能把 UI 基础区间称为 α 的完整武器强度得分**：`tools/stats.ts:103` 还乘 `1.065 ** (native.weapon-enchant + floor(e/3))`，而任务书 §5.6 的 UI 公式没有这一步。未改批准公式；真正属性管线、力量惩罚、攻速/命中求值仍留 5A2-S。

稀有色对比度保持批准数据；最低为 rare 浅色 3.578，set 浅色 4.445；均满足本任务 ≥3:1，前两者未达 4.5:1，未改核心颜色。

## 预览与验收限制

静态页：`/private/tmp/phase6b1b-acceptance-20261007/preview/loot-ui-preview.html`（681,733 字节，665.75 KiB；可直接用浏览器打开）。52 状态 × 深/浅 × 320/390/1024，共 312 框；SSR 全状态和交互后展示状态均有测试。HTML 自包含，无脚本、外链或翻译键回退；静态页供布局/文案复看，不执行交互。

实时入口：运行 `npm run dev` 后，打开 `/src/ext/modules/loot/tools/preview/index.html`，可测试按钮、表单和键盘；本轮未留运行中的服务器。

浏览器实际布局/触控/像素验收未执行：mimo-browser-use 入口返回 `agent is not defined`；当前 CUA 的 IAB 不可用，浏览器清单为空。没有绕过工具限制，也未把静态声明或自定义 renderer 当作浏览器通过。请维护者用交付页复看各档与明暗主题；真实游戏挂载仍不在本步范围。

未运行完整 npm test、全部 test:ext、组合 smoke、删除矩阵、ce:fetch、test:full、test:gen、test:drift，遵守本任务 §12 的限定。已追加仓库轻档明确要求的 U24、repo_hygiene、test_suite_membership 与 c_4a 生产读者白名单定向守卫；后者的筛选跳过只表示未选择其余用例，不是修改 skip。

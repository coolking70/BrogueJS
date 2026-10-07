# 6B1-β 报告：loot 纯展示 UI

## 1 结论

完成。本步6个公共组件与1个内部组件未挂载，loot保持惰性；不接游戏命令或运行时。规定门禁全部通过；浏览器按任务书留维护者验收。

## 2 基线与环境

起点 `1223d09d784d4272956c72ebd25b6792468e53ad`（docs(ext): 6B1-beta dot package (loot UI components)），符合预期。最终实现候选为本地 `20ccdf5`（源码输入hash见§10）；最终文档/发布提交见本报告所属提交与交付摘要。

现存 alpha checkout 实际为 `0cc99e5` 且包含未提交旧工作，未在其中实施。显式获取同一授权分支后，新建独立 `BrogueJS6B1-beta` 克隆，初始工作树干净；没有合并其他分支、rebase、tag 或 PR。旧 alpha 开工前后状态清单 SHA256 均为 `d456d1ba6f2f9806fa240195e4873bc5e89b699fd8d61402c1b546ecc1c76dd2`。

Node v24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。复用已有安装依赖，不新增依赖、不改 package/lock/config。

开工：`node scripts/test-discovery.mjs > /dev/null && echo ok` 退出 0；`npx vitest run src/ext/modules/loot/tests --maxWorkers=2` 退出 0，10 文件 / 335 passed / 0 skipped / 0 todo / 0 failed，23.07s。

发布采用已连接GitHub对象API：常规 `GIT_TERMINAL_PROMPT=0 git push --dry-run origin HEAD:refs/heads/ext/phase6-loot-core` 退出128，错误为无法读取GitHub用户名（终端提示禁用）。未搜索凭据、未创建新授权。对象API保持逐提交tree精确相同，但作者/时间不同导致commit SHA不同；仅用expected_sha保护更新授权分支，不force、不推其他分支。

| 逻辑提交 | 本地 SHA | 对象API SHA | 两端相同 tree |
| --- | --- | --- | --- |
| 投影/模型/组件/文案 | 828873a422bccba4dc533cbe3430eddc9273105a | 90612d995b82f452f168b14bb07d2d153a2ed4a0 | 816bf6c10dddfe506211a805b8d3b130adcb286b |
| 真实夹具/预览 | fbde636a91f3103fc2137fe6ba73c2cd7975b881 | 1139c9117b52aa00305f10e9394a40aa3c2b65a5 | 3dd0e2584e3b386f11eedf6bd93f2237e36f462f |
| 测试/快照/清单 | 20ccdf5955d2eaa0a16a2f3500b3543ec4d62041 | c58cf15d1cc77a17456394e71d89a265aa2a536f | 2015e5e8bbf426ee514aa388111a3a1f92d5a5dd |

最后一个逻辑提交仅加入本报告与UI合同，继承上述最终源码。文档提交的精确SHA/tree在发布后交付摘要核验，不在文档中递归嵌入自身hash。发布时远端预期基线为1223d09；最终fetch复核commit、tree与源码输入hash。

## 3 交付清单

本轮共35个新增/修改文件，全部在 §13.1 白名单内。

差异摘要（`git diff --stat 1223d09..HEAD`）：35 files changed, 8042 insertions(+), 2 deletions(-)。

- `docs/ext/loot-ui-contract.md`
- `docs/ext/phase6b1b.report.md`
- `src/ext/modules/loot/descriptor.ts`
- `src/ext/modules/loot/locales/ui.zh_CN.json`
- `src/ext/modules/loot/test-suites.json`
- `src/ext/modules/loot/tests/__snapshots__/loot_ui_components.test.ts.snap`
- `src/ext/modules/loot/tests/loot_ui_components.test.ts`
- `src/ext/modules/loot/tests/loot_ui_fixtures.test.ts`
- `src/ext/modules/loot/tests/loot_ui_i18n.test.ts`
- `src/ext/modules/loot/tests/loot_ui_inert.test.ts`
- `src/ext/modules/loot/tests/loot_ui_knowledge.test.ts`
- `src/ext/modules/loot/tests/loot_ui_preview.test.ts`
- `src/ext/modules/loot/tests/loot_ui_style.test.ts`
- `src/ext/modules/loot/tests/loot_ui_viewmodel.test.ts`
- `src/ext/modules/loot/tools/loot-ui-preview.mjs`
- `src/ext/modules/loot/tools/preview/LootUiGallery.vue`
- `src/ext/modules/loot/tools/preview/fixtures.ts`
- `src/ext/modules/loot/tools/preview/i18n.ts`
- `src/ext/modules/loot/tools/preview/index.html`
- `src/ext/modules/loot/tools/preview/main.ts`
- `src/ext/modules/loot/tools/preview/render.ts`
- `src/ext/modules/loot/tools/preview/states.ts`
- `src/ext/modules/loot/ui/LootAffixRow.vue`
- `src/ext/modules/loot/ui/LootComparePanel.vue`
- `src/ext/modules/loot/ui/LootItemCard.vue`
- `src/ext/modules/loot/ui/LootItemChip.vue`
- `src/ext/modules/loot/ui/LootPickupFilterForm.vue`
- `src/ext/modules/loot/ui/LootPresetPicker.vue`
- `src/ext/modules/loot/ui/LootSalvagePanel.vue`
- `src/ext/modules/loot/ui/errors.ts`
- `src/ext/modules/loot/ui/format.ts`
- `src/ext/modules/loot/ui/knowledge.ts`
- `src/ext/modules/loot/ui/tables.ts`
- `src/ext/modules/loot/ui/types.ts`
- `src/ext/modules/loot/ui/viewModel.ts`

41 个既有核心/数据/测试文件开工/收尾逐文件 SHA256 完全相同；只改 descriptor 文案 import/spread 与清单追加8项。自动核对白名单：

```sh
git diff --name-only 1223d09..HEAD | python3 -c 'import re,sys; p=[x.strip() for x in sys.stdin]; allowed=r"(?:src/ext/modules/loot/(?:ui/(?!descriptor\.ts$).+|locales/ui\.zh_CN\.json|descriptor\.ts|test-suites\.json|tools/preview/.+|tools/loot-ui-preview\.mjs|tests/loot_ui_[^/]+\.test\.ts|tests/__snapshots__/loot_ui_.+)|docs/ext/(?:loot-ui-contract|phase6b1b\.report)\.md)"; bad=[x for x in p if not re.fullmatch(allowed,x)]; print("files",len(p),"outside",bad); assert not bad'
```

该检查退出0，35文件，outside=[]。现有test项顺序保持，新增8项，gen/drift空数组不变。

## 4 合同摘要

完整类型、签名、组件 props/emits、稳定性与集成边界见 [UI 合同](loot-ui-contract.md)。5 个 build* 构建器、2 个过滤默认/规范化入口，另有 projectLootKnowledge / knownModifierDrafts 两个投影入口。

追加可选字段：LootItemCard.initiallyExpanded=false；LootPickupFilterForm.initialDraft（缺省 value）。用于 SSR 正确展示展开与编辑状态；不接入状态/命令。

## 5 i18n

119 个 UI 键。专属扫描 unresolved=0 / missing=0 / 前缀引用=0，所有 UI 键均有字面量引用，两份 locale 不相交；核心 locale 不改。规则版本 0.1.1；包指纹 `sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2`。

## 6 夹具

21 个配方全部在 seed 1…707 内找到首个命中，零放宽。所有物品由真实 v1.1 rollLoot + mulberry32 生成；只允许 reveal/enhancement 变换且重新校验。

| 配方 | 目录 | 请求 | 谓词/物品简述 | seed/itemIndex |
| --- | --- | --- | --- | --- |
| R01 | none | floor D1 standard weapon | normal | 1/0 |
| R02 | none | floor D3 standard armor | normal | 1/0 |
| R03 | none | floor D3 standard ring | normal | 1/0 |
| R04 | none | floor D8 standard weapon | magic，恰 1 前缀 + 1 后缀，未腐化 | 25/0 |
| R05 | none | floor D4 standard ring | magic，1 条词缀，未腐化 | 5/0 |
| R06 | none | kill D12 standard `ogre`（非 leader/champion/encounterSubject） | rare 护甲，≥4 条，未腐化 | 218/0 |
| R07 | none | kill D16 standard `ogre` | rare 武器，含 `loot.affix.brutal`，未腐化 | 272/1 |
| R08 | none | kill D16 standard `ogre` | rare 武器，含 `loot.affix.giantsbane` | 146/0 |
| R09 | none | vault D30 bountiful weapon baseId:null highValue:true | rare，6 条词缀 | 7/0 |
| R10 | none | kill D16 scarce `ogre` | rare，corrupted | 146/0 |
| R11 | none | floor D10 scarce weapon | magic，corrupted | 46/0 |
| R12 | full | encounter D20 standard formId `giants.abyssal-colossus` | uniqueId `loot.unique.colossus-maul` | 707/0 |
| R13 | none | encounter D14 standard formId null | 唯一戒指（penitent 或 gambler） | 150/0 |
| R14 | none | encounter D6 standard formId null | uniqueId `loot.unique.whisper` | 7/0 |
| R15 | full | kill D16 standard `ogre` | 护甲，含 enduring/steadfast/stalwart 之一 | 79/0 |
| R16 | full | kill D16 standard `ogre` | 含 `loot.affix.adept.*` 变体 | 9/1 |
| R17 | none | vault D40 bountiful armor highValue:true | rare，含至少一条 tier=6 | 1/0 |
| E-W | none | kill D12 standard `ogre` | magic 武器（比较用已装备） | 8/0 |
| E-A | none | floor D12 standard armor | magic 护甲 | 5/0 |
| E-R1 | none | floor D12 standard ring | rare 戒指 | 10/0 |
| E-R2 | none | floor D12 standard ring | magic 戒指 | 5/0 |

## 7 状态与快照

52 个规定状态：

- chip.normal
- chip.magic-unknown
- chip.rare-identified
- chip.rare-unknown
- chip.unique-unknown
- chip.unique-identified
- chip.corrupted
- chip.enhanced
- chip.floor
- chip.hallucinating
- chip.ring-kind-unknown
- chip.selected
- card.floor
- card.magic-unknown
- card.rare-partial
- card.rare-brutal
- card.giantsbane
- card.unique-unknown
- card.unique-maul
- card.unique-ring
- card.malevolent
- card.corrupted
- card.combat-affix
- card.growth-labels
- card.growth-fallback
- card.enhanced-cap
- card.folded
- card.unfolded
- card.ring-unknown-kind
- card.familiarity
- card.t6
- compare.weapon
- compare.partial
- compare.empty-slot
- compare.rings
- compare.strength-short
- compare.folded
- compare.floor
- salvage.single
- salvage.batch
- salvage.unique
- salvage.blocked
- salvage.corrupted
- salvage.bountiful
- filter.standard
- filter.dirty
- filter.no-classes
- filter.read-only
- filter.bountiful
- preset.standard
- preset.disabled
- preset.keyboard

52 个 SFC 快照；8 项交互测试；16 个含未知信息状态逐项检查。覆盖筹码点击/Enter/Space、卡片展开折叠、比较折叠、分解阻断/submitting、过滤草稿/规范化/重置/只读/未改动禁用/宿主更新，以及预设方向键/Home/End/Space/Enter。按定义了关闭/取消事件的面板验证 Escape。未知词缀 id/翻译名/格式化值不进入 props 或渲染；仅允许确已由别的已知行/基底公开的精确碰撞值，未知行结构另严格核验。

## 8 样式与主题

token、容器断点与稀有色注入见合同。7 个组件非 scoped、选择器 .loot- 前缀、44px 双向触控尺寸与焦点轮廓通过静态检查。根面板12px内边距，使390px预览内容宽度364px进入中档；320px仍单列。此检查不替代像素浏览器验收。

| 稀有度 | 深色 | 浅色 |
| --- | ---: | ---: |
| normal | 11.622 | 7.847 |
| magic | 6.304 | 5.918 |
| rare | 14.145 | 3.578 |
| unique | 7.912 | 5.634 |
| set | 9.946 | 4.445 |
| runeword | 8.191 | 5.804 |

全部 ≥3.0；rare 浅色 3.578、set 浅色4.445未达4.5，如实记录，不改批准数据。

## 9 预览

实时：`npm run dev` 后打开 `http://localhost:5173/src/ext/modules/loot/tools/preview/index.html`。
静态：`node src/ext/modules/loot/tools/loot-ui-preview.mjs --out <仓库外目录>`，输出 `loot-ui-preview.html`。静态大小680,485字节（664.54 KiB），52状态×深浅×三宽度，共312框；无脚本、无外链、无缺键回退。

浏览器：未执行（交维护者用预览页检查）。按任务书不尝试浏览器，也不声明像素验收通过。

## 10 门禁结果表

| 阶段/检查 | 实际命令 | 退出码 | 文件 / passed / skipped / todo / failed | 耗时s |
| --- | --- | ---: | --- | ---: |
| M1-boundary | `node scripts/check-module-boundaries.mjs` | 0 | 不适用 | 5.432 |
| M1-types | `npx vue-tsc -b` | 0 | 不适用 | 31.194 |
| M1-loot | `npx vitest run src/ext/modules/loot/tests --maxWorkers=2` | 0 | 18 / 626 / 0 / 0 / 0 | 27.673 |
| M2-boundary | `node scripts/check-module-boundaries.mjs` | 0 | 不适用 | 5.309 |
| M2-types | `npx vue-tsc -b` | 0 | 不适用 | 40.737 |
| M2-loot | `npx vitest run src/ext/modules/loot/tests --maxWorkers=2` | 0 | 18 / 626 / 0 / 0 / 0 | 39.256 |
| M2-i18n | `npx vitest run src/test/p1_30_i18n_gate.test.ts --maxWorkers=2` | 0 | 1 / 26 / 0 / 0 / 0 | 24.950 |
| M3-boundary | `node scripts/check-module-boundaries.mjs` | 0 | 不适用 | 5.709 |
| M3-types | `npx vue-tsc -b` | 0 | 不适用 | 42.337 |
| M3-loot | `npx vitest run src/ext/modules/loot/tests --maxWorkers=2` | 0 | 18 / 626 / 0 / 0 / 0 | 30.967 |
| M3-i18n | `npx vitest run src/test/p1_30_i18n_gate.test.ts --maxWorkers=2` | 0 | 1 / 26 / 0 / 0 / 0 | 22.707 |
| M3-build | `npm run build` | 0 | 不适用 | 44.177 |
| M3-preview | `node src/ext/modules/loot/tools/loot-ui-preview.mjs --out ../phase6b1b-evidence/M3-preview` | 0 | 不适用 | 2.402 |
| final-boundary | `node scripts/check-module-boundaries.mjs` | 0 | 不适用 | 6.071 |
| final-types | `npx vue-tsc -b` | 0 | 不适用 | 41.102 |
| final-build | `npm run build` | 0 | 不适用 | 64.802 |
| final-build-grep | `bash -c 'grep -rl "loot-item-card\&#124;loot-compare\&#124;LootUiGallery" dist/; code=$?; echo "grep_exit=$code"; test "$code" -eq 1'` | 0 | 不适用 | 0.018 |
| final-loot | `npx vitest run src/ext/modules/loot/tests --maxWorkers=2` | 0 | 18 / 626 / 0 / 0 / 0 | 35.577 |
| final-narrative | `npx vitest run src/ext/modules/narrative/tests --maxWorkers=2` | 0 | 11 / 218 / 0 / 0 / 0 | 154.913 |
| final-affected | `npx vitest run src/test/p1_30_i18n_gate.test.ts src/test/ext_module_creation_ui.test.ts src/test/ext_module_boundaries.test.ts src/test/sfc_harness.test.ts --maxWorkers=2` | 0 | 4 / 62 / 0 / 0 / 0 | 24.286 |
| final-preview | `node src/ext/modules/loot/tools/loot-ui-preview.mjs --out ../phase6b1b-evidence/final-preview` | 0 | 不适用 | 2.066 |

所有里程碑末次与收尾均以同一源码输入执行，前后 SHA256 均为 `18dd54f66894e5e3ce076468cc35caf5925f2327edec3e5281a9d5b1690869a9`。哈希覆盖按路径排序的 src/**、scripts/** 与 package/lock/Vite/TS 配置，逐文件以路径 NUL 内容 NUL 串接；文档不属于编译输入。源码在最终门禁后未再修改。耗时为命令墙钟秒，表中不适用表示非测试命令。

生产产物 `grep -rl "loot-item-card\|loot-compare\|LootUiGallery" dist/` 退出1，零匹配；外层确认命令退出0。构建保留既有>500kB chunk警告，未调整共享构建配置。

开发过程曾出现注册尚未落盘测试导致发现器拒绝、SFC动作字面量未引用、Object.hasOwn不适用目标库，以及测试数值与公开数字碰撞，均按真实原因修正，未 skip/todo/放宽既有测试。首次快照 -u 后已不带-u通过；最终52快照全部复核。

仅 §12 指定门禁；完整 npm test、全部 test:ext、组合 smoke、删除矩阵、ce:fetch、test:full、test:gen、test:drift 未运行（任务书禁止）。

## 11 自行决定事项

1. 为保护已有未提交 alpha 工作，新建同分支独立克隆，不 stash、不覆盖旧树。
2. SSR 展开与草稿状态追加两个可选初始展示 props，后续 value 变化仍重置草稿。
3. 未知戒指 sourceId 使用非泄露 unknown-ring 占位符；全鉴定且种类已知时仍与核心草稿逐项一致。
4. 实际扫描器仅收集 TS/TSX 语义字段字面量，不收集 SFC script 中的对象字面量；组件动作与类别用直接字面量 t 分支，未改共享扫描器。
5. PresetPicker 的固定 emits 合同无 cancel/close，因此 Escape 留宿主；其余定义了 close/cancel 的面板按合同测试 Escape，不声称预设有取消事件。
6. 比较力量需求越低越好，与 native.strength 属性加值区分；有未知影响的估算值与差值附 ?。
7. 预设稀有度百分比写在 metric.label 参数中，value 为空，避免同一数字重复显示；所有数字仍来自数据。
8. 地面分解已阻断且 ilvl 已剥离，分解预览输出0而不反推隐藏物等；不计入总数。
9. 非交互筹码显式width:100%，避免inline-size容器固有宽度塌缩；面板内边距12px保持390px中档。
10. 源码审查另以21夹具×none/all揭示×0/1/cap强化共126组基底数值、三预设共378组分解精确/区间神谕交叉复核。

## 12 待集成复核清单

见合同完整表：C6-1 宿主识别/侦测/诅咒事实；6B-int 熟悉度、挂载、DialogHost/键盘、过滤/分解/预设命令与过滤默认；5A2-S 已知管线假设求值、力量惩罚与 growth 标签；6B3 强化/精炼；6A1 地图稀有色；6C 套装/插槽。

## 13 核心问题与未覆盖项

独立审查无未解决阻断项；未发现需修改核心的缺陷。已修正 UI 层的扫描器用法、筹码容器宽度、力量需求方向、部分已知问号，以及伪造 identified 标志绕过公开 DTO 校验的问题；最后一项由5个回归用例保护。未覆盖真实游戏集成与浏览器像素/触控实测，二者均由任务书明确留给后续。

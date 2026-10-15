# 6B3 独立审查 R1

结论：**需修**。新增重要问题 1 项（R1-F1）；未发现阻断级问题。默认配置的限定门禁通过，不抵消合法配置下已复现的同版本拒档问题。

审查基线：HEAD `944615f45a2647af6a197f621ffac6f31c9ea6f3`，审查对象为工作区全部未提交实现及新增文件。已读 AGENTS.md、HANDOFF、development、architecture、任务单、实施合同和报告；按 D1–D7 全 A、数值平衡延期、浏览器由维护者执行裁定审查。未改仓库源码/测试/文档，未 commit，未运行全量、CE、drift、构建或类型检查。本轮实际 Node v25.2.1；作者原记录使用 Node24，本轮没有冒称同一运行环境。

## 新问题（仅阻断/重要）

### R1-F1 — 重要：有效属性技能快照仍被永久总属性上限拒绝，合法局面保存后无法读取

- 引入点：`src/ext/modules/growth/module.ts:384` 改为使用 `effectiveView`（定义于 `:114`）创建临时技能效果；装备加值进入 `source.attributes` 是本步要求的正确方向。
- 遗漏点：`src/ext/modules/growth/skills.ts:202` 的 `isGrowthSkillBuild` 仍在 `:204` 将所有快照属性之和与 `config.attributeTotalCap` 比较。该字段约束永久投资；属性管线按各属性有效 cap 计算，并不受永久总投资上限限制。
- 复现：仅在仓外测试包把 `attributeTotalCap` 设为 4，其他生产定义保持原值；原 schema 接受该包。seed42/wizard、growth+loot，真实创建 scout + stoneborn + unaffiliated，永久属性为敏捷2、体质1（总和3）。受控构造合法 T6 +3 意志 adept 戒指，经 `deriveNativeFacts` 生成原生字段并通过真实 equip 命令装备。有效总属性为6，每项均未超过有效 cap。装备后保存/读取成功。随后真实 `use-skill` 施放 `growth.skill.hold-breath`，产生含意志3的效果快照；`isGrowthSkillBuild=false`，当前保存的 `loadSnapshot=false`。
- 对照：相同脚本/操作仅使用默认总上限36时，施放后 `isGrowthSkillBuild=true` 且 `loadSnapshot=true`。在 cap4 结果上仅把用于验证的效果来源属性换回永久值，验证亦为 true。证实失败来自快照验证混用永久预算，不是 schema 非法、物品非法或普通存档身份不符。
- 影响：支持的自定义配置只要永久总 cap 小于各属性有效 cap 之和，合法装备和技能操作即可产生自身无法读取的同版本存档。默认总 cap36恰等于五属性 cap 之和，当前默认样例没有暴露该问题；不扩大声称默认局必坏，也不要求调整任何平衡数值。
- 建议：为施放时的有效属性快照使用对应的有效值验证规则；永久 `values/allocated` 继续执行原投资总 cap。不要提高生产总 cap 或全局删除永久预算验证来绕过。补合法总 cap 较小、装备跨过总投资 cap、实际施放、保存读取和快照续存的窄回归。
- 证据：`/private/tmp/p6b3rev1.cap-probe.mjs`、`p6b3rev1.cap-4.json`、`p6b3rev1.cap-36.json`；两次最终探针均 exit0，JSON分别记录失败/成功断言事实。复验命令：仓库根 `node /private/tmp/p6b3rev1.cap-probe.mjs` 与 `PROBE_CAP=36 node /private/tmp/p6b3rev1.cap-probe.mjs`。探针为受控场景，不宣称自然掉落。初版探针手工原生附魔值与 T6 数据不匹配，先在保存检查被 C6_VALIDATOR 拒绝；修正为生产 `deriveNativeFacts` 后才得到上述有效复现，不将初版夹具错误列为产品缺陷。

## 逐条判定与证据

| 核查项 | 判定 | 审查证据 |
| --- | --- | --- |
| loot→growth 软推荐；明确关闭优先；关loot保留growth | 通过 | `selection.ts:10,29` 的 visited/declined/selected；loot descriptor `:8` 仅 recommends。先关闭默认growth再启用loot会推荐；推荐后显式拒绝在反复切loot时保持，显式恢复可清拒绝。`ext_module_recommendations`、真实SFC `ext_module_creation_ui` 通过。 |
| manifest、配置、initialCommand一致；无growth fallback | 通过 | 精确 `manifest(ids)`/创建入口不经过推荐解析；三预设初始命令恰各一次、首层前有效目录已确定，坏批次保完整活局测试通过。`loot_growth_attributes`、`loot_capabilities`、`loot_integration`；`loot/session.ts:29` 只按真实能力解析，缺席回退保留，非法能力不静默降级。 |
| 属性正式键、单向求值、重入守卫、缓存失效 | 通过（快照例外见F1） | `runtime.ts:444` 保留collect重入拒绝，`:452` 全provider基础→派生，`:500` 限输入为属性根、`:505` 禁止写回根；两阶段累计256行、属性根32条。`:526` 组件/状态写失效；hypothetical局部求值，knownOnly在根处先过滤。`ext_stats_pipeline/native/runtime/review`、成长生命周期、物品相关测试通过。 |
| 来源、cap显示、装备与永久点数/退款/前置分离 | 部分通过，需修F1 | `growth/statSources.ts:18` 拆永久投入/身份/初始来源，派生沿有效属性；永久HP与临时差额分行避免装备补血。`growth/view.ts:240` 来源/有效值、`GrowthCharacterPanel.vue:113` cap及合并封顶说明；双训练戒3+3→4，knownOnly剔除一枚→3，永久组件不变。学习仍在 `module.ts:362` 用永久view；分配/退款仍使用attributes组件。F1是技能快照验证仍混入永久总cap的遗漏。实际三档呈现由维护者验收。 |
| sage/adept/scholar真实结算，查询无写 | 通过 | `Game.ts:5535` 装备成功后的通用提交→`runtime.ts:1950`，匹配属性/物化行；`growth/statSources.ts:17` 声明XP收据，`runtime.ts:651` 自有validator组件实际安全整数正增才提交。真实击杀、无奖励/封顶/未装备/重复奖励负例及完整对象图/RNG/ID查询纯度测试通过。封顶仍揭示非零参与行符合实施合同已明确政策。 |
| 职业/树外部注册接口、fixture、缺growth预检拒绝 | 通过 | `content.ts` 严格JSON/预算/owner/version/fingerprint；`registry.ts:22,27,80` 精确启用集汇总、缺target提前拒绝、身份纳入贡献；`growth/content.ts:29` 两阶段引用、命名空间、预算、树+技能联合环检查，`skills.ts:54` 消费树约束。`ext_growth_content` 11项真实组装、创建/学习/来源/save-load、通用组件SSR及负例通过。生产无fixture内容。 |
| 共享补口最小化、未越权 | 通过 | 共享差量限推荐、受限属性输入、自有组件正增收据及纯数据组装；没有任意脚本/递归stats/跨模块组件写口，没有新增Game字段。居民/袭击差量仅把同文案迁到共享locale所有权，支撑物理全删。worldSdk/edibleSdk/itemSdk与HEAD逐字节一致；没有修改守卫脚本。 |
| 版本按真实差量；未调参 | 通过 | foundation15→16；growth module/rules1.9.0；loot module/rules0.4.0，pack0.1.1/state1保持；whole-run7/recording4/origin2保持。growth JSON去除两版本字段后与HEAD深比较相同；loot data无差量。目录/贡献指纹及不同目录拒绝测试通过。 |
| 同版本存读/完整回放/seek/续录确定性 | 默认链通过；总体需修F1 | `loot_growth_attributes` 自然seed26创建→战斗/XP/升级→分配→adept装备/卸装→存读、完整回放、seek、续录通过；`loot_integration` 显式loot fallback链及256摘要/2048快照边界通过。F1补足了现有默认测试未覆盖的合法配置快照拒档。 |
| 模块边界与唯一全移除 | 通过（限定范围） | 正常/全删boundary和测试依赖检查均exit0；复用作者唯一副本，八模块目录确实全部移除，除删除清单专用文件外保留源文件逐字节与当前候选一致；全删相关测试132过、2具名依赖跳过。独立重跑原全关探针new→3wait→save/load→第4wait续录→完整replay/seek[0,1,4]通过；当前foundation16/growth1.9/loot0.4真实导出缺包拒绝，完整对象图/双RNG/ID/录像保持。 |
| 旧测试前提修订与范围 | 通过 | 检查修改仅checkbox事件、两阶段provider夹具、批准版本及“缺能力”场景不再启用growth；原行为断言未放宽。作者仓外反事实日志可读且通过，本轮复跑修改后的相关文件通过；没有再次改旧测试或重做反事实。浏览器三档未执行，按裁定归维护者；平衡/6B4/6C不作为本轮缺陷。 |

## 本轮实际执行

正常树三批串行执行，均 `NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run <files> --maxWorkers=2`；无 `-t`。没有重复文件累加：**41文件、753测试全部通过，skip/todo/unhandled均0**。

| 批次/日志（均在 /private/tmp） | 文件 | 测试 | exit | Vitest秒 |
| --- | --- | --- | --- | --- |
| p6b3rev1.related-a.log | 10过 | 171过 | 0 | 52.08 |
| p6b3rev1.related-b.log | 16过 | 382过 | 0 | 74.93 |
| p6b3rev1.related-c.log | 15过 | 200过 | 0 | 101.92 |
| p6b3rev1.removed-related.log | 8过、2依赖跳过 | 132过、2占位跳过 | 0 | 22.18 |

A：共享 `ext_module_recommendations, ext_module_creation_ui, ext_stats_pipeline, ext_stats_native, ext_stats_runtime, ext_stats_review, ext_item_stats`；growth `ext_growth_content, ext_growth_loot_receipts`；loot `loot_growth_attributes`。

B：growth `ext_growth_attributes, ext_growth_progression, ext_growth_evaluator, ext_growth_combat_stats, ext_growth_config, ext_growth_identities, ext_growth_identity_runtime, ext_growth_skills, ext_growth_skill_integration, ext_growth_view, ext_growth_creation_ui, ext_growth_creation_view, ext_growth_public_effects, ext_growth_clone_overhealth, ext_growth_body_transitions_rewards, ext_growth_item_runtime`。

C：loot `loot_capabilities, loot_catalog, loot_stats_integration, loot_integration, loot_game_ui, loot_game_sfc, loot_review_r1, loot_trigger_settlements, loot_trigger_commits, loot_ui_knowledge, loot_ui_i18n`；共享 `p1_30_i18n_gate, u24_hardcoded_text, repo_hygiene, test_suite_membership`。

以上短名精确对应 `.test.ts`；共享在 `src/test/`，growth/loot在 `src/ext/modules/<module>/tests/`。完整命令另存 `/private/tmp/p6b3rev1.commands.json`。

全移除：复用 `/private/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-CQ2XbC/candidate`。相关文件为 A 的七个共享文件加 `p1_30_i18n_gate, u24_hardcoded_text, test_suite_membership`；跳过 `ext_stats_review`（缺combat/growth）、`ext_item_stats`（缺combat），不把占位skip计通过。没有新建单删/单留布局或矩阵。作者原准备状态仍为 prepared-not-verified，本轮限定结果独立记录。

正常/全删分别运行 `node scripts/check-module-boundaries.mjs` 和 `node scripts/check-test-dependencies.mjs`，四项exit0。日志 `p6b3rev1.{boundary,dependencies,removed-boundary,removed-dependencies}.log`；依赖报告errors=[]，安装集合分别8包/空。

全删实际探针 `/private/tmp/p6b3rev1.removed-probe.mjs`（仅把作者脚本的结果输出路径改到本轮目录）、结果 `p6b3rev1.removed-probe.json`，exit0。读取的save/recording是作者原始当前导出，没有修改manifest。

## 身份与审查边界

复算1487源文件scope SHA256为 `c71ba83e93f954ccc4b541f07b53a51469a7a003e4c9dda58c169a3964aacd6d`，与实施报告一致；scope及算法与报告相同。正常树测试后再次核对源码身份及git状态，不产生仓库改动。

本轮没有把SFC/SSR当浏览器通过，也没有重复作者build/types或运行全量。上述“通过”只涵盖已审代码与限定验证；维护者三档浏览器责任保持。R1-F1修复并完成针对性复验前，结论为 **需修**。

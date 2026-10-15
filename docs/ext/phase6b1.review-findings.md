# 6B1 独立审查，第 1 轮

日期：2026-10-15。结论：**需修**。新增问题：**重要 1 项；阻断 0 项**。未修改仓库文件、未暂存、未 commit/push；仅在 `/private/tmp` 写审查探针、日志及本报告。没有启动子代理。

## 审查对象与范围

- HEAD：`26aaaf3c90d6efb44fd1c6d120748cd81540f1bf`；对象为其上的全部未提交 6B1 改动，包括 untracked loot 目录。
- 已读 AGENTS.md、HANDOFF、development、architecture、6B1 任务单（D1～D6 全选 A）、实施报告；结合 C6 合同与相关 6A1 鉴定修复记录复核。
- 独立重算候选 108 个 src/scripts 路径：逐文件 0 不匹配，聚合 `5c83235669921c52898063800e6c812d9d31891feee5e424e0439a1f7c812c8f`。
- SDK 闭包 283 文件：逐文件 0 不匹配，聚合 `893ff7f50a4160c734dffd0d079d079f18cffc2f690d813aeb08b5ad1e2ad540`。
- 76 个迁移条目均对照固定 `93523fc596b173396a0d526ab2073b327ff7cf3e` git blob 与当前原始字节散列，0 不匹配。16 份数据未改；生成器差量仅 beginItem(index)/beginGold 通知，不改抽取算法。
- 本轮只运行相关测试、独立小探针、boundary、测试依赖检查。未跑全量、drift、CE、组合/删除矩阵、build/vue-tsc 或浏览器。作者的类型/构建/全删证据是核对既有产物，不冒称本轮重跑。

## 新问题

### F1【重要】碎片鉴定错误地把“词缀全已知”当成“整件没有剩余知识”

定位：`src/ext/modules/loot/commands.ts:24–28`，直接拒绝 `data.affixes.every(a => a.known)`；共享第二道条件在 `src/engine/Core/ItemCommands.ts:56–58`，仍要求 `!runtime.itemKnown(target)`。

否定会揭示实例/loot 词缀，但不会学习戒指原生种类。因此这是合法且仍可鉴定的物品；只检查 owner 词缀知识不足以判定整件鉴定资格。新接入的 identify-shards 在这条合法路径上始终失败，不能实现任务 §3.4“鉴定整件与应学习的原生种类/符文”及 A6/A7 的完整知识闭环。

独立最小复现（真实当前 Game；物品布景为原生成器夹具，不冒称自然链）：

1. seed42、loot 单开；装配原 R12，公开 salvage + Yes，获得 80 碎片。
2. 装配原 R05（ring_of_awareness），放玩家脚下；真实 `executeItemCommand('read', 否定卷轴)`，再 `executeCommand('pickup')`。
3. 确认 `isIdentified=true`、loot 所有词缀 known=true，但原生 kindKnown=false；原生卷轴的 `canIdentifyChosenItem` 返回 true。
4. 通过公开 `ext:command` 提交当前 revision 的 identify-shards。计划返回 null，kindKnown 仍 false；80 碎片不变，tick/revision 不变。
5. 经 JSON 快照存读后重复，结果完全相同。

实际输出：

```json
{"reload":false,"kind":"ring_of_awareness","identified":true,"kindKnown":false,"scrollSelectable":true,"planAccepted":false,"shardsBefore":80,"shardsAfter":80,"tickCost":0,"revisionBefore":2,"revisionAfter":2}
{"reload":true,"kind":"ring_of_awareness","identified":true,"kindKnown":false,"scrollSelectable":true,"planAccepted":false,"shardsBefore":80,"shardsAfter":80,"tickCost":0,"revisionBefore":2,"revisionAfter":2}
```

探针：`/private/tmp/p6b1rev1-probe.mjs`；输出：`/private/tmp/p6b1rev1-probe.log`。在仓库根执行：

```sh
NODE_OPTIONS=--max-old-space-size=3072 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/p6b1rev1-probe.mjs
```

修复方向：由宿主公开、可信的整件鉴定资格区分实例/种类/符文，模块与宿主两道校验一起修；不能只删除模块条件，因为共享条件仍会拒绝。不要让模块私引 ItemLoader 或自行维护种类知识。补即时与存读后碎片鉴定回归，验证学习原生种类、恰扣 10 片/100 tick、录像一致，以及真正全已知物品继续零成本拒绝。

归因边界：共享 `!itemKnown` 条件在 HEAD 已存在；本轮新 loot 命令沿用同一错误前提，暴露了尚未补齐的 SDK/接入缺口。不是声称 6B1 新改坏了原生鉴定卷轴，也不是指责拒绝时发生了部分扣费。原生卷轴分支当前正常。

## 任务 §5.1：S2/F-03 逐条判定

| 条目 | 判定 | 证据 |
| --- | --- | --- |
| 1 R08 大型目标条件 | 通过 | seed146/0 的既有夹具保留；`ui/viewModel.ts` 将 body.large 投影成 condition 文本引用，组件渲染“对大型目标”；独立文本断言通过，未并成无条件总伤害。 |
| 2 R12 符文名称 | 通过 | seed707/0 的 force 行带 `runic.name.force`；真实渲染“力量”。独立探针经生产 buildLiveLootCompareView 仍保留该文本引用。 |
| 3 公开 DTO/聚合身份 | 通过 | `LootCompareRowView` 明示可选 condition/runic；groupKey 保留 stat/category/unit/conditions/runicType；组件只读 DTO，不解析 key。 |
| 4 红绿、未知隔离、窄布局 | 通过（代码/组件层） | 核对作者 s2-red 日志为两条新增断言失败，s2-green 为同两条通过；本轮完整 loot 回归通过。unknown 行仅位置；分组回归/独立文本/快照保持。CSS 有 <360px 分行与 min-width:0；未声称像素验收。 |
| 5 本步交付完整修复 | 通过 | DTO、模型、组件、locale、回归均在候选；完整面板没有提前挂载，符合 D1-A。 |

真实比较的六标量来自 `stats.hypothetical(..., true)`；条件行单列。固定符文行明确显示目录强度，并有“完整强度效果待后续接入”的提示，未把 8 宣称为当前原生强度。更多比较标量及产品面板仍为报告公开的 6B2 范围。

## 任务 §5.2：A1～A10 逐条判定

| 条目 | 判定 | 证据与边界 |
| --- | --- | --- |
| A1 输入忠实 | 通过 | 76 项迁移及 16 JSON 字节核对；纯包指纹、新集成身份分开；固定 tape/schema/非法输入零 RNG 测试通过。文字 33 与实际固定数据 35 的差异已真实披露，未擅改数据。 |
| A2 身份/状态 | 通过 | integration 三预设真实 startNewGame、一次 create、坏配置/state/catalog/收据拒绝；capabilities 使用实际 combat keys 与 giants formIds，growth unavailable；state UTF-8 限额和严格字段；locale 不入规则指纹。 |
| A3 掉落 | 通过 | loot 四来源适配；原 generator 随机顺序保持。桶0不重置、后续单调、金币8；真实 floor/kill 自然链、giants split/lost/load 与 vault qualifier 回退通过；共享掉落次序/一次资格回归通过。 |
| A4 接纳/回滚 | 通过 | loot giants 8191/8192 根 partial/skip；accepted uniqueIds 按件结算。共享无落点、跳过唯一未来可掉、预算、后置 DF 故障完整图回滚；loot settle 晚异常完整图/RNG/ID 回归通过。正常跳过保留抽骰。 |
| A5 机械生效 | 通过 | statSources 显式适配本地节点/单位/equipment speed/owner预算；R07 在力量8/20对照，双同种戒指隐式只一次、knownOnly/cache/卸装回归；共享四槽和预算隔离回归通过。怪物 HP/伤害/命中采用原曲线，见 D3。 |
| A6 操作经济 | **部分满足，F1需修** | 过滤规范化、分解 No/Yes、多堆/成本/CAS/晚失败通过；未知 loot 词缀的十片鉴定可用。但词缀已知、原生种类未知的戒指被误拒，整件鉴定闭环不完整。 |
| A7 知识展示 | **部分满足，F1需修** | 原生卷轴否定后再鉴定、熟悉度、已知 DTO/铭文/四位置/幻觉/记忆及只读纯度回归通过，F-03关闭；新增独立探针发现碎片路径仍遗漏种类知识。D5 清单真实，见下表。 |
| A8 真实生命周期 | 通过（所测范围） | 当前 loot seed26 自然击杀→掉落→拾取→装备→分解→10片鉴定，save/load/replay零OOS/seek/续录通过；当前 loot 2049 命令测试覆盖256 fullCheckpoint/2048 snapshot。不是仅引用旧 c6fixture。F1边缘路径未被现有自然链覆盖。 |
| A9 缺包/可删除 | 通过（本轮静态+已有一行证据核对） | boundary/依赖本轮 exit0。作者唯一全删副本 `.../brogue-removed-modules-C20YVp/candidate` 的 modules 目录确为空；906 个剩余 src/scripts 文件与源树扣模块逐字节一致；缺包 save7/recording4 原始文件 SHA 与摘要相符，probe 代码/日志确验证拒绝与完整对象图、RNG/ID、录像保持。未新建第二副本或重复全关生命周期。 |
| A10 关闭范围 | 通过（报告需随F1更新） | 候选/SDK散列真实；失败、修复和最后范围有区分；历史统计不冒称平衡，静态组件不冒称浏览器；完整UI/6B3强度/M4/统计14标记均明确后置。不能把本轮结果写成无遗留可合入。 |

## 第7节裁定与 SDK 边界

| 裁定 | 判定 | 证据 |
| --- | --- | --- |
| D1-A | 通过 | MainMenu 同时提交 buildModuleCreationCommands 与 buildModuleCreationConfigurations；loot bridge 根据创建 payload 得到 presetId，registry 校验后才 start；三预设真实首层测试通过。只挂新局选择，β/画廊不扩成全产品UI。 |
| D2-A | 通过 | descriptor module/rules0.2.0、state v1、defaultEnabled=false、standard；foundation15/whole-run7/recording4/origin2保持；坏身份直接拒绝，无迁移。 |
| D3-A | 通过 | `statSources.ts:23–26` 调原 `monsterScalingAt`，无新曲线；原 JSON/economy 字节保持。environment 行和 initializeHealthOnBirth 接宿主可信出生初始化；后续升容不补/降容钳制沿现有 materialization。D7 giants 验证3500bp，跨层携带对象load回归通过。 |
| D4-A | 范围合规，另有F1缺口 | 8项共享补口各有最小场景或定向回归，未复制掉落服务、私写Item或改守卫。worldSdk/edibleSdk字节冻结；导出和散列已登记。F1说明还需要一个窄鉴定资格补口，不能靠模块绕过宿主条件。 |
| D5-A | 清单真实，限定范围通过 | 对35个非符文定义和8件唯一全部固定行逐项核对；已接恰为 keen/brutal/honed/dull/giantsbane/warding，以及 whisper.r0、ember-fang.r0、penitent.r2、colossus-maul.r0/r2、vigil-plate.r2。待补/能力缺席项未伪装成已接。 |
| D6-A | 通过 | 当前运行文件+两个合同迁入，历史报告/统计按固定git blob引用；无 narrative 资产或旧共享底座带入。 |

D5 的事实路径为 `runtime.ts` physicalResolved → melee/positivePhysicalDamage/hpLost>0 → 冻结 role/targetTags → `triggerLootKnowledge` → 候选 validator → 提交知识/摘要失效。攻击方与防守方 stat 集不同，giantsbane/colossus条件须命中 body.large，不整件揭示。真实 melee brutal 回归通过；R08小/大目标纯投影回归通过。collect/getter/name/比较未调用揭示入口。未把“具有非零贡献的每种被动均可被首次触发揭示”当成本轮已完成。

SDK补口逐项：

| 补口 | 最小证据 | 判定 |
| --- | --- | --- |
| prepareItemSession | loot+combat/growth 的实际目录身份与存读；坏fingerprint拒绝 | 通用、窄；无私读模块状态 |
| creation configuration bridge | scarce/standard/bountiful选择同时落manifest与create | 通用、窄；无底座硬编码loot ID |
| actor depth/withStatWorld | giants旧层和 carried actor跨层load | 宿主提供可信层深，未让模块改Game |
| validateReceipts | 篡改 uniqueMask/watermark拒绝且保活局 | 冻结accepted投影，未暴露可写位图 |
| vault qualifiers可选 | 明确[]原生回退；无约束路径保留一次kind选择 | 未扩大受限vault转换 |
| ItemKnowledgeProvider.trigger | 真实brutal近战、R08条件、部分未知保持 | 有受控事实入口；不是查询中揭示 |
| projectKnownItem/redaction | 四位置、未知ilvl/ring、幻觉/记忆/铭文 | 可信宿主读口；模块只收detached facts |
| birth/prune/placement/transition摘要失效 | prune只变一次、当前loot256/2048、作者768首次失败日志 | 限定状态失效修复；无格式迁移 |

其他模块差量仅测试所有权/依赖：giants两条掉落用例移属，settlement UI文件仅路径与SFC基准等价换算，旧断言未删；stats fixture重命名避免真实loot安装ID碰撞；foraging选择由泛扫描改精确声明。未观察到玩法越权或通过削弱守卫来过门禁。

## 本轮执行结果

共同设置：Node v24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`，批次串行。

| 命令范围 | 结果 | 日志 |
| --- | --- | --- |
| loot/tests + p1_30_i18n_gate + u24_hardcoded_text | exit0；24文件687通过，0失败/skip/todo/unhandled；38.09s | `/private/tmp/p6b1rev1-loot-node24.log` |
| ext_item_data/drop/stats/commands/presentation/roots + ext_stats_review + ext_module_creation_ui + giants/tests/item_drop_integration | exit0；9文件147通过，0失败/skip/todo/unhandled；38.75s | `/private/tmp/p6b1rev1-related.log` |
| ext_item_recording，筛选 `tracks partial knowledge\|naturally generates, walks\|records natural kill` | exit0；1文件3通过、11未选，0失败/todo/unhandled | `/private/tmp/p6b1rev1-recording.log` |
| check-module-boundaries.mjs | exit0 | `/private/tmp/p6b1rev1-boundary.log` |
| check-test-dependencies.mjs | exit0；errors=[] | `/private/tmp/p6b1rev1-dependencies.json`，stderr为空 |
| 独立仓外probe | exit0；确认F1即时/存读两场景及生产R12符文文本引用 | `/private/tmp/p6b1rev1-probe.log` |

以上三批 Node24 Vitest 去重为34文件/837项通过，另11项按筛选未执行。最初曾用系统 Node v25.2.1 跑 loot 22文件/658项并通过；随后发现环境版本不同，已按规定Node24重新执行，初批不叠加计数，也不作为最终环境证据。探针退出0是观察断言成立，**不是F1预期产品行为通过**。

作者全删材料：准备模式仍为 prepared-not-verified；实际限定检查另列。核对过 `/private/tmp/phase6b1-removed-probe.log`、probe脚本与当前输入散列：save `a83f341860ef70bf67228be1a22699cf05c16e9f2d4dc72a617b9534ed97a929`；recording `8e8ea5e4e35dd9bb39eb285a301c1dc3956c6d8b986a668e9061d306b10d4e46`。没有拿prepared结果替代执行结果。

## 交回

**需修 F1 后进入第2轮定向复验。** 无其他已确证阻断/重要问题；不要求扩大为全量、浏览器或M4平衡测试。审查结束候选散列再次核对无变化。

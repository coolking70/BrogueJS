# 6B3 实施合同

> 6Z 当前索引（2026-10-17，候选 `06682d5`）：当前身份 foundation20/itemSdk4/worldSdk2/world schema6/edibleSdk1；loot0.9.0、pack0.6.0/schema5、实例6/state2，crafting1.1.0/definitions schema2、growth1.10.0，whole-run7/recording4/origin2。现行增量见 [loot配置](loot-config.md) 与 [合同差异](phase6z-contract-delta.md)；以下有日期的旧章节是冻结历史，不追改数值或历史通过数。6Z实绩见[报告](phase6z.report.md)，浏览器/性能不因功能提交自动关闭。

本合同落实 [任务单](phase6b3.task.md) 的 B3-D1..D7 A 裁定。版本为 foundation16、growth module/rules1.9.0、loot module/rules0.4.0；数据包 schema1、loot pack0.1.1/state1、whole-run7/recording4/origin2 保持。数值平衡、符文重塑与强化分别延后；符文/强化归6B4。

## 新局选择

`ModuleDescriptor.recommends` 是最多32条合法模块ID的软推荐。`resolveModuleRecommendations(descriptors, selected, declined)`、`selectModule` 是公开纯函数：规范排序、去重、访问集合截断推荐环，缺包写入 `missing`。`selected` 表示当前实际选择，`reasons` 表示当前启用来源，`declined` 表示本草稿拒绝；手选项即使来源关闭也保留。

| 操作 | 结果 |
| --- | --- |
| 在没有推荐来源时关闭默认growth，随后开启loot | 自动选growth，显示推荐来源 |
| loot开启时关闭growth | 记录declined，loot保持；反复开关loot仍尊重拒绝 |
| 关闭loot | 已选growth保持 |
| 恢复推荐 | 清declined并重新解析 |
| 新挂载菜单草稿 | 从默认集合重新解析，不持久化拒绝 |
| growth未安装 | missing提示，loot使用fallback |

菜单、`DEFAULT_EXTENSIONS` 使用推荐解析。`prepareModuleCreation(ids)`、`registry.manifest(ids)`、`Game.startNewGame({extensions:ids})` 的显式集合仍精确，不再自动补模块。默认程序化中性角色沿原创建命令；菜单按用户选择产生身份。先解析集合，再组装目录、构造创建步骤和配置，最后由原初始批次预检提交。返回创建页保留本草稿；取消创建销毁创建计划/命令草案。load/replay/seek仅使用记录的精确身份。

## 属性目录与单向求值

`growth.attributes.v1` 输入精确 `{v:1}`；其他输入返回 unsupported-input；未启用返回 absent。输出严格：

```ts
{v:1, rulesFingerprint, fingerprint, attributes:[{
  id, stat, nameKey, descriptionKey, unit:'rank', minimum:0, maximum, equipment
}]}
```

属性按完整定义ID排序、唯一、最多32条。`stat = 'growth.attribute:' + id`；loot展开为 `'loot.affix.adept.' + id`。当前5条完整后缀为 `growth.attribute.strength-training/agility/constitution/will/perception`（每项使用完整独立ID，不是斜线别名）。训练cap4，其余cap8；训练禁用时equipment=false。能力在角色创建前可读，数值通过真实已声明Stat键查询。空目录合法；非法形状、指纹或未声明键硬拒绝，不降格为absent。

`attributeCatalogFingerprint` 包含机械条目及growth有效rulesFingerprint，排除名称/说明文本引用；locale内容不参与机械身份。loot保存规范availability及能力指纹于有效目录，角色升级/加点不改目录。focus与XP各自检查真实键，不以目录非空代替能力检查。缺growth保持sage→mending、adept→titan、scholar→omit及原权重合并。

`StatKeyDeclaration.attributeId` 只开放 `<owner>.attribute:<合法definitionId>`，要求query/base0/min0；其他ID、sourceId、模块名仍使用原 `validId`。属性根禁止条件行。根键总数最多32。

`StatSourceProvider.derived` 声明 `inputs / outputs / optionalOutputs / collect`：所有inputs须是属性根；outputs须存在；optionalOutputs允许缺席的可选combat键；输出不得写回根，不得重复，总数最多128。所有模块先执行原collect，再从冻结根行求有效属性，最后执行derived。`context.input(key)`只读取已声明根；不能读任意下游或递归调用stats。两阶段合计仍最多256行/provider；原纯函数、重入、条件、预算守卫保留。只有根→下游一层，因此不存在可配置的属性↔原生字段回边。

knownOnly在根求值前过滤未知装备，派生使用过滤后的属性；hypothetical与组件提案共享这条路径，局部求值不发布缓存/账本。基础值仍是L0，绝不把已物化力量/HP作为成长基础。

| 输入/规则 | 下游与现有数学 | 来源/提交 |
| --- | --- | --- |
| 等级 | 每级按原表发AP/SP；偶数级+1生命，最多10 | progression；原升级事务 |
| 训练 | 3AP/级，cap4；每级+1 `native.strength` | 永久投入/初始继承/装备；装备不写allocated |
| 敏捷 | 攻方+100bp/点、守方−50bp/点；潜行沿原floor | hit-chance/evasion及stealth-range；不写accuracy |
| 体质 | +3最大生命/点 | native.max-hp；永久和外部差值分别入账 |
| 意志 | focus+floor(rank/2)；冷却按原ceil(−rank/4) | focus-capacity/cooldown-duration，原上下限 |
| 感知 | 搜索输入+2/点 | search-strength，原手动/自动搜索规则 |
| 可选combat | 体质→体力+2/点；意志→韧性+1/点 | 仅真实存在的容量键；原min/max |
| 身份/被动/临时效果 | 原有限端口、条件、槽、预算与舍入 | 永久属性来源拆分；规则来源为定义/技能/实例ID+机械规则hash，非数组序号 |

永久cap/totalCap、成本、退款和技能/树前置仅用永久构筑。装备有效cap沿原配置；超cap来源仍可见，合并后统一封顶，不能把每件的独立边际相加。施放的强度/持续/冷却快照读取当时有效属性，已经施放的效果保持原source快照，换装不追溯修改。技能效果的持久source快照按有效属性边界校验：完整键集、非负安全整数、每项cap及训练cap；不套用永久属性min或attributeTotalCap。永久values/allocated继续执行原min及总投资上限。角色资源/加点预览走knownOnly管线；条件规则例子明确标参考输入，不冒充对未知敌人的命中率。

永久生命行继续遵守现有refill-delta与配置恢复策略；装备导致的差值是temporary行，无refill权限。默认升级/加点不补HP/focus、不清冷却；容量降低只钳制，创建满血沿原合同。

## 知识和失效

装备提交调用宿主 `commitEquipmentStatKnowledge`，范围是已声明属性根、物化容量及原生力量；仍由物品的匹配非零行决定揭示。`StatSourceProvider.gainReceipts` 最多16条唯一 `{component,field,stat}`，仅本模块已校验组件的直接字段与本模块Stat键；安全整数实际递增才调用既有物品知识提交。growth声明 progression.experience→growth.xp-gain。没有任意字段路径、回调或跨模块写权。itemSdk1、worldSdk1、edibleSdk1无导出差量。

| 词缀 | 实际参与事实 | 负例与封顶 |
| --- | --- | --- |
| sage | 装备提交focus容量行 | 查询/load不揭示；合并封顶仍按原非零参与政策揭示；容量增加不补focus |
| adept | 装备提交对应属性根，随后同一DAG派生 | 未装备/纯比较不揭示；cap按合并结果；非零来源参与封顶仍揭示 |
| scholar | 实际XP结算使progression.experience递增 | 零奖励/已封顶/重复已领取奖励不提交；未装备不揭示；取整后没有额外边际但参与正XP按既有参与规则揭示 |

| 生命周期 | 机械/已知失效与责任 |
| --- | --- |
| 创建、升级、分配、洗点、身份/技能装配 | 原组件/state写口标脏、清moduleViews；安全点账本重算；原录像摘要 |
| 临时效果施加/消费/到期 | 原skill-build/objectiveClock事务失效；快照保留施放属性 |
| 换装、强化、否定、药水、形态 | 原原生revision/Item绑定失效；派生行参与物化签名；装备提交额外记录已知事实 |
| 鉴定/首次事实 | 原Item知识绑定与摘要更新；knownOnly过滤重算，不额外加机械收益 |
| load、seek、换局、克隆/复活 | 原会话重建/账本所有权；不回放gainReceipts；旧草稿session失效 |

## 有限内容注册

公开边界 `ModuleDescriptor.content: ContentContribution[]`；每贡献严格为 `{schema:1,owner,target,version,fingerprint,data}`，owner/version必须匹配声明者，target必须是另一合法模块。每包最多8个不同target，总JSON最多65536字符；拒绝getter、函数和未知字段。强引用target缺席时预检拒绝，区别于软推荐。汇总仅本局启用贡献，按owner排序；目标有效rules fingerprint为hash({base,content})。注册顺序与locale值不影响身份。目标须实现 `ExtensionModule.assembleContent`，在运行时创建/能力发布之前冻结目录。

growth领域data严格为 `{professions,trees,attributeRules}`：

- professions：完整现有GrowthIdentity，kind必须profession；顶层及嵌套效果/誓约ID、文本键属于贡献者；只新增，不覆盖原定义。沿现有属性预算、赠技、装备槽和前置校验。
- trees：`{id,nameKey,descriptionKey,professionIds,nodes:[{id,skillId,requires:nodeId[]}]}`。引用既有技能；每技能最多属于一树，节点前置在本树内。职业集合限制可见性与学习；没有新点数池、持久树状态或执行回调。树边和现有技能边合并检查循环。
- attributeRules：`{id,attributeId,effect:GrowthModifier}`；只能附加现有有限下游端口规则，不能新增任意属性/能力或写组件。source magnitude引用仍由原schema校验；属性规则不能回写属性根。

每贡献最多16职业/8树/32规则；每职业直接效果与誓约效果合计最多16，每树64节点/每节点16前置；汇总最多16树、128节点、88定义、64属性效果。这是组装准入上限，不调整既有规则数值，运行时仍保留256行/provider硬上限。文本键须由启用descriptor locales声明；机械data纳入指纹，locale正文不纳入。返回的扩展pack含只读registeredTrees，仅会话目录，不改变原定义包schema1。

最小接入样例见 `src/ext/modules/growth/tests/ext_growth_content.test.ts`：b3fixture通过公开descriptor注册职业、两节点树和一条敏捷→生命规则，通用创建步骤/角色视图/学习命令直接消费。依次调用 `registryFromDescriptors` → `manifest` → `prepareModuleCreation`；不要导入另一模块的执行器，不直接写growth组件。样例只在测试中安装，生产外部贡献为空，原12技能及4职业/4血统/4信仰不变。

测试、失败归因、候选身份、全移除与待浏览器验收以 [报告](phase6b3.report.md) 为准。

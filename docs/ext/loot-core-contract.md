# loot 当前核心合同（6Z）

2026-10-17，候选 `06682d5`。现行完整配置见[loot-config](loot-config.md)，冻结A/B/C合同到现行实现的映射见[合同差异](phase6z-contract-delta.md)；历史实施/审查结论留对应报告，不将旧纯包签名当当前接口。

## 身份与所有权

foundation20/itemSdk4/worldSdk2/world schema6/edibleSdk1；loot module与rules0.9.0、pack0.6.0/总包schema5、dropTables2、实例6/state2；whole-run7/recording4/origin2。manifest configuration严格为`{presetId}`，新局冻结scarce/standard/bountiful，默认关闭/启用默认standard。

`session.ts`的state严格包含v/presetId/created/revision/catalogFingerprint/uniqueMask/setMask/watermark/filter，≤4KiB；唯一位图8位、套装位图32位十六进制字符串并限制到实际piece数量。create仅一次，首层生成前配置生效。目录指纹包括实际公开能力/属性/来源目录，不能只看安装名。

`Item.moduleData.loot`为实例唯一真相，quantity=1；owner≤4KiB/所有moduleData≤8KiB/depth16。实例v6校验基底/类别/词缀/孔/序列/强化/来源及原生字段一致性。create按出生事实校验，合法update/load保留原生强化、解咒、否定的差量；非法输入在候选发布前拒绝，活局/引用/双流/allocator保持。旧格式直接拒绝，不迁移。

## 来源与事务

- floor/vault/kill/encounter经过宿主真实来源与固定装配，不先随机spawn再覆盖；vault原有qualifiers语义保持。唯一/套装仅实际接纳写收据，遭遇watermark与宿主资格交叉校验；来源失败/容量不足不伪造接纳。
- craft走WorldWork真实完成票据、ordinal和固定基底，至多magic，不用普通掉落provider；原生装备escrow/预留/取消/异常退款保持单所有权。
- part走可信直接成员破坏，宿主自然核心出生授予原body有限部位资格。`foundation.itemDrops.parts`不依赖临时成员ID；一次消费、换形/phase/split撤销未用资格，返回原形/克隆不重领。`foundation.item-bodies.v1`只读目录，`partBroken`只读多消费者事实，不能据此授予奖励写权。site无真实入口，保留协议及拒绝，玩法延期。
- 每件≤64骰/事件≤512骰，固定区间与单候选不抽骰；两条RNG有独立合同。新增来源事务包含原生/runtime/知识/消息/allocator/统计会话完整回滚，禁止只看save投影。

同priority同source且选择域相交的表在schema准入拒绝（含闭区间端点/通配/零概率）；不同priority及互斥选择允许。不靠数组顺序选择歧义配置。

## 生成器顺序与错误边界

`rollLootWithTrace` / `rollLoot` 接收有效目录、严格 `LootRollRequest` 和唯一注入的 `LootRandom.randomInt`。请求校验先于抽骰；非法字段/来源/引用抛 `LootContractError('INVALID_REQUEST', path, detail)`。返回值深冻结；`newUniqueIds` 是本次候选收据，真正接纳后才提交运行状态，不能在纯生成时写收据。craft 使用独立的可信完成路径，不伪装成此请求。

当前 `generator.ts` 顺序如下，配置扩展不得无意改变：

1. 校验请求，确定怪物类别及匹配表，再算来源件数；floor先做转换判定，kill/part按各自概率和数量，encounter按预设数量。被遭遇接管的kill和无类别kill直接返回。
2. 每件依次算物等、类别、基底、最低稀有度及稀有权重，抽稀有度。unique/set筛选未占用且满足物等的候选；无候选退rare，成功暂占本次候选集合，避免事件内重复。
3. magic/rare抽词缀数量，按前后缀容量、group、类别、能力与tier资格筛选；选择行，再抽tier/数值。腐化随后判定、加入合法负面行，再按规则补偿一条正面行。unique/set改用固定rows抽值；rare随后抽名称片段。
4. 派生原生事实后，slaying/immunity抽合法原生目标；normal武甲最后抽孔数，戒指不抽。孔数是终端选择，单个正权候选不耗骰。
5. 全部装备之后处理允许来源的符文副表，最后处理kill/encounter金币。part不走符文/金币副表。每件、材料及金币均受计数器对应边界约束；固定区间、确定概率及单候选沿原计数器的零消耗规则。

`rollAffix`、`unlockedTiers`、`computeRarityWeights` 的实际类型与取整规则以源码为准。纯包错误不吞掉，宿主在命令/来源事务边界回滚并报告；不得通过重抽、跳过异常候选或追加临时随机源恢复。

## 纯接口的不变约束

- 加权选择保持目录顺序，只累计正权重；唯一候选、闭区间两端相同、确定概率不抽骰。所有整数缩放按实现逐步向下取整，中间值必须是安全整数。不能为展示或修复样本额外抽骰。
- `LootRandom.beginItem?(index)`只是桶边界通知，不是额外随机源；前置与首件的预算关系、材料/金币边界由`generator.ts`计数器和宿主item SDK共同约束，不能重置预算绕过上限。
- `validateLootItemData`只验实例，`deriveNativeFacts`派生原生事实，`projectItemModifiers`产出修正草稿；原生单位换算、本地比例折算、来源归并及cap由实际属性适配层承担。纯β显示公式不能替代它。
- 缺能力的replace仅对源与目标共同支持的物品类别转移权重；omit移除候选。adept展开公开完整属性ID，不从安装名臆造属性；目录规范化、排序、去重后决定指纹。同目录和请求必须产生同结果。
- 非法请求必须在第一骰前拒绝；随机回调非整数/越界、未知引用和预算超限分别按实际`LootContractError`边界处理。输入不修改、返回深冻结且可结构化复制；校验失败不能偷偷换来源、补默认或重抽。

## 属性、知识与命令

四槽装备来源进入真实属性管线，local与原生内部单位通过C6适配，不把UI显示点当内部防御。growth公开完整属性ID、L2有界贡献、cap和容量升不补/降钳制；可选combat/growth/body能力缺席时replace/omit且指纹反映变化。

两套×四槽、累计阈值、同件双戒不重复计件；四符文/两词、满孔严格顺序、词替换单符文行；part不增加装备属性来源行。默认最坏武器11/护甲8/戒指6、四槽31+4cap35，硬限每件24/provider256。21随机/4固定原生符文的强度与真实触发知识已实现，与插槽材料分开。

UI仅收脱敏DTO，`projectKnownItem`和真实`readLootGameView`只读；首次有效物理/属性/原生符文事实只揭示参与行。未知、部分已知、地面、幻觉、戒指种类、套装阈值与来源秘密遵守[UI合同](loot-ui-contract.md)。装备/知识变更在原事务失效、验证及物化，纯查询不写state/收据，不耗RNG/事务。

所有状态输入走`executeCommand`/`executeItemCommand`。create/filter为0tick；分解每件100tick、鉴定10碎片/100tick；镶嵌1符文/100tick；工位10碎片/100工作tick；强化卷轴成功后才消费。prepare/commit独立重验目标/所有权/容量/revision，失败无部分扣费，工位选行用rowId。非loot装备保持原生行为。

## 共享入口与验收边界

公开入口以`src/ext/itemSdk.ts`、`worldSdk.ts`、`types.ts`和实际调用方为准。`prepareItemSession`在能力注册后构造目录；`DropProvider.validateReceipts`、宿主原生鉴定资格和效果事实保持冻结权限。C3/C4无新增Game字段；整phase6的6B4 `pendingEnchantmentScrollId`已登记U03并保存run.enchantmentScrollId。

硬容量、配置扩展方法、工位/配方成本和未测性能边界见[配置手册](loot-config.md)。当前自动门禁、首次失败/复核、全删/七组合以[6Z报告](phase6z.report.md)为准；统一浏览器U01–U18及C3/C4云端结论仍交维护者，不能由功能实现推断通过。

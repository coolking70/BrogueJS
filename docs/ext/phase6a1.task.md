# 6A1 本地实施任务书：物品扩展、掉落事务、属性接线与 C6-1 冻结

> 2026-10-11。依据 [6A0 报告 §5 维护者裁定](phase6a0.report.md#5-待维护者决定)：C6-D1/D2/D3/D5/D6 已采用建议；C6-D4 按已批准数值 v1.1，**唯一品可分解，分解前警告；批量每件 100 tick；10 片鉴定一次 100 tick；失败整单 0 成本**。这些裁定已生效，不再列为待签认。
>
> 工作分支 **`ext/loot-6a0`**；本任务书编写基线 `4ba994cfd9647fbc8a9ca17060fc97fea0c72a5b`。生产审计基线仍为 `59b9ba691daf66819eeea0299a0539f3641ad208`，两者差量仅为 6A0 两份文档、两份探针。实施开工时另记实际 HEAD 与工作树差量，不自动跟随或合并已前进的 `origin/ext/phase5`。
>
> 本任务书只定义后续实施。当前写任务书这一步**只新增本文，不实施代码**。后续 6A1 由本地单主笔按 **6A1a → 6A1b → 6A1s → 6A1c → 6A1d** 串行实施，交底座与中性 fixture；不安装 loot，不开 6B2/6B3/6C。每子步形成可审阅停点，6A1d 完成前不宣称 SDK 冻结。**不要 commit / push，不暂存，不尝试绕过沙箱写共享 Git 管理目录。**

## 0 开工核对与规格来源

1. 先读根 `AGENTS.md`、[HANDOFF](../HANDOFF.md)、[开发指南](../development.md)、[架构](../architecture.md)、[测试与重录规则](../testing.md)、[i18n](../i18n.md)，再读 [C6-1 候选合同](phase6a-contract.md)、[6A0 报告](phase6a0.report.md)。本任务书采用 [5A4 任务书](phase5a4.task.md) 的开工核对、预先裁定、子步停点、门禁与冻结交接格式，不继承它的版本号、worker 数或历史待批准条款。
2. 设计输入固定为 `93523fc596b173396a0d526ab2073b327ff7cf3e`（编写时 `origin/ext/phase6-loot-core`）。使用下列只读命令；不把远端整分支合入、不将 α/β 包视为当前已安装模块：

   ```sh
   git show origin/ext/phase6-loot-core:docs/ext/phase6-loot.md
   git show 93523fc596b173396a0d526ab2073b327ff7cf3e:docs/ext/phase6-loot-numbers.md
   git show 93523fc596b173396a0d526ab2073b327ff7cf3e:docs/ext/phase6-loot-tuning.md
   git show 93523fc596b173396a0d526ab2073b327ff7cf3e:docs/ext/loot-core-contract.md
   git show 93523fc596b173396a0d526ab2073b327ff7cf3e:docs/ext/loot-ui-contract.md
   ```

   若远端引用移动，仍按上述固定提交读取设计稿。正文简称“设计 §X”均指该提交的 `phase6-loot.md`；“C6 §X”均指本地 `phase6a-contract.md` 的相应节。
3. 优先级：维护者最新裁定与已批准 v1.1 → C6 接入合同 → 旧设计的未被覆盖部分。经典/未接管路径仍以 CE 执行路径为规格。旧设计的预设名、26 词缀/6 唯一品、v3 每命令完整 state、七模块 128 子集不是当前事实。批准值为 `scarce/standard/bountiful`、33 非符文词缀、21 符文变体数据、8 唯一品；遭遇唯一乘数 5000/10000/5000、warding 仅护甲、丰饶 elite 1–3。L-D01–13、N-01–13、M1–M4 不重新审批，M4 真实力量/怪物倍率平衡验证仍留原排期。
4. 记录实际版本：预期 foundation 13、whole-run 6、recording 4、origin 2、world5 schema 4、WorldWork SDK 1、edible SDK 1。实值不同先定位来源并写报告，不能沿旧文档硬改回去。核对 C6 §2 各接入点的当前文件与方法；报告写实际行号，不能把 `59b9ba6` 行号直接当未来改完的行号。
5. 开工保存现有导出散列：`worldSdk.ts` 应为 `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`，`edibleSdk.ts` 为 `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b`，`stats.ts` 为 `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84`（6A0 输入散列）。前两者本步保持；stats 仅按 §1 解冻后重发散列。若基线不符，先解释差量，不覆盖已有工作。
6. 使用以下环境，所有命令在本工作树根运行，不读取/修改/运行 BrogueJS-p5，不与外部完整门禁争用资源：

   ```sh
   export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
   export NODE_OPTIONS=--max-old-space-size=3072
   node --version
   ```

   输出须为 `v24.19.0`。开发期 vitest 定向文件、`--maxWorkers=1`，逐批串行；不安装依赖、不新增 npm 包。

## 1 预先裁定（已批准项直接执行）

| 编号 / 来源 | 本步执行口径 |
| --- | --- |
| C6-D1；C6 §6.1、§7；报告 §3 | 接受 a/b/s/c/d 拆分。公式前装备输入、戒指点、能力发现由本地实现。允许窄改 `src/ext/stats.ts` 的装备 DTO、必要查询/槽位表达及对应 runtime/固定 DAG，保持旧调用兼容，真实导出后重新冻结；不重做 5A2-S，不关闭行/layer/预算守卫。growth 正式属性能力未补时明确 adept→titan fallback。 |
| C6-D2；C6 §5.3 | 底座验证遭遇生命周期，单调 ordinal/watermark，唯一品用目录固定序号紧凑收据（最多 128），loot state 目标 ≤4 KiB。6A1b 冻结实际字段、容量、溢出拒绝与全序证明；不能堆无限历史 key、截旧收据或漏掉乱序终结的遭遇。 |
| C6-D3；C6 §3 第 2 条 | 通用 moduleData 上限已批准：4 owner、每 owner 紧凑 UTF-8 JSON ≤4 KiB、每件总 moduleData ≤8 KiB、递归深度 ≤16；全局机械 Item roots 8,192。4 KiB owner 上限与 loot state 4 KiB 目标是不同对象，不能混用。 |
| C6-D4；报告 §5 裁定正文 | **唯一品允许分解、事前警告**，覆盖 C6 §6.2 表格及末段“拒绝唯一/待定”、报告 §5 表格里的旧建议和设计 §10.4“非唯一”限制。装备中/粘装仍拒绝；批量按成功整单件数 ×100 tick，10 碎片鉴定整件 100 tick；失败、陈旧、No 均整单 0 成本。唯一收据不因分解返还。 |
| C6-D5；C6 §5.1 | floor 武器先按原生频率投掷/近战分流，可转换近战不抽被替换的原生基底；vault 无法等价表达 qualifier 时整次原生回退，不丢机器约束、不发 loot 收据。未接管路径不得新增分流骰。 |
| C6-D6；C6 §9 | 开发期相关功能定向串行，收尾统一完整/组合/真实删除。集成人按实际结构统一分配 foundation/whole-run 新批次，不预占 14 或某 whole-run 号；recording 4/origin 2 结构不变则保留，codec 身份仍更新并拒绝旧档。 |
| C6 §3、§4、§5.2 | 顶层 moduleData 键就是启用模块 ID，validator 键等于声明 owner。数据只在可信创建/变更/加载发布口写入；普通 callback 无 Item 写权限。provider 同 source 只能一个，冲突构造期拒绝。 |
| C6 §5.1、§6.1；L-D10=C、L-D11=B | 任意击杀者的非行政死亡均可掉，排除的是死者盟友/克隆/无奖励/召唤副本。首版仅 floor/kill/encounter/vault，part/craft/site 不开放；无深度不伪造 depth=1。固定装配 12 武/6 甲/8 戒，无随机 spawn。 |
| C6 §3 第 6 条、§6.1、§7 | 武/甲 +0 是出生合同；6B3 前原生强化可改 enchantment，解咒可使 corrupted=true 且 isCursed=false，合法存档不能据出生等式拒绝。固定唯一 runicType 可写原生，完整符文强度重塑留 6B3。 |
| C6 §6.2、§6.3、§8 | 命令复用 `executeCommand` / `executeItemCommand`，显示只接已知投影。鉴定更新知识与摘要，不增机械 stat revision；不能在 getter/collect/hypothetical 内揭示。 |

本任务书的实现约定：测试模块拟名 `c6fixture`，目录 `src/ext/testing/fixtures/itemFixture/`，harness 拟为 `src/ext/testing/itemHarness.ts`；这些是本地组织方式，不是假称现存导出或新的维护者裁定。可以按实际代码调整文件名，报告逐项登记。新增错误诊断须稳定、可测试、走 foundation i18n，并在冻结表给出错误码；不从候选声明臆造“已实现”的错误 API。

## 2 接口合同与实现边界

| 实施责任 | 精确合同引用 | 冻结前必须落地的实物 |
| --- | --- | --- |
| 数据/注册 | C6 §3 第 1–7 条；§4 `ItemFacts`、`ItemDataValidationContext`、`ItemDataValidator`、`ItemContribution.itemDataValidators` | `Item.moduleData`、全原始 Item 行验证、owner 注册与生命周期；类型复用仓内 Json，不复制 loot 私有语义到 foundation |
| 掉落 | C6 §4 `DropEvent` 至 `DropAuthority`；§5.1–5.3 | `itemSdk.ts` 真实签名、宿主 authority、provider roll/settle、事件资格/回执/事务、遭遇声明与生命周期 |
| 装配 | C6 §4 `NativeAssembly`、`DropItemSpec`；§6.1 | C5/C6 共用的无 RNG 内部核心、新 C6 包装、全基底事实；不扩 `worldSdk.ts` 原模板联合 |
| 属性 | C6 §7 全表及末两段；§3 第 7 条；报告 §3 的 6A1s | 同一冻结装备事实进入实际求值与 hypothetical；节点名、单位、舍入、力量惩罚、来源预算与能力发现表 |
| 命令/展示 | C6 §4 `ItemCommandRead/Proposal/Provider`、`KnownItemFacts`、`ItemPresentationProvider`；§6.2（按 C6-D4 覆盖）、§6.3 | 受控物品计划、确认/CAS/时间、知识同步、名称/前景装饰、locale 与无泄露 DTO |
| 格式/冻结 | C6 §8、§9；报告 §3 的 6A1d、§4 | U03/摘要登记、格式身份、真实 Game fixture 全链、生产 codec 体积重测、SDK 导出/散列/类型见证 |

候选声明不是仅照抄 `.ts` 就算完成：必须用外部 provider fixture 从真实公开入口编译并运行；任何相对候选声明的差量在 6A1 报告中列“候选→实际→原因→覆盖测试”，最终同步 C6 合同。不得导出活 Item、Game、runtime 内部指针或可伪造后直接写世界的自由回调。

## 3 子步骤与停点

每子步完成后更新同一份 `docs/ext/phase6a1.report.md` 的相应小节，写实际文件、合同对应、门禁结果与未完项，再进入下一子步。停点不是独立版本发布；各子步不提交。a/b/s 可分批审阅，全部依赖在 d 冻结时闭合。

### 6A1a Item / codec / 校验

**范围与依据**：C6 §2 的 Item/快照/根/Inventory 行，§3 全部，§4 数据与 validator 类型，§8 原始 DTO 和坏档拒绝要求。修改 Item、EntitySnapshot、WholeRunSnapshot、runtime 注册、全根读取与 Inventory 各合并入口；先用中性数据物品证明持久化，不实现 loot 目录或生成算法。

- `moduleData` 仅一个通用可选字段。原生物品没有自有该属性；拒绝显式 undefined、null、空 map、未知/未启用/无 validator owner。安装时拒绝错 owner、重复注册及不合法贡献声明。
- 在任何 codec 丢字段/规范化之前验证原始行：有限 JSON、普通或空原型对象、稠密数组、无 getter/setter/符号/危险键/循环，预算按实际 UTF-8 编码，先安全检查再编码。owner validator 同步、纯、只收冻结脱离实体的事实；false、抛错及非法返回均拒绝。
- 全机械根与全部 entityGraph Item 行分别审计。保存前扫根；加载先验原始行、候选解码后复核引用/唯一机械所有者/目录/物化账本，完成后才退役活局。装备、visible/everSeen 历史引用不重复计机械根容量，但其中原始 Item 数据仍校验。
- `stacksWith`、materialCompatible、addItem 快路、hasSpace/预览、容器转移都拒绝任一带 moduleData 的合并/拆数量。正常迁移保持同一实例与 ID；候选/快照/回滚深拷贝不共享可变子对象。无 moduleData 的 C5 MATERIAL 保持原堆叠规则。

**停点验收**：

1. `u_01_instance_snapshot` 的字段与实例自有属性审计通过；缺席序列化/反序列化仍缺席；深拷贝隔离；owner/version/跨字段拒绝；每个预算恰好上限与上限+1（含多字节文本、深度计数约定）覆盖。
2. 活跃层、缓存层、背包、怪物携带、载客、坠落、purgatory、容器、escrow、纯历史图引用逐根放坏字段验证；重复 ID/重复所有者与合法装备引用分别测试。escrow 数据须验证，不因此放开原生装备作 crafting 输入。
3. 每类坏档、缺包、目录不符都在活局发布前拒绝，完整世界/引用、双流及计数、ID allocator、录像 generation/prefix 保持；不能只比序列化 JSON。
4. 未带数据物品的堆叠、容量和原快照路径不变；fixture 一件有效数据物品完成创建、迁移、save/load。完整 replay/seek 由 d 汇总补齐，不能把此停点称完整 C6。

### 6A1b 固定装配 / 四类事件 / 宿主事务

**范围与依据**：C6 §4 掉落类型及声明后 plan 权限段，§5.1–5.3，§6.1；C6-D2/D5。从 `assembleWorldItem` 提取无 RNG 核心，新增四来源服务，补宿主外层 checkpoint 和通用遭遇登记；真实 giants 声明式适配由本地完成。

- 12 武/6 甲/8 戒按登记基底复制 damage/clumping/flags/armor/strengthRequired/weight/identityId/glyph/color，quantity=1、无 quiver 堆叠 ID；出生 enchantment/熟悉度 charges/known/诅咒/runicType 按可信提案与数据一致性落地。戒指 implicit 只写一次，不再叠重复 stat 行；不得调用随机 spawn 后覆盖。
- floor 保留计量/食物/宝石与投掷资格，冻结原频率分流和闭区间取值向量。转换 false 后才执行原生回退；不接管路径保持原次序。vault 逐条列出 `MachineItemGeneration` qualifier、映射或整次回退理由；指定基底不抽、品质不靠重复领唯一的原生重试凑齐。
- kill 在 `captureDeath` 之前冻结出生/克隆/无奖励/盟友/leader/mutation/遭遇资格；携带物先落、服务后落、死亡 DF 最后。仅服务接管时抑制旧毒死/近战 `dropMonsterLoot` 两处；所有真正非行政死因进入同一安全点，外围部位不额外发事件。
- encounter 由底座核验声明主体出生、分裂、终结与行政失去，不读 giants 私有 state。alive→defeated 恰一次，行政失去转 lost；分裂最后主体/核心才结算；kill 的 encounterSubject 防双掉。冻结 ordinal 分配/消费时点、watermark 推进和持久预算，专测两遭遇交错/逆登记顺序终结，证明 watermark 不漏发/不重发；无此证明不能冻结。
- 提案按 C6 §5.2 顺序执行：资格/事实→外层 checkpoint→roll→提案校验→容量/落点→固定装配→acceptance→settle→state/Item/属性预算校验→一次提交→发布。死亡 checkpoint 必须在 captureDeath 前覆盖模块 deathCaptured、主体退役和携带物；生成复用外层生成事务。
- `prepare` 是可信安全点的一次生成，不是可反复取样的 UI 报价。计划由会话 WeakMap 按真实对象身份绑定 owner、局、命令/生成事务、eventId、revision、容量、实体；品牌类型不充当运行时权限。roll 实质 RNG 闭区间，≤64/件、≤512/事件；settle/验证/装配零 RNG。
- 最多 8 装备加至多 1 原生 GOLD 根，均计 8,192 根预算。容量/落点不足按提案顺序部分接受，保留已抽骰；无候选零落点骰，有候选沿既有候选次序/单次随机，floor/vault 外层唯一落点所有者不变。全跳过也消费遭遇事件，最多一次提示。
- acceptance 的 index/itemId/uniqueIds 严格对应；唯一只对实际落地提交，事件内临时占用防重复，跳过唯一可未来再掉。异常与预期跳过分开：结构/validator/settle/预算/计划失效或后续死亡 DF 失败，回滚完整外层世界、双流、ID、收据、goldGenerated、死亡标记、携带物、物化、绑定、缓存、消息/事实。

**停点验收**：全 26 基底逐字段/双流零消耗且 C5 原三模板结果不变；四来源成功/不接管向量；全部 vault qualifier 分类；近战、毒、法术、陷阱、盟友击杀及行政/克隆/召唤/无奖励/盟友死者负例；携带物时序；真实 giants 与中性 encounter fixture 的分裂/换层/lost/交错终结/load/seek/重访去重。满根、仅剩一个根且含金币、无落点、部分接受、全跳过、跳过唯一再掉逐项验证。伪造/复用/陈旧/跨局/跨 owner plan 拒绝且无额外时间/RNG。在 roll、ID 分配、落地、settle、物化、事实/消息、死亡 DF 各边界注入失败，用独立完整对象图写集差分证明回滚，保留 `ext_generation_checkpoint_differential` 原保护强度。

### 6A1s 属性接口补齐（6B1 冻结阻断项）

**范围与依据**：C6 §7 全表及末两段、§3 第 7 条、§6.1 戒指与 runic 映射；C6-D1。只补已完成 5A2-S 的接线缺口：装备事实、公式前本件基底与戒指点、可选能力发现、hypothetical、缓存失效与物化安全点。

- `EquippedStatItem` 增加深冻结的自有 moduleData/基底事实，不给 provider Item 指针；实际装备与 hypothetical 使用同一投影。明确 weapon/armor/left-ring/right-ring 身份，同基底双戒 sourceId 按实体 ID 分离（如 C6 §7 的 `loot.item.<id>.affix.<index>.<modifierIndex>`），不使用 `<baseId>#...`。
- 在固定 DAG 增加本地伤害/护甲公式前入口，不开放模块加边。brutal flat 与 keen 本件比例先处理基底，再走附魔、力量惩罚与既有公式；plated 先并本件 armor、reinforced 再作本件比例。真实伤害区间、预览与 hypothetical 同路求值，冻结实际节点名、输入单位、舍入顺序和力量不足向量。
- 逐项冻结单位适配：整 enchant→quarter ×4；显示 armor→内部 ×10；mending→regeneration-bonus 戒指点；shadow/noisy 按原生戒指点聚合（负点×4、环境折半、最终下限）；seeker ×20 一次、8 点=160；radiant 合并戒指点后执行原生零光规则。ring implicit 不重复输出；runic 固定值替换仍留 6B3，不误报强度全生效。
- swift 映射 equipment 槽、loot more≥−4000，最终速度沿 25…400；loot enchant/减伤来源聚合限界与全局 clamp 分开，不截其它模块来源。monsterScaling 不绕 owner/layer 守卫，选合法 environment 来源或受控出生基础端口，写等价向量及选择理由。
- 可选能力按真实注册键和版本化查询规范化，不按安装模块名猜测。growth 属性映射如本步发布，须列出无环实现、真实 `growth.attributes.v1` 响应与模块版本；否则明确 unavailable，adept→titan。combat 容量/恢复键同样按实际能力发现；giants 公开形态/遭遇能力不得借私有 state 读取。
- 装备/分解等机械变化经脏标记与 reconcile；降容钳制、升容不补，loot 无 refill-delta。出生倍率需满血时只用出生初始化安全点。知识变化只失效已知投影与 native/knowledge 摘要，不增机械 revision；load/seek/回滚重建会话缓存。

**停点验收**：上述每行至少一个正值/边界/负值（适用时）固定向量，覆盖力量不足、附魔与本地 flat/% 次序、再生精确分数、潜行负点、光照零点、单位 caps、两个同种戒指分别替换。未知词缀机械生效，knownOnly 比较不泄露；hypothetical 不改活体、账本、缓存、revision、双流。debug 全量重算与缓存一致；换装/卸装/知识改变/save/load/seek/回滚后均验证。growth/combat 有能力/缺键/缺席 fallback 规范指纹稳定；出生满血与之后升容不补分别验证。经典与扩展中性战斗差分、真实屠戮旗标与命中预览枚举继续通过。

### 6A1c 命令权限 / 知识同步 / 只读装饰

**范围与依据**：C6 §4 命令/展示声明，§6.2（C6-D4 覆盖唯一分解与时间）、§6.3、§3 第 6–7 条、§8 摘要通知。实现底座路由与中性 fixture 命令，不在 foundation 硬编码 loot 词缀/分解产量表，不实现真实 loot UI。

- 公开输入仍为 `executeCommand('ext:command', JSON.stringify({module,action,payload}))`；原生卷轴/熟悉度用现有可信入口与 `executeItemCommand`。itemCommands 与同名 commands 构造期冲突；不能套 wait 动作包装任意 Item 写入。
- provider `prepare` 纯、0 RNG/0 ID/0 tick，宿主封计划，核验 owner/背包与装备/粘装、数量、材料归属/堆叠/容量、允许的 tick 和修改种类。计划绑定模块 revision 及 Item/原生所有者事实；确认后重新 CAS，丢弃/换装/移箱后不能凭旧 revision 接受旧计划。只可 updateOwnData，自有外的 owner 字段不可改；identified/canBeIdentified 等由可信知识同步派生。
- 冻结 C6 §6.2 的严格 v1 payload：create 恰一次且 presetId 与 manifest configuration 一致；set-filter 带 revision、class 去重规范排序，0 tick 仍录像；salvage 1–26 互异背包 ID、整单原子、成功每件 100 tick；identify-shards 10 片/整件/100 tick。fixture 用同构中性 action 演示，真实 loot action 注册归 6B1。socket/unsocket/reforge 此时不注册，不做空成功。
- 唯一分解有 Yes/No 警告，装备中/粘装拒绝；碎片容量在移除输入后的候选背包中完整预检，MATERIAL stack99 可有多堆，不能假设任意产量只占一格。唯一收据保留；拒绝/取消/陈旧/中途失败整单不扣物/不出料/不耗时/不耗实质 RNG。拒绝不计成功接受；确认决策与拒绝事件是否留记录沿现有命令边界，以真实 replay 验证，不私设第二套日志。
- 卷轴、熟悉度和受控鉴定安全点同步 `identified ⇔ 全部 known`；保留种类知识/实例知识差别及合法原生强化/解咒状态。提供受控结算期揭示接点与 fixture，不在 `collect`/显示/比较中首次揭示；具体哪些 loot 词缀触发由 6B1 内容接线。
- 名称装饰会话弱绑定、原生名先算、inscription 最外层、不递归读取装饰 getter；卸载清理，load/seek 重建。owner project 可读原始数据，name/appearance/Vue 只读已知 DTO。floor 只露稀有度，未知戒指不露 baseId，未知行不含 id/tier/values/sourceId，未可靠暴露诅咒不传真值。无位置 getter 保守 floor；容器单独约定，不能冒充背包。
- 真正外观入口 `itemAppearance` 只在可见且非幻觉时请求稀有前景 token；幻觉整个分支不读真实稀有度，记忆沿存下的外观，不查当前真值；glyph 不变。名称/颜色/比较/显示过滤不写状态、脏标记或 RNG；机械自动拾取过滤通过已录制 state，显式拾取仍走原生命令。

**停点验收**：真实命令成功/每类非法载荷/未知字段/重入/陈旧/跨 owner/确认 Yes 与 No；唯一警告与整单原子；1 件/26 件计时、10 片鉴定、碎片多堆和满背包容量；确认期间所有权变化；计划篡改/复用与普通 callback 写 Item 负例。卷轴/熟悉度/逐条揭示→摘要改变且机械 revision 不变；中文 i18n、原生命名/铭文、floor/pack/equipped/container × 已知/未知、未知戒指、detect magic、诅咒暴露、幻觉/记忆逐格无泄露；重复只读调用双流与完整状态不变。未安装 provider 时原命令/生成/展示保持。

### 6A1d 格式统一 / 集成 fixture / 冻结

**范围与依据**：C6 §8 全部、§9 版本表；报告 §3 的 6A1d、§4 冻结表；C6-D6。由集成人统一版本与登记、黄金归因、全链 fixture、编码重测及文档，不把子步各自临时版本带入最终身份。

- 按 §8 的版本表实施同批格式身份；新增 Game 字段登记 U03，实体字段登记 ITEM_FIELDS/u_01。Item.moduleData 进入 native，遭遇生命周期/序号进入 foundation 对应摘要叶，known 变化进 native/knowledge；每个写入口显式通知。计划/弱绑定/缓存不持久化，不能靠统计脏标记替代录像摘要。
- 用真实 Game + 测试专用 `c6fixture`：生成→拾取→四槽装备与比较→地面/背包/携带/缓存/坠落/容器等合法迁移→知识/分解命令→save/load→逐条 replay 零 OOS→seek→续录。容器/escrow 合法性沿 C5，不能为了覆盖强行构造生产不接受的 crafting 输入；坏档覆盖另做原始 DTO 注入。
- 覆盖 plain snapshot、toSaveSnapshot origin/prefix、录制初始 digest、周期 full、checkpoint worker 与同步 fallback、seek 缓存预算、缺包/错误 codec/坏数据保活局。保留 digestChunk=256、checkpointPeriod=2048、seek 总预算 64 MiB/最多 128 的既定语义，除非另有确证设计变更；不能以体积为由删校验。
- 格式/trace/drift 变化先单变量回退本批生产文件归因，再按 `docs/testing.md` §3 原方法重录并逐叶登记。预期外壳变化与真实行为变化分列；loot 未安装的 RNG/规则差异不能简单重录掩盖。
- 以生产 serialize/deserialize/whole-run codec 重测 2,000 件带数据物品（mixed、五词缀、六词缀，和 6A0 同口径对照），测 UTF-8 实际字节、投影/编码/解码时间并核对无数据丢失。可在测试探针中只读使用固定纯包数据，不能安装 loot 或以 DTO 手动覆盖冒充生产 codec。若真实 loot manifest load 尚待 6B1，明确说明本轮 owner fixture 验证范围。
- 完成真实 provider 类型见证、SDK 导出路径/签名/版本/SHA-256、固定向量、能力响应、共享文件差量和门禁报告，更新 C6 的候选/实际状态与已覆盖裁定。报告保留本地候选身份；维护者后续实际验收合入 commit 才是对外派发基线。

**停点验收**：a/b/s/c 全部条目有结果，真实 codec/录像链与 worker/同步一致，损坏/缺包/旧身份拒绝保活局，§7 开发期最终门禁通过且失败历史如实保留，§10 冻结项除“维护者未来合入 commit”外有实物。当前只有类型声明、内部手工 fixture 或 DTO 覆盖测量时不得称 d 完成；未合入不得派发 6B1。完整阶段6/删除/浏览器待排期项目逐条标未验证，不妨碍如实报告开发期停点。

## 4 零影响、确定性与持久不变量

1. **经典与未接管扩展局**：不增加掉落/RNG/时间，不改变原生生成、两条旧掉落调用或展示；固定装配提取保持 C5 三模板结果；worldSdk/edibleSdk 字节保持。版本外壳可按统一批次改变；giants 经批准新增的通用登记若产生 foundation 元数据差量须单列归因，但无掉落 provider 时不得新增掉落行为或骰。
2. **机械所有权与存档图**：8,192 计唯一机械根，不重复数装备引用；持久校验扫描每个原始 Item 行，包含纯历史引用。迁移不复制物品，不把 moduleData 塞 worldItem，也不在 module state 存第二份物品真相。
3. **预期容量失败与异常失败**：容量/落点跳过保骰、accepted 唯一才记账，成功消费遭遇即推进收据；异常完整回滚。两者分别有 fixture 与注入测试，不能用同一个“返回 false”路径混淆。
4. **受控写与纯读**：所有改状态的玩家输入经统一命令边界；NPC 死亡/生成由宿主安全点处理。stats/显示/query 不开事务、不 reconcile、不揭示、不抽 RNG；未知机械生效与已知显示隔离。
5. **严格身份**：不迁移旧档、不剥坏 owner、不吞 validator/settle 错误；load/seek 只恢复既有收据与会话绑定，不派发历史掉落。

## 5 非目标与范围限制

- 不创建/安装 `src/ext/modules/loot/**`，不重写远端生成器、词缀数值/预设/目录，不在 foundation 引入 loot 私有类型或静态 import。
- 不重做 5A2-S，不合并经典与扩展战斗解算器；触达规则读点须保留中性差分与真实 ITEM_RUNIC 保险。
- 不做 6B2 真实 UI/主题成品、6B3 强化/符文强度重塑、6C 套装/插槽/符文之语/工位，part/craft/site 事件不开放。通用读口/装饰器/基础 token 可做，loot 页面留相应步骤。
- 不扩大 worldSdk 的冻结模板联合；不改 crafting/settlement/foraging/narrative 玩法；growth/giants 仅允许本任务的公开能力/声明适配与相应身份、定向回归，不读私有状态跨模块接线。
- 不启动全部 256 组合或完整 removal、不假称 6A0/阶段5证据覆盖本次生产变更；不做旧存档迁移、无障碍或逐骰 CE 一致性项目。
- 不改 package 依赖，不提交截图或 >1 MB 原始证据，不产生 CRLF。任何后续实施者都不 commit/push，报告交维护者处理。

## 6 测试 fixture 与共享文件清单

`c6fixture` 为测试专用、只通过真实 SDK 声明的模块，不进入生产 catalog/构建。具备中性数据物品 validator、四来源 provider、部分接受/唯一收据、遭遇声明、属性修正、受控知识/分解/过滤命令与 locale；另用冲突 provider 测安装拒绝。最小“一件物品”演示之外，必须有多 owner、双戒、满容量、带金币、乱序遭遇、失败注入与坏档集合。新增底座测试建议 `src/test/ext_item_data_*`、`ext_item_drop_*`、`ext_item_commands_*`、`ext_item_presentation_*`、`ext_item_stats_*`、`ext_item_recording_*`，按实际文件登记 `scripts/test-suites.json`，不是空写名字占覆盖率。

| 责任 / 子步 | 预计触达文件（相对仓库根；新文件名可登记后调整） | 限定 |
| --- | --- | --- |
| Item/根/codec；a/d | `src/engine/Items/Item.ts`、`Inventory.ts`；`src/engine/Core/EntitySnapshot.ts`、`WholeRunSnapshot.ts`、`WorldItemRoots.ts`、`WorldWorkValidation.ts` | 全行校验、非堆叠、候选发布；WorldWork/容器入口仅为对应防合并与校验，不放开工作配方 |
| SDK/注册；a–d | 新 `src/ext/itemSdk.ts`；`src/ext/types.ts`、`runtime.ts`、`compatibility.ts`、`descriptor.ts` | 贡献声明、权限与版本；不暴露可写实体 |
| 宿主服务/事务；b | `src/engine/Core/Game.ts`、`GenerationCoordinator.ts`、`WorldCheckpoint.ts`；`src/engine/Items/WorldItems.ts`、`ItemLoader.ts`；新固定装配/掉落/遭遇内部实现文件 | 明确 checkpoint 写集；机器 qualifier 类型按实际定义文件定位；审计 Monster 召唤/克隆/退役路径 |
| giants 本地适配；b | `src/ext/modules/giants/module.ts`、必要的声明辅助文件、`descriptor.ts` 与定向 tests | 声明主体/分裂/退役接线；私有 state/schema 仅确有持久变化时改并升身份，不能让 loot 直接读 |
| 属性；s | `src/ext/stats.ts`、`runtime.ts`；`src/engine/Stats/StatPipeline.ts`、`NativeStatKeys.ts`、`NativeStatSources.ts`；`src/engine/Items/RingBonuses.ts`；实际伤害/预览读点 `src/engine/Combat/Combat.ts`、相关公式读者与 Player/Game | 仅本件公式前事实、戒指点、能力发现、已知投影；不得另建 UI 公式 |
| growth 可选适配；s | 条件性 `src/ext/modules/growth/module.ts`、`statSources.ts`、`descriptor.ts` 与定向 tests | 真正发布属性能力才修改；否则记录 unavailable/fallback，不能无关扩展其它成长功能 |
| 命令/知识/展示；c | `Game.ts`、`ItemLoader.ts`、`ItemUseCoordinator.ts`、`Item.ts`；`src/engine/UI/Appearance.ts`、相关 ItemDetail/DetailGenerator 读口；`src/ext/registry.ts`、`src/ext/ui/creation.ts`（仅配置/初始命令桥） | 位置/知识安全、原生命令、确认/回放；不做 loot 页面。必要通用 locale/token 按现有归属落文件并在报告列明 |
| 格式/worker；d | `WholeRunSnapshot.ts`、`RecordingDigest.ts`、`RecordingFormat.ts`、`RecordingV4.ts`、`RecordingCheckpoint.ts`、`RecordingCheckpoint.worker.ts` 及相关身份读者 | 是否改每个文件以实际结构为准，整个 codec 身份同步 |
| 登记/fixture/报告；各步 | `scripts/u03-state-contract.json`、`recording-digest-contract.json`、`test-suites.json`、必要 `check-module-boundaries.mjs`；新 item fixture/harness、对应 src/test、C6 合同与 `docs/ext/phase6a1.report.md` | 守卫清单只按正式新责任登记，不放宽断言/越权；黄金仅归因后重录 |

`Game.ts`、`runtime.ts`、`stats.ts` 及格式身份由本地主笔独占修改；不并行派子代理写共享文件。`worldSdk.ts`、`edibleSdk.ts` 保持原散列；其余既有冻结导出逐项登记是否变更，不能一边改 stats 一边宣称“九冻结字节不变”。上表是预计影响面，不要求无差别改遍；超出表的必要读者修正先在报告补路径、依据与验证范围，不借此扩大玩法。

## 7 开发期门禁（C6-D6 已批准）

本节是本地实施时的门禁，**本次只写任务书不执行这些生产测试**。阶段6特定裁定覆盖开发期重复启动一般全量档的要求；全量/组合/真实删除仍在阶段6收尾统一安排，合入 main/打标签按届时门禁执行，不将定向通过冒充全量通过。

每子步停点执行相关批次并记录实际命令/退出码/文件与用例数/耗时；最终在同一候选源码上汇总跑全部本步新增与直接受影响项，未受影响的已跑批次可明确注明引用身份与范围。

1. **公共门禁**：`node scripts/check-module-boundaries.mjs`、`npx vue-tsc -b`、`npm run build`；相关读源码守卫含 `p1_30_i18n_gate`、`u24_hardcoded_text`、`repo_hygiene`、`test_suite_membership`，涉及目录基础读者时定向跑 `c_4a_terrain_catalog` 的对应守卫。不要仅靠类型编译证明 runtime 接线。
2. **功能文件选择**：先从 `scripts/test-discovery.mjs`、`scripts/test-suites.json` 及各模块自有 `test-suites.json` 确认当前归属，再用 `rg` 按实际读写点补文件，报告列出最终精确路径；下表是最低相关入口，不是按历史通配名启动全部扩展测试。

   | 子步 | 最低定向旧入口 + 新测试 |
   | --- | --- |
   | a | `src/test/u_01_instance_snapshot.test.ts`、`u_03_whole_run_snapshot.test.ts`、`ext_world_items_roots.test.ts`、`ext_world_work_boundaries.test.ts`、`ext_world_work_transactions.test.ts`，以及实际堆叠/容器/坏档/注册读者；新增 moduleData 全根集合 |
   | b | `ext_generation_checkpoint.test.ts`、`ext_generation_checkpoint_differential.test.ts`、实际 populate/blueprint/死亡/召唤/携带物测试；giants 自有发现器选主体/分裂/退役/持久文件；新增固定装配/四事件/事务/收据/能力伪造集合 |
   | s | `ext_stats_pipeline.test.ts`、`ext_stats_native.test.ts`、`ext_stats_runtime.test.ts`、`ext_stats_review.test.ts`、`ext_combat_neutral_differential.test.ts`、`ext_slaying_alignment.test.ts`；实际 growth/combat 能力/物化相关自有文件；新增公式前/单位/双戒/缓存集合 |
   | c | `x3b_item_details.test.ts`、实际鉴定/熟悉度/命令/时间/名称/幻觉/记忆测试、i18n 守卫；新增受控命令与纯显示集合 |
   | d | `u_27_recording.test.ts`、`x2a_recording_checkpoint.test.ts`、`x3b_display_recording.test.ts`、`u_r2_trace.test.ts`、`u_r3_trace.test.ts`、`u_r4_trace.test.ts`、`ext_recording_v4_digest.test.ts`、`ext_recording_v4_snapshots.test.ts`、`ext_recording_v4_storage.test.ts`、`ext_foundation_contracts.test.ts`、`ext_compatibility_diagnostics.test.ts`，以及当前发现器列出的受影响 U03/5A1/5A2 功能文件；新增真实全链/worker/缺包集合 |

   每批使用 `npx vitest run <明确文件列表> --maxWorkers=1`；占位符执行前换成实际路径。新测试登记归属，模块内部适配回归仍走模块自有发现器，不改共享清单强绑可删除模块。
3. **drift**：b 涉生成后及 d 最终候选运行 `npm run test:drift -- --maxWorkers=1`，源码读者守卫照常定向执行。drift 差异逐项归因；未接管原生路径不应改变生成/RNG，不能直接重录消除红灯。
4. **真实 engine-only smoke**：经典无 runtime、扩展空模块、既有七模块全开但无掉落 provider、c6fixture 单独、fixture+growth、fixture+combat、fixture+giants、fixture+growth+combat+giants、fixture+crafting/settlement 的容器路径、fixture+当前七模块全开。每组真实命令→save/load→逐条 replay→seek→续录；模块有无能力的负例另测。fixture 不计生产模块数量，这不是全组合矩阵。
5. **体积/性能定向测量**：d 使用真实 codec 2,000 件复测（硬件/Node/预热/次数/分位算法/竞争情况/样本构成），不能沿用 6A0 的候选 DTO 覆盖时间当生产新增成本。对 fixture 的 8 件掉落、缓存命中/未命中、hypothetical 比较做定向测量；设计 §11.3 目标分别为单掉落≤1 ms、查询 P95≤0.01/0.1 ms、比较≤2 ms。声明数据规模与是否含校验/装配/提交；真实 loot 有效目录≤20 ms、自然长局与 M4 留后续，不拿 fixture 冒充。超标如实定位，不改门限或省校验。
6. **留到收尾的门禁**：完整 `npm test`、全部 `test:ext`、`test:full`、强制 CE `test:gen`、全部组合/真实物理删除、浏览器/真机与最大负载长局，按维护者阶段6收尾排期执行（需 CE 的先 `npm run ce:fetch`）。6A1 内不自动启动。当前七模块=128 启用子集；加入 loot 后八模块=256，届时由发现器重算，真实删除也动态发现，不照抄旧 128 或阶段5布局数。

失败先归因：真实缺陷修生产并补回归；旧前提依赖已修行为时，只回退本次生产文件让原测试通过，再恢复新代码证明失败，之后仅修前提、不改断言语义。不得 skip、删用例、放宽容差/超时或改守卫让实现过关。保留首次非零退出与后续定向复核的不同身份；单 worker 复跑不冒称完整套件一次全绿。重录按 `docs/testing.md` §3，前后版本/字段/原因逐项列账。

## 8 版本处理（集成人统一分配）

| 身份 | 本步处理 |
| --- | --- |
| foundation 13 | C6 注册、掉落持久生命周期、stats 实际新增接口同一批升号；记录最终实值与引用位置，不预占 14，不每子步各加一号 |
| whole-run 6 / `brogue-web-whole-run-v6` | 新 Item 字段/编码合同统一升号；同步 codecIdentity、snapshot schema、RecordingFormat、worker 与类型/身份守卫 |
| recording 4 | event/header 结构不变保留 4，codec 指向新 foundation/whole-run；结构若变另升并登记理由；旧 codec 严格拒绝 |
| origin 2 | 前缀/输入状态结构不变保留 2，仍绑定新 header 身份，不接续旧规则 |
| world5 schema 4 / WorldWork SDK 1 / edible SDK 1 | 格式未改则保持；不得为 C6 新能力扩大旧 SDK 冻结联合 |
| C6 SDK | 原来不存在；候选 v1 以实际导出/类型 fixture/运行验收冻结，给出版本声明位置与 SHA-256 |
| stats / growth / giants | stats 发布新散列；growth 如实际新增能力、giants 如新增接线行为，各按规则/持久变化更新必要 module/rules/state 身份；无改动项明确保持，不无故改号 |
| loot module/rules/state | 6A1 不安装 loot，不能虚构本地新模块身份。6B1 必须按集成行为与 state 显式升 module/rules/state，不能沿用纯包 0.1.1 冒充；`LootItemDataV1` 的 v1/corrupted/数组顺序与实例合同保持 |
| 有效目录/预设 | 6B1 用固定静态包+规范 availability+manifest preset configuration 保护机械身份，locale 排除机械指纹；fixture 先证明配置与一次 create 一致及不一致拒绝 |

子步需要运行 codec 时可提前落本批次统一身份，但标候选且不对外发包；d 核对最终结构后只保留一套正式值。所有新字段/摘要叶、修改导出与历史格式拒绝策略纳入同一报告；不做迁移。

## 9 交付与报告路径

后续 6A1 交付代码、测试、更新后的实际 C6 合同及 **`docs/ext/phase6a1.report.md`**，不 commit/push。报告至少包含：

- 开工 HEAD/生产审计基线/设计固定提交、工作树差量与 Node 身份；C6 §2 接入点实际行号；每子步 done/not-done 和合同条目→实现→测试对应表。
- C6-D1–D6 执行结果，尤其唯一分解覆盖旧合同的记录；候选接口到真实接口差量、具体错误码/预算深度定义/装配基底表/vault qualifier 表/遭遇字段与全序证明。
- stats 解冻清单、真实键与单位/舍入/sourceId/slot/caps 表、增长能力实际响应或 fallback、growth/giants 适配路径与身份变化；旧 SDK 前后散列。
- 最终版本表、U03/ITEM_FIELDS/摘要域与显式事务写集登记；物化/缓存/知识通知点；原生强化/解咒合法档覆盖及 6B3 限制。
- 每条实际门禁的命令、退出码、计数、耗时与源码身份；所有首次失败、修复、单变量反事实、黄金逐叶归因与原捕获方法；worker/同步/seek/续录和缺包保活局结果。
- 2,000 件生产 codec 字节/耗时与 6A0 对照、定向性能结果及限制；未运行的完整/组合/删除/浏览器/自然长局/M4 项逐条标未验证。
- §10 每项实际值/路径/散列/测试证据；本地候选源身份与维护者未来验收合入 commit 分列，后者未产生就写“待维护者填写”，不得用任务书 HEAD 冒充。

原始日志、快照、截图与 >1 MB 证据放 `/private/tmp/phase6a1-*`，仓内只留可复现命令和小型摘要。不更新状态为“6B1 已可玩”；完成到本步即停，不自动实施后续阶段。

## 10 6B1 dot 包前置：6A1 冻结后必须逐项核对

依据 C6 §9、6A0 报告 §4、设计 §13.2。**6A1d 开发期验收、C6 实际冻结和维护者验收合入之后**才能派发集成包。下面任一必填项空缺，不能拿 6A0 候选声明或纯包 0.1.1 替代。本任务只列核对清单，不派发 dot、不编造未来 commit/hash。

1. **可复现基线**：6A1 验收合入完整 commit、分支、报告路径；最终 foundation/whole-run/recording/origin/world5/C6 SDK 实值；必要 growth/giants 身份及兼容声明。定向开发期已验与收尾未验范围分别列出。
2. **真实导出与散列**：`itemSdk.ts`、types 贡献入口、stats 接口、能力/遭遇导出、itemHarness、c6fixture 的真实路径、导出签名、provider 类型见证与 SHA-256；worldSdk/edibleSdk 保持值，stats 新值。冻结清单需覆盖 dot 实际 import 闭包，不给候选路径假散列。
3. **输入包与批准数值**：固定 `93523fc` 的 α core/β UI、core/UI 临时合同、v1.1 数值/调参和 M1–M4。33 非符文+21 符文变体+8 唯一、三预设与倍率确认；保留既有生成器与严格校验，集成适配不重写算法、不回退旧值，M4 按原排期。
4. **实例/验证合同**：`moduleData.loot` 唯一真相，LootItemDataV1 的 v1/corrupted/原数组顺序；4 owner/4 KiB/8 KiB/深16 与 8,192 所有者、6 词缀/8 固定行等各层上限；缺席语义、非堆叠、完整根校验、目录/owner/版本拒绝、合法强化/解咒例外。validator 真实注册方法和 detached facts 见证齐全。
5. **固定装配映射**：26 基底身份表、C5 不变证据、出生原生事实、charges/identified/runicType、戒指 implicit 唯一写入；不可调用随机 spawn。6B3 前符文强度限制写入包说明，不宣称完整重塑。
6. **生成向量与回执**：roll 闭区间、单候选不抽、每件/每事件预算、腐化/固定行/名称/金币次序与纯包错误边界；floor 分流和转换 false 原生回退、vault 每个 qualifier 的映射/不接管；8 装备+金币根、容量/落点部分接受、accepted unique 对应、保骰与异常回滚分别有固定向量。
7. **遭遇与可选形态**：通用声明、subject 分裂/退役/换层、ordinal/watermark 的确切字段/上限/乱序证明与加载恢复语义；唯一目录序号映射/指纹、≤4 KiB state 的最坏预算；真实 giants 声明接线可用，dot 不碰其私有 state；part/craft/site 不在首版协议。
8. **属性接线表**：实际可用键、公式前节点、quarter/armor/再生/潜行/感知/光照单位与舍入、四槽/双戒 identity、合法 sourceId、equipment 槽、来源预算/全局 clamp、物化与出生初始化；knownOnly/hypothetical 与缓存对照 fixture。不能将 `LootModifierDraft` 强转 `StatModifierRow`，β 临时比较公式须换真实 API。
9. **可选能力与有效目录**：growth/combat/giants 的可用性规范化响应、实际键/查询版本与缺席 fallback；growth 未发布属性能力时 adept→titan，不能看模块名宣称可用；能力稳定排序参与有效目录指纹，无空壳硬依赖。
10. **命令/确认/时间**：唯一分解允许且警告，唯一收据不返还；批量每件100 tick，10片鉴定100 tick，失败整单0成本。真实 envelope、严格 v1 payload、revision/CAS 与会话计划、所有者重验、容量多堆、Yes/No 记录、拒绝码、鉴定知识同步/结算期揭示均有真实命令与 replay fixture。preset 同时进 manifest 与一次 create，set-filter 0 tick 仍录像；未来 socket/工位命令未接线不注册。
11. **显示与 β UI 交接**：已知 DTO 的位置、种类/实例/极性/诅咒暴露字段，名称/前景插槽/i18n 键与主题 token；floor/未知戒指/幻觉/记忆不泄露；容器位置属于新增扩约，不能强转 β 原 floor/pack/equipped。通用 UI/主题接线仍归本地，真实 UI 验收归 6B2。
12. **模块身份与材料**：填 6B1 新 module/rules/state 计划，0.1.1 只作纯输入身份；机械 pack/availability/preset 纳入规则身份，locale 除外，旧档严格拒绝。loot.shard 经现有 `worldDefinitions.items` 注册 MATERIAL、stack99、无 moduleData，沿 C5 容器与容量；不发明 registerItemDefinitions API。
13. **dot 可写边界与发现器**：仅 `src/ext/modules/loot/**` 与 loot 自有文档；自有 descriptor/locale/test-suites，实际自动发现入口与 harness 示例随包。禁止改 Game/共享 codec/types/stats/其它模块/package；共享缺口列清单交本地补 SDK，不在模块目录绕过权限或关闭守卫。
14. **6B1 验收与后续排期**：包内定向 schema/预算负例/纯生成固定向量/fallback/指纹，加真实 Game 自然击杀→掉落→装备→生效→鉴定→分解→save/load→replay/seek/续录。列明开发期门禁与收尾完整/256 组合/真实删除/浏览器排期；体积/真实性证据不能用 6A0 候选覆盖或仅 mock 替代。6B2/6B3/6C 各自仍需后续授权，不随此包自动开工。

## 附：必须带走的旧文档差异

- C6 §3 “预算待批准”、§6.2 “拒绝唯一/鉴定时间待定”与报告 §4 “门禁待填”均已有报告 §5 裁定覆盖；本次只写任务书，6A1d 冻结时再同步合同实际状态，不能让 dot 自选相互冲突的旧段落。
- 设计旧 mapTileDrawing 着色位置更正为 `Appearance.itemAppearance`；`registerItemDefinitions` 更正为现有 `worldDefinitions.items`；旧 encounter 私有查询更正为底座验证生命周期；旧录像 v3 风险描述更正为当前 recording4 摘要与周期完整快照。
- 6A0 五词缀 2,000 件净增约 1.063 MiB，六词缀约 1.186 MiB，均为候选 DTO 测量；不再引用旧估算“约420B/件、0.6–0.9MiB”作验收实测，也不据此擅自压缩或砍词缀。6A1d 必须用真实 codec 重测。
- 本地 6A1 只解锁底座，6B1 才验证真实 loot 内容自然闭环；“SDK 已冻结”“模块已接线”“真实 UI 已验”“阶段6全面验收”是不同结论，报告按实际结果分别写。

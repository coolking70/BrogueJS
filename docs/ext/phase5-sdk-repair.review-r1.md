# SDK-1 / SDK-2 独立 R1 审查报告

**结论：未发现确证生产缺陷；SDK-2 在本步范围内通过，SDK-1 已覆盖的修复路径通过，但“冻结袭击动作”缺少合同要求的验证，当前不能将整个 SDK 步骤无条件收口。** 建议原作者补齐该窄回归及报告，再交最多一次 R2；不安排 R3。

这是六项收口后的独立 SDK 步骤 R1，不是六项 R3。报告由现有 wrapper 保存为 `foundation-sdk-r1.final.md`。

## 审查对象与身份

唯一候选为 `/Users/coolking70/Documents/同步空间/BrogueJS-p5`、`ext/phase5`、HEAD：

`6954ee770a92e2dec6bc79a53e5245e42561f6de`

已读取 AGENTS 必读文档、SDK 任务书及作者报告、执行根补充合同，以及固定 `4ea702c0fce7a25cea9be0bf92b27dbd3ff29677` 的 combat2 acceptance、两份 SDK 补丁草案和回归草案。

开审和结束时均逐字节核对 `foundation-sdk-candidate-final.json`：**八路径 SHA256 全部相符，HEAD 未变。**

| 路径 | SHA256 前缀 |
| --- | --- |
| `src/ext/runtime.ts` | `df45a559a867` |
| `src/ext/modules/growth/module.ts` | `6f22517d300a` |
| `src/test/ext_generation_actor_identity.test.ts` | `49a1e94d085d` |
| `src/ext/modules/growth/tests/ext_growth_death_projection.test.ts` | `1ef9e1214726` |
| `src/ext/modules/combat/tests/combat_sdk_generation_identity.test.ts` | `a4843859b25d` |
| `scripts/test-suites.json` | `31a47ce7ef81` |
| combat `test-suites.json` | `2254556abdc4` |
| growth `test-suites.json` | `1ce19bd51afa` |

审查期间父所有的 `commander-status.md` 出现并发变化；未将其纳入候选审查，也未修改它。

## S1 / S2 / S3 确证生产问题

- **S1：无确证发现。**
- **S2：无确证发现。**
- **S3：无确证发现。**

下列验收缺口不作为已复现的产品缺陷计数。

## 必须补齐的验收缺口

### C1：当前缓存 NPC 回归没有覆盖冻结袭击动作

位置：[ext_generation_actor_identity.test.ts:110](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/test/ext_generation_actor_identity.test.ts:110)。

该场景只安装独立动作协议和 `generation-fault`，创建普通 rat。离层后第117行明确断言动作已变成 `break-recovery`。它有效证明：

- 普通 NPC 的未释放攻击在离层时被中断；
- 缓存层恢复时钟被冻结；
- 随后的生成回滚保留 ledger 图；
- 返回后能够结束动作并存读。

**这不是合同要求的冻结袭击动作。** 真正袭击路径由有效、暂停的 raid 根产生 `frozenRaidActorIds`，在 [ActorActionProduction.ts:134](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/ActorActionProduction.ts:134) 允许 `preserveOnDepthExit`，保留尚未释放的攻击；缓存读档也为该路径设置特别准入条件。当前测试走的是另一个分支。

影响：尚无证据证明保留 windup/待释放段的袭击动作，在生成子回滚后仍保持 metadata、资源、scheduler 镜像和后续释放闭包一致。现有受影响批次没有补足这项 SDK 场景。

最小补充建议：

1. 在正确模块归属下，用真实有效 raid 根建立已付费、仍有待释放段的动作；需要独立动作协议时明确隔离，不能仅伪造 `frozenRaidActorIds`。
2. 离层后断言袭击资格成立、原攻击阶段保留，并非 `break-recovery`。
3. 执行生成子回滚，核完整 ledger 值及 action/resource 子对象身份；推进另一层时核资源、阶段和原生镜像冻结。
4. 对冻结中的完整存档做实际读取和完整快照比较，返回后核原段及结束回调完成。
5. 保留当前普通缓存恢复测试，报告分别记述两种语义。

本项要求来自补充合同 B5 和 SDK-1 任务书，不是新增内容集成范围。

## SDK-1 实现审查

[ runtime.ts:1520 ](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/runtime.ts:1520) 在每个 generation frame 建立时捕获恢复器，时点正确。子提交不覆盖父检查点，因此父失败仍能恢复父入口的图。

[ runtime.ts:1556 ](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/runtime.ts:1556) 先恢复模块状态快照，再恢复原活 ledger 和全部旧子对象，随后恢复组件、世界、原生资源、因果及统计，最后关闭 frame 并通知回滚。恢复器同时重新挂回原 ledger，避免只恢复失联对象的数值。

三个正式测试的相关语义成立：

- 根回归确实覆盖 no-op、真实数值和数组修改、旧 action 删除、嵌套子提交后父回滚、其他模块发布异常、并发 NPC/玩家、休息及后续结束。
- 独立对象图 oracle 检查引用、数组、子对象和值，强于存档投影。
- combat 回归确实通过真实旧包 `fixture.stomp` 的公开付费命令启动动作；没有用中性协议替代该内容复现。
- 复合来源测试使用真实生产执行器，诊断绑定留在隔离 registry。
- 完成后的存读比较保留完整快照，只同步 `savedAt`。

本审查另执行两个同步、纯内存 runtime 探针，均 exit0：

- 无动作图中新增 action/resource 记录，回滚后删除新增记录并保留原数组身份；嵌套回滚恢复子入口的中间图，父回滚再撤销父内新增记录。
- 子提交后其他模块发布异常，恢复 ledger、组件、原生 HP/maxHP/gold；只读回滚通知看到完整恢复后的 runtime。

这些探针使用诊断图写入，不冒称实际公开动作建立的全生命周期回归。

### 恢复器异常边界

`states` 替换与 `restoreActorState()` 之间没有新增外部回调。正常活 ledger 来自脱离输入的可变 JSON，恢复器对旧对象做原位恢复；未找到合法生产路径会在此把旧节点变成冻结对象、访问器或 Proxy。

但实现**没有承诺恢复器自身抛错时仍能完成整个回滚**：若原位恢复抛错，第1556行之后的组件、资源、统计和 frame 关闭不会继续。这是必须区分的边界，不能将“其他模块发布异常可恢复”扩大解释为任意恢复过程异常均原子。未复现合法输入触发该失败，因此不列为产品缺陷，也不建议为假设性外部图破坏扩改生产。

原生世界、scheduler 图和会话恢复仍由 Game 的外层生成检查点负责；本次没有扩张 runtime 子事务的原合同。未发现盲删 metadata 或弱化镜像、存档守卫的改动。

## SDK-2 实现审查

[growth/module.ts:654](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/growth/module.ts:654) 显式投影既有十字段，正确适配合法 `ActorFacts.movementRegionId`；没有放宽持久 schema。

核实结果：

- `player`、`rewardEligible === false` 的提前过滤保持；
- `origin` 和 `administrative` 保持；
- 持久 DTO 中的 `movementRegionId`、任意 `extra` 负例仍被严格工厂拒绝；
- square、fixed-zone、composite-core × 玩家、盟友、行政死亡九场都走实际 Game 死亡路径；
- 普通死亡保存真实来源，行政死亡核实来源清空和行政标记；
- 玩家27全奖、盟友21/6分成、重复终结不重复奖励、收集幂等及完整存读均有断言；
- growth 来源过滤、GC 和收据代码未改；整个 `giants2_foundation` 已有本步通过证据，包括35045d9相关来源保留和收集幂等回归。

这些空间形态使用独立 body fixture，证明底座与 growth 协议；原 seed118 则另提供真实 combat2 内容路线证据。两者没有混称。

## 归属、隔离与原输入

新增测试分别登记根、growth、combat，归属合理。

根回归明确安装独立协议 descriptor；根支持文件没有硬导入可删除 combat/giants 包。growth 回归只启用 growth 与独立 body fixture。撤掉协议 fixture 后，新建真实 registry 拒绝其 save/recording，并保留旧玩家对象。

上述结果支持源码层面的可删除性和真实规则身份拒绝；**本步没有执行新的物理删除布局，不能据此称15布局已验。**

隔离 combat2 树的以下文件与固定参考逐字节相同：

- 原 `combat2_sdk_repro.test.ts`；
- seed23、seed118 输入夹具；
- `combat2Harness.ts`。

新增持久化诊断核对原 `initialCommands`，执行原 prefix 和原 attempted。`mechanical()` 保留整个 `toSnapshot()`，仅将 `savedAt` 置零。本审查读取既有完整 expected/actual 对象，确认两 seed 全对象相等；没有裁缓存、世界、RNG 或生成字段。

## 首败、反事实及证据真实性

已核原 Vitest JSON、raw 摘要、results、summary 和清单列出的12个 done；不是依据 READY 或作者 exit0 作结论。

- 原公开输入首败为 metadata/scheduler mismatch、growth 非法模块状态，真实保留。
- 两生产文件分别单变量撤回，各批内部 Vitest 均 exit1；wrapper exit0只是批次执行完成。
- 最终根文件撤 SDK-1：9败/2过，测试哈希与候选一致。
- 早期 cause 身份文件明确标注为按实际操作重建，未冒称现场哈希；重建基线哈希与固定 HEAD 相符。
- FOV 诊断三个配置的1939项差异数组完全相同，且全部为 `isVisible`；刷新后都为零。结合手工替换 arena 几何这一前提，补 `updateVision()` 合法。既有测试、断言和完整快照字段未被削弱。

末次24项保留此前23项全部名称并全部通过，只新增真实生成 revision 回归。前后候选清单只有根测试变化；生产、另外两测试和三份登记保持。因此已通过的生产相关批次可复用，最后三文件完整补验及 types 足以覆盖该末次追加，无须重跑全部批次。

| 本步证据 | 核实结果 |
| --- | --- |
| 最终三个 SDK 文件 | 24过，0失败 |
| 生成/动作生命周期 | 12文件，224过 |
| growth 来源/奖励/GC | 6文件，65过 |
| combat 相关生命周期 | 4文件，74过 |
| 源码/存档/模块守卫 | 7文件，86过 |
| 隔离原公开输入及完整存读 | 2文件，4过 |
| 实际 drift | 7文件，14过 |
| c4a 名称过滤 | 3过、27项未选中 |
| boundary / types / build | 实际 exit0 |
| 最后补验 types | 实际 exit0 |

上述正向批次原始记录未报告 unhandled。c4a 的27项属于名称过滤，不计真实 skip；各批和23→24的复测不累加为总覆盖数。

## 性能与 revision 差异

60次测量包括两次 begin、子 rollback、父 commit；前10次预热，后50次计时。计时之外才检查对象图、完成动作和存读。P50 `0.050292ms`、P95 `0.060459ms`、max `0.065792ms` 与记录相符。

新增捕获递归保存 **actor ledger 各节点的浅副本及引用**，不是深拷贝整个活世界；成本仍随 ledger 图大小增长。`projectWholeRun` 反例证明没有借完整原生世界投影，但不能把它当最大 ledger 负载性能证明。

真实原生生成9样本为三 seed 的 D2–D4。计时包含 `generateDepth`，不包含场景初始化、后续快照、hash及压缩写证据：

- 基线 median/max：`148.028 / 188.001ms`；
- 修后 median/max：`157.426 / 201.222ms`。

样本有限且固定顺序，不能精确拆出修复成本或承诺最大负载；未发现足以确证不可接受成本的证据。外部性能探针的捕获附加行位于计时结束后；按操作记录重建出的探针哈希与实测身份相符。

本审查独立逐叶比较九对既有完整对象：

- 七对完全相同；
- seed23 D3 仅 `extensions.modules.combat.revision`：`4→5`；
- seed23 D4 仅该叶：`5→7`。

**基线差异不是零。** 旧观察器在D2 blueprint回滚后首先丢失 session/live 身份，之后 live/session 为 `3/2、4/3、5/4`；修后为 `3/3、5/5、7/7`。结合真实 `leftDepth` 闭包的 revision 增量和协议 fixture 首访 placement 增量，当前这三个首次入层场景每层正确增加2。旧离层增量落在失联 ledger，解释成立。

完整世界、缓存、RNG及生成字段未被归一化遮蔽；无需将这两叶解释成地图或随机变化。既有 drift14项通过，黄金和生成基线文件没有改动。

## 范围、未验与交接

本次没有修改生产、测试、黄金、文档、状态或外部内容树，没有派代理、commit/push/merge/tag，也没有启动新的 npm/ext 全套、128组合、15布局或 CE fetch/full/gen。两个内存探针同步完成，无本审查遗留后台任务；作者清单中的12批均有相符 done。系统禁止 `ps`，因此没有追加进程表审计。

未验包括 C1 的冻结袭击动作、最大 ledger 负载、后续集成组合和人工场景。giantHit/zombie 内容缺证据、bonfire/jackal 集成前提、最终全量及人工验收仍归后续；XP skip和5D3另案，不扩大本步。

**交接裁定：生产修复未发现确证缺陷，先补 C1 的正式窄回归和对应报告。补齐后由最多一次 R2复核；不能把当前普通缓存恢复测试当作冻结袭击合同已经关闭。**

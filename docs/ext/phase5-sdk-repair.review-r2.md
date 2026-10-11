# SDK-1 / SDK-2 独立只读 R2 最终报告

**结论：R2 通过。R1-C1 已关闭；未发现新的确证生产问题，SDK-1 / SDK-2 可按本步骤范围收口。** 本轮是 SDK 步骤第二且最后一轮，不安排 R3，不重新审查已收口六项。

## 审查范围与源码身份

审查工作树：`/Users/coolking70/Documents/同步空间/BrogueJS-p5`，分支 `ext/phase5`，HEAD 始终为：

`6954ee770a92e2dec6bc79a53e5245e42561f6de`

已读 AGENTS 必读文档、SDK 任务书、作者报告及末节 R1-C1、R1 审查报告、执行根 `pipeline-supplement-20261011.md`。

独立逐字节核对结果：

- `foundation-sdk-r1-fix-candidate-final.json` 十路径全部匹配当前文件。
- 十路径与 `foundation-sdk-c1-candidate-before-gates.json` 完全相同。
- 原八路径与 `foundation-sdk-candidate-final.json` 完全相同。
- 隔离 `foundation-sdk-c1-tree` 最终十路径也全部匹配。
- 本次 C1 补充仅新增 settlement 测试及登记，没有生产、黄金或生成基线变化。

| 路径 | SHA256 前缀 |
|---|---|
| `src/ext/runtime.ts` | `df45a559a867` |
| `src/ext/modules/growth/module.ts` | `6f22517d300a` |
| 根 SDK1 回归 | `49a1e94d085d` |
| growth SDK2 回归 | `1ef9e1214726` |
| combat SDK1 回归 | `a4843859b25d` |
| 根套件登记 | `31a47ce7ef81` |
| combat 套件登记 | `2254556abdc4` |
| growth 套件登记 | `1ce19bd51afa` |
| settlement C1 新回归 | `f660ef0bf45c` |
| settlement 套件登记 | `d15c651cc60f` |

## S1 / S2 / S3 确证发现

- **S1：无新的确证生产问题。**
- **S2：无新的确证生产问题。**
- **S3：无新的确证生产问题。**

下述覆盖限制和报告术语澄清单列，不计为产品缺陷。

## R1-C1 关闭依据

### 真实 raid 根与冻结资格成立

[新回归第19行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts:19) 经真实 settlement 配置、公开付费建立 home、建造 bedroom、招募 resident，再推进权威世界时钟与执行等待，由生产 raid 编排生成 active 事件和原生成员。测试核预算、事件阶段及 `validateRaidReferences`；没有直接伪造 raid ledger 或 `frozenRaidActorIds`。

动作后端明确使用独立协议 fixture：版本 `0.0.1`、独立规则指纹，替换测试 registry 中的可选 combat descriptor；settlement 保持真实 descriptor 和准入。它证明 SDK 与真实袭击生命周期的组合合同，不冒称自然 combat2 内容路线。

原生 rat/kobold 决策实际付费启动双段攻击。随后通过公开楼梯命令离层，raid 根真实进入 pause，生产派生冻结集合包含该成员。[第80行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts:80) 检查原 windup、两待释放段、metadata、资源及原生镜像保持，且没有 `break-recovery`。

这对应 [ActorActionProduction.ts:134](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/ActorActionProduction.ts:134) 的 `preserveOnDepthExit`。原普通 rat 缓存恢复测试仍保留其 `break-recovery` 语义，二者没有混称。

新文件归属 settlement 并登记其套件；根 SDK 回归及协议支持文件没有新增 settlement 硬依赖。

### 子回滚和异层冻结检查有效

[第91行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts:91) 调用生产 runtime 的 floor/blueprint 子事务，执行 no-op 子 rollback 后父 commit。核对包括：

- 完整 ledger 值及独立 ledger/root 对象图 oracle；
- 原 ledger、action、resource、root、scheduler 身份；
- metadata、资源、动作与原生镜像守卫；
- RNG 和完整 `toSaveSnapshot()`，仅归一 `savedAt`。

这是受控调用生产事务入口的回归；不把它描述为自然内容路线中的 blueprint 失败。

异层推进 `96000` 世界 tick 并执行六次公开 wait 后，阶段、资源、原生 ticks、HP、位置及全部 `statusDurations` 保持；`nextActionId` 和所检查的 raid 经济字段没有变化。没有冻结期间额外收费或重复结算的证据。

### 两种真实读档路径均成立

[第112行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts:112) 的两场分别覆盖：

1. `h.load` 调用实际 `Game.loadSnapshot`，替换活会话。
2. 原生 `withReplayCandidate` 中实际执行 `candidate.loadSnapshot`，随后恢复全局服务并续行原会话。

第二条没有 mock 解码器。[Game.ts:4496](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:4496) 的候选作用域在 `finally` 恢复 RNG、时钟、分配器、Logger、ItemLoader 等服务。原 scheduler 和 ledger 身份保持；返回后进一步核原 action/resource 引用。结合 phased session 的身份复用条件及原 scheduler 未替换，后续使用的是保留的旧 session/finish 闭包。

两种读取均比较完整保存对象，保全部缓存、世界和模块字段，只归一 `savedAt`。未使用裁字段或仅 hash 相等代替完整比较。

### 返回和完成合同成立

返回原层后 pause 解除，原攻击状态仍保留。测试仅将合法玩家目标准备到原锁定格，没有修改攻击 metadata 或移动攻击源。

[第141行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts:141) 使用真实生产 scheduler 推进，两个 spy 未替换原实现。断言覆盖：

- 原段释放顺序 `[0,1]`；
- 两次真实原生近战调用；
- 一次终末 sweep，累计 `180` tick；
- 原 bundle/action 清除；
- 原费用不重收，恢复阶段正常回 `2` 点；
- `nextActionId`、事件身份及所检查的 raid 经济值保持；
- 完成后再次真实存读，metadata 不复活。

经济证据限于 event/ordinal、loss、营地消耗和 gold 等检查。新回归没有安装 growth，也没有杀死 raid 成员，**不构成新增 XP 或死亡奖励覆盖**。SDK2 原奖励、来源及收据证据仍独立保留。

## 首败、反事实和门禁真实性

独立核对了 `foundation-sdk-c1-final.summary.json`、相关 commands/results、原 Vitest JSON、raw 日志和八个实际 done；没有以 READY 或数量替代判断。

新夹具首败处理合理：

- wait 后玩家实际离开楼梯格，楼梯命令没有离层；仅撤 SDK1 仍得到相同入口失败和诊断值。重新准备楼梯入口是新场景布景修正。
- 返回落点为 `(30,24)`，原锁定格 `(30,25)` 为空，导致零接触；日志同时显示终末 sweep 已发生一次 `180` tick。将目标准备到原锁定格符合原接触合同，没有修改 metadata、生产过滤或断言语义。

最终原新文件的单变量对照成立：

| 证据 | 内部 exit | 结果 |
|---|---:|---|
| 仅撤 SDK1 runtime | 1 | 0过／2败，均在 ledger 身份断言首败 |
| 隔离树恢复 SDK1 | 0 | 2过／0败 |
| 当前树新 C1 整文件 | 0 | 2过／0败 |
| 既有 raid 整文件 | 0 | 28过／0败 |
| membership 整文件 | 0 | 6过／0败 |
| types | 0 | 完成 |
| boundary | 0 | 完成 |

撤回 runtime 的 SHA256 与 HEAD 原文件相符；对照前后最终测试及登记字节一致，growth 未变。cause/counter wrapper 的 exit0 表示批次完成，内部预期 exit1 被保留，没有冒称通过。

原 Vitest JSON 的逐项状态与汇总一致：本次无真实 skip、todo 或名称过滤；raw 未报告 unhandled。CE 缺失提示不代表这些已执行用例发生 skip。八个 stage 的 done 与 launch metadata 相符，记录独立 session、process group 和 nohup；重负载按 Node24、3GiB、单 worker 串行执行。

## 两生产边界与范围限制

必要复核未发现边界退化：

- [runtime.ts:1520](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/runtime.ts:1520) 按 generation frame 捕获身份恢复器，[第1556行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/runtime.ts:1556) 在恢复模块值后挂回原 ledger 图，再继续后续恢复；没有盲删 metadata 或弱化镜像守卫。
- [growth/module.ts:654](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/growth/module.ts:654) 仍显式投影既有十字段；过滤、origin、administrative 及封闭 schema 保持。

原八路径不变，支持沿用 R1 已审的 SDK2、224／65／74／86、原公开输入、drift 等证据；本轮没有重新运行或重新宣称这些批次。

R1 限制继续保留：两个内存探针、60次小图和9次原生生成均为有限样本，最大 ledger 负载未测；恢复器自身抛错不保证后续清理完成。未发现合法触发证据，不要求假设性扩改。

另有一处**非阻断报告术语澄清**：[作者报告第109行](/Users/coolking70/Documents/同步空间/BrogueJS-p5/docs/ext/phase5-sdk-repair.report.md:109) 将 finish 参数写为 `actionId=1`。实际签名是 `(ownerId, depth, elapsedTicks)`，证据应记为 `[actorId, depth=1, elapsedTicks=180]`。action 清除另有独立断言；此文字误标不影响 C1 关闭。

本审查仅做只读源码与证据核验、同步内存汇总校验，没有新跑测试门禁、写文件、派代理或启动后台任务，无本审查遗留子进程。作者八个 stage 的 done 已核；父已实际确认无相关子进程，本轮未重复进程表审计。

## 最终交接

**R1-C1 关闭，SDK R2 通过，可收口。** 父可按已有授权提交推送 SDK，随后按固定顺序集成 narrative2 `1d0d900`、combat2 `4ea702c`，在最终组合候选统一执行约定全量。

本报告不代表新的全量、128组合、15删除布局或人工验收通过。giantHit、zombie、bonfire、jackal、XP skip、5D3及 Claude 最终人工仍属后续，不扩入本步骤。

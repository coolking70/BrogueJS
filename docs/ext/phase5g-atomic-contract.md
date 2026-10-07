> 发布说明：本建议已由维护者采纳进 [返工包](phase5g-revision.dot-package.md)。下文probe文件属于本地外部证据目录 /private/tmp/brogue-commander-20261007/phase5g-atomic-contract/，不随仓库发布。指挥另用Node24重跑同一32场景，结果一致；仍是合成writer探针，不是Game回滚验收。

# SDK-03 原子性合同交叉审查

审查日期：2026-10-08。只读对象：`/private/tmp/brogue-commander-20261007/phase5g-review-tree`，HEAD `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`。下列源码行号均相对此树。**本文为维护者裁定建议，不代表用户已逐条批准，也不是修复交付。**

## 裁定摘要

**事实：三个写入段的 catch 确实隐藏了事务失败信号。推荐保留写前验证的保守 return，移除写入段吞错，让故障传到已有事务边界。** 不必增加 SDK 返回值协议、改冻结九文件或升存档/录像格式。最小生产改动属于 dot 的 `foraging/participants.ts`；本地负责明确合同及审核事务验收，不需要为 SDK-03 先改底座生产代码。

**未找到已证明可由正常游玩触发、比报告更严重的生产故障。** 报告的具体吃菌数值仍是其真实 Game 故障注入证据，本审查没有重复该复现。可信 writer 存在主动抛错的守卫，不能据“可信”推导其保证永不抛；但当前 foraging 的验证和合法同步调用通常满足这些守卫，不能把注入反例描述成日常必现故障。

另一个须精确表述的事实：`onNeedEvent` 无条件使用降级路径，包括喂食产生的 band 事件；传播它的写入异常**不等于**整条 feed 必然回滚。此处基线与旧 E29 的概括用语有差距，不能在本次改 catch 时悄悄扩大底座事务范围。

## 1. 四类情况：文字合同与执行合同

| 情况 | 现行承诺与实际边界 |
| --- | --- |
| 正常事实、正常可信 writer | 同步 void 参与者通过受控 tx 写知识/组件、消息及模块记账；正常返回即成功。runtime 并不独立核对“是否全部业务步骤都写完”。合法的 `markKnowledge` 返回 false 是业务结果，不是事务失败标志。 |
| 畸形 fact/state、重复或非本模块事实 | §6.4 要求非预期输入只推进 lastFactId 或不写；当前实现采用不写。验证/计算在首写前完成，异常保守 return；这只保证参与者零写入，不承诺撤销底座在投递事实前已做的食物消耗/环境结算。`qualifies` 的异常必须仍转换为布尔；可选居民查询抛错视非居民。 |
| 真实 runtime writer 意外抛出 | SDK 类型没有 never-throw 保证。作用域、state/component 校验、消息校验等均可 throw。**若异常逸出参与者**，现有 runtime 还原参与者事务，随后按 strict/degrade 处理；**若在模块内部被 catch**，runtime 看见 undefined，会视为成功，先前写入可能保留。writer 抛错前后都没有“事务已失败”锁存标记。 |
| 测试人为包装/替换 writer | 包装后的异常同样被三个提交 catch 吞掉。它证明异常传播合同存在缺口，不证明原 writer 会在同一正常场景抛错。替换函数若根本没有调用原 writer，runtime 完全看不到该故障；不能要求它自动发现任意被模块隐藏的异常。 |

文字依据：`docs/ext/phase5g.dot-package.md:603` 绝对措辞“绝不抛异常”与括号中的失败回滚语义并列；`:626–646` 中明确“绝不抛”直接落在 `qualifies`，`onNeedEvent` 没另写同一句，但 dot 将防御政策推广到它。报告 SDK-03 的“§6.4/6.5 要求参与者绝不抛”因此略有概括。

§12.2（`:1114–1122`）明确文字与基线冲突以基线为准、不可绕过 SDK、失败期望可记录待集成。基线 `worldEdible.ts:155–163` / `actorNeeds.ts:47–66` 为 void writer/void callback；`runtime.ts:1685–1698` 明确支持抛错与回滚。因此“所有意外一律吞掉”不是实现原子性的必要条件。dot 保守遵从绝对措辞并报告冲突可以理解；推荐维护者明确收窄该措辞，而不是把原交付说成故意违约。

## 2. 真实事务与 catch 所在位置

1. `participants.ts:14–22、41–46、73–78` 是写前验证/规划；保留。`:23–37、47–52、79–97` 包住真正写入，是 SDK-03 的直接原因：已写知识/组件/缓冲消息/离队请求之后，`replaceState` 失败仍正常返回。
2. `runtime.ts:1677–1698` 以 `transaction → invoke → callback` 执行。回调正常返回且为 undefined 即成功；没有额外失败结果协议。`transaction`（`:979–1004`）在异常时恢复 edible 状态、模块 state/components/world、资源/统计等；`bufferMessages`（`:962–969`）丢弃失败回调的缓冲消息。`invoke` 末尾的属性验证/物化在 callback 外执行（`:1251–1269`），那里的异常不会被上述模块 catch 吞掉。
3. eat：`EdibleEffects.ts:102–145` 先消耗与应用效果，再参与者，再加耗时。`Game.ts:5509` 的 `transactEdible` 加上 `WorldWork.ts:640–653` 提供外层原生检查点；逸出的错误产生 C5_PROVIDER，随后不调用 playerTurnEnded。feed/roast 走 `EdibleCommands.ts:359–410` 的相同外层保护；roast 的 `drainFireContacts(game, true)` 对连锁参与者严格回滚。失败命令仍可被录制，不能断言录像完全不增加。
4. 环境火接触：`FireContact.ts:148–158` 使用 `!strict` 降级。失败只回滚参与者事务，已变形/移除物品等机械结果继续，底座消息/爆炸继续，记会话诊断；不承诺回退整次时间推进。
5. 需求事件：`ActorNeeds.ts:63–83` 总是 `degrade=true`。`depart` 先只进局部队列，只有 runtime 返回 ok 才启动真实离队。吞掉后续 writer 异常会错误地保留 ok，从而仍执行队列；传播错误则丢弃本事件请求。机械 need row 在事件前更新，不回退/不保证重投该事件。`feedNeed`（`:185–213`）也调用这个 event，故 feed 内 onNeedEvent 失败降级，而 onConsumed 失败才使外层 feed 回滚。

底座 writer 具体守卫：`runtime.ts:458–467、516–527、1683–1694`；知识更新实现 `KindKnowledge.ts:92–127`。foraging 将 pack 克隆后由同一 pack 驱动校验与 state 生成（`module.ts:12–23`），饱和计数与 history 限长已有实现。审查未建立上述守卫在正常合法 foraging 写入中失败的可达链路。

## 3. 最小修复与所有权

**推荐解释**：never-throw 约束不可信模块数据的验证/规划，以及资格查询；完成写前验证后，真正 tx writer 的异常必须逸出参与者，交给现有事务所有者处理。执行阶段若 catch，只能清理局部临时数据并原样 rethrow，不能 return、继续写或启动补偿事务。

- **转 dot 必改**：`src/ext/modules/foraging/participants.ts` 去掉上述三个提交段的吞错 catch（或原样 rethrow）；保留首写前全部校验、两种 next 预计算、`qualifies` 与居民查询的兜底。为清楚划分阶段，可在首写前确定可见性、消息 key/参数及要写的组件值。不要调整写入次序来冒充原子性修复。
- **dot 验收/文档**：在已有 `tests/foraging_module.test.ts`、`foraging_eat.test.ts`、`foraging_roast.test.ts`、`foraging_fire.test.ts`、`foraging_companion.test.ts` 中追加负例，更新 `docs/ext/phase5g.report.md` 的 SDK-03 实测与未验证边界。复用已登记文件，无须动共享测试发现清单。配置手册仅在其中已有相关合同说明需纠正时改；数值/名称/其他玩法不动。
- **本地必要工作**：维护者在派发块或本地任务书中明确覆盖绝对 never-throw 措辞，审查共享事务与模块测试结果。**SDK-03 的最小闭环没有必须先做的底座生产修补。** 原 runtime 已能处理逸出的异常；只本地改底座、让 dot 保留 catch，不能可靠修复报告中的“外部替换函数先抛”反例。SDK-01/02/04 不在本审查裁定范围。
- **可选底座加固，非本次前置**：若要保证模块即便自行 catch 了“真实 tx writer 抛错”仍不得提交，可由本地在 `src/ext/runtime.ts` 的 edibleParticipate 为本次调用加失败锁存：统一包住 state/component/message/extra writer，任何抛错记失败并 rethrow，回调返回后仍强制 abort。配共享底座测试。局部变量即可，不必加 Game 字段；不必改冻结九文件、SDK 签名或持久化格式。但它发现不了根本未调用原 writer 的替换函数异常，也不是任意模块恶意吞错的完整隔离机制，不能代替 dot 修订。本审查不建议以新增通用事务协议扩 scope。

协议/版本裁定：最小修复未改变 SDK 方法、JSON/state schema、命令 payload 或正常成功路径；无理由为此升级 FOUNDATION_PROTOCOL、EDIBLE_SDK_VERSION 或 whole-run/录像格式。改变的是失败语义的明确性，必须如实记录；如发布管理另有模块版本政策，由维护者统一处理，不让 dot 自行破坏本包冻结身份。

仍不解决的边界：未抛错却悄悄不写的 writer、任意模块内部隐藏的故障、引擎检查点之外的副作用、回滚自身失败/进程终止、事务结束后的消息端口外部副作用、已降级的机械事件重投。也不保证 malformed fact 必须拒绝整个命令。旧 E29 若要求 feed 内任何 need 失败都拒绝 feed，须另由底座所有者明确修改事件传播范围；本次不能顺带实施。

## 4. 可直接纳入 §0 的转贴块（维护者采纳后派发）

> SDK-03 合同修订：本条覆盖 §6.4/6.5 对“绝不抛异常”的泛化解释。onConsumed、onFireContact、onNeedEvent 必须先完成事实/state 校验及纯规划；畸形输入、非本 owner/need、重复事实或规划失败在任何 tx writer 调用前保守 return，零 writer 调用。qualifies 及 settlement 可选查询继续按原合同返回布尔，查询异常视非居民。
>
> 进入提交段后，markKnowledge、message、replaceState、setOwnComponent、removeOwnComponent、depart 的异常必须传播至 foundation；不得吞错、改为正常返回、继续写、另起补偿事务或私写 Game。markKnowledge 的正常 false 不视为异常。成功仍返回 undefined。
>
> foundation 维持当前边界：eat/feed 的 onConsumed 与主动 roast 的 onFireContact 失败，由已有外层事务回滚并成为已录制、0 成本 C5_PROVIDER；环境火接触和 onNeedEvent 失败丢弃参与者写入及本事件离队请求，记诊断，机械结算保留。onNeedEvent 包括 feed 内发生的需求事件；本条不扩大为整条 feed 必拒绝，也不增加自动重试。
>
> 修改范围仅 participants.ts、已有 foraging_module/eat/roast/fire/companion 测试文件和 phase5g.report.md；如已有配置手册合同说明与此冲突，同步纠正。不得修改共享生产/测试、冻结九文件、其他模块、SDK/格式号、数据与名称。将 SDK-03 注入负例恢复为有效断言；不得把“throws/rollback”改成“吞错成功”，不得 skip/todo。正常功能断言保留。
>
> 必需负例：(1) 畸形 fact/state、accessor、重复/外 owner 的三个参与者均不抛且全部 writer 零调用；可选查询异常仍为原资格结果。(2) 三个参与者各在首写失败、已成功写后下一 writer 失败、writer 完成自身写后抛错时传播同一异常；覆盖烤菌第二次知识写、message、replaceState、need 组件与 depart。(3) 用真实原参与者，只包装 tx writer 注入故障，不能用“整个参与者直接 throw”替代 SDK-03：公开 eat/feed/roast 分别比较原生对象/物品所有权数量、知识、state/components、need、消息、事实计数、双 RNG、耗时；拒绝保持 0 成本 C5_PROVIDER 并检查录制。(4) 环境火/need 保留机械结算，模块事务回到调用前且有诊断；deadline 的 depart 已排队、replaceState 随后失败时不能启动离队；feed 内 need 失败的降级边界另列断言。正常同场景无故障时仍成功。

本块是技术裁定建议及明确的后续修订范围，**不表述为用户已逐项批准**。当前只读审查未派发、未联系 dot。

## 5. 证据与未验证

- 已阅读任务要求的项目文档、§6.4/6.5/12.2、SDK-03 报告及上述执行链；本地 HEAD 开始/结束检查均一致，工作树无改动。未触碰 p5 未提交树、未派代理、未 commit/push/merge。
- 仅运行 probe.cjs，输出 probe.json，Node `v25.2.1`，exit 0，**32 个参与者级断言场景**。直接加载现有参与者与验证代码；candidate 只在内存将三个提交 catch 改为 rethrow，未写源码。四条投递（consumed/fire/need-band/need-deadline）各比较 normal、malformed、replaceState 写前抛及写后抛；原版故障不逸出，candidate 逸出同一异常，双方 malformed 零写。
- 探针 tx 是记录调用的替身，不模拟事务回滚，不构成真实 Game 验收。报告中的“known、数量1、tick100”未由本探针独立重跑；它与读取到的控制流一致，记为**报告事实 + 静态推断**，不可冒充本轮复现。未运行套件/门禁、浏览器、长局或真实回滚矩阵。
- 暂未发现自然生产半提交的独立反例；也未穷举所有跨模块、死亡/换层与极限数值情形。need 队列可能在同类注入下启动未记账离队是源码推断，不是新发现的自然生产故障。

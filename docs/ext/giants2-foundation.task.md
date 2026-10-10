# giants2前置底座修复任务书（已授权）

2026-10-09，ext/phase5，开工前代码HEAD `02ef819`。用户已明确授权本步→提交推送→合入`357a473`并关闭giants目录五项旧路线验证→推送→5Y。原验收为`357a473:docs/ext/giants2.acceptance.md`；参考补丁/回归在同提交`docs/ext/evidence/giants2/`，仅供根因与修复方向参考，不盲目应用。

## 1 维护者待决项

无新增产品或难回退决策。三项已由用户授权修复，按最小底座修复、保原玩法/协议/门限推荐执行；若确需改冻结合同或出现重大不可逆选项，先提供具体证据再问。5Y已批准Y1-A/Y2-A及D8投影P95≤100ms目标，本步不实现Worker。

## 2 必须修复并验证

1. **G2-SDK01**：growth回放多留不可达死亡角色导致OOS。核对Runtime安全边界结算、来源收集与GC时序，一次与重复收集完整状态幂等；保真实已死来源对仍存活poison/burning/延迟伤害目标的credit，以及待发奖励、关系/分成、位移死亡来源。不得删字段、放宽growth校验、让回放额外collect一次掩盖问题。
2. **G2-SDK02**：NPC行动后扣除旧soonestTurn误扣新硬直，导致timer/stagger失配、输入永久锁和拒档。核对原生与actor scheduler时序，过往elapsed只扣一次，新的防御恢复债务保完整。验证classic无scheduler、玩家bundle忙/空闲、同边界NPC、parry/dodge/stagger、动画开关、强制推进与save/load/录像；不得接受锁内输入、清硬直或强行归零掩盖问题。
3. **G2-SPATIAL**：行政退休携带者路径`passenger.loc={...actor.loc}`违反受管实体空间写守卫。通过可信空间提交入口，核验整足迹合法落点、索引一致、来源失效通知、原乘客/携带者所有权；失败需安全拒绝/回滚。新增真实写入口回归，不扩白名单、不仅替换字符串骗守卫。

底座只改必要共享文件及新/受影响共享回归和文档/测试登记；不修改giants生产或旧D12路线，本步不合入giants2。九冻结SDK/协议版本/玩法数值/黄金默认不变，若涉及真实摘要变化需按单变量归因，不手改旧版本manifest使长录像强行兼容。

## 3 验证与证据

- 在当前5E1后的ext/phase5重现上述三项，不拿验收报告旧foundation状态替代当前证据。使用公开Game输入配合明确标注的最小诊断布景；SDK01/02原草案可改为正式测试并登记归属。
- SDK01补活目标携带已死施法者来源、延迟奖励/分成、重复collect/存读；SDK02补真实防御/动画/回放/存读和classic不变；SPATIAL补受管乘客实际退休/落点/索引/失败完整图保持。
- 先列实际受影响测试清单再串行运行，至少覆盖growth credit/causality、combat defense/animated defense/客观时钟、共享空间守卫、存录和5E1相关窄回归。Node24.19、3GiB、Vitest单worker；实际boundary/types/build/test:drift。完整npm/test:ext、128组合、删除/设备矩阵留5Z。
- 底座变化若令既有trace失败，先单变量定位生产修复/数据/布景差异，保原命令、断言和阈值；真正必要的摘要重录按原入口，禁止重写manifest/版本伪装兼容。对新giants内容/旧D12路线的问题留下一合入步骤，不在本步越界改giants。
- 保留每批原失败/过滤/退出码，后续只跑受影响项，不合并重叠通过数。证据只摘要，不建多版本源树或逐字节封存。最多两轮独立审查→原作者修复，第二轮后余项按正确性/覆盖登记5Z，无第三轮。

## 4 交接和后续

本地gpt-6.1-sol/high执行，无commit/push；实现交接后停止写入。另起独立CLI审查，原会话resume修复；维护者核对后提交推送ext/phase5。每个子进程结束同轮接续，顶部状态每步或6小时更新≤5行。

本步报告`giants2-foundation.report.md`，审查`giants2-foundation.review-findings.md`，遗留`phase5z-remainders.md`。执行记录放`/private/tmp/brogue-commander-20261009-g2-foundation/`。

下一步仅在本步收口推送后开始：维护者合入origin/ext/giants2固定`357a473e67281e2164ebdcac6f738336598e8027`，处理冲突保双方修复；派执行者在giants目录重选可复现公开路线/种子关闭旧shale-weaver D12前提失效的五项验证，保原行为断言/门限、明确单变量归因、不改生成数值适配测试。完成giants相关门禁和最多两轮审修后推送。之后才开5Y；5Y目标未达100ms只登记5Z，不扩范围。

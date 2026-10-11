# SDK-1 / SDK-2 小底座修复任务书

## 授权、基线与流程
用户已明确授权在六项收口之后另开本步骤。六项与R1响应、combat2 VISIBILITY补充经R2通过，已发布 `63a279e26a9166beaf321d01e1c0d434c55c08a8` 至origin/ext/phase5。本步不是六项R3；独立作者实施→独立R1→原作者resume修复→最多R2，无R3，由维护者核对并提交推送。所有设计已裁定，无须重新等待确认。

只在ext/phase5实施SDK-1/SDK-2及必要同因回归，不提前合入narrative2/combat2。固定参考 `4ea702c0fce7a25cea9be0bf92b27dbd3ff29677:docs/ext/combat2.acceptance.md`，其 evidence/combat2 下 sdk1-generation-identity.patch、sdk2-growth-death-projection.patch、sdk-regression.draft.ts 仅供参考。完整用户合同在 `/private/tmp/brogue-commander-20261009-5z/pipeline-supplement-20261011.md`。先读AGENTS及其必读文档。

## SDK-1（S1）
生成子事务rollback须恢复活actor-action ledger和action/resource等子对象身份。原seed23第91条公开输入坠层生成时blueprint回滚，数值恢复但finishAction闭包持旧ledger导致metadata/scheduler失配。用真实旧fixture.stomp的no-op blueprint rollback补最小复现，核真实修改回滚、嵌套子提交后父失败、多来源、休息、冻结袭击动作、其它模块异常及生成性能。保完整值、ledger/action/resource身份、后续动作结束、真实save/load。保镜像/存档守卫，不在安全边界盲删metadata，不放宽校验。

## SDK-2（S1）
growth deathCaptured producer应把合法ActorFacts可选空间字段明确投影到既有封闭死亡DTO。原seed118第152条公开输入，square-2 movementRegionId杀死岩脊兽时spread actor导致持久DTO多字段拒绝。不能改schema吞未知非法字段，不丢death/origin/奖励。覆盖独立、固定区域、复合核心，普通/行政死亡，合法来源/分成/重复收据；保35045d9来源过滤、GC/收集幂等及原拒绝负例。保持既有持久格式，无旧档迁移。

## 回归与证据
修复前复现并保首败；草案不等于已验证实现。生产引入回归修生产。测试旧前提必须单变量回退生产证明，再结合原合法语义最小修前提、保断言/费用/风险链。bonfire/jackal旧前提留后续集成，当前基线若遇同因问题先真实归因，不提前改内容绑定。真实combat2 seed23/118原输入可在隔离外部内容装配核对，不把外部装配说成合入；不重抽失败seed，不用只0OOS代替完整快照。原seed47 giantHit及zombie自然释放待办属内容集成，本步不展开。

正式测试正确归属并考虑可删除模块：通用SDK根回归不能硬依赖可删内容；growth归其模块，必要fixture明确隔离，真实registry拒绝不得被fixture遮蔽。仅跑必要受影响完整文件/生命周期/生成性能，以及boundary/types/build、相关drift，Node24、3GiB、单worker、重负载串行。保存各套exit、通过/失败/真实skip/todo/unhandled与前后源码身份；重叠不累加、名称过滤不是真skip。只保存必要结果摘要，原始大证据在/tmp，不追加全量重建。用户Z1-A：不主动CE fetch/full/gen。

本步不跑完整npm/test:ext/128/15；这些在SDK收口、narrative2 1d0d900及combat2 4ea702c顺序合入之后，最终组合候选统一跑一次。XP保持skip，5D3另案，Claude最终候选人工待验。

## 交付与运行
唯一生产作者。不得commit/push/merge/tag，不派其它作者或审查。不得改commander-status.md（由父负责并发隔离），不得改dispatch/monitor/quick-check及本任务书；其他源码/正式回归/SDK报告归作者。完成实施与相关复测再退出，不得只做分析交接。报告 `docs/ext/phase5-sdk-repair.report.md`；进度 `/private/tmp/brogue-commander-20261009-5z/foundation-sdk-impl.progress.md`，最终 READY同前缀.READY.md，确有阻碍用.BLOCKED.md列原因影响，不虚报通过。

所有后台长门禁必须使用执行根launch-detached.py（独立OS session + nohup）及run-child.sh写done，stdin/stdout文件，不使用仅会话内&。作者退出前应完成所派门禁并核done，或明确独立门禁stage/PID供父接管，不能声称未结束的测试通过。父会话01a1163c-1880-7c31-b810-dd60d1e07ac8，watchdog同执行根；父CLI resume存在active-writer冲突，沿用60分钟兜底不反复尝试。

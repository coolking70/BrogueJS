# 5G foraging 集中返工包（维护者裁定，已发布合同）

本包对应 dot 原交付 `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`，保留其历史与报告，不把 741 项通过当作缺口验收。维护者按用户“推荐先行、记录决定”授权作以下可回退裁定。本包用于隔离返工，不代表 foraging 最终验收。固定派发 tip/tree 见维护者随 §0 给出的发布回执；未取得该回执时不得以浮动分支直接开工。

本包明确覆盖原 §0/§2/§9/§10.3 的旧分支、门禁与交付指令：只从新的 `origin/codex/phase5g-revision-base` 派发 tip 创建 `codex/phase5g-revision`，只推后者；原 `ext/phase5g` 保留。代码基线与含本包的派发 tip 分列，开工核验真实 commit/tree、干净工作树、两者差异仅为维护者文档。最终 SHA 由本包 §A 与维护者转贴同时给出；不以分支名代替固定身份。

## 0 转贴给 dot（维护者复制并附上发布回执）

```text
继续 BrogueJS 5G foraging 集中返工。
先 fetch origin/codex/phase5g-revision-base，从维护者本条消息给出的固定派发 tip 新建 codex/phase5g-revision；若本地已有同名分支，先核对其是否属于本次任务，禁止覆盖其他工作。
完整阅读 docs/ext/phase5g-revision.dot-package.md，并按其 §1–§3 一次完成修订、门禁和回执。新包覆盖原任务的旧分支/never-throw/错误反馈/持久化与阶段门禁指令，原任务其余条款继续有效。
代码基线 6874dbb07a67c6873b30580d0c06af2a42507875，包含已验收5C1 5dbeb32、原dot交付0fb2720及共享修复3f6e237；代码基线到派发tip只能有本包§A列明的维护者文档变化。
只改foraging自有目录及本包白名单文档，只推codex/phase5g-revision；原ext/phase5g、ext/phase5、main、foundation和基线分支不动。
重点完成提交异常传播、真实治疗/再生/知识断言、无foraging组合、真实沉眠与持久化，以及可选模块物理删除后的测试适配。具体事务边界和验收表述以新包为准。
正常七模块树相关组合为10行+3联动，两自然trace保持；全128子集及完整阶段门禁仍留5Z，不改黄金数据/trace或冻结接口。
按推荐处理可回退细节并记录；只在重大且难回退的问题上停下询问。开发后另起独立审查，原执行者修复发现，再提交推送。
每条提交保留 Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>。
最终中文回执给出起始tip、最终commit、报告、所有命令退出/数量、逐项关闭情况及仍缺的浏览器/真机证据；不要宣称维护者最终验收。
```

## 1 必做修订与裁定

继续 BrogueJS 5G foraging，先完整读新基线的本任务包、AGENTS.md、docs/HANDOFF.md、docs/ext/README.md、原 phase5g.dot-package.md 和 phase5g.report.md。新基线已同时含已验收 5C1、你原来的 0fb2720 和本地共享底座修复；从该明确 SHA 创建新修订分支，保留原 ext/phase5g，不修改 main、ext/phase5 或 foundation。

本包覆盖原任务中与下文冲突的 never-throw、错误反馈和 T-PERSIST 要求；未覆盖的原合同继续有效。只修改 foraging 自有目录及指定报告/手册，不再提交共享底座补丁。完成所有下列工作，逐项报告实际结果与未验证边界；开发与独立审查分离，发现交原执行者修复后再提交推送。每条提交保留 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。不要等维护者逐条回复日常决定。

1. **恢复治疗与再生的有效断言。** 本地已按设计修正精确点数治疗和纯再生投影，冻结 SDK 不变。恢复真实玩家/同伴的 `max(min, floor(maxHp*percent/100))`，封顶缺失 HP、满血零收益和烤制 keep/strip；对事实 `hpGained` 与即时真实 HP 分别断言。采空后到 32000 tick，公开 UI 应看到可采且能真实提交重采。反复只读不结算、不变 state/revision/RNG，提交使用投影提供的实际 CAS revision；第一次成功后旧 revision 仍拒绝，预留/满容量合同保持。禁止模块自己算再生时钟或强启用按钮。
2. **纠正参与者提交段吞错。** `onConsumed`、`onFireContact`、`onNeedEvent` 的事实/state 校验及纯规划必须在首个 writer 前完成；畸形/重复/外 owner 输入保守 return，零 writer。`qualifies` 和可选居民查询继续布尔兜底。进入提交段后，`markKnowledge/message/replaceState/setOwnComponent/removeOwnComponent/depart` 抛错必须传播给底座；删除三个提交 catch 或原样 rethrow，不吞错、不补偿、不继续写、不私写 Game。正常 `markKnowledge=false` 不是异常。
3. **按真实事务边界测注入故障。** eat/feed 的 `onConsumed` 和主动 roast 的 `onFireContact` 失败由外层回滚，产生已录制、零成本 `C5_PROVIDER`；不得断言录制完全不增加。环境火以及所有 `onNeedEvent`（包括 feed 内）失败则撤销参与者写入/消息/本事件离队请求、保留机械结算并记诊断，不承诺自动重投或整条 feed 回滚。三参与者测首写抛、已写后下一 writer 抛、writer 自身写后抛；覆盖烤菌第二次知识写、message、replaceState、need 组件和 depart。真实 Game 测试须使用原参与者，只包装 writer 注错；“整个参与者直接 throw”只能作对照。strict路径按命令前比较物品身份/数量、知识、模块 state/components、need、消息、事实计数、双 RNG 与耗时；degrade路径以参与者入口为边界保留已发生的机械更新/事实分配、底座消息与RNG消耗，仅比较参与者撤销，不能要求整条环境/need命令回到命令前。deadline 已排队 depart 随后 replaceState 失败不能启动离队。同场景无故障仍成功。
4. **恢复重复揭示计数的真实测试。** 本地将 markKnowledge 布尔语义明确为新增或严格升级；相同/降级返回 false。重复吃已知原菌、重复爆炸揭示、烤菌顺带原菌（两者全未知、部分已知、全已知）、save/load 后再吃均需真实 SDK/参与者测试。eaten 等消费统计继续增长，revealed 计“产生新 known 知识的事实数”，同一烤菌事实两次 markKnowledge 返回值取 OR，最多 +1；重复、降级及仅 tasted 不增加。raw/roasted 全未知、仅 raw 已知、仅 roasted 已知、全已知四种前提分别断言增量 1/1/1/0；不得用 mock 固定 false 冒充真实修复。
5. **修复无 foraging 的组合分支。** 已安装 settlement 时现有 settlement-only 行会错误解引用 foraging state。无 foraging 的行用模块中立的 manifest、digest、save/load/replay/seek/续录终态；启用时仍保留 eaten=1 等真实断言。保留原七组合，增加/保持 settlement-only、foraging+settlement，以及所有当前七生产模块一起启用的一行。实际未启用 foraging 时不得查其私有状态，不可删行/skip/缺席直接 return。热源与巨兽原三项保留。这是相关组合，不是全子集 smoke；现在七模块全子集应为 128，5Z 再统一执行。
6. **补强持久化证据。** 原 T-PERSIST 多数仅 save/load 后 wait 两次，沉眠还被手动改为 7，不能证明真实效果完整延续。保留受控场景但先通过公开食用/喂食/烤制/火/需求时间推进建立效果，断言真实激活强度、持续时间及相应期满/唤醒/离队终态；存读与不存读对照使用相同公开后续命令，比较机械根、模块 state、知识、需求和双 RNG。不得食用后手改 duration 冒称真效果，不用 origin monkeypatch 或伪事件制造录像。正常七模块树的两条自然 trace 与相关组合 replay/seek/续录仍必过；九类特殊布景各自完整新局录像明确移交 5Z，不冒称已完成。玩家沉眠会在同一食用命令内同步推进到醒来：只读事实观察点验证25回合真实施加，分别测自然到期/真实正伤害提前唤醒及命令终态；不要要求不存在的正常命令间沉眠存档窗口。活动沉眠存读用公开 feed 给普通同伴 drowse，付费命令后确认真实剩余时长再保存；载入/不载入两组分别比较到期、真实伤害唤醒、期间不能行动和需求/知识/state/双RNG；载入后从当前Game重取actor。5Z特殊录像交接也注明actor/时点。
7. **UI 与反馈裁定。** SDK-02描述更正：worldSdk原已有可选lastCommandError公开读口，缺口是固定ForagingView未投影具体提交错误，不是所有底座都没有合法错误读口。首版保留有意义的通用拒绝反馈，不新增不相关的 lastError 读口或猜测具体错误码；据此更新原“必须具体提交码”的首版验收描述，记录为维护者推荐裁定，非四个 SDK 问题都已修复。保持未知信息不泄露、确认/ACK 唯一屏障、纯 UI 零规则成本。浏览器允许则运行原 24 格和再生后重采；环境拒绝时保存错误，不绕系统限制、不编截图，给维护者明确复验路线与所需种子。真实设备留用户/5Z。
8. **本轮修复已知测试硬依赖并做最小删除复验。** 扫描所有 foraging 自有测试/辅助文件，覆盖 roast、companion、persistence、leak、UI、combinations、trace B。通用火/消费/持久化规则使用合法自有测试 descriptor/热源 fixture，不能依赖可删除的 crafting；无热源拒绝仍保留。仅确实验证真实 peer 联动的用例，按实际已安装 descriptor 能力生成测试参数或注册场景；正常七模块树仍执行原热源/巨兽三项、原七组合、新三组合与两条自然 trace。peer缺席时不能在已注册用例中直接 return 假通过、不能skip/todo、不能向共享清单转移测试、不能删 foraging 测试文件或改发现器。trace B依赖crafting，缺席时明确不注册该真实联动trace并列出未适用原因；自然trace A和模块独立规则仍实际执行。建立外部副本分别实际删除 crafting、combat、giants 以及只保留 foraging，跑保留的foraging自有集合/发现归属；记录实际删掉的模块文件、正常与各副本注册用例数量、真实执行结果，无额外exclude/被删peer空壳。此次是已知硬依赖修复的最小复验，不宣称完整5Z删除矩阵。

## 2 允许范围与禁止事项

- 允许：`src/ext/modules/foraging/**`；`docs/ext/phase5g.report.md` 追加修订报告；`docs/ext/foraging-config.md` 仅同步必要合同；可新增 `docs/ext/phase5g-revision.review-findings.md` 独立审查。
- 不改：共享 src/ext SDK/runtime、共享 engine/ui/test/scripts、其他模块、原任务/本返工包、全局 locale、数据数值/名称/黄金 JSON/trace、协议/存档/录像号。新自有测试须登记本模块清单；优先在现有相关文件补齐。
- 九冻结文件和原 fixture 树逐字节相同；SDK-03 不需要共享运行时失败锁存，本包也不授权这项扩大。
- 不能把正常注入故障写成已证明日常必现；不能因注入并非自然发生就放弃明确的失败语义。

## 3 门禁与回执

Node 24、3 GiB、Vitest 最多两 workers。相关开发测试后，最终 foraging 自有完整集合、必要共享受影响集合、上述相关组合/自然 trace、boundary、vue-tsc、build；实际 `npm run test:drift` 包装器必须成功，不能再用直接分区替代包装器验收。不得重录基线、放宽断言、加 skip/todo 或延长超时。完整 npm test、全部 test:ext、全 128 组合、完整物理删除、极限长局仍留 5Z。

回执给出最终 commit、基线、实际 diff 文件数/白名单、冻结哈希、每项门禁命令/退出/数量、逐发现关闭情况、独立审查结论、自然/受控/浏览器/真机分别的覆盖，以及待确认决定。失败过程保留，别把重复跑的通过数量相加。仅维护者合入 ext/phase5；dot 不自称维护者最终验收通过。

## A 派发核对与固定身份

- [x] 5C1 已独立审查及浏览器收口，提交 5dbeb32d17e72124a04156bcdff9b875807cfa48 已推送 ext/phase5；[验收](phase5c1.acceptance.md) 保留真机和5Z边界。
- [x] 共享修复 3f6e237c48f2696513426cfadc85ad79f22ae943 已独立审查：[报告](phase5g-sdk.report.md)、[审查](phase5g-sdk.review-findings.md)。治疗、再生、知识布尔和测试启动/平台问题已修；SDK-02按§1.7裁定，SDK-03模块返工仍待完成。
- [x] 新代码基线 **6874dbb07a67c6873b30580d0c06af2a42507875**，tree **31502966e231395c35daf78a6dc9159411866553**，双亲正是5C1提交与SDK提交；原dot四提交及0fb2720在SDK父链完整保留。合并两侧相对共同基线的变化文件没有重叠，候选逐字节等于预期并集。
- [x] [集成检查](phase5g-revision-base.report.md) 与 [独立审查](phase5g-revision-base.review-findings.md) 完成。源码/脚本/资源1201文件SHA-256 38e4410a5db8a13ad25e47d78fe4db354cf4c76fc946f344f7672f3f93311a7c，完整门禁输入2645文件SHA-256 ef3b583fab05ccebd0fd73f0ea3d4965bfd70dd91ca77a890efe8b5ab2c65fe8；门禁前后无变化。
- [x] 本基线 boundary/types/build 通过，8相关文件208项通过，实际npm drift包装器6文件12项通过。原组合文件11通过/1个已知settlement-only失败已完整保留；修该失败及新增真正全七行是本包工作，不称基线所有测试全绿。
- [x] 七生产模块已核对；foraging/settlement默认关闭，growth原默认开启。foundation10/worldSdk1/edible1/whole-run6/recording4/origin2/SaveDatabase2不变。九冻结哈希见集成报告§7，fgfixture树7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c；原foraging数据/locale/黄金/两trace字节不变。
- [x] 本包合同经两轮[独立审查](phase5g-revision-package.review-findings.md)，三项发现已关闭。发布版仅重排§0与详细条款、填固定身份，并更正SDK-02公共读口事实；要求以本包为准。原交付[本地审查](phase5g-local.review-findings.md)和[原子性合同审查](phase5g-atomic-contract.md)随附，历史报告不是当前产品通过证明。
- [x] 派发 ref 为 origin/codex/phase5g-revision-base；**含本包的最终派发tip与tree由维护者发布回执固定给出**，避免文档自引用其自身commit。该tip必须是上列代码基线的后代，差异只允许以下四份新增维护者文档；dot核对后从该固定tip创建/核验 codex/phase5g-revision。

  - docs/ext/phase5g-revision.dot-package.md
  - docs/ext/phase5g-local.review-findings.md
  - docs/ext/phase5g-atomic-contract.md
  - docs/ext/phase5g-revision-package.review-findings.md

发布时维护者另行核对远端tip/tree与本地一致；原 ext/phase5g=0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467、main=a48793437d51f4f8cebaf079f0ffcf0ceb1fa4ef、ext/foundation=d389f902bebe448ae1b409fc7ad3e1eff5dc934d 保持原值。ext/phase5的后续指挥文档记录不改变本包固定5C1代码来源。

本包明确不声称5G最终验收、Linux实测、24浏览器/真机或5Z全量通过。dot最终回执必须区分首版裁定、实际修复及仍未验证证据。

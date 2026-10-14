# narrative2 / combat2 顺序集成任务书

## 已授权范围与基线
六项底座63a279e已独立R2收口；SDK-1/SDK-2及冻结袭击C1经R2通过，已发布 `e9280c6a9e217e9e1c27c55744f7281ddcb494fe` 至origin/ext/phase5。只有一个生产作者，不再开六项或SDK R3。完整用户合同位于执行根pipeline-supplement-20261011.md，以其C节及最新用户裁定为准。AGENTS必读文档及两份固定验收报告必须完整读取。

用户明确授权依次合入：
1. narrative2 `1d0d900212c94e5acfccdd63d244e24d6f2d1bd2`。
2. combat2 `4ea702c0fce7a25cea9be0bf92b27dbd3ff29677`。

必须保留两个固定提交的真实Git父系，在ext/phase5按此顺序merge，不能只复制生产目录冒称已合。可用--no-ff建立仅供继续第二次merge的合并提交；这是用户已授权集成范围。记录每个merge SHA/冲突及处理。作者不得push或合main/foundation、打标签；最终修验提交由维护者核对。若需解决冲突，保留已发布六项/SDK生产修复、正式回归及所有模块登记，不用ours/theirs整片丢弃。父专属commander-status.md、dispatch/monitor/quick-check不改；该任务书为父所有。不要提交父正在更新的状态文件。

## 逐项关闭
narrative2：原12失败（五人各failCommit/failSettlement共10、N2-A01缓存完整世界、七包组合读档后再存）及九行组合全部在当前整合候选实际通过；保完整世界、原对象/RNG、消息/事件/录制游标、来源/重试、续录/回放/非单调seek断言。不能只继承六项补丁副本通过；第12与九行末行重叠不重复计数。跑全部narrative、相关共享回归。
combat2：原6失败（SDK原seed23第91、seed118第152；三个seed3/47完整seek；bonfire旧jackal前提）实际关闭。保原seed23/118安全prefix、初始commands和attempted，不重新抽掉失败seed。另保giants2_foundation SDK02动画开/关两项，不混记原6。bonfire及jackal必须在当前整合树独立单变量仅回退definitions到已知旧表证明，并结合合法原行为语义最小修前提，保伤害/时间/中断/No等断言和35045d9来源/GC幂等；不改生产绑定迎合旧测试。跑全部combat（含旧回归及其组合）与受影响共享。

补combat2验收报告自然证据缺口：zombie自然出生后的combat.anchor-break实际释放；自然巨兽被新招正伤害接触和群体handled闭环；非空缓存NPC资源冻结；自然seed11/12完整持久化；growth技能明确No。自然证据须正常局/公开命令，不注入HP/RNG/位置/敌人或直接写ledger冒充自然；受控协议证据单列。seed47 giantHit=false保留首败：用户允许补一条命中巨兽的自然/公开路线或已有有效seed，保原正伤害断言，不删断言/跳过/换成宽松条件。原seed47完整存读/seek/续录仍保。已保存的六项外部combat2三变体捕获/两内容首败只作归因参考，不当当前组合通过。

## 证据和门禁
已有底座格式foundation14/world5schema5/settlement1.4及新内容身份会影响输入身份和黄金。先真实首败、单变量归因，再原捕获方法更新必要fixture/trace，只留简明逐字段分类和派生hash对应；原命令、原物理输入、费用/RNG/行动等不能为过测试随意改写。不得盲改golden或减去缓存字段。已有tmp捕获脚本可复用方法，不沿用旧候选结果。生产真实回归修生产，未知根因不得称过时前提。
本阶段仅定向完整模块/受影响文件与boundary/types/build/必要drift，不在每次merge跑完整npm/ext/128/15。两次merge及内容补证完成后写READY交维护者核对，必要独立最多两轮审修；维护者再派最终组合候选统一一次完整npm test/test:ext/test:drift、128正常启用及15实际删除布局（7单删7单留1全删，每行boundary/types/build、全部剩余ext、真实缺包旧存档录像拒绝；smoke全开/全关去重29）。本作者此阶段不擅自启动最终全量。
逐套记录命令/exit/过败/真实skip/todo/unhandled/过滤/前后源码身份。重叠不累加，部分结果不称全绿。用户Z1-A不主动CEfetch/full/gen。XP奖励保持skip，5D3另案。Claude在最终组合候选浏览器抽样，无回执仍待验；作者交人工清单，不以静态UI代替人工通过。

## 执行、交接
执行根/private/tmp/brogue-commander-20261009-5z。Node24/3GiB/单worker，重负载串行；所有后台长任务必须launch-detached.py独立OS session/nohup、文件stdin/stdout、run-child写done，不能会话内&依赖作者存活。作者不得派另一个作者或审查。实际修验完成再退出，不只做分析或准备；若不可关闭逐项原因/影响/未验交BLOCKED，不伪造完成。
报告docs/ext/phase5-narrative2-combat2-integration.report.md；进度integration-narrative2-combat2.progress.md；READY/BLOCKED使用同前缀。阶段性合并提交只作流程检查点，不代表验收通过或准许push。最终报告包含两merge固定身份/修复diff、原12/九行/原6逐项表、自然/受控证据分列、门禁摘要、未验与人工清单。父会话01a1163c-1880-7c31-b810-dd60d1e07ac8，watchdog执行根，60分钟事件兜底。

# 用户新裁定：自然补证限时及内容缺口非阻塞（2026-10-12）
此裁定覆盖此前必须补齐 zombie/巨兽自然内容证据才能 READY 的冲突要求。
- 每个自然搜索补证子进程外部硬限时1200秒（20分钟），保固定种子/命令预算；任何更短既有门限仍保留。使用执行根 bounded-natural-command.py --seconds 1200 --record 新唯一证据文件 -- 命令，外包 launch-detached/run-child。不能靠同步CPU循环中的测试timeout替代外部时钟，也不能拆分重试无限续预算。
- 当前 natural-supplement-capture 实际运行约88分钟，用户授权停止。PID81282/81284已TERM，integration-next2-v2.done exit143，原始首败/部分结果保留；不称通过、不伪造退出124。旧作者73479也已TERM并done143，用原会话续跑本裁定，非新增审修轮。
- zombie naturally 与自然巨兽正伤害/群体handled列为内容证据缺口，不阻塞集成/审查/最终统一全量。保原断言、原seed47首败及原23/118安全prefix；不删除、不弱化、不伪造自然命中。不得继续为此无界搜索或等裁定。部分seed118持久化标记不等于完整文件通过。
- 仍完成原文件完整存读/seek/续录、其余集成必要回归；真实生产缺陷不得混入内容豁免。全模块门禁若碰到已豁免内容断言，如实列exit/失败与范围，其他结果完整统计，不能称全部全绿；原自然搜索capture不自动在常规全量中重启。
- 独立 integration-content-following-v1 已自动接续固定trace刷新、原links原断言首败确认、原法narrative重录，先等该stage结束，不并发写生产。此后全narrative/combat、78受影响、boundary/types/build/drift → 独立最多两轮审修 → 最终统一npm/ext/drift/128/15。
- 原法narrative重录仍属于必要工作，但所有自然搜索也受20分钟外部上限，若超时保留证据并逐项报告；只有用户明确豁免的zombie/giant内容缺口非阻塞，其他真实问题不自行豁免。

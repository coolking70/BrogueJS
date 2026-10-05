# 3b 预警与多段攻击报告

日期：2026-10-05 UTC。分支 `ext/phase3`。本步止于 3b，不包含 3c 体力恢复/闪避、3d 韧性/弹反玩法、3e 篝火，不合并 main、不打 tag、不部署。

## 基线和范围

实际 GitHub `ext/phase3` 为已批准 `21aceeb0795c9cb91d349bd5745ef767f807f528`；明确从 `https://github.com/coolking70/BrogueJS.git` fetch hosted foundation 并合入 `ef2a0f2dbe734b14597db41ad662dc53e333b224`，保留 4a0–4a4 全部历史。旧脏树未触碰。交付前再次显式 fetch hosted foundation，结果仍为 ef2a0f2。

- combat module/rules 从 1.0.0 升至 **1.1.0**；包 schema=1，由精确 manifest/rules 指纹拒绝旧 inert 包状态。foundation=4、native entity/whole-run/replay=3 不变，没有独立分配共享版本。
- 保留三份原创形状 ID：fixture.slash / fixture.stomp / fixture.double-thrust，玩家名为扇锋斩、震环击、续锋刺。新增显式 rat/kobold/ogre profile 绑定。`fixture.*` 是稳定数据 ID，实际生产路径已开放；DEV 布景另有明确的 fixture 标记和导出拒绝。
- 三招式仍按声明一次扣费；现有 24 点预算耗尽后 NPC 回原生行为，玩家按钮不可用。**本步不恢复体力、不提供闪避或弹反输入**，相关完整资源循环留 3c/3d。
- giants、growth、narrative 均为可选。没有跨模块硬导入，没有改动 giants 默认目录、生成率、场地、身形或战斗绑定。

## 权威状态、输入和生命周期

`ExtensionModule.actorActions` 是有限数据声明；`ExtensionRuntime.actorActionBinding()` 仅由可信引擎读取。定义和持久状态分别经 `actorActionValidation.ts` 严格校验。唯一机械倒计时位于模块状态的 scheduler；动作元数据仅保存招式、朝向、当前 locked cells、风险凭据、费用和跨层 sweep 抑制标记，没有另一份 remaining/elapsed。

`PhasedAttackProduction.ts` 负责纯准备/提交、选择和段解析；`ActorActionProduction.ts` 负责会话绑定、状态恢复、时钟镜像、打断、缓存层和 native terminal sweep。模块回调不接收可写 Game、Creature 或 scope。runtime 退休/世界回滚后重新绑定，旧 plan 不能复用。

- 玩家输入仍为 `executeCommand('ext:command', JSON.stringify({module:'combat',action:'attack',payload:{attackId,facing}}))`。纯准备不取骰、不收费、不分 ID、不写计时器。方向和确认 UI 复用既有 DialogService，未新增 window 输入监听器。
- 风险用原生酸蚀/友军谓词，逐目标保存授权，复用原 requestConfirm 的 live/replay 决策消费；No 零费用/时间/RNG。等待确认期间不持有写权限；提交前重验 session、revision、身体、原生物种、装备、资源和所有相关 actor 位移修订。延迟命中出现新未授权风险时跳过，不弹新对话。
- 每次独立 NPC 新决策仍先执行原生 prelude 一次。沉睡、俘虏、麻痹、缠绕前置消耗不能绕过；施法、召唤、逃跑、危险地形、尸体学习和盟友避险/追击资格优先回原生行为。阶段边界不重复 prelude 或补原生 attackSpeed。
- 发起成员足迹加相对形状；每段在自身正前摇开始时锁定地面。墙体变化可缩小当前合法命中，不能把原先未预警格增补进同段。后续段有独立正延迟再锁定。
- 死亡先取消待段；位移、换形、已开放的身体变化、状态失能、跨层取消待段并进入有界 break-recovery。native 单格与方形都维护不持久的 actorSourceRevision，离开再回原格仍使旧准备/待段失效。持久 sourceFootprintVersion 仍为纯机械指纹，读档重新绑定会话修订。
- 缓存层 countdown 冻结；跨层不向旧层或新层补一次含旧层耗时的 terminal sweep。普通同层完成/打断只以实际 elapsed sweep 一次。异常显式使录制失效，不吞错重复执行。
- load 候选先验证唯一计时真相/native mirror、模块资源引用、pending source profile/资格、当前/缓存深度及 locked cells 在真实地图和相对形状内；坏档不退休旧世界。加载 busy 玩家时本次 load 不推进世界，下一 update 自动继续原阶段，期间拒绝新输入，不重跑动作前置或收费。

现有 generic scheduler 的 ≤4 成员、费用和/耗时 max/下一边界 min、稳定 member/subaction identity 仍保留。**当前生产空间准入是独立 native / r0 square 2×2、3×3；未开放任意 mask、zone、复合群或旋转体**。其未来阶段不能靠移除 guard 宣称支持。

## 身体命中和显示

`ActorCombatResolution` 在消费 D08 part scope 前筛掉非法接触格，再调用既有 `Game.collectBodyTargets(cells,{effect:'area-damage'},scope)`。一个目标首个格不合法时允许后面的合法尾格；一段仍只命中同一 part 一次，后续段用新 scope。

近邻使用 `Game.meleeContact`/`nearestLegalMeleeContact`；延伸突刺使用 bodyRayContact 与真实 body contact；`withBodyAttackContact` 包住完整 native 玩家/NPC 结算、装备酸蚀/符文、护甲、状态、血迹、死亡和反伤。保留 dodge→parry→native 顺序；没有防御时才进入原生命中/伤害 RNG，不伪造 hit/physicalResolved。原生 seizing 额外收紧到真实相邻接触，避免新增远距段远程抓取。

- 源与目标死亡/换形/位移会使已冻结的后续接触失效；反伤杀源后停止余段。
- 公共投影在底座先按真实可见 source/cells 过滤，再由 UI 防御性验证。历史 DisplayFrame 深复制/冻结 telegraphs，回放历史显示不读取未来 live 预警。
- 玩家初始前摇和每次已完成的同 tick 阶段组都发布既有有界 presentation frame；显示无规则 RNG/额外 tick。
- 叠加警示只画一次格子，来源列表稳定；警示位于身体之前，不遮挡身体轮廓/字形。三招式、方向、状态和提示全部 i18n。

## 验证与证据

运行环境 Node 24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。仅运行本步/直接受影响功能，不运行完整 npm test、全部 test:ext、实际 removal、CE full/gen。没有地图生成改动，不运行 drift 或重录黄金。

开发期已通过：combat runtime（真实命令/风险/save/replay/seek/续录）、纯 schema/planner、基础状态/调度、body/native、square 集成、公共历史帧/SFC/对话、相关原生战斗。独立审查的五个反例均已加入修复并重新验证：非法首接触吞掉合法尾格、away-and-back 陈旧准备、换种 profile 与余量不一致、离图锁格坏档后置崩溃、未分配目标的伪造风险凭据。

ef2a0f2 基线上的最终正常候选门禁：

| 检查 | 实际结果 |
|---|---|
| boundary / vue-tsc / production build | 各 exit 0；保留已有大 chunk 提示 |
| 45 文件功能相关集合 | **45/45 文件，920 passed / 8 skipped，exit 0，295.15s** |
| 5 个相关真实组合 smoke | **5 passed，exit 0**；其余 26 项由 -t 过滤，不计为执行 |
| 独立审查 | 5 个隔离回归通过；最后 runtime/state 53 项通过；无剩余审查 blocker |
| LF / git diff --check | 通过 |

8 skipped 是原 p2_1 四项、p2_2 两项、p2_3 两项历史退役基线，未新增 skip。CE 缺失提示不意味着把通过项算作 CE 验证。最终文件清单在执行环境 `/tmp/phase3b-final-related-files.txt`，日志 `phase3b-final-related-accepted.log` / `phase3b-final-{boundary,type,build}-accepted.log` / `phase3b-final-composition.log`。

开发期第一次45文件集合实际为43文件通过、2文件失败（914 passed / 5 failed / 8 skipped）。5失败由两个精确旧前提造成：256个偏移旧布景使用±128长行，现改为±32内16×16同样256唯一格并保留预算断言；4a0 full-graph只因新纯 `ports.visibleActorActionCells` 闭包键改变对象形状，现只规范化该新读端口，所有原字段、52个完整世界/snapshot/RNG/message观测继续严格比较。两个文件97项独立复核通过后，完整45文件重新运行得到上述全绿结果，没有重录基线。另两轮在最终错误路径/坏档修复落地时主动中断（exit130），不作通过证据。

方形集成明确区分：

1. 原生 Game.createSquareMonster fixture 的 2×2/3×3 四种来源/目标矩阵；两段 native physical facts/伤害/毒、body contact、酸蚀和单次费用。
2. 方形 NPC windup/inter-segment/recovery 各相位存读、续录、完整机械状态与双 RNG replay/seek 比较。
3. seed 7306 实际新局到 D3 的自然 ridgeback 出生。测试仅给 combat 配置增加该自然 typeId 的招式绑定，使用 150/130/150 tick fixture 节奏；没有改 giants 默认数据。完成两段真实伤害、三个相位恢复，以及 167 条自然命令全 replay/seek。它不是 giants 默认已绑定 combat 的声明。

旧测试变更：combat inert-only 安装/无 UI/无状态断言已替换为生产功能与拒绝坏档/禁用覆盖；包版本/新增 profile 数量/形状上限按正式开放更新。原 square-unopened defense 测试只将布景改为仍未开放的 r90 square，拒绝断言保持；另做了仅回退 ActorCombatResolution 的单变量反事实。没有宽泛 skip/exclude 或降低超时。

## 浏览器和明确边界

官方 cloud browser 尝试 `http://127.0.0.1:5173/` 返回 **net::ERR_BLOCKED_BY_CLIENT**，未绕过限制，未声称拿到像素。DEV-only `window.debug_combat_telegraphs()` 安全选可见地板、优先放 2×2 ogre，真实 wait 开始前摇；显式标记 fixture，拒绝 save/replay 导出。Mac fallback QA 使用独立 QA-only 构建与精确源码散列；像素结果由验收方补充，截图只留本地。

未运行完整收尾/删除矩阵，未宣称所有安装子集、手机真触摸或 FPS 已验收。正式开局 UI 保存仍禁止进行中的 command/turn；测试中的 busy-player机械 checkpoint 恢复与普通玩家命令已完整排空后的 save/录制连续性分别验证，不混同为 UI 可中途导出完整命令录像。

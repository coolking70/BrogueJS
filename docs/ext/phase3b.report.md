# 3b 预警与多段攻击报告

日期：2026-10-05 UTC。分支 `ext/phase3`。本步止于 3b，不包含 3c 体力恢复/闪避、3d 韧性/弹反玩法、3e 篝火，不合并 main、不打 tag、不部署。

## 基线和范围

实际 GitHub `ext/phase3` 为已批准 `21aceeb0795c9cb91d349bd5745ef767f807f528`；明确从 `https://github.com/coolking70/BrogueJS.git` fetch hosted foundation 并合入 `ef2a0f2dbe734b14597db41ad662dc53e333b224`，保留 4a0–4a4 全部历史。旧脏树未触碰。开发中复核仍为 ef2a0f2；最终复核发现 hosted foundation 前进至 b306f01，已按下节再次合并，不覆盖 4a 历史。

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

## 最新 foundation 整合

3b 实现先提交为 `d5645f9`，随后明确 fetch 真正 GitHub 最新 foundation **b306f01d4a3e9e66f2fc9c0d5e394a4f3e2c2b9a**，通过 merge **071e8d8ea7b0cf59d5349ff6a5732cf115065b60** 保留两侧历史，无冲突、无整文件覆盖。

上游差异仅包括 `45e7cd2` 的一次性陷阱先消费后触发修复，以及 `b306f01` 的 3×3 Abyssal Colossus 内容/场地/文本、trace 和测试。唯一引擎差异位于 Game.triggerTrap，与 3b 接线不重叠；没有 Vue/renderer/UI 生产改动。3b 不重做 4a5，也不改其默认生成或 combat 绑定。

补充真实已安装 3×3 form 验证：通过 `Game.createModuleMonster` 发布该声明物种，确认 9 格及原 maxHp，再以显式 fixture combat 配置执行两段原生攻击、一次费用、windup 存读及后续 phase。此物种的出生标记为 scripted，不冒充自然 D7 出生；上游自己的自然 3×3 测试亦纳入整合门禁。

整合集合首轮 20 文件：19 文件通过、1 文件失败，403 passed / 1 failed。失败是 `giants_runtime.test.ts` 原盲走路线在 combat 从 inert 变为真实威胁后 D2 死亡，并非存读/回放差异。仅对该文件启用 combat 的组合改用菜单公开 wizard 模式，`naturalFixture.ts` 增加默认仍为 normal 的显式参数；保留全部世界/RNG/存读/seek/续录断言。其余 giants-only normal 路线、combat 自有 normal 模式 seed7306 D3 自然 ridgeback + 167 命令 replay 及真实伤害覆盖保持。没有给原型生产角色加血、放松伤害或改平衡。四个修订后的组合案例独立通过。

同时保留缺 combat 包与未开放 dodge/parry/rest/未知命令拒绝的有效旧合同。拒绝缺模块时仅允许原有两次错误反馈合并为一条日志；其它完整序列化世界、RNG、allocator、player/runtime 身份与未调用 unload 都保持。不是用安装禁用冒充实际目录删除。

## 身体命中和显示

`ActorCombatResolution` 在消费 D08 part scope 前筛掉非法接触格，再调用既有 `Game.collectBodyTargets(cells,{effect:'area-damage'},scope)`。一个目标首个格不合法时允许后面的合法尾格；一段仍只命中同一 part 一次，后续段用新 scope。

近邻使用 `Game.meleeContact`/`nearestLegalMeleeContact`；延伸突刺使用 bodyRayContact 与真实 body contact；`withBodyAttackContact` 包住完整 native 玩家/NPC 结算、装备酸蚀/符文、护甲、状态、血迹、死亡和反伤。保留 dodge→parry→native 顺序；没有防御时才进入原生命中/伤害 RNG，不伪造 hit/physicalResolved。原生 seizing 额外收紧到真实相邻接触，避免新增远距段远程抓取。

- 源与目标死亡/换形/位移会使已冻结的后续接触失效；反伤杀源后停止余段。
- 公共投影在底座先按真实可见 source/cells 过滤，再由 UI 防御性验证。历史 DisplayFrame 深复制/冻结 telegraphs，回放历史显示不读取未来 live 预警。
- 玩家初始前摇和每次已完成的同 tick 阶段组都发布既有有界 presentation frame；显示无规则 RNG/额外 tick。
- 叠加警示只画一次格子，来源列表稳定；警示位于身体之前，不遮挡身体轮廓/字形。三招式、方向、状态和提示全部 i18n。

## 验证与证据

运行环境 Node 24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。仅运行本步/直接受影响功能，不运行完整 npm test、全部 test:ext、实际 removal、CE full/gen。3b 没有地图生成改动，不运行 drift 或重录黄金。最终整合继承的 4a5 内容/trace 是上游已验收改动，本步不重新捕获，不将上游 drift 结果算作本步执行。

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

## 整合后与像素反馈后的最终门禁

- 最新 foundation 整合后 20 文件相关集合最终 **20/20 文件、406/406 项通过、0 skipped，exit0，193.84s**（`/tmp/phase3b-post-foundation-final-pass.log`；清单 `phase3b-post-foundation-files.txt`）。包括全部相关 giants 功能、combat 功能、4a2/4a3、旧单格完整 graph、陷阱/传送/火焰直接回归。首轮的路线失败和精确 fixture 调整见上文，不将失败当作通过。
- boundary、vue-tsc、production build 及 diff-check 均 exit0；日志 `phase3b-post-foundation-{boundary,type,build}.log`。production build 保留既有 chunk 大小提示。
- Mac 像素发现 warning HUD 在方向→确认→Cancel 后消失（见下节）后，仅修改 `useCombatUi.ts` 的 hover 过滤。修复前3个回归重现失败；修复后 **6 文件 / 85 项通过**，包括新增真实 Game 零命令/完整机械状态与双 RNG 不变、历史帧、body SFC、i18n/硬编码文本守卫。随后 boundary/type/build/diff-check 全部 exit0。没有以先前20文件的旧 UI 结果代替此轮专测。

## 性能与预算

只计真实 `executeCommand` 的 9 次原生场景采样（开局生成在计时外）：P50 **8.26 ms**，P95 **19.25 ms**，该单格玩家样本最大预警 8 格。该小样本在本云环境执行，不是帧率、手机性能或通关平衡结论。原测试 console 输出未保留数值，因此用外部临时 Vite transform 将**同一既有计时探针的输出**写至 `/tmp/phase3b-performance-metrics.json`，未改仓库源文件、断言或生产求值器；1 项通过，其余18项由名称过滤。相关日志 `phase3b-performance-measured.log`。

生产限制：每段最多1024投影格、每形状最多256整数偏移/坐标±32、每核心最多4个稳定子动作、正阶段与总动作tick预算；当前实际生产发起者仍为独立单成员 facade。状态/预算触顶明确拒绝，坏定义不静默降级。四成员并行和 max/min 时钟上界由基础 scheduler fixture 验证，不称为已开放自然复合敌人。

## 浏览器和明确边界

官方 cloud browser 尝试 `http://127.0.0.1:5173/` 返回 **net::ERR_BLOCKED_BY_CLIENT**，未绕过限制，未声称拿到像素。DEV-only `window.debug_combat_telegraphs()` 安全选可见地板、优先放 2×2 ogre，真实 wait 开始前摇；显式标记 fixture，拒绝 save/replay 导出。Mac fallback QA 使用独立 QA-only 构建与精确源码散列；像素结果由验收方补充，截图只留本地。

Mac v4 实际检查发现一个 UI blocker：1440×900 普通模式，combat-only test 局，真实 DEV 2×2 ogre 预警后，点击招式→东方→取消，警示格和身体仍在，左栏 warning HUD 消失。turn/input/玩家状态/展示帧队列没有变化。“未知”是原有消息日志入口的独立地形悬停文本，**不是 HUD 文本变成未知**。

根因是 HUD 将任何非空 hoverCell 都当作缩小列表的条件，在普通/未知非警示格上得到空列表就隐藏全部警示。修复只在 hover 命中警示格时缩小列表；否则保留当前公开历史帧的全局警示，瞄准期间保留全览。旧警示真正退休后仍消失；没有缓存陈旧 source、读取未来世界或屏蔽合法未知地形文本。

Mac v4 已实看17张截图，三招式真正释放→idle、重复点击、modal 上箭头隔离等通过；六布局仅有初始子项检查，320px 沉浸身体辨认曾不确定。未把这些算成最终全矩阵通过，未声称浏览器双 RNG、历史 MORE、触摸或自然录像已覆盖。v5 QA 包用于该精确方向/取消案例和窄屏回归，最终结果如下。

### Mac v5 有界像素回归：通过

维护者已核对恢复后的最终报告与实际像素：

- **1440×900 普通模式**：非警示格 hover→选方向→确认页→Cancel，全局警示 HUD 保持；警示格 hover 正常聚焦，离开恢复全览。
- **320×844 沉浸模式**：同一路径通过；完整 2×2 身体与预警可见、可辨认，HUD 与对话控件不溢出。
- 两个视口 Cancel 后完整 `render_game_to_text` 展示状态均与之前一致。该接口不是完整世界/RNG 转储，**浏览器完整世界与双 RNG 未验证**；真实 Game 机械状态与双 RNG 的证据来自上述独立85项测试。
- 实看8张 v5 截图，全部只留 Mac 本地；48个归档文件重新核对。只关闭本轮创建的标签页/5397服务，恢复视口设置。恢复任务仅补全证据/清理，没有将重复操作算成额外 QA。

验收包为 `BrogueJS-phase3b-qa.zip`（Library version5）：归档 SHA-256 **bb8e76cf7f201f33d5c02f7ac1245231271a37599e777c5c0fc2346d87a1ef39**；生产/测试/配置源集合 SHA-256 **b09532b3c198255fc4e6b76012d367172af12bbbb348e3d0e50e58a612492577**。QA-only 构建保留 DEV fixture，正常 production build 不开放该入口。最终仅追加本报告，未改验收后的生产源码。

这是修复后的有界回归，不扩称为六布局全部场景重跑。390px、全部地图/布局组合、浏览器历史 MORE、真实触摸、自然录像的更广像素覆盖仍按前述限制保留。

未运行完整收尾/删除矩阵，未宣称所有安装子集、手机真触摸或 FPS 已验收。正式开局 UI 保存仍禁止进行中的 command/turn；测试中的 busy-player机械 checkpoint 恢复与普通玩家命令已完整排空后的 save/录制连续性分别验证，不混同为 UI 可中途导出完整命令录像。

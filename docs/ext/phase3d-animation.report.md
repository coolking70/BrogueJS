# 3d 动画防御：区分新攻击，并修复超过5秒帧间隙丢弃已接受动作

## 结论与范围

基于实际远程 `ext/foundation` 的 `a01a8927dacb4946abff763c083a179fa5a160ac`，确认两个不同事实：

1. **健康帧节奏下没有复现NPC停滞**：两次NW弹反都成功，随后显示相同phase/remaining/elapsed的是不同actionId的新攻击，普通wait后才受伤。
2. **超过5秒的浏览器帧间隙确实会丢弃已接受动作**：首次恢复帧走超时分支，尚未消费NPC/防御恢复调度就结束动作，留下NPC原actionId及永久防御恢复输入锁。新增成功期望在旧生产代码上明确失败，再修改生产实现。

修复只改 `Game.stepAdvancement` 的超时分支：把到期解释为跳过剩余动画等待，消费同一个已接受动作的原调度iterator，然后正常收尾和更新一次检查点。保留异常路径、费用、时钟计账、60tick排他窗口、正式profiles、stomp不可弹反及DEV时序；不强制写世界tick、不给玩家重放一次命令、不增Game字段或改格式。

新增回归通过真实 `Game`、`animationEnabled=true`、`useCombatUi`、`DialogService`、`bindDialogAcknowledgments` 的真实Logger opt-in/同步回调，以及GameCanvas同顺序/模态条件的16ms `tickAdvancement` 帧验证。测试只在帧间隙用Date.now模拟经过6秒墙钟；不伪造世界时间。本证明没有Pixi挂载/浏览器像素，不能声称复现了用户浏览器发生间隙的原因，也不能把健康帧的新action现象和超时缺陷混为一谈。

## 先复现的证据

首轮仅用公开命令及普通帧就成功；进一步加入真实 UI 方向/确认与展示时间线，仍成功。固定诊断布景中玩家在 (38,20)、HP30，DEV 默认可弹反食人魔从 NW 接触边预警；沿用原50tick就绪、正常付费 slash 建立剩余10tick预警。没有改窗口、正式profile、原生食人魔能力或招式数据。

seed73073 的完整序列：

| 边界 | actionId | phaseIndex | remaining | elapsed | 玩家HP | defended累计 |
| --- | --- | --- | --- | --- | --- | --- |
| DEV初次可输入预警 | 2 | 0 | 10 | 40 | 30 | 0 |
| UI NW弹反＋普通帧 | 3 | 0 | 10 | 40 | 30 | 1 |
| 再次UI NW弹反＋普通帧 | 4 | 0 | 10 | 40 | 30 | 2 |
| 普通wait＋普通帧 | 无在途bundle | — | — | — | 21 | 2 |

相同phase/remaining/elapsed属于**不同actionId的新攻击**。前两次攻击已经各被弹反一次，玩家没有受伤。100tick恢复结束时，敌人恰好再次来到相同相位，看起来像原预警未动。随后wait不是弹反命令，原保护已经耗尽，因新攻击正常受伤。seed73074、73075同样验证两次成功弹反、新actionId及随后wait受伤，不以挑选命中seed制造成功。

用户的实际报告若具有同一个actionId在正常帧后仍不变，需要继续调查；本结果不能代替用户那一局的完整诊断，也不能在没有该证据时更改正常的时钟计账。

## 先失败再修复：墙钟超时分支

在正常wait得到可见原生rat风摇remaining50后，经真实UI提交parry或dodge，确认 `isAdvancing=true`，只让Date.now经过6000ms，再调用普通 `tickAdvancement(16)`。

旧代码实测：

- parry：NPC原actionId/remaining50/elapsed0原样不动；playerTicks被清0，parryRemaining60、recovery100未消费；defended0
- dodge：NPC同样未动；playerTicks被清0，dodgeRemaining40、recovery80未消费
- 两者都 `isAdvancing=false`、`lastAdvancementError=null`，但独立防御恢复锁 `isInputLocked=true`，正常帧再也没有在途iterator可消费
- 旧代码同时把录像标成不完整；这与用户能够连续接受弹反的报告不完全相同，因此不把其唯一根因写成已确认

旧代码两项成功期望失败，六项健康帧测试通过；日志为 `animated-defense-gap-before.log`。修复后同一个调度iterator真实完成：parry正常defended一次，dodge累计80tick正常进入敌人恢复；两者保护/恢复归零，解锁，记录完整。既有P2-2异常与超时守卫仍通过，没有改旧断言。

增强后的最终测试还在已接受防御、首个恢复帧前加入真实需确认消息，用DialogService的MORE令牌消费，覆盖实际Logger opt-in与同步UI回调；不靠直接清除logger队列。健康动画/延迟动画/同步三条路径的完整世界、双RNG、完整录像严格相同（仅归零墙钟导出时刻）。

## 为什么没有删除currentTick累加

普通移动/等待等原生动作也独立累加命令检查点的 `timeSystem.currentTick`，随后由 `playerTurnEnded` 建立动画推进，`tickAdvancement` 消费同一个 `TimeCoordinator.advancementLoop`。防御动作的资源/窗口和NPC相位在 `advanceActionTime` 内按真实经过时间消耗。回归直接观察每次弹反累计100tick推进、一次turn收尾、输入锁及最终检查点。

因此仅看命令tick跳变不能证明NPC不推进；删除计账会改变录像检查点，却不能修复已确认的过期iterator丢弃路径。保留该计账，只修超时调度。

## 新回归覆盖

- 三个连续seed的真实DEV2x2可见预警，另一个原支持1x1 fallback布景精确匹配player(38,20)/source(37,19)；真实UI选NW并确认，不使用伪造Game替身
- 输入接受后确实 `isAdvancing` 和 `isInputLocked`；费用一次扣3、保护初始60
- 同一确认令牌二次回答被拒；推进期间重复公开输入不增加记录或费用
- 普通帧及模态仍开的GameCanvas条件路径均完成推进；累计调度100tick，无异常、无超时强制解锁
- 单次defended、双方HP不因弹反下降、poise保持、原预警actionId退休/新actionId出现
- 最终记录使用客观 `absoluteTurnNumber`，与一次主观 `stats.turns` 收尾分别核验
- 后续普通wait不延续已经耗尽的弹反保护
- parry和dodge分别比较健康动画UI、超过5秒间隙动画UI与同步模式：完整世界快照、双RNG、完整录像（只归零创建时刻 `recordedAt`）一致；快照只归零保存墙钟并把记录另行独立比较
- dodge费用4、恢复80；两种防御完成后保护/恢复都归零，输入时本身不抽RNG

首版新测试的开发错误单独记录：把录像的客观turn误与主观stats.turns比较；读取尚未实体化的默认体力行；比较export墙钟；使用当前TS目标不支持的Array.at。均只修新测试的观察方式/语法，没有修改旧测试、生产实现、容差或门限。

## 验证

- 修复后第一轮8项动画回归：8通过（最终扩为10项，见下节）
- 12个相关完整文件：245项通过，0 skipped，exit0；含动画回归、parry决策/规则/UI、dodge规则/UI、原生防御、严格防御状态、P2-4动画、presentation、repo hygiene及测试归属
- 真实Game组合smoke：empty、combat、combat+giants、combat+growth、combat+giants+growth，5通过；26项名称过滤未执行
- module boundary及唯一测试归属：通过
- vue-tsc＋生产build：通过；只有既有大chunk提示
- diff-check：通过

上表早期245项属于生产修复前的调查门禁。最终生产修复后的完整相关门禁另列下方，不能混称一个最终结果。

未运行完整npm test、全部test:ext、removal、CE full/gen/drift或giants长录像。没有像素、触控或本地浏览器验证声明。

## 隔离与历史

独立clone `/workspace/scratch/db2caf941a8f/BrogueJS-animated-defense`，分支 `fix/animated-defense`。3e脏工作区完全不动。实际fetch/ls-remote确认foundation为a01a892、phase4为0f89227；底座已经包含正式4d-2历史，未摘取或重写任何上游。未推送、未改main/tag、未部署。

原始调查与门禁日志保存在交付证据包：`animated-defense-ui-sequence.log`、`animated-defense-regression.log`、`animated-defense-gates.log`、`animated-defense-smoke.log`、`animated-defense-build-final.log`。源码回归无需这些日志即可重跑。

## 最终修复门禁

- 17个完整相关文件：291通过、2个既有P2-2生成/长局基线skip，exit0，114.53s。包括防御/UI/动画/P2-2异常超时、presentation、录像u27/x2a/x3b、U03快照及仓库守卫；命令中一个不存在的dialog_acknowledgments文件未匹配，不算第18个测试文件。
- 审查补充实际slow-turn已yield后超时，以及超时分支异常的两项测试后，最终新增文件10/10通过，exit0，14.98s。生产代码自上述17文件门禁后未再改变。
- 最终5个真实Game相关组合smoke通过，26项名称过滤，exit0，15.97s。
- 最终module boundary/测试归属、vue-tsc＋build、diff-check通过；build仅既有大chunk提示。
- 新增覆盖真实200tick slowed wait先yield25ms，再墙钟过期：仍完成原客观块，结果/双RNG/录像与同步一致，收尾/检查点恰好一次。超时分支next抛异常时继续保留原error/unlock/recording失效和一次收尾保护。
- 完成前实际fetch/merge foundation为Already up to date；ls-remote确认foundation与phase3仍为a01a892、phase4为0f89227。没有覆盖3e或重写4d历史。

最终原始日志为 `animated-defense-final-gates.log`、`animated-defense-final-test.log`、`animated-defense-final-smoke.log`、`animated-defense-final-build.log`。before/after墙钟间隙日志一并保留。一次轮询遇到平台自动审批容量错误，随后未完成的smoke明确重跑并保存exit0，不把基础设施失败当作测试通过。

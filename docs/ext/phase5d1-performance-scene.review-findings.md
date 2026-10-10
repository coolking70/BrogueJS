# 5D1 性能场景第十七次准备失败：只读诊断

2026-10-08。**现有证据定位到“取种后返回种植床的行走阶段”，不是种植信用不足或作物完成提交失败。** 农夫75的真实种植票据仍为carrying，未进入planting；屋外粮仓与屋内作业区之间共用一个门，诊断终点门格被向外取料的农夫77占住。优先最小修正合法场景的种子来源/通道，保留真实产物断言；不应继续增加wait次数或降低断言来把准备写成通过。

本次没有运行Game、Vitest、浏览器、build或性能计时，没有改任何生产/测试源码，仅核对冻结源码及已有诊断。拥塞的终点机制可以证明；完整320步是否循环、谁先让路及首次停滞tick，捕获文件没有逐步历史，不能伪造时间线或判定生产永久死锁。**性能未通过。**

## 1. 固定证据与故障位置

已读 `input/AGENTS.md`及必读项目文档、正式 `input/docs/ext/phase5d1.task.md`，随后读场景、准备/计时测试、ResidentJobs/Pathing/Needs/Economy/Production与原生移动链。输入2631份文件逐份匹配 `source-manifest.json`，无新增/缺失；该字典按排序键紧凑JSON独立计算的SHA为 `26d7626ef57db12b38768635eba383a1f705355e3f823ba648ab109d21e7e59a`。它是本诊断冻结集合的摘要，不是Git提交或性能候选通过标记。

`preparation-resident-seventeenth.json`明确是失败：仅registered=true被执行，crop断言返回false；另外两项在本次命令中未执行，不能把它们计入通过。该断言在冻结 `resident_performance_preparation.test.ts:20`；原运行栈报写诊断与断言同一长行的旧行号19，表达式对应一致。断言之前已完成320次公开wait、每步录制/时钟正推进、full summary存在、resident16及曾见job/bundle等检查。最终汇总与 `verifyResidentScale`在crop断言之后，故失败场景没有完整准备report/独立长区间核验通过结果。

任务告知64营地准备此前通过；本目录未提供那一次的原始通过结果，我不将其重新认证。更关键的是：64准备测试仅验证64活居民、4营、有限FOOD和长需求参考，**没有执行320wait或要求plant/haul完成**，所以64准备通过也不能反证本次16人工作场景失败（准备测试:26–32，`residentScaleReference.ts:run`仅advanceWorldClock/settleResidentNeeds）。

## 2. 可以确定的 actor/job 时间线

以下“阶段”由捕获状态和生产唯一转换推导，不是本次新执行trace。捕获的job.day=1，表明接受票据时在绝对区间[32000,64000)；文件未含每次wait的时钟，不能给接受动作杜撰精确tick。

| 角色 | 受控起点/命令 | 320wait后捕获 | 可确定的阶段 |
| --- | --- | --- | --- |
| 农夫75 | 起点(20,10)，plot64(19,14)，source1、destination69 | (23,8)；唯一job72；cargo73；phase=carrying；actionId=null；credit=0/r=0 | 已实际接受种子escrow、完成100tick pickup，尚未启动planting |
| 农夫74/76/77 | 三个不同plot，均source1 | (21,8)/(20,8)/(20,9)，仍plant/revision2/stopReason=null；没有当前票据 | 仍处在未来plant岗位；不能把岗位配置称为种植执行 |
| 搬运78–81 | source1→destination71，真实wood Item73，各quantity8 | (20,10)/(22,7)/(22,8)/(21,7)，仍haul/revision2；没有当前haul票据 | 没有现存取货/送货执行；诊断不提供任何成功搬运证据 |
| 守卫82–89 | 岗位等于各自初始post | 均在原外侧post，如(24,10–13)、(25,10–12)、(25,14) | 配置了站岗；不能由终点相同推断从未移动或已完成巡回 |

唯一job的 `hp=15`与goblin模板初始HP一致；pendingCompletion=false、reservedSlots=1。所有16个needs行alive=true、foodShortage=0、housingShortage=0、unfedDays=0。四plot最终reason=null、lightSum=0。这些排除了**终点**的食物/住房欠额、缺水和过亮停工；不能据此宣称每一历史子区间效率均100%。默认schedule[16,8,8]只有work半日产生经济劳动，rest/watch本来会暂停（ResidentJobs:50–54、414–420）。

转换证据：`ResidentJobs.ts:187–231`正式accept时创建唯一cargo/票据并startPhase100；`:336–338`pickup完成才设carrying；`:424–449`必须真正走到plot邻工作位、有交互线，才进入planting并创建劳动bundle。`:275–282`严格只给actionId非空、phase=planting、status=working的票据计信用。作物在`:344–369`完成事务才消费escrow并createOutputs。因此job75当前这条票据从未进入planting（阶段无反向转换），不会仅靠累计320次player wait生出crop。看到job/bundle只能证明取种阶段曾接受，不能证明1000有效劳动已发生。

## 3. 具体阻塞：双向物流穿同一个门

场景位置均来自 `residentPerformanceScene.ts`：

- `:48–50`粮仓marker/source在(24,9)，位于卧室东侧外部。
- `:64–70`卧室边界x17/23、y9/15，唯一门在(20,9)，并已打开；其余边格真实付费wood-wall，不能穿墙斜切。
- `:71,76–81`16床和4plot位于屋内，plot为(18–21,14)，产物箱69在(22,14)；种子6、木材32全部存屋外source1。
- `:118,128`4农夫和4搬运者全部从屋内出发，共用source1；8守卫站在源箱/物流箱外侧邻近格。农夫取种后必须返回屋内，其他人仍要向外走，形成双向相向流。

捕获终点，农夫75在(23,8)携种，目标(19,14)在屋内。墙边没有第二通路；唯一入口(20,9)由农夫77占着，门外(20,8)由农夫76占着，门内(20,10)由搬运78占着。门两旁又分别是wall(19,9)/(21,9)，不能从侧面直接跨到门内。附近(21,8)/(21,7)/(22,7)/(22,8)也有取料者。

`ResidentJobs.ts:89–115`只在合法、无actor/player占位的降距离格移动，否则尝试一次占位重规划，再正moveSpeed等待。`ResidentPathing.ts:60–70`重规划将其他活actor及player作为阻挡；不会移动阻挡者、友军交换或为相向流预留门格。故在捕获占位下，75无法从外部抵达plot工作位，当前票据保持carrying，信用0；`stopReason=null`正常，因为这种行走等待不走`:514–519`的accept错误分支。

**证实范围与假设：** 单门被占及carrying未进入劳动是确定的；整个采样过程是否长期相向振荡/饥饿调度，是强支持的拥塞解释，需极小逐步trace才能确定。没有证据证明低光阈值、需求闭式、bundle elapsed或crop提交算法坏了。也不要把goblin的MA_AVOID_CORRIDORS归为原因：`MonsterBlink.ts:120–131`该拒绝要求非盟友HUNTING等前提，当前居民是合法盟友；原生资格必须保留，不能为场景删能力。

## 4. 原执行者最小合法修正与有限验证

**优先只改测试场景：把6份种子在准备阶段经真实transfer存入既有屋内箱69(22,14)，四个plant job以该箱为source和destination。** `residentSchema.ts:13–27`允许plant source=destination；只有haul明确要求两箱不同。`ResidentJobs.ts:168–178`已经对同箱同时核算输入退款与输出预留。因此无需新增产物、虚构信用、放大FOOD、取消床/屋顶或改变生产逻辑。修改位置是场景`:79–81,128–129`的按材料选择box/source及revision；先站真实可交互内侧位，如(22,13)，再公开transfer。注册组与control使用同样付费建造及同样种子入箱准备，保持布景一致。

这消除农夫“出门取种再逆向回屋”的不必要单门往返；保留初始真实步行、pickup100、planting有效1000、seed→crop/真实入箱以及原crop断言。它是**待验证的场景修正**，本审查未运行，不能保证搬运也随之通过。四搬运仍走屋外source→不同箱71，八guard仍真实站岗；农夫不再加入门口相向流后，应单独核对haul实际取货/脚程/送货。

若真实搬运仍堵，下一步应给source/目的箱保留足够交互工作位，并把guard岗移离物流通道、或真实付费增加并打开第二扇门（如东墙(23,10)，保完整房间）。两组都按同一布局建造。不要只把NPC全塞目的格、测量中瞬移、暂停其他工人或放开穿墙来避免拥塞。

建议给原执行者一个有停点的验证流程：仅做一次不计时准备，先在已有320wait循环里采样前64或96步及状态变化（数据写原外部证据）；保留最终真实crop要求。记录75及门口76/77/78的worldTick、位置、schedule phase、有效eff、票据phase/actionId/credit，以及实选step/blockedMap结果。若到该小诊断截点仍没有进入planting，不继续盲加320/640wait；直接提交该trace。这里64/96只是提前诊断停点，不是缩小正式320正耗时样本或代替1000有效劳动。

最少应看到：seed入cargo→pickup完成→实际走到plot工作位→planting bundle→正信用→crop在指定箱；haul则source数量扣减→单一cargo→真实移动→目的箱数量增加/同Item守恒。只有这些真实工作履历成立，才进入parent安排的计时窗口。

## 5. 工作负载及control可比性尚未被充分证明

1. **目前是受阻物流负载，不是已验证的plant/haul/guard组合。** preparation及计时测试只检查jobs/bundles曾非空和某crop存在（准备`:20`、计时`:33`）；它们不按kind验证planting信用、haul完成、guard正等待/真实移动。当前捕获甚至只有一个plant pickup票据，不能据此说四农夫/四搬运都执行过。应保留crop断言并补分岗位小计，而非把配置数量当执行数量。

2. **必须确认劳动出现在ordinary样本内。** 计时测试`:28`排除前32次预热，`:29`只汇总全程creditPeak；`:33`的crop可由预热期完成。生产完成后把r.job设idle（ResidentJobs:367），无自动续批授权。因此最小布局修正若让所有有限plant/haul在前32步完成，后288步主要测idle/guard/rest，仍不能冒称ordinary测到了持续经济劳动。至少报告预热/ordinary各自的planting有效dt、credit增量、haul pickup/delivery、job活跃命令数。若活动全在预热，需要合法调整同源场景的初始日程相位/真实路径，使有明确劳动区间落入测量样本，或交指挥裁定可接受的分阶段代表性负载；不得在测量循环私加种子/信用或未经公开命令自动续单。

3. **路径指标确定漏计。** `resident_performance.test.ts:19,34`只spy `travelDistanceMap`。但 `ResidentPathing.ts:55–72`的占位fallback自身整图BFS不调用它，同时`:57`已给专门rebuilds计数+1；已有`:42`导出residentPathRebuilds。报告应保存该计数的样本前后差，另分缓存miss/native distance和blocked BFS；当前pathRebuilds不能称全路径重建次数。拥塞场景恰会反复走漏计分支，此缺口不是猜测性能超标。

4. **守卫站岗不等于已验证来回移动。** guard目标被设置为其初始post（场景`:124,128`），和平work/watch可正100tick等待；rest会往床边尝试（ResidentJobs:471–477）。这是合法站岗负载，但捕获终点都回到原post不证明实际床往返。准备`:18`只比较首尾位置，即使出去又返回也计0，且moved没有通过门槛。应记录逐命令移动/正等待次数，避免把端点moved当总工作量。

5. **control是16原生盟友、0经济居民，不是0 NPC。** 场景`:93–104,112`手动移除resident组件/索引/ledger，保留同类goblin及结构/FOOD/物料，并重置位置/timer；同时doesNotTrackLeader改false。原生盟友会追随player并随机mill（Monster.ts:1968–1993），不同于驻留岗位。这个control可以作为“新增居民经济系统相对既有同数量原生AI”的对照，但不是完全静止或逐步同路径的基线。相同seed和终点位置不足以证明两组初始HP/status、原生clock、food余量、结构版本、source/needs组件全部匹配；准备过程的更早NPC已在不同策略下行动。应在captured origin保存匹配字段及刻意差异，不宣称逐随机骰/逐动作相同。任何source/通道修改都对两组共同实施。

正式task要求的普通新增P95≤5ms、64长需求≤50ms均没有在本任务测量。住房/FOOD通过、codec通过、64有限预算或长需求守恒均不能代替16在场实际劳动与计时。原执行者继续作为唯一产品写入者；本报告到此停止。

# 3d 条件验收：弹反预警信息核对

最终结论：保留60tick排他弹反与正式stomp不可弹反；补齐HUD/地图属性提示、非阻断确认提醒，以及不改时钟/食人魔能力的正常付费玩家slash建立DEV预警。已纳入正式4d-2 foundation0f89227，停止在本修复，不进入3e。下文按时间保留复现、失败尝试与各次真实门禁，最后一节是最终交付结果。

## 原始反馈与先复现

本轮从干净 `ext/phase3` 的 `e8013907c9f8d5af7fd35f385af8bcc9d90f6713` 开始。GitHub API 与实际 `git ls-remote` 同时确认 foundation/phase3 为该提交；phase4 为 `1b3019ab43d8e6ebd03c1b4852468a6969cea898`，尚未发布进 foundation。完整 refspec fetch 后 merge foundation 显示 Already up to date；不提前取未发布阶段4实现，不重写任何并行历史。

用户在 Mac 的 combat-only DEV 食人魔预警中看到“即将释放”，连续正确朝向弹反仍受伤，韧性12→7。最初假设是 remaining60 正好撞上 window60 的排他终点。本轮**先新增真实 Game 成功期望回归，再修改生产代码**：实际 DEV 放置入口生成原生食人魔风摇，看到覆盖玩家的可见预警后直接执行正常 `ext:command/parry`，不手动推进时间、不改风摇/剩余时钟逼出结果。

初始成功期望确实失败。确定种子73073、清空地形的诊断场景得到：

| 时点 | 数据 |
| --- | --- |
| 第一次可输入预警 | 客观tick100；stomp风摇剩余50 |
| 正常弹反后的第一个推进块 | delta50；攻击剩余0；弹反窗口仍剩10 |
| 下一输入边界 | defended事实0；HP1000→992；poise12→7 |

这不是对用户曾看到remaining60的否认：场景前史不同可以改变首次可输入时的剩余量。但该复现证明**即使窗口没有到期，食人魔这招也不能弹反**。真实数据 `fixture.stomp.segments[0].parryable` 为false；同一底座解析器在尝试弹反前正确跳过了它。最初“应成功”的测试预期把不可弹反招式误当成可弹反，不能靠改截止边界使其通过。

原始失败用例与日志保留在本地 `/tmp/parry-timing/original-expect-success-regression.ts`、`repro-before.log`、`repro-two-before.log`。报告不把诊断场景称为自然局，也不以引擎测试冒充浏览器像素验证。

## 规则裁决

保留现有数据与语义：combat module/rules1.3.0，state schema3；parry cost3/window60/recovery100/poiseDamage12/contactRange1；stomp不可弹反；elapsed先扣、remaining>0才有效，终点排他。没有持久化或机械指纹变更。

理由：默认可弹反招式 slash风摇50，double-thrust风摇40/第二段间隔30，已经小于60。实际Game的默认rat/slash首次可见预警后正常弹反成功。将窗口扩到100不会使stomp变成可弹反，却会扩大原生攻击保护时长和NPC判断范围；改成包含终点会改动严格过期朝向校验和调度顺序，均不是这次已证实问题所需。

精确边界另外用**在创建局之前加载的合法自定义招式数据**检查：59/60/61风摇让玩家自然看到59/60/61；NPC则通过自身构造器100tick原生准备时间，在玩家159/160/161风摇中自然看到59/60/61。全部只用正常wait/attack/parry命令推进。玩家与NPC都在59成功、60/61失败，证明两边使用相同排他规则，不把边界测试改成“为成功而等待/手改elapsed”。

## 显示修复

- combat投影读取**当前段**的parryable与scheduler唯一phaseRemainingTicks；不暴露后续段定义。
- 可见来源/可见格过滤后复制冻结到DisplayTelegraph，再随历史DisplayFrame传给HUD。旧DTO缺字段或字段畸形时明确“弹反属性未知/释放时间未知”，不借当前局状态补未来信息。
- 预警明示“可弹反/不可弹反”及“距本段释放N时间刻”。“可弹反”只是招式属性，不保证朝向、接触范围、资源、时机都满足；完整说明放在预警title和弹反确认说明内，不再给72px HUD额外塞一行长说明。
- 说明明确开始弹反及其它行动会推进时间，命中必须发生在窗口归零之前。原单工具栏与CSS字节保持不变；不扩展显示为输入授权。
- 第一轮b44bea0保留原DEV stomp；用户后续明确要求可弹反练习场景。最终默认DEV已采用本文后节的真实玩家slash建立预警，stomp保留为显式负例；正式怪物profile和招式数据不变。

### 显示的单变量反事实

把更新后的两份显示/UI测试原样放入独立e801390工作树、保留全部旧生产文件：**2文件，8失败/24通过，exit1**。失败集中在缺少parryable/countdown、历史metadata、明确的属性/倒计时文本与窗口说明。相同测试在新显示代码 **2文件32项全部通过**；旧机械断言未削弱，原有测试只增加新信息断言。原始日志保留 `hud-counterfactual.log`。

## 门禁与范围

在生产代码修改前，新实际Game合同测试 **1文件10项全部通过**（包括默认首次可见警告成功、不可弹反/反方向失败、双方59/60/61、存读/精确录像检查点/双向seek）。初始要求stomp成功的失败证据与后续按真实数据纠正的断言分开记录，不冒称初次全绿。

e801390底座上的相关机械集合8文件252项通过；显示/实际Game/通用UI/仓库守卫集合8文件86项通过；静态源码守卫8项通过、51项名称过滤；5个相关真实Game模块子集smoke通过、26项名称过滤；boundary、vue-tsc+production build、diff-check通过。构建只有既有大chunk警告。900份输入的显示候选前后SHA-256为 `febd0737938494d71f856395fbf2963a5101ccdde0c7de603ee23876cde450dc`。

## 完成前同步新的4d-1 foundation

后续实际fetch/ls-remote发现foundation已推进到 `8f7ab26974a509821ad2f40e48e018a2878a87f5`（phase4同提交，phase3仍e801390）。立即正常fast-forward合入该正式底座，保留其两条父历史及22个上游文件；HUD补丁无冲突。不得把前一底座的门禁冒称这个整合结果的验收。新增上游涉及production body、唯一core调度、成员冷却/损伤/退休和严格整局状态合同；本轮不修改这些既有实现，也不修改giants默认数据。

整合后同一冻结候选，Node24.19.0、每个Vitest最多2workers、3GiB堆：

| 门禁 | 结果 |
| --- | --- |
| 19个完整相关文件 | **19/19通过，409/409项通过，0 skipped，exit0，88.45s** |
| 5个真实Game相关模块子集 | **5通过，26名称过滤未跑，exit0，13.05s** |
| 3个源码守卫文件的静态筛选 | **8通过，51名称过滤未跑，exit0，7.17s** |
| module boundary与唯一测试归属 | exit0 |
| vue-tsc + production build | exit0；只有既有大chunk提示 |
| git diff --check | exit0 |

19文件包含本次实际Game/HUD/UI、parry一次消费/无免费反击/RNG/闪避优先、严格时钟/存读、runtime/part-break、通用模块UI、仓库守卫，以及新增上游4d production-body、U03整局快照与换层。新测试已在combat自己的test-suites.json登记。既有终点59/60/61、持久化过期朝向和phase expiry断言不改；没有修改任何机械生产文件或默认数据。

最终904份生产/测试/脚本/配置输入在相关门禁前后完全一致，SHA-256 **`fd52687b437cdedb64190d2c0c801c796cb188866c8624c87e43726d7cbbbbe5`**。原始日志位于本地 `/tmp/parry-timing/integrated-*.log`，散列清单为 `integrated-source-before.json` / `integrated-source-after.json`；之后只补文档。此前e801390门禁与整合后结果分列，不叠加成一个不真实的全套数字。

未跑完整npm test、全部test:ext、removal、CE full/gen/drift或giants长录像；未进入3e、main、tag或部署。没有本候选的浏览器像素/触控证据；用户已完成的上一候选Mac试玩是本次反馈来源，不是新HUD的像素验收。本轮没有发起新的浏览器下载/重试，也没有伪称SSR布局测试就是320px实际画面。

完成前再次完整refspec fetch与实际ls-remote：foundation/phase4仍为8f7ab26，phase3仍为e801390；merge为Already up to date。独立维护审查已核对HUD与42项实际Game/UI测试，无源码blocker。当时先提交b44bea0显示修复与回归，没有发布远程；后续DEV选择已由本文最终正常命令方案解决，没有待用户决定的数据替换。

## 用户后续要求：地图图标与弹反确认提示

用户明确要求保留stomp不可弹反，同时扩展显示修复：地图预警格也区分属性，所选朝向只有不可弹反预警时确认页应提示但不能阻止操作，DEV场景需要可弹反示例。正式窗口/恢复/招式数据不变。

- 地图保留每格一次低透明填充与原阶段边框/顶部标记，新增左下盾形（可弹反）、右下×（不可弹反）、底部空心菱形（未知）。同格混合威胁聚合全部属性，不能让优先绘制的可弹反图标盖掉不可弹反威胁。12/16/24/32px下各图标笔画边界不重叠；这只是绘图操作断言，不是像素截图。
- 图例文字在combat locale；历史ACK只画捕获DTO，不回读活世界。隐藏来源/未见格仍被公开投影过滤，缺旧metadata不变成false。
- 确认页从捕获DisplayFrame的公开来源身体格/来源行确定所选朝向；该方向至少一个预警且全部明确parryable=false时显示提醒。未知属性或缺来源位置时保守不声称“只有不可弹反”。不从攻击落点猜来源朝向，不读活monster/definitions，不新增输入授权。
- 提醒仅出现在弹反确认步，确认仍enabled、命令字节与费用/恢复完全照旧。Back/Cancel/改方向、历史帧与令牌隔离均覆盖。

新增map8项、advisory24项。把这两份新测试及登记原样放在独立b44bea0旧生产树，得到 **20失败/12通过，exit1**；当前实现的相关UI4文件72项通过。负例断言以提醒实际是否启用为准，不把旧版缺少可选props误当成“错误显示提醒”。此前原有断言没有削弱。

### DEV诊断的实际约束与最终正常命令方案

按用户限制保持原DEV初始50tick、原招式windup/recovery和正常命令推进。食人魔外观/数值使用现有fan-edge profile的尝试，在正常等待后没有预警，并观察到已发生攻击/击退；没有为此延长初始timer。随后现有follow-thrust profile在一次正常wait之后确实给出首个可见第二段预警remaining20，但原食人魔的MA_ATTACKS_STAGGER已把玩家击退到接触范围外，meleeContact为null。这个失败不是窗口到期，也不能靠扩大window修复。当时曾询问是否可仅在DEV练习实体改用无击退战斗数据；随后找到下述完全使用正常动作的路线，该问题已撤回，无需用户再作数据选择。最终没有去掉食人魔击退，也没有采用kobold数值替换。原生rat首个预警正常弹反成功证明始终保留。

## 再次同步正式4d-2底座

实际fetch/ls-remote确认foundation/phase4已到 `0f89227f6626b59a77d3513bc6da91ffbc0b4067`，phase3仍e801390。正常merge纳入15个上游文件，与显示补丁无冲突，保留双方历史。上游新增≤4真实成员来源的profile/费用/scope、核心min边界/max收束、冻结member证明与core破防/局部取消；本任务不改这些规则、不扩大dodge白名单或giants默认数据。相关新4d测试中的诊断成员存读续跑不等于自然新局完整group replay/seek；本报告不借用它作这种声明。整合门禁与最终DEV结论另补。


最终DEV默认模式复用已存在的rat绑定fan-edge/slash profile，但外观、原生食人魔数值/能力（含MA_ATTACKS_STAGGER）与原50tick初始就绪保持。此前既有诊断HP10000/禁再生也原样保持；不是正式怪物/生成目录变更。方法是执行**一次真实玩家扇锋斩命令**建立场景，而不是wait：

| 顺序 | 默认数据下实际行为 |
| --- | --- |
| 建立诊断NPC | 原50tick就绪，不延后；不改window、windup或remaining |
| 玩家正常扇锋斩 | 面向实际接触边，花费4体力；风摇50＋恢复40＝90tick；正常命中抽签和伤害照旧 |
| 首个可见且可输入的预警 | 食人魔slash已自然风摇40，剩余10；没有此前食人魔攻击/击退或玩家HP损失 |
| 第一个后续玩家决策 | 正确朝向正常parry命令成功，单次defended事实；玩家HP不降、NPCHP不因弹反下降 |

三个预先列出的连续seed73073/73074/73075均走该完整DEV入口成功；没有按抽签挑seed、强制命中、伤后补HP或重置时钟。另保留原生rat构造器100就绪＋正常wait后首个warning50的成功证明；两者是不同真实命令前史，不能混称同一个场景。自定义59/60/61只检验排他合同，绝不作为修改fixture时钟强行过关的替代证据。

`debug_combat_telegraphs()`返回所执行setup动作、attackId、方向、配置成本/耗时、原始就绪值、是否有待确认和实际setup HP损失。准备期间若普通攻击需要风险确认，依旧由Game保留确认页，不自动批准；新增真实风险用例验证待确认/取消前后不扣体力、不推进NPC50tick。`debug_combat_telegraphs('stomp')`保留原wait100、不可弹反stomp负例。原显示测试改为显式选stomp，原false/50/导出拒绝断言不变；不是把负例改成成功。

## 最终冻结门禁与交付范围

最终基于正常merge `2fb3cd5a52ee10375999fb1f45f0453160f3866a`，其保留b44bea0与正式foundation `0f89227f6626b59a77d3513bc6da91ffbc0b4067` 两侧历史。最后实际完整refspec fetch/ls-remote再次确认foundation/phase4仍为0f89227，phase3仍e801390，merge为Already up to date；不碰main/tag，不强推。

| 最终冻结检查 | 实际结果 |
| --- | --- |
| 24个完整相关文件 | **24/24通过，525/525项通过，0 skipped，exit0，107.03s** |
| 5个真实Game相关模块子集 | **5通过，26名称过滤未执行，exit0，12.54s** |
| 静态源码守卫筛选 | **8通过，51名称过滤未执行，exit0，7.10s** |
| module boundary与测试唯一归属 | exit0 |
| vue-tsc＋production build | exit0；保留既有大chunk提示 |
| 单独DEV QA构建 | exit0，7.24s；确认产物含debug_combat_telegraphs |
| diff-check与源码冻结 | exit0；907项输入前后完全一致 |

最终生产/测试/脚本/配置集合SHA-256：**`f3736374d499e1a87c423c1c218cc566f89d6fa452165ffae7f28957c438167b`**。清单、精确24文件列表、v3命令日志与退出码保存在本地交付目录；代码冻结后只更新本报告与QA说明。

此前一次最终集合/构建在平台自动审批容量错误期间未得到完成结果；初次后台启动也没有实际开始。它们均不算通过或测试失败。最终改回同一授权直接命令，留下相关测试、构建、QA构建与smoke/守卫的明确exit0；没有换执行器或绕过审批，没有删测试、改timeout、放宽旧断言、扩大窗口或重录基线来换取通过。

本次没有修改相对0f89227的引擎机制、正式combat定义/版本、giants默认、保存/录像格式、失效校验或NPC规则。3d shared NPC边界、一次消费、无免费反击、dodge优先、RNG、严格存读/phase expiry及part-break回滚仍通过；新增4d核心/成员合同随其正式上游测试核对，不能把那组诊断续跑说成完整自然group replay。

只交付已验证的source bundle及对应编译DEV QA包，由维护流程进行正常快进发布。新HUD/地图/确认页的真实浏览器像素检查由支持的浏览器执行，结果另记；本报告不以绘图指令、SSR或引擎测试声称像素/触控已过。截图不入仓库/交付包。未跑完整npm test、全部test:ext、removal、CE full/gen/drift或giants长录像，未开始3e、main、tag或部署。

最终扩展审查已核对地图混合图标、公开历史数据、非阻断确认和正常付费DEV建立流程，无源码blocker；报告中已取消过时的“待用户选择”状态。三个固定seed的真实Game命令证明已通过，新显示的浏览器像素仍未运行。source bundle须验证并导入到持有前提提交的仓库后才用于发布；此执行任务不推送远程。

# 3d 条件验收：弹反预警信息核对

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
- 原DEV食人魔仍使用原stomp。另一个可弹反DEV场景的选择等待用户确认，本候选没有悄悄改怪物profile或正式招式。

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

完成前再次完整refspec fetch与实际ls-remote：foundation/phase4仍为8f7ab26，phase3仍为e801390；merge为Already up to date。独立维护审查已核对HUD与42项实际Game/UI测试，无源码blocker。当前只提交已明确范围的显示修复与回归；不发布远程，DEV可弹反场景的选择仍待用户确认，不能把这部分说成已完成。

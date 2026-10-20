# P1d A 段独立来源审计

2026-10-20；开工 `3431533`。本审计独立读取原实现，不将既有排他接缝视作已实现招募。PD1–PD7 已按维护者推荐批准。

## 俘虏

`Game.becomeAllyWith → becomeSingleAllyWith` 先保存 `isCaged`，原生掉落持物，清俘虏/擒抱、设盟友，再 `recordRescuedResident`。`freeCaptive` 与魔法救援共用这条路径。普通支配不应得到救援来源。party-only 不能依赖 settlement 的 source 组件；需在这条可信路径记录仅 party 有效的救援事实。

CE 参照为本地 `brogue/BrogueCE-master`，HEAD `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`，`Movement.c:728` 与 `:1193`：解除俘虏前掉持物，原生救援耗 attackSpeed，拒绝不耗时。P1d 的后续身份升格零 tick 是批准的扩展政策，不是 CE 原生规则。

既有自然证据入口为 `resident_captive_natural.test.ts` 与 `resident-captive-route.json`：seed 3 D3 goblin ID 86。其 No/Yes、原持物掉落、真实来源、存读与录像路径可复用。

**没有“随便一种简单怪物”可以直接变普通玩家。** kobold 并非已核实的 captive horde leader；tentacle horror 虽可减少技能映射却不适合操持装备。monkey 有偷窃逃跑及 DF，goblin 有穿刺和避走廊，ogre 有击退/慢攻击，mystic/conjurer 有法术。经二次执行路径核对，goblin/kobold 的目录 onHit 是旧数据：`Monster.hasEffectiveOnHitStatus` 明确排除；`hasStatusImmunity` 及 Game 抗性路径也排除 natural legacy 默认，不能按 JSON 启用这些无效能力。第一批可选 goblin 的实际自然链，保留有效穿刺、regen20、bloodType、accuracy70/defense10/damage、状态/最大状态、计时和已有 growth；避走廊属于原 NPC AI 策略，由显式受控策略替代。有效 onHit 若后续类型具有则必须保留，不能静默清除。白名单应登记在 party 有效规则指纹，不继承 settlement 的宽泛居民表。

`ControlledActor` 构造默认 HP30、力量12、营养2150及玩家血液类型，不能用构造默认值覆盖原身份。既有 post-rescue 持物已落地，招募不再赠还。实体 ID、HP、组件与物品所有权必须保留。

## 叙事

NPC 是 `WorldInteractable`，不是 Monster。`placement.ts` 在 committed enteredLevel 调 `placeInteractables`；`npcBindings` 记录 npcId/placementId/instanceKey。

`recruitment.ts` / `data/recruitment.json` 明确 author-only、targetPhase=5D3。`narrative2_metadata.test.ts` 会修改实际导入 JSON，验证旧运行/规则身份/奖励/录像不变。P1d 不得将该表直接变成权限；新增独立 party 专用白名单及可选查询能力，保持旧 pack 和元数据无变化。

首批最小合法链为 `cord.mender`、`cord.mender.verdict=splice`：D2–D3 `cord.mender.first` 每局最多一次；`open → ask → consider → choose-a → leave-a`。choose-a 设置 flag、journal、story；原 once-per-run trigger 发 `cord.mender.reward.receipt`。招募在对话关闭后显式执行，满员不消费资格、不重发奖励。

权威准入必须同时核对真实 world entity、npcBinding、placement receipt、已落盘 flag 和关闭的 session。同 ID 移交须清 world entity 与 binding，保留 placement/reward/trigger receipts。不存在原 NPC HP/装备；首次受控身份初始化必须作为单独批准的 party 规则登记，不能声称复制原 Monster。

## 居民与同 ID 桥接

普通 `prepareResidentCommand/commitResidentCommand` 已验证邻接、视野、交互线、camp revision、资格、床位、人口和粮食；普通 recruit/dismiss 自带100 ticks，P1d 不能递归执行它们。

建议保留同一个 `PartyMember` 对象，将控制中 actors 根迁至唯一 stationed 根，并从 members/native/window 移除；居民经济从 world5/resident component 读取它。原怪物居民首次加入可以转换表示但不得同时保留原 Monster 所有权。原 `residentActors` 和大量直接 `g.monsters.find` 都必须接受同一个驻营实体；Game 调度、占位、离层、死亡、departure、snapshot 实体图也需同步。

编回前先 `settleResidentNeeds(g,true)`。`cancelResidentWork` 负责取消订单、退 cargo、retire action bundle、写 interrupted receipt；`cancelResidentOrder` 退 escrow/工具、保留已完成批次、释放 reservations 和 ticket。源容器不存在时原物落到真实 home floor，不新造物品。随后 `removeResident(...,false)` 清 residentJobs/orders、residentStates/frozen.residents/productionQuotas、居民行和组件，不启动普通 departure。

保守阻挡非居民拥有的 busy action、未决窗口、非活动层、离营中、不能安全退款的坏引用。可安全取消的居民工作在同一外层事务结清。派驻使用真实 camp/合法空床、无岗位；需求和营养不能因往返而初始化为满。

`initialResidentNeed` 的0 shortage不是可重复恢复策略。首次转换须明确营养与日粮模型映射；之后保存原 resident need 行并连续交接。普通留守冻结与居民经济运行只能有一个有效计费所有者。

## 事务与验证

外层复用 `checkpointCombatFactWorld` 与 `runtime.checkpointPartyCommand`，居民内层复用 `transactResidentWorld/checkpointResidentWorld/worldWorkTransaction`。除了普通根，还必须恢复原 actor 对象、列表、stats/needs/bed/path sessions、双随机流、allocator、日志和录制前缀。实体替换不能只恢复存档 JSON。

`assertMemberEligibility` 只是单格/居民/raid/临时/生命排他接缝；新增动态名册需 independently 验证 immutable 开局人数、initial IDs、首次来源、转换记录与当前唯一 owner。死亡可保留历史 actor 根但不占活槽，派驻不能在 members 中保留假行。

建议定向整文件包括 resident sources/captive natural/jobs/labor/needs/production economy/failures/codec；narrative metadata/runtime/persistence/rewards/sessions；party lifecycle/actions/window/decisions/AI companion/worker，另加三来源真实命令与逐写阶段对象图回滚。此审计不代表实现或门禁通过。

## C 实施后的复核补充

驻营实体使用 `party.stationed` 唯一对象根；原生临时状态使用独立 `stationedNative`，与成员 `native` 按 ID 移交并随档保存。`TimeCoordinator.residents` 仅提供本层存活、未退役驻营人的瞬时视图；FREE 选择复用 `selectNativeActorAction → selectResidentDecision`，busy 相位只由原 actor-action scheduler 倒计时。原生状态、毒火伤害、环境接触及真实 HP 恢复仍推进，口粮由居民经济独占，往返不补营养。驻营不是可输入成员，也不伪装 Monster。施工的占格与逃生检查同样纳入驻营实体。

死亡、离营与驻营环境终止通过 `retireStationedResident` 取消/退款原工作、移除需求与住所、终结原居民来源，将同一个实体保留为退役历史。库存物品只移动一次到对应层，清装备引用；不重新生成物品，不恢复 HP。原居民事务现在包含 party 对象图，自动经济终止中途抛错亦恢复原对象与库存。

**需维护者后续裁定的限制**：原 Monster 的跨层坠落接收链不能无损接受 ControlledActor。本轮对驻营人落入深渊采用 `fallen` 原地退役、保留现有 HP 和历史、掉落原物品、不迁移队伍；不会伪称实现了原 Monster 跨层存活。这是安全终止分支，仍需后续决定可否继续扩展驻营跨层身份。正常居民寻路禁止危险格，不主动进入该分支；强制位移和地形变化仍会触发。

驻营遭敌复核补充：敌方原生寻敌、几何格查询与 bolt 候选现在通过独立 `nativeAllyActors` 视图看见本层驻营人；不把驻营人加入可输入 roster。驻营 FREE 居民选择器返回 native-fallback 后，仅对合法邻接、可见的敌人原地自卫，复用已付成本的原生 melee/符文/死亡结算并付一次攻速；无敌等待，失能/混乱/恐惧等居民禁用状态不自行攻击。**首版是平民原地自卫策略，未复用完整 Monster AI，也不主动追击。** NativeAttackTransaction 世界所有权同时纳入真实在场party盟友，以保留stamina/parry/poise守卫，仍不授予输入权限。

## 自然居民闭环最终证据

`party_resident_natural.test.ts` 使用 settlement 原 `resident-natural-route.json` 的 seed28、前388条公开输入和原确认选择，party开局人数1。真实生成ID25，原营地46、床27；付费招募后再用公开party输入完成编入、控制成员走进原营地、派驻和再次编入。未替换地图、移动实体坐标或补发预算；没有修改原自然路线黄金。

首轮 `C5_WRONG_LEVEL` 是新增测试漏了回营步骤：获招募者在(22,19)，主成员在(22,20)，真实营地区域从x=23开始。只修测试路径，保留驻营边界守卫。下一轮 `ACTOR_BUSY` 为全部timer为零时仍须遵循ready顺序，补公开等待后由新成员移动；同样未改生产守卫。

最终整文件1/1通过，exit0，218.81s（测试214.07s），Node v25.2.1、heap3072、单worker。包含同ID往返、save/load、406条事件从seed重放、转换前/驻营后/编回后的双向seek与续录摘要一致。日志 `/private/tmp/party-p1d/resident-natural-roundtrip-final.log`，结构化结果 `resident-natural-final.summary.json`；真实样本位于 `/private/tmp/party-p1d/perf/natural-resident-roundtrip-save.json` 和 `natural-resident-recording.json`。此项是作者执行证据，不冒称独立审查。

## 最终任务覆盖核对（只读，2026-10-20）

本节对照任务单、当前报告、选测清单与工具入口检查**交付覆盖**，不是第三轮总体代码审查，也没有新跑测试或修改生产。读取时最终85个影响面整文件仍在串行执行，性能尚未开始；因此以下待项是该时点快照，后续应由主报告链接实际结果关闭。R1/R2的既有结论不在本节重开。

### 仍需本轮自动工作或证据收口

| 任务要求 | 当前已具备 | 尚未闭合的具体项 |
| --- | --- | --- |
| §5 / PD-A01–10 最终精简门禁 | 85文件清单、13组合、无party五配置、全删准备/静态与若干有效分批证据 | 最终批正在跑；须逐文件合并有效结果、保留首败/反事实、不将不同批次拼成一次全绿。正常树最终types/build/源与工具hash要绑定所有生产差量；全删须最终实际拒包样本与classic/空生命周期通过，不能只引用prepare或静态完成。 |
| §2.2 / PD-A03 驻营离层经济与恢复 | 新C用例证明本层同实体岗位、haul、状态、退役及存读；旧resident/world5文件覆盖原Monster经济 | 在当前新party文件及根组合用例中，未找到**驻营ControlledActor实际离层→离线需求/劳动→返回→存读**的直接联测，也未找到该新根经**拆营/床失效**触发原有终止流程的直接联测。旧Monster居民用例不能单独证明新stationed根的这些入口。应补明确证据；本节不据此判断生产一定有错。 |
| §2.4 / PD-A08 旧名册异步job | 新`party_roster_worker`覆盖255/256/257与2047/2048/2049，生产Worker逐域、链和诊断载入；通用async文件覆盖迟到/乱序/旧generation/降级 | 新转换测试在转换前后每个边界主动flush，没有故意延迟旧名册job跨越转换的联合探针。应明确这项目前是“边界转换+通用队列”组合证据，不能写成已直接验证“旧名册job迟到不覆新根”；若要求直接覆盖，补转换邻近延迟/重复响应联测。 |
| §6 / PD-A11 本地性能 | 跨格式协议、AI A/B入口、四套runner/merge、新转换/AI负载工具已存在 | 最终源上的分层数据、三来源/票据/往返场景、rounds=1工具链冒烟及可追溯汇总仍待执行；必须保留短跑身份/实际steps，不能借历史阶段78项工具测试宣布性能通过。 |
| §6 新转换经济工作次数 | `profile-party-roster-perf`记录residentJobs/actionBundles/residents/tickets/orders的前后数量 | 这些是根记录量，不是结算/取消/退款等实际执行或处理次数。报告已诚实披露区别，但任务要求的经济工作次数尚不能由这些字段关闭。需补实际工作计数，或作为明确未完成项留裁定；不得改名冒充。 |
| §9 / PD-A12 文档状态 | 报告、独立R1/R2、人工清单、合同与本审计均已落地 | 报告仍有“叙事回放处理中”“自然居民重跑”“13组合复验中”等过时进度；自然居民最终1/1、UI最终19/19等已发给主作者，应按最终证据回填。最终源/build/tools、六种状态及R2后集成修复要单独列清，不能把尚未复核的后改动归入既有R2。 |

### 性能分层工具的实际覆盖

- `profile-party-window-perf.mjs` 对窗口/AI路径记录acceptWait、inputToReady、同步输入、stats、capture/restore、vision、scheduler、environment、NPC、recordMain、validation；另有projection/full/encoding/flush、生产Worker metrics、process CPU、GC、内存端点、AI calls/nodes/acceptedDecisions/budgetFallbacks/cacheHits。这些计时有包含/重叠关系，不能加总成互斥成本表；报告必须说明scope。工具能力不等于本次最终源已运行。
- `profile-party-perf.mjs` 保持原ready-actor-wait，记录command/event/projection/full/encoding/flush与生产Worker、体积/内存。它是旧wait工作量基线，不能代替新转换或AI负载。
- `profile-party-roster-perf.mjs` 有input/projection/full/encoding/Worker墙钟与算法/save计时，成功与拒绝按label/outcome分桶，P50/P95/P99/max/n、零tick、转换次数、根数量/体积及采样内存峰值；每个结果做实际load、snapshot重放/尾段恢复与Worker checkpoint核验。**没有seed replay计时或完整录像异步时序证明，没有经济实际执行次数，load验证也未单独计时。** 这些边界在结果解释中应保留。
- `profile-party-ai-load.mjs` 单列4096节点无路预算和0/8/16原生同伴；后者仅party-only，且是origin前可重建arena，不是自然场景。存在控制/决策、NPC、摘要/编码/flush及save/load/replay/seek证据入口。任务没有批准用这项替代party-ai-v1的only/all校准；两者必须分列。

### 命令和承诺的精确性

1. 当前报告的`gh workflow run`四种suite、mode、comparison、rounds及三分片名称与workflow一致；phase6明确传6c4/6c4，party A/B显式传`party-p1c-p1d-v1`，下载/merge入口也对应实际工具。B/control必须仍保留为维护者未来真实已推送SHA，未提交工作树不能伪造可派发SHA。当前RecordingDigest文件SHA与报告所列`bf3bef…a9cd`一致。
2. 报告的新转换示例只调用`capture-party-roster-perf OUTPUT`，默认仅产出rescue-1/2/4；后面的循环也只运行这些rescue场景。**照抄该段不会覆盖居民、票据、往返和叙事。** capture工具已支持额外的schema1 `diagnostic-origin` wrapper参数，实际报告需补传入本次最终resident-before-join、resident-with-ticket及叙事wrapper，并列出产出的每个scenario与各自profile命令。自然存档/录像不是该wrapper格式，不能直接拿来充数。输出目录要求全新，重跑用独立路径。
3. “工具仅冒烟云端派发将rounds改1”是未来远端示例，不是本轮**本地**冒烟的可执行记录。需补本次实际本地runner命令、冻结A/B/control工作目录、Node精确版本、heap、rounds/steps/shard/mode/comparison及输出路径；本地缩短steps必须明确smoke-only，不能写成完整2049输入校准。
4. “未来维护者可执行AI-load”的命令可作为复现实验说明，但本次用户已要求本地分层，不应把必需的本地AI无路/同伴诊断默认外包维护者。正式三轮云端由维护者派发与本地作者工作是两项。
5. 固定Node/heap/单worker是本次测试与计时要求。文档通用`node`不自动保证Node24；最终执行记录必须写实际解析到的版本，计时不得与85文件门禁争资源。自然居民已通过记录确实是Node25.2.1，不能改写为Node24。

### 已明确由维护者完成或裁定的事项

- **正式云端派发/数据**：用户将最终party校准、非party D6以及批准的跨格式比较派发留维护者侧；当前可以完成精确命令和本地冒烟，但正式run URL、三轮/独立第四轮、下载工件hash及D6判定目前不存在，PD-A11正式云端部分不能标通过。party三套/新场景继续report-only，不追加硬预算。
- **浏览器与真机**：桌面、320/390横竖屏、手势、目标/焦点、对话/背包、Worker后台、点击延迟/FPS和真机均由独立manual checklist保留待验。SFC/Node通过不代填。
- **已记录行为限制待裁定**：驻营强制坠落采用fallen原地退役，尚非原Monster跨层存活；护送明确拒绝，邻接自卫不主动追击。按用户指令记录后继续其他工作，不能把它们静默写成完整原生等价。
- **发布**：未授权commit/push/tag/merge，本次不得提交。最终自动通过、R1/R2状态、正式云端、人工、发布须分别陈述；正常等待维护者派发/人工不是要求作者中途停工。


### 主笔补验闭合记录（2026-10-20，保留上述审计时状态）

- 新驻营根已补实际公开离层/返回、真实离线日粮结算、两阶段无origin存读；拆床住房欠额、有居民撤营拒绝、公开遣散后一次落物与撤营、终端存读均在`party_resident_handoff`最终15/15通过（`extra-resident-second.log`）。楼梯/交互定位及推进经济日界是明确诊断布景，不冒称自然seed输入；原seed28公开406事件链单独1/1通过。
- 旧job/新名册直接联合探针已补：真实生产Worker冻结256旧居民、257加入名册，先交257再256；512成员/513派驻同样乱序，并在新请求等待时重复已完成旧响应。两例整文件通过（`extra-final.log`），原六边界保留；活实体/库存/native根、RNG/allocator/tick、机械摘要与前缀链不被旧响应覆盖。
- 85个影响面整文件、13个真MainMenu配置、实体九模块全删的21个适用整文件、classic和extended空生命周期、15份真实缺包样本、静态/types/build已闭合；原失败、两旧skip和各批Node版本详见主报告，未把多批重复计成一次全绿。
- 性能工具已增加诊断专用经济调用/处理行/epoch/job计数观察器，源码只在Vite内存中插桩，另以未插桩引擎验证逐步机械等价；工具整文件26/26。实际最终本地测量与精确四wrapper/九场景命令由主报告性能节登记。正式云端与人工事项仍保持未验。

上述为主笔执行结果回填，不是第三轮独立审查。

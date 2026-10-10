# giants2 第二批原创巨兽交付报告

> 结论：部分完成。两种新巨兽的数据、独立自然战斗与固定trace已交付；共享录像/输入锁问题、铜须持久化复核中断、旧复合体路线及真实浏览器证据仍阻断完整验收。

## 1 结论与范围

两种species、四forms：盲灯蜷兽/展躯盲灯兽、铜须伏螯/外围节须。生产只按任务包精确追加数据及自有i18n；底座AI/时钟/RNG/身体/转换/奖励接口和所有版本不改。

## 2 基线与恢复环境

- 原代码基线e0fa39a225428d36e6e342f6585f57f45960e6ba；派发tip924afe3ffb3eba4d5dda950c3225fb81e09eef03，差异只有任务包。
- 工作分支ext/giants2。首次工作树BrogueJS-giants2在2026-10-08 20:01UTC执行环境断线后，在恢复视图不可见，/tmp证据亦不可见；不能断言永久丢失。
- 20:51只读恢复核对：七个既有仓库均无派发对象或giants2工作树登记，shared仅见较早交付。远端ext/giants2-base仍精确924afe3，未见ext/giants2。
- 按已授权任务在全新BrogueJS-giants2-recovery重建，未覆盖原路径或其他工作树。独立Git目录引用既有只读对象，并只fetch精确派发分支，起始工作树干净。没有纳入维护者后续foundation12。
- Node24.19.0前置PATH，NODE_OPTIONS=--max-old-space-size=3072，Vitest --maxWorkers=2；重型命令全局串行。依赖逐包链接既有安装，Vite缓存独立；检查发现初期TS的.tmp缓存链接到依赖来源树，收口已改为本候选独立目录，并要求重跑types/build。未改其他工作树的受控源码；package/lock不改。
- 旧环境结果仅历史：两条自然trace155/615事件曾真实捕获且固定命令比较2/2通过，boundary与修正后types通过；build完成未知。原文件/日志不在当前恢复视图，因此本轮重新采集与验证，不能把旧通过数算入最终候选。
- 当前恢复证据/tmp/giants2-evidence、/tmp/giants2-recovery-evidence；周期源码备份/workspace/shared/giants2-recovery-backups，不承诺跨环境丢失必定幸存。
- 最终提交和精确源树hash见交付回执及仓库外receipt；远端重建提交的SHA可能不同，但应核对同一源树。执行者未push，不把本地SHA冒充远端发布结果。

## 3 写入白名单与版本

仅src/ext/modules/giants/**、docs/ext/giants-config.md、本报告。任务包、共享文件、其他模块零改动。foundation11/whole-run6/recording4/origin2/world5 schema2/worldSdk1/edibleSdk1保持；giants module/rules1.0.0、pack/state/spatial schema1保持。最终31个写入文件全部在白名单、均≤1MB、无CRLF；受控共享文件/版本零改动。文件清单见附录B。

## 4 数据与身份

从任务包§3.3及§5原文提取JSON，精确追加forms/templates/transitions和bodies.definitions/breakRules；原attackProfiles、所有前缀字段与顺序保持，statusProfiles保持缺席。9forms/6templates/2bodies/2member-breaks/2transitions/原2attackProfiles。locale仅替换旧module.description，其余新加。四新form金币/物品掉率0、专属奖励0，无新growth报价。

最终机械fingerprint应为sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8；以本轮契约结果为准。旧真实pack输入拒绝，不迁移或改manifest。完整数值/形状/支撑/阶段/侧室/可配边界见配置手册。

## 5 SDK问题

- G2-SDK01（新增真实录像阻断）：giants+growth及七模块的**原始、尚未读档**自然接触录像已经分别在command126/tick12400和command121/tick11900报extensions域OOS（捕获接触终点为134/129事件）。故不是save/load或seek0夹具导致。最小对照中，原局继续wait2与读档后wait2的完整规范世界在加载点及两后缀均零变化叶；其续录仍重现原始OOS。分类probe进程exit0只表示成功采集对照，绝不计为录像门禁通过。原档、原录制、续录和报告位于/tmp/giants2-recovery-evidence/growth-{pair,all}-*；精确首分歧仅一个完整世界叶：pair的/extensions/modules/growth/actors/53、ALL的同路径actor77，replay多保留{player:false,allied:false,hostile:true,alive:false,relation:0}，直接公开输入已移除此死亡actor；其余规范世界叶、双RNG、时间、消息完全相同。建议维护者检查growth simulationSettled死亡actor清理与直接advanceCommand/completeReplayEvent的结算时点；此处不补共享逻辑，不排除该叶或更新hash来隐藏OOS。复现：npx vitest run src/ext/modules/giants/tests/giants2_combinations.test.ts -t 'giants[+]growth' --maxWorkers=2。精确输入/首分歧save与world在growth-{pair,all}-first-oos-*。
- G2-SDK02（新增headless真实Game输入阻断）：全七模块seed1/wizard原生产路线在D5、event314、turn313、位置30,10停止，isAdvancing=false而isInputLocked=true；player stamina24满、poise0、staggerRemainingTicks20，NPC native bundle recovery尚余10ticks。一次正式wait和后续原路线step均不增加事件/turn、不移动、不解锁；pending确认为空、lastAdvancementError为空。因此不是缺补充等待或体力不足。原档及读状态probe在all-copper-blocked-{save,probe}.json；不调用私有时钟或清锁绕过。全七模块铜须完整出生/世界预留验证受阻，不能声称通过。建议维护者检查共享actor-lock与自然回合结算/后续生产调度恢复；本轮浏览器不可用，未把headless复现扩称所有浏览器路径皆同。
- G2-BASE01（原基线已有）：phase4a0_spatial源守卫拒绝Game.ts:13743的passenger.loc={...actor.loc}直接写入。四个被扫描生产文件均与924afe3逐字节相同，失败不是本次模块改动引入；共享守卫及生产均未修。
- 非SDK缺陷：过预算诊断漏catalog绑定；新测试类型错误；真实近战poise预言遗漏原生命中2点；新铜须持久化把同步已回答确认误当必须异步pending；七模块诊断清除居民来源actor导致原生引用校验拒绝。这些只能修自有夹具前提，不弱化断言/skip/todo。

## 6 覆盖索引

| 项目 | 自有测试 | 分类 |
| --- | --- | --- |
| DATA/IMP | giants2_contract/giants2_imports | 精确文档契约、AST、真实Runtime |
| MASK | giants2_geometry | 空间诊断 |
| ZONE/BODY/REWARD | giants2_parts | 真实Game/Combat诊断 |
| PHASE | giants2_phase | NPC决策与成功/失败诊断 |
| GEN | giants2_generation | 公开路线自然出生及明确诊断负例 |
| PERSIST | giants2_persistence | 固定自然输入、续录/回放/seek、坏输入拒绝及真实往返 |
| UI | giants2_ui | 真实DisplayFrame与SFC；浏览器另列 |
| COMBO | giants2_combinations | 九行自然接触/闭环测试及独立联动诊断（两行OOS保留） |
| TRACE | giants2_trace/giants2NaturalFixture | 正式生成、公开命令、固定回归 |

索引不代替实际通过结果。

## 7 门禁

完整首轮结果（不是全绿；后续只列受影响复核，不累计重叠数）：

| 命令 | exit | 实际结果 | 耗时 |
| --- | ---: | --- | ---: |
| node scripts/check-module-boundaries.mjs | 0 | 边界及测试归属通过 | 6s |
| npx vue-tsc -b | 0 | 类型通过 | 25s |
| npm run build | 0 | 实际生产构建通过 | 33s |
| npx vitest run src/ext/modules/giants/tests --maxWorkers=2 --no-file-parallelism | 1 | 28文件：192通过/17失败，0skip/0todo | 2260.41s |
| npm run test:drift -- --maxWorkers=2 --no-file-parallelism | 0 | 7文件14项通过，0失败/skip/todo | 322.88s |
| 下列13文件定向Vitest，maxWorkers2、no-file-parallelism | 1 | 205通过/1失败，0skip/0todo | 291.17s |
| node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,growth,narrative,settlement --engine-only --maxWorkers=2 | 0 | 恰1行removed=[giants]，保留其余6模块；normal full=not-run | <1s |
| git diff --check | 0 | 无空白错误 | <1s |

定向文件：phase4a0_spatial、phase4a2_body_combat、phase4d_production_body、phase4d_body_lifecycle、phase4e_body_transition、ext_combat_transition_facts、ext_generation_checkpoint_differential、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、test_suite_membership、phase4a3_body_display、x3b_display_recording（全部为src/test下实际存在的.test.ts）。对应空间/部位/转换/原子回滚/持久化/显示/i18n/归属与源守卫，不以全ext替代选取。

17项自有首轮失败按根因分组：新铜须持久化4项被同一同步确认夹具前提阻断；growth和七模块自然续录各1项extensions域OOS；七模块奖励诊断清场造成resident.source.actor失联1项；七模块固定seed2铜须路线D6未完成1项；旧D7/8模板清单漏铜须1项；旧guard随机变形样本仍原形1项；旧D2 fall夹具原样读档拒绝1项；旧C5 seed7306在D2死亡1项；旧复合体5项被D12无安全楼梯路线阻断。新确认/奖励夹具已作窄修，单批复核与SDK最小复现见§5；四个旧前提完成单批窄修复核：原副本四个原测试4/4通过exit0、28.73s；候选对应四个测试4/4通过exit0、31.03s。两次各有27项因-t未选择，不能计为通过，也没有向源码添加skip。修订仅：D6/7/8贡献列表追加铜须；guard诊断显式抽合法rat，避免新数据/种子下随机无位结果；D2落层诊断在清列表前走原生行政退休，保持生成所有权闭包；C5显式旧seed7306改用已确认的GIANTS_ACCEPTANCE_SEED7328。全部原断言和旧timeout保留。runtime原副本同时用原7306，故标原前提重现；不能称相对于候选7328只变了数据。

新持久化/组合的两文件修正后复核于22:15启动，随后执行环境生命周期暂停。23:35恢复时session43310已不存在、日志仅startup，没有终态或case结果；登记为**中断/不可验证**，不称通过、测试超时或产品失败。源码中的同步确认与居民保留修正仅完成类型/构建复核，仍需维护者重跑这两文件。最后类型/构建发现新确认断言使用Array.at而目标库不支持（两命令各exit2、25s），仅换为等价slice(-1)[0]；收口独立TS缓存下types exit0、26s，实际build exit0、33s（Vite8.48s），boundary exit0、6s，diff-check exit0。未重复完整自有套件、未重采自然trace来追求绿灯。所有首轮失败与后续受影响复核分别列，不累计重叠数；未运行不称通过。

开发期：M1契约/导入/原配置示例3文件44项通过exit0、19.84s；types首轮exit2（五个新测试类型错误：Pose字面量、replaceAll目标库、无效Player.accuracy设置），修正后types exit0、24s。M2四文件30通过/1失败exit1、57.45s；真实近战除灯褶破坏5点还扣原生命中2点，原预期7遗漏后者。沿冻结policy12/2及破甲5独立算式12−2−5修正新夹具预言，不改生产或弱化伤害/互斥断言。受影响parts/imports2文件31项通过exit0、14.06s。边界exit0、6s，最终types exit0、25s，实际build exit0、33s（Vite8.34s，有既有大chunk提示）。

## 8 自然trace与持久化

两物种分别顺序seed1…64，必要时65…256一次扩展；每seed下楼/原生装备食物等≤3000、战斗≤800。最终生产概率/深度原样，全图只读BFS规划，所有改变经公开命令；没有reveal/teleport/HP或装备注入。wizard不作normal平衡证明。

本轮首次采集+固定命令回归2/2通过236.27s。审查发现失败seed摘要只在每100步更新，可能记录前一层；仅补finally刷新摘要后重新完整采集，2/2通过236.91s，不改路线与任何世界数据。

| 物种 | seed/mode/modules | 自然出生 | 事件/tick/录像字节 | 关键事件索引 |
| --- | --- | --- | --- | --- |
| 盲灯 | 1/wizard/[giants] | D2/actor70/region69/lantern-chamber | 155/15400/150360 | 到达44、接触123、破甲132→133、展躯141→142、终结154→155 |
| 伏螯 | 2/wizard/[giants] | D7/core159/region158/copper-chamber | 615/60900/594406 | 到达541、接触544、首断555→556、二断563、三断569→570且核心活/失支撑、四断581、终结614→615 |

两个紧凑文件约21KB/74KB。盲灯seed1即完成；伏螯seed1真实走到D8、585事件无目标（D5 no-space/D6先占预算），seed2完成。无65…256扩展。完整搜索表、原始录像及新局0/到达/破坏后/转换后/终结后的save；前状态提供完整规范hash，持久化测试仅在内存重建相应save保存在/tmp/giants2-evidence，另压缩备份至/workspace/shared/giants2-recovery-backups/evidence-M3-2112.tar.gz；不能以备份存在承诺跨环境持久。

原始输入是未改manifest的正式命令录制。首轮盲灯四项持久化测试通过；铜须四项在初始重建的确认夹具前提处失败，修正后的长复核被执行环境中断，因此铜须完整save/load续录/replay/seek/楼梯往返不能宣称通过。normal seed1/D2公开接触通过；不声称normal击杀或难度平衡。新局0、到达、破坏/转换/终结前后真相完整规范化；只归一化savedAt，不删除机械叶。

## 9 九组合与删除计划

[]、giants、giants分别配combat/growth/narrative/crafting/foraging/settlement、七模块全开。首轮八个giants行均自然接触新种；九行中7行完整闭环通过，giants+growth及七模块两行被原始录像OOS阻断。含combat的部位provider、缺combat的fallback和growth零报价另作真实诊断；不冒充128覆盖。

只运行：node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,growth,narrative,settlement --engine-only --maxWorkers=2。
实际plan恰一行removed=[giants]、retained其余6个，normalTreeFullGate.status=not-run。实际删除留5Z：去掉--plan并追加唯一仓库外--output；剩余boundary/types/build/test:ext/64子集及两份实际新巨兽save/recording拒绝均须另验，浏览器需去掉engine-only。计划不代表删除通过。

## 10 UI

1440×900/390×844/320×844 ×普通/沉浸×四地图模式。五状态：蜷伏、破甲、展躯、完整须、断须；检视/HUD/凹角/隐藏/历史帧与回放seek分列。SFC诊断不代替真实构建浏览器，截图仅仓库外。真实手机未测。实际构建浏览器执行0/120、通过0/120，全部逐格未运行：3视口×2布局×4模式×5状态。已验证录制索引并准备真实file-input/seek/settings/右键检视脚本；Chromium启动因本地IPC socket EPERM失败（常规和获准escalation均exit1），受支持CUA浏览器打开预览URL又为ERR_CONNECTION_REFUSED，页面未加载。故没有截图，不把其当产品UI失败或组件通过替代。逐格结果及脚本/log在/tmp/giants2-browser，维护者可在可访问预览的浏览器补验。

## 11 旧测试/trace前提与反事实

原契约仅forms5→9/templates4→6/nameKey5→9三计数。旧自然轨迹仅因追加生成数据和指纹变更重采；只回退definitions的副本对照与原公开捕获方法，所有断言/旧超时保持。恢复前normal seed7306在D2死亡，顺序搜索首次7328保留normal、四向路线、D3首个且唯一岩脊兽前提；本轮会重新确认，不伪造恢复不存在的旧搜索账本。本轮严格仅definitions回退、locale保持最终值：原两trace2/2通过18.02s、原spine1/1通过42.65s，均exit0且旧60秒门限不变。两项种子诊断重新证实7306/D2死亡及7328/D3/135事件/HP15/唯一岩脊兽。原BROGUE_CAPTURE_GIANTS_TRACE=1重采两trace2/2通过19.93s、spine1/1通过43.17s。三JSON与断线前保留的最终SHA完全一致；共享及别家基线零改动。

逐叶变化见附录A；normal33、colossus56、spine89。normal种子前提替换；另两种原seed/mode/物种/HP/形状保持，新增场地改变placement、allocator、指纹、世界及双RNG路径。旧环境spine超时只属旧环境历史，本轮原门限实际通过。

## 12 决定与审查

G2-D01…D06按任务包执行；没有新增战利品、再生、自定义AI、持久根或协议。可逆选择：测试按职责拆分，原包oracle、只读全图路线、模块自有AST守卫、仓库外原始证据与源码备份。恢复轮独立审查1确认数据/locale/oracle精确、自然无注入、导入和持久化主体覆盖；发现并修正空named import/export绕过AST守卫、失败seed摘要刷新和四pose凹角必须公开move证明。另补存活破甲/展躯/失支撑重访的稳定部位及派生速度断言。第二轮完成静态/真实输入复核，确认上述修正、精确数据、trace原始命令、测试登记及0/120浏览器口径；最终失败与中断按本报告保留。只做这两轮审查和已列出的单批窄修，不加第三轮扩张。

## 13 遗留与5Z

本轮为可复现的部分交付，不是全绿验收。

功能/状态阻断：G2-SDK01 growth死亡actor在replay多留一叶而OOS；G2-SDK02七模块headless输入锁无法经普通wait/step继续。二者共享修订均交维护者。
证据/既有测试剩余：铜须完整持久化及修正后组合两文件的复核被环境中断；原复合体seed7309五项被D12无安全路线阻断，未继续旧种子/路线搜索；G2-BASE01共享源守卫原基线已失败；真实浏览器120格未运行、真设备未测。组件测试已通过，但不替代浏览器。

全七模块铜须探索保留seed1…6尝试与中断exit130；seed4到D8无目标，其余为深度路线未完成。早期该外部probe未启用捕获开关，日志里的depth1/events0为陈旧摘要，不能引用为实际进度；真实失败深度只引用错误字符串。发现可复现输入锁后停止盲搜，未改生产概率/深度/HP或私有时钟。helper现已将内存搜索摘要与写日志开关分离；这不追造丢失的旧计数。未运行且明确留5Z：完整npm test、全部test:ext、128组合、实际删除矩阵/只删giants、全项目性能/体积、ce:fetch/test:full/test:gen。功能/状态阻断与浏览器/设备证据缺口须分别登记，不能自行把功能缺陷归为无影响。

## 附录A 旧trace逐叶重录登记

从原公开捕获方法的真实输出逐叶比较；未手改manifest、期望摘要或共享基线。

### spine-natural-trace.json（89叶）

| 路径 | 原值 | 新值 |
| --- | --- | --- |
| `/boss/id` | `277` | `355` |
| `/boss/spatial/movementRegionId` | `276` | `354` |
| `/commands` | `1174` | `1129` |
| `/commandsHash` | `"2937b269b0c94d16606dfff5bd65e846bd7d09c9389c97bc2f986af2f6852acb"` | `"9bec693d38ff51dd917d1b78489aee2d35aca7cc42b6028b70580976d8a34fd7"` |
| `/extensionsHash` | `"59a76eaf6ab2430a512bb1b9e479c97778270f09ad6f6578016404f3dc5cbac1"` | `"a25ebe05702ae9c744fd462252d885426cc1b7ceb9ab54f2ff302d8c0afeef2c"` |
| `/nativeWorldHash` | `"e22be1ef55fedf188ff2b9fac73ab2103ff3b555abc3aaee09af9961b9a8854b"` | `"def2e9f8d126b570ec22448acb58e207e55e9e7436be48bd6768526601a30da0"` |
| `/rng/cosmeticNumbersGenerated` | `218` | `554` |
| `/rng/randomNumbersGenerated` | `3192634` | `1809992` |
| `/rng/streams/0/a` | `4151359883` | `3353936444` |
| `/rng/streams/0/b` | `269303261` | `2709179059` |
| `/rng/streams/0/c` | `2656930214` | `1286853845` |
| `/rng/streams/0/d` | `2689637803` | `2528348433` |
| `/rng/streams/1/a` | `1327421572` | `3233743101` |
| `/rng/streams/1/b` | `3353250964` | `1049576734` |
| `/rng/streams/1/c` | `445618263` | `596737203` |
| `/rng/streams/1/d` | `4118652294` | `2112441856` |
| `/state/bosses/0/primaryId` | `77` | `64` |
| `/state/bosses/0/regionId` | `76` | `63` |
| `/state/bosses/0/subjects/0/groupId` | `77` | `64` |
| `/state/bosses/1/primaryId` | `96` | `102` |
| `/state/bosses/1/regionId` | `95` | `101` |
| `/state/bosses/1/subjects/0/groupId` | `96` | `102` |
| `/state/bosses/2/primaryId` | `145` | `162` |
| `/state/bosses/2/regionId` | `144` | `161` |
| `/state/bosses/2/subjects/0/groupId` | `145` | `162` |
| `/state/bosses/3/primaryId` | `166` | `200` |
| `/state/bosses/3/regionId` | `165` | `199` |
| `/state/bosses/3/subjects/0/groupId` | `166` | `200` |
| `/state/bosses/4/primaryId` | `233` | `304` |
| `/state/bosses/4/regionId` | `232` | `303` |
| `/state/bosses/4/subjects/0/groupId` | `233` | `304` |
| `/state/bosses/5/primaryId` | `277` | `355` |
| `/state/bosses/5/regionId` | `276` | `354` |
| `/state/bosses/5/subjects/0/groupId` | `277` | `355` |
| `/state/placements/1/regionId` | `76` | `63` |
| `/state/placements/10/depth` | `{"absent":true}` | `10` |
| `/state/placements/10/instanceKey` | `{"absent":true}` | `"giants.abyssal-chamber.depth-10"` |
| `/state/placements/10/reason` | `{"absent":true}` | `null` |
| `/state/placements/10/regionId` | `{"absent":true}` | `303` |
| `/state/placements/10/result` | `{"absent":true}` | `"placed"` |
| `/state/placements/10/templateId` | `{"absent":true}` | `"giants.abyssal-chamber"` |
| `/state/placements/11/depth` | `{"absent":true}` | `10` |
| `/state/placements/11/instanceKey` | `{"absent":true}` | `"giants.spine-chamber.depth-10"` |
| `/state/placements/11/reason` | `{"absent":true}` | `"budget"` |
| `/state/placements/11/regionId` | `{"absent":true}` | `null` |
| `/state/placements/11/result` | `{"absent":true}` | `"skipped"` |
| `/state/placements/11/templateId` | `{"absent":true}` | `"giants.spine-chamber"` |
| `/state/placements/12/depth` | `{"absent":true}` | `11` |
| `/state/placements/12/instanceKey` | `{"absent":true}` | `"giants.spine-chamber.depth-11"` |
| `/state/placements/12/reason` | `{"absent":true}` | `null` |
| `/state/placements/12/regionId` | `{"absent":true}` | `354` |
| `/state/placements/12/result` | `{"absent":true}` | `"placed"` |
| `/state/placements/12/templateId` | `{"absent":true}` | `"giants.spine-chamber"` |
| `/state/placements/2/regionId` | `95` | `101` |
| `/state/placements/3/depth` | `7` | `5` |
| `/state/placements/3/instanceKey` | `"giants.abyssal-chamber.depth-7"` | `"giants.copper-chamber.depth-5"` |
| `/state/placements/3/reason` | `null` | `"budget"` |
| `/state/placements/3/regionId` | `144` | `null` |
| `/state/placements/3/result` | `"placed"` | `"skipped"` |
| `/state/placements/3/templateId` | `"giants.abyssal-chamber"` | `"giants.copper-chamber"` |
| `/state/placements/4/depth` | `7` | `6` |
| `/state/placements/4/instanceKey` | `"giants.stone-chamber.depth-7"` | `"giants.copper-chamber.depth-6"` |
| `/state/placements/4/reason` | `"budget"` | `"no-space"` |
| `/state/placements/4/templateId` | `"giants.stone-chamber"` | `"giants.copper-chamber"` |
| `/state/placements/5/depth` | `8` | `7` |
| `/state/placements/5/instanceKey` | `"giants.abyssal-chamber.depth-8"` | `"giants.abyssal-chamber.depth-7"` |
| `/state/placements/5/regionId` | `165` | `161` |
| `/state/placements/6/depth` | `9` | `7` |
| `/state/placements/6/instanceKey` | `"giants.spine-chamber.depth-9"` | `"giants.stone-chamber.depth-7"` |
| `/state/placements/6/reason` | `"no-space"` | `"budget"` |
| `/state/placements/6/templateId` | `"giants.spine-chamber"` | `"giants.stone-chamber"` |
| `/state/placements/7/depth` | `10` | `7` |
| `/state/placements/7/instanceKey` | `"giants.abyssal-chamber.depth-10"` | `"giants.copper-chamber.depth-7"` |
| `/state/placements/7/reason` | `null` | `"budget"` |
| `/state/placements/7/regionId` | `232` | `null` |
| `/state/placements/7/result` | `"placed"` | `"skipped"` |
| `/state/placements/7/templateId` | `"giants.abyssal-chamber"` | `"giants.copper-chamber"` |
| `/state/placements/8/depth` | `10` | `8` |
| `/state/placements/8/instanceKey` | `"giants.spine-chamber.depth-10"` | `"giants.abyssal-chamber.depth-8"` |
| `/state/placements/8/reason` | `"budget"` | `null` |
| `/state/placements/8/regionId` | `null` | `199` |
| `/state/placements/8/result` | `"skipped"` | `"placed"` |
| `/state/placements/8/templateId` | `"giants.spine-chamber"` | `"giants.abyssal-chamber"` |
| `/state/placements/9/depth` | `11` | `9` |
| `/state/placements/9/instanceKey` | `"giants.spine-chamber.depth-11"` | `"giants.spine-chamber.depth-9"` |
| `/state/placements/9/reason` | `null` | `"no-space"` |
| `/state/placements/9/regionId` | `276` | `null` |
| `/state/placements/9/result` | `"placed"` | `"skipped"` |
| `/state/revision` | `10` | `13` |

### colossus-natural-trace.json（56叶）

| 路径 | 原值 | 新值 |
| --- | --- | --- |
| `/boss/id` | `145` | `162` |
| `/boss/spatial/movementRegionId` | `144` | `161` |
| `/commands` | `402` | `429` |
| `/commandsHash` | `"7ce36f0880ff9c7e9c26eb6ff4ace7216ca247b6ef73fababc147e3c27270d51"` | `"d14edd09772d68f19cf95e7bdab8eb58e04c69b33390857a60605f0c74800f90"` |
| `/extensionsHash` | `"161591719a46b18ae62a3bddcf06e441106fa1739d8760b679952e22be6008f5"` | `"fce350713672b404923ee9bb374b79ddf380008674ecbc395a941a6472a74a3b"` |
| `/nativeWorldHash` | `"84d5a3103bf0d96151ffa1ae84fb6b582cfc20f0912ae665eafdd2b581edc93c"` | `"033d0b101eb7666c3461135e7744c30a8f6d4746e4ce136cf574d1b4d1ae07b4"` |
| `/region/id` | `144` | `161` |
| `/rng/randomNumbersGenerated` | `771232` | `893272` |
| `/rng/streams/0/a` | `4281823612` | `235176311` |
| `/rng/streams/0/b` | `2424179346` | `2581987579` |
| `/rng/streams/0/c` | `2195393393` | `1312325916` |
| `/rng/streams/0/d` | `3872421745` | `411886447` |
| `/rng/streams/1/a` | `979723902` | `4042634080` |
| `/rng/streams/1/b` | `52016900` | `3450481948` |
| `/rng/streams/1/c` | `2858888735` | `1446371799` |
| `/rng/streams/1/d` | `328251736` | `1135615780` |
| `/state/bosses/0/primaryId` | `77` | `64` |
| `/state/bosses/0/regionId` | `76` | `63` |
| `/state/bosses/0/subjects/0/groupId` | `77` | `64` |
| `/state/bosses/1/primaryId` | `96` | `102` |
| `/state/bosses/1/regionId` | `95` | `101` |
| `/state/bosses/1/subjects/0/groupId` | `96` | `102` |
| `/state/bosses/2/primaryId` | `145` | `162` |
| `/state/bosses/2/regionId` | `144` | `161` |
| `/state/bosses/2/subjects/0/groupId` | `145` | `162` |
| `/state/placements/1/regionId` | `76` | `63` |
| `/state/placements/2/regionId` | `95` | `101` |
| `/state/placements/3/depth` | `7` | `5` |
| `/state/placements/3/instanceKey` | `"giants.abyssal-chamber.depth-7"` | `"giants.copper-chamber.depth-5"` |
| `/state/placements/3/reason` | `null` | `"budget"` |
| `/state/placements/3/regionId` | `144` | `null` |
| `/state/placements/3/result` | `"placed"` | `"skipped"` |
| `/state/placements/3/templateId` | `"giants.abyssal-chamber"` | `"giants.copper-chamber"` |
| `/state/placements/4/depth` | `7` | `6` |
| `/state/placements/4/instanceKey` | `"giants.stone-chamber.depth-7"` | `"giants.copper-chamber.depth-6"` |
| `/state/placements/4/reason` | `"budget"` | `"no-space"` |
| `/state/placements/4/templateId` | `"giants.stone-chamber"` | `"giants.copper-chamber"` |
| `/state/placements/5/depth` | `{"absent":true}` | `7` |
| `/state/placements/5/instanceKey` | `{"absent":true}` | `"giants.abyssal-chamber.depth-7"` |
| `/state/placements/5/reason` | `{"absent":true}` | `null` |
| `/state/placements/5/regionId` | `{"absent":true}` | `161` |
| `/state/placements/5/result` | `{"absent":true}` | `"placed"` |
| `/state/placements/5/templateId` | `{"absent":true}` | `"giants.abyssal-chamber"` |
| `/state/placements/6/depth` | `{"absent":true}` | `7` |
| `/state/placements/6/instanceKey` | `{"absent":true}` | `"giants.stone-chamber.depth-7"` |
| `/state/placements/6/reason` | `{"absent":true}` | `"budget"` |
| `/state/placements/6/regionId` | `{"absent":true}` | `null` |
| `/state/placements/6/result` | `{"absent":true}` | `"skipped"` |
| `/state/placements/6/templateId` | `{"absent":true}` | `"giants.stone-chamber"` |
| `/state/placements/7/depth` | `{"absent":true}` | `7` |
| `/state/placements/7/instanceKey` | `{"absent":true}` | `"giants.copper-chamber.depth-7"` |
| `/state/placements/7/reason` | `{"absent":true}` | `"budget"` |
| `/state/placements/7/regionId` | `{"absent":true}` | `null` |
| `/state/placements/7/result` | `{"absent":true}` | `"skipped"` |
| `/state/placements/7/templateId` | `{"absent":true}` | `"giants.copper-chamber"` |
| `/state/revision` | `5` | `8` |

### natural-trace.json（33叶）

| 路径 | 原值 | 新值 |
| --- | --- | --- |
| `/boss/id` | `55` | `61` |
| `/boss/loc/x` | `23` | `22` |
| `/boss/loc/y` | `6` | `7` |
| `/boss/spatial/movementRegionId` | `54` | `60` |
| `/commands` | `152` | `135` |
| `/commandsHash` | `"9d69be4c68abbfe097b0c4b118fdf15fe9104df072a30ebd72e00c080c94fe70"` | `"a66a522b254e2b26f059ec1c404ce5c4e039572824f3901bc9de7d4560737b62"` |
| `/extensionsHash` | `"d447965c5b7ccc9c7f501624c490ac8631609d9bc66d3a19e2e1546b40bbf5b2"` | `"6b20a3c85269e24c4e9920e4ef0590e4545ba27fba641d3601cb16ab4f0fa5db"` |
| `/nativeWorldHash` | `"4ba05dba1b37d982339a77cd1e345833212e0db6f7581a76b3e531538ca0f125"` | `"c449dde2ee8a373e220ac72b6837e045ffdf86b76ced0eb3f49aac84f5fdf28a"` |
| `/region/bounds/x` | `18` | `17` |
| `/region/bounds/y` | `2` | `3` |
| `/region/id` | `54` | `60` |
| `/rng/cosmeticNumbersGenerated` | `162` | `163` |
| `/rng/randomNumbersGenerated` | `280199` | `106170` |
| `/rng/streams/0/a` | `1682859513` | `1528303169` |
| `/rng/streams/0/b` | `3057119382` | `3067604934` |
| `/rng/streams/0/c` | `3892612344` | `552353547` |
| `/rng/streams/0/d` | `3589685941` | `383403918` |
| `/rng/streams/1/a` | `3459876219` | `193234601` |
| `/rng/streams/1/b` | `1517813164` | `1016148519` |
| `/rng/streams/1/c` | `3529874670` | `3967908132` |
| `/rng/streams/1/d` | `4176910288` | `1106716129` |
| `/seed` | `7306` | `7328` |
| `/state/bosses/0/primaryId` | `55` | `61` |
| `/state/bosses/0/regionId` | `54` | `60` |
| `/state/bosses/0/subjects/0/groupId` | `55` | `61` |
| `/state/placements/0/regionId` | `54` | `60` |
| `/state/placements/1/depth` | `{"absent":true}` | `3` |
| `/state/placements/1/instanceKey` | `{"absent":true}` | `"giants.lantern-chamber.depth-3"` |
| `/state/placements/1/reason` | `{"absent":true}` | `"budget"` |
| `/state/placements/1/regionId` | `{"absent":true}` | `null` |
| `/state/placements/1/result` | `{"absent":true}` | `"skipped"` |
| `/state/placements/1/templateId` | `{"absent":true}` | `"giants.lantern-chamber"` |
| `/state/revision` | `1` | `2` |

## 附录B 最终写入清单

- `docs/ext/giants-config.md`
- `docs/ext/giants2.report.md`
- `src/ext/modules/giants/data/colossus-natural-trace.json`
- `src/ext/modules/giants/data/definitions.json`
- `src/ext/modules/giants/data/giants2-copper-trace.json`
- `src/ext/modules/giants/data/giants2-lantern-trace.json`
- `src/ext/modules/giants/data/natural-trace.json`
- `src/ext/modules/giants/data/spine-natural-trace.json`
- `src/ext/modules/giants/locales/zh_CN.json`
- `src/ext/modules/giants/test-suites.json`
- `src/ext/modules/giants/tests/giants2MechanicsFixture.ts`
- `src/ext/modules/giants/tests/giants2NaturalFixture.ts`
- `src/ext/modules/giants/tests/giants2_combinations.test.ts`
- `src/ext/modules/giants/tests/giants2_contract.test.ts`
- `src/ext/modules/giants/tests/giants2_generation.test.ts`
- `src/ext/modules/giants/tests/giants2_geometry.test.ts`
- `src/ext/modules/giants/tests/giants2_imports.test.ts`
- `src/ext/modules/giants/tests/giants2_parts.test.ts`
- `src/ext/modules/giants/tests/giants2_persistence.test.ts`
- `src/ext/modules/giants/tests/giants2_phase.test.ts`
- `src/ext/modules/giants/tests/giants2_trace.test.ts`
- `src/ext/modules/giants/tests/giants2_ui.test.ts`
- `src/ext/modules/giants/tests/giants_c5_placement.test.ts`
- `src/ext/modules/giants/tests/giants_colossus.test.ts`
- `src/ext/modules/giants/tests/giants_contract.test.ts`
- `src/ext/modules/giants/tests/giants_rigid.test.ts`
- `src/ext/modules/giants/tests/giants_runtime.test.ts`
- `src/ext/modules/giants/tests/giants_trace.test.ts`
- `src/ext/modules/giants/tests/naturalFixture.ts`
- `src/ext/modules/giants/tests/oracles/giants-before-giants2.json`
- `src/ext/modules/giants/tests/oracles/giants-locale-before-giants2.json`

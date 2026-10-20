# P1d R2：居民桥接、UI、性能工具独立复核

2026-10-20，开工 HEAD `3431533`，审阅未提交工作区。审阅者 `/root/review_r1` 没有编写本文件审查的 C 生产实现、UI 或性能工具；此前编写的 `party_narrative_roster.test.ts` 不在本次独立审查结论之内。叙事测试结果与发现另由主报告记录。本轮以静态执行路径复核为主，未运行居民/UI/性能的新探针，也未以作者测试代替独立实测。

## 新 findings

### R2-I1 / P1：原跨格式算法身份检查阻止真实 A/B 启动

发现时 `scripts/party-perf-crossformat.mjs` 的 `readCrossformatTarget` 要求 A/B 三个算法源文件的 SHA-256 完全相同。P1d 已在 `RecordingDigest.ts` 的物品收集和演员归一化中增加 `party.stationed` 遍历，P1c 源码没有这两处，所以真实 A 工作树读取 B target 必然抛出 `Cross-format full oracle algorithm changed`。现有 mock digest 单元场景不能证明真实工作树启动成功。

最小复现：以冻结 P1c 为 A、当前 P1d 为 B，捕获 B target 后在 A 调用 `readCrossformatTarget`。无需执行计时负载即可触发。

**本轮整改静态关闭：** 作者增加 `empty-stationed-traversals-v1` 明确算法差量，固定旧/新完整源 SHA，仅允许两处精确字符串替换，替换后完整源码 SHA 必须等于 P1c；其余算法完整 hash 仍逐一相等。B frame 另要求 `stationed=[]` 与 `stationedNative={}`，A lift 产生这两个空根。两处改动在空驻营集合下都保持原遍历顺序与内容，因此此限定支持创建路线比较；不能用在动态转换路线。此处未声称真实 rounds=1 或云端 A/B 已通过。

### R2-I2 / P2：居民拒绝原因未进入 party UI 翻译通道

发现时 `usePartyUi.ts:57` 只识别 `PartyFailure`；`PartyResident.preparePartyStation` 缺床抛 `World5Error('C5_ROOM')`、缺粮抛 `C5_INPUT`，因而在 UI 变成泛化 `INTERNAL_FAILURE`。`visiblePartyCandidates` 又保留 `C5_RESERVED/C5_BUSY` 等 code，`PartyRosterPanel` 拼接 `ext.party.error.C5_*`，而 party 语言包没有对应项，候选行显示原键。

最小复现：合法相邻非领队成员在没有空床的营地点击派驻；或让可见驻营成员持有非居民订单预约后查看加入候选。应显示具体的床位/预约理由，而不是内部错误或翻译键。

**状态：已交 UI 作者整改，尚待本文件回读。**

## 原 findings 的独立回读

- **R1-F1 原调度缺失静态关闭。** `TimeCoordinator` 用独立 residents port 把驻营纳入最早到期、原生 timer 递减、busy action boundary 与决策 dispatch；没有加入 controlledActors/ready roster。`Game.timePorts` 在驻营 actor scope 中选择居民工作，native fallback 可作相邻防卫，默认推进原生速度。`ResidentWorld` 的 active 视图只包含当前层且未退役居民，经济与 work 路径共用实体；`ResidentNeeds` 也用这个视图确认驻营可达。`stationedNative` 保留中毒/坠落等临时字段。毒火、恢复、状态、资源/autoID 和环境扫描现有单独驻营入口。Monster 接触、bolt 候选和目标选择已加入 `nativeAllyActors`，防止驻营只被调度却脱离敌我交互。
- **R1-F6 仍待整改回读。** 本次读取 `GameCanvas.vue:754` 仍仅绘制 `activeControlledActors`，前段怪物循环也没有驻营实体；派驻把实体移出这两根后，地图仍会消失。已交 UI 作者。应按当前层、存活、可见的居民视图绘制，并保持其不可控制身份；不能把 retired 或其他楼层实体画出来。
- **原生坠落仍是已知限制，不能由 F1 静态关闭覆盖。** `Game.ts:14255` 对驻营 ControlledActor 直接 `retireStationedResident(...,'fallen')`，保留 HP 并把物品留在本层。原 Monster 走 falling/跨层路径。本项已由 C 作者登记 source-audit；此行为没有完整保持原生非致死坠落身份链，仍须按任务裁决，不能写成 CE 一致或已全部验收。

## 性能工具的其它结论与边界

跨格式 lift 保留未列出的机械字段；逐输入 oracle 比较完整 domain/root，manifest 只替换批准版本和 party 身份，A/B 都执行两次完整 oracle；生命周期要求各自 native save/load/seed replay/seek。没有发现通过忽略 party 域或改摘要阈值规避差异的路径。

`profile-party-roster-perf.mjs` 把诊断快照来源、setup 字节 hash、命令成功/拒绝、零 tick、HP/原物、退款计数、full/Worker 一致、快照加载和快照尾段重放分开记录；明确 `seedReplay:false`。它不能充当自然救援/叙事种子录像证据。`profile-party-ai-load.mjs` 的无路预算桶和预 origin 人工同伴场景也有单独身份与 scope，不代替原 party-ai-v1。两工具均为 report-only；本次没有独立执行其计时。

UI 的投影、map pick 与异步窗口回调已有 game/root/revision/focus/token 失效检查；这不等价于浏览器视觉验收。窄屏抽屉、地图颜色与点击、键盘冲突及移动布局仍由维护者人工清单覆盖。

## 回读时的文件身份

以下为静态读后快照；工作区继续修改时不能把这些 hash 当最终候选。

| 文件 | SHA-256 |
| --- | --- |
| `src/engine/Core/PartyResident.ts` | `735c625736cc15f3307863398a29eae74141443f8f81143e56e6dfa912f8674c` |
| `src/engine/Core/ResidentWorld.ts` | `df59b42f9b1834b8a261fb71fe41fb1dc635eef71d0c871b566a7353e3f3425c` |
| `src/engine/Core/TimeCoordinator.ts` | `bc620b9b803ea60bca13720509c1ba1b91b79dd1096d775c609e043d62eb20d6` |
| `src/engine/Core/Game.ts` | `d9739a037846d69bedf168c40f30a5eddca1d982f30209c564c7e2f89e754927` |
| `src/entities/Monster.ts` | `672d80e60e3389ae2ddd49561ebe244ebeab334a6c24953c0a849a090051f202` |
| `src/components/GameCanvas.vue` | `ff862f17637adf44807e6876b694aecc1ba0ab681fa5e65632d0b526db6bcc2d` |
| `src/ext/modules/party/ui/usePartyUi.ts` | `4096203f67122a980f6043e763a000526a1026fa94edd657bb486f78c075be51` |
| `scripts/party-perf-crossformat.mjs` | `0cd227e5ceff5e1b86c1086dca931cc4ae29b9ba5763802612181c282d5b4644` |
| `scripts/profile-party-roster-perf.mjs` | `fd589019e0263948f4ab61046abafac7482813ac70d7784140479805bef6fa0b` |
| `scripts/profile-party-ai-load.mjs` | `3e6d0042fa3dab048357dc7dbba8c5fad0df8c421b553695495dff613ff8d9ee` |

## UI 整改后的独立静态回读

**R2-I2 静态关闭。** `usePartyUi` 现在识别 `World5Error` 与 `PartyFailure`，统一经 `partyFailureKey` 翻译。C5 映射至现存 foundation error key，未知 code 回退本地内部错误；候选行和派驻行也复用同一函数。已查 `room/input/reserved/busy/distance/wrong_level` 均存在中文文本。本轮未运行 UI 作者新增测试。

**R1-F6 静态关闭。** `visibleStationedResidents` 联合当前层 resident row、stationed 实体根、HP、retired 与格子可见性；`GameCanvas` 独立绘制该结果并使用 NPC 语义。它既不扩大 controlledActors 也不修改 FOV/随机流，远层、死亡、退役和未见居民被排除。实际像素样式、点击与回放表现仍留浏览器人工验收。

| 整改文件 | SHA-256 |
| --- | --- |
| `src/ui/partyResidentMap.ts` | `52ed8f8a973c5a6096aad89f76f8a6cc7521183e7e61615e787f976b737f2f14` |
| `src/ext/modules/party/ui/feedback.ts` | `d3f00523dfc6742ec6308a3fc31b2283e4bd91c531d4876709d7494e37d7c34e` |
| `src/components/GameCanvas.vue` | `b5ffa6e92b2e1c89ec9e7c1bdaaa8cd61c4ee52709d56d3767d67511d50b5afb` |
| `src/ext/modules/party/ui/usePartyUi.ts` | `dc14a0eb7779579595a5e18f760b59aecc4450b3e8c29645b1c63c2e6dcf965a` |
| `src/ext/modules/party/ui/PartyRosterPanel.vue` | `666c64fb42b5cdea1d614e7fe2123afbd605a57fd575fbf5fed4e488d07e93c1` |

## 自然救援整文件暴露问题的最后静态回读

作者报告真实 D3 已救 goblin 加入后的保存先因 `resident.source.rescue` 拒绝，继而发现观察集合保留旧 Monster 导致图中同 ID 重复。本轮仅回读修复，不追加测试：

- `convertPartyActor` 从引擎 `candidateSource` 取真实 resident source，只有未 consumed 时才置位并增加 revision，经 `replaceResidentComponent` 发布。这与已消费来源的居民 release 分支不重复计数；发生在原生/扩展联合事务内，后续失败会回滚。
- join 同步清除当前 `visibleMonsters`、`everSeenMonsters` 和缓存层 `visibleMonsters` 的旧 Monster 引用，随后只保留同 ID PartyMember 根并执行 `replacePartyCreature`。`checkpointCombatFactWorld` 深捕获当前两个 Set 及 `levels` Map；`WorldCheckpoint` 递归捕获 Map/Set 成员和引用，因此该清理没有越过尾部失败回滚范围。
- growth 测试把额外 `new Game` 推迟至捕获 save 之后，修的是构造器重置进程级 allocator 的测试前提；不需放宽生产 ID 守卫或成长断言。已提醒作者去掉临时诊断文件的无条件 `/private/tmp/party-p1d` 写入，避免干净运行环境不存在目录。

以上静态身份：`PartyRecruitment.ts` 为 `5e23efa362060ef1de3c2787fc060660c80feb6a5c854e1029b38898c34b81a1`，`Game.ts` 为 `5b5ef316294960408ef9b0c02c92a0b99217f1ef36dd65976645c1186765ba68`，`WorldCheckpoint.ts` 为 `2e5bbc6aae4cc34731d5b652cdcddc9de7945783ae0c25b11a44863989f105c6`。实际自然救援/成长最终整文件结果由主门禁记录。

## R2-F2 同项资格边界复核

按主作者要求，仅复核既有 R2-F2 的修复完整性，未开始第三轮全面审查，未写或运行新测试。本次读取 `growth/module.ts`（SHA-256 `93a727efee92b2f4945cd87ce33b00d4532264f87879c142c1398532dbdba869`）仍有：

- kill 路由约 518 行以历史 `isMember(state,sourceId)` 将驻营来源当作直接 party 击杀，跳过普通盟友分账。
- 新参与事实约 709/715 行的 damage/physicalResolved，以及约 434 行的成功辅助结果，仍以历史成员资格向 participants 插入新记录。

因此仅修“普通盟友无 participants 时的默认分摊名单”尚不能完整关闭 R2-F2。这些新事实资格应查询 `memberIds(context)` 实时名册；历史名单继续支持结构验证、已记录 participants 和 receipts，不应在派驻时删除既得席位。

还有同项发奖边界：`planAward` 约 192/200 行以历史成员决定 `alliesGrow` 豁免和 NPC 自动加点。修正 kill 路由后，普通盟友份额仍可能把驻营对象当现役成员。这里不能简单全局替换：`awardPool` 结算真实历史参与者时必须保留其既得 party 份额；普通盟友新份额则应服从当前身份与既有 NPC 规则。建议显式区分本次授予的历史 party 份额与普通盟友份额。**此同项范围尚待作者修复及定向证据，不能沿用前述默认名单分支的静态关闭来宣称整项关闭。**

### F2 同项最后整改回读

**上述已列 F2 资格边界静态关闭。** 新 kill 分类、成功辅助、damage 与 physicalResolved 均改查实时 `memberIds(context)`；objectiveTime 的成员冻结分支也只适用于实时成员，驻营不会仅因历史名单而冻结计时。`awardPool` 仍以历史成员验证既有份额，并显式传递 `historicalPartyShare=true`；普通 `award` 只有实时成员获得成员规则豁免，其他盟友份额回到 `alliesGrow` 和 NPC 自动加点规则。历史 participants/receipts 没有删除，结构初始化与世界验证仍保留历史名单依据。直接调用 `planAward` 的故事奖励准备路径限定主 player，因此不依赖历史成员判定。

新增第二个成长用例明确是 hook 级事实探针：先在现役时取得参与席位，再派驻；新 damage 不增加席位，旧席位保留，普通盟友击杀的默认 player 份池只包含当前名册。该用例不是独立自然战斗或种子录像证据，实际执行结果由主门禁记录；本审阅未运行它。

回读身份：`growth/module.ts` 为 `c38d6d313908af91a961151162de75cac09e1eb8274afa4890ea1db84e5d251f`；`party_growth_roster.test.ts` 为 `54c8669f46929a5041d7aacce52c56675f0ae8cc73d2b6374917f2de19389e90`。

## R1-F1 驻营瞬时视图优化回读

仅比较 `Game.activeStationedResidents` 的局部优化。原路径先把 `monsters` 与本层未退役驻营拼接，再筛 `instanceof ControlledActor && hp>0`；Monster 与 ControlledActor 都直接继承 Creature，合法 monsters 根没有 ControlledActor，而 stationed 根已经约束为 PartyMember/ControlledActor。新路径在 map 为空时直接返回空数组，否则仅枚举 stationed，沿原插入顺序筛 HP、未退役、真实 resident row、本层 dungeon。无 party、无驻营、远层、退役与死亡的结果相同；没有新增缓存或随机/状态写入。**合法世界下集合及顺序语义相同，移除了对 monsters 的冗余扫描。** 本次未运行测试或重新审查其它路径。

回读 `Game.ts` SHA-256：`00ed3fe8057779569f500504223d3292fc58b262319796e01f4f3960203fb4de`。

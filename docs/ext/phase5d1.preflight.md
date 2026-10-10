# 5D1 实施前勘察

日期：2026-10-08。执行树 `/Users/coolking70/Documents/同步空间/BrogueJS-p5`，分支 `ext/phase5`，固定 HEAD `769f6fc18aad4881bfcc8d2170de84cfd319e4e8`，已验收 5C1 代码 `5dbeb32d17e72124a04156bcdff9b875807cfa48`。本轮仅只读源码/文档、短环境与散列核验，交外部草稿；未修改生产、测试、仓库文档或 progress，未 commit/push，未启动代理、浏览器或完整门禁。

结论：可以进入 5D1，但不能把 5A fixture 或 5C 空账本当作已有居民产品能力。需要生产居民适配器、真实候选来源、需求核与生命周期事务、一次原生自由决策仲裁、护送例外、严格跨引用 codec；5D1 必须含真实在场种植/搬运/守卫。日粮离层一致性属于本步，不能全部推到 5D2。伴随草稿给出具体推荐合同，仍是实施建议，不是已实现或已验收事实。

## 1 阅读、优先级与身份核验

已查根 AGENTS、HANDOFF/development/architecture、ext README、commander-handoff/status、联合设计、foraging 的居民/日粮/离队/版本段、C5-1 的离线/居民/计时/codec边界、5A4 §8、5C1 task/report/acceptance、settlement-config，以及下表真实代码。扩展新产品政策和本轮任务优先历史 CE 门禁；不 ce:fetch/full/gen。当前状态以 5C1 acceptance 与 commander-status 最新段为准，不把报告保留的历史 BLOCKED/未提交误当当前状态。

`progress.md` 63269 UTF-8 字节、210行；首行确为 `Original prompt: 按 docs/tasks/ux-1-playtest-remediation.md 整改八项人工试玩问题；用户在 2026-09-29 明确要求停止定时任务并启动合适子进程开发。`。后续实施只追加，不替换原 prompt；历史自动化/代理授权不扩大本任务的禁止派代理边界。

真实环境短检查：指定 Node 返回 v24.19.0，项目可见 playwright 依赖；没有启动 Vite/SSR/测试/Chromium。因此不宣称浏览器可用、路线已跑或功能已通过。Git porcelain 为空，分支及 HEAD 符合任务。P5 的 `src/ext/modules/foraging` 不存在。没有读取/修改 dot 工作树或分支；新返工基线 db50a84 只按任务和状态文档登记，不将其能力计入本树。

## 2 可复用口与缺口逐项核对

行号为固定 HEAD，仅作定位；符号是稳定依据。

| 事项 | 真实文件/符号及执行事实 | 5D1 必补内容 |
| --- | --- | --- |
| 营地真相 | `ext/structureSdk.ts:CampState/CampRecord`，`Core/StructureProduction.ts:commitStructureCommand`；真实 region/标记/容器、slot ordinal、锁粮和建材账单已有 | 增居民政策/粮仓引用及报告；不复制 Grid/库存/HP |
| 空经济边界 | `StructureProduction.ts:919–957 freezeProductionCamps/settleProductionCamps` 只覆盖 lastSettledTick，不消费、不规划；`validateProductionCampReferences:829` 明确拒绝非空 residentStates | 替换空政策，先结旧区间再冻结；撤掉“必须空”限制并换为严格居民跨引用校验 |
| 居民状态 | `ext/world5.ts:55 ResidentRecord/77 OfflineResidentState` 已有 home/actor索引及 alive/shortage，初始化 residents=[]；`Game.ts:1849` 只有测试 fixture 注册 | 生产登记、床/岗位组件、唯一需求 ledger、64/16名额及GC；fixture不是产品 |
| 对外身份 | `settlement/module.ts:optionalQueries` 接受 actorId，但 validate 只准 resident=false、query 恒 false | 查询真实组件归属；同一提交末触发 resident-changed；只读不得补算 |
| 原生来源 | `Game.ts:14316 freeCaptive` 真实解救经 becomeAllyWith；后者也用于普通支配，无可信来源收据 | 在 wasCaged 的真实解救转换点记候选来源，支配任意动物不记；所有解救入口共用，拒绝 isAlly 推断来源 |
| 解救物品语义 | `becomeSingleAllyWith:14302` 调用 makeMonsterDropItem，原生携带战利品会落地；freeCaptive 不新建 actor、不补HP | 招募保留“解救完成后”的实际原 actor、物品根/装备/状态；报告须明确原解救落物不是招募吞装备。若要求救前 carriedItem 也留身，需另明示修改该救援语义，不能悄悄恢复/复制落物 |
| 现有NPC装备模型 | `entities/Monster.ts:391 carriedItem` 是携带战利品，普通Monster无Player式Inventory/装备槽 | 招募保存全部既有实体字段和growth等组件；不虚称已有NPC装备管理系统，不扩展为居民装备制作/装配 |
| 普通自生模板 | `NativeFormDefinition/validNativeForm` 现要求 size=2/3 或 footprint；`Game.createModuleMonster` 使用 spatial/publishSquareMonster；generationContributions 要 ownedRegions 和形态/场地条件 | 新有限单格模板可信生成口；不能用 giant 场地或1格mask冒充普通 resident 能力。模板数据归 settlement，不导入其他模块 |
| 真实世界事务 | `WorldWork.ts:640 transactWorldWork` + runtime.worldWorkTransaction；`StructureWorld.ts:561 transactStructureWorld` 包地形/房间缓存 | 可复用同步事务骨架，但居民需要独立扩大且列明写集；现 checkpointWorldWork 只浅捕活动actor，不包所有缓存/组件/装备内部写入 |
| 命令确认 | `Game.executeCommand`、`StructureProduction.prepare/commit` 已严格payload/CAS/No重验 | 新 resident SDK/command族；玩家只给目标ID，NPC只接受内部scope。No/陈旧/忙态不能消费时钟/ID/料/RNG |
| 工作内核 | `WorldWork.selectWorldWorkDecision:1298` 能续既有NPC ticket；`prepareTrustedWorldWork:1361` 只准 DEV+fixture；trusted-world scope也限DEV | 生产NPC准备口按 native scope验证；真实种植/搬运循环和产出提交；不能借fixture/DEV开关 |
| 唯一调度 | `PhasedAttackProduction.bindPhasedAttackProduction:391–430` combat缺席时仍可绑定中立world action根，selector先选worldWork；`TimeCoordinator:207–230` busy先dispatch，闲时才prelude | 单selector内加居民仲裁；原生危险/敌情优先，工作不抢战斗；无combat、无既有bundle时也能执行resident行动 |
| 原生前导 | `Monster.prepareNativeDecision:1766` 做activation/感知/失能/俘虏；`takeNativeDecision` 保留盟友战斗、追随、移动 | 调度只一次prelude；不能取native fallback的整段来“走一下”后再做job；守卫调用原生战斗、和平时返回岗而非追玩家 |
| 日粮旧算法 | `Core/WorldSettlement.ts:compute` epochTicks=1000，每epoch找 rationDefinitions，吃上直接 shortage=0；长尾只饱和不离开 | 改每日−1/+1、双欠额、真实原生FOOD identity、departure effect；独立测试迭代器作规范 |
| FOOD真实投影 | `WorldWorkWorld.itemRead` 原生Food definitionId=null，nativeCategory=food；`createOutputs` 原生输出不带 worldItem | 原 `rationDefinitions`/definitionId delta无法表达自然口粮/芒果消费；新增可信Item-ID消费/锁数量写口，不给自然FOOD伪造 worldItem |
| 锁粮 | `settlement/state.ts` locked 总量必须恰2；`WorldMaterialTransfer` 所有withdraw查 runtime.worldCampLockedQuantity；撤营退真实剩粮 | state2允许剩0..2，以 consumedLockedUnits+剩锁=2校验；消费Item与锁引用同事务，整堆吃完清Item根，额外未锁粮仍可取 |
| 住房 | `StructureWorld.computeRooms:190` 完整房间/床已有；`world5` 校验却只准 frozen.bed=null、facilities=[] | 合法卧室床/分配、非空有限facility DTO；屋顶/门墙/床损坏同步失效/重分配；床不足不得出走 |
| 居民跟随 | `Game.generationPorts excludeLevelFollower:1485` 任何world5 resident都排除；`LevelTravel.scheduleLevelFollowers:56` 支持排除谓词 | 明确escort例外，stay仍排除，不改变home索引为物理坐标 |
| 管理层倒计时 | `Game.monstersApproachStairs:2001` 管理层整层跳过，护送即使安排了entersLevelIn也不动 | 只放行已授权escort候选的楼梯迁出/倒计时；其他原生生态保持冻结，禁止整层解除 |
| 落地和坠落 | `GenerationCoordinator:432` 先managed settlement再fallen/pending；`Game.displaceWorldResident:1896` 停订单、route=false仍保home | 保留落地顺序；escort/cached/pending一名额、归属不重复，坠落取消在途工作/退款，需求仍home核负责 |
| 需求资格通知 | `Core/ActorNeeds.triggerActorNeeds` 支持resident-changed；`Game:1865` fixture已调用；qualifies读queryOptional | 招募/解除归属后，在同事务末、真实component/index/ledger均发布后通知；不每回合轮询/不双扣foraging饥饿 |
| 非死亡离队 | `ActorDeparture.beginDeparture:20` 只找active/dormant；retireActor可查departureActors；beginDeparture验证 owner 已安装，EdibleValidation也同 | 需要非活动carrier可入离队和原层落物适配；不伪造edibleItems/actorNeed声明来“获取权限” |
| 退役作用域 | `Game.retireDepartingActors:13536` 枚举cached/pending但落 carriedItem 到当前this.items，并清底座引用；没清settlement/world5 | 必须先清本模块resident/order/床/冻结/预留/退款/锁引用，再底座退役；落物按真实carrier层，不能远方物品落玩家脚下 |
| 普通死亡 | `Game.processMonsterDeath:10594` 标alive=false/停order；保留world5.residents，允许dead tombstone | 5D1改有界终结/释放人口、床/订单/escrow清理；死亡仍走原生death/kill，离开不发这些事实 |
| 存读约束 | `world5.validateWorld5:314–442` orders.ticketId必须null、pendingOutputs/facilities必须空、床必须null；只有旧fixture状态合法 | 严格schema2跨根校验，不只是给types加字段；读档候选坏引用拒绝，旧live不退休 |
| 录像摘要 | `WholeRunSnapshot` v6；foundation10；recording4/origin2；`recording-digest-contract.json` world5 root含经济索引，7 perLevel leaves已有 | foundation/world/state升号与摘要脏标；本步无需新录像外壳/存储，拒旧manifest。相关golden需字段归因；不改5G golden |
| UI | `SettlementPanel/useSettlementUi/projection` 为已有抽屉；`projectSettlement` 只读structures SDK；Canvas已有render_game_to_text/advanceTime | 扩展同面板居民/岗位/粮仓/带路/回营；仍唯一DialogInput；不得新开调试生产入口 |
| 模块测试 | 本树6模块，foraging未装；settlement persistence有写死crafting/combat/giants组合 | 新联动行按installed descriptors决定可选peer；单模块行总必跑，不import对方私有包；底座测试使用中性fixture |

## 3 冲突与推荐裁定

1. **日粮与住房的唯一模型**：食物欠额按32000tick日边界±1，住房欠额按1000tick经济epoch±1，各0..3；工作有效shortage=max(foodShortage,housingShortage)，效率100/50/0/0。住房不足不驱逐；departure只看发粮前foodShortage已3且本日又缺粮。吃上只−1，不旧代码归零。`unfedDays`另记连续缺粮天数用于事实/诊断，不取代foodShortage判据。组件不再存第二份shortage。详见任务草稿。
2. **护送仍由营地日粮负责**：离开home工作挂起/取消，身份与人口保留，不转foraging；授权escort跨楼梯例外同时修follow排除和管理层倒计时，否则只改一处仍不可玩。回营只在真实同层到达/驻留命令完成，不免费传送。
3. **本步需求离线不是5D2生产**：统一 needs transition在真实推进安全点处理到期营地（包括cached home和escort home），长跨度按有界事件跳跃；入层/有效机械操作补齐欠区间。离场不种植、不搬运、不烹饪，不得因为不做离线生产就跳过欠粮。
4. **种植不等厨师**：本步最小种植床/种子/作物和真实在场劳动产物必须交；作物为食材MATERIAL、不是FOOD；不能玩家自制日粮。5D2另做完整田地/灶台/猎场/离线产量与供应链。生产种植量上限保持每居民最多6格、每格每天最多1单位，不用即时收获刷无限食物。
5. **单一权威**：world5.residents是归属/预算索引，actor component是岗位/床/来源/模式政策，home ledger是唯一需求数值。共享键引用严格相等，不把索引投影变第二个可写policy，不复制actor HP/坐标/装备。
6. **候选来源闭环**：有限自生尝试与真实救援独立于narrative/growth；source receipt/highwater防重生/重招；普通支配不招工。读档不补招/重授模板。narrative随身交互是5D3。
7. **版本最小方案**：foundation10→11，World5.schema1→2，C5-1经济修订1.1.0（非worldSdk2），settlement module/rules1.0.0→1.1.0、state1→2、新居民payload v1。不改Item/Creature字段，whole-run继续v6、recording4/origin2、IDB2；如实施确实新增原生实体字段再whole-run升v7并同步schema/校验/黄金归因，不能只改写出端。所有相关fixture需明确新格式，无旧档迁移。worldSdk/edibleSdk继续1。
8. **5A4 §8权限说明纠偏**：文档写“合法edible/need worldDefinitions owner”，实际beginDeparture/EdibleValidation只查 installed owner；settlement已拥有worldDefinitions，无需空壳可食/需求定义。扩展非活动退役直接修改状态所有者，不绕入口、不修改冻结actorNeeds.ts。
9. **解救/招募保存边界**：沿真实原生救援现有落物/解除领导关系；招募自身零回血、零重授、零清status、零装备重造。若把“原装备”理解成救援前carriedItem，现代码与该强解释冲突；推荐以救援完成后的实际物品图为招募基线并在报告注明。不能用招募重造物品来弥补。

以上均可回退建议，按任务要求直接提出；不请求逐条批准。大范围worldmap、任意居民形态、永久运行供应链、叙事actor附着、离层灾害与Worker不在范围。

## 4 九冻结文件与fgfixture

短脚本对当前字节求SHA-256，九值均与5C1报告表一致；并不等于已核验dot新基线整树。实施开始/结束再次比同一固定HEAD。

| 路径（src/ext/前缀） | SHA-256 |
| --- | --- |
| worldSdk.ts | 297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343 |
| edibleSdk.ts | fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b |
| worldEdible.ts | 7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67 |
| kindKnowledge.ts | 4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f |
| actorNeeds.ts | 8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e |
| stats.ts | c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84 |
| testing/worldHarness.ts | a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0 |
| testing/forageHarness.ts | ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38 |
| testing/fixtures/forageFixture/index.ts | adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea |

本轮fgfixture树未写入；交付末用git状态再次核验。后续不能修改其目录来适配新world5；若需要旧fixture经济DTO适配，在非冻结的可信适配层/自有测试中做，不声称冻结harness已支持新居民命令。

## 5 证据与未验证边界

本轮事实是源码勘察和git/Node/依赖/散列检查，不是功能验证。没有相关Vitest、boundary、type、build、drift、浏览器/自然新局/存读/回放/seek/续录/性能结果。5C1的133/569/90项、24GUI与自然seed28结果只作为已有事实/路线素材，不能冒称5D1证据。

后续真正受测矩阵、自然命令路线准备和最终交付表详见 `phase5d1.task.md`；重点仍须真实来源、原actor保留、双需求/真实FOOD、cached退役、单决策、护送迁层、失败对象图、坏档旧live、自然录像。受控布景录像必须带from-save origin，不能冒充完整新局。真实手机/全组合/完整删除/长局/Worker/5Z未验边界如实列。

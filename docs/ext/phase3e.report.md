# 3e 篝火：有时长、可打断恢复

## 范围与基线

本步实现已批准 `phase3-combat.md` §7 / P3-D05=A。只恢复，不刷新敌人、不复活、不回卷世界，不新增 growth/narrative adapter；不进入3f。开工恢复时先从真实 GitHub `coolking70/BrogueJS` 显式 fetch `ext/foundation`，快进至 `7ad95121d896bab0e235f531fc9f0913ea90d7a2`，包含4d-3与3d动画修复。暂停中的3e变更用 stash 三方恢复，测试登记冲突保留双方项，没有整文件覆盖上游。

交付前再次fetch发现foundation前进，随后快进并三方恢复至 `a2b58f83a9e4255b4f3be9499efd3b9399301202`，保留4d-4 `087bafc` 的群体状态/侧栏改动。Game、PhasedAttackProduction与全局locale自动三方合并，无冲突标记；本步不修改其默认内容。最终组合门禁以此较新基线为准。

## 实现与执行顺序

- combat拥有篝火定义、放置绑定/收据、每点访问与完成次数、有界休息历史；坐标/世界实体ID由 foundation.world 的非阻挡 WorldInteractable 持有。没有生物组件或叙事 gate。
- 说明界面0tick只读，复用同一战斗栏与 DialogHost/DialogInput。实际输入是 `executeCommand('ext:command', JSON.stringify({module:'combat', action:'rest', payload:{bonfireId}}))`。bonfireId 是世界实体数字ID，不接受玩家/其他actor身份注入。
- `prepareWorldRest` 纯准备，检查存活、状态、忙态/硬直、交互距离/LOS/可见性、其他交互 gate、可见敌情、资源/动作容量以及有界ID。确认等待期间不分配ID、不恢复、不消耗时间或RNG。既有 requestConfirm 精确记录一个答案；No免费返回；runtime会话、修订、位置/资源/世界目标变化或复用旧计划拒绝。
- 接受后分配共享 `nextActionId`，访问序号加一，提交现有 actor scheduler 的单个 recovery phase。scheduler 是唯一倒计时，玩家 native timer只是镜像；实际经过的delta前向累计到 currentTick。期间NPC、环境、饥饿、毒和既有客观时钟正常运行，不注入伪wait命令，也不给保护窗口。
- 正HP损失、死亡、位移/空间来源变化、失能、楼层离开、目标移除或新可见敌情取消奖励。盾完全吸收造成0HP损失不伪称受伤；环境与原生状态效果仍可打断。会话空间revision防止“移出再移回”漏取消；读档重绑会话token，持久层校验精确source footprint机械指纹。
- 每次同tick敌人与环境结算后检查中断；成功恢复延后到原生回合收尾（包括饥饿伤害/死亡、最终视野、playerTurnEnded hook）之后。玩家ID靠前不会先于同tick怪物或终局饥饿回血。`settling` 仅是同步安全点中间态，不是第二个时钟，不允许保存/载入。
- 完成时按当前权威HP上限与combat模板容量恢复，精确一次写入 `actionId/bonfireId/instanceKey/visit/actorId/depth/result/reason` 收据。未完成没有篝火奖励；普通原生回血、体力随时间恢复仍按原规则进行。完成后的load/update不会重发恢复。
- 不清毒、饥饿等原生状态，不重置成长技能/冷却/专注，不擦死亡、任务或奖励收据；正常时间流逝导致状态自然递减不算额外恢复。所有现有生物、ID分配器、RNG与世界时间前向继续。

## 配置入口与默认值

入口：`src/ext/modules/combat/data/definitions.json` 的 `bonfires`。文字：`src/ext/modules/combat/locales/zh_CN.json`。所有字段严格校验，不接受未知键、坏引用、非法整数、无界数组、getter或原型污染。

| 字段 | 默认 / 合同 |
|---|---|
| `definitions[].id` | `combat.bonfire`；全包定义ID唯一 |
| `nameKey / descriptionKey` | 篝火名称、说明；必须是本包存在的本地化键 |
| `glyph / color` | `♨` / `#E7A34B`；单码点、六位十六进制色 |
| `interactionDistance` | 1，合法范围0–16；仍检查可见性与交互LOS |
| `placement.minDepth / maxDepth` | 1 / 40 |
| `placement.maxPerDepth / maxPerRun` | 1 / 40；有限每层/全局名额，重复访问不补发 |
| `placement.minStairDistance / maxEntranceDistance` | 2 / 6；复用底座安全候选顺序 |
| `placement.onNoSpace` | `skip`；可配 `defer`，仅在后续首次访问的合格楼层继续，越过末层终止 |
| `restTicks` | 500；正整数，最大1,000,000；不是墙钟毫秒 |
| `restorePolicy.hp / stamina / poise` | 各为 `full`；可分别设为 `none`，不隐含其他恢复 |
| `resetPolicy` | 仅 `none`，首版拒绝任何敌人/世界重置 |
| `limits.maxActive / maxPlacements` | 40 / 40；硬上限1024；所有定义的总名额不能越界 |
| `limits.maxRestReceipts` | 128；硬上限4096；滚动保留最近记录，访问/完成总数不随淘汰重置 |

纯数据默认允许满血时继续花时间休息，没有暗藏一次性限制、付费物品、满血禁用或世界重生。资源容量仍采用3c/3d模板；本步没有新增D06属性adapter。

## enteredLevel写集与生成合同

仅在首次进入层的既有提交事务中安全放置；不改 Architect/地形/连通/房间/怪物生成或生成随机调用。写集是 foundation.world.entities、世界实体ID分配器，以及 combat的bindings/placements/pending/revision。没有挖营地房间或重录地图基线。

候选由 `interactablePlacementCells` 纯计算，沿既有稳定距离/坐标顺序、排除占用/危险地形/机器/楼梯距离；当前无位时按数据skip/defer。每个底座批次最多256项，超过时在同一外层generation事务分块；后续块看到前面已占据的格。257/1024对象与第二块故障覆盖整个事务回滚，实体ID与RNG复原，无半批世界实体。

缓存层保留自己的篝火，collectWorld只移除不再保留层的活绑定，历史名额/次数不复活。此处普通对象ID的前向分配是新模块规则的一部分，会影响后续ID数值，但不倒退、不复用旧实体、不改两条RNG。已跑相关生成事务/完整对象图checkpoint回归；按开发期政策不扩张重型drift或CE生成普查，未重录任何地图/黄金trace。

## 版本、存档与可删除性

- combat module/rules：`1.3.0 → 1.4.0`；机械JSON指纹随新定义改变。精确manifest在替换旧Game前拒绝旧版本/缺模块/坏引用，不做迁移。
- foundation manifest/外层快照保持4；combat pack schema保持1；actor ledger schema保持3。只有声明了 `actorActions.definitions.bonfires` 的执行器才接受对应 `state.bonfires` 和严格 `rest` 输入；没有声明的底座fixture维持原严格字段集合，不静默接受额外状态。旧combat1.3无法冒充1.4能力。
- 新模块字段：`bonfires.bindings/placements/pending/active/receipts`。active保存动作身份、原HP/anchor与中断标记，倒计时仅在scheduler；没有新增Game机械字段。存档验证世界对象互相引用、玩家身份/深度、预算、访问/收据序号、source形状/原生timer以及动作ID不与已完成休息重用。
- `WorldRestUnavailableReason` 是底座有限原因码；本地化映射留在combat，确认采用底座通用 `ext.command.rest_confirm`，时长来自已校验定义。底座没有直接引用combat本地化常量，也不import combat/growth/narrative/giants实现。
- runtime的actorActions命名空间普通setState与部位破坏提交都保留原生动作对象图。`adoptActorActionJson` 在同时带actorId/actionId的记录上优先按actionId，避免同一玩家多条休息收据合并成同一个对象。
- 本步只证明边界/禁用与真实组合合同；未进行实际物理删除矩阵，按批准门禁留到3f。

## 共享文件

底座改动限定为 `Game.ts`、`TimeCoordinator.ts`、`ActorActionProduction.ts`、`ActorActionScheduler.ts`、`PhasedAttackProduction.ts`、新增 `WorldRestProduction.ts`；扩展协议/事务为 `ext/actorActions.ts`、`actorActionValidation.ts`、`actorActionIdentity.ts`、`runtime.ts`、`world.ts`、新增 `worldRest.ts`，以及全局locale的通用确认文案。其余生产/数据/UI/自有测试均在combat模块。没有改giants默认内容、扩展多格闪避、复制存档codec或新增Game机械字段。

## 独立审查与针对修复

| 问题 | 修复 / 针对覆盖 |
|---|---|
| 同tick先于饥饿终局恢复 | 成功恢复推后到完整原生epilogue；HP1/nutrition0的真实命令死亡，不被篝火救活；真实隐身NPC第500tick命中取消奖励 |
| 配置允许>256放置、底座批次拒绝 | 同事务有序分块；257/1024数量与第二块失败全回滚 |
| 资源/动作预算接受后才失败 | 准备时预留全部活actor隐式部分资源池；已满隐式池不额外分配；4096容量、restorePolicy=none与NPC池用例 |
| recovery-only存档未校验source版本 | 显式校验rest source指纹/part/actor/anchor；损坏存档保留旧live Game，不退休旧局 |
| 多条休息收据被actorId合并 | 优先actionId；真实两次休息后giants部位破坏成功/故障回滚都保持两条内容及对象身份 |
| enteredLevel更新替换活动作图 | actorActions普通setState也原位adopt；原跨层/坠落闪避三个失败直接复绿，未修改旧断言 |
| 通用事务/GC故障只替换JSON副本 | 为actor ledger加对象身份checkpoint；command/settle/collect三种后置故障恢复保留的scheduler、resource与篝火引用 |
| 底座残留combat文案依赖 | 原因码+模块映射+底座通用确认文案；i18n/边界守卫，无白名单放宽 |

## 旧测试前提修订

保留原测试、先做单变量生产反事实：未改的schema/defense两个测试在隔离a01a892生产树144/144通过；新生产最初暴露版本与总定义类别变更。只把版本钉到1.4.0，严格键集合加入bonfires，总定义上限夹具/期望计数计入bonfires，仍验证精确上限与+1拒绝。

未改的part-break纯测试在同一隔离生产树41/41通过；新生产两个用例仅因初始ledger新增bonfires严格键集合失败。只登记新键，保持不追加硬直、不重复setState与对象身份断言。跨层闪避失败是真回归，修生产对象图，不修测试。i18n动态键失败改生产字面量映射，不改守卫。

## 验证与交付状态

运行环境 Node24.19.0，3GiB堆、最多2个Vitest workers。相关文件清单随QA包提供 `final-tests.txt`，原始日志保留在执行环境 `/workspace/shared/phase3e-verification/`，不提交截图/大原始证据。

| 门禁 | 实际结果 |
|---|---|
| `node scripts/check-module-boundaries.mjs` | 通过，exit0 |
| `npx vue-tsc -b` | 最终通过，exit0 |
| `npm run build` | 最终通过，exit0；保留既有大chunk提示，未改阈值 |
| 最终a2b58f8组合38文件相关批次 | 855通过，0失败，0跳过，原始exit0；包括原防御/动画/资源/部位破坏/底座动作、世界交互、生成checkpoint、受控命令、源码/UI守卫及4d真实动作/生产身体/群体状态/侧栏合同 |
| 较早7ad基线及就绪门追加回归 | 36文件829通过；最后小改另4文件129通过、0失败/0跳过。最终38文件已在a2b58f8重新完整执行，包含此改动 |
| U03实例/Cell源码登记筛选 | 2通过，12项被 `-t` 筛除；无新Game机械字段 |
| 地形读者源码守卫筛选 | 3通过，27项被 `-t` 筛除；没有放宽读者白名单 |
| DEV QA构建 | `NODE_ENV=development vite build --mode development --base ./ --outDir <QA>/dist`，exit0 |

新的runtime文件47项覆盖500tick、实际NPC/环境推进、No/旧计划/双提交、所有中断、最后tick隐身NPC真实攻击、终局饥饿死亡、动画驱动、8个combat启用组合、4096容量、失败对象图回滚、存读/候选拒绝/续录。正常模式seed7397的原样生成，通过真实移动/战斗命令完成两次休息，第三次被新敌情自然打断；逐命令checkpoint、两RNG、前后seek与存档续录一致。没有把修改过世界的测试场景称作自然生成证据。

32项定义/放置/事务用例覆盖严格配置、skip/defer、访问/载入/GC、257与1024有序分块、后块故障回滚及普通command/settle/collect故障的完整引用恢复；24项新UI用例覆盖只读打开/关闭、陈旧会话、DialogHost屏障、重复输入/blur/reset及历史帧。另新增两次休息之后的真实部位破坏成功/失败收据身份回归。

较早36文件批次后曾在 `combat/module.ts` 增加显式 `initializationReady:()=>true`，分离瞬态保存gate与创建就绪gate，并补跑4文件。随后合入a2b58f8重新执行最终38文件及全部构建/源码守卫；最终这轮 src/scripts 前后逐文件SHA-256完全一致，不以历史阶段的绿灯替代合并后验收。

未执行：完整npm test、全部test:ext、test:full、test:gen、重型drift、物理删除矩阵。未隐藏CE缓存；当前执行环境没有CE源码，选择的最终定向批次实际0skip，CE提示不等于已跑CE。

浏览器/真实触屏像素验收尚未在本步执行；SFC、DialogService与动画驱动引擎测试不冒充真实设备。最终QA源包由验收方在相关门禁和独立审查后使用。本步不自动进入3f，不合main、不打tag、不部署。

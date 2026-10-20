# P1d R2 独立复核与 C 作者自检

2026-10-20；开工 HEAD `3431533`，本轮审阅未提交候选。审阅者 `/root/source_audit` 独立复核主作者实现的来源、profile、codec、成长、名册外层事务；本人同时是 C 居民桥接与驻营调度作者，因此 **R1-F1 的说明仅为作者自检，不能充当独立 R2 关闭证据**。本轮遵父任务只做静态审查，未运行新的审查探针；下述作者测试属于此前实施验证。R1 原文保留在 `party-p1d.review-r1.md`。

## 新 findings

### R2-F1 / P2：居民首次来源仍未与真实来源组件联合

`Game.loadSnapshot` 来源预检只确认 `residentMemories.source.owner` 在已安装 resident owners 内；`validatePartyRoster` 只检查 source.key 等于 memory.source.key。`ResidentValidation` 则独立验证真实 resident source component 和 spawnSlot，没有将它与党籍首次 source/memory 联合。

静态反例：从合法居民已加入的无 origin 诊断档出发，将 `party.state.sources[id].key`、该 ID 的全部 transfer.sourceKey 与 `residentMemories[id].source.source.key` 一起改为合法 ID 字符串 `forged.spawn.1`，保留真实 settlement source component 与 spawnSlot。三个副本彼此一致，真实组件也各自合法，但不是同一来源。现有检查没有比较位置。该变异不需要新增实体或更改 profile。

建议在替换活局之前联合比较实际 owner/source kind/key；已死或已退役者真实 source 已终结时，须核实对应 terminal spawnSlot/退役历史，不能把正常终止记录误拒。拒绝应保持活局对象身份。R1-F3 的 party-only goblin 冒称 narrative 已修；本项是 resident 分支未完整关闭。

### R2-F2 / P2：成长历史 union 被用于未来盟友击杀的默认分摊

`growth.party.members` 改为历史 union，能够保留旧 receipts/participants，修复 R1-F2 的派驻抛错。然而 `growth/module.ts` 的非成员盟友击杀分支仍使用 `participants[target] ?? state.party.members`。当普通盟友独立击杀、没有成员参与记录时，历史上加入过的驻营/迁出成员也进入新分摊；`awardPool` 只检查历史 isMember 与 `hp > 0`。HP 保留的行政退役者也可因此得到后续奖励。

建议缺少 participants 时使用当前权威名册，按既有规则决定 active/frozen 筛选；保留真实旧 participants 及已付 receipts，不删历史。行政退役对象不应在未来奖励中重新获得活跃资格。该项是 R1-F2 修复后的新行为，不应把历史 union 当当前控制权限。

## 原 findings 的独立静态复核

- **R1-F2：原拒绝原因已消除，但受 R2-F2 限制。** roster hook 用历史 union，state 上限扩大到128，receipts/participants仍检查历史ID；`validateWorld` 也接受历史成员成长组件，即使 monsters.enabled=false。控制命令的 memberPayload 改从 foundation当前名册取资格。真实含奖励后派驻/存读的测试仍由主作者执行，本轮不冒称通过。
- **R1-F3：部分关闭。** kind/template 组合白名单、固定 cord.mender key、所需模块 presence、叙事 placement+verdict+解绑事实已加入，预检在替换活局前。resident 联合缺口见 R2-F1。
- **R1-F4：静态关闭。** WholeRunSnapshot 的 actors 与 stationed 分支现在使用相同 source/profile 匹配约束；retired 仍经过 stationed profile 检查后才跳过居住/占位约束。creation不得附profile，非creation必须提供匹配template的有效profile。具体变异拒档探针待主门禁。
- **R1-F5：静态关闭，并有实施测试证据。** executeCommand 外层 restoreBoundary 在native+extension恢复后，重新bind恢复的actors、unbind恢复的stationed；覆盖内层生成器返回后的第二次collect、recordInputEvent与presentation异常路径。C文件测试两项晚期失败均断言同对象、isPartyMember、native/库存引用、完整snapshot和录制前缀。反向rejoin尾部异常路径同一代码可覆盖，尚未单列新探针。
- **R1-F7：静态关闭原伤害/弱化遗漏。** 两条物理resolve入口均先取profile.damage；无武器时读取native端点并应用nativeRolledDamage，裸防御走monsterDefenseAdjusted。goblin目录clumping=1，当前解析也为1。profile regen分支同时保留native间隔并接再生戒指倍率与regenerating。真实resolveAttack/resolveAttackExtended弱化差分测试已在主作者文件，执行结果以主门禁为准；不能把getter相等当伤害验证。
- **R1-F6：非本次分工。** 地图与UI由其他独立审阅者负责，本文件不关闭视觉项。

## C 作者自检（非独立）

R1-F1 已增加独立 `TimePorts.residents`。FREE ready/timer/decision和busy scheduler分开；派驻实体不进入controlledActors、不伪装Monster。`stationedNative`移交原生临时字段；环境、毒火/状态递减、真实移动接触、客观资源/物品识别与居民经济有各自执行入口。结构施工占格/逃生也纳入驻营。

`party_resident_handoff.test.ts` 11/11 通过，单worker、无文件并行，45.84s（tests41.84s）。包括公开join/station/rejoin存读、原物一次退役掉落、事务中自动退役失败回滚、晚期collect/record失败、实际公开wait推进驻营步行和haul相位至入库、weakened递减、真实escrow退款。该次transform后仅补驻营客观arcana资源与autoID遍历，需最终门禁再覆盖。尚未单列火/毒致死和跨层坠落探针。

深渊强制坠落采取fallen安全退役，HP与历史保留、不带队伍下层、原物落本层，尚未实现原Monster跨层存活链；限制已登记source-audit，需维护者后续裁定，不能声称与原NPC坠落行为一致。

## 检查边界及候选身份

本轮 `vue-tsc -b --pretty false` 曾报告两处类型错：WholeRunSnapshot回调丢LevelRef窄化、growth memberPayload要求完整ExtensionContext却接ControlledCommandPreparationContext。已立即交主作者修复，不将并行修复前输出冒称最终门禁。

以下SHA-256为本次读后采集，后续整改需另记，不能覆盖本轮原发现：

| 文件 | SHA-256 |
| --- | --- |
| `src/engine/Combat/Combat.ts` | `c5765c46436272c0ebfd303128286b44dd69a2f46e3981066c26ed066e9400f3` |
| `src/engine/Stats/NativeStatSources.ts` | `67ce2a9fa4cd833ea994c5cf4110e85b48a05ccf2c103c017efbe6c8ea9addf6` |
| `src/ext/partyRoster.ts` | `39b965e48d642155bbe25a3f704b4d9afbe601b7d7f8f2a4b4cddad9d00d628e` |
| `src/engine/Core/WholeRunSnapshot.ts` | `8ab8cc9309f7102c9399558619f6e9e11fad6d1ae24a23d691f3be3d51656791` |
| `src/ext/modules/growth/module.ts` | `c9f044b22ebeb0f62a4f3a4093c8d0d6caad334ea53d161dc08e71af16b74889` |
| `src/ext/modules/growth/state.ts` | `225a62c84d574b0e752bcb958c2bb03f56566f8d6aceedfdb55f598fd6c57348` |
| `src/engine/Core/Game.ts` | `6f3673c3d3712c552b5a466df78db7ecf3905eb19932cadf242b3ebce840856d` |

## R2 整改回读（保留上述原发现）

- **R2-F2 原发现静态关闭。** 主作者已把无 participants 的普通盟友击杀 fallback 改成 `memberIds(context)`，从 foundation 当前名册取ID，历史 union 不再充作未来默认分摊名单。既有真实 participants/receipt仍保留。此处没有声称重新执行奖励探针。
- **R2-F1 第一轮整改：活来源缺口已补，终端分支待补。** `loadSnapshot` 现在关联实际 resident source component 的 key/kind/consumed 与 owner policy模板；`forged.spawn.1`反例无法通过。但当前 `!actual`直接拒绝，会拒绝合法死亡/退役居民档：`terminateResidentSource` 必定移除source，且将对应spawnSlot置terminal并清actorId。已要求以dead/retired身份、原memory key与terminal spawnSlot联合验证，不把合法终止历史误拒。
- **来源优先级补充：** 已救goblin先转普通居民再编入party时，应优先保留原可信rescue证明；它不是wayfarer/gardener自然spawn模板，不能静默拓宽resident白名单。居民release/退款与memory仍执行，首次party source可以保持rescue。

## R2 第二轮整改回读

**R2-F1 静态关闭。** live来源要求实际component key/kind/consumed匹配；缺component仅允许dead member或retired身份，且memory.kind=spawn、同owner中真实terminal且actorId=null的slot与原source key按depth对应；仍要求模板属于owner居民政策。源source/memory/key/transfer的一致性由PartyRoster验证共同保证。这样原伪key反例会拒绝，合法终端居民不再因为已清source被提前拒绝。

**goblin来源优先级已修。** PartyRecruitment.partySource先查询真实rescued证明，再回退自然resident来源；原居民release和memory路径不变。

以上均为独立静态回读，实际变异拒档/终端存读/成长分摊测试以主门禁记录为准。本文件未将静态闭合作为这些测试已通过的替代。C/R1-F1仍需另一审阅者独立关闭。

整改后身份：

| 文件 | SHA-256 |
| --- | --- |
| `src/engine/Core/Game.ts` | `4248130ce4964a82777c3b6176b74aa3f1c080f1c34fa595a5b8703e676cec53` |
| `src/engine/Core/PartyRecruitment.ts` | `6f7bbb5eac6990ff19423252b13480346f37c9a80204af834e88f45944bfc52a` |
| `src/ext/modules/growth/module.ts` | `c9f044b22ebeb0f62a4f3a4093c8d0d6caad334ea53d161dc08e71af16b74889` |

## 后续 C 作者补丁（需独立复核与最终执行）

主作者后续集成审阅指出驻营遭敌/反击入口遗漏，作者已补 `nativeAllyActors` 瞬时视图、Monster格查询/bolt候选、Game原生寻敌、NativeAttackTransaction所有权；驻营FREE回退执行原地邻接自卫，使用原生attack成本与完整melee后处理，不进入playerTurnEnded，不主动追击。该补丁是本人C自检整改，**不能作为本文件独立审查的关闭项**。

居民测试文件现为13例，新增真实敌方决策攻击驻营与反击、原生中毒死亡仅captureDeath一次并terminal读档；原station例补无origin伪造来源/缺profile拒档，行政retire例补terminal读档。新增部分已提交主作者门禁队列，本审阅者未自行运行；此前11/11不代表这13例最终结果。

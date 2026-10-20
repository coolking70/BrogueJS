# P1d 独立 R1 原始 findings

审查日期：2026-10-20。开工 HEAD `3431533`，审查对象为未提交候选；作者仍在并行修改，以下行号对应本次读到的版本。审查者是独立上下文 `/root/review_r1`，未参与实现。按父任务要求，本轮先做只读执行路径审查，**尚未运行复现探针或测试**；以下给出静态可确证的遗漏及最小回归方式，不将未实现测试/报告列为代码缺陷。

已读 AGENTS.md、HANDOFF、development、architecture、P1d task 和 source-audit。PD1–PD7 按已批准推荐，不重开产品裁决。

## R1-F1 / P1：派驻实体没有接入活动层原生调度

位置：`src/engine/Core/Game.ts:687`、`:12764`、`:12794`；`src/engine/Core/TimeCoordinator.ts:140`、`:158`、`:232`。

派驻将成员移出 `root.actors` 和 `state.members`，放入 `root.stationed`。但时间端口的 `party.actors()` 仍只返回 `activeControlledActors`，`world.monsters` 仍仅返回 `game.monsters`。TimeCoordinator 求下一次原生行动、倒计时与 dueActors 都只使用这两组，stationed 不属于任一组。`selectResidentDecision` 虽已支持新的实体类型，却只有 `Game.monsterTakeTurn → selectNativeActorAction` 的生产调用者，派驻对象不会到达它。

因此派驻居民在当前层不会走向床位、执行守卫移动或启动搬运/生产岗位；同时原生环境/状态更新仍大量只遍历 `activeControlledActors + monsters`，派驻身份不应由此变为免疫火毒的静止对象。`actorActionWorld` 增加查询根并不提供 FREE decision 调度。

最小回归：使用已有 `residentScene`，公开 join→station；给派驻对象分配一个需要移动的 guard/haul 岗位，让主成员通过公开 wait 推进至少数百 tick，断言对象确实移动/开始真实票据。另以已存在的中毒/燃烧状态验证活动层按一次原生时间结算。无需直接调用 `selectResidentDecision`，那会绕过缺失入口。

## R1-F2 / P1：已有 growth 奖励或参与记录的成员不能派驻

位置：`src/ext/modules/growth/module.ts:734`、`:742`；`src/ext/modules/growth/state.ts:62`、`:65`；`src/ext/runtime.ts:667`。

`partyRosterChanged` 把 `growth.party.members` 替换为当前名册，但保留历史 `participants` 和 `receipts`。`isGrowthState` 仍强制这些历史行的每个 actorId 必须属于当前 members。成员一旦获得共享首访/击杀奖励，派驻从 members 删除该 ID，随后 `saveState → context.setState` 立即抛 `Invalid module state: growth`，使合法派驻事务回滚。即使尚未奖励，留有战斗参与记录也同样触发。

最小回归：P+growth+settlement 两人开局，获得一条包含副成员的真实共享奖励，再在合法营地公开 station。保留原 receipts/贡献记录，验证派驻、保存读回及再编入都成功。应区分历史身份与当前可分配名册，不能删除历史收据来让校验通过。另需检查 `monsters.enabled=false` 时离队后的既有成长组件仍被接受。

## R1-F3 / P2：动态来源校验可绕过已救来源，接受不存在的叙事身份

位置：`src/ext/partyRoster.ts:33–36`、`:55–56`；`src/engine/Core/WholeRunSnapshot.ts:549`。

来源结构只验证 kind 是四选一、key/template 是非空字符串；只有 `kind=rescue` 关联救援事实。没有校验 narrative 的固定 template、实际 narrative 模块、placement/verdict/reward 事实，也没有把 resident 的来源连到其权威组件/来源记录。

最小反例不需制造实体：从 **party-only** 的已招募 goblin 诊断 snapshot 出发，把该 source 的 kind 改为 `narrative`、key 改为任意非空值，并同步该 actor 的 transfer.sourceKey，删除 rescued 证明，保留 actor/profile/所有其他世界数据。该变更满足当前所有 roster 校验，WholeRunSnapshot 也只比较 profile.template 与 source.template；它表达“没有 narrative 模块却来自 narrative 的 goblin”，生产准入绝不可能产生。无 origin 诊断档也是任务要求验证的入口，不能靠录像回放偶然发现来替代来源联合校验。

建议回归同时覆盖：不支持的 kind/template 配对、缺失提供者、伪 placement/source key、合法往返后仍能联合验证。加载拒绝必须发生在替换活局之前。

## R1-F4 / P2：派驻 snapshot 漏掉来源和原生 profile 的关联校验

位置：`src/engine/Core/WholeRunSnapshot.ts:551–556`；对照同文件 `:549`；`src/engine/Core/PartyRecruitment.ts:75`。

`actors` 分支要求 creation 不能有 profile，非 creation 必须具有与 source.template 一致的 profile；`stationed` 分支没有同等约束，`validControlledSnapshot` 又允许不带 profile。删除派驻 goblin 的 profile，或替换成另一种合法 profile，不会被这一分支拒绝。再次编入直接返回同一个 stationed 对象，缺失 profile 的实体使用 PartyMember 默认能力，恢复到 actors 后却不满足同文件的可读档条件。

最小回归：真实招募→派驻 snapshot，分别删除/替换其 profile，使用无 origin 档验证拒绝并保持原活局。测试同一个变异在 active/stationed/retired 三种保存状态都保持一致准入。本条是当前 codec 校验可确证的不对称；完整 load 探针尚未执行。

## R1-F5 / P1：事务尾部失败不会恢复成员能力绑定

位置：`src/engine/Core/Game.ts:4407`、`:4425–4428`；对照 `:713`；`src/engine/Core/PartyActorIdentity.ts`。

内层 `partyRosterStages` catch 会按恢复后的 actors/stationed 重新 bind/unbind。但在生成器已成功返回之后，外层还会再次 collectExtensionComponents、录制事件和发布 presentation；这些步骤异常时只运行 `restoreBoundary`，没有恢复模块级 `PartyActorIdentity.members` WeakSet。原生/extension checkpoint 都没有捕获这个 WeakSet。

例如 station 内部已 `unbindPartyMember(actor)`；在生成器完成后的第二次 collect 或 recordInputEvent 注入异常，外层恢复旧 actors/member/native 根，但原对象仍不在 WeakSet 中。随后 `nativeStatFacts` 缺少 `party.member` 标签，runtime 对成员物品能力/伤害因果的识别与名册不一致。反向 rejoin 尾部失败会让已恢复为 stationed 的对象保留 member 能力。

最小回归：分别在 station/rejoin 的 **生成器完成之后** 注入一次性错误，除完整对象图/双流/录制前缀外，显式断言原对象的 `isPartyMember` 和 `nativeStatFacts(...).tags` 恢复。现有内部 replace/emit/vision 注入没有覆盖这一阶段。

## R1-F6 / P2：派驻成员从地图渲染中消失

位置：`src/components/GameCanvas.vue:725`、`:754`；`src/engine/Core/Game.ts:687`。

Canvas 实体循环只绘制 game.monsters 和 activeControlledActors。派驻对象移出这两组，stationed 没有第三条绘制路径，因此即使同层、可见、仍占格，也没有角色图形。居民管理列表能访问该对象并不能替代地图显示。

最小回归：可见营地中公开派驻，核验原位置仍显示人物且交互语义属于居民；再编入恢复队员语义。自动检查可验证 Canvas 投影输入，实际视觉操作留维护者清单。

## R1-F7 / P1：招募者原生伤害没有进入真实攻击路径

位置：`src/engine/Combat/Combat.ts:196–216`、`:323–338`、`:493–513`、`:628–643`；`src/engine/Stats/NativeStatSources.ts:132`。

转换保存 `partyProfile.damage`，NativeStatSources 的 damageRange 也能够读到它，但两条实际物理攻击路径都以 `damageString='1d2'` 开始，ControlledActor 分支仅在装备武器时替换。之后只有 `weaponEnchant !== undefined || attacker instanceof Monster` 才读取 native.damage-min/max。新招募 goblin 没有赠品/武器，因而仍以默认 1d2 投骰，而不是原有 1d4+1；nativeStat getter 相等的现测试不经过这个分支。

同一转换还保留了 weaknessAmount，却在 profile 的裸防御分支直接返回原 defense，未应用 monsterDefenseAdjusted；真实伤害的 nativeRolledDamage 也仅对 Monster 生效。因而弱化中的原生能力也发生跳变。武器替换原生伤害可以按已审装备规则处理，空手原生能力则不能静默丢失。

最小回归：公开救援/招募后，空手对固定目标走两条实际攻击入口，控制 hit/随机端点并排除偷袭，验证基础伤害 2–5，及 weakness 前后原生伤害/防御行为。再覆盖装备/卸下武器恢复原生伤害，不用只读统计 getter 代替真实伤害。

## 已读候选身份

下列 SHA-256 于发现记录前采集；修复后应另记新候选，不覆盖本记录。

| 文件 | SHA-256 |
| --- | --- |
| PartyRecruitment.ts | `6f18a4a66914b6ceaeb04db84c888e46919a644b5f0411367869a2d17c01e564` |
| PartyResident.ts | `ae74342109e3f730ac35525e818c770b33d92988f728c4cc44f6f5f7c9f1a53f` |
| Game.ts | `c9e59b7c4079911df6ae3153d4ff92330e5e8bb49e7bf4f85669854cc3a9f21f` |
| WholeRunSnapshot.ts | `d9c9263c6b1db32a830c93c1ae3cba469b1023d69402e0ca088250f027138f53` |
| partyRoster.ts | `7e42c0d0e30a7cdc72dc35a567722ff10105aa9d7f9907632736f9144f449ca7` |
| growth/module.ts | `d3259b9186effaecee18707cf3157ca066a0115a857df4aa620a5b893f22fc6d` |
| growth/state.ts | `09756366b2da0a16702377026a259d1e5a7f0d67ffbf981d90eae74926f9e3f1` |

工具/性能比较与完整 UI 输入层尚未收到最终候选审查范围，本记录不宣称这些部分已审。上述七项是 R1 原始项，未因作者口头回复或后续改动自动关闭。

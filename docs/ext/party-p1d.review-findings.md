# Party P1d 独立审查（本次第 1 轮）

结论：**需修**。发现 3 项新的、已复现的重要问题，均涉及新增的驻营实体根；现有相关测试通过不能关闭这些遗漏。本轮不把浏览器、数值平衡、正式云端长基准或报告已列出的坠落/护送限制列为新缺陷。

审查对象：HEAD `3431533c709a73e0d0c1ca7fd5564b4347818f9c` 上的未提交 P1d 实现。已读 AGENTS.md、项目三份必读文档、任务单（PD1–PD7 按推荐）、合同及实现报告；对照代码与已有审查记录。本轮未修改生产代码、测试或守卫，未 commit。唯一工作区写入为用户指定的本报告副本。

## F1 · 重要：派驻后从射线碰撞世界消失，无法接受正常治疗等法杖效果

位置：`src/engine/Core/Game.ts:697`（迁移至 stationed）、`:7634–7636`（boltWorld）。

`partyRosterStages` 正确地把实体从受控成员移至 `stationed`，但 `boltWorld.creatureAt` 仍只查询 `activeControlledActors` 和原生 monsters。新加入的 `nativeAllyActors` 没有接入这个真正供轨迹及命中执行使用的端口。敌方选择驻营者作直接目标时的 actor scope 只能覆盖部分情况，不能修复玩家施法或射线路径上的驻营者。

复现（诊断布景，实际生产射线/效果执行）：

1. 载入实现方已生成且当前引擎接受的 S11 驻营存档，主成员在 `(19,13)`，驻营居民 #47 在 `(20,13)`。
2. 将居民 HP 设为 5，使用生产 `getBoltForItem('staff_of_healing')`、`computeBoltResult` 和 `applyBoltResult` 向居民施法。
3. 实测驻营格查询为 `null`、`hits=[]`，射线落在后方 `(21,13)`，居民 HP 仍为 5。
4. 经公开 `party:roster join` 编回同一个实体，重复同样施法：查询返回 #47、`hits=[47]`，HP 从 5 增至 11。

证据：`/private/tmp/p1drev1/probe.mjs`、`probe.log`。该探针直接调用正式射线执行函数，未声称是种子录像或浏览器操作。本轮同时核对了本地 CE `Items.c:5131` 的实际格上生物查询及 `:5366` 的 BE_HEALING 执行，未见驻营身份可免除此路径的依据。应将当前层存活驻营者纳入完整射线占位/效果端口，并补驻营与编回前后的治疗、路径阻挡回归。

## F2 · 重要：驻营者的原生属性环境读档后丢失，同版本恢复改变潜行判定

位置：`src/engine/Core/Game.ts:982–987`（configureControlledNativeStats）、`:13631` / `:13763`（stationed 解码与发布）；`src/engine/Stats/NativeStatSources.ts:27`、`:148`。

成员在原对象上派驻时仍保留 `environments` WeakMap 中的 darkness/shadow/rested 回调；读档重新构造驻营对象后，`configureControlledNativeStats` 只遍历 `controlledActors`，没有为 `stationed` 重建这些机械查询依赖。另一个相关遗漏是 rested 回调只读 `party.native`，没有读取 `stationedNative`。

复现：

1. 载入相同驻营诊断档，经公开 join → station，使同一实体经过正常成员初始化和派驻。
2. #47 位于 `(20,13)`，查询 `nativeStat(actor,'native.stealth-range')` 得到 **7**；现场 `darkness=false`、`shadow=true`。
3. 保存当前诊断快照并用另一 Game 载入成功，角色位置、装备和状态不变；查询同一属性得到 **14**。

证据：`/private/tmp/p1drev1/stat-probe.mjs`、`stat-probe.log`。这是同版本有效诊断快照的直接机械属性差异；本轮没有把它夸大为已捕获自然录像 OOS。Game 的敌方目标调度会以驻营者为 commandActor 调用潜行计算，因此不是纯显示差异。应在新局/转换/载入/恢复路径一致地绑定驻营原生属性环境，回调读取正确原生状态根，并比较恢复前后的派生属性及后续敌方行动。

## F3 · 重要：地形特效撤离漏掉驻营者，关闭闸门会把活人留在不可通行格

位置：`src/engine/Core/Game.ts:15172–15189`（bindDungeonFeatureEffects）；`src/engine/Map/DungeonFeature.ts:145–164`（正式撤离执行）。

DF 的 `creatures` 与 `instantEffects` 端口仍只枚举活动成员和 monsters。驻营者虽然已纳入通用空间占位，却没有进入这套地形特效生物枚举；因此 `DFF_EVACUATE_CREATURES_FIRST` 不能撤离它，其他 DF 还可能把其占位误当空格。

复现：

1. 载入上述驻营存档，#47 在 `(20,13)`；绑定正式 DF effects。
2. 在该格执行原目录的 `DF_ACTIVATE_PORTCULLIS`，不修改 DF 定义或守卫。
3. 结果 `evacuationRequired=true`，#47 仍在 `(20,13)`，该格 `isPassable=false`。
4. 从相同存档重新开始，先经公开 join，再执行同一 DF：#47 被撤至 `(19,14)`，新位置 `isPassable=true`。

证据：`/private/tmp/p1drev1/df-probe.mjs`、`df-probe.log`。本地 CE `Architect.c:3332–3353` 也是先取得 blockingMap 上的生物再迁移位置。应为 DF 撤离、即时接触和占位检查提供当前层完整生物集合，补驻营者被地形覆盖的回归。这与 F1 分属射线和地形特效两套执行端口，不能只修其中一处便关闭另一项。

## 本轮核查和验证

- PD1 额外公开命令探针通过：主成员拒绝派驻、非主队长拒绝派驻、移交队长后可派驻、终局拒绝加入；4 人局死亡一人后可招募，保留 5 条历史成员且仅 4 名存活，新成员默认 local:0 人工，诊断存读成功。证据 `pd1-probe.mjs` / `pd1-probe.log`。
- PD2–PD4：复读来源白名单、真实提供者证据、HP/物品/growth 交接、失败回滚、同层邻接及安全边界、旧指令清理、居民工作取消/退款和需求交接。三项发现如上；未把“基础互转测试通过”扩大为驻营完整原生行为通过。
- PD5：复读手机抽屉、显式执行者、旧回调失效、已知地图投影，运行相关 UI/投影测试；未做浏览器验收。
- PD6：复读 F24/S11/R8/O6 与无 party F20/S7/R4/O2、来源/名册/实体根联合校验和旧格式拒绝。另实际重跑两份 S10/R7 旧格式样本拒绝并保活局（`old-format-rejection.json`）。自然来源生命周期、Worker 256/2048 邻接、回放/seek/续录测试在首批通过，但 F2 是额外发现的恢复缺口。
- PD7：复读显式跨格式适配器与源/算法身份、逐输入域比较、默认 strict、party-ai A/B 工作量校验及汇总；三个工具测试文件通过。本轮没有运行性能基准或云端任务。
- 正常树 boundary、测试依赖检查均 exit 0。无 party 五配置原字节夹具测试通过，未重录任何黄金或基线。
- 首批定向测试：**14 文件、140 项通过，exit 0，186.96 秒**。日志 `/private/tmp/p1drev1/selected.log`。包括新增名册/居民/成长/叙事、自然俘虏/居民、Worker、UI/计划投影、生命周期、无 party 与三性能工具文件。命令曾额外列出不存在的 `party_narrative_natural.test.ts`，Vitest 未运行该路径，实际只计 14 文件；自然叙事链在 `party_narrative_roster.test.ts` 内。
- 补充相关测试：**10 文件、354 项通过，exit 0，503.37 秒**。日志 `/private/tmp/p1drev1/related.log`。整文件为 party_travel、party_window、party_r1_environment、party_r2_occupancy、party_ai_r1_control、party_ai_r1_companion、ext_creation_combinations_ui、ext_combat_neutral_differential、ext_slaying_alignment、u_03_whole_run_snapshot。两批互不重叠，共 **24 文件 / 494 项通过**；这不包含额外诊断探针，也不是完整 npm test。
- 全删复核：复用实现方隔离副本，独立核实九模块目录全部不存在，余下 **913 个源码文件与本轮正常树逐字一致**。实际重跑删除树 classic 存读/种子回放/双向 seek/续录通过；**15 份真实 P1d 存档/录像缺包全部拒绝，并保活局对象身份、摘要、双 RNG、allocator 与前缀**。证据 `removal-classic.json`、`removal-rejection.json`。本轮未重新跑全删 build 或全部 21 测试文件，不冒称新增完整删除门禁。

复现运行环境：Node v24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`。从仓库根执行 `node /private/tmp/p1drev1/{probe,stat-probe,df-probe,pd1-probe}.mjs`（分别执行各文件）。SSR 的 HMR listen EPERM 警告不影响上述探针完成，均以进程 exit 0 和输出结果为证。

三项探针共用 `/private/tmp/p1drev1/resident-stationed-save.json`（1,853,178 bytes，SHA-256 `c396f798c4d2ac2f24f0f25e02c81af418c35edb373e9ca17cd1c8bb93f5cd05`），是复制的实现方诊断档，无 recordingOrigin；大文件仅保留在 /private/tmp。源码与样本身份见 `identity.json`。全部复现脚本和日志在 `/private/tmp/p1drev1/`，未写入仓库。

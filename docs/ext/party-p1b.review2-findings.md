# Party P1b 独立复审 R2（最后一轮）

结论：**可合入**。第 1 轮 R1-F1–F5 全部关闭；本轮未发现修复引入的新增阻断或重要问题。无 party 的原字节守卫及独立 HEAD 行为差分均通过。本结论限于本次指定的定向复审范围，不替代尚待维护者执行的浏览器、真机及正式性能验收。

审查日期：2026-10-18。对象为 HEAD `a47a15b635284c84b4651ec28083adc052509c05` 上的未提交 P1b 实现及修复。先读首轮发现与实施报告的“第 1 轮审查发现处理”，并核对 AGENTS、HANDOFF、development、architecture 和 party 合同。没有修改生产、测试、守卫、基线或原报告，没有 commit/push，没有启动子代理；仓库唯一新增输出为本报告副本。证据目录：`/private/tmp/p1brev2/`。

## 首轮发现逐项裁定

| 发现 | 独立核实 | 裁定 |
| --- | --- | --- |
| R1-F1：副成员待决保存丢失 origin | `RecordingFormat.ts:145–152` 按 `party.native.modal` 的机械所有者查库存，拒绝多个/不存在的所有者及错属物品，不依赖 focus。重新运行首轮真实魔杖场景：B/18、wand/23，待决时 origin 与 validateInputState 均 true；选择 `cell:37:12`，直接与读档两路均扣至 3 次、完整机械摘要相同、可续录；seed replay 无 OOS。新增正式回归另外覆盖投掷、恶性药水实际选择，以及保存/加载/续录/回放/前后 seek。 | **关闭** |
| R1-F2：拒绝后提交锁无法解除 | `PartyPlanning.ts:33–67` 的有效 edit/append/clear/keep 重置 submitted 并更换 generation。首轮未知格旅行得到 INVALID_TARGET 后，编辑 wait 可提交，seq=1。正式回归验证未经编辑仍拒绝重复提交，旧 deadline 与 flush 中的旧异步提交失效，真实 UI clear/append/advance 可恢复。 | **关闭** |
| R1-F3：同层传送继续旧队列 | `Game.ts:16239` 在真实 placeCreature 成功提交处记录 displacement；`PartyWindow.ts:267–279` 仅接受活动成员事实，严格收据类型与中文键已接入。首轮传送从 (37,25) 到 (64,7)，位移事实 tick=0，完整安全边界 tick=100 停窗；cursor=1，未执行 search。正式生命周期回归验证主成员不动、后缀下一窗继续，普通步行不误报。 | **关闭** |
| R1-F4：受伤后同边界回血漏打断 | `Game.ts:785` 由 nativeDamageCommitted 的 hpLost 记录伤害/低血事实，不再仅靠净 HP；`Creature.ts` 的 setter/apply/weaken/addPoison 增加观察通知。首轮 burning 探针 skip=0…4 全部在 tick=100 停窗；skip=1/3/4 实际扣 1 后恢复到 HP20，仍保留 damage。正式回归覆盖两成员同边界真实伤害/治疗、状态施加/清除、低血后治疗及 stop/continue 的完整生命周期。 | **关闭** |
| R1-F5：失败物品动作消费游标 | `Game.ts:626–651` 区分原生 boolean/回合提交信号；`PartyWindow.ts:369–385` 对 rejected 记 plan-invalid 并在递增游标前硬停。首轮诅咒 unequip→search 两个连续窗口均拒绝 unequip、cursor=0，武器仍装备，没有跳到 search。正式回归覆盖 equip/drop/native-unequip、已知空杖、护符冷却、call/inscribe/relabel 失败和空格 pickup；合法零耗时 inscription 为 accepted 且只消费一项，保存/keep/续录/回放/seek 均一致。 | **关闭** |

以上复现沿用首轮布景和原生命令执行，仅将仓库外探针中的“应重现旧缺陷”断言改为修复后的期望；F1 增加完整 domains/root 比较。没有替换命令、录像或伤害实现，也没有据作者日志直接判定关闭。对应本轮日志为 `modal.log`、`probe.log`、`damage.log`。

## 修复回归与无 party 不变性

定向检查了新增观察与返回值会话：StatusObservation 使用 WeakMap，窗口 finally 解除订阅；原生事务恢复同步恢复 observation 比较基线，收据/锁存仍由原机械对象图回滚。partyItemCommits 在 finally 恢复/清除，原生 false 不再抛出异常触发多余回滚。没有新增 Game/entity 持久字段、随机抽样或实体 ID 分配；无 party 时没有运行窗口能力或状态订阅。确认/取消、模态选择、保存恢复及现有 P1a 环境路径的相关回归均通过。未发现新增阻断或重要问题。

无 party 验证有两层：

1. 原 `ext_party_inert.test.ts` 及 `party-phase6-inert.json` 与 HEAD 逐字节未改，本轮原样通过。classic、空扩展、growth、loot、八模块全开五配置的 save/recording/Game keys/RNG/messages 保持原夹具；没有删版本字段、归一化或重录。
2. 将 HEAD 用 `git archive` 展开到 `/private/tmp/p1brev2/head/`，对 HEAD 与当前候选分别运行同一独立原生行为探针。五配置各九阶段，共 **45 个阶段对照**，覆盖状态设置、原生燃烧/恢复边界、真实 takeDamage/healPoints、诅咒脱卸失败、正常脱卸/装备、刻字及传送。逐阶段完整世界/存档/录像 JSON 哈希、Game/Player 字段集合、双 RNG、allocator、消息及 HP/位置/回合全部相同；两份结果文件本身也逐字节相同。见 `no-party-comparison.json`、`no-party-{current,head}.json`，结果文件 SHA256 为 `76cb317ee3fca937fbf4e134e6b5f21a88d3fc70dd6357928898a6b56655bda8`。这是受控原生效果差分，不冒称自然长局或穷举全部状态。

## 本轮实际门禁与证据

- **一次相关 Vitest 批次：exit0，20 个不同文件、579 项通过，0 失败、0 跳过、0 todo，469.59 秒。** Node v25.2.1，heap 3072 MiB，单 worker、禁止文件并行。日志/JSON 为 `related.log`、`related-results.json`。JSON 的 49 个嵌套 suite 不误计为 49 文件。
- 文件范围：party_actions、party_r1_environment、party_travel、party_window、party_window_decisions、party_window_review_r1、party_window_ui；ext_causality、ext_item_commands、ext_party_inert、ext_recording_v4_digest、ext_recording_v4_snapshots、u_03_whole_run_snapshot、u_14a_status_gaps、u_14b_status_gaps、ux_1d_recording_continuation、w_11_teleport_placement、w_12_blink_beckoning、w_9_directed_status、x3_u3_cursed_equipment。完整路径及复现命令保存在 `selected-tests.txt`、`commands.txt`。
- `node scripts/check-module-boundaries.mjs`：exit0，`boundary.log`。
- `node scripts/check-test-dependencies.mjs`：exit0，693 文件、`errors=[]`，`dependencies.log`。两个守卫脚本与 HEAD 一致。
- 三份首轮场景修复探针及最终 HEAD/当前无 party 差分均 exit0，探针数量不计入 579 项 Vitest 覆盖。
- 独立无 party 探针首版错误地清空所有 monsters，连 settlement 居民源实体也被删掉，HEAD 与当前候选均报 `resident.source.actor`。仅修正仓库外布景为保留实体后，两边重跑通过；首版脚本与两份首次失败日志保留。这不是产品缺陷，也没有修改/放宽校验。Vite SSR 的 websocket EPERM 为环境监听提示，模块加载与所有最终探针断言正常完成，不据此声称浏览器通过。

身份核对：作者修复后 manifest 的 687 个生产文件与当前逐文件一致（生产聚合 `1c0abf116eb9cbdef366389683d59b841972b58deb862c660993f79957bbb3b3`）。本轮记录的 3,235 个已有生产/测试/脚本/配置/文档路径结束时散列无变化；新增路径仅为指定的 `docs/ext/party-p1b.review2-findings.md`。见 `source-before.json`、`source-audit.json`。本报告 `/private/tmp/p1brev2.findings.md` 与仓库副本逐字节相同。

按本轮授权未跑完整 npm test/test:ext/drift/full/gen、types/build、Worker 长边界、物理删包矩阵、性能长跑、云端或浏览器；没有把首轮审查或作者历史结果冒称本轮重跑。五项已确认问题均关闭，无剩余已证实的阻断/重要修复项；本轮结束，不再开启第三轮审查。

# Party P1d 独立复审（第 2 轮，最后一轮）

结论：**需修**。第 1 轮 F1–F3 的原始复现均已关闭；F1 的射线接入暴露了 **1 项新的重要问题**：闪电杀死驻营者会提前截断，后方目标漏伤。当前相关自动测试没有覆盖这一致死穿透路径。本轮不修改实现、不 commit，不启动第 3 轮。

审查对象：HEAD `3431533c709a73e0d0c1ca7fd5564b4347818f9c` 上的未提交 P1d 实现及修复。已读第 1 轮发现、实施报告 §9、项目三份必读文档并核对合同。当前 `sourceSnapshot` 为 `0d5d7328bf1e8d8ab3d9ec7a1b2f77c3201726e7743f22fb79106c1310062cbe`，与作者修后身份一致。修前 `Game.before.ts` 的 SHA-256 为 `89e5b700167a4658ad4718f5502f307d2ca7ed261202bdf36c81ae2855ed5fdc`，与第 1 轮保存的身份一致；据此单独核对修复差量，而非把整个 P1d 都当作本轮新修复。

## F4 · 重要：致死驻营命中错误中止闪电穿透

位置：`src/engine/Core/Game.ts:7639`（本次 F1 修复将驻营者接入射线查询）、`:7712`（实际射线逐格执行的提前终止条件）。

`boltWorld` 现能找到驻营者，但 `applyBoltResult` 仍在命中任意死亡 `ControlledActor` 时直接 `return false`。派驻保留同一个 `ControlledActor`，因此驻营居民被闪电杀死也会触发这个原有的受控角色终止分支，后续穿透和该格后续地形处理被跳过。这一条件不是本轮新增代码；缺陷是本轮把驻营根接入它之后新可达的行为，不能以原条件未改为由排除。

独立复现使用第 1 轮同一 S11 驻营诊断档（无录制来源），在 `/private/tmp` 中布景：主成员 `(19,13)`、驻营 #47 `(20,13)`、下游原生 rat `(21,13)`，直线施放正式 `staff_of_lightning`（enchantment=3）。没有修改生产代码、目录或守卫。

- 正式 `computeBoltResult` → `applyBoltResult`：驻营者 HP=1 时，预览命中 `[47,52]`，实际命中仅 `[47]`；#47 死亡，下游 HP 保持 1000，`isGameOver=false`。同场景把驻营 HP 设为 1000，实际命中 `[47,52]`，下游 HP 降到 994。
- **公开命令复核**：物品加入背包后调用 `submitPartyIntent({kind:'item',operation:'use',…}, player.id)`，由正式命令路径执行。驻营 HP=1 时死亡并正常退役，但下游 HP 仍为 1000、队伍未终局；驻营 HP=40 时存活，下游 HP 降到 994。不是仅有预览差异，也不依赖直接调用私有效果函数。此诊断档不支持完整录制，`events=0` 如实保留，不冒称自然录像或回放证据。
- 原生生物对照：把首个射线占位者换成 HP=1 的原生 rat，驻营者移出射线；前者死亡后实际仍命中两者，下游 HP 降到 995。

CE 执行依据：本地冻结源码 `Items.c:5168–5191` 在目标死亡时，仅玩家死亡触发立即终止，否则完成 `killCreature` 后继续；`:5420–5422` 按 `BF_PASSES_THRU_CREATURES` 判断停止。`Rogue.h:1850` 明确该标志供闪电等穿透生物。驻营者已经不在成员名册，合同 PD4 要求其独立居民调度，没有把居民死亡规定为玩家射线终止条件。

建议：致死提前终止不要仅凭 `instanceof ControlledActor` 覆盖驻营实体；保留已批准的队员/终局语义，让驻营目标死亡后沿该 bolt 的正常穿透及地形规则继续。补“低 HP 驻营者在前、敌人在后”的公开闪电回归，并检查死亡退休及后续存读。不要改守卫或降低穿透断言。

证据：`/private/tmp/p1drev2/lightning-probe.mjs`、`lightning-public-probe.mjs`、`lightning-native-control.mjs` 及对应 `.log`；三进程 exit 0。`probe-assertions.json` 对关键结果作了独立硬断言。

## 第 1 轮问题核销

| 项目 | 本轮独立核实 | 结论 |
|---|---|---|
| F1 射线查不到驻营者 | 原脚本、原样本重跑：驻营与编回均 lookup=47、hits=[47]、HP 5→11、落点 `(20,13)`；复读当前层/存活/退役过滤及治疗、焚烧飞镖、范围消魔端口 | 原症状关闭；新增致死穿透问题单列 F4 |
| F2 存读后属性环境丢失 | 原脚本重跑潜行 7→7，shadow=true、darkness=false；所有权根绑定包含 stationed，rested 查 native/stationedNative，照明刷新失效驻营属性缓存；新回归同时覆盖 rested 两值、敌方真实决策、恢复/seek/续录 | 关闭 |
| F3 DF 撤离遗漏驻营者 | 原脚本、原目录闸门：驻营与编回均从 `(20,13)` 撤到 `(19,14)`，passable=true；枚举、即时接触与火/下降补查均接入活驻营根 | 关闭 |

补读控制窗口/共享视野/矿灯仍使用在籍活动成员；驻营原生状态时钟未因本轮集合替换重复进入队员时钟。死亡、退役、离层过滤和原生环境绑定也已复核。除 F4 外，本轮未确认其他新增阻断或重要问题；不将上一轮已列的坠落/护送限制、浏览器、平衡或正式性能待办重新列为缺陷。

## 验证范围与无 party 保持

- **相关测试：24 文件 / 471 项全部通过，exit 0，无 skip。** Vitest 用时 489.58 秒，含进程启动的外层耗时 494.20 秒。7 个 party 整文件包含新增驻营原生、居民交接、自然居民、环境、占位、旅行、事务检查点；17 个 foundation 整文件涵盖无 party、射线/反射/地形/消魔/照明/飞镖、属性、whole-run 与相关源码守卫。精确路径及命令在 `/private/tmp/p1drev2/selected-files.txt`、`selected-command.json`，原始结果为 `selected.log`、`selected-result.json`。
- **boundary 与测试依赖检查均 exit 0**：分别执行 `node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs`；依赖报告覆盖 717 个测试文件，`errors=[]`。结果及耗时见 `probes-gates.json`。未改扫描器、白名单、断言、timeout 或 skip。
- **无 party 字节/行为保持核验通过。** `ext_party_inert.test.ts` 在本轮批次通过，classic、extended 空、growth、loot、旧八模块五配置的 Game own keys、save、recording、消息和双 RNG 均符合原黄金夹具；测试及 `party-phase6-inert.json` 与 HEAD 字节相同，整个 fixtures 目录无差量。静态复读确认本轮修复在无 party 时保留原集合与顺序，原生统计回调仍走原根；没有提升无 party 的 F20/S7/R4/O2 身份。有限配置/输入的测试范围如上，不冒称全量游玩证明。
- 第 1 轮三原脚本、同一个诊断样本均原样重跑，结果另存本轮目录，未覆盖原证据。样本 SHA-256 保持 `c396f798c4d2ac2f24f0f25e02c81af418c35edb373e9ca17cd1c8bb93f5cd05`。新补三份射线诊断脚本也均 exit 0，硬断言结果见 `probe-assertions.json`。SSR 的 HMR listen EPERM 警告存在，但不影响探针执行及输出断言通过。
- 环境：Node v24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest 单 worker、关闭文件并行，从仓库根执行。Node 路径为 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`。
- 按本轮授权仅跑相关测试、boundary、测试依赖及上述定向诊断；未跑全量、drift、生成普查、types/build、删除矩阵、性能或浏览器。没有把作者修前的删除/性能证据算作本轮修后验证。
- 写入报告前逐文件核对 3318 个已跟踪/未忽略文件，全部与本轮开始时一致；最终唯一仓库写入是用户指定的 `docs/ext/party-p1d.review2-findings.md`，与 `/private/tmp/p1drev2.findings.md` 字节相同。未改生产代码、测试、守卫、第一轮报告或作者报告，未 commit/push。大型原始证据仅留 `/private/tmp/p1drev2/`。

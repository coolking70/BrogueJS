# giants2 维护者验收审查

审查对象 `9c23d6c`（派发起点 `924afe3`，代码基线 `e0fa39a225428d36e6e342f6585f57f45960e6ba`）。2026-10-09。**裁决：需底座修复后合入，当前不可直接合入。**

## 范围与环境

已读 AGENTS.md、HANDOFF、development、architecture、任务包、dot 报告和配置手册。相对 `924afe3` 的 31 个交付文件均在既定白名单；生产变化只有 giants 的 definitions/locale JSON，模块实现、底座、其他模块、协议版本不变。维护者未修改 dot 分支生产/测试文件，未 commit。

Node `v24.19.0`，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`。Vitest 用 `--maxWorkers=2`，模块/受影响/漂移整批另加 `--no-file-parallelism`。原始输入在 `/private/tmp/giants2-evidence`；本轮日志、复现脚本及补丁在 `/private/tmp/giants2-acceptance`。

CLI 联网 DNS 不可用；通过 GitHub 已连接 API 确认远端 `ext/phase5` 为 `5c34f50f56bcf85f4cee890ae80dec87fa927831`，与本地 `origin/ext/phase5` 一致；该对照已是 foundation12，最小复现各自创建本版本正式新局，不篡改foundation11原录制来强行加载。对照均为 `/private/tmp` 下独立 detached 副本，依赖软链用户指定 node_modules；未修改原工作树的 Git 元数据。临时base/phase5/candidate副本均已删除，保留补丁/脚本/日志/摘要；无临时分支或worktree登记残留。

## 门禁

| 候选命令 | exit / 结果 | 日志 |
| --- | --- | --- |
| `node scripts/check-module-boundaries.mjs` | 0 | `boundary.log` |
| `npx vue-tsc -b` | 0 | `types.log` |
| `npm run build` | 0，生产构建完成 | `build.log` |
| `npx vitest run src/ext/modules/giants/tests --maxWorkers=2 --no-file-parallelism` | 1；28文件198通过/11失败，0skip/todo；2843.69s | `giants.log` |
| dot 原列 13 个受影响测试文件，同上 worker/串行参数 | 1；13文件205通过/1失败，0skip/todo；141.21s | `affected.log` |
| `npm run test:drift -- --maxWorkers=2 --no-file-parallelism` | 0；7文件14通过，0失败/skip/todo；157.73s | `drift.log` |

13 文件精确清单见仓库外 `gates.sh`，与 dot 报告 §7 一致。完整模块批次的11失败=原17中仍在的8项+本轮新增3项超时；原17中的9项失败原因消除。单批未全绿，不能用定向通过覆盖此退出码。

完整模块批次包含 `giants2_persistence.test.ts` 和 `giants2_combinations.test.ts`，直接补足 dot 会话中断的两文件复核；结果不能与首轮重叠累加。持久化文件7通过/1超时；组合文件13通过/3失败。三个额外超时是旧colossus完整持久化120s、旧giants+foraging自然持久化120s、新copper逐条回放/seek480s；原门限、单worker、本轮无其他测试进程并行的3文件定向复核全部通过（exit0，3通过/27项被-t筛除，287.83s，`isolation.log`）；没有改断言/门限/skip，也没有重跑整个模块套件。早期整批与临时对照有进程重叠，因此不以该轮计时独立判定性能回归。

## dot 首轮 17 失败归因

| 首轮项数 | 失败组 | 维护者归因 / 当前状态 |
| ---: | --- | --- |
| 4 | 铜须持久化的同步确认前提 | 原 helper 把同步消费的确认当作必须 pending；交付改成仅解答实际 pending 并核对最终 decisions，不改产品。铜须4项中3通过，逐事件回放/非单调seek首批仅超时583.759s，随后原480s门限下单worker隔离通过。原同步确认失败四项均关闭，不把整文件首批超时隐藏。 |
| 2 | giants+growth、七模块自然组合 OOS | 原始录像首分歧已独立复现；底座 G2-SDK01，见下文。 |
| 1 | 七模块零奖励诊断 `resident.source.actor` | 旧诊断清场删除居民来源；交付改为保留原世界/预留再找完整空位。当前组合文件该项通过。 |
| 1 | 七模块 seed2 铜须路线止于 D6 | 未修候选仍报 `Descent incomplete D6, HP1001`；临时候选仅应用两个底座补丁、不改数据/测试/seed后，该原用例通过完整出生、预留避让和save/load。结合combat-only时钟最小反事实归为SDK02，不能声称dot分支已修。 |
| 1 | D7/8 生成模板列表漏铜须 | 新数据追加后的列表前提未更新；交付已补 D6/7/8 对应候选；当前该项通过。 |
| 1 | guard 随机变形仍原形 | 新场地/随机路径后随机变形未保证可放置；交付显式用合法 rat 作为诊断前提；当前该项通过。 |
| 1 | D2 fall 旧清场档拒绝 | 直接清列表留下生成所有权引用；交付先走行政退休再布景；当前该项通过。 |
| 1 | C5 seed7306 D2 死亡 | 追加生成数据改变路线；交付改为已重采的 normal seed7328，断言语义未变。这不是“同种子仅回退数据”的严格单变量对照，不能把 dot 两次不同种子结果说成同一实验。当前该项通过。 |
| 5 | 旧 shale-weaver 自然复合体在 D12 无安全楼梯路径 | 同一个 capture 失败导致五项均未进入目标验证；不等于五个身体/存读产品缺陷。基线实际到D15/2602事件/8断部位/核心死亡；五项中3通过、2因480秒门限超时（660.408s/627.516s），无D12错误，不冒充基线整文件全绿。候选五项仍全部报 `No safe natural stair route D12`，保持未关闭。 |

### 共享源守卫

`src/test/phase4a0_spatial.test.ts:204` 禁止受管实体直接写位置。候选 `src/engine/Core/Game.ts:13743` 的 `passenger.loc={...actor.loc}` 命中。`e0fa39a` 和 `5c34f50` 均实际跑出 **25 通过 / 1 失败，exit 1**；不是仅凭 diff 推测。dot 对基线已有失败的说明成立。

该处在行政退休携带者时转移乘客，正确方向是使用可信的空间提交接口并核验完整落点/索引/来源失效通知；不能扩守卫白名单。它独立于下面两个 SDK 补丁，未在本次审查修复。

## G2-SDK01：growth 回放残留死亡角色

**归因：底座既有缺陷，giants2 自然路线触发；不是 giants 新数据校验或新巨兽死亡逻辑引入。**

原始录像保持原 manifest/checkpoint：双模块 command126、tick12400、位置28,18 首次 OOS；七模块 command121、tick11900、位置28,19 首次 OOS。完整世界只差 `/extensions/modules/growth/actors/53` 或 `/77`：回放多出 `{player:false,allied:false,hostile:true,alive:false,relation:0}`。其余叶（包括时间和双 RNG）相同。证据 `current-raw.json`。

根因执行链（行号按 `9c23d6c`）：

- `Game.ts:3724` 直接命令先 collect，`recordInputEvent` → `updateRecordedCheckpoint` 在 `Game.ts:3589` 再 collect；回放 `completeReplayEvent` 在 `Game.ts:4309` 只 collect 一次即比 digest。
- `src/ext/runtime.ts:1240–1245` 用 **GC 前全部** status/fatal/displacement/death origins 计算 sourceIds。
- `src/ext/modules/growth/module.ts:492–493` 按 reachable/source/player 并集保留 actor 摘要；刚死亡的来源因即将删除的 death origin 被保留。
- `src/ext/runtime.ts:1677–1684` 随后清理不可达死亡与 causality。第二次 collect 才删掉该摘要，因此同一安全边界的一次/两次收集不幂等。回放 hash 没有错，不能忽略该叶。

最小诊断：仅启用 growth，新生 rat，自身作为真实 causality 来源受致命伤，走 kill/removeDead；连续两次调用现有收集入口。两次完整扩展状态应相同，实际第一次保留死亡 actor、第二次删除。`e0fa39a` 和当前 phase5 都复现，完全不安装 giants。此诊断证明结算机制，原始自然录像另证真实公开输入影响。

修复方向：结算奖励后保留的来源集合应基于**本次 GC 后仍可达目标的 origins**；不能清掉仍有活目标携带 poison/burning 的已死施法者，也不能提前删除待结算奖励。补丁只在 Runtime 构造 sourceIds 时过滤其目标根，不放宽 growth 验证器，不靠回放多跑一次 hook 掩盖问题。

临时补丁已让两份未改写的原始录像完整回放 **136/136、131/131**，零 OOS，完整规范世界无差异（`patched-raw.json`）。dot 报告的134/129是接触终点，本次实际原始文件各含其后两条命令，按文件真实长度验完。

## G2-SDK02：七模块 D5 输入锁

**归因：底座既有调度错误；仅启用 combat 也可复现，不依赖新巨兽。**

从 `all-copper-blocked-save.json` 的真实 recordingOrigin 命令前缀重新启动并逐条公开执行，重建 seed1/wizard/七模块 D5、event314、turn313、位置30,10。玩家 stamina24、poise0、stagger20，但 `player.ticksUntilTurn=0`、`isAdvancing=false`、`isInputLocked=true`，无确认、无推进异常。再执行 wait，以及公开 `update()`、`tickAdvancement(1000)` 均不前进/解锁。新导出的存档也被加载校验拒绝；不是单纯缺少 headless 帧泵。证据 `current-natural-lock.json`。

根因：`src/engine/Core/TimeCoordinator.ts:239/244` 在本时间片 NPC 决策/攻击**之后**才扣玩家的 `soonestTurn`；攻击可在 `PhasedAttackProduction.ts:708` 给玩家新设硬直并把原生 timer 镜像为硬直。末尾扣除的是新 timer，相当于用已经过去的时间冲抵刚开始的硬直。后续 `advanceResources`（同文件:207–242）按未来 elapsed 递减硬直，两个计时遂失配；`TimeCoordinator.ts:126` 只看原生 timer 结束推进。`PhasedAttackProduction.ts:415` 仍依硬直锁输入；`ActorActionProduction.ts:168–172` 的 resumePending 只用于加载恢复，没有为这个已错误完成的命令建立续跑。存档在 `PhasedAttackProduction.ts:556` 的 defense recovery mirror 校验被拒绝。

最小诊断：只开 combat，一次公开 wait；诊断 NPC 在50tick的原生决策调用真实 `applyActorPoiseDamage(...,999)`。未修树返回 timer0/stagger50，后续 wait 不记新事件，生产 update/tick 也不恢复。`e0fa39a` 与当前 phase5 结果相同。布景/决策注入明确为诊断，不冒充自然录像。

修复方向：有 actor scheduler 且玩家非 bundle-busy 时，在本边界 NPC 执行前扣除已经过去的玩家时间，再允许攻击建立新的完整恢复债务；没有 action scheduler 的 classic 路径保持原位置。不要接受锁内的新输入、清掉硬直或强行改 timer 为0。临时候选按同一314条公开输入重建后，stagger0、输入解锁，下一条wait成为event315/turn314，存档load成功；当前phase5的最小诊断也恢复正常（`patched-natural-lock.json`、`phase5-patched-lock.json`）。

### 版本对照小结

| 版本 | growth一次/两次收集 | combat中途硬直 | 共享空间守卫 |
| --- | --- | --- | --- |
| `e0fa39a`（foundation11） | 死亡来源首轮保留、第二轮删除 | timer0/stagger50，wait/update/tick均不能恢复 | 25过/1败 |
| `9c23d6c`（foundation11） | 原始自然录像command126/121 OOS | 真实D5前缀timer0/stagger20，档拒绝 | 受影响回归同一失败 |
| `5c34f50`（foundation12） | 同样最小复现 | 同样最小复现 | 25过/1败 |
| 临时补丁副本 | 一次/两次相同；原始录像全过 | 自然D5、最小诊断解锁，档可读；seed2铜须原用例通过 | 未修，不宣称关闭 |

## 补丁与回归草案

- `/private/tmp/giants2-acceptance/sdk-fixes.patch`：仅 `src/ext/runtime.ts` 与 `src/engine/Core/TimeCoordinator.ts`，可应用于 `e0fa39a`、当前 phase5 及交付候选；未写入任何分支。
- `/private/tmp/giants2-acceptance/sdk-regression.test.ts`：拟放 `src/test/giants2_sdk_acceptance.test.ts` 的两项真实 Runtime/Game 诊断回归，接纳时还须登记测试归属。
- `/private/tmp/giants2-acceptance/probe.mjs`：原始录像复演、D5命令前缀重建、三树最小诊断和零影响对照；参数为 `root kind label`，所有输出写同目录。

草案在基线上实际 **补丁前2失败，补丁后2通过**；最终不依赖giants测试helper的草案在当前phase5再次 **补丁前2失败/补丁后2通过**（`phase5-sdk-before.log` / `phase5-sdk-regression.log`）。候选加补丁后vue-tsc通过；5个窄回归文件116通过、2个原有skip，exit0/61.28s（`patch-regression.log`）。两个skip是`p2_3_objective_time.test.ts:358/413`早已退役的旧基线，不是本轮新增或缺CE跳过；包括真实延迟poison死亡来源与分成、parry/dodge、动画防御及客观时钟。临时候选额外运行原组合文件`-t 'growth|all seven naturally'`：6通过、10项仅未选择，exit0/92.61s（`patch-combinations.log`）；含两条原失败自然回放、provider/零奖励诊断和原seed2铜须完整生成/预留/save-load。上述结果只属于两个共享文件加补丁的临时树，不能登记成未修改dot候选全绿。

这是根因及修复方向的实验验证，不是已完成的底座发布；正式接纳需要审查延迟伤害 credit、原生/分阶段防御、动画与存读、命令确定性及受影响 trace，不能直接把旧版本完整长录像宣称兼容。

## 新巨兽只读审查

本次未确认 giants2 新增生产数据本身存在可独立成立的规则缺陷；已证实的真实故障为上面两个底座问题。检查范围及限度如下：

| 领域 | 只读审查 |
| --- | --- |
| 数据/校验 | 与任务包完整子包精确追加、原定义前缀和旧攻击profile保留；新4form/2template/1body/1transition使用已有正式校验/安装闭包。指纹 `sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8`；不改协议/版本、不冒充兼容旧指纹。 |
| 灯褶/展躯 | keep-zone不删格，local HP正额封顶后1:1传伤；破坏移动×4/3、wick×2和一次收据沿底座；phase HP≤42、200ticks、ratio、同ID/区域/history，新形态不带旧局部zone。无新AI/时钟/奖励路径。 |
| 铜须 | 核心4格+4个独立1格实体；四条直接tether，外围正HP限额1/4传伤，remove留槽墓碑；minSupportParts2且核心不提供support；仅核心调度、核心终结退休成员。数据与既有SDK合同一致。 |
| 自然生成 | D2–4、D5–8，priority10，每层一个成功侧室；新形态/limb无独立模板；未改概率/深度来适配路线。两条新固定自然trace在模块套件与drift通过；自然持久化首批7/8，原门限隔离后铜须剩余项通过。新形态/断须/终结关键切点hash未重录。 |
| 存读/回放 | 正式命令录制、坏manifest/空间闭包拒绝、存活破甲/展躯/失撑重访均有自有测试。铜须确认helper修正不改decisions断言；含growth的原始录像确有底座OOS，不能被独立giants通过掩盖。 |
| 零影响 | 共享源码/其他模块/共享trace无变更；追加内容只随giants启用安装。补充classic和extended空模块同seed20条wait，基线与候选完整机械快照（仅savedAt归零）均精确相同；双RNG等机械叶未剔除。UI只消费DisplayFrame，不增加实质随机调用。 |

配置手册如实说明两率0/零专属奖励、新旧指纹不兼容与既有SDK配置边界。新增内容没有图片资产，不适用像素精灵产线。UI组件测试不等于实际浏览器120格验收；dot的0/120仍是证据缺口，本轮未扩大到截图/真机矩阵。

## 最终裁决

**需底座修复后合入；当前不可直接合入。** 两个SDK缺陷均不是giants2引入，不能要求dot越白名单修共享代码，也不能把真实OOS/不可恢复输入锁移作“无影响”。临时补丁仅供维护者审查接纳，不在本分支落地。

合入前还须关闭两个独立事项：底座共享空间守卫的真实写入口违规；dot旧复合体D12自然路线前提失效的五项验证（重新选择可复现公开路线/种子，保留行为断言和原门限，记录单变量归因）。本轮没有调整该旧测试或新巨兽数值。

真实浏览器120格、真机、完整npm/test:ext、128子集、实际删除、完整CE/生成普查仍按任务包留5Z；本报告不把它们计为通过。合入当前phase5后须按实际合并差异做对应门禁，不能拿foundation11候选结果替代foundation12整合结果。


收口：仅新增本报告；未改任何dot源码/测试/基线，低风险giants内修复清单为空。未commit/push。`git diff --check`通过。报告保留原整批失败及各次独立复核结果，不累计重叠通过数。

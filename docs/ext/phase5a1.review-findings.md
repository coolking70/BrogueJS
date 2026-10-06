# 5A1 独立只读审阅（ext/phase5 工作树，HEAD 60a5435 + 未提交改动）

审阅方式：`git diff` + 阅读新文件；所有复现均在仓库外副本 `scratchpad/p5/`（rsync 复制源码、软链 node_modules、仅副本内登记 probe 测试）中用 `vitest --maxWorkers=1` 跑单文件，**未修改仓库任何文件**。注意审阅期间 Codex 仍在改 Game.ts（例如已加入 `verifiedReplayBoundary`/区间诊断），以下行号以审阅时为准。

## 高

### H1 普通“保存游戏”会覆盖/截断用户已保存的录像（静默数据丢失）
- 位置：`src/engine/Core/SaveStorage.ts` `saveSnapshot`（有 `recordingOrigin` 时 `writeRecording(stores, originRecording(origin))`）；`RecordingStorage.ts writeRecording` 先 `clear()` 三个 store 再写 key `'current'`；`App.vue saveReplay` 也写同一个 `'current'`。`Game.toSaveSnapshot` 在回放模式下（`else if (this.replayRecording && !this.replayError)`）把 `replayEvents.slice(0, replayCursor)` 作为 origin。
- 复现（probe `clobber.test.ts`，内存适配器）：保存 300 条录像 → 读取该录像回放、seek 到 10、保存游戏 → IDB 当前录像只剩 **10 条**，快照缓存被清空；另起一局 B（seed 999）存档 → 当前录像变成 **B 的 3 条**，原 seed 517 录像消失。v3 时代 `brogue-web-replay-v1` 与存档互不影响，这是回归。
- 修复方向：存档的来源前缀镜像与“用户保存的当前录像”分开命名空间（例如 recordings 中 `save-origin` 与 `current` 两个 key、chunk 键加前缀），或存档只写 checkpoint（origin 已在 world JSON 内）；回放中存档不得改写用户录像。合同 §10.2 “单一当前录像”的措辞需要维护者澄清，但不应以丢用户数据实现。

### H2 居民经原生路径离开其管理层后，存档“成功”但无法读回
- 位置：`src/ext/world5.ts validateWorld5` 居民检查要求 `context.actors.get(actorId) === levelRef.depth`（`world5SnapshotContext` 的 actors 只含各层 monsters/dormant，不含 pending）；`Game.toSnapshot` 只调 `assertWorldLevelOwnership`，**不跑 validateWorld5**；`monstersFall`（Game.ts ~10049）对居民无任何处理。
- 复现（probe `fall.test.ts`）：fixture 登记居民 → 给居民足够 HP、`falling=true` 后调用原生 `monstersFall()` → 居民进入 `pendingFallenByDepth[2]`；`toSaveSnapshot()` 正常返回；`loadSnapshot` 返回 false，提示“存档格式过旧或文件已损坏”。同理可推：死亡居民被盟友复活（purgatory）到别层后 `alive=false` 但实体活在别层，也会被拒。现有测试 `refuses a historical-dead resident claim while its native actor is pending...` 把这种形状当“坏档”，但游戏自己能产出它。
- 影响：5A1 中只有测试 fixture 能启用 world5，生产零影响；但这是 C5 “不变量在运行期维持、坏档在退休前拒绝”的契约缺口，5A2/5A3 有真实居民后即为“存档不可读”。
- 修复方向：居民离层（坠落/跟随/复活）要么在运行期被阻止，要么作为事务更新 world5（解绑/标记 displaced/停工）；`toSnapshot` 在写出前对 world5 跑与 load 相同的 `validateWorld5`（写出端与读入端同一谓词），失败即拒存而不是写出不可读档。补“居民原生坠落/复活”回归。

### H3 坠入**缓存中的**管理层的怪物被直接写入该层（越过结算），重访时还被跳过落位，停在上一层坐标（可能在墙里）
- 位置：`Game.monstersFall` 对 `this.levels.get(depth+1)` 存在的情形直接 `cached.monsters.push(m)`（及 `commitWholeBodyFall` 的 `cached!.monsters.push`），不经 pending 根；`GenerationCoordinator.generateDepth` 管理层路径 `frozenActors = new Set(ports.monsters.map(id))` 之后 `restoreLevelResidents(frozenActors)` 跳过这些怪物，`preplaced=true` 的新坠入者不会被 `restoreLevelResident` 重新放置。
- 复现（probe `fallin.test.ts`）：在 D2 登记管理层，回到 D1，令一只怪物在 D1 坠落 → 立即出现在 `levels.get(2).monsters`（pending[2] 为空，违反任务书 §2“玩家不在时坠入管理层的生物留在 pending 根，结算后才写入”与不变量 6）；再入 D2 结算后，该怪物 `preplaced` 仍为 true、坐标保持坠落前的值，probe 中所在格不可通行（墙）。
- 证据缺口：现有用例 `freezes departure routes...`（ext_world5_offline.test.ts:704）是手工 `pendingFallenByDepth.set(1, [m])`，而玩家在 D2，D1 在上方，原生坠落不可能落到 D1——走的是不可达路径，真实路径未覆盖。
- 修复方向：目标层为管理层时坠落一律进 pending 根（生物与整体身体组两条路径都改）；`frozenActors` 只冻结离场时已在层内的实体（离场时记录集合，或排除 `preplaced`）；补“从上一层真实坠入下方管理缓存层”的回归。

## 中

### M1 机械摘要依赖本地化文本：改一句译文就让所有录像失效；不同文本表之间录像互不认
- 位置：`RecordingDigest.mechanicalDigest` 的 knowledge 域含 `run.logger`（消息正文为 i18n 输出），native 域在不同语言下也不同（物品/名称类文本字段；`inventoryStamp` 还回落到 `i.name`）；`loadReplay` 先比 `initialDigest`。
- 复现（probe `lang*.test.ts`）：英文（headless 默认值）录制 5 条 → 中文环境 `loadReplay` 返回 false，“录像格式不受支持或已损坏”；初始摘要差异域为 `native, knowledge`。前 3 条英文、后 300 条中文录制，再回放 → `OOS at command 256: domain knowledge`。实现者在 x2i 测试里把切语言挪到新局之前，修的是测试而不是根因。
- 影响：生产固定 zh_CN，所以不是运行时切换问题；但任何对 `zh_CN.json`/模块 locale 文本的修订都会让旧录像在 initialDigest 处被当作“损坏”拒绝，或在第一个 chunk 边界 OOS；headless 工具（英文默认值）也无法验证浏览器录像。v3 不校验日志，这是新引入的脆弱性。
- 修复方向：持久知识按消息 key+参数（或消息 id/turn/count）入摘要，不纳入渲染文本；native 域排除显示名等派生文本；或者把 locale 资源指纹显式放入 header 并给出明确的“文本版本不同”拒绝原因，而不是“损坏”。需维护者裁定。

### M2 收据历史满 128 条即硬失败，导致管理层永久无法进入
- 位置：`WorldSettlement.commitOfflineSettlement`：追加后 `if (world.receipts.length > 128) throw C5_OVERFLOW`；去重依赖 `world.receipts.some(identity)`。`Game.settleManagedWorld` 把失败转成异常，入层事务整体回滚。
- 合同 §11（行 831/836）写的是“公开历史 128，ordinal 永不因滚动淘汰”“去重凭根的单调 ID/高水位……不依靠滚动历史”，即应滚动淘汰最旧收据。
- 影响：5A1 fixture 每个 ledger 只有一个事件、只产生 1 条收据，当前不可达；5A2/5A3 一旦有周期性事件，第 129 条收据之后每次入层都回滚——确定性软锁。
- 修复方向：按 ordinal/tick 淘汰最旧，幂等判定改用 ledger 的 `lastEventOrdinal` 高水位（已存在）而非历史扫描；补“超过 128 条收据仍可结算”的用例。

### M3 旧版本存档对用户不可见，拒绝原因永远显示不出来
- 位置：`SaveStorage.readSaveSummary` 返回 `summary?.schema === WHOLE_RUN_SCHEMA ? summary : null`；App 用它决定是否显示“继续”。
- 影响：v3 存档在 checkpoint store 中被保留（符合“不删”），但菜单直接没有“继续”，`save.format_invalid` 这条 i18n 原因永远走不到；用户下一次保存会静默覆盖它。任务书 §1 要求旧格式“在退休当前局前拒绝并给出 i18n 简洁原因”。（这个判断写法沿用了旧代码，但本批次是新一次格式升级，应当兑现原因提示。）同类：`brogue-web-replay-v1` 存在时每次启动都提示 `replay.legacy_ignored`，没有清除或导出旧 JSON 的途径（导出按钮现在只读 IDB）。
- 修复方向：summary 识别旧 schema 时返回一个“不兼容”状态，菜单显示原因（可选提供“删除旧存档”）；旧录像键提供一次性导出/忽略。

## 低

- L1 `Game.loadSnapshot`：`!!run.world5 !== !!extensions?.needsWorld5` 和 `validateWorld5(..., rulesFingerprint)` 失败两处直接 `return false`，不走 `refuse()`，没有 i18n 原因（同函数其他分支都有）。
- L2 `App.saveReplay` → `saveRecording` 把可丢弃的 ≤64 MiB 加速快照与事件放在同一事务；配额不足时整份录像保存失败，没有“去掉快照重试”的降级。
- L3 经典局逐事件新增两次 SHA-256（`chainDigest`、`inventoryStamp`），与任务书“经典局不得增加任何逐事件摘要成本”的字面要求不符；实测 P95 新增 0.052 ms 在门槛内，属于需维护者确认的偏差，不是功能缺陷。
- L4 `registerWorld5Fixture` 是 `src/ext/world5Fixture.ts` 的生产导出，任何模块工厂都能自注册获得 world5 能力；“仅测试”只靠约定，模块边界脚本没有强制。
- L5 `replaySeek` 无可用快照时走 seed 路径，`clearRecording()` 会清掉 `trustedSnapshots`（下次 seek 要重新从 seed 验证，只影响性能）；候选内抛出的异常会原样冒到 UI（当前局不受影响）。
- L6 测试缺口：
  - `ext_recording_v4_storage.test.ts` 的 v1→v2 升级用例里，`checkpoint` Map 根本没接到被测代码上，“保留 checkpoint 内容”这条断言恒真；生产 `saveDatabaseTransaction`（async action、abort、配额）没有任何 fake-IDB 覆盖（报告已列为浏览器未验证）。
  - H3 的坠落测试走不可达路径；没有居民离层（坠落/复活）的用例（H2）。
  - 没有“超过 128 条收据”的用例（M2）。

## 已核对、未发现问题的部分
- 时钟：`worldClock.validate` 在任何计时扣减前预检溢出，`advance` 紧随 bodies/actions、在客观块之前；动画 yield 恢复不会重复加；`advance` 只在 `soonestTurn>0` 时调用，不依赖 actions 端口；不用墙钟/RNG。
- 经典局零影响：普通局不创建 `world5`（`delete`，不留自有槽）；`reserveGenerationAllocator` 只在 world5 局额外调用；新端口在普通局返回 false/undefined；`displacementTrapDepressions` 改为可选后所有读写点都用了 `?.`。
- planner/offlineDraw/seedKey/canonical：没有 `Math.random`/`Date`/`localeCompare`，码点排序，拒绝 getter/稀疏数组/孤立代理对；提交用 jsonCheckpoint 整体回滚，Promise 一律拒绝并吞掉拒绝。
- 模块删除安全：foundation 只 import `src/ext/world5.ts`、`world5Fixture.ts`（都属 foundation），没有对任何可选模块的硬依赖。
- 旧格式拒绝：v3 录像、origin 1、whole-run v3、foundation 5 都在 `isValidRecording`/`isWholeRunSnapshot`/manifest 校验处、退休当前局之前被拒。
- IDB：v2 的 `onupgradeneeded` 只补缺失的 store；checkpoint 与录像前缀同一个 readwrite 事务；内存适配器下写入失败时原记录保留。
- 候选重放隔离：`withReplayCandidate` 恢复 rng/tick/实体与机关分配器/奖励房计数/ItemLoader/Logger（含呈现队列、观察者、反馈）/MachineObservation；构造候选用固定 seed，避免消耗全局随机。
- 录像链：保存/导出给末事件补的临时 full 在续录时被撤掉并重算尾链。随机游玩 3 个种子 × 400 条命令，每 9 条做一次“先导出再存档”（共 135 次），存档来源一次都没丢。
- 闪光后存档：第 256 条命令（chunk 边界）后产生 flare、tick 后存档，以及回放 seek 后再存档，来源都保留、存档可读，没有复现“呈现写知识导致来源不连续”。
- 维护者关于隐藏分歧的裁定：审阅期间工作树已改为报告“首个可验证分歧 + 前一已验证边界与区间”（`verifiedReplayBoundary`/`replayDiagnostic`）；seek 路径也会传递边界。

## probe 位置（仓库外）
`/private/tmp/claude-501/-Users-coolking70-Documents------BrogueJS/522f7155-3db2-4bc2-9d6e-c8d191c438ac/scratchpad/p5/src/probe/`：`clobber.test.ts`（H1）、`fall.test.ts`（H2）、`fallin.test.ts`（H3）、`lang.test.ts`/`lang2.test.ts`（M1）、`exportsave.test.ts`、`flare.test.ts`（未复现项）。

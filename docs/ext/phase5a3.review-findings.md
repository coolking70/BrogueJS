# 5A3 独立只读审查（ext/phase5 @ 56ad210 + 未提交 5A3 工作树）

审查方式：通读任务书/报告/合同相关节，逐文件读 `CellProperties.ts`、`StructureWorld.ts`、`StructureValidation.ts`、`structureSchema.ts` 与全部迁移 diff（Grid/DF/Promotion/Bolt/Movement/LoopMap/Game/ext），grep 剩余原始 `TERRAIN_FLAGS[...]`/`layers` 读者；在 `/private/tmp/p5a3r`（工作树副本，node_modules 逐项软链）跑复现测试 `src/test/zz_review_p5a3.test.ts`（为通过测试归属检查，在副本 `scripts/test-suites.json` 登记）。工作树未改动；`worldSdk.ts` SHA-256 = `e2f3cbbf…05f` 与报告一致，`src/ext/modules/crafting/**` 无 diff。

复现命令（副本内）：
```
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072
npx vitest run src/test/zz_review_p5a3.test.ts --maxWorkers=1 --reporter=verbose
```

---

## P1（应在 5A3 收口前修或给出维护者裁定）

### P1-1 有结构的层上，任何原生地形拓扑变化都逐格触发一次“全局重型事务”；R9 在原生循环中途执行而非“同一边界”

- 位置：`StructureWorld.ts` `bindWorldStructures` 内 `watchStructureTerrain` 回调（约 L340–370）；`transactStructureWorld`（L380–400）→ `Game.checkpointStructureWorld` → `checkpointCombatFactWorld`（Game.ts:455，深拷贝 player/全部生物/grid/全部缓存层/lightMap/world5/…）；`invalidateStructureWorld` → `bindWorldStructures`（**所有层**重绑、重建每层 2291 个 watcher、每层 `computeRooms`）→ `refreshStructureDerivedState`（loopMap、`rebuildWaypoints`、`updateVision`、`refreshVisibleEntities`）。
- 触发面：watcher 安装在有结构层的**每一格**；回调只要 `PASSABILITY|AUTO_DESCENT|LAVA|DEEP_WATER` 位变化（非结构格也算）就开事务；结构格地基失效时 `destroyComponent` 内部再调一次 `bindWorldStructures`。洪水陷阱/湖水涨退/熔岩/燃烧木桥变裂隙/DF_FLOOD 蒸发、以及重访层 `catchUpEnvironment` 的 50–100 次环境更新都会逐格命中。
- 复现（R3/R3b，单层、仅 1–3 个结构格）：30 次原生 `setTerrain`/`setTerrainLayer(LIQUID, WATER_DEEP)` 在结构层耗时 **1174 ms / 1195 ms（≈39 ms/格）**，`refreshStructureDerivedState` 调用 30 次；零结构层同操作 0.0 ms。8 个营地层时每格再加约 28 ms 全层房间重算与 8 层深拷贝，一次 100 格洪水即为数秒级单回合卡顿。
- 语义问题：R9 写的是“同一边界”提交地基失效；现实现是在原生 setter 的 `refreshTerrainProperties` 内同步执行——销毁部件、箱物品 `items.push` 落地、取消票据退款、写 RestPoint 收据、`rebuildWaypoints`（消耗 RNG）、`updateVision`（此时当前格 `isPassable/isOpaque` 尚未赋值，需靠回调里再递归 refresh 补救）都发生在原生 DF/晋升循环中途；若此事务抛错（见 P2-2 remains 满），异常从原生环境更新中抛出，整条命令失败。
- 修复方向：watcher 只登记 `dirtyCells(level)`，不开事务；在原生边界（`updateEnvironment` 末尾 / 单次 `spawnDungeonFeature` 返回后 / catch-up 每次迭代后）统一 `settleStructureFoundations(level)`：①有结构格变为非稳定 → 一次事务批量销毁；②仅拓扑变化 → 只标该层房间/路线缓存脏（房间读时懒算），`invalidateSpatialTerrain` 一次，派生刷新一次；不需要事务（纯派生、不会失败）。`bindWorldStructures` 改为按层增量（仅脏层重绑），watcher 不必每次重建。

### P1-2 结构根进入 world5 单叶摘要：满预算时**每条耗时命令**录像新增约 35 ms；报告的逐命令性能样本没有覆盖此路径

- 位置：`Game.recordingEventDigest`（Game.ts:3514）world5 域 token 含 `world5.revision`；`advanceWorldClock`（world5.ts:175）每次时间推进都 `revision+1`；`merkleDomain('world5', {root: world5, …})` 把整个 world5（含 3072 行/12288 部件结构）作为**一个叶**重算。
- 复现：R7——同一 harness，`wait` 命令 median/P95 **3.27/4.41 ms → 38.24/39.41 ms**（world5 加入 3072 行结构后）；R5：结构根 canonical JSON ≈1.2 MiB，`hashJson` 中位 31 ms；纯 JS `sha256` 实测 71.5 MiB/s（node crypto 2435 MiB/s）。
- 报告 §5 “八层满结构普通命令 P95 +0.029 ms”取自 `/private/tmp/phase5a3-evidence/perf-final.mjs` 的 2049 条 `escape` 命令——escape 不推进时间、不写 world5，dirty token 不变，因而测不到这条成本。火烧结构（每回合写 HP）、5C1 每条建造命令同样命中。
- 修复方向（二选一，需维护者确认）：(a) foundation 9 尚未冻结，趁此把 world5 域叶拆为 `root`（不含 structures）+ `structures.<depth>`（每层 ≤384 行，≈150 KiB）——摘要值随 foundation 9 一起变化，`sha256-c5-merkle-v1` 的“叶键表”属于 codec 内容，event/full 两侧同表即可；(b) 不改值：对 structures 子串做按 revision 缓存的 canonical 片段 + 流式/优化 SHA，仍需整串过 SHA（约 17 ms@71 MiB/s，优化后约 4–6 ms）。无论哪种，都要用**推进时间的命令**（wait/search/move）重测逐命令 P95，并单列“满结构 + 每回合 world5 写”档。

### P1-3 逃生检查把关闭的结构门当墙：玩家无法关上自己所在房间的门；任何关闭门都可能让后续阻挡施工全部被拒

- 位置：`StructureWorld.ts` `escapes`（L401–440，用 `cell.isPassable`，关闭结构门为 false）；`validate` door 分支 `if (!c.open) protectedCell(game, v.row.at, true)`。
- 复现（R1）：玩家 (20,10)，东侧建门并打开，再建 7 面墙围成 1 格房间（均成功），从内侧关门 → **`C5_PROTECTED`**。推论：玩家在一个只靠结构门出入的屋内时无法关门；屋门关闭时屋内玩家/居民的任何阻挡施工都会失败；5C1 居民进屋关门后，营地内的阻挡施工全被拒。
- R11 的“唯一逃生路线”针对玩家与居民；二者都能经命令开结构门（怪物不能，R7 只约束 AI）。
- 修复方向：`escapes` 的可通行谓词对“完好的结构门（开/关）”视为可通过（仍按原生对角规则，门格本身的 diagonal 阻挡照旧）；怪物 AI 仍按合成性质视为墙。需要补“屋内关门 / 门关着时屋内施工”测试。

---

## P2

### P2-1 营地撤销被区域内任何 interactable 永久阻塞（与是否属于营地无关）

- 位置：`validate` retire 分支（L489–500）`runtime.worldWorkEntities().some(e => e.depth === r.depth && regionContains(r, e))`；同处 `orders/tickets` 只按层匹配。
- 复现（R2）：把骨架/fixture 的生成期资源节点放到 (21,12)，`create` 9×9 营地（节点及其工作位全在界内，create 合法放行）→ 空营地 `retire` 得 **`C5_RESERVED`**，且节点不可移除，营地永久无法撤销。同理：`ensureRemains` 若把该层 remains 放进界内（见 P2-2，左上角优先扫描），营地也永远撤销不了；同层任何与营地无关的工作订单/票据也会阻塞。
- 修复方向：retire 只检查“营地关联”（`regionId` 的结构行、绑定部件的台/箱/RestPoint、该营地 RestPoint/箱、该 slot 的居民/离线账、引用营地设施的订单/票据）；或 create/expand 时拒绝界内的外来 interactable，并保证 remains 放在界外。

### P2-2 remains 托管容器选址与容量会“吞物”或在原生环境更新中抛错

- 位置：`remainsPosition`（L863）从 (1,1) 起全图扫描第一个 `clearWorldCell`；`destroyComponent` 中 `putContainer(remains)`，remains 容量 1024，满了 `fail('C5_CAPACITY')`。
- 问题：①位置与营地无关、不看可达/已探索——可能落在未探索区、孤岛、营地界内（P2-1）；②同层 16 箱 × 64 = 1024，正好等于 remains 容量；remains 不会自动清空，历史损毁积累后，下一次火烧/地基失效（在 `updateEnvironment`/原生 setter 内）抛 `C5_CAPACITY`，整条命令失败（无降级路径）。
- 修复方向：remains 选址从结构格做 BFS（已知、可达、界外优先）；环境路径（R8/R9）禁止因容量失败：退化为最近合法地面落地或 remains 扩容，保持“不吞物、不抛错”。

### P2-3 结构墙/关闭门不阻挡表面类 DF 扩散（燃烧药水、血、网等可穿墙）

- 位置：`bindStructureCell` 只加 `PASSABILITY|DIAGONAL|ITEMS|VISION|GAS`；`spawnMapDF` 的扩散判据只额外看 `structureBlocking().liquid`（DungeonFeature.ts:391），表面扩散仍读 `T_OBSTRUCTS_SURFACE_EFFECTS`（原生墙由 `T_OBSTRUCTS_EVERYTHING` 带此位）。
- 后果：向屋墙投燃烧药水，`DF_INCINERATION_POTION` 的表面火会经墙格扩散进屋；血/苔藓/网等同理。合同 §6 写“墙挡移动/视线/普通弹道/气液”，未提表面效果，但“墙外放火烧进屋内”与原生墙语义不符。
- 修复方向：在 `spawnMapDF` 的**传播**判据中，对结构移动阻挡格按 `T_OBSTRUCTS_SURFACE_EFFECTS` 处理（原点仍可落火，保留 R8 结构可燃）；补“墙外燃烧药水不入室”测试。需维护者确认语义。

### P2-4 房间重算：每次绑定重算全部 8 层，且单次提交重复多次

- 位置：`bindWorldStructures` 对每个有结构的层都 `rooms.set(grid, computeRooms(...))`；一次提交路径上 `destroyComponent` → bind、`invalidateStructureWorld` → bind、失败恢复再 bind；`computeRooms` 用字符串键 Set/Map、每格多次 `readCellProperties`（分配对象）、`structureDefinition()` 每次 `worldDefinitionPacks().flatMap().find()`；`Binding.roof()` 每次 `rooms.some(r => r.cells.some(...))` 线性扫描（`readCellProperties` 即使只要 `stableFloor` 也会调用两次）。
- 归类：报告的“8 层房间重算 28 ms”是**实现缺陷**而非 R14 的必要成本——R14 只要求“提交后该层全层重算”。
- 修复方向：按层脏标 + 读时懒算（`identifyRooms`/`usableRoof` 首次读取时算该层）；数值下标 `y*W+x`、`Uint8Array` seen；定义查表预编译为 `Map`；屋顶资格在 `computeRooms` 后写入每格布尔表供 `roof()` O(1) 读取。预计单层 <1 ms、提交路径只算 1 层。

### P2-5 完整 checkpoint 成本（含 5A2 遗留的 D8 每 256 条全量摘要 ≈1.13 s P95）——归类与设计

实测拆分（R6，单层真实快照）：`projectWholeRun` 4.5 ms、`JSON.stringify` 4.1 ms（1.9 MiB）、canonical 33.6 ms、纯 JS SHA 29.0 ms，`mechanicalDigest` 合计 75.5 ms；D8 约 8 倍 → 与 5A2 的 1.13 s 一致。归因：canonical（排序键、`c5Canonical`）≈45%，SHA（71 MiB/s 纯 JS）≈40%，`JSON.parse(JSON.stringify())` 深拷贝 ≈10%。

满结构额外 ≈192 ms P95 的归类：
1. 256 边界 world5 域单叶全量（≈31 ms，同 P1-2）；
2. 2048 边界在 `updateRecordedCheckpoint` 中**再次** `projectWholeRun` + `JSON.parse(JSON.stringify)` + `worldSnapshotHash(world)` 全量哈希——快照点把整份世界（含结构）多做一遍投影/克隆/哈希，2048 点代价约为 256 点的 2 倍；
3. `projectWholeRun` 的结构/引用校验（`validateStructureRoots` 字符串键排序检查 + `validateStructureReferences` 中对每部件 `containers.filter(... entities.some(...))` 的 O(部件×箱×实体)）。

建议设计（与 recording v4 契约一致：`digestChunk 256`、`checkpointPeriod 2048`、摘要值逐字节不变、仍是“全量重算”，诊断语义按 2026-10-06 裁定的区间 `(previousVerifiedBoundary, command]`）：

- **A. 冻结-离线计算（主线程只付投影+序列化）**：边界命令结束时同步做 `frozen = JSON.stringify(projectWholeRun())` 与 `inputState` 复制（≈8–9 ms/层；D8 ≈70 ms，可进一步只对活动层重投影）；把字符串交给专用 Worker（打包同一份 `mechanicalDigest` + SHA，浏览器内可用 SubtleCrypto）。Worker 返回 `fullCheckpoint`；同一 job 若是 2048 点，复用同一 `frozen` 计算 `snapshotDigest` 并产出 `world`（消除第 2 项的重复投影/哈希）。
- **惰性链**：`chainDigest` 依赖含 `fullCheckpoint` 的 payload，因此对边界事件之后的事件只存 payload，维护 `chainFrontier`；Worker 回来后顺序补算（每事件只是小哈希）。所有需要链/快照的消费者——保存、来源镜像、导出 JSON、写 IndexedDB 加速快照、seek、`trustedSnapshots`——先 `await recorder.flush()`；无 Worker 环境（Node 测试、headless）同步内联执行，结果相同。
- **分歧检查**：`event.checkpoint` 与 full 域的比对移入回调；不一致时记录 `divergence={command,domain,tick,player,fromCommand=prevVerified+1,toCommand=command}`，下一命令边界抛出并拒绝保存/续录——与裁定的区间诊断一致，不宣称精确首命令。
- **回放/seek**：流水线校验（≤1–2 个未决边界）；发现不一致即停止并按区间报告；加速快照只在其 checkpoint 已验证后进入 trusted 集合（现有语义）。
- **与值无关的纯加速（可先做）**：重写 `sha256` 热循环（去掉每块 `[...state]` 解构/`forEach` 闭包、增量流式更新、避免巨型字符串 + `TextEncoder` 整体拷贝），预期 3–5×；`mechanicalDigest` 用不变式投影代替 `JSON.parse(JSON.stringify)` 后再 delete；`projectWholeRun` 在录像路径跳过已在写入口保证的重复校验。
- 不建议在本格式内做“非活动层哈希缓存”：合同 §10.2 明写 chunk 边界“native、knowledge 全量重算”作为独立 oracle；若要缓存非活动层，需要新的叶布局（`level.<depth>` 叶）与维护者裁定。

---

## P3

1. **记忆外观不含结构**：`memoryTerrainAppearance` 只用 `rememberedLayers`；`cellAppearance` 仅可见格叠加 `structureAppearance`。离开视野后结构墙/门/窗显示成地板（`rememberedTerrainFlags` 是合成值，机械上正确，仅 UI 误导）。修：记忆时刻快照结构字形。
2. **魔法地图**（Game.ts:5531）以基础 DUNGEON|LIQUID 写 `rememberedTerrainFlags`：未探索的结构墙被记成可走地板，自动旅行会规划穿墙（可见后再重规划）。可视为“不泄露隐藏结构”的取舍，建议报告注明。
3. **粉碎术/隧道术**：`crystalizeFromPlayer` 读基础 DUNGEON 层，结构墙不受影响；隧道弹道撞结构墙会消耗预算后停止（无死循环）。即结构墙对二者等同 impregnable——需写入 5C1 交接或确认。
4. **region create 的不可见格反馈**：界内不可见格若有机器/楼梯返回 `C5_BLOCKED`、未见生物足迹跨界返回 `C5_PROTECTED`，否则成功——成功/失败本身泄露未见实体（R11 精神）。修：不可见格一律按“未知=阻挡”统一拒绝或只按已知投影判定。
5. **零结构热路径**：`terrainFlagsOfCell`/`refreshTerrainProperties` 每次 1–2 次 WeakMap 查找 + try/catch；报告实测寻路 0.389→0.406 ms、气体 1.52→1.63 ms（+4%/+7%，可能含噪声）。可加模块级 `boundCellCount===0` 快路完全跳过。
6. **`structureAppearance` 每帧每格** 调 `definition()`（`flatMap().find()` 分配）；绑定时预编译字形即可。
7. `CellProperties.cellLiquidBlocked` 在生产代码无调用（液体只走 `spawnMapDF` 的 `structureBlocking().liquid`），属死接口或清单遗漏，建议删除或接入并在附录 A 说明。
8. retire 对“同层任何订单/票据”一律 `C5_RESERVED`（见 P2-1），过宽。

---

## 已检查且未发现缺陷（checked-and-sound）

- **SDK/crafting**：`worldSdk.ts` 逐字节不变（SHA 与报告一致）；crafting 无 diff；`structures?/restPoints?` 缺省不归一，指纹仅在声明任一键时混入 `FOUNDATION_STRUCTURE_RULES`。
- **零结构恒等（静态）**：所有合成入口在无绑定时返回原基础值；`exposeTileToFire` 的结构分支仅在 `structureFlammable` 为真时改变点火概率/落火，零结构 RNG 序列不变；`spawnMapDF` 新判据在 `randPercent` 之前短路，零结构时恒真；watcher 仅装在有结构行的层；`hasOwnedRegions` 改动只在存在 region 时生效。与报告 UR2/3/4、drift、巨兽 trace、单变量反事实的证据一致。
- **读者清单完整性**：grep 剩余原始 `TERRAIN_FLAGS[...]`/`layers`/`terrainAllowsMove` 读者（Game.ts 5531/7808/9957/10307/10372/12197/12247/13344/13708、MonsterSidebar、FootprintExposure gas、AutoTravelVisibility、TerrainHealing、Gas.ts:431、DF 晋升目标）均为基础类型/作用目标读者或已先叠加 `structureBlocking`；FOV/LightMap 读合成后的 `isOpaque` 缓存；Scent/Waypoint/TerrainRules/MonsterBlink/怪物 AI 均经 `terrainFlagsOfCell`（已合成）；巨兽足迹/位姿/身体约束/轨迹改为 `composedCellFlags`；`check-structure-readers.mjs` 用 AST 钉住原始读者（含别名/解构/字符串索引），本副本运行 exit 0。
- **弹道**：物理（投掷/distance attack/毒镖/闪现）与魔法分别由定义裁定；闪现另尊重移动阻挡；隧道遇结构墙停止不循环。
- **门**：关闭门 = 墙性质、开启恢复基础；拓扑（房间）不随门开关变化；关门拒绝门格上有生物/物品/interactable/唯一工作位；怪物 AI 经合成 flags 视为墙（静态审查，未见开门路径）。
- **事务**：`transactStructureWorld` 以全对象图 checkpoint + 绑定/空间 revision/房间恢复；计划句柄 epoch/单次使用/CAS stamp 复验；拆卸返还公式 `floor(count*hp/maxHp/2)`、损伤抗性折算、HP≤0 同事务删除；箱损毁先近邻落地再 remains，票据取消退款一次（逻辑审查 + 报告失败注入测试）。
- **R8 公式** `max(1,floor(maxHp*(100-fire)/1000))` 与规则字符串一致，只对可燃部件；**R9** 判据 `stableFloor` 与建造保护同源。
- **region**：create 恰 9×9 且在内边界、expand 包含旧 bounds 且 ≤24×20、同层 1/全局 8/共享 128、最小空闲 slot、高水位不归零；最后撤销删 `regions` 键且 save/load 后仍无键（`ext_region_runtime_transactions` 已测）；生成期 region `revision:0`；schema 校验 camp 尺寸/slot 唯一/同层唯一。
- **房间**：四邻 flood、2…128、触边/不稳定格判开放、对角不连通、完整屋顶才有标签、炉需通风、会话 ID、只读 0 RNG。
- **RestPoint**：与 auto_rest 相同的 `everSeenMonsters=new Set()` 语义；每步一次 wait、`maxRestTicks/100` 上限；满血/伤害/移动/距离/威胁/扰动/目标毁坏停止；非命令路径只置 disturbed 不写收据；whole-run 校验 `remaining≤300`、读档校验 revision/ordinal/未写收据；不建 ticket/bundle，combat 篝火未改。
- **save/load/seek**：load 与 `catchUpEnvironment` 都重新 `bindWorldStructures`；`validateStructureReferences` 校验镜像坐标、槽位、门字段、设施绑定、camp 预算。
- **未验证**：模块移除矩阵（留 5Z）；CE 源码对照（报告已注明 DNS 失败）；封闭结构门后的怪物长时间追击运行时测试（我尝试的 R8 场景因视野/建造约束未构成有效封闭，未计结论）。

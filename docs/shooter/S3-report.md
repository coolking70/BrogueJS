# S3 实施与验收报告

日期：2026-10-05。分支：`product/shooter-prototype`。基线：`9db8ff6423e9438364f5a8c370c0c1312657e850`。

维护者已认可 S2 试玩手感并授权下一阶段。范围与使用说明见 [S3.md](S3.md)。

## 实施

独立 hordes 模块提供 200 个轻量感染者、8 个完整共享 CreatureBase 精英、1 个直径两格的连续圆形 Boss。流场按半径/目标格共享，局部避让和最终 sweep 共同处理拥挤移动；精英/Boss 使用真实 ActorActionScheduler 前摇、延迟释放、恢复与伤害硬直。增援槽位、队列与随机出生候选均确定性保存。

从原 Creature 提取完整纯状态/方法基类，并保留原生血液效果适配。属性覆盖守卫扩展到继承的 CreatureBase 声明，继续覆盖完整声明与实际自有字段；没有删除断言或跳过原生行为测试。实时角色显式使用局部 ID，九个完整角色不会触及原生全局分配器。

## 门禁

最终代码候选 SHA-256：`0cf37dfdd53b84f412807d7a1fa5d51df90b293db6ed56173df1a36f183cc691`。覆盖 `src/`、`scripts/`、package/lock、Vite 配置与 Shooter HTML 共 905 文件；按路径排序后对 `path\0sha256(bytes)\n` 再取 SHA-256。冻结后只补充本报告的实际结果，没有继续修改代码。

环境：Node 24.19.0，容器配额 8 vCPU / 8 GiB；长测试统一 `NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。下列成功结果均来自修复后的最终代码候选。

| 检查 | 实际结果 |
|---|---|
| `node scripts/check-module-boundaries.mjs` | 通过，exit 0 |
| `npx vue-tsc -b` | 通过，exit 0 |
| `npm run build` | 通过，exit 0；Vite 7.53 s，保留已有大 chunk 提示 |
| `git diff --check` | 通过 |
| 原生恢复、克隆、字段覆盖与 Horde 定向 | 10 文件、274 项通过；65.92 s；包含刚修复的 9 项原生失败用例 |
| 全部 `npm run test:ext` | 81 文件、1,552 项通过；0 失败 / skip / todo；555.58 s |
| 完整 `npm test` | 355 文件通过；6,500 passed、83 skipped、5 todo，0 failed；2,534.33 s |
| 正常树真实产品组合 | Game 16 引擎 + 16 构建浏览器；Shooter 4 引擎 + 4 构建浏览器，全部通过 |
| 完整冷加载与独立房间 | 打包后的整个 ShooterSession 在禁用 Date.now / performance.now / Math.random 后冷导入；两个房间各 210 Actor、交错 90 Tick、全局 ID 不变、重放全状态相同 |

完整套件按仓库既有机制保留 skip/todo（包括缺失 CE 参照的用例）；未新增 skip、宽泛 exclude 或隐藏已有 CE 缓存。完整命令为 `NODE_OPTIONS=--max-old-space-size=3072 npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=<仓库外路径>`，扩展套件同参数改为 `npm run test:ext --`。

正常组合均实际运行新局、输入、save/load、逐条 replay、seek 与存档续录；Shooter 构建 UI 还执行检查点、录像导入/导出及缺失模块拒绝。原生四个模块组合与实时两个模块组合分属各自产品入口，不把六个目录直接解释成 64 个同构产品组合。

生产构建输入对应同一代码候选；原始 dist 的 41 文件 SHA-256 为 `379cb619035d0bfbb9370550407ebfa7ce4a71ad8e7a3dc32f5f7aaac46c8caf`。发布快照仅将 Shooter HTML 同时用作根页面。

### 十分钟战斗与设备路径

`check-shooter-s3.mjs` 在 200 + 8 + 1 开局完成 18,000 Tick 战斗，四种武器共射击 1,042 次、击倒 783 个目标、累计出生 982 个敌人，9 个完整角色启动 121 个动作。结束时 190 普通 + 8 精英 + 1 Boss 存活，10 个槽位等待增援。该场景包含击杀、死亡、重生和补入，区别于下方始终保持 209 敌人存活的容量测试。

完整录像重放相同；30 / 60 / 144 FPS 外部驱动各推进 18,000 Tick，完整机械最终状态逐项一致、peak backlog 均为 0。Tick CPU 计入一次生产快照：p50 **8.75 ms**、p95 **15.68 ms**、p99 **18.69 ms**。这些是共享云环境实测，不代表所有终端的渲染性能。

构建页面在 1440×1100 和 390×844 下通过：键鼠、navigator 标准手柄轮询（模拟设备）、两根同时存在的 CDP 触点、移动射击、松开停止、换弹中存读档、完整重放、导入导出、失焦停止。页面错误为 0，无横向溢出。S3 实体手柄/手机的主观手感尚未认证。

### 真实墙钟容量测试

最终代码候选的 `check-shooter-s3-realtime.mjs` 通过：实际 **600.020 秒**，固定 **30 Hz / 18,000 Tick**，最低及结束时均为 **209 个存活敌人**，9 个完整高级角色；78,417 次 pump，**peak backlog 0、late pumps 0**。Tick CPU 包含生产快照，p50 **10.48 ms**、p95 **16.65 ms**、p99 **19.49 ms**。玩家正常移动、受击及重生（41 次），不开火；没有跳 Tick、降低频率或减少敌人。本次只保留正常树 2-worker 全套回归作为后台负载。

必须保留先前的失败记录：上一代码候选在同时运行多套删除/组合/浏览器验收时，一次十分钟运行出现过 1 次 pump 的 1 Tick backlog（p95 19.51 ms、p99 28.57 ms），严格零积压门禁因此失败。未改门槛，也不把该次失败算作通过；后来在较低后台负载下复测通过。原生恢复修复后，再对最终代码完整重跑十分钟，得到上面的最终数据。本结果不承诺任意主机负载下都不会出现瞬时积压。

### 实际删除

两份独立副本均实际移除完整目录，清理候选缓存，执行 boundary、vue-tsc、build、全部剩余 test:ext，以及所有剩余产品子集的引擎和构建浏览器 smoke；每道命令 exit 0。要求缺失模块的存档/录像均被拒绝。删除副本采用 removal 档，不重复完整 npm test。

| 实际保留目录 | 剩余扩展测试 | Game 引擎 / 浏览器 | Shooter 引擎 / 浏览器 |
|---|---|---|---|
| combat、firearms、giants、growth、narrative（删除 hordes） | 79 文件、1,540 项通过；580.78 s | 16 / 16 | 2 / 2 |
| 仅 hordes（删除其余五个目录） | 28 文件、506 项通过；181.44 s | 1 / 1 | 2 / 2 |

删除来源完整输入 hash（含当时的文档草稿）为 `380afa03ae9ba827ba27c4ea0832df6f124397bc65032e19fd3abfa4a965a0af`，执行前后相同。删除 hordes 后为 `ba61ab1347a66c2eef2694de866a89fa6487fa479fbc9096a054eebdd7eb67d7`；仅保留 hordes 后为 `526ab6f64f13c2975c61c9f8584962f4fa14be410f863b78ed8c9c3ccdf4ccaf`，各自检查前后也相同。后来只补写验收事实，因此文档 hash 与代码 hash 分开记录。

本轮只验证上述两种实际删除形态，不声称完成六模块全部 63 种删除子集。复现命令分别为 `check-module-removal.mjs --profile=removal --retain=combat,firearms,giants,growth,narrative --maxWorkers=2 --output=<新目录>` 和 `--retain=hordes`；浏览器路径由 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 提供。

## 已发现并修复的问题

- 第一轮精英攻击重放测试发现表现事件携带完整 pose 的 facing 字段；改为严格的 x/y 世界点，不放宽事件格式校验。
- 原生 Creature 静态导入血液/地形效果会触发全局 RNG 的墙钟初始化；提取共享完整基类，原生适配继续按原时序调用血液效果，实时路径保持纯净。
- 同一目标需要不同半径的通行场；大型身体不采用普通感染者可穿越的一格门路径。
- 处理避让后处于保守中心线通行图外、但实际圆体仍合法的位置，重新引向邻近可达格，避免在圆角附近停止。
- 枪械单模块集成用例显式选择 firearms，保持原测试的六敌人前提；跨模块联动在 Horde 测试与真实产品子集验收中验证。
- 最后增加恢复校验时，误要求麻痹状态必须存在 maxStatus 镜像；共享 Creature.applyStatus 实际只更新剩余时长。第一版扩展回归因此出现 2 项失败（1,550 项通过），未发布。修正为实际可达的状态合同，同时继续拒绝伪造的 maxStatus 字段；原定向用例和最终完整扩展套件通过。旧完整回归/战斗验收中止，按新冻结候选重新运行。
- 两份删除副本首次同时进行类型检查时触及 8 GiB 内存配额，均收到 SIGKILL；没有把它们记为通过。错开编译后，在同一代码候选重新执行完整 removal 流程，结果如上。

- 完整正常树回归随后揭示 5 文件、9 项原生读档/录像失败（6,491 通过、83 skip、5 todo）：快照和克隆通过 Object.create 绕过构造，原先只在构造时安装的血液 WeakMap 回调因此丢失。改为原生 Creature 原型方法分派，实时基类保留无副作用默认方法；原生构造、无构造恢复及克隆均使用相同行为。未改测试前提或断言，274 项受影响测试通过后重新冻结候选并重跑最终门禁。

## 范围与未认证项

S3 Boss 是有实际大半径碰撞/导航/枪械命中的单实体，不包含 Giants 部位/group。九个完整角色使用共享 CreatureBase 与实时 AI/调度器，不运行经典 Monster.takeTurn。普通感染者无完整 Creature 实例。

自动化手柄输入与 CDP 双指触屏不替代 S3 实体设备手感验收。沿用 S2 的设备操作，当前阶段没有任务结算、支援或联机。固定 authored 测试场不涉及程序地图生成，本轮不运行 drift；遵循扩展分支政策，不获取 CE 或运行 test:full/test:gen。没有合并 main 或打 tag。

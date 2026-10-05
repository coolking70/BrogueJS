# S5 实施与验收报告

基线：`24939bbcd51a8acca50ca53c805084cc53c54d7e`，分支 `product/shooter-prototype`。本轮新增战场支援并更新同一个私人试玩页，不合 main、不打 tag。设计和数值见 [S5](S5.md)。

## 改动

- 独立 support descriptor/data/state/运行规则/本地化/模块自有测试。
- 四种支援的确认坐标、到达、部署寿命、冷却、补给、有限炮塔弹药、轰炸伤害/环境互动与扫描。
- 产品增加通用 SupportHost；可选枪械 replenish 取消换弹但保留开火冷却。统一伤害权威与任务目标解锁保持。
- 产品支持四类 realtime provider 的任意子集；记录受控环境变化，严格恢复 Grid/contact 和只读 DTO 镜像。
- 三种输入、世界倒计时、危险预警、冷却栏与取消流程。支援选择期间抑制射击，Q/LB 跳过冷却类型。
- v6 存档/录像、Profile v5、support 1.0.0、firearms 1.2.0。旧 S4 不迁移。

## 验证

最终代码候选 R4：SHA-256 `12bdd8214043b50bc121f505957b785df640879890187ec5184b3b0d6c9b9a46`，覆盖 src、scripts、package/lock、Vite 配置及 Shooter HTML 共 938 文件；按路径排序，对每个文件取 bytes SHA-256，再对 `path\0sha256\n` 拼接取 SHA-256。冻结后只补写本报告，没有更改代码、测试、脚本或数据。

完整输入 hash（包含当时的报告占位稿）为 `7e24f128568cc788ec882eec9da8486d2d39ef7ea43ff935f69ff4687111b4bc`，2,318 文件。正常树、全部八目录的隔离扩展测试副本、两份删除来源均相同；测试前后未变。填写验收事实后的文档 hash 与代码 hash 分开处理。

环境为 Node 24.19.0、8 GiB；长门禁统一 `NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。正常 `npm test` 在原候选树执行；全部 `test:ext` 在保留全部八目录、逐字节相同的正常副本 `/tmp/brogue-removed-modules-j1CksV/candidate` 执行，隔离可写 TS/Vite 缓存。复制脚本的 `--prepare-only` 结果只记作 prepared-not-verified，不冒充已运行 full 档。下面的实际测试命令单独执行并取得 exit 0。

| 检查 | 最终结果 |
|---|---|
| 模块边界 | 通过，exit 0 |
| `npx vue-tsc -b` | 通过，exit 0 |
| `npm run build` | 通过，exit 0；Vite 9.20 s，保留既有大 chunk 提示 |
| `git diff --check` | 通过 |
| 开发定向支援、枪械与任务 | 5 文件、43 项通过；support 自有 2 文件、15 项亦通过 |
| 全部 `npm run test:ext -- --maxWorkers=2` | 85 文件通过；1,583 项通过；594.89 s；0 failed / skipped / todo |
| 完整 `npm test -- --maxWorkers=2` | 359 文件通过；6,531 passed、83 skipped、5 todo（总计 6,619）；2530.81 s；0 failed |
| 正常树真实组合 | Game 16 引擎 + 16 构建浏览器；Shooter 16 引擎 + 16 构建浏览器，全部通过 |
| 支援浏览器 | 1440×1100 与 390×844：键鼠/触屏选点、领取补给、取消、危险预警、标准手柄 LB/右杆/RB（模拟设备）、扫描、存档恢复、精确录像校验/导入，均通过；页面错误 0、无横向溢出 |
| 修复后本地化预检 | 4 文件、44 项通过；含 p1_30、u24 和支援自有测试 |
| 世界标注 | 两尺寸下支援标签不遮挡换弹条；同点炮塔/扫描标注不重叠，真实 DOM 矩形断言通过 |
| 已验收的读条和撤离 | 换弹与任务双读条、离区暂停、撤离抵达/离区暂停/重入继续、存档/录像精确恢复通过；登乘累计 177 Tick，离区 60 Tick 不清零，重入增加至 178 |
| 补给与旧版边界 | 实际开火冷却 8→7 Tick，补给没有清除；真实旧 S4 检查点被拒绝；恢复与录像精确一致 |

完整套件的 CE 缺失依赖 skip 与既有 todo 按仓库原机制保留，没有新增 skip、空壳替代、宽泛 exclude 或隐藏缓存。此次没有 CE 源码，不获取 CE，不运行 test:full/test:gen。地图变更是运行时清除 authored 火焰/毒气，没有程序生成改动，故不运行 drift。cgroup oom / oom_kill 计数相对执行前没有增加。

整局、cadence、补给冷却与累计撤离的补充原始证据来自相同机制冻结后的检查。R3 调整世界标注布局，R4 仅补充两个本地化有限词汇绑定并归档未使用键，运行机制与 UI 布局不再改变。必需门禁、两份真实删除和支援浏览器检查均在最终 R4 重跑；未将 R1/R2 中断任务或 R3 失败回归计为通过。

组合覆盖所有剩余产品子集的新局/实际输入、save/load、逐条 replay、seek/检查点恢复和继续录制，以及缺失模块的旧输入拒绝；构建 UI 另覆盖导入/导出。Game 的四模块与 Shooter 的四 provider 属于不同产品，不把八个目录解释成 256 种同构产品组合。

## 完整任务

默认 firearms/hordes/missions/support 使用真实移动、碰撞、枪械、支援、目标时长和累计登乘，未缩短计时或直接修改世界/补满资源。真实完成 19,733 Tick / 657.77 s（约 10:58）：击倒 574、死亡 1、造成伤害 26,410、承伤 221。支援呼叫分别为补给 8、炮塔 11、轰炸 15、扫描 17；成功登乘后结算 120 行动点数（其中击倒奖励 20）、0 样本，未完成可选救援。

整局检查点恢复与完整录像重放精确一致；30/60/144 FPS 外部驱动均在同一 19,733 Tick 终止，机械状态完全一致，peak backlog 0。该项为加速无头整局和外部时钟确定性检查，不冒充十分钟真实墙钟浏览器容量测试。

Tick CPU 包含生产快照：p50 / p95 / p99 = 1.690 / 3.252 / 6.905 ms（其他 CI 同时运行）。这不代表所有设备的渲染帧率；实体手柄/手机和主观平衡仍由维护者试玩。

## 物理删除

两份独立副本实际删去模块整个自有目录并清理缓存；分别运行 boundary、vue-tsc、build、全部剩余 test:ext、所有剩余子集的引擎及构建浏览器 smoke。全部门禁 exit 0；removal 档不重复完整 npm test，正常树完整回归单独完成。

| 实际保留目录 | 剩余扩展测试 | Game 引擎 / 浏览器 | Shooter 引擎 / 浏览器 |
|---|---|---|---|
| 仅 support（删除其他七目录） | 28 文件通过；509 项通过；203.05 s | 1 / 1 | 2 / 2 |
| 其余七目录（删除 support） | 83 文件通过；1,568 项通过；526.70 s | 16 / 16 | 8 / 8 |

仅 support 的删除后 hash 为 `0ee3a507f32178f0fbf6b6c6d86d744b458638161d34e5caf74709bf6bc14cb5`；移除 support 后为 `9d10c3d4a6b651bebdd175eb31f162c35bd7ab85a07f0f100b09085fc4874c6a`，各自门禁前后相同。只验证这两种删除形态，不声称完成八目录全部 255 种删除子集（含正常树共 256 行）。复现命令分别为 `node scripts/check-module-removal.mjs --profile=removal --retain=support --maxWorkers=2 --output=<新目录>` 与 `--retain=combat,firearms,giants,growth,hordes,missions,narrative`；设置可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。

## 构建与原始证据

生产 dist 39 文件，按相对 dist 的路径/文件 SHA-256 拼接取 hash：`8769bc8a640df23c1a6b2294f4f5054b422bcf2fbda2e188ddc71f244750abb5`。发布采用此冻结构建，将 shooter.html 同时用作根 index.html；其余 38 个构建文件逐字节相同。Site SOURCE.json 记录来源提交、代码和构建 hash。

原始证据均在仓库外 `/workspace/scratch/32419adc086d/`：`s5-localization-preflight-r4.log`、`s5-final-npm-test-r4.log`、`s5-final-test-ext-r4.log`、`s5-composition-final-r4.json`、`s5-removal-only-support-r4/`、`s5-removal-without-support-r4/`、`shooter-s5-browser-r4/`、`shooter-s5-progress-final/`、`shooter-s5-engine-final/`、`s5-full-mission-cadences.json`、`s5-resupply-cooldown-old-version.json`。不提交截图、完整录像或长日志。

## 发现与修复

定向开发检查发现两处测试布景问题：阻挡点同时超出八格范围，因此实际返回 range（修正为圈内墙体，断言保持 blocked）；第一轮浏览器检查启动时最终 build 尚未结束，旧产物缺少 camera scale 数据导致坐标 NaN。第二轮等待完整 build 后正常通过。组合浏览器检查另发现新增支援栏使切枪按钮点击时自动滚出战场，原射击坐标落在视口外（运行中 Tick 913、rifle 已选中、shots 0）；脚本改为切枪后滚回 canvas 再读取坐标。原 30 秒射击断言不变。中间候选的 normal npm/test:ext 与 without-support 删除检查主动中断（exit 130）。随后多支援同点的视觉检查确认世界标注会重叠/遮挡头顶读条，补充自动堆叠与头顶避让，并增加真实浏览器重叠断言。R2 的进行中门禁再中断，不计为最终通过；全部必要门禁统一在标签修正后的最终冻结候选执行。没有削弱既有断言、增加 skip 或调整旧超时。

R3 完整正常树回归实际为 358 文件通过、1 文件失败，6,529 passed / 2 failed / 83 skipped / 5 todo，2528.20 s；不能计为通过。开发阶段遗漏本地化定向预检，导致这两项问题直到完整回归才被发现。两项失败均来自本地化守卫：两个新增 DTO labelKey 调用点没有登记其有限模块词汇，另有一个未使用文本键。按既有 realtime module uiKeys 绑定方式，仅为这两个实际调用点登记 support descriptor 的有限词汇，不改扫描器、断言、跳过或命名空间规则；未使用键移入 legacy 归档。最终门禁随后在 R4 重新冻结和执行。

## 交付边界

支援首版为单人任务；炮塔未加入被攻击、实体阻挡或维修；没有长期账户、支援升级和多人服务器。S4 所有正常任务、换弹/任务读条和累计撤离继续保留。试玩感受、四种支援收益与冷却平衡需维护者验收。

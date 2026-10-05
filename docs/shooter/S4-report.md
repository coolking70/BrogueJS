# S4 实施与验收报告

2026-10-05。分支 `product/shooter-prototype`，基线 `67ce68199a9dba55d1a177d4e8fec5d3490ab76d`。维护者已试玩验收 S3 并授权进入 S4；规则、设施坐标与操作见 [S4.md](S4.md)。

## 实施

新增独立 `missions` 模块：版本化 Objective Graph、64×48 authored 场景、两站扫描、三个巢穴、通信上传、撤离呼叫/抵达/登乘，以及一个可选救援和两类 POI。默认组合为 firearms、hordes、missions，任务十五分钟限时、六次出击机会，成功或失败只结算一次。奖励是本局行动点数与携带样本，尚无永久账户。

底座提供 MissionRuntime 合同，产品统一组装三种实时 provider。模块仅通过只读玩家/目标状态和受控治疗/爆破端口访问世界，设施 HP 由唯一 DamageResolutionAuthority 提交；population 不得移动或复活设施。目标、地图、区域、计时、奖励与各阶段增援策略都由模块数据定义。缺少枪械时提供近距离、三秒爆破替代；缺少尸潮时任务仍完整运行。

离散交互和主动结束与枪械命令共用 Tick 入口和录像；三类设备共用规范化命令。新增任务 HUD、目标/POI 标记、区域进度、坐标、增援提示、结算卡和手机双杆之间的交互按钮。结算当 Tick 停止追赶循环，不再多推进世界。全部玩家文本走 i18n；动态设施标题/标签以安装模块 uiKeys 登记词汇，没有削弱原守卫断言。

存档与录像升级为 `broguejs-shooter-s4` / `broguejs-shooter-s4-replay` v5，Profile `shooter-s4`。状态、模块 manifest、数据指纹和 HUD 镜像交叉校验。S0–S3 格式明确拒绝，不迁移。

## 最终候选与门禁

最终代码候选 R2 SHA-256：`950ab5fa9564d24f76846d1fccaa3705cbf737a5a31fe6c29a143f3e96bc3230`。覆盖 src、scripts、package/lock、Vite 配置及 Shooter HTML 共 922 文件；按路径排序，对每个文件取 bytes SHA-256，再对 `path\0sha256\n` 拼接取 SHA-256。冻结后只填写文档事实，没有继续修改代码。

环境为 Node 24.19.0、8 vCPU / 8 GiB；长门禁使用 `NODE_OPTIONS=--max-old-space-size=3072` 和 `--maxWorkers=2`，编译错开运行。以下均为最终 R2 候选实际结果。

| 检查 | 结果 |
|---|---|
| 模块边界 | 通过，exit 0 |
| `npx vue-tsc -b` | 通过，exit 0 |
| `npm run build` | 通过，exit 0；Vite 8.06 s，保留既有大 chunk 提示 |
| `git diff --check` | 通过 |
| 最后一次结算修复定向 | 2 文件、15 项通过；包括 lives / timeout / aborted 三种同 Tick 目标归零失败结算 |
| 全部 `npm run test:ext` | 83 文件、1,567 项通过，0 failed / skip / todo；589.64 s |
| 完整 `npm test` | 357 文件通过；6,515 passed、83 skipped、5 todo，0 failed；2,555.56 s |
| 正常树真实产品组合 | Game 16 引擎 + 16 构建浏览器，Shooter 8 引擎 + 8 构建浏览器，全部通过 |
| 完整冷加载与独立房间 | 整个 ShooterSession 打包后禁用 Date.now / performance.now / Math.random 冷导入；两个房间各 213 Actor、初始 34 敌人和 9 个完整角色，交错 90 Tick，全局 ID 不变，重放全状态相同 |

完整套件按仓库现有机制保留 CE 缺失依赖的 skip 和既有 todo；未新增 skip、宽泛 exclude 或隐藏已有 CE 缓存。完整命令为 `NODE_OPTIONS=--max-old-space-size=3072 npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=<仓库外 JSON>`；扩展套件同参数改为 `npm run test:ext --`。

正常组合实际覆盖新局、输入、save/load、逐条 replay、seek/检查点恢复与续录、缺失模块拒绝；构建 UI 覆盖检查点与录像导入/导出。原生四模块与实时三模块属于不同产品，不将七个目录解释成 128 个同构产品组合。

生产 dist 共 39 文件，SHA-256 `3a725ef3ab1face722759d8a15c908840b7cc27fd01901a351407d2a9fa6aa8d`。发布使用这一构建快照，仅把 Shooter HTML 同时用作根页面。

## 完整行动与设备路径

真实移动/碰撞、枪械或受控爆破、真实时长目标、医疗与撤离，不缩短计时、不开无敌，也不在验收路径直接修改世界。

| 最终整局 | 完成时长 | 实际结果 | 本局奖励 |
|---|---|---|---|
| missions 单独启用，完成救援和两处样本 | 20,747 Tick / 691.57 s | 0 死亡，实际爆破三处巢穴、伤害 2,700 | 150 行动点数、8 样本 |
| 默认三模块主链 | 21,509 Tick / 716.97 s | 击倒 617、死亡 4、射击 3,690、伤害 31,465 / 承伤 595，成功登乘 | 120 行动点数、0 样本；未完成可选救援 |

两种整局均通过精确存档恢复和完整录像重放。30 / 60 / 144 FPS 外部驱动均到达同一个真实终止 Tick，全部机械状态一致，虚拟 cadence 的 peak backlog 均为 0。该项是确定性外部时钟检查，不冒充十分钟真实墙钟容量测试。

Tick CPU 包含一次生产快照：任务独立 p50 / p95 / p99 为 0.058 / 0.125 / 0.217 ms；默认战斗组合为 1.704 / 3.159 / 4.634 ms。共享云环境数据不能代表所有终端渲染性能。

构建页面在 1440×1100 和 390×844 下通过键盘 E、navigator 标准手柄 A 边沿（模拟设备）及真实触屏按钮点击、扫描继续、检查点、完整录像导出/校验/导入、成功奖励、主动结束失败、结算控件禁用和无横向溢出。页面错误为 0。自动化路径不替代 S4 实体手柄/手机的主观试玩验收；基础操作手感由维护者在 S3 验收。

## 实际删除

两份独立副本实际删除模块完整自有目录，只随所属目录删除该模块登记测试，清理 TS/Vite 缓存；每份执行 boundary、vue-tsc、build、全部剩余 test:ext、全部剩余产品子集的引擎和构建浏览器 smoke，以及要求缺失模块的存档/录像拒绝。采用 removal 档，不重复完整 npm test。

| 实际保留目录 | 剩余扩展测试 | Game 引擎 / 浏览器 | Shooter 引擎 / 浏览器 |
|---|---|---|---|
| combat、firearms、giants、growth、hordes、narrative（删除 missions） | 81 文件、1,552 项通过；588.54 s | 16 / 16 | 4 / 4 |
| 仅 missions（删除其余六目录） | 28 文件、509 项通过；164.77 s | 1 / 1 | 2 / 2 |

删除来源完整输入 hash（含当时文档草稿）为 `23139d9519cd3e8d6e2e23200b29dedced30308b5378346b4f040d79d1d9e370`，执行前后相同。删除 missions 后为 `760eea65ddb20502b1c523e7a3db49d4fcb08fcbcdfa65710cefc7b3014edfbc`；仅 missions 后为 `6dd0920b9f7c2c28d87506ec63260153b974d2ad243fd0b144b219ea15c5bbc6`，各自检查前后也相同。最后仅补写验收事实，文档 hash 与代码 hash 分开记录。

只验证上述两种真实删除形态，不声称完成七目录全部 127 种删除子集。复现使用 `node scripts/check-module-removal.mjs --profile=removal --retain=combat,firearms,giants,growth,hordes,narrative --maxWorkers=2 --output=<新目录>` 和 `--retain=missions`；设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 为可用 Chromium 路径。所有成功门禁 exit 0。

## 发现、修复与未完成候选

- 开发初稿将 S3 的 209 只全活压力场直接用于任务，六次机会在 1,244 Tick 消耗完。改为任务数据控制初始人口与阶段增援，完整 roster 和 9 个完整角色保留；关闭 missions 时 S3 压力场仍为 200 普通 + 8 精英 + 1 Boss。
- 初始撤离人口 64 普通 / 4 精英令登乘过度拥挤。按任务阶段调整为清巢后 24 / 1 / 1、撤离 32 / 2 / 1，增援每 45 Tick 最多 2；没有删已有活敌人、降频或更改验收断言。最终默认主链包含四次死亡并真实成功撤离。
- 无枪械爆破在重复交互时重置前摇；已启动的巢穴不再作为可再次启动的 nearby 项。验证 pilot 自身修复了死者碰撞尝试、重生后旧路点和区域避让问题；不以修改世界或补满生命替代实际医疗。
- 单元位置 fixture 起初没有同步 nearby 显示镜像，修正 fixture，保留镜像一致性断言。动态标题/设施标签在 i18n 守卫登记模块自有 uiKeys；两个既有 firearms 测试只把录像批次类型扩展为 ShooterCommand，断言未改。
- 收尾 R1 发现同一 Tick 战斗摧毁巢穴并发生最后死亡、超时或主动结束时，任务先失败而未同步目标图，终态读档会被拒绝。将真实目标 HP 的完成同步放在失败优先级检查之前，新增三种终止条件的存档恢复测试，形成最终 R2。R1 的完整回归和第一份删除流程被主动中止（exit 130），不是通过证据；R1 已通过的部分也没有冒充 R2。最终门禁按 R2 重新执行。

## 范围

本阶段仅交付 Mission；Support、Operation、长期成长与多人未实现。新任务是 authored 地图，不改变程序地图生成，故本轮不运行 drift；遵循扩展分支当前政策，不获取 CE、不运行 test:full/test:gen。不合并 main、不打 tag。S3 十分钟 209 敌人真实墙钟容量结果仍是历史证据，本轮没有把它重标为 S4 新验证。

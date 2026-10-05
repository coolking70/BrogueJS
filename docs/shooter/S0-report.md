# S0 实施与验证报告

日期：2026-10-05。基线：`6f71e0e3c639bb7df5f599923c30ecd84fa7cd48`。产品格式：`shooter-s0` v1，30 Hz。

## 实施结果

已实现独立实时 Driver、同步 SimulationHost、生产 ActorActionScheduler 的 Tick 适配、隔离的 RNG 实例、逐 Tick 输入、专有检查点和录像，以及独立 Pixi 诊断页面。使用方法与接口合同见 [S0 开发说明](S0.md)。

共享引擎的唯一已有实现调整是拆分 `Random.ts`：Random 类原样移至 `RandomSource.ts`，原路径仍导出同一个 API 并实例化原 singleton。抽取前后类实现逐字相同（仅文件路径注释不同）。Shooter 冷导入不再触发原 singleton 的墙钟种子初始化。没有修改已有 Game 状态字段、ActorActionScheduler、TimeCoordinator 或玩法模块。

## 验证范围

- 新增三份测试文件，共 28 项；连同已有 Random、ActorActionScheduler 的定向回归，共 55 项通过。
- 600 秒模拟时间，共 18,000 Tick：headless 与 30/60/144 FPS 驱动后的完整机械状态和 RNG 相同，三种稳定帧率的峰值积压均为 0。
- 抖动/800 ms 停顿场景保留全部待执行 Tick，补算后与 headless 相同；过载没有通过丢 Tick 隐藏。
- 验证暂停时间不入机械时钟、分数 credit 与既有积压保留、重复/非法输入拒绝、动作按第 6/9/12 Tick 准时结算、成员过滤和稳定 owner 顺序。
- 验证动作各阶段的精确存读档、以恢复点为录像起点的续录、录像最终完整状态比较、输入篡改、头版本/产品不匹配与损坏 timer mirror 拒绝。
- 冷 Node bundle 在禁用 `Date.now()`、无 DOM 的环境中完成导入和第一 Tick；双 Session 交错运行不改原全局 RNG。
- 构建产物在 Chromium 桌面 1440×1000、手机视口 390×844 验证：真实 rAF 推进、暂停、单步、保存/恢复、重放验证、录像下载与上传恢复；页面错误为 0，无横向溢出。已目视核对两张最终截图。手机为浏览器模拟，不是实机。

## 性能样本

场景仅为两个静止诊断角色，Node 24.19.0，3 GiB 堆，Tick 包含 Host 快照发布。

| 指标 | 本轮最终样本 |
|---|---:|
| p50 Tick CPU | 0.01910 ms |
| p95 Tick CPU | 0.05101 ms |
| p99 Tick CPU | 0.09372 ms |
| 600 秒录像 JSON | 1,070,287 bytes |

这些数据不能推导出尸潮或原 Game 整个世界的实时性能。十分钟指模拟时长，不是浏览器连续真实运行十分钟。

## 仓库门禁

以下为修复后同一代码候选的最终结果。长测试使用 Node 24.19.0、3 GiB 堆与最多 2 个 worker。

| 门禁 | 最终结果 |
|---|---|
| `npm run check:modules` | 通过，退出 0 |
| `npx vue-tsc -b` | 通过，退出 0 |
| `npm run build` | 通过，退出 0；原入口仍有既有大 chunk 提示 |
| 新增测试及 Random / ActorActionScheduler 定向回归 | 5 文件、55 项通过 |
| 文本、i18n、仓库卫生与测试清单门禁 | 4 文件、37 项通过 |
| `npm run test:ext -- --maxWorkers=2` | 77 文件、1,510 项通过；507.99 秒，退出 0 |
| `npm test -- --maxWorkers=2` | 348 文件全部通过；6,423 passed、83 skipped、5 todo；2,470.10 秒，退出 0 |
| 真实 Game 模块组合 smoke | 16 组 headless 与相同 16 组构建产物浏览器全部通过 |
| S0 验收脚本 | 18,000 Tick、30/60/144 FPS 状态等价及桌面/手机视口交互全部通过 |

模块组合覆盖 combat、giants、growth、narrative 的全部子集，检查存读档、录像 seek、续行和缺失模块拒绝。完整套件的 skipped / todo 保持仓库现行机制，未将它们计入通过数；未获取 CE 参考源码。

上述门禁完成后复核代码候选摘要一致（src、scripts、package/lock、Vite、shooter.html；排除报告与截图）：`e9727d6ba377548fb96e5f88a6edc45612dcff80cebe3ff34e213b70b3546076`。

## 修复记录与界限

首次定向时钟测试错误地在 33,334 μs 后又提供 33,333 μs，触发预期的时间倒退拒绝；修正测试输入顺序，未改变时钟断言。

首次完整套件发现 Shooter 页面 `t` 别名未被现有 i18n 扫描器识别。生产页面改用项目既有 `useTranslation()`，动作阶段改为显式翻译键；原扫描器及断言不变。相关文本/源码门禁 4 文件、37 项已通过。首次完整运行的失败与修复后最终完整运行分别报告，不用定向结果冒充完整全绿。

首轮完整 `npm test -- --maxWorkers=2` 退出 1：346 文件通过、2 文件失败；6,421 项通过、2 项失败、83 skipped、5 todo，耗时 2,488.40 秒。失败均为本节列出的 i18n 引用扫描和 `/private/tmp` 缺失。

目视检查发现 Pixi `arc` 路径从原点连到圆环，已加显式 `moveTo`，在最终构建重新检查。浏览器下载源返回损坏包，改用独立临时 Chromium 153 环境；安装字体后中文显示正常，未把浏览器或字体依赖加入产品仓库。

首轮完整运行另有 `phase4b_pose_pathing` 报告落盘失败：既有测试硬编码 `/private/tmp/p4b-pose-performance.json`，Linux 缺少父目录，报 ENOENT。补齐测试环境的 `/private/tmp` 后，原文件 14 项单 worker 复核全过；没有修改寻路实现、门限或断言。此目录同样是两份既有 phase4a1 性能报告的输出前提。

没有地图生成改动，未运行 drift；按扩展分支现行政策未运行 CE 的 `ce:fetch`、`test:full`、`test:gen`。本次没有增删或改造玩法模块，没有声称执行物理模块删除矩阵。

**交付边界：S0 实时运行时诊断原型，待维护者验收。** 整个 Game 的环境/AI、Growth/Narrative/Giants 实时化、连续移动、枪械、尸潮、任务、支援和联机均未实现。没有合并主线、打 tag 或部署公开试玩。

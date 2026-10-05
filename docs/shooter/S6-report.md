# S6 实施与验收

## 交付内容

以开发分支 `product/shooter-prototype` 的 S5 `5a1ef1a0e643a96ee35d7e2aa98b9535488f2bc7` 为基线；它与维护者已验收的本地 S5 `6640d5880b628fe5214e10b78b7bceb73d420077` 具有同一 Git tree `caa04930dccad8e143838029f9bfb487b9fce063`。S5 已经通过连接的 GitHub 接口推送，本轮没有合并 main、强推或修改原始 RFC。

本阶段实现三场连续任务的本地行动、三个区域入口、三档难度、出战配装、枪械解锁、支援解锁与冷却升级、持久奖励、失败保留已结算资源和刷新后继续出战。三场使用独立 seed 与原布局/水平镜像/垂直镜像，保持现有主目标链，不宣称新增三种任务类型。操作和数值见 [S6.md](S6.md)。

新增 `operations`、`meta-progression` 独立扩展，各自拥有数据、规则 fingerprint、命名空间、状态、词汇与测试。通用战略接口位于 Simulation；产品 `CampaignSession` 负责跨模块组装、事务和出战 ticket。机械世界只接收固定的 `BattleSetup`，模块收到独立冻结副本，不能修改内部配装。战略界面不推进机械时钟，账号状态不进入战斗 tick。单局训练和录像导入不发永久资源。

## 最终候选与环境

最终候选 R2：

| 对象 | SHA-256 |
|---|---|
| 代码、测试、脚本与构建入口，共 958 文件 | `2817bf36b59a7c61508ae9aa092d191e4de15943136455c29ca2e10e3dad3b6a` |
| 门禁开始前的完整输入，包含当时的文档占位稿 | `fbe4514dd5976a6c86911a2aa92384b22f1df35194ad23bf8be14cc6f3eac8ba` |
| 最终生产 dist，共 39 文件 | `fa77ae50b3e1391cadcfb79712f878ff787cf852f6f70be6da6b91ccb734c5cd` |

以上内容先冻结，再执行最终门禁；本报告随后填写实际事实，文档变动不改变代码、测试、脚本和生产 dist 的 hash。扩展套件在保留全部 10 个扩展的逐文件相同副本运行，完整常规套件在原工作树运行。删除检查由现有 helper 创建独立副本并真实移除目录和目录内测试，依赖缓存独立。原始日志、截图、检查点与逐文件证据均位于仓库外，没有提交大型验收产物。

Node `v24.19.0`，8 GiB 内存限制；长套件使用 `NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。浏览器使用环境保留的 Chromium `153.0.8010.0`，通过现有脚本启动；没有另行下载浏览器。没有降低测试断言、添加 skip/exclude、缩小完整常规套件或修改 CE/reference 门禁。原生 Brogue 生成器没有改变，因此依最新扩展交付策略未执行 CE 下载、`test:full`、`test:gen` 或原生生成 drift；Shooter 布局变换另行覆盖。

## 常规门禁

| 检查 | 实际结果 |
|---|---|
| 模块边界与测试归属 | 通过 |
| `vue-tsc -b` | 通过 |
| `npm run build` | 通过，Vite 6.95 秒；既有大 chunk 提示仍存在 |
| 全部 `npm run test:ext -- --maxWorkers=2` | 87 文件、1,590 项通过，560.91 秒，无失败、skip 或 todo |
| 完整 `npm test -- --maxWorkers=2` | 362 文件通过；6,543 passed、83 skipped、5 todo（总计 6,631），2542.11 秒，exit 0，无失败 |
| 正常组合 | Game 16 引擎 / 16 浏览器，Shooter 16 引擎 / 16 浏览器，战略 4 引擎 / 4 浏览器，全部通过 |

组合验收使用真实 Game、Shooter 和战略 session，不使用空壳替身。覆盖新开局、存档/恢复、回放/seek、继续录制及缺少必需模块时拒绝恢复；战略 manifest 与战斗 manifest 分开。浏览器使用构建产物和正式 checkpoint，不新增测试注入入口。

## 物理删除副本

| 实际删除形态 | 剩余扩展套件 | Game 引擎 / 浏览器 | Shooter 引擎 / 浏览器 | 战略引擎 / 浏览器 |
|---|---|---|---|---|
| 仅 operations | 27 文件、498 项通过；158.62s | 1 / 1 | 1 / 1 | 2 / 2 |
| 仅 meta-progression | 27 文件、497 项通过；161.54s | 1 / 1 | 1 / 1 | 2 / 2 |
| 删除 operations、meta-progression，保留其余八包 | 85 文件、1,583 项通过；510.32s | 16 / 16 | 16 / 16 | 1 / 1 |

- 仅 operations：删除后 hash `580183b4dfbcded150ad11c259de44fc6c2dd323a521bff2fac3e38890bbd0aa`，门禁前后一致。boundaries 3.68s（exit 0）、typecheck 18.85s（exit 0）、build 25.93s（exit 0）、extension-tests 159.30s（exit 0）、composition-smoke 15.48s（exit 0）。
- 仅 meta-progression：删除后 hash `137714c6f4577205f6cc5730e8b2c724f18d2f9d1c440145ca04d08f3f86e655`，门禁前后一致。boundaries 3.25s（exit 0）、typecheck 18.08s（exit 0）、build 23.30s（exit 0）、extension-tests 162.22s（exit 0）、composition-smoke 15.67s（exit 0）。
- 删除 operations、meta-progression，保留其余八包：删除后 hash `d019e64d21462d4da48f6cdde5a3433c28fcaa07dcd872bd6aac505f039bb2f8`，门禁前后一致。boundaries 4.18s（exit 0）、typecheck 21.42s（exit 0）、build 29.82s（exit 0）、extension-tests 511.01s（exit 0）、composition-smoke 340.48s（exit 0）。

各行均执行边界、类型、生产构建、保留扩展套件及其全部安装子集的真实引擎/构建后浏览器组合检查。删除副本不重复完整常规 `npm test`；上面的正常工作树完整门禁是最终候选的独立结果。本轮执行上述三个代表删除形态，没有宣称穷举 10 包的 1,024 个目录组合。各副本删除前及原树结束时 hash 与冻结输入一致。

## 行动、成长和战斗验收

`check-shooter-s6.mjs` 最终结果通过：

| 完整行动中的场次 | 布局 | seed | 实际机械 Tick | 本场奖励 |
|---|---|---:|---:|---|
| 1 | 原布局 | 1014405279 | 21,316 | 150 点数、8 样本 |
| 2 | 水平镜像 | 1014337224 | 21,384 | 150 点数、8 样本 |
| 3 | 垂直镜像 | 1014283317 | 21,317 | 150 点数、8 样本 |

该三场链启用枪械/任务/支援、不启用 hordes，使用真实移动、枪械和计时完成主线、救援与资源目标，每场逐一验证精确恢复/回放、唯一结算。第一场后购买炮塔并升级补给，第二场后购买霰弹枪并换装；最终账号 440 点数、27 样本、已完成行动 1、已解锁突击，说明购买消耗、本场收入和第三场奖励确实连接。

另以默认四个战斗模块、初始配装完成一整场任务：20,175 Tick（672.5 秒机械时间）、547 击杀、0 死亡，结局成功且精确恢复/回放。所有 3 布局 × 3 难度组合各运行 30 Tick，实际初始出战机会为 6/5/4、群体数量 32/40/48，保存/回放一致。这不等同于九个组合都跑完任务，也不等同于实际等待十分钟的浏览器容量测试。

浏览器在 1440×1100 和 390×844 两种 viewport 完成购买与账号持久化、出战检查点恢复、隐藏未解锁槽位、失败保留、三次结算、刷新不重复奖励、下一难度解锁；均无横向溢出或浏览器错误。浏览器三场结算使用上面由真实引擎产生的终局检查点，不宣称三场全程在 UI 中手动打完。

## 已验收反馈与支援回归

头顶进度回归最终通过：九个真实引擎检查点，覆盖换弹与区域读条同时出现、键盘换弹、窗口改变、离开区域暂停、撤离到达、登船暂停/恢复和完成后隐藏读条。登船已累计 177 Tick，圈外 60 Tick 保留累计进度；恢复进入继续累计，并验证精确保存/回放。此前累计撤离改善保留。

S5 支援回归最终通过：四战斗模块完成任务 19,733 Tick（657.7667 秒机械时间），574 击杀、1 死亡，四类支援分别调用 8/11/15/17 次；奖励 120 点数，精确恢复/回放。双 viewport 覆盖键盘/触摸选择、地面目标、补给拾取、取消、危险预警、扫描、标签避开换弹/重叠排列、检查点与录像导出/导入，无溢出或错误。标准手柄通过脚本模拟验证，没有宣称真实手机或实体手柄人工验收。

该支援任务在并行 CI 负载下每 tick CPU p50/p95/p99 为 1.734/3.331/7.871 毫秒，仅代表该机器和该路线的样本，不作为设备性能保证。

## 候选修订记录

R1 的组合、扩展和产品回归已通过，但复核发现模块配装接口持有内部对象的可写别名；中止当时运行中的完整常规套件和首个删除副本，两者不计入最终通过结果。R2 改为深只读类型、独立冻结对象/数组，并补充尝试写入/修改数组、修改外部输入以及恢复一致性的测试。随后重新冻结，重新执行本报告列出的全部最终门禁；未继续修改功能或测试。前置定位套件为 11 文件、102 项通过，最终完整套件覆盖最终断言。

## 存档和试玩交付

Profile `shooter-s6` v6；机械 snapshot/replay v7；战略 `broguejs-campaign-s6` v1。账号、行动、出战绑定和机械检查点以一个 JSON 原子写入，战斗每 300 Tick（10 秒）自动保存，并在终局/手动保存时写入。刷新可继续当前出战，最多回退到最近检查点。旧 S0–S5 存档不迁移，进度限同一浏览器和站点；样本当前只积累，没有消费项。多人、云同步和服务器战略层属于后续阶段。

沿用原试玩 Site：`https://broguejs-shooter-s2.coolking.chatgpt.site`，保留现有仅拥有者访问配置。发布使用上述已验证生产 dist，将 `shooter.html` 同时作为 `index.html`；源码仍在 BrogueJS 开发分支，Site 的 `SOURCE.json` 记录实际 GitHub 提交、代码与构建 hash。具体发布成功状态以 Sites 的终态和本轮最终交付消息为准。

## 原始证据与复现

仓库外证据根目录 `/workspace/scratch/32419adc086d/`：`s6-code-frozen-r2.json`、`s6-build-frozen-r2.json`、`s6-normal-copy-r2/`、`s6-boundary-final-r2.log`、`s6-typecheck-final-r2.log`、`s6-build-final-r2.log`、`s6-final-test-ext-r2.log`、`s6-final-npm-test-r2.log`、`s6-composition-final-r2.json`、三份 `s6-removal-*-r2/`、`shooter-s6-final-r2/`、`shooter-s6-progress-regression-r2/`、`shooter-s6-support-regression-r2/`。删除结果逐门禁保存真实命令、起止时间、退出码与 before/after hash；正常套件日志保存计数、耗时及默认 CE 跳过说明。边界和独立类型命令没有另外采集计时；构建时间为 Vite 实际报告。

删除复现使用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<可用 Chromium>` 与上述 Node/堆/worker 配置，运行 `node scripts/check-module-removal.mjs --profile=removal --retain=<保留目录列表> --maxWorkers=2 --output=<仓库外新目录>`。三次 retain 分别为 `operations`、`meta-progression`、`combat,firearms,giants,growth,hordes,missions,narrative,support`。每次 output 使用新目录，保留先前证据；不采用 prepare-only 或 engine-only 冒充完整删除验收。

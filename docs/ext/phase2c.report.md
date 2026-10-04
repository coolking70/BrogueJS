# 2c 剧情事件与可选奖励报告

## 范围与状态

从已验收2b基线 `5af90ce126496a831c0706eb622271e6b1c38f2d` 在 `ext/foundation` 实施2c。只包含剧情事实/效果/日志/收据与可选growth XP；不改地图生成，不加入物品、地形、阵营、传送等重世界效果，不开始2d，不合并main、不打tag、不部署。

底座foundation=3，manifest.schema=1；narrative module/rules=1.2.0、state=3、input=2；growth module/rules=1.5.0。旧版本严格拒绝，不做存档迁移。模块仍只依赖底座；真实删除时自有测试随模块目录移除，余下清单不放宽。

## 实现与提交边界

- `ext/types.ts/runtime.ts/registry.ts/descriptor.ts`：可选奖励协议、纯预检、唯一provider、同步受控提交、全局单调fact ID、待消费入层事实及持久校验。没有订阅者时不排剧情队列、不分配事实ID。
- `Game.ts`：在录制origin前明确结算初始化已就绪的剧情；有创建步骤的组合保留队列，在最后创建命令同一事务内排空。ext命令内包含最终扩展资源结算，之后才能生成最终checkpoint。没有新增Game实例字段。
- narrative `effects/commit/sessions/placement/module/state`：安全放置与剧情消费分开；完整因果链先纯计划，稳定顺序提交意图，再写日志/flags/receipts与事实序号。可预期后续效果失败在任何provider写入前拒绝；提交期异常则由底座恢复各模块、受控资源、世界对象、队列和序号并丢弃缓冲消息。
- growth `module.ts`：共享纯XP计划与受控提交；自己持有报价/数额/原因/原生资源重算及发行者+奖励+实例去重。`growth.public-character.v1`仅给玩家四个公开字段；无growth不调用，不导入另一模块实现。
- 缺provider / story关闭 / 无报价分别持久记 `absent` / `disabled` / `unsupported-key`；不报错、不滞后一命令、不在后续补发。`ready`仅为预检，只有provider成功提交才记 `applied`（reason=null）。默认growth仍关闭story，不虚构XP奖励。

原子性是上述扩展/资源写集的合同，不是任意原生动作、地图或物品的全Game事务。受控原生动作自身异常仍沿既有录制失效策略处理；不回卷其未完整回滚的原生实体分配器。奖励provider不能取RNG或走重世界端口。纯剧情提交/结算失败可恢复双流RNG；不声称回卷已推进原生动作的完整世界。

## 测试覆盖与前提调整

新增基础事实/能力事务测试、narrative奖励事务测试、growth可选奖励测试均登记所属清单；`scripts/test-suites.json`登记底座新增文件，模块测试通过既有自有清单进入同一发现器。

专项覆盖四种可选结果、合法报价同checkpoint到账、receipt去重与skip不补发、坏DTO/异步/越权能力、后续效果预检失败、provider写后抛错、最终结算失败、消息与资源/RNG/全局ID回滚、第一次入层等待创建、反向注册顺序、重复checkpoint，以及真实Game的save/load/逐事件replay/seek/续录。growth真实组合通过catalog发现narrative，测试不硬导入另一模块；物理删除后只执行仍存在的适用组合。

旧测试仅调整明确版本、新增storyFact钩子、放置与事实拆分后的fixture及receipt格式前提；原功能/边界/确定性断言保留。未重录黄金trace或生成基线。

开发期结果单列：早期narrative专项因放置分离后未推进revision出现14项失败，修复放置revision后原会话/实际Game专项28项通过；纯内核/schema108项通过。新奖励测试的3项初始fixture假设失败已修正，15项通过；growth新测试15项与原相关38项通过。开发期类型错误为过渡API、ES目标不支持`.at`及底座fixture版本。剧情消费从generation移到最终settle后，原normal缓存测试的直接换层helper缺少该边界导致1项保存拒绝；补显式结算后14项runtime测试通过，未改产品保存守卫。完整开发ext曾61文件/1186项通过，但早于最后审查修复，最终检查另列，不把开发局部绿灯当最终通过。

## 独立审查

两名只读审查者分别检查事务/事实/叙事边界与成长计划/收据。发现并修复：

- 通用事务原先回卷实体分配器，但受控原生动作创建的实体并未完整回滚，会复用ID。移除通用allocator回卷，仅生成事务保留自身放置回滚；原生动作发生后也不回卷其RNG/因果账本。审查者原探针复测确认存活ID不冲突。
- 已就绪快照可伪造待消费的未来入层事实。读取时基于候选自身持久状态校验初始化状态，拒绝已就绪队列；合法未初始化origin仍可读取。另校验候选世界/录像checkpoint的深度和turn，错误输入在退休旧局前拒绝。审查者原探针与合法初始化正例复测通过。
- growth历史故事receipt只验非空文字。现要求发行者/已声明报价/实例三个合法ID，pending还须匹配同一报价的数额和原因；不强制发行者仍安装或story开关开启。补畸形存读拒绝与独立原生strength整数边界。复审未发现剩余阻塞。

真实growth+narrative矩阵覆盖对话奖励；首次入层奖励与创建的完整Game保存/录像流程使用基础测试provider，二者不是同一个真实双模块首次入层配置。当前`storyFact`只有narrative消费并预留root+derived范围；未来多个消费模块共享根事实时须另定派生ID分配协议，未声称已经实现。

## 最终门禁

第一冻结树：2026-10-04 03:38:48 UTC，2058份输入，hash `4ff939264cc7e00b2ecfd6b1f2abab2843144b2b9e452c0ed289efc87e44b5bc`。vue-tsc 26.35s、exit2，Game新增录像队列边界检查未先收窄可选event.turn类型。改为显式拒绝缺失turn；未改校验意图。其余门禁及完整npm test均未启动。

第二冻结树于2026-10-04 03:41:16–04:34:42 UTC完成全部引擎门禁；Node24.19.0、3072MiB堆、2workers，全程串行。2058份输入的hash `7a72755dc6ad0eaac2b11790bd8b0133f1f3a7b0cbde041c005ac396aae75314` 在每项前后及整个删除矩阵前后均相同。

| 树 | 命令 | 实际结果 | 秒 | exit |
|---|---|---|---:|---:|
| 正常 | `npx vue-tsc -b` | pass | 21.52 | 0 |
| 正常 | `npm run build` | pass；既有large-chunk warning | 26.45 | 0 |
| 正常 | `node scripts/check-module-boundaries.mjs` | pass | 4.19 | 0 |
| 正常 | `npm run test:ext -- --maxWorkers=2` | 62文件；1204 passed，0 skip/todo/fail | 257.22 | 0 |
| 正常 | `npm test -- --maxWorkers=2` | 307文件；5623 passed，8历史skip，5历史todo，0 fail | 2156.18 | 0 |
| 正常 | `node scripts/check-module-composition-smoke.mjs --output=<normal-smoke.json> --engine-only` | 四子集pass | 6.61 | 0 |
| 删除副本 | `node scripts/check-module-removal.mjs --profile=removal --maxWorkers=2 --engine-only --output=<removal>` | 三真实删除行pass；不重复完整npm test | 734.54 | 0 |

删除副本各自运行boundary、`node node_modules/vue-tsc/bin/vue-tsc.js -b`、`npm run build`、全部剩余`npm run test:ext -- --maxWorkers=2`及带`--removed-modules`的engine-only组合smoke，全部exit0：

| 实际删除 | 删除文件/自有测试 | 剩余ext原文摘要 | boundary/type/build/ext/smoke秒 | 剩余子集 |
|---|---:|---|---|---:|
| narrative | 31 / 6 | `Test Files 56 passed (56)`；`Tests 1034 passed (1034)` | 3.46 / 17.41 / 27.88 / 234.83 / 6.97 | 2 |
| growth | 61 / 31 | `Test Files 31 passed (31)`；`Tests 638 passed (638)` | 3.44 / 16.43 / 29.52 / 172.22 / 4.31 | 2 |
| 两者 | 92 / 37 | `Test Files 25 passed (25)`；`Tests 477 passed (477)` | 3.20 / 15.87 / 26.51 / 166.55 / 3.68 | 1 |

删除行0 skip/todo/fail。未保留空壳、未放宽余下测试清单，完整npm test仅正常树运行一次。副本删除后及门禁结束的输入hash各自相同：保留growth=`b6c439c5d95e79084364c58d9cc4a8c5faa97784204bbb04e5181d94473dd3f8`；保留narrative=`acd90173827af92e3d80bfd54add651b0f35d2613bc718ea7fcf88f9a4c74c3f`；空集=`f27c9f598374c55d4866423c04797e296f8861f79f759376b6deb8070fcbf1fe`。

正常四子集及删除后的2/2/1子集共9组，全部验证真实Game新局、原生命令、save/load、逐事件checkpoint与双RNG、seek、续录及缺模块输入拒绝。没有CE fetch/full/gen前置；保留已有4.9MiB CE缓存，正常npm test按原机制运行。`test:drift`不适用且未运行：只调整Game扩展提交边界，未改Generator、GenerationCoordinator或地图/地形写入，不重录基线/黄金trace。

最终摘要文档在门禁后补充结果，不冒称在这些新增结果文字上重跑完整测试。除此之外生产/测试/配置字节保持冻结；1428份非Markdown输入hash为 `409bfb54bf38572b095fa83bb026866f45e04fa26ded33e13b6f99538ea6fb4b`。原始命令、逐文件hash、真实退出码与副本记录保留仓库外 `cloud-extension-evidence/phase2c/final-candidate2/`；第一失败冻结树独立保留。

## UI与交付限制

本次未改UI、布局、输入处理、对白文案或内容流，复用2b临时bar既有公开剧情日志；数据定义仅升级版本。2c因此不另跑像素/交互浏览器QA，四种奖励结果与持久/录像由真实引擎集成验证。正常runner状态为`passed-engine-browser-not-run`，删除脚本状态为`partial-browser-not-verified`；没有把它们改写为browser passed。本候选真实浏览器、真实触摸和持续held流程未重测，不沿用2b截图冒称新候选已实测。

2d获准后必须核对并复用main `dc0b78b` 的DialogService/DialogHost/DialogInput及blur修复`26ad9c4`。当前Input.ts自定义物理释放屏障必须移除或统一到DialogInput，不长期保留两套机制；本轮不实施。

交付提供精确commit/tree/input hash与verified git bundle供既有Mac轻量publisher；具体不可自引用的commit/tree与bundle size/SHA在交付摘要登记。云端不重试已知缺GitHub认证的push；远程发布另行验证。大原始日志、截图、删除副本和构建归档保留仓库外，不提交。

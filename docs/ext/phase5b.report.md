# 5B crafting 执行报告

## 1 结论

生产实现已冻结并完成本次可执行收尾；结论为**部分完成**。仅启用 crafting 的 normal 自然公开命令闭环已完成：D1 采集、镐、桌、炉、皮甲、床/箱套件，携桌套件至 D2 采矿、放桌、匕首。因 SDK-02/03 的 UI/投影合同缺口、共享门禁失败、删除行执行中断及浏览器环境阻断，本交付按“部分完成、完整闭环可玩”报告，不宣称全部验收通过。

## 2 基线与环境

- 从 `origin/ext/phase5b-base` 建独立 clone 和 `ext/phase5b`，没有合并/rebase；旧工作区保持不变。
- 实际派发基线：`1ce8f7683b8e47f42a6baf7cbc84837f7ca4204a`。初始 `git status --short` 为空。
- `git diff --stat 2d870a2..HEAD` 初始恰为 `docs/ext/phase5b.dot-package.md`（208行差异）和 `scripts/check-module-composition-smoke.mjs`（91行差异），总计 183 insertions、116 deletions。
- Node `v24.19.0`；所有运行使用 `NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。没有安装新依赖、修改锁文件。
- 四项冻结 SHA-256 全匹配：worldSdk `e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f`；worldHarness `0cc14ecd4cf734591616b291239b3ef23b99e451af6f954a3de6de3f3143ba26`；craftingSkeleton/index `f4d70fd3b9be75444f181448ced4005c20d546c0cff7ce11eef366bb4a1a5372`；worldWorkBasic `a0267454f15f1b3c90649ab1a4945ddf1e055d40dc0072e776ab74265ca61ee1`。
- 最终代码/测试提交：`881a28296d32dc2667b5814f2a625d1f334bb5b3`；最终文档提交即本报告所在 `ext/phase5b` tip，完整SHA由交付摘要/Git历史给出（报告不能包含自身提交哈希）。

### 2.1 发布路径与提交映射

标准 `git push origin HEAD:refs/heads/ext/phase5b` 因本环境没有 HTTPS 用户名凭据而退出128；没有读取/创建凭据。随后使用已有 GitHub 连接器 push 权限重建五个逻辑提交，只发布 `ext/phase5b`。对象 API 不保留本地作者时间戳，因此提交 SHA 改变；前四个提交的 tree SHA 均与已测试本地提交完全相同，最终报告提交也按同树核验。原始本地历史保存在工作区外部 bundle；不 merge/rebase，不推其他分支或 tag。

| 逻辑提交 | 本地 SHA | 发布 SHA | 相同 tree SHA |
| --- | --- | --- | --- |
| 1 | `070bdb21eb704e1058e5d17b388644b9ef070feb` | `ceaf620c2254cc83f94d08bd5bd47ada825fe6be` | `ce069b227ccb8c5f4e1bd6caa47fccc659ad1e63` |
| 2 | `89634e9bbe478af7ad71a08cbf459e84ba97fb98` | `0cf479edb7bdf213ebaaf44e05eaf5c52a710d63` | `89054ee1955da4a0a61050d98f6ae43e313997b3` |
| 3 | `ad5458a652994c173eb376fc28cb7f941a0dc572` | `ca11dc05ecdbc56b5bfc1ddeb7ea49f5759b2c15` | `742342f18b9e40d0846ca1a8aa5283f83839e40b` |
| 4 | `48d43db7b17bcec3abcd15e45ca13b946ba5290c` | `881a28296d32dc2667b5814f2a625d1f334bb5b3` | `13e4eedf33a1b1ee8b768dc1ec1da3392c7af7c4` |

第五个逻辑提交仅补充本报告及发布映射；其最终 SHA 由交付摘要和本报告所在分支历史给出。发布后 fetch 校验远端 tip、精确 tree、单父链、39文件白名单及冻结输入哈希；本地分支仅在 tree 相同后对齐远端提交，没有合并或重放代码。

## 3 交付清单

所有改动仅在 `src/ext/modules/crafting/**`、`docs/ext/crafting-config.md`、本报告。共享 SDK、引擎、UI、脚本、配置、其他模块、其他 trace 均不改。

39 个新增文件；`git diff --stat 1ce8f76..HEAD`：总计 8320 行新增、0删除。其中38个代码/测试/手册文件8050行，本报告另计；以下列表即全部白名单变更：

```text
src/ext/modules/crafting/commands.ts
src/ext/modules/crafting/data/definitions.json
src/ext/modules/crafting/data/natural-trace.json
src/ext/modules/crafting/definitions.ts
src/ext/modules/crafting/descriptor.ts
src/ext/modules/crafting/index.ts
src/ext/modules/crafting/locales/zh_CN.json
src/ext/modules/crafting/module.ts
src/ext/modules/crafting/schema.ts
src/ext/modules/crafting/state.ts
src/ext/modules/crafting/test-suites.json
src/ext/modules/crafting/tests/crafting_combinations.test.ts
src/ext/modules/crafting/tests/crafting_commands.test.ts
src/ext/modules/crafting/tests/crafting_config_examples.test.ts
src/ext/modules/crafting/tests/crafting_data_tables.test.ts
src/ext/modules/crafting/tests/crafting_module.test.ts
src/ext/modules/crafting/tests/crafting_persistence.test.ts
src/ext/modules/crafting/tests/crafting_placement.test.ts
src/ext/modules/crafting/tests/crafting_projection.test.ts
src/ext/modules/crafting/tests/crafting_regen.test.ts
src/ext/modules/crafting/tests/crafting_rejections.test.ts
src/ext/modules/crafting/tests/crafting_runtime.test.ts
src/ext/modules/crafting/tests/crafting_schema.test.ts
src/ext/modules/crafting/tests/crafting_trace.test.ts
src/ext/modules/crafting/tests/crafting_ui.test.ts
src/ext/modules/crafting/tests/crafting_work.test.ts
src/ext/modules/crafting/tests/runtimeHelpers.ts
src/ext/modules/crafting/tests/traceHelpers.ts
src/ext/modules/crafting/types.ts
src/ext/modules/crafting/ui/CraftingEntry.vue
src/ext/modules/crafting/ui/CraftingPanel.vue
src/ext/modules/crafting/ui/CraftingWorkHud.vue
src/ext/modules/crafting/ui/commands.ts
src/ext/modules/crafting/ui/descriptor.ts
src/ext/modules/crafting/ui/useCraftingUi.ts
src/ext/modules/crafting/ui/view.ts
src/ext/modules/crafting/view.ts
docs/ext/crafting-config.md
docs/ext/phase5b.report.md
```

## 4 版本与身份

- module `crafting` / module version `1.0.0` / rules schema `1` / rules version `1.0.0`
- rules 指纹 `sha256:fc1b8d11b7faf918331cf58895f135e11e67d397b5c88d1a08c5b2b679597fe1`
- state schema `1`；四种 payload `v:1`；descriptor `worldSdk:1`；foundation 引用 `FOUNDATION_PROTOCOL`（基线为7）
- `defaultEnabled:false`；locale 不计入机械指纹；数组顺序、glyph/color、limits 均计入

## 5 数据一致性

任务书 §5.2–5.8 所有 ID、数字、tags、ItemAmount 顺序逐项保持，由 `crafting_data_tables.test.ts` 的独立黄金表校验。12物品、5节点、2实体工位、7配方；无 crafting 食物/菌类定义。

原生外观：匕首 `)` / `#CCCCCC`，皮甲 `]` / `#888888`，来自 `src/engine/Items/ItemLoader.ts:1317,1389` 的原生模板装配；实际显示 `src/engine/UI/Appearance.ts:483–484` 读取 item.char/item.color。T2 静态提取这些构造常量核对，不为检查外观消费 RNG。

## 6 SDK 差异与问题清单

本节区分已按实际基线适配的差异与仍须底座支持的缺口，不通过本模块修补共享实现。

### SDK-01：模块栏命令 ID 格式

- 条款：任务书 §7.2 指定 `crafting.open`
- 实际：`src/ext/ui/useModuleUi.ts` 的贡献校验要求命令 ID 以 `crafting:` 开头，否则拒绝整会话
- 复现：让 crafting 的 command ID 使用 `crafting.open`，调用公共 useModuleUi 刷新
- 影响/处理：按 §12.2-1 使用 `crafting:open`，显示、命令 payload、模块 ID 不变
- 建议本地修订：任务书统一使用共享 UI 接受的命名空间格式

### SDK-02：精确拒绝原因没有只读 UI 出口

- 条款：§7.2 拒绝后显示该错误码对应 i18n 文本
- 实际：worldSdk 的只读接口与固定 §7.1 DTO 没有“最后一次世界工作错误”；引擎 `worldWorkLastError` 在不允许的生产导入范围内
- 复现：陈旧 inventoryStamp 的公开命令返回 `C5_STALE`（harness 可读）；UI 只见未变化的投影与录制事件
- 影响：投影已知原因用具体文案；提交被拒的未知原因用任务书允许的 `ui.rejected`，不向玩家展示码/field
- 建议本地修订：提供受支持只读 command result/error UI 出口；不在模块复制引擎错误判断

### SDK-03：固定投影不含箱清单

- 条款：§12.1-8 “有箱时可选”来源/目标
- 实际：WorkContext 有 containers，但 §7.1 固定投影无 containers；共享 UI 读不到 WorldWorkReadSDK
- 复现：crafting+c5fixture 局的 harness WorkContext 看得到容量16箱，固定 crafting DTO 只有节点/工位/配方/放置/历史
- 影响：命令构造器保留可选 container ID/revision，公开命令支持箱；面板默认 null，不能展示真实箱选项
- 建议本地修订：明确扩充投影 DTO、容器来源预览及其调用预算，或公开带选择参数的只读 UI SDK；这是本任务书固定投影与“有箱可选”要求之间的合同缺口，不能误读成 worldSdk 完全没有容器能力

### SDK-04：combat 活跃 bundle 的输入前置门禁

- 条款：T13 要求 combat 动作存活时公开 craft 返回 `C5_BUSY`
- 实际：真实 player phased action 存活时，`Game.executeCommand` 的 `isInputLocked` 在世界命令 prepare 前直接拒绝输入；harness 返回 `{recorded:false,error:null}`
- 最小复现：启用 crafting+combat，用测试布景 `preparePhasedAttackCommand`/`commitPhasedAttackCommand` 开始 `fixture.slash` 并确认真实 bundle 存活，再用有效 make-pick payload 调用 `h.ext('crafting','craft',payload)`
- 影响：玩家确实不能在动作中开始制造，但该输入不录制、也不会得到 `C5_BUSY`；与任务书测试期望不同
- 处理：按 §12.2-5 将不成立的失败断言移出交付套件，保留独立复现证据；没有 skip/todo、没有改前置门禁
- 建议本地修订：明确已锁定玩家输入的错误/录制合同，或让共享命令层公开统一忙碌结果

### SDK-05：非安全整数 payload 在 SDK 前分派错误

- 条款：§6.3/T10 坏 batchCount 应为 `C5_BAD_PAYLOAD`，录制且零成本
- 实际：`WorldWork.isWorldWorkCommand` 的严格 `commandEnvelope` 先拒非安全整数，Game 随后误入普通扩展 commands 路径；crafting 没有普通 commands，抛 `Unknown extension command`
- 最小复现：`createWorldHarness({seed:51020001,modules:['crafting']})` 后发送有效 make-table-kit payload，仅将 batchCount 改为 `1.5` 或 `9007199254740992`
- 影响：模块 prepare 的严格校验可拒这些值，但公开路由先于它退出；整数0、17、MAX_SAFE_INTEGER 的公开拒绝仍正常
- 处理：保留 prepare 单元拒绝覆盖，将两条不成立的公开期望移至问题证据，不 skip/todo、不改引擎
- 建议本地修订：按 module/action 识别世界命令，再在世界错误路径验证 payload，避免回落普通命令抛异常

无共享代码修补。

## 7 门禁结果表

统一 Node24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。秒数取命令外层计时；中断项没有退出码、没有完整通过数。未运行不等于通过。

### 7.1 开发期 M1–M6

按组件并行完成，再做同树共同复核，不虚构六次重复执行。组件专项：M1 schema/data/config 227项（后加identity wrapper回归纳入总回归）；M2 module/commands 137项；T6投影4项；T7–T12共76项；T14 UI252项；T13组合8项；T15 trace3项。各专项exit0，0skip/todo；重叠集合不能相加。

| 实际命令 | exit | passed/skipped/todo/failed | 秒 |
| --- | ---: | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 0 | 所有权/导入通过 | 5.882 |
| `npx vue-tsc -b` | 0 | 类型通过 | 35.239 |
| `npm run build` | 0 | 构建通过；既有大chunk提示 | 49.480 |
| `npx vitest run src/ext/modules/crafting/tests --maxWorkers=2` | 0 | 708/0/0/0，15文件 | 308.119 |
| 下列6个受影响既有文件定向 | 1 | 45/0/0/1，6文件 | 5.987 |
| 同6文件＋`crafting_ui.test.ts`修正后复核 | 0 | 298/0/0/0，7文件 | 8.067 |

受影响集合：`src/test/{ext_module_boundaries,ext_module_ui,ext_module_creation_ui,test_suite_membership,repo_hygiene,u24_hardcoded_text}.test.ts`；均经 `npx vitest run <逐项文件> --maxWorkers=2`。首轮失败是新增紧凑入口的装饰“匠”字违反既有模板i18n守卫；删除冗余装饰，只保留翻译标签，正式模块栏glyph仍是任务书的匠。没有改守卫。最终§7.2及UI复核均使用这次修正后的生产树。

初期并行新增测试尚未登记导致一次boundary失败，以及测试编写期类型/断言错误均已修正；保留原始日志，不冒称首跑全绿。独立审查补上身份wrapper变更检测、真实provider事务回滚、公开楼梯重试和移除安全性后才冻结。

### 7.2 正常树 §9.2 收尾

| 实际命令 | exit | passed/skipped/todo/failed 或结果 | 秒 |
| --- | ---: | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 0 | 通过 | 5.513 |
| `npx vue-tsc -b` | 0 | 通过 | 33.182 |
| `npm run build` | 0 | 通过 | 44.530 |
| `npm run test:ext -- --maxWorkers=2` | 1 | 3819/0/0/30；175文件通过、13文件失败，共188 | 5781.029 |
| `npm run test:drift -- --maxWorkers=2` | 1 | 7/0/0/1；4文件通过、1失败，共5 | 228.639 |
| `node scripts/check-module-composition-smoke.mjs --output <外部证据>/smoke-engine.json --engine-only` | 0 | 32/32引擎子集通过；浏览器未运行 | 937.927 |
| 两行物理删除及补充smoke | 见§9 | 部分完成，不能称两行全过 | 见§9 |
| 24行浏览器矩阵 | — | blocked，见§10 | — |

`test:ext` 中 crafting 自有15文件/708项全部通过。完整ext只执行一次；完整drift也只执行一次。drift唯一失败为未改 `giants_spine_trace.test.ts` 原60秒门限超时（实际61.221秒），没有黄金差异断言失败；crafting三项trace在本次drift内通过。

32子集smoke第一次启动后执行会话丢失，没有结果JSON/退出码，记为中断未完成；验证冻结输入一致后仅重启这一未完成门禁，得到上表完整结果。没有重跑已完成ext/drift。

### 7.3 共享失败逐类归因（30项）

| 类型 | 数量 | 具体来源/结果 |
| --- | ---: | --- |
| 原期限超时 | 15 | combat_combinations 9；ext_module_composition 1；giants_colossus 1；giants_rigid 2；giants_spine_trace 1；giants_zones_natural 1。原30/60/120/240/300秒等期限保持 |
| 外部证据写入失败 | 9 | giants_composite_natural 5；phase4a1_game_perf、phase4a1_pathing_perf、phase4d_playable_recording各1；ext_world_work_boundaries的D15证据1。均ENOENT于`/private/tmp/*.json`，不是D15回血断言失败 |
| 旧完整图散列对照不匹配 | 4 | phase4a0_spatial_differential：empty/growth/narrative/growth+narrative；未改旧fixture |
| 新模块暴露旧守卫前提 | 2 | ext_world5_clock_levels:492/506/526把world5存在等同于`ids.includes('world5-fixture')`；crafting的worldDefinitions理应启用world5，crafting-only和五模块case因此期望false却得到true |

最后两条不是“派发基线原来已经跑红的同名case”：crafting尚未安装时没有该单模块case。应由维护者把共享测试的enabled预期按真实世界定义声明修订，不能让crafting隐藏world5迎合旧断言。

删除crafting副本的1009个生产/测试/脚本/配置文件与派发基线Git blob逐字相同（0差异），在该副本已再现旧图散列4失败、empty组合/四种combat+narrative/giants长测等原期限超时及证据路径失败；因整行ext后来中断，不提供虚构的最终合计。这个源等同性证据只支持上述已观察的失败归因，不替代完整门禁。

经一次正规权限审阅，仅创建了缺失的`/private/tmp`目录；默认测试权限下写探针仍返回EROFS（只读文件系统），故停止环境修复，没有chmod、策略修改、symlink或替代路径绕过。先前ENOENT日志保留，后续删除副本仍受该写入限制。受写入失败阻断的用例不视为其后续断言已通过。

没有修改共享源码、共享测试、脚本、原期限、旧黄金；没有新增skip/todo，也没有把定向复核拼成一次全绿ext。

## 8 自然 trace 与持久化证据

- 种子 `2`，`normal`，`modules:['crafting']`；264条公开命令，30,800 tick，录像265,449字节；最终 digest `fa9fd43cd7071229c1321c5577a3af11721aaf99c9bad5f1473200de9a6844b4`
- 选择过程：尝试不同种子1–8；自然导航器的自动下楼目标判定修正后重试seed2，共9次新局，未超64上限；没有改游戏状态/SDK来帮助录制
- 完整流程：启动礼包→D1木石纤维皮革→镐→桌→炉→皮甲→床/箱套件→额外桌套件→D2→金属×4→桌→匕首
- 捕获时 save/load/replay 摘要一致；replay `firstMismatch:null`；seek 0/132/264 摘要一致
- T15 末次专项：3/3通过，exit0，132.44s；逐条录制/错误、终态四项、完整录像、seek及原输入续录均校验
- 组合末次专项：8/8通过，exit0，115.80s；包含无额外模块、四种两两组合、五模块及战斗伤害/实际巨兽侧室
- startup 满包/全部跳过：真实 Game 的启动生命周期函数与显式预置场景验证（启动无玩家命令），不称为纯公开玩家流程
- skip/defer 首次无空间结果为显式布景，重返楼层的 retry/唯一收据通过真实 stairs_down/stairs_up；未把布景当作公开生成无空间的证据
- 完整纯公开自然 trace 不使用这些测试布景，48条 crafting+216条原生 move；下楼由踩到楼梯的原生行为完成

## 9 组合与删除

正常树：安装combat/crafting/giants/growth/narrative，32/32真实Game子集的游玩、save/load、逐事件replay、seek、续录及缺模块输入拒绝通过。`requestedScopePassed:true`，`passed:false`（浏览器未跑）。settlement未安装，不硬引用或伪造其行。

浏览器访问被拒绝后，不再另起直连浏览器绕过限制。正常smoke和两行removal均使用`--engine-only`；标准engine+browser命令及视口像素验收标blocked，不冒称通过。

### 9.1 实际执行命令

```sh
NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-removal.mjs --profile=removal --retain=combat,giants,growth,narrative --maxWorkers=2 --output=<外部证据>/remove-crafting --engine-only
NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-removal.mjs --profile=removal --retain=crafting --maxWorkers=2 --output=<外部证据>/only-crafting --engine-only
```

两行均真实复制当前候选、物理删除自有目录、清理缓存、核对测试所有权。没有plan/prepare-only替代，也没有保留空壳。

| 删除行 | 实际删除 | boundary | vue-tsc | build | 全部剩余ext | 在同一删除副本补充engine smoke |
| --- | --- | --- | --- | --- | --- | --- |
| 删crafting | crafting目录，15个自有测试移除 | exit0/6.285s | exit0/33.703s | exit0/46.847s | 已运行，执行器会话丢失；无终态/完整计数，**未完成** | exit0，16/16，517.017s |
| 只留crafting | combat/giants/growth/narrative，98个自有测试移除 | exit0/5.027s | exit0/32.477s | exit0/47.354s | 已启动，执行器会话丢失；无终态/完整计数，**未完成** | exit0，2/2，27.112s |

两次中断均核验“心跳停止＋执行会话Unknown process id”，没有把静默长等待当作活跃：第一行最后心跳在总运行5041.334秒，第二行在90.005秒。保留原始running日志/元数据和独立中断记录；没有重启整行或重复全部测试。仅执行各自原计划中**从未开始**的smoke，命令如下，cwd明确是对应实际删除副本：

```sh
node scripts/check-module-composition-smoke.mjs --output <外部证据>/remove-crafting/keep-combat+giants+growth+narrative-smoke.json --engine-only --removed-modules crafting
node scripts/check-module-composition-smoke.mjs --output <外部证据>/only-crafting/keep-crafting-smoke.json --engine-only --removed-modules combat,giants,growth,narrative
```

两个smoke均核对保留组合save/load/replay/seek/续录和要求已删模块的档/录像拒绝；输入前后哈希一致。删除副本哈希：删crafting `e54e65538e4e6f9d5ce0c15e1d9180254c59569985c347fcbf35a3a05ed6dc55`；只留crafting `c39caa49b83f3061d389da585fcd5dfc2a4018b8ed85a7297bde20f24135e7d4`。

**两行整体均未完成，不是完整removal通过。** 通用脚本的normal-tree-full提示不改变5B任务书排除完整npm test的要求。删除副本中的全部剩余ext终态仍待稳定执行环境验证。

## 10 浏览器与视口

真实设备未验证。云浏览器访问正常启动的 Vite `http://127.0.0.1:4173/` 返回 `net::ERR_BLOCKED_BY_CLIENT`，因此三个视口（1440×900、390×844、320×844）×普通/沉浸×四地图模式共24行全部 **blocked**。不换地址/通道绕过访问拒绝，不把 SFC/静态 CSS 检查冒称浏览器通过。

| 范围 | 结果 | 证据性质 |
| --- | --- | --- |
| 正常云 Vite localhost 启动 | 通过 | Node24.19启动日志 |
| 云 cdp 打开本地预览 | blocked | ERR_BLOCKED_BY_CLIENT |
| 24行视口×沉浸×地图 | blocked | 未取得游戏像素截图 |
| 长名称/满背包/取消/连点/blur/触摸/旧ACK/回放的浏览器验证 | blocked | SFC/真实Game覆盖另列，不等价 |
| 真实手机/真实触摸设备 | 未运行 | 无设备连接 |

独立静态审查发现共享 shell 在移动沉浸和手机回放不呈现原模块 CommandBar；已用本模块自有紧凑 bar 槽补同一个打开动作，HUD 仍仅有 activeTicket 时出现。桌面370px侧栏/手机48dvh面板保留地图区域、44px按钮与滚动结构已静态检查；视觉效果仍待可访问浏览器验证。

## 11 自行决定事项

- 移动沉浸/回放的共享命令栏不可见，使用模块自有紧凑 bar 展示同一个打开动作；面板打开时隐藏该入口，不改共享 shell
- state 类型在 `state.ts`，投影类型在 `view.ts`，机械包类型在 `types.ts`，避免 UI 误持有机械实现
- schema/DTO 校验先读属性描述符，拒绝 getter、稀疏/额外属性数组、非 JSON 与污染原型；不调用未知 getter
- `applyFact` 和参与者对异常输入保留原 state，不让取消递归变成新 provider 错误
- 工位预览严格用 `workPositions`，自动选择最小 interactableId；节点显示只读已物化余量，不自算再生
- 投影返回独立对象，最多每配方16次 preview；无材料候选也做一次 preview 获取权威原因
- trace final 在 §8.3 简写的 inventory/digest 之外保留 nodes/state，以满足 T15 明确的逐项终态校验；不另造重复黄金文件
- SDK/UI 未提供的能力只报告缺口，不加调度器、WeakMap 动作根、Game 补丁、额外玩法或其他模块依赖

## 12 未覆盖 / 待本地集成

- 5A2-S 合入及自然 trace 逐字段归因/重跑由维护者完成；本分支不预占兼容、不 rebase
- 5A3 fixture 绑定工位邻接回归待其基线存在
- 完整 `npm test`、全量删除矩阵、CE fetch/full/gen、5Z体积/性能均未运行，按任务边界排除
- SDK-02/03 的完整 UI 支持需本地底座/合同更新
- 源码、测试、配置、手册输入冻结（排除仅追加结果的本报告），2453文件聚合SHA-256：`a5fbff6605e99ba17035b9ecb056e18e34b0b5019b133d125cb01b678e2760b6`；收尾后逐文件复核一致，只有本报告追加结果
- 两行删除的全部剩余ext因执行器中断均未完成；正常树ext/drift已完整跑完但有§7所列失败
- 浏览器24行及真实触摸设备全部未验证；SFC/静态审查不能代替
- SDK-04/05的公开错误/录制合同期望未能由冻结底座满足，已附复现；不保留明知失败的自有断言或skip/todo

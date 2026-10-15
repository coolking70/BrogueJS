# P2 独立复审，第 2 轮（最后一轮）

结论：**可合入**。R1-F1 已独立关闭；在本轮指定范围内，未发现新的阻断或重要问题。此结论不表示历史性能尾部问题或全部性能目标已解决。

审查对象为 HEAD `a56e6447609565981a68c57d0788c69fc68f283e` 上全部未提交 P2 实现及修复。已读取 AGENTS.md、HANDOFF、development、architecture、P2 报告（含审查发现处理节）及第一轮发现。源码差量 SHA-256（`git diff HEAD -- src`）为 `aaad60a9d5c14bfc8c382f6d91ed85d0f475581620512ac6b347b2bc9251efac`；与作者 R1 审计和本轮两个独立回放制品一致。审查前后，作者审计登记的 22 个文件散列均相符；没有修改仓库文件，没有 commit/push。

## R1-F1：关闭

直接重跑上一轮公开接口最小复现 `/private/tmp/perfp2rev1.gc-min.mjs current`：组件来源删除后，再写入无关组件，玩家光照 **expected=1、actual=1**。未开启 testMode/debug，未手工清缓存或更改私有状态。

修复位于 `src/ext/runtime.ts:1905` 的 `collectComponents`：实际删除整个角色组件记录时，先调用全局失效，清除属性结果/来源缓存及模块只读视图、标脏绑定角色，然后才清理退休读者；无删除时不增加失效。`forgetStatDependencies` 仅移除退休读者，存活读者对已退休来源的依赖继续保留，因此同 ID 后续创建组件仍能通知读者。材料化属性在下一次属性读取时按既有惰性协议重新协调。

除作者回归外，本轮新建仓外探针 `/private/tmp/perfp2rev2.lifecycle.mjs`，分别以 base/derived 来源验证两个存活读者、缺失后创建、删除/重建、来源 GC、解绑后创建、重新挂接、模块状态开关、事务内读取新值后失败、退休读者和退休来源的原生事务回滚。两组均通过，光照及 max-hp 均先核对期望值，再调用一致性检查。确认日志为 `/private/tmp/perfp2rev2.lifecycle-confirmed.log`，exit 0。

上一轮仓外 `/private/tmp/perfp2rev1.probe.mjs` 也在当前源码通过：条件跨角色读取、缺失读取、删除重建、写后读再失败、内层失败恢复外层及外层失败恢复原态。日志 `/private/tmp/perfp2rev2.probe.log`。

## 同类路径及新增修复核查

| 路径 | 独立核查结果 |
|---|---|
| 组件创建/更新/删除、缺失读取、跨角色读取 | 依赖键包含模块、来源角色、组件名，base/derived/revisionHint 读取均登记；写入清理对应只读视图并通知全部已观测读者。历史依赖并集只会多失效，4096 键溢出退回全局失效。相关回归通过。 |
| 组件整角色 GC、退休、同 ID 重建 | 全局失效覆盖存活读者；原复现、base/derived、无后续写入/无关后续写入、再次 GC、多个读者及重新挂接验证通过。 |
| command、嵌套 worldWork、generation 回滚 | 恢复状态/组件/账本/资源，清理来源结果及模块视图；随后再次写入仍能通知跨角色读者。普通回滚保留的额外历史依赖不造成漏失效。嵌套及生成回归通过。 |
| itemCommand 与原生退休回执 | 会话捕获覆盖新增依赖 Map/Set、缓存、修订、角色绑定；读者/来源退休后失败，绑定身份及后续失效均恢复。相关探针和原生身份测试通过。 |
| 装备、鉴定、growth 加点/洗点、状态变化 | 装备/物品知识仍通过原生修订和知识缓存清理生效；knownOnly/假设投影重新求值。growth 派生缓存键包含有效/永久属性、作用域、上下文、隐形、模板和 L0，只有深冻结配置可复用。装备替换、鉴定/符文发现、酸蚀、加点/洗点、临时效果到期及状态相关测试通过。 |
| 世界对象 GC 多 hook 失败 | `runtime.ts:1885–1902` 新增外层账本/资源保存点；后续 hook 失败时与组件/模块状态一起恢复，并清材料化签名和值、保守失效。新增世界 GC 回归通过；未发现该窄修引入新问题。 |

还复核了 immutable JSON 认证、只读视图与可写例外、来源准入凭证及同边界捕获池：外来浅冻结/可变子节点不能获得可复用凭证，来源预算仍执行；actorActions 与 growth:focus 可写例外保留，捕获池不跨写入复用。未发现新的校验绕过或回滚写域缺失。

## 本轮实际验证

- 相关 **43 文件 / 761 项全部通过，exit 0**，660.29s。Node 24.19.0、3072 MiB、单 worker、禁止文件并行；输入清单 `/private/tmp/ext-perf-p2/r1/related-tests.txt`，结果 `/private/tmp/perfp2rev2.tests.log`。包含属性/装备/鉴定/growth、完整图生成差分、战斗/肢体、跨层、居民失败与生命周期、存读/录像/seek 和新增世界 GC 回归。
- `npm run check:modules` **exit 0**：boundary 通过，测试依赖 `errors: []`。可核验退出码的日志 `/private/tmp/perfp2rev2.boundary-confirmed.log`。
- 独立执行未改动的 `scripts/check-ext-perf.mjs`，使用 `/private/tmp/ext-perf-p0p1` 的两条原冻结输入，没有重生成、缩短路线或削减 full oracle/D20 等待段。完整 runner **exit 0**，两条原硬门禁均 pass；日志 `/private/tmp/perfp2rev2.p0.log`，原始制品 `/private/tmp/perfp2rev2-p0/`。

| 基准 | 完整命令 | OOS | full 检查点 | 与 HEAD 基线逐叶比较 |
|---|---:|---:|---:|---|
| classic | 2208 | 0 | 9 | 3,499,183 状态叶 + 2,280 域叶，零差异 |
| all | 2516 | 0 | 10 | 3,396,652 状态叶 + 10,144 域叶，零差异 |

两条另与作者 R1 最终制品分别逐叶比较，结果也为零差异。整个 semantic 对象一致，包含终态、事件域、已验证 full 域散列、双流 RNG、去除计时的命令行语义及客观时间块。各实际入口调用计数完全一致；all 保持 2,326 客观块、231,034 ticks。比较结果为 `/private/tmp/perfp2rev2.replay-before-{classic,all}.json` 和 `/private/tmp/perfp2rev2.replay-r1-final-{classic,all}.json`。

本轮还独立重比作者 R1 制品与最初 HEAD 基线、审查前 final，两条四组均逐叶零差异，见 `/private/tmp/perfp2rev2.compare-{before,final}-{classic,all}.json`。以上独立完整回放结果不依赖这些历史制品比较。

## 保留边界

本轮仅运行指定相关测试、boundary、测试依赖检查及基准回放；未运行全量 npm test/test:ext/test:drift、types/build 或居民新性能校准。基准与相关测试部分并行，本轮 wall 数值不用于性能收益/回退裁决。作者保留的 64 居民 59.071/51.294ms 历史超50ms结果、偶发尾部归因缺口、深层30/40ms目标未达及设备覆盖缺口继续保留，不因本轮“可合入”而关闭。

SSR 探针和 runner 有受限环境 HMR 端口 EPERM 提示，但实际加载、断言及完整回放均完成并返回成功，未改变观测逻辑绕过提示。

仓库身份检查见 `/private/tmp/perfp2rev2.identity-before.json`、`/private/tmp/perfp2rev2.identity-after.json`；所有新脚本、日志和本结论仅写入 `/private/tmp`。

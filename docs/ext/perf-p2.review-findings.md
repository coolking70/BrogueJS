# P2 独立审查，第 1 轮

结论：**需修**。发现 1 项可重复的游戏属性语义回归（R1-F1），应修复后进入第 2 轮。未修改仓库文件、未 commit。

审查对象：`a56e6447609565981a68c57d0788c69fc68f283e` 上的全部未提交 P2 差量。已读 AGENTS.md、HANDOFF、development、architecture、性能评估与 P2 报告。当前 `git diff HEAD -- src` SHA-256 为 `66732fb5a29d4a4b19763cffea0cfdaa6b1a2673041c276a7c26996d29f16c6e`，与作者最终审计一致；作者审计登记的 20 个文件散列全部相符。

## R1-F1：组件 GC 漏掉存活的跨角色读者，精确失效使旧属性结果继续生效

**重要，需修。** 位置：`src/ext/runtime.ts:535–549`（新组件级失效）、`:1897–1904`（GC/退休及新增 forget 调用）。

`collectComponents()` 直接删除已不可达角色的整个组件记录，但只清除退休角色自己的属性缓存；新增 `forgetStatDependencies()` 也只是移除退休角色作为“读者”的记录，不会使读取其组件的存活角色失效。后续 `setComponent()` 现在仅通知被写组件的读者。因此，存活角色可能继续使用已删除来源的属性结果。`invoke()` 中的 validateSources/reconcile 循环也会复用旧来源，不能修复这个遗漏。

最小复现使用正常 `ExtensionRegistry`、`ExtensionRuntime`、Player、Monster，未开启 testMode/debug，也未直接修改缓存或私有状态：

1. 注册属性 provider：玩家的 `native.light` 从同模块怪物组件 `bonus.value` 获得 flat 加成。
2. 通过 runtime.command → context.setComponent 写入怪物 bonus=6，并读取玩家光照：基础 1，加成后 7。
3. 调用原生 GC 入口 `collectComponents([player])`，确认怪物组件已从 snapshot 删除。
4. 通过同一命令入口写玩家一个 provider 未读取的 `unread` 组件，再读取玩家光照。
5. **当前 P2 返回 7；HEAD 返回 1。** 在当前 P2 内仅把 set/removeComponent 的 `invalidateStats(component)` 恢复为 `invalidateStats()`，返回 1。其他 P2 生产代码保持原样。

反事实通过 Vite 只读加载替换完成，没有回退/编辑工作区文件。最小脚本及带断言日志：

- `/private/tmp/perfp2rev1.gc-min.mjs`
- `perfp2rev1.gc-min-current.log`：exit 1，expected=1，actual=7。
- `perfp2rev1.gc-min-head.log`：exit 0，expected=actual=1。
- `perfp2rev1.gc-min-coarse.log`：exit 0，expected=actual=1；仅恢复组件写入的保守失效。

在仓库根复现：

```sh
NODE=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$NODE" /private/tmp/perfp2rev1.gc-min.mjs current
"$NODE" /private/tmp/perfp2rev1.gc-min.mjs head
"$NODE" /private/tmp/perfp2rev1.gc-min.mjs coarse
```

归因边界：HEAD 在 GC 刚结束、尚无后续写入时也没有主动刷新存活读者；本轮确证的 P2 回归是**原来后续合法组件写入会恢复正确值，现在仍返回旧值**。不能把“GC 删除原先就直接写”当作本优化保持语义的证明。跨角色组件读取是受支持的能力，本补丁自己的跨角色依赖测试也覆盖它；不能靠禁止这种 provider 来修守卫。该探针证明基础运行时合同回归，不声称当前八个内建模块已有实际玩家录像复现。

建议：GC 删除组件时，在丢弃依赖信息前使所有存活读者的结果/来源缓存及对应组件视图失效，并确保物化属性能够重新协调；或对此较少发生的整角色删除保守全局失效。补回归应覆盖跨角色来源退休、无关组件后续写入、读取/物化和失败回滚，保留上述 HEAD/单变量反事实。

## 其余审查结果

- 只读事实：immutableJson 仅认证分离、重新校验且深冻结的 JSON；外来浅冻结、可变子节点和 accessor 不凭 revision 获得可信身份。canonical 仅对内部认证对象复用。可写 context 仍返回独立副本，actorActions 与 growth:focus 保持可写例外。没有确认新的外来输入校验绕过。
- 属性来源：set/removeComponent 正常路径记录模块、被读角色和组件名，含缺失读取、历史条件分支、derived 与 revisionHint 读取；4096 键溢出保守全局失效。装备/鉴定仍有原生修订与 knownOnly 重新求值；growth 缓存包含有效/永久属性、作用域、上下文、隐形/模板、L0，并只对深冻结配置启用。R1-F1 是删除角色组件这一写路径的遗漏。
- 事务：普通失败及 generation rollback 清理结果与只读视图；原生会话回执还恢复缓存/修订和绑定。JSON savepoint 只共享认证不可变分支，保留独立可写容器；原生调度器身份回执覆盖被省去的重复 JSON 副本。居民原生/经济捕获池仅在同一同步无写入边界共用，写入前 seal，后续嵌套另建池，原生战斗、肢体、层与营地写根未删。未确认该部分的新回滚问题。
- 独立额外探针 `/private/tmp/perfp2rev1.probe.mjs` 在当前与 HEAD 均通过：跨角色缺失读取、条件分支切换、删除/重建、事务内读新值后失败、内层失败恢复外层值、外层失败恢复原值。GC 最小复现另列，不被这些通过结果覆盖。

## digest 与测试修订裁决

两处旧 foundation15 前提更新为16正当：`HEAD:src/ext/descriptor.ts:6` 已是 foundation16，P2 没改协议定义或摘要算法。独立执行 SHA-256 规范化捕获，只有根元组 foundation 15→16：旧根 `2a655762f01a6b8e0f9d7bfae71e83ba3102d0052b5b9229ca9ff7f9a823a707`，新根 `54ba08909354cb6a47cba280b1a83fe3e893acfef4a8a70bfb15bf62fdb75b8a`；六域散列保持。证据 `/private/tmp/perfp2rev1.digest.jsonl`。另核对作者保留的 foundation HEAD 反事实失败记录。

测试差量其余为新增用例/导入/套件登记，未删除用例、放宽容差或翻转游戏规则断言。工厂调用时机、错误规则身份拒绝等断言未弱化。

## 验证记录

- `npm run check:modules`：exit 0，module boundary 通过，测试依赖 `errors: []`；`/private/tmp/perfp2rev1.boundary.log`。
- 相关 42 文件 / 742 项全部通过，exit 0，620.56s；Node 24.19.0、3072 MiB、单 worker、禁止文件并行。覆盖属性/装备/鉴定/growth、generation 完整图差分、原生调度器身份、战斗事实/巨兽肢体、跨层、营地居民失败注入，以及存档/录像/seek。输入列表 `/private/tmp/ext-perf-p2/related-tests.txt`，输出 `/private/tmp/perfp2rev1.tests.log`。
- 用原比较器独立重比作者 before/final 原始制品：all 3,396,652 状态叶 + 10,144 摘要域叶；classic 3,499,183 状态叶 + 2,280 摘要域叶；均零差异、semantic 对象相同。结果 `perfp2rev1.compare-all.json` / `perfp2rev1.compare-classic.json`。源码身份与作者最终制品一致。**本轮未重新运行完整基准回放**；零 OOS 来自作者保留的 2208/2516 命令回放制品，本轮独立的是原始数据比较，不冒称独立重放。
- 未跑全量 npm test/test:ext/test:drift、types/build 或新性能校准。作者保留的 64 居民 59.071/51.294ms 超50ms、深层绝对预算未达标与 GC/设备覆盖缺口仍保留，不因本轮语义审查而关闭。

本轮先修 R1-F1；不需要重录 digest 或放宽现有守卫来解决。

最终核验：HEAD、源差量哈希及作者审计登记的全部文件保持原样；见 `/private/tmp/perfp2rev1.identity.json`。现有 742 项通过不覆盖 R1-F1；独立新增仓外复现当前 exit 1、HEAD 与单变量保守失效均 exit 0。

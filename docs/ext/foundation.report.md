# EXT-0 扩展底座阶段 0 交付报告

阶段 0 实现交付：`709f219ca8e0e542f16c7ea53f912706ae762752`，基于 main `3c1407f`，云端从 WIP `ed8d270` 接续。阶段 0 已完成，最终四项门禁全部退出 0；后续阶段 1 仅设计，见 [phase1-growth.md](phase1-growth.md)。

## 实现范围

- `src/ext/` 提供按局启用的注册表、依赖/版本验证、同步生命周期、冻结事件 DTO、模块私有 JSON 与通用生物组件、严格模块命令、纯数据定义格式
- 经典 `extensionRuntime === null`，不调用模块；原存档/录像投影、规则/RNG、旧断言、黄金 trace、生成基线未修改
- Game 仅新增 `extensionRuntime`，已登记 `scripts/u03-state-contract.json`；Creature 回调用 WeakMap 接线，不向原实体 codec 偷加字段
- 示例 example 1.0.0 只统计非行政怪物死亡并显示 i18n 消息；不是玩家击杀归属，不包含经验、属性、职业或技能玩法
- 扩展存档/录像记录模块集合、精确版本与组件；实时/回放/seek/续录共用命令派发与完整扩展 checkpoint
- 最终 23 项新增扩展回归覆盖注册/依赖、严格 JSON/校验、权限过期、同步生命周期、命令边界、存读/录像/seek/续录/OOS、原 main 双流精确 RNG 和经典零模块调用

准确钩子位置、权限与已知能力边界见 [architecture.md](architecture.md)，尤其第 3、4、8 节。`sourceId` 只在 attack 栈中可信；投掷/独立法术/持续伤害、生成回滚、死亡回收和规则替换需阶段 1 补强。

## 最终门禁

命令结果摘要原文统一保存在 [evidence/summary.md](evidence/summary.md)，不再重复提交原始日志或全量散列。

| 命令 | 阶段 0 最终结果 | 退出码 | 时长 |
|---|---|---|---|
| `npx vue-tsc -b` | 通过 | 0 | 15.15s |
| `npm run build` | 通过，既有 >500kB 分块提示保留 | 0 | 19.31s |
| 完整 `npm test` | 262 文件；4594 passed / 83 skipped / 5 todo | 0 | 3193.95s |
| `npm run test:drift` | 1 文件 / 1 项通过 | 0 | 51.05s |

环境：云端 Linux x86_64、Node 24.19.0/npm 11.9.0，4 个 Vitest worker，NODE_OPTIONS 4096MiB、TZ=UTC。冻结源码的聚合 SHA256 `7b653cc1288d62b11c350e9238451373fb7861ea7e1859e56b33b90e6abff9a0` 在门禁前后相同；门禁后只整理文档/证据。没有修改旧断言/超时/测试集合或生成/trace 夹具。

83 skipped 经核对为缺 CE 参照的 75 项条件跳过 + 8 项历史 skip，5 todo 未改；阶段 0 没有执行 ce:fetch/test:full，**CE 对照用例未执行**。不得把条件跳过宣称为通过。

## 其它验证与历史边界

原 main 独立归档捕获 seed4101 的开局/真实攻击/等待双流 tuple，形成 `src/test/fixtures/ext-classic-rng.json`；不是从修改后的扩展实现反算期望。

阶段 0 浏览器在 1440×1000 和 390×844 模拟视口验证默认经典/扩展开局，seed1141 巫师局 21 条自然命令发生一次击杀；中文消息、存读档、完整来源、回放及版本不匹配拒绝通过，pageerror/console.error 为空。截图未入库；手机只是尺寸模拟，未声称安卓实机验证。这些不是主线刻符新界面合并后的再次浏览器验收。

本地迁移前的中断轮不计最终通过。曾出现裸函数调用 `CombatSystem.attack` 被包装器 `this.resolveAttack` 破坏，已改用 `CombatSystem.resolveAttack` 并在云端完整门禁复验；另修严格 JSON/异步边界、过期 context、继承命令、损坏历史和超宽 RNG 区间。最终结果来自一次完整全绿轮次，不拼接定向结果。

## 阶段 1 前置整合与证据精简

维护者本轮授权后，在 `ext/foundation` 合入最新 `origin/main 912d7a1`，合并提交 `7024ea0`。只有 progress.md / zh_CN.json 冲突，保留双方新增、主线刻符/旅行修复与 lab 词条改名删除；JSON.parse、合并后 vue-tsc/build 通过。尚未把旧阶段 0 全套结果冒充整合后的完整测试。

本轮按要求把 evidence 的 39 份缓存/哈希/原始及中断日志压缩为一个最终门禁 summary；原始文件留执行环境本地 `/tmp/brogue-phase0-evidence-raw-709f219/`，旧提交可追溯。后续阶段同样只提交精简原文摘要。

阶段 1 第一小步的设计、待确认项、底座补强与门禁均见 [phase1-growth.md](phase1-growth.md)。阶段 0 的“不获取 CE”仅是当时范围：本轮已要求未来每个实施小步尽量 ce:fetch 后 test:full，让 CE 对照真正执行。完成设计后停止，等待确认。

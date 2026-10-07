# 5G 集中返工独立审查

## 审查身份与范围

本审查由未参加本轮实现的独立审查者进行；只写本文件，不改生产代码或测试，不提交/推送。审查对象从固定派发 `db50a84511dde0b0196f8b182205b9ea70086ef3`（tree `cd4a1fdf9a94538180a0a67a1feb174fdb8c3a3e`）产生的 `codex/phase5g-revision` 工作树。代码基线为 `6874dbb07a67c6873b30580d0c06af2a42507875`。

修复后门禁输入2651文件（不含报告/审查元数据），按“路径+NUL+SHA256+LF”汇总：`7c9c8f740d49abeaabba04e21cd82249f9e511269b942cac54e913f853b027ba`。审查者逐文件复算零不一致。

采用 `phase5g-revision.dot-package.md` 的新事务、反馈、持久化和门禁裁定。读取实际 diff、原参与者、相关共享调用路径及自有测试；不把实施者的历史通过数视为最终验收。

## 发现与处理

### R-F01 / P2：死亡 detached 故障测试混淆可复活尸体与离队退役（已修复并独立关闭）

- 发现位置：审查初始候选 `src/ext/modules/foraging/tests/foraging_atomic.test.ts:169–173`。
- 新增断言从参与者入口组件快照删除死亡 actor 的整行，要求最终 components 为 `{}`。真实 Goblin 盟友死亡进入 purgatory，组件行仍被机械根引用；注入 removeOwnComponent/replaceState 失败时，事务应恢复该行，而不是强制清除。
- 独立运行该文件时，四个 detached before/after 用例失败：预期 `{}`，实际 `{"40":{"foraging:hunger":{"band":"fed"}}}`。实施者用 `-t 'detached:'` 原样复现四失败，堆栈指向原第173行。
- 归因：`Game.ts:10619` 先拆除机械需求，随后 `removeDeadMonsters`（约10658起）把可复活盟友加入 purgatory；`Game.ts:3530–3536` 将 purgatory 纳入 collectComponents 可达根。离队退役在 `Game.ts:13543` 调用 retireEdibleActor，是另一条路径。当前生产回滚符合新包，不应为了迎合测试修改共享死亡路径。
- 原执行者已修复（现第169–179行）：完整比较实际 components 与参与者入口，另断言同一actor在purgatory、已离开active monsters、恢复其自有组件。state、消息、事实数、双 RNG、需求行消失及同一有效存档的无故障对照全部保留；未改生产代码、未删除/跳过用例。实施者定向四项通过；独立完整atomic54/54复跑exit0，74.30s，0skip/todo。R-F01关闭。

### R-E01 / P2（共享基线既有，范围外）：活跃力量存档向已过期活局载入被拒绝

- 位置：`src/ext/runtime.ts:387` 临时属性来源用当前运行 ports.simulationTicks 过滤；约1234行 validateWorld 校验候选 materialized stats。共享文件相对派发 tip 无 diff。
- 实施者的真实诊断日志：公开吃 might 后保存力量14、+2至40000tick；立即载入成功；原活局 wait 至40000后载入相同字节失败；fresh harness 载入成功，manifest相同、存档字节未变。审查者复核日志与共享源码，未另行修改或重复注入诊断。
- 本轮力量持久化的 fresh-load / 不载入控制，两组都执行相同398+1公开wait，比较完整机械快照、extensions（含知识/需求/state）、双 RNG 和 digest，是有效的独立分支到期证据；不能据此宣布上述晚期活局 reload 已通过。
- 保留为维护者共享修复交接，不在 foraging 内绕过或修改冻结接口。此项并非本次模块修改引入，也不将日志中的诊断筛选 skip 计入最终套件结果。

## 已核查要点

- 三参与者先完成事实/state校验和纯规划，再进入无 catch 的 writer 段；畸形/重复/外 owner输入零writer，qualifies/可选居民查询保留布尔兜底。烤菌两次真实知识写取OR，只计一次新 known。
- 严格路径使用原 descriptor/参与者、只包装 writer 注错；eat/feed/roast要求恰好一条已录制零成本 C5_PROVIDER，比较物品身份/数量、机械快照、知识/state/components/need、消息、事实计数、双 RNG。降级路径按参与者入口，保留环境/需求机械结算及诊断；deadline失败没有残留离队队列。
- 精确治疗用独立 min/percent/cap/full 数值和事实点即时HP；烤制keep/strip独立crypto预言。32000tick真实纯读投影、UI面板提交、实际CAS与旧revision拒绝。共享 `ext_edible_runtime` 已有预留/满节点断言，`ext_world_work_failures` 有背包容量拒绝，列入实施者必要共享复跑。
- 同伴沉眠由公开feed施加真实25回合，命令后余24；保存/载入后重新取得actor。ready盟友旁有敌对目标，沉眠时目标HP/位置不动、醒后实际攻击；另有真实爆炸正伤害提前唤醒。玩家沉眠仅在真实事实观察点验证，同一eat命令最终自然醒/伤害醒，不虚造命令间存档窗口。
- 无foraging组合走中立manifest/digest/机械快照，不读其私有state；正常计划为10组合+2热源+1群体，保留两自然trace。通用热源使用自有fgheat descriptor；peer真实联动按安装能力注册，crafting缺席才不注册trace B。
- 九冻结文件 SHA-256 全部与开工清单一致；共享源码、原fgfixture、foraging数据/locale/两trace无diff；严格发现器识别七生产模块、20份foraging自有测试。仅白名单路径变更；git diff --check通过。

## 独立运行记录

环境：Node24.19.0；每次 `NODE_OPTIONS=--max-old-space-size=3072`；两个独立进程各 `--maxWorkers=1`，总worker不超过2；无CE fetch/full/gen。

1. `npx vitest run src/ext/modules/foraging/tests/foraging_persistence.test.ts src/ext/modules/foraging/tests/foraging_nodes.test.ts src/ext/modules/foraging/tests/foraging_knowledge.test.ts --maxWorkers=1`：exit0，3文件31passed，0failed/skip/todo，103.23s。
2. `npx vitest run src/ext/modules/foraging/tests/foraging_atomic.test.ts src/ext/modules/foraging/tests/foraging_combinations.test.ts src/ext/modules/foraging/tests/foraging_trace.test.ts --maxWorkers=1`：exit1，3文件中2通过/1失败；67passed、4failed，0skip/todo，258.83s。组合13（10+3）和自然trace4全部通过；失败仅为旧候选R-F01四项，修复后的完整atomic复跑另补。
3. 修复后 `npx vitest run src/ext/modules/foraging/tests/foraging_atomic.test.ts --maxWorkers=1`：exit0，1文件54passed，0failed/skip/todo，74.30s。
4. `node scripts/test-discovery.mjs`、九冻结文件 `sha256sum -c`、`git diff --check`：exit0。

日志留仓库外，不把重复跑的通过数相加。

## 最终门禁与物理删除证据复核

以下是实施者执行、审查者检查命令回执/日志/JSON及磁盘实际状态的最终结果，不冒称审查者重复跑过全部门禁：

| 最终命令 | exit | 数量 | 外部计时秒 |
|---|---|---|---|
| `node scripts/check-module-boundaries.mjs` | 0 | 边界通过 | 6.397 |
| `npx vue-tsc -b` | 0 | 类型通过 | 23.786 |
| `npm run build` | 0 | 构建通过 | 34.085 |
| `npx vitest run src/ext/modules/foraging/tests --maxWorkers=2`（另启JSON reporter） | 0 | 20文件849passed，0fail/skip/todo | 321.714 |
| 报告R3列明的17个必要共享测试，`--maxWorkers=2` | 0 | 17文件347passed，0fail/skip/todo | 464.437 |
| 实际 `npm run test:drift -- --maxWorkers=2`（另启JSON reporter） | 0 | 6文件12passed，0fail/skip/todo | 197.584 |

类型检查早期一次会话中断未取得exit，实施者保留日志并重新完整运行；不得把中断写成通过。正常组合仍为10+3，两自然trace均真实执行。表中正常own与drift有自然trace重叠，不累加为不同覆盖。

四个外部副本各执行严格 `node scripts/test-discovery.mjs` 和完整保留的 `npx vitest run src/ext/modules/foraging/tests --maxWorkers=2`，两命令均exit0。每个副本都保留20份foraging测试文件、47个自有文件；不额外exclude，不删自有测试，不放peer空壳。

| 副本 | 实际删除模块文件 | 实际注册/通过用例 | fail/skip/todo | 测试外部计时秒 |
|---|---:|---:|---|---:|
| 删除crafting | 42 | 845/845 | 0/0/0 | 297.316 |
| 删除combat | 61 | 846/846 | 0/0/0 | 307.135 |
| 删除giants | 36 | 846/846 | 0/0/0 | 314.609 |
| 只留foraging（删除另外六模块） | 283 | 833/833 | 0/0/0 | 247.902 |

审查者直接验证各模块目录及清单中的每个文件确实不存在，删除前哈希与正常树相符；逐个比较副本中所有应保留输入与正常最终manifest，分别2609/2590/2615/2368文件零不一致，包含全部foraging文件及共享发现器/配置。正常树2651输入在所有运行后仍与上述最终SHA逐文件一致。

用例数量差异来自真实peer联动不适用及安装集合重组：无crafting不注册两项trace B；无combat不注册其两项热源用例；无giants不注册两项群体用例；仅foraging仍实际执行自然trace A、独立通用热源和模块规则。未通过已注册用例中的直接return/skip制造通过。该证据只是新包授权的最小删除复验，不是5Z完整removal档（未跑各副本全部其余模块测试/类型/构建或全子集）。

## 结论与未验证边界

R-F01已由原执行者修复并独立复跑关闭；未发现仍需修改本轮生产参与者或测试的范围内缺陷，代码/针对性行为审查通过。R-E01共享既有加载边界继续公开交接。已复核同一最终输入上的正常必要门禁和四个授权物理删除副本，结果如上；本次独立审查可签收。共享旧问题及浏览器/5Z边界不因此关闭。

浏览器24格、再生后浏览器重采、真实触摸设备未由本审查执行，不声称像素QA。已复核实施者本轮启动日志：Chromium因 `socket() failed: Operation not permitted` 中止；无浏览器截图或测试成功证据，不绕过限制。特殊九类布景完整新局录像、完整npm test、全部test:ext、全128组合、完整删除矩阵和极限长局仍属5Z。这里的代码审查不是维护者最终验收。

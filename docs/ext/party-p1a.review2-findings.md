# Party P1a 独立复审 R2（最后一轮）

结论：**需修**。第 1 轮 2 阻断 + 5 重要的原始复现均已修复；本轮同类排查确认 **1 个新的重要发现，0 个新阻断**。新发现是原 P1a 实现遗留，修复前副本同样复现，不归因于 R1 修复新引入。本轮未确证 R1 修复另外引入阻断或重要问题。浏览器、平衡、云端长基准均不列缺陷。本轮只读仓库，所有探针、日志及本报告均在 `/private/tmp`；未修改仓库、未 commit、未启动子代理。

审查对象：HEAD `e3ec8f49f8a7c6f827ecb04dac7304a441c960e6` 上的全部未提交 P1a 实现及 R1 修复。已读 AGENTS.md、HANDOFF、development、architecture、P1a 任务书、party 合同、R1 发现和作者报告的审查处理节。逐文件独立复算作者列出的 782 个生产/工具文件，实际身份为 `7fc89d26a6134e2dd881220a43a0322df9104473a15f41bbd57ca212abfabcca`，与报告一致，差异为空（`p1arev2/source-audit.json`）。

## R2-F1 — 重要：单格位移的占位世界漏掉非主成员，公开传送可产生可持久化的成员叠格

定位：`src/engine/Core/Game.ts:16086`、`:15987`，关联 `src/engine/Movement/CreatureSpatial.ts:206–209`、`src/engine/Movement/CreaturePlacement.ts:105–110`。

`teleportCreature` 仍向候选查询传 `{grid, player, monsters, dormantMonsters}`，没有活动非主成员。落位的第二道 `canDisplaceCreature` 又把 `Game` 直接传给 `canPlaceCreature`；`Game` 的 getter 名为 `controlledActors`，而通用空间口读取的是 `world.controlled`。所以候选过滤和最终占位校验均把其他非主成员所在格视为空地。已有 `spatialWorldPort()` 能提供完整成员及 inactivePlayer 信息，但这两个单格入口没有使用它。普通公开移动在 `Game.ts:4374` 明确禁止成员叠格，传送不能绕过同一物理约束。

独立复现脚本：`/private/tmp/p1arev2/teleport-overlap.mjs`。seed42、party-only 三人；在真实录制 header 前设置可重建的受控地图，A 在 `(9,10)`、B 在 `(10,10)`、C 在 `(60,10)`，其余格为墙。B 持真实 `scroll_of_teleportation`。A 经公开命令 wait，B 经公开 item/use 读卷轴。候选列表错误地只有 C 的格子，B 实际传送到 C 身上。

实际结果：

```json
{"candidates":[{"x":60,"y":10}],"positions":[{"id":1,"loc":{"x":9,"y":10}},{"id":18,"loc":{"x":60,"y":10}},{"id":23,"loc":{"x":60,"y":10}}],"events":3,"load":true,"replayOOS":null,"seek":3,"secondaryOverlap":true}
```

这不是手改坏档：非法重叠由公开命令产生，随后真正 `toSaveSnapshot → loadSnapshot`、逐步 seed replay、seek 0→末尾均保留它，完整 mechanical digest 相等。`WholeRunSnapshot.ts:539–549` 新联合准入仍未检查同层成员占位冲突。两名独立实体共享格子会使单格选敌、碰撞和 DF 的首实体查找产生歧义；确定性重放错误状态不代表玩法正确。

同一脚本在 `/private/tmp/party-p1a/r1/before` 运行也得到相同结果。证据：`teleport-overlap.log`、`teleport-before-r1.log`；两次 exit0 表示断言成功确认缺陷，并非产品通过。脚本仅布置初始化世界，未替换候选、传送、物品、调度、存读或回放实现；这是受控边界复现，不冒称自然随机游玩录像。

建议修复：候选和最终提交统一使用包含所有活动成员、排除冻结主成员的空间口；检查共享的单格位移调用者，不能只在卷轴入口加例外。增加三成员公开传送的占位回归，以及读档同层占位冲突的拒绝/保活测试。在本复现场景里没有合法传送落点，应沿既有无落点语义处理，不能落到 C 身上。

复现命令（在候选仓库根运行）：

```sh
'/Users/coolking70/Documents/同步空间/rea/.tools/node-v24.18.0-darwin-arm64/bin/node' /private/tmp/p1arev2/teleport-overlap.mjs
```

## 原 7 项定向判定

| R1 项 | R2 判定及依据 |
|---|---|
| F1 非主成员火焰 TypeError | 原问题关闭。ControlledActor/Monster 显式分类；旧 `probe4` 的公开火格移动输出 FIRE_MOVE_OK，旧 `probe3` 的燃烧 tick 输出 BURN_OK；火免疫、灭火、爆炸、护甲和食物火接触也有相应生产适配与回归。 |
| F2 毒伤全灭未终局 | 原问题关闭。状态及调度边界统一死亡清理，不再由 settleDue 直接写 dead。旧探针得到 hp=[0,0]、life=[dead,dead]、kills=0、gameOver=true；死亡事实、阶段动作取消、冻结幸存者和重复终局由专项测试核实。 |
| F3 modal 绕过控制命令 | 关闭。公共预检在 actor-step/control 分流前检查 modal；独立 control-recheck 验证 travel 与 leader 均 DECISION_REQUIRED，快照、实体身份、allocator、双流、事件前缀不变；escape 后可保存。 |
| F4 跨冻结层恢复 issuer | 关闭。issuer 必须属于所选 frozen 层，检查早于 generateDepth。独立三层探针拒绝 B(D1) 恢复 D2，再由 C(D2) 恢复成功，B 完整实体 JSON 保持；诊断快照可读回。 |
| F5 其他成员 falling 延后 | 关闭原“已置 falling 位却先给人工决策”问题。时间端口枚举全部活动成员；客观块、同 tick 动作后及已接受命令收尾处理。旧 probe3 在 B 推进后直接进入 D2，A falling=false；不把原生悬浮到期次序另列缺陷。 |
| F6 潜行环境来源串 scope | 关闭。创建/读档配置每成员自己的 darkness/shadow/rested；光照失效所有活动成员缓存，敌人选择目标后重算目标潜行。旧探针同一 A 在 A/B scope 的值均为7，专项另验次成员与 load。 |
| F7 成员身份/层联合准入 | 原列举问题关闭。manifest 数量、实际 visited/cache 层、单格/非临时/居民/raid 排他、HP/life/全灭终态均在发布前检查；旧临时成员/未访问冻结层负例拒绝，独立 count 负例拒绝且保活。完整物理占位仍有 R2-F1 的遗漏。 |

独立旧探针输出见 `p1arev2/probe3.log`、`probe4.log`、`probe6.log`；额外不变性断言见 `control-recheck.mjs/.log`。原探针的 exit0 仅是运行完成，以上判定依据实际输出与本轮断言。

## 同类排查与无 party 不变性

- 火/毒/气体/爆炸/DF、深水背包、陷阱、坠落、饥饿、定向状态、反射/远程命中及阶段死亡均追查了实际 actor 归属和收尾。此次修复覆盖明显扩大，但 **位移物理占位这一同类路径仍不充分**，不能凭 player/Monster 词法搜索和已有回归全绿宣称全部收口。
- 全队终局入口已逐个追查 `triggerGameOver` 调用点：原生近战通过调度收尾，状态/环境/DF、bolt、坠落、饥饿及阶段动作进入统一清理；全灭才停局，冻结幸存者保留恢复，正常出口仍验证出口位置/队伍护符并显式确认，新增 busy/失能限制。未发现新的阻断或重要终局问题；这不等于穷举所有怪物、符文和模块排列。
- 无 party 惰性形状、双 codec 与既有字段保持。独立核对 HEAD 归档与作者 baseline 副本的764个路径：仅 `scripts/test-suites.json` 有捕获测试登记差量，生产源相同；无 party fixture 仍与最初 baseline.json 相等（`baseline-audit.json`）。
- 除原 `ext_party_inert` 的五配置字节守卫，本轮新增仓外配对探针，在 HEAD 副本及当前树运行完全相同的 **27场景/42检查点**：classic、extended空集、八模块无party，各测燃烧、公开进火、毒死、岩浆、爆炸、毒气、消魔、休息/搜索、传送。固定 Date.now，保留全部字段，逐点比较完整 snapshot/save/replay JSON SHA、Game own keys、双流完整状态、消息；结果 **全部精确相等，differences=[]**。见 `no-party-differential.mjs`、`no-party-{head,current}.json`、`no-party-comparison.json`。在已测范围确认无 party 字节/行为不变，不作无限场景证明。
- 配对探针首版清空八模块居民来源实体，基线与候选均被已有 `resident.source.slot` 守卫拒绝；仅修改仓外布景保留来源，随后两侧同法完成27场景。首版日志保留 `no-party-head.log`、`no-party-current.log`，最终日志为各自 `*2.log`，不把该夹具错误列为产品缺陷。

## 本轮运行记录

- 相关整文件批次：**exit0，23文件 / 440项通过 / 2项既有跳过，613.17秒**（tests598.89秒）。日志 `/private/tmp/p1arev2/related.log`，完整可重跑命令 `/private/tmp/p1arev2/run-related.sh`，机器可读结果 `results.json`。
- 集合包含全部6份 party 专项（44条 R1 环境回归、生命周期/动作/跨层/扩展、生产 Worker 的1/4成员255/256/257/2047/2048/2049边界、save/seek/续录），加无 party 字节、火/爆炸/毒/气体/坠落/饥饿/光照/客观时间/终局、食物火、原生属性、U01/U03、反射致死、定向状态及 BoltContract，共17份相关原测试。没有跑无关套件。
- `node scripts/check-module-boundaries.mjs`：exit0，`boundary.log` 明确输出模块边界和测试归属通过。
- `node scripts/check-test-dependencies.mjs`：exit0，687文件，errors=[]，missing 行为0；`deps.log`。
- 上述独立旧探针、control-recheck、27场景无 party 配对、修复前/后传送重叠探针均完成。Vite SSR 的 WebSocket listen EPERM 是沙箱提示，加载/执行实际完成，不作为产品缺陷。
- 结束时再次复算782个生产/工具文件，仍为同一候选 hash，mismatches=[]（`source-final-audit.json`）。原有源码/测试守卫/fixture 均未由审查者改写。

现有测试通过不会关闭 R2-F1；其最小公开命令探针已证明该缺口不在现有覆盖内。

所有运行使用 Node v24.18.0；Vitest 使用 heap3072MiB、单 worker、无文件并行。没有运行完整 npm test/test:ext/drift/full/gen、types/build、性能基准、浏览器或删除布局。本次是规定的第2轮/最后一轮，不建议再开第3轮独立审查；剩余确证问题交作者窄修和维护者按既定流程验收。

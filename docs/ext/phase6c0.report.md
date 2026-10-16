# 6C0 交付报告

2026-10-16。**C0合同准备完成，停在维护者冻结点；未进入C1，未commit。** 开工及结束HEAD为`057abf2a69a35b3c9796b7b2ee15efe018b7a6d8`，分支`ext/phase6`，开工工作树干净。仅文档改动，没有生产代码、测试、配置数据、运行身份或黄金制品变化。

## 交付与裁定

| 文件 | 本次交付 |
| --- | --- |
| [phase6c.task.md](phase6c.task.md) | §10.2登记维护者C-D1..C-D8全采纳，更新授权止于C0、B4-5已关闭、site无入口延期、性能及6Z普通收口；纠正当前world5.schema为5；明确C0无代码门禁范围 |
| [phase6c0-contract.md](phase6c0-contract.md) | §2严格目录/实例/state/收据/编码预算；§3两套8件、累计2/3/4奖励、set权重及set/runeword碎片表；§4孔表、4符文/2词、材料来源/镶嵌/否定/知识；§5工位、C5托管与退款、craft协议；§6part/site及固定随机顺序；§7最小补口/失效/性能负载；§8分步版本身份方案 |
| 本报告 | 开工身份、实际验证、失败轨迹、未验范围与冻结停点 |

维护者已批准的是C-D方向；合同中的具体新增数值、schema和补口细节交本次冻结，不冒称已完成玩法或平衡验收。首批配置只用已有属性节点，不新增职业/槽位/唯一扩编/T7。原8唯一与6B数值曲线保持。

当前源码核对得到三项需明确的事实：

- world5.schema实际为5；任务单旧概览的4已修正，历史报告不改写。
- 宿主收据上限128、当前8唯一+8套装件可复用；配置需同时满足unique+pieces≤128。套装行绑定已装备锚件，继续受24行/件及256行/provider守卫约束，不申请额外共享属性权限。
- WorldWork尚不支持裸原生装备托管，也没有forge/lootRoll；DropItemSpec尚不支持材料；part已有可信破坏但奖励需新增事务事实。G2–G6列后续最小权限、写集、失败回滚及版本影响。site只有类型预留，执行仍requireDungeon；按C-D5延期玩法接线，C4仅协议/拒绝边界，不扩世界地图。

特别冻结语义：套装接纳才占唯一收据；identityKnown区分单行揭示与完整件身份；runewordId仅由完整序列派生，不另落盘；否定保留孔/序列来源且不恢复原生符文；all拆卸是一批n×100tick/n×10片，未完成取消返原装备/未耗材料、已付时间不退；重铸完成时才抽结果，允许变差。craft随C3、part随C4。

## 版本与证据身份

本步运行身份保持：foundation17 / itemSdk2；loot module/rules0.5.0、pack0.2.0/schema1、实例v2/state1；growth1.10.0、crafting1.0.0；world5.schema5/worldSdk1/edibleSdk1；whole-run7/recording4/origin2。未来版本分配见合同§8，未提前改常量。

| 项目 | 身份 |
| --- | --- |
| HEAD:src树 | `55146f6e45b4a02f4c0f01b1e528a78f32416b1a`；工作树src无差量 |
| itemSdk.ts SHA256 | `b69e33f91ac1a2babc582277b613aec5f3fc1badbde4d751addf12505ebbe9e6` |
| worldSdk.ts SHA256 | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| edibleSdk.ts SHA256（入口文件） | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b`；非闭包聚合 |
| stats.ts SHA256 | `e064ecbe6f207f013a57f6da96c3fd1c9ab04ca974e263fe296f04043676fa26` |
| 6B4预算文件SHA256 | `c659a3788e4f53aa8ea20e7a050950b3bb39f990f2fd92863a3f7eecc0ea2e38` |
| loot/data逐文件hash清单的SHA256 | `5b222f79496710f77efecb4cff13d3a3439ac51975e8290759e6c34e982e9e0f`；按路径排序的`[{path,sha256}]`紧凑UTF-8 JSON，不冒充运行pack fingerprint |
| dist / 有效能力目录指纹 | 本步无构建/无新会话，未重新采集；不把现存dist当本步构建证据 |

原始小型日志与逐文件hash清单位于`/private/tmp/phase6c0-057abf2/`。B4-5结论引用[6B4报告末节](phase6b4.report.md#b4-5-维护者裁定关闭2026-10-16)，云端run38860207834由维护者裁定关闭；本步未访问云端、未重新测量。原三轮B校准后无第四次独立回放限制继续保留；C1仍须正常三轮A/B、修订D6和冻结后独立回放。

## 实际检查

事前因果范围：只有三份文档，执行LF/链接/冲突标记/体积与差异检查；已有repo_hygiene验证源码未污染、test_suite_membership验证归属，boundary和静态测试依赖检查为用户指定门禁。没有为文档新增镜像实现的测试，也未选择无关玩法套件。

Node路径：`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，版本v24.19.0；PATH以前述bin开头，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest maxWorkers2。命令在仓库根执行。

| 命令 | 实际结果 / 日志 |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=2` | **exit1，启动失败，未执行用例**；共享node_modules指向仓外，Vite写`.vite-temp`受权限限制（EPERM）；`related.log` |
| 同上加`--configLoader=runner --no-cache` | **exit0，2文件8项通过，17.95s**；skip/todo/unhandled=0；`related-runner.log` |
| `node scripts/check-module-boundaries.mjs` | **exit0**，Module boundaries and test ownership verified；`boundary.log` |
| `node scripts/check-test-dependencies.mjs` | **exit0**，errors为空；`dependencies.json`，stderr空 |
| `python3 /private/tmp/phase6c0-057abf2/check-docs.py` | **exit0**，三份文档本地链接目标、LF、无冲突标记、<1MiB、tracked diff仅文档 |
| `git diff --check` | **exit0** |

首次失败保留；后续仅改变配置加载/缓存位置行为，无测试前提、断言、容差、时限或守卫改动，没有反事实/黄金重录事项。8项是最终一次批次的结果，不与首败重复累加。检索时遇到旧文档路径已更名，已用实际ItemCommands.ts/WorldWork与worldBasics.requireDungeon纠正合同锚点。

本步无代码，依用户范围未跑vue-tsc/build；未跑完整npm/ext/drift、CE/full/gen、组合/全删/单删单留、性能A/B或浏览器。C1–C4的功能、同版本生命周期、SDK类型见证、性能和三档浏览器全部**尚未实施/未验**，不能拿C0静态检查代替。6B既有浏览器和平衡遗留仍按原报告；不声明phase6可发布。

## 停点

C0五项交付已映射到合同：§3.1(1)身份/范围→本报告；(2)目录/成本/来源/RNG→合同§2–6；(3)权威结构/收据/非法组合/体积→§2；(4)权限/回滚/知识/性能→§5–7；(5)裁定/责任→任务单§10.2及合同§8。

**交维护者冻结具体合同后再开C1；本主笔在此停止。** 未commit/push、未运行云端任务，未开启下一子步。

# CHORE-TEST-TIERS 门禁分档调整报告

2026-10-03；工作区 `BrogueJS-newtheme`，分支 `chore/test-tiers`，基点与当前 HEAD 均为 `ff48147`。按已批准的 `docs/tasks/chore-test-tiers.md` 执行；未 staging、commit 或 push。

拆出 27 个实测重型生成普查文件，新增 `test:gen`；常规、普查、基线三组分别为 **244 / 27 / 2 文件**，覆盖仓库全部 273 个测试文件且无交集。现有 272 个测试文件逐字节未改，断言、超时、种子、skip/todo、五份基线/trace 均保持原样；引擎与界面实现未改。

## 实测方法与入选依据

先用原配置完整执行 `npm test -- --maxWorkers=3 --reporter=default --reporter=json --outputFile.json=/tmp/brogue-test-tiers/old-test.json`。该命令启动时已按原配置解析文件集合；随后新增的测试框架未进入该次 271 文件的集合。CE 参照源码已存在，复用同一份本地 legacy 参照。没有同时启动另一套重测试。

环境：Node v25.2.1、npm 11.6.2、Vitest 4.1.11。按 `SCAN_SEEDS`、多层循环、census 等检索执行内容，再结合 JSON 逐用例计时核查主要成本。采用建议阈值：原完整套件中单文件测试时间 ≥60 秒、主体为多种子/多层地图或物品生成普查。下表秒数取 Vitest 文件汇总行（同机 3 workers 下的实际文件测试时间，非逐文件独占 CPU 测量）；普查复测也是 3 workers。

| 文件（均在 `src/test/`） | 原套件实测 / 秒 | `test:gen` 复测 / 秒 | 入选理由 |
|---|---:|---:|---|
| `b1_retire_invented.test.ts` | 127.336 | 144.879 | 16 种子 × D1–D26，统计已建机器并检查退役机器不出现 |
| `b2_transcription.test.ts` | 303.530 | 354.166 | 34 种子 × D1–D26，普查 CE71 机器及实际内容物、连通性 |
| `b_1a_identification.test.ts` | 65.995 | 88.639 | 2 种子 × D1–D26，生成物品落点与双跑物品签名一致性扫描 |
| `b_4a_item_generation.test.ts` | 362.908 | 404.112 | 多组种子整局 D1–D26 物品计量、产量、种类与附魔/符文扫描 |
| `b_4b_item_placement.test.ts` | 159.026 | 161.176 | 多组种子多层真实生成，统计人口物品、金币、钥匙、食物落位与数量 |
| `blueprint_center.test.ts` | 381.523 | 429.849 | 45 种子 × D1–D26，共享真实生成遍历，检查中心、区域 origin 与奖励可取性 |
| `c_0_add_loops.test.ts` | 317.581 | 425.272 | 多种子 × 26 层地形/完整生成反复扫描环路、门位、割点与 loopMap |
| `c_1_room_profile.test.ts` | 159.367 | 177.750 | 5 种子 × D1–D26，反复地形与完整生成，检查房型、布局、环路与深水分布 |
| `c_3_walls_doors.test.ts` | 149.197 | 160.337 | 15 种子 × D1–D26 完整连通扫描及多组地形/门位生成扫描 |
| `c_4a_0_layer_model.test.ts` | 160.763 | 247.626 | 15 种子 × D1–D26，跨层清除事件及重复生成指纹扫描 |
| `c_4a_terrain_catalog.test.ts` | 124.729 | 141.052 | 15 种子 × D1–D26，逐格 cost 分歧普查；保留文件内目录/源码守卫 |
| `c_8_connectivity.test.ts` | 271.642 | 288.804 | 30 种子 × D1–D25，验证双向楼梯可达与生成期连通性 |
| `horde_terrain_spawn.test.ts` | 129.276 | 138.997 | 多组种子 × D1–D26，水生群落出现率、楼梯与物品落点普查 |
| `invented_content_pool.test.ts` | 163.241 | 256.068 | 20 种子 × D1–D26，520 层真实产物检查退池内容为零及类别非空 |
| `p1_26_invariants.test.ts` | 117.183 | 150.595 | 5 种子 × D1–D26，两轮完整生成验证楼梯/可达/确定性 |
| `p1_29_lake_connectivity.test.ts` | 141.158 | 145.935 | 15 种子地形阶段与 10 种子端到端 × D1–D26，湖泊/楼梯连通性 |
| `p1_33_machine_chokepoint.test.ts` | 133.742 | 143.204 | 15 种子 × D1–D26，完整生成机器结构及连通性扫描 |
| `p1_37_machine_flag_i18n.test.ts` | 160.450 | 252.832 | 5 种子 × D1–D26，机器内容与旗标扫描、生成样本存档往返 |
| `u25_machine_observation.test.ts` | 63.367 | 83.265 | 4 种子 × D1–D26，观测开/关两轮生成，逐层比较指纹与完整双随机流 |
| `v_1a_blueprint_items.test.ts` | 65.560 | 88.174 | 4 种子 × D1–D26，两组整局生成检查蓝图直投为零与计量产量 |
| `v_2a_vestibule_return.test.ts` | 96.530 | 113.234 | 4 种子整局 D1–D26，共享生成普查前厅/守卫递归、内容与落点 |
| `v_2b_2b_blueprints.test.ts` | 66.066 | 86.367 | 8 种子 × D1–D26，蓝图产物入池与递归覆盖扫描 |
| `v_2b_4_altars.test.ts` | 107.784 | 119.743 | 多组种子 × D1–D26，强制 CE15/护符唯一性及抽签资格生成扫描 |
| `v_2b_6_keys.test.ts` | 183.979 | 212.863 | 多组种子 × D1–D26，Kennel/钥匙/锁具可解性与携带者普查 |
| `v_2b_7_features.test.ts` | 648.794 | 792.567 | 多组种子 × D1–D26，携钥匙怪/携带指令/机关载体与机器格记录生成普查 |
| `v_2b_9e_2_autogen.test.ts` | 128.454 | 143.417 | 16 种子 × D1–D26，真实机器生成数量、空 interior 与内容覆盖普查 |
| `w_5_arcana_instance.test.ts` | 341.572 | 464.855 | 实际去重后 40 种子 × D1–D26；检查物品类别覆盖及法器初值（标题的 12 种子已过时） |

混合文件按整文件归属：例如 `b_1a_identification` 的两项全层扫描合计 53.709 秒，占原文件 65.995 秒约 81%；其余鉴定与投掷断言全部保留在同一文件。轻/中档仍须定向运行普查文件中的源码守卫，局部规则改动仍须运行与改动相关的全部测试。

以下候选实测低于 60 秒，继续留在常规组：

| 文件 | 原实测 / 秒 |
|---|---:|
| `c_2_lakes_e2e.test.ts` | 45.555 |
| `c_5_fall_subsystem.test.ts` | 28.293 |
| `horde_selection.test.ts` | 14.573 |
| `p1_20_item_placement.test.ts` | 37.470 |
| `t_1_tail.test.ts` | 41.662 |
| `u_19d_machine_families.test.ts` | 38.896 |
| `v_1c_machine_structure.test.ts` | 26.509 |
| `v_2b_5_dormant.test.ts` | 30.689 |

`armor_model_effect`（246.914 秒）和 `monster_stats_effect`（154.181 秒）主要是局部战斗效果/回合模拟，继续留在常规组。UR2/UR3/UR4 黄金 trace 也全部留在常规组。`u_26a_deep_baseline`（原实测 52.653 秒）按基线用途移到 drift，与原浅层基线一起检查两份现有夹具，不作为普查入选；没有重录。

## 命令与覆盖守卫

唯一归属清单为 `scripts/test-suites.json`，显式登记全部测试文件。`scripts/run-test-suite.mjs` 与 `vite.config.ts` 都读取该清单；常规组通过配置 exclude 排除 gen/drift，另两组通过精确 include 选取。`test:full` 使用同一常规组并强制 `BROGUE_REQUIRE_CE=1`。直接 `npx vitest run <文件>` 保留原定向入口，`test:watch` 保留原完整发现行为。

新增 `test_suite_membership.test.ts` 检查未登记/失效路径、重复或跨组归属、真实配置分区和 npm 入口。反例验证：遗漏新增守卫自身时退出 1；正常登记退出 0；追加跨组重复与失效路径分别退出 1（临时清单均已恢复）。最终 `test:full` 定向运行该守卫 3/3 通过，完整常规套件也包含这 3 项。

最终分别执行 `BROGUE_TEST_SUITE=<test|gen|drift> npx vitest list --filesOnly --json`，并与文件系统盘点及清单比较。三个实际执行结果的 JSON 报告再次核对同样文件集合：

| 组 | 文件数 |
|---|---:|
| `npm test` / `test:full` | 244 |
| `test:gen` | 27 |
| `test:drift` | 2 |
| 并集 = 全仓库盘点 | 273 |
| test ∩ gen / test ∩ drift / gen ∩ drift | 各 0 |

新测试必须登记清单；新普查文件须按实测用途登记 gen。守卫负责登记与分区完整性，成本分类仍需读执行路径并实测。

CE 缺失路径也已验证：指定不存在的 `BROGUE_CE_DIR` 时，普通 `npm test` 的定向守卫通过并打印可选 CE 提示；`test:full` 与 `BROGUE_REQUIRE_CE=1 npm run test:gen` 均退出 1，错误为缺 CE 参照。正式普查使用强制 CE 组合，全部对照实际运行。

## 门禁分档

| 档位 | 适用 | 内容 |
|---|---|---|
| 轻 | 纯前端、文案、只读显示 | 类型检查 + build + 相关前端测试 + 所有源码守卫 |
| 中 | 不改规则的消息、显示、日志、自动行动、输入 | 轻档 + 相关单测 + UR2/UR3/UR4 + 录像（u_27、x2a、x3b）+ U03 + drift |
| 局部规则 | 战斗、物品效果、状态、AI 等；不改生成、RNG 消耗次数/顺序、存档/录像格式 | 中档 + 相关全部测试 + test:full + drift |
| 全量 | 生成、RNG 消耗、存档/录像格式；新版 CE；扩展合并 main；打标签 | 类型检查 + build + test:full + 强制 CE 的 test:gen + drift |

局部规则/全量档先 `npm run ce:fetch`；全量的普查组合为 `BROGUE_REQUIRE_CE=1 npm run test:gen`。保留 CPU 争用时原门限单 worker 复核、不改断言/超时/种子、原退出码与复核分列、跳过合并后全量复跑的三项条件。扩展开发说明同步引用四档并明确生成/事务/存档升全量。

## 最终验收与新旧耗时

先后串行执行最终类型检查、构建、完整新常规套件、完整强制 CE 普查、完整 drift；下表为各命令壁钟秒数（含 npm/CLI 启动），测试三组均为 3 workers。

| 门禁 | 退出码 | 壁钟 / 秒 | 结果 |
|---|---:|---:|---|
| 原 `npm test` | 0 | 2451.571 | 271 文件；4830 passed / 0 failed / 8 skipped / 5 todo |
| `npx vue-tsc -b` | 0 | 4.987 | 通过 |
| `npm run build` | 0 | 7.176 | 通过 |
| 新 `npm test` | 0 | 931.628 | 244 文件；4396 passed / 0 failed / 8 skipped / 5 todo |
| `BROGUE_REQUIRE_CE=1 npm run test:gen` | 0 | 2132.807 | 27 文件；436 passed / 0 failed / 0 skipped / 0 todo |
| `npm run test:drift` | 0 | 77.607 | 2 文件；2 passed / 0 failed / 0 skipped / 0 todo |

常规门禁从 **40.86 分钟降为 15.53 分钟**，本轮壁钟减少 **62.0%**。这是一轮同机、相同 worker 上限的门禁对比；机器负载与缓存未作为控制变量。完整验收仍须加普查和 drift，所有原有测试保留。

首轮最终 runner 在类型检查发现新增代码的 `String.replaceAll` / `Object.hasOwn` 与 app 编译库不兼容，退出 2，尚未进入构建/测试；已改成正则 replace / hasOwnProperty.call 后重新冻结运行，最终全链退出 0。原失败证据保留在 `initial-typecheck/`。没有修改编译目标或旧测试。

最终 `src/`、`scripts/`、`public/`、package/lock/config 的 569 个文件在每阶段前后均无变化。前后散列清单 SHA256 均为 `424ca92b1af4d7b66bb26ada84ee3fc6d1168c0dc3ce97f058e71fd01345ecf8`。旧测试 272 文件散列全部不变，五份基线/trace 与 HEAD 字节完全一致；没有旧守卫前提修订、断言翻转或重录。

## 改动文件与证据

- `package.json`、`vite.config.ts`：npm 入口与共享配置分区。
- `scripts/run-test-suite.mjs`、`scripts/test-suites.json`：套件运行器与唯一完整清单。
- `src/test/test_suite_membership.test.ts`：覆盖、分区与 npm 入口守卫。
- `docs/development.md`、`AGENTS.md`、`docs/ext/README.md`：四档门禁及扩展要求。
- `docs/testing.md`：测试归属、CE 组合及两份基线入口。
- `README.md`、`docs/release.md`、`docs/HANDOFF.md`：同步活跃命令与发布/接手步骤，防止旧完整命令漏掉普查。
- `progress.md`：仅将屠戮修复条目的“续轮用户调整验收范围”改为“续轮 Claude 调整验收范围”。
- 本报告 `docs/reports/chore-test-tiers.report.md`。

任务书开工时已是未跟踪文件，保留原样。无 CRLF、无截图或大体积原始证据入仓库；未 staging、commit/push。原始计时 JSON、日志、反例、CE 路径与文件枚举证明均在 `/tmp/brogue-test-tiers/`；小型结论集中在本报告。

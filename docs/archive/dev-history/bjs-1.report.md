# BJS-1 独立项目重构报告

状态：BJS-1 完成。无 CE 全量按任务 §3.4 完成原门限超时复跑后 0 失败；有 CE 最终完整运行及独立 drift 均 0 失败。未提交、未推送。

## 范围与输入

- 入场 HEAD：`3b18cee6aca8efe82882c5f3d20577cdffd82adc`，入场工作树干净。
- 未提交、未推送、未暂存。`docs/` 内仅写入 `docs/archive/`；任务书原样保留。
- 验证副本：`/private/tmp/bjs1-validation`，用 `git clone --no-hardlinks` 新建，再覆盖未提交的最终文件布局；独立执行 `npm ci`，未复用工作区依赖。
- Node `v25.2.1`，npm `11.6.2`，Vitest `4.1.11`；验证日期 2026-09-29（Asia/Shanghai）。

## 迁移清单

以下按原始文件计数，各组不重叠；完整路径、原/新字节数与 SHA-256 见 [migration-manifest.json](bjs-1-evidence/migration-manifest.json)。

| 分类 | 文件数 | 原字节数 | 处理 |
|---|---:|---:|---|
| 上移到根目录 | 453 | 8,429,927 | 源码、原有夹具、配置、公开资源、发布说明及保留的契约数据 |
| 测试数据与可选捕获产物 | 34 | 6,020,268 | 迁入 `src/test/fixtures/traces/` 与 `src/test/fixtures/ce-oracles/<单元>/` |
| 开发历史 | 552 | 7,278,331 | 549 份原开发 Markdown，加 progress、旧子项目 README、旧 gitignore |
| 历史脚本 | 653 | 2,328,811 | 原脚本目录中 649 份未引用文件，以及根目录四份 CJS 转换脚本 |
| 内置 CE | 45 | 2,550,349 | 从受版本控制的树中删除；改用按需拉取 |
| 保留原路径 | 4 | 42,187 | LICENSE、根 README、根 gitignore、任务书；README 与 gitignore 按新布局更新 |

历史文档与历史脚本逐字节保持原样，各自新增阶段/用途 INDEX。`scripts/` 仅保留被 `u_03_whole_run_snapshot.test.ts` 消费的 `u03-state-contract.json`，另新增当前 `ce:fetch` 入口。历史脚本中的旧绝对路径只存在于归档区。

原测试没有读取 Markdown 规格数据的运行依赖，因此无需从报告提取规格夹具；源码中的报告引用统一更新到归档目录。34 份迁移数据中，29 份为读取夹具，5 份为测试显式开启的证据捕获产物。UR2/UR3/UR4 的读写共用新 trace 路径；已有 generation/deep_generation 基线仍在原 fixtures 位置，未重捕获。X4-R1 可选账本输出写入归档后的原 Markdown。

## CE 参照与跳过策略

- `ce:fetch` 默认稀疏、浅拉取 legacy 固定提交 `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9` 的 src 与 LICENSE.txt，规范化到 `.ce-reference/BrogueCE-master/`；SOURCE.json 记录 source/repo/commit/ref/fetchedAt。
- 缓存复用核验远端、HEAD、元数据、工作区修改与关键文件；不匹配时提示 `--force`。强制重拉先在临时目录成功完成，再替换旧缓存。
- upstream 支持默认 HEAD 及显式 tag/SHA，打印测试按 legacy 校准的警告。
- `ceSource.ts` 集中提供 CE_ROOT、hasCeSource、ceFile、readCe，优先使用 BROGUE_CE_DIR。globalSetup 缺源只提示一次；BROGUE_REQUIRE_CE=1 缺源直接失败。
- 缺源只跳过读取 C 源码/源码哈希的用例，固定黄金数据与 Web 行为测试照常执行。跳过名称统一追加 `CE reference source not found; run npm run ce:fetch`。
- U05a 的 41 个动态条目身份单独保存在 ownership-cases.json，仅用于无 CE 时注册全部 skipped 用例；有 CE 时仍使用原 C 表解析。原 inventory 断言及 41 个动态用例断言未改。

完整声明见 [ce-dependencies.json](bjs-1-evidence/ce-dependencies.json)。实际完整无 CE 运行确认：23 文件、74 个 CE skip；另有 8 个既有 skip。共 29 个 CE 读取表达式（包含动态 JSON 来源路径），均经 ceFile 解析。

| CE 依赖文件 | 条件跳过声明数 | 实际 CE skip |
|---|---:|---:|
| `src/test/u_05a_item_ownership.test.ts` | 1 | 42 |
| `src/test/u_09_learning_consumers.test.ts` | 1 | 1 |
| `src/test/u_14a_status_gaps.test.ts` | 1 | 1 |
| `src/test/u_15b2_ring_birth.test.ts` | 1 | 1 |
| `src/test/u_19a_machine_view.test.ts` | 2 | 2 |
| `src/test/u_19d_machine_families.test.ts` | 1 | 1 |
| `src/test/u_19e_machine_families.test.ts` | 1 | 1 |
| `src/test/u_19f_autogen.test.ts` | 1 | 1 |
| `src/test/u_26a_deep_levels.test.ts` | 1 | 1 |
| `src/test/v_2b_9c_effects.test.ts` | 1 | 1 |
| `src/test/v_2b_9d_dungeon_profile.test.ts` | 1 | 1 |
| `src/test/w_10_poison.test.ts` | 1 | 1 |
| `src/test/w_24_wand_catalog.test.ts` | 1 | 1 |
| `src/test/w_25_staff_catalog.test.ts` | 1 | 1 |
| `src/test/x2e_charms.test.ts` | 1 | 1 |
| `src/test/x2g_native_effects.test.ts` | 2 | 2 |
| `src/test/x2m_lighting.test.ts` | 1 | 1 |
| `src/test/x2o_horde_clump.test.ts` | 1 | 1 |
| `src/test/x3_u8c_combat_items.test.ts` | 1 | 1 |
| `src/test/x4_r1_world_catalog.test.ts` | 3 | 3 |
| `src/test/x4_r3_creature_items.test.ts` | 2 | 2 |
| `src/test/x4_r5_content_text.test.ts` | 3 | 4 |
| `src/engine/Combat/BoltCatalog.test.ts` | 3 | 3 |

## 门禁结果

安装、类型检查与构建均在独立验证副本执行：`npm ci`、`npx vue-tsc -b`、`npm run build` 均 exit 0。Vite 仅提示现有 bundle 大于 500 kB。日志见 [安装](bjs-1-evidence/npm-ci.txt)、[类型检查](bjs-1-evidence/vue-tsc.txt)、[构建](bjs-1-evidence/build.txt)。

CE 拉取专项检查通过：legacy 固定提交与缓存复用、upstream HEAD 与显式 SHA、来源/元数据不匹配拒绝复用、`--force` 恢复、非法参数拒绝；另验证了 BROGUE_CE_DIR 优先级和 BROGUE_REQUIRE_CE 缺源失败。全量验证副本单独执行 `npm run ce:fetch` 成功，使用 [SOURCE.json](bjs-1-evidence/validation-ce-source.json) 中记录的 legacy 提交。

无 CE 首轮命令：`npm test -- --reporter=default --reporter=json --outputFile=/private/tmp/bjs1-no-ce.json`；全量及全部复跑期间，验证副本均未拉取 CE。

无 CE 全量已完整结束（4470.73 秒）：239 文件 / 4533 项，4441 passed、5 timeout failures、82 skipped、5 todo。5 个失败全部为原门限超时（4 个 900000 ms、P1-33 600000 ms），没有断言差异；依照任务 §3.4 复跑：B2、C-8、P1-33 在原门限内通过；蓝图中心和 W-5 在低并发轮仍超时，随后不运行其他门禁、以 1 worker 串行复跑，分别 7/7、18/18 通过，各次运行墙钟耗时 835.22 / 723.67 秒，均未改门限。

| 无 CE 超时文件 | 原用例门限（秒） | 最终通过复跑的最长用例（秒） | 文件结果 |
|---|---:|---:|---:|
| `b2_transcription.test.ts` | 900 | 868.22 | 21 passed |
| `blueprint_center.test.ts` | 900 | 833.33 | 7 passed |
| `c_8_connectivity.test.ts` | 900 | 609.39 | 7 passed |
| `p1_33_machine_chokepoint.test.ts` | 600 | 268.30 | 7 passed |
| `w_5_arcana_instance.test.ts` | 900 | 721.24 | 18 passed |

无 CE 有效合并结果：**239 文件，4446 passed / 0 failed / 82 skipped / 5 todo**。这不是声称首轮一次全绿：首轮与每次复跑原始结果均保留。复跑文件的全部用例名称及数量与首轮逐项匹配；逐文件采用结果见 [no-ce-effective-summary.json](bjs-1-evidence/no-ce-effective-summary.json)。

74 个新增 CE skip 分布在 23 个文件，原有 8 skip 与 5 todo 保留；逐文件与名称见 [no-ce-skip-inventory.json](bjs-1-evidence/no-ce-skip-inventory.json)。原始全量结果见 [JSON](bjs-1-evidence/no-ce-full.json) / [日志](bjs-1-evidence/no-ce-full.txt)。

基准口径由 [X4-R6 最终报告 §5](reports/x4-r6.report.md) 复核：默认测试 239 文件、4520 通过，加独立 drift 1 文件、1 通过，合计 240 文件、4521 通过。

有 CE 完整运行命令：`npm run test:full -- --maxWorkers=8 --reporter=default --reporter=json --outputFile=/private/tmp/bjs1-with-ce.json`。2026-09-29 15:17:31 开始，耗时 3066.69 秒，exit 0；**239 文件全部通过，4520 passed / 0 failed / 8 skipped / 5 todo，0 个缺 CE skip**，无需超时复跑。原始证据：[JSON](bjs-1-evidence/with-ce-full.json) / [日志](bjs-1-evidence/with-ce-full.txt)。

随后独立执行 `npm run test:drift -- --maxWorkers=1 --reporter=default --reporter=json --outputFile=/private/tmp/bjs1-drift.json`，耗时 45.68 秒，exit 0；1 文件、1 passed。见 [JSON](bjs-1-evidence/drift.json) / [日志](bjs-1-evidence/drift.txt)。

逐项比对两种模式的用例全名与数量：74 个 CE skip 在有 CE 模式全部变为 passed，原有 8 skip、5 todo 的名称和状态均不变。**有 CE 加 drift 合计 240 文件、4521 passed / 0 failed / 8 skipped / 5 todo，与重构前完全一致。**见 [with-ce-effective-summary.json](bjs-1-evidence/with-ce-effective-summary.json)。

## 静态一致性与残留扫描

- 原 240 个测试文件共 14,124 个 expect 调用，仅归一化迁移路径及 ceFile 包装后逐项一致；原生产 TypeScript 去注释 AST 一致。见 [assertion-audit.json](bjs-1-evidence/assertion-audit.json)。
- 源码守卫 repo_hygiene、p1_30、u24、c_4a 本来就按 import.meta.url 计算 src 根；整体上移后相对结构不变，未放宽扫描范围或断言。
- 生产源码只改注释文档路径，weapons.json 只改 source 元数据路径；原夹具中的来源路径改为 CE 根相对路径，哈希/黄金结果保留。
- 活动 src、scripts、根配置与根文档扫描：0 个旧子项目路径、0 个旧开发文档路径；旧 CE 目录名共 8 处，限 ceSource.ts 的默认根目录（1）及被任务明确要求的拉取/归一化脚本（7）。测试不再自行拼接旧 CE 目录。见 [path-scan.json](bjs-1-evidence/path-scan.json)。
- 原样保留的 docs/tasks/bjs-1-restructure.md 自身包含目标布局及旧路径说明；这是任务原文，不作为活动路径残留改写。docs/archive/ 中的旧路径按归档要求保留。
- 32 份迁移数据逐字节不变；X2e/X2g 两份 JSON 仅改 sources 的路径键，数值与哈希值不变，见 [fixture-metadata-diff.json](bjs-1-evidence/fixture-metadata-diff.json)。原有夹具中的来源路径及 P2-3 note 的报告链接同步更新；游戏数据仅 weapons.json 的 source 元数据路径变化。
- 所有交付文本无 CRLF；历史文档/脚本逐字节不变，LICENSE 与任务书原字节保留。工作区与独立验证副本的 487 个冻结输入一致，见 [final-audit.json](bjs-1-evidence/final-audit.json)。

## 执行过程中的问题

- 沙箱内 npm 有两次因 macOS Keychain `SecItemCopyMatching failed -50` 崩溃；安装与 npm 全量门禁使用经自动审批允许的沙箱外调用。Git 拉取同样需要访问宿主代理。
- 初次误从无依赖工作区调用类型检查，生成 403 份 JS 中间文件；同步后导致一次 479 文件的重复收集失败。已依据同名 TS/Vue 来源精确删除两处副本的中间文件，并重新运行全量门禁；未通过修改断言或排除测试消除失败。
- 部分额外的自动审批查询未在期限内完成；未据此判断动作不安全。长测试复跑改用沙箱内已安装的本地 Vitest 入口（与 npm test 的参数、排除规则和原门限相同），没有依赖未获批准的动作。
- 保留现有测试超时：testTimeout=900000、hookTimeout=120000，以及各用例原有单独阈值。无 CE 超时复跑如上记录；有 CE 最终完整运行没有超时失败。

有 CE 模式的首个 4-worker 沙箱尝试在早期长扫描再次超时后以会话 SIGINT 停止（exit 130），仅作为中断记录保留，不计入完整门禁覆盖。随后按既有 X4-R6 基准的 8 workers、并使用与无 CE 首轮相同的宿主执行方式，从头运行完整 test:full。代码与全部门限均未变化。

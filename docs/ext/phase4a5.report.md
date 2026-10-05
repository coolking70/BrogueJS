# 4a-5 执行报告：3×3 沉渊巨像

2026-10-05。分支 `ext/phase4`，HEAD 保持 `ef2a0f2dbe734b14597db41ad662dc53e333b224`。依据 [任务书](phase4a5.task.md) 执行，未 commit、未暂存、未 push。

已完成第二个正式原创敌人、独立场地与功能验收。生产改动只有 giants 的内容 JSON 和中文 locale；现有底座已支持此次尺寸、入口与完整足迹，因此没有修改底座、Game 字段、命令边界、状态 schema 或公共脚本。

**内容与调参位置**

- [definitions.json](../../src/ext/modules/giants/data/definitions.json)：新增 `giants.abyssal-colossus`，3×3，HP 260、防御 60、命中基数 95、伤害 8–16、移动耗时 200、攻击耗时 100。字形 `C`，石青色 `#789b9c`；没有特殊能力，bloodType/DFChance/DFType 均为 0。岩脊兽数据原样保留。
- [zh_CN.json](../../src/ext/modules/giants/locales/zh_CN.json)：新增“沉渊巨像”名称、远古石质守卫的原创描述，并更新模块简介。所有显示文本沿用 i18n。
- 场地 `giants.abyssal-chamber`：16×12 净空、入口宽 4、D7–14、40% 尝试率、16 个候选、return-to-spawn。出生完整身体离四边至少两格。40% 是尝试率，仍须通过空间与最终出生预检。
- 两个模板 priority 均为 0，沿用 priority/owner/template ID 稳定排序；D7–8 按 ID 先尝试 abyssal-chamber，成功后 stone-chamber 共用同一成功预算并记 budget 跳过。每层所有贡献合计仍最多一个场地。

**专项覆盖与自然验收**

新增 [giants_colossus.test.ts](../../src/ext/modules/giants/tests/giants_colossus.test.ts)，登记于模块自有 test-suites。9 项覆盖普通/简单模式原生 D7 生成、自然路线来源、净空和四格入口、独立完整 fit flood 的 **140 个合法锚点**、避开九格身体的 **183 格玩家连通区域**、入口至上下楼梯的连通、D7/8 竞争与预算、守场回归/追击/完整身体越界拒绝、击败后的存读和楼梯重访不复生、历史血条和显示零 RNG、原生变形选中 3×3，以及完整存档/逐事件回放/seek/读档续录。4a-1/4a-2 原有 3×3 路径、位移、环境和战斗 fixture 全部继续通过。

维护者可在菜单选择**巫师模式、扩展局、仅勾选 giants、种子 `7309`**，自然游玩至最浅允许深度 **D7**。场地左上角 `(16,5)`，16×12；巨像出生锚点 `(23,10)`，HP 260（坐标从 0 起）。固定自动路线共 **402 条真实命令**，region ID144、Boss ID145；同层岩脊兽模板实际记 skipped/budget。

[naturalFixture.ts](../../src/ext/modules/giants/tests/naturalFixture.ts) 的深层路线只读选路，避开火焰陷阱，使用真实移动、搜索、楼梯、等待、装备和进食命令；没有揭图、搬玩家、改 HP、注入怪物或跳深度来捕获录像。单独的普通/简单模式生成用例直接选择 D7 后调用原生生成器，属于**生成诊断**，不冒充这两种模式完整自然游玩至 D7。守场与死亡重访测试有明确标注的诊断定位/击杀布景；真实录像闭环不使用这些编辑。

巫师路线 save/load 保留完整命令来源；逐条 replay 比较事件的扩展检查点、双 RNG 和 cursor，seek 到 0/中间/末尾均无 OOS；读档后真实 wait 的续录保留原前缀并再次完整回放，最终原生怪物、实体图、模块状态和 RNG 一致。原 D3 普通模式路线与全部子集 smoke 的自然 D3 路线保留。

**最终门禁**

统一 Node **24.19.0**（PATH 前置 Codex runtime）、`NODE_OPTIONS=--max-old-space-size=3072`，所有 Vitest 命令 `--maxWorkers=2`。最终同一候选树于 2026-10-05 03:56:34–04:00:31 UTC 串行完成：

| 命令 | 结果 | 命令耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | exit0 | 1.52s |
| `npx vue-tsc -b` | exit0 | 6.48s |
| `npm run build` | exit0；保留已有 >500 KB chunk 提示 | 8.95s |
| 直接相关 Vitest 集合 | **13 文件 / 202 项全部通过**，exit0 | 103.68s |
| `c_4a_terrain_catalog.test.ts -t 白名单` | 1 项通过，29 项由 `-t` 过滤，exit0 | 1.53s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16 子集通过**，exit0 | 65.07s |
| `npm run test:drift -- --maxWorkers=2` | **3 文件 / 4 项全部通过**，exit0 | 49.16s |

相关集合包括全部 4 个 giants 功能测试文件、4a-1/4a-2 四份行为测试、通用场地贡献专项，以及 i18n、硬编码文本、仓库卫生、套件归属守卫。复现 runner `/private/tmp/p4a5-gates.py`；精确命令、清单、退出码、耗时和输入散列见 `/private/tmp/p4a5-final-gates.json`、`p4a5-final-related-files.json`；各门禁日志为 `/private/tmp/p4a5-final-*.log` / `.exit`。

smoke 安装集合为 combat/giants/growth/narrative，遍历全部 16 子集；含 giants 的 8 子集自然至 D3，随后真实游玩、存读、逐事件回放、seek、续录。证据 `/private/tmp/p4a5-final-composition.json`：engine.status=passed、requestedScopePassed=true。browser=not-run，整体 passed=false 是脚本保留的浏览器未验状态，不冒充浏览器全门禁通过。

835 份 src/scripts/配置输入在每项门禁前后逐文件一致，汇总 SHA-256 `07095f911ea003febc06ec9d28be8a367be09e520c75b986a5614cca13dd06ae`；最终只补写本报告。按任务书没有运行完整 npm test、全部 test:ext、removal 或 CE full/gen。没有新增 skip/todo；上述过滤不改测试声明。原始证据全部留在仓库外。

**旧前提修订与 trace 归因**

旧变形测试将原创目录长度写死为 1，新增敌人后实际抽样范围从 1–68 变成 1–69。首轮保持旧断言时该项失败；只回退 `data/definitions.json` 后，原变形测试和旧 D3 trace 同时通过（2 passed、9 项 `-t` 过滤，exit0；`/private/tmp/p4a5-counterfactual.log` / `.exit`）。恢复新数据后，将长度前提改为独立内容包的 `forms.length`，保留“完整启用目录取骰”的断言语义及原无位、状态、位置、ID 断言，没有放宽容差或修改守卫。

原 [natural-trace.json](../../src/ext/modules/giants/data/natural-trace.json) 用原入口 `BROGUE_CAPTURE_GIANTS_TRACE=1 npx vitest run src/ext/modules/giants/tests/giants_trace.test.ts --maxWorkers=2` 重录。逐字段只有 **extensionsHash 一项**变化：

| 字段 | 原值 | 新值与原因 |
|---|---|---|
| extensionsHash | `40a6affc0fb16944adf50df3d810926cb338687c28eac19698140cf914e91c05` | `20c0b82b60b32144cdd91efdf26d76a3ca06c3a985cb2967b1eacc0b28492417`；manifest 中 giants 内容指纹增加第二形态/模板。 |

pack 指纹由 `sha256:66ce9b443decf63c665df4056441d9bb84795d65213b78f929eb5d3d95872991` 变为 `sha256:ce66b49bef4618e9058d2fd755196cc1ba09af0767677d23778f15892280ef92`。D3 的 seed/depth、152 条命令与命令哈希、完整原生世界哈希、双 RNG 的全部字段、region、state、Boss 所有字段均未变。旧 trace 文件 SHA-256 为 `5fbc2814bf7c58e333e08722fac0dc45e0f9c4c5ccaed5904880b7fbec6e1385`，新文件为 `00ec08b193e7a66f3e9d1f4197a8e4b680110eed7af6aa9af44215594c210901`。

新增 [colossus-natural-trace.json](../../src/ext/modules/giants/data/colossus-natural-trace.json) 是独立 D7 夹具，显式记录 mode=wizard；沿同一捕获函数/入口生成，文件 SHA-256 `b1d44ad632256c2ee0f5c534820ed37de0ff829ff71d848d27e231bc60a29e3a`。未启用 giants 的两份浅/深生成基线与既有 UR 黄金 trace 没有重录或修改；最终 drift 严格通过，两份生成基线与 HEAD 字节相同。

开发期首轮新深层夹具碰到火焰陷阱 DF 重入栈溢出；另一个初轮失败是新重访夹具错误假设返层一定落在楼梯正中。前者只回退本步内容数据后仍在原路线复现（`/private/tmp/p4a5-fire-counterfactual.json` / `.log`，断言旧 RangeError/triggerTrap 重入复现的探针 exit0）；后者修新夹具定位并保留 D6→D7、无复生与原状态不变的断言。首次失败日志 `/private/tmp/p4a5-colossus-initial.log`、`p4a5-colossus-second.log` 保留，未当作最终通过证据；最终 9 项巨像专项全部通过。

**限制**

深层完整自然录像路线使用菜单公开的巫师模式；普通/简单模式已验证原生场地与巨像生成，未验证上述自动路线在这两种模式存活到 D7。数值仍是任务书临时值，没有做通关或平衡裁决。火焰陷阱旧重入问题仍存在，本步不修改其生产规则，验收路线避开它。场地沿用有限候选和预算，允许 no-space/budget 跳过。Boss HUD 和隐藏/历史 HP 的引擎与组件契约已测，没有运行浏览器、触屏或截图验收；物理删除及阶段收尾全量门禁留到既定后续步骤。机械 pack 指纹已变化，旧 giants 存档/录像会按现有合同拒绝，不做迁移。

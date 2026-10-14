# 阶段5最终失败修复报告

任务：`/private/tmp/claude-501/-Users-coolking70-Documents------BrogueJS/522f7155-3db2-4bc2-9d6e-c8d191c438ac/scratchpad/p5-final-fix.task.md`。
开工：ext/phase5，HEAD a15c980；保留全部既有未提交集成/政策差量。不 commit/push。
运行环境：Node 24.19.0，NODE_OPTIONS=--max-old-space-size=3072。
结论：原96项未获豁免失败及5个空套件错误已关闭。完整npm与ext仍为exit1，实际结果与负载超时复验分别登记；剩余三项为任务明确批准的非阻塞项。
原始日志与临时单变量回退备份：`/private/tmp/p5-final-fix-20261014/`。

## 已核实的任务书纠正

任务书所列五个文件并非空文件：u_13_combat_math、u_19a_machine_view、x2e_charms、x2o_horde_clump、x4_r1_world_catalog 均有有效测试，只各残留一个空 describe。已仅移除空组，保留有效测试与发现清单，不整文件删除。

## 根因与处理

原候选14文件：336通过/82失败/0skip，exit1（79行为＋3夹具，与原台账一致）。

- ORIGIN：仅回退 `advanceCommand` 的 ORIGIN 驱动差量，原 Q5 两用例仍失败，0过/2败/54名称过滤，exit1；该差量不是确认缺失原因。
- VISIBILITY：仅撤 `finishTransientDisplay` 无flare时普通FOV重算，其他候选保持，原12完整文件396/396通过，0skip/todo，exit0；涵盖原79失败（76行为＋3夹具）。原候选已逐字节恢复。原布景手写可见标记但未重建实际光照/FOV，或Object.create夹具缺实际FOV/LightMap；补齐前提，不撤生产可见性修复、不改断言。
- 对象图：仅回退 narrative2 `definitions.ts`、`data/definitions.json`、`schema.ts`，四组合旧完整图/快照黄金全部精确复现；恢复当前内容仅两个narrative组合变化。原法捕获后逐语义路径核查完整graph585叶及snapshot492叶；仅版本/指纹、五个新剧情flag、D2 cord.mender待放置与派生录像摘要，所有观察点RNG/消息一致。56黄金字段变更登记在[证据](evidence/phase5-final-fix-spatial.json)，不是纯格式豁免。新黄金原4组合已实际通过。
- 后续夹具复测v2：390过/6败；4个旧自动确认布景使用不可能的 false visible/true clairvoyant 组合，改为真正的run续步fixture，保原No零成本、停止、一次决策与回放/seek断言；2个隐藏路段补实际黑暗。v3：57过/1败，唯一为本轮替换误及另一个直接酸攻击资格单测；已恢复原行，随后完整33项全部通过。
- W-5类别清单误把扩展 `MATERIAL` 当原生地下城掉落；与近期ORIGIN/VISIBILITY/SDK/集成无关，属5A2新增类别后遗留旧枚举前提。

## 本次修改清单与保留范围

- 空组清理：`u_13_combat_math`、`u_19a_machine_view`、`x2e_charms`、`x2o_horde_clump`、`x4_r1_world_catalog`仅删空describe；文件/有效测试全部保留，发现清单不需删项。
- 扫描边界：`c_4a_0_layer_model`与`p2_0_seeded_rng`排除test/tests目录及.test文件，生产允许清单与断言不变。
- 初始化：`w_14_obstruction`补LightMap；`w_2_arcana_submission`补FOV/LightMap与既有全可见effect夹具对应实际光照。
- 可见性布景：`dialog_continuations`、`p4_7_player_weapon_geometry`、`slaying_melee_autohit`、`u_02a_rng_snapshot`、`ui_4_glyph_feedback`、`w_18_entrancement`、`x3_u1_movement_safety`、`x3_u2_ally_captive`、`x3_u8b_items`、`x4a_movement_rendering`按原生光照重建；原完整状态/双RNG/决策/回放/seek/不泄露隐藏地形断言保持。
- 清单前提：`w_5_arcana_instance`排除扩展MATERIAL的原生掉落要求；`narrative2_imports`同步已删除的gen入口，完整发现/无重复/无遗漏断言保持。
- 黄金：`phase4a0-single-cell-baseline.json`及20KB变更登记；不修改完整图捕获/比较器、不删字段、不直接替换未知hash。
- 本轮无生产代码改动；临时ORIGIN/VISIBILITY/narrative2回退全部恢复。入场1343源码/配置文件用未改文件及本次修改前备份重建，全部与原候选SHA匹配，既有未提交集成/政策差量保持。

## 定向复测结论

- 原12可见性/夹具文件v2：390过/6败，后续只复验受改两文件与完整图黄金v3：57过/1败；v3唯一误替换已恢复原语句，原33项movement_safety随清理批次全过。其余已过文件没有后续语义改动。
- 清理批次12文件：159过/1败/0skip/todo，exit1，431.09秒；唯一narrative清单尚有第二处旧gen空数组前提。最小同步为明确无gen属性后，完整narrative_imports 5/5通过，exit0。首次退出1保留，不将重叠结果累加或称原批次全绿。
- W-5整文件18项通过，生成普查259.64秒；两扫描守卫、5空组文件、测试归属与仓库卫生检查均通过。
- 两组合完整图新黄金原4项全部通过；断言保持完整graph/snapshot，不删除字段。
- 当前原79行为、3夹具、2扫描、1清单及5空组错误已按受影响文件复测关闭。11超时已在4个文件单worker完整复验关闭。已批准3项非阻塞不重开搜索。

## 最终门禁

完整统一门禁已完成，候选SHA256 `f4542258a60ae235fea408d9c7ab356353fe6e4fcf2df2f87d3faee9b7ef7fa2`。超时复验前后源码一致：

| 单worker完整文件 | 通过/失败/skip/todo | exit | 秒 |
|---|---|---|---|
| combat_combinations | 64/0/0/0 | 0 | 964.06 |
| narrative2_rewards | 46/0/0/0 | 0 | 231.77 |
| blueprint_center | 7/0/0/0 | 0 | 266.42 |
| ext_module_composition | 143/0/0/0 | 0 | 612.74 |

原11超时按任务书归为负载导致；没有性能生产修改，没有改门限/种子/断言。每个文件单独使用`--maxWorkers=1`，原文件全部用例执行，无名称过滤。

原始99失败台账及此前完整npm/ext退出1保留；zombie、giantHit、N2七包900s三项已批准非阻塞范围不扩大。


## 完整npm首次结果（本轮）

`npm test -- --maxWorkers=3 --reporter=default --reporter=json --outputFile=/private/tmp/p5-final-fix-20261014/final-npm.json`：exit1，12439.66秒；604文件通过/7失败/1skip，共612文件；11340测试通过/18失败/9skip/5todo。0已报告unhandled。源码前后相同。

18项=2已批准内容（giantHit与zombie anchor-break）＋1已批准N2七包900s＋15其它超时。15中ext_module_composition 2、combat_combinations 10、narrative2_rewards 2，均位于同一候选已单worker完整全过文件；另giants2_persistence铜巨兽完整续录1项在本批门禁结束后单独复验整个文件，8/8通过、0skip/todo、exit0，379.47秒。因此15项均按任务书归为负载超时，不因复验通过抹掉首次失败。日志最终分组确认这些STACK_TRACE_ERROR均为Test timed out，不是凭JSON堆栈猜测。

本轮未再出现原行为、夹具、扫描、清单或空套件失败。

## 完整门禁实际结果

所有命令串行前台执行并等待结束；Node 24.19.0、3 GB heap。三个Vitest命令均附default/json reporter，完整命令及失败名称见[门禁摘要](evidence/phase5-final-fix-gates.json)。文件数取testResults/文本汇总，不将describe套件数当文件数。

| 命令 | 通过/失败/skip/todo | 文件通过/失败/skip | exit | 秒 |
|---|---|---|---|---|
| `npm test -- --maxWorkers=3` | 11340/18/9/5 | 604/7/1 | 1 | 12439.66 |
| `npm run test:ext -- --maxWorkers=3` | 6316/3/1/0 | 329/3/1 | 1 | 5581.89 |
| `npm run test:drift -- --maxWorkers=3` | 16/0/0/0 | 8/0/0 | 0 | 131.16 |
| `npm run check:modules`（含test dependencies） | 通过 | — | 0 | 9.54 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | — | 0 | 9.67 |
| `npm run build` | 通过 | — | 0 | 17.05 |

完整ext仅剩giantHit、zombie自然出招及N2七包900s三项已批准失败；没有新增行为失败。构建只有既有大chunk提示。两套完整测试没有报告unhandled error；所有门禁前后源码/配置SHA相同。

## 原99条台账处置索引

编号来自[原首败台账](phase5-final-npm-triage.md)，保留首败事实，不覆盖旧报告。

| 原编号 | 根因与处置 |
|---|---|
| 001、030–033、092–096、099（11） | 四个完整文件单worker全过，按任务归为负载超时 |
| 002、034（2） | 扫描误纳模块测试/helper，缩至生产路径，原守卫断言保持 |
| 003–029、035、038–046、048、052–089（76） | VISIBILITY暴露人工布景与真实光照不一致，补齐夹具，完整状态/决策断言保持 |
| 036–037（2） | narrative2内容更新，单变量恢复旧图后原法重录并逐字段登记 |
| 047、049–050（3） | Object.create夹具缺FOV/LightMap，补实际依赖 |
| 051（1） | MATERIAL属于扩展类别，修原生掉落枚举前提 |
| 090、091（2） | 已批准内容缺口，保留失败 |
| 097（1） | 已批准N2七包900s调查，保留失败 |
| 098（1） | 同步已删除gen入口，发现完整性断言保持 |

另5个空describe报错已移除，保留五文件内全部有效测试；它们不计入99条用例失败。

## 诊断记录与边界

单变量VISIBILITY已隔离全部76项相关行为，完整图单变量narrative2隔离另2项；无需再同时撤SDK/集成来猜测根因。W-5的MATERIAL来自更早5A2，属枚举前提遗漏，按新政策无需对纯前提更正另做生产反事实。

完整图首次诊断仅回退两个定义文件，因schema未配套出现INVALID_VERSION；补齐同一narrative2变更的schema后，四个旧黄金全部精确复现。首轮premises-v1误与只读图分析重叠，在修改任何文件前停止（exit130），不列有效验收；随后全部验证按串行前台完成。诊断失败与中断不伪装成通过。

本轮没有增加skip/todo、修改超时/种子、放宽行为断言或改生产代码，没有重开三项已批准调查。浏览器/真机沿用既有人工待验状态，非本任务门禁。既有集成与政策差量已保留，未commit/push。


## 最终遗留与交付核对

- 保留已批准三项：zombie自然出招缺combat.anchor-break、giantHit未命中、N2七包生命周期900s性能调查。未扩大批准范围。
- 完整npm仍记录15项负载超时，全部对应完整文件在同一源码、maxWorkers=1下通过；这关闭本任务的超时归因，不代表三worker全量稳定性已改善。原11项与新15项重叠，不累加成独立失败数。
- 完整门禁及最后giants复验源码SHA一致；21个测试文件＋1份黄金变更，另报告/状态/README与2份摘要证据。无生产修改，原1343文件候选保留核对0差异。
- `git diff --check`通过；本轮新增摘要均小于1MB、无CRLF；原始完整图与日志保留在/tmp，不加入仓库。未commit/push，不宣布阶段5浏览器/真机全面验收。

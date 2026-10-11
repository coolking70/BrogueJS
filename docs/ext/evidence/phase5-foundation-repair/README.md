# 六项修复黄金逐叶登记（2026-10-11）

`golden-changes.json.gz` 是处理后的完整差异登记（157456 bytes，SHA256 `0a35a95b50c48f6e6ddff2854ee227c780506446f4a846c972f61a5dd5401a1c`），保每文件前后SHA、每差异叶路径/前后值/语义字段及归因。解压JSON 1017709 bytes；原始图/完整快照超过1MB，仅临时保存在 `/private/tmp/brogue-commander-20261009-5z/foundation-evidence/` 供维护者R1，不提交原始证据。

只回退生产的旧完整25文件362/362反事实先通过，原测试/黄金未改。三变体为开工HEAD4856505、最终候选仅撤普通FOV分支、完整最终18生产文件。第二与第三仅相差 `finishTransientDisplay` 无闪光普通FOV重算，捕获命令、布景、参数、所有输入和原断言相同。非FOV比较并不凭名称默认只有格式，实际逐叶检查其全部变化仅如下。

| 变体对 | 配对文件 | 总叶 | 完整类别计数 |
|---|---:|---:|---|
| base→nonvis | 290 | 2799 | 格式派生hash2433；foundation13→14 158；world5schema4→5 55；settlement1.3→1.4 100；规则指纹50；wall time3 |
| nonvis→final | 290 | 1051 | 普通FOV isVisible920；可见目标战斗名称72；FOV派生hash56；wall time3 |

可见目标消息仅 `you hit something, catching it unaware`→`you hit the Rat, catching it unaware`，由FOV恢复真实目标可见性引起。所有其余RNG、知识、物品、经济、tick/turn、命令/decision、native物理字段均无差异。wall time是savedAt/recordedAt实际捕获时间差，不作为玩法差异；补充native快照保留savedAt字段并沿原读取边界设0。P4原图编码器的既有排除清单未改，未增加裁字段或改断言。逐叶原递归比较不设排除清单，未归因类别会使登记失败。

原方法：UR2_CAPTURE/UR3_CAPTURE/UR4_CAPTURE及各*_CAPTURE_DIR（UR2/3内容完全不变，保原文件）；P4A0_CAPTURE/P4A0_CAPTURE_DIR；CRAFTING_CAPTURE_TRACE；FORAGING_CAPTURE_DIRECTORY（原naturalCapture选择相同seed与完全相同commands）；RESIDENT_FORMAT_CAPTURE（自然24、俘虏23个原digest cut）；FORAGING_IMPORT_CAPTURE（mounted App原公开39输入，保持历史命令三元组）。原捕获测试使用真实绝对root的临时attribution.config.ts；只读toSnapshot/exportRecording补充原生全快照，不改变驱动或决策。原生成method/source：src/test/u_r2_trace.test.ts、u_r3_trace.test.ts、u_r4_trace.test.ts、phase4a0_spatial_differential.test.ts，模块crafting_trace/foraging_trace/resident_natural/resident_captive_natural及src/test/replay_import_ui.test.ts。Node24.19.0、3GiB、单worker、无文件并发，均run-child+watchdog实际exit0，完整命令/过滤及纠错在实施报告和临时脚本。

自然24/24、俘虏23/23 raw cut全部覆盖；另外保留load/replay初始化0事件D2/D3状态，不能冒充原cut。早期string seed提取无raw、手写cut漏914和四批短暂重叠均明确不当完整证据，已按原法严格串行补齐。最终登记使用补齐后的比较。

黄金仅更新：UR4、P4 compact、crafting/foraging三个final、居民两route的digest、新foundation14原公开39事件导出。不可变foundation13/12/10 raw均保留；新14原导出59162 bytes/SHA `7c2a6f65a8925e62c212ffb08f1d934db48712bdddf51b09a3f18a74b4e3fb7e`。原route除digest和原trace除final之外均逐字段等于HEAD；不修改物理命令、actor ID/HP/location/depth/tick checkpoint。


R1五条巨人黄金补录：`r1-giants-golden-changes.json.gz` 保留base→nonvis→final两边界全部9199叶、原捕获路径/种子/命令/检查点身份及源goldenSHA；未知叶0。格式56、FOV1667（ridgeback14、colossus51、spine60、lantern72、copper1470）、recording派生摘要7413、trace派生hash57、墙钟6。三个natural原快照有undefined，另用V8原值捕获并逐项复算原native/extensions/commands hash；两giants2严格沿原JSON世界方法。三个变体共84原投影hash均核对。所有行动/决定/机械事件和输入保持，D3/D7的cached-level FOV不是格式变化。原始V8及28点每变体完整快照只留/private/tmp执行根，不提交。


R1最终门禁：`r1-gates.json` 是实际命令/退出/计数/源码构建/相关缺五包完整剩余ext的审阅摘要；`r1-failures.json` 原63精确title全部对应passed；`r1-additional-spatial-failures.json` 新增5首败及单项反事实/合法native场景/最小前提修复保原断言。正常226文件唯一并集4314pass/1既有CEskip，不伪称新一次226exit0：原4309/5/1 exit1与修正3完整文件58 exit0及全源码重构证明分别保留。缺五包191完整文件2924pass/1既有CEskip真实exit0，drift14真实exit0。无新增skip/todo/exclude；后续同作者combat2 VISIBILITY补充后才独立R2。

## R2前 combat2 VISIBILITY独立作者补充（2026-10-12）
`combat2-visibility-gates.json`：真实stage/done/退出计数/失败与源身份。原3完整文件未修3fail/1pass；只撤FOV仍同3fail/1pass；修后2pass/2fail——三个seek首败已闭，后置两内容覆盖期望缺口保留，绝不写作4pass。7路线三变体原输入、所有快照点；修后11/12真实存读、所有缓存、非单调seek及续录已到达。主6完整76pass；实际缺五包根5pass；新根单FOV回退5fail，finally源/测试字节精确恢复。
`combat2-visibility-world-leaves.json.gz`：每对2537完整世界点，全125148变叶，格式5074、普通FOV120074，未知0；不裁缓存/知识/RNG等字段。`...recording-leaves.json.gz`：明确格式14/已独立复算的派生hash及recordedAt捕获墙钟；非visibility变体之间只有墙钟差异，录制digest不能替代全世界相等。`...recording-proof.json`：独立ECMAScript JSON/crypto公式7635 root、7572 chain、63实际扩展投影样本。
`...first-leaves.json`／`...only-fov-leaves.json`：原8/8/23缓存首败。`...giant-gap.json`／`...natural-gap.json`：固定原输入无巨兽正伤害、无zombie anchor-break自然释放；三变体原观察hits/releases精确一致，属于原内容fixture缺口；原断言/输入及真实exit1保留，最新用户裁定及补充合同C10已后置combat2集成，不阻塞本次VISIBILITY/R2。
`...principle-audit.json`：7个R1相关文件所有原expect/公开命令AST按序保留，无新skip/todo；须结合已存单变量反事实及合法native FOV语义，不单凭AST或回退通过免责。`...reuse-proof.json`：仅移除新根并还原feed/manifest旧hash即可精确重现R1 2184edaa全部1310 inputs；19生产/所有原黄金及其余源不变，因此复用原R1未受影响完整文件/drift14/原16与64性能、真实无fixture缺包拒档，计数不重叠累加。
`...isolated-identity.json`：明确固定4ea702c内容只装配外部树，公共19生产同主源；原3测试源码不变，仅按原mechanical/digest方法重录已归因的identity/checkpoints。未合combat2；最终集成仍须复验原文件并补当前内容缺口。大原始世界/gzip/log及无效classifier-v1保留执行根，不提交原始证据。

`combat2-visibility-scope-close.json`：同一作者范围收口，仅核22个真实既有done、Vitest完整计数、固定原三个test字节与主source/build身份，不重跑有效门禁。用户combat2-giantHit-scope-decision.md明确后置巨兽接触内容，pipeline补充C10后置zombie自然释放；原完整文件2pass/2fail exit1保留，不skip/删断言/伪称全绿。正式范围内native5＋feed34＋四守卫37=76pass、缺包根5pass，原seed3/47/11/12完整持久化通过。READY仅交父统一独立R2，未整合内容/SDK、未最终全量验收。

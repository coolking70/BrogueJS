# 阶段 2a1：叙事包与执行内核

状态：实现、独立审查、第二冻结树全部云端门禁及本报告所列Mac小浏览器验收完成，等待维护者验收。基线 `fbba5b27e3e3276c36dad84c62b2a66ff48f5d2f`，仅 `ext/foundation`。2a0 已由维护者验收。本轮仅 2a1，不合 main、不打标签、不部署；交付后停止等待，不启动 2b。

## 范围与版本

- `narrative@1.0.0`：独立目录、descriptor、定义数据、显示 manifest、locale、state/input 校验和测试 ownership。底座自动发现，不导入 growth，不声明阶段依赖；默认不勾选
- 机械规则 schema/version 为 `1/1.0.0`，state/input 各为 1；数据 fingerprint `sha256:2795691753c729879804a79bd777591826b0303450ffc27ebf43f7cd1a7dc38d` 独立进入每局 manifest。显示 manifest 自有 `displayVersion`，不把图片字节混入机械数据
- 本步只有纯 schema、条件求值、效果计划、触发器与状态/输入校验。正式 Game 包没有 hooks、玩家 commands、creation command、view/UI contribution。可选菜单说明明确标注尚未接入 NPC
- 第 2b 的世界交互对象、NPC 放置/open/choose/close、时间 gate；第 2c 的全局事实/boot-ready/提交 flush/真实 growth XP adapter；第 2d 的 DialogService/Host 与立绘均未实施。本步不拉 main、不另造弹窗
- 没有新增 Game 实例字段或世界对象 codec，U03 与底座包络/foundation=1 不变。没有地图生成改变，不跑 drift，也不重录基线

## 文件、纯内核语义与配置例子

- `types.ts/schema.ts/errors.ts`：纯数据联合、严格 own-key/有限安全整数/禁止原型键、访问器、非JSON对象、环及过深/过宽结构；未知枚举/字段和引用以稳定 code+path 拒绝。35 个错误码各有独立中文解释与 `textKey`
- `data/definitions.json`：原创“档案守卫/残页”数据例；只有内容与逻辑，没有世界放置实现。`data/portraits.json` 是独立版本占位 manifest；`locales/zh_CN.json` 包含所有数据词条/模块菜单说明
- `conditions.ts`：所有比较、固定短路 all/any/not、事件字段按事件类型收窄，可选玩家公开查询仅接受 level/professionId/lineageId/faithId 四字段。available 中的 null 身份不当成缺能力；错误/异步 provider 响应不能静默降级
- `effects.ts/triggers.ts`：先计划完整因果链，再返回下一份 detached state；stable FIFO 事件、priority 降序/ID 升序触发，同一 effect 列表顺序稳定。counter 溢出、状态/预算/收据错误使整条计划拒绝，暂存消息不会提前发布
- `state.ts/input.ts`：state 只含 schema/revision/lastFactId/flags/counters/triggerReceipts/rewardReceipts/journal；日志按 entryId 去重并保持首次顺序，收据严格 scope/计数/已知 ID/排序/重复校验。open/choose/close v1 仅严格语法解析，拒绝伪造 actor/effect/reward amount/next 字段；它们尚未注册为玩家动作
- `definitions.ts/module.ts/index.ts/descriptor.ts`：纯loader输出来源认证、按实际机械包计算指纹、独立初始化与state验证。没有扩展自己的 Game/RNG 生命周期，模块外也不引用具体 narrative 文件

加载后的包深冻结并有会话级来源认证。plan 同样冻结，保留其原包身份与完整 base-state 内容；伪造/JSON 克隆/跨包/过期 base 的计划不能提交。来源认证和计划登记只验证临时对象资格，不替代任何持久状态。

技术上限与包内较低预算分开：条件深16/操作1024、效果256、派生事件128、会话转移1024、NPC预算256、日志4096、收据65536；原始JSON另限深64/值1000000/字符串16384；按所有集合独立上限保守相加，最大state为413705值、plan为421023值，不会因通用JSON额度早于合法收据额度失败。当前深度有界1–40，仅为纯数据/收据约束，不新增世界地图能力。样例采用较低8/256/64/32/128/32/256/4096预算。schema 静态估算 trigger 与 reward 收据容量，执行沿整条因果链共享预算；root 输入不计入“派生事件”额度。

机械 definitions（含placement）共享全局ID域；node/choice各在dialogue内唯一；portrait manifest与reward receipt各有独立命名域。所有引用仍严格校验。自动story图不管条件真假都必须无环；手动对话环允许，但每节点必须能沿可静态证明的无条件、无效果边到达退出。纯工具cursor达到上限拒绝继续选项，实际会话close/gate留2b。

下面是纯工具/测试调用例子，不是游戏命令入口：

```ts
const pack = loadNarrativeDefinitionPack();
const before = initialNarrativeState(pack);
const plan = planNarrativeChoice(pack, before, {
    factId: 1, depth: 1, turn: 0, kind: 'dialogue-choice',
    dialogueId: 'archive.greeting', choiceId: 'read-note',
}, { dialogueId: 'archive.greeting', nodeId: 'hello', choiceId: 'read-note', transitions: 0 });
const after = commitNarrativePlan(pack, before, plan);
// before保持初始；after含archive.read=true、archive.note日志与skipped奖励收据。
// 没有世界NPC，没有tick/turn变化，也没有XP提交。
```

修改NPC/节点/选项/flag只需改包及其引用/locale，通过loader与纯planner；测试用新增、改名和合法删除的数据验证，不在执行代码检查archive样例ID。

可选奖励缺provider默认为 `skipped/absent`，纯预检也能明确返回 disabled/unsupported-key；这些结果只提交一次固定run receipt。声明 ready 仅生成 `prepared` 意图，`commitNarrativePlan` 明确以 `REWARD_COMMIT_REQUIRED` 拒绝，避免未结算XP被冒称已应用。没有调用旧 `grantReward`，没有growth私有import或真实adapter。

`lastFactId` 是纯kernel局部因果链计数；派生story顺序递增。旧fact回退拒绝，同ID事实不重执行，重复/叉分choice不推进cursor。它不是后续底座全局factId；2b/2c新增持久字段或改变输入/规则语义时必须相应升版，不能把本步state当作已实现完整阶段2。

## 测试与审查

自有三份测试登记在 narrative/test-suites.json，新增底座 `ext_compatibility_diagnostics.test.ts` 登记根清单；共用发现器/模块边界检查已通过。已有模块/引擎测试未删除、未添加 skip、未放宽门限。i18n 静态扫描的旧前提按下节精确扩展，原“缺引用/死词条均失败”断言保留。安装实际narrative后，既有发现式组合测试自然新增 narrative-only 与两模块组合。

2026-10-03 16:04 UTC 最终冻结前整合专项：vue-tsc、6文件156项（含82 schema/25 kernel/6 runtime、诊断、组合与基础生命周期）全部通过，boundary与diff检查通过。该专项不代替以下最终门禁。

专项与两轮独立审查覆盖并修复了：危险definition ID成为record原型键、条件/效果/provider入参别名、state共享数组污染、重复choice推进、异步provider未处理拒绝、无法实现的receipt计数、派生事件预算根事件误计以及高收据配置被通用JSON额度过早拒绝。消息只存在plan中，任何后续错误均无半提交。新增源码只依赖底座及模块自身数据，不导入growth私有文件。

底座 `registry.ts/runtime.ts/compatibility.ts` 与 `Game.ts/App.vue` 做本步相关最小补强：所有录像ext命令只做结构/启用模块/own function注册性预检，payload语义仍由模块validator与实际执行负责，不用当前state gate误拒将来合法输入。保存/录像的missing/version/state-invalid错误点名模块及所需/已装版本；rules指纹差异单独显示。Game保持原布尔接口，可选失败回调将同条本地化诊断传到既有菜单feedback，无新增持久字段。测试覆盖旧玩家/runtime/RNG/事件未被退休或改变，以及三个实际App handler的精确提示优先和generic fallback。

中间实现树出现过尚未落盘的loader认证export导致组合测试失败，以及当前ES lib不支持Object.hasOwn/Array.at等类型问题；均在冻结前修正。早期单次Vitest参数`--minWorkers`不受本仓库版本支持，未启动测试；已改为受支持maxWorkers。以上不算最终门禁结果，最终全量不拼接中间树绿灯。

## 真实组合与物理删除

全部安装子集 `{}`、`growth`、`narrative`、`growth+narrative` 已实际验证真实Game新局、原生游玩、存读、逐checkpoint回放、seek与续录。三个独立副本分别真删 narrative（19文件/3自有测试）、growth（60文件/30自有测试）、两者（79文件/33自有测试），不在开发工作树删除。重新发现后精确移除owner测试，其余测试全部运行；没有空壳、catch import或exclude规避。

每个删除副本先确认与冻结树的2037文件hash相同，实删目录，清理TS/Vite缓存后重建并通过boundary/type/build/ext/完整npm test；删除后的输入在所有门禁前后同字节。随后各自对余下全部子集跑engine smoke：2、2、1组，加正常4组共9组，保存读取、精确双RNG/checkpoint、逐条录像、seek到0/中间/末尾、save后wait续录及回放全部通过；要求已移除模块的旧存档/录像明确拒绝。

删除脚本使用显式engine-only，原结果仍为 `partial-browser-not-verified`；这项标记未被改成浏览器passed。真实浏览器由下面同字节Mac验证补充，范围与限制分别列明。

## 第一冻结树的真实结果

2026-10-03 16:08:10–16:52:20 UTC，2037份输入，hash `14e768add3815a161f810ab9f1223c415474a513c6d81a3da37a3ff1101e2ff7`，前后逐字不变。type/build/boundary通过；ext 55文件1101项全过。完整npm test exit1：299文件通过、1文件失败；5509 passed、1 failed、8历史skip、5历史todo，2325.15s。唯一失败是 `p1_30_i18n_gate` 的死词条守卫，将9个纯数据引用及35个类型化错误词条误视为未引用，因为旧扫描器只识别t()和两个descriptor字段。三个真实删除轮尚未启动，无中断或失败被写为passed。

修正只涉及 `src/test/i18n_scan.ts` 与其现有测试：发现已安装模块的真实data JSON，识别有限本地化字段；对实际textKey表达式使用有限字面量类型集合展开，不能用宽泛前缀认领整个locale。注入未引用词条仍dead、引用缺key仍missing，开放字符串模板不能通过；测试/locale自身不当作引用，物理删除模块后不残留引用。它维护“只改数据”的当前设计，不制造虚假t()调用或删词条过门禁。生产字节不变，仍须对第二冻结树完整重跑，不用定向测试拼接绿灯。

## 第二冻结树最终门禁

2026-10-03 17:03:36–19:51:35 UTC，Node24.19.0/npm11.9.0、3072MiB堆、2workers。完整门禁严格串行；保留现有CE缓存供默认npm test自然使用，无fetch/full/gen，地图生成未改，不跑drift。

| 树 | 实际命令 | 结果 | 墙钟耗时 | exit |
|---|---|---|---|---|
| 正常 | `npx vue-tsc -b` | 通过 | 25.69s | 0 |
| 正常 | `npm run build` | 通过 | 30.21s | 0 |
| 正常 | `node scripts/check-module-boundaries.mjs` | 通过 | 3.48s | 0 |
| 正常 | `npm run test:ext -- --maxWorkers=2` | Test Files  55 passed (55)；Tests  1101 passed (1101)；Vitest 252.30s | 253.04s | 0 |
| 正常 | `npm test -- --maxWorkers=2` | Test Files  300 passed (300)；Tests  5515 passed | 8 skipped | 5 todo (5528)；Vitest 2270.08s | 2271.06s | 0 |
| 删 narrative，保留 growth | `node scripts/check-module-boundaries.mjs` | 通过 | 4.09s | 0 |
| 删 narrative，保留 growth | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | 25.95s | 0 |
| 删 narrative，保留 growth | `npm run build` | 通过 | 28.18s | 0 |
| 删 narrative，保留 growth | `npm run test:ext -- --maxWorkers=2` | Test Files  52 passed (52)；Tests  986 passed (986)；Vitest 245.82s | 246.80s | 0 |
| 删 narrative，保留 growth | `npm test -- --maxWorkers=2` | Test Files  297 passed (297)；Tests  5400 passed | 8 skipped | 5 todo (5413)；Vitest 2263.59s | 2265.07s | 0 |
| 删 growth，保留 narrative | `node scripts/check-module-boundaries.mjs` | 通过 | 3.65s | 0 |
| 删 growth，保留 narrative | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | 20.58s | 0 |
| 删 growth，保留 narrative | `npm run build` | 通过 | 26.86s | 0 |
| 删 growth，保留 narrative | `npm run test:ext -- --maxWorkers=2` | Test Files  25 passed (25)；Tests  555 passed (555)；Vitest 195.82s | 196.70s | 0 |
| 删 growth，保留 narrative | `npm test -- --maxWorkers=2` | Test Files  270 passed (270)；Tests  4969 passed | 8 skipped | 5 todo (4982)；Vitest 2144.34s | 2145.35s | 0 |
| 两模块全删 | `node scripts/check-module-boundaries.mjs` | 通过 | 3.54s | 0 |
| 两模块全删 | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 通过 | 17.62s | 0 |
| 两模块全删 | `npm run build` | 通过 | 25.11s | 0 |
| 两模块全删 | `npm run test:ext -- --maxWorkers=2` | Test Files  22 passed (22)；Tests  441 passed (441)；Vitest 162.76s | 163.59s | 0 |
| 两模块全删 | `npm test -- --maxWorkers=2` | Test Files  267 passed (267)；Tests  4855 passed | 8 skipped | 5 todo (4868)；Vitest 2294.49s | 2295.40s | 0 |

每组ext均0 skip/todo/fail；每组完整npm test均8历史skip/5历史todo、0 fail。无FATAL/OOM、未处理错误或worker异常。构建仅保留已有大chunk、npm代理配置/新版提示。精简原文见 [证据摘要](evidence/summary.md#阶段2a1叙事包与纯执行内核)。

2037份冻结输入hash `f3b04aaa8c2d733219117a922fcbdc056eac68daa8e389833666abf6a1d485cf`，整个长门禁前后完全相同，三份删除副本前后也相同。第一树到第二树只改两个测试文件和本报告，其余2034文件同字节；所有最终门禁结束后仅更新交付文档与证据摘要，没有再改生产/测试树。原日志/完整hash/副本留云端仓库外 `cloud-extension-evidence/phase2a1-final2-20261003T1703Z/`；首轮失败证据另存 `phase2a1-final-20261003T1608Z/`。

## Mac小浏览器验收与限制

使用云端构建的normal、without-narrative、without-growth、without-modules四份static dist；没有在Mac开发、build或跑长测试。归档2,854,705字节，SHA256 `bdbdb3a9a5b78a969fde1218a963db7a3cff4da5e56207c96938779953e1c64f`。四份dist共80文件在Mac开始/结束核对通过，第二树重新生成的全部80文件也与QA包逐文件完全一致。

- normal四组合实际菜单开局、wait、保存读取、短录像单步均通过；tick/turn/位置/模块state/双RNG一致。空集另验读档续wait到2事件及Home/End seek。narrative-only不出现growth构筑、NPC或对话UI，符合内核阶段
- 三个删除构建的模块选择器正确。真实文件选择器导入小型原生录像：缺narrative显示要求1.0.0，缺growth显示要求1.4.0；version负例显示narrative要求9.9.9/当前1.0.0；state-invalid明确点名narrative。旧player/runtime引用、完整snapshot机械部分和双RNG保持，排除savedAt与诊断logger；没有静默剥除缺包状态
- 取消选择/取消双模块构筑保持旧局。390/320宽选择器说明可换行、无横向溢出、返回可达；实际尺寸以CDP验证（常规viewport工具该轮未生效）
- 9组补充built-Game probe通过，四页面无报告console错误；这是直接运行真实构建引擎，不把probe写成完整UI流程
- 删除构建没有逐一重做完整菜单存取/回放链路，主要由其实际选择器/导入诊断与built-Game probe覆盖；未测真实手机触摸、异常chunk。未重跑无关六布局或native-confirm，不改变先前阶段的未验证项

Mac使用Codex IAB，UA Chrome/154.0.0.0；不从UA推断实际硬件/系统版本。首轮一次工具调用约19.3分钟延迟，无产品错误证据，后续小调用恢复；四个localhost端口8871–8874、标签页已关闭，viewport/动画还原。Mac报告 `qa-2a1/mac-phase2a1-browser-qa.json`，22张截图索引 `qa-2a1/evidence/screens-index.json`，截图仅留Mac，不提交仓库。

四份最终dist hash（排序逐文件path/SHA组合）：

- normal（24文件）：`e73400c2bb53a43d40c0f0a12b98f17d8bb330ebc61ec4a960a2bc38bdde3237`
- without-narrative（24文件）：`316cec3a4da84289da616f565453c0bd04c30c92e27dd21fbbaa7c80be213362`
- without-growth（16文件）：`008494e978afb7d3ecc87b8f85fecf778ec64fd6763fb704cc87e35d361f4135`
- without-modules（16文件）：`8292a06c1f8440012db23e192318179a8c25bfec994c424518733c0ebb73b22a`

## 交付边界

已选四A仍是阶段2方向：免费对话全世界冻结；NPC固定可穿行非战斗；首版flags/log/events与可选XP；不做重世界效果。本步只落2a1纯包/内核，未把A方案的2b/2c能力提前宣称完成。2d仍需维护者提供main的D1统一DialogService/DialogHost提交后按需复用，本步没有合main或新增弹窗。没有热启停、旧版本迁移、真实奖励提交、全局事实flush、NPC放置或正式对话UI。

本次交付仅foundation commit与相对基线的验证git bundle。云端已知无GitHub认证，不重复push；由现有Mac轻量发布流程处理分支。交付后停止等待验收，不自动进入2b或其它阶段。

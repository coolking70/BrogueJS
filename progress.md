Original prompt: 按 docs/tasks/ux-1-playtest-remediation.md 整改八项人工试玩问题；用户在 2026-09-29 明确要求停止定时任务并启动合适子进程开发。

- 2026-09-30 新授权 LAVA-1：修复录像种子437995121 D4熔岩断路与手动/自动墙角规则不一致。复用空闲工作树，切到codex/lava-connectivity（main ee51a11），原UX工作已合并。任务书docs/tasks/lava-connectivity.md；先失败回归，再生产修复，完整门禁与浏览器验收。用户没有授权本轮发布。

- 自动化 broguejs 已暂停。
- 原门禁已结束，三个超时项及 drift 串行复核均通过于独立 playtest-remediation 工作树，源码前后哈希相同；证据 /tmp/broguejs-ux1-baseline-20260929/state.json。
- 开发在本 playtest-fixes 工作树、codex/playtest-fixes 分支进行。
- 开发期间不并行跑重门禁。主线程负责 App/MainMenu/翻译、浏览器验证与集成；子进程按分配文件实现。

- A/B/C/D/E 首轮实现已集成；实际Vue/Pixi浏览器保存/导出/导入/读档与双横竖屏模拟麻痹死亡流程通过。36组窗口/指针/UI大小组合日志末行可达；有效CSS视口缩小模拟重排，未声称控制原生浏览器工具栏缩放。
- 寻路纯网格长路径约2.1–6.1倍；3248网格完整回调/路径等价。D1/D3/D4/D5完整应用采样无证据将D4卡顿归咎于渲染。
- 交叉review发现并处理菜单反馈对自动行动的扰动（实际浏览器反例true→false）及幻觉显示RNG污染（UI子进程处理中）。
- 构建和32项源码/i18n/显示/导出边界定向检查已过。最终完整门禁待生产冻结后串行执行；不并跑重套件。
- 幻觉绘制改用独立显示流，改前新回归2/2红、改后含旧seeded RNG/R1守卫53/53绿；实际浏览器双流不变且显示流前进。生产已冻结，最终runner会话34201，状态/tmp/broguejs-ux1-final-20260929/state.json；请只跟进这一轮，不重复启动。

- 首轮完整npmtest退出1：244文件通过/2失败；4478测试通过/2失败/89 skipped/5todo，2946.44s。生产哈希前后相同。p2_2_real_speed两处输入事件计数失败由录制有效性标志误兼作收集开关导致，recording_impl修复；x3_u5_ui旧手编译SFC夹具缺新Input依赖，death_perf_audit做单变量反事实后仅修前提。原日志保留/tmp/broguejs-ux1-final-20260929/。修复后用同一完整Vitest集合的test:full（启用CE）统一复验，再drift，不另重复同集合的普通npmtest。
- 首轮失败已修：runtime.origin仅控制输入收集，complete来源独立控制导出；原p2_2 D1/D2不改，小套39过/2历史skip。X3-U5仅补真实Input模块映射和document.querySelector前提，7过；单变量反事实日志已保存。真实UI再验放大后的点击移动/投掷、8事件续录独立回放零OOS、存储失败回退及触屏死亡全部通过。
- 最终CE完整复验已启动，会话62586，/tmp/broguejs-ux1-recheck-20260929/state.json；build→ce:fetch→test:full(同npmtest完整集合，CE强制启用)→drift，3worker，无并行其他重测试。源码再次冻结。

- 最终验收完成：build/ce:fetch/test:full/drift全部exit0。CE完整套件246文件、4563passed/8历史skip/5todo；drift1/1。最终源码前后哈希fd39aa0ccebbe81b6ad2e5ebf68976c47389f3b54629c917066c591c29d1f52a。首轮全部失败已在完整套件中恢复，不是定向拼接通过。
- 本轮无需继续实施；剩余非阻塞验证是原手机现场、自然长局D4卡顿和原生浏览器工具栏缩放实机普查，详见known-issues及汇总报告。自动化保持暂停，未提交/推送/发布。开发预览http://127.0.0.1:5393。
- 最后标准客户端Canvas读回偶现全黑，属于采证路径缺口；已用浏览器页面合成截图再次跑完整集成流程，全通过且已查看正常地图截图，证据/tmp/broguejs-ux1-browser/final-integration/。基线对照Vite5394已停止；开发Vite5393保留供用户试玩。
- LAVA-1：先红后绿，新11项回归通过；原种子D4安全楼梯路线修复。仅回退3个行为生产文件，旧5份基线/trace全部精确通过，新9项回归失败；恢复后按原方法重录两份生成基线+UR3（逐叶登记docs/reports/lava-1-fixture-diff.json），UR2/UR4未改。真实浏览器揭示地图/移除怪物隔离几何，鼠标路径45步下到D5，HP500未降；键盘墙角拒绝不耗时/RNG，移走墙后可斜走，控制台零错误，截图已查看。标准客户端Canvas读回仍黑，已重跑有头并以页面合成截图采证。完整冻结门禁会话19873，状态/tmp/broguejs-lava-fix/gate-state.json；不要重复启动重测试或改生产代码。
- PERF-2只读定位：新录像seed438036894的632命令零OOS；独立有头WebGL场景对照确认出生房间由火把闪烁驱动大量TextStyle.fill更新/文字纹理重建，关闭水面舞动无改善，固定火把随机颜色或阻断fill更新则恢复流畅。按帧计数的自动探索/回放放大掉帧。旧主仓回放2600命令零OOS，D4另有怪物A*尖峰，不能统一归因。报告docs/reports/perf-2-spawn-stutter.report.md；探针和截图只在/tmp/broguejs-stutter-investigation，未改生产/测试/脚本，已停止临时5396预览，5395保留。
- LAVA-1冻结门禁尚未结束：目前blueprint_center用例e及monster_stats_effect配对聚合出现非超时失败，最终断言堆栈待full结束；不要视为环境超时。后者日志legacy1050次预期攻击仅257次掉血，旧采样策略未检查实际墙角且可能反复将被拒命令算作miss，需要门禁结束后做仅回退生产的反事实再裁决，不能放宽命中率断言。blueprint用例e需先核实正例覆盖/真实违例，再归因。run-gates.py会在full退出后继续drift，必须等待全链结束后才能改src/scripts或启动重测试。最新生产/测试/脚本哈希核对仍等于冻结值86a1f676f5876accd161f2bebed8218cbf481ee50956ffe69050278294dd2947。尚未合并、推送或宣告LAVA-1完成。
- 更新：首轮完整门禁全链已于北京时间2026-09-30 12:15:10结束。full exit1：238文件通过/9失败，4562测试通过/12失败/8skip/5todo；drift exit0 1/1。前后冻结哈希相同。用户询问状态后已告知并继续已授权整改。九文件失败均非超时；详细名单/分类见lava-1报告及gate-full.log。仅回退三个行为生产文件的反事实正在执行：会话37487、/tmp/broguejs-lava-fix/isolate-guards.py、old-guards-state.json/old-guards.log；runner finally自动恢复新生产字节，完成前不改测试/生产、不跑其他重测试。不要忘记此时工作树生产暂为旧版本。临时自然机器捕获探针已写/tmp/broguejs-lava-fix/capture-new-machines.test.ts，尚未复制入测试目录或执行，须反事实结束恢复新生产后再用。

- LAVA-1 收口：9 份旧失败文件仅回退生产全部 101 项通过；新 Connectivity + 旧移动的进一步隔离 3 项通过并恢复生产。按证据修正局部战斗/饥饿策略和 CE47 测试 BFS 的墙角合法性，不改断言；正在定向验证，并继续自然机关采样。用户已授权按计划继续渲染优化、统一门禁、计时与 D4 寻路定位。

- PERF-2 地形字符改 tint，同条件无重测试争用：出生 19.28→60 FPS，纹理 2501→172；三场景 RNG 未变、截图已查看。实体光晕/投射物保持原样。统一门禁尚未启动；自然机关采样仍在进行。

- 自然 CE21/35/7/52 新样本通过；CE55 新样本证明测试侧需允许 CE 的斜向拉杆，并在原 350 步内观察全部开启。U19f 三项原断言全通过；新增 bump 顺序回归，LAVA 共 12 项通过。普查仅追加正例，不移除原种子。正式定向复核运行在 /tmp/broguejs-lava-fix/adjusted-guards-state.json，源文件已冻结。

- 定向复核 13 文件/194 项全通过，退出0，前后哈希 dded29119ebd3e2fcfd9355ff3bf7da58c33c4d8b4e762cb09503d10a0659cfe。统一门禁在 /tmp/broguejs-lava-fix/combined-gates/gate-state.json，runner会串行 full→drift；build/CE fetch 0，full 尚运行，W-5 生成普查出现新失败，需收尾后读取真实错误再按原门限复核。不得修改冻结源码或同时重跑。


统一门禁于北京时间 2026-09-30 18:25:45 全链结束：build/CE fetch/drift 均退出 0；full 退出 1，245 文件通过、2 失败，4573 项通过、2 失败、8 skip、5 todo，6361.88 秒。两份失败的最终错误均为 Test timed out in 900000ms（blueprint_center 用例 b、W-5 generated results），原 12 项行为失败在本轮全部通过。冻结前后源码/测试/脚本哈希 dded29119ebd3e2fcfd9355ff3bf7da58c33c4d8b4e762cb09503d10a0659cfe。正在原门限、单 worker、不并行文件复跑两份完整文件，证据 /tmp/broguejs-lava-fix/combined-timeout-retries/；此时不能称完整套件退出 0。


两份超时普查原门限串行复核全通过：blueprint_center 7/7、537.27 秒；W-5 18/18、485.49 秒。前后冻结哈希相同，证据 combined-timeout-retries/state.json。完整套件实际退出 1 与串行复核退出 0 分开记录，不称完整套件一次全绿。

- PERF-2 计时阶段实现：新增 15 项通过、构建通过；真实键盘暂停/重启/后台与 632 条自然录像显示时钟重放零 OOS，截图已查看。中档冻结门禁会话48435，/tmp/broguejs-stutter-investigation/cadence-medium/state.json；不要改 src/scripts 或并行重测试/浏览器，结束后再执行 D4 查询探针。

- 计时中档 build/710 项/ drift 全过，哈希 c61d7adb... 一致。D4 实测四次幽灵刀刃无路查询：5609→1351/1352 次读，约 10.6→3.6ms；已仅加 NPC 查询内缓存，两处真实 AI 先红后绿，56 项通过。旧基线注入缓存 2600/2600 零OOS，当前632/632再验零OOS。最终中档冻结会话91157，/tmp/broguejs-stutter-investigation/npc-final-medium/state.json；只跟进本轮，不改源码/脚本或并行重测试。临时旧5396预览已停止，5395保留。未合并/推送/发布。

- 最终中档首次因新增测试误用不存在的 MonsterState.ALLY 在构建停止（未跑测试），证据保留 npc-final-medium-initial-type-error/。本项目盟友身份由 isAlly 独立表示；夹具改为 HUNTING + isAlly。仅回退 Monster 生产文件，两项重复读取断言失败；finally 逐字节恢复后 56 项通过。重新冻结门禁会话14167，npc-final-medium/state.json；build 已退出0，53文件中档运行，哈希 a7491c67b5011b12a7f095a87a0e7d0f096c15aea724294c6ac64bfebe3a8d87。只跟进这一轮。

- 本轮授权计划全部完成。最终 build / 53文件987passed（8历史skip）/ drift1项全部exit0，于19:57:43结束，前后源码哈希a7491c67b5011b12a7f095a87a0e7d0f096c15aea724294c6ac64bfebe3a8d87一致。最终状态npc-final-medium/state.json；无需再启动测试或重复实施。原full两项超时及串行复核的实际退出码分开保留，未来合并/发版需按规定补验。主仓干净；本分支未提交/合并/推送/发布。HANDOFF/known-issues及两份报告已同步。5395预览保留，无需自动化，旧5396已停。

- 2026-09-30 UI-LAB 新授权：获取远程 a4a48e3（基点 ee51a11），本地整改保存为 26ee897。独立工作树三方合并，生产冲突仅 GameCanvas/Monster；保留毫秒节奏+tint，整合 retained/coalesced 绘制，NPC 采用紧凑单查询数组，保留两套独立回归。任务书 docs/tasks/ui-lab-integration.md；最终合并门禁尚待完成。

- UI-LAB 合并验收：定向19文件143项通过；真实三主题四地图状态不变、背包字母、日志、缩放、行动节奏、模拟双横竖屏触屏、保存/JSON导出、632条用户回放0OOS，控制台无错误；Pages实际基路径资源200。诊断原固定计数由三生产文件反事实1326/204归因后精确更新1309/212；重寻路目标新254回合13.51ms→7.35ms，Map与数组接近。完整报告 docs/reports/ui-lab-integration.report.md。即将冻结生产/测试/脚本，两个workers与4GB堆运行一轮完整CE门禁+drift，不并行重探针。

- UI-LAB 最终冻结7877a38门禁一次完整通过：Pages build0、cefetch0、full0（258文件4633pass/8历史skip/5todo，3367.30s）、drift0（1/1，25.81s）。前后代码/测试/脚本/资源SHA2568aa0e25c60043787e6a2a9558bc975d48ef5ac3a6e415232cd44c3b85c08767a。两旧超时普查本轮直接通过，无复跑。最终只写文档；main重新fetch仍ee51a11且干净，待快进推送并核查Pages。

- 2026-10-01 CAPTIVE-1：用户反馈俘虏无原版锁链。复用空闲干净工作树，切codex/captive-chains，main 997872f已发布。CE legacy/upstream 均确认生成时四组方向锁链、笼内俘虏例外、救出后地面链锚留存。根因spawnHordeAt漏生成步骤且6种方向误标缺位。先红5/7，补齐后新8项通过；构建显露旧C7完整光源夹具需补新地形，待反事实后仅补前提。任务书docs/tasks/captive-chains.md。
- CAPTIVE-1归因：仅回退生产的build及原3份失败文件7项全过；UR3同口径原哈希输入与黄金trace相等。新旧120快照逐叶4076变化仅链锚表层/结果地形/菌林覆盖后的透明性/重访记忆，非地图数据与RNG均未变。按原方法重录浅层基线37个指纹与UR3，深层/UR2/UR4未变。仅补C7新6项光源前提和图形目录精确214数量；断言/容差/超时/skip不变。报告及diff账本在docs/reports/captive-chains.*。临时捕获探针已移出测试目录。

- CAPTIVE-1最终显示87项通过；四份旧目录/外观失败文件仅回退生产时100项全过，保持旧135投影、精确更新214目录并补CE独立六项外观。真实键盘/鼠标救出、四模式锁链、响应式横竖窗口验收通过，截图已查看。冻结门禁会话75648，/tmp/bjs-captive-chains/gates/state.json，前置SHA256 d6c9838f90a9c33f78475d76dd5cf3494d14b08c56b58fa7d5ec8e578175745f；不改src/scripts/public/config、不另开重测试，待full及drift最终退出。

- CAPTIVE-1首轮全链结束：build/ce-fetch/drift exit0，full exit1（257文件通过、2失败；4642pass/3fail/8历史skip/5todo），前后冻结哈希相同。三项非超时，分别是C4a0新增地形期望缺失、Map直接写入违背原白名单、C4b F3缺新链锚组合。生产反事实原相关6项通过后恢复。保持写入白名单不变，把Map帮助函数改为纯选址、Architect原地形生成所有者负责写入（运行中曾计划放Game，该入口不在白名单，最终采用Architect）；CE六项期望补齐，F3仅准许FLOOR/空LIQUID/空GAS。build与定向19项通过，新回归共13项；重构后UR3/生成基线2项精确通过，无需重新捕获。

- CAPTIVE-1最终浏览器复验全过，四模式/键盘及鼠标救援/双RNG状态不变，实际合成截图已查看，控制台零错误；手机尺寸仅响应式模拟。第二轮完整冻结门禁 /tmp/bjs-captive-chains/final-gates/state.json，2workers/4GB，build→cefetch→full→drift；只跟进这轮，不改生产或并行重测试。

- CAPTIVE-1修复完成：最终会话83665，build/cefetch/full/drift均exit0；259文件4646passed/0failed/8历史skip/5todo，3359.65秒；drift1项，25.68秒。北京时间03:14:34结束，前后SHA256 64b47a05cdb15a78ee4f0451ab43cabdb072f2b7aad4d195c557b2d2e14c57c2一致。首轮3项失败在完整集合均恢复，不是定向拼接。最终仅补文档，main997872f干净；修复保存codex/captive-chains，未合并/推送/发布。5395预览保留，旧存档已生成楼层不迁移。无需重复开发或测试。

- CAPTIVE-1后续合并授权：用户明确要求合并推送。fetch后origin/main仍997872f，修复分支干净且源代码散列与完整全绿门禁一致；fb79ace已快进main。只补合并交接文档，再推送由已有Pages工作流部署，不重复运行完整套件，不创建新版本标签。

- 2026-10-02 EXT-0 新授权：独立任务克隆 main 3c1407f，ext/foundation；完整阅读 docs/ext 路线/两参考、AGENTS、HANDOFF/architecture/development/testing。实现按开局启用的注册表、生命周期、只读事件 DTO + 模块 JSON/通用生物组件、命令边界、独立存档和录像包络/命令检查点；经典运行时为 null，不调用模块。新增13项回归与原main精确RNG夹具，旧测试/trace/基线未改。桌面/手机模拟浏览器自然21命令击杀、存读档/回放与版本拒绝通过，截图只在/tmp/bjs-ext-browser。阶段0完成后停止，未开始阶段1；最终四项门禁待冻结执行。

- EXT-0 cloud migration WIP: user requested cloud development/testing to avoid local CPU contention. Stopped only task runner/tests; vue-tsc/build passed on source9a2519d, full npm test interrupted with 3 melee failures reported, drift not started. Two unbound attack-call references corrected without local retesting. Current source934bb0f; see docs/ext/cloud-handoff.md. No stage1 or main integration.

- 2026-10-01 UTC EXT-0 云端完成：从ed8d270接续ext/foundation，旧近战24项恢复通过；修复过期context、继承命令、损坏存档历史、超宽RNG区间4项边界，新增6项后共23项扩展回归。最终vue-tsc/build/完整npm test（262文件4594pass/83skip/5todo）/drift全部exit0，冻结前后源码SHA256 7b653cc1288d62b11c350e9238451373fb7861ea7e1859e56b33b90e6abff9a0一致；原断言/trace/基线未改，无CE获取。最新main ad3e902仅只读预览，JSON与进度各1冲突，未集成；最终报告docs/ext/foundation.report.md。停止阶段0，等维护者审核，不进入阶段1。
